import type { LucideIcon } from "lucide-react";
import type { AuthRole } from "@shared/auth/types";

export type WorkspaceSearchItem = {
 id: string;
 title: string;
 category: string;
 href: string;
 keywords: string[];
 icon: LucideIcon;
 roles?: readonly AuthRole[];
 /** Also visible to any role granted one of these permissions. */
 permissions?: readonly string[];
};

export type QuickCreateAction = {
 label: string;
 href: string;
 icon: LucideIcon;
 roles?: readonly AuthRole[];
 /** Also visible to any role granted one of these permissions. */
 permissions?: readonly string[];
};
