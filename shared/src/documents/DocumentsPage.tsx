import { motion } from "framer-motion";
import {
 Download,
 Eye,
 FileArchive,
 FileImage,
 FileSpreadsheet,
 FileText,
 Folder,
 History,
 KeyRound,
 Plus,
 Search,
 Share2,
 ShieldCheck,
 Tags,
 UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@shared/ui/ThemeToggle";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Dialog } from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { useToast } from "@shared/ui/toast-context";
import { cn } from "@shared/lib/utils";
import { liveSyncIntervalMs, sharedDataChangedEvent } from "@shared/realtime/data-sync";
import { documentTags, documentUsers, folders, permissionLevels, supportedFileTypes } from "./documents.data";
import type { DocumentFolder, ManagedDocument, PermissionLevel } from "./documents.types";
import { downloadManagedDocument, fetchDocuments, updateDocument, uploadDocument } from "./documents.api";
import { getDocumentStats } from "./documents.utils";

function fileIcon(type: ManagedDocument["type"]) {
 if (type === "Image") return FileImage;
 if (type === "XLSX") return FileSpreadsheet;
 if (type === "PPTX") return FileArchive;
 return FileText;
}

function DocumentPreviewModal({
 document,
 onClose,
 onDownload,
}: {
 document: ManagedDocument;
 onClose: () => void;
 onDownload: () => void;
}) {
 const Icon = fileIcon(document.type);

 return (
 <Dialog className="max-w-5xl" onClose={onClose}>
 <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
 <div className="flex min-w-0 items-start gap-4">
 <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
 <Icon className="h-6 w-6" />
 </span>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-primary">{document.type}</p>
 <h2 className="mt-1 truncate text-2xl font-bold">{document.name}</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 {document.size} - Updated {document.updatedAt}
 </p>
 </div>
 </div>
 <div className="flex gap-2">
 <Button onClick={onDownload} type="button" variant="outline">
 <Download className="h-4 w-4" />
 Download
 </Button>
 <Button onClick={onClose} type="button" variant="outline">
 Close
 </Button>
 </div>
 </div>

 <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
 <Card className="bg-background">
 <CardHeader>
 <CardTitle>Preview</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex min-h-72 items-center justify-center rounded-lg border bg-card p-6 text-center">
 <div>
 <Icon className="mx-auto mb-5 h-16 w-16 text-primary" />
 <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground">{document.previewText}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <div className="space-y-4">
 <Card className="bg-background">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-base">
 <History className="h-4 w-4 text-primary" />
 Version History
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {document.versions.map((version) => (
 <div className="rounded-lg border bg-card p-3" key={version.id}>
 <p className="text-sm font-semibold">{version.version}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 {version.author} - {version.date}
 </p>
 <p className="mt-2 text-xs text-muted-foreground">{version.note}</p>
 </div>
 ))}
 </CardContent>
 </Card>
 <Card className="bg-background">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-base">
 <ShieldCheck className="h-4 w-4 text-primary" />
 Sharing
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {document.sharedWith.length === 0 && <p className="text-sm text-muted-foreground">Private document</p>}
 {document.sharedWith.map((share) => (
 <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm" key={share.user}>
 <span className="font-semibold">{share.user}</span>
 <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{share.permission}</span>
 </div>
 ))}
 </CardContent>
 </Card>
 </div>
 </div>
 </Dialog>
 );
}

function DocumentCard({
 document,
 folder,
 onDownload,
 onPreview,
 onShare,
 onTag,
}: {
 document: ManagedDocument;
 folder?: DocumentFolder;
 onDownload: () => void;
 onPreview: () => void;
 onShare: (user: string, permission: PermissionLevel) => void;
 onTag: (tag: string) => void;
}) {
 const Icon = fileIcon(document.type);

 return (
 <Card className="h-full bg-card hover:-translate-y-1 hover:border-primary/35 hover:shadow-glass">
 <CardContent className="space-y-4 p-5">
 <div className="flex items-start gap-4">
 <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
 <Icon className="h-6 w-6" />
 </span>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-semibold text-primary">{document.type}</p>
 <h3 className="mt-1 line-clamp-2 font-semibold leading-6">{document.name}</h3>
 <p className="mt-1 text-sm text-muted-foreground">{folder?.name ?? "Company"}</p>
 </div>
 </div>

 <div className="grid gap-3 text-sm sm:grid-cols-3">
 <Metric label="Size" value={document.size} />
 <Metric label="Owner" value={document.owner} />
 <Metric label="Versions" value={String(document.versions.length)} />
 </div>

 <div className="flex flex-wrap gap-2">
 {document.tags.map((tag) => (
 <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground" key={tag}>
 {tag}
 </span>
 ))}
 </div>

 <div className="grid gap-2 sm:grid-cols-2">
 <select className="h-10 rounded-md border bg-background px-3 text-sm" onChange={(event) => event.target.value && onTag(event.target.value)} value="">
 <option value="">Add tag</option>
 {documentTags.map((tag) => (
 <option key={tag}>{tag}</option>
 ))}
 </select>
 <select
 className="h-10 rounded-md border bg-background px-3 text-sm"
 onChange={(event) => {
 const [user, permission] = event.target.value.split("|");
 if (user && permission) onShare(user, permission as PermissionLevel);
 }}
 value=""
 >
 <option value="">Share</option>
 {documentUsers.flatMap((user) =>
 permissionLevels.map((permission) => (
 <option key={`${user}-${permission}`} value={`${user}|${permission}`}>
 {user} - {permission}
 </option>
 )),
 )}
 </select>
 </div>

 <div className="flex flex-wrap gap-2">
 <Button onClick={onPreview} size="sm" type="button" variant="outline">
 <Eye className="h-4 w-4" />
 Preview
 </Button>
 <Button onClick={onDownload} size="sm" type="button" variant="outline">
 <Download className="h-4 w-4" />
 Download
 </Button>
 </div>
 </CardContent>
 </Card>
 );
}

function Metric({ label, value }: { label: string; value: string }) {
 return (
 <div className="rounded-lg border bg-background p-3">
 <p className="text-xs text-muted-foreground">{label}</p>
 <p className="mt-1 truncate text-sm font-semibold">{value}</p>
 </div>
 );
}

export function DocumentsPage() {
 const { toast } = useToast();
 const [documents, setDocuments] = useState<ManagedDocument[]>([]);
 const [activeFolder, setActiveFolder] = useState("folder-root");
 const [search, setSearch] = useState("");
 const [typeFilter, setTypeFilter] = useState("All");
 const [tagFilter, setTagFilter] = useState("All");
 const [previewDocument, setPreviewDocument] = useState<ManagedDocument | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const loadSequenceRef = useRef(0);
 const stats = getDocumentStats(documents);

 const loadDocuments = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
 const requestId = loadSequenceRef.current + 1;
 loadSequenceRef.current = requestId;
 const result = await fetchDocuments();
 if (requestId !== loadSequenceRef.current) return;
 if (result.status === "ok") {
 setDocuments(result.data);
 } else if (!silent) {
 toast({ title: "Could not load documents", description: "Try refreshing the page.", type: "error" });
 }
 }, [toast]);

 useEffect(() => {
 let active = true;
 const refreshIfActive = () => {
 if (!active) return;
 void loadDocuments({ silent: true });
 };

 void loadDocuments();
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
 }, [loadDocuments]);

 const visibleDocuments = useMemo(() => {
 return documents
 .filter((document) => activeFolder === "folder-root" || document.folderId === activeFolder)
 .filter((document) => {
 const searchText = `${document.name} ${document.type} ${document.owner} ${document.tags.join(" ")}`.toLowerCase();
 return searchText.includes(search.toLowerCase());
 })
 .filter((document) => typeFilter === "All" || document.type === typeFilter)
 .filter((document) => tagFilter === "All" || document.tags.includes(tagFilter));
 }, [activeFolder, documents, search, tagFilter, typeFilter]);

 const uploadDocuments = async (files: FileList | null) => {
 if (!files?.length) return;
 for (const file of Array.from(files)) {
 const result = await uploadDocument(file, activeFolder);
 if (result.status !== "ok") {
 toast({
 title: "Could not upload document",
 description: result.status === "forbidden" ? "You don't have permission to do that." : `${file.name} failed to upload.`,
 type: "error",
 });
 continue;
 }
 setDocuments((current) => [result.data, ...current]);
 }
 };

 const updateShare = async (documentId: string, user: string, permission: PermissionLevel) => {
 const current = documents.find((document) => document.id === documentId);
 if (!current) return;
 const sharedWith = [{ user, permission }, ...current.sharedWith.filter((share) => share.user !== user)];
 const result = await updateDocument(documentId, { sharedWith });
 if (result.status !== "ok") {
 toast({ title: "Could not update sharing", description: "Something went wrong. Try again.", type: "error" });
 return;
 }
 setDocuments((current) => current.map((document) => (document.id === documentId ? result.data : document)));
 };

 const addTag = async (documentId: string, tag: string) => {
 const current = documents.find((document) => document.id === documentId);
 if (!current || current.tags.includes(tag)) return;
 const result = await updateDocument(documentId, { tags: [...current.tags, tag] });
 if (result.status !== "ok") {
 toast({ title: "Could not add tag", description: "Something went wrong. Try again.", type: "error" });
 return;
 }
 setDocuments((current) => current.map((document) => (document.id === documentId ? result.data : document)));
 };

 const statCards = [
 { label: "Total Documents", value: stats.total, icon: FileText },
 { label: "Shared Files", value: stats.shared, icon: Share2 },
 { label: "Versions", value: stats.versions, icon: History },
 { label: "Storage Used", value: `${stats.storage.toFixed(1)} MB`, icon: UploadCloud },
 ];

 return (
 <main className="min-h-screen bg-enterprise">
 <header className="sticky top-0 z-40 border-b bg-background ">
 <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
 <div>
 <p className="text-sm font-semibold text-primary">Documents</p>
 <h1 className="text-2xl font-bold">Document Management</h1>
 </div>
 <div className="flex items-center gap-2">
 <Button asChild type="button" variant="outline">
 <Link to="/dashboard">Dashboard</Link>
 </Button>
 <ThemeToggle />
 <Button onClick={() => fileInputRef.current?.click()} type="button">
 <Plus className="h-4 w-4" />
 Upload
 </Button>
 <input
 accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
 className="hidden"
 multiple
 onChange={(event) => void uploadDocuments(event.target.files)}
 ref={fileInputRef}
 type="file"
 />
 </div>
 </div>
 </header>

 <div className="container space-y-6 py-6">
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

 <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
 <aside className="space-y-4">
 <Card className="glass">
 <CardHeader>
 <CardTitle>Folder Structure</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2">
 {folders.map((folder) => (
 <button
 className={cn(
 "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted",
 activeFolder === folder.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
 folder.parentId && "ml-4 w-[calc(100%-1rem)]",
 )}
 key={folder.id}
 onClick={() => setActiveFolder(folder.id)}
 type="button"
 >
 <Folder className="h-4 w-4" />
 {folder.name}
 </button>
 ))}
 </CardContent>
 </Card>
 <Card className="glass">
 <CardHeader>
 <CardTitle>Supported Files</CardTitle>
 </CardHeader>
 <CardContent className="flex flex-wrap gap-2">
 {supportedFileTypes.map((type) => (
 <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground" key={type}>
 {type}
 </span>
 ))}
 </CardContent>
 </Card>
 </aside>

 <section className="min-w-0 space-y-4">
 <Card className="glass">
 <CardContent className="space-y-4 p-4">
 <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px]">
 <div className="relative">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input className="pl-9" placeholder="Search documents, tags, owners..." value={search} onChange={(event) => setSearch(event.target.value)} />
 </div>
 <select className="h-11 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
 <option>All</option>
 {supportedFileTypes.map((type) => (
 <option key={type}>{type}</option>
 ))}
 </select>
 <select className="h-11 rounded-md border bg-background px-3 text-sm" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
 <option>All</option>
 {documentTags.map((tag) => (
 <option key={tag}>{tag}</option>
 ))}
 </select>
 </div>
 <div className="flex flex-wrap gap-2">
 {documentTags.map((tag) => (
 <button
 className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
 key={tag}
 onClick={() => setTagFilter(tag)}
 type="button"
 >
 <Tags className="h-3.5 w-3.5" />
 {tag}
 </button>
 ))}
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
 {visibleDocuments.map((document) => (
 <DocumentCard
 document={document}
 folder={folders.find((folder) => folder.id === document.folderId)}
 key={document.id}
 onDownload={() => void downloadManagedDocument(document)}
 onPreview={() => setPreviewDocument(document)}
 onShare={(user, permission) => updateShare(document.id, user, permission)}
 onTag={(tag) => addTag(document.id, tag)}
 />
 ))}
 </div>

 <Card className="glass overflow-hidden">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <KeyRound className="h-5 w-5 text-primary" />
 Permissions
 </CardTitle>
 </CardHeader>
 <div className="overflow-x-auto">
 <table className="w-full min-w-[780px] text-sm">
 <thead className="border-b bg-muted text-left">
 <tr>
 <th className="p-4">Document</th>
 <th className="p-4">Owner</th>
 <th className="p-4">Shared With</th>
 <th className="p-4">Updated</th>
 </tr>
 </thead>
 <tbody>
 {visibleDocuments.map((document) => (
 <tr className="border-b" key={document.id}>
 <td className="p-4 font-semibold">{document.name}</td>
 <td className="p-4">{document.owner}</td>
 <td className="p-4 text-muted-foreground">
 {document.sharedWith.map((share) => `${share.user} (${share.permission})`).join(", ") || "Private"}
 </td>
 <td className="p-4">{document.updatedAt}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </Card>
 </section>
 </div>
 </div>

 {previewDocument && (
 <DocumentPreviewModal
 document={previewDocument}
 onClose={() => setPreviewDocument(null)}
 onDownload={() => void downloadManagedDocument(previewDocument)}
 />
 )}
 </main>
 );
}
