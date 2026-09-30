import { getAssignableRoles } from "../constants/user-hierarchy.js";
import { roleRepository } from "../repositories/role.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { PasswordChangeModel } from "../models/password-history.model.js";
import { AppError } from "../utils/app-error.js";
import { generateTemporaryPassword, hashPassword } from "../utils/password.js";
import { assertCanManage } from "./hierarchy.service.js";
import { auditLogService } from "./audit-log.service.js";
import { Types } from "mongoose";
import type {
  ChangeManagerInput,
  ChangeRoleInput,
  CompleteProfileInput,
  CreateUserProfileInput,
  MoveDepartmentInput,
  UpdateEmployeeProfileInput,
  UpdateOwnProfileInput,
} from "../validation/user.validation.js";
import type { EmployeeProfile, UserDocument } from "../models/user.model.js";

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toEmployeeDto(user: UserDocument) {
  const department = user.departmentId as unknown as { _id: Types.ObjectId; name: string } | null;
  const manager = user.managerId as unknown as { _id: Types.ObjectId; fullName: string; email: string; role: string } | null;
  const profile = user.employeeProfile ?? {};

  return {
    id: user.id,
    fullName: user.fullName,
    companyName: user.companyName,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    isProfileComplete: user.isProfileComplete,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    avatar: user.avatar ?? getInitials(user.fullName),
    departmentId: department && typeof department === "object" ? department._id : user.departmentId,
    department: department && typeof department === "object" ? department.name : undefined,
    branchId: user.branchId?.toString(),
    managerId: manager && typeof manager === "object" ? manager._id.toString() : user.managerId?.toString(),
    manager:
      manager && typeof manager === "object"
        ? { id: manager._id.toString(), fullName: manager.fullName, email: manager.email, role: manager.role }
        : undefined,
    teamIds: (user.teamIds ?? []).map((id) => id.toString()),
    employeeCode: profile.employeeCode ?? `EMP-${user.id.slice(-6).toUpperCase()}`,
    phone: profile.phone,
    location: profile.location,
    designation: profile.designation,
    employmentType: profile.employmentType,
    joiningDate: profile.joiningDate,
    employmentStatus: profile.employmentStatus ?? "Active",
    personalInformation: profile.personalInformation,
    contact: profile.contact,
    skills: profile.skills ?? [],
    experience: profile.experience ?? [],
    education: profile.education ?? [],
    documents: profile.documents ?? [],
    salaryDetails: profile.salaryDetails,
    performanceScore: profile.performanceScore,
  };
}

const protectedAccountRoles = new Set(["Owner", "Administrator", "CEO", "Admin"]);

export class UserService {
  async listUsers() {
    const users = await userRepository.findMany({ isActive: true });
    return users.map((user) => toEmployeeDto(user));
  }

  async listUsersByDepartment(departmentId: string) {
    const users = await userRepository.findMany({ departmentId, isActive: true });
    return users.map((user) => toEmployeeDto(user));
  }

  /**
   * Built-in roles the actor may hand out, plus every active custom role when the actor has full access
   * (Owner/Administrator). Managers and HR stay limited to their fixed list so a custom role can never be
   * used to give someone more access than the creator is trusted with.
   */
  async getAssignableRoles(creatorRole: string): Promise<string[]> {
    const builtIn: string[] = getAssignableRoles(creatorRole);
    // Only Owner/Administrator hold full access (custom roles never do), so no permission lookup is needed here.
    if (!protectedAccountRoles.has(creatorRole)) return builtIn;

    const roles = await roleRepository.listAll();
    const custom = roles.filter((role) => !role.isSystem && role.isActive && !role.hasFullAccess).map((role) => role.name);
    return [...builtIn, ...custom];
  }

  async createUser(creatorUserId: string, input: CreateUserProfileInput) {
    const creator = await userRepository.findById(creatorUserId);

    if (!creator) {
      throw new AppError("Creator account not found", 404);
    }

    const assignableRoles = await this.getAssignableRoles(creator.role);

    if (!assignableRoles.includes(input.role)) {
      throw new AppError("You are not allowed to create a user with this role", 403);
    }

    const existingUser = await userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new AppError("A user with this email already exists", 409);
    }

