import type { FilterQuery, SortOrder, Types, UpdateQuery } from "mongoose";
import { TeamModel, type Team, type TeamDocument } from "../models/team.model.js";
import type { ListTeamsQuery } from "../validation/team.validation.js";

export type TeamCreateData = Omit<Team, "createdAt" | "updatedAt">;

function buildTeamFilter(organizationId: Types.ObjectId, query: ListTeamsQuery): FilterQuery<Team> {
  const filter: FilterQuery<Team> = { organizationId };

  if (query.search) {
    filter.name = { $regex: query.search, $options: "i" };
  }
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.status) filter.status = query.status;

  return filter;
}

export class TeamRepository {
  async create(data: TeamCreateData) {
    return TeamModel.create(data);
  }

  async findById(id: string) {
    return TeamModel.findById(id).lean();
  }

  async list(organizationId: Types.ObjectId, query: ListTeamsQuery) {
    const filter = buildTeamFilter(organizationId, query);
    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === "asc" ? 1 : -1,
    };

    const [items, total] = await Promise.all([
      TeamModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
      TeamModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async listAll(organizationId: Types.ObjectId) {
    return TeamModel.find({ organizationId }).sort({ name: 1 }).lean();
  }

  async listByDepartment(departmentId: string) {
    return TeamModel.find({ departmentId }).lean();
  }

  async update(id: string, updates: UpdateQuery<TeamDocument>) {
    return TeamModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
  }

  async delete(id: string) {
    return TeamModel.findByIdAndDelete(id).select("_id").lean();
  }

  async deleteByDepartment(departmentId: string) {
    const teams = await TeamModel.find({ departmentId }).select("_id name").lean();
    if (teams.length > 0) await TeamModel.deleteMany({ departmentId });
    return teams;
  }

  async existsForDepartment(departmentId: string) {
    return TeamModel.exists({ departmentId });
  }
}

export const teamRepository = new TeamRepository();
