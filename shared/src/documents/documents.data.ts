import type { DocumentFolder, PermissionLevel, SupportedFileType } from "./documents.types";

export const supportedFileTypes: SupportedFileType[] = ["PDF", "DOCX", "XLSX", "PPTX", "Image"];
export const permissionLevels: PermissionLevel[] = ["Viewer", "Editor", "Owner"];
export const documentTags = ["Finance", "HR", "Legal", "Sales", "Projects", "Policy", "Report", "Design"];
export const documentUsers = ["Priya Sharma", "Sneha Joshi", "Karan Malhotra", "Vikram Nair", "Ananya Iyer"];

export const folders: DocumentFolder[] = [
 { id: "folder-root", name: "Company" },
 { id: "folder-finance", name: "Finance", parentId: "folder-root" },
 { id: "folder-hr", name: "HR", parentId: "folder-root" },
 { id: "folder-projects", name: "Projects", parentId: "folder-root" },
 { id: "folder-sales", name: "Sales", parentId: "folder-root" },
];
