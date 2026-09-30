import type { Request } from "express";
import { attendanceService } from "../services/attendance.service.js";
import { faceVerificationChallengeService } from "../services/face-verification-challenge.service.js";
import { jsonController } from "../utils/controller.js";
import type { AttendanceAdminOverviewQuery, AttendanceSummaryQuery } from "../validation/attendance.validation.js";

function requestMeta(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
    deviceId: req.header("x-device-id") ?? undefined,
  };
}

export class AttendanceController {
  summary = jsonController(200, "Attendance summary fetched successfully", ({ req }) =>
    attendanceService.summary(req.query as unknown as AttendanceSummaryQuery),
  );

  adminOverview = jsonController(200, "Attendance overview fetched successfully", ({ req }) =>
    attendanceService.adminOverview(req.query as unknown as AttendanceAdminOverviewQuery),
  );

  issueVerificationChallenge = jsonController(201, "Liveness challenge issued successfully", ({ req }) =>
    faceVerificationChallengeService.issue(req.user!.id, req.body.action, req.header("x-device-id") ?? undefined),
  );

  checkIn = jsonController(201, "Attendance checked in successfully", ({ req }) =>
    attendanceService.checkIn(req.user?.id, req.body, requestMeta(req)),
  );

  checkOut = jsonController(200, "Attendance checked out successfully", ({ req }) =>
    attendanceService.checkOut(req.user?.id, req.body, requestMeta(req)),
  );

  heartbeat = jsonController(200, "Presence recorded", ({ req }) => attendanceService.heartbeat(req.user?.id));
}

export const attendanceController = new AttendanceController();
