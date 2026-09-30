import { LoginPage as SharedLoginPage } from "@shared/auth/pages/LoginPage";

const intendedFor = ["Manager", "Employee", "HR", "Finance", "Sales", "Support", "Developer"] as const;

export function LoginPage() {
 return (
 <SharedLoginPage
 eyebrow="Workspace"
 allowedRoles={intendedFor}
 intendedFor={intendedFor}
 subtitle="Sign in with Manager, Employee, HR, Sales, Finance, Support, or Developer accounts."
 title="Employee Workspace Login"
 />
 );
}
