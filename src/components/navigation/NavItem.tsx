import { NavLink } from "react-router-dom";
import type { NavItemDef } from "./navItems";
import styles from "./Navigation.module.css";

interface NavItemProps {
  item: NavItemDef;
  badge?: number;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavItem({ item, badge, collapsed, onNavigate }: NavItemProps) {
  const Icon = item.icon;
  const badgeText = badge ? `, ${badge} waiting` : "";
  return (
    <NavLink
      to={item.path}
      className={styles.nav}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed || badge ? `${item.label}${badgeText}` : undefined}
    >
      <Icon aria-hidden="true" strokeWidth={1.7} />
      <span className={styles.lbl}>{item.label}</span>
      {!!badge && (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
