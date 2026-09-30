import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { getApiBaseUrl } from "@shared/lib/env";
import { formatClockTime } from "@shared/lib/utils-helpers";
import { notifyLocalDataChanged } from "@shared/realtime/data-sync";
import type { AttendanceRecord, Department, Employee, EmployeeFormInput, EmployeeManager, Holiday } from "./employees.types";

export type EmployeesResult<T> = { status: "ok"; data: T } | { status: "forbidden" } | { status: "error" };

export const employeeDirectoryChangedEvent = "ai_bos_employee_directory_changed";

export type BackendEmployee = {
 id: string;
 fullName: string;
 companyName: string;
 email: string;
 role: string;
 isActive: boolean;
 lastLoginAt?: string;
 createdAt?: string;
 avatar?: string;
 departmentId?: string;
 department?: string;
 managerId?: string;
 manager?: EmployeeManager;
 employeeCode?: string;
 phone?: string;
 location?: string;
 designation?: string;
 employmentType?: string;
 joiningDate?: string;
 employmentStatus?: Employee["status"];
 personalInformation?: Partial<Employee["personalInformation"]>;
 contact?: Partial<Employee["contact"]>;
 skills?: string[];
 experience?: string[];
 education?: string[];
 documents?: Employee["documents"];
 salaryDetails?: Partial<Employee["salaryDetails"]>;
 performanceScore?: number;
};

export type DepartmentOption = Department;

async function getSessionHeader(): Promise<Record<string, string>> {
 let session = getStoredAuthSession();
 if (session && isSessionExpired(session)) {
 session = await refreshSession();
 }
 return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

async function fetchWithSession(input: RequestInfo | URL, init: RequestInit = {}) {
 const buildHeaders = async () => ({
 ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers),
 ...(await getSessionHeader()),
 });

 let response = await fetch(input, { ...init, headers: await buildHeaders() });
 if (response.status !== 401) return response;

 const refreshedSession = await refreshSession();
 if (!refreshedSession) return response;

 response = await fetch(input, {
 ...init,
 headers: {
 ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers),
 Authorization: `Bearer ${refreshedSession.accessToken}`,
 },
 });
 return response;
}

async function fetchJson<T>(endpoint: string): Promise<EmployeesResult<T>> {
 try {
 const response = await fetchWithSession(`${getApiBaseUrl()}${endpoint}`, {
 cache: "no-store",
 });

 if (response.status === 403) return { status: "forbidden" };
 if (!response.ok) return { status: "error" };

 const json = await response.json().catch(() => null);
 return json ? { status: "ok", data: json.data as T } : { status: "error" };
 } catch {
 return { status: "error" };
 }
}

export function notifyEmployeeDirectoryChanged() {
 if (typeof window === "undefined") return;
 const timestamp = String(Date.now());
 window.localStorage.setItem(employeeDirectoryChangedEvent, timestamp);
 window.dispatchEvent(new CustomEvent(employeeDirectoryChangedEvent, { detail: timestamp }));
 notifyLocalDataChanged({ at: new Date().toISOString(), resource: "users" });
}

function fallbackInitials(name: string) {
 return name
 .split(" ")
 .filter(Boolean)
 .slice(0, 2)
 .map((part) => part[0]?.toUpperCase() ?? "")
 .join("");
}

