import { motion } from "framer-motion";
import {
 BadgeCheck,
 Bell,
 BriefcaseBusiness,
 Camera,
 Check,
 CalendarCheck,
 Clock3,
 Download,
 FileText,
 Globe2,
 Mail,
 MapPin,
 Palette,
 Pencil,
 Save,
 ShieldCheck,
 Sparkles,
 UsersRound,
 WalletCards,
 X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStoredAuthSession, updateStoredSessionUser } from "@shared/auth/auth-service";
import { ChangePasswordCard } from "@shared/auth/components/ChangePasswordCard";
import { ChangePinCard } from "@shared/auth/components/ChangePinCard";
import type { AuthRole } from "@shared/auth/types";
import { getProfileRole, profileDirectory } from "@shared/profile/profile-directory";
import { fetchOwnProfile, updateOwnProfile, type OwnProfileResult } from "@shared/profile/own-profile.api";
import { getInitials } from "@shared/lib/utils";
import { fetchLeadStats, fetchOrgCounts, fetchProjectStats } from "@shared/dashboard-stats/dashboard-stats.api";
import { fetchTaskStats } from "@shared/tasks/tasks.api";
import { fetchIntegrations } from "@shared/integrations/integration.api";
import { fetchTeamAccounts } from "@shared/team-accounts/team-accounts.api";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { useToast } from "@shared/ui/toast-context";

type RoleProfileConfig = {
 name: string;
 title: string;
 company: string;
 department: string;
 employeeId: string;
 email: string;
 phone: string;
 location: string;
 initials: string;
 stats: { label: string; value: string; trend: string; icon: LucideIcon }[];
 skills: string[];
 permissions: string[];
 activity: { title: string; time: string; icon: LucideIcon }[];
};

