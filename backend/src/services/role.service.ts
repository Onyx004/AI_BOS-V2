import type { Types } from "mongoose";
import { getDefaultPermissionKeys } from "../constants/default-roles.js";
import { roleRepository } from "../repositories/role.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { roleHistoryRepository } from "../repositories/role-history.repository.js";
import { roleTemplateRepository } from "../repositories/role-template.repository.js";
import { auditService } from "./audit.service.js";
import { AppError } from "../utils/app-error.js";
import { slugify } from "../utils/slugify.js";
import type { CreateRoleInput, ListRolesQuery, UpdateRoleInput } from "../validation/role.validation.js";

type RoleLike = { slug: string; isSystem: boolean };

/** Built-in roles carry their locked default permissions so the UI can show them as non-removable. */
function withDefaults<T extends RoleLike>(role: T) {
  return { ...role, defaultPermissionKeys: role.isSystem ? getDefaultPermissionKeys(role.slug) : [] };
}

export class RoleService {
  async create(input: CreateRoleInput, userId?: string) {
    const slug = slugify(input.name);

    const existing = await roleRepository.existsBySlug(slug);
    if (existing) {
      throw new AppError("A role with this name already exists", 409);
    }

    let permissionKeys = input.permissionKeys ?? [];
    if (input.templateId) {
      const template = await roleTemplateRepository.findById(input.templateId);
      if (!template) {
        throw new AppError("Role template not found", 404);
      }
      if (input.permissionKeys === undefined) {
        permissionKeys = template.permissionKeys;
      }
    }

    permissionKeys = [...new Set(permissionKeys)];

    const role = await roleRepository.create({
      slug,
      name: input.name,
      description: input.description,
      isSystem: false,
      hasFullAccess: false,
      rank: input.rank,
      permissionKeys,
      templateId: input.templateId as unknown as Types.ObjectId,
      isActive: true,
      createdBy: userId as unknown as Types.ObjectId,
      updatedBy: userId as unknown as Types.ObjectId,
    });

    await auditService.record({
      actorUserId: userId ?? "",
      action: "role.create",
      targetType: "Role",
      targetId: role._id as Types.ObjectId,
      after: { name: role.name, permissionKeys: role.permissionKeys },
    });

    return role;
  }

  async list(query: ListRolesQuery) {
    const result = await roleRepository.list(query);
    return { ...result, items: result.items.map(withDefaults) };
  }

  async listAll() {
    return roleRepository.listAll();
  }

  async getById(id: string) {
    const role = await roleRepository.findById(id);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    return withDefaults(role);
  }

  async update(id: string, input: UpdateRoleInput, userId?: string) {
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw new AppError("Role not found", 404);
    }

    if (existing.isSystem && existing.hasFullAccess) {
      throw new AppError("Full-access system roles cannot be edited", 403);
    }

    if (existing.isSystem && input.name) {
      throw new AppError("System role names cannot be changed", 403);
    }

    if (!existing.isSystem && input.name && input.name !== existing.name) {
      if ((await userRepository.countByRoleName(existing.name)) > 0) {
        throw new AppError("This role is assigned to users, so it cannot be renamed. Move them to another role first.", 409);
      }
      const nextSlug = slugify(input.name);
      if (nextSlug !== existing.slug && (await roleRepository.existsBySlug(nextSlug))) {
        throw new AppError("A role with this name already exists", 409);
      }
    }

    if (existing.isSystem && input.isActive === false) {
      throw new AppError("System roles cannot be deactivated", 403);
    }

    if (existing.isSystem && input.permissionKeys) {
      const missing = getDefaultPermissionKeys(existing.slug).filter((key) => !input.permissionKeys?.includes(key as never));
      if (missing.length > 0) {
        throw new AppError(`Default permissions of the ${existing.name} role cannot be removed: ${missing.join(", ")}`, 400);
      }
    }

    const permissionKeysChanged =
      input.permissionKeys && JSON.stringify(input.permissionKeys) !== JSON.stringify(existing.permissionKeys);

    if (permissionKeysChanged) {
      const previousVersion = await roleHistoryRepository.latestVersion(id);
      await roleHistoryRepository.create({
        roleId: existing._id as Types.ObjectId,
        version: previousVersion + 1,
        permissionKeys: existing.permissionKeys,
        changedBy: userId as unknown as Types.ObjectId,
      });
    }

    const slugUpdate = !existing.isSystem && input.name && input.name !== existing.name ? { slug: slugify(input.name) } : {};
    const role = await roleRepository.update(id, { ...input, ...slugUpdate, updatedBy: userId });
    if (!role) {
      throw new AppError("Role not found", 404);
    }

    await auditService.record({
      actorUserId: userId ?? "",
      action: "role.update",
      targetType: "Role",
      targetId: existing._id as Types.ObjectId,
      before: { permissionKeys: existing.permissionKeys },
      after: { permissionKeys: role.permissionKeys },
    });

    return withDefaults(role);
  }

  async delete(id: string, userId?: string) {
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw new AppError("Role not found", 404);
    }

    if (existing.isSystem) {
      throw new AppError("System roles cannot be deleted", 403);
    }

    const holders = await userRepository.countByRoleName(existing.name);
    if (holders > 0) {
      throw new AppError(`${holders} user(s) still have this role. Move them to another role before deleting it.`, 409);
    }

    await roleRepository.delete(id);

    await auditService.record({
      actorUserId: userId ?? "",
      action: "role.delete",
      targetType: "Role",
      targetId: existing._id as Types.ObjectId,
      before: { name: existing.name, permissionKeys: existing.permissionKeys },
    });

    return { deleted: true };
  }
}

export const roleService = new RoleService();
