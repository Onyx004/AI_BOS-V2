import type { RequestHandler } from "express";
import { documentService } from "../services/document.service.js";
import { jsonController } from "../utils/controller.js";
import fs from "node:fs";
import type { ListDocumentsQuery } from "../validation/document.validation.js";

export class DocumentController {
  list = jsonController(200, "Documents fetched successfully", ({ req }) =>
    documentService.list(req.query as unknown as ListDocumentsQuery),
  );

  upload = jsonController(201, "Document uploaded successfully", ({ req }) =>
    documentService.upload(req.file, req.body, req.user?.id),
  );

  getById = jsonController(200, "Document fetched successfully", ({ req }) =>
    documentService.getById(req.params.id),
  );

  update = jsonController(200, "Document updated successfully", ({ req }) =>
    documentService.update(req.params.id, req.body),
  );

  delete = jsonController(200, "Document deleted successfully", ({ req }) =>
    documentService.delete(req.params.id),
  );

  download: RequestHandler = async (req, res) => {
    const { filePath, name, mimeType } = await documentService.resolveFile(req.params.id);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    res.status(200).send(fs.readFileSync(filePath));
  };
}

export const documentController = new DocumentController();