const profileConfigs: Record<AuthRole, RoleProfileConfig> = {
 Owner: {
 ...profileDirectory.Owner,
 company: "AI Business Operating System",
 department: "Executive Office",
 employeeId: "AIBOS-001",
 email: "owner@aibos.company",
 phone: "+91 98765 43210",
 location: "India",
 stats: [{ label: "Team Members", value: "—", trend: "Loading…", icon: UsersRound }],
 skills: ["Strategy", "Finance", "AI Governance", "Leadership", "Business Intelligence", "Admin Oversight"],
 permissions: ["Full owner dashboard", "Admin access", "Finance reports", "People records", "AI configuration"],
 activity: [],
 },
 Administrator: {
 ...profileDirectory.Administrator,
 company: "AI Business Operating System",
 department: "System Operations",
 employeeId: "AIBOS-ADM",
 email: "admin@aibos.company",
 phone: "+91 90000 10001",
 location: "India",
 stats: [
 { label: "Managed Users", value: "—", trend: "Loading…", icon: UsersRound },
 { label: "Integrations", value: "—", trend: "Loading…", icon: BriefcaseBusiness },
 ],
 skills: ["RBAC", "Security", "Integrations", "AI Config", "Audit", "System Settings"],
 permissions: ["Admin panel", "AI configuration", "Settings", "Integrations", "User management"],
 activity: [],
 },
 Manager: {
 ...profileDirectory.Manager,
 company: "",
 department: "",
 employeeId: "",
 email: "",
 phone: "",
 location: "",
 stats: [
 { label: "Projects", value: "—", trend: "Loading…", icon: BriefcaseBusiness },
 { label: "Open Tasks", value: "—", trend: "Loading…", icon: BadgeCheck },
 { label: "Team Members", value: "—", trend: "Loading…", icon: UsersRound },
 ],
 skills: ["Projects", "Tasks", "Reports", "Team Planning", "Workflow Automation"],
 permissions: ["Manager dashboard", "Projects", "Tasks", "Employees", "Workflows", "Analytics reports"],
 activity: [],
 },
 HR: {
 ...profileDirectory.HR,
 company: "AI Business Operating System",
 department: "Human Resources",
 employeeId: "AIBOS-HR",
 email: "hr@aibos.company",
 phone: "+91 90000 10003",
 location: "India",
 stats: [
 { label: "Employees", value: "—", trend: "Loading…", icon: UsersRound },
 { label: "HR Tasks", value: "—", trend: "Loading…", icon: BadgeCheck },
 { label: "Policy Docs", value: "—", trend: "Loading…", icon: FileText },
 ],
 skills: ["Employee Records", "Onboarding", "Policies", "HR Tasks", "Meetings", "Documents"],
 permissions: ["HR dashboard", "Employees", "Tasks", "Documents", "Meetings"],
 activity: [],
 },
 Sales: {
 ...profileDirectory.Sales,
 company: "AI Business Operating System",
 department: "Sales",
 employeeId: "AIBOS-SAL",
 email: "sales@aibos.company",
 phone: "+91 90000 10004",
 location: "India",
 stats: [
 { label: "Pipeline", value: "—", trend: "Loading…", icon: WalletCards },
 { label: "Active Leads", value: "—", trend: "Loading…", icon: UsersRound },
 { label: "Win Rate", value: "—", trend: "Loading…", icon: WalletCards },
 ],
 skills: ["CRM", "Finance", "Products", "Forecasting", "Customer Follow-up", "Reports"],
 permissions: ["Sales dashboard", "CRM", "Finance", "Products", "Tasks", "Meetings"],
 activity: [],
 },
 Employee: {
 ...profileDirectory.Employee,
 company: "AI Business Operating System",
 department: "Operations",
 employeeId: "AIBOS-EMP",
 email: "employee@aibos.company",
 phone: "+91 90000 10005",
 location: "India",
 stats: [{ label: "Open Tasks", value: "—", trend: "Loading…", icon: BadgeCheck }],
 skills: ["Task Execution", "Meetings", "Documents", "Knowledge Base", "AI Copilot"],
 permissions: ["Employee dashboard", "Tasks", "Documents", "Meetings", "AI copilot"],
 activity: [],
 },
 Finance: {
 ...profileDirectory.Finance,
 company: "AI Business Operating System",
 department: "Finance",
 employeeId: "AIBOS-FIN",
 email: "finance@aibos.company",
 phone: "+91 90000 10006",
 location: "India",
 stats: [{ label: "Open Tasks", value: "—", trend: "Loading…", icon: BadgeCheck }],
 skills: ["Financial Planning", "Analytics", "Reporting", "Forecasting", "AI Consultant", "Compliance"],
 permissions: ["Analytics view", "Report generation", "AI consultant analysis", "Policy view"],
 activity: [],
 },
 Support: {
 ...profileDirectory.Support,
 company: "AI Business Operating System",
 department: "Customer Success",
 employeeId: "AIBOS-SUP",
 email: "support@aibos.company",
 phone: "+91 90000 10007",
 location: "India",
 stats: [],
 skills: ["Customer Support", "Troubleshooting", "User Directory", "Memory Management", "AI Consultant"],
 permissions: ["User directory view", "Memory management", "AI consultant analysis"],
 activity: [],
 },
 Developer: {
 ...profileDirectory.Developer,
 company: "AI Business Operating System",
 department: "Engineering",
 employeeId: "AIBOS-DEV",
 email: "developer@aibos.company",
 phone: "+91 90000 10008",
 location: "India",
 stats: [{ label: "Integrations", value: "—", trend: "Loading…", icon: BriefcaseBusiness }],
 skills: ["Integrations", "AI Systems", "Automation", "Memory Architecture", "Platform Reliability"],
 permissions: ["Integration management", "AI configuration view", "Memory view"],
 activity: [],
 },
};

function SectionCard({ children, subtitle, title }: { children: ReactNode; subtitle?: string; title: string }) {
 return (
 <Card className="glass rounded-lg">
 <CardHeader>
 <CardTitle>{title}</CardTitle>
 {subtitle && <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>}
 </CardHeader>
 <CardContent>{children}</CardContent>
 </Card>
 );
}

