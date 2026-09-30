import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldOff, TriangleAlert, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { getStoredAuthSession } from "@shared/auth/auth-service";
import { cn } from "@shared/lib/utils";
import { liveSyncIntervalMs, sharedDataChangedEvent } from "@shared/realtime/data-sync";
import { Button } from "@shared/ui/button";
import { Card } from "@shared/ui/card";
import { Dialog } from "@shared/ui/dialog";
import { EmptyState } from "@shared/ui/empty-state";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { PasswordInput } from "@shared/ui/password-input";
import { useToast } from "@shared/ui/toast-context";
import { employeeDirectoryChangedEvent } from "@shared/employees/employees.api";
import { createProfile, fetchAssignableRoles, fetchTeamAccounts, type TeamAccountsResult } from "./team-accounts.api";
import { createProfileSchema, type CreateProfileFormValues, type TeamAccount } from "./team-accounts.schema";

export function TeamAccountsPage() {
 const { toast } = useToast();
 const session = getStoredAuthSession();
 const [rolesResult, setRolesResult] = useState<TeamAccountsResult<string[]> | null>(null);
 const [accountsResult, setAccountsResult] = useState<TeamAccountsResult<TeamAccount[]> | null>(null);
 const [loading, setLoading] = useState(true);
 const [modalOpen, setModalOpen] = useState(false);
 const loadSequenceRef = useRef(0);

 const load = useCallback(({ silent = false }: { silent?: boolean } = {}) => {
 const requestId = loadSequenceRef.current + 1;
 loadSequenceRef.current = requestId;
 if (!silent) setLoading(true);
 Promise.all([fetchAssignableRoles(), fetchTeamAccounts()])
 .then(([roles, list]) => {
 if (requestId !== loadSequenceRef.current) return;
 setRolesResult(roles);
 setAccountsResult(list);
 })
 .finally(() => {
 if (requestId === loadSequenceRef.current) setLoading(false);
 });
 }, []);

 useEffect(() => {
 let active = true;
 const refreshIfActive = () => {
 if (!active) return;
 load({ silent: true });
 };
 const refreshFromDirectoryEvent = () => {
 if (!active) return;
 load({ silent: true });
 };

 load();
 const intervalId = window.setInterval(refreshIfActive, liveSyncIntervalMs);
 window.addEventListener("focus", refreshIfActive);
 window.addEventListener(sharedDataChangedEvent, refreshFromDirectoryEvent);
 window.addEventListener(employeeDirectoryChangedEvent, refreshFromDirectoryEvent);
 window.addEventListener("storage", refreshFromDirectoryEvent);
 document.addEventListener("visibilitychange", refreshIfActive);
 return () => {
 active = false;
 loadSequenceRef.current += 1;
 window.clearInterval(intervalId);
 window.removeEventListener("focus", refreshIfActive);
 window.removeEventListener(sharedDataChangedEvent, refreshFromDirectoryEvent);
 window.removeEventListener(employeeDirectoryChangedEvent, refreshFromDirectoryEvent);
 window.removeEventListener("storage", refreshFromDirectoryEvent);
 document.removeEventListener("visibilitychange", refreshIfActive);
 };
 }, [load]);

 const assignableRoles = rolesResult?.status === "ok" ? rolesResult.data : null;
 const accounts = accountsResult?.status === "ok" ? accountsResult.data : null;

 const {
 formState: { errors, isSubmitting },
 handleSubmit,
 register,
 reset,
 setValue,
 } = useForm<CreateProfileFormValues>({
 resolver: zodResolver(createProfileSchema),
 defaultValues: { fullName: "", email: "", password: "", role: "Employee", managerId: "", phone: "" },
 });

 useEffect(() => {
 if (assignableRoles && assignableRoles.length > 0) {
 setValue("role", assignableRoles[0]);
 }
 }, [assignableRoles, setValue]);

 const onSubmit: SubmitHandler<CreateProfileFormValues> = async (values) => {
 try {
 await createProfile(values);
 toast({ title: "Profile created", description: `${values.fullName} can now sign in as ${values.role}.`, type: "success" });
 reset({ fullName: "", email: "", password: "", role: assignableRoles?.[0] ?? "Employee", managerId: "", phone: "" });
 setModalOpen(false);
 load();
 } catch (error) {
 toast({ title: "Could not create profile", description: (error as Error).message, type: "error" });
 }
 };

 if (!session) {
 return <div className="p-6 text-sm text-muted-foreground">Sign in to manage team accounts.</div>;
 }

 const canCreate = Boolean(assignableRoles && assignableRoles.length > 0);

 return (
 <div className="space-y-6 p-4 lg:p-6">
 <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
 <div>
 <p className="text-sm font-semibold text-primary">Team Accounts</p>
 <h1 className="text-2xl font-bold">Create and manage user profiles</h1>
 <p className="text-sm text-muted-foreground">
 Your role ({session.user.roleName ?? session.user.role}) determines which roles you can create profiles for.
 </p>
 </div>
 {canCreate && (
 <Button onClick={() => setModalOpen(true)} type="button">
 <Plus className="h-4 w-4" />
 Create Profile
 </Button>
 )}
 </div>

 {loading ? (
 <p className="text-sm text-muted-foreground">Loading…</p>
 ) : rolesResult?.status === "error" || accountsResult?.status === "error" ? (
 <EmptyState
 action={{ label: "Retry", onClick: load }}
 description="We couldn't reach the server. Check your connection and try again."
 icon={TriangleAlert}
 title="Something went wrong"
 />
 ) : accounts === null && !canCreate ? (
 <EmptyState
 description="Your role does not have permission to create or view team accounts."
 icon={ShieldOff}
 title="No access to team accounts"
 />
 ) : accounts === null ? (
 <EmptyState
 description="You can create profiles below, but you don't have permission to view the full directory."
 icon={UsersRound}
 title="Directory hidden"
 />
 ) : accounts.length === 0 ? (
 <EmptyState description="Create the first profile for your team." icon={UsersRound} title="No accounts yet" />
 ) : (
 <Card className="overflow-x-auto">
 <table className="w-full min-w-[560px] text-sm">
 <thead className="border-b bg-muted text-left text-xs uppercase text-muted-foreground">
 <tr>
 <th className="p-3">Name</th>
 <th className="p-3">Email</th>
 <th className="p-3">Role</th>
 <th className="p-3">Manager</th>
 <th className="p-3">Status</th>
 </tr>
 </thead>
 <tbody>
 {accounts.map((account) => (
 <tr key={account.id} className="border-b last:border-0">
 <td className="p-3 font-semibold">{account.fullName}</td>
 <td className="p-3 text-muted-foreground">{account.email}</td>
 <td className="p-3">{account.role}</td>
 <td className="p-3 text-muted-foreground">{account.manager?.fullName ?? "Top level"}</td>
 <td className={cn("p-3 font-semibold", account.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
 {account.isActive ? "Active" : "Disabled"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </Card>
 )}

 {modalOpen && (
 <Dialog as="form" onClose={() => setModalOpen(false)} onSubmit={handleSubmit(onSubmit)}>
 <div className="mb-4 flex items-center justify-between">
 <h2 className="text-lg font-bold">Create profile</h2>
 <Button aria-label="Close" onClick={() => setModalOpen(false)} size="icon" type="button" variant="ghost">
 <X className="h-4 w-4" />
 </Button>
 </div>

 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="fullName">Full name</Label>
 <Input id="fullName" {...register("fullName")} />
 {errors.fullName && <p className="text-xs font-medium text-destructive">{errors.fullName.message}</p>}
 </div>

 <div className="space-y-2">
 <Label htmlFor="email">Email</Label>
 <Input id="email" type="email" {...register("email")} />
 {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
 </div>

 <div className="space-y-2">
 <Label htmlFor="password">Temporary password</Label>
 <PasswordInput id="password" placeholder="Temporary password" {...register("password")} />
 {errors.password && <p className="text-xs font-medium text-destructive">{errors.password.message}</p>}
 </div>

 <div className="space-y-2">
 <Label htmlFor="role">Role</Label>
 <select
 className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
 id="role"
 {...register("role")}
 >
 {(assignableRoles ?? []).map((role) => (
 <option key={role} value={role}>
 {role}
 </option>
 ))}
 </select>
 {errors.role && <p className="text-xs font-medium text-destructive">{errors.role.message}</p>}
 </div>

 <div className="space-y-2">
 <Label htmlFor="managerId">Reports to</Label>
 <select
 className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
 id="managerId"
 {...register("managerId")}
 >
 <option value="">Top level / creator default</option>
 {(accounts ?? []).map((account) => (
 <option key={account.id} value={account.id}>
 {account.fullName} - {account.role}
 </option>
 ))}
 </select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="phone">Phone</Label>
 <Input id="phone" {...register("phone")} />
 {errors.phone && <p className="text-xs font-medium text-destructive">{errors.phone.message}</p>}
 </div>
 </div>

 <div className="mt-6 flex justify-end gap-2">
 <Button onClick={() => setModalOpen(false)} type="button" variant="outline">
 Cancel
 </Button>
 <Button disabled={isSubmitting} type="submit">
 {isSubmitting ? "Creating…" : "Create Profile"}
 </Button>
 </div>
 </Dialog>
 )}
 </div>
 );
}
