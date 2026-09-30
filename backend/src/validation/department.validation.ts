import { z } from "zod";
import { departmentStatuses } from "../constants/department.js";

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
  headId: z.string().min(1, "A department must have a head"),
  parentDepartmentId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  status: z.enum(departmentStatuses).default("Active"),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  code: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
  headId: z.string().min(1).optional(),
  parentDepartmentId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  status: z.enum(departmentStatuses).optional(),
});

export const departmentIdParamsSchema = z.object({
  id: z.string().min(1),
});

/** `?deleteTeams=true` is the caller confirming that the department's teams go with it. */
export const deleteDepartmentQuerySchema = z.object({
  deleteTeams: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
export type DeleteDepartmentQuery = z.infer<typeof deleteDepartmentQuerySchema>;

export const listDepartmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(departmentStatuses).optional(),
  sortBy: z.enum(["name", "code", "status", "createdAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;

export const departmentMembersParamsSchema = z.object({
  id: z.string().min(1),
});