function downloadProfile(config: RoleProfileConfig, role: AuthRole) {
 const blob = new Blob([JSON.stringify({ role, profile: config }, null, 2)], { type: "application/json" });
 const url = URL.createObjectURL(blob);
 const link = document.createElement("a");
 link.href = url;
 link.download = `${role.toLowerCase()}-profile.json`;
 link.click();
 URL.revokeObjectURL(url);
}

type ProfileFormState = {
 fullName: string;
 phone: string;
 location: string;
 dateOfBirth: string;
 gender: string;
 nationality: string;
 maritalStatus: string;
 address: string;
 emergencyContact: string;
};

function toFormState(profile: OwnProfileResult | null, fallback: { name: string; phone: string; location: string }): ProfileFormState {
 return {
 fullName: profile?.fullName ?? fallback.name,
 phone: profile?.phone ?? fallback.phone,
 location: profile?.location ?? fallback.location,
 dateOfBirth: profile?.personalInformation?.dateOfBirth ?? "",
 gender: profile?.personalInformation?.gender ?? "",
 nationality: profile?.personalInformation?.nationality ?? "",
 maritalStatus: profile?.personalInformation?.maritalStatus ?? "",
 address: profile?.contact?.address ?? "",
 emergencyContact: profile?.contact?.emergencyContact ?? "",
 };
}

