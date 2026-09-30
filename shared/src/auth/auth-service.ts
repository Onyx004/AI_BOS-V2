import { getApiBaseUrl } from "../lib/env";
import { authRoles, decodeJwtPayload, type AuthRole, type JwtReadySession } from "./types";

export const authSessionChangedEvent = "ai_bos_auth_session_changed";

const rememberedEmailStorageKey = "ai_bos_remembered_email";

/**
 * "Remember me" email-only convenience storage — deliberately separate from
 * session/token persistence above. Never stores a password, token, refresh
 * token, or any other auth secret; only ever holds the email string.
 */
export function getRememberedEmail(): string | null {
 if (typeof window === "undefined") return null;
 return window.localStorage.getItem(rememberedEmailStorageKey);
}

export function setRememberedEmail(email: string) {
 if (typeof window === "undefined") return;
 window.localStorage.setItem(rememberedEmailStorageKey, email);
}

export function clearRememberedEmail() {
 if (typeof window === "undefined") return;
 window.localStorage.removeItem(rememberedEmailStorageKey);
}

const loginMethodStorageKey = "ai_bos_login_method";

export type LoginMethod = "password" | "pin";

/** Which sign-in option (password or PIN) worked last, so the login screen opens on it. Not a secret. */
export function getRememberedLoginMethod(): LoginMethod {
 if (typeof window === "undefined") return "password";
 try {
 return window.localStorage.getItem(loginMethodStorageKey) === "pin" ? "pin" : "password";
 } catch {
 return "password";
 }
}

export function setRememberedLoginMethod(method: LoginMethod) {
 if (typeof window === "undefined") return;
 try {
 window.localStorage.setItem(loginMethodStorageKey, method);
 } catch {
 // storage unavailable: the login screen just falls back to password next time
 }
}

const roleSensitiveStorageKeys = [
 "ai-bos-recent-pages",
 "ai-bos-favorite-pages",
 "admin-completed",
 "manager-completed",
] as const;

const roleSensitiveCacheNames = ["api-get-cache", "api-get-cache-v2"] as const;

type LoginResponse = {
 user: {
 email: string;
 role: string;
 fullName: string;
 permissions?: string[];
 companyName?: string;
 isProfileComplete?: boolean;
 mustChangePassword?: boolean;
 hasActiveFaceEnrollment?: boolean;
 avatar?: string;
 };
 tokens: {
 accessToken: string;
 refreshToken: string;
 tokenType: "Bearer";
 expiresIn: number;
 };
};

function normalizeAuthRole(role: string): AuthRole {
 if (role === "Admin") return "Administrator";
 if (role === "CEO") return "Owner";
 // Custom roles open the Employee workspace; what they can do comes from their permissions.
 return (authRoles as readonly string[]).includes(role) ? (role as AuthRole) : "Employee";
}

/** The real name of a custom role, or undefined for the built-in roles. */
function customRoleName(role: string): string | undefined {
 return role === "Admin" || role === "CEO" || (authRoles as readonly string[]).includes(role) ? undefined : role;
}

function normalizeSession(session: JwtReadySession): JwtReadySession {
 const legacyRole = session.user.role as string;
 return {
 ...session,
 user: {
 ...session.user,
 role: normalizeAuthRole(legacyRole),
 // Sessions stored before this field existed have no `isProfileComplete` at
 // all — treat them as already-complete so already-onboarded users aren't
 // retroactively locked out until their next real login/refresh.
 isProfileComplete: session.user.isProfileComplete ?? true,
 mustChangePassword: session.user.mustChangePassword ?? false,
 permissions: session.user.permissions ?? [],
 },
 };
}

function notifyAuthSessionChanged() {
 if (typeof window !== "undefined") {
 window.dispatchEvent(new Event(authSessionChangedEvent));
 }
}

function clearRoleSensitiveBrowserState() {
 if (typeof window === "undefined") return;

 for (const key of roleSensitiveStorageKeys) {
 window.localStorage.removeItem(key);
 window.sessionStorage.removeItem(key);
 }

 if ("caches" in window) {
 void Promise.all(roleSensitiveCacheNames.map((name) => window.caches.delete(name)));
 }
}

export function persistSession(session: JwtReadySession, rememberMe: boolean) {
  const normalizedSession = normalizeSession(session);
  const previousSession = getStoredAuthSession();

  if (
    previousSession &&
    (previousSession.user.email !== normalizedSession.user.email || previousSession.user.role !== normalizedSession.user.role)
  ) {
    clearRoleSensitiveBrowserState();
  }

 // Always write to sessionStorage so this tab's session is isolated from
 // other tabs on the same origin/port (e.g. Admin and Manager both on :8081).
 sessionStorage.setItem("ai_bos_auth_session", JSON.stringify(normalizedSession));

 if (rememberMe) {
 localStorage.setItem("ai_bos_auth_session", JSON.stringify(normalizedSession));
 } else {
 localStorage.removeItem("ai_bos_auth_session");
 }

 notifyAuthSessionChanged();

 return normalizedSession;
}

/** Patches the signed-in user's own profile fields (e.g. after a self-service edit) in whichever storage already holds the session, without needing to know the original `rememberMe` choice. */
export function updateStoredSessionUser(patch: Partial<JwtReadySession["user"]>) {
 for (const storage of [sessionStorage, localStorage]) {
 const raw = storage.getItem("ai_bos_auth_session");
 if (!raw) continue;
 try {
 const session = JSON.parse(raw) as JwtReadySession;
 storage.setItem("ai_bos_auth_session", JSON.stringify({ ...session, user: { ...session.user, ...patch } }));
 } catch {
 // ignore malformed stored session
 }
 }
 notifyAuthSessionChanged();
}

