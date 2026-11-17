import { Compass, Heart, Home, PlusSquare, Search, type LucideIcon } from "lucide-react";

export type NavItem = {
  key: "home" | "search" | "explore" | "create" | "notifications";
  to: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that mark this item active (e.g. mobile Explore/Search tab). */
  alsoActiveOn?: string[];
};

/** Desktop sidebar (frontend/01 App Shell): Home, Search, Explore, Create, Notifications (+ Profile). */
export const SIDEBAR_ITEMS: NavItem[] = [
  { key: "home", to: "/", label: "Home", icon: Home },
  { key: "search", to: "/search", label: "Search", icon: Search },
  { key: "explore", to: "/explore", label: "Explore", icon: Compass, alsoActiveOn: ["/tags/"] },
  { key: "create", to: "/create", label: "Create", icon: PlusSquare },
  { key: "notifications", to: "/notifications", label: "Notifications", icon: Heart },
];

/** Mobile bottom tab bar: Home, Explore/Search, Create, Notifications (+ Profile). */
export const TABBAR_ITEMS: NavItem[] = [
  { key: "home", to: "/", label: "Home", icon: Home },
  { key: "explore", to: "/explore", label: "Explore", icon: Compass, alsoActiveOn: ["/search", "/tags/"] },
  { key: "create", to: "/create", label: "Create", icon: PlusSquare },
  { key: "notifications", to: "/notifications", label: "Notifications", icon: Heart },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
    // `/create/story` belongs to Create; nothing else nests under a nav root.
    return true;
  }
  return (item.alsoActiveOn ?? []).some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}
