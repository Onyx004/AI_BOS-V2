import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const documentFileTypes = ["PDF", "DOCX", "XLSX", "PPTX", "Image"] as const;
export type DocumentFileType = (typeof documentFileTypes)[number];

export const documentPermissionLevels = ["Viewer", "Editor", "Owner"] as const;
export type DocumentPermissionLevel = (typeof documentPermissionLevels)[number];

export type DocumentShare = {
  user: string;
  permission: DocumentPermissionLevel;
};

export type DocumentVersion = {
  version: string;
  author: string;
  date: Date;
  note: string;
};

export type ManagedDocument = {
  organizationId?: Types.ObjectId;
  name: string;
  type: DocumentFileType;
  folderId: string;
  sizeBytes: number;
  ownerId?: Types.ObjectId;
  ownerName: string;
  tags: string[];
  sharedWith: DocumentShare[];
  versions: DocumentVersion[];
  previewText: string;
  storedFileName: string;
  mimeType: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type ManagedDocumentDocument = HydratedDocument<ManagedDocument>;

const documentShareSchema = new Schema<DocumentShare>(
  {
    user: { type: String, required: true, trim: true, maxlength: 160 },
    permission: { type: String, enum: documentPermissionLevels, required: true },
  },
  { _id: false },
);

const documentVersionSchema = new Schema<DocumentVersion>(
  {
    version: { type: String, required: true, trim: true, maxlength: 32 },
    author: { type: String, required: true, trim: true, maxlength: 160 },
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 240, default: "" },
  },
  { _id: false },
);

const managedDocumentSchema = new Schema<ManagedDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    type: { type: String, enum: documentFileTypes, required: true },
    folderId: { type: String, required: true, trim: true, maxlength: 80, index: true, default: "folder-root" },
    sizeBytes: { type: Number, min: 0, default: 0 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 160 },
    tags: { type: [String], default: [] },
    sharedWith: { type: [documentShareSchema], default: [] },
    versions: { type: [documentVersionSchema], default: [] },
    previewText: { type: String, trim: true, maxlength: 500, default: "" },
    storedFileName: { type: String, required: true, trim: true, maxlength: 220 },
    mimeType: { type: String, required: true, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

managedDocumentSchema.index({ name: "text", tags: "text", ownerName: "text" });
managedDocumentSchema.index({ organizationId: 1, folderId: 1, createdAt: -1 });

export const ManagedDocumentModel = model("ManagedDocument", managedDocumentSchema);
