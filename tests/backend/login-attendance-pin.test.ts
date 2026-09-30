import test from "node:test";
import assert from "node:assert/strict";
import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

test("PIN login accepts the right 6-digit PIN, rejects wrong ones, and is blocked until account setup is done", async () => {
  const { authService } = await import("../../backend/src/services/auth.service.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { attendanceService } = await import("../../backend/src/services/attendance.service.ts");
  const { hashPassword } = await import("../../backend/src/utils/password.ts");
  const { loginSchema } = await import("../../backend/src/validation/auth.validation.ts");

  assert.equal(loginSchema.safeParse({ email: "a@b.co", pin: "123456" }).success, true);
  assert.equal(loginSchema.safeParse({ email: "a@b.co", pin: "12345" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "a@b.co", pin: "123456", password: "x" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "a@b.co" }).success, false);

  const originals = {
    find: userRepository.findByEmailWithPassword,
    update: userRepository.updateLastLogin,
    seen: userRepository.touchLastSeen,
    role: roleRepository.findBySlug,
    checkIn: attendanceService.recordLoginCheckIn,
  };
  const checkIns: string[] = [];
  const user = {
    id: "pin-user",
    fullName: "Pin User",
    companyName: "WorknAi",
    email: "pin@example.com",
    passwordHash: await hashPassword("Whatever123!"),
    pinHash: await hashPassword("482913"),
    role: "Employee",
    isEmailVerified: true,
    isActive: true,
    isProfileComplete: true,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
  roleRepository.findBySlug = (async () => null) as any;
  userRepository.findByEmailWithPassword = (async () => user) as any;
  userRepository.updateLastLogin = (async () => user) as any;
  userRepository.touchLastSeen = async () => undefined;
  attendanceService.recordLoginCheckIn = (async (userId: string) => {
    checkIns.push(userId);
    return null;
  }) as any;

  try {
    await assert.rejects(() => authService.login({ email: user.email, pin: "000000" }), /Invalid email or PIN/);
    assert.deepEqual(checkIns, [], "failed login must not check in");

    const ok = await authService.login({ email: user.email, pin: "482913" });
    assert.equal(ok.user.email, user.email);
    assert.deepEqual(checkIns, ["pin-user"], "successful login is the day's check-in");

    user.pinHash = undefined;
    await assert.rejects(() => authService.login({ email: user.email, pin: "482913" }), /Invalid email or PIN/);

    user.pinHash = await hashPassword("482913");
    user.mustChangePassword = true;
    await assert.rejects(() => authService.login({ email: user.email, pin: "482913" }), /temporary password first/);
  } finally {
    userRepository.findByEmailWithPassword = originals.find;
    userRepository.updateLastLogin = originals.update;
    userRepository.touchLastSeen = originals.seen;
    roleRepository.findBySlug = originals.role;
    attendanceService.recordLoginCheckIn = originals.checkIn;
  }
});

test("login check-in creates one record per day, skips admin roles and reopens an offline auto check-out", async () => {
  const { attendanceService } = await import("../../backend/src/services/attendance.service.ts");
  const { attendanceRepository } = await import("../../backend/src/repositories/attendance.repository.ts");
  const { securityService } = await import("../../backend/src/services/security.service.ts");
  const originals = {
    find: attendanceRepository.findByUserAndDate,
    create: attendanceRepository.create,
    reopen: attendanceRepository.reopenAutoClosed,
    audit: securityService.recordSecurityEvent,
  };
  const created: Record<string, unknown>[] = [];
  const reopened: string[] = [];
  let existing: Record<string, unknown> | null = null;
  attendanceRepository.findByUserAndDate = (async () => existing) as any;
  attendanceRepository.create = (async (input: Record<string, unknown>) => {
    created.push(input);
    return input;
  }) as any;
  attendanceRepository.reopenAutoClosed = (async (userId: string) => {
    reopened.push(userId);
    return {};
  }) as any;
  securityService.recordSecurityEvent = (async () => undefined) as any;
  const userId = "64f000000000000000000031";

  try {
    await attendanceService.recordLoginCheckIn(userId, "Administrator");
    assert.equal(created.length, 0, "administrators are not part of attendance");

    await attendanceService.recordLoginCheckIn(userId, "Employee");
    assert.equal(created.length, 1);
    assert.equal(created[0].checkInMethod, "login");
    assert.equal(created[0].status, "Present");

    existing = { checkOutMethod: "auto_offline", checkOutAt: new Date() };
    await attendanceService.recordLoginCheckIn(userId, "Employee");
    assert.equal(created.length, 1, "second login of the day does not create another record");
    assert.deepEqual(reopened, [userId]);

    reopened.length = 0;
    existing = { checkOutMethod: undefined, checkOutAt: undefined };
    await attendanceService.recordLoginCheckIn(userId, "Employee");
    assert.deepEqual(reopened, [], "normal open record is left untouched");
  } finally {
    attendanceRepository.findByUserAndDate = originals.find;
    attendanceRepository.create = originals.create;
    attendanceRepository.reopenAutoClosed = originals.reopen;
    securityService.recordSecurityEvent = originals.audit;
  }
});

test("users offline for 2 hours are checked out at the time they went offline", async () => {
  const { attendanceService } = await import("../../backend/src/services/attendance.service.ts");
  const { attendanceRepository } = await import("../../backend/src/repositories/attendance.repository.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { securityService } = await import("../../backend/src/services/security.service.ts");
  const originals = {
    open: attendanceRepository.findOpen,
    close: attendanceRepository.closeOpenRecord,
    seen: userRepository.findLastSeenByIds,
    audit: securityService.recordSecurityEvent,
  };
  const now = new Date("2026-09-29T12:00:00.000Z");
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000);
  const oid = (n: number) => ({ toString: () => `64f0000000000000000000${n}` });
  const open = [
    { _id: oid(10), userId: oid(1), checkInAt: at(300) }, // last seen 150m ago -> closed at last seen
    { _id: oid(11), userId: oid(2), checkInAt: at(300) }, // last seen 30m ago -> still online
    { _id: oid(12), userId: oid(3), checkInAt: at(180) }, // never pinged -> closed at check-in time
  ];
  const lastSeen: Record<string, Date | undefined> = { [oid(1).toString()]: at(150), [oid(2).toString()]: at(30) };
  const closedAt = new Map<string, Date>();
  attendanceRepository.findOpen = (async () => open) as any;
  attendanceRepository.closeOpenRecord = (async (id: string, when: Date) => {
    closedAt.set(id, when);
    return { modifiedCount: 1 };
  }) as any;
  userRepository.findLastSeenByIds = (async () =>
    Object.entries(lastSeen).map(([id, lastSeenAt]) => ({ _id: { toString: () => id }, lastSeenAt }))) as any;
  securityService.recordSecurityEvent = (async () => undefined) as any;

  try {
    const closed = await attendanceService.autoCheckOutOfflineUsers(now);
    assert.equal(closed, 2);
    assert.equal(closedAt.get(oid(10).toString())?.getTime(), at(150).getTime());
    assert.equal(closedAt.get(oid(12).toString())?.getTime(), at(180).getTime());
    assert.equal(closedAt.has(oid(11).toString()), false);
  } finally {
    attendanceRepository.findOpen = originals.open;
    attendanceRepository.closeOpenRecord = originals.close;
    userRepository.findLastSeenByIds = originals.seen;
    securityService.recordSecurityEvent = originals.audit;
  }
});
