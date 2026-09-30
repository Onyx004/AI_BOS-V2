import { Router } from "express";
import { taskController } from "../controllers/task.controller.js";
import { taskCommentController } from "../controllers/task-comment.controller.js";
import { asyncHandler, route } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { taskService } from "../services/task.service.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  bulkDeleteTasksSchema,
  bulkUpdateTasksSchema,
  checklistToggleSchema,
  createDailyTaskSchema,
  createTaskSchema,
  listTasksQuerySchema,
  logTimeSchema,
  taskChecklistParamsSchema,
  taskIdParamsSchema,
  taskProjectParamsSchema,
  updateTaskSchema,
} from "../validation/task.validation.js";
import {
  commentIdParamsSchema,
  commentResourceParamsSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  updateCommentSchema,
} from "../validation/task-comment.validation.js";

export const taskRoutes = Router();

const requireTaskAccess = asyncHandler(async (req, _res, next) => {
  await taskService.assertCanView(req.params.id, req.user!);
  next();
});

taskRoutes.use(authenticate);

taskRoutes.get(
  "/stats",
  ...route(requirePermission("task.view_stats"), taskController.stats),
);

taskRoutes.get(
  "/team/summary",
  ...route(requirePermission("task.view_team"), taskController.teamSummary),
);

taskRoutes.get(
  "/export/csv",
  ...route(validate({ query: listTasksQuerySchema }), requirePermission("task.export"), taskController.exportCsv),
);

taskRoutes.get(
  "/export/pdf",
  ...route(validate({ query: listTasksQuerySchema }), requirePermission("task.export"), taskController.exportPdf),
);

taskRoutes.get(
  "/",
  ...route(validate({ query: listTasksQuerySchema }), taskController.list),
);

taskRoutes.get(
  "/project/:projectId",
  ...route(validate({ params: taskProjectParamsSchema }), taskController.listByProject),
);

taskRoutes.post(
  "/",
  ...route(requirePermission("task.create"), validate({ body: createTaskSchema }), taskController.create),
);

taskRoutes.post(
  "/daily",
  ...route(validate({ body: createDailyTaskSchema }), taskController.createDaily),
);

taskRoutes.patch(
  "/bulk",
  ...route(requirePermission("task.bulk_update"), validate({ body: bulkUpdateTasksSchema }), taskController.bulkUpdate),
);

taskRoutes.delete(
  "/bulk",
  ...route(requirePermission("task.bulk_delete"), validate({ body: bulkDeleteTasksSchema }), taskController.bulkDelete),
);

taskRoutes.get(
  "/:id",
  ...route(validate({ params: taskIdParamsSchema }), taskController.getById),
);

taskRoutes.patch(
  "/:id",
  ...route(requirePermission("task.update"), validate({ params: taskIdParamsSchema, body: updateTaskSchema }), taskController.update),
);

taskRoutes.delete(
  "/:id",
  ...route(requirePermission("task.delete"), validate({ params: taskIdParamsSchema }), taskController.delete),
);

taskRoutes.patch(
  "/:id/checklist/:itemId",
  ...route(
    requirePermission("task.update"),
    validate({ params: taskChecklistParamsSchema, body: checklistToggleSchema }),
    taskController.updateChecklistItem,
  ),
);

taskRoutes.post(
  "/:id/time-entries",
  ...route(
    requirePermission("task.log_time"),
    validate({ params: taskIdParamsSchema, body: logTimeSchema }),
    taskController.logTime,
  ),
);

taskRoutes.get(
  "/:id/comments",
  ...route(
    validate({ params: commentResourceParamsSchema, query: listCommentsQuerySchema }),
    requireTaskAccess,
    taskCommentController.list,
  ),
);

taskRoutes.post(
  "/:id/comments",
  ...route(
    requirePermission("task.comment"),
    validate({ params: commentResourceParamsSchema, body: createCommentSchema }),
    requireTaskAccess,
    taskCommentController.create,
  ),
);

taskRoutes.patch(
  "/:id/comments/:commentId",
  ...route(
    requirePermission("task.comment"),
    validate({ params: commentIdParamsSchema, body: updateCommentSchema }),
    requireTaskAccess,
    taskCommentController.update,
  ),
);

taskRoutes.delete(
  "/:id/comments/:commentId",
  ...route(
    requirePermission("task.comment"),
    validate({ params: commentIdParamsSchema }),
    requireTaskAccess,
    taskCommentController.delete,
  ),
);
