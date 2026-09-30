import multer from "multer";
import { AppError } from "../utils/app-error.js";
import { resolveUnsafeExt } from "./upload.middleware.js";

const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".webp"];
const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const maxDocumentSizeBytes = 25 * 1024 * 1024;

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxDocumentSizeBytes },
  fileFilter(_req, file, callback) {
    const resolved = resolveUnsafeExt(file.originalname);
    if (!resolved) {
      callback(new AppError("Unsupported file name", 415));
      return;
    }
    if (!resolved.ext || !allowedExtensions.includes(resolved.ext)) {
      callback(new AppError("Unsupported file extension", 415));
      return;
    }
    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new AppError("Unsupported file type", 415));
      return;
    }
    callback(null, true);
  },
});
