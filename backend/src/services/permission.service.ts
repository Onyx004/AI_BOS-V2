import { roleRepository } from "../repositories/role.repository.js";
import { slugify } from "../utils/slugify.js";

export type EffectivePermissions = {
  hasFullAccess: boolean;
  permissionKeys: Set<string>;
};

const noAccess: EffectivePermissions = { hasFullAccess: false, permissionKeys: new Set() };
const builtInFullAccessRoles = new Set(["owner", "administrator", "ceo", "admin"]);

export class PermissionService {
  async resolveEffectivePermissions(roleSlug: string): Promise<EffectivePermissions> {
    const normalizedRole = roleSlug.toLowerCase();
    // Built-in roles are looked up by their lower-cased name; custom roles by the slug made from their name.
    let role = await roleRepository.findBySlug(normalizedRole);
    const slug = slugify(roleSlug);
    if (!role && slug && slug !== normalizedRole) role = await roleRepository.findBySlug(slug);

    if (!role || !role.isActive) {
      if (builtInFullAccessRoles.has(normalizedRole)) {
        return { hasFullAccess: true, permissionKeys: new Set() };
      }
      return noAccess;
    }

    return {
      hasFullAccess: role.hasFullAccess,
      permissionKeys: new Set(role.permissionKeys),
    };
  }

  async hasPermission(roleSlug: string, key: string): Promise<boolean> {
    const { hasFullAccess, permissionKeys } = await this.resolveEffectivePermissions(roleSlug);
    return hasFullAccess || permissionKeys.has(key);
  }
}

export const permissionService = new PermissionService();
