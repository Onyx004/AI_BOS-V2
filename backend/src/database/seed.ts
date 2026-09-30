import mongoose, { type Types } from "mongoose";
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "./mongo.js";
import { syncDefaultRoles } from "./default-role-sync.js";
import { UserModel, type EmployeeProfile } from "../models/user.model.js";
import { ProjectModel } from "../models/project.model.js";
import { OrganizationModel } from "../models/organization.model.js";
import { OrganizationSettingsModel } from "../models/organization-settings.model.js";
import { DepartmentModel } from "../models/department.model.js";
import { BranchModel } from "../models/branch.model.js";
import { TeamModel } from "../models/team.model.js";
import { RoleModel } from "../models/role.model.js";
import { PermissionGroupModel } from "../models/permission-group.model.js";
import { RoleTemplateModel } from "../models/role-template.model.js";
import { CollaborationRoomModel } from "../models/collaboration-room.model.js";
import { CollaborationMessageModel } from "../models/collaboration-message.model.js";
import { CollaborationNoteModel } from "../models/collaboration-note.model.js";
import { ScheduledNotificationModel } from "../models/scheduled-notification.model.js";
import { NotificationModel } from "../models/notification.model.js";
import { IntegrationProviderConfigModel } from "../models/integration-provider-config.model.js";
import { BackupScheduleModel } from "../models/backup-schedule.model.js";
import { CompanyPolicyModel } from "../models/company-policy.model.js";
import { HolidayModel } from "../models/holiday.model.js";
import { organizationScope } from "../constants/organization.js";
import { defaultRoleDefinitions, hrPermissions, managerPermissions } from "../constants/default-roles.js";
import { crmPermissionKeys } from "../constants/permissions.js";
import { integrationFamilies } from "../constants/integration.js";
import { backupTypes } from "../constants/backup.js";
import { notificationService } from "../services/notification.service.js";
import { hashPassword } from "../utils/password.js";
import { logger } from "../utils/logger.js";
import type { UserRole } from "../constants/roles.js";

type SeedUser = {
  fullName: string;
  companyName: string;
  email: string;
  role: UserRole;
  department: string;
  managerEmail?: string;
  employeeProfile: EmployeeProfile;
};

