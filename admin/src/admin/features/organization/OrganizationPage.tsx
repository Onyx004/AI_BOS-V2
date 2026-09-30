import { motion } from "framer-motion";
import {
 ArrowLeft,
 Building2,
 CalendarDays,
 FileText,
 MapPin,
 Network,
 Pencil,
 Plus,
 Save,
 Settings as SettingsIcon,
 ShieldAlert,
 Trash2,
 UploadCloud,
 Users,
 UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "@shared/auth/auth-service";
import { ThemeToggle } from "@shared/ui/ThemeToggle";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { useConfirm } from "@shared/ui/confirm-dialog-context";
import { Dialog } from "@shared/ui/dialog";
import { EmptyState } from "@shared/ui/empty-state";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { SkeletonCard } from "@shared/ui/skeleton";
import { useToast } from "@shared/ui/toast-context";
import { cn } from "@shared/lib/utils";
import {
 createBranch,
 createDepartment,
 createHoliday,
 createPolicy,
 createTeam,
 deleteBranch,
 deleteDepartment,
 deleteHoliday,
 deletePolicy,
 deleteTeam,
 fetchBranches,
 fetchDepartments,
 fetchHierarchy,
 fetchHolidays,
 fetchOrganization,
 fetchOrganizationSettings,
 fetchPolicies,
 fetchTeams,
 publishPolicy,
 saveOrganization,
 saveOrganizationSettings,
 updateDepartment,
} from "./organization.api";
import {
 activeStatuses,
 branchTypes,
 businessTypes,
 dateFormats,
 defaultOrganization,
 defaultOrganizationSettings,
 emptyBranchForm,
 emptyCompanyPolicyForm,
 emptyDepartmentForm,
 emptyHolidayForm,
 emptyTeamForm,
 holidayTypes,
 policyCategories,
 weekdays,
 type Branch,
 type BranchFormInput,
 type CompanyPolicy,
 type CompanyPolicyFormInput,
 type Department,
 type DepartmentFormInput,
 type Holiday,
 type HolidayFormInput,
 type OrgHierarchyDepartmentNode,
 type OrgHierarchyReportingNode,
 type OrgHierarchyResponse,
 type OrgHierarchyUser,
 type OrganizationForm,
 type OrganizationSettingsForm,
 organizationSchema,
 type Team,
 type TeamFormInput,
} from "./organization.schema";

type OrgTab = "profile" | "departments" | "branches" | "teams" | "hierarchy" | "holidays" | "policies" | "settings";

const tabs: { id: OrgTab; label: string; icon: typeof Building2 }[] = [
 { id: "profile", label: "Profile", icon: Building2 },
 { id: "departments", label: "Departments", icon: Users },
 { id: "branches", label: "Branches", icon: MapPin },
 { id: "teams", label: "Teams", icon: UsersRound },
 { id: "hierarchy", label: "Hierarchy", icon: Network },
 { id: "holidays", label: "Holidays", icon: CalendarDays },
 { id: "policies", label: "Policies", icon: FileText },
 { id: "settings", label: "Settings", icon: SettingsIcon },
];

const textareaClassName =
 "flex min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

const selectClassName = "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary";

function mergeOrganizationSettings(settings: Partial<OrganizationSettingsForm>): OrganizationSettingsForm {
 return {
 ...defaultOrganizationSettings,
 ...settings,
 workspacePreferences: {
 ...defaultOrganizationSettings.workspacePreferences,
 ...(settings.workspacePreferences ?? {}),
 officeLocation: {
 ...defaultOrganizationSettings.workspacePreferences.officeLocation,
 ...(settings.workspacePreferences?.officeLocation ?? {}),
 },
 },
 };
}

function buildOfficeMapUrl(latitude: number, longitude: number) {
 const lat = Number.isFinite(latitude) ? latitude : defaultOrganizationSettings.workspacePreferences.officeLocation.latitude;
 const lng = Number.isFinite(longitude) ? longitude : defaultOrganizationSettings.workspacePreferences.officeLocation.longitude;
 const delta = 0.003;
 const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].map((value) => value.toFixed(6)).join("%2C");
 return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}

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

function readFileAsDataUri(file: File): Promise<string> {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => resolve(String(reader.result));
 reader.onerror = () => reject(reader.error);
 reader.readAsDataURL(file);
 });
}

function DepartmentTreeNode({ node }: { node: OrgHierarchyDepartmentNode }) {
 return (
 <div className="rounded-lg border bg-background p-4">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="font-semibold">{node.name}</p>
 {node.code && <p className="text-xs text-muted-foreground">{node.code}</p>}
 </div>
 {node.head && <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Head: {node.head.fullName}</span>}
 </div>
 {node.teams.length > 0 && (
 <div className="mt-3 space-y-2">
 {node.teams.map((team) => (
 <div className="rounded-md border bg-background p-3 text-sm" key={team.id}>
 <span className="font-semibold">{team.name}</span>
 <span className="ml-2 text-xs text-muted-foreground">{team.members.length} members</span>
 </div>
 ))}
 </div>
 )}
 {node.children.length > 0 && (
 <div className="mt-3 space-y-3 border-l pl-4">
 {node.children.map((child) => (
 <DepartmentTreeNode key={child.id} node={child} />
 ))}
 </div>
 )}
 </div>
 );
}

function flattenReportingTree(nodes: OrgHierarchyReportingNode[]): OrgHierarchyUser[] {
 return nodes.flatMap((node) => [
 { id: node.id, fullName: node.fullName, email: node.email, role: node.role },
 ...flattenReportingTree(node.directReports),
 ]);
}

function ReportingTreeNode({ node }: { node: OrgHierarchyReportingNode }) {
 return (
 <div className="rounded-lg border bg-background p-4">
 <p className="font-semibold">{node.fullName}</p>
 <p className="text-xs text-muted-foreground">
 {node.role} - {node.email}
 </p>
 {node.directReports.length > 0 && (
 <div className="mt-3 space-y-3 border-l pl-4">
 {node.directReports.map((report) => (
 <ReportingTreeNode key={report.id} node={report} />
 ))}
 </div>
 )}
 </div>
 );
}

