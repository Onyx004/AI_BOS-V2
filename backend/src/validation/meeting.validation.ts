import { z } from "zod";
import { meetingStatuses } from "../models/meeting.model.js";

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional(),
  status: z.enum(meetingStatuses).default("Scheduled"),
  link: z.string().max(500).optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  status: z.enum(meetingStatuses).optional(),
  link: z.string().max(500).optional(),
});

export const meetingIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listMeetingsQuerySchema = z.object({
  status: z.enum(meetingStatuses).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
