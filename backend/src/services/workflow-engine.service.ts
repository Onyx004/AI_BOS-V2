import type { WorkflowConditionOperator } from "../constants/workflow.js";
import type { WorkflowStep, WorkflowStepBranch } from "../models/workflow.model.js";
import { leadService } from "./lead.service.js";
import { taskService } from "./task.service.js";
import { projectService } from "./project.service.js";
import { emailService } from "./email.service.js";
import { notificationService } from "./notification.service.js";
import { logger } from "../utils/logger.js";

function resolveValue(context: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), context);
}

export function evaluateCondition(operator: WorkflowConditionOperator, actual: unknown, expected: string): boolean {
  switch (operator) {
    case "equals":
      return String(actual ?? "") === expected;
    case "not_equals":
      return String(actual ?? "") !== expected;
    case "contains":
      return String(actual ?? "").includes(expected);
    case "greater_than":
      return Number(actual) > Number(expected);
    case "less_than":
      return Number(actual) < Number(expected);
    case "is_empty":
      return actual === undefined || actual === null || actual === "";
    case "is_not_empty":
      return !(actual === undefined || actual === null || actual === "");
    default:
      return false;
  }
}

/**
 * Picks the next step for a condition step: the first branch whose condition
 * matches wins; falls back to the step's own `nextStepId` when no branch
 * matches (or the step has none), matching a simple if/elseif/else shape.
 */
export function resolveNextStepId(step: WorkflowStep, context: Record<string, unknown>): string | undefined {
  const branches: WorkflowStepBranch[] = step.branches ?? [];
  for (const branch of branches) {
    const actual = resolveValue(context, branch.condition);
    if (evaluateCondition(branch.operator, actual, branch.value)) {
      return branch.nextStepId;
    }
  }
  return step.nextStepId;
}

export type ActionResult = { output: Record<string, unknown>; skipped?: boolean };

function stringFrom(config: Record<string, unknown>, context: Record<string, unknown>, key: string): string | undefined {
  const value = config[key] ?? resolveValue(context, key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberFrom(config: Record<string, unknown>, context: Record<string, unknown>, key: string, fallback = 0) {
  const value = config[key] ?? resolveValue(context, key);
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function findLeadId(context: Record<string, unknown>) {
  for (const value of Object.values(context)) {
    if (value && typeof value === "object" && typeof (value as Record<string, unknown>).leadId === "string") {
      return (value as Record<string, string>).leadId;
    }
  }
  return undefined;
}

/**
 * Runs a single "action" step. Actions backed by real services (task,
 * project, email, notification) actually execute; actions with no backing
 * resource in this codebase yet (CRM lead, sales assignment, meeting
 * scheduling) are logged and marked skipped rather than failing the whole
 * workflow — the schema/UI already model them, the underlying feature
 * doesn't exist yet.
 */
export async function runAction(step: WorkflowStep, userId?: string, context: Record<string, unknown> = {}): Promise<ActionResult> {
  const config = step.config ?? {};

  switch (step.actionType) {
    case "create_task": {
      const task = await taskService.create(
        {
          title: typeof config.title === "string" && config.title ? config.title : step.name,
          description: typeof config.description === "string" ? config.description : undefined,
          issueType: "Task",
          status: "Todo",
          priority: (config.priority as never) ?? "Medium",
          projectId: typeof config.projectId === "string" ? config.projectId : undefined,
          assigneeId: typeof config.assigneeId === "string" ? config.assigneeId : undefined,
          labels: Array.isArray(config.labels) ? (config.labels as string[]) : [],
          estimatedHours: 0,
          checklist: [],
          attachments: [],
          recurring: false,
          recurrence: "None",
          isDailyTask: false,
        },
        userId,
      );
      return { output: { taskId: String(task?._id ?? ""), taskCode: task?.taskCode } };
    }

    case "create_project": {
      const now = new Date();
      const inMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const project = await projectService.create(
        {
          projectName: typeof config.projectName === "string" && config.projectName ? config.projectName : step.name,
          description: typeof config.description === "string" ? config.description : undefined,
          category: (config.category as never) ?? "Internal",
          priority: (config.priority as never) ?? "Medium",
          status: "Planning",
          progress: 0,
          startDate: typeof config.startDate === "string" ? new Date(config.startDate) : now,
          endDate: typeof config.endDate === "string" ? new Date(config.endDate) : inMonth,
          budget: 0,
          estimatedHours: 0,
          teamMembers: [],
          projectManager: typeof config.projectManager === "string" && config.projectManager ? config.projectManager : "Unassigned",
          attachments: [],
          epics: [],
          sprints: [],
          tags: [],
        },
        userId,
      );
      return { output: { projectId: String(project._id ?? ""), projectCode: project.projectCode } };
    }

    case "send_email": {
      const to = typeof config.to === "string" ? config.to : "";
      if (!to) return { output: { sent: false, reason: "No recipient email configured" }, skipped: true };
      const sent = await emailService.send({
        to,
        subject: typeof config.subject === "string" && config.subject ? config.subject : step.name,
        text: typeof config.body === "string" ? config.body : "",
      });
      return { output: { sent } };
    }

    case "send_notification": {
      const recipientUserIds = Array.isArray(config.recipientUserIds)
        ? (config.recipientUserIds as unknown[]).filter((id): id is string => typeof id === "string")
        : [];
      if (recipientUserIds.length === 0) {
        return { output: { dispatched: false, reason: "No recipients configured" }, skipped: true };
      }
      await notificationService.dispatch({
        recipientUserIds,
        type: "workflow.notification",
        category: "system",
        title: typeof config.title === "string" && config.title ? config.title : step.name,
        body: typeof config.body === "string" ? config.body : "",
        actorUserId: userId,
        sourceType: "Workflow",
      });
      return { output: { dispatched: true, recipientCount: recipientUserIds.length } };
    }

    case "create_crm_lead":
    {
      const lead = await leadService.create(
        {
          name: stringFrom(config, context, "name") ?? stringFrom(config, context, "customerName") ?? step.name,
          company: stringFrom(config, context, "company"),
          email: stringFrom(config, context, "email"),
          phone: stringFrom(config, context, "phone"),
          source: stringFrom(config, context, "source") ?? "Workflow",
          value: numberFrom(config, context, "value", 0),
          ownerId: stringFrom(config, context, "ownerId"),
          metadata: { workflowStepId: step.stepId, trigger: context },
        },
        userId,
      );
      return { output: { leadId: String(lead._id ?? ""), status: lead.status, value: lead.value } };
    }

    case "assign_sales_executive":
    {
      const leadId = stringFrom(config, context, "leadId") ?? stringFrom(config, context, "createLead.leadId") ?? findLeadId(context);
      const ownerId = stringFrom(config, context, "ownerId") ?? stringFrom(config, context, "salesExecutiveId");
      if (!leadId || !ownerId) {
        return { output: { assigned: false, reason: "leadId and ownerId are required" }, skipped: true };
      }
      await leadService.assignOwner(leadId, ownerId);
      return { output: { assigned: true, leadId, ownerId } };
    }

    case "update_record":
    case "schedule_meeting": {
      logger.warn(`Workflow action "${step.actionType}" has no backing service yet — skipping step "${step.name}"`);
      return { output: { reason: `${step.actionType} is not implemented yet` }, skipped: true };
    }

    default:
      return { output: { reason: "No action type configured on this step" }, skipped: true };
  }
}
