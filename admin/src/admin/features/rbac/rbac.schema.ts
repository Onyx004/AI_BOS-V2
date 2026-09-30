export type PermissionCatalogEntry = {
 key: string;
 module: string;
 label: string;
 description: string;
};

export type Role = {
 _id: string;
 slug: string;
 name: string;
 description?: string;
 isSystem: boolean;
 hasFullAccess: boolean;
 rank: number;
 permissionKeys: string[];
 /** Locked permissions of a built-in role; they can never be removed, only added to. */
 defaultPermissionKeys?: string[];
 isActive: boolean;
};

export type RoleFormInput = {
 name: string;
 description: string;
 rank: number;
 permissionKeys: string[];
 templateId: string;
};

export const emptyRoleForm: RoleFormInput = {
 name: "",
 description: "",
 rank: 10,
 permissionKeys: [],
 templateId: "",
};

export type PermissionGroup = {
 _id: string;
 name: string;
 description?: string;
 permissionKeys: string[];
};

export type PermissionGroupFormInput = {
 name: string;
 description: string;
 permissionKeys: string[];
};

export const emptyPermissionGroupForm: PermissionGroupFormInput = {
 name: "",
 description: "",
 permissionKeys: [],
};

export type RoleTemplate = {
 _id: string;
 name: string;
 description?: string;
 permissionKeys: string[];
 basedOnSystemRole?: string;
};

export type RoleTemplateFormInput = {
 name: string;
 description: string;
 permissionKeys: string[];
};

export const emptyRoleTemplateForm: RoleTemplateFormInput = {
 name: "",
 description: "",
 permissionKeys: [],
};

export type PermissionAuditLogEntry = {
 _id: string;
 actorUserId: string;
 action: string;
 targetType: string;
 targetId: string;
 before?: unknown;
 after?: unknown;
 createdAt: string;
};

export type RoleHistoryEntry = {
 _id: string;
 roleId: string;
 version: number;
 permissionKeys: string[];
 changedBy: string;
 changeNote?: string;
 createdAt: string;
};
