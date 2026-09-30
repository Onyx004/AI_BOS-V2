import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

const root = path.resolve(import.meta.dirname, "../..");

test("a new user has no department (Unassigned) unless one is chosen", async () => {
  const { userService } = await import("../../backend/src/services/user.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const original = { findById: userRepository.findById, findByEmail: userRepository.findByEmail, create: userRepository.create };
  const created: Record<string, any>[] = [];
  userRepository.findById = (async () => ({ id: "hr1", role: "HR", companyName: "Acme", organizationId: "org1", departmentId: "dept-of-creator", isActive: true })) as any;
  userRepository.findByEmail = (async () => null) as any;
  userRepository.create = (async (input: Record<string, any>) => {
    created.push(input);
    return { id: "not-an-object-id", ...input, isActive: true };
  }) as any;

  try {
    await userService.createUser("hr1", { fullName: "New Person", email: "new@x.co", password: "Str0ng!Passw0rd", role: "Employee", phone: "9999999999" } as any);
    assert.equal(created[0].departmentId, undefined, "the creator's own department is not copied onto the new user");
  } finally {
    userRepository.findById = original.findById;
    userRepository.findByEmail = original.findByEmail;
    userRepository.create = original.create;
  }
});

test("deleting a department unassigns its members; its teams go too, but only after the caller confirms", async () => {
  const { departmentService } = await import("../../backend/src/services/department.service.ts");
  const { departmentRepository } = await import("../../backend/src/repositories/department.repository.ts");
  const { teamRepository } = await import("../../backend/src/repositories/team.repository.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const original = {
    find: departmentRepository.findById,
    detach: departmentRepository.detachChildren,
    delete: departmentRepository.delete,
    listTeams: teamRepository.listByDepartment,
    deleteTeams: teamRepository.deleteByDepartment,
    clear: userRepository.clearDepartment,
    removeTeams: userRepository.removeTeams,
  };
  const calls: string[] = [];
  let teams: { _id: string; name: string }[] = [];
  departmentRepository.findById = (async () => ({ _id: "d1", name: "Sales" })) as any;
  departmentRepository.detachChildren = (async (id: string) => void calls.push(`detach:${id}`)) as any;
  departmentRepository.delete = (async (id: string) => {
    calls.push(`delete:${id}`);
    return { _id: id };
  }) as any;
  teamRepository.listByDepartment = (async () => teams) as any;
  teamRepository.deleteByDepartment = (async (id: string) => {
    calls.push(`deleteTeams:${id}`);
    return teams;
  }) as any;
  userRepository.clearDepartment = (async (id: string) => {
    calls.push(`unassign:${id}`);
    return 4;
  }) as any;
  userRepository.removeTeams = (async (ids: unknown[]) => void calls.push(`pullTeams:${ids.join(",")}`)) as any;

  try {
    const plain = await departmentService.delete("d1");
    assert.deepEqual(plain, { deleted: true, unassignedEmployees: 4, deletedTeams: 0 });
    assert.deepEqual(calls, ["unassign:d1", "pullTeams:", "detach:d1", "delete:d1"], "members are unassigned before the department goes away");

    calls.length = 0;
    teams = [{ _id: "t1", name: "Inside Sales" }, { _id: "t2", name: "Field Sales" }];
    await assert.rejects(
      () => departmentService.delete("d1"),
      (error: any) => error.statusCode === 409 && error.message.includes("2 teams") && error.message.includes("Inside Sales, Field Sales"),
    );
    assert.deepEqual(calls, [], "without confirmation nothing is touched");

    const confirmed = await departmentService.delete("d1", { deleteTeams: true });
    assert.deepEqual(confirmed, { deleted: true, unassignedEmployees: 4, deletedTeams: 2 });
    assert.deepEqual(calls, ["unassign:d1", "deleteTeams:d1", "pullTeams:t1,t2", "detach:d1", "delete:d1"]);
  } finally {
    departmentRepository.findById = original.find;
    departmentRepository.detachChildren = original.detach;
    departmentRepository.delete = original.delete;
    teamRepository.listByDepartment = original.listTeams;
    teamRepository.deleteByDepartment = original.deleteTeams;
    userRepository.clearDepartment = original.clear;
    userRepository.removeTeams = original.removeTeams;
  }
});

test("deleting a department together with its teams also needs team.delete, and the admin dialog asks first", async () => {
  const { departmentRoutes } = await import("../../backend/src/routes/department.routes.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const original = roleRepository.findBySlug;

  type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...args: any[]) => any }[] } };
  const layer = (departmentRoutes as unknown as { stack: Layer[] }).stack.find((item) => item.route?.path === "/:id" && item.route.methods.delete);
  assert.ok(layer?.route, "DELETE /:id is registered");
  const guard = layer!.route!.stack[3];

  const run = async (deleteTeams: boolean, permissionKeys: string[]) => {
    roleRepository.findBySlug = (async () => ({ isActive: true, hasFullAccess: false, permissionKeys })) as any;
    let outcome: unknown = "pending";
    await guard.handle({ query: { deleteTeams }, user: { id: "u1", role: "Custom" } }, {}, (error?: unknown) => {
      outcome = error ?? "allowed";
    });
    return outcome;
  };

  try {
    assert.equal(await run(false, ["department.delete"]), "allowed", "a plain department delete does not need team.delete");
    assert.equal(await run(true, ["department.delete", "team.delete"]), "allowed");
    assert.equal(((await run(true, ["department.delete"])) as { statusCode?: number }).statusCode, 403, "deleting the teams too needs team.delete");
  } finally {
    roleRepository.findBySlug = original;
  }

  const page = fs.readFileSync(path.join(root, "admin/src/admin/features/organization/OrganizationPage.tsx"), "utf8");
  assert.match(page, /Delete department and its teams\?/);
  assert.match(page, /deleteDepartment\(department\._id, token, \{ deleteTeams: departmentTeams\.length > 0 \}\)/);
  const api = fs.readFileSync(path.join(root, "admin/src/admin/features/organization/organization.api.ts"), "utf8");
  assert.match(api, /\?deleteTeams=true/);
});

