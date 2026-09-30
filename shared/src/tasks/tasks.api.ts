import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { getApiBaseUrl } from "@shared/lib/env";
import { notifyLocalDataChanged } from "@shared/realtime/data-sync";

export type TaskStatus = "Todo" | "In Progress" | "Blocked" | "Review" | "Testing" | "Completed";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";
export type TaskIssueType = "Epic" | "Story" | "Task" | "Subtask" | "Bug";

export type TasksResult<T> = { status: "ok"; data: T } | { status: "forbidden" } | { status: "error" };

export type BackendTaskUserRef = { id?: string; _id?: string; fullName?: string; email?: string } | string;

export type BackendChecklistItem = { _id?: string; id?: string; title: string; done: boolean };
export type BackendAttachment = { name: string; url?: string; mimeType?: string; size?: number };
export type BackendTimeEntry = {
 userId?: BackendTaskUserRef;
 hours: number;
 note?: string;
 createdAt?: string;
};

export type BackendTask = {
 id?: string;
 _id?: string;
 taskCode: string;
 title: string;
 description?: string;
 issueType?: TaskIssueType;
 status: TaskStatus;
 progress?: number;
 remaining?: number;
 blockedReason?: string;
 priority: TaskPriority;
 projectId?: string;
 epicId?: string;
 sprintId?: string;
 parentTaskId?: string;
 backlogRank?: number;
 assigneeId?: BackendTaskUserRef;
 reporterId?: BackendTaskUserRef;
 labels: string[];
 dueDate?: string;
 startDate?: string;
 estimatedHours: number;
 actualHours: number;
 checklist: BackendChecklistItem[];
 attachments: BackendAttachment[];
 timeEntries: BackendTimeEntry[];
 recurring: boolean;
 recurrence: string;
 createdAt: string;
 updatedAt: string;
};

export type TaskStats = {
 total: number;
 byStatus: { status: string; count: number }[];
 overdue: number;
 dueSoon: number;
 tracked: number;
};

async function getSessionHeader(): Promise<Record<string, string>> {
 let session = getStoredAuthSession();
 if (session && isSessionExpired(session)) {
 session = await refreshSession();
 }
 return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

async function fetchJson<T>(endpoint: string): Promise<TasksResult<T>> {
 try {
 const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
 cache: "no-store",
 headers: await getSessionHeader(),
 });

 if (response.status === 403) return { status: "forbidden" };
 if (!response.ok) return { status: "error" };

 const json = await response.json().catch(() => null);
 return json ? { status: "ok", data: json.data as T } : { status: "error" };
 } catch {
 return { status: "error" };
 }
}

async function sendJson<T>(endpoint: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
 const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
 method,
 cache: "no-store",
 headers: {
 "Content-Type": "application/json",
 ...(await getSessionHeader()),
 },
 body: body !== undefined ? JSON.stringify(body) : undefined,
 });

 const json = await response.json().catch(() => null);
 if (!response.ok) {
 throw new Error(json?.message ?? "Request failed.");
 }

 notifyLocalDataChanged({ at: new Date().toISOString(), method, path: endpoint, resource: "tasks" });
 return json.data as T;
}

function userRefName(ref: BackendTaskUserRef | undefined, fallback: string): string {
 if (!ref) return fallback;
 if (typeof ref === "string") return ref;
 return ref.fullName ?? fallback;
}

function userRefId(ref: BackendTaskUserRef | undefined): string | undefined {
 if (!ref) return undefined;
 if (typeof ref === "string") return ref;
 return ref.id ?? ref._id;
}

/**
 * Maps the backend wire shape onto the plain object shape the existing
 * frontend/admin `Task` type expects (TaskStatus/labels/assignee as a display
 * name, etc.) — TypeScript's structural typing lets each portal's own local
 * `Task` type accept this without importing it here.
 */
