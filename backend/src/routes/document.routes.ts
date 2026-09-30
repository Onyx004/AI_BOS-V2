import { Router } from "express";
import { documentController } from "../controllers/document.controller.js";
import { route } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { documentUpload } from "../middleware/document-upload.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  documentIdParamsSchema,
  listDocumentsQuerySchema,
  updateDocumentSchema,
  uploadDocumentSchema,
} from "../validation/document.validation.js";

export const documentRoutes = Router();

documentRoutes.use(authenticate);

documentRoutes.get(
  "/",
  ...route(requirePermission("document.view_all"), validate({ query: listDocumentsQuerySchema }), documentController.list),
);

documentRoutes.post(
  "/",
  documentUpload.single("file"),
  ...route(requirePermission("document.upload"), validate({ body: uploadDocumentSchema }), documentController.upload),
);

documentRoutes.get(
  "/:id",
  ...route(requirePermission("document.view_all"), validate({ params: documentIdParamsSchema }), documentController.getById),
);

documentRoutes.get(
  "/:id/file",
  ...route(requirePermission("document.download"), validate({ params: documentIdParamsSchema }), documentController.download),
);

documentRoutes.patch(
  "/:id",
  ...route(
    requirePermission("document.update"),
    validate({ params: documentIdParamsSchema, body: updateDocumentSchema }),
    documentController.update,
  ),
);

documentRoutes.delete(
  "/:id",
  ...route(requirePermission("document.delete"), validate({ params: documentIdParamsSchema }), documentController.delete),
);
