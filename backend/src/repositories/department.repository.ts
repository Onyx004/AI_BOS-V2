import type { FilterQuery, SortOrder, Types, UpdateQuery } from "mongoose";
import { DepartmentModel, type Department, type DepartmentDocument } from "../models/department.model.js";
import type { ListDepartmentsQuery } from "../validation/department.validation.js";

export type DepartmentCreateData = Omit<Department, "createdAt" | "updatedAt">;

function buildDepartmentFilter(
  organizationId: Types.ObjectId,
  query: ListDepartmentsQuery,
): FilterQuery<Department> {
  const filter: FilterQuery<Department> = { organizationId };

  if (query.search) {
    filter.name = { $regex: query.search, $options: "i" };
  }
  if (query.status) filter.status = query.status;

  return filter;
}

export class DepartmentRepository {
  async create(data: DepartmentCreateData) {
    return DepartmentModel.create(data);
  }

  async findById(id: string) {
    return DepartmentModel.findById(id).lean();
  }

  async findByName(organizationId: Types.ObjectId, name: string) {
    return DepartmentModel.findOne({ organizationId, name }).select("_id").lean();
  }

  async list(organizationId: Types.ObjectId, query: ListDepartmentsQuery) {
    const filter = buildDepartmentFilter(organizationId, query);
    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === "asc" ? 1 : -1,
    };

    const [items, total] = await Promise.all([
      DepartmentModel.find(filter).sort(sort).skip(skip).limit(query.limit).populate("headId", "fullName email role").lean(),
      DepartmentModel.countDocuments(filter),
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
    return DepartmentModel.find({ organizationId }).sort({ name: 1 }).lean();
  }

  async update(id: string, updates: UpdateQuery<DepartmentDocument>) {
    return DepartmentModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
  }

  async delete(id: string) {
    return DepartmentModel.findByIdAndDelete(id).select("_id").lean();
  }

  async existsAsParent(departmentId: string) {
    return DepartmentModel.exists({ parentDepartmentId: departmentId });
  }

  async detachChildren(departmentId: string) {
    return DepartmentModel.updateMany({ parentDepartmentId: departmentId }, { $unset: { parentDepartmentId: "" } });
  }

  async existsForBranch(branchId: string) {
    return DepartmentModel.exists({ branchId });
  }
}

export const departmentRepository = new DepartmentRepository();
