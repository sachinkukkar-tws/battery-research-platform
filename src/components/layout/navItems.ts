import { Compass, FileText, MessageSquareText, type LucideIcon } from "lucide-react";

export interface NavItemDef {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItemDef[] = [
  { path: "/explore", label: "Explorer", icon: Compass },
  { path: "/papers", label: "Papers", icon: FileText },
  { path: "/ask", label: "Ask Amplifi", icon: MessageSquareText },
];

export const titleForPath = (pathname: string) => NAV_ITEMS.find((n) => pathname.startsWith(n.path))?.label ?? "Explorer";
