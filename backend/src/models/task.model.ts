import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { taskIssueTypes, taskPriorities, taskStatuses, type TaskIssueType, type TaskPriority, type TaskStatus } from "../constants/tasks.js";

export type TaskAttachment = {
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
};

export type ChecklistItem = {
  _id?: Types.ObjectId;
  title: string;
  done: boolean;
};

export type TimeEntry = {
  userId: Types.ObjectId;
  hours: number;
  note?: string;
  createdAt: Date;
};

export type Task = {
  title: string;
  description?: string;
  taskCode: string;
  issueType: TaskIssueType;
  status: TaskStatus;
  progress: number;
  blockedReason?: string;
  priority: TaskPriority;
  projectId?: Types.ObjectId;
  epicId?: Types.ObjectId;
  sprintId?: Types.ObjectId;
  parentTaskId?: Types.ObjectId;
  backlogRank?: number;
  assigneeId?: Types.ObjectId;
  reporterId?: Types.ObjectId;
  labels: string[];
  dueDate?: Date;
  startDate?: Date;
  estimatedHours: number;
  actualHours: number;
  checklist: ChecklistItem[];
  attachments: TaskAttachment[];
  timeEntries: TimeEntry[];
  recurring: boolean;
  recurrence: string;
  isDailyTask: boolean;
  isArchived: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskDocument = HydratedDocument<Task>;

const attachmentSchema = new Schema<TaskAttachment>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0 },
  },
  { _id: false },
);

const checklistItemSchema = new Schema<ChecklistItem>({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  done: { type: Boolean, default: false },
});

const timeEntrySchema = new Schema<TimeEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    hours: { type: Number, min: 0, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const taskSchema = new Schema<Task>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200, index: true },
    description: { type: String, trim: true, maxlength: 3000 },
    taskCode: { type: String, required: true, unique: true, trim: true, index: true },
    issueType: { type: String, enum: taskIssueTypes, default: "Task", index: true },
    status: { type: String, enum: taskStatuses, default: "Todo", index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    blockedReason: { type: String, trim: true, maxlength: 1000 },
    priority: { type: String, enum: taskPriorities, default: "Medium", index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    epicId: { type: Schema.Types.ObjectId, index: true },
    sprintId: { type: Schema.Types.ObjectId, index: true },
    parentTaskId: { type: Schema.Types.ObjectId, ref: "Task", index: true },
    backlogRank: { type: Number, min: 0, index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User" },
    labels: [{ type: String, trim: true, lowercase: true, index: true }],
    dueDate: { type: Date, index: true },
    startDate: { type: Date },
    estimatedHours: { type: Number, min: 0, default: 0 },
    actualHours: { type: Number, min: 0, default: 0 },
    checklist: { type: [checklistItemSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    timeEntries: { type: [timeEntrySchema], default: [] },
    recurring: { type: Boolean, default: false },
    recurrence: { type: String, trim: true, default: "None" },
    isDailyTask: { type: Boolean, default: false, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

taskSchema.index({
  title: "text",
  description: "text",
  taskCode: "text",
  labels: "text",
});
taskSchema.index({ isArchived: 1, createdAt: -1 });
taskSchema.index({ isArchived: 1, status: 1, createdAt: -1 });
taskSchema.index({ isArchived: 1, priority: 1, dueDate: 1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ projectId: 1, issueType: 1, backlogRank: 1 });
taskSchema.index({ projectId: 1, sprintId: 1, status: 1 });
taskSchema.index({ projectId: 1, epicId: 1, status: 1 });
taskSchema.index({ assigneeId: 1, status: 1 });
taskSchema.index({ assigneeId: 1, isDailyTask: 1, dueDate: 1 });

export const TaskModel = model("Task", taskSchema);
