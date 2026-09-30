import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { getApiBaseUrl } from "@shared/lib/env";
import { formatDateTime } from "@shared/lib/utils-helpers";
import { notifyLocalDataChanged } from "@shared/realtime/data-sync";
import type { CrmOwner, CrmRecord, CrmSettings, Lead, LeadFormInput, LeadStage } from "./crm.types";

export type CrmResult<T> = { status: "ok"; data: T } | { status: "forbidden" } | { status: "error"; message?: string };

type BackendOwner = { _id?: string; fullName?: string; email?: string } | string;

type BackendLead = {
  id?: string;
  _id?: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source: string;
  status: LeadStage;
  value: number;
  currency?: string;
  ownerId?: BackendOwner;
  metadata?: {
    nextFollowUp?: string;
    notes?: string[];
    attachments?: { name: string; type?: string; size?: string }[];
  };
  activities?: { title: string; detail?: string; at: string }[];
  createdAt: string;
  updatedAt: string;
};

type LeadPayload = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStage;
  value?: number;
  currency?: string;
  ownerId?: string;
  metadata?: Record<string, unknown>;
};

async function getSessionHeader(): Promise<Record<string, string>> {
  let session = getStoredAuthSession();
  if (session && isSessionExpired(session)) {
    session = await refreshSession();
  }
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function ownerIdOf(owner: BackendOwner | undefined) {
  if (!owner) return "";
  return typeof owner === "string" ? owner : (owner._id ?? "");
}

function ownerNameOf(owner: BackendOwner | undefined) {
  if (!owner) return "Unassigned";
  if (typeof owner === "string") return "Assigned";
  return owner.fullName ?? owner.email ?? "Assigned";
}

function compact<T extends object>(payload: T) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== "")) as T;
}

async function request<T>(path: string, init: RequestInit = {}, map: (json: unknown) => T | null): Promise<CrmResult<T>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(await getSessionHeader()),
      },
    });

    const json = await response.json().catch(() => null);
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) {
      const fieldErrors =
        json?.errors && typeof json.errors === "object"
          ? Object.values(json.errors).flat().filter((value): value is string => typeof value === "string")
          : [];
      return { status: "error", message: fieldErrors[0] ?? json?.message };
    }

    const data = map(json?.data);
    return data === null ? { status: "error" } : { status: "ok", data };
  } catch {
    return { status: "error" };
  }
}

