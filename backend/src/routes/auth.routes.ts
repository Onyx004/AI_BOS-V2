import { Router } from "express";
import { z } from "zod";
import { authController } from "../controllers/auth.controller.js";
import { resetPasswordController } from "../controllers/reset-password.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  changePasswordSchema,
  changePinSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordRequestSchema,
  setPasswordSchema,
} from "../validation/auth.validation.js";

export const authRoutes = Router();

authRoutes.post(
  "/login",
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);

authRoutes.post(
  "/refresh-token",
  authRateLimiter,
  validate({ body: refreshTokenSchema.partial() }),
  asyncHandler(authController.refresh),
);

authRoutes.post("/logout", asyncHandler(authController.logout));

authRoutes.get("/me", authenticate, asyncHandler(authController.me));

authRoutes.patch(
  "/change-password",
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword),
);

authRoutes.put(
  "/pin",
  authenticate,
  authRateLimiter,
  validate({ body: changePinSchema }),
  asyncHandler(authController.changePin),
);

authRoutes.post(
  "/reset-password/request",
  authRateLimiter,
  validate({ body: resetPasswordRequestSchema }),
  asyncHandler(resetPasswordController.requestReset),
);

authRoutes.post(
  "/reset-password/verify",
  authRateLimiter,
  validate({ body: z.object({ token: z.string().min(1) }) }),
  asyncHandler(resetPasswordController.verifyToken),
);

authRoutes.post(
  "/reset-password/set",
  authRateLimiter,
  validate({ body: setPasswordSchema }),
  asyncHandler(resetPasswordController.setPassword),
);
