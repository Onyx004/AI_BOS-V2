import { z } from "zod";
import { documentPermissionLevels } from "../models/document.model.js";

export const uploadDocumentSchema = z.object({
  folderId: z.string().max(80).default("folder-root"),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
});

export const updateDocumentSchema = z.object({
  folderId: z.string().max(80).optional(),
  tags: z.array(z.string()).optional(),
  sharedWith: z
    .array(
      z.object({
        user: z.string().min(1).max(160),
        permission: z.enum(documentPermissionLevels),
      }),
    )
    .optional(),
});

export const documentIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listDocumentsQuerySchema = z.object({
  folderId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(100),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
