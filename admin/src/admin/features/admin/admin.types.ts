import type { LucideIcon } from "lucide-react";

export type AdminPermission = "view" | "create" | "edit" | "delete" | "export" | "restore" | "manage";
export type AdminFieldType = "text" | "email" | "number" | "date" | "select" | "textarea" | "tags" | "password";
export type AdminRecordValue = string | number | boolean | string[];
export type AdminRecord = { id: string } & Record<string, AdminRecordValue>;

export type AdminField = {
 key: string;
 label: string;
 type: AdminFieldType;
 options?: string[];
 required?: boolean;
};

export type AdminModule = {
 id: string;
 label: string;
 description: string;
 icon: LucideIcon;
 fields: AdminField[];
 records: AdminRecord[];
 permissions: AdminPermission[];
 route?: string;
};

export type AdminRole = {
 id: string;
 name: string;
 description: string;
 permissions: Record<string, AdminPermission[]>;
};

export type AdminLog = {
 id: string;
 actor: string;
 action: string;
 module: string;
 severity: "Info" | "Warning" | "Critical";
 timestamp: string;
};

export type AdminSetting = {
 key: string;
 label: string;
 type: AdminFieldType;
 value: AdminRecordValue;
 options?: string[];
};

export type AdminSettingGroup = {
 id: string;
 label: string;
 description: string;
 settings: AdminSetting[];
};

export type AdminAnalyticsPoint = {
 month: string;
 users: number;
 revenue: number;
 activity: number;
 securityEvents: number;
};
