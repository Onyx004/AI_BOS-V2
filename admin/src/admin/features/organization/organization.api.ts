import type {
 Branch,
 BranchFormInput,
 CompanyPolicy,
 CompanyPolicyFormInput,
 Department,
 DepartmentFormInput,
 Holiday,
 HolidayFormInput,
 OrgHierarchyResponse,
 OrganizationForm,
 OrganizationSettingsForm,
 Team,
 TeamFormInput,
} from "./organization.schema";
import { getApiBaseUrl } from "@shared/lib/env";

const apiBaseUrl = getApiBaseUrl();

type ApiEnvelope<T> = {
 success: boolean;
 message: string;
 data: T;
};

type Paginated<T> = {
 items: T[];
 pagination: { page: number; limit: number; total: number; totalPages: number };
};

function authHeaders(token?: string) {
 return {
 "Content-Type": "application/json",
 ...(token ? { Authorization: `Bearer ${token}` } : {}),
 };
}

async function request<T>(path: string, token: string | undefined, init?: RequestInit): Promise<T> {
 const response = await fetch(`${apiBaseUrl}${path}`, {
 ...init,
 headers: authHeaders(token),
 });
 if (!response.ok) {
 const body = (await response.json().catch(() => null)) as { message?: string } | null;
 throw new Error(body?.message ?? `Request failed (${response.status})`);
 }
 const body = (await response.json()) as ApiEnvelope<T>;
 return body.data;
}

export function fetchOrganization(token?: string) {
 return request<OrganizationForm & { _id: string }>("/organization", token);
}

export function saveOrganization(input: Partial<OrganizationForm>, token?: string) {
 return request<OrganizationForm & { _id: string }>("/organization", token, {
 method: "PATCH",
 body: JSON.stringify(input),
 });
}

export function fetchOrganizationSettings(token?: string) {
 return request<OrganizationSettingsForm & { _id: string }>("/organization/settings", token);
}

export function saveOrganizationSettings(input: OrganizationSettingsForm, token?: string) {
 return request<OrganizationSettingsForm & { _id: string }>("/organization/settings", token, {
 method: "PATCH",
 body: JSON.stringify(input),
 });
}

export function fetchDepartments(token?: string) {
 return request<Paginated<Department>>("/organization/departments?limit=100", token);
}

export function createDepartment(input: DepartmentFormInput, token?: string) {
 return request<Department>("/organization/departments", token, {
 method: "POST",
 body: JSON.stringify(input),
 });
}

export function updateDepartment(id: string, input: DepartmentFormInput, token?: string) {
 return request<Department>(`/organization/departments/${id}`, token, {
 method: "PATCH",
 body: JSON.stringify(input),
 });
}

/** `deleteTeams` confirms that the department's teams are deleted together with it. */
export function deleteDepartment(id: string, token?: string, options: { deleteTeams?: boolean } = {}) {
 return request<{ deleted: boolean; unassignedEmployees?: number; deletedTeams?: number }>(
 `/organization/departments/${id}${options.deleteTeams ? "?deleteTeams=true" : ""}`,
 token,
 { method: "DELETE" },
 );
}

export function fetchBranches(token?: string) {
 return request<Paginated<Branch>>("/organization/branches?limit=100", token);
}

export function createBranch(input: BranchFormInput, token?: string) {
 return request<Branch>("/organization/branches", token, {
 method: "POST",
 body: JSON.stringify(input),
 });
}

export function updateBranch(id: string, input: BranchFormInput, token?: string) {
 return request<Branch>(`/organization/branches/${id}`, token, {
 method: "PATCH",
 body: JSON.stringify(input),
 });
}

export function deleteBranch(id: string, token?: string) {
 return request<{ deleted: boolean }>(`/organization/branches/${id}`, token, { method: "DELETE" });
}

export function fetchTeams(token?: string) {
 return request<Paginated<Team>>("/organization/teams?limit=100", token);
}

export function createTeam(input: TeamFormInput, token?: string) {
 return request<Team>("/organization/teams", token, {
 method: "POST",
 body: JSON.stringify(input),
 });
}

export function updateTeam(id: string, input: TeamFormInput, token?: string) {
 return request<Team>(`/organization/teams/${id}`, token, {
 method: "PATCH",
 body: JSON.stringify(input),
 });
}

export function deleteTeam(id: string, token?: string) {
 return request<{ deleted: boolean }>(`/organization/teams/${id}`, token, { method: "DELETE" });
}

export function fetchHolidays(token?: string) {
 return request<Paginated<Holiday>>("/organization/holidays?limit=100", token);
}

export function createHoliday(input: HolidayFormInput, token?: string) {
 return request<Holiday>("/organization/holidays", token, {
 method: "POST",
 body: JSON.stringify(input),
 });
}

export function deleteHoliday(id: string, token?: string) {
 return request<{ deleted: boolean }>(`/organization/holidays/${id}`, token, { method: "DELETE" });
}

export function fetchPolicies(token?: string) {
 return request<Paginated<CompanyPolicy>>("/organization/policies?limit=100", token);
}

export function createPolicy(input: CompanyPolicyFormInput, token?: string) {
 return request<CompanyPolicy>("/organization/policies", token, {
 method: "POST",
 body: JSON.stringify(input),
 });
}

export function publishPolicy(id: string, token?: string) {
 return request<CompanyPolicy>(`/organization/policies/${id}/publish`, token, { method: "PATCH" });
}

export function deletePolicy(id: string, token?: string) {
 return request<{ deleted: boolean }>(`/organization/policies/${id}`, token, { method: "DELETE" });
}

export function fetchHierarchy(token?: string) {
 return request<OrgHierarchyResponse>("/organization/hierarchy", token);
}
