import { z } from "zod";
import { taskIssueTypes, taskPriorities, taskStatuses } from "../constants/tasks.js";

const dateStringSchema = z.preprocess((val) => {
  if (val === null || val === "" || val === undefined) return undefined;
  return val;
}, z.coerce.date().optional());

const attachmentSchema = z.object({
  name: z.string().min(1).max(180),
  url: z.string().url().optional(),
  mimeType: z.string().optional(),
  size: z.number().min(0).optional(),
});

const checklistItemSchema = z.object({
  title: z.string().min(1).max(200),
  done: z.boolean().default(false),
});

const requireBlockedReason = (value: { status?: string; blockedReason?: string | null }, context: z.RefinementCtx) => {
  if (value.status === "Blocked" && !value.blockedReason?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blockedReason"],
      message: "Blocked reason is required when status is Blocked",
    });
  }
};

export const createTaskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(3000).nullable().optional(),
  issueType: z.enum(taskIssueTypes).default("Task"),
  status: z.enum(taskStatuses).default("Todo"),
  progress: z.number().int().min(0).max(100).default(0),
  blockedReason: z.string().trim().min(1).max(1000).nullable().optional(),
  priority: z.enum(taskPriorities).default("Medium"),
  projectId: z.string().min(1).nullable().optional(),
  epicId: z.string().min(1).nullable().optional(),
  sprintId: z.string().min(1).nullable().optional(),
  parentTaskId: z.string().min(1).nullable().optional(),
  backlogRank: z.number().min(0).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  reporterId: z.string().min(1).nullable().optional(),
  labels: z.array(z.string().min(1).max(40)).default([]),
  dueDate: dateStringSchema,
  startDate: dateStringSchema,
  estimatedHours: z.number().min(0).default(0),
  checklist: z.array(checklistItemSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
  recurring: z.boolean().default(false),
  recurrence: z.string().max(40).default("None"),
  isDailyTask: z.boolean().default(false),
}).superRefine(requireBlockedReason);

export const updateTaskSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(3000).optional(),
  issueType: z.enum(taskIssueTypes).optional(),
  status: z.enum(taskStatuses).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  blockedReason: z.string().trim().min(1).max(1000).nullable().optional(),
  priority: z.enum(taskPriorities).optional(),
  projectId: z.string().min(1).nullable().optional(),
  epicId: z.string().min(1).nullable().optional(),
  sprintId: z.string().min(1).nullable().optional(),
  parentTaskId: z.string().min(1).nullable().optional(),
  backlogRank: z.number().min(0).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  reporterId: z.string().min(1).nullable().optional(),
  labels: z.array(z.string().min(1).max(40)).optional(),
  dueDate: dateStringSchema,
  startDate: dateStringSchema,
  estimatedHours: z.number().min(0).optional(),
  checklist: z.array(checklistItemSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
  recurring: z.boolean().optional(),
  recurrence: z.string().max(40).optional(),
  isDailyTask: z.boolean().optional(),
  isArchived: z.boolean().optional(),
}).superRefine(requireBlockedReason);

export const createDailyTaskSchema = z.object({
  title: z.string().min(2).max(200),
});

export const taskIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const taskProjectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const taskChecklistParamsSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
});

export const checklistToggleSchema = z.object({
  done: z.boolean(),
});

export const logTimeSchema = z.object({
  hours: z.number().min(0.25).max(24),
  note: z.string().max(500).optional(),
});

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  issueType: z.enum(taskIssueTypes).optional(),
  projectId: z.string().optional(),
  epicId: z.string().optional(),
  sprintId: z.string().optional(),
  assigneeId: z.string().optional(),
  isDailyTask: z.coerce.boolean().optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  sortBy: z.enum(["title", "status", "priority", "dueDate", "createdAt", "backlogRank"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  archived: z.coerce.boolean().optional(),
});

export const bulkDeleteTasksSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const bulkUpdateTasksSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  updates: z.object({
    status: z.enum(taskStatuses).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    blockedReason: z.string().trim().min(1).max(1000).nullable().optional(),
    priority: z.enum(taskPriorities).optional(),
    sprintId: z.string().min(1).nullable().optional(),
    epicId: z.string().min(1).nullable().optional(),
    backlogRank: z.number().min(0).nullable().optional(),
    isArchived: z.boolean().optional(),
  }).superRefine(requireBlockedReason),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateDailyTaskInput = z.infer<typeof createDailyTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type BulkDeleteTasksInput = z.infer<typeof bulkDeleteTasksSchema>;
export type BulkUpdateTasksInput = z.infer<typeof bulkUpdateTasksSchema>;
export type ChecklistToggleInput = z.infer<typeof checklistToggleSchema>;
export type LogTimeInput = z.infer<typeof logTimeSchema>;
