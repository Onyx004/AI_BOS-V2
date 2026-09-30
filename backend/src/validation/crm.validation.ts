import { z } from "zod";
import { supportedCurrencies } from "../constants/currencies.js";
import { customerHealthValues, dealKinds, dealStages, followUpStatuses, quoteStatuses } from "../models/crm.model.js";

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalEmail = z.union([z.literal(""), z.string().trim().email().max(180)]).optional();
const money = z.number().min(0);
export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => (supportedCurrencies as readonly string[]).includes(code), "Unsupported currency");

export const crmIdParamsSchema = z.object({ id: objectId });

export const crmListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  ownerId: objectId.optional(),
  kind: z.enum(dealKinds).optional(),
  stage: z.enum(dealStages).optional(),
  status: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});
export type CrmListQuery = z.infer<typeof crmListQuerySchema>;

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  company: optionalText(180),
  email: optionalEmail,
  phone: optionalText(32),
  currency: currencyCodeSchema.optional(),
  revenue: money.default(0),
  health: z.enum(customerHealthValues).default("Good"),
  ownerId: objectId.optional(),
});

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1).max(180),
  industry: optionalText(120),
  employees: z.number().int().min(0).default(0),
  currency: currencyCodeSchema.optional(),
  revenue: money.default(0),
  website: optionalText(240),
  ownerId: objectId.optional(),
});

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  role: optionalText(120),
  company: optionalText(180),
  email: optionalEmail,
  phone: optionalText(32),
  ownerId: objectId.optional(),
});

export const dealCreateSchema = z.object({
  name: z.string().trim().min(1).max(180),
  company: optionalText(180),
  kind: z.enum(dealKinds).default("Deal"),
  stage: z.enum(dealStages).default("New"),
  currency: currencyCodeSchema.optional(),
  value: money.default(0),
  closeDate: dateKey.optional(),
  ownerId: objectId.optional(),
});

export const quoteCreateSchema = z.object({
  customer: z.string().trim().min(1).max(180),
  currency: currencyCodeSchema.optional(),
  amount: money.default(0),
  status: z.enum(quoteStatuses).default("Draft"),
  validUntil: dateKey.optional(),
  ownerId: objectId.optional(),
});

export const followUpCreateSchema = z.object({
  leadName: z.string().trim().min(1).max(160),
  channel: z.string().trim().min(1).max(60).default("Call"),
  dueDate: dateKey,
  status: z.enum(followUpStatuses).default("Open"),
  ownerId: objectId.optional(),
});

export const crmMeetingCreateSchema = z.object({
  title: z.string().trim().min(1).max(180),
  account: optionalText(180),
  date: dateKey,
  time: optionalText(20),
  ownerId: objectId.optional(),
});

export const convertLeadSchema = z.object({}).optional();