export function OrganizationPage() {
 const session = useMemo(() => getStoredAuthSession(), []);
 const token = session?.accessToken;
 const isAuthorized = session?.user.role === "Administrator" || session?.user.role === "Owner";
 const { toast } = useToast();
 const { confirm } = useConfirm();

 const [activeTab, setActiveTab] = useState<OrgTab>("profile");
 const [loading, setLoading] = useState(true);
 const [savingProfile, setSavingProfile] = useState(false);
 const [savingSettings, setSavingSettings] = useState(false);
 const [detectingOfficeLocation, setDetectingOfficeLocation] = useState(false);

 const [organization, setOrganization] = useState<OrganizationForm>(defaultOrganization);
 const [settings, setSettings] = useState<OrganizationSettingsForm>(defaultOrganizationSettings);
 const [departments, setDepartments] = useState<Department[]>([]);
 const [branches, setBranches] = useState<Branch[]>([]);
 const [teams, setTeams] = useState<Team[]>([]);
 const [holidays, setHolidays] = useState<Holiday[]>([]);
 const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
 const [hierarchy, setHierarchy] = useState<OrgHierarchyResponse | null>(null);
 const employeeOptions = useMemo(() => (hierarchy ? flattenReportingTree(hierarchy.reportingTree) : []), [hierarchy]);
 const officeMapUrl = buildOfficeMapUrl(
 settings.workspacePreferences.officeLocation.latitude,
 settings.workspacePreferences.officeLocation.longitude,
 );

 const [departmentForm, setDepartmentForm] = useState<DepartmentFormInput>(emptyDepartmentForm);
 const [showDepartmentForm, setShowDepartmentForm] = useState(false);
 const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
 const [departmentEditForm, setDepartmentEditForm] = useState<DepartmentFormInput>(emptyDepartmentForm);
 const [savingDepartmentEdit, setSavingDepartmentEdit] = useState(false);
 const [branchForm, setBranchForm] = useState<BranchFormInput>(emptyBranchForm);
 const [showBranchForm, setShowBranchForm] = useState(false);
 const [teamForm, setTeamForm] = useState<TeamFormInput>(emptyTeamForm);
 const [showTeamForm, setShowTeamForm] = useState(false);
 const [holidayForm, setHolidayForm] = useState<HolidayFormInput>(emptyHolidayForm);
 const [showHolidayForm, setShowHolidayForm] = useState(false);
 const [policyForm, setPolicyForm] = useState<CompanyPolicyFormInput>(emptyCompanyPolicyForm);
 const [showPolicyForm, setShowPolicyForm] = useState(false);

 useEffect(() => {
 if (!isAuthorized) {
 setLoading(false);
 return;
 }

 const load = async () => {
 try {
 const [org, orgSettings, deptRes, branchRes, teamRes, holidayRes, policyRes, hierarchyRes] = await Promise.all([
 fetchOrganization(token),
 fetchOrganizationSettings(token),
 fetchDepartments(token),
 fetchBranches(token),
 fetchTeams(token),
 fetchHolidays(token),
 fetchPolicies(token),
 fetchHierarchy(token),
 ]);
 setOrganization({ ...defaultOrganization, ...org });
 setSettings(mergeOrganizationSettings(orgSettings));
 setDepartments(deptRes.items);
 setBranches(branchRes.items);
 setTeams(teamRes.items);
 setHolidays(holidayRes.items);
 setPolicies(policyRes.items);
 setHierarchy(hierarchyRes);
 } catch {
 toast({
 title: "Failed to load organization data",
 description: "Check that the backend API is reachable.",
 type: "error",
 });
 } finally {
 setLoading(false);
 }
 };

 void load();
 }, [isAuthorized, token]);

 const saveProfile = async () => {
 setSavingProfile(true);
 try {
 const parsed = organizationSchema.safeParse(organization);
 if (!parsed.success) {
 const firstIssue = parsed.error.issues[0];
 toast({ title: "Check company details", description: firstIssue?.message ?? "Some fields need correction.", type: "error" });
 return;
 }
 const payload: Partial<OrganizationForm> = { ...parsed.data };
 if (!payload.logo) {
 delete payload.logo;
 }
 const saved = await saveOrganization(payload, token);
 setOrganization({ ...defaultOrganization, ...saved });
 toast({ title: "Organization profile saved", type: "success" });
 } catch (error) {
 toast({ title: "Failed to save profile", description: (error as Error).message, type: "error" });
 } finally {
 setSavingProfile(false);
 }
 };

 const handleLogoChange = async (file: File | undefined) => {
 if (!file) return;
 const dataUri = await readFileAsDataUri(file);
 setOrganization((current) => ({ ...current, logo: dataUri }));
 };

 const saveSettings = async () => {
 setSavingSettings(true);
 try {
 const saved = await saveOrganizationSettings(settings, token);
 setSettings(mergeOrganizationSettings(saved));
 toast({ title: "Organization settings saved", type: "success" });
 } catch (error) {
 toast({ title: "Failed to save settings", description: (error as Error).message, type: "error" });
 } finally {
 setSavingSettings(false);
 }
 };

 const useCurrentOfficeLocation = () => {
 if (!navigator.geolocation) {
 toast({ title: "Location not supported", description: "This browser cannot detect current location.", type: "error" });
 return;
 }

 setDetectingOfficeLocation(true);
 navigator.geolocation.getCurrentPosition(
 (position) => {
 setSettings((current) => ({
 ...current,
 workspacePreferences: {
 ...current.workspacePreferences,
 officeLocation: {
 ...current.workspacePreferences.officeLocation,
 latitude: Number(position.coords.latitude.toFixed(6)),
 longitude: Number(position.coords.longitude.toFixed(6)),
 },
 },
 }));
 setDetectingOfficeLocation(false);
 toast({ title: "Office location detected", description: "Review and save settings to apply it.", type: "success" });
 },
 (error) => {
 setDetectingOfficeLocation(false);
 toast({
 title: "Could not detect location",
 description: error.code === error.PERMISSION_DENIED ? "Please allow location permission for this site." : "Try again from the office location.",
 type: "error",
 });
 },
 { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
 );
 };

 const toggleWorkingDay = (day: (typeof weekdays)[number]) => {
 setSettings((current) => ({
 ...current,
 workingDays: current.workingDays.includes(day)
 ? current.workingDays.filter((item) => item !== day)
 : [...current.workingDays, day],
 }));
 };

 const submitDepartment = async () => {
 try {
 const created = await createDepartment(departmentForm, token);
 setDepartments((current) => [...current, created]);
 setDepartmentForm(emptyDepartmentForm);
 setShowDepartmentForm(false);
 toast({ title: "Department created", type: "success" });
 } catch (error) {
 toast({ title: "Failed to create department", description: (error as Error).message, type: "error" });
 }
 };

 const removeDepartment = async (department: Department) => {
  const members = department.memberCount ?? 0;
 const departmentTeams = teams.filter((team) => team.departmentId === department._id);
 const teamsWarning =
 departmentTeams.length > 0
 ? ` Its ${departmentTeams.length} team${departmentTeams.length === 1 ? "" : "s"} (${departmentTeams.map((team) => team.name).join(", ")}) will be deleted too, and team leads lose access to their members' tasks.`
 : "";
 const accepted = await confirm({
 title: departmentTeams.length > 0 ? "Delete department and its teams?" : "Delete department?",
 description: `${department.name} will be deleted. ${members > 0 ? `${members} employee${members === 1 ? "" : "s"} in it will become Unassigned.` : "Employees in it (if any) will become Unassigned."}${teamsWarning}`,
 confirmLabel: departmentTeams.length > 0 ? `Delete department and ${departmentTeams.length} team${departmentTeams.length === 1 ? "" : "s"}` : "Delete",
 tone: "danger",
 });
 if (!accepted) return;
 try {
 const result = await deleteDepartment(department._id, token, { deleteTeams: departmentTeams.length > 0 });
 setDepartments((current) => current.filter((item) => item._id !== department._id));
 setTeams((current) => current.filter((team) => team.departmentId !== department._id));
 const unassigned = result.unassignedEmployees ?? 0;
 const removedTeams = result.deletedTeams ?? 0;
 const details = [
 unassigned > 0 ? `${unassigned} employee${unassigned === 1 ? "" : "s"} moved to Unassigned.` : "",
 removedTeams > 0 ? `${removedTeams} team${removedTeams === 1 ? "" : "s"} deleted.` : "",
 ].filter(Boolean);
 toast({
 title: "Department deleted",
 description: details.length > 0 ? details.join(" ") : undefined,
 type: "success",
 });
 } catch (error) {
 toast({ title: "Failed to delete department", description: (error as Error).message, type: "error" });
 }
 };

 const openEditDepartment = (department: Department) => {
 setEditingDepartment(department);
 setDepartmentEditForm({
 name: department.name,
 code: department.code ?? "",
 description: department.description ?? "",
 headId: department.headId ?? "",
 status: department.status,
 });
 };

 const closeEditDepartment = () => {
 setEditingDepartment(null);
 };

 const saveDepartmentEdit = async () => {
 if (!editingDepartment) return;
 setSavingDepartmentEdit(true);
 try {
 const updated = await updateDepartment(editingDepartment._id, departmentEditForm, token);
 setDepartments((current) => current.map((item) => (item._id === updated._id ? updated : item)));
 setEditingDepartment(null);
 toast({ title: "Department updated", type: "success" });
 } catch (error) {
 toast({ title: "Failed to update department", description: (error as Error).message, type: "error" });
 } finally {
 setSavingDepartmentEdit(false);
 }
 };

 const submitBranch = async () => {
 try {
 const created = await createBranch(branchForm, token);
 setBranches((current) =>
 created.isHeadOffice
 ? [...current.map((item) => ({ ...item, isHeadOffice: false })), created]
 : [...current, created],
 );
 setBranchForm(emptyBranchForm);
 setShowBranchForm(false);
 toast({ title: "Branch created", type: "success" });
 } catch (error) {
 toast({ title: "Failed to create branch", description: (error as Error).message, type: "error" });
 }
 };

 const removeBranch = async (branch: Branch) => {
 const accepted = await confirm({
 title: "Delete branch?",
 description: `${branch.name} will be removed if no departments or employees reference it.`,
 confirmLabel: "Delete",
 tone: "danger",
 });
 if (!accepted) return;
 try {
 await deleteBranch(branch._id, token);
 setBranches((current) => current.filter((item) => item._id !== branch._id));
 toast({ title: "Branch deleted", type: "success" });
 } catch (error) {
 toast({ title: "Failed to delete branch", description: (error as Error).message, type: "error" });
 }
 };

 const submitTeam = async () => {
 try {
 const created = await createTeam(teamForm, token);
 setTeams((current) => [...current, created]);
 setTeamForm(emptyTeamForm);
 setShowTeamForm(false);
 toast({ title: "Team created", type: "success" });
 } catch (error) {
 toast({ title: "Failed to create team", description: (error as Error).message, type: "error" });
 }
 };

 const removeTeam = async (team: Team) => {
 const accepted = await confirm({
 title: "Delete team?",
 description: `${team.name} will be permanently removed.`,
 confirmLabel: "Delete",
 tone: "danger",
 });
 if (!accepted) return;
 try {
 await deleteTeam(team._id, token);
 setTeams((current) => current.filter((item) => item._id !== team._id));
 toast({ title: "Team deleted", type: "success" });
 } catch (error) {
 toast({ title: "Failed to delete team", description: (error as Error).message, type: "error" });
 }
 };

 const submitHoliday = async () => {
 try {
 const created = await createHoliday(holidayForm, token);
 setHolidays((current) => [...current, created].sort((a, b) => a.date.localeCompare(b.date)));
 setHolidayForm(emptyHolidayForm);
 setShowHolidayForm(false);
 toast({ title: "Holiday added", type: "success" });
 } catch (error) {
 toast({ title: "Failed to add holiday", description: (error as Error).message, type: "error" });
 }
 };

 const removeHoliday = async (holiday: Holiday) => {
 const accepted = await confirm({
 title: "Delete holiday?",
 description: `${holiday.name} will be removed from the calendar.`,
 confirmLabel: "Delete",
 tone: "danger",
 });
 if (!accepted) return;
 try {
 await deleteHoliday(holiday._id, token);
 setHolidays((current) => current.filter((item) => item._id !== holiday._id));
 toast({ title: "Holiday deleted", type: "success" });
 } catch (error) {
 toast({ title: "Failed to delete holiday", description: (error as Error).message, type: "error" });
 }
 };

 const submitPolicy = async () => {
 try {
 const created = await createPolicy(policyForm, token);
 setPolicies((current) => [created, ...current]);
 setPolicyForm(emptyCompanyPolicyForm);
 setShowPolicyForm(false);
 toast({ title: "Policy created", type: "success" });
 } catch (error) {
 toast({ title: "Failed to create policy", description: (error as Error).message, type: "error" });
 }
 };

 const doPublishPolicy = async (policy: CompanyPolicy) => {
 try {
 const updated = await publishPolicy(policy._id, token);
 setPolicies((current) => current.map((item) => (item._id === updated._id ? updated : item)));
 toast({ title: "Policy published", type: "success" });
 } catch (error) {
 toast({ title: "Failed to publish policy", description: (error as Error).message, type: "error" });
 }
 };

 const removePolicy = async (policy: CompanyPolicy) => {
 const accepted = await confirm({
 title: "Delete policy?",
 description: `${policy.title} will be permanently removed.`,
 confirmLabel: "Delete",
 tone: "danger",
 });
 if (!accepted) return;
 try {
 await deletePolicy(policy._id, token);
 setPolicies((current) => current.filter((item) => item._id !== policy._id));
 toast({ title: "Policy deleted", type: "success" });
 } catch (error) {
 toast({ title: "Failed to delete policy", description: (error as Error).message, type: "error" });
 }
 };

 if (!isAuthorized) {
 return (
 <main className="flex min-h-screen items-center justify-center bg-enterprise p-4">
 <EmptyState
 action={{ label: "Back to Dashboard", onClick: () => window.location.assign("/dashboard") }}
 description="Only Administrator and Owner users can manage the organization profile, structure, and policies."
 icon={ShieldAlert}
 title="Admin access required"
 />
 </main>
 );
 }

 return (
 <main className="min-h-screen bg-enterprise">
 <header className="sticky top-0 z-40 border-b bg-background ">
 <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
 <div className="flex items-center gap-3">
 <Button asChild size="icon" type="button" variant="outline">
 <Link aria-label="Back to Admin" to="/admin">
 <ArrowLeft className="h-4 w-4" />
 </Link>
 </Button>
 <div>
 <p className="text-sm font-semibold text-primary">Admin / Organization</p>
 <h1 className="text-2xl font-bold">Organization Management</h1>
 </div>
 </div>
 <ThemeToggle />
 </div>
 </header>

 <div className="container space-y-6 py-6">
 <Card className="glass">
 <CardContent className="flex gap-2 overflow-x-auto p-4">
 {tabs.map((tab) => {
 const Icon = tab.icon;
 return (
 <Button
 className="shrink-0"
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 type="button"
 variant={activeTab === tab.id ? "default" : "outline"}
 >
 <Icon className="h-4 w-4" />
 {tab.label}
 </Button>
 );
 })}
 </CardContent>
 </Card>

 {loading ? (
 <div className="grid gap-4 lg:grid-cols-3">
 <SkeletonCard />
 <SkeletonCard />
 <SkeletonCard />
 </div>
 ) : (
 <>
 {activeTab === "profile" && (
 <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }}>
 <SectionCard subtitle="Company identity, logo, business type, and tax details." title="Company Profile">
 <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
 <div className="rounded-lg border bg-background p-4">
 {organization.logo ? (
 <img alt="Company logo" className="aspect-square w-full rounded-lg object-cover" src={organization.logo} />
 ) : (
 <div className="flex aspect-square items-center justify-center rounded-lg bg-primary text-3xl font-bold text-primary-foreground">
 {organization.name.slice(0, 2).toUpperCase() || "CO"}
 </div>
 )}
 <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted">
 <UploadCloud className="h-4 w-4" />
 Upload Logo
 <input
 accept="image/png,image/jpeg,image/webp"
 className="hidden"
 onChange={(event) => void handleLogoChange(event.target.files?.[0])}
 type="file"
 />
 </label>
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="orgName">Company Name</Label>
 <Input id="orgName" value={organization.name} onChange={(event) => setOrganization((c) => ({ ...c, name: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgLegalName">Legal Name</Label>
 <Input id="orgLegalName" value={organization.legalName} onChange={(event) => setOrganization((c) => ({ ...c, legalName: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgBusinessType">Business Type</Label>
 <select
 className={selectClassName}
 id="orgBusinessType"
 value={organization.businessType}
 onChange={(event) => setOrganization((c) => ({ ...c, businessType: event.target.value as OrganizationForm["businessType"] }))}
 >
 {businessTypes.map((type) => (
 <option key={type} value={type}>
 {type}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgGstin">GSTIN</Label>
 <Input id="orgGstin" placeholder="22AAAAA0000A1Z5" value={organization.gstin} onChange={(event) => setOrganization((c) => ({ ...c, gstin: event.target.value.toUpperCase() }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgPan">PAN</Label>
 <Input id="orgPan" value={organization.pan} onChange={(event) => setOrganization((c) => ({ ...c, pan: event.target.value.toUpperCase() }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgTaxId">Tax ID (non-GST)</Label>
 <Input id="orgTaxId" value={organization.taxIdentificationNumber} onChange={(event) => setOrganization((c) => ({ ...c, taxIdentificationNumber: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgEmail">Email</Label>
 <Input id="orgEmail" type="email" value={organization.email} onChange={(event) => setOrganization((c) => ({ ...c, email: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgPhone">Phone</Label>
 <Input id="orgPhone" value={organization.phone} onChange={(event) => setOrganization((c) => ({ ...c, phone: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgWebsite">Website</Label>
 <Input id="orgWebsite" value={organization.website} onChange={(event) => setOrganization((c) => ({ ...c, website: event.target.value }))} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="orgAddress1">Address Line 1</Label>
 <Input id="orgAddress1" value={organization.addressLine1} onChange={(event) => setOrganization((c) => ({ ...c, addressLine1: event.target.value }))} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="orgAddress2">Address Line 2</Label>
 <Input id="orgAddress2" value={organization.addressLine2} onChange={(event) => setOrganization((c) => ({ ...c, addressLine2: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgCity">City</Label>
 <Input id="orgCity" value={organization.city} onChange={(event) => setOrganization((c) => ({ ...c, city: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgState">State</Label>
 <Input id="orgState" value={organization.state} onChange={(event) => setOrganization((c) => ({ ...c, state: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgCountry">Country</Label>
 <Input id="orgCountry" value={organization.country} onChange={(event) => setOrganization((c) => ({ ...c, country: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="orgPincode">Pincode</Label>
 <Input id="orgPincode" value={organization.pincode} onChange={(event) => setOrganization((c) => ({ ...c, pincode: event.target.value }))} />
 </div>
 </div>
 </div>
 <Button className="mt-6" disabled={savingProfile} onClick={saveProfile} type="button">
 <Save className="h-4 w-4" />
 {savingProfile ? "Saving..." : "Save Profile"}
 </Button>
 </SectionCard>
 </motion.div>
 )}

 {activeTab === "departments" && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Departments</h2>
 <Button onClick={() => setShowDepartmentForm((v) => !v)} type="button">
 <Plus className="h-4 w-4" />
 Add Department
 </Button>
 </div>
 {showDepartmentForm && (
 <SectionCard title="New Department">
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="deptName">Name</Label>
 <Input id="deptName" value={departmentForm.name} onChange={(event) => setDepartmentForm((c) => ({ ...c, name: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="deptCode">Code</Label>
 <Input id="deptCode" value={departmentForm.code} onChange={(event) => setDepartmentForm((c) => ({ ...c, code: event.target.value.toUpperCase() }))} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="deptHead">Department Head</Label>
 <select
 className={selectClassName}
 id="deptHead"
 value={departmentForm.headId}
 onChange={(event) => setDepartmentForm((c) => ({ ...c, headId: event.target.value }))}
 >
 <option value="">Select department head</option>
 {employeeOptions.map((employee) => (
 <option key={employee.id} value={employee.id}>
 {employee.fullName} ({employee.role})
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="deptDescription">Description</Label>
 <Input id="deptDescription" value={departmentForm.description} onChange={(event) => setDepartmentForm((c) => ({ ...c, description: event.target.value }))} />
 </div>
 </div>
 <Button className="mt-4" disabled={!departmentForm.name || !departmentForm.headId} onClick={submitDepartment} type="button">
 Create Department
 </Button>
 </SectionCard>
 )}
 {departments.length === 0 ? (
 <EmptyState description="Create your first department to start structuring the organization." icon={Users} title="No departments yet" />
 ) : (
 <div className="grid gap-3 sm:grid-cols-2">
 {departments.map((department) => (
 <Card className="glass" key={department._id}>
 <CardContent className="flex items-start justify-between gap-3 p-4">
 <div>
 <p className="font-semibold">{department.name}</p>
 {department.code && <p className="text-xs text-muted-foreground">{department.code}</p>}
 {department.description && <p className="mt-2 text-sm text-muted-foreground">{department.description}</p>}
 </div>
 <div className="flex shrink-0 gap-2">
 <Button onClick={() => openEditDepartment(department)} size="icon" type="button" variant="outline">
 <Pencil className="h-4 w-4" />
 </Button>
 <Button onClick={() => void removeDepartment(department)} size="icon" type="button" variant="outline">
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 {editingDepartment && (
 <Dialog
 as="form"
 className="max-w-lg"
 onClose={closeEditDepartment}
 onSubmit={(event) => {
 event.preventDefault();
 void saveDepartmentEdit();
 }}
 >
 <div className="mb-4">
 <h2 className="text-xl font-bold">Edit Department</h2>
 <p className="mt-1 text-sm text-muted-foreground">Update {editingDepartment.name}&apos;s details.</p>
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="deptEditName">Name</Label>
 <Input id="deptEditName" value={departmentEditForm.name} onChange={(event) => setDepartmentEditForm((c) => ({ ...c, name: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="deptEditCode">Code</Label>
 <Input id="deptEditCode" value={departmentEditForm.code} onChange={(event) => setDepartmentEditForm((c) => ({ ...c, code: event.target.value.toUpperCase() }))} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="deptEditHead">Department Head</Label>
 <select
 className={selectClassName}
 id="deptEditHead"
 value={departmentEditForm.headId}
 onChange={(event) => setDepartmentEditForm((c) => ({ ...c, headId: event.target.value }))}
 >
 <option value="">Select department head</option>
 {employeeOptions.map((employee) => (
 <option key={employee.id} value={employee.id}>
 {employee.fullName} ({employee.role})
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="deptEditDescription">Description</Label>
 <Input id="deptEditDescription" value={departmentEditForm.description} onChange={(event) => setDepartmentEditForm((c) => ({ ...c, description: event.target.value }))} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="deptEditStatus">Status</Label>
 <select
 className={selectClassName}
 id="deptEditStatus"
 value={departmentEditForm.status}
 onChange={(event) => setDepartmentEditForm((c) => ({ ...c, status: event.target.value as DepartmentFormInput["status"] }))}
 >
 {activeStatuses.map((status) => (
 <option key={status} value={status}>
 {status}
 </option>
 ))}
 </select>
 </div>
 </div>
 <div className="mt-6 flex justify-end gap-3">
 <Button onClick={closeEditDepartment} type="button" variant="outline">
 Cancel
 </Button>
 <Button disabled={savingDepartmentEdit || !departmentEditForm.name || !departmentEditForm.headId} type="submit">
 {savingDepartmentEdit ? "Saving..." : "Save Changes"}
 </Button>
 </div>
 </Dialog>
 )}
 </div>
 )}

 {activeTab === "branches" && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Branches &amp; Office Locations</h2>
 <Button onClick={() => setShowBranchForm((v) => !v)} type="button">
 <Plus className="h-4 w-4" />
 Add Branch
 </Button>
 </div>
 {showBranchForm && (
 <SectionCard title="New Branch">
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="branchName">Name</Label>
 <Input id="branchName" value={branchForm.name} onChange={(event) => setBranchForm((c) => ({ ...c, name: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="branchType">Type</Label>
 <select
 className={selectClassName}
 id="branchType"
 value={branchForm.type}
 onChange={(event) => setBranchForm((c) => ({ ...c, type: event.target.value as BranchFormInput["type"] }))}
 >
 {branchTypes.map((type) => (
 <option key={type} value={type}>
 {type}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="branchAddress">Address Line 1</Label>
 <Input id="branchAddress" value={branchForm.addressLine1} onChange={(event) => setBranchForm((c) => ({ ...c, addressLine1: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="branchCity">City</Label>
 <Input id="branchCity" value={branchForm.city} onChange={(event) => setBranchForm((c) => ({ ...c, city: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="branchState">State</Label>
 <Input id="branchState" value={branchForm.state} onChange={(event) => setBranchForm((c) => ({ ...c, state: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="branchPincode">Pincode</Label>
 <Input id="branchPincode" value={branchForm.pincode} onChange={(event) => setBranchForm((c) => ({ ...c, pincode: event.target.value }))} />
 </div>
 <label className="flex items-center gap-3 rounded-lg border bg-background p-3">
 <input checked={branchForm.isHeadOffice} className="h-4 w-4 accent-primary" onChange={(event) => setBranchForm((c) => ({ ...c, isHeadOffice: event.target.checked }))} type="checkbox" />
 <span className="text-sm font-semibold">Set as Head Office</span>
 </label>
 </div>
 <Button className="mt-4" disabled={!branchForm.name || !branchForm.addressLine1 || !branchForm.city || !branchForm.state || !branchForm.pincode} onClick={submitBranch} type="button">
 Create Branch
 </Button>
 </SectionCard>
 )}
 {branches.length === 0 ? (
 <EmptyState description="Add your first office location or branch." icon={MapPin} title="No branches yet" />
 ) : (
 <div className="grid gap-3 sm:grid-cols-2">
 {branches.map((branch) => (
 <Card className="glass" key={branch._id}>
 <CardContent className="flex items-start justify-between gap-3 p-4">
 <div>
 <p className="font-semibold">{branch.name}</p>
 <p className="text-xs text-muted-foreground">
 {branch.city}, {branch.state} - {branch.pincode}
 </p>
 {branch.isHeadOffice && <span className="mt-2 inline-block rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Head Office</span>}
 </div>
 <Button onClick={() => void removeBranch(branch)} size="icon" type="button" variant="outline">
 <Trash2 className="h-4 w-4" />
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>
 )}

 {activeTab === "teams" && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Teams</h2>
 <Button disabled={departments.length === 0} onClick={() => setShowTeamForm((v) => !v)} type="button">
 <Plus className="h-4 w-4" />
 Add Team
 </Button>
 </div>
 {departments.length === 0 && (
 <p className="text-sm text-muted-foreground">Create a department first before adding teams.</p>
 )}
 {showTeamForm && (
 <SectionCard title="New Team">
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="teamName">Name</Label>
 <Input id="teamName" value={teamForm.name} onChange={(event) => setTeamForm((c) => ({ ...c, name: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="teamDepartment">Department</Label>
 <select
 className={selectClassName}
 id="teamDepartment"
 value={teamForm.departmentId}
 onChange={(event) => setTeamForm((c) => ({ ...c, departmentId: event.target.value }))}
 >
 <option value="">Select department</option>
 {departments.map((department) => (
 <option key={department._id} value={department._id}>
 {department.name}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="teamDescription">Description</Label>
 <Input id="teamDescription" value={teamForm.description} onChange={(event) => setTeamForm((c) => ({ ...c, description: event.target.value }))} />
 </div>
 </div>
 <Button className="mt-4" disabled={!teamForm.name || !teamForm.departmentId} onClick={submitTeam} type="button">
 Create Team
 </Button>
 </SectionCard>
 )}
 {teams.length === 0 ? (
 <EmptyState description="Create teams under your departments." icon={UsersRound} title="No teams yet" />
 ) : (
 <div className="grid gap-3 sm:grid-cols-2">
 {teams.map((team) => (
 <Card className="glass" key={team._id}>
 <CardContent className="flex items-start justify-between gap-3 p-4">
 <div>
 <p className="font-semibold">{team.name}</p>
 <p className="text-xs text-muted-foreground">
 {departments.find((department) => department._id === team.departmentId)?.name ?? "Unknown department"}
 </p>
 </div>
 <Button onClick={() => void removeTeam(team)} size="icon" type="button" variant="outline">
 <Trash2 className="h-4 w-4" />
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>
 )}

 {activeTab === "hierarchy" && (
 <div className="grid gap-6 xl:grid-cols-2">
 <SectionCard subtitle="Departments, their teams, and department heads." title="Department Structure">
 {!hierarchy || hierarchy.departments.length === 0 ? (
 <EmptyState description="Create departments and teams to see the structure here." icon={Network} title="Nothing to show yet" />
 ) : (
 <div className="space-y-3">
 {hierarchy.departments.map((node) => (
 <DepartmentTreeNode key={node.id} node={node} />
 ))}
 </div>
 )}
 </SectionCard>
 <SectionCard subtitle="Manager-to-report chains derived from employee records." title="Reporting Structure">
 {!hierarchy || hierarchy.reportingTree.length === 0 ? (
 <EmptyState description="Reporting lines appear once employees have a manager assigned." icon={UsersRound} title="No reporting data yet" />
 ) : (
 <div className="space-y-3">
 {hierarchy.reportingTree.map((node) => (
 <ReportingTreeNode key={node.id} node={node} />
 ))}
 </div>
 )}
 </SectionCard>
 {hierarchy && hierarchy.unassignedUsers.length > 0 && (
 <SectionCard subtitle="Employees not yet placed in a department." title="Unassigned Employees">
 <div className="grid gap-2 sm:grid-cols-2">
 {hierarchy.unassignedUsers.map((user) => (
 <div className="rounded-lg border bg-background p-3 text-sm" key={user.id}>
 <span className="font-semibold">{user.fullName}</span>
 <span className="ml-2 text-xs text-muted-foreground">{user.role}</span>
 </div>
 ))}
 </div>
 </SectionCard>
 )}
 </div>
 )}

 {activeTab === "holidays" && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Holiday Calendar</h2>
 <Button onClick={() => setShowHolidayForm((v) => !v)} type="button">
 <Plus className="h-4 w-4" />
 Add Holiday
 </Button>
 </div>
 {showHolidayForm && (
 <SectionCard title="New Holiday">
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="holidayName">Name</Label>
 <Input id="holidayName" value={holidayForm.name} onChange={(event) => setHolidayForm((c) => ({ ...c, name: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="holidayDate">Date</Label>
 <Input id="holidayDate" type="date" value={holidayForm.date} onChange={(event) => setHolidayForm((c) => ({ ...c, date: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="holidayType">Type</Label>
 <select
 className={selectClassName}
 id="holidayType"
 value={holidayForm.type}
 onChange={(event) => setHolidayForm((c) => ({ ...c, type: event.target.value as HolidayFormInput["type"] }))}
 >
 {holidayTypes.map((type) => (
 <option key={type} value={type}>
 {type}
 </option>
 ))}
 </select>
 </div>
 </div>
 <Button className="mt-4" disabled={!holidayForm.name || !holidayForm.date} onClick={submitHoliday} type="button">
 Add Holiday
 </Button>
 </SectionCard>
 )}
 {holidays.length === 0 ? (
 <EmptyState description="Add public, optional, or company holidays." icon={CalendarDays} title="No holidays yet" />
 ) : (
 <div className="space-y-2">
 {holidays.map((holiday) => (
 <Card className="glass" key={holiday._id}>
 <CardContent className="flex items-center justify-between gap-3 p-4">
 <div>
 <p className="font-semibold">{holiday.name}</p>
 <p className="text-xs text-muted-foreground">
 {new Date(holiday.date).toLocaleDateString()} - {holiday.type}
 </p>
 </div>
 <Button onClick={() => void removeHoliday(holiday)} size="icon" type="button" variant="outline">
 <Trash2 className="h-4 w-4" />
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>
 )}

 {activeTab === "policies" && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Company Policies</h2>
 <Button onClick={() => setShowPolicyForm((v) => !v)} type="button">
 <Plus className="h-4 w-4" />
 Add Policy
 </Button>
 </div>
 {showPolicyForm && (
 <SectionCard title="New Policy">
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="policyTitle">Title</Label>
 <Input id="policyTitle" value={policyForm.title} onChange={(event) => setPolicyForm((c) => ({ ...c, title: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="policyCategory">Category</Label>
 <select
 className={selectClassName}
 id="policyCategory"
 value={policyForm.category}
 onChange={(event) => setPolicyForm((c) => ({ ...c, category: event.target.value as CompanyPolicyFormInput["category"] }))}
 >
 {policyCategories.map((category) => (
 <option key={category} value={category}>
 {category}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="policyContent">Content</Label>
 <textarea
 className={textareaClassName}
 id="policyContent"
 value={policyForm.content}
 onChange={(event) => setPolicyForm((c) => ({ ...c, content: event.target.value }))}
 />
 </div>
 </div>
 <Button className="mt-4" disabled={!policyForm.title || !policyForm.content} onClick={submitPolicy} type="button">
 Create Policy (Draft)
 </Button>
 </SectionCard>
 )}
 {policies.length === 0 ? (
 <EmptyState description="Draft HR, IT, finance, and compliance policies." icon={FileText} title="No policies yet" />
 ) : (
 <div className="space-y-2">
 {policies.map((policy) => (
 <Card className="glass" key={policy._id}>
 <CardContent className="flex items-start justify-between gap-3 p-4">
 <div className="min-w-0 flex-1">
 <p className="font-semibold">{policy.title}</p>
 <p className="text-xs text-muted-foreground">
 {policy.category} - v{policy.version} -{" "}
 <span className={cn(policy.status === "Published" && "text-emerald-600 dark:text-emerald-300")}>{policy.status}</span>
 </p>
 </div>
 <div className="flex shrink-0 gap-2">
 {policy.status !== "Published" && (
 <Button onClick={() => void doPublishPolicy(policy)} size="sm" type="button" variant="outline">
 Publish
 </Button>
 )}
 <Button onClick={() => void removePolicy(policy)} size="icon" type="button" variant="outline">
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>
 )}

 {activeTab === "settings" && (
 <div className="grid gap-6 xl:grid-cols-2">
 <SectionCard subtitle="Working days, business hours, and locale defaults." title="Business Hours &amp; Working Days">
 <div className="space-y-4">
 <div>
 <p className="mb-2 text-sm font-semibold">Working Days</p>
 <div className="flex flex-wrap gap-2">
 {weekdays.map((day) => (
 <button
 className={cn(
 "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
 settings.workingDays.includes(day) ? "border-primary/50 bg-primary/10 text-primary" : "bg-background",
 )}
 key={day}
 onClick={() => toggleWorkingDay(day)}
 type="button"
 >
 {day.slice(0, 3)}
 </button>
 ))}
 </div>
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="hoursStart">Business Hours Start</Label>
 <Input id="hoursStart" type="time" value={settings.businessHoursStart} onChange={(event) => setSettings((c) => ({ ...c, businessHoursStart: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="hoursEnd">Business Hours End</Label>
 <Input id="hoursEnd" type="time" value={settings.businessHoursEnd} onChange={(event) => setSettings((c) => ({ ...c, businessHoursEnd: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="settingsTimezone">Timezone</Label>
 <Input id="settingsTimezone" value={settings.timezone} onChange={(event) => setSettings((c) => ({ ...c, timezone: event.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="weekStartsOn">Week Starts On</Label>
 <select
 className={selectClassName}
 id="weekStartsOn"
 value={settings.weekStartsOn}
 onChange={(event) => setSettings((c) => ({ ...c, weekStartsOn: event.target.value as OrganizationSettingsForm["weekStartsOn"] }))}
 >
 {weekdays.map((day) => (
 <option key={day} value={day}>
 {day}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="dateFormat">Date Format</Label>
 <select
 className={selectClassName}
 id="dateFormat"
 value={settings.dateFormat}
 onChange={(event) => setSettings((c) => ({ ...c, dateFormat: event.target.value as OrganizationSettingsForm["dateFormat"] }))}
 >
 {dateFormats.map((format) => (
 <option key={format} value={format}>
 {format}
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="currency">Currency</Label>
 <Input id="currency" maxLength={3} value={settings.currency} onChange={(event) => setSettings((c) => ({ ...c, currency: event.target.value.toUpperCase() }))} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="fiscalYearStart">Fiscal Year Start Month</Label>
 <Input
 id="fiscalYearStart"
 max={12}
 min={1}
 type="number"
 value={settings.fiscalYearStartMonth}
 onChange={(event) => setSettings((c) => ({ ...c, fiscalYearStartMonth: Number(event.target.value) }))}
 />
 </div>
 </div>
 </div>
 </SectionCard>

 <SectionCard subtitle="Organization-wide workspace defaults." title="Workspace Settings">
 <div className="space-y-3">
 <label className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
 <span className="text-sm font-semibold">Allow remote check-in</span>
 <input
 checked={settings.workspacePreferences.allowRemoteCheckIn}
 className="h-4 w-4 accent-primary"
 onChange={(event) =>
 setSettings((c) => ({ ...c, workspacePreferences: { ...c.workspacePreferences, allowRemoteCheckIn: event.target.checked } }))
 }
 type="checkbox"
 />
 </label>
 <label className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
 <span className="text-sm font-semibold">Enforce geo-fence for check-in</span>
 <input
 checked={settings.workspacePreferences.enforceGeoFence}
 className="h-4 w-4 accent-primary"
 onChange={(event) =>
 setSettings((c) => ({ ...c, workspacePreferences: { ...c.workspacePreferences, enforceGeoFence: event.target.checked } }))
 }
 type="checkbox"
 />
 </label>
 <div className="rounded-lg border bg-background p-4">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-sm font-semibold">Office attendance location</p>
 <p className="mt-1 text-xs leading-5 text-muted-foreground">Saved once by admin and applied to every user check-in/check-out.</p>
 </div>
 <Button disabled={detectingOfficeLocation} onClick={useCurrentOfficeLocation} size="sm" type="button" variant="outline">
 <MapPin className="h-4 w-4" />
 {detectingOfficeLocation ? "Detecting..." : "Use current location"}
 </Button>
 </div>
 <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
 <div className="space-y-3">
 <div className="space-y-2">
 <Label htmlFor="officeLocationName">Location name</Label>
 <Input
 id="officeLocationName"
 placeholder="Main Office"
 value={settings.workspacePreferences.officeLocation.name}
 onChange={(event) =>
 setSettings((c) => ({
 ...c,
 workspacePreferences: {
 ...c.workspacePreferences,
 officeLocation: {
 ...c.workspacePreferences.officeLocation,
 name: event.target.value,
 },
 },
 }))
 }
 />
 </div>
 <div className="grid gap-3 sm:grid-cols-3">
 <div className="space-y-2">
 <Label htmlFor="officeLatitude">Latitude</Label>
 <Input
 id="officeLatitude"
 step="any"
 type="number"
 value={settings.workspacePreferences.officeLocation.latitude}
 onChange={(event) =>
 setSettings((c) => ({
 ...c,
 workspacePreferences: {
 ...c.workspacePreferences,
 officeLocation: {
 ...c.workspacePreferences.officeLocation,
 latitude: Number(event.target.value),
 },
 },
 }))
 }
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="officeLongitude">Longitude</Label>
 <Input
 id="officeLongitude"
 step="any"
 type="number"
 value={settings.workspacePreferences.officeLocation.longitude}
 onChange={(event) =>
 setSettings((c) => ({
 ...c,
 workspacePreferences: {
 ...c.workspacePreferences,
 officeLocation: {
 ...c.workspacePreferences.officeLocation,
 longitude: Number(event.target.value),
 },
 },
 }))
 }
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="officeRadius">Radius meters</Label>
 <Input
 id="officeRadius"
 min={1}
 step={1}
 type="number"
 value={settings.workspacePreferences.officeLocation.radiusMeters}
 onChange={(event) =>
 setSettings((c) => ({
 ...c,
 workspacePreferences: {
 ...c.workspacePreferences,
 officeLocation: {
 ...c.workspacePreferences.officeLocation,
 radiusMeters: Number(event.target.value),
 },
 },
 }))
 }
 />
 </div>
 </div>
 </div>
 <div className="overflow-hidden rounded-lg border bg-muted">
 <iframe
 className="h-56 w-full"
 loading="lazy"
 referrerPolicy="no-referrer-when-downgrade"
 src={officeMapUrl}
 title={`${settings.workspacePreferences.officeLocation.name || "Office"} map preview`}
 />
 <div className="border-t bg-background px-3 py-2 text-xs text-muted-foreground">
 {settings.workspacePreferences.officeLocation.name || "Office"} - {settings.workspacePreferences.officeLocation.radiusMeters}m radius
 </div>
 </div>
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="leaveNote">Default Leave Policy Note</Label>
 <textarea
 className={textareaClassName}
 id="leaveNote"
 value={settings.workspacePreferences.defaultLeavePolicyNote}
 onChange={(event) =>
 setSettings((c) => ({ ...c, workspacePreferences: { ...c.workspacePreferences, defaultLeavePolicyNote: event.target.value } }))
 }
 />
 </div>
 </div>
 <Button className="mt-6 w-full" disabled={savingSettings} onClick={saveSettings} type="button">
 <Save className="h-4 w-4" />
 {savingSettings ? "Saving..." : "Save Settings"}
 </Button>
 </SectionCard>
 </div>
 )}
 </>
 )}
 </div>
 </main>
 );
}
