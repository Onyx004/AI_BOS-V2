import assert from "node:assert/strict";
import test from "node:test";

import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

// Login records attendance presence; there is no live MongoDB in these tests, so stub the DB-backed side effects.
const { userRepository: presenceUserRepository } = await import("../../backend/src/repositories/user.repository.ts");
const { attendanceService: presenceAttendanceService } = await import("../../backend/src/services/attendance.service.ts");
presenceUserRepository.touchLastSeen = async () => undefined;
presenceAttendanceService.recordLoginCheckIn = async () => null;


test("valid temporary password works before expiry and expired temporary password is rejected", async () => {
  const { authService } = await import("../../backend/src/services/auth.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { hashPassword } = await import("../../backend/src/utils/password.ts");

  const originalFind = userRepository.findByEmailWithPassword;
  const originalUpdate = userRepository.updateLastLogin;
  const originalFindRole = roleRepository.findBySlug;
  const passwordHash = await hashPassword("TempPass123!");
  let updateCalls = 0;
  const baseUser = {
    id: "temporary-user",
    fullName: "Temporary User",
    companyName: "WorknAi",
    email: "temporary@example.com",
    passwordHash,
    role: "Employee",
    isEmailVerified: true,
    isActive: true,
    isProfileComplete: true,
    mustChangePassword: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  roleRepository.findBySlug = (async () => null) as any;
  userRepository.updateLastLogin = (async () => {
    updateCalls += 1;
    return baseUser;
  }) as any;

  try {
    userRepository.findByEmailWithPassword = (async () => ({
      ...baseUser,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
    })) as any;

    const valid = await authService.login({
      email: baseUser.email,
      password: "TempPass123!",
    });
    assert.equal(valid.user.mustChangePassword, true);
    assert.equal(updateCalls, 1);

    userRepository.findByEmailWithPassword = (async () => ({
      ...baseUser,
      temporaryPasswordExpiresAt: new Date(Date.now() - 60_000),
    })) as any;

    await assert.rejects(
      authService.login({ email: baseUser.email, password: "TempPass123!" }),
      /Temporary password has expired/,
    );
    assert.equal(updateCalls, 1, "expired credential must not create a login session");
  } finally {
    userRepository.findByEmailWithPassword = originalFind;
    userRepository.updateLastLogin = originalUpdate;
    roleRepository.findBySlug = originalFindRole;
  }
});

test("normal password accounts ignore a stale temporary-password expiry", async () => {
  const { authService } = await import("../../backend/src/services/auth.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { hashPassword } = await import("../../backend/src/utils/password.ts");

  const originalFind = userRepository.findByEmailWithPassword;
  const originalUpdate = userRepository.updateLastLogin;
  const originalFindRole = roleRepository.findBySlug;
  const user = {
    id: "normal-user",
    fullName: "Normal User",
    companyName: "WorknAi",
    email: "normal@example.com",
    passwordHash: await hashPassword("NormalPass123!"),
    role: "Employee",
    isEmailVerified: true,
    isActive: true,
    isProfileComplete: true,
    mustChangePassword: false,
    temporaryPasswordExpiresAt: new Date(Date.now() - 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  roleRepository.findBySlug = (async () => null) as any;
  userRepository.findByEmailWithPassword = (async () => user) as any;
  userRepository.updateLastLogin = (async () => user) as any;

  try {
    const result = await authService.login({
      email: user.email,
      password: "NormalPass123!",
    });
    assert.equal(result.user.email, user.email);
  } finally {
    userRepository.findByEmailWithPassword = originalFind;
    userRepository.updateLastLogin = originalUpdate;
    roleRepository.findBySlug = originalFindRole;
  }
});

test("successful mandatory password update clears temporaryPasswordExpiresAt", async () => {
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { UserModel } = await import("../../backend/src/models/user.model.ts");
  const originalUpdate = UserModel.findByIdAndUpdate;
  let update: any;

  UserModel.findByIdAndUpdate = ((id: unknown, receivedUpdate: unknown) => {
    update = receivedUpdate;
    return Promise.resolve({ id });
  }) as any;

  try {
    await userRepository.updatePassword("user-1", "new-hash");
    assert.equal(update.$set.mustChangePassword, false);
    assert.deepEqual(update.$unset, { temporaryPasswordExpiresAt: "" });
  } finally {
    UserModel.findByIdAndUpdate = originalUpdate;
  }
});
