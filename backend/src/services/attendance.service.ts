import { Types } from "mongoose";
import { env } from "../config/env.js";
import type { AttendanceLocation } from "../models/attendance.model.js";
import { attendanceRepository } from "../repositories/attendance.repository.js";
import { faceEnrollmentRepository } from "../repositories/face-enrollment.repository.js";
import { organizationRepository } from "../repositories/organization.repository.js";
import { organizationSettingsRepository } from "../repositories/organization-settings.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/app-error.js";
import { hashValue } from "../utils/crypto.js";
import type {
  AttendanceAdminOverviewQuery,
  AttendanceLocationInput,
  AttendanceMarkInput,
  AttendanceSummaryQuery,
} from "../validation/attendance.validation.js";
import { faceEnrollmentService } from "./face-enrollment.service.js";
import { securityService } from "./security.service.js";

const indiaTimezone = "Asia/Kolkata";
const offlineCheckOutAfterMs = 2 * 60 * 60 * 1000;
const attendanceExemptRoles = new Set(["Owner", "Administrator"]);
type RequestMeta = { ip?: string; userAgent?: string; deviceId?: string };

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: indiaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(from: AttendanceLocationInput, to: { latitude: number; longitude: number }) {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

type AttendanceOfficeConfig = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  allowRemoteCheckIn: boolean;
  enforceGeoFence: boolean;
};

function fallbackOfficeLocation(): AttendanceOfficeConfig {
  return {
    name: "Main Office",
    latitude: env.ATTENDANCE_OFFICE_LAT,
    longitude: env.ATTENDANCE_OFFICE_LNG,
    radiusMeters: env.ATTENDANCE_RADIUS_METERS,
    allowRemoteCheckIn: false,
    enforceGeoFence: true,
  };
}

async function officeLocation(): Promise<AttendanceOfficeConfig> {
  const organization = await organizationRepository.getOrCreateDefault();
  const settings = await organizationSettingsRepository.getOrCreateDefault(organization._id);
  const location = settings.workspacePreferences.officeLocation;
  const fallback = fallbackOfficeLocation();
  return {
    name: location?.name ?? fallback.name,
    latitude: location?.latitude ?? fallback.latitude,
    longitude: location?.longitude ?? fallback.longitude,
    radiusMeters: location?.radiusMeters ?? fallback.radiusMeters,
    allowRemoteCheckIn: settings.workspacePreferences.allowRemoteCheckIn,
    enforceGeoFence: settings.workspacePreferences.enforceGeoFence !== false,
  };
}

async function verifiedLocation(input: AttendanceLocationInput): Promise<AttendanceLocation> {
  const office = await officeLocation();
  const distanceMeters = Math.round(calculateDistanceMeters(input, office));
  if ((office.enforceGeoFence || !office.allowRemoteCheckIn) && distanceMeters > office.radiusMeters) {
    throw new AppError(`You are ${distanceMeters}m away from office. Attendance is allowed within ${office.radiusMeters}m only.`, 400);
  }
  return { latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy, distanceMeters };
}

function requireUserId(userId?: string) {
  if (!userId) throw new AppError("Authentication required", 401);
  return userId;
}

function deviceHash(meta?: RequestMeta) {
  return meta?.deviceId ? hashValue(meta.deviceId) : undefined;
}

export class AttendanceService {
  async summary(query: AttendanceSummaryQuery) {
    return attendanceRepository.findByDate(query.date ?? todayKey());
  }

  async adminOverview(query: AttendanceAdminOverviewQuery) {
    const records = await attendanceRepository.findAdminOverview(query.date ?? todayKey());
    const userIds = records.map((record) => {
      const user = record.userId as unknown as { _id?: Types.ObjectId };
      return user?._id?.toString();
    }).filter((value): value is string => Boolean(value));
    const enrollments = await faceEnrollmentRepository.findLatestStatusesByUsers(userIds);
    const enrollmentByUser = new Map<string, string>();
    for (const enrollment of enrollments) {
      const key = enrollment.userId.toString();
      if (!enrollmentByUser.has(key)) enrollmentByUser.set(key, enrollment.status);
    }
    const normalized = records.map((record) => {
      const user = record.userId as unknown as { _id?: Types.ObjectId; fullName?: string; email?: string; role?: string; employeeProfile?: { employeeCode?: string } };
      const userId = user?._id?.toString() ?? String(record.userId);
      return {
        id: record._id.toString(),
        date: record.date,
        status: record.status,
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
        checkInMethod: record.checkInMethod ?? (record.checkInFaceVerified ? "face" : "manual"),
        checkOutMethod: record.checkOutMethod,
        checkInFaceVerified: Boolean(record.checkInFaceVerified),
        checkOutFaceVerified: Boolean(record.checkOutFaceVerified),
        checkInManualReason: record.checkInManualReason,
        checkOutManualReason: record.checkOutManualReason,
        employee: {
          id: userId,
          fullName: user?.fullName ?? "Unknown employee",
          email: user?.email ?? "",
          role: user?.role ?? "",
          employeeCode: user?.employeeProfile?.employeeCode,
        },
        enrollmentStatus: enrollmentByUser.get(userId) ?? "not_enrolled",
      };
    });
    const search = query.search?.toLowerCase();
    const filtered = normalized.filter((record) => {
      if (query.status && record.status !== query.status) return false;
      if (query.method && record.checkInMethod !== query.method && record.checkOutMethod !== query.method) return false;
      if (search && !`${record.employee.fullName} ${record.employee.email} ${record.employee.employeeCode ?? ""}`.toLowerCase().includes(search)) return false;
      return true;
    });
    const start = (query.page - 1) * query.limit;
    return { records: filtered.slice(start, start + query.limit), total: filtered.length, page: query.page, limit: query.limit, date: query.date ?? todayKey() };
  }