function listOf(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  const items = (payload as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? items : null;
}

function changed(path: string, method: string) {
  notifyLocalDataChanged({ at: new Date().toISOString(), method, path, resource: "crm" });
}

// ---- Leads -------------------------------------------------------------

function toLead(record: BackendLead, index: number): Lead {
  const id = record.id ?? record._id ?? `lead-${index}`;
  return {
    id,
    leadCode: `LEAD-${id.slice(-6).toUpperCase()}`,
    name: record.name,
    company: record.company ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    source: record.source,
    stage: record.status,
    value: record.value,
    currency: record.currency ?? "",
    ownerId: ownerIdOf(record.ownerId),
    salesperson: ownerNameOf(record.ownerId),
    nextFollowUp: record.metadata?.nextFollowUp ?? "",
    notes: record.metadata?.notes ?? [],
    attachments: (record.metadata?.attachments ?? []).map((attachment) => ({
      name: attachment.name,
      type: attachment.type ?? "file",
      size: attachment.size ?? "Unknown",
    })),
    activityTimeline: [...(record.activities ?? [])].reverse().map((activity, activityIndex) => ({
      id: `${id}-activity-${activityIndex}`,
      title: activity.title,
      detail: activity.detail ?? "",
      time: formatDateTime(activity.at),
    })),
    createdAt: record.createdAt.slice(0, 10),
  };
}

export function fetchCrmLeads(limit = 100): Promise<CrmResult<Lead[]>> {
  return request(`/leads?limit=${limit}`, {}, (payload) => listOf(payload)?.map((item, index) => toLead(item as BackendLead, index)) ?? null);
}

async function writeLead(path: string, method: "POST" | "PATCH", payload: LeadPayload) {
  const result = await request(path, { method, body: JSON.stringify(compact(payload)) }, (data) => (data ? toLead(data as BackendLead, 0) : null));
  if (result.status === "ok") changed(path, method);
  return result;
}

function leadMetadata(input: { nextFollowUp?: string; notes?: string[]; attachments?: { name: string; type?: string; size?: string }[] }) {
  return { nextFollowUp: input.nextFollowUp, notes: input.notes, attachments: input.attachments };
}

export function createCrmLead(input: LeadFormInput): Promise<CrmResult<Lead>> {
  return writeLead("/leads", "POST", {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    source: input.source,
    status: input.stage,
    value: input.value,
    currency: input.currency,
    ownerId: input.ownerId,
    metadata: leadMetadata(input),
  });
}

export function updateCrmLead(id: string, update: Partial<Lead>): Promise<CrmResult<Lead>> {
  const hasMetadata = update.nextFollowUp !== undefined || update.notes !== undefined || update.attachments !== undefined;
  return writeLead(`/leads/${id}`, "PATCH", {
    name: update.name,
    company: update.company,
    email: update.email,
    phone: update.phone,
    source: update.source,
    status: update.stage,
    value: update.value,
    currency: update.currency,
    ownerId: update.ownerId,
    metadata: hasMetadata ? leadMetadata(update) : undefined,
  });
}

/** Marks the lead Won and creates its customer record (needs lead.update and customer.create). */
export async function convertCrmLead(id: string): Promise<CrmResult<{ customerId: string }>> {
  const path = `/leads/${id}/convert`;
  const result = await request(path, { method: "POST" }, (data) => {
    const customerId = (data as { customerId?: string } | null)?.customerId;
    return customerId ? { customerId } : null;
  });
  if (result.status === "ok") changed(path, "POST");
  return result;
}

export async function deleteCrmLead(id: string): Promise<CrmResult<true>> {
  const path = `/leads/${id}`;
  const result = await request<true>(path, { method: "DELETE" }, () => true);
  if (result.status === "ok") changed(path, "DELETE");
  return result;
}

// ---- Other CRM collections ----------------------------------------------

function toRecord(raw: Record<string, unknown>): CrmRecord {
  const owner = raw.ownerId as BackendOwner | undefined;
  return { ...raw, id: String(raw.id ?? raw._id ?? ""), ownerId: ownerIdOf(owner), ownerName: ownerNameOf(owner) };
}

export function fetchCrmRecords(path: string, params: Record<string, string> = {}, limit = 200): Promise<CrmResult<CrmRecord[]>> {
  const query = new URLSearchParams({ ...params, limit: String(limit) });
  return request(`/crm/${path}?${query}`, {}, (payload) => listOf(payload)?.map((item) => toRecord(item as Record<string, unknown>)) ?? null);
}

export async function writeCrmRecord(path: string, payload: Record<string, unknown>, id?: string): Promise<CrmResult<CrmRecord>> {
  const target = id ? `/crm/${path}/${id}` : `/crm/${path}`;
  const method = id ? "PATCH" : "POST";
  const result = await request(target, { method, body: JSON.stringify(payload) }, (data) =>
    data ? toRecord(data as Record<string, unknown>) : null,
  );
  if (result.status === "ok") changed(target, method);
  return result;
}

export async function deleteCrmRecord(path: string, id: string): Promise<CrmResult<true>> {
  const target = `/crm/${path}/${id}`;
  const result = await request<true>(target, { method: "DELETE" }, () => true);
  if (result.status === "ok") changed(target, "DELETE");
  return result;
}

export function fetchCrmSettings(): Promise<CrmResult<CrmSettings>> {
  return request("/crm/settings", {}, (payload) => {
    const settings = payload as Partial<CrmSettings> | null;
    return settings?.defaultCurrency && Array.isArray(settings.currencies) ? { defaultCurrency: settings.defaultCurrency, currencies: settings.currencies } : null;
  });
}

export function fetchCrmOwners(): Promise<CrmResult<CrmOwner[]>> {
  return request("/crm/owners", {}, (payload) => (Array.isArray(payload) ? (payload as CrmOwner[]) : null));
}
