import { z } from "zod";

export const businessTypes = [
 "Private Limited",
 "Public Limited",
 "LLP",
 "Partnership",
 "Sole Proprietorship",
 "Non-Profit",
 "Government",
 "Other",
] as const;

export const branchTypes = ["Head Office", "Branch", "Warehouse", "Remote"] as const;
export const activeStatuses = ["Active", "Inactive"] as const;
export const holidayTypes = ["Public", "Optional", "Restricted", "Company"] as const;
export const policyCategories = [
 "HR",
 "IT",
 "Finance",
 "Compliance",
 "Conduct",
 "Leave",
 "Security",
 "General",
] as const;
export const policyStatuses = ["Draft", "Published", "Archived"] as const;
export const weekdays = [
 "Monday",
 "Tuesday",
 "Wednesday",
 "Thursday",
 "Friday",
 "Saturday",
 "Sunday",
] as const;
export const dateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const pincodeRegex = /^\d{6}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const organizationSchema = z.object({
 name: z.string().min(2).max(180),
 legalName: z.string().max(180).optional().or(z.literal("")),
 logo: z.string().optional().or(z.literal("")),
 businessType: z.enum(businessTypes),
 gstin: z.string().regex(gstinRegex, "Invalid GSTIN format").optional().or(z.literal("")),
 pan: z.string().regex(panRegex, "Invalid PAN format").optional().or(z.literal("")),
 taxIdentificationNumber: z.string().max(40).optional().or(z.literal("")),
 email: z.string().email().optional().or(z.literal("")),
 phone: z.string().max(20).optional().or(z.literal("")),
 website: z.string().url().optional().or(z.literal("")),
 addressLine1: z.string().max(160).optional().or(z.literal("")),
 addressLine2: z.string().max(160).optional().or(z.literal("")),
 city: z.string().max(100).optional().or(z.literal("")),
 state: z.string().max(100).optional().or(z.literal("")),
 country: z.string().max(100).optional().or(z.literal("")),
 pincode: z.string().regex(pincodeRegex, "Pincode must be 6 digits").optional().or(z.literal("")),
});

export type OrganizationForm = z.infer<typeof organizationSchema>;

export const defaultOrganization: OrganizationForm = {
 name: "",
 legalName: "",
 logo: "",
 businessType: "Private Limited",
 gstin: "",
 pan: "",
 taxIdentificationNumber: "",
 email: "",
 phone: "",
 website: "",
 addressLine1: "",
 addressLine2: "",
 city: "",
 state: "",
 country: "India",
 pincode: "",
};

export const organizationSettingsSchema = z
 .object({
 workingDays: z.array(z.enum(weekdays)).min(1),
 businessHoursStart: z.string().regex(timeRegex, "Use HH:mm format"),
 businessHoursEnd: z.string().regex(timeRegex, "Use HH:mm format"),
 timezone: z.string().min(1).max(60),
 weekStartsOn: z.enum(weekdays),
 dateFormat: z.enum(dateFormats),
 currency: z.string().length(3),
 fiscalYearStartMonth: z.number().int().min(1).max(12),
 workspacePreferences: z.object({
 allowRemoteCheckIn: z.boolean(),
 enforceGeoFence: z.boolean(),
 officeLocation: z.object({
 name: z.string().min(1).max(120),
 latitude: z.number().min(-90).max(90),
 longitude: z.number().min(-180).max(180),
 radiusMeters: z.number().int().positive(),
 }),
 defaultLeavePolicyNote: z.string().max(500).optional().or(z.literal("")),
 }),
 })
 .refine((data) => data.businessHoursEnd > data.businessHoursStart, {
 message: "Business hours end must be after start",
 path: ["businessHoursEnd"],
 });

export type OrganizationSettingsForm = z.infer<typeof organizationSettingsSchema>;

