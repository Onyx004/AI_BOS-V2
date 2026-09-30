import type { FilterQuery, Types, UpdateQuery } from "mongoose";
import { MeetingModel, type Meeting, type MeetingDocument, type MeetingSource } from "../models/meeting.model.js";

export type MeetingCreateData = Pick<Meeting, "title" | "startTime" | "organizerName"> &
  Partial<Pick<Meeting, "organizationId" | "organizerId" | "endTime" | "status" | "link" | "source" | "externalId" | "createdBy">>;

export class MeetingRepository {
  async create(data: MeetingCreateData) {
    return MeetingModel.create(data);
  }

  async findById(id: string) {
    return MeetingModel.findById(id).lean();
  }

  async list(query: { organizationId?: string; status?: Meeting["status"]; search?: string; limit?: number }) {
    const filter: FilterQuery<Meeting> = {};
    if (query.organizationId) filter.organizationId = query.organizationId;
    if (query.status) filter.status = query.status;
    if (query.search) filter.title = { $regex: query.search, $options: "i" };

    return MeetingModel.find(filter)
      .sort({ startTime: -1 })
      .limit(query.limit ?? 100)
      .lean();
  }

  async update(id: string, updates: UpdateQuery<MeetingDocument>) {
    return MeetingModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
  }

  async delete(id: string) {
    return MeetingModel.findByIdAndDelete(id).select("_id").lean();
  }

  async upsertSynced(
    organizationId: Types.ObjectId,
    source: MeetingSource,
    externalId: string,
    data: Omit<MeetingCreateData, "source" | "externalId" | "organizationId">,
  ) {
    return MeetingModel.findOneAndUpdate(
      { organizationId, source, externalId },
      { $set: { ...data, organizationId, source, externalId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }
}

export const meetingRepository = new MeetingRepository();