  async checkIn(userId: string | undefined, input: AttendanceMarkInput, meta?: RequestMeta) {
    const currentUserId = requireUserId(userId);
    const date = todayKey();
    if (await attendanceRepository.findByUserAndDate(currentUserId, date)) {
      throw new AppError("Attendance is already checked in for today.", 409);
    }
    const location = await verifiedLocation(input);
    const verification = await faceEnrollmentService.verifyAttendance(currentUserId, "check-in", input.verification, meta);
    const record = await attendanceRepository.create({
      userId: new Types.ObjectId(currentUserId),
      date,
      status: "Present",
      checkInAt: new Date(),
      checkInMethod: "face",
      checkInFaceVerified: true,
      checkInLivenessPassed: true,
      checkInFaceEnrollmentId: new Types.ObjectId(verification.faceEnrollmentId),
      checkInVerificationChallengeId: new Types.ObjectId(verification.verificationChallengeId),
      checkInVerificationModelVersion: verification.verificationModelVersion,
      checkInDeviceIdHash: deviceHash(meta),
      checkInLocation: location,
    });
    await this.auditAttendance(currentUserId, "check-in", "face", meta);
    return record;
  }

  async checkOut(userId: string | undefined, input: AttendanceMarkInput, meta?: RequestMeta) {
    const currentUserId = requireUserId(userId);
    const date = todayKey();
    const existing = await attendanceRepository.findByUserAndDate(currentUserId, date);
    if (!existing) throw new AppError("Please check in before checking out.", 400);
    if (existing.checkOutAt) throw new AppError("Attendance is already checked out for today.", 409);
    const location = await verifiedLocation(input);
    const verification = await faceEnrollmentService.verifyAttendance(currentUserId, "check-out", input.verification, meta);
    const record = await attendanceRepository.updateByUserAndDate(currentUserId, date, {
      status: "Checked Out",
      checkOutAt: new Date(),
      checkOutMethod: "face",
      checkOutFaceVerified: true,
      checkOutLivenessPassed: true,
      checkOutFaceEnrollmentId: new Types.ObjectId(verification.faceEnrollmentId),
      checkOutVerificationChallengeId: new Types.ObjectId(verification.verificationChallengeId),
      checkOutVerificationModelVersion: verification.verificationModelVersion,
      checkOutDeviceIdHash: deviceHash(meta),
      checkOutLocation: location,
    });
    await this.auditAttendance(currentUserId, "check-out", "face", meta);
    return record;
  }

  /** First login of the day is the check-in. A record auto-closed for being offline is reopened when the user comes back the same day. */
  async recordLoginCheckIn(userId: string, role: string, meta?: RequestMeta) {
    if (attendanceExemptRoles.has(role)) return null;
    const date = todayKey();
    const existing = await attendanceRepository.findByUserAndDate(userId, date);
    if (existing) {
      if (existing.checkOutMethod === "auto_offline") await attendanceRepository.reopenAutoClosed(userId, date);
      return existing;
    }
    const record = await attendanceRepository.create({
      userId: new Types.ObjectId(userId),
      date,
      status: "Present",
      checkInAt: new Date(),
      checkInMethod: "login",
      checkInFaceVerified: false,
      checkInLivenessPassed: false,
      checkInDeviceIdHash: deviceHash(meta),
    });
    await this.auditAttendance(userId, "check-in", "login", meta);
    return record;
  }

  async heartbeat(userId: string | undefined) {
    await userRepository.touchLastSeen(requireUserId(userId));
    return { ok: true };
  }

  /** Closes open records of users whose last heartbeat is older than the offline limit; the check-out time is when they went offline. */
  async autoCheckOutOfflineUsers(now = new Date()) {
    const open = await attendanceRepository.findOpen();
    if (open.length === 0) return 0;
    const users = await userRepository.findLastSeenByIds([...new Set(open.map((record) => record.userId.toString()))]);
    const lastSeenByUser = new Map(users.map((user) => [user._id.toString(), user.lastSeenAt]));
    let closed = 0;
    for (const record of open) {
      const lastSeen = lastSeenByUser.get(record.userId.toString());
      const offlineSince = lastSeen && lastSeen > record.checkInAt ? lastSeen : record.checkInAt;
      if (now.getTime() - offlineSince.getTime() < offlineCheckOutAfterMs) continue;
      const result = await attendanceRepository.closeOpenRecord(record._id.toString(), offlineSince);
      if (result.modifiedCount > 0) {
        closed += 1;
        await this.auditAttendance(record.userId.toString(), "check-out", "auto_offline");
      }
    }
    return closed;
  }

  private async auditAttendance(userId: string, action: string, method: "face" | "manual" | "login" | "auto_offline", meta?: RequestMeta, reason?: string) {
    const eventType = method === "face" ? "face_attendance_recorded" : method === "manual" ? "manual_attendance_recorded" : "daily_task_attendance_recorded";
    const label = method === "face" ? "Face-verified" : method === "manual" ? "Manual" : method === "login" ? "Login-based" : "Offline auto";
    await securityService.recordSecurityEvent({
      userId,
      eventType,
      severity: method === "face" ? "low" : "medium",
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      description: `${label} attendance ${action} recorded`,
      metadata: { action, verificationMethod: method, faceVerified: method === "face", reason, deviceIdentifierPresent: Boolean(meta?.deviceId) },
    });
  }
}

export const attendanceService = new AttendanceService();
