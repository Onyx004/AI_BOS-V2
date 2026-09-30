import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Clock3, Download, ExternalLink, LayoutDashboard, Loader2, LogOut, MessageSquare, Moon, Search, Star, Sun, UserCircle, Zap } from "lucide-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { filterByRole, getStoredAuthRole, RequireAuth } from "@shared/auth/access-control";
import { authSessionChangedEvent, clearAuthSession, getStoredAuthSession } from "@shared/auth/auth-service";
import type { AuthRole } from "@shared/auth/types";
import { fetchRooms } from "@shared/collaboration/collaboration.api";
import type { CollaborationRoom } from "@shared/collaboration/collaboration.schema";
import { apiClient } from "@shared/lib/api-client";
import { NotificationBell } from "@shared/notifications/NotificationBell";
import { usePresenceHeartbeat } from "@shared/attendance/usePresenceHeartbeat";
import { useBackendDataBridge } from "@shared/realtime/data-sync";
import { ConfirmDialogProvider } from "@shared/ui/confirm-dialog";
import { CompanyLogo } from "@shared/ui/company-logo";
import { PageSkeleton } from "@shared/ui/page-skeleton";
import { ToastProvider } from "@shared/ui/toast";
import { commandPaletteOpenEvent, dashboardExportRequestEvent, quickActionsOpenEvent } from "./events";
import type { QuickCreateAction, WorkspaceSearchItem } from "./types";

export type AppRouteConfig = {
  path: string;
  element: ReactNode;
  allowedRoles?: readonly AuthRole[];
  allowedPermissions?: readonly string[];
  allowFullAccessBypass?: boolean;
  requireProfileComplete?: boolean;
  requireFaceEnrollment?: boolean;
};

export function lazyNamed<TModule extends Record<string, unknown>, TName extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TName,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType<any> };
  });
}

function AppFallback() {
  return <PageSkeleton />;
}

const LazyAppExperience = lazyNamed(() => import("./AppExperience"), "AppExperience");
const LazyCommandPalette = lazyNamed(() => import("./CommandPalette"), "CommandPalette");
const LazyPwaChrome = lazyNamed(() => import("@shared/pwa"), "PwaChrome");
const LazyNotificationPopupListener = lazyNamed(() => import("@shared/notifications"), "NotificationPopupListener");

function useIdleMount() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(() => setMounted(true), { timeout: 600 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const timeout = window.setTimeout(() => setMounted(true), 1);
    return () => window.clearTimeout(timeout);
  }, []);

  return mounted;
}

function getRouteElement(route: AppRouteConfig) {
  if (!route.allowedRoles) {
    return route.element;
  }

  return (
    <RequireAuth
      allowedRoles={route.allowedRoles}
      allowedPermissions={route.allowedPermissions}
      allowFullAccessBypass={route.allowFullAccessBypass}
      requireProfileComplete={route.requireProfileComplete}
      requireFaceEnrollment={route.requireFaceEnrollment}
    >
      {route.element}
    </RequireAuth>
  );
}