    const managerId = input.managerId ?? (["Owner", "Administrator"].includes(creator.role) ? undefined : creator.id);
    if (managerId) {
      const manager = await userRepository.findById(managerId);
      if (!manager || !manager.isActive) {
        throw new AppError("Selected manager was not found", 404);
      }
      if (creator.organizationId?.toString() !== manager.organizationId?.toString()) {
        throw new AppError("Selected manager must belong to your organization", 400);
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      fullName: input.fullName,
      companyName: creator.companyName,
      email: input.email,
      passwordHash,
      role: input.role,
      organizationId: creator.organizationId,
      departmentId: input.departmentId,
      branchId: input.branchId,
      managerId,
      teamIds: input.teamIds,
      employeeProfile: { ...input.employeeProfile, phone: input.phone },
      isProfileComplete: false,
      mustChangePassword: true,
    });

    const isValidId = Types.ObjectId.isValid(user.id);
    if (isValidId) {
      const objectId = new Types.ObjectId(user.id);
      await Promise.all([
        PasswordChangeModel.create({
          user: objectId,
          previousPasswordHash: passwordHash,
          changedBy: objectId,
        }),
      ]);
    }

    return toEmployeeDto(user);
  }

  async updateEmployeeProfile(
    actorUserId: string | undefined,
    actorRole: string | undefined,
    targetUserId: string,
    input: UpdateEmployeeProfileInput,
  ) {
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new AppError("User not found", 404);
    }

    if ((input.departmentId || input.managerId) && actorUserId && actorRole) {
      await assertCanManage({ id: actorUserId, role: actorRole }, targetUserId);
    }

    if (input.managerId) {
      if (input.managerId === targetUserId) {
        throw new AppError("A user cannot report to themselves", 400);
      }
      const manager = await userRepository.findById(input.managerId);
      if (!manager || !manager.isActive) {
        throw new AppError("Selected manager was not found", 404);
      }
      if (target.organizationId?.toString() !== manager.organizationId?.toString()) {
        throw new AppError("Selected manager must belong to the same organization", 400);
      }
    }

    const updated = await userRepository.updateEmployeeProfile(targetUserId, input);
    if (!updated) {
      throw new AppError("User not found", 404);
    }

    return toEmployeeDto(updated);
  }

  async moveToDepartment(actorUserId: string, actorRole: string, targetUserId: string, input: MoveDepartmentInput) {
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new AppError("User not found", 404);
    }

    await assertCanManage({ id: actorUserId, role: actorRole }, targetUserId);

    const updated =
      input.departmentId === null
        ? await userRepository.clearUserDepartment(targetUserId)
        : await userRepository.updateEmployeeProfile(targetUserId, { departmentId: input.departmentId });
    if (!updated) {
      throw new AppError("User not found", 404);
    }

    return toEmployeeDto(updated);
  }

  async changeManager(actorUserId: string, actorRole: string, targetUserId: string, input: ChangeManagerInput) {
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new AppError("User not found", 404);
    }

    if (input.managerId === targetUserId) {
      throw new AppError("A user cannot report to themselves", 400);
    }

    const manager = await userRepository.findById(input.managerId);
    if (!manager || !manager.isActive) {
      throw new AppError("Selected manager was not found", 404);
    }
    if (target.organizationId?.toString() !== manager.organizationId?.toString()) {
      throw new AppError("Selected manager must belong to the same organization", 400);
    }

    await assertCanManage({ id: actorUserId, role: actorRole }, targetUserId);

    const updated = await userRepository.updateEmployeeProfile(targetUserId, { managerId: input.managerId });
    if (!updated) {
      throw new AppError("User not found", 404);
    }

    return toEmployeeDto(updated);
  }

  async changeRole(actorUserId: string, actorRole: string, targetUserId: string, input: ChangeRoleInput) {
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new AppError("User not found", 404);
    }

    if (protectedAccountRoles.has(target.role)) {
      throw new AppError("The role of an Owner or Administrator account cannot be changed here", 403);
    }

    await assertCanManage({ id: actorUserId, role: actorRole }, targetUserId);

    const assignableRoles = await this.getAssignableRoles(actorRole);
    if (!assignableRoles.includes(input.role)) {
      throw new AppError("You are not allowed to assign this role", 403);
    }

    const updated = await userRepository.updateRole(targetUserId, input.role);
    if (!updated) {
      throw new AppError("User not found", 404);
    }

    return toEmployeeDto(updated);
  }

  async deleteUser(actorUserId: string, actorRole: string, targetUserId: string) {
    if (actorUserId === targetUserId) {
      throw new AppError("You cannot remove your own account", 400);
    }

    const target = await userRepository.findById(targetUserId);
    if (!target || !target.isActive) {
      throw new AppError("User not found", 404);
    }

    if (protectedAccountRoles.has(target.role)) {
      throw new AppError("CEO and administrator accounts cannot be removed", 400);
    }

    await assertCanManage({ id: actorUserId, role: actorRole }, targetUserId);

    const updated = await userRepository.deactivate(targetUserId);
    if (!updated) {
      throw new AppError("User not found", 404);
    }

    return { deleted: true, id: targetUserId };
  }

  async resetPassword(actorUserId: string, actorRole: string, targetUserId: string) {
    const target = await userRepository.findById(targetUserId);
    if (!target || !target.isActive) {
      throw new AppError("User not found", 404);
    }

    await assertCanManage({ id: actorUserId, role: actorRole }, targetUserId);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const updated = await userRepository.updateAccountCredentials(targetUserId, {
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    if (!updated) {
      throw new AppError("User not found", 404);
    }

    if (Types.ObjectId.isValid(target.id)) {
      await PasswordChangeModel.create({
        user: new Types.ObjectId(target.id),
        previousPasswordHash: passwordHash,
        changedBy: new Types.ObjectId(actorUserId),
      });
    }

    await auditLogService.record({
      actorUserId,
      actorRole,
      category: "user_action",
      method: "POST",
      path: `/users/${targetUserId}/reset-password`,
      resourceType: "user",
      resourceId: targetUserId,
      statusCode: 200,
      success: true,
      metadata: { targetEmail: target.email },
    });

    return { temporaryPassword };
  }

  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const profile = user.employeeProfile ?? {};

    return {
      id: user.id,
      fullName: user.fullName,
      companyName: user.companyName,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      isProfileComplete: user.isProfileComplete,
      lastLoginAt: user.lastLoginAt,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      branchId: user.branchId,
      managerId: user.managerId,
      teamIds: user.teamIds,
      avatar: user.avatar ?? getInitials(user.fullName),
      employeeCode: profile.employeeCode,
      designation: profile.designation,
      employmentType: profile.employmentType,
      joiningDate: profile.joiningDate,
      phone: profile.phone,
      location: profile.location,
      personalInformation: profile.personalInformation,
      contact: profile.contact,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateOwnProfile(userId: string, input: UpdateOwnProfileInput) {
    const employeeProfile: Partial<EmployeeProfile> = {};
    if (input.phone !== undefined) employeeProfile.phone = input.phone;
    if (input.location !== undefined) employeeProfile.location = input.location;
    if (input.personalInformation !== undefined) employeeProfile.personalInformation = input.personalInformation;
    if (input.contact !== undefined) employeeProfile.contact = input.contact;

    const updated = await userRepository.updateEmployeeProfile(userId, {
      fullName: input.fullName,
      avatar: input.avatar,
      ...(Object.keys(employeeProfile).length > 0 ? { employeeProfile: employeeProfile as EmployeeProfile } : {}),
    });

    if (!updated) {
      throw new AppError("User not found", 404);
    }

    return toEmployeeDto(updated);
  }

  async completeOwnProfile(userId: string, input: CompleteProfileInput) {
    const updated = await userRepository.updateEmployeeProfile(userId, {
      employeeProfile: {
        designation: input.designation,
        employmentType: input.employmentType,
        joiningDate: input.joiningDate,
        personalInformation: input.personalInformation,
        contact: input.contact,
      },
      isProfileComplete: true,
    });

    if (!updated) {
      throw new AppError("User not found", 404);
    }

    return toEmployeeDto(updated);
  }

  async getPasswordChanges(userId: string) {
    const history = await PasswordChangeModel.find({ user: userId })
      .sort({ changedAt: -1 })
      .limit(20)
      .select("previousPasswordHash changedAt changedBy")
      .populate("changedBy", "fullName email")
      .lean();

    return history.map((entry) => ({
      changedAt: entry.changedAt,
      changedBy: entry.changedBy,
    }));
  }
}

export const userService = new UserService();
