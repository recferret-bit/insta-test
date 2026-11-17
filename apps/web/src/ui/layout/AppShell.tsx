import { CircleUser, LogIn, type LucideIcon } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { unreadBadgeLabel, useUnreadCount } from "../../state/notifications";
import { useMe, useIsAuthenticated } from "../../state/session";
import { useLiveConnection } from "../../state/sse";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { BrandMark } from "./BrandMark";
import { isNavItemActive, SIDEBAR_ITEMS, TABBAR_ITEMS, type NavItem } from "./nav-items";
import { ThemeToggle } from "./ThemeToggle";
import "./AppShell.css";

function NavGlyph({ item, badge }: { item: NavItem; badge: string }) {
  return (
    <span className="nav-glyph">
      <Icon icon={item.icon} size={24} />
      {item.key === "notifications" && badge ? (
        <span className="nav-badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

function accessibleLabel(item: NavItem, unread: number): string {
  return item.key === "notifications" && unread > 0 ? `${item.label}, ${unread} unread` : item.label;
}

function NavEntry({
  item,
  pathname,
  unread,
  badge,
}: {
  item: NavItem;
  pathname: string;
  unread: number;
  badge: string;
}) {
  const active = isNavItemActive(item, pathname);
  return (
    <li>
      <Link
        to={item.to}
        className={["nav-link", active && "nav-link--active"].filter(Boolean).join(" ")}
        aria-current={active ? "page" : undefined}
        aria-label={accessibleLabel(item, unread)}
      >
        <NavGlyph item={item} badge={badge} />
        <span className="nav-label" aria-hidden="true">
          {item.label}
        </span>
      </Link>
    </li>
  );
}

function ProfileEntry({ pathname, compact = false }: { pathname: string; compact?: boolean }) {
  const authenticated = useIsAuthenticated();
  const me = useMe();
  if (!authenticated) {
    return (
      <SimpleEntry to="/login" label="Log in" icon={LogIn} active={pathname === "/login"} compact={compact} />
    );
  }
  const to = me ? `/u/${encodeURIComponent(me.username)}` : "/settings/profile";
  const active = me ? pathname.startsWith(to) : false;
  return (
    <li>
      <Link
        to={to}
        className={["nav-link", active && "nav-link--active"].filter(Boolean).join(" ")}
        aria-current={active ? "page" : undefined}
        aria-label="Profile"
      >
        <span className="nav-glyph">
          {me ? <Avatar src={me.avatarUrl} alt="" size={24} /> : <Icon icon={CircleUser} size={24} />}
        </span>
        {compact ? null : (
          <span className="nav-label" aria-hidden="true">
            Profile
          </span>
        )}
      </Link>
    </li>
  );
}

function SimpleEntry({
  to,
  label,
  icon,
  active,
  compact,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  compact: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className={["nav-link", active && "nav-link--active"].filter(Boolean).join(" ")}
        aria-current={active ? "page" : undefined}
        aria-label={label}
      >
        <span className="nav-glyph">
          <Icon icon={icon} size={24} />
        </span>
        {compact ? null : (
          <span className="nav-label" aria-hidden="true">
            {label}
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * App shell (F-FE-01): desktop sidebar ≥ 768 px (icon-only, labels from 1264 px), mobile top bar + bottom tab bar
 * below 768 px. Mounts the live (SSE) connection manager while authenticated.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const authenticated = useIsAuthenticated();
  const unread = useUnreadCount();
  const badge = unreadBadgeLabel(unread);
  useLiveConnection(authenticated);
  const notifications = SIDEBAR_ITEMS.find((i) => i.key === "notifications")!;

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="shell__sidebar">
        <div className="shell__brand">
          <BrandMark />
        </div>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {SIDEBAR_ITEMS.map((item) => (
              <NavEntry key={item.key} item={item} pathname={pathname} unread={unread} badge={badge} />
            ))}
            <ProfileEntry pathname={pathname} />
          </ul>
        </nav>
        <div className="shell__sidebar-footer">
          <ThemeToggle showLabel className="nav-link" />
        </div>
      </aside>

      <header className="shell__topbar">
        <BrandMark />
        <div className="shell__topbar-actions">
          <ThemeToggle className="icon-button" />
          <Link
            to="/notifications"
            className="icon-button"
            aria-label={accessibleLabel(notifications, unread)}
          >
            <NavGlyph item={notifications} badge={badge} />
          </Link>
        </div>
      </header>

      <main id="main-content" className="shell__main" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="shell__tabbar" aria-label="Primary mobile">
        <ul className="tab-list">
          {TABBAR_ITEMS.map((item) => (
            <NavEntry key={item.key} item={item} pathname={pathname} unread={unread} badge={badge} />
          ))}
          <ProfileEntry pathname={pathname} compact />
        </ul>
      </nav>
    </div>
  );
}
