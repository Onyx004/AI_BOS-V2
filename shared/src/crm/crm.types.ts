export type LeadStage = "New" | "Contacted" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
export type CrmModule =
  | "leads"
  | "customers"
  | "companies"
  | "contacts"
  | "deals"
  | "opportunities"
  | "quotes"
  | "followUps"
  | "meetings";

export type CrmAttachment = {
  name: string;
  type: string;
  size: string;
};

export type CrmActivity = {
  id: string;
  title: string;
  detail: string;
  time: string;
};

export type Lead = {
  id: string;
  leadCode: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  stage: LeadStage;
  value: number;
  currency: string;
  ownerId: string;
  salesperson: string;
  notes: string[];
  attachments: CrmAttachment[];
  activityTimeline: CrmActivity[];
  createdAt: string;
  nextFollowUp: string;
};

export type LeadFormInput = Pick<
  Lead,
  "name" | "company" | "email" | "phone" | "source" | "stage" | "value" | "currency" | "ownerId" | "nextFollowUp"
> & {
  notes: string[];
  attachments: CrmAttachment[];
};

export type CrmSettings = {
  defaultCurrency: string;
  currencies: string[];
};

export type CrmOwner = {
  id: string;
  fullName: string;
  role: string;
};

/** A row from any non-lead CRM collection, with the owner already flattened for display. */
export type CrmRecord = Record<string, unknown> & {
  id: string;
  ownerId: string;
  ownerName: string;
};

export type CrmFieldType = "text" | "email" | "number" | "date" | "select" | "currency";

export type CrmFieldConfig = {
  name: string;
  label: string;
  type: CrmFieldType;
  required?: boolean;
  options?: readonly string[];
  defaultValue?: string | number;
};

export type CrmResourceConfig = {
  module: Exclude<CrmModule, "leads">;
  /** API path under `/crm`. */
  path: string;
  /** Permission prefix: `<prefix>.view | create | update | delete`. */
  permissionPrefix: string;
  title: string;
  singular: string;
  fields: CrmFieldConfig[];
  columns: { label: string; render: (record: CrmRecord) => string }[];
  /** Sent on create and used as a list filter (e.g. Deals vs Opportunities share one collection). */
  scope?: Record<string, string>;
};
