import { Router } from "express";
import { meetingController } from "../controllers/meeting.controller.js";
import { route } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createMeetingSchema,
  listMeetingsQuerySchema,
  meetingIdParamsSchema,
  updateMeetingSchema,
} from "../validation/meeting.validation.js";

export const meetingRoutes = Router();

meetingRoutes.use(authenticate);

meetingRoutes.get(
  "/",
  ...route(requirePermission("meeting.view_all"), validate({ query: listMeetingsQuerySchema }), meetingController.list),
);

meetingRoutes.post(
  "/",
  ...route(requirePermission("meeting.create"), validate({ body: createMeetingSchema }), meetingController.create),
);

meetingRoutes.get(
  "/:id",
  ...route(requirePermission("meeting.view_all"), validate({ params: meetingIdParamsSchema }), meetingController.getById),
);

meetingRoutes.patch(
  "/:id",
  ...route(
    requirePermission("meeting.update"),
    validate({ params: meetingIdParamsSchema, body: updateMeetingSchema }),
    meetingController.update,
  ),
);

meetingRoutes.delete(
  "/:id",
  ...route(requirePermission("meeting.delete"), validate({ params: meetingIdParamsSchema }), meetingController.delete),
);
