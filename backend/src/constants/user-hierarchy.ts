import { type UserRole } from "./roles.js";

/**
 * Who may create a profile for whom. Deliberately an explicit allow-list, not a
 * generic rank comparison — e.g. Manager may not create Finance/Support/Developer
 * even though those roles rank lower, so it can't be derived from Role.rank alone.
 */
export const assignableRolesByRole: Partial<Record<UserRole, UserRole[]>> = {
  Owner: ["Manager", "HR", "Employee", "Sales", "Finance", "Support", "Developer"],
  Administrator: ["Manager", "HR", "Employee", "Sales", "Finance", "Support", "Developer"],
  Manager: ["HR", "Employee", "Sales"],
  HR: ["Employee", "Sales"],
};

function normalizeCreatorRole(role: string): string {
  if (role === "CEO") return "Owner";
  if (role === "Admin") return "Administrator";
  return role;
}

export function getAssignableRoles(creatorRole: string): UserRole[] {
  return assignableRolesByRole[normalizeCreatorRole(creatorRole) as UserRole] ?? [];
}
