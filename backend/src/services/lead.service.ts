import type { Types } from "mongoose";
import { leadRepository } from "../repositories/lead.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import type { LeadStatus } from "../models/lead.model.js";
import { CustomerModel } from "../models/crm.model.js";
import { AppError } from "../utils/app-error.js";
import { getDefaultCurrency } from "./crm-settings.service.js";
import type { ListLeadsQuery, UpdateLeadInput } from "../validation/lead.validation.js";

export type CreateLeadInput = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  value?: number;
  currency?: string;
  ownerId?: string;
  metadata?: Record<string, unknown>;
};

export class LeadService {
  async create(input: CreateLeadInput, userId?: string) {
    const actor = userId ? await userRepository.findById(userId) : null;

    return leadRepository.create({
      activities: [{ title: "Lead created", detail: `${input.name} added to CRM`, at: new Date(), by: userId as unknown as Types.ObjectId }],
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      source: input.source ?? "Workflow",
      status: input.status ?? "New",
      value: input.value ?? 0,
      currency: input.currency ?? (await getDefaultCurrency()),
      ownerId: input.ownerId as unknown as Types.ObjectId,
      organizationId: actor?.organizationId,
      metadata: input.metadata ?? {},
      createdBy: userId as unknown as Types.ObjectId,
    });
  }

  async list(query: ListLeadsQuery) {
    return leadRepository.list(query);
  }

  async getById(id: string) {
    const lead = await leadRepository.findById(id);
    if (!lead) {
      throw new AppError("Lead not found", 404);
    }
    return lead;
  }

  async update(id: string, input: UpdateLeadInput, userId?: string) {
    const existing = await leadRepository.findById(id);
    if (!existing) {
      throw new AppError("Lead not found", 404);
    }
    const activity = this.describeChange(existing.status, input.status, userId);
    const lead = await leadRepository.update(id, activity ? { ...input, $push: { activities: { $each: [activity], $slice: -100 } } } : input);
    if (!lead) {
      throw new AppError("Lead not found", 404);
    }
    return lead;
  }

  /** Marks the lead Won and creates its customer record once (the lead id is stored on the customer). */
  async convertToCustomer(id: string, userId?: string) {
    const existing = await leadRepository.findById(id);
    if (!existing) {
      throw new AppError("Lead not found", 404);
    }
    const ownerId = (existing.ownerId as unknown as { _id?: Types.ObjectId } | undefined)?._id ?? userId;
    const actor = userId ? await userRepository.findById(userId) : null;
    const customer =
      (await CustomerModel.findOne({ leadId: id }).lean()) ??
      (await CustomerModel.create({
        name: existing.name,
        company: existing.company,
        email: existing.email,
        phone: existing.phone,
        revenue: existing.value,
        currency: existing.currency ?? (await getDefaultCurrency()),
        leadId: id,
        ownerId,
        createdBy: userId,
        organizationId: actor?.organizationId,
      }));
    const activity = this.describeChange(existing.status, "Won", userId) ?? {
      title: "Converted to customer",
      detail: `${existing.name} is now a customer`,
      at: new Date(),
      by: userId as unknown as Types.ObjectId,
    };
    const lead = await leadRepository.update(id, { status: "Won", $push: { activities: { $each: [activity], $slice: -100 } } });
    return { lead, customerId: String(customer._id) };
  }

  private describeChange(from: LeadStatus, to: LeadStatus | undefined, userId?: string) {
    if (!to || to === from) return null;
    return {
      title: to === "Won" ? "Lead won" : "Stage changed",
      detail: `${from} → ${to}`,
      at: new Date(),
      by: userId as unknown as Types.ObjectId,
    };
  }

  async delete(id: string) {
    const lead = await leadRepository.delete(id);
    if (!lead) {
      throw new AppError("Lead not found", 404);
    }
    return { deleted: true };
  }

  async assignOwner(leadId: string, ownerId: string) {
    const lead = await leadRepository.updateOwner(leadId, ownerId);
    if (!lead) {
      throw new AppError("Lead not found", 404);
    }
    return lead;
  }

  async stats() {
    return leadRepository.stats();
  }
}

export const leadService = new LeadService();