export function AnimatedAppRoutes({ routes }: { routes: readonly AppRouteConfig[] }) {
  const location = useLocation();

  return (
    <Suspense fallback={<AppFallback />}>
      <AnimatePresence mode="sync">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          initial={{ opacity: 0, y: 10 }}
          key={location.pathname}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <Routes location={location}>
            {routes.map((route) => (
              <Route element={getRouteElement(route)} key={route.path} path={route.path} />
            ))}
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

function useVisibleWorkspaceControls({
  allowFullAccessBypass = true,
  quickCreateActions,
  searchItems,
}: {
  allowFullAccessBypass?: boolean;
  quickCreateActions: readonly QuickCreateAction[];
  searchItems: readonly WorkspaceSearchItem[];
}) {
  const location = useLocation();
  const [currentRole, setCurrentRole] = useState<AuthRole | undefined>(() => getStoredAuthRole());
  const [currentPermissions, setCurrentPermissions] = useState<readonly string[]>(() => getStoredAuthSession()?.user.permissions ?? []);

  useEffect(() => {
    const refreshRole = () => {
      setCurrentRole(getStoredAuthRole());
      setCurrentPermissions(getStoredAuthSession()?.user.permissions ?? []);
    };
    refreshRole();
    window.addEventListener(authSessionChangedEvent, refreshRole);
    return () => window.removeEventListener(authSessionChangedEvent, refreshRole);
  }, [location.key]);

  return useMemo(
    () => ({
      visibleQuickCreateActions: filterByRole(quickCreateActions, currentRole, allowFullAccessBypass, currentPermissions),
      visibleSearchItems: filterByRole(searchItems, currentRole, allowFullAccessBypass, currentPermissions),
    }),
    [allowFullAccessBypass, currentPermissions, currentRole, quickCreateActions, searchItems],
  );
}

const hiddenChromePaths = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/complete-profile",
  "/change-password-required",
  "/face-enrollment",
];
// "nav-notifications" is deliberately excluded here â€” the NotificationBell on the
// right already covers it (live unread count, dropdown, and a "View all" link to the
// same page), so keeping both was a redundant, near-identical affordance.
const quickNavOrder = ["nav-dashboard", "nav-tasks"];
const dashboardPaths = ["/dashboard"];
const recentPagesStorageKey = "ai-bos-recent-pages";
const favoritePagesStorageKey = "ai-bos-favorite-pages";

type StoredPageItem = {
  href: string;
  label: string;
  category: string;
};

type OrganizationBrand = {
  name?: string;
  logo?: string;
  businessType?: string;
};

function useOrganizationBrand() {
  const [brand, setBrand] = useState<OrganizationBrand | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<OrganizationBrand>("/organization", { cacheTtlMs: 60_000 }).then((organization) => {
      if (!cancelled) setBrand(organization);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = brand?.name?.trim() || "AI BOS";
  return {
    name,
    logo: brand?.logo,
    subtitle: brand?.businessType || "Business OS",
  };
}

function isWorkspacePath(pathname: string) {
  return !hiddenChromePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isDashboardPath(pathname: string) {
  return dashboardPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const routeLabels: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/profile": "Profile",
  "/settings": "Settings",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/employees": "Employees",
  "/crm": "CRM",
  "/finance": "Finance",
  "/products": "Products",
  "/documents": "Documents",
  "/meetings": "Meetings",
  "/analytics": "Analytics",
  "/admin": "Admin",
};

function getRouteLabel(pathname: string) {
  if (routeLabels[pathname]) return routeLabels[pathname];
  const projectMatch = pathname.match(/^\/projects\/(.+)/);
  if (projectMatch) return "Project Details";
  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/-/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" / ");
}

function TopBarBreadcrumb({ brandName, currentPage, pathname }: { brandName: string; currentPage?: StoredPageItem; pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <div className="hidden h-8 min-w-0 items-center gap-2 border-t border-border/70 bg-background/20 px-4 text-xs font-semibold text-muted-foreground lg:flex backdrop-blur-sm">
      <Link className="block max-w-28 shrink-0 truncate transition-colors hover:text-foreground" title={brandName} to="/dashboard">
        {brandName}
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const label = index === segments.length - 1 ? (currentPage?.label ?? getRouteLabel(href)) : getRouteLabel(href);
        return (
          <div className="flex min-w-0 items-center gap-2" key={href}>
            <ChevronRight className="h-3 w-3 shrink-0" />
            {index === segments.length - 1 ? (
              <span className="block max-w-[min(18rem,42vw)] truncate text-foreground" title={label}>{label}</span>
            ) : (
              <Link className="block max-w-40 truncate transition-colors hover:text-foreground" title={label} to={href}>
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

function readStoredPages(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredPageItem[]) : [];
  } catch {
    return [];
  }
}

function isAllowedStoredPage(item: StoredPageItem, items: readonly WorkspaceSearchItem[]) {
  return items.some(
    (workspaceItem) => item.href === workspaceItem.href || item.href.startsWith(`${workspaceItem.href}/`),
  );
}

function readAllowedStoredPages(key: string, items: readonly WorkspaceSearchItem[]) {
  return readStoredPages(key).filter((item) => isAllowedStoredPage(item, items));
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sortMessageRooms(rooms: CollaborationRoom[]) {
  return [...rooms].sort((left, right) => {
    const leftTime = left.lastMessage?.createdAt ?? left.lastMessageAt ?? "";
    const rightTime = right.lastMessage?.createdAt ?? right.lastMessageAt ?? "";
    return (rightTime ? new Date(rightTime).getTime() : 0) - (leftTime ? new Date(leftTime).getTime() : 0);
  });
}

function formatRoomActivity(room: CollaborationRoom) {
  const value = room.lastMessage?.createdAt ?? room.lastMessageAt;
  if (!value) return "No activity";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CompanyMessageMenu({ messengerItem }: { messengerItem?: WorkspaceSearchItem }) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<CollaborationRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = rooms.reduce((sum, room) => sum + (room.unreadCount ?? 0), 0);
  const messengerHref = messengerItem?.href ?? "/messenger";

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRooms()
      .then((roomList) => {
        if (cancelled) return;
        setRooms(sortMessageRooms(roomList));
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open company messages"
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:w-10"
        title="Company Msg"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <MessageSquare className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-background bg-primary" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-12 z-[95] w-[min(94vw,420px)] overflow-hidden rounded-lg border border-border bg-background shadow-2xl shadow-slate-950/20 dark:bg-slate-950 dark:shadow-slate-950/55"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            role="menu"
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Company Msg</p>
                <p className="truncate text-xs text-muted-foreground">Recent conversations and shortcuts</p>
              </div>
              <Link
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                to={messengerHref}
                onClick={() => setOpen(false)}
              >
                Open
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  className="rounded-xl border bg-card px-3 py-2 text-sm font-semibold transition hover:bg-muted"
                  to={messengerHref}
                  onClick={() => setOpen(false)}
                >
                  Open Messenger
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Full chat window</span>
                </Link>
                <button
                  className="rounded-xl border bg-card px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new Event(commandPaletteOpenEvent));
                  }}
                >
                  Search Messages
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Find workspace items</span>
                </button>
              </div>

              <div className="mt-3 border-t pt-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">Conversations</p>
                  {unreadCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{unreadCount} unread</span>}
                </div>
                {loading && (
                  <div className="flex items-center gap-2 rounded-xl px-3 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading conversations
                  </div>
                )}
                {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
                {!loading && !error && rooms.length === 0 && <p className="rounded-xl px-3 py-4 text-sm text-muted-foreground">No conversations yet.</p>}
                {!loading && !error && (
                  <div className="space-y-1">
                    {rooms.slice(0, 8).map((room) => (
                      <Link
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-muted"
                        key={room._id}
                        to={messengerHref}
                        onClick={() => setOpen(false)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{room.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {room.lastMessage?.body || `${room.roomType} conversation`}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">{formatRoomActivity(room)}</span>
                          {room.unreadCount > 0 && (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{room.unreadCount}</span>
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExportMenu({
  items,
  onDashboard,
  quickActions,
}: {
  items: readonly WorkspaceSearchItem[];
  onDashboard: boolean;
  quickActions: readonly QuickCreateAction[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const runExport = (callback: () => void) => {
    callback();
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open download menu"
        className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        title="Downloads"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Download className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-12 z-[95] w-[min(92vw,320px)] overflow-hidden rounded-lg border border-border bg-background p-2 shadow-2xl shadow-slate-950/20 dark:bg-slate-950 dark:shadow-slate-950/55"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            role="menu"
          >
            <div className="border-b px-3 py-2">
              <p className="text-sm font-semibold">Download</p>
              <p className="text-xs text-muted-foreground">Export dashboard and workspace data.</p>
            </div>
            <div className="mt-2 space-y-1">
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted disabled:pointer-events-none disabled:opacity-45"
                disabled={!onDashboard}
                type="button"
                onClick={() => runExport(() => window.dispatchEvent(new Event(dashboardExportRequestEvent)))}
              >
                Dashboard snapshot
                <span className="text-xs text-muted-foreground">JSON</span>
              </button>
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                type="button"
                onClick={() =>
                  runExport(() =>
                    downloadJson("workspace-navigation.json", {
                      exportedAt: new Date().toISOString(),
                      items: items.map(({ icon: _icon, ...item }) => item),
                    }),
                  )
                }
              >
                Workspace navigation
                <span className="text-xs text-muted-foreground">JSON</span>
              </button>
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                type="button"
                onClick={() =>
                  runExport(() =>
                    downloadJson("quick-create-actions.json", {
                      exportedAt: new Date().toISOString(),
                      actions: quickActions.map(({ icon: _icon, ...action }) => action),
                    }),
                  )
                }
              >
                Quick create actions
                <span className="text-xs text-muted-foreground">JSON</span>
              </button>
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                type="button"
                onClick={() =>
                  runExport(() =>
                    downloadJson("quick-access-pages.json", {
                      exportedAt: new Date().toISOString(),
                      favorites: readAllowedStoredPages(favoritePagesStorageKey, items),
                      recentPages: readAllowedStoredPages(recentPagesStorageKey, items),
                    }),
                  )
                }
              >
                Favorites & recents
                <span className="text-xs text-muted-foreground">JSON</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickWorkspaceMenu({
  currentPage,
  items,
  quickActions,
}: {
  currentPage?: StoredPageItem;
  items: readonly WorkspaceSearchItem[];
  quickActions: readonly QuickCreateAction[];
}) {
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<StoredPageItem[]>([]);
  const [recentPages, setRecentPages] = useState<StoredPageItem[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener(quickActionsOpenEvent, openMenu);
    return () => window.removeEventListener(quickActionsOpenEvent, openMenu);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFavorites(readAllowedStoredPages(favoritePagesStorageKey, items));
    setRecentPages(readAllowedStoredPages(recentPagesStorageKey, items));
  }, [items, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggleFavorite = () => {
    if (!currentPage) return;
    setFavorites((current) => {
      const exists = current.some((item) => item.href === currentPage.href);
      const next = exists ? current.filter((item) => item.href !== currentPage.href) : [currentPage, ...current].slice(0, 8);
      window.localStorage.setItem(favoritePagesStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = currentPage ? favorites.some((item) => item.href === currentPage.href) : false;

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-600 px-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-300 sm:h-10 sm:gap-2 sm:px-3 sm:text-sm"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Zap className="h-4 w-4" />
        <span className="hidden sm:inline">Quick</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-12 z-[95] w-[min(92vw,380px)] overflow-hidden rounded-lg border border-border bg-background p-3 shadow-2xl shadow-slate-950/20 dark:bg-slate-950 dark:shadow-slate-950/55"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            role="menu"
          >
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <div>
                <p className="text-sm font-semibold">Quick Add & Access</p>
                <p className="text-xs text-muted-foreground">Create, jump, or favorite from one place.</p>
              </div>
              <button
                aria-label={isFavorite ? "Remove current page from favorites" : "Favorite current page"}
                className={[
                  "grid h-9 w-9 place-items-center rounded-xl border transition hover:bg-muted",
                  isFavorite ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                ].join(" ")}
                disabled={!currentPage}
                type="button"
                onClick={toggleFavorite}
              >
                <Star className={["h-4 w-4", isFavorite ? "fill-current" : ""].join(" ")} />
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              <button
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition hover:bg-muted"
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event(commandPaletteOpenEvent));
                }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Search className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Search workspace</span>
                  <span className="text-xs text-muted-foreground">Projects, people, reports, settings</span>
                </span>
              </button>

              {quickActions.length > 0 && (
                <section>
                  <p className="px-1 pb-2 text-xs font-bold uppercase tracking-normal text-muted-foreground">Quick Create</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.slice(0, 6).map((action) => {
                      const Icon = action.icon;
                      return (
                        <Link
                          className="flex min-h-16 items-center gap-2 rounded-xl border bg-card p-3 text-sm font-semibold transition hover:bg-muted"
                          key={`${action.label}-${action.href}`}
                          to={action.href}
                          onClick={() => setOpen(false)}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 truncate">{action.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <p className="px-1 pb-2 text-xs font-bold uppercase tracking-normal text-muted-foreground">Favorites</p>
                <div className="space-y-1">
                  {(favorites.length ? favorites : currentPage ? [{ ...currentPage, label: "Favorite this page" }] : []).slice(0, 4).map((item) => (
                    <Link className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted" key={`${item.href}-${item.label}`} to={item.href} onClick={() => setOpen(false)}>
                      <span className="min-w-0 truncate">{item.label}</span>
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </section>

              <section>
                <p className="px-1 pb-2 text-xs font-bold uppercase tracking-normal text-muted-foreground">Recently Opened</p>
                <div className="space-y-1">
                  {recentPages.slice(0, 4).map((item) => (
                    <Link className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted" key={item.href} to={item.href} onClick={() => setOpen(false)}>
                      <span className="min-w-0 truncate">{item.label}</span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="h-3 w-3" />
                        {item.category}
                      </span>
                    </Link>
                  ))}
                  {recentPages.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No recent pages yet.</p>}
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileMenu() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("theme") as "light" | "dark" | null) ?? "light");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const session = useMemo(() => getStoredAuthSession(), [location.key]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const signOut = () => {
    clearAuthSession();
    setOpen(false);
    window.location.assign("/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:w-10",
          location.pathname === "/profile" ? "bg-primary/10 text-primary" : "",
        ].join(" ")}
        title="Profile"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {session?.user.avatar?.startsWith("data:image/") ? (
          <img alt="" className="h-full w-full object-cover" src={session.user.avatar} />
        ) : (
          <UserCircle className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-12 z-[95] w-[min(92vw,300px)] overflow-hidden rounded-lg border border-border bg-background p-2 shadow-2xl shadow-slate-950/20 dark:bg-slate-950 dark:shadow-slate-950/55"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            role="menu"
          >
            <div className="border-b px-3 py-3">
              <p className="truncate text-sm font-semibold">{session?.user.fullName ?? "Profile"}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{session?.user.email ?? "Signed in account"}</p>
              {session?.user.role && <p className="mt-2 w-fit rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{session.user.roleName ?? session.user.role}</p>}
            </div>
            <div className="mt-2 space-y-1">
              <Link
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                role="menuitem"
                to="/profile"
                onClick={() => setOpen(false)}
              >
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                My profile
              </Link>
              <Link
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                role="menuitem"
                to="/dashboard"
                onClick={() => setOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                Dashboard
              </Link>
              {session && !session.user.isProfileComplete && (
                <Link
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                  role="menuitem"
                  to="/complete-profile"
                  onClick={() => setOpen(false)}
                >
                  <Star className="h-4 w-4 text-muted-foreground" />
                  Complete profile
                </Link>
              )}
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                role="menuitem"
                type="button"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {theme === "dark" ? <Sun className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span>Theme</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{theme === "dark" ? "Dark" : "Light"}</span>
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                role="menuitem"
                type="button"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GlobalTopBar({ items, quickActions }: { items: readonly WorkspaceSearchItem[]; quickActions: readonly QuickCreateAction[] }) {
  const location = useLocation();
  const brand = useOrganizationBrand();
  const frequentItems = quickNavOrder
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is WorkspaceSearchItem => Boolean(item));
  const messengerItem = items.find((item) => item.id === "nav-messenger");
  const visible = isWorkspacePath(location.pathname) && frequentItems.length > 0;
  const onDashboard = isDashboardPath(location.pathname);
  const currentPage = useMemo(() => {
    const exactItem = items.find((item) => item.href === location.pathname);
    if (exactItem) return { href: exactItem.href, label: exactItem.title, category: exactItem.category };
    return undefined;
  }, [items, location.pathname]);

  // Lets pages reserve top space (see .has-quick-nav in styles/index.css) so this
  // fixed bar never covers each page's own sticky header or its first content.
  useEffect(() => {
    document.body.classList.toggle("has-quick-nav", visible);
    return () => document.body.classList.remove("has-quick-nav");
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <nav
      aria-label="Quick workspace navigation"
      className="fixed inset-x-0 top-0 z-[80] flex flex-col border-b border-border bg-background shadow-lg shadow-slate-950/10 dark:bg-slate-950 dark:shadow-slate-950/40"
    >
      <div className="flex h-14 items-center gap-0.5 px-1.5 sm:gap-1 sm:px-3">
        <Link aria-label="Go to dashboard" className="mr-0.5 flex shrink-0 items-center sm:mr-1" to="/dashboard">
          <CompanyLogo collapsed logoUrl={brand.logo} name={brand.name} subtitle={brand.subtitle} />
        </Link>
        <span aria-hidden="true" className="mr-0.5 h-6 w-px shrink-0 bg-border sm:mr-1" />
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:gap-1">
          {frequentItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={[
                  "flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition-all hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:px-3 sm:text-sm",
                  active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                key={item.id}
                title={item.title}
                to={item.href}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden min-w-0 truncate sm:inline">{item.title.replace("Company ", "").replace(" Center", "")}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            aria-label="Open command search"
            className="hidden h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:grid sm:h-10 sm:w-10"
            title="Search"
            type="button"
            onClick={() => window.dispatchEvent(new Event(commandPaletteOpenEvent))}
          >
            <Search className="h-4 w-4" />
          </button>
          <CompanyMessageMenu messengerItem={messengerItem} />
          <QuickWorkspaceMenu currentPage={currentPage} items={items} quickActions={quickActions} />
          <div className="hidden sm:block">
            <ExportMenu items={items} onDashboard={onDashboard} quickActions={quickActions} />
          </div>
          <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:mx-1 sm:block" />
          <NotificationBell />
          <ProfileMenu />
        </div>
      </div>
      <TopBarBreadcrumb brandName={brand.name} currentPage={currentPage} pathname={location.pathname} />
    </nav>
  );
}

const WorkspaceChrome = memo(function WorkspaceChrome({
  allowFullAccessBypass,
  quickCreateActions,
  searchItems,
}: {
  allowFullAccessBypass?: boolean;
  quickCreateActions: readonly QuickCreateAction[];
  searchItems: readonly WorkspaceSearchItem[];
}) {
  const { visibleQuickCreateActions, visibleSearchItems } = useVisibleWorkspaceControls({
    allowFullAccessBypass,
    quickCreateActions,
    searchItems,
  });

  return (
    <>
      <GlobalTopBar items={visibleSearchItems} quickActions={visibleQuickCreateActions} />
      <LazyCommandPalette items={visibleSearchItems} />
      <LazyAppExperience items={visibleSearchItems} />
      <LazyPwaChrome />
      <LazyNotificationPopupListener />
    </>
  );
});

export function AppProviders({
  allowFullAccessBypass = true,
  children,
  quickCreateActions,
  searchItems,
}: {
  allowFullAccessBypass?: boolean;
  children: ReactNode;
  quickCreateActions: readonly QuickCreateAction[];
  searchItems: readonly WorkspaceSearchItem[];
}) {
  const chromeMounted = useIdleMount();
  useBackendDataBridge();
  usePresenceHeartbeat();

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        {children}
        {chromeMounted ? (
          <Suspense fallback={null}>
            <WorkspaceChrome
              allowFullAccessBypass={allowFullAccessBypass}
              quickCreateActions={quickCreateActions}
              searchItems={searchItems}
            />
          </Suspense>
        ) : null}
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
