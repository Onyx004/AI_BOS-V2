import type { Types } from "mongoose";
import { taskRepository } from "../repositories/task.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import type { Task } from "../models/task.model.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { notificationService } from "./notification.service.js";
import { taskAccessService, type TaskAccess } from "./task-access.service.js";
import { AppError } from "../utils/app-error.js";
import { toCsv } from "../utils/csv.js";
import { createSimplePdfBuffer } from "../utils/pdf.js";
import { generateTaskCode } from "../utils/task-code.js";
import type {
  BulkDeleteTasksInput,
  BulkUpdateTasksInput,
  CreateTaskInput,
  ListTasksQuery,
  LogTimeInput,
  UpdateTaskInput,
} from "../validation/task.validation.js";

function normalizeLabels(labels: string[]) {
  return [...new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean))];
}

type CreateTaskServiceInput = Omit<CreateTaskInput, "progress"> & { progress?: number };

const employeeWorkUpdateFields = new Set(["status", "progress", "blockedReason"]);

function checklistProgress(checklist: Array<{ done: boolean }>) {
  if (checklist.length === 0) return undefined;
  return Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
}

function normalizedProgress(
  status: Task["status"],
  requestedProgress: number | undefined,
  checklist: Array<{ done: boolean }>,
  fallbackProgress = 0,
) {
  let progress = checklistProgress(checklist) ?? requestedProgress ?? fallbackProgress;
  if (status === "Completed") progress = 100;
  if (status === "Todo" && checklist.length === 0 && requestedProgress === undefined) progress = 0;
  if (status === "In Progress" && progress >= 100) progress = 99;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function taskUpdateProgress(existing: Task, input: UpdateTaskInput) {
  const nextStatus = input.status ?? existing.status;
  const checklist = input.checklist ?? existing.checklist;
  let fallbackProgress = existing.progress ?? checklistProgress(existing.checklist) ?? 0;

  if (existing.status === "Completed" && nextStatus !== "Completed" && input.progress === undefined) {
    fallbackProgress = Math.min(fallbackProgress, 99);
  }

  return normalizedProgress(nextStatus, input.progress, checklist, fallbackProgress);
}

function withTaskProgress<T extends Pick<Task, "status" | "progress" | "checklist">>(task: T) {
  const progress = normalizedProgress(task.status, task.progress, task.checklist, 0);
  return { ...task, progress, remaining: 100 - progress };
}

async function createUniqueTaskCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taskCode = generateTaskCode();
    const existingTask = await taskRepository.findByCode(taskCode);

    if (!existingTask) {
      return taskCode;
    }
  }

  throw new AppError("Unable to generate unique task code", 500);
}

function notifyAssignee(taskId: string, taskTitle: string, assigneeId: string, actorUserId?: string) {
  if (assigneeId === actorUserId) return;

  void notificationService.dispatch({
    recipientUserIds: [assigneeId],
    type: "task.assigned",
    category: "system",
    title: "You were assigned a task",
    body: taskTitle,
    actionUrl: `/tasks/${taskId}`,
    actorUserId,
    sourceType: "Task",
    sourceId: taskId,
  });
}

export class TaskService {
  private async accessFor(actor: AuthenticatedUser) {
    return taskAccessService.resolve(actor);
  }

  private assertVisible(task: Pick<Task, "assigneeId" | "projectId">, access: TaskAccess) {
    if (!taskAccessService.canView(task, access)) {
      throw new AppError("You do not have access to this task", 403);
    }
  }

  async assertCanView(id: string, actor: AuthenticatedUser) {
    const [task, access] = await Promise.all([
      taskRepository.findById(id),
      this.accessFor(actor),
    ]);
    if (!task) throw new AppError("Task not found", 404);
    this.assertVisible(task, access);
    return withTaskProgress(task);
  }

