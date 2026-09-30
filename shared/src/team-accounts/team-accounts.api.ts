import { getApiBaseUrl } from "@shared/lib/env";
import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { notifyEmployeeDirectoryChanged } from "@shared/employees/employees.api";
import type { CreateProfileFormValues, TeamAccount } from "./team-accounts.schema";

export type TeamAccountsResult<T> =
 | { status: "ok"; data: T }
 /** The caller's role genuinely lacks permission — safe to show a permanent "no access" state. */
 | { status: "forbidden" }
 /** Network error, timeout, or an unexpected server error — transient, should be retryable rather than read as "no access". */
 | { status: "error" };

async function fetchWithStatus<T>(endpoint: string): Promise<TeamAccountsResult<T>> {
 let session = getStoredAuthSession();
 if (session && isSessionExpired(session)) {
 session = await refreshSession();
 }

 try {
 const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
 cache: "no-store",
 headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
 });

 if (response.status === 403) return { status: "forbidden" };
 if (!response.ok) return { status: "error" };

 const json = await response.json().catch(() => null);
 if (!json) return { status: "error" };

 return { status: "ok", data: json.data as T };
 } catch {
 return { status: "error" };
 }
}

export function fetchAssignableRoles() {
 return fetchWithStatus<string[]>("/users/assignable-roles");
}

export function fetchTeamAccounts() {
 return fetchWithStatus<TeamAccount[]>("/users").then((result) =>
 result.status === "ok"
 ? ({ status: "ok", data: result.data.filter((account) => account.isActive) } satisfies TeamAccountsResult<TeamAccount[]>)
 : result,
 );
}

export async function createProfile(input: CreateProfileFormValues): Promise<TeamAccount> {
 const session = getStoredAuthSession();
 const body = {
 fullName: input.fullName,
 email: input.email,
 password: input.password,
 role: input.role,
 phone: input.phone,
 ...(input.managerId ? { managerId: input.managerId } : {}),
 };

 const response = await fetch(`${getApiBaseUrl()}/users`, {
 method: "POST",
 cache: "no-store",
 headers: {
 "Content-Type": "application/json",
 ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
 },
 body: JSON.stringify(body),
 });

 const json = await response.json().catch(() => null);

 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to create this profile.");
 }

 notifyEmployeeDirectoryChanged();
 return json.data as TeamAccount;
}