const companyName = "Nexora Softworks Pvt. Ltd.";
const companyShortName = "Nexora Softworks";
const companyDomain = "nexorasoftworks.dev";
const demoPassword = process.env.AI_BOS_DEMO_SEED_PASSWORD;
const companyLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#101828"/><path d="M28 92V36h14l44 56h14V36H84v32L56 36H28v56z" fill="#56F0C4"/><path d="M38 92h62v-14H50L38 92z" fill="#4DA3FF"/></svg>`;
const companyLogoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(companyLogoSvg)}`;

const seedUsers: SeedUser[] = [
  {
    fullName: "Aarav Mehta",
    companyName,
    email: `aarav.mehta@${companyDomain}`,
    role: "Owner",
    department: "Executive",
    employeeProfile: {
      employeeCode: "NEX-2026-001",
      phone: "+91 90080 51001",
      location: "Bengaluru HQ",
      designation: "Founder & CEO",
      employmentType: "Full Time",
      joiningDate: new Date("2026-01-15"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1982-04-11", gender: "Male", nationality: "Indian", maritalStatus: "Married" },
      contact: { address: "Indiranagar, Bengaluru", emergencyContact: "+91 90080 51901" },
      skills: ["SaaS Strategy", "Enterprise Sales", "AI Governance", "Leadership"],
      experience: ["Founder & CEO at Nexora Softworks", "VP Product at CloudSprint"],
      education: ["MBA, IIM Bengaluru", "B.Tech, Computer Science"],
      documents: [
        { name: "founder-id.pdf", type: "Identity", size: "720 KB" },
        { name: "board-appointment.pdf", type: "Legal", size: "410 KB" },
      ],
      salaryDetails: { annualCtc: 9600000, monthlySalary: 800000, bank: "HDFC Bank", taxId: "AARPM9021Q" },
      performanceScore: 97,
    },
  },
  {
    fullName: "Isha Sinha",
    companyName,
    email: `isha.sinha@${companyDomain}`,
    role: "Administrator",
    department: "Operations",
    managerEmail: `aarav.mehta@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-002",
      phone: "+91 90080 51002",
      location: "Bengaluru HQ",
      designation: "Head of Business Operations",
      employmentType: "Full Time",
      joiningDate: new Date("2026-01-20"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1989-08-18", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "HSR Layout, Bengaluru", emergencyContact: "+91 90080 51902" },
      skills: ["RBAC", "Process Design", "Security Operations", "Vendor Management"],
      experience: ["Head of Operations at Nexora Softworks", "Program Lead at FinEdge"],
      education: ["MBA, Operations"],
      documents: [{ name: "operations-contract.pdf", type: "Contract", size: "560 KB" }],
      salaryDetails: { annualCtc: 4200000, monthlySalary: 350000, bank: "ICICI Bank", taxId: "ISHPS4456R" },
      performanceScore: 94,
    },
  },
  {
    fullName: "Kabir Arora",
    companyName,
    email: `kabir.arora@${companyDomain}`,
    role: "Manager",
    department: "Product",
    managerEmail: `aarav.mehta@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-003",
      phone: "+91 90080 51003",
      location: "Bengaluru HQ",
      designation: "Product Delivery Manager",
      employmentType: "Full Time",
      joiningDate: new Date("2026-01-27"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1991-11-27", gender: "Male", nationality: "Indian", maritalStatus: "Married" },
      contact: { address: "Koramangala, Bengaluru", emergencyContact: "+91 90080 51903" },
      skills: ["Product Strategy", "Agile Delivery", "Roadmapping", "Customer Discovery"],
      experience: ["Product Delivery Manager at Nexora Softworks", "Senior BA at SaaSWorks"],
      education: ["MBA, Business Operations", "B.Tech, Computer Science"],
      documents: [{ name: "offer-letter.pdf", type: "HR", size: "340 KB" }],
      salaryDetails: { annualCtc: 3600000, monthlySalary: 300000, bank: "Axis Bank", taxId: "KABPR7788T" },
      performanceScore: 92,
    },
  },
  {
    fullName: "Naina Rao",
    companyName,
    email: `naina.rao@${companyDomain}`,
    role: "HR",
    department: "Human Resources",
    managerEmail: `isha.sinha@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-004",
      phone: "+91 90080 51004",
      location: "Bengaluru HQ",
      designation: "People Operations Lead",
      employmentType: "Full Time",
      joiningDate: new Date("2026-02-03"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1993-05-30", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Whitefield, Bengaluru", emergencyContact: "+91 90080 51904" },
      skills: ["Hiring", "Employee Records", "Onboarding", "Payroll Coordination"],
      experience: ["People Operations Lead at Nexora Softworks", "HR Generalist at PeopleFirst"],
      education: ["MBA, Human Resources"],
      documents: [{ name: "nda.pdf", type: "Legal", size: "260 KB" }],
      salaryDetails: { annualCtc: 2200000, monthlySalary: 183333, bank: "SBI", taxId: "NAIRA3321M" },
      performanceScore: 90,
    },
  },
  {
    fullName: "Devika Menon",
    companyName,
    email: `devika.menon@${companyDomain}`,
    role: "Finance",
    department: "Finance",
    managerEmail: `isha.sinha@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-005",
      phone: "+91 90080 51005",
      location: "Bengaluru HQ",
      designation: "Finance Controller",
      employmentType: "Full Time",
      joiningDate: new Date("2026-02-10"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1990-01-22", gender: "Female", nationality: "Indian", maritalStatus: "Married" },
      contact: { address: "Jayanagar, Bengaluru", emergencyContact: "+91 90080 51905" },
      skills: ["FP&A", "SaaS Metrics", "Compliance", "Billing Operations"],
      experience: ["Finance Controller at Nexora Softworks", "Audit Associate at FinCore"],
      education: ["CA", "B.Com Finance"],
      documents: [{ name: "tax-declaration.pdf", type: "Finance", size: "410 KB" }],
      salaryDetails: { annualCtc: 3000000, monthlySalary: 250000, bank: "ICICI Bank", taxId: "DEVMX6789Z" },
      performanceScore: 91,
    },
  },
  {
    fullName: "Rhea Kapoor",
    companyName,
    email: `rhea.kapoor@${companyDomain}`,
    role: "Sales",
    department: "Sales",
    managerEmail: `aarav.mehta@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-006",
      phone: "+91 90080 51006",
      location: "Mumbai Client Office",
      designation: "Enterprise Account Executive",
      employmentType: "Full Time",
      joiningDate: new Date("2026-02-18"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1995-09-18", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Powai, Mumbai", emergencyContact: "+91 90080 51906" },
      skills: ["CRM", "Pipeline Management", "Negotiation", "SaaS Demos"],
      experience: ["Enterprise AE at Nexora Softworks", "Account Executive at LeadWave"],
      education: ["BBA, Marketing"],
      documents: [{ name: "offer-letter.pdf", type: "HR", size: "300 KB" }],
      salaryDetails: { annualCtc: 2600000, monthlySalary: 216667, bank: "HDFC Bank", taxId: "RHEPN2210K" },
      performanceScore: 89,
    },
  },
  {
    fullName: "Manav Bansal",
    companyName,
    email: `manav.bansal@${companyDomain}`,
    role: "Support",
    department: "Customer Success",
    managerEmail: `kabir.arora@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-007",
      phone: "+91 90080 51007",
      location: "Bengaluru HQ",
      designation: "Customer Success Lead",
      employmentType: "Full Time",
      joiningDate: new Date("2026-03-02"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1994-12-03", gender: "Male", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "BTM Layout, Bengaluru", emergencyContact: "+91 90080 51907" },
      skills: ["Customer Support", "Implementation", "Escalation Management", "SLA Reporting"],
      experience: ["Customer Success Lead at Nexora Softworks", "Support Engineer at Helptrail"],
      education: ["B.Sc, Computer Applications"],
      documents: [{ name: "identity-proof.pdf", type: "Identity", size: "690 KB" }],
      salaryDetails: { annualCtc: 1900000, monthlySalary: 158333, bank: "Kotak Mahindra", taxId: "MANPK5567J" },
      performanceScore: 87,
    },
  },
  {
    fullName: "Tara Kulkarni",
    companyName,
    email: `tara.kulkarni@${companyDomain}`,
    role: "Developer",
    department: "Engineering",
    managerEmail: `kabir.arora@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-008",
      phone: "+91 90080 51008",
      location: "Bengaluru HQ",
      designation: "Senior Backend Engineer",
      employmentType: "Full Time",
      joiningDate: new Date("2026-03-09"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1993-02-11", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Marathahalli, Bengaluru", emergencyContact: "+91 90080 51908" },
      skills: ["Node.js", "MongoDB", "API Design", "Platform Reliability"],
      experience: ["Senior Backend Engineer at Nexora Softworks", "Backend Engineer at DataForge"],
      education: ["B.Tech, Computer Science"],
      documents: [{ name: "engineering-contract.pdf", type: "Contract", size: "1.0 MB" }],
      salaryDetails: { annualCtc: 3800000, monthlySalary: 316667, bank: "Axis Bank", taxId: "TARJ8890W" },
      performanceScore: 93,
    },
  },
  {
    fullName: "Omar Qureshi",
    companyName,
    email: `omar.qureshi@${companyDomain}`,
    role: "Developer",
    department: "Engineering",
    managerEmail: `tara.kulkarni@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-009",
      phone: "+91 90080 51009",
      location: "Bengaluru HQ",
      designation: "Frontend Engineer",
      employmentType: "Full Time",
      joiningDate: new Date("2026-03-16"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1997-06-25", gender: "Male", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Electronic City, Bengaluru", emergencyContact: "+91 90080 51909" },
      skills: ["React", "TypeScript", "Accessibility", "Design Systems"],
      experience: ["Frontend Engineer at Nexora Softworks", "UI Developer at PixelGrid"],
      education: ["B.Tech, Computer Science"],
      documents: [{ name: "offer-letter.pdf", type: "HR", size: "290 KB" }],
      salaryDetails: { annualCtc: 2400000, monthlySalary: 200000, bank: "SBI", taxId: "OMAPR1123D" },
      performanceScore: 88,
    },
  },
  {
    fullName: "Saanvi Iyer",
    companyName,
    email: `saanvi.iyer@${companyDomain}`,
    role: "Developer",
    department: "Engineering",
    managerEmail: `tara.kulkarni@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-010",
      phone: "+91 90080 51010",
      location: "Bengaluru HQ",
      designation: "QA Automation Engineer",
      employmentType: "Full Time",
      joiningDate: new Date("2026-03-23"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1996-10-16", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Domlur, Bengaluru", emergencyContact: "+91 90080 51910" },
      skills: ["Playwright", "API Testing", "Regression Suites", "Release Quality"],
      experience: ["QA Automation Engineer at Nexora Softworks", "QA Analyst at TestHive"],
      education: ["B.E, Information Science"],
      documents: [{ name: "qa-contract.pdf", type: "Contract", size: "510 KB" }],
      salaryDetails: { annualCtc: 2100000, monthlySalary: 175000, bank: "HDFC Bank", taxId: "SAAPI9021M" },
      performanceScore: 89,
    },
  },
  {
    fullName: "Vihaan Shah",
    companyName,
    email: `vihaan.shah@${companyDomain}`,
    role: "Developer",
    department: "Engineering",
    managerEmail: `tara.kulkarni@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-011",
      phone: "+91 90080 51011",
      location: "Bengaluru HQ",
      designation: "DevOps Engineer",
      employmentType: "Full Time",
      joiningDate: new Date("2026-04-01"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1995-12-08", gender: "Male", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Bellandur, Bengaluru", emergencyContact: "+91 90080 51911" },
      skills: ["AWS", "Docker", "CI/CD", "Observability"],
      experience: ["DevOps Engineer at Nexora Softworks", "Cloud Engineer at InfraNest"],
      education: ["B.Tech, Electronics"],
      documents: [{ name: "devops-offer.pdf", type: "HR", size: "440 KB" }],
      salaryDetails: { annualCtc: 2800000, monthlySalary: 233333, bank: "Axis Bank", taxId: "VIHPS7788T" },
      performanceScore: 90,
    },
  },
  {
    fullName: "Maya Fernandes",
    companyName,
    email: `maya.fernandes@${companyDomain}`,
    role: "Employee",
    department: "Design",
    managerEmail: `kabir.arora@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-012",
      phone: "+91 90080 51012",
      location: "Goa Remote",
      designation: "Product Designer",
      employmentType: "Full Time",
      joiningDate: new Date("2026-04-08"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1994-03-29", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Panjim, Goa", emergencyContact: "+91 90080 51912" },
      skills: ["UX Research", "Figma", "Design Systems", "Prototyping"],
      experience: ["Product Designer at Nexora Softworks", "UX Designer at Studio42"],
      education: ["B.Des, Interaction Design"],
      documents: [{ name: "design-offer.pdf", type: "HR", size: "390 KB" }],
      salaryDetails: { annualCtc: 2200000, monthlySalary: 183333, bank: "ICICI Bank", taxId: "MAYPF4456R" },
      performanceScore: 91,
    },
  },
  {
    fullName: "Arjun Nair",
    companyName,
    email: `arjun.nair@${companyDomain}`,
    role: "Employee",
    department: "Engineering",
    managerEmail: `tara.kulkarni@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-013",
      phone: "+91 90080 51013",
      location: "Bengaluru HQ",
      designation: "Junior Software Engineer",
      employmentType: "Full Time",
      joiningDate: new Date("2026-04-15"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "2000-07-14", gender: "Male", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Yelahanka, Bengaluru", emergencyContact: "+91 90080 51913" },
      skills: ["JavaScript", "REST APIs", "MongoDB", "Documentation"],
      experience: ["Junior Software Engineer at Nexora Softworks"],
      education: ["B.Tech, Computer Science"],
      documents: [{ name: "campus-offer.pdf", type: "HR", size: "350 KB" }],
      salaryDetails: { annualCtc: 1200000, monthlySalary: 100000, bank: "SBI", taxId: "ARJPN1123D" },
      performanceScore: 82,
    },
  },
  {
    fullName: "Simran Gill",
    companyName,
    email: `simran.gill@${companyDomain}`,
    role: "Sales",
    department: "Sales",
    managerEmail: `rhea.kapoor@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-014",
      phone: "+91 90080 51014",
      location: "Delhi Client Office",
      designation: "Sales Development Representative",
      employmentType: "Full Time",
      joiningDate: new Date("2026-05-04"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1998-02-22", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Saket, New Delhi", emergencyContact: "+91 90080 51914" },
      skills: ["Prospecting", "Lead Qualification", "CRM Hygiene", "Email Campaigns"],
      experience: ["SDR at Nexora Softworks", "Inside Sales Associate at GrowthLoop"],
      education: ["BBA, Marketing"],
      documents: [{ name: "sales-offer.pdf", type: "HR", size: "330 KB" }],
      salaryDetails: { annualCtc: 1400000, monthlySalary: 116667, bank: "HDFC Bank", taxId: "SIMGN2210K" },
      performanceScore: 84,
    },
  },
  {
    fullName: "Pranav Desai",
    companyName,
    email: `pranav.desai@${companyDomain}`,
    role: "Support",
    department: "Customer Success",
    managerEmail: `manav.bansal@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-015",
      phone: "+91 90080 51015",
      location: "Pune Remote",
      designation: "Implementation Specialist",
      employmentType: "Full Time",
      joiningDate: new Date("2026-05-12"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1996-09-01", gender: "Male", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Kharadi, Pune", emergencyContact: "+91 90080 51915" },
      skills: ["Onboarding", "Data Migration", "Customer Training", "Support Docs"],
      experience: ["Implementation Specialist at Nexora Softworks", "CS Associate at CloudDesk"],
      education: ["BCA"],
      documents: [{ name: "implementation-offer.pdf", type: "HR", size: "360 KB" }],
      salaryDetails: { annualCtc: 1500000, monthlySalary: 125000, bank: "Kotak Mahindra", taxId: "PRNPK5567J" },
      performanceScore: 85,
    },
  },
  {
    fullName: "Zoya Khan",
    companyName,
    email: `zoya.khan@${companyDomain}`,
    role: "Employee",
    department: "Marketing",
    managerEmail: `rhea.kapoor@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-016",
      phone: "+91 90080 51016",
      location: "Bengaluru HQ",
      designation: "Growth Marketing Associate",
      employmentType: "Full Time",
      joiningDate: new Date("2026-06-01"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1999-01-06", gender: "Female", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "Ulsoor, Bengaluru", emergencyContact: "+91 90080 51916" },
      skills: ["Content", "Campaign Analytics", "SEO", "Webinars"],
      experience: ["Growth Marketing Associate at Nexora Softworks"],
      education: ["BA, Mass Communication"],
      documents: [{ name: "marketing-offer.pdf", type: "HR", size: "310 KB" }],
      salaryDetails: { annualCtc: 1100000, monthlySalary: 91667, bank: "ICICI Bank", taxId: "ZOYKA3321M" },
      performanceScore: 83,
    },
  },
  {
    fullName: "Ethan Dsouza",
    companyName,
    email: `ethan.dsouza@${companyDomain}`,
    role: "Employee",
    department: "Operations",
    managerEmail: `isha.sinha@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-017",
      phone: "+91 90080 51017",
      location: "Bengaluru HQ",
      designation: "IT & Office Coordinator",
      employmentType: "Full Time",
      joiningDate: new Date("2026-06-15"),
      employmentStatus: "On Leave",
      personalInformation: { dateOfBirth: "1997-10-19", gender: "Male", nationality: "Indian", maritalStatus: "Single" },
      contact: { address: "MG Road, Bengaluru", emergencyContact: "+91 90080 51917" },
      skills: ["Asset Management", "Access Provisioning", "Vendor Coordination"],
      experience: ["IT & Office Coordinator at Nexora Softworks", "Admin Executive at DeskOps"],
      education: ["B.Com"],
      documents: [{ name: "ops-offer.pdf", type: "HR", size: "305 KB" }],
      salaryDetails: { annualCtc: 900000, monthlySalary: 75000, bank: "SBI", taxId: "ETHDS1123D" },
      performanceScore: 80,
    },
  },
  {
    fullName: "Leena Thomas",
    companyName,
    email: `leena.thomas@${companyDomain}`,
    role: "Support",
    department: "Executive",
    managerEmail: `aarav.mehta@${companyDomain}`,
    employeeProfile: {
      employeeCode: "NEX-2026-018",
      phone: "+91 90080 51018",
      location: "Remote",
      designation: "External Security Auditor",
      employmentType: "Contract",
      joiningDate: new Date("2026-07-01"),
      employmentStatus: "Active",
      personalInformation: { dateOfBirth: "1988-12-16", gender: "Female", nationality: "Indian", maritalStatus: "Married" },
      contact: { address: "Kochi, Kerala", emergencyContact: "+91 90080 51918" },
      skills: ["Security Audit", "Compliance Review", "Read-Only Advisory"],
      experience: ["External Security Auditor for Nexora Softworks", "GRC Consultant at SecureWorks"],
      education: ["CISA", "M.Tech, Cyber Security"],
      documents: [{ name: "auditor-nda.pdf", type: "Legal", size: "220 KB" }],
      salaryDetails: { annualCtc: 0, monthlySalary: 0, bank: "Not applicable", taxId: "Not applicable" },
      performanceScore: 86,
    },
  },
];

const seedProjects = [
  {
    projectName: "PulseDesk CRM Modernization",
    projectCode: "NEX-PRJ-2026-001",
    description: "Client CRM rebuild with React dashboards, role-based pipelines, and automated follow-up reminders.",
    category: "Client",
    priority: "High",
    status: "Active",
    progress: 74,
    startDate: new Date("2026-02-03"),
    endDate: new Date("2026-08-14"),
    budget: 5400000,
    estimatedHours: 1800,
    client: "Northstar Retail",
    teamMembers: ["Tara Kulkarni", "Omar Qureshi", "Saanvi Iyer", "Rhea Kapoor"],
    projectManager: "Kabir Arora",
    attachments: [{ name: "crm-scope.pdf", mimeType: "application/pdf", size: 420000 }],
    notes: "UAT window starts in August. Keep API response budget under 300ms.",
    tags: ["crm", "react", "client"],
    isArchived: false,
  },
  {
    projectName: "NexOps Internal ERP",
    projectCode: "NEX-PRJ-2026-002",
    description: "Internal operations platform for employees, projects, invoices, approvals, and executive reporting.",
    category: "Product",
    priority: "Critical",
    status: "Active",
    progress: 68,
    startDate: new Date("2026-03-01"),
    endDate: new Date("2026-09-30"),
    budget: 7200000,
    estimatedHours: 2400,
    client: "Internal",
    teamMembers: ["Tara Kulkarni", "Vihaan Shah", "Maya Fernandes", "Devika Menon"],
    projectManager: "Kabir Arora",
    attachments: [{ name: "erp-roadmap.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 220000 }],
    notes: "Security hardening, messenger, and employee directory are in active rollout.",
    tags: ["erp", "internal", "automation"],
    isArchived: false,
  },
  {
    projectName: "AtlasAI Support Assistant",
    projectCode: "NEX-PRJ-2026-003",
    description: "RAG-enabled assistant for customer onboarding, support tickets, and implementation knowledge base.",
    category: "Automation",
    priority: "High",
    status: "Planning",
    progress: 31,
    startDate: new Date("2026-05-06"),
    endDate: new Date("2026-10-18"),
    budget: 4100000,
    estimatedHours: 1260,
    client: "Internal",
    teamMembers: ["Manav Bansal", "Pranav Desai", "Tara Kulkarni"],
    projectManager: "Kabir Arora",
    attachments: [{ name: "support-rag-architecture.md", mimeType: "text/markdown", size: 84000 }],
    notes: "Retrieval evaluation set is being prepared by customer success.",
    tags: ["ai", "rag", "support"],
    isArchived: false,
  },
  {
    projectName: "SecurePay Billing Portal",
    projectCode: "NEX-PRJ-2026-004",
    description: "Subscription billing portal with invoice workflows, renewal reminders, and finance dashboards.",
    category: "Client",
    priority: "Medium",
    status: "Completed",
    progress: 100,
    startDate: new Date("2026-01-29"),
    endDate: new Date("2026-06-21"),
    budget: 3900000,
    estimatedHours: 1120,
    client: "Zenith HealthTech",
    teamMembers: ["Devika Menon", "Omar Qureshi", "Saanvi Iyer"],
    projectManager: "Kabir Arora",
    attachments: [{ name: "billing-handover.pdf", mimeType: "application/pdf", size: 610000 }],
    notes: "Production handover completed. Warranty support continues through August.",
    tags: ["billing", "finance", "client"],
    isArchived: false,
  },
  {
    projectName: "Cloud Cost Control Sprint",
    projectCode: "NEX-PRJ-2026-005",
    description: "Infrastructure optimization to reduce monthly AWS spend and improve observability for active products.",
    category: "Operations",
    priority: "Medium",
    status: "Delayed",
    progress: 52,
    startDate: new Date("2026-04-10"),
    endDate: new Date("2026-08-05"),
    budget: 1600000,
    estimatedHours: 520,
    client: "Internal",
    teamMembers: ["Vihaan Shah", "Tara Kulkarni"],
    projectManager: "Isha Sinha",
    attachments: [{ name: "cloud-cost-report.csv", mimeType: "text/csv", size: 120000 }],
    notes: "Reserved instance recommendations need finance approval.",
    tags: ["devops", "cost", "operations"],
    isArchived: false,
  },
] as const;

async function seedOrganization() {
  const organization = await OrganizationModel.findOneAndUpdate(
    { scope: organizationScope },
    {
      $set: {
        scope: organizationScope,
        name: companyShortName,
        legalName: companyName,
        logo: companyLogoDataUri,
        businessType: "Private Limited",
        gstin: "29NEXSO4521P1Z8",
        pan: "NEXSO4521P",
        taxIdentificationNumber: "IN-NEX-2026-042",
        email: `hello@${companyDomain}`,
        phone: "+91 80 4567 2100",
        website: `https://${companyDomain}`,
        addressLine1: "Nexora Tower, 3rd Floor, 100 Feet Road",
        addressLine2: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        pincode: "560038",
        isDefault: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await OrganizationSettingsModel.findOneAndUpdate(
    { scope: organizationScope },
    { $setOnInsert: { scope: organizationScope, organizationId: organization._id } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  const seedDepartments = [
    { name: "Engineering", code: "ENG" },
    { name: "Product", code: "PROD" },
    { name: "Design", code: "DES" },
    { name: "Sales", code: "SALES" },
    { name: "Marketing", code: "MKT" },
    { name: "Human Resources", code: "HR" },
    { name: "Operations", code: "OPS" },
    { name: "Finance", code: "FIN" },
    { name: "Customer Success", code: "CS" },
    { name: "Executive", code: "EXEC" },
  ];

  for (const department of seedDepartments) {
    await DepartmentModel.updateOne(
      { organizationId: organization._id, name: department.name },
      { $set: { ...department, organizationId: organization._id, status: "Active" } },
      { upsert: true },
    );
  }

  const seedBranches = [
    {
      name: "Bengaluru HQ",
      isHeadOffice: true,
      addressLine1: "Nexora Tower, 100 Feet Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
    },
    {
      name: "Mumbai Client Office",
      isHeadOffice: false,
      addressLine1: "BKC Innovation Centre",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
    },
  ];

  for (const branch of seedBranches) {
    await BranchModel.updateOne(
      { organizationId: organization._id, name: branch.name },
      { $set: { ...branch, organizationId: organization._id, country: "India", status: "Active" } },
      { upsert: true },
    );
  }

  const backfillResult = await UserModel.updateMany(
    { organizationId: { $exists: false } },
    { $set: { organizationId: organization._id } },
  );

  logger.info(
    `Seeded organization "${organization.name}" with ${seedDepartments.length} departments and ${seedBranches.length} branch (backfilled organizationId on ${backfillResult.modifiedCount} users)`,
  );

  return organization;
}

async function seedRBAC() {
  const roleDefinitions = defaultRoleDefinitions.map((definition) => ({ ...definition, isSystem: true }));

  const permissionGroups = [
    {
      name: "Project Management",
      description: "Full project and workflow lifecycle management.",
      permissionKeys: [
        "project.view_stats",
        "project.export",
        "project.create",
        "project.update",
        "project.delete",
        "project.bulk_update",
        "project.bulk_delete",
        "project.archive",
        "project.duplicate",
        "workflow.view_stats",
        "workflow.create",
        "workflow.update",
        "workflow.delete",
        "workflow.duplicate",
        "workflow.toggle_status",
        "workflow.execute",
      ],
    },
    {
      name: "Task Management",
      description: "Task lifecycle, checklists, time tracking, and comments.",
      permissionKeys: [
        "task.view_stats",
        "task.export",
        "task.create",
        "task.update",
        "task.delete",
        "task.bulk_update",
        "task.bulk_delete",
        "task.log_time",
        "task.comment",
      ],
    },
    {
      name: "CRM Management",
      description: "CRM leads, customers, companies, contacts, deals, quotes, follow-ups and meetings.",
      permissionKeys: crmPermissionKeys,
    },
    {
      name: "People Management",
      description: "Departments, branches, teams, holidays, and the user directory.",
      permissionKeys: [
        "department.create",
        "department.update",
        "department.delete",
        "branch.create",
        "branch.update",
        "branch.delete",
        "team.create",
        "team.update",
        "team.delete",
        "holiday.create",
        "holiday.update",
        "holiday.delete",
        "user.view_all",
      ],
    },
    {
      name: "Financial Operations",
      description: "Analytics, financial insight, and finance record management.",
      permissionKeys: [
        "analytics.view",
        "analytics.export",
        "finance.view",
        "finance.create",
        "finance.update",
        "finance.delete",
        "finance.export",
      ],
    },
    {
      name: "Automation",
      description: "Integrations and document upload workflows.",
      permissionKeys: ["integration.manage", "document.upload"],
    },
    {
      name: "System Administration",
      description: "Organization profile, roles, and platform governance.",
      permissionKeys: [
        "organization.update",
        "organization_settings.update",
        "role.view",
        "role.create",
        "role.update",
        "role.delete",
        "role_template.manage",
        "permission_group.manage",
        "permission_audit.view",
      ],
    },
  ];

  const roleTemplates = [
    {
      name: "Department Head",
      description: "Starting point for a department-head custom role, based on HR.",
      basedOnSystemRole: "hr",
      permissionKeys: hrPermissions,
    },
    {
      name: "Project Lead",
      description: "Starting point for a project-lead custom role, based on Manager.",
      basedOnSystemRole: "manager",
      permissionKeys: managerPermissions,
    },
    {
      name: "Read-Only Auditor",
      description: "View-only access to roles, audit log, and role history.",
      basedOnSystemRole: "employee",
      permissionKeys: ["role.view", "permission_audit.view", "role_history.view"],
    },
  ];

  await syncDefaultRoles();

  // Backfill collaboration.moderate onto Manager/HR even if their Role documents
  // were already seeded in an earlier session (setOnInsert above wouldn't touch them).
  await RoleModel.updateOne({ slug: "manager" }, { $addToSet: { permissionKeys: "collaboration.moderate" } });
  await RoleModel.updateOne({ slug: "hr" }, { $addToSet: { permissionKeys: "collaboration.moderate" } });
  await RoleModel.updateOne({ slug: "manager" }, { $addToSet: { permissionKeys: "notification.broadcast" } });
  await RoleModel.updateOne({ slug: "hr" }, { $addToSet: { permissionKeys: "notification.broadcast" } });
  await RoleModel.updateOne({ slug: "manager" }, { $addToSet: { permissionKeys: "audit.view" } });
  await RoleModel.updateOne({ slug: "hr" }, { $addToSet: { permissionKeys: "audit.view" } });
  await RoleModel.updateOne({ slug: "developer" }, { $addToSet: { permissionKeys: "audit.view" } });
  await RoleModel.updateOne({ slug: "manager" }, { $addToSet: { permissionKeys: "user.create" } });
  await RoleModel.updateOne({ slug: "hr" }, { $addToSet: { permissionKeys: "user.create" } });
  await RoleModel.updateOne({ slug: "manager" }, { $addToSet: { permissionKeys: "user.view_all" } });
  await RoleModel.updateOne({ slug: "manager" }, { $addToSet: { permissionKeys: "user.edit" } });
  await RoleModel.updateOne({ slug: "hr" }, { $addToSet: { permissionKeys: "user.edit" } });
  await RoleModel.updateOne({ slug: "manager" }, { $addToSet: { permissionKeys: "workflow.approve_step" } });

  // Backfill Task permissions onto roles seeded before Task management existed.
  await RoleModel.updateOne(
    { slug: "manager" },
    {
      $addToSet: {
        permissionKeys: {
          $each: [
            "project.comment",
            "task.view_stats",
            "task.export",
            "task.create",
            "task.update",
            "task.delete",
            "task.bulk_update",
            "task.bulk_delete",
            "task.log_time",
            "task.comment",
          ],
        },
      },
    },
  );
  await RoleModel.updateOne({ slug: "hr" }, { $addToSet: { permissionKeys: "task.view_stats" } });
  await RoleModel.updateOne({ slug: "finance" }, { $addToSet: { permissionKeys: "task.view_stats" } });
  await RoleModel.updateOne(
    { slug: "employee" },
    { $addToSet: { permissionKeys: { $each: ["task.create", "task.update", "task.log_time", "task.comment"] } } },
  );

  // Backfill Lead permissions onto roles seeded before the CRM lead entity existed.
  await RoleModel.updateOne(
    { slug: "manager" },
    {
      $addToSet: {
        permissionKeys: { $each: ["lead.view_all", "lead.view_stats", "lead.create", "lead.update", "lead.delete"] },
      },
    },
  );
  await RoleModel.updateOne(
    { slug: "sales" },
    {
      $addToSet: {
        permissionKeys: { $each: ["lead.view_all", "lead.view_stats", "lead.create", "lead.update"] },
      },
    },
  );

  // Backfill Finance permissions onto roles seeded before the Finance module existed.
  await RoleModel.updateOne(
    { slug: "finance" },
    {
      $addToSet: {
        permissionKeys: { $each: ["finance.view", "finance.create", "finance.update", "finance.delete", "finance.export"] },
      },
    },
  );
  await RoleModel.updateOne({ slug: "sales" }, { $addToSet: { permissionKeys: "finance.view" } });

  for (const group of permissionGroups) {
    await PermissionGroupModel.updateOne(
      { name: group.name },
      { $setOnInsert: group },
      { upsert: true },
    );
  }

  for (const template of roleTemplates) {
    await RoleTemplateModel.updateOne(
      { name: template.name },
      { $setOnInsert: template },
      { upsert: true },
    );
  }

  logger.info(`Seeded ${roleDefinitions.length} system roles, ${permissionGroups.length} permission groups, ${roleTemplates.length} role templates`);
}

async function seedCollaborationLegacy() {
  const organization = await OrganizationModel.findOne({ scope: organizationScope });
  if (!organization) return;

  const [admin, ceo, manager, employee] = await Promise.all([
    UserModel.findOne({ email: "priya.sharma@aibos.company" }),
    UserModel.findOne({ email: "rajeev.khanna@aibos.company" }),
    UserModel.findOne({ email: "rohan.kapoor@aibos.company" }),
    UserModel.findOne({ email: "aditya.rao@aibos.company" }),
  ]);

  let team = await TeamModel.findOne({ organizationId: organization._id, name: "Product Team" });
  if (!team) {
    const engineering = await DepartmentModel.findOne({ organizationId: organization._id, name: "Engineering" });
    if (engineering && manager) {
      team = await TeamModel.create({
        organizationId: organization._id,
        name: "Product Team",
        departmentId: engineering._id,
        leadId: manager._id,
        memberIds: [manager._id, employee?._id].filter(Boolean),
        status: "Active",
      });

      await UserModel.updateOne({ _id: manager._id }, { $addToSet: { teamIds: team._id } });
      if (employee) {
        await UserModel.updateOne({ _id: employee._id }, { $addToSet: { teamIds: team._id } });
      }
    }
  }

  const workspaceRoom = await CollaborationRoomModel.findOneAndUpdate(
    { organizationId: organization._id, roomType: "workspace" },
    {
      $setOnInsert: {
        organizationId: organization._id,
        roomType: "workspace",
        name: "Workspace",
        participantIds: [],
        createdBy: admin?._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const teamRoom = team
    ? await CollaborationRoomModel.findOneAndUpdate(
        { organizationId: organization._id, roomType: "team", teamId: team._id },
        {
          $setOnInsert: {
            organizationId: organization._id,
            roomType: "team",
            teamId: team._id,
            name: `${team.name} Team`,
            participantIds: [],
            createdBy: admin?._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    : null;

  const project = await ProjectModel.findOne({ projectCode: "PRJ-2026-SALES" });
  const projectRoom = project
    ? await CollaborationRoomModel.findOneAndUpdate(
        { organizationId: organization._id, roomType: "project", projectId: project._id },
        {
          $setOnInsert: {
            organizationId: organization._id,
            roomType: "project",
            projectId: project._id,
            name: project.projectName,
            participantIds: [],
            createdBy: admin?._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    : null;

  let seededMessageCount = 0;

  if (admin && ceo && (await CollaborationMessageModel.countDocuments({ roomId: workspaceRoom._id })) === 0) {
    const welcome = await CollaborationMessageModel.create({
      roomId: workspaceRoom._id,
      authorId: admin._id,
      body: "Welcome to the AI BOS workspace, team! Let's build something great.",
      mentionedUserIds: [],
      attachments: [],
      reactions: [{ emoji: "🎉", userId: ceo._id }],
      isPinned: true,
      pinnedBy: admin._id,
      pinnedAt: new Date(),
    });
    await CollaborationRoomModel.updateOne({ _id: workspaceRoom._id }, { $set: { lastMessageAt: welcome.createdAt } });
    seededMessageCount += 1;
  }

  if (teamRoom && manager && (await CollaborationMessageModel.countDocuments({ roomId: teamRoom._id })) === 0) {
    const message = await CollaborationMessageModel.create({
      roomId: teamRoom._id,
      authorId: manager._id,
      body: "Kickoff sync tomorrow at 10am — please review the sprint board before then.",
      mentionedUserIds: [],
      attachments: [],
      reactions: [],
      isPinned: false,
    });
    await CollaborationRoomModel.updateOne({ _id: teamRoom._id }, { $set: { lastMessageAt: message.createdAt } });
    seededMessageCount += 1;
  }

  if (projectRoom && admin && (await CollaborationMessageModel.countDocuments({ roomId: projectRoom._id })) === 0) {
    const message = await CollaborationMessageModel.create({
      roomId: projectRoom._id,
      authorId: admin._id,
      body: "Project channel is live — share blockers and updates here.",
      mentionedUserIds: [],
      attachments: [],
      reactions: [],
      isPinned: false,
    });
    await CollaborationRoomModel.updateOne({ _id: projectRoom._id }, { $set: { lastMessageAt: message.createdAt } });
    seededMessageCount += 1;
  }

  await CollaborationNoteModel.findOneAndUpdate(
    { roomId: workspaceRoom._id },
    {
      $setOnInsert: {
        roomId: workspaceRoom._id,
        title: "Onboarding notes",
        body: "- Set up your profile\n- Join your team channel\n- Say hello in Workspace chat",
        lastEditedBy: admin?._id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  logger.info(
    `Seeded collaboration rooms (workspace${teamRoom ? ", team" : ""}${projectRoom ? ", project" : ""}) with ${seededMessageCount} starter messages`,
  );
}

async function seedCollaboration() {
  const organization = await OrganizationModel.findOne({ scope: organizationScope });
  if (!organization) return;

  const [admin, ceo, manager, engineer, support] = await Promise.all([
    UserModel.findOne({ email: `isha.sinha@${companyDomain}` }),
    UserModel.findOne({ email: `aarav.mehta@${companyDomain}` }),
    UserModel.findOne({ email: `kabir.arora@${companyDomain}` }),
    UserModel.findOne({ email: `tara.kulkarni@${companyDomain}` }),
    UserModel.findOne({ email: `manav.bansal@${companyDomain}` }),
  ]);

  const engineering = await DepartmentModel.findOne({ organizationId: organization._id, name: "Engineering" });
  let team = engineering
    ? await TeamModel.findOneAndUpdate(
        { organizationId: organization._id, name: "Platform Engineering Squad" },
        {
          $set: {
            organizationId: organization._id,
            name: "Platform Engineering Squad",
            departmentId: engineering._id,
            leadId: engineer?._id,
            memberIds: [engineer?._id, manager?._id, support?._id].filter(Boolean),
            description: "Core product engineering team for APIs, dashboards, and deployment automation.",
            status: "Active",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    : null;

  if (team) {
    await UserModel.updateMany(
      { email: { $in: [`tara.kulkarni@${companyDomain}`, `kabir.arora@${companyDomain}`, `manav.bansal@${companyDomain}`] } },
      { $addToSet: { teamIds: team._id } },
    );
  }

  const workspaceRoom = await CollaborationRoomModel.findOneAndUpdate(
    { organizationId: organization._id, roomType: "workspace" },
    {
      $set: {
        organizationId: organization._id,
        roomType: "workspace",
        name: "Nexora HQ",
        participantIds: [],
        createdBy: admin?._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const teamRoom = team
    ? await CollaborationRoomModel.findOneAndUpdate(
        { organizationId: organization._id, roomType: "team", teamId: team._id },
        {
          $set: {
            organizationId: organization._id,
            roomType: "team",
            teamId: team._id,
            name: "Platform Engineering",
            participantIds: [],
            createdBy: admin?._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    : null;

  const project = await ProjectModel.findOne({ projectCode: "NEX-PRJ-2026-002" });
  const projectRoom = project
    ? await CollaborationRoomModel.findOneAndUpdate(
        { organizationId: organization._id, roomType: "project", projectId: project._id },
        {
          $set: {
            organizationId: organization._id,
            roomType: "project",
            projectId: project._id,
            name: project.projectName,
            participantIds: [],
            createdBy: admin?._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    : null;

  let seededMessageCount = 0;

  if (admin && ceo) {
    const welcome = await CollaborationMessageModel.create({
      roomId: workspaceRoom._id,
      authorId: admin._id,
      body: "Welcome to Nexora HQ. July priorities: finish ERP security review, close Northstar UAT blockers, and keep support SLAs under 4 hours.",
      mentionedUserIds: [],
      attachments: [],
      reactions: [{ emoji: "OK", userId: ceo._id }],
      isPinned: true,
      pinnedBy: admin._id,
      pinnedAt: new Date("2026-07-22T10:10:00.000Z"),
      createdAt: new Date("2026-07-22T10:00:00.000Z"),
    });
    await CollaborationRoomModel.updateOne({ _id: workspaceRoom._id }, { $set: { lastMessageAt: welcome.createdAt } });
    seededMessageCount += 1;
  }

  if (teamRoom && manager) {
    const message = await CollaborationMessageModel.create({
      roomId: teamRoom._id,
      authorId: manager._id,
      body: "Sprint 14 is active. Please update API contracts before today's 5pm deployment review.",
      mentionedUserIds: [],
      attachments: [],
      reactions: [],
      isPinned: false,
      createdAt: new Date("2026-07-24T11:30:00.000Z"),
    });
    await CollaborationRoomModel.updateOne({ _id: teamRoom._id }, { $set: { lastMessageAt: message.createdAt } });
    seededMessageCount += 1;
  }

  if (projectRoom && admin) {
    const message = await CollaborationMessageModel.create({
      roomId: projectRoom._id,
      authorId: admin._id,
      body: "NexOps ERP channel is live. Share blockers, release notes, and QA evidence here.",
      mentionedUserIds: [],
      attachments: [],
      reactions: [],
      isPinned: false,
      createdAt: new Date("2026-07-25T09:15:00.000Z"),
    });
    await CollaborationRoomModel.updateOne({ _id: projectRoom._id }, { $set: { lastMessageAt: message.createdAt } });
    seededMessageCount += 1;
  }

  await CollaborationNoteModel.create({
    roomId: workspaceRoom._id,
    title: "Nexora operating notes",
    body: "- Keep daily updates in Company Messenger\n- Attach QA proof before release approval\n- Use employee directory data from the backend only",
    lastEditedBy: admin?._id,
  });

  logger.info(
    `Seeded Nexora collaboration rooms (workspace${teamRoom ? ", team" : ""}${projectRoom ? ", project" : ""}) with ${seededMessageCount} starter messages`,
  );
}

async function seedNotificationDefaults() {
  const admin = await UserModel.findOne({ email: `isha.sinha@${companyDomain}` });
  if (!admin) return;

  const reminderTitle = "Submit Nexora weekly status update";
  const existingReminder = await ScheduledNotificationModel.findOne({
    createdBy: admin._id,
    title: reminderTitle,
  });

  if (!existingReminder) {
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(9, 0, 0, 0);

    await ScheduledNotificationModel.create({
      createdBy: admin._id,
      recipientUserIds: [],
      recipientRoles: ["Employee", "Manager"],
      title: reminderTitle,
      body: "Add progress, blockers, release risks, and next-week plans to Company Messenger before Friday 5pm.",
      category: "reminder",
      priority: "Medium",
      actionUrl: "/messenger",
      scheduledFor: nextMonday,
      recurrence: { frequency: "weekly", interval: 1 },
      nextFireAt: nextMonday,
    });
  }

  const welcomeType = "welcome_to_notification_center";
  const existingWelcome = await NotificationModel.findOne({ recipientUserId: admin._id, type: welcomeType });

  if (!existingWelcome) {
    await notificationService.dispatch({
      recipientUserIds: [(admin._id as Types.ObjectId).toString()],
      type: welcomeType,
      category: "system",
      priority: "Low",
      title: "Nexora notification center is live",
      body: "Manage release reminders, customer escalations, and team announcements from here.",
      actionUrl: "/notifications",
    });
  }

  const recipients = await UserModel.find({ email: { $in: [`kabir.arora@${companyDomain}`, `tara.kulkarni@${companyDomain}`, `rhea.kapoor@${companyDomain}`] } });
  if (recipients.length) {
    await NotificationModel.insertMany(
      recipients.map((recipient, index) => ({
        recipientUserId: recipient._id,
        actorUserId: admin._id,
        type: "demo_operating_update",
        category: index === 2 ? "broadcast" : "reminder",
        priority: index === 0 ? "High" : "Medium",
        title: index === 2 ? "Northstar proposal follow-up due" : "Release readiness review",
        body: index === 2 ? "Update CRM notes and send the revised proposal by tomorrow." : "Review open blockers before the NexOps release checkpoint.",
        actionUrl: index === 2 ? "/crm" : "/projects",
        sourceType: "seed",
        channels: { inApp: true, email: false, whatsapp: false, push: false },
        isRead: false,
        createdAt: new Date(`2026-07-${23 + index}T09:30:00.000Z`),
      })),
    );
  }

  logger.info("Seeded notification defaults and operating updates");
}

async function seedIntegrationDefaults() {
  for (const family of integrationFamilies) {
    await IntegrationProviderConfigModel.updateOne(
      { family },
      { $setOnInsert: { family, isEnabled: false } },
      { upsert: true },
    );
  }

  logger.info(`Seeded ${integrationFamilies.length} integration provider config placeholders`);
}

async function seedBackupDefaults() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const type of backupTypes) {
    await BackupScheduleModel.updateOne(
      { type },
      { $setOnInsert: { type, frequency: "daily", isEnabled: false, retentionDays: 30, nextRunAt: tomorrow } },
      { upsert: true },
    );
  }

  logger.info(`Seeded ${backupTypes.length} backup schedule placeholders (disabled by default)`);
}

async function seedEmployeeProfiles() {
  const organization = await OrganizationModel.findOne({ scope: organizationScope });
  if (!organization) return;

  const departments = await DepartmentModel.find({ organizationId: organization._id }).select("_id name").lean();
  const departmentIdByName = new Map(departments.map((department) => [department.name, department._id]));
  const branches = await BranchModel.find({ organizationId: organization._id }).select("_id name").lean();
  const branchIdByName = new Map(branches.map((branch) => [branch.name, branch._id]));
  const users = await UserModel.find({ email: { $in: seedUsers.map((user) => user.email) } }).select("_id email").lean();
  const userIdByEmail = new Map(users.map((user) => [user.email, user._id]));

  for (const user of seedUsers) {
    const departmentId = departmentIdByName.get(user.department);
    const managerId = user.managerEmail ? userIdByEmail.get(user.managerEmail) : undefined;
    const branchId = user.employeeProfile.location?.includes("Mumbai")
      ? branchIdByName.get("Mumbai Client Office")
      : branchIdByName.get("Bengaluru HQ");
    await UserModel.updateOne(
      { email: user.email },
      { $set: { organizationId: organization._id, departmentId, branchId, managerId, companyName, employeeProfile: user.employeeProfile } },
    );
  }

  logger.info(`Synced employee profiles and department assignments for ${seedUsers.length} users`);
}

async function seedCompanyPoliciesAndHolidays() {
  const organization = await OrganizationModel.findOne({ scope: organizationScope });
  const admin = await UserModel.findOne({ email: `isha.sinha@${companyDomain}` });
  if (!organization) return;

  await CompanyPolicyModel.insertMany([
    {
      organizationId: organization._id,
      title: "Secure Software Development Lifecycle",
      category: "Security",
      content:
        "All Nexora projects must pass code review, dependency checks, role-based access review, and QA sign-off before production release.",
      status: "Published",
      version: 1,
      effectiveDate: new Date("2026-02-01"),
      acknowledgementRequired: true,
      tags: ["security", "engineering", "release"],
      createdBy: admin?._id,
      updatedBy: admin?._id,
      createdAt: new Date("2026-02-01T09:00:00.000Z"),
    },
    {
      organizationId: organization._id,
      title: "Hybrid Work and Attendance",
      category: "HR",
      content:
        "Teams work from the Bengaluru HQ twice a week. Remote employees must keep availability, leave, and daily updates current in the platform.",
      status: "Published",
      version: 1,
      effectiveDate: new Date("2026-03-01"),
      acknowledgementRequired: true,
      tags: ["hr", "attendance", "remote"],
      createdBy: admin?._id,
      updatedBy: admin?._id,
      createdAt: new Date("2026-03-01T09:00:00.000Z"),
    },
    {
      organizationId: organization._id,
      title: "Client Data Handling",
      category: "Compliance",
      content:
        "Client production data may be accessed only for approved support or migration tasks and must never be copied into local demo environments.",
      status: "Published",
      version: 1,
      effectiveDate: new Date("2026-04-15"),
      acknowledgementRequired: true,
      tags: ["compliance", "client-data"],
      createdBy: admin?._id,
      updatedBy: admin?._id,
      createdAt: new Date("2026-04-15T09:00:00.000Z"),
    },
  ]);

  const branchIds = (await BranchModel.find({ organizationId: organization._id }).select("_id").lean()).map((branch) => branch._id);
  await HolidayModel.insertMany([
    {
      organizationId: organization._id,
      name: "Republic Day",
      date: new Date("2026-01-26"),
      type: "Public",
      description: "National holiday",
      isRecurringAnnually: true,
      branchIds,
      createdBy: admin?._id,
    },
    {
      organizationId: organization._id,
      name: "Nexora Foundation Day",
      date: new Date("2026-04-03"),
      type: "Company",
      description: "Company-wide offsite and product showcase",
      isRecurringAnnually: true,
      branchIds,
      createdBy: admin?._id,
    },
    {
      organizationId: organization._id,
      name: "Independence Day",
      date: new Date("2026-08-15"),
      type: "Public",
      description: "National holiday",
      isRecurringAnnually: true,
      branchIds,
      createdBy: admin?._id,
    },
  ]);

  logger.info("Seeded Nexora company policies and holiday calendar");
}

async function remapLegacyUsers() {
  const adminResult = await UserModel.updateMany(
    { role: "Admin" },
    { $set: { role: "Administrator" } },
  );

  const ownerResult = await UserModel.updateMany(
    { role: "CEO" },
    { $set: { role: "Owner" } },
  );

  logger.info(`Remapped ${adminResult.modifiedCount + ownerResult.modifiedCount} legacy role users`);
}

async function seedDatabase() {
  await connectDatabase();

  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready for reset");
  }

  await mongoose.connection.db.dropDatabase();
  logger.warn(`Cleared database before seeding Nexora demo data: ${env.MONGODB_URI}`);

  if (!demoPassword) {
    throw new Error("AI_BOS_DEMO_SEED_PASSWORD is required to run demo seed data");
  }

  const passwordHash = await hashPassword(demoPassword);

  for (const user of seedUsers) {
    await UserModel.updateOne(
      { email: user.email },
      {
        $set: {
          fullName: user.fullName,
          companyName: user.companyName,
          email: user.email,
          role: user.role,
          passwordHash,
          isEmailVerified: true,
          isActive: true,
          isProfileComplete: true,
        },
      },
      { upsert: true },
    );
  }

  for (const project of seedProjects) {
    await ProjectModel.updateOne(
      { projectCode: project.projectCode },
      { $set: project },
      { upsert: true },
    );
  }

  await seedOrganization();
  await seedEmployeeProfiles();
  await seedRBAC();
  await seedCompanyPoliciesAndHolidays();
  await seedCollaboration();
  await seedNotificationDefaults();
  await seedIntegrationDefaults();
  await seedBackupDefaults();
  await remapLegacyUsers();

  logger.info(`Seeded ${seedUsers.length} Nexora users and ${seedProjects.length} projects into ${env.MONGODB_URI}`);
  await disconnectDatabase();
}

void seedDatabase()
  .then(() => process.exit(0))
  .catch(async (error) => {
    logger.error(error);
    await disconnectDatabase();
    process.exit(1);
  });
