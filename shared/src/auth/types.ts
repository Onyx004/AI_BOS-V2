export const authRoles = ["Owner", "Administrator", "Manager", "HR", "Finance", "Sales", "Support", "Developer", "Employee"] as const;

export type AuthRole = (typeof authRoles)[number];

export type JwtReadySession = {
 accessToken: string;
 refreshToken: string;
 tokenType: "Bearer";
 expiresIn: number;
 user: {
 email: string;
 role: AuthRole;
 /** Only for custom roles: the real role name. `role` is then "Employee" so the Employee workspace opens. */
 roleName?: string;
 fullName: string;
 permissions?: string[];
 companyName?: string;
 isProfileComplete: boolean;
 mustChangePassword: boolean;
 hasActiveFaceEnrollment?: boolean;
 avatar?: string;
 };
};

/** Decodes a JWT's payload without verifying its signature — only for reading claims like `exp` client-side. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
 try {
 const segment = token.split(".")[1];
 if (!segment) return null;
 const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(segment.length + ((4 - (segment.length % 4)) % 4), "=");
 return JSON.parse(atob(base64)) as Record<string, unknown>;
 } catch {
 return null;
 }
}
