import { motion } from "framer-motion";
import {
 CalendarCheck,
 ChevronLeft,
 ChevronRight,
 ContactRound,
 Download,
 LogOut,
 Menu,
 Plus,
 RotateCcw,
 Sparkles,
 X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthSession, getStoredAuthSession } from "@shared/auth/auth-service";
import { usePermissions } from "@shared/auth/usePermissions";
import { crmViewPermissions } from "@shared/crm/permissions";
import { useIsTablet, useMediaQuery } from "@shared/hooks/useMediaQuery";
import { dashboardExportRequestEvent } from "@shared/platform/events";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { useToast } from "@shared/ui/toast-context";

export type ProfessionalDashboardStat = {
 label: string;
 value: string;
 trend: string;
 icon: LucideIcon;
 href?: string;
};

export type ProfessionalDashboardLink = {
 label: string;
 href: string;
 icon: LucideIcon;
 note: string;
};

export type ProfessionalDashboardQueueItem = {
 title: string;
 meta: string;
 priority: "High" | "Medium" | "Low" | "Critical";
};

export type ProfessionalDashboardActivity = {
 title: string;
 detail: string;
 time: string;
 icon: LucideIcon;
};

export type ProfessionalDashboardNavGroup = {
 label: string;
 items: { label: string; href: string; icon: LucideIcon }[];
};

export type ProfessionalDashboardConfig = {
 storageKey: string;
 eyebrow: string;
 title: string;
 subtitle: string;
 roleLabel: string;
 navGroups: ProfessionalDashboardNavGroup[];
 stats: ProfessionalDashboardStat[];
 primaryActions: ProfessionalDashboardLink[];
 queue: ProfessionalDashboardQueueItem[];
 activity: ProfessionalDashboardActivity[];
 insights: string[];
 focus: string[];
 attendanceHref?: string;
};

function downloadJson(filename: string, data: unknown) {
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
 const url = URL.createObjectURL(blob);
 const link = document.createElement("a");
 link.href = url;
 link.download = filename;
 link.click();
 URL.revokeObjectURL(url);
}

