import { type UserDocument } from "../models/user.model.js";
import { userRepository } from "../repositories/user.repository.js";
import { PasswordHistoryModel } from "../models/password-history.model.js";
import { PasswordChangeModel } from "../models/password-history.model.js";
import { passwordPolicySchema } from "../utils/password.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { AppError } from "../utils/app-error.js";
import { securityService } from "./security.service.js";
import type { ChangePasswordInput, ChangePinInput } from "../validation/auth.validation.js";
import { attendanceService } from "./attendance.service.js";

const MAX_PASSWORD_HISTORY = 5;

export class PasswordService {
  async hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  async check(password: string, hash: string): Promise<boolean> {
    return verifyPassword(password, hash);
  }

  async validatePolicy(password: string): Promise<void> {
    const result = passwordPolicySchema.safeParse(password);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join("; ");
      throw new AppError(`Password policy violation: ${issues}`, 400);
    }
  }

  async isSameAsPrevious(userId: string, newPassword: string): Promise<boolean> {
    const history = await PasswordHistoryModel.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(MAX_PASSWORD_HISTORY)
      .select("passwordHash");

    for (const entry of history) {
      const match = await verifyPassword(newPassword, entry.passwordHash);
      if (match) return true;
    }

    return false;
  }

  async changePasswordWithHistory(userId: string, newHash: string, previousHash: string) {
    await Promise.all([
      PasswordHistoryModel.create({
        user: userId,
        passwordHash: previousHash,
      }),
      userRepository.updatePassword(userId, newHash),
      PasswordChangeModel.create({
        user: userId,
        previousPasswordHash: previousHash,
        changedBy: userId as unknown as import("mongoose").Types.ObjectId,
      }),
    ]);

    const history = await PasswordHistoryModel.find({ user: userId }).sort({ createdAt: -1 });
    if (history.length > MAX_PASSWORD_HISTORY) {
      const toRemove = history.slice(MAX_PASSWORD_HISTORY);
      await PasswordHistoryModel.deleteMany({ _id: { $in: toRemove.map((e) => e.id) } });
    }
  }

  async changePassword(userId: string, input: ChangePasswordInput, meta?: { ip?: string; userAgent?: string; deviceId?: string }) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const userWithPassword = await userRepository.findByEmailWithPassword(user.email);

    if (!userWithPassword) {
      throw new AppError("User not found", 404);
    }

    const isPasswordValid = await verifyPassword(input.currentPassword, userWithPassword.passwordHash);

    if (!isPasswordValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    const isSame = await this.isSameAsPrevious(userId, input.newPassword);
    if (isSame) {
      throw new AppError("New password must be different from previous passwords", 400);
    }

    await this.validatePolicy(input.newPassword);

    const newHash = await hashPassword(input.newPassword);
    await this.changePasswordWithHistory(userId, newHash, userWithPassword.passwordHash);

    if (input.pin) await userRepository.setPin(userId, await hashPassword(input.pin));
    // Users who just finished first-login setup have not been checked in yet (login was blocked on the password change).
    if (userWithPassword.mustChangePassword) {
      await attendanceService.recordLoginCheckIn(userId, userWithPassword.role, meta).catch(() => undefined);
    }
    await userRepository.touchLastSeen(userId);

    await securityService.recordSecurityEvent({
      userId,
      eventType: "password_changed",
      severity: "medium",
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      deviceId: meta?.deviceId,
      description: "Password was changed",
    });

    return { updated: true };
  }

  async changePin(userId: string, input: ChangePinInput, meta?: { ip?: string; userAgent?: string; deviceId?: string }) {
    const user = await userRepository.findPinHash(userId);
    if (!user) throw new AppError("User not found", 404);
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new AppError("Current password is incorrect", 400);
    }
    await userRepository.setPin(userId, await hashPassword(input.pin));
    await securityService.recordSecurityEvent({
      userId,
      eventType: "password_changed",
      severity: "medium",
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      deviceId: meta?.deviceId,
      description: "Sign-in PIN was changed",
    });
    return { updated: true };
  }
}

export const passwordService = new PasswordService();