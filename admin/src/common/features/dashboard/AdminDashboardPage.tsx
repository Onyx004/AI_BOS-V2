import {
 BarChart3,
 CalendarDays,
 Clock3,
 CheckSquare,
 ContactRound,
 FileText,
 FolderKanban,
 Lock,
 LogIn,
 MessageSquare,
 Monitor,
 Plug,
 Settings,
 Shield,
 ShieldAlert,
 ShieldCheck,
 UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredAuthSession } from "@shared/auth/auth-service";
import { fetchAuditLogs } from "@shared/audit-backup/audit-backup.api";
import type { AuditCategory, AuditLogEntry } from "@shared/audit-backup/audit-backup.schema";
import { fetchIntegrations } from "@shared/integrations/integration.api";
import { fetchModuleAccess, updateModuleAccess, type ModuleAccess } from "@shared/lib/module-access.api";
import {
 ProfessionalDashboard,
 type ProfessionalDashboardActivity,
 type ProfessionalDashboardConfig,
} from "@shared/platform/ProfessionalDashboard";
import { liveSyncIntervalMs, sharedDataChangedEvent } from "@shared/realtime/data-sync";
import { fetchTeamAccounts } from "@shared/team-accounts/team-accounts.api";
import { Button } from "@shared/ui/button";
import { useToast } from "@shared/ui/toast-context";
import { useAdministratorMonitoringAccess } from "@/admin/features/administrator-access/AdministratorMonitoringAccessContext";

