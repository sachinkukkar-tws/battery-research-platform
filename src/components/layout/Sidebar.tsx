import { ChevronLeft } from "lucide-react";
import { Mark } from "@/components/common/Badges";
import { NavItem } from "@/components/navigation/NavItem";
import { NAV_ITEMS } from "@/components/navigation/navItems";
import navStyles from "@/components/navigation/Navigation.module.css";
import { useResearchData } from "@/state/ResearchDataContext";
import { useServices } from "@/state/ServicesContext";
import styles from "./Layout.module.css";

interface SidebarProps {
  id: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: () => void;
}

export function Sidebar({ id, collapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const { queue } = useResearchData();
  const { config } = useServices();
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <aside className={styles.sidebar} id={id} aria-label="Sections">
      <div className={styles.logo}>
        <Mark />
        <span className={styles.logoText}>
          Battery Research
          <br />
          Platform
        </span>
        <button type="button" className={styles.collapseBtn} onClick={onToggleCollapsed} aria-label={label} title={label} aria-expanded={!collapsed}>
          <ChevronLeft aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Main">
        <ul className={navStyles.list}>
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <NavItem item={item} collapsed={collapsed} onNavigate={onNavigate} badge={item.path === "/review" ? queue.length : undefined} />
            </li>
          ))}
        </ul>
      </nav>
      <p className={styles.sideNote}>
        {config.mode === "mock"
          ? "Demo data from the client’s hard carbon papers. Values were checked by hand unless marked."
          : "Connected to the platform and Amplifi. Values are checked by hand unless marked."}
      </p>
    </aside>
  );
}
