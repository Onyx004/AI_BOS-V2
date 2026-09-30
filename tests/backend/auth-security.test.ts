import test from "node:test";
import assert from "node:assert/strict";
import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

// Login records attendance presence; there is no live MongoDB in these tests, so stub the DB-backed side effects.
const { userRepository: presenceUserRepository } = await import("../../backend/src/repositories/user.repository.ts");
const { attendanceService: presenceAttendanceService } = await import("../../backend/src/services/attendance.service.ts");
presenceUserRepository.touchLastSeen = async () => undefined;
presenceAttendanceService.recordLoginCheckIn = async () => null;


test("createUser enforces the role-assignment hierarchy", async () => {
  const { userService } = await import("../../backend/src/services/user.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");

  const originalFindById = userRepository.findById;
  const originalFindByEmail = userRepository.findByEmail;
  const originalCreate = userRepository.create;

  function creatorWithRole(role: string) {
    return {
      id: "creator-1",
      fullName: "Creator",
      companyName: "WorknAi",
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  }

  userRepository.findByEmail = async () => null;
  userRepository.create = async (input: any) => ({
    id: "user-new",
    fullName: input.fullName,
    companyName: input.companyName,
    email: input.email,
    role: input.role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  try {
    userRepository.findById = async () => creatorWithRole("Manager");

    await assert.rejects(
      () =>
        userService.createUser("creator-1", {
          fullName: "New Admin",
          email: "new-admin@example.com",
          password: "Secure123!",
          role: "Administrator",
        }),
      /not allowed to create a user with this role/,
    );

    const managerCreatedHr = await userService.createUser("creator-1", {
      fullName: "New HR",
      email: "new-hr@example.com",
      password: "Secure123!",
      role: "HR",
    });
    assert.equal(managerCreatedHr.role, "HR");

    userRepository.findById = async () => creatorWithRole("HR");

    await assert.rejects(
      () =>
        userService.createUser("creator-1", {
          fullName: "New Manager",
          email: "new-manager@example.com",
          password: "Secure123!",
          role: "Manager",
        }),
      /not allowed to create a user with this role/,
    );

    const hrCreatedEmployee = await userService.createUser("creator-1", {
      fullName: "New Employee",
      email: "new-employee@example.com",
      password: "Secure123!",
      role: "Employee",
    });
    assert.equal(hrCreatedEmployee.role, "Employee");
  } finally {
    userRepository.findById = originalFindById;
    userRepository.findByEmail = originalFindByEmail;
    userRepository.create = originalCreate;
  }
});

test("JWT verifies issuer, audience, subject, and role", async () => {
  const { createTokenPair, verifyAccessToken } = await import("../../backend/src/utils/jwt.ts");

  const tokens = createTokenPair({ sub: "user-1", role: "Administrator" });
  const payload = verifyAccessToken(tokens.accessToken);

  assert.equal(payload.sub, "user-1");
  assert.equal(payload.role, "Administrator");
  assert.equal(tokens.tokenType, "Bearer");
});

test("login rejects invalid passwords and succeeds with current user role", async () => {
  const { authService } = await import("../../backend/src/services/auth.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { hashPassword } = await import("../../backend/src/utils/password.ts");

  const originalFindByEmailWithPassword = userRepository.findByEmailWithPassword;
  const originalUpdateLastLogin = userRepository.updateLastLogin;
  const originalFindBySlug = roleRepository.findBySlug;
  // No live MongoDB in this test — permission resolution must not buffer against it.
  roleRepository.findBySlug = (async () => null) as any;
  const passwordHash = await hashPassword("Secure123");
  const user = {
    id: "user-2",
    fullName: "Aman",
    companyName: "WorknAi",
    email: "aman@example.com",
    passwordHash,
    role: "Manager",
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  userRepository.findByEmailWithPassword = async () => user;
  userRepository.updateLastLogin = async () => ({ ...user, role: "HR", lastLoginAt: new Date() });

  try {
    await assert.rejects(
      () => authService.login({ email: "aman@example.com", password: "Wrong" }),
      /Invalid email or password/,
    );

    const result = await authService.login({ email: "aman@example.com", password: "Secure123" });
    assert.equal(result.user.role, "HR");
  } finally {
    userRepository.findByEmailWithPassword = originalFindByEmailWithPassword;
    userRepository.updateLastLogin = originalUpdateLastLogin;
    roleRepository.findBySlug = originalFindBySlug;
  }
});

test("refresh uses database user state and rejects inactive users", async () => {
  const { authService } = await import("../../backend/src/services/auth.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { createTokenPair } = await import("../../backend/src/utils/jwt.ts");

  const originalFindById = userRepository.findById;
  const originalFindBySlug = roleRepository.findBySlug;
  // No live MongoDB in this test — permission resolution must not buffer against it.
  roleRepository.findBySlug = (async () => null) as any;
  const token = createTokenPair({ sub: "user-3", role: "Owner" }).refreshToken;
  const activeUser = {
    id: "user-3",
    fullName: "Owner",
    companyName: "WorknAi",
    email: "ceo@example.com",
    role: "Administrator",
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  userRepository.findById = async () => activeUser;

  try {
    const result = await authService.refresh({ refreshToken: token });
    assert.equal(result.user.role, "Administrator");

    userRepository.findById = async () => ({ ...activeUser, isActive: false });
    await assert.rejects(() => authService.refresh({ refreshToken: token }), /Invalid refresh token/);
  } finally {
    userRepository.findById = originalFindById;
    roleRepository.findBySlug = originalFindBySlug;
  }
});

test("profile lookup reports missing users", async () => {
  const { authService } = await import("../../backend/src/services/auth.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const originalFindById = userRepository.findById;

  userRepository.findById = async () => null;

  try {
    await assert.rejects(() => authService.getProfile("missing"), /User not found/);
  } finally {
    userRepository.findById = originalFindById;
  }
});
