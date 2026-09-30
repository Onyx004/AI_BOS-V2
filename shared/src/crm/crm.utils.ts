import type { Lead, LeadStage } from "./crm.types";

let fallbackCurrency = "INR";

/** Currency shown for records saved before currencies existed; set from the organization settings once loaded. */
export function setFallbackCurrency(currency: string) {
  fallbackCurrency = currency;
}

export function formatMoney(value: number, currency?: string) {
  const code = currency || fallbackCurrency;
  return new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-US", {
    currency: code,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export type MoneyTotals = Record<string, number>;

export function addMoney(totals: MoneyTotals, amount: number, currency?: string) {
  const code = currency || fallbackCurrency;
  totals[code] = (totals[code] ?? 0) + amount;
}

/** Amounts in different currencies are never added together, so a total is one figure per currency. */
export function formatMoneyTotals(totals: MoneyTotals) {
  const entries = Object.entries(totals).filter(([, amount]) => amount !== 0);
  if (entries.length === 0) return formatMoney(0);
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

export function getCrmStats(leads: Lead[], customerRevenue: MoneyTotals, customerCount: number) {
  const wonLeads = leads.filter((lead) => lead.stage === "Won").length;
  const revenue: MoneyTotals = { ...customerRevenue };
  for (const lead of leads) {
    if (lead.stage !== "Lost") addMoney(revenue, lead.value, lead.currency);
  }
  const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;

  return {
    customers: customerCount,
    leads: leads.length,
    revenue,
    conversionRate,
  };
}

export function stageClass(stage: LeadStage) {
  const classes: Record<LeadStage, string> = {
    New: "bg-muted text-muted-foreground",
    Contacted: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    Qualified: "bg-primary/10 text-primary",
    Proposal: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    Negotiation: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    Won: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    Lost: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  };

  return classes[stage];
}
