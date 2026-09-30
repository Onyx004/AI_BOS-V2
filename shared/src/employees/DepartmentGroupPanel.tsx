import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Search, UsersRound } from "lucide-react";
import { Avatar } from "@shared/ui/avatar";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { useToast } from "@shared/ui/toast-context";
import { fetchAssignableRoles, updateEmployeeDepartment, updateEmployeeRole } from "./employees.api";
import type { Department, Employee } from "./employees.types";

type DepartmentGroupPanelProps = {
 department: Department;
 members: Employee[];
 otherDepartments: Department[];
 nonMembers: Employee[];
 onChanged: () => void;
 /** The "Unassigned" group: employees without a department. Adding someone here takes them out of their department. */
 isUnassigned?: boolean;
};

export function DepartmentGroupPanel({ department, members, otherDepartments, nonMembers, onChanged, isUnassigned = false }: DepartmentGroupPanelProps) {
 const [search, setSearch] = useState("");
 const [busyId, setBusyId] = useState<string | null>(null);
 const [movePickerId, setMovePickerId] = useState<string | null>(null);
 const [rolePickerId, setRolePickerId] = useState<string | null>(null);
 const [assignableRoleOptions, setAssignableRoleOptions] = useState<string[]>([]);
 const { toast } = useToast();

 useEffect(() => {
 fetchAssignableRoles().then((result) => {
 if (result.status === "ok") setAssignableRoleOptions(result.data);
 });
 }, []);

 const filteredNonMembers = useMemo(
 () =>
 search.trim()
 ? nonMembers.filter((employee) => `${employee.name} ${employee.email}`.toLowerCase().includes(search.toLowerCase()))
 : [],
 [nonMembers, search],
 );

 const addMember = async (employee: Employee) => {
 setBusyId(employee.id);
 try {
 await updateEmployeeDepartment(employee.id, isUnassigned ? null : department.id);
 toast({ title: "Member added", description: `${employee.name} moved to ${isUnassigned ? "Unassigned" : department.name}.`, type: "success" });
 setSearch("");
 onChanged();
 } catch (error) {
 toast({ title: "Could not add member", description: (error as Error).message, type: "error" });
 } finally {
 setBusyId(null);
 }
 };

 const moveMember = async (employee: Employee, targetDepartmentId: string | null) => {
 setBusyId(employee.id);
 try {
 await updateEmployeeDepartment(employee.id, targetDepartmentId);
 const target = otherDepartments.find((item) => item.id === targetDepartmentId);
 toast({ title: "Member moved", description: `${employee.name} moved to ${targetDepartmentId === null ? "Unassigned" : (target?.name ?? "another department")}.`, type: "success" });
 setMovePickerId(null);
 onChanged();
 } catch (error) {
 toast({ title: "Could not move member", description: (error as Error).message, type: "error" });
 } finally {
 setBusyId(null);
 }
 };

 const changeRole = async (employee: Employee, role: string) => {
 setBusyId(employee.id);
 try {
 await updateEmployeeRole(employee.id, role);
 toast({ title: "Role updated", description: `${employee.name} is now ${role}.`, type: "success" });
 setRolePickerId(null);
 onChanged();
 } catch (error) {
 toast({ title: "Could not update role", description: (error as Error).message, type: "error" });
 } finally {
 setBusyId(null);
 }
 };

 return (
 <Card className="glass overflow-hidden">
 <CardHeader className="space-y-1">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <CardTitle className="flex min-w-0 items-center gap-2">
 <UsersRound className="h-4 w-4 shrink-0 text-primary" />
 <span className="truncate" title={department.name}>{department.name}</span>
 </CardTitle>
 <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
 {isUnassigned ? members.length : department.memberCount} {(isUnassigned ? members.length : department.memberCount) === 1 ? "member" : "members"}
 </span>
 </div>
 {department.head && <p className="truncate text-xs text-muted-foreground">Head: {department.head.fullName}</p>}
 {department.description && <p className="truncate text-xs text-muted-foreground">{department.description}</p>}
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="relative">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
 <Input
 className="h-9 pl-8 text-sm"
 onChange={(event) => setSearch(event.target.value)}
 placeholder={isUnassigned ? "Move an employee to Unassigned..." : "Add an employee to this department..."}
 value={search}
 />
 </div>

 {search.trim() && (
 <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-background p-1">
 {filteredNonMembers.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching employees.</p>}
 {filteredNonMembers.map((employee) => (
 <button
 className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
 disabled={busyId === employee.id}
 key={employee.id}
 onClick={() => void addMember(employee)}
 type="button"
 >
 <Avatar className="h-7 w-7 shrink-0 rounded-md text-xs" name={employee.name} value={employee.avatar} />
 <span className="min-w-0 flex-1 truncate">{employee.name}</span>
 <span className="max-w-[35%] shrink-0 truncate text-xs text-muted-foreground">{employee.department}</span>
 </button>
 ))}
 </div>
 )}

 <div className="space-y-2">
 {members.length === 0 && <p className="text-sm text-muted-foreground">{isUnassigned ? "Everyone is placed in a department." : "No members yet."}</p>}
 {members.map((employee) => (
 <div className="rounded-lg border bg-background p-2.5" key={employee.id}>
 <div className="flex flex-wrap items-center gap-2.5">
 <Avatar className="h-9 w-9 shrink-0 rounded-md text-xs" name={employee.name} value={employee.avatar} />
 <div className="min-w-0 flex-1 basis-24">
 <p className="truncate text-sm font-semibold" title={employee.name}>{employee.name}</p>
 <p className="truncate text-xs text-muted-foreground" title={employee.designation}>{employee.designation}</p>
 </div>
 <div className="ml-auto flex shrink-0 items-center gap-1.5">
 {assignableRoleOptions.length > 0 ? <button
 className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
 onClick={() => setRolePickerId((current) => (current === employee.id ? null : employee.id))}
 type="button"
 >
 {employee.role}
 </button> : <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{employee.role}</span>}
 <Button
 className="h-7 w-7"
 disabled={busyId === employee.id}
 onClick={() => setMovePickerId((current) => (current === employee.id ? null : employee.id))}
 size="icon"
 title="Move to another department"
 type="button"
 variant="ghost"
 >
 <ArrowRightLeft className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>

 {rolePickerId === employee.id && (
 <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
 {assignableRoleOptions.map((role) => (
 <button
 className="rounded-full border px-2 py-1 text-[11px] font-semibold hover:border-primary/50 hover:text-primary disabled:opacity-50"
 disabled={busyId === employee.id}
 key={role}
 onClick={() => void changeRole(employee, role)}
 type="button"
 >
 {role}
 </button>
 ))}
 </div>
 )}

 {movePickerId === employee.id && (
 <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
 {otherDepartments.length === 0 && <p className="text-xs text-muted-foreground">{isUnassigned ? "Create a department first." : "No other departments yet."}</p>}
 {!isUnassigned && (
 <button
 className="rounded-full border border-dashed px-2 py-1 text-[11px] font-semibold hover:border-primary/50 hover:text-primary disabled:opacity-50"
 disabled={busyId === employee.id}
 onClick={() => void moveMember(employee, null)}
 type="button"
 >
 Unassigned
 </button>
 )}
 {otherDepartments.map((target) => (
 <button
 className="rounded-full border px-2 py-1 text-[11px] font-semibold hover:border-primary/50 hover:text-primary disabled:opacity-50"
 disabled={busyId === employee.id}
 key={target.id}
 onClick={() => void moveMember(employee, target.id)}
 type="button"
 >
 {target.name}
 </button>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 );
}
