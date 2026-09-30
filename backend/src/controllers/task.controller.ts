import { taskService } from "../services/task.service.js";
import { fileController, jsonController } from "../utils/controller.js";
import type { ListTasksQuery } from "../validation/task.validation.js";

export class TaskController {
  stats = jsonController(200, "Task stats fetched successfully", ({ req }) => taskService.stats(req.user!));

  teamSummary = jsonController(200, "Team task summary fetched successfully", ({ req }) => taskService.teamSummary(req.user!));

  list = jsonController(200, "Tasks fetched successfully", ({ req }) =>
    taskService.list(req.query as unknown as ListTasksQuery, req.user!),
  );

  listByProject = jsonController(200, "Project tasks fetched successfully", ({ req }) =>
    taskService.listByProject(req.params.projectId, req.user!),
  );

  create = jsonController(201, "Task created successfully", ({ req }) =>
    taskService.create(req.body, req.user?.id),
  );

  createDaily = jsonController(201, "Daily task created successfully", ({ req }) =>
    taskService.createDailyTask(req.body.title, req.user!),
  );

  getById = jsonController(200, "Task fetched successfully", ({ req }) =>
    taskService.getById(req.params.id, req.user!),
  );

  update = jsonController(200, "Task updated successfully", ({ req }) =>
    taskService.update(req.params.id, req.body, req.user!),
  );

  delete = jsonController(200, "Task deleted successfully", ({ req }) =>
    taskService.delete(req.params.id, req.user!),
  );

  bulkDelete = jsonController(200, "Tasks deleted successfully", ({ req }) =>
    taskService.bulkDelete(req.body, req.user!),
  );

  bulkUpdate = jsonController(200, "Tasks updated successfully", ({ req }) =>
    taskService.bulkUpdate(req.body, req.user!),
  );

  updateChecklistItem = jsonController(200, "Checklist item updated successfully", ({ req }) =>
    taskService.updateChecklistItem(req.params.id, req.params.itemId, req.body.done, req.user!),
  );

  logTime = jsonController(201, "Time logged successfully", ({ req }) =>
    taskService.logTime(req.params.id, req.body, req.user!),
  );

  exportCsv = fileController("text/csv", "attachment; filename=tasks.csv", ({ req }) =>
    taskService.exportCsv(req.query as unknown as ListTasksQuery, req.user!),
  );

  exportPdf = fileController("application/pdf", "attachment; filename=tasks.pdf", ({ req }) =>
    taskService.exportPdf(req.query as unknown as ListTasksQuery, req.user!),
  );
}

export const taskController = new TaskController();
