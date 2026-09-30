import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();
const root = path.resolve(import.meta.dirname, "../..");

test("attendance schema persists methods but no raw face image fields", () => {
  const modelSource = fs.readFileSync(path.join(root, "backend/src/models/attendance.model.ts"), "utf8");
  const serviceSource = fs.readFileSync(path.join(root, "backend/src/services/attendance.service.ts"), "utf8");
  const migrations = fs.readFileSync(path.join(root, "backend/src/database/runtime-migrations.ts"), "utf8");
  assert.match(modelSource, /checkInMethod/);
  assert.doesNotMatch(modelSource, /checkInFaceImage\??:/);
  assert.doesNotMatch(serviceSource, /faceImage|data:image/);
  assert.match(serviceSource, /checkInFaceVerified: false/);
  assert.match(serviceSource, /manual_attendance_recorded/);
  assert.match(migrations, /\$unset: \{ checkInFaceImage: "", checkOutFaceImage: "" \}/);
});

test("one-time challenge binds liveness to authenticated user and attendance action", async () => {
  const { faceVerificationChallengeService } = await import("../../backend/src/services/face-verification-challenge.service.ts");
  const { faceVerificationChallengeRepository } = await import("../../backend/src/repositories/face-verification-challenge.repository.ts");
  const { faceEnrollmentRepository } = await import("../../backend/src/repositories/face-enrollment.repository.ts");
  const originalEnrollment = faceEnrollmentRepository.findActiveByUser;
  const originalIssue = faceVerificationChallengeRepository.issue;
  const originalConsume = faceVerificationChallengeRepository.consume;
  try {
    faceEnrollmentRepository.findActiveByUser = async () => ({ status: "active" }) as never;
    faceVerificationChallengeRepository.issue = async (input) => ({ id: "64f000000000000000000001", expiresAt: input.expiresAt, challenge: input.challenge }) as never;
    faceVerificationChallengeRepository.consume = async (_id, userId, action) =>
      userId === "64f000000000000000000010" && action === "check-in"
        ? ({ _id: "64f000000000000000000001", challenge: "blink" }) as never
        : null;
    const issued = await faceVerificationChallengeService.issue("64f000000000000000000010", "check-in");
    assert.equal(["blink", "turn_left", "turn_right"].includes(issued.challenge), true);
    const evidence = {
      challenge: "blink" as const,
      neutralObserved: true as const,
      challengeObserved: true as const,
      returnedToCenter: true as const,
      durationMs: 1500,
      framesEvaluated: 8,
      faceScoreMin: 0.9,
      antispoofScoreMin: 0.9,
      passiveLivenessScoreMin: 0.9,
    };
    await faceVerificationChallengeService.consume("64f000000000000000000010", "check-in", issued.challengeId, evidence);
    await assert.rejects(
      () => faceVerificationChallengeService.consume("64f000000000000000000099", "check-in", issued.challengeId, evidence),
      /expired or was already used/,
    );
  } finally {
    faceEnrollmentRepository.findActiveByUser = originalEnrollment;
    faceVerificationChallengeRepository.issue = originalIssue;
    faceVerificationChallengeRepository.consume = originalConsume;
  }
});

test("administrative biometric endpoints deny Manager and allow Owner or Administrator role gate", async () => {
  const { requireRole } = await import("../../backend/src/middleware/rbac.middleware.ts");
  const gate = requireRole("Owner", "Administrator");
  const run = (role: string) => new Promise<unknown>((resolve) => gate({ user: { id: "u", role } } as never, {} as never, resolve as never));
  const managerResult = await run("Manager") as { statusCode?: number };
  const ownerResult = await run("Owner");
  assert.equal(managerResult.statusCode, 403);
  assert.equal(ownerResult, undefined);
  const routes = fs.readFileSync(path.join(root, "backend/src/routes/face-enrollment.routes.ts"), "utf8");
  assert.match(routes, /requireRole\("Owner", "Administrator"\)/);
});

