import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ContactRound,
  FileText,
  Handshake,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { usePermissions } from "@shared/auth/usePermissions";
import { cn } from "@shared/lib/utils";
import { liveSyncIntervalMs, sharedDataChangedEvent } from "@shared/realtime/data-sync";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { useConfirm } from "@shared/ui/confirm-dialog-context";
import { Dialog } from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { ThemeToggle } from "@shared/ui/ThemeToggle";
import {
  convertCrmLead,
  createCrmLead,
  deleteCrmLead,
  deleteCrmRecord,
  fetchCrmLeads,
  fetchCrmOwners,
  fetchCrmRecords,
  fetchCrmSettings,
  updateCrmLead,
  writeCrmRecord,
  type CrmResult,
} from "./crm.api";
import { crmResources, leadSources, leadStages } from "./crm.data";
import { leadFormSchema, type LeadFormValues } from "./crm.schema";
import type { CrmFieldConfig, CrmModule, CrmOwner, CrmRecord, CrmResourceConfig, CrmSettings, Lead, LeadFormInput, LeadStage } from "./crm.types";
import { addMoney, formatMoney, formatMoneyTotals, getCrmStats, setFallbackCurrency, stageClass, type MoneyTotals } from "./crm.utils";

type ModuleTab = { id: CrmModule; label: string; icon: LucideIcon; viewPermission: string };

const moduleTabs: ModuleTab[] = [
  { id: "leads", label: "Leads", icon: Target, viewPermission: "lead.view_all" },
  { id: "customers", label: "Customers", icon: UsersRound, viewPermission: "customer.view" },
  { id: "companies", label: "Companies", icon: Building2, viewPermission: "company.view" },
  { id: "contacts", label: "Contacts", icon: ContactRound, viewPermission: "contact.view" },
  { id: "deals", label: "Deals", icon: Handshake, viewPermission: "deal.view" },
  { id: "opportunities", label: "Opportunities", icon: TrendingUp, viewPermission: "deal.view" },
  { id: "quotes", label: "Quotes", icon: FileText, viewPermission: "quote.view" },
  { id: "followUps", label: "Follow Ups", icon: CalendarDays, viewPermission: "followup.view" },
  { id: "meetings", label: "Meetings", icon: BriefcaseBusiness, viewPermission: "crm_meeting.view" },
];

