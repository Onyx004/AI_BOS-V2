import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

const root = path.resolve(import.meta.dirname, "../..");

const roleDocs = [
  { slug: "owner", name: "Owner", isSystem: true, hasFullAccess: true, isActive: true, permissionKeys: [] },
  { slug: "administrator", name: "Administrator", isSystem: true, hasFullAccess: true, isActive: true, permissionKeys: [] },
  { slug: "manager", name: "Manager", isSystem: true, hasFullAccess: false, isActive: true, permissionKeys: ["task.create"] },
  { slug: "intern", name: "Intern", isSystem: false, hasFullAccess: false, isActive: true, permissionKeys: ["task.create", "customer.view"] },
  { slug: "hr-manager", name: "HR Manager", isSystem: false, hasFullAccess: false, isActive: true, permissionKeys: ["user.view_all"] },
  { slug: "retired", name: "Retired", isSystem: false, hasFullAccess: false, isActive: false, permissionKeys: [] },
];

async function withRoleStore<T>(run: () => Promise<T>) {
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const original = { findBySlug: roleRepository.findBySlug, listAll: roleRepository.listAll };
  roleRepository.findBySlug = (async (slug: string) => roleDocs.find((role) => role.slug === slug) ?? null) as any;
  roleRepository.listAll = (async () => roleDocs) as any;
  try {
    return await run();
  } finally {
    roleRepository.findBySlug = original.findBySlug;
    roleRepository.listAll = original.listAll;
  }
}

test("Owner and Administrator can hand out active custom roles; Manager and HR stay on their fixed lists", async () => {
  const { userService } = await import("../../backend/src/services/user.service.ts");
  await withRoleStore(async () => {
    const builtInForOwner = ["Manager", "HR", "Employee", "Sales", "Finance", "Support", "Developer"];
    assert.deepEqual(await userService.getAssignableRoles("Owner"), [...builtInForOwner, "Intern", "HR Manager"]);
    assert.deepEqual(await userService.getAssignableRoles("Administrator"), [...builtInForOwner, "Intern", "HR Manager"]);
    assert.deepEqual(await userService.getAssignableRoles("Manager"), ["HR", "Employee", "Sales"]);
    assert.deepEqual(await userService.getAssignableRoles("HR"), ["Employee", "Sales"]);
    assert.deepEqual(await userService.getAssignableRoles("Employee"), []);
  });
});

test("a custom role such as 'HR Manager' resolves its permissions through its slug", async () => {
  const { permissionService } = await import("../../backend/src/services/permission.service.ts");
  await withRoleStore(async () => {
    const hrManager = await permissionService.resolveEffectivePermissions("HR Manager");
    assert.deepEqual([...hrManager.permissionKeys], ["user.view_all"]);
    const intern = await permissionService.resolveEffectivePermissions("Intern");
    assert.ok(intern.permissionKeys.has("customer.view"));
    const unknown = await permissionService.resolveEffectivePermissions("Nobody");
    assert.equal(unknown.hasFullAccess, false);
    assert.equal(unknown.permissionKeys.size, 0);
  });
});

