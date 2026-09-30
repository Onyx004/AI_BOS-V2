export type SupportedFileType = "PDF" | "DOCX" | "XLSX" | "PPTX" | "Image";
export type PermissionLevel = "Viewer" | "Editor" | "Owner";

export type DocumentVersion = {
 id: string;
 version: string;
 author: string;
 date: string;
 note: string;
};

export type DocumentShare = {
 user: string;
 permission: PermissionLevel;
};

export type DocumentFolder = {
 id: string;
 name: string;
 parentId?: string;
};

export type ManagedDocument = {
 id: string;
 name: string;
 type: SupportedFileType;
 folderId: string;
 size: string;
 owner: string;
 updatedAt: string;
 tags: string[];
 sharedWith: DocumentShare[];
 versions: DocumentVersion[];
 previewText: string;
};

export type DocumentUploadInput = {
 name: string;
 type: SupportedFileType;
 folderId: string;
 tags: string[];
 owner: string;
};