const adminNav = [
 {
 label: "Control",
 items: [
 { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
 { label: "Admin Panel", href: "/admin", icon: ShieldCheck },
 { label: "Settings", href: "/settings", icon: Settings },
 { label: "Integrations", href: "/integrations", icon: Plug },
 { label: "Monitoring", href: "/monitoring", icon: Monitor },
 ],
 },
 {
 label: "Operations",
 items: [
 { label: "Projects", href: "/projects", icon: FolderKanban },
 { label: "Tasks", href: "/tasks", icon: CheckSquare },
 { label: "Meetings", href: "/meetings", icon: CalendarDays },
 { label: "Messenger", href: "/messenger", icon: MessageSquare },
 { label: "Employees", href: "/employees", icon: UsersRound },
 { label: "Attendance", href: "/attendance", icon: Clock3 },
 ],
 },
 {
 label: "Customers",
 items: [
 { label: "CRM", href: "/crm", icon: ContactRound },
 ],
 },
];

// Note: AuditCategory here (shared/src/audit-backup/audit-backup.schema.ts) is missing
// "ai_activity" and "device_update", which the backend's own AuditCategory does have
// (backend/src/constants/audit.ts) - the `??` fallbacks below cover those gracefully.
const auditCategoryLabels: Record<AuditCategory, string> = {
 login: "Login",
 logout: "Logout",
 user_action: "User Action",
 crud: "Record Updated",
 permission_change: "Permission Changed",
 settings_change: "Settings Changed",
 file_activity: "File Activity",
 report_download: "Report Downloaded",
};

const auditCategoryIcons: Record<AuditCategory, typeof ShieldCheck> = {
 login: LogIn,
 logout: LogIn,
 user_action: UsersRound,
 crud: FolderKanban,
 permission_change: ShieldAlert,
 settings_change: Settings,
 file_activity: FileText,
 report_download: BarChart3,
};

function formatRelativeTime(iso: string): string {
 const diffMs = Date.now() - new Date(iso).getTime();
 const minutes = Math.round(diffMs / 60000);
 if (minutes < 1) return "Just now";
 if (minutes < 60) return `${minutes} min ago`;
 const hours = Math.round(minutes / 60);
 if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
 const days = Math.round(hours / 24);
 return `${days} day${days === 1 ? "" : "s"} ago`;
}

function toActivityItem(entry: AuditLogEntry): ProfessionalDashboardActivity {
 return {
 title: auditCategoryLabels[entry.category] ?? entry.category,
 detail: `${entry.actorEmail ?? "System"} - ${entry.method} ${entry.resourceType ?? entry.path}`,
 time: formatRelativeTime(entry.createdAt),
 icon: auditCategoryIcons[entry.category] ?? FileText,
 };
}

const panelConfig: ProfessionalDashboardConfig = {
 storageKey: "admin",
 attendanceHref: "/attendance",
 eyebrow: "System Control",
 title: "Admin Dashboard",
 subtitle: "A polished command center for users, permissions, integrations, settings, audits, and operations.",
 roleLabel: "Administrator",
 navGroups: adminNav,
 stats: [
 { label: "Active Users", value: "-", trend: "Loading...", icon: UsersRound, href: "/admin" },
 { label: "Integrations", value: "-", trend: "Loading...", icon: Plug, href: "/integrations" },
 ],
 primaryActions: [
 { label: "Admin Panel", href: "/admin", icon: ShieldCheck, note: "Users, roles, permissions, audits, and module control" },
 { label: "Settings", href: "/settings", icon: Settings, note: "Company, security, workspace, and system preferences" },
 { label: "Company Messenger", href: "/messenger", icon: MessageSquare, note: "Team chat, direct messages, room notes, and shared files" },
 { label: "Integrations", href: "/integrations", icon: Plug, note: "Connected apps, logs, sync status, and health" },
 ],
 queue: [],
 activity: [],
 insights: [],
 focus: ["Full admin access", "Role and permission control", "Integration settings", "System settings"],
};

export function AdminDashboardPage() {
  const { toast } = useToast();
  const { hasPermission } = useAdministratorMonitoringAccess();
  const session = getStoredAuthSession();
  const userRole = session?.user?.role ?? "Administrator";
  const isOwner = userRole === "Owner";

  const [liveStats, setLiveStats] = useState<Record<string, { value: string; trend: string }>>({});
  const [liveActivity, setLiveActivity] = useState<ProfessionalDashboardActivity[]>([]);
  const [moduleAccessState, setModuleAccessState] = useState<ModuleAccess | null>(null);
  const [togglingMode, setTogglingMode] = useState(false);
  const loadSequenceRef = useRef(0);

  const loadDashboard = useCallback(async () => {
    const requestId = loadSequenceRef.current + 1;
    loadSequenceRef.current = requestId;
    const [accountsResult, integrationsResult, accessResult, auditResult] = await Promise.all([
      fetchTeamAccounts(),
      (async () => {
        try {
          return await fetchIntegrations(session?.accessToken);
        } catch {
          return null;
        }
      })(),
      fetchModuleAccess(),
      (async () => {
        try {
          return await fetchAuditLogs({ limit: 5 }, session?.accessToken);
        } catch {
          return null;
        }
      })(),
    ]);
    if (requestId !== loadSequenceRef.current) return;

    const next: Record<string, { value: string; trend: string }> = {};
    if (accountsResult.status === "ok") {
      const activeCount = accountsResult.data.filter((account) => account.isActive).length;
      next["Active Users"] = { value: String(activeCount), trend: "Live count" };
    }
    if (integrationsResult) {
      const connected = integrationsResult.filter((integration) => integration.status === "connected").length;
      next.Integrations = { value: String(integrationsResult.length), trend: `${connected} connected` };
    }
    setLiveStats(next);
    if (accessResult) {
      setModuleAccessState(accessResult);
    }
    if (auditResult) {
      setLiveActivity(auditResult.items.map(toActivityItem));
    }
  }, [session?.accessToken]);

  useEffect(() => {
    let active = true;
    const refreshIfActive = () => {
      if (active) void loadDashboard();
    };

    void loadDashboard();
    const intervalId = window.setInterval(refreshIfActive, liveSyncIntervalMs);
    window.addEventListener("focus", refreshIfActive);
    window.addEventListener(sharedDataChangedEvent, refreshIfActive);
    document.addEventListener("visibilitychange", refreshIfActive);
    return () => {
      active = false;
      loadSequenceRef.current += 1;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfActive);
      window.removeEventListener(sharedDataChangedEvent, refreshIfActive);
      document.removeEventListener("visibilitychange", refreshIfActive);
    };
  }, [loadDashboard]);

  const handleToggleControlMode = async (newMode: "full_control" | "read_only") => {
    setTogglingMode(true);
    try {
      const currentAccess = moduleAccessState ?? { adminPanelEnabled: true };
      const success = await updateModuleAccess({
        adminPanelEnabled: currentAccess.adminPanelEnabled,
        administratorControlMode: newMode,
      });

      if (success) {
        setModuleAccessState((prev) => ({
          ...(prev ?? { adminPanelEnabled: true }),
          administratorControlMode: newMode,
        }));
        toast({
          title: newMode === "read_only" ? "Administrator Control set to Read-Only" : "Full Control Granted to Administrators",
          description: newMode === "read_only" ? "Administrators are now restricted to read-only views." : "Administrators can now create, edit, and delete data.",
          type: "success",
        });
      } else {
        toast({ title: "Failed to update control mode", type: "error" });
      }
    } catch {
      toast({ title: "Failed to update control mode", type: "error" });
    } finally {
      setTogglingMode(false);
    }
  };

  const currentMode = moduleAccessState?.administratorControlMode ?? "full_control";
  const isReadOnly = currentMode === "read_only";

  const config = hasPermission("device.monitoring.view")
    ? panelConfig
    : {
        ...panelConfig,
        navGroups: panelConfig.navGroups.map((group) => ({
          ...group,
          items: group.items.filter((item) => item.href !== "/monitoring"),
        })),
      };

  const adaptedConfig: ProfessionalDashboardConfig = {
    ...config,
    roleLabel: isOwner ? "Owner (Master Admin)" : "Administrator",
    subtitle: isOwner
      ? "Owner Command Center: Full operational visibility and master control over administrator permissions."
      : "Administrator Command Center: Poland system governance and operations control.",
  };

  const stats = adaptedConfig.stats.map((stat) => (liveStats[stat.label] ? { ...stat, ...liveStats[stat.label] } : stat));

  return (
    <div className="space-y-4">
      {/* Owner Master Control Switch Banner */}
      {isOwner && (
        <div className="mx-4 mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm lg:mx-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {isReadOnly ? <Lock className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Owner Master Control Switch</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${isReadOnly ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}`}>
                    {isReadOnly ? "READ-ONLY MODE" : "FULL CONTROL MODE"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isReadOnly
                    ? "Administrators can view all dashboards but mutating actions (create, edit, delete) are locked."
                    : "Administrators have full write permissions across all authorized features."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={isReadOnly ? "default" : "outline"}
                size="sm"
                disabled={togglingMode}
                onClick={() => handleToggleControlMode("full_control")}
              >
                Full Control
              </Button>
              <Button
                variant={isReadOnly ? "destructive" : "outline"}
                size="sm"
                disabled={togglingMode}
                onClick={() => handleToggleControlMode("read_only")}
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Read-Only
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Administrator Read-Only Warning Notice Banner */}
      {!isOwner && isReadOnly && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300 lg:mx-6">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">System in Read-Only Mode (Set by Owner)</span>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              You can view all records and telemetry, but creating, modifying, or deleting data is restricted.
            </p>
          </div>
        </div>
      )}

      <ProfessionalDashboard config={{ ...adaptedConfig, stats, activity: liveActivity }} />
    </div>
  );
}
