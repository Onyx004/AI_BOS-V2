import { salesDefaultCrmPermissionKeys } from "./permissions.js";

/**
 * The built-in roles and the permissions each one always has. These defaults are locked:
 * an admin can add extra permissions to a built-in role (and remove those extras again),
 * but never take a default away. Custom roles are the only ones that can be created or deleted.
 * Owner and Administrator have full access, so they carry no explicit permission list.
 */
export const managerPermissions: string[] = [
  "project.view_stats",
  "project.export",
  "project.create",
  "project.update",
  "project.bulk_update",
  "project.bulk_delete",
  "project.archive",
  "project.duplicate",
  "project.comment",
  "task.view_stats",
  "task.export",
  "task.create",
  "task.update",
  "task.delete",
  "task.bulk_update",
  "task.bulk_delete",
  "task.log_time",
  "task.comment",
  "lead.view_all",
  "lead.view_stats",
  "lead.create",
  "lead.update",
  "lead.delete",
  "workflow.view_stats",
  "workflow.create",
  "workflow.update",
  "workflow.duplicate",
  "workflow.toggle_status",
  "workflow.execute",
  "workflow.approve_step",
  "team.create",
  "team.update",
  "policy.view_all",
  "analytics.view",
  "collaboration.moderate",
  "notification.broadcast",
  "audit.view",
  "user.create",
  "user.view_all",
  "user.edit",
];
export const hrPermissions: string[] = [
  "project.view_stats",
  "task.view_stats",
  "workflow.view_stats",
  "department.create",
  "department.update",
  "branch.create",
  "branch.update",
  "team.create",
  "team.update",
  "holiday.create",
  "holiday.update",
  "holiday.delete",
  "policy.create",
  "policy.update",
  "policy.publish",
  "policy.view_all",
  "user.view_all",
  "collaboration.moderate",
  "notification.broadcast",
  "audit.view",
  "user.create",
  "user.edit",
];
export const employeePermissions: string[] = ["task.create", "task.update", "task.log_time", "task.comment"];

export type DefaultRoleDefinition = {
  slug: string;
  name: string;
  rank: number;
  hasFullAccess: boolean;
  permissionKeys: string[];
};

export const financePermissions: string[] = [
  "project.view_stats",
  "task.view_stats",
  "analytics.view",
  "policy.view_all",
  "finance.view",
  "finance.create",
  "finance.update",
  "finance.delete",
  "finance.export",
];

export const salesPermissions: string[] = [...salesDefaultCrmPermissionKeys, "finance.view"];
export const supportPermissions: string[] = ["user.view_all"];
export const developerPermissions: string[] = ["integration.manage", "audit.view"];

export const defaultRoleDefinitions: DefaultRoleDefinition[] = [
  { slug: "owner", name: "Owner", rank: 100, hasFullAccess: true, permissionKeys: [] },
  { slug: "administrator", name: "Administrator", rank: 90, hasFullAccess: true, permissionKeys: [] },
  { slug: "manager", name: "Manager", rank: 70, hasFullAccess: false, permissionKeys: managerPermissions },
  { slug: "hr", name: "HR", rank: 60, hasFullAccess: false, permissionKeys: hrPermissions },
  { slug: "finance", name: "Finance", rank: 55, hasFullAccess: false, permissionKeys: financePermissions },
  { slug: "sales", name: "Sales", rank: 50, hasFullAccess: false, permissionKeys: salesPermissions },
  { slug: "support", name: "Support", rank: 45, hasFullAccess: false, permissionKeys: supportPermissions },
  { slug: "developer", name: "Developer", rank: 45, hasFullAccess: false, permissionKeys: developerPermissions },
  { slug: "employee", name: "Employee", rank: 20, hasFullAccess: false, permissionKeys: employeePermissions },
];

/** The locked permissions of a built-in role; empty for custom roles and full-access roles. */
export function getDefaultPermissionKeys(slug: string): string[] {
  return defaultRoleDefinitions.find((definition) => definition.slug === slug.toLowerCase())?.permissionKeys ?? [];
}
