import { z } from "zod";
import { passwordPolicySchema } from "../utils/password.js";

const employeeDocumentSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.string().min(1).max(40),
  size: z.string().min(1).max(20),
});

export const employeeProfileSchema = z
  .object({
    phone: z.string().max(32).optional(),
    location: z.string().max(160).optional(),
    designation: z.string().max(120).optional(),
    employmentType: z.string().max(40).optional(),
    joiningDate: z.coerce.date().optional(),
    employmentStatus: z.enum(["Active", "On Leave", "Inactive"]).optional(),
    personalInformation: z
      .object({
        dateOfBirth: z.string().max(32).optional(),
        gender: z.string().max(32).optional(),
        nationality: z.string().max(64).optional(),
        maritalStatus: z.string().max(32).optional(),
      })
      .optional(),
    contact: z
      .object({
        address: z.string().max(240).optional(),
        emergencyContact: z.string().max(64).optional(),
      })
      .optional(),
    skills: z.array(z.string().max(60)).optional(),
    experience: z.array(z.string().max(200)).optional(),
    education: z.array(z.string().max(200)).optional(),
    documents: z.array(employeeDocumentSchema).optional(),
    salaryDetails: z
      .object({
        annualCtc: z.number().min(0).optional(),
        monthlySalary: z.number().min(0).optional(),
        bank: z.string().max(120).optional(),
        taxId: z.string().max(40).optional(),
      })
      .optional(),
    performanceScore: z.number().min(0).max(100).optional(),
    employeeCode: z.string().max(40).optional(),
  })
  .strict();

export const createUserSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: passwordPolicySchema,
  role: z.string().trim().min(1).max(80),
  phone: z.string().min(1).max(32),
  departmentId: z.string().length(24).optional(),
  branchId: z.string().length(24).optional(),
  managerId: z.string().length(24).optional(),
  teamIds: z.array(z.string().length(24)).optional(),
  employeeProfile: employeeProfileSchema.optional(),
});

export const updateEmployeeProfileSchema = z.object({
  departmentId: z.string().length(24).optional(),
  branchId: z.string().length(24).optional(),
  managerId: z.string().length(24).optional(),
  teamIds: z.array(z.string().length(24)).optional(),
  employeeProfile: employeeProfileSchema.optional(),
});

/** `null` moves the employee to Unassigned (no department). */
export const moveDepartmentSchema = z.object({
  departmentId: z.string().length(24).nullable(),
});

export const changeManagerSchema = z.object({
  managerId: z.string().length(24),
});

export const changeRoleSchema = z.object({
  role: z.string().trim().min(1).max(80),
});

const avatarSchema = z
  .string()
  .startsWith("data:image/", "Profile photo must be an image data URL")
  .max(2_000_000, "Profile photo is too large. Please choose a smaller image.");

export const updateOwnProfileSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    avatar: avatarSchema.nullable().optional(),
    phone: z.string().max(32).optional(),
    location: z.string().max(160).optional(),
    personalInformation: z
      .object({
        dateOfBirth: z.string().max(32).optional(),
        gender: z.string().max(32).optional(),
        nationality: z.string().max(64).optional(),
        maritalStatus: z.string().max(32).optional(),
      })
      .optional(),
    contact: z
      .object({
        address: z.string().max(240).optional(),
        emergencyContact: z.string().max(64).optional(),
      })
      .optional(),
  })
  .strict();

export const completeProfileSchema = z.object({
  designation: z.string().min(1).max(120),
  employmentType: z.string().min(1).max(40),
  joiningDate: z.coerce.date(),
  personalInformation: z.object({
    dateOfBirth: z.string().min(1).max(32),
    gender: z.string().min(1).max(32),
  }),
  contact: z.object({
    address: z.string().min(1).max(240),
    emergencyContact: z.string().min(1).max(64),
  }),
});

export type CreateUserProfileInput = z.infer<typeof createUserSchema>;
export type EmployeeProfileInput = z.infer<typeof employeeProfileSchema>;
export type UpdateEmployeeProfileInput = z.infer<typeof updateEmployeeProfileSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
export type MoveDepartmentInput = z.infer<typeof moveDepartmentSchema>;
export type ChangeManagerInput = z.infer<typeof changeManagerSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
