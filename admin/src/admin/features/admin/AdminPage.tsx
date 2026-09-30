import { motion } from "framer-motion";
import {
 Building2,
 FileClock,
 Search,
 Settings,
 ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@shared/ui/ThemeToggle";
import { Button } from "@shared/ui/button";
import { Card, CardContent } from "@shared/ui/card";
import { useConfirm } from "@shared/ui/confirm-dialog-context";
import { Input } from "@shared/ui/input";
import { liveSyncIntervalMs, sharedDataChangedEvent } from "@shared/realtime/data-sync";
import { useToast } from "@shared/ui/toast-context";
import { cn } from "@shared/lib/utils";
import { deleteEmployee, employeeDirectoryChangedEvent, fetchEmployeeUsers, type BackendEmployee } from "@shared/employees/employees.api";
import { adminModules, adminSystemCards } from "./admin.data";
import type { AdminModule, AdminRecord } from "./admin.types";
import { AdminEntityTable } from "./components/AdminEntityTable";
import { AdminRecordModal } from "./components/AdminRecordModal";

type AdminTab = "modules" | "settings";
const protectedExecutiveRoles = new Set(["Owner", "Administrator", "CEO", "Admin"]);

const tabs: { id: AdminTab; label: string; icon: typeof ShieldCheck }[] = [
 { id: "modules", label: "Module Control", icon: ShieldCheck },
 { id: "settings", label: "System Settings", icon: Settings },
];

function formatAdminDate(value?: string) {
 return value ? value.slice(0, 10) : "Never";
}

function toAdminEmployeeRecord(user: BackendEmployee): AdminRecord {
 return {
 id: user.id,
 name: user.fullName,
 email: user.email,
 role: user.role,
 department: user.department ?? "Unassigned",
 designation: user.designation ?? user.role,
 status: user.employmentStatus ?? (user.isActive ? "Active" : "Inactive"),
 joiningDate: formatAdminDate(user.joiningDate ?? user.createdAt),
 lastLogin: formatAdminDate(user.lastLoginAt ?? user.createdAt),
 isSystemAccount: protectedExecutiveRoles.has(user.role),
 };
}

export function AdminPage() {
 const { confirm } = useConfirm();
 const { toast } = useToast();
 const [modules, setModules] = useState<AdminModule[]>(adminModules);
 const [activeTab, setActiveTab] = useState<AdminTab>("modules");
 const [activeModuleId, setActiveModuleId] = useState(adminModules[0].id);
 const [search, setSearch] = useState("");
 const [editingRecord, setEditingRecord] = useState<AdminRecord | null>(null);
 const employeeLoadSequenceRef = useRef(0);
 const activeModule = modules.find((module) => module.id === activeModuleId) ?? modules[0];

 const loadEmployeeRecords = useCallback(async () => {
 const requestId = employeeLoadSequenceRef.current + 1;
 employeeLoadSequenceRef.current = requestId;
 const result = await fetchEmployeeUsers();
 if (requestId !== employeeLoadSequenceRef.current || result.status !== "ok") return;
 const employeeRecords = result.data.map(toAdminEmployeeRecord);
 setModules((current) =>
 current.map((module) => (module.id === "employees" ? { ...module, records: employeeRecords } : module)),
 );
 }, []);

 useEffect(() => {
 let isMounted = true;
 const refreshIfActive = () => {
 if (!isMounted) return;
 void loadEmployeeRecords();
 };
 const refreshFromDirectoryEvent = () => {
 if (!isMounted) return;
 void loadEmployeeRecords();
 };

 void loadEmployeeRecords();
 const intervalId = window.setInterval(refreshIfActive, liveSyncIntervalMs);
 window.addEventListener("focus", refreshIfActive);
 window.addEventListener(sharedDataChangedEvent, refreshFromDirectoryEvent);
 window.addEventListener(employeeDirectoryChangedEvent, refreshFromDirectoryEvent);
 window.addEventListener("storage", refreshFromDirectoryEvent);
 document.addEventListener("visibilitychange", refreshIfActive);

 return () => {
 isMounted = false;
 employeeLoadSequenceRef.current += 1;
 window.clearInterval(intervalId);
 window.removeEventListener("focus", refreshIfActive);
 window.removeEventListener(sharedDataChangedEvent, refreshFromDirectoryEvent);
 window.removeEventListener(employeeDirectoryChangedEvent, refreshFromDirectoryEvent);
 window.removeEventListener("storage", refreshFromDirectoryEvent);
 document.removeEventListener("visibilitychange", refreshIfActive);
 };
 }, [loadEmployeeRecords]);

 const filteredRecords = useMemo(() => {
 return activeModule.records.filter((record) => JSON.stringify(record).toLowerCase().includes(search.toLowerCase()));
 }, [activeModule.records, search]);

 const saveRecord = (record: AdminRecord) => {
 const exists = activeModule.records.some((item) => item.id === record.id);
 setModules((current) =>
 current.map((module) =>
 module.id === activeModule.id
 ? {
 ...module,
 records: exists ? module.records.map((item) => (item.id === record.id ? record : item)) : [record, ...module.records],
 }
 : module,
 ),
 );
 setEditingRecord(null);
 };

 const deleteRecord = async (record: AdminRecord) => {
 if (activeModule.id === "employees" && record.isSystemAccount === true) {
 toast({
 title: "Protected account",
 description: "CEO and admin accounts are fixed, so they cannot be edited or removed from Admin Panel.",
 type: "error",
 });
 return;
 }

 const accepted = await confirm({
 title: "Delete admin record?",
 description: `Record ${record.id} will be removed from ${activeModule.label}.`,
 confirmLabel: "Delete Record",
 tone: "danger",
 });
 if (accepted) {
 if (activeModule.id === "employees") {
 try {
 await deleteEmployee(record.id);
 } catch (error) {
 toast({ title: "Could not remove employee", description: (error as Error).message, type: "error" });
 return;
 }
 }
 setModules((current) =>
 current.map((module) =>
 module.id === activeModule.id
 ? { ...module, records: module.records.filter((item) => item.id !== record.id) }
 : module,
 ),
 );
 toast({ title: activeModule.id === "employees" ? "Employee removed" : "Admin record deleted", description: `${record.name ?? record.id} was removed from ${activeModule.label}.`, type: "warning" });
 }
 };

 return (
 <main className="min-h-screen bg-enterprise">
 <header className="sticky top-0 z-40 border-b bg-background ">
 <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
 <div>
 <p className="text-sm font-semibold text-primary">Admin Panel</p>
 <h1 className="text-2xl font-bold">Nexora Control Center</h1>
 </div>
 <div className="flex items-center gap-2">
 <Button asChild type="button" variant="outline">
 <Link to="/dashboard">Dashboard</Link>
 </Button>
 <ThemeToggle />
 <Button asChild type="button" variant="outline">
 <Link to="/admin/organization">
 <Building2 className="h-4 w-4" />
 Organization
 </Link>
 </Button>
 <Button asChild type="button" variant="outline">
 <Link to="/admin/rbac">
 <ShieldCheck className="h-4 w-4" />
 Roles &amp; Permissions
 </Link>
 </Button>
 <Button asChild type="button" variant="outline">
 <Link to="/audit-backup">
 <FileClock className="h-4 w-4" />
 Audit &amp; Backup
 </Link>
 </Button>
 </div>
 </div>
 </header>

 <div className="container space-y-6 py-6">
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
 {adminSystemCards.map((card, index) => {
 const Icon = card.icon;
 return (
 <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} key={card.label} transition={{ delay: index * 0.04 }}>
 <Card className="glass h-full">
 <CardContent className="p-5">
 <Icon className="mb-4 h-5 w-5 text-primary" />
 <p className="text-sm text-muted-foreground">{card.label}</p>
 <p className="mt-2 text-2xl font-bold">{card.value}</p>
 </CardContent>
 </Card>
 </motion.div>
 );
 })}
 </div>

 <Card className="glass">
 <CardContent className="flex gap-2 overflow-x-auto p-4">
 {tabs.map((tab) => {
 const Icon = tab.icon;
 return (
 <Button className="shrink-0" key={tab.id} onClick={() => setActiveTab(tab.id)} type="button" variant={activeTab === tab.id ? "default" : "outline"}>
 <Icon className="h-4 w-4" />
 {tab.label}
 </Button>
 );
 })}
 </CardContent>
 </Card>

 {activeTab === "modules" && (
 <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
 <aside className="space-y-3">
 {modules.map((module) => {
 const Icon = module.icon;
 if (module.route) {
 return (
 <Link
 className="flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
 key={module.id}
 to={module.route}
 >
 <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
 <span>
 <span className="block font-semibold">{module.label}</span>
 <span className="mt-1 block text-xs leading-5 text-muted-foreground">Open workspace &rarr;</span>
 </span>
 </Link>
 );
 }
 return (
 <button
 className={cn(
 "flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40",
 activeModuleId === module.id && "border-primary/50 bg-primary/5",
 )}
 key={module.id}
 onClick={() => setActiveModuleId(module.id)}
 type="button"
 >
 <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
 <span>
 <span className="block font-semibold">{module.label}</span>
 <span className="mt-1 block text-xs leading-5 text-muted-foreground">{module.records.length} records - live</span>
 </span>
 </button>
 );
 })}
 </aside>

 <section className="min-w-0 space-y-4">
 <Card className="glass">
 <CardContent className="space-y-4 p-4">
 <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
 <div>
 <p className="text-sm font-semibold text-primary">{activeModule.label}</p>
 <h2 className="mt-1 text-2xl font-bold">Dynamic Module Manager</h2>
 <p className="mt-2 text-sm text-muted-foreground">{activeModule.description}</p>
 </div>
 </div>
 <div className="relative">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input className="pl-9" placeholder={`Search ${activeModule.label.toLowerCase()}...`} value={search} onChange={(event) => setSearch(event.target.value)} />
 </div>
 </CardContent>
 </Card>
 <AdminEntityTable actionsDisabled={false} module={activeModule} onDelete={deleteRecord} onEdit={setEditingRecord} records={filteredRecords} />
 </section>
 </div>
 )}

 {activeTab === "settings" && (
 <div className="rounded-lg border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
 <p className="font-semibold text-foreground">System settings are managed under Organization.</p>
 <p className="mt-1">
 Use{" "}
 <Link className="text-primary underline" to="/admin/organization">
 Organization Settings
 </Link>{" "}
 for company profile, business hours, and workspace configuration backed by the real API.
 </p>
 </div>
 )}
 </div>

 {editingRecord && (
 <AdminRecordModal
 module={activeModule}
 onClose={() => setEditingRecord(null)}
 onSubmit={saveRecord}
 record={editingRecord}
 />
 )}
 </main>
 );
}
