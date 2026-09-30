import { Router, type RequestHandler } from "express";
import { departmentController } from "../controllers/department.controller.js";
import { route } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createDepartmentSchema,
  departmentIdParamsSchema,
  deleteDepartmentQuerySchema,
  departmentMembersParamsSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "../validation/department.validation.js";

export const departmentRoutes = Router();

/** Deleting a department together with its teams is also a team deletion, so it needs `team.delete` as well. */
const requireTeamDeleteWhenDeletingTeams: RequestHandler = (req, res, next) =>
  (req.query as { deleteTeams?: boolean }).deleteTeams ? requirePermission("team.delete")(req, res, next) : next();

departmentRoutes.use(authenticate);

departmentRoutes.get(
  "/",
  ...route(validate({ query: listDepartmentsQuerySchema }), departmentController.list),
);

departmentRoutes.post(
  "/",
  ...route(
    requirePermission("department.create"),
    validate({ body: createDepartmentSchema }),
    departmentController.create,
  ),
);

departmentRoutes.get(
  "/:id/members",
  ...route(validate({ params: departmentMembersParamsSchema }), departmentController.members),
);

departmentRoutes.get(
  "/:id",
  ...route(validate({ params: departmentIdParamsSchema }), departmentController.getById),
);

departmentRoutes.patch(
  "/:id",
  ...route(
    requirePermission("department.update"),
    validate({ params: departmentIdParamsSchema, body: updateDepartmentSchema }),
    departmentController.update,
  ),
);

departmentRoutes.delete(
  "/:id",
  ...route(
    requirePermission("department.delete"),
    validate({ params: departmentIdParamsSchema, query: deleteDepartmentQuerySchema }),
    requireTeamDeleteWhenDeletingTeams,
    departmentController.delete,
  ),
);
