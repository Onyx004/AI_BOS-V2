export type TaskStatus = "Todo" | "In Progress" | "Blocked" | "Review" | "Testing" | "Completed";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";
export type TaskIssueType = "Epic" | "Story" | "Task" | "Subtask" | "Bug";
export type TaskView = "kanban" | "backlog" | "hierarchy" | "list" | "calendar" | "timeline" | "team";

export type TaskAttachment = {
 name: string;
 type: string;
 size: string;
};

export type TaskComment = {
 id: string;
 author: string;
 message: string;
 createdAt: string;
};

export type ChecklistItem = {
 id: string;
 title: string;
 done: boolean;
};

export type TimeEntry = {
 id: string;
 user: string;
 hours: number;
 note: string;
 createdAt: string;
};

export type ActivityLog = {
 id: string;
 title: string;
 time: string;
};

export type Task = {
 id: string;
 taskCode: string;
 title: string;
 description: string;
 issueType?: TaskIssueType;
 status: TaskStatus;
 progress: number;
 remaining: number;
 blockedReason?: string;
 priority: TaskPriority;
 projectId?: string;
 epicId?: string;
 sprintId?: string;
 parentTaskId?: string;
 backlogRank?: number;
 labels: string[];
 assignee: string;
 reporter: string;
 assigneeId?: string;
 reporterId?: string;
 dueDate: string;
 startDate: string;
 estimatedHours: number;
 actualHours: number;
 attachments: TaskAttachment[];
 comments: TaskComment[];
 checklist: ChecklistItem[];
 recurring: boolean;
 recurrence: string;
 activityLogs: ActivityLog[];
 notifications: string[];
 timeEntries: TimeEntry[];
 createdAt: string;
 updatedAt: string;
};

export type TaskFormInput = Omit<
 Task,
"id" | "taskCode" | "remaining" | "activityLogs" | "timeEntries" | "createdAt" | "updatedAt" | "assigneeId" | "reporterId"
> & {
 taskCode?: string;
};
