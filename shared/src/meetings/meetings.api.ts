import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { getApiBaseUrl } from "@shared/lib/env";
import type { Meeting, MeetingFormInput, MeetingStatus } from "./meetings.types";

type MeetingsResult<T> = { status: "ok"; data: T } | { status: "forbidden" } | { status: "error" };

type BackendMeeting = {
  id?: string;
  _id?: string;
  title: string;
  organizerName: string;
  startTime: string;
  endTime?: string;
  status: MeetingStatus;
  link?: string;
  source: Meeting["source"];
};

async function getSessionHeader(): Promise<Record<string, string>> {
  let session = getStoredAuthSession();
  if (session && isSessionExpired(session)) {
    session = await refreshSession();
  }
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function toMeeting(record: BackendMeeting, index: number): Meeting {
  return {
    id: record.id ?? record._id ?? `meeting-${index}`,
    title: record.title,
    organizerName: record.organizerName,
    startTime: record.startTime,
    endTime: record.endTime,
    status: record.status,
    link: record.link,
    source: record.source,
  };
}

export async function fetchMeetings(limit = 100): Promise<MeetingsResult<Meeting[]>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/meetings?limit=${limit}`, {
      cache: "no-store",
      headers: await getSessionHeader(),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };

    const json = await response.json().catch(() => null);
    const payload = json?.data;
    const items = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(items)) return { status: "error" };

    return { status: "ok", data: items.map(toMeeting) };
  } catch {
    return { status: "error" };
  }
}

function compactPayload(payload: Partial<MeetingFormInput>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== "")) as Partial<MeetingFormInput>;
}

async function writeMeeting(path: string, method: "POST" | "PATCH", payload: Partial<MeetingFormInput>): Promise<MeetingsResult<Meeting>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(await getSessionHeader()),
      },
      body: JSON.stringify(compactPayload(payload)),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };

    const json = await response.json().catch(() => null);
    const payloadData = json?.data;
    if (!payloadData) return { status: "error" };
    return { status: "ok", data: toMeeting(payloadData, 0) };
  } catch {
    return { status: "error" };
  }
}

export function createMeeting(input: MeetingFormInput): Promise<MeetingsResult<Meeting>> {
  return writeMeeting("/meetings", "POST", input);
}

export function updateMeeting(id: string, input: Partial<MeetingFormInput>): Promise<MeetingsResult<Meeting>> {
  return writeMeeting(`/meetings/${id}`, "PATCH", input);
}

export async function deleteMeeting(id: string): Promise<MeetingsResult<{ deleted: true }>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/meetings/${id}`, {
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