/** Authenticates against the real backend — the account's role decides access, not the login form. */
export async function login(
 email: string,
 secret: string,
 rememberMe: boolean,
 method: LoginMethod = "password",
): Promise<JwtReadySession> {
 const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(method === "pin" ? { email, pin: secret } : { email, password: secret }),
 });

 const json = await response.json().catch(() => null);

 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to sign in. Please try again.");
 }

  const data = json.data as LoginResponse;
  const session: JwtReadySession = {
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    tokenType: data.tokens.tokenType,
    expiresIn: data.tokens.expiresIn,
    user: {
      email: data.user.email,
      role: normalizeAuthRole(data.user.role),
      roleName: customRoleName(data.user.role),
      fullName: data.user.fullName,
      permissions: data.user.permissions ?? [],
      isProfileComplete: data.user.isProfileComplete ?? true,
      companyName: data.user.companyName,
      mustChangePassword: data.user.mustChangePassword ?? false,
      hasActiveFaceEnrollment: data.user.hasActiveFaceEnrollment,
      avatar: data.user.avatar,
    },
  };

  return persistSession(session, rememberMe);
}

export async function changePassword(currentPassword: string, newPassword: string, pin?: string): Promise<void> {
 const session = getStoredAuthSession();
 const response = await fetch(`${getApiBaseUrl()}/auth/change-password`, {
 method: "PATCH",
 headers: {
 "Content-Type": "application/json",
 ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
 },
 body: JSON.stringify({ currentPassword, newPassword, ...(pin ? { pin } : {}) }),
 });

 const json = await response.json().catch(() => null);

 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to change password. Please try again.");
 }
}

export async function changePin(currentPassword: string, pin: string): Promise<void> {
 const session = getStoredAuthSession();
 const response = await fetch(`${getApiBaseUrl()}/auth/pin`, {
 method: "PUT",
 headers: {
 "Content-Type": "application/json",
 ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
 },
 body: JSON.stringify({ currentPassword, pin }),
 });

 const json = await response.json().catch(() => null);

 if (!response.ok) {
 throw new Error(json?.message ?? "Unable to save PIN. Please try again.");
 }
}

export function getStoredAuthSession(): JwtReadySession | null {
 // Check this tab's own session first. Only a brand-new tab (nothing in
 // sessionStorage yet) falls back to a remembered localStorage session.
 const rawSession =
 sessionStorage.getItem("ai_bos_auth_session") ??
 localStorage.getItem("ai_bos_auth_session");

 if (!rawSession) {
 return null;
 }

 try {
 return normalizeSession(JSON.parse(rawSession) as JwtReadySession);
 } catch {
 return null;
 }
}

export function clearAuthSession() {
 const session = getStoredAuthSession();

 if (session) {
 void window.electronAPI
 ?.ensureDeviceEnrollment?.(
 session.accessToken,
 false,
 )
 .catch(() => undefined);
 }

 localStorage.removeItem("ai_bos_auth_session");
 sessionStorage.removeItem("ai_bos_auth_session");
 clearRoleSensitiveBrowserState();
 notifyAuthSessionChanged();
}

/** True once the access token's own `exp` claim has passed. Returns false for non-JWT/opaque tokens (e.g. in tests) rather than guessing. */
export function isSessionExpired(session: JwtReadySession): boolean {
 const payload = decodeJwtPayload(session.accessToken);
 const role = payload?.role;
 if (role === "CEO" || role === "Admin") return true;
 const exp = typeof payload?.exp === "number" ? payload.exp : null;
 return exp !== null && Date.now() >= exp * 1000;
}

let inFlightRefresh: Promise<JwtReadySession | null> | null = null;

/** Exchanges the stored refresh token for a new session. De-duplicates concurrent callers so a burst of expired API calls only rotates the refresh token once. */
export function refreshSession(): Promise<JwtReadySession | null> {
 if (!inFlightRefresh) {
 inFlightRefresh = performRefresh().finally(() => {
 inFlightRefresh = null;
 });
 }
 return inFlightRefresh;
}

async function performRefresh(): Promise<JwtReadySession | null> {
 const current = getStoredAuthSession();
 if (!current) return null;

 const wasRemembered = localStorage.getItem("ai_bos_auth_session") !== null;

 try {
 const response = await fetch(`${getApiBaseUrl()}/auth/refresh-token`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ refreshToken: current.refreshToken }),
 });

 if (!response.ok) {
 clearAuthSession();
 return null;
 }

 const json = await response.json().catch(() => null);
 const data = json?.data as LoginResponse | undefined;
 if (!data) {
 clearAuthSession();
 return null;
 }

 const session: JwtReadySession = {
 accessToken: data.tokens.accessToken,
 refreshToken: data.tokens.refreshToken,
 tokenType: data.tokens.tokenType,
 expiresIn: data.tokens.expiresIn,
 user: {
 email: data.user.email,
 role: normalizeAuthRole(data.user.role),
 roleName: customRoleName(data.user.role),
 fullName: data.user.fullName,
 permissions: data.user.permissions ?? current.user.permissions ?? [],
 isProfileComplete: data.user.isProfileComplete ?? true,
 companyName: data.user.companyName,
 mustChangePassword: data.user.mustChangePassword ?? false,
 hasActiveFaceEnrollment: data.user.hasActiveFaceEnrollment,
 avatar: data.user.avatar,
 },
 };

 return persistSession(session, wasRemembered);
 } catch {
 clearAuthSession();
 return null;
 }
}
