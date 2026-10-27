import { BarChart3, CircleCheck, LayoutGrid, Library, MessageSquareText, type LucideIcon } from "lucide-react";

export interface NavItemDef {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItemDef[] = [
  { path: "/workspace", label: "Workspace", icon: LayoutGrid },
  { path: "/library", label: "Library", icon: Library },
  { path: "/review", label: "Review", icon: CircleCheck },
  { path: "/charts", label: "Charts", icon: BarChart3 },
  { path: "/ask", label: "Ask Amplifi", icon: MessageSquareText },
];

export const titleForPath = (pathname: string) =>
  NAV_ITEMS.find((n) => pathname.startsWith(n.path))?.label ?? "Workspace";