function emptyLeadForm(ownerId: string, currency: string): LeadFormInput {
  return {
    name: "",
    company: "",
    email: "",
    phone: "",
    source: "Website",
    stage: "New",
    value: 0,
    currency,
    ownerId,
    nextFollowUp: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    notes: [],
    attachments: [],
  };
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const selectClass = "h-11 w-full rounded-md border bg-background px-3 text-sm";

/** Reloads on mount, on the shared "data changed" event, on window focus and on the live-sync interval. */
function useLiveLoader(load: (options: { silent: boolean }) => Promise<void>) {
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) void load({ silent: true });
    };

    void load({ silent: false });
    const intervalId = window.setInterval(refresh, liveSyncIntervalMs);
    window.addEventListener("focus", refresh);
    window.addEventListener(sharedDataChangedEvent, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(sharedDataChangedEvent, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
}

function OwnerSelect({ id, onChange, owners, value }: { id?: string; onChange: (ownerId: string) => void; owners: CrmOwner[]; value: string }) {
  if (owners.length === 0) return null;
  return (
    <select className={selectClass} id={id} onChange={(event) => onChange(event.target.value)} value={value}>
      {!owners.some((owner) => owner.id === value) && <option value={value}>{value ? "Current owner" : "Me"}</option>}
      {owners.map((owner) => (
        <option key={owner.id} value={owner.id}>
          {owner.fullName} ({owner.role})
        </option>
      ))}
    </select>
  );
}

function LeadFormModal({
  currencies,
  initial,
  onClose,
  onSubmit,
  owners,
}: {
  currencies: string[];
  initial: LeadFormInput;
  onClose: () => void;
  onSubmit: (input: LeadFormInput) => void;
  owners: CrmOwner[];
}) {
  const editing = Boolean(initial.name);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: initial,
  });

  return (
    <Dialog as="form" className="max-w-4xl" onClose={onClose} onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{editing ? "Edit Lead" : "Create Lead"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Capture the opportunity, owner, notes, and next follow up.</p>
        </div>
        <Button onClick={onClose} type="button" variant="outline">
          Close
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="leadName">Lead Name</Label>
          <Input id="leadName" className={cn(errors.name && "border-destructive focus-visible:ring-destructive/20")} {...register("name")} />
          {errors.name && <p className="text-xs font-medium text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" className={cn(errors.company && "border-destructive focus-visible:ring-destructive/20")} {...register("company")} />
          {errors.company && <p className="text-xs font-medium text-destructive">{errors.company.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" className={cn(errors.email && "border-destructive focus-visible:ring-destructive/20")} {...register("email")} />
          {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>
        <div className="space-y-2">
          <Label>Source</Label>
          <select className={selectClass} {...register("source")}>
            {leadSources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Stage</Label>
          <select className={selectClass} {...register("stage")}>
            {leadStages.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </div>
        {owners.length > 0 && (
          <div className="space-y-2">
            <Label>Owner</Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => <OwnerSelect onChange={field.onChange} owners={owners} value={field.value} />}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="leadCurrency">Currency</Label>
          <select className={selectClass} id="leadCurrency" {...register("currency")}>
            {currencies.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="value">Deal Value</Label>
          <Input
            id="value"
            min={0}
            type="number"
            className={cn(errors.value && "border-destructive focus-visible:ring-destructive/20")}
            {...register("value", { valueAsNumber: true })}
          />
          {errors.value && <p className="text-xs font-medium text-destructive">{errors.value.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nextFollowUp">Next Follow Up</Label>
          <Input id="nextFollowUp" type="date" {...register("nextFollowUp")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attachments">Attachments</Label>
          <Controller
            control={control}
            name="attachments"
            render={({ field }) => (
              <Input
                id="attachments"
                placeholder="proposal.pdf, notes.docx"
                value={field.value.map((item) => item.name).join(", ")}
                onChange={(event) =>
                  field.onChange(parseList(event.target.value).map((name) => ({ name, type: "File", size: "Pending" })))
                }
              />
            )}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <Input
                id="notes"
                placeholder="Budget confirmed, wants demo"
                value={field.value.join(", ")}
                onChange={(event) => field.onChange(parseList(event.target.value))}
              />
            )}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onClose} type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">{editing ? "Save Lead" : "Create Lead"}</Button>
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function LeadCard({
  canConvert,
  canDelete,
  canUpdate,
  lead,
  onAssign,
  onConvert,
  onDelete,
  onEdit,
  onStageChange,
  owners,
}: {
  canConvert: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  lead: Lead;
  onAssign: (ownerId: string) => void;
  onConvert: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onStageChange: (stage: LeadStage) => void;
  owners: CrmOwner[];
}) {
  return (
    <Card className="bg-background hover:-translate-y-1 hover:border-primary/35 hover:shadow-glass">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">{lead.leadCode}</p>
            <h3 className="mt-1 truncate font-semibold">{lead.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{lead.company}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", stageClass(lead.stage))}>{lead.stage}</span>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{lead.email || "-"}</span>
          </p>
          <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span className="truncate">{lead.phone || "-"}</span>
          </p>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Metric label="Value" value={formatMoney(lead.value, lead.currency)} />
          <Metric label="Owner" value={lead.salesperson} />
          <Metric label="Follow Up" value={lead.nextFollowUp || "-"} />
        </div>
        {lead.notes.length > 0 && (
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground">Notes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lead.notes.map((note) => (
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground" key={note}>
                  {note}
                </span>
              ))}
            </div>
          </div>
        )}
        {canUpdate && (
          <div className="grid gap-2 sm:grid-cols-2" onClick={(event) => event.stopPropagation()}>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={lead.stage} onChange={(event) => onStageChange(event.target.value as LeadStage)}>
              {leadStages.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
            {owners.length > 0 && (
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={lead.ownerId} onChange={(event) => onAssign(event.target.value)}>
                {!owners.some((owner) => owner.id === lead.ownerId) && <option value={lead.ownerId}>{lead.salesperson}</option>}
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          {canConvert && lead.stage !== "Won" && (
            <Button onClick={onConvert} size="sm" type="button">
              <UserCheck className="h-4 w-4" />
              Convert
            </Button>
          )}
          {canUpdate && (
            <Button onClick={onEdit} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button onClick={onDelete} size="sm" type="button" variant="outline">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button size="sm" type="button" variant="outline">
            <FileText className="h-4 w-4" />
            {lead.attachments.length} Files
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityTimeline({ lead }: { lead: Lead }) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lead.activityTimeline.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
        {lead.activityTimeline.map((activity) => (
          <div className="rounded-lg border bg-background p-4" key={activity.id}>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">{activity.title}</p>
                {activity.detail && <p className="mt-1 text-sm text-muted-foreground">{activity.detail}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="glass">
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

function fieldInitial(field: CrmFieldConfig, defaultCurrency: string, record?: CrmRecord) {
  const stored = record?.[field.name];
  if (stored !== undefined && stored !== null && stored !== "") return String(stored);
  if (field.type === "currency") return defaultCurrency;
  return field.defaultValue !== undefined ? String(field.defaultValue) : "";
}

function RecordFormModal({
  config,
  onClose,
  onSaved,
  owners,
  record,
  settings,
}: {
  config: CrmResourceConfig;
  onClose: () => void;
  onSaved: (record: CrmRecord) => void;
  owners: CrmOwner[];
  record?: CrmRecord;
  settings: CrmSettings;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.fields.map((field) => [field.name, fieldInitial(field, settings.defaultCurrency, record)])),
  );
  const [ownerId, setOwnerId] = useState(record?.ownerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing = config.fields.find((field) => field.required && !values[field.name]?.trim());
    if (missing) return setError(`${missing.label} is required`);

    const payload: Record<string, unknown> = { ...config.scope };
    for (const field of config.fields) {
      const raw = values[field.name]?.trim() ?? "";
      if (field.type === "number") payload[field.name] = raw === "" ? 0 : Number(raw);
      else if (raw !== "" || (record && field.type === "text")) payload[field.name] = raw;
    }
    if (ownerId) payload.ownerId = ownerId;

    setSaving(true);
    setError(null);
    const result = await writeCrmRecord(config.path, payload, record?.id);
    setSaving(false);
    if (result.status === "ok") return onSaved(result.data);
    setError(result.status === "forbidden" ? "You do not have permission to do that." : (result.message ?? "Could not save. Please try again."));
  };

  return (
    <Dialog as="form" className="max-w-2xl" onClose={onClose} onSubmit={submit}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold">{record ? `Edit ${config.singular}` : `Add ${config.singular}`}</h2>
        <Button onClick={onClose} type="button" variant="outline">
          Close
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {config.fields.map((field) => (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={`crm-${field.name}`}>{field.label}</Label>
            {field.type === "select" || field.type === "currency" ? (
              <select
                className={selectClass}
                id={`crm-${field.name}`}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                value={values[field.name]}
              >
                {(field.type === "currency" ? settings.currencies : field.options)?.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <Input
                id={`crm-${field.name}`}
                min={field.type === "number" ? 0 : undefined}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                type={field.type === "text" ? "text" : field.type}
                value={values[field.name]}
              />
            )}
          </div>
        ))}
        {owners.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="crm-owner">Owner</Label>
            <OwnerSelect id="crm-owner" onChange={setOwnerId} owners={owners} value={ownerId} />
          </div>
        )}
      </div>
      {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onClose} type="button" variant="outline">
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? "Saving..." : record ? "Save" : "Add"}
        </Button>
      </div>
    </Dialog>
  );
}

function ResourcePanel({ config, owners, search, settings }: { config: CrmResourceConfig; owners: CrmOwner[]; search: string; settings: CrmSettings }) {
  const { hasPermission } = usePermissions();
  const { confirm } = useConfirm();
  const canCreate = hasPermission(`${config.permissionPrefix}.create`);
  const canUpdate = hasPermission(`${config.permissionPrefix}.update`);
  const canDelete = hasPermission(`${config.permissionPrefix}.delete`);
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [editing, setEditing] = useState<CrmRecord | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const sequence = useRef(0);

  const load = useCallback(
    async ({ silent }: { silent: boolean }) => {
      const requestId = ++sequence.current;
      if (!silent) setState("loading");
      const result = await fetchCrmRecords(config.path, config.scope);
      if (requestId !== sequence.current) return;
      if (result.status === "ok") {
        setRecords(result.data);
        setState("ok");
      } else {
        setState(result.status);
      }
    },
    [config.path, config.scope],
  );
  useLiveLoader(load);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => `${config.columns.map((column) => column.render(record)).join(" ")} ${record.ownerName}`.toLowerCase().includes(needle));
  }, [config.columns, records, search]);

  const remove = async (record: CrmRecord) => {
    const confirmed = await confirm({
      title: `Delete ${config.singular.toLowerCase()}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    setActionError(null);
    const result = await deleteCrmRecord(config.path, record.id);
    if (result.status === "ok") setRecords((current) => current.filter((item) => item.id !== record.id));
    else setActionError(result.status === "forbidden" ? "You do not have permission to delete this." : "Could not delete. Please try again.");
  };

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{config.title}</CardTitle>
        {canCreate && (
          <Button onClick={() => setEditing("new")} size="sm" type="button">
            <Plus className="h-4 w-4" />
            Add {config.singular}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {state === "loading" && <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">Loading {config.title.toLowerCase()}...</p>}
        {state === "forbidden" && <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">Your role does not have access to {config.title.toLowerCase()}.</p>}
        {state === "error" && <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">Could not load {config.title.toLowerCase()}. Please try again.</p>}
        {actionError && <p className="text-sm font-medium text-destructive">{actionError}</p>}
        {state === "ok" && rows.length === 0 && (
          <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">No {config.title.toLowerCase()} found.</p>
        )}
        {state === "ok" &&
          rows.map((record) => (
            <div className="grid items-center gap-2 rounded-lg border bg-background p-4 text-sm md:grid-cols-[repeat(4,minmax(0,1fr))_auto]" key={record.id}>
              {config.columns.map((column, index) => (
                <span className={cn("min-w-0 truncate", index === 0 ? "font-semibold" : "text-muted-foreground")} key={column.label} title={column.label}>
                  {column.render(record)}
                </span>
              ))}
              <span className="flex items-center gap-1 justify-self-end">
                <span className="mr-2 hidden text-xs text-muted-foreground lg:inline">{record.ownerName}</span>
                {canUpdate && (
                  <Button aria-label={`Edit ${config.singular}`} onClick={() => setEditing(record)} size="icon" type="button" variant="ghost">
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button aria-label={`Delete ${config.singular}`} onClick={() => void remove(record)} size="icon" type="button" variant="ghost">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </span>
            </div>
          ))}
      </CardContent>
      {editing && (
        <RecordFormModal
          config={config}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRecords((current) => (current.some((item) => item.id === saved.id) ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]));
            setEditing(null);
          }}
          owners={owners}
          record={editing === "new" ? undefined : editing}
          settings={settings}
        />
      )}
    </Card>
  );
}

function resultMessage(result: Exclude<CrmResult<unknown>, { status: "ok" }>) {
  return result.status === "forbidden" ? "You do not have permission to do that." : (result.message ?? "Something went wrong. Please try again.");
}

export function CrmPage() {
  const { hasPermission } = usePermissions();
  const { confirm } = useConfirm();
  const visibleTabs = moduleTabs.filter((tab) => hasPermission(tab.viewPermission));
  const [activeModule, setActiveModule] = useState<CrmModule>(visibleTabs[0]?.id ?? "leads");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customerTotals, setCustomerTotals] = useState<{ count: number; revenue: MoneyTotals }>({ count: 0, revenue: {} });
  const [owners, setOwners] = useState<CrmOwner[]>([]);
  const [settings, setSettings] = useState<CrmSettings>({ defaultCurrency: "INR", currencies: ["INR", "USD"] });
  const [leadEditor, setLeadEditor] = useState<Lead | "new" | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [leadAccess, setLeadAccess] = useState<"ok" | "forbidden" | "error">("ok");
  const [pageError, setPageError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);

  const canViewLeads = hasPermission("lead.view_all");
  const canViewCustomers = hasPermission("customer.view");
  const canCreateLead = hasPermission("lead.create");
  const canUpdateLead = hasPermission("lead.update");
  const canDeleteLead = hasPermission("lead.delete");
  const canConvertLead = canUpdateLead && hasPermission("customer.create");
  const activeResource = crmResources.find((resource) => resource.module === activeModule);
  const currentTab = visibleTabs.find((tab) => tab.id === activeModule) ?? visibleTabs[0];

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeModule)) setActiveModule(visibleTabs[0].id);
  }, [activeModule, visibleTabs]);

  useEffect(() => {
    let active = true;
    void fetchCrmOwners().then((result) => {
      if (active && result.status === "ok") setOwners(result.data);
    });
    void fetchCrmSettings().then((result) => {
      if (!active || result.status !== "ok") return;
      setFallbackCurrency(result.data.defaultCurrency);
      setSettings(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const loadLeadsAndTotals = useCallback(
    async ({ silent }: { silent: boolean }) => {
      const requestId = ++loadSequenceRef.current;
      if (!silent) setLoadingLeads(true);
      const [leadResult, customerResult] = await Promise.all([
        canViewLeads ? fetchCrmLeads() : Promise.resolve(null),
        canViewCustomers ? fetchCrmRecords("customers") : Promise.resolve(null),
      ]);
      if (requestId !== loadSequenceRef.current) return;

      if (leadResult?.status === "ok") {
        setLeads(leadResult.data);
        setSelectedLeadId((current) => current || leadResult.data[0]?.id || "");
        setLeadAccess("ok");
      } else if (leadResult) {
        setLeads([]);
        setLeadAccess(leadResult.status);
      }
      if (customerResult?.status === "ok") {
        const revenue: MoneyTotals = {};
        for (const customer of customerResult.data) {
          addMoney(revenue, Number(customer.revenue ?? 0), typeof customer.currency === "string" ? customer.currency : undefined);
        }
        setCustomerTotals({ count: customerResult.data.length, revenue });
      }
      setLoadingLeads(false);
    },
    [canViewCustomers, canViewLeads],
  );
  useLiveLoader(loadLeadsAndTotals);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0];
  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) =>
        `${lead.name} ${lead.company} ${lead.email} ${lead.source} ${lead.stage} ${lead.salesperson}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [leads, search],
  );
  const stats = getCrmStats(leads, customerTotals.revenue, customerTotals.count);

  const saveLead = async (input: LeadFormInput) => {
    const editing = leadEditor !== "new" && leadEditor !== null ? leadEditor : null;
    const result = editing ? await updateCrmLead(editing.id, input as Partial<Lead>) : await createCrmLead(input);
    if (result.status !== "ok") {
      setPageError(resultMessage(result));
      return;
    }
    setPageError(null);
    setLeads((current) => (current.some((lead) => lead.id === result.data.id) ? current.map((lead) => (lead.id === result.data.id ? result.data : lead)) : [result.data, ...current]));
    setSelectedLeadId(result.data.id);
    setLeadEditor(null);
  };

  const updateLead = async (id: string, update: Partial<Lead>) => {
    const result = await updateCrmLead(id, update);
    if (result.status !== "ok") {
      setPageError(resultMessage(result));
      return;
    }
    setPageError(null);
    setLeads((current) => current.map((lead) => (lead.id === id ? result.data : lead)));
  };

  const convertLead = async (lead: Lead) => {
    const result = await convertCrmLead(lead.id);
    if (result.status !== "ok") {
      setPageError(resultMessage(result));
      return;
    }
    setPageError(null);
    await loadLeadsAndTotals({ silent: true });
  };

  const removeLead = async (lead: Lead) => {
    const confirmed = await confirm({ title: "Delete lead?", description: `${lead.name} will be removed permanently.`, confirmLabel: "Delete", tone: "danger" });
    if (!confirmed) return;
    const result = await deleteCrmLead(lead.id);
    if (result.status !== "ok") {
      setPageError(resultMessage(result));
      return;
    }
    setPageError(null);
    setLeads((current) => current.filter((item) => item.id !== lead.id));
  };

  const statCards = [
    ...(canViewCustomers ? [{ label: "Total Customers", value: stats.customers, icon: UsersRound }] : []),
    ...(canViewLeads ? [{ label: "Leads", value: stats.leads, icon: Target }] : []),
    { label: "Revenue", value: formatMoneyTotals(stats.revenue), icon: Banknote },
    ...(canViewLeads ? [{ label: "Conversion Rate", value: `${stats.conversionRate}%`, icon: TrendingUp }] : []),
  ];

  return (
    <main className="min-h-screen bg-enterprise">
      <header className="sticky top-0 z-40 border-b bg-background ">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-semibold text-primary">CRM</p>
            <h1 className="text-2xl font-bold">Customer Relationship Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <ThemeToggle />
            {activeModule === "leads" && canCreateLead && (
              <Button onClick={() => setLeadEditor("new")} type="button">
                <Plus className="h-4 w-4" />
                Create Lead
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container space-y-6 py-6">
        {visibleTabs.length === 0 ? (
          <EmptyState message="Your role does not have access to any CRM data yet. Ask an administrator to grant CRM permissions." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} key={card.label} transition={{ delay: index * 0.04 }}>
                    <Card className="glass h-full">
                      <CardContent className="p-5">
                        <Icon className="mb-4 h-5 w-5 text-primary" />
                        <p className="text-sm text-muted-foreground">{card.label}</p>
                        <p className={cn("mt-2 font-bold", String(card.value).length > 14 ? "text-xl" : "text-3xl")}>{card.value}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            <Card className="glass">
              <CardContent className="space-y-4 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder={`Search ${currentTab?.label.toLowerCase() ?? "CRM"}...`} value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Button
                        className="shrink-0"
                        key={tab.id}
                        onClick={() => setActiveModule(tab.id)}
                        type="button"
                        variant={activeModule === tab.id ? "default" : "outline"}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {pageError && <p className="text-sm font-medium text-destructive">{pageError}</p>}

            <div className={cn("grid gap-6", activeModule === "leads" && "xl:grid-cols-[1fr_340px]")}>
              <section className="min-w-0">
                {activeModule === "leads" && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {loadingLeads && <EmptyState message="Loading leads..." />}
                    {!loadingLeads && leadAccess === "forbidden" && <EmptyState message="Your role does not have access to leads." />}
                    {!loadingLeads && leadAccess === "error" && <EmptyState message="Could not load leads from the backend. Please try again." />}
                    {!loadingLeads && leadAccess === "ok" && filteredLeads.length === 0 && <EmptyState message="No leads found." />}
                    {!loadingLeads &&
                      leadAccess === "ok" &&
                      filteredLeads.map((lead) => (
                        <div className="cursor-pointer" key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                          <LeadCard
                            canConvert={canConvertLead}
                            canDelete={canDeleteLead}
                            canUpdate={canUpdateLead}
                            lead={lead}
                            onAssign={(ownerId) => void updateLead(lead.id, { ownerId })}
                            onConvert={() => void convertLead(lead)}
                            onDelete={() => void removeLead(lead)}
                            onEdit={() => setLeadEditor(lead)}
                            onStageChange={(stage) => void updateLead(lead.id, { stage })}
                            owners={owners}
                          />
                        </div>
                      ))}
                  </div>
                )}
                {activeResource && <ResourcePanel config={activeResource} key={activeResource.module} owners={owners} search={search} settings={settings} />}
              </section>

              {activeModule === "leads" && (
                <aside className="space-y-4">
                  {selectedLead && (
                    <>
                      <Card className="glass">
                        <CardHeader>
                          <CardTitle>Lead Snapshot</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Metric label="Lead" value={selectedLead.name} />
                          <Metric label="Company" value={selectedLead.company || "-"} />
                          <Metric label="Stage" value={selectedLead.stage} />
                          <Metric label="Owner" value={selectedLead.salesperson} />
                          <Metric label="Value" value={formatMoney(selectedLead.value, selectedLead.currency)} />
                        </CardContent>
                      </Card>
                      <ActivityTimeline lead={selectedLead} />
                    </>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {leadEditor && (
        <LeadFormModal
          currencies={settings.currencies}
          initial={
            leadEditor === "new"
              ? emptyLeadForm("", settings.defaultCurrency)
              : {
                  name: leadEditor.name,
                  company: leadEditor.company,
                  email: leadEditor.email,
                  phone: leadEditor.phone,
                  source: leadEditor.source,
                  stage: leadEditor.stage,
                  value: leadEditor.value,
                  currency: leadEditor.currency || settings.defaultCurrency,
                  ownerId: leadEditor.ownerId,
                  nextFollowUp: leadEditor.nextFollowUp,
                  notes: leadEditor.notes,
                  attachments: leadEditor.attachments,
                }
          }
          onClose={() => setLeadEditor(null)}
          onSubmit={(input) => void saveLead(input)}
          owners={owners}
        />
      )}
    </main>
  );
}
