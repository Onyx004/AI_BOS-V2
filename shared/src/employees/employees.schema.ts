import { z } from "zod";
import { authRoles } from "@shared/auth/types";

export const employeeFormSchema = z.object({
 name: z.string().min(1, "Name is required"),
 email: z.string().min(1, "Email is required").email("Enter a valid email"),
 password: z
 .string()
 .min(12, "Password must be at least 12 characters")
 .regex(/[A-Z]/, "Password needs one uppercase letter")
 .regex(/[a-z]/, "Password needs one lowercase letter")
 .regex(/[0-9]/, "Password needs one number")
 .regex(/[^A-Za-z0-9]/, "Password needs one special character"),
 role: z.string().min(1, "Choose a role"),
 phone: z.string().min(1, "Enter a phone number"),
 department: z.string(),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