export const defaultOrganizationSettings: OrganizationSettingsForm = {
 workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
 businessHoursStart: "09:30",
 businessHoursEnd: "18:30",
 timezone: "Asia/Kolkata",
 weekStartsOn: "Monday",
 dateFormat: "DD/MM/YYYY",
 currency: "INR",
 fiscalYearStartMonth: 4,
 workspacePreferences: {
 allowRemoteCheckIn: false,
 enforceGeoFence: true,
 officeLocation: {
 name: "Main Office",
 latitude: 12.9716,
 longitude: 77.5946,
 radiusMeters: 300,
 },
 defaultLeavePolicyNote: "",
 },
};

export type Department = {
 _id: string;
 name: string;
 code?: string;
 description?: string;
 headId?: string;
 status: (typeof activeStatuses)[number];
 memberCount?: number;
};

export type DepartmentFormInput = {
 name: string;
 code: string;
 description: string;
 headId: string;
 status: (typeof activeStatuses)[number];
};

export const emptyDepartmentForm: DepartmentFormInput = {
 name: "",
 code: "",
 description: "",
 headId: "",
 status: "Active",
};

export type Branch = {
 _id: string;
 name: string;
 type: (typeof branchTypes)[number];
 isHeadOffice: boolean;
 addressLine1: string;
 city: string;
 state: string;
 country: string;
 pincode: string;
 status: (typeof activeStatuses)[number];
};

export type BranchFormInput = {
 name: string;
 type: (typeof branchTypes)[number];
 isHeadOffice: boolean;
 addressLine1: string;
 city: string;
 state: string;
 country: string;
 pincode: string;
 status: (typeof activeStatuses)[number];
};

export const emptyBranchForm: BranchFormInput = {
 name: "",
 type: "Branch",
 isHeadOffice: false,
 addressLine1: "",
 city: "",
 state: "",
 country: "India",
 pincode: "",
 status: "Active",
};

export type Team = {
 _id: string;
 name: string;
 departmentId: string;
 description?: string;
 status: (typeof activeStatuses)[number];
};

export type TeamFormInput = {
 name: string;
 departmentId: string;
 description: string;
 status: (typeof activeStatuses)[number];
};

export const emptyTeamForm: TeamFormInput = {
 name: "",
 departmentId: "",
 description: "",
 status: "Active",
};

export type Holiday = {
 _id: string;
 name: string;
 date: string;
 type: (typeof holidayTypes)[number];
 description?: string;
};

export type HolidayFormInput = {
 name: string;
 date: string;
 type: (typeof holidayTypes)[number];
 description: string;
};

export const emptyHolidayForm: HolidayFormInput = {
 name: "",
 date: "",
 type: "Public",
 description: "",
};

export type CompanyPolicy = {
 _id: string;
 title: string;
 category: (typeof policyCategories)[number];
 content: string;
 status: (typeof policyStatuses)[number];
 version: number;
};

export type CompanyPolicyFormInput = {
 title: string;
 category: (typeof policyCategories)[number];
 content: string;
};

export const emptyCompanyPolicyForm: CompanyPolicyFormInput = {
 title: "",
 category: "General",
 content: "",
};

export type OrgHierarchyUser = {
 id: string;
 fullName: string;
 email: string;
 role: string;
};

export type OrgHierarchyTeamNode = {
 id: string;
 name: string;
 lead: OrgHierarchyUser | null;
 members: OrgHierarchyUser[];
};

export type OrgHierarchyDepartmentNode = {
 id: string;
 name: string;
 code?: string;
 head: OrgHierarchyUser | null;
 teams: OrgHierarchyTeamNode[];
 children: OrgHierarchyDepartmentNode[];
};

export type OrgHierarchyReportingNode = {
 id: string;
 fullName: string;
 email: string;
 role: string;
 directReports: OrgHierarchyReportingNode[];
};

export type OrgHierarchyResponse = {
 departments: OrgHierarchyDepartmentNode[];
 reportingTree: OrgHierarchyReportingNode[];
 branches: { id: string; name: string; city: string; isHeadOffice: boolean }[];
 unassignedUsers: OrgHierarchyUser[];
 cycleDetected: boolean;
};
