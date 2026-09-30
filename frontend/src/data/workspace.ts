import {
 Bell,
 BriefcaseBusiness,
 CalendarDays,
 ContactRound,
 FileText,
 MessageSquare,
 Package,
 ReceiptText,
 SquarePen,
 UserPlus,
 UsersRound,
 WalletCards,
} from "lucide-react";
import { crmViewPermissions } from "@shared/crm/permissions";
import type { QuickCreateAction, WorkspaceSearchItem } from "@shared/platform/types";

export const frontlineRoles = ["Manager", "Employee", "HR", "Finance", "Sales", "Support", "Developer"] as const;
export const managerRoles = ["Manager"] as const;
export const employeeDirectoryRoles = ["Manager", "HR"] as const;
export const hrRoles = ["HR"] as const;
export const documentRoles = ["Employee", "HR", "Finance", "Sales", "Support", "Developer"] as const;
export const salesRoles = ["Sales"] as const;
export const financeRoles = ["Finance", "Sales"] as const;

export const workspaceSearchItems: WorkspaceSearchItem[] = [
 { id: "nav-dashboard", title: "Dashboard", category: "Navigation", href: "/dashboard", keywords: ["home", "overview"], icon: BriefcaseBusiness, roles: frontlineRoles },
 { id: "nav-projects", title: "Projects", category: "Projects", href: "/projects", keywords: ["delivery", "budget", "timeline"], icon: BriefcaseBusiness, roles: managerRoles },
 { id: "nav-workflows", title: "Workflow Automation", category: "Automation", href: "/workflows", keywords: ["workflow", "automation", "triggers", "actions"], icon: SquarePen, roles: managerRoles },
 { id: "nav-tasks", title: "Tasks", category: "Tasks", href: "/tasks", keywords: ["todo", "kanban", "work"], icon: SquarePen, roles: frontlineRoles },
 { id: "nav-employees", title: "Employees", category: "Employees", href: "/employees", keywords: ["hr", "team", "people"], icon: UsersRound, roles: employeeDirectoryRoles },
 { id: "nav-team-accounts", title: "Team Accounts", category: "Employees", href: "/team-accounts", keywords: ["users", "accounts", "create profile", "onboard"], icon: UserPlus, roles: ["HR"] },
 { id: "nav-crm", title: "CRM", category: "Customers", href: "/crm", keywords: ["leads", "customers", "deals"], icon: ContactRound, roles: ["Sales"], permissions: crmViewPermissions },
 { id: "nav-finance", title: "Finance", category: "Finance", href: "/finance", keywords: ["invoice", "payment", "revenue"], icon: WalletCards, roles: financeRoles },
 { id: "nav-products", title: "Products", category: "Products", href: "/products", keywords: ["inventory", "sku", "stock"], icon: Package, roles: ["Sales"] },
 { id: "nav-documents", title: "Documents", category: "Documents", href: "/documents", keywords: ["files", "pdf", "docs"], icon: FileText, roles: documentRoles },
 { id: "nav-meetings", title: "Meetings", category: "Meetings", href: "/meetings", keywords: ["calendar", "zoom", "meet"], icon: CalendarDays, roles: frontlineRoles },
 { id: "nav-messenger", title: "Company Messenger", category: "Collaboration", href: "/messenger", keywords: ["chat", "messages", "notes", "mentions", "discussion", "collaboration"], icon: MessageSquare, roles: frontlineRoles },
 { id: "nav-notifications", title: "Notification Center", category: "Notifications", href: "/notifications", keywords: ["notifications", "alerts", "reminders", "preferences"], icon: Bell, roles: frontlineRoles },
];

export const quickCreateActions: QuickCreateAction[] = [
 { label: "Project", href: "/projects", icon: BriefcaseBusiness, roles: managerRoles },
 { label: "Workflow", href: "/workflows", icon: SquarePen, roles: managerRoles },
 { label: "Task", href: "/tasks", icon: SquarePen, roles: frontlineRoles },
 { label: "Employee", href: "/employees", icon: UserPlus, roles: employeeDirectoryRoles },
 { label: "Customer", href: "/crm", icon: ContactRound, roles: ["Sales"], permissions: ["customer.create"] },
 { label: "Invoice", href: "/finance", icon: ReceiptText, roles: financeRoles },
 { label: "Document", href: "/documents", icon: FileText, roles: documentRoles },
 { label: "Message", href: "/messenger", icon: MessageSquare, roles: frontlineRoles },
];
