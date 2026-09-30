import { z } from "zod";
import { leadStatuses } from "../models/lead.model.js";
import { currencyCodeSchema } from "./crm.validation.js";

export const createLeadSchema = z.object({
  name: z.string().min(1).max(160),
  company: z.string().max(180).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().max(32).optional(),
  source: z.string().max(80).default("Manual"),
  status: z.enum(leadStatuses).default("New"),
  value: z.number().min(0).default(0),
  currency: currencyCodeSchema.optional(),
  ownerId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  company: z.string().max(180).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().max(32).optional(),
  source: z.string().max(80).optional(),
  status: z.enum(leadStatuses).optional(),
  value: z.number().min(0).optional(),
  currency: currencyCodeSchema.optional(),
  ownerId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const assignLeadOwnerSchema = z.object({
  ownerId: z.string().min(1),
});

export const leadIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listLeadsQuerySchema = z.object({
  status: z.enum(leadStatuses).optional(),
  ownerId: z.string().optional(),
  organizationId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type AssignLeadOwnerInput = z.infer<typeof assignLeadOwnerSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