test("creating a user and changing a role accept custom roles only from full-access accounts, and never touch Owner/Administrator", async () => {
  const { userService } = await import("../../backend/src/services/user.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const original = {
    findById: userRepository.findById,
    findByEmail: userRepository.findByEmail,
    create: userRepository.create,
    updateRole: userRepository.updateRole,
  };
  const users: Record<string, any> = {
    owner1: { id: "owner1", role: "Owner", companyName: "Acme", organizationId: "org1", isActive: true },
    manager1: { id: "manager1", role: "Manager", companyName: "Acme", organizationId: "org1", isActive: true },
    emp1: { id: "emp1", role: "Employee", fullName: "Emp One", email: "e@x.co", isActive: true, organizationId: "org1" },
    owner2: { id: "owner2", role: "Owner", fullName: "Other Owner", email: "o@x.co", isActive: true, organizationId: "org1" },
  };
  const created: any[] = [];
  userRepository.findById = (async (id: string) => users[id] ?? null) as any;
  userRepository.findByEmail = (async () => null) as any;
  userRepository.create = (async (input: any) => {
    created.push(input);
    return { id: "not-an-object-id", ...input, isActive: true };
  }) as any;
  userRepository.updateRole = (async (id: string, role: string) => ({ ...users[id], role })) as any;

  const newUser = (role: string) => ({ fullName: "New Person", email: "new@x.co", password: "Str0ng!Passw0rd", role, phone: "9999999999" }) as any;

  try {
    await withRoleStore(async () => {
      await userService.createUser("owner1", newUser("Intern"));
      assert.equal(created[0].role, "Intern");

      await assert.rejects(() => userService.createUser("owner1", newUser("Retired")), /not allowed/, "an inactive custom role cannot be assigned");
      await assert.rejects(() => userService.createUser("owner1", newUser("Nonexistent")), /not allowed/);
      await assert.rejects(() => userService.createUser("owner1", newUser("Owner")), /not allowed/, "Owner is still not assignable");
      await assert.rejects(() => userService.createUser("manager1", newUser("Intern")), /not allowed/, "a Manager cannot hand out custom roles");

      const changed = await userService.changeRole("owner1", "Owner", "emp1", { role: "HR Manager" });
      assert.equal(changed.role, "HR Manager");
      await assert.rejects(() => userService.changeRole("manager1", "Manager", "emp1", { role: "Intern" }), /not allowed|only manage/);
      await assert.rejects(() => userService.changeRole("owner1", "Owner", "owner2", { role: "Manager" }), /cannot be changed/);
    });
  } finally {
    userRepository.findById = original.findById;
    userRepository.findByEmail = original.findByEmail;
    userRepository.create = original.create;
    userRepository.updateRole = original.updateRole;
  }
});

test("a custom role that people hold cannot be deleted or renamed; an unused one can", async () => {
  const { roleService } = await import("../../backend/src/services/role.service.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { auditService } = await import("../../backend/src/services/audit.service.ts");
  const original = {
    findById: roleRepository.findById,
    exists: roleRepository.existsBySlug,
    update: roleRepository.update,
    delete: roleRepository.delete,
    count: userRepository.countByRoleName,
    audit: auditService.record,
  };
  let holders = 3;
  const updates: Record<string, any>[] = [];
  roleRepository.findById = (async () => ({ _id: "c1", slug: "intern", name: "Intern", isSystem: false, hasFullAccess: false, permissionKeys: [] })) as any;
  roleRepository.existsBySlug = (async () => false) as any;
  roleRepository.update = (async (_id: string, update: Record<string, any>) => {
    updates.push(update);
    return { _id: "c1", slug: "intern", name: "Intern", isSystem: false, hasFullAccess: false, permissionKeys: [], ...update };
  }) as any;
  roleRepository.delete = (async () => ({ _id: "c1" })) as any;
  userRepository.countByRoleName = (async () => holders) as any;
  auditService.record = (async () => undefined) as any;

  try {
    await assert.rejects(() => roleService.delete("c1", "u1"), (error: any) => error.statusCode === 409 && /3 user/.test(error.message));
    await assert.rejects(() => roleService.update("c1", { name: "Trainee" }, "u1"), /cannot be renamed/);

    holders = 0;
    const renamed = await roleService.update("c1", { name: "Trainee Staff" }, "u1");
    assert.equal(updates[0].slug, "trainee-staff", "the slug follows the new name so permissions keep resolving");
    assert.equal(renamed.name, "Trainee Staff");
    assert.deepEqual(await roleService.delete("c1", "u1"), { deleted: true });
  } finally {
    roleRepository.findById = original.findById;
    roleRepository.existsBySlug = original.exists;
    roleRepository.update = original.update;
    roleRepository.delete = original.delete;
    userRepository.countByRoleName = original.count;
    auditService.record = original.audit;
  }
});

test("a custom role signs in to the Employee workspace but keeps its own name for display", () => {
  const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
  const auth = read("shared/src/auth/auth-service.ts");
  assert.match(auth, /\(authRoles as readonly string\[\]\)\.includes\(role\) \? \(role as AuthRole\) : "Employee"/);
  assert.equal((auth.match(/roleName: customRoleName\(data\.user\.role\)/g) ?? []).length, 2, "login and token refresh both keep the custom role name");
  assert.match(read("shared/src/platform/ProfessionalDashboard.tsx"), /session\?\.user\.roleName \?\? session\?\.user\.role/);
  assert.match(read("shared/src/employees/employees.schema.ts"), /role: z\.string\(\)\.min\(1/);
});
