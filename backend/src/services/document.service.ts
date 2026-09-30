import fs, { promises as fsp } from "node:fs";
import path from "node:path";
import type { Types } from "mongoose";
import { documentRepository } from "../repositories/document.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/app-error.js";
import type { DocumentFileType } from "../models/document.model.js";
import type { ListDocumentsQuery, UpdateDocumentInput, UploadDocumentInput } from "../validation/document.validation.js";

const documentsUploadsDir = path.join(process.cwd(), "uploads", "documents");

function safeFileName(filename: string) {
  return filename
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 180);
}

function fileTypeFromName(name: string): DocumentFileType {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "PDF";
  if (extension === "docx" || extension === "doc") return "DOCX";
  if (extension === "xlsx" || extension === "xls") return "XLSX";
  if (extension === "pptx" || extension === "ppt") return "PPTX";
  return "Image";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class DocumentService {
  async upload(file: Express.Multer.File | undefined, input: UploadDocumentInput, userId?: string) {
    if (!file) {
      throw new AppError("File is required", 400);
    }

    const actor = userId ? await userRepository.findById(userId) : null;
    const ownerName = actor?.fullName ?? "Unknown";

    await fsp.mkdir(documentsUploadsDir, { recursive: true });
    const storedFileName = `${Date.now()}-${safeFileName(file.originalname)}`;
    await fsp.writeFile(path.join(documentsUploadsDir, storedFileName), file.buffer);

    const now = new Date();
    return documentRepository.create({
      name: file.originalname,
      type: fileTypeFromName(file.originalname),
      folderId: input.folderId || "folder-root",
      sizeBytes: file.size,
      ownerId: userId as unknown as Types.ObjectId,
      ownerName,
      tags: input.tags?.length ? input.tags : ["Uploaded"],
      sharedWith: [],
      versions: [{ version: "v1.0", author: ownerName, date: now, note: "Initial upload" }],
      previewText: `${file.originalname} uploaded to the AI BOS document workspace.`,
      storedFileName,
      mimeType: file.mimetype,
      organizationId: actor?.organizationId,
      createdBy: userId as unknown as Types.ObjectId,
    });
  }

  async list(query: ListDocumentsQuery) {
    const documents = await documentRepository.list(query);
    return documents.map((document) => ({ ...document, size: formatBytes(document.sizeBytes) }));
  }

  async getById(id: string) {
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new AppError("Document not found", 404);
    }
    return { ...document, size: formatBytes(document.sizeBytes) };
  }

  async update(id: string, input: UpdateDocumentInput) {
    const document = await documentRepository.update(id, input);
    if (!document) {
      throw new AppError("Document not found", 404);
    }
    return { ...document, size: formatBytes(document.sizeBytes) };
  }

  async delete(id: string) {
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new AppError("Document not found", 404);
    }
    await documentRepository.delete(id);
    await fsp.unlink(path.join(documentsUploadsDir, document.storedFileName)).catch(() => undefined);
    return { deleted: true };
  }

  async resolveFile(id: string) {
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new AppError("Document not found", 404);
    }
    const filePath = path.join(documentsUploadsDir, document.storedFileName);
    if (!fs.existsSync(filePath)) {
      throw new AppError("Document file is missing from storage", 404);
    }
    return { filePath, name: document.name, mimeType: document.mimeType };
  }
}

export const documentService = new DocumentService();