export function toEmployee(record: BackendEmployee): Employee {
 const annualCtc = record.salaryDetails?.annualCtc ?? null;
 return {
 id: record.id,
 employeeCode: record.employeeCode ?? `EMP-${record.id.slice(-6).toUpperCase()}`,
 name: record.fullName,
 avatar: record.avatar ?? fallbackInitials(record.fullName),
 email: record.email,
 phone: record.phone ?? "Not added",
 location: record.location ?? "Not added",
 department: record.department ?? "Unassigned",
 departmentId: record.departmentId,
 managerId: record.managerId,
 manager: record.manager,
 role: record.role,
 designation: record.designation ?? record.role,
 employmentType: record.employmentType ?? "Full Time",
 joiningDate: record.joiningDate?.slice(0, 10) ?? record.createdAt?.slice(0, 10) ?? "Not added",
 status: record.employmentStatus ?? (record.isActive ? "Active" : "Inactive"),
 personalInformation: {
 dateOfBirth: record.personalInformation?.dateOfBirth ?? "Not added",
 gender: record.personalInformation?.gender ?? "Not added",
 nationality: record.personalInformation?.nationality ?? "Not added",
 maritalStatus: record.personalInformation?.maritalStatus ?? "Not added",
 },
 contact: {
 address: record.contact?.address ?? record.location ?? "Not added",
 emergencyContact: record.contact?.emergencyContact ?? "Not added",
 },
 skills: record.skills?.length ? record.skills : ["Not added"],
 experience: record.experience?.length ? record.experience : ["Not added"],
 education: record.education?.length ? record.education : ["Not added"],
 documents: record.documents ?? [],
 salaryDetails: {
 annualCtc,
 monthlySalary: record.salaryDetails?.monthlySalary ?? (annualCtc === null ? null : Math.round(annualCtc / 12)),
 bank: record.salaryDetails?.bank ?? "Not added",
 taxId: record.salaryDetails?.taxId ?? "Not added",
 },
 performanceScore: record.performanceScore,
 };
}

export async function fetchEmployees() {
 const result = await fetchJson<BackendEmployee[]>("/users");
 if (result.status !== "ok") return result;
 return { status: "ok", data: result.data.map(toEmployee) } satisfies EmployeesResult<Employee[]>;
}

export type BackendAttendance = {
 _id?: string;
 id?: string;
 userId: string | { _id?: string; id?: string };
 date: string;
 status: "Present" | "Checked Out";
 checkInAt: string;
 checkOutAt?: string;
};

function attendanceUserId(record: BackendAttendance) {
 return typeof record.userId === "string" ? record.userId : (record.userId?._id ?? record.userId?.id ?? "");
}

function attendanceWorkingHours(record: BackendAttendance) {
 if (!record.checkOutAt) return 0;
 const hours = (new Date(record.checkOutAt).getTime() - new Date(record.checkInAt).getTime()) / 3_600_000;
 return Math.max(0, Math.round(hours * 10) / 10);
}

function toAttendanceRecord(record: BackendAttendance): AttendanceRecord {
 const toTime = (value?: string) => (value ? formatClockTime(value) : undefined);

 return {
 id: record.id ?? record._id ?? `${attendanceUserId(record)}-${record.date}`,
 employeeId: attendanceUserId(record),
 date: record.date,
 checkIn: toTime(record.checkInAt),
 checkOut: toTime(record.checkOutAt),
 workingHours: attendanceWorkingHours(record),
 status: "Present",
 };
}

export async function fetchAttendanceSummary(date?: string) {
 const query = date ? `?date=${date}` : "";
 const result = await fetchJson<BackendAttendance[]>(`/attendance/summary${query}`);
 if (result.status !== "ok") return result;
 return { status: "ok", data: result.data.map(toAttendanceRecord) } satisfies EmployeesResult<AttendanceRecord[]>;
}

export function fetchEmployeeUsers() {
 return fetchJson<BackendEmployee[]>("/users");
}

type DepartmentApiRecord = {
 id?: string;
 _id?: string;
 name: string;
 description?: string;
 headId?: string;
 head?: EmployeeManager;
 memberCount?: number;
};
type DepartmentApiResponse = DepartmentApiRecord[] | { items: DepartmentApiRecord[] };

export async function fetchDepartments() {
 const result = await fetchJson<DepartmentApiResponse>("/organization/departments?limit=100");
 if (result.status !== "ok") return result;
 const items = Array.isArray(result.data) ? result.data : result.data.items;
 return {
 status: "ok",
 data: items.map((department) => ({
 id: department.id ?? department._id ?? department.name,
 name: department.name,
 description: department.description,
 headId: department.headId,
 head: department.head,
 memberCount: department.memberCount ?? 0,
 })),
 } satisfies EmployeesResult<DepartmentOption[]>;
}