export function toTask(record: BackendTask) {
 const id = record.id ?? record._id ?? "";
 const checklistProgress = record.checklist.length > 0
 ? Math.round((record.checklist.filter((item) => item.done).length / record.checklist.length) * 100)
 : undefined;
 const progress = record.status === "Completed"
 ? 100
 : Math.max(0, Math.min(100, record.progress ?? checklistProgress ?? 0));
 return {
 id,
 taskCode: record.taskCode,
 title: record.title,
 description: record.description ?? "",
 issueType: record.issueType ?? "Task",
 status: record.status,
 progress,
 remaining: record.remaining ?? 100 - progress,
 blockedReason: record.blockedReason,
 priority: record.priority,
 projectId: record.projectId,
 epicId: record.epicId,
 sprintId: record.sprintId,
 parentTaskId: record.parentTaskId,
 backlogRank: record.backlogRank,
 labels: record.labels,
 assignee: userRefName(record.assigneeId, "Unassigned"),
 reporter: userRefName(record.reporterId, "Unassigned"),
 dueDate: record.dueDate ?? "",
 startDate: record.startDate ?? "",
 estimatedHours: record.estimatedHours,
 actualHours: record.actualHours,
 attachments: record.attachments.map((attachment) => ({
 name: attachment.name,
 type: attachment.mimeType ?? "file",
 size: attachment.size ? `${Math.round(attachment.size / 1024)} KB` : "",
 })),
 comments: [] as { id: string; author: string; message: string; createdAt: string }[],
 checklist: record.checklist.map((item) => ({
 id: item._id ?? item.id ?? "",
 title: item.title,
 done: item.done,
 })),
 recurring: record.recurring,
 recurrence: record.recurrence,
 activityLogs: [] as { id: string; title: string; time: string }[],
 notifications: [] as string[],
 timeEntries: record.timeEntries.map((entry, index) => ({
 id: `${id}-time-${index}`,
 user: userRefName(entry.userId, "Unknown"),
 hours: entry.hours,
 note: entry.note ?? "",
 createdAt: entry.createdAt ?? "",
 })),
 createdAt: record.createdAt,
 updatedAt: record.updatedAt,
 assigneeId: userRefId(record.assigneeId),
 reporterId: userRefId(record.reporterId),
 };
}

export type TaskListQuery = {
 page?: number;
 limit?: number;
 search?: string;
 status?: TaskStatus;
 priority?: TaskPriority;
 issueType?: TaskIssueType;
 projectId?: string;
 epicId?: string;
 sprintId?: string;
 assigneeId?: string;
 isDailyTask?: boolean;
 dueDateFrom?: string;
 dueDateTo?: string;
};

export type TeamTaskSummary = {
 id: string;
 fullName: string;
 email: string;
 role: string;
 totalTasks: number;
 completedTasks: number;
 overdueTasks: number;
};

function toQueryString(query?: TaskListQuery) {
 if (!query) return "";
 const params = new URLSearchParams();
 for (const [key, value] of Object.entries(query)) {
 if (value !== undefined && value !== "") params.set(key, String(value));
 }
 const qs = params.toString();
 return qs ? `?${qs}` : "";
}

export async function fetchTasks(query?: TaskListQuery) {
 const result = await fetchJson<{ items: BackendTask[] }>(`/tasks${toQueryString({ limit: 100, ...query })}`);
 if (result.status !== "ok") return result;
 return { status: "ok", data: result.data.items.map(toTask) } satisfies TasksResult<ReturnType<typeof toTask>[]>;
}

export async function fetchTasksByProject(projectId: string) {
 const result = await fetchJson<BackendTask[]>(`/tasks/project/${projectId}`);
 if (result.status !== "ok") return result;
 return { status: "ok", data: result.data.map(toTask) } satisfies TasksResult<ReturnType<typeof toTask>[]>;
}

export async function fetchTaskById(id: string) {
 const result = await fetchJson<BackendTask>(`/tasks/${id}`);
 if (result.status !== "ok") return result;
 return { status: "ok", data: toTask(result.data) } satisfies TasksResult<ReturnType<typeof toTask>>;
}

export function fetchTaskStats() {
 return fetchJson<TaskStats>("/tasks/stats");
}

export function fetchTeamTaskSummary() {
 return fetchJson<TeamTaskSummary[]>("/tasks/team/summary");
}

export async function createTask(input: Record<string, unknown>) {
 const record = await sendJson<BackendTask>("/tasks", "POST", input);
 return toTask(record);
}

export async function createDailyTask(title: string) {
 const record = await sendJson<BackendTask>("/tasks/daily", "POST", { title });
 return toTask(record);
}

export async function updateTask(id: string, input: Record<string, unknown>) {
 const record = await sendJson<BackendTask>(`/tasks/${id}`, "PATCH", input);
 return toTask(record);
}

export async function deleteTask(id: string) {
 return sendJson<{ deleted: boolean }>(`/tasks/${id}`, "DELETE");
}

export async function toggleChecklistItem(taskId: string, itemId: string, done: boolean) {
 const record = await sendJson<BackendTask>(`/tasks/${taskId}/checklist/${itemId}`, "PATCH", { done });
 return toTask(record);
}

export async function logTaskTime(taskId: string, entry: { hours: number; note?: string }) {
 const record = await sendJson<BackendTask>(`/tasks/${taskId}/time-entries`, "POST", entry);
 return toTask(record);
}
