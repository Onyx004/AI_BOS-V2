import { formatMoney } from "./crm.utils";
import type { CrmRecord, CrmResourceConfig, LeadStage } from "./crm.types";

export const leadStages: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
export const leadSources = ["Website", "Referral", "LinkedIn", "Event", "Partner", "Outbound"];

const text = (record: CrmRecord, key: string) => {
  const value = record[key];
  return typeof value === "string" && value ? value : "-";
};
const money = (record: CrmRecord, key: string) =>
  formatMoney(Number(record[key] ?? 0), typeof record.currency === "string" ? record.currency : undefined);

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const crmResources: CrmResourceConfig[] = [
  {
    module: "customers",
    path: "customers",
    permissionPrefix: "customer",
    title: "Customers",
    singular: "Customer",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "currency", label: "Currency", type: "currency" },
      { name: "revenue", label: "Revenue", type: "number", defaultValue: 0 },
      { name: "health", label: "Health", type: "select", options: ["Excellent", "Good", "At Risk"], defaultValue: "Good" },
    ],
    columns: [
      { label: "Name", render: (r) => text(r, "name") },
      { label: "Company", render: (r) => text(r, "company") },
      { label: "Revenue", render: (r) => money(r, "revenue") },
      { label: "Health", render: (r) => text(r, "health") },
    ],
  },
  {
    module: "companies",
    path: "companies",
    permissionPrefix: "company",
    title: "Companies",
    singular: "Company",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "industry", label: "Industry", type: "text" },
      { name: "employees", label: "Employees", type: "number", defaultValue: 0 },
      { name: "currency", label: "Currency", type: "currency" },
      { name: "revenue", label: "Revenue", type: "number", defaultValue: 0 },
      { name: "website", label: "Website", type: "text" },
    ],
    columns: [
      { label: "Name", render: (r) => text(r, "name") },
      { label: "Industry", render: (r) => text(r, "industry") },
      { label: "Employees", render: (r) => String(r.employees ?? 0) },
      { label: "Revenue", render: (r) => money(r, "revenue") },
    ],
  },
  {
    module: "contacts",
    path: "contacts",
    permissionPrefix: "contact",
    title: "Contacts",
    singular: "Contact",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "role", label: "Role", type: "text" },
      { name: "company", label: "Company", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "text" },
    ],
    columns: [
      { label: "Name", render: (r) => text(r, "name") },
      { label: "Role", render: (r) => text(r, "role") },
      { label: "Company", render: (r) => text(r, "company") },
      { label: "Email", render: (r) => text(r, "email") },
    ],
  },
  {
    module: "deals",
    path: "deals",
    permissionPrefix: "deal",
    title: "Deals",
    singular: "Deal",
    scope: { kind: "Deal" },
    fields: [
      { name: "name", label: "Deal name", type: "text", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "stage", label: "Stage", type: "select", options: leadStages, defaultValue: "New" },
      { name: "currency", label: "Currency", type: "currency" },
      { name: "value", label: "Value", type: "number", defaultValue: 0 },
      { name: "closeDate", label: "Expected close", type: "date", defaultValue: inDays(30) },
    ],
    columns: [
      { label: "Deal", render: (r) => text(r, "name") },
      { label: "Company", render: (r) => text(r, "company") },
      { label: "Stage", render: (r) => text(r, "stage") },
      { label: "Value", render: (r) => `${money(r, "value")} closes ${text(r, "closeDate")}` },
    ],
  },
  {
    module: "opportunities",
    path: "deals",
    permissionPrefix: "deal",
    title: "Opportunities",
    singular: "Opportunity",
    scope: { kind: "Opportunity" },
    fields: [
      { name: "name", label: "Opportunity name", type: "text", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "stage", label: "Stage", type: "select", options: leadStages, defaultValue: "New" },
      { name: "currency", label: "Currency", type: "currency" },
      { name: "value", label: "Value", type: "number", defaultValue: 0 },
      { name: "closeDate", label: "Expected close", type: "date", defaultValue: inDays(30) },
    ],
    columns: [
      { label: "Opportunity", render: (r) => text(r, "name") },
      { label: "Company", render: (r) => text(r, "company") },
      { label: "Stage", render: (r) => text(r, "stage") },
      { label: "Value", render: (r) => money(r, "value") },
    ],
  },
  {
    module: "quotes",
    path: "quotes",
    permissionPrefix: "quote",
    title: "Quotes",
    singular: "Quote",
    fields: [
      { name: "customer", label: "Customer", type: "text", required: true },
      { name: "currency", label: "Currency", type: "currency" },
      { name: "amount", label: "Amount", type: "number", defaultValue: 0 },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Accepted", "Rejected"], defaultValue: "Draft" },
      { name: "validUntil", label: "Valid until", type: "date", defaultValue: inDays(14) },
    ],
    columns: [
      { label: "Quote", render: (r) => text(r, "quoteNo") },
      { label: "Customer", render: (r) => text(r, "customer") },
      { label: "Status", render: (r) => text(r, "status") },
      { label: "Amount", render: (r) => `${money(r, "amount")} until ${text(r, "validUntil")}` },
    ],
  },
  {
    module: "followUps",
    path: "follow-ups",
    permissionPrefix: "followup",
    title: "Follow Ups",
    singular: "Follow-up",
    fields: [
      { name: "leadName", label: "Lead / customer", type: "text", required: true },
      { name: "channel", label: "Channel", type: "select", options: ["Call", "Email", "Demo", "WhatsApp", "Visit"], defaultValue: "Call" },
      { name: "dueDate", label: "Due date", type: "date", required: true, defaultValue: inDays(1) },
      { name: "status", label: "Status", type: "select", options: ["Open", "Done"], defaultValue: "Open" },
    ],
    columns: [
      { label: "Lead", render: (r) => text(r, "leadName") },
      { label: "Channel", render: (r) => text(r, "channel") },
      { label: "Due", render: (r) => text(r, "dueDate") },
      {
        label: "Status",
        render: (r) => (r.status === "Open" && typeof r.dueDate === "string" && r.dueDate < today() ? "Overdue" : text(r, "status")),
      },
    ],
  },
  {
    module: "meetings",
    path: "meetings",
    permissionPrefix: "crm_meeting",
    title: "Meetings",
    singular: "Meeting",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "account", label: "Account", type: "text" },
      { name: "date", label: "Date", type: "date", required: true, defaultValue: inDays(1) },
      { name: "time", label: "Time", type: "text", defaultValue: "11:00 AM" },
    ],
    columns: [
      { label: "Meeting", render: (r) => text(r, "title") },
      { label: "Account", render: (r) => text(r, "account") },
      { label: "Date", render: (r) => text(r, "date") },
      { label: "Time", render: (r) => text(r, "time") },
    ],
  },
];
