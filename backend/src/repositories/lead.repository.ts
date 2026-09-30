import type { FilterQuery, Types, UpdateQuery } from "mongoose";
import { LeadModel, type Lead, type LeadDocument, type LeadStatus } from "../models/lead.model.js";

export type LeadCreateData = Pick<Lead, "name" | "source" | "status" | "value" | "metadata"> &
  Partial<Pick<Lead, "organizationId" | "currency" | "company" | "email" | "phone" | "ownerId" | "createdBy" | "activities">>;

const ownerPopulate = { path: "ownerId", select: "fullName email role" };

export class LeadRepository {
  async create(data: LeadCreateData) {
    return LeadModel.create(data);
  }

  async findById(id: string) {
    return LeadModel.findById(id).populate(ownerPopulate).lean();
  }

  async list(query: { organizationId?: string; status?: LeadStatus; ownerId?: string; search?: string; limit?: number }) {
    const filter: FilterQuery<Lead> = {};
    if (query.organizationId) filter.organizationId = query.organizationId;
    if (query.status) filter.status = query.status;
    if (query.ownerId) filter.ownerId = query.ownerId;
    if (query.search) filter.$text = { $search: query.search };

    return LeadModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 50)
      .populate(ownerPopulate)
      .lean();
  }

  async update(id: string, updates: UpdateQuery<LeadDocument>) {
    return LeadModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).populate(ownerPopulate).lean();
  }

  async updateOwner(id: string | Types.ObjectId, ownerId: string | Types.ObjectId) {
    return LeadModel.findByIdAndUpdate(id, { $set: { ownerId } }, { new: true, runValidators: true })
      .populate(ownerPopulate)
      .lean();
  }

  async delete(id: string) {
    return LeadModel.findByIdAndDelete(id).select("_id").lean();
  }

  async stats() {
    const [stats] = await LeadModel.aggregate<{
      total: number;
      byStatus: { status: string; count: number }[];
      totalValue: number;
      wonValue: number;
    }>([
      {
        $facet: {
          total: [{ $count: "count" }],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          totalValue: [{ $group: { _id: null, sum: { $sum: "$value" } } }],
          wonValue: [{ $match: { status: "Won" } }, { $group: { _id: null, sum: { $sum: "$value" } } }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
          byStatus: {
            $map: { input: "$byStatus", as: "s", in: { status: "$$s._id", count: "$$s.count" } },
          },
          totalValue: { $ifNull: [{ $arrayElemAt: ["$totalValue.sum", 0] }, 0] },
          wonValue: { $ifNull: [{ $arrayElemAt: ["$wonValue.sum", 0] }, 0] },
        },
      },
    ]);

    return stats ?? { total: 0, byStatus: [], totalValue: 0, wonValue: 0 };
  }
}

export const leadRepository = new LeadRepository();
