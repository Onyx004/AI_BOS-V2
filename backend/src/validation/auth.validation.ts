import { z } from "zod";
import { passwordPolicySchema } from "../utils/password.js";

export const pinSchema = z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits");

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).optional(),
    pin: pinSchema.optional(),
  })
  .refine((value) => Boolean(value.password) !== Boolean(value.pin), {
    message: "Provide either a password or a 6-digit PIN",
    path: ["password"],
  });

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordPolicySchema,
  pin: pinSchema.optional(),
});

export const changePinSchema = z.object({
  currentPassword: z.string().min(1),
  pin: pinSchema,
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const setPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordPolicySchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePinInput = z.infer<typeof changePinSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordRequestSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

