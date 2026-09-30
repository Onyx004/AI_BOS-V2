export type PermissionModule =
  | "Organization"
  | "Department"
  | "Branch"
  | "Team"
  | "Holiday"
  | "Approval"
  | "Project"
  | "Task"
  | "CRM"
  | "Finance"
  | "Workflow"
  | "Document"
  | "Product"
  | "Meeting"
  | "Analytics"
  | "Integration"
  | "User Management"
  | "Role Management"
  | "Collaboration"
  | "Notification"
  | "Audit"
  | "Backup"
  | "Device Security";

export type PermissionCatalogEntry = {
  key: string;
  module: PermissionModule;
  label: string;
  description: string;
};

export const permissionCatalog: PermissionCatalogEntry[] = [
  // Organization
  { key: "organization.update", module: "Organization", label: "Update company profile", description: "Edit company name, logo, business type, and tax details." },
  { key: "organization_settings.update", module: "Organization", label: "Update organization settings", description: "Edit business hours, working days, and workspace preferences." },

  // Department
  { key: "department.create", module: "Department", label: "Create department", description: "Create new departments." },
  { key: "department.update", module: "Department", label: "Update department", description: "Edit existing departments." },
  { key: "department.delete", module: "Department", label: "Delete department", description: "Remove departments." },

  // Branch
  { key: "branch.create", module: "Branch", label: "Create branch", description: "Create new branches or office locations." },
  { key: "branch.update", module: "Branch", label: "Update branch", description: "Edit existing branches." },
  { key: "branch.delete", module: "Branch", label: "Delete branch", description: "Remove branches." },

  // Team
  { key: "team.create", module: "Team", label: "Create team", description: "Create new teams." },
  { key: "team.update", module: "Team", label: "Update team", description: "Edit existing teams." },
  { key: "team.delete", module: "Team", label: "Delete team", description: "Remove teams." },

  // Holiday
  { key: "holiday.create", module: "Holiday", label: "Create holiday", description: "Add holiday calendar entries." },
  { key: "holiday.update", module: "Holiday", label: "Update holiday", description: "Edit holiday calendar entries." },
  { key: "holiday.delete", module: "Holiday", label: "Delete holiday", description: "Remove holiday calendar entries." },

  // Approval (policy publish + workflow approval-step actions)
  { key: "policy.create", module: "Approval", label: "Create company policy", description: "Draft new company policies." },
  { key: "policy.update", module: "Approval", label: "Update company policy", description: "Edit company policies." },
  { key: "policy.publish", module: "Approval", label: "Publish company policy", description: "Approve and publish a draft policy." },
  { key: "policy.delete", module: "Approval", label: "Delete company policy", description: "Remove company policies." },
  { key: "policy.view_all", module: "Approval", label: "View all policies", description: "View draft and archived policies, not just published ones." },
  { key: "workflow.approve_step", module: "Approval", label: "Approve workflow step", description: "Approve an approval-type workflow step." },

  // Project
  { key: "project.view_stats", module: "Project", label: "View project stats", description: "View aggregate project statistics." },
  { key: "project.export", module: "Project", label: "Export projects", description: "Export project lists as CSV/PDF." },
  { key: "project.create", module: "Project", label: "Create project", description: "Create new projects." },
  { key: "project.update", module: "Project", label: "Update project", description: "Edit existing projects." },
  { key: "project.delete", module: "Project", label: "Delete project", description: "Remove projects." },
  { key: "project.bulk_update", module: "Project", label: "Bulk update projects", description: "Update multiple projects at once." },
  { key: "project.bulk_delete", module: "Project", label: "Bulk delete projects", description: "Remove multiple projects at once." },
  { key: "project.archive", module: "Project", label: "Archive project", description: "Archive a project." },
  { key: "project.duplicate", module: "Project", label: "Duplicate project", description: "Duplicate an existing project." },

  // Task
  { key: "task.view_stats", module: "Task", label: "View task stats", description: "View aggregate task statistics." },
  { key: "task.export", module: "Task", label: "Export tasks", description: "Export task lists as CSV/PDF." },
  { key: "task.create", module: "Task", label: "Create task", description: "Create new tasks." },
  { key: "task.update", module: "Task", label: "Update task", description: "Edit tasks, including status, checklist, and assignment." },
  { key: "task.delete", module: "Task", label: "Delete task", description: "Remove tasks." },
  { key: "task.bulk_update", module: "Task", label: "Bulk update tasks", description: "Update multiple tasks at once." },
  { key: "task.bulk_delete", module: "Task", label: "Bulk delete tasks", description: "Remove multiple tasks at once." },
  { key: "task.log_time", module: "Task", label: "Log time on task", description: "Log time entries against a task." },
  { key: "task.comment", module: "Task", label: "Comment on task", description: "Post comments on a task." },
  { key: "task.view_team", module: "Task", label: "View team tasks", description: "See a list of people whose tasks you can view, with per-person task summaries, and assign them tasks." },
  { key: "project.comment", module: "Project", label: "Comment on project", description: "Post comments on a project." },

  // Lead
  { key: "lead.view_all", module: "CRM", label: "View leads", description: "View the CRM lead list and lead details." },
  { key: "lead.view_stats", module: "CRM", label: "View lead stats", description: "View aggregate lead/pipeline statistics." },
  { key: "lead.create", module: "CRM", label: "Create lead", description: "Create new CRM leads." },
  { key: "lead.update", module: "CRM", label: "Update lead", description: "Edit leads, including status and owner assignment." },
  { key: "lead.delete", module: "CRM", label: "Delete lead", description: "Remove CRM leads." },

  // CRM (read = view, write = create, update, delete)
  { key: "customer.view", module: "CRM", label: "View customers", description: "View the customers list and details in CRM." },
  { key: "customer.create", module: "CRM", label: "Create customer", description: "Add new customers in CRM." },
  { key: "customer.update", module: "CRM", label: "Update customer", description: "Edit existing customers in CRM." },
  { key: "customer.delete", module: "CRM", label: "Delete customer", description: "Remove customers from CRM." },
  { key: "company.view", module: "CRM", label: "View companies", description: "View the companies list and details in CRM." },
  { key: "company.create", module: "CRM", label: "Create company", description: "Add new companies in CRM." },
  { key: "company.update", module: "CRM", label: "Update company", description: "Edit existing companies in CRM." },
  { key: "company.delete", module: "CRM", label: "Delete company", description: "Remove companies from CRM." },
  { key: "contact.view", module: "CRM", label: "View contacts", description: "View the contacts list and details in CRM." },
  { key: "contact.create", module: "CRM", label: "Create contact", description: "Add new contacts in CRM." },
  { key: "contact.update", module: "CRM", label: "Update contact", description: "Edit existing contacts in CRM." },
  { key: "contact.delete", module: "CRM", label: "Delete contact", description: "Remove contacts from CRM." },
  { key: "deal.view", module: "CRM", label: "View deals and opportunities", description: "View the deals and opportunities list and details in CRM." },
  { key: "deal.create", module: "CRM", label: "Create deal", description: "Add new deals and opportunities in CRM." },
  { key: "deal.update", module: "CRM", label: "Update deal", description: "Edit existing deals and opportunities in CRM." },
  { key: "deal.delete", module: "CRM", label: "Delete deal", description: "Remove deals and opportunities from CRM." },
  { key: "quote.view", module: "CRM", label: "View quotes", description: "View the quotes list and details in CRM." },
  { key: "quote.create", module: "CRM", label: "Create quote", description: "Add new quotes in CRM." },
  { key: "quote.update", module: "CRM", label: "Update quote", description: "Edit existing quotes in CRM." },
  { key: "quote.delete", module: "CRM", label: "Delete quote", description: "Remove quotes from CRM." },
  { key: "followup.view", module: "CRM", label: "View follow-ups", description: "View the follow-ups list and details in CRM." },
  { key: "followup.create", module: "CRM", label: "Create follow-up", description: "Add new follow-ups in CRM." },
  { key: "followup.update", module: "CRM", label: "Update follow-up", description: "Edit existing follow-ups in CRM." },
  { key: "followup.delete", module: "CRM", label: "Delete follow-up", description: "Remove follow-ups from CRM." },
  { key: "crm_meeting.view", module: "CRM", label: "View CRM meetings", description: "View the CRM meetings list and details in CRM." },
  { key: "crm_meeting.create", module: "CRM", label: "Create CRM meeting", description: "Add new CRM meetings in CRM." },
  { key: "crm_meeting.update", module: "CRM", label: "Update CRM meeting", description: "Edit existing CRM meetings in CRM." },
  { key: "crm_meeting.delete", module: "CRM", label: "Delete CRM meeting", description: "Remove CRM meetings from CRM." },

  // Finance
  { key: "finance.view", module: "Finance", label: "View finance records", description: "View income, expenses, invoices, payments, taxes, and budgets." },
  { key: "finance.create", module: "Finance", label: "Create finance records", description: "Record income/expense entries, generate invoices, log payments, taxes, and budgets." },
  { key: "finance.update", module: "Finance", label: "Update finance records", description: "Edit finance records and update invoice status." },
  { key: "finance.delete", module: "Finance", label: "Delete finance records", description: "Remove finance records." },
  { key: "finance.export", module: "Finance", label: "Export finance records", description: "Export finance data and invoices." },

  // Workflow
  { key: "workflow.view_stats", module: "Workflow", label: "View workflow stats", description: "View aggregate workflow statistics." },
  { key: "workflow.create", module: "Workflow", label: "Create workflow", description: "Create new workflows." },
  { key: "workflow.update", module: "Workflow", label: "Update workflow", description: "Edit existing workflows." },
  { key: "workflow.delete", module: "Workflow", label: "Delete workflow", description: "Remove workflows." },
  { key: "workflow.duplicate", module: "Workflow", label: "Duplicate workflow", description: "Duplicate an existing workflow." },
  { key: "workflow.toggle_status", module: "Workflow", label: "Toggle workflow status", description: "Activate or pause a workflow." },
  { key: "workflow.execute", module: "Workflow", label: "Execute workflow", description: "Run a workflow." },

  // Document
  { key: "document.view_all", module: "Document", label: "View documents", description: "View the document catalog and file metadata." },
  { key: "document.upload", module: "Document", label: "Upload document", description: "Upload new files into the document catalog." },
  { key: "document.update", module: "Document", label: "Update document", description: "Edit document metadata, tags, and sharing." },
  { key: "document.delete", module: "Document", label: "Delete document", description: "Remove documents." },
  { key: "document.download", module: "Document", label: "Download document", description: "Download a document's file." },

  // Product
  { key: "product.view_all", module: "Product", label: "View products", description: "View the product catalog." },
  { key: "product.create", module: "Product", label: "Create product", description: "Create new products." },
  { key: "product.update", module: "Product", label: "Update product", description: "Edit existing products." },
  { key: "product.delete", module: "Product", label: "Delete product", description: "Remove products." },

  // Meeting
  { key: "meeting.view_all", module: "Meeting", label: "View meetings", description: "View scheduled and synced meetings." },
  { key: "meeting.create", module: "Meeting", label: "Create meeting", description: "Schedule new meetings." },
  { key: "meeting.update", module: "Meeting", label: "Update meeting", description: "Edit existing meetings." },
  { key: "meeting.delete", module: "Meeting", label: "Delete meeting", description: "Remove meetings." },

  // Analytics
  { key: "analytics.view", module: "Analytics", label: "View analytics", description: "View business analytics dashboards." },
  { key: "analytics.export", module: "Analytics", label: "Export analytics", description: "Export analytics reports." },

  // Integration
  { key: "integration.manage", module: "Integration", label: "Manage integrations", description: "Connect, sync, and manage third-party integrations." },

  // User Management
  { key: "user.view_all", module: "User Management", label: "View all users", description: "View the full user directory." },
  { key: "user.create", module: "User Management", label: "Create user profile", description: "Create new user accounts for the roles you're allowed to manage." },
  { key: "user.edit", module: "User Management", label: "Edit employee profile", description: "Edit employee profile details such as department, designation, and salary." },

  // Role Management
  { key: "role.view", module: "Role Management", label: "View roles", description: "View roles and the permission matrix." },
  { key: "role.create", module: "Role Management", label: "Create role", description: "Create new custom roles." },
  { key: "role.update", module: "Role Management", label: "Update role", description: "Edit role permissions." },
  { key: "role.delete", module: "Role Management", label: "Delete role", description: "Remove custom roles." },
  { key: "role_template.manage", module: "Role Management", label: "Manage role templates", description: "Create and edit role templates." },
  { key: "permission_group.manage", module: "Role Management", label: "Manage permission groups", description: "Create and edit permission groups." },
  { key: "permission_audit.view", module: "Role Management", label: "View permission audit log", description: "View the permission audit trail." },
  { key: "role_history.view", module: "Role Management", label: "View role history", description: "View role permission change history." },

  // Collaboration
  { key: "collaboration.moderate", module: "Collaboration", label: "Moderate collaboration", description: "Delete or pin other members' messages, and archive or manage rooms." },

  // Notification
  { key: "notification.broadcast", module: "Notification", label: "Broadcast notifications", description: "Compose and schedule notifications targeted at roles, teams, or the whole organization." },

  // Audit
  { key: "audit.view", module: "Audit", label: "View audit logs", description: "Search, filter, and export the system-wide audit trail." },

  // Backup
  { key: "backup.manage", module: "Backup", label: "Manage backups", description: "Run, schedule, download, and restore system backups." },
  // Device Security
  { key: "security.view", module: "Device Security", label: "View security dashboard", description: "View security dashboard, login history, and security events." },
  { key: "device.credential.view", module: "Device Security", label: "View device credentials", description: "View managed-device credential metadata and security status." },
  { key: "device.credential.rotate", module: "Device Security", label: "Rotate device credentials", description: "Authorize secure rotation of managed-device authentication credentials." },
  { key: "device.credential.revoke", module: "Device Security", label: "Revoke device credentials", description: "Revoke a managed-device credential and block future per-device authentication." },  { key: "device.auth.migration_status", module: "Device Security", label: "View device auth migration status", description: "View legacy authentication compatibility and strict-cutover configuration status." },
  { key: "device.command.view", module: "Device Security", label: "View device commands", description: "View managed-device command history and execution status." },
  { key: "device.command.execute", module: "Device Security", label: "Execute device commands", description: "Queue approved non-power commands for managed devices." },
  { key: "device.command.power", module: "Device Security", label: "Control device power", description: "Authorize approved restart and shutdown actions for managed devices." },
  { key: "device.monitoring.view", module: "Device Security", label: "View device monitoring", description: "View managed endpoints, telemetry, inventory, usage, update status, and device details." },
  { key: "device.software.manage", module: "Device Security", label: "Manage device software", description: "Manage approved software packages and endpoint install, update, and uninstall actions." },
  { key: "device.restriction.manage", module: "Device Security", label: "Manage application restrictions", description: "View and change managed-device application restriction policies." },
  { key: "device.remote_support.create", module: "Device Security", label: "Create remote support sessions", description: "Request and view consented remote support sessions." },
  { key: "device.remote_support.control", module: "Device Security", label: "Control remote support sessions", description: "Send authorized remote input during a consented remote support session." },
];

export const permissionKeys = permissionCatalog.map((entry) => entry.key) as [string, ...string[]];

export type PermissionKey = (typeof permissionKeys)[number];



export const crmResourcePermissionPrefixes = ["customer", "company", "contact", "deal", "quote", "followup", "crm_meeting"] as const;

/** Every CRM permission key, including the pre-existing lead.* set. */
export const crmPermissionKeys: string[] = permissionCatalog.filter((entry) => entry.module === "CRM").map((entry) => entry.key);

/** What the built-in Sales role gets by default: read/write/update everything, but no deletes and no quotes. */
export const salesDefaultCrmPermissionKeys: string[] = crmPermissionKeys.filter(
  (key) => !key.endsWith(".delete") && !key.startsWith("quote."),
);
