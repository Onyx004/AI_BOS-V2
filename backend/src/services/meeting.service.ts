import type { Types } from "mongoose";
import { meetingRepository } from "../repositories/meeting.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/app-error.js";
import type { CreateMeetingInput, ListMeetingsQuery, UpdateMeetingInput } from "../validation/meeting.validation.js";

export class MeetingService {
  async create(input: CreateMeetingInput, userId?: string) {
    const actor = userId ? await userRepository.findById(userId) : null;

    return meetingRepository.create({
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status ?? "Scheduled",
      link: input.link,
      source: "manual",
      organizerId: userId as unknown as Types.ObjectId,
      organizerName: actor?.fullName ?? "Unknown",
      organizationId: actor?.organizationId,
      createdBy: userId as unknown as Types.ObjectId,
    });
  }

  async list(query: ListMeetingsQuery) {
    return meetingRepository.list(query);
  }

  async getById(id: string) {
    const meeting = await meetingRepository.findById(id);
    if (!meeting) {
      throw new AppError("Meeting not found", 404);
    }
    return meeting;
  }

  async update(id: string, input: UpdateMeetingInput) {
    const meeting = await meetingRepository.update(id, input);
    if (!meeting) {
      throw new AppError("Meeting not found", 404);
    }
    return meeting;
  }

  async delete(id: string) {
    const meeting = await meetingRepository.delete(id);
    if (!meeting) {
      throw new AppError("Meeting not found", 404);
    }
    return { deleted: true };
  }
}

export const meetingService = new MeetingService();
