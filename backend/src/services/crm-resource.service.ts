import type { Model } from "mongoose";
import { crmPermissionKeys } from "../constants/permissions.js";
import { roleRepository } from "../repositories/role.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { getDefaultCurrency } from "./crm-settings.service.js";
import { AppError } from "../utils/app-error.js";
import type { CrmListQuery } from "../validation/crm.validation.js";

const ownerPopulate = { path: "ownerId", select: "fullName email role" };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type CrmResourceOptions = {
  label: string;
  model: Model<any>;
  searchFields: string[];
  /** Query-string filters that map 1:1 onto a stored field (e.g. `kind`, `stage`, `status`). */
  filterFields?: readonly (keyof CrmListQuery)[];
  /** Records that carry an amount get the organization currency when none is chosen. */
  hasMoney?: boolean;
  /** Fills in server-generated fields (e.g. a quote number) just before insert. */
  prepareCreate?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

/** Plain list/create/update/delete for one CRM collection. Access is enforced by the router (per-resource permissions), not here. */
export class CrmResourceService {
  constructor(private readonly options: CrmResourceOptions) {}

  async list(query: CrmListQuery) {
    const filter: Record<string, unknown> = {};
    for (const field of this.options.filterFields ?? []) {
      if (query[field] !== undefined) filter[field] = query[field];
    }
    if (query.ownerId) filter.ownerId = query.ownerId;
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), "i");
      filter.$or = this.options.searchFields.map((field) => ({ [field]: pattern }));
    }
    return this.options.model.find(filter).sort({ createdAt: -1 }).limit(query.limit).populate(ownerPopulate).lean();
  }

  async getById(id: string) {
    const record = await this.options.model.findById(id).populate(ownerPopulate).lean();
    if (!record) throw new AppError(`${this.options.label} not found`, 404);
    return record;
  }

  async create(input: Record<string, unknown>, userId?: string) {
    const actor = userId ? await userRepository.findById(userId) : null;
    let data: Record<string, unknown> = {
      ...input,
      ownerId: input.ownerId ?? userId,
      createdBy: userId,
      organizationId: actor?.organizationId,
    };
    if (this.options.hasMoney && !data.currency) data.currency = await getDefaultCurrency();
    if (this.options.prepareCreate) data = await this.options.prepareCreate(data);
    const created = await this.options.model.create(data);
    return this.getById(created._id.toString());
  }

  async update(id: string, input: Record<string, unknown>) {
    const record = await this.options.model
      .findByIdAndUpdate(id, input, { new: true, runValidators: true })
      .populate(ownerPopulate)
      .lean();
    if (!record) throw new AppError(`${this.options.label} not found`, 404);
    return record;
  }

  async delete(id: string) {
    const record = await this.options.model.findByIdAndDelete(id).select("_id").lean();
    if (!record) throw new AppError(`${this.options.label} not found`, 404);
    return { deleted: true };
  }
}

/** Users who can be picked as a CRM owner: full-access roles plus any role holding a CRM permission. */
export async function listCrmOwners() {
  const roles = await roleRepository.listAll();
  const eligibleSlugs = new Set(["owner", "administrator"]);
  for (const role of roles) {
    if (!role.isActive) continue;
    if (role.hasFullAccess || role.permissionKeys.some((key) => crmPermissionKeys.includes(key))) eligibleSlugs.add(role.slug);
  }
  const users = await userRepository.findActiveByRoleSlugs([...eligibleSlugs]);
  return users.map((user) => ({ id: user._id.toString(), fullName: user.fullName, role: user.role }));
}
