import { Router } from "express";
import { leadController } from "../controllers/lead.controller.js";
import { route } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  assignLeadOwnerSchema,
  createLeadSchema,
  leadIdParamsSchema,
  listLeadsQuerySchema,
  updateLeadSchema,
} from "../validation/lead.validation.js";

export const leadRoutes = Router();

leadRoutes.use(authenticate);

leadRoutes.get(
  "/stats",
  ...route(requirePermission("lead.view_stats"), leadController.stats),
);

leadRoutes.get(
  "/",
  ...route(requirePermission("lead.view_all"), validate({ query: listLeadsQuerySchema }), leadController.list),
);

leadRoutes.post(
  "/",
  ...route(requirePermission("lead.create"), validate({ body: createLeadSchema }), leadController.create),
);

leadRoutes.get(
  "/:id",
  ...route(requirePermission("lead.view_all"), validate({ params: leadIdParamsSchema }), leadController.getById),
);

leadRoutes.patch(
  "/:id",
  ...route(requirePermission("lead.update"), validate({ params: leadIdParamsSchema, body: updateLeadSchema }), leadController.update),
);

leadRoutes.post(
  "/:id/convert",
  ...route(
    requirePermission("lead.update"),
    requirePermission("customer.create"),
    validate({ params: leadIdParamsSchema }),
    leadController.convert,
  ),
);

leadRoutes.delete(
  "/:id",
  ...route(requirePermission("lead.delete"), validate({ params: leadIdParamsSchema }), leadController.delete),
);

leadRoutes.patch(
  "/:id/owner",
  ...route(
    requirePermission("lead.update"),
    validate({ params: leadIdParamsSchema, body: assignLeadOwnerSchema }),
    leadController.assignOwner,
  ),
);