export function RoleProfilePage() {
 const session = getStoredAuthSession();
 const role = getProfileRole(session?.user.role);
 const config = profileConfigs[role];
 const [email] = useState(session?.user.email ?? config.email);
 const [saved, setSaved] = useState(false);
 const [liveStats, setLiveStats] = useState<Record<string, { value: string; trend: string }>>({});
 const [profile, setProfile] = useState<OwnProfileResult | null>(null);
 const [profileLoading, setProfileLoading] = useState(true);
 const [isEditing, setIsEditing] = useState(false);
 const [isSaving, setIsSaving] = useState(false);
 const [form, setForm] = useState<ProfileFormState>(() => toFormState(null, { name: session?.user.fullName ?? config.name, phone: config.phone, location: config.location }));
 const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
 const [avatarError, setAvatarError] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement | null>(null);
 const { toast } = useToast();

 const displayName = profile?.fullName ?? session?.user.fullName ?? config.name;
 const initials = getInitials(displayName);
 const storedAvatar = profile?.avatar && profile.avatar.startsWith("data:image/") ? profile.avatar : null;
 const company = (profile?.companyName ?? session?.user.companyName ?? config.company) || "Not provided";
 const designation = profile?.designation ?? config.title;
 const department = config.department || "Not assigned";
 const employeeId = (profile?.employeeCode ?? profile?.id ?? config.employeeId) || "Not available";
 const exportConfig = {
 ...config,
 name: displayName,
 company,
 department,
 employeeId,
 email,
 phone: form.phone,
 location: form.location,
 };

 const loadProfile = useCallback(async () => {
 setProfileLoading(true);
 try {
 const data = await fetchOwnProfile();
 setProfile(data);
 setForm(toFormState(data, { name: session?.user.fullName ?? config.name, phone: config.phone, location: config.location }));
 } catch {
 // Keep the authenticated session identity visible and leave unavailable fields honest.
 } finally {
 setProfileLoading(false);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 useEffect(() => {
 void loadProfile();
 }, [loadProfile]);

 useEffect(() => {
 let cancelled = false;

 async function load() {
 const next: Record<string, { value: string; trend: string }> = {};

 if (role === "Owner" || role === "Manager" || role === "HR" || role === "Administrator") {
 const accountsResult = await fetchTeamAccounts();
 if (cancelled) return;
 if (accountsResult.status === "ok") {
 const value = { value: String(accountsResult.data.length), trend: "Live count" };
 next["Team Members"] = value;
 next.Employees = value;
 next["Managed Users"] = value;
 }
 }

 if (role === "Administrator" || role === "Developer") {
 const session = getStoredAuthSession();
 try {
 const integrations = await fetchIntegrations(session?.accessToken);
 if (cancelled) return;
 const connected = integrations.filter((integration) => integration.status === "connected").length;
 next.Integrations = { value: String(integrations.length), trend: `${connected} connected` };
 } catch {
 // ignore — leave placeholder value
 }
 }

 if (role === "Manager") {
 const projectStats = await fetchProjectStats();
 if (cancelled) return;
 if (projectStats.status === "ok") {
 next.Projects = { value: String(projectStats.data.active), trend: `${projectStats.data.delayed} delayed` };
 }
 }

 if (role === "HR") {
 const orgCounts = await fetchOrgCounts();
 if (cancelled) return;
 if (orgCounts.status === "ok") {
 next["Policy Docs"] = { value: String(orgCounts.data.policies), trend: "Live count" };
 }
 }

 if (role === "Sales") {
 const leadStats = await fetchLeadStats();
 if (cancelled) return;
 if (leadStats.status === "ok") {
 const winRate = leadStats.data.totalValue > 0 ? Math.round((leadStats.data.wonValue / leadStats.data.totalValue) * 100) : 0;
 next.Pipeline = { value: `$${Math.round(leadStats.data.totalValue / 1000)}K`, trend: "Live total" };
 next["Active Leads"] = { value: String(leadStats.data.total), trend: "Live count" };
 next["Win Rate"] = { value: `${winRate}%`, trend: "Won / total value" };
 }
 }

 if (["Manager", "Employee", "Finance", "Developer"].includes(role)) {
 const [taskStats] = await Promise.all([fetchTaskStats()]);
 if (cancelled) return;
 if (taskStats.status === "ok") {
 const openTasks = taskStats.data.total - (taskStats.data.byStatus.find((entry) => entry.status === "Completed")?.count ?? 0);
 const value = { value: String(openTasks), trend: `${taskStats.data.overdue} overdue` };
 next["Open Tasks"] = value;
 }
 }

 if (!cancelled) {
 setLiveStats(next);
 }
 }

 void load();
 return () => {
 cancelled = true;
 };
 }, [role]);

 const personalInfo = useMemo(
 () => [
 { label: "Full Name", value: displayName },
 { label: "Email", value: email },
 { label: "Phone", value: form.phone || "Not added" },
 { label: "Location", value: form.location || "Not added" },
 ],
 [displayName, email, form.location, form.phone],
 );

 const editableDetails = useMemo(
 () => [
 { label: "Date of Birth", value: form.dateOfBirth || "Not added" },
 { label: "Gender", value: form.gender || "Not added" },
 { label: "Nationality", value: form.nationality || "Not added" },
 { label: "Marital Status", value: form.maritalStatus || "Not added" },
 { label: "Address", value: form.address || "Not added" },
 { label: "Emergency Contact", value: form.emergencyContact || "Not added" },
 ],
 [form.address, form.dateOfBirth, form.emergencyContact, form.gender, form.maritalStatus, form.nationality],
 );

 const updateField = (field: keyof ProfileFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
 setForm((current) => ({ ...current, [field]: event.target.value }));
 };

 const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 event.target.value = "";
 if (!file) return;

 setAvatarError(null);
 if (!file.type.startsWith("image/")) {
 setAvatarError("Please choose an image file.");
 return;
 }
 if (file.size > 2_000_000) {
 setAvatarError("Photo is too large. Please choose an image under 2MB.");
 return;
 }

 const reader = new FileReader();
 reader.onload = () => setAvatarPreview(String(reader.result));
 reader.onerror = () => setAvatarError("Could not read that image. Please try another.");
 reader.readAsDataURL(file);
 };

 const cancelEdit = () => {
 setForm(toFormState(profile, { name: session?.user.fullName ?? config.name, phone: config.phone, location: config.location }));
 setAvatarPreview(null);
 setAvatarError(null);
 setIsEditing(false);
 };

 const saveProfile = async () => {
 setIsSaving(true);
 try {
 const updated = await updateOwnProfile({
 fullName: form.fullName.trim() || undefined,
 avatar: avatarPreview ?? undefined,
 phone: form.phone,
 location: form.location,
 personalInformation: {
 dateOfBirth: form.dateOfBirth,
 gender: form.gender,
 nationality: form.nationality,
 maritalStatus: form.maritalStatus,
 },
 contact: {
 address: form.address,
 emergencyContact: form.emergencyContact,
 },
 });
 setProfile(updated);
 setForm(toFormState(updated, { name: config.name, phone: config.phone, location: config.location }));
 setAvatarPreview(null);
 updateStoredSessionUser({
 fullName: updated.fullName,
 avatar: updated.avatar?.startsWith("data:image/") ? updated.avatar : undefined,
 });
 setIsEditing(false);
 setSaved(true);
 toast({ title: "Profile saved", description: "Your profile has been updated.", type: "success" });
 } catch (error) {
 toast({ title: "Could not save profile", description: (error as Error).message, type: "error" });
 } finally {
 setIsSaving(false);
 }
 };

 const profileSummary = [
 { label: "Profile", value: profileLoading ? "Loading" : profile ? "Backend verified" : "Backend unavailable", icon: CalendarCheck, tone: "text-emerald-600 dark:text-emerald-300" },
 { label: "Account", value: email || "Not available", icon: Clock3, tone: "text-sky-600 dark:text-sky-300" },
 { label: "Access", value: `${role} workspace`, icon: ShieldCheck, tone: "text-primary" },
 { label: "Status", value: saved ? "Changes saved" : "Verified account", icon: Sparkles, tone: "text-amber-600 dark:text-amber-300" },
 ];

 return (
 <main className="min-h-screen bg-enterprise">
 <div className="container space-y-6 py-6">
 <motion.section animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-lg border bg-card shadow-sm" initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.35 }}>
 <div className="relative h-52 bg-[linear-gradient(120deg,rgba(15,23,42,0.82),rgba(37,99,235,0.66),rgba(16,185,129,0.38)),url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=75')] bg-cover bg-center">
 <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
 <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-2">
 <Button className="border bg-background/95 text-foreground hover:bg-background" onClick={() => downloadProfile(exportConfig, role)} size="sm" type="button">
 <Download className="h-4 w-4" />
 Export
 </Button>
 {isEditing ? (
 <>
 <Button disabled={isSaving} onClick={() => void saveProfile()} size="sm" type="button">
 <Save className="h-4 w-4" />
 {isSaving ? "Saving..." : "Save"}
 </Button>
 <Button className="border bg-background/95 text-foreground hover:bg-background" disabled={isSaving} onClick={cancelEdit} size="sm" type="button" variant="outline">
 <X className="h-4 w-4" />
 Cancel
 </Button>
 </>
 ) : (
 <Button className="border bg-background/95 text-foreground hover:bg-background" disabled={profileLoading} onClick={() => setIsEditing(true)} size="sm" type="button">
 <Pencil className="h-4 w-4" />
 {profileLoading ? "Loading..." : "Edit Profile"}
 </Button>
 )}
 </div>
 </div>
 <div className="grid gap-5 px-5 pb-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_360px]">
 <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
 <div className="relative -mt-16 h-28 w-28 shrink-0">
 <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border-4 border-background bg-primary text-3xl font-bold text-primary-foreground shadow-lg">
 {avatarPreview || storedAvatar ? (
 <img alt={displayName} className="h-full w-full object-cover" src={avatarPreview ?? storedAvatar ?? undefined} />
 ) : (
 initials
 )}
 </div>
 {isEditing && (
 <>
 <button
 aria-label="Change profile photo"
 className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg hover:opacity-90"
 onClick={() => fileInputRef.current?.click()}
 type="button"
 >
 <Camera className="h-4 w-4" />
 </button>
 <input accept="image/*" className="hidden" onChange={handleAvatarChange} ref={fileInputRef} type="file" />
 </>
 )}
 </div>
 <div className="min-w-0 flex-1 pb-1">
 <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
 <div className="min-w-0">
 <p className="text-sm font-semibold text-primary">{role} Profile</p>
 {isEditing ? (
 <Input
 className="mt-2 max-w-sm bg-background text-2xl font-bold"
 onChange={updateField("fullName")}
 value={form.fullName}
 />
 ) : (
 <h1 className="mt-2 text-3xl font-bold">{displayName}</h1>
 )}
 <p className="mt-2 text-sm text-muted-foreground">
 {designation} - {company}
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <span className="rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{role}</span>
 <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
 {saved ? "Saved" : "Verified"}
 </span>
 </div>
 </div>
 {avatarError && <p className="mt-2 text-xs font-medium text-destructive">{avatarError}</p>}
 </div>
 </div>
 <div className="grid gap-2 sm:grid-cols-2">
 {profileSummary.map((item) => {
 const Icon = item.icon;
 return (
 <div className="rounded-lg border bg-background p-3" key={item.label}>
 <Icon className={`mb-2 h-4 w-4 ${item.tone}`} />
 <p className="text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
 <p className="mt-1 truncate text-sm font-semibold">{item.value}</p>
 </div>
 );
 })}
 </div>
 </div>
 </motion.section>

 <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {config.stats.map((stat, index) => {
 const Icon = stat.icon;
 const live = liveStats[stat.label];
 const value = live?.value ?? stat.value;
 const trend = live?.trend ?? stat.trend;
 return (
 <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 14 }} key={stat.label} transition={{ delay: index * 0.04 }}>
 <Card className="glass rounded-lg">
 <CardContent className="p-5">
 <Icon className="mb-4 h-5 w-5 text-primary" />
 <p className="text-sm text-muted-foreground">{stat.label}</p>
 <p className="mt-3 text-3xl font-bold">{value}</p>
 <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-300">{trend}</p>
 </CardContent>
 </Card>
 </motion.div>
 );
 })}
 </section>

 <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
 <div className="space-y-6">
 <SectionCard subtitle="Role-correct identity for the current signed-in session." title="Personal Information">
 <div className="grid gap-4 sm:grid-cols-2">
 {personalInfo.map((item) => (
 <div className="rounded-lg border bg-background p-4" key={item.label}>
 <p className="text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
 <p className="mt-2 text-sm font-semibold">{item.value}</p>
 </div>
 ))}
 </div>
 </SectionCard>

 <SectionCard subtitle={isEditing ? "Update your contact details below." : "Your email, phone, and location."} title="Contact Settings">
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="profileEmail">Email</Label>
 <Input disabled id="profileEmail" value={email} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="profilePhone">Phone</Label>
 <Input disabled={!isEditing} id="profilePhone" onChange={updateField("phone")} value={form.phone} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="profileLocation">Location</Label>
 <Input disabled={!isEditing} id="profileLocation" onChange={updateField("location")} value={form.location} />
 </div>
 </div>
 </SectionCard>

 <SectionCard subtitle={isEditing ? "Update your personal and emergency details." : "Personal and emergency contact details."} title="Additional Details">
 {isEditing ? (
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="profileDob">Date of Birth</Label>
 <Input id="profileDob" onChange={updateField("dateOfBirth")} value={form.dateOfBirth} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="profileGender">Gender</Label>
 <Input id="profileGender" onChange={updateField("gender")} value={form.gender} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="profileNationality">Nationality</Label>
 <Input id="profileNationality" onChange={updateField("nationality")} value={form.nationality} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="profileMarital">Marital Status</Label>
 <Input id="profileMarital" onChange={updateField("maritalStatus")} value={form.maritalStatus} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="profileAddress">Address</Label>
 <Input id="profileAddress" onChange={updateField("address")} value={form.address} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="profileEmergency">Emergency Contact</Label>
 <Input id="profileEmergency" onChange={updateField("emergencyContact")} value={form.emergencyContact} />
 </div>
 </div>
 ) : (
 <div className="grid gap-4 sm:grid-cols-2">
 {editableDetails.map((item) => (
 <div className="rounded-lg border bg-background p-4" key={item.label}>
 <p className="text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
 <p className="mt-2 text-sm font-semibold">{item.value}</p>
 </div>
 ))}
 </div>
 )}
 </SectionCard>

 <SectionCard subtitle="Company membership and role scope." title="Company Information">
 <div className="grid gap-4 sm:grid-cols-2">
 {[
 { label: "Company", value: company },
 { label: "Department", value: department },
 { label: "Role", value: role },
 { label: "Employee ID", value: employeeId },
 ].map((item) => (
 <div className="rounded-lg border bg-background p-4" key={item.label}>
 <p className="text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
 <p className="mt-2 text-sm font-semibold">{item.value}</p>
 </div>
 ))}
 </div>
 </SectionCard>

 <SectionCard title="Skills">
 <div className="flex flex-wrap gap-2">
 {config.skills.map((skill) => (
 <span className="rounded-md border bg-background px-3 py-1.5 text-sm font-semibold" key={skill}>
 {skill}
 </span>
 ))}
 </div>
 </SectionCard>

 <SectionCard title="Recent Activity">
 <div className="space-y-3">
 {config.activity.length === 0 && (
 <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">No live profile activity is available yet.</p>
 )}
 {config.activity.map((item) => {
 const Icon = item.icon;
 return (
 <div className="flex items-start gap-3 rounded-lg border bg-background p-4" key={item.title}>
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
 <Icon className="h-4 w-4" />
 </span>
 <div>
 <p className="text-sm font-semibold">{item.title}</p>
 <p className="mt-1 text-xs text-muted-foreground">{item.time}</p>
 </div>
 </div>
 );
 })}
 </div>
 </SectionCard>
 </div>

 <div className="space-y-6">
 <SectionCard subtitle="What this role can access." title="Permissions">
 <div className="space-y-3">
 {config.permissions.map((permission) => (
 <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4" key={permission}>
 <span className="text-sm font-semibold">{permission}</span>
 <Check className="h-4 w-4 text-emerald-500" />
 </div>
 ))}
 </div>
 </SectionCard>

 <SectionCard subtitle="Update the password used to sign in." title="Change Password">
 <ChangePasswordCard />
 </SectionCard>

 <SectionCard subtitle="Sign in quickly with a 6-digit PIN instead of your password." title="Sign-in PIN">
 <ChangePinCard />
 </SectionCard>

 <SectionCard title="Preferences">
 <div className="grid gap-3 sm:grid-cols-2">
 {[
 { label: "Theme", value: "Dark and light mode", icon: Palette },
 { label: "Language", value: "English", icon: Globe2 },
 { label: "Timezone", value: "Asia/Kolkata", icon: MapPin },
 { label: "Digest", value: `${role} updates`, icon: Bell },
 { label: "Email", value: email, icon: Mail },
 { label: "Workspace", value: `${role} view`, icon: BriefcaseBusiness },
 ].map((item) => {
 const Icon = item.icon;
 return (
 <div className="rounded-lg border bg-background p-4" key={item.label}>
 <Icon className="mb-3 h-4 w-4 text-primary" />
 <p className="text-sm font-semibold">{item.label}</p>
 <p className="mt-1 truncate text-xs text-muted-foreground">{item.value}</p>
 </div>
 );
 })}
 </div>
 </SectionCard>

 <Card className="rounded-lg bg-foreground text-background dark:bg-white dark:text-slate-950">
 <CardContent className="p-5">
 <ShieldCheck className="mb-4 h-5 w-5" />
 <p className="text-sm font-semibold">Security Tip</p>
 <p className="mt-2 text-sm leading-6 opacity-75">Change your password regularly and never share it with anyone.</p>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 </main>
 );
}
