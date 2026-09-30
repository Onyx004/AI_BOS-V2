import type { FilterQuery, UpdateQuery } from "mongoose";
import { ManagedDocumentModel, type ManagedDocument, type ManagedDocumentDocument } from "../models/document.model.js";

export type DocumentCreateData = Pick<
  ManagedDocument,
  "name" | "type" | "folderId" | "sizeBytes" | "ownerName" | "storedFileName" | "mimeType" | "previewText" | "versions"
> &
  Partial<Pick<ManagedDocument, "organizationId" | "ownerId" | "tags" | "sharedWith" | "createdBy">>;

export class DocumentRepository {
  async create(data: DocumentCreateData) {
    return ManagedDocumentModel.create(data);
  }

  async findById(id: string) {
    return ManagedDocumentModel.findById(id).lean();
  }

  async list(query: { organizationId?: string; folderId?: string; search?: string; limit?: number }) {
    const filter: FilterQuery<ManagedDocument> = {};
    if (query.organizationId) filter.organizationId = query.organizationId;
    if (query.folderId && query.folderId !== "folder-root") filter.folderId = query.folderId;
    if (query.search) filter.$text = { $search: query.search };

    return ManagedDocumentModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 100)
      .lean();
  }

  async update(id: string, updates: UpdateQuery<ManagedDocumentDocument>) {
    return ManagedDocumentModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
  }

  async delete(id: string) {
    return ManagedDocumentModel.findByIdAndDelete(id).lean();
  }
}

export const documentRepository = new DocumentRepository();