function priorityClass(priority: ProfessionalDashboardQueueItem["priority"]) {
 if (priority === "Critical") return "bg-rose-500/10 text-rose-600 dark:text-rose-300";
 if (priority === "High") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
 if (priority === "Medium") return "bg-primary/10 text-primary";
 return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function readCompletedTasks(key: string) {
 try {
 const raw = window.localStorage.getItem(key);
 return raw ? (JSON.parse(raw) as string[]) : [];
 } catch {
 return [];
 }
}

function Sidebar({
 collapsed,
 config,
 mobileOpen,
 onCloseMobile,
 onLogout,
 onToggle,
}: {
 collapsed: boolean;
 config: ProfessionalDashboardConfig;
 mobileOpen: boolean;
 onCloseMobile: () => void;
 onLogout: () => void;
 onToggle: () => void;
}) {
 const location = useLocation();
 const isTablet = useIsTablet();
 const brandName = getStoredAuthSession()?.user.companyName?.trim() || "AI BOS";
 const { hasAnyPermission } = usePermissions();
 // Employee app only (the admin app passes attendanceHref): a role granted CRM in the permission matrix gets a CRM link even though its dashboard config has none.
 const showGrantedCrmLink = !config.attendanceHref && hasAnyPermission(...crmViewPermissions);
 const navGroups = useMemo(() => {
 if (!showGrantedCrmLink || config.navGroups.some((group) => group.items.some((item) => item.href === "/crm"))) return config.navGroups;
 return [...config.navGroups, { label: "Customers", items: [{ label: "CRM", href: "/crm", icon: ContactRound }] }];
 }, [config.navGroups, showGrantedCrmLink]);
 // Tablet (768–1023px) gets a persistent icon-rail, not the phone's off-canvas drawer.
 const effectiveCollapsed = collapsed || isTablet;

 return (
 <>
 <div
 className={cn(
 "fixed inset-x-0 bottom-0 top-14 z-40 bg-foreground transition-opacity md:hidden",
 mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
 )}
 aria-hidden="true"
 onClick={onCloseMobile}
 />
 <aside
 className={cn(
 "fixed bottom-0 left-0 top-14 z-50 flex border-r bg-background transition-all duration-300 md:sticky md:top-0 md:z-auto md:h-screen",
 effectiveCollapsed ? "w-[88px]" : "w-[292px]",
 mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
 )}
 >
 <div className="flex min-w-0 flex-1 flex-col p-4">
 <div className="flex h-12 items-center justify-between gap-2">
 {!effectiveCollapsed && (
 <Link className="min-w-0" to="/dashboard">
 <span className="block truncate text-base font-bold">{brandName}</span>
 <span className="block truncate text-xs text-muted-foreground">{config.roleLabel}</span>
 </Link>
 )}
 <Button aria-label="Close sidebar" className="md:hidden" onClick={onCloseMobile} size="icon" type="button" variant="ghost">
 <X className="h-4 w-4" />
 </Button>
 </div>

 <nav aria-label={`${config.roleLabel} navigation`} className="mt-7 flex-1 space-y-6 overflow-y-auto pr-1">
 {navGroups.map((group) => (
 <div key={group.label}>
 {!effectiveCollapsed && <p className="mb-2 px-3 text-[11px] font-bold uppercase text-muted-foreground">{group.label}</p>}
 <div className="space-y-1">
 {group.items.map((item) => {
 const Icon = item.icon;
 const isActive = location.pathname === item.href;
 return (
 <Link
 aria-current={isActive ? "page" : undefined}
 aria-label={effectiveCollapsed ? item.label : undefined}
 className={cn(
 "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-all hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
 isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15" : "text-muted-foreground",
 effectiveCollapsed && "justify-center px-0",
 )}
 key={item.href}
 title={effectiveCollapsed ? item.label : undefined}
 to={item.href}
 >
 <Icon className="h-4 w-4 shrink-0" />
 {!effectiveCollapsed && <span className="truncate">{item.label}</span>}
 </Link>
 );
 })}
 </div>
 </div>
 ))}
 </nav>

 <div className="space-y-2 border-t pt-4">
 {config.attendanceHref && (
 <Link
 aria-label={effectiveCollapsed ? "Attendance" : undefined}
 className={cn(
 "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
 effectiveCollapsed && "justify-center px-0",
 )}
 onClick={onCloseMobile}
 to={config.attendanceHref}
 title={effectiveCollapsed ? "Attendance" : undefined}
 >
 <CalendarCheck className="h-4 w-4 shrink-0" />
 {!effectiveCollapsed && <span className="truncate">Attendance</span>}
 </Link>
 )}
 <button
 aria-label={effectiveCollapsed ? "Logout" : undefined}
 className={cn(
 "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive",
 effectiveCollapsed && "justify-center px-0",
 )}
 onClick={onLogout}
 title={effectiveCollapsed ? "Logout" : undefined}
 type="button"
 >
 <LogOut className="h-4 w-4 shrink-0" />
 {!effectiveCollapsed && <span>Logout</span>}
 </button>
 <Button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="hidden w-full rounded-lg lg:flex" onClick={onToggle} type="button" variant="outline">
 {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
 {!collapsed && "Collapse"}
 </Button>
 </div>
 </div>
 </aside>
 </>
 );
}

// Search, Quick Add, Export trigger, notifications, and profile all now live in the
// app-wide GlobalTopBar (see platform/AppShell.tsx) so they aren't duplicated here.
// This just keeps the mobile sidebar toggle, since the docked sidebar is off-canvas
// on small screens and needs a way to be opened.
function MobileSidebarToggle({ onOpenSidebar }: { onOpenSidebar: () => void }) {
 return (
 <div className="flex items-center gap-3 border-b bg-background px-4 py-2 md:hidden">
 <Button aria-label="Open sidebar" onClick={onOpenSidebar} size="icon" type="button" variant="ghost">
 <Menu className="h-5 w-5" />
 </Button>
 <span className="text-sm font-semibold text-muted-foreground">Menu</span>
 </div>
 );
}

export function ProfessionalDashboard({ config, leadingContent }: { config: ProfessionalDashboardConfig; leadingContent?: ReactNode }) {
 const [collapsed, setCollapsed] = useState(false);
 const [mobileOpen, setMobileOpen] = useState(false);
 const [completed, setCompleted] = useState<string[]>(() => readCompletedTasks(`${config.storageKey}-completed`));
 const [hiddenInsights, setHiddenInsights] = useState(false);
 const navigate = useNavigate();
 const location = useLocation();
 const isDockedNav = useMediaQuery("(min-width: 768px)");
 const session = getStoredAuthSession();
 const { toast } = useToast();
 const roleLabel = session?.user.roleName ?? session?.user.role ?? config.roleLabel;

 useEffect(() => {
 window.localStorage.setItem(`${config.storageKey}-completed`, JSON.stringify(completed));
 }, [completed, config.storageKey]);

 useEffect(() => {
 setMobileOpen(false);
 }, [location.pathname]);

 useEffect(() => {
 if (isDockedNav) setMobileOpen(false);
 }, [isDockedNav]);

 const toggleTask = (title: string) => {
 setCompleted((current) => {
 const exists = current.includes(title);
 const next = exists ? current.filter((item) => item !== title) : [...current, title];
 toast({ title: exists ? "Task reopened" : "Task completed", description: title, type: exists ? "info" : "success" });
 return next;
 });
 };

 const exportDashboard = () => {
 downloadJson(`${config.storageKey}-dashboard.json`, {
 role: roleLabel,
 exportedAt: new Date().toISOString(),
 stats: config.stats,
 queue: config.queue,
 completed,
 });
 toast({ title: "Dashboard exported", description: `${config.title} snapshot downloaded.`, type: "success" });
 };

 useEffect(() => {
 window.addEventListener(dashboardExportRequestEvent, exportDashboard);
 return () => window.removeEventListener(dashboardExportRequestEvent, exportDashboard);
 });

 const logout = () => {
 clearAuthSession();
 navigate("/login");
 };

 return (
 <div className="min-h-screen bg-enterprise">
 <div className="flex min-h-screen">
 <Sidebar
 collapsed={collapsed}
 config={config}
 mobileOpen={mobileOpen}
 onCloseMobile={() => setMobileOpen(false)}
 onLogout={logout}
 onToggle={() => setCollapsed((value) => !value)}
 />
 <div className="flex min-w-0 flex-1 flex-col">
 <MobileSidebarToggle onOpenSidebar={() => setMobileOpen(true)} />
 <div className="flex min-w-0 flex-1">
 <main className="min-w-0 flex-1">
 <div className="space-y-6 p-4 lg:p-6">
 {leadingContent}
 <motion.div animate={{ opacity: 1, y: 0 }} className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end" initial={{ opacity: 0, y: 18 }} transition={{ duration: 0.35 }}>
 <div>
 <p className="text-sm font-semibold text-primary">{config.eyebrow}</p>
 <h1 className="mt-2 text-balance text-3xl font-bold tracking-normal lg:text-5xl">{config.title}</h1>
 <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{config.subtitle}</p>
 </div>
 <div className="glass-soft rounded-lg p-4">
 <div className="flex flex-wrap items-center gap-2">
 <Button onClick={() => setCompleted([])} size="sm" type="button" variant="outline">
 <RotateCcw className="h-4 w-4" />
 Reset
 </Button>
 <Button onClick={exportDashboard} size="sm" type="button">
 <Download className="h-4 w-4" />
 Export
 </Button>
 <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold">
 <Sparkles className="h-4 w-4 text-primary" />
 {completed.length} done
 </div>
 </div>
 <p className="mt-3 text-xs text-muted-foreground">Role-aware workspace with saved task progress.</p>
 </div>
 </motion.div>

 <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {config.stats.map((stat, index) => {
 const Icon = stat.icon;
 const body = (
 <Card className="h-full rounded-lg bg-card interactive-surface">
 <CardContent className="p-5">
 <span className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
 <Icon className="h-5 w-5" />
 </span>
 <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
 <p className="mt-2 text-2xl font-bold sm:text-3xl">{stat.value}</p>
 <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-300">{stat.trend}</p>
 </CardContent>
 </Card>
 );
 return (
 <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 14 }} key={stat.label} transition={{ delay: index * 0.04 }}>
 {stat.href ? <Link to={stat.href}>{body}</Link> : body}
 </motion.div>
 );
 })}
 </section>

 <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
 <Card className="glass rounded-lg">
 <CardHeader>
 <CardTitle>Core Options</CardTitle>
 <p className="text-sm text-muted-foreground">Fast paths for this dashboard role.</p>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2">
 {config.primaryActions.map((action) => {
 const Icon = action.icon;
 return (
 <Link className="interactive-surface rounded-lg border bg-background p-4" key={action.href} to={action.href}>
 <Icon className="h-5 w-5 text-primary" />
 <p className="mt-4 font-semibold">{action.label}</p>
 <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.note}</p>
 </Link>
 );
 })}
 </CardContent>
 </Card>

 <Card className="glass rounded-lg">
 <CardHeader className="flex flex-row items-center justify-between gap-3">
 <div>
 <CardTitle>Insights</CardTitle>
 <p className="mt-2 text-sm text-muted-foreground">Actionable signals for the role.</p>
 </div>
 <Button aria-label="Toggle insights" onClick={() => setHiddenInsights((value) => !value)} size="icon" type="button" variant="outline">
 {hiddenInsights ? <Plus className="h-4 w-4" /> : <X className="h-4 w-4" />}
 </Button>
 </CardHeader>
 <CardContent className="space-y-3">
 {hiddenInsights ? (
 <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">Insights hidden for focus mode.</p>
 ) : config.insights.length === 0 ? (
 <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">No live insights are available yet.</p>
 ) : (
 config.insights.map((insight) => (
 <p className="rounded-lg border bg-background p-4 text-sm leading-6" key={insight}>
 {insight}
 </p>
 ))
 )}
 </CardContent>
 </Card>
 </section>

 <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
 <Card className="glass rounded-lg">
 <CardHeader>
 <CardTitle>Priority Queue</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {config.queue.length === 0 && (
 <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">No priority items are currently assigned.</p>
 )}
 {config.queue.map((item) => {
 const isDone = completed.includes(item.title);
 return (
 <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background" key={item.title}>
 <input checked={isDone} className="mt-1 h-4 w-4 accent-primary" type="checkbox" onChange={() => toggleTask(item.title)} />
 <span className="min-w-0 flex-1">
 <span className={cn("block text-sm font-semibold", isDone && "text-muted-foreground line-through")}>{item.title}</span>
 <span className="mt-1 block text-xs text-muted-foreground">{item.meta}</span>
 </span>
 <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", priorityClass(item.priority))}>{item.priority}</span>
 </label>
 );
 })}
 </CardContent>
 </Card>

 <Card className="glass rounded-lg">
 <CardHeader>
 <CardTitle>Access Scope</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2">
 {config.focus.map((item) => (
 <div className="rounded-lg border bg-background p-4 text-sm font-semibold" key={item}>
 {item}
 </div>
 ))}
 </CardContent>
 </Card>
 </section>
 </div>
 </main>

 <aside className="hidden w-[360px] shrink-0 border-l bg-card/35 p-5 xl:block">
 <div className="sticky top-20 space-y-5">
 <div>
 <p className="text-sm font-semibold text-primary">Activity Feed</p>
 <h2 className="mt-2 text-xl font-bold">Live Operations</h2>
 </div>
 <div className="relative space-y-3">
 <div className="absolute bottom-4 left-5 top-4 w-px bg-border" />
 {config.activity.length === 0 && (
 <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">No live activity is available yet.</p>
 )}
 {config.activity.map((item, index) => {
 const Icon = item.icon;
 return (
 <motion.div animate={{ opacity: 1, x: 0 }} className="relative rounded-2xl border bg-background/65 p-4 pl-14" initial={{ opacity: 0, x: 16 }} key={item.title} transition={{ delay: index * 0.04 }}>
 <span className="absolute left-2 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
 <Icon className="h-4 w-4" />
 </span>
 <p className="text-sm font-semibold leading-6">{item.title}</p>
 <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
 <p className="mt-2 text-xs text-muted-foreground">{item.time}</p>
 </motion.div>
 );
 })}
 </div>
 </div>
 </aside>
 </div>
 </div>
 </div>
 </div>
 );
}