test("attendance is login-based: manual and daily-task marking are gone, presence heartbeat is authenticated", () => {
  const routes = fs.readFileSync(path.join(root, "backend/src/routes/attendance.routes.ts"), "utf8");
  assert.match(routes, /attendanceRoutes\.use\(authenticate\)/);
  assert.doesNotMatch(routes, /\/manual\/check-(in|out)/);
  assert.doesNotMatch(routes, /\/daily-task\/check-(in|out)/);
  assert.match(routes, /\/heartbeat/);
});

test("successful 1:1 verification records server attendance and duplicate punches are rejected", async () => {
  const { attendanceService } = await import("../../backend/src/services/attendance.service.ts");
  const { attendanceRepository } = await import("../../backend/src/repositories/attendance.repository.ts");
  const { organizationRepository } = await import("../../backend/src/repositories/organization.repository.ts");
  const { organizationSettingsRepository } = await import("../../backend/src/repositories/organization-settings.repository.ts");
  const { faceEnrollmentService } = await import("../../backend/src/services/face-enrollment.service.ts");
  const { securityService } = await import("../../backend/src/services/security.service.ts");
  const originals = {
    find: attendanceRepository.findByUserAndDate,
    create: attendanceRepository.create,
    organization: organizationRepository.getOrCreateDefault,
    settings: organizationSettingsRepository.getOrCreateDefault,
    verify: faceEnrollmentService.verifyAttendance,
    audit: securityService.recordSecurityEvent,
  };
  let created: Record<string, unknown> | null = null;
  try {
    attendanceRepository.findByUserAndDate = async () => null;
    attendanceRepository.create = async (input) => { created = input as unknown as Record<string, unknown>; return input as never; };
    organizationRepository.getOrCreateDefault = async () => ({ _id: "64f000000000000000000020" }) as never;
    organizationSettingsRepository.getOrCreateDefault = async () => ({
      workspacePreferences: { officeLocation: { name: "Office", latitude: 12, longitude: 77, radiusMeters: 300 }, allowRemoteCheckIn: true, enforceGeoFence: false },
    }) as never;
    faceEnrollmentService.verifyAttendance = async () => ({
      faceVerified: true, livenessPassed: true,
      faceEnrollmentId: "64f000000000000000000021",
      verificationChallengeId: "64f000000000000000000022",
      verificationModelVersion: "human-3.3.6-faceres-v1",
    });
    securityService.recordSecurityEvent = async () => undefined;
    const verification = {
      challengeId: "64f000000000000000000022",
      embedding: Array.from({ length: 256 }, () => 0.01),
      evidence: {
        challenge: "blink" as const, neutralObserved: true as const, challengeObserved: true as const,
        returnedToCenter: true as const, durationMs: 1200, framesEvaluated: 6,
        faceScoreMin: 0.9, antispoofScoreMin: 0.9, passiveLivenessScoreMin: 0.9,
      },
    };
    await attendanceService.checkIn("64f000000000000000000010", { latitude: 12, longitude: 77, verification });
    assert.equal(created?.checkInMethod, "face");
    assert.equal(created?.checkInFaceVerified, true);
    assert.equal(created?.checkInAt instanceof Date, true);

    attendanceRepository.findByUserAndDate = async () => ({ checkInAt: new Date() }) as never;
    await assert.rejects(
      () => attendanceService.checkIn("64f000000000000000000010", { latitude: 12, longitude: 77, verification }),
      /already checked in/,
    );
  } finally {
    attendanceRepository.findByUserAndDate = originals.find;
    attendanceRepository.create = originals.create;
    organizationRepository.getOrCreateDefault = originals.organization;
    organizationSettingsRepository.getOrCreateDefault = originals.settings;
    faceEnrollmentService.verifyAttendance = originals.verify;
    securityService.recordSecurityEvent = originals.audit;
  }
});

test("biometric templates and raw images are absent from API and audit metadata", () => {
  const enrollmentService = fs.readFileSync(path.join(root, "backend/src/services/face-enrollment.service.ts"), "utf8");
  const adminPage = fs.readFileSync(path.join(root, "admin/src/admin/features/attendance/AttendancePage.tsx"), "utf8");
  assert.doesNotMatch(enrollmentService.match(/metadata:\s*\{[^}]+\}/gs)?.join("\n") ?? "", /templateEncrypted|embedding|data:image/);
  assert.doesNotMatch(adminPage, /templateEncrypted|templateHash|faceImage/);
});
