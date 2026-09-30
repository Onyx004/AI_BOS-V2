import { defaultRoleDefinitions } from "../constants/default-roles.js";
import { RoleModel } from "../models/role.model.js";
import { RoleTemplateModel } from "../models/role-template.model.js";
import { UserModel } from "../models/user.model.js";
import { logger } from "../utils/logger.js";

/**
 * Makes sure every built-in role exists, is marked as a system role, and holds all of its
 * locked default permissions. Extra permissions an admin added are kept. Runs on every start
 * so a database that was never seeded (or had defaults removed) is repaired.
 */
export async function syncDefaultRoles() {
  for (const definition of defaultRoleDefinitions) {
    await RoleModel.updateOne(
      { slug: definition.slug },
      {
        $set: {
          name: definition.name,
          rank: definition.rank,
          hasFullAccess: definition.hasFullAccess,
          isSystem: true,
          isActive: true,
        },
        $addToSet: { permissionKeys: { $each: definition.permissionKeys } },
        $setOnInsert: { slug: definition.slug },
      },
      { upsert: true },
    );
  }
}

/**
 * The Guest role no longer exists; custom roles replace it. If someone still has the Guest
 * role we keep it as a plain custom role (so they are not orphaned) instead of deleting it.
 */
export async function removeGuestRole() {
  const guestUsers = await UserModel.countDocuments({ role: /^guest$/i });
  await RoleTemplateModel.updateMany({ basedOnSystemRole: /^guest$/i }, { $unset: { basedOnSystemRole: "" } });

  if (guestUsers === 0) {
    await RoleModel.deleteOne({ slug: "guest" });
    return;
  }

  await RoleModel.updateOne({ slug: "guest" }, { $set: { isSystem: false } });
  logger.warn(`${guestUsers} user(s) still have the removed Guest role; it was kept as a custom role. Move them to another role, then delete it.`);
}