type BackendHoliday = {
 id?: string;
 _id?: string;
 name: string;
 date: string;
 type: string;
};

export async function fetchHolidays() {
 const result = await fetchJson<{ items: BackendHoliday[] }>("/organization/holidays?limit=200");
 if (result.status !== "ok") return result;
 return {
 status: "ok",
 data: result.data.items.map((holiday) => ({
 name: holiday.name,
 date: holiday.date.slice(0, 10),
 type: holiday.type,
 })),
 } satisfies EmployeesResult<Holiday[]>;
}

export async function createDepartment(input: { name: string; description?: string; headId: string }): Promise<Department> {
 const response = await fetchWithSession(`${getApiBaseUrl()}/organization/departments`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(input),
 });

 const json = await response.json().catch(() => null);
 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to create this department.");
 }

 const record = json.data as DepartmentApiRecord;
 return {
 id: record.id ?? record._id ?? record.name,
 name: record.name,
 description: record.description,
 headId: record.headId,
 head: record.head,
 memberCount: record.memberCount ?? 0,
 };
}

export async function fetchDepartmentMembers(departmentId: string): Promise<Employee[]> {
 const response = await fetchWithSession(`${getApiBaseUrl()}/organization/departments/${departmentId}/members`, {
 cache: "no-store",
 });

 const json = await response.json().catch(() => null);
 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to load department members.");
 }

 return (json.data as BackendEmployee[]).map(toEmployee);
}

export async function fetchAssignableRoles() {
 return fetchJson<string[]>("/users/assignable-roles");
}

async function patchEmployee(id: string, path: string, body: Record<string, unknown>): Promise<Employee> {
 const response = await fetchWithSession(`${getApiBaseUrl()}/users/${id}${path ? `/${path}` : ""}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });

 const json = await response.json().catch(() => null);
 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to update this employee.");
 }

 const employee = toEmployee(json.data as BackendEmployee);
 notifyEmployeeDirectoryChanged();
 return employee;
}

/** `null` moves the employee to Unassigned. */
export function updateEmployeeDepartment(employeeId: string, departmentId: string | null) {
 return patchEmployee(employeeId, "department", { departmentId });
}

export function updateEmployeeManager(employeeId: string, managerId: string) {
 return patchEmployee(employeeId, "manager", { managerId });
}

export function updateEmployeeRole(employeeId: string, role: string) {
 return patchEmployee(employeeId, "role", { role });
}

export function updateEmployeeDesignation(employeeId: string, designation: string) {
 return patchEmployee(employeeId, "", { employeeProfile: { designation } });
}

export async function createEmployee(input: EmployeeFormInput, departmentId?: string): Promise<Employee> {
 const validDepartmentId = departmentId && /^[a-f\d]{24}$/i.test(departmentId) ? departmentId : undefined;
 const response = await fetchWithSession(`${getApiBaseUrl()}/users`, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 },
 body: JSON.stringify({
 fullName: input.name,
 email: input.email,
 password: input.password,
 role: input.role,
 phone: input.phone,
 departmentId: validDepartmentId,
 }),
 });

 const json = await response.json().catch(() => null);
 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to create this employee.");
 }

 const employee = toEmployee(json.data as BackendEmployee);
 notifyEmployeeDirectoryChanged();
 return employee;
}

export async function resetEmployeePassword(id: string): Promise<{ temporaryPassword: string }> {
 const response = await fetchWithSession(`${getApiBaseUrl()}/users/${id}/reset-password`, {
 method: "POST",
 cache: "no-store",
 });

 const json = await response.json().catch(() => null);
 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to reset this employee's password.");
 }

 return json.data as { temporaryPassword: string };
}

export async function deleteEmployee(id: string): Promise<void> {
 const response = await fetchWithSession(`${getApiBaseUrl()}/users/${id}`, {
 method: "DELETE",
 cache: "no-store",
 });

 const json = await response.json().catch(() => null);
 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to remove this employee.");
 }

 notifyEmployeeDirectoryChanged();
}
