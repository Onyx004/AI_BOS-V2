import { motion } from "framer-motion";
import { CalendarClock, CalendarDays, Link2, Plus, RefreshCw, Trash2, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@shared/ui/ThemeToggle";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { useConfirm } from "@shared/ui/confirm-dialog-context";
import { Dialog } from "@shared/ui/dialog";
import { EmptyState } from "@shared/ui/empty-state";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { useToast } from "@shared/ui/toast-context";
import { cn } from "@shared/lib/utils";
import { liveSyncIntervalMs, sharedDataChangedEvent } from "@shared/realtime/data-sync";
import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { syncIntegration } from "@shared/integrations/integration.api";
import { createMeeting, deleteMeeting, fetchMeetings, updateMeeting } from "./meetings.api";
import type { Meeting, MeetingFormInput, MeetingStatus } from "./meetings.types";

const meetingStatuses: MeetingStatus[] = ["Scheduled", "In Progress", "Completed", "Cancelled"];

function statusClass(status: MeetingStatus) {
 const classes: Record<MeetingStatus, string> = {
 Scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
 "In Progress": "bg-amber-500/10 text-amber-600 dark:text-amber-300",
 Completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
 Cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
 };
 return classes[status];
}

function sourceLabel(source: Meeting["source"]) {
 if (source === "google") return "Google Calendar";
 if (source === "zoom") return "Zoom";
 return "Manual";
}

async function getAccessToken() {
 let session = getStoredAuthSession();
 if (session && isSessionExpired(session)) {
 session = await refreshSession();
 }
 return session?.accessToken;
}

const emptyForm: MeetingFormInput = {
 title: "",
 startTime: "",
 endTime: "",
 status: "Scheduled",
 link: "",
};

function toDatetimeLocal(value?: string) {
 if (!value) return "";
 return value.slice(0, 16);
}

function MeetingFormModal({
 initialMeeting,
 onClose,
 onSubmit,
}: {
 initialMeeting?: Meeting | null;
 onClose: () => void;
 onSubmit: (input: MeetingFormInput) => void;
}) {
 const [form, setForm] = useState<MeetingFormInput>(() =>
 initialMeeting
 ? {
 title: initialMeeting.title,
 startTime: toDatetimeLocal(initialMeeting.startTime),
 endTime: toDatetimeLocal(initialMeeting.endTime),
 status: initialMeeting.status,
 link: initialMeeting.link ?? "",
 }
 : emptyForm,
 );

 const updateField = <K extends keyof MeetingFormInput>(field: K, value: MeetingFormInput[K]) => {
 setForm((current) => ({ ...current, [field]: value }));
 };

 return (
 <Dialog
 as="form"
 className="max-w-2xl"
 onClose={onClose}
 onSubmit={(event) => {
 event.preventDefault();
 onSubmit(form);
 }}
 >
 <div className="mb-6 flex items-start justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">{initialMeeting ? "Edit Meeting" : "Schedule Meeting"}</h2>
 </div>
 <Button onClick={onClose} type="button" variant="outline">
 Close
 </Button>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="title">Title</Label>
 <Input id="title" required value={form.title} onChange={(event) => updateField("title", event.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="startTime">Start</Label>
 <Input id="startTime" required type="datetime-local" value={form.startTime} onChange={(event) => updateField("startTime", event.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="endTime">End</Label>
 <Input id="endTime" type="datetime-local" value={form.endTime} onChange={(event) => updateField("endTime", event.target.value)} />
 </div>
 <div className="space-y-2">
 <Label>Status</Label>
 <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={(event) => updateField("status", event.target.value as MeetingStatus)}>
 {meetingStatuses.map((status) => (
 <option key={status}>{status}</option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="link">Meeting Link</Label>
 <Input id="link" placeholder="https://..." value={form.link} onChange={(event) => updateField("link", event.target.value)} />
 </div>
 </div>

 <div className="mt-6 flex justify-end gap-3">
 <Button onClick={onClose} type="button" variant="outline">
 Cancel
 </Button>
 <Button type="submit">{initialMeeting ? "Save Meeting" : "Schedule Meeting"}</Button>
 </div>
 </Dialog>
 );
}

export function MeetingsPage() {
 const { confirm } = useConfirm();
 const { toast } = useToast();
 const [meetings, setMeetings] = useState<Meeting[]>([]);
 const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
 const [isCreating, setIsCreating] = useState(false);
 const [isSyncing, setIsSyncing] = useState(false);
 const loadSequenceRef = useRef(0);

 const loadMeetings = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
 const requestId = loadSequenceRef.current + 1;
 loadSequenceRef.current = requestId;
 const result = await fetchMeetings();
 if (requestId !== loadSequenceRef.current) return;
 if (result.status === "ok") {
 setMeetings(result.data);
 } else if (!silent) {
 toast({ title: "Could not load meetings", description: "Try refreshing the page.", type: "error" });
 }
 }, [toast]);

 useEffect(() => {
 let active = true;
 const refreshIfActive = () => {
 if (!active) return;
 void loadMeetings({ silent: true });
 };

 void loadMeetings();
 const intervalId = window.setInterval(refreshIfActive, liveSyncIntervalMs);
 window.addEventListener("focus", refreshIfActive);
 window.addEventListener(sharedDataChangedEvent, refreshIfActive);
 document.addEventListener("visibilitychange", refreshIfActive);
 return () => {
 active = false;
 loadSequenceRef.current += 1;
 window.clearInterval(intervalId);
 window.removeEventListener("focus", refreshIfActive);
 window.removeEventListener(sharedDataChangedEvent, refreshIfActive);
 document.removeEventListener("visibilitychange", refreshIfActive);
 };
 }, [loadMeetings]);

 const upsertMeeting = async (input: MeetingFormInput) => {
 const result = editingMeeting ? await updateMeeting(editingMeeting.id, input) : await createMeeting(input);
 if (result.status !== "ok") {
 toast({
 title: editingMeeting ? "Could not update meeting" : "Could not schedule meeting",
 description: result.status === "forbidden" ? "You don't have permission to do that." : "Something went wrong. Try again.",
 type: "error",
 });
 return;
 }
 setMeetings((current) =>
 editingMeeting
 ? current.map((meeting) => (meeting.id === result.data.id ? result.data : meeting))
 : [result.data, ...current],
 );
 setEditingMeeting(null);
 setIsCreating(false);
 };

 const removeMeeting = async (meeting: Meeting) => {
 const accepted = await confirm({
 title: "Delete meeting?",
 description: `"${meeting.title}" will be removed from the schedule.`,
 confirmLabel: "Delete Meeting",
 tone: "danger",
 });
 if (!accepted) return;

 const result = await deleteMeeting(meeting.id);
 if (result.status !== "ok") {
 toast({ title: "Could not delete meeting", description: "Something went wrong. Try again.", type: "error" });
 return;
 }
 setMeetings((current) => current.filter((item) => item.id !== meeting.id));
 toast({ title: "Meeting deleted", description: "The meeting was removed.", type: "warning" });
 };

 const runSync = async (key: "google_calendar" | "zoom") => {
 setIsSyncing(true);
 try {
 const token = await getAccessToken();
 const result = await syncIntegration(key, token);
 toast({ title: "Sync complete", description: result.summary, type: "success" });
 await loadMeetings({ silent: true });
 } catch (error) {
 toast({
 title: "Sync failed",
 description: error instanceof Error ? error.message : "Connect this provider in Integrations first.",
 type: "error",
 });
 } finally {
 setIsSyncing(false);
 }
 };

 const upcoming = meetings.filter((meeting) => meeting.status === "Scheduled" || meeting.status === "In Progress");
 const statCards = [
 { label: "Total Meetings", value: meetings.length, icon: CalendarDays },
 { label: "Upcoming", value: upcoming.length, icon: CalendarClock },
 { label: "Synced from Google/Zoom", value: meetings.filter((meeting) => meeting.source !== "manual").length, icon: Video },
 ];

 return (
 <main className="min-h-screen bg-enterprise">
 <header className="sticky top-0 z-40 border-b bg-background ">
 <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
 <div>
 <p className="text-sm font-semibold text-primary">Meetings</p>
 <h1 className="text-2xl font-bold">Meeting Management</h1>
 </div>
 <div className="flex items-center gap-2">
 <Button asChild type="button" variant="outline">
 <Link to="/dashboard">Dashboard</Link>
 </Button>
 <ThemeToggle />
 <Button onClick={() => setIsCreating(true)} type="button">
 <Plus className="h-4 w-4" />
 Schedule Meeting
 </Button>
 </div>
 </div>
 </header>

 <div className="container space-y-6 py-6">
 <div className="grid gap-4 sm:grid-cols-3">
 {statCards.map((card, index) => {
 const Icon = card.icon;
 return (
 <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} key={card.label} transition={{ delay: index * 0.04 }}>
 <Card className="glass h-full">
 <CardContent className="p-5">
 <Icon className="mb-4 h-5 w-5 text-primary" />
 <p className="text-sm text-muted-foreground">{card.label}</p>
 <p className="mt-2 text-3xl font-bold">{card.value}</p>
 </CardContent>
 </Card>
 </motion.div>
 );
 })}
 </div>

 <Card className="glass">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <RefreshCw className="h-4 w-4 text-primary" />
 Sync from Google Calendar / Zoom
 </CardTitle>
 </CardHeader>
 <CardContent className="flex flex-wrap items-center gap-3">
 <Button disabled={isSyncing} onClick={() => void runSync("google_calendar")} type="button" variant="outline">
 Sync Google Calendar
 </Button>
 <Button disabled={isSyncing} onClick={() => void runSync("zoom")} type="button" variant="outline">
 Sync Zoom
 </Button>
 <Button asChild type="button" variant="outline">
 <Link to="/integrations">
 <Link2 className="h-4 w-4" />
 Connect a provider
 </Link>
 </Button>
 <p className="text-xs text-muted-foreground">Requires Google/Zoom to be connected first in Integrations.</p>
 </CardContent>
 </Card>

 <Card className="glass overflow-hidden">
 <CardHeader>
 <CardTitle>Scheduled Meetings</CardTitle>
 </CardHeader>
 {meetings.length === 0 ? (
 <CardContent>
 <EmptyState
 action={{ label: "Schedule Meeting", onClick: () => setIsCreating(true) }}
 description="No meetings yet. Schedule one manually or sync from a connected provider."
 icon={CalendarDays}
 title="No meetings found"
 />
 </CardContent>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[860px] text-sm">
 <thead className="border-b bg-muted text-left">
 <tr>
 <th className="p-4">Title</th>
 <th className="p-4">Organizer</th>
 <th className="p-4">Start</th>
 <th className="p-4">Source</th>
 <th className="p-4">Status</th>
 <th className="p-4">Link</th>
 <th className="p-4" />
 </tr>
 </thead>
 <tbody>
 {meetings.map((meeting) => (
 <tr className="border-b" key={meeting.id}>
 <td className="p-4 font-semibold">
 <button className="text-left hover:text-primary" onClick={() => setEditingMeeting(meeting)} type="button">
 {meeting.title}
 </button>
 </td>
 <td className="p-4">{meeting.organizerName}</td>
 <td className="p-4">{new Date(meeting.startTime).toLocaleString()}</td>
 <td className="p-4">
 <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{sourceLabel(meeting.source)}</span>
 </td>
 <td className="p-4">
 <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusClass(meeting.status))}>{meeting.status}</span>
 </td>
 <td className="p-4">
 {meeting.link ? (
 <a className="text-primary underline" href={meeting.link} rel="noreferrer" target="_blank">
 Join
 </a>
 ) : (
 <span className="text-muted-foreground">-</span>
 )}
 </td>
 <td className="p-4 text-right">
 {meeting.source === "manual" && (
 <Button onClick={() => void removeMeeting(meeting)} size="sm" type="button" variant="outline">
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </Card>
 </div>

 {(isCreating || editingMeeting) && (
 <MeetingFormModal
 initialMeeting={editingMeeting}
 onClose={() => {
 setIsCreating(false);
 setEditingMeeting(null);
 }}
 onSubmit={upsertMeeting}
 />
 )}
 </main>
 );
}