  async create(input: CreateTaskServiceInput, userId?: string) {
    const taskCode = await createUniqueTaskCode();
    const progress = normalizedProgress(input.status, input.progress, input.checklist);

    const task = await taskRepository.create({
      ...input,
      taskCode,
      progress,
      labels: normalizeLabels(input.labels),
      blockedReason: input.blockedReason ?? undefined,
      description: input.description ?? undefined,
      reporterId: (input.reporterId ?? userId) as unknown as Types.ObjectId,
      projectId: (input.projectId ?? undefined) as unknown as Types.ObjectId,
      epicId: (input.epicId ?? undefined) as unknown as Types.ObjectId,
      sprintId: (input.sprintId ?? undefined) as unknown as Types.ObjectId,
      parentTaskId: (input.parentTaskId ?? undefined) as unknown as Types.ObjectId,
      backlogRank: input.backlogRank ?? undefined,
      assigneeId: (input.assigneeId ?? undefined) as unknown as Types.ObjectId,
      dueDate: input.dueDate ?? undefined,
      startDate: input.startDate ?? undefined,
      actualHours: 0,
      timeEntries: [],
      isArchived: false,
      createdBy: userId as unknown as Types.ObjectId,
      updatedBy: userId as unknown as Types.ObjectId,
    });

    if (input.assigneeId) {
      notifyAssignee((task._id as Types.ObjectId).toString(), task.title, input.assigneeId, userId);
    }

    const created = await taskRepository.findById((task._id as Types.ObjectId).toString());
    return created ? withTaskProgress(created) : created;
  }

