import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { getApiBaseUrl } from "@shared/lib/env";
import { notifyLocalDataChanged } from "@shared/realtime/data-sync";
import type { FaceLivenessChallenge, FaceLivenessEvidence } from "@shared/face-enrollment/human-face-engine";

export type AttendanceLocationPayload = { latitude: number; longitude: number; accuracy?: number };
export type AttendanceFaceVerificationPayload = {
  challengeId: string;
  embedding: number[];
  evidence: FaceLivenessEvidence;
};
export type AttendanceMarkPayload = AttendanceLocationPayload & { verification: AttendanceFaceVerificationPayload };
export type ManualAttendanceMarkPayload = AttendanceLocationPayload & { reason: string };
export type AttendanceLocation = AttendanceLocationPayload & { distanceMeters?: number };
export type AttendanceOffice = { name?: string; latitude: number; longitude: number; radiusMeters: number };
export type AttendanceAction = "check-in" | "check-out";
export type AttendanceVerificationMethod = "face" | "manual" | "daily_task" | "login" | "auto_offline";

export type FaceVerificationChallengeResponse = {
  challengeId: string;
  challenge: FaceLivenessChallenge;
  expiresAt: string;
  timeoutMs: number;
};

export type AttendanceRecord = {
  _id?: string;
  id?: string;
  userId?: string;
  date: string;
  status: "Present" | "Checked Out";
  checkInAt: string;
  checkOutAt?: string;
  checkInLocation?: AttendanceLocation;
  checkOutLocation?: AttendanceLocation;
  checkInMethod?: AttendanceVerificationMethod;
  checkOutMethod?: AttendanceVerificationMethod;
  checkInManualReason?: string;
  checkOutManualReason?: string;
  checkInFaceVerified?: boolean;
  checkOutFaceVerified?: boolean;
  checkInLivenessPassed?: boolean;
  checkOutLivenessPassed?: boolean;
  checkInFaceEnrollmentId?: string;
  checkOutFaceEnrollmentId?: string;
  checkInVerificationModelVersion?: string;
  checkOutVerificationModelVersion?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceToday = { record: AttendanceRecord | null; office: AttendanceOffice };

async function getSessionHeader(): Promise<Record<string, string>> {
  let session = getStoredAuthSession();
  if (session && isSessionExpired(session)) session = await refreshSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

async function requestJson<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
      ...(await getSessionHeader()),
    },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const fieldErrors = json?.errors && typeof json.errors === "object"
      ? Object.values(json.errors).flat().filter((value): value is string => typeof value === "string")
      : [];
    throw new Error(fieldErrors[0] ?? json?.message ?? "Attendance request failed.");
  }
  return json.data as T;
}

export function issueFaceVerificationChallenge(action: AttendanceAction) {
  return requestJson<FaceVerificationChallengeResponse>("/attendance/verification-challenge", {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

async function markAttendance(endpoint: string, payload: AttendanceMarkPayload | ManualAttendanceMarkPayload | AttendanceLocationPayload) {
  const record = await requestJson<AttendanceRecord>(endpoint, { method: "POST", body: JSON.stringify(payload) });
  notifyLocalDataChanged({ at: new Date().toISOString(), method: "POST", path: endpoint, resource: "attendance" });
  return record;
}

export function checkInAttendance(payload: AttendanceMarkPayload) {
  return markAttendance("/attendance/check-in", payload);
}

export function checkOutAttendance(payload: AttendanceMarkPayload) {
  return markAttendance("/attendance/check-out", payload);
}

/** Tells the backend this user is still active; after 2 hours without one the day is auto checked-out at the last ping. */
export async function sendPresenceHeartbeat() {
  await requestJson<{ ok: boolean }>("/attendance/heartbeat", { method: "POST" });
}
