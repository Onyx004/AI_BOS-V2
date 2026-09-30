import {
 Bell,
 DatabaseBackup,
 Fingerprint,
 Globe2,
 KeyRound,
 Mail,
 Palette,
 Phone,
 ShieldCheck,
 UploadCloud,
} from "lucide-react";

export const companySettings = {
 name: "Nexora Softworks Pvt. Ltd.",
 email: "admin@nexorasoftworks.dev",
 phone: "+91 80 4567 2100",
 timezone: "Asia/Kolkata",
 language: "English",
};

export const brandColors = [
 { name: "Blue", value: "#2563eb" },
 { name: "Emerald", value: "#10b981" },
 { name: "Amber", value: "#f59e0b" },
 { name: "Rose", value: "#f43f5e" },
 { name: "Slate", value: "#334155" },
];

export const settingsSections = [
 { title: "Company", description: "Workspace identity, logo, and primary contact details.", icon: UploadCloud },
 { title: "Notification", description: "Control system, email, and in-app notifications.", icon: Bell },
 { title: "Security", description: "Authentication, password policies, sessions, and access controls.", icon: ShieldCheck },
 { title: "API Keys", description: "Manage integration keys for future automation and AI services.", icon: KeyRound },
 { title: "Backup", description: "Configure company data backup, retention, and recovery preferences.", icon: DatabaseBackup },
 { title: "Appearance", description: "Theme, brand color, layout density, and interface preferences.", icon: Palette },
];

export const notificationOptions = [
 "Project updates",
 "Employee approvals",
 "CRM activity",
 "Finance alerts",
];

export const securityOptions = [
 { label: "Require two-factor authentication", enabled: true, icon: Fingerprint },
 { label: "Force password rotation every 90 days", enabled: false, icon: ShieldCheck },
 { label: "Notify admins on new device login", enabled: true, icon: Bell },
];

export const apiKeys = [
 { name: "Production API Key", status: "Active", created: "Jul 18, 2026" },
 { name: "Automation Webhook Key", status: "Restricted", created: "Jul 10, 2026" },
];

export const backupOptions = [
 { label: "Daily encrypted backup", value: "Enabled" },
 { label: "Retention period", value: "90 days" },
 { label: "Backup region", value: "India" },
];

export const companyInfoCards = [
 { label: "Email", value: companySettings.email, icon: Mail },
 { label: "Phone", value: companySettings.phone, icon: Phone },
 { label: "Timezone", value: companySettings.timezone, icon: Globe2 },
];

export const aiIntegrations = [
 {
 id: "int_openai",
 type: "openai",
 name: "OpenAI",
 description: "GPT-4, ChatGPT, and other OpenAI models for AI assistance.",
 icon: "🤖",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "daily",
 createdAt: "2026-07-18",
 },
 {
 id: "int_gemini",
 type: "gemini",
 name: "Google Gemini",
 description: "Google's Gemini AI models for advanced reasoning.",
 icon: "💎",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "daily",
 createdAt: "2026-07-18",
 },
 {
 id: "int_groq",
 type: "groq",
 name: "Groq",
 description: "Fast inference for real-time AI responses.",
 icon: "⚡",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "realtime",
 createdAt: "2026-07-18",
 },
 {
 id: "int_openrouter",
 type: "openrouter",
 name: "OpenRouter",
 description: "Access to multiple AI models through one API.",
 icon: "🔗",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "daily",
 createdAt: "2026-07-18",
 },
 {
 id: "int_ollama",
 type: "ollama",
 name: "Ollama",
 description: "Local AI models for privacy-focused processing.",
 icon: "🏠",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "manual",
 createdAt: "2026-07-18",
 },
 {
 id: "int_google_drive",
 type: "google_drive",
 name: "Google Drive",
 description: "File storage and document management.",
 icon: "📁",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "hourly",
 createdAt: "2026-07-18",
 },
 {
 id: "int_google_calendar",
 type: "google_calendar",
 name: "Google Calendar",
 description: "Calendar integration for meeting scheduling.",
 icon: "📅",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "realtime",
 createdAt: "2026-07-18",
 },
 {
 id: "int_gmail",
 type: "gmail",
 name: "Gmail",
 description: "Email integration for notifications and reports.",
 icon: "📧",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "hourly",
 createdAt: "2026-07-18",
 },
 {
 id: "int_slack",
 type: "slack",
 name: "Slack",
 description: "Team communication and notifications.",
 icon: "💬",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "realtime",
 createdAt: "2026-07-18",
 },
 {
 id: "int_teams",
 type: "teams",
 name: "Microsoft Teams",
 description: "Microsoft Teams integration for collaboration.",
 icon: "👥",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "realtime",
 createdAt: "2026-07-18",
 },
 {
 id: "int_zoom",
 type: "zoom",
 name: "Zoom",
 description: "Video conferencing for meetings.",
 icon: "🎥",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "manual",
 createdAt: "2026-07-18",
 },
 {
 id: "int_github",
 type: "github",
 name: "GitHub",
 description: "Code repository and project management.",
 icon: "🐙",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "daily",
 createdAt: "2026-07-18",
 },
 {
 id: "int_jira",
 type: "jira",
 name: "Jira",
 description: "Project management and issue tracking.",
 icon: "🎫",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "hourly",
 createdAt: "2026-07-18",
 },
 {
 id: "int_dropbox",
 type: "dropbox",
 name: "Dropbox",
 description: "Cloud file storage and sharing.",
 icon: "📦",
 status: "disconnected",
 permissions: ["read", "write"],
 syncFrequency: "daily",
 createdAt: "2026-07-18",
 },
];

export const integrationLogs: Record<string, { id: string; integrationId: string; timestamp: string; action: string; status: "success" | "error" | "warning"; message: string }[]> = {
 int_openai: [
 { id: "log-1", integrationId: "int_openai", action: "Connection test", status: "success", message: "API key validated successfully", timestamp: "2026-07-18T10:00:00Z" },
 ],
 int_gemini: [
 { id: "log-2", integrationId: "int_gemini", action: "Connection test", status: "error", message: "Invalid API key", timestamp: "2026-07-18T10:00:00Z" },
 ],
};
