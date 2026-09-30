import { z } from "zod";
import { faceEmbeddingSchema } from "./face-enrollment.validation.js";

export const attendanceLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).optional(),
});

export const attendanceActionSchema = z.enum(["check-in", "check-out"]);
export const faceLivenessChallengeSchema = z.enum(["blink", "turn_left", "turn_right"]);

export const faceLivenessEvidenceSchema = z.object({
  challenge: faceLivenessChallengeSchema,
  neutralObserved: z.literal(true),
  challengeObserved: z.literal(true),
  returnedToCenter: z.literal(true),
  durationMs: z.number().int().min(300).max(30_000),
  framesEvaluated: z.number().int().min(3).max(180),
  faceScoreMin: z.number().min(0).max(1),
  antispoofScoreMin: z.number().min(0).max(1),
  passiveLivenessScoreMin: z.number().min(0).max(1),
});

export const faceVerificationSchema = z.object({
  challengeId: z.string().regex(/^[0-9a-f]{24}$/i, "Liveness challenge is invalid"),
  embedding: faceEmbeddingSchema,
  evidence: faceLivenessEvidenceSchema,
});

export const issueFaceChallengeSchema = z.object({ action: attendanceActionSchema });
export const attendanceMarkSchema = attendanceLocationSchema.extend({ verification: faceVerificationSchema });

export const attendanceSummaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const attendanceAdminOverviewQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["Present", "Checked Out"]).optional(),
  method: z.enum(["face", "manual", "daily_task", "login", "auto_offline"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type AttendanceLocationInput = z.infer<typeof attendanceLocationSchema>;
export type AttendanceMarkInput = z.infer<typeof attendanceMarkSchema>;
export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>;
export type AttendanceAdminOverviewQuery = z.infer<typeof attendanceAdminOverviewQuerySchema>;
export type FaceLivenessEvidence = z.infer<typeof faceLivenessEvidenceSchema>;
