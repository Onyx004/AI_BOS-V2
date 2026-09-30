import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

const root = path.resolve(import.meta.dirname, "../..");
const builtInNames = ["Owner", "Administrator", "Manager", "HR", "Finance", "Sales", "Support", "Developer", "Employee"];

test("built-in roles are Owner..Employee, Guest is gone everywhere, and every locked permission exists in the catalog", async () => {
  const { defaultRoleDefinitions } = await import("../../backend/src/constants/default-roles.ts");
  const { userRoles } = await import("../../backend/src/constants/roles.ts");
  const { assignableRolesByRole } = await import("../../backend/src/constants/user-hierarchy.ts");
  const { permissionKeys } = await import("../../backend/src/constants/permissions.ts");

  assert.deepEqual(defaultRoleDefinitions.map((role) => role.name), builtInNames);
  assert.deepEqual([...userRoles], builtInNames);
  assert.equal(JSON.stringify(assignableRolesByRole).includes("Guest"), false);

  const known = new Set<string>(permissionKeys);
  for (const role of defaultRoleDefinitions) {
    for (const key of role.permissionKeys) assert.ok(known.has(key), `${role.name}: unknown permission ${key}`);
  }
  for (const name of ["Owner", "Administrator"]) {
    const role = defaultRoleDefinitions.find((item) => item.name === name)!;
    assert.equal(role.hasFullAccess, true);
  }
  const sales = defaultRoleDefinitions.find((role) => role.slug === "sales")!;
  assert.ok(sales.permissionKeys.includes("customer.view") && sales.permissionKeys.includes("lead.create"));
});