  async list(query: ListTasksQuery, actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);
    const resolvedQuery = query.assigneeId === "me" ? { ...query, assigneeId: actor.id } : query;
    const result = await taskRepository.list(resolvedQuery, taskAccessService.toFilter(access));
    return { ...result, items: result.items.map(withTaskProgress) };
  }

  async createDailyTask(title: string, actor: AuthenticatedUser) {
    const taskCode = await createUniqueTaskCode();
    return taskRepository.create({
      title,
      taskCode,
      status: "Todo",
      progress: 0,
      priority: "Medium",
      issueType: "Task",
      labels: [],
      isDailyTask: true,
      dueDate: new Date(),
      assigneeId: actor.id as unknown as Types.ObjectId,
      reporterId: actor.id as unknown as Types.ObjectId,
      estimatedHours: 0,
      actualHours: 0,
      checklist: [],
      attachments: [],
      timeEntries: [],
      recurring: false,
      recurrence: "None",
      isArchived: false,
      createdBy: actor.id as unknown as Types.ObjectId,
      updatedBy: actor.id as unknown as Types.ObjectId,
    });
  }

  async listByProject(projectId: string, actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);
    const tasks = await taskRepository.listByProject(projectId, taskAccessService.toFilter(access));
    return tasks.map(withTaskProgress);
  }

  async getById(id: string, actor: AuthenticatedUser) {
    return this.assertCanView(id, actor);
  }

  async update(id: string, input: UpdateTaskInput, actor: AuthenticatedUser) {
    const [existing, access] = await Promise.all([
      taskRepository.findById(id),
      this.accessFor(actor),
    ]);
    if (!existing) {
      throw new AppError("Task not found", 404);
    }
    this.assertVisible(existing, access);

    if (!taskAccessService.canManage(existing, access)) {
      const disallowedFields = Object.keys(input).filter((field) => !employeeWorkUpdateFields.has(field));
      if (disallowedFields.length > 0) {
        throw new AppError(`Assigned users cannot update task fields: ${disallowedFields.join(", ")}`, 403);
      }
    }

    const updates = {
      ...input,
      progress: taskUpdateProgress(existing as Task, input),
      ...(input.labels ? { labels: normalizeLabels(input.labels) } : {}),
      updatedBy: actor.id,
    };

    const task = await taskRepository.update(id, updates);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const existingAssigneeId = existing.assigneeId ? String((existing.assigneeId as { _id?: unknown })._id ?? existing.assigneeId) : undefined;
    if (input.assigneeId && input.assigneeId !== existingAssigneeId) {
      notifyAssignee(id, task.title, input.assigneeId, actor.id);
    }

    return withTaskProgress(task);
  }

  async delete(id: string, actor: AuthenticatedUser) {
    const [task, access] = await Promise.all([
      taskRepository.findById(id),
      this.accessFor(actor),
    ]);
    if (!task) {
      throw new AppError("Task not found", 404);
    }
    this.assertVisible(task, access);
    if (!taskAccessService.canManage(task, access)) {
      throw new AppError("You do not have permission to delete this task", 403);
    }
    const deleted = await taskRepository.delete(id);

    if (!deleted) {
      throw new AppError("Task not found", 404);
    }

    return { deleted: true };
  }

  async bulkDelete(input: BulkDeleteTasksInput, actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);
    const result = await taskRepository.bulkDelete(input.ids, taskAccessService.toFilter(access));
    return { deletedCount: result.deletedCount };
  }

  async bulkUpdate(input: BulkUpdateTasksInput, actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);
    let progress = input.updates.status === "Completed"
      ? 100
      : input.updates.status === "Todo"
        ? 0
        : input.updates.progress;
    if (input.updates.status === "In Progress" && progress !== undefined) {
      progress = Math.min(progress, 99);
    }
    const result = await taskRepository.bulkUpdate(input.ids, {
      ...input.updates,
      ...(progress !== undefined ? { progress } : {}),
      updatedBy: actor.id,
    }, taskAccessService.toFilter(access));

    return { modifiedCount: result.modifiedCount };
  }

  async updateChecklistItem(taskId: string, itemId: string, done: boolean, actor: AuthenticatedUser) {
    const [task, access] = await Promise.all([
      taskRepository.findById(taskId),
      this.accessFor(actor),
    ]);
    if (!task) {
      throw new AppError("Task not found", 404);
    }
    this.assertVisible(task, access);

    const checklist = task.checklist.map((item) =>
      String(item._id) === itemId ? { ...item, done } : item,
    );

    const progress = normalizedProgress(task.status, undefined, checklist, task.progress ?? 0);
    const updated = await taskRepository.update(taskId, { checklist, progress, updatedBy: actor.id });
    if (!updated) {
      throw new AppError("Task not found", 404);
    }

    return withTaskProgress(updated);
  }

  async logTime(taskId: string, input: LogTimeInput, actor: AuthenticatedUser) {
    const [task, access] = await Promise.all([
      taskRepository.findById(taskId),
      this.accessFor(actor),
    ]);
    if (!task) {
      throw new AppError("Task not found", 404);
    }
    this.assertVisible(task, access);

    const timeEntries = [
      ...task.timeEntries,
      { userId: actor.id as unknown as Types.ObjectId, hours: input.hours, note: input.note, createdAt: new Date() },
    ];

    const updated = await taskRepository.update(taskId, {
      timeEntries,
      actualHours: task.actualHours + input.hours,
      updatedBy: actor.id,
    });

    if (!updated) {
      throw new AppError("Task not found", 404);
    }

    return withTaskProgress(updated);
  }

  async stats(actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);
    return taskRepository.stats(taskAccessService.toFilter(access));
  }

  async teamSummary(actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);

    const members = access.allTasks
      ? await userRepository.findMany({ isActive: true, _id: { $ne: actor.id } })
      : await userRepository.findMany({ _id: { $in: access.managedAssigneeIds.filter((id) => id !== actor.id) } });

    const memberIds = members.map((member) => (member._id as Types.ObjectId).toString());
    const summaries = await taskRepository.teamSummary(memberIds);
    const summaryById = new Map(summaries.map((summary) => [summary._id.toString(), summary]));

    return members.map((member) => {
      const id = (member._id as Types.ObjectId).toString();
      const summary = summaryById.get(id);
      return {
        id,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        totalTasks: summary?.total ?? 0,
        completedTasks: summary?.completed ?? 0,
        overdueTasks: summary?.overdue ?? 0,
      };
    });
  }

  async exportCsv(query: ListTasksQuery, actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);
    const tasks = await taskRepository.listAll(query, taskAccessService.toFilter(access));
    return toCsv(
      tasks.map((task) => ({
        taskCode: task.taskCode,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
      })),
      ["taskCode", "title", "status", "priority", "dueDate", "estimatedHours", "actualHours"],
    );
  }

  async exportPdf(query: ListTasksQuery, actor: AuthenticatedUser) {
    const access = await this.accessFor(actor);
    const tasks = await taskRepository.listAll(query, taskAccessService.toFilter(access));
    const lines = tasks.map((task) => `${task.taskCode} - ${task.title} - ${task.status} - ${task.priority}`);

    return createSimplePdfBuffer("AI BOS Task Export", lines);
  }
}

export const taskService = new TaskService();
