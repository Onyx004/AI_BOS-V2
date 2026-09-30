import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { getApiBaseUrl } from "@shared/lib/env";
import type { DocumentShare, ManagedDocument, SupportedFileType } from "./documents.types";

type DocumentsResult<T> = { status: "ok"; data: T } | { status: "forbidden" } | { status: "error" };

type BackendDocument = {
  id?: string;
  _id?: string;
  name: string;
  type: SupportedFileType;
  folderId: string;
  size: string;
  ownerName: string;
  tags: string[];
  sharedWith: DocumentShare[];
  versions: { version: string; author: string; date: string; note: string }[];
  previewText: string;
  updatedAt: string;
};

async function getSessionHeader(): Promise<Record<string, string>> {
  let session = getStoredAuthSession();
  if (session && isSessionExpired(session)) {
    session = await refreshSession();
  }
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function toManagedDocument(record: BackendDocument, index: number): ManagedDocument {
  const id = record.id ?? record._id ?? `document-${index}`;
  return {
    id,
    name: record.name,
    type: record.type,
    folderId: record.folderId,
    size: record.size,
    owner: record.ownerName,
    updatedAt: record.updatedAt.slice(0, 10),
    tags: record.tags ?? [],
    sharedWith: record.sharedWith ?? [],
    versions: (record.versions ?? []).map((version, versionIndex) => ({
      id: `${id}-v${versionIndex}`,
      version: version.version,
      author: version.author,
      date: version.date.slice(0, 10),
      note: version.note,
    })),
    previewText: record.previewText,
  };
}

export async function fetchDocuments(limit = 100): Promise<DocumentsResult<ManagedDocument[]>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/documents?limit=${limit}`, {
      cache: "no-store",
      headers: await getSessionHeader(),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };

    const json = await response.json().catch(() => null);
    const payload = json?.data;
    const items = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(items)) return { status: "error" };

    return { status: "ok", data: items.map(toManagedDocument) };
  } catch {
    return { status: "error" };
  }
}

export async function uploadDocument(file: File, folderId: string, tags: string[] = []): Promise<DocumentsResult<ManagedDocument>> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", folderId);
    for (const tag of tags) formData.append("tags", tag);

    const response = await fetch(`${getApiBaseUrl()}/documents`, {
      method: "POST",
      cache: "no-store",
      headers: await getSessionHeader(),
      body: formData,
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };

    const json = await response.json().catch(() => null);
    const payloadData = json?.data;
    if (!payloadData) return { status: "error" };
    return { status: "ok", data: toManagedDocument(payloadData, 0) };
  } catch {
    return { status: "error" };
  }
}

export async function updateDocument(
  id: string,
  update: { folderId?: string; tags?: string[]; sharedWith?: DocumentShare[] },
): Promise<DocumentsResult<ManagedDocument>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/documents/${id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(await getSessionHeader()),
      },
      body: JSON.stringify(update),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };

    const json = await response.json().catch(() => null);
    const payloadData = json?.data;
    if (!payloadData) return { status: "error" };
    return { status: "ok", data: toManagedDocument(payloadData, 0) };
  } catch {
    return { status: "error" };
  }
}

export async function deleteManagedDocument(id: string): Promise<DocumentsResult<{ deleted: true }>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/documents/${id}`, {
      method: "DELETE",
      cache: "no-store",
      headers: await getSessionHeader(),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };
    return { status: "ok", data: { deleted: true } };
  } catch {
    return { status: "error" };
  }
}

export async function downloadManagedDocument(document: ManagedDocument): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/documents/${document.id}/file`, {
    cache: "no-store",
    headers: await getSessionHeader(),
  });
  if (!response.ok) return;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