test("a built-in role keeps its default permissions: extras can be added and removed, defaults cannot", async () => {
  const { roleService } = await import("../../backend/src/services/role.service.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { roleHistoryRepository } = await import("../../backend/src/repositories/role-history.repository.ts");
  const { auditService } = await import("../../backend/src/services/audit.service.ts");
  const { getDefaultPermissionKeys } = await import("../../backend/src/constants/default-roles.ts");

  const defaults = getDefaultPermissionKeys("employee");
  assert.ok(defaults.length > 0);
  const originals = {
    find: roleRepository.findById,
    update: roleRepository.update,
    version: roleHistoryRepository.latestVersion,
    create: roleHistoryRepository.create,
    audit: auditService.record,
  };
  let stored: Record<string, any> = { _id: "r1", slug: "employee", name: "Employee", isSystem: true, hasFullAccess: false, permissionKeys: [...defaults] };
  const updates: Record<string, any>[] = [];
  roleRepository.findById = (async () => stored) as any;
  roleRepository.update = (async (_id: string, update: Record<string, any>) => {
    updates.push(update);
    stored = { ...stored, ...update };
    return stored;
  }) as any;
  roleHistoryRepository.latestVersion = (async () => 0) as any;
  roleHistoryRepository.create = (async () => undefined) as any;
  auditService.record = (async () => undefined) as any;

  try {
    const missingOne = defaults.slice(1);
    await assert.rejects(
      () => roleService.update("r1", { permissionKeys: missingOne as any }, "u1"),
      (error: any) => error.statusCode === 400 && error.message.includes(defaults[0]),
    );
    await assert.rejects(() => roleService.update("r1", { permissionKeys: [] }, "u1"), /cannot be removed/);
    assert.equal(updates.length, 0, "nothing is saved when a default would be removed");

    const withExtra = await roleService.update("r1", { permissionKeys: [...defaults, "customer.view"] as any }, "u1");
    assert.ok(withExtra.permissionKeys.includes("customer.view"));
    assert.deepEqual(withExtra.defaultPermissionKeys, defaults, "the response tells the UI which permissions are locked");

    const extraRemoved = await roleService.update("r1", { permissionKeys: [...defaults] as any }, "u1");
    assert.equal(extraRemoved.permissionKeys.includes("customer.view"), false, "an extra permission can be taken away again");

    await assert.rejects(() => roleService.update("r1", { isActive: false }, "u1"), /cannot be deactivated/);
    await assert.rejects(() => roleService.update("r1", { name: "Renamed" }, "u1"), /names cannot be changed/);
    await assert.rejects(() => roleService.delete("r1", "u1"), /cannot be deleted/);

    stored = { _id: "c1", slug: "intern", name: "Intern", isSystem: false, hasFullAccess: false, permissionKeys: ["task.create"] };
    const custom = await roleService.update("c1", { permissionKeys: [] }, "u1");
    assert.deepEqual(custom.permissionKeys, [], "a custom role has no locked permissions");
    assert.deepEqual(custom.defaultPermissionKeys, []);
  } finally {
    roleRepository.findById = originals.find;
    roleRepository.update = originals.update;
    roleHistoryRepository.latestVersion = originals.version;
    roleHistoryRepository.create = originals.create;
    auditService.record = originals.audit;
  }
});

test("startup sync creates or repairs every built-in role without touching extras, and Guest is retired safely", async () => {
  const { syncDefaultRoles, removeGuestRole } = await import("../../backend/src/database/default-role-sync.ts");
  const { RoleModel } = await import("../../backend/src/models/role.model.ts");
  const { RoleTemplateModel } = await import("../../backend/src/models/role-template.model.ts");
  const { UserModel } = await import("../../backend/src/models/user.model.ts");
  const { defaultRoleDefinitions } = await import("../../backend/src/constants/default-roles.ts");
  const originals = {
    updateOne: RoleModel.updateOne,
    deleteOne: RoleModel.deleteOne,
    templates: RoleTemplateModel.updateMany,
    count: UserModel.countDocuments,
  };
  const roleUpdates: { filter: any; update: any; options: any }[] = [];
  const deleted: unknown[] = [];
  let guestUsers = 0;
  RoleModel.updateOne = (async (filter: any, update: any, options: any) => {
    roleUpdates.push({ filter, update, options });
    return {};
  }) as any;
  RoleModel.deleteOne = (async (filter: any) => {
    deleted.push(filter);
    return {};
  }) as any;
  RoleTemplateModel.updateMany = (async () => ({})) as any;
  UserModel.countDocuments = (async () => guestUsers) as any;

  try {
    await syncDefaultRoles();
    assert.equal(roleUpdates.length, defaultRoleDefinitions.length);
    for (const definition of defaultRoleDefinitions) {
      const call = roleUpdates.find((item) => item.filter.slug === definition.slug)!;
      assert.equal(call.options.upsert, true, `${definition.slug} is created when missing`);
      assert.equal(call.update.$set.isSystem, true);
      assert.deepEqual(call.update.$addToSet.permissionKeys.$each, definition.permissionKeys, "defaults are added back, extras untouched");
      assert.equal(call.update.$set.permissionKeys, undefined, "the permission list is never overwritten");
    }

    roleUpdates.length = 0;
    await removeGuestRole();
    assert.deepEqual(deleted, [{ slug: "guest" }], "an unused Guest role is deleted");

    deleted.length = 0;
    guestUsers = 2;
    await removeGuestRole();
    assert.equal(deleted.length, 0, "a Guest role that still has users is not deleted");
    assert.deepEqual(roleUpdates[0].update, { $set: { isSystem: false } }, "it is kept as a plain custom role instead");
  } finally {
    RoleModel.updateOne = originals.updateOne;
    RoleModel.deleteOne = originals.deleteOne;
    RoleTemplateModel.updateMany = originals.templates;
    UserModel.countDocuments = originals.count;
  }
});

test("RBAC page locks default permissions, apps no longer know Guest, and the login screen remembers the last method", () => {
  const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
  const rbac = read("admin/src/admin/features/rbac/RBACPage.tsx");
  assert.match(rbac, /lockedKeys\.has\(entry\.key\)/);
  assert.match(rbac, /disabled=\{selectedRole\.hasFullAccess \|\| lockedKeys\.has\(entry\.key\)\}/);
  assert.match(rbac, /if \(lockedKeys\.has\(key\)\) return;/);

  assert.doesNotMatch(read("shared/src/auth/types.ts"), /Guest/);
  assert.doesNotMatch(read("frontend/src/data/workspace.ts"), /Guest/);
  assert.doesNotMatch(read("frontend/src/common/features/dashboard/RoleDashboardPage.tsx"), /Guest/);
  assert.doesNotMatch(read("admin/src/admin/features/admin/admin.data.ts"), /Guest/);

  const login = read("shared/src/auth/pages/LoginPage.tsx");
  assert.match(login, /useState<"password" \| "pin">\(getRememberedLoginMethod\)/);
  assert.match(login, /setRememberedLoginMethod\(loginMethod\)/);
});
