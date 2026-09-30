export const userRoles = [
  "Owner",
  "Administrator",
  "Manager",
  "HR",
  "Finance",
  "Sales",
  "Support",
  "Developer",
  "Employee",
] as const;

export type UserRole = (typeof userRoles)[number];