test("the Add Employee form starts on Unassigned", () => {
  const page = fs.readFileSync(path.join(root, "shared/src/employees/EmployeesPage.tsx"), "utf8");
  assert.match(page, /defaultValues: emptyEmployeeForm,/);
  assert.match(page, /<option value="">Unassigned<\/option>/);
});

test("an employee can be moved to Unassigned (null department) and the Employees page has a working Unassigned section", async () => {
  const { userService } = await import("../../backend/src/services/user.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { moveDepartmentSchema } = await import("../../backend/src/validation/user.validation.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const original = {
    role: roleRepository.findBySlug,
    findById: userRepository.findById,
    clear: userRepository.clearUserDepartment,
    update: userRepository.updateEmployeeProfile,
  };
  const calls: string[] = [];
  roleRepository.findBySlug = (async () => ({ isActive: true, hasFullAccess: true, permissionKeys: [] })) as any;
  userRepository.findById = (async () => ({ id: "emp1", role: "Employee", fullName: "Emp", email: "e@x.co", isActive: true })) as any;
  userRepository.clearUserDepartment = (async (id: string) => {
    calls.push(`clear:${id}`);
    return { id, role: "Employee", fullName: "Emp", email: "e@x.co", isActive: true };
  }) as any;
  userRepository.updateEmployeeProfile = (async (id: string, update: Record<string, unknown>) => {
    calls.push(`set:${id}:${update.departmentId}`);
    return { id, role: "Employee", fullName: "Emp", email: "e@x.co", isActive: true };
  }) as any;

  try {
    assert.equal(moveDepartmentSchema.safeParse({ departmentId: null }).success, true);
    assert.equal(moveDepartmentSchema.safeParse({ departmentId: "64f000000000000000000001" }).success, true);
    assert.equal(moveDepartmentSchema.safeParse({ departmentId: "Unassigned" }).success, false, "a name is not a department id");

    await userService.moveToDepartment("owner1", "Owner", "emp1", { departmentId: null });
    await userService.moveToDepartment("owner1", "Owner", "emp1", { departmentId: "64f000000000000000000001" });
    assert.deepEqual(calls, ["clear:emp1", "set:emp1:64f000000000000000000001"]);
  } finally {
    roleRepository.findBySlug = original.role;
    userRepository.findById = original.findById;
    userRepository.clearUserDepartment = original.clear;
    userRepository.updateEmployeeProfile = original.update;
  }

  const page = fs.readFileSync(path.join(root, "shared/src/employees/EmployeesPage.tsx"), "utf8");
  assert.match(page, /name !== "Unassigned" && !apiDepartments\.some/, "the fake 'Unassigned' department made from employee data is gone");
  assert.match(page, /isUnassigned\s+members=\{employees\.filter\(\(employee\) => !employee\.departmentId\)\}/);
  const panel = fs.readFileSync(path.join(root, "shared/src/employees/DepartmentGroupPanel.tsx"), "utf8");
  assert.match(panel, /updateEmployeeDepartment\(employee\.id, isUnassigned \? null : department\.id\)/);
  assert.match(panel, /moveMember\(employee, null\)/);
});
