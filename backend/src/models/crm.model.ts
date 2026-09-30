import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const customerHealthValues = ["Excellent", "Good", "At Risk"] as const;
export const dealStages = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
export const dealKinds = ["Deal", "Opportunity"] as const;
export const quoteStatuses = ["Draft", "Sent", "Accepted", "Rejected"] as const;
export const followUpStatuses = ["Open", "Done"] as const;

type CrmBase = {
  organizationId?: Types.ObjectId;
  ownerId?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const baseFields = {
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
};

const schemaOptions = { timestamps: true, versionKey: false } as const;

export type Customer = CrmBase & {
  name: string;
  currency?: string;
  company?: string;
  email?: string;
  phone?: string;
  revenue: number;
  health: (typeof customerHealthValues)[number];
  leadId?: Types.ObjectId;
};
const customerSchema = new Schema<Customer>(
  {
    ...baseFields,
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    company: { type: String, trim: true, maxlength: 180 },
    email: { type: String, trim: true, lowercase: true, maxlength: 180 },
    phone: { type: String, trim: true, maxlength: 32 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3 },
    revenue: { type: Number, min: 0, default: 0 },
    health: { type: String, enum: customerHealthValues, default: "Good" },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", index: true },
  },
  schemaOptions,
);
export const CustomerModel = model("Customer", customerSchema);
export type CustomerDocument = HydratedDocument<Customer>;

export type Company = CrmBase & {
  name: string;
  currency?: string;
  industry?: string;
  employees: number;
  revenue: number;
  website?: string;
};
const companySchema = new Schema<Company>(
  {
    ...baseFields,
    name: { type: String, required: true, trim: true, maxlength: 180, index: true },
    industry: { type: String, trim: true, maxlength: 120 },
    employees: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3 },
    revenue: { type: Number, min: 0, default: 0 },
    website: { type: String, trim: true, maxlength: 240 },
  },
  schemaOptions,
);
export const CompanyModel = model("CrmCompany", companySchema);

export type Contact = CrmBase & {
  name: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
};
const contactSchema = new Schema<Contact>(
  {
    ...baseFields,
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    role: { type: String, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 180 },
    email: { type: String, trim: true, lowercase: true, maxlength: 180 },
    phone: { type: String, trim: true, maxlength: 32 },
  },
  schemaOptions,
);
export const ContactModel = model("CrmContact", contactSchema);

export type Deal = CrmBase & {
  name: string;
  currency?: string;
  company?: string;
  kind: (typeof dealKinds)[number];
  stage: (typeof dealStages)[number];
  value: number;
  closeDate?: string;
};
const dealSchema = new Schema<Deal>(
  {
    ...baseFields,
    name: { type: String, required: true, trim: true, maxlength: 180, index: true },
    company: { type: String, trim: true, maxlength: 180 },
    kind: { type: String, enum: dealKinds, default: "Deal", index: true },
    stage: { type: String, enum: dealStages, default: "New", index: true },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3 },
    value: { type: Number, min: 0, default: 0 },
    closeDate: { type: String, trim: true, maxlength: 10 },
  },
  schemaOptions,
);
export const DealModel = model("CrmDeal", dealSchema);

export type Quote = CrmBase & {
  quoteNo: string;
  currency?: string;
  customer: string;
  amount: number;
  status: (typeof quoteStatuses)[number];
  validUntil?: string;
};
const quoteSchema = new Schema<Quote>(
  {
    ...baseFields,
    quoteNo: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    customer: { type: String, required: true, trim: true, maxlength: 180, index: true },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3 },
    amount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: quoteStatuses, default: "Draft", index: true },
    validUntil: { type: String, trim: true, maxlength: 10 },
  },
  schemaOptions,
);
export const QuoteModel = model("CrmQuote", quoteSchema);

export type FollowUp = CrmBase & {
  leadName: string;
  channel: string;
  dueDate: string;
  status: (typeof followUpStatuses)[number];
};
const followUpSchema = new Schema<FollowUp>(
  {
    ...baseFields,
    leadName: { type: String, required: true, trim: true, maxlength: 160, index: true },
    channel: { type: String, trim: true, maxlength: 60, default: "Call" },
    dueDate: { type: String, required: true, trim: true, maxlength: 10, index: true },
    status: { type: String, enum: followUpStatuses, default: "Open", index: true },
  },
  schemaOptions,
);
export const FollowUpModel = model("CrmFollowUp", followUpSchema);

export type CrmMeeting = CrmBase & {
  title: string;
  account?: string;
  date: string;
  time?: string;
};
const crmMeetingSchema = new Schema<CrmMeeting>(
  {
    ...baseFields,
    title: { type: String, required: true, trim: true, maxlength: 180, index: true },
    account: { type: String, trim: true, maxlength: 180 },
    date: { type: String, required: true, trim: true, maxlength: 10, index: true },
    time: { type: String, trim: true, maxlength: 20 },
  },
  schemaOptions,
);
export const CrmMeetingModel = model("CrmMeeting", crmMeetingSchema);
