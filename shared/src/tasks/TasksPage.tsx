import { motion } from "framer-motion";
import {
 AlarmClock,
 ArrowLeft,
 Bell,
 CheckCircle2,
 ClipboardCheck,
 Clock3,
 Edit3,
 Flag,
 GitBranch,
 Layers3,
 LayoutList,
 ListChecks,
 Plus,
 Rocket,
 Search,
 Timer,
 Trash2,
 UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@shared/ui/ThemeToggle";
import { usePermissions } from "@shared/auth/usePermissions";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { useConfirm } from "@shared/ui/confirm-dialog-context";
import { Dialog } from "@shared/ui/dialog";
import { EmptyState } from "@shared/ui/empty-state";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { useToast } from "@shared/ui/toast-context";
import { cn } from "@shared/lib/utils";
import { formatDateTime } from "@shared/lib/utils-helpers";
import { fetchEmployeeUsers } from "@shared/employees/employees.api";
import { fetchProjects, type ProjectSummary } from "@shared/projects/projects.api";
import { liveSyncIntervalMs, sharedDataChangedEvent } from "@shared/realtime/data-sync";
import { fetchTaskComments, postTaskComment, type Comment } from "@shared/tasks/task-comments.api";
import {
 createDailyTask as apiCreateDailyTask,
 createTask as apiCreateTask,
 deleteTask as apiDeleteTask,
 fetchTasks as apiFetchTasks,
 fetchTeamTaskSummary,
 logTaskTime as apiLogTaskTime,
 toggleChecklistItem as apiToggleChecklistItem,
 updateTask as apiUpdateTask,
 type TeamTaskSummary,
} from "@shared/tasks/tasks.api";
import { taskIssueTypes, taskLabels, taskPriorities, taskStatuses } from "./tasks.data";
import { taskFormSchema, type TaskFormValues } from "./tasks.schema";
import type { Task, TaskFormInput, TaskStatus, TaskView } from "./tasks.types";
import { formatHours, getTaskCompletion, getTaskStats, priorityClass, statusClass } from "./tasks.utils";

const emptyForm: TaskFormInput = {
 title: "",
 description: "",
 issueType: "Task",
 status: "Todo",
 progress: 0,
 blockedReason: "",
 priority: "Medium",
 labels: [],
 assignee: "",
 reporter: "",
 dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
 startDate: new Date().toISOString().slice(0, 10),
 estimatedHours: 0,
 actualHours: 0,
 attachments: [],
 comments: [],
 checklist: [],
 recurring: false,
 recurrence: "None",
 notifications: [],
};

function parseList(value: string) {
 return value
 .split(",")
 .map((item) => item.trim())
 .filter(Boolean);
}

function getProjectName(projects: ProjectSummary[], projectId?: string) {
 return projects.find((project) => project.id === projectId)?.projectName ?? "No project";
}

function getSprintName(projects: ProjectSummary[], sprintId?: string) {
 return projects.flatMap((project) => project.sprints).find((sprint) => sprint.id === sprintId)?.name ?? "Backlog";
}

function getEpicTitle(projects: ProjectSummary[], epicId?: string) {
 return projects.flatMap((project) => project.epics).find((epic) => epic.id === epicId)?.title ?? "No epic";
}

function TaskCommentsPanel({ taskId }: { taskId: string }) {
 const [comments, setComments] = useState<Comment[]>([]);
 const [body, setBody] = useState("");
 const [loading, setLoading] = useState(true);
 const [posting, setPosting] = useState(false);

 useEffect(() => {
 fetchTaskComments(taskId).then((result) => {
 if (result.status === "ok") setComments(result.data);
 setLoading(false);
 });
 }, [taskId]);

 const handlePost = async () => {
 const trimmed = body.trim();
 if (!trimmed || posting) return;
 setPosting(true);
 try {
 const comment = await postTaskComment(taskId, trimmed);
 setComments((current) => [...current, comment]);
 setBody("");
 } catch {
 // Silently ignore — the input stays filled so the user can retry.
 } finally {
 setPosting(false);
 }
 };

 return (
 <div className="space-y-2 md:col-span-2">
 <Label>Comments</Label>
 <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-background p-3">
 {loading ? (
 <p className="text-xs text-muted-foreground">Loading comments...</p>
 ) : comments.length === 0 ? (
 <p className="text-xs text-muted-foreground">No comments yet.</p>
 ) : (
 comments.map((comment) => (
 <div className="rounded-md border bg-card p-2 text-sm" key={comment.id}>
 <div className="flex items-center justify-between gap-2">
 <span className="font-semibold">{comment.author}</span>
 <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
 </div>
 <p className="mt-1 text-muted-foreground">{comment.body}</p>
 </div>
 ))
 )}
 </div>
 <div className="flex gap-2">
 <Input
 onChange={(event) => setBody(event.target.value)}
 onKeyDown={(event) => {
 if (event.key === "Enter" && !event.shiftKey) {
 event.preventDefault();
 void handlePost();
 }
 }}
 placeholder="Write a comment..."
 value={body}
 />
 <Button disabled={posting || !body.trim()} onClick={handlePost} type="button">
 Post
 </Button>
 </div>
 </div>
 );
}

function TaskFormModal({
 defaultAssignee,
 initialTask,
 onClose,
 onSubmit,
 projects,
 tasks,
 teamMembers,
}: {
 defaultAssignee?: string;
 initialTask?: Task | null;
 onClose: () => void;
 onSubmit: (input: TaskFormInput) => void;
 projects: ProjectSummary[];
 tasks: Task[];
 teamMembers: string[];
}) {
 const defaultValues: TaskFormValues = initialTask
 ? {
 taskCode: initialTask.taskCode,
 title: initialTask.title,
 description: initialTask.description,
 issueType: initialTask.issueType ?? "Task",
 status: initialTask.status,
 progress: initialTask.progress,
 blockedReason: initialTask.blockedReason ?? "",
 priority: initialTask.priority,
 projectId: initialTask.projectId,
 epicId: initialTask.epicId,
 sprintId: initialTask.sprintId,
 parentTaskId: initialTask.parentTaskId,
 backlogRank: initialTask.backlogRank,
 labels: initialTask.labels,
 assignee: initialTask.assignee,
 reporter: initialTask.reporter,
 dueDate: initialTask.dueDate,
 startDate: initialTask.startDate,
 estimatedHours: initialTask.estimatedHours,
 actualHours: initialTask.actualHours,
 attachments: initialTask.attachments,
 comments: initialTask.comments,
 checklist: initialTask.checklist,
 recurring: initialTask.recurring,
 recurrence: initialTask.recurrence,
 notifications: initialTask.notifications,
 }
 : { ...emptyForm, assignee: defaultAssignee ?? emptyForm.assignee };

 const {
 control,
 formState: { errors },
 handleSubmit,
 register,
 watch,
 } = useForm<TaskFormValues>({
 resolver: zodResolver(taskFormSchema),
 defaultValues,
 });

 const selectedProjectId = watch("projectId");
 const selectedStatus = watch("status");
 const selectedProject = projects.find((project) => project.id === selectedProjectId);
 const parentOptions = tasks.filter((task) => task.id !== initialTask?.id && (task.issueType ?? "Task") !== "Subtask");

 return (
 <Dialog as="form" className="max-w-5xl" onClose={onClose} onSubmit={handleSubmit(onSubmit)}>
 <div className="mb-6 flex items-start justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">{initialTask ? "Edit Task" : "Assign Task"}</h2>
 <p className="mt-1 text-sm text-muted-foreground">{initialTask?.taskCode ?? "Task code is assigned when saved"}</p>
 </div>
 <Button onClick={onClose} type="button" variant="outline">
 Close
 </Button>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="title">Title</Label>
 <Input id="title" className={cn(errors.title && "border-destructive focus-visible:ring-destructive/20")} {...register("title")} />
 {errors.title && <p className="text-xs font-medium text-destructive">{errors.title.message}</p>}
 </div>
 <div className="space-y-2">
 <Label>Status</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("status")}>
 {taskStatuses.map((status) => (
 <option key={status}>{status}</option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="progress">Progress</Label>
 <Input id="progress" max={100} min={0} type="number" {...register("progress", { valueAsNumber: true })} />
 </div>
 {selectedStatus === "Blocked" && (
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="blockedReason">Blocked reason</Label>
 <textarea
 className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
 id="blockedReason"
 {...register("blockedReason")}
 />
 {errors.blockedReason && <p className="text-xs font-medium text-destructive">{errors.blockedReason.message}</p>}
 </div>
 )}
 <div className="space-y-2">
 <Label>Priority</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("priority")}>
 {taskPriorities.map((priority) => (
 <option key={priority}>{priority}</option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label>Issue Type</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("issueType")}>
 {taskIssueTypes.map((issueType) => (
 <option key={issueType}>{issueType}</option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label>Project</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("projectId")}>
 <option value="">No project</option>
 {projects.map((project) => (
 <option key={project.id} value={project.id}>
 {project.projectName}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label>Epic</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("epicId")}>
 <option value="">No epic</option>
 {(selectedProject?.epics ?? []).map((epic) => (
 <option key={epic.id} value={epic.id}>
 {epic.title}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label>Sprint</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("sprintId")}>
 <option value="">Backlog</option>
 {(selectedProject?.sprints ?? []).map((sprint) => (
 <option key={sprint.id} value={sprint.id}>
 {sprint.name} ({sprint.status})
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label>Parent Task</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("parentTaskId")}>
 <option value="">No parent</option>
 {parentOptions.map((task) => (
 <option key={task.id} value={task.id}>
 {task.taskCode} - {task.title}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label>Assignee</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("assignee")}>
 <option value="">Unassigned</option>
 {teamMembers.map((member) => (
 <option key={member}>{member}</option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label>Reporter</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" {...register("reporter")}>
 <option value="">Current user</option>
 {teamMembers.map((member) => (
 <option key={member}>{member}</option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="labels">Labels</Label>
 <Controller
 control={control}
 name="labels"
 render={({ field }) => (
 <Input
 id="labels"
 placeholder="Frontend, AI, Bug"
 value={field.value.join(", ")}
 onChange={(event) => field.onChange(parseList(event.target.value))}
 />
 )}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="startDate">Start Date</Label>
 <Input id="startDate" type="date" {...register("startDate")} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="dueDate">Due Date</Label>
 <Input id="dueDate" type="date" {...register("dueDate")} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="estimatedHours">Estimated Hours</Label>
 <Input
 id="estimatedHours"
 min={0}
 type="number"
 className={cn(errors.estimatedHours && "border-destructive focus-visible:ring-destructive/20")}
 {...register("estimatedHours", { valueAsNumber: true })}
 />
 {errors.estimatedHours && <p className="text-xs font-medium text-destructive">{errors.estimatedHours.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="actualHours">Actual Hours</Label>
 <Input
 id="actualHours"
 min={0}
 type="number"
 className={cn(errors.actualHours && "border-destructive focus-visible:ring-destructive/20")}
 {...register("actualHours", { valueAsNumber: true })}
 />
 {errors.actualHours && <p className="text-xs font-medium text-destructive">{errors.actualHours.message}</p>}
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="description">Description</Label>
 <textarea
 className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
 id="description"
 {...register("description")}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="attachments">Attachments</Label>
 <Controller
 control={control}
 name="attachments"
 render={({ field }) => (
 <Input
 id="attachments"
 placeholder="brief.pdf, screenshot.png"
 value={field.value.map((item) => item.name).join(", ")}
 onChange={(event) =>
 field.onChange(parseList(event.target.value).map((name) => ({ name, type: "File", size: "Pending" })))
 }
 />
 )}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="notifications">Notifications</Label>
 <Controller
 control={control}
 name="notifications"
 render={({ field }) => (
 <Input
 id="notifications"
 placeholder="Due soon, Needs review"
 value={field.value.join(", ")}
 onChange={(event) => field.onChange(parseList(event.target.value))}
 />
 )}
 />
 </div>
 {initialTask ? <TaskCommentsPanel taskId={initialTask.id} /> : null}
 <div className="space-y-2">
 <Label htmlFor="checklist">Checklist</Label>
 <Controller
 control={control}
 name="checklist"
 render={({ field }) => (
 <Input
 id="checklist"
 placeholder="Design, Build, Review"
 value={field.value.map((item) => item.title).join(", ")}
 onChange={(event) =>
 field.onChange(
 parseList(event.target.value).map((title, index) => ({
 id: `checklist-${index}`,
 title,
 done: false,
 })),
 )
 }
 />
 )}
 />
 </div>
 <div className="flex items-center gap-3 rounded-lg border bg-muted p-4">
 <input className="h-4 w-4 accent-primary" id="recurring" type="checkbox" {...register("recurring")} />
 <Label htmlFor="recurring">Recurring Task</Label>
 </div>
 <div className="space-y-2">
 <Label htmlFor="recurrence">Recurrence</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" id="recurrence" {...register("recurrence")}>
 {["None", "Daily", "Weekly", "Monthly", "Quarterly"].map((item) => (
 <option key={item}>{item}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="mt-6 flex justify-end gap-3">
 <Button onClick={onClose} type="button" variant="outline">
 Cancel
 </Button>
 <Button type="submit">{initialTask ? "Save Task" : "Assign Task"}</Button>
 </div>
 </Dialog>
 );
}


function TaskDetailDrawer({
 canLogTime,
 canManageTask,
 canUpdateWork,
 onClose,
 onEdit,
 onLogTime,
 onToggleChecklist,
 onWorkUpdate,
 projects,
 task,
}: {
 canLogTime: boolean;
 canManageTask: boolean;
 canUpdateWork: boolean;
 onClose: () => void;
 onEdit: () => void;
 onLogTime: () => void;
 onToggleChecklist: (itemId: string) => void;
 onWorkUpdate: (input: Record<string, unknown>) => void;
 projects: ProjectSummary[];
 task: Task;
}) {
 const completion = getTaskCompletion(task);
 const [workStatus, setWorkStatus] = useState<TaskStatus>(task.status);
 const [workProgress, setWorkProgress] = useState(task.progress);
 const [blockedReason, setBlockedReason] = useState(task.blockedReason ?? "");

 useEffect(() => {
 setWorkStatus(task.status);
 setWorkProgress(task.progress);
 setBlockedReason(task.blockedReason ?? "");
 }, [task.blockedReason, task.id, task.progress, task.status]);

 return (
 <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30 p-3">
 <aside className="h-full w-full max-w-xl overflow-y-auto rounded-lg border bg-background shadow-glass">
 <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background p-5">
 <div className="min-w-0">
 <p className="text-xs font-semibold text-primary">{task.taskCode}</p>
 <h2 className="mt-1 text-xl font-bold leading-7">{task.title}</h2>
 </div>
 <Button onClick={onClose} type="button" variant="outline">Close</Button>
 </div>
 <div className="space-y-5 p-5">
 <div className="flex flex-wrap gap-2">
 <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusClass(task.status))}>{task.status}</span>
 <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", priorityClass(task.priority))}>{task.priority}</span>
 <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">{task.issueType ?? "Task"}</span>
 </div>
 <p className="text-sm leading-6 text-muted-foreground">{task.description || "No description."}</p>
 <div className="rounded-md border bg-card p-4">
 <div className="flex items-center justify-between gap-3">
 <p className="text-sm font-semibold">Work progress</p>
 <span className="text-xs font-semibold text-muted-foreground">{task.remaining}% remaining</span>
 </div>
 <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
 </div>
 <p className="mt-2 text-xs text-muted-foreground">Completed: {completion}% · Remaining: {100 - completion}%</p>
 {canUpdateWork && (
 <div className="mt-4 grid gap-3 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="task-work-status">Status</Label>
 <select
 className="h-10 w-full rounded-md border bg-background px-3 text-sm"
 id="task-work-status"
 onChange={(event) => setWorkStatus(event.target.value as TaskStatus)}
 value={workStatus}
 >
 {taskStatuses.map((item) => <option key={item}>{item}</option>)}
 </select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="task-work-progress">Progress (%)</Label>
 <Input
 disabled={task.checklist.length > 0}
 id="task-work-progress"
 max={100}
 min={0}
 onChange={(event) => setWorkProgress(Math.max(0, Math.min(100, Number(event.target.value))))}
 type="number"
 value={workProgress}
 />
 {task.checklist.length > 0 && (
 <p className="text-xs text-muted-foreground">Calculated from checklist completion.</p>
 )}
 </div>
 {workStatus === "Blocked" && (
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="task-blocked-reason">Blocked reason</Label>
 <textarea
 className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
 id="task-blocked-reason"
 onChange={(event) => setBlockedReason(event.target.value)}
 value={blockedReason}
 />
 </div>
 )}
 <div className="sm:col-span-2">
 <Button
 disabled={workStatus === "Blocked" && !blockedReason.trim()}
 onClick={() => onWorkUpdate({
 status: workStatus,
 progress: workProgress,
 blockedReason: workStatus === "Blocked" ? blockedReason.trim() : null,
 })}
 type="button"
 >
 Save work update
 </Button>
 </div>
 </div>
 )}
 {task.status === "Blocked" && task.blockedReason && (
 <p className="mt-3 rounded-md bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
 Blocked: {task.blockedReason}
 </p>
 )}
 </div>
 <div className="grid gap-3 sm:grid-cols-2">
 {[
 ["Project", getProjectName(projects, task.projectId), Layers3],
 ["Epic", getEpicTitle(projects, task.epicId), GitBranch],
 ["Sprint", getSprintName(projects, task.sprintId), Rocket],
 ["Assignee", task.assignee, Flag],
 ].map(([label, value, Icon]) => {
 const DetailIcon = Icon as typeof Layers3;
 return (
 <div className="rounded-md border bg-card p-3" key={label as string}>
 <DetailIcon className="mb-2 h-4 w-4 text-primary" />
 <p className="text-xs text-muted-foreground">{label as string}</p>
 <p className="mt-1 truncate text-sm font-semibold">{value as string}</p>
 </div>
 );
 })}
 </div>
 <div className="rounded-md border bg-card p-3">
 <div className="flex items-center justify-between gap-3 text-sm">
 <span className="font-semibold">Time</span>
 <span>{formatHours(task.actualHours)} / {formatHours(task.estimatedHours)}</span>
 </div>
 <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full bg-emerald-500" style={{ width: `${task.estimatedHours ? Math.min(100, (task.actualHours / task.estimatedHours) * 100) : 0}%` }} />
 </div>
 </div>
 <div className="rounded-md border bg-card p-3">
 <p className="text-sm font-semibold">Checklist</p>
 <div className="mt-3 space-y-2">
 {task.checklist.length === 0 ? (
 <p className="text-sm text-muted-foreground">No checklist items.</p>
 ) : (
 task.checklist.map((item) => (
 <div className="flex items-center gap-2 text-sm" key={item.id}>
 <input
 checked={item.done}
 className="h-4 w-4 accent-primary"
 disabled={!canUpdateWork}
 onChange={() => onToggleChecklist(item.id)}
 type="checkbox"
 />
 <span className={cn(item.done && "line-through text-muted-foreground")}>{item.title}</span>
 </div>
 ))
 )}
 </div>
 </div>
 <TaskCommentsPanel taskId={task.id} />
 <div className="flex flex-wrap gap-2">
 {canManageTask && <Button onClick={onEdit} type="button">
 <Edit3 className="h-4 w-4" />
 Edit
 </Button>}
 {canLogTime && <Button onClick={onLogTime} type="button" variant="outline">
 <Timer className="h-4 w-4" />
 Log 1h
 </Button>}
 </div>
 </div>
 </aside>
 </div>
 );
}


export function TasksPage() {
 const { confirm } = useConfirm();
 const { toast } = useToast();
 const { hasAnyPermission, hasPermission } = usePermissions();
 const canCreateTask = hasPermission("task.create");
 const canUpdateTask = hasPermission("task.update");
 const canDeleteTask = hasPermission("task.delete");
 const canLogTime = hasPermission("task.log_time");
 const canManageTask = hasAnyPermission("task.view_stats", "task.export", "task.delete", "task.bulk_update", "task.bulk_delete");
 const canViewTeam = hasPermission("task.view_team");
 const [tasks, setTasks] = useState<Task[]>([]);
 const [teamSummary, setTeamSummary] = useState<TeamTaskSummary[]>([]);
 const [teamSummaryLoaded, setTeamSummaryLoaded] = useState(false);
 const [teamSummaryLoading, setTeamSummaryLoading] = useState(false);
 const [selectedTeamMember, setSelectedTeamMember] = useState<TeamTaskSummary | null>(null);
 const [teamMemberTasks, setTeamMemberTasks] = useState<Task[]>([]);
 const [teamMemberTasksLoading, setTeamMemberTasksLoading] = useState(false);
 const [assignTaskForPerson, setAssignTaskForPerson] = useState<string | null>(null);
 const [isAddingDailyTask, setIsAddingDailyTask] = useState(false);
 const [dailyTaskTitle, setDailyTaskTitle] = useState("");
 const [savingDailyTask, setSavingDailyTask] = useState(false);
 const [projects, setProjects] = useState<ProjectSummary[]>([]);
 const [teamMembers, setTeamMembers] = useState<string[]>([]);
 const [employeeIdByName, setEmployeeIdByName] = useState<Record<string, string>>({});
 const [view, setView] = useState<TaskView>("list");
 const [search, setSearch] = useState("");
 const [status, setStatus] = useState("All");
 const [priority, setPriority] = useState("All");
 const [issueType, setIssueType] = useState("All Types");
 const [projectId, setProjectId] = useState("All Projects");
 const [editingTask, setEditingTask] = useState<Task | null>(null);
 const [selectedTask, setSelectedTask] = useState<Task | null>(null);
 const [isCreating, setIsCreating] = useState(false);

 const loadTasks = useCallback(async () => {
 const result = await apiFetchTasks();
 if (result.status === "ok") setTasks(result.data as unknown as Task[]);
 }, []);

 const loadProjects = useCallback(async () => {
 const result = await fetchProjects();
 if (result.status === "ok") setProjects(result.data);
 }, []);

 const loadTeamSummary = useCallback(async () => {
 setTeamSummaryLoading(true);
 try {
 const result = await fetchTeamTaskSummary();
 if (result.status === "ok") {
 setTeamSummary(result.data);
 setTeamSummaryLoaded(true);
 }
 } finally {
 setTeamSummaryLoading(false);
 }
 }, []);

 const openTeamMember = useCallback(async (member: TeamTaskSummary) => {
 setSelectedTeamMember(member);
 setTeamMemberTasksLoading(true);
 try {
 const result = await apiFetchTasks({ assigneeId: member.id });
 if (result.status === "ok") setTeamMemberTasks(result.data as unknown as Task[]);
 } finally {
 setTeamMemberTasksLoading(false);
 }
 }, []);

 useEffect(() => {
 void loadTasks();
 void loadProjects();

 fetchEmployeeUsers().then((result) => {
 if (result.status !== "ok") return;
 const names = result.data.map((employee) => employee.fullName);
 setTeamMembers(names);
 setEmployeeIdByName(
 Object.fromEntries(result.data.map((employee) => [employee.fullName, employee.id])),
 );
 });
 }, [loadProjects, loadTasks]);

 useEffect(() => {
 const reload = () => {
 void loadTasks();
 void loadProjects();
 };
 const interval = window.setInterval(reload, liveSyncIntervalMs);
 window.addEventListener(sharedDataChangedEvent, reload);
 window.addEventListener("storage", reload);
 return () => {
 window.clearInterval(interval);
 window.removeEventListener(sharedDataChangedEvent, reload);
 window.removeEventListener("storage", reload);
 };
 }, [loadProjects, loadTasks]);

 const filteredTasks = useMemo(() => {
 return tasks
 .filter((task) => {
 const searchText = `${task.title} ${task.description} ${task.assignee} ${task.reporter} ${task.labels.join(" ")}`.toLowerCase();
 return searchText.includes(search.toLowerCase());
 })
 .filter((task) => status === "All" || task.status === status)
 .filter((task) => priority === "All" || task.priority === priority)
 .filter((task) => issueType === "All Types" || (task.issueType ?? "Task") === issueType)
 .filter((task) => projectId === "All Projects" || task.projectId === projectId);
 }, [issueType, priority, projectId, search, status, tasks]);

 const stats = getTaskStats(tasks);
 const latestActivities = tasks.flatMap((task) => task.activityLogs.map((log) => ({ ...log, task: task.title }))).slice(0, 6);
 const notifications = tasks.flatMap((task) => task.notifications.map((title) => ({ id: `${task.id}-${title}`, title, task: task.title }))).slice(0, 6);

 const addDailyTask = async () => {
 const title = dailyTaskTitle.trim();
 if (title.length < 2) return;
 setSavingDailyTask(true);
 try {
 const created = await apiCreateDailyTask(title);
 setTasks((current) => [created as unknown as Task, ...current]);
 setDailyTaskTitle("");
 setIsAddingDailyTask(false);
 toast({ title: "Daily task added", description: title, type: "success" });
 } catch (error) {
 toast({ title: "Could not add daily task", description: error instanceof Error ? error.message : "Try again.", type: "error" });
 } finally {
 setSavingDailyTask(false);
 }
 };

 const upsertTask = async (input: TaskFormInput) => {
 const payload = {
 title: input.title,
 description: input.description,
 issueType: input.issueType,
 status: input.status,
 progress: input.progress,
 blockedReason: input.status === "Blocked" ? input.blockedReason?.trim() : null,
 priority: input.priority,
 projectId: input.projectId || undefined,
 epicId: input.epicId || undefined,
 sprintId: input.sprintId || undefined,
 parentTaskId: input.parentTaskId || undefined,
 backlogRank: input.backlogRank,
 labels: input.labels,
 assigneeId: employeeIdByName[input.assignee],
 reporterId: employeeIdByName[input.reporter],
 dueDate: input.dueDate || undefined,
 startDate: input.startDate || undefined,
 estimatedHours: input.estimatedHours,
 checklist: input.checklist.map(({ title, done }) => ({ title, done })),
 recurring: input.recurring,
 recurrence: input.recurrence,
 };

 try {
 if (editingTask) {
 const updated = await apiUpdateTask(editingTask.id, payload);
 setTasks((current) => current.map((task) => (task.id === editingTask.id ? (updated as unknown as Task) : task)));
 setSelectedTask((current) => (current?.id === editingTask.id ? (updated as unknown as Task) : current));
 } else {
 const created = await apiCreateTask(payload);
 setTasks((current) => [created as unknown as Task, ...current]);
 if (selectedTeamMember && payload.assigneeId === selectedTeamMember.id) {
 setTeamMemberTasks((current) => [created as unknown as Task, ...current]);
 }
 }
 setEditingTask(null);
 setIsCreating(false);
 setAssignTaskForPerson(null);
 } catch (error) {
 toast({ title: "Could not save task", description: error instanceof Error ? error.message : "Try again.", type: "error" });
 }
 };

 const deleteTask = async (id: string) => {
 const accepted = await confirm({
 title: "Delete task?",
 description: "This task will be removed from the current workspace view.",
 confirmLabel: "Delete Task",
 tone: "danger",
 });
 if (accepted) {
 try {
 await apiDeleteTask(id);
 setTasks((current) => current.filter((task) => task.id !== id));
 toast({ title: "Task deleted", description: "The task was removed from the workspace view.", type: "warning" });
 } catch (error) {
 toast({ title: "Could not delete task", description: error instanceof Error ? error.message : "Try again.", type: "error" });
 }
 }
 };

 const toggleChecklist = (taskId: string, itemId: string) => {
 const task = tasks.find((item) => item.id === taskId);
 const item = task?.checklist.find((entry) => entry.id === itemId);
 if (!item) return;

 apiToggleChecklistItem(taskId, itemId, !item.done)
 .then((updated) => {
 setTasks((current) => current.map((entry) => (entry.id === taskId ? (updated as unknown as Task) : entry)));
 setSelectedTask((current) => (current?.id === taskId ? (updated as unknown as Task) : current));
 })
 .catch((error) => {
 toast({ title: "Could not update checklist", description: error instanceof Error ? error.message : "Try again.", type: "error" });
 });
 };

 const logTime = (taskId: string) => {
 apiLogTaskTime(taskId, { hours: 1, note: "Manual time entry" })
 .then((updated) => {
 setTasks((current) => current.map((task) => (task.id === taskId ? (updated as unknown as Task) : task)));
 setSelectedTask((current) => (current?.id === taskId ? (updated as unknown as Task) : current));
 })
 .catch((error) => {
 toast({ title: "Could not log time", description: error instanceof Error ? error.message : "Try again.", type: "error" });
 });
 };

 const updateTaskFields = async (task: Task, input: Record<string, unknown>) => {
 const previous = tasks;
 setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, ...input } as Task : item)));
 try {
 const updated = await apiUpdateTask(task.id, input);
 setTasks((current) => current.map((item) => (item.id === task.id ? (updated as unknown as Task) : item)));
 setSelectedTask((current) => (current?.id === task.id ? (updated as unknown as Task) : current));
 } catch (error) {
 setTasks(previous);
 toast({ title: "Could not update task", description: error instanceof Error ? error.message : "Try again.", type: "error" });
 }
 };

 const statCards = [
 { label: "Total Tasks", value: stats.total, icon: ListChecks },
 { label: "Active Tasks", value: stats.active, icon: ClipboardCheck },
 { label: "Due Soon", value: stats.dueSoon, icon: AlarmClock },
 { label: "Overdue", value: stats.overdue, icon: Bell },
 { label: "Tracked Hours", value: formatHours(stats.tracked), icon: Clock3 },
 ];

 return (
 <main className="min-h-screen bg-enterprise">
 <header className="sticky top-0 z-40 border-b bg-background ">
 <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
 <div>
 <p className="text-sm font-semibold text-primary">Tasks</p>
 <h1 className="text-2xl font-bold">Task Management</h1>
 </div>
 <div className="flex items-center gap-2">
 <Button asChild type="button" variant="outline">
 <Link to="/dashboard">Dashboard</Link>
 </Button>
 <ThemeToggle />
 <Button onClick={() => setIsAddingDailyTask(true)} type="button" variant={canCreateTask ? "outline" : "default"}>
 <Plus className="h-4 w-4" />
 Add Daily Task
 </Button>
 {canCreateTask && <Button onClick={() => setIsCreating(true)} type="button">
 <Plus className="h-4 w-4" />
 Assign Task
 </Button>}
 </div>
 </div>
 </header>

 <div className="container grid gap-6 py-6 xl:grid-cols-[1fr_320px]">
 <section className="min-w-0 space-y-6">
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
 {statCards.map((card, index) => {
 const Icon = card.icon;
 return (
 <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} key={card.label} transition={{ delay: index * 0.04 }}>
 <Card className="glass h-full">
 <CardContent className="p-5">
 <Icon className="mb-4 h-5 w-5 text-primary" />
 <p className="text-sm text-muted-foreground">{card.label}</p>
 <p className="mt-2 text-3xl font-bold">{card.value}</p>
 </CardContent>
 </Card>
 </motion.div>
 );
 })}
 </div>

 <Card className="glass">
 <CardContent className="space-y-4 p-4">
 <div className="flex flex-wrap items-center gap-3">
 <div className="relative min-w-[220px] flex-1">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 className="pl-9"
 placeholder="Search tasks, labels, assignees..."
 value={search}
 onChange={(event) => setSearch(event.target.value)}
 />
 </div>
 <div className="flex flex-wrap gap-2">
 {(["list", ...(canViewTeam ? (["team"] as const) : [])] as TaskView[]).map((item) => (
 <Button
 key={item}
 onClick={() => {
 setView(item);
 if (item === "team") {
 setSelectedTeamMember(null);
 if (!teamSummaryLoaded) void loadTeamSummary();
 }
 }}
 type="button"
 variant={view === item ? "default" : "outline"}
 >
 {item === "list" && <LayoutList className="h-4 w-4" />}
 {item === "team" && <UsersRound className="h-4 w-4" />}
 {item}
 </Button>
 ))}
 </div>
 </div>
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
 <select className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
 <option>All</option>
 {taskStatuses.map((item) => (
 <option key={item}>{item}</option>
 ))}
 </select>
 <select className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value)}>
 <option>All</option>
 {taskPriorities.map((item) => (
 <option key={item}>{item}</option>
 ))}
 </select>
 <select
 className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
 value={projectId}
 onChange={(event) => setProjectId(event.target.value)}
 >
 <option>All Projects</option>
 {projects.map((project) => (
 <option key={project.id} value={project.id}>
 {project.projectName}
 </option>
 ))}
 </select>
 <select className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={issueType} onChange={(event) => setIssueType(event.target.value)}>
 <option>All Types</option>
 {taskIssueTypes.map((item) => (
 <option key={item}>{item}</option>
 ))}
 </select>
 </div>
 <div className="flex flex-wrap gap-2">
 {taskLabels.map((label) => (
 <button
 className="rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
 key={label}
 onClick={() => setSearch(label)}
 type="button"
 >
 {label}
 </button>
 ))}
 </div>
 </CardContent>
 </Card>

 {view === "list" && (
 filteredTasks.length === 0 ? (
 <EmptyState
 action={canCreateTask ? { label: "Assign Task", onClick: () => setIsCreating(true) } : { label: "Add Daily Task", onClick: () => setIsAddingDailyTask(true) }}
 description="No tasks match the current filters. Clear your search or create a task to get moving."
 icon={ListChecks}
 title="No tasks found"
 />
 ) : (
 <Card className="glass overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full min-w-[980px] text-sm">
 <thead className="border-b bg-muted text-left">
 <tr>
 <th className="p-4">Task</th>
 <th className="p-4">Status</th>
 <th className="p-4">Priority</th>
 <th className="p-4">Assignee</th>
 <th className="p-4">Reporter</th>
 <th className="p-4">Due Date</th>
 <th className="p-4">Hours</th>
 <th className="p-4">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredTasks.map((task) => (
 <tr className="border-b" key={task.id}>
 <td className="p-4">
 <p className="font-semibold">{task.title}</p>
 <p className="mt-1 text-xs text-primary">{task.taskCode}</p>
 </td>
 <td className="p-4">
 <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusClass(task.status))}>{task.status}</span>
 </td>
 <td className="p-4">
 <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", priorityClass(task.priority))}>{task.priority}</span>
 </td>
 <td className="p-4">{task.assignee}</td>
 <td className="p-4">{task.reporter}</td>
 <td className="p-4">{task.dueDate}</td>
 <td className="p-4">
 {formatHours(task.actualHours)} / {formatHours(task.estimatedHours)}
 </td>
 <td className="p-4">
 <div className="flex gap-2">
 {canManageTask && <Button onClick={() => setEditingTask(task)} size="sm" type="button" variant="outline">
 Edit
 </Button>}
 <Button onClick={() => setSelectedTask(task)} size="sm" type="button" variant="outline">
 Open
 </Button>
 {canDeleteTask && <Button onClick={() => deleteTask(task.id)} size="sm" type="button" variant="outline">
 Delete
 </Button>}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </Card>
 )
 )}

 {view === "team" && !selectedTeamMember && (
 teamSummaryLoading ? (
 <p className="px-1 text-sm text-muted-foreground">Loading team...</p>
 ) : teamSummary.length === 0 ? (
 <EmptyState description="You don't currently have anyone's tasks to monitor." icon={UsersRound} title="No team members found" />
 ) : (
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
 {teamSummary.map((member) => (
 <button
 className="rounded-lg border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
 key={member.id}
 onClick={() => void openTeamMember(member)}
 type="button"
 >
 <p className="font-semibold">{member.fullName}</p>
 <p className="mt-1 text-xs text-muted-foreground">{member.role}</p>
 <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
 <div className="rounded-md bg-muted px-2 py-1.5">
 <p className="font-bold">{member.totalTasks}</p>
 <p className="text-muted-foreground">Total</p>
 </div>
 <div className="rounded-md bg-muted px-2 py-1.5">
 <p className="font-bold">{member.completedTasks}</p>
 <p className="text-muted-foreground">Done</p>
 </div>
 <div className="rounded-md bg-muted px-2 py-1.5">
 <p className="font-bold">{member.overdueTasks}</p>
 <p className="text-muted-foreground">Overdue</p>
 </div>
 </div>
 </button>
 ))}
 </div>
 )
 )}

 {view === "team" && selectedTeamMember && (
 <div className="space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <Button onClick={() => setSelectedTeamMember(null)} size="sm" type="button" variant="outline">
 <ArrowLeft className="h-4 w-4" />
 Back to team
 </Button>
 <div className="min-w-0 flex-1">
 <p className="font-semibold">{selectedTeamMember.fullName}</p>
 <p className="text-xs text-muted-foreground">{selectedTeamMember.role}</p>
 </div>
 {canCreateTask && (
 <Button
 onClick={() => {
 setAssignTaskForPerson(selectedTeamMember.fullName);
 setIsCreating(true);
 }}
 size="sm"
 type="button"
 >
 <Plus className="h-4 w-4" />
 Assign Task
 </Button>
 )}
 </div>
 {teamMemberTasksLoading ? (
 <p className="px-1 text-sm text-muted-foreground">Loading tasks...</p>
 ) : teamMemberTasks.length === 0 ? (
 <EmptyState description="This person has no tasks yet." icon={ListChecks} title="No tasks found" />
 ) : (
 <Card className="glass overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full min-w-[720px] text-sm">
 <thead className="border-b bg-muted text-left">
 <tr>
 <th className="p-4">Task</th>
 <th className="p-4">Status</th>
 <th className="p-4">Priority</th>
 <th className="p-4">Due Date</th>
 </tr>
 </thead>
 <tbody>
 {teamMemberTasks.map((task) => (
 <tr className="cursor-pointer border-b hover:bg-muted/50" key={task.id} onClick={() => setSelectedTask(task)}>
 <td className="p-4">
 <p className="font-semibold">{task.title}</p>
 <p className="mt-1 text-xs text-primary">{task.taskCode}</p>
 </td>
 <td className="p-4">
 <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusClass(task.status))}>{task.status}</span>
 </td>
 <td className="p-4">
 <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", priorityClass(task.priority))}>{task.priority}</span>
 </td>
 <td className="p-4">{task.dueDate}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </Card>
 )}
 </div>
 )}
 </section>

 <aside className="space-y-4">
 <Card className="glass">
 <CardHeader>
 <CardTitle>Notifications</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {notifications.map((item) => (
 <div className="rounded-lg border bg-background p-3" key={item.id}>
 <p className="text-sm font-semibold leading-6">{item.title}</p>
 <p className="mt-1 text-xs text-muted-foreground">{item.task}</p>
 </div>
 ))}
 </CardContent>
 </Card>
 <Card className="glass">
 <CardHeader>
 <CardTitle>Activity Logs</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {latestActivities.map((item) => (
 <div className="rounded-lg border bg-background p-3" key={item.id}>
 <div className="flex items-start gap-3">
 <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
 <div className="min-w-0">
 <p className="text-sm font-semibold leading-6">{item.title}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 {item.task} - {item.time}
 </p>
 </div>
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 <Card className="bg-foreground text-background dark:bg-white dark:text-slate-950">
 <CardContent className="p-5">
 <Timer className="mb-4 h-5 w-5" />
 <p className="text-sm font-semibold">Time Tracking</p>
 <p className="mt-2 text-3xl font-bold">{formatHours(stats.tracked)}</p>
 <p className="mt-2 text-sm opacity-75">Logged across active work.</p>
 </CardContent>
 </Card>
 </aside>
 </div>

 {isAddingDailyTask && (
 <Dialog
 as="form"
 className="max-w-md"
 onClose={() => {
 setIsAddingDailyTask(false);
 setDailyTaskTitle("");
 }}
 onSubmit={(event) => {
 event.preventDefault();
 void addDailyTask();
 }}
 >
 <div className="mb-4">
 <h2 className="text-xl font-bold">Add Daily Task</h2>
 <p className="mt-1 text-sm text-muted-foreground">Ye task sirf aapke liye add hoga (aaj ka daily task).</p>
 </div>
 <div className="space-y-2">
 <Label htmlFor="daily-task-title">Task</Label>
 <Input
 autoFocus
 id="daily-task-title"
 onChange={(event) => setDailyTaskTitle(event.target.value)}
 placeholder="Aaj aap kya kaam karoge?"
 value={dailyTaskTitle}
 />
 </div>
 <div className="mt-6 flex justify-end gap-3">
 <Button
 onClick={() => {
 setIsAddingDailyTask(false);
 setDailyTaskTitle("");
 }}
 type="button"
 variant="outline"
 >
 Cancel
 </Button>
 <Button disabled={savingDailyTask || dailyTaskTitle.trim().length < 2} type="submit">
 {savingDailyTask ? "Adding..." : "Add Daily Task"}
 </Button>
 </div>
 </Dialog>
 )}
 {(isCreating || editingTask) && (
 <TaskFormModal
 defaultAssignee={assignTaskForPerson ?? undefined}
 initialTask={editingTask}
 onClose={() => {
 setIsCreating(false);
 setEditingTask(null);
 setAssignTaskForPerson(null);
 }}
 onSubmit={upsertTask}
 projects={projects}
 tasks={tasks}
 teamMembers={teamMembers}
 />
 )}
 {selectedTask && (
 <TaskDetailDrawer
 canLogTime={canLogTime}
 canManageTask={canManageTask}
 canUpdateWork={canUpdateTask}
 onClose={() => setSelectedTask(null)}
 onEdit={() => {
 setEditingTask(selectedTask);
 setSelectedTask(null);
 }}
 onLogTime={() => logTime(selectedTask.id)}
 onToggleChecklist={(itemId) => toggleChecklist(selectedTask.id, itemId)}
 onWorkUpdate={(input) => void updateTaskFields(selectedTask, input)}
 projects={projects}
 task={selectedTask}
 />
 )}
 </main>
 );
}
