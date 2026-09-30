import {
 Bell,
 BriefcaseBusiness,
 CalendarDays,
 Clock3,
 FolderKanban,
 MessageSquare,
 Monitor,
 Plug,
 Settings,
 ShieldAlert,
 SquarePen,
 UserPlus,
 UsersRound,
 Workflow,
} from "lucide-react";
import type { QuickCreateAction, WorkspaceSearchItem } from "@shared/platform/types";

export const workspaceSearchItems: WorkspaceSearchItem[] = [
 { id: "nav-dashboard", title: "Dashboard", category: "Navigation", href: "/dashboard", keywords: ["home", "overview"], icon: BriefcaseBusiness, roles: ["Administrator", "Owner"] },
 { id: "nav-admin", title: "Admin Panel", category: "Administrator", href: "/admin", keywords: ["roles", "permissions", "audit"], icon: BriefcaseBusiness, roles: ["Administrator", "Owner"] },
 { id: "nav-settings", title: "Settings", category: "Settings", href: "/settings", keywords: ["theme", "company", "security"], icon: Settings, roles: ["Administrator", "Owner"] },
 { id: "nav-integrations", title: "Integrations", category: "System", href: "/integrations", keywords: ["slack", "salesforce", "quickbooks", "sync"], icon: Plug, roles: ["Administrator", "Owner"] },
 { id: "nav-projects", title: "Projects", category: "Projects", href: "/projects", keywords: ["delivery", "budget", "timeline"], icon: FolderKanban, roles: ["Administrator", "Owner"] },
 { id: "nav-workflows", title: "Workflow Automation", category: "Automation", href: "/workflows", keywords: ["workflow", "automation", "triggers", "actions"], icon: Workflow, roles: ["Administrator", "Owner"] },
 { id: "nav-tasks", title: "Tasks", category: "Tasks", href: "/tasks", keywords: ["todo", "kanban", "work"], icon: SquarePen, roles: ["Administrator", "Owner"] },
 { id: "nav-meetings", title: "Meetings", category: "Meetings", href: "/meetings", keywords: ["calendar", "zoom", "meet"], icon: CalendarDays, roles: ["Administrator", "Owner"] },
 { id: "nav-employees", title: "Employees", category: "Employees", href: "/employees", keywords: ["hr", "team", "people"], icon: UsersRound, roles: ["Administrator", "Owner"] },
 { id: "nav-attendance", title: "Attendance", category: "Employees", href: "/attendance", keywords: ["check-in", "check-out", "face", "manual"], icon: Clock3, roles: ["Administrator", "Owner"] },
 { id: "nav-messenger", title: "Company Messenger", category: "Collaboration", href: "/messenger", keywords: ["chat", "messages", "notes", "mentions", "discussion", "collaboration"], icon: MessageSquare, roles: ["Administrator", "Owner"] },
 { id: "nav-notifications", title: "Notification Center", category: "Notifications", href: "/notifications", keywords: ["notifications", "alerts", "reminders", "preferences"], icon: Bell, roles: ["Administrator", "Owner"] },
 { id: "nav-audit-backup", title: "Audit & Backup", category: "System", href: "/audit-backup", keywords: ["audit", "logs", "backup", "restore", "history"], icon: ShieldAlert, roles: ["Administrator", "Owner"] },
 { id: "nav-monitoring", title: "Monitoring", category: "System", href: "/monitoring", keywords: ["monitoring", "health", "performance", "alerts", "reports"], icon: Monitor, roles: ["Administrator", "Owner"] },
];

export const quickCreateActions: QuickCreateAction[] = [
 { label: "Project", href: "/projects", icon: FolderKanban, roles: ["Administrator", "Owner"] },
 { label: "Task", href: "/tasks", icon: SquarePen, roles: ["Administrator", "Owner"] },
 { label: "Employee", href: "/employees", icon: UserPlus, roles: ["Administrator", "Owner"] },
 { label: "Meeting", href: "/meetings", icon: CalendarDays, roles: ["Administrator", "Owner"] },
 { label: "Workflow", href: "/workflows", icon: Workflow, roles: ["Administrator", "Owner"] },
 { label: "Message", href: "/messenger", icon: MessageSquare, roles: ["Administrator", "Owner"] },
];
