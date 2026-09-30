import { type UserDocument } from "../models/user.model.js";
import { userRepository } from "../repositories/user.repository.js";
import { sessionRepository } from "../repositories/session.repository.js";
import type { PublicUser } from "../types/auth.js";
import { AppError } from "../utils/app-error.js";
import { createTokenPair, decodeToken, getTokenExpiry, verifyRefreshToken } from "../utils/jwt.js";
import { verifyPassword } from "../utils/password.js";
import { fingerprintDevice } from "../utils/device.js";
import { securityService, isValidObjectId } from "./security.service.js";
import { passwordService } from "./password.service.js";
import { attendanceService } from "./attendance.service.js";
import { faceEnrollmentService } from "./face-enrollment.service.js";
import { permissionService } from "./permission.service.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RefreshTokenInput,
} from "../validation/auth.validation.js";

async function toAuthUser(user: UserDocument): Promise<PublicUser> {
  const [hasActiveFaceEnrollment, effectivePermissions] = await Promise.all([
    faceEnrollmentService.hasActiveEnrollment(user.id),
    permissionService.resolveEffectivePermissions(user.role),
  ]);
  return {
    id: user.id,
    fullName: user.fullName,
    companyName: user.companyName,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    isProfileComplete: user.isProfileComplete,
    mustChangePassword: user.mustChangePassword,
    hasActiveFaceEnrollment,
    permissions: Array.from(effectivePermissions.permissionKeys),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  private async trackSession(userId: string, refreshToken: string, meta?: { ip?: string; userAgent?: string; deviceId?: string }) {
    if (!isValidObjectId(userId)) return;
    const payload = decodeToken(refreshToken);
    if (!payload?.jti) return;

    await sessionRepository.create({
      user: userId,
      refreshTokenJti: payload.jti,
      expiresAt: getTokenExpiry(refreshToken),
      userAgent: meta?.userAgent,
      ip: meta?.ip,
      deviceId: meta?.deviceId,
    });
  }

  /** Login-based attendance: the first login of the day is the check-in. Never blocks the sign-in itself. */
  private async recordLoginPresence(user: UserDocument, meta?: { ip?: string; userAgent?: string; deviceId?: string }) {
    try {
      await userRepository.touchLastSeen(user.id);
      await attendanceService.recordLoginCheckIn(user.id, user.role, meta);
    } catch (error) {
      logger.error(error, "Login attendance check-in failed");
    }
  }

  async login(input: LoginInput, meta?: { ip?: string; userAgent?: string; deviceId?: string }) {
    const user = await userRepository.findByEmailWithPassword(input.email);

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    if (!user.isActive) {
      throw new AppError("This account is disabled", 403);
    }

    const recentFailures = await securityService.countRecentFailedLogins(user.id, env.LOCKOUT_DURATION_MINUTES);
    if (recentFailures >= env.MAX_LOGIN_ATTEMPTS) {
      throw new AppError(`Too many failed login attempts. Try again in ${env.LOCKOUT_DURATION_MINUTES} minutes.`, 423);
    }

    const usingPin = Boolean(input.pin);
    if (usingPin && user.mustChangePassword) {
      throw new AppError("Sign in with your temporary password first to finish account setup", 401);
    }
    const isPasswordValid = usingPin
      ? Boolean(user.pinHash) && (await verifyPassword(input.pin ?? "", user.pinHash ?? ""))
      : await verifyPassword(input.password ?? "", user.passwordHash);

    if (!isPasswordValid) {
      await securityService.recordLoginHistory({
        userId: user.id,
        eventType: "login_failure",
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: meta?.deviceId,
        failureReason: usingPin ? "invalid_pin" : "invalid_password",
      });
      await securityService.recordSecurityEvent({
        userId: user.id,
        eventType: "login_failure",
        severity: "medium",
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: meta?.deviceId,
        description: "Failed login attempt",
        metadata: { reason: usingPin ? "invalid_pin" : "invalid_password" },
      });
      throw new AppError(usingPin ? "Invalid email or PIN" : "Invalid email or password", 401);
    }

    if (
      user.mustChangePassword &&
      user.temporaryPasswordExpiresAt &&
      user.temporaryPasswordExpiresAt.getTime() <= Date.now()
    ) {
      await securityService.recordLoginHistory({
        userId: user.id,
        eventType: "login_failure",
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: meta?.deviceId,
        failureReason: "temporary_password_expired",
      });
      await securityService.recordSecurityEvent({
        userId: user.id,
        eventType: "login_failure",
        severity: "low",
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: meta?.deviceId,
        description: "Expired temporary credential rejected",
        metadata: { reason: "temporary_password_expired" },
      });
      throw new AppError(
        "Temporary password has expired. Request a new temporary password.",
        401,
      );
    }

    const updatedUser = await userRepository.updateLastLogin(user.id);
    const authUser = updatedUser ?? user;
    const tokens = createTokenPair({
      sub: authUser.id,
      role: authUser.role,
    });

    await this.trackSession(authUser.id, tokens.refreshToken, meta);

    if (!authUser.mustChangePassword) await this.recordLoginPresence(authUser, meta);

    await securityService.recordLoginHistory({
      userId: authUser.id,
      eventType: "login_success",
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      deviceId: meta?.deviceId,
    });

    return {
      user: await toAuthUser(authUser),
      tokens,
    };
  }

  async refresh(input: RefreshTokenInput, meta?: { ip?: string; userAgent?: string; deviceId?: string }) {
    if (!input.refreshToken) {
      throw new AppError("Refresh token is required", 401);
    }

    const payload = verifyRefreshToken(input.refreshToken);
    const user = await userRepository.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new AppError("Invalid refresh token", 401);
    }

    if (payload.jti && isValidObjectId(user.id)) {
      const session = await sessionRepository.findByJti(payload.jti);
      if (!session || session.status !== "active") {
        throw new AppError("Invalid refresh token", 401);
      }
      await sessionRepository.revoke(session.id);
    }

    const tokens = createTokenPair({
      sub: user.id,
      role: user.role,
    });

    await this.trackSession(user.id, tokens.refreshToken, meta);

    await securityService.recordLoginHistory({
      userId: user.id,
      eventType: "token_refresh",
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      deviceId: meta?.deviceId,
    });

    return {
      user: await toAuthUser(user),
      tokens,
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;

    const payload = decodeToken(refreshToken);
    if (!payload?.jti) return;

    const session = await sessionRepository.findByJti(payload.jti);
    if (session && session.status === "active") {
      await sessionRepository.revoke(session.id);
    }
  }

  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return toAuthUser(user);
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    return passwordService.changePassword(userId, input);
  }
}

export const authService = new AuthService();
