import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/common/Button";
import { Mark } from "@/components/common/Badges";
import { DetailDialogs } from "@/components/detail/DetailDialogs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTheme } from "@/hooks/useTheme";
import { useExplorerData, type ExplorerState } from "@/state/ExplorerDataContext";
import { GlobalSearch } from "./GlobalSearch";
import { NAV_ITEMS, titleForPath } from "./navItems";
import styles from "./Layout.module.css";

const DATA_BADGE: Record<ExplorerState["status"], string> = {
  loading: "Loading",
  ready: "Amplifi data",
  missing: "No data yet",
  error: "Data unavailable",
};

export function AppShell() {
  const { pathname } = useLocation();
  const { state } = useExplorerData();
  const { theme, toggle } = useTheme();
  const chatPage = pathname.startsWith("/ask");
  usePageTitle(titleForPath(pathname));

  // Each page starts at the top, like a fresh page load.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // The chat always asks Amplifi; the other pages show Amplifi's checked answers once they have loaded.
  const live = chatPage || state.status === "ready";
  const badge = chatPage ? "Live Amplifi" : DATA_BADGE[state.status];

  return (
    <div className={`${styles.shell} ${chatPage ? styles.chat : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NavLink to="/explore" className={styles.brand} aria-label="Battery Science Explorer, home">
            <Mark size="sm" />
            <span className={styles.brandText}>
              Battery Science <span>Explorer</span>
            </span>
          </NavLink>
          <nav className={styles.nav} aria-label="Main">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}>
                <Icon aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className={styles.search}>
            <GlobalSearch />
          </div>
          <div className={styles.end}>
            <span className={`${styles.badge} ${live ? styles.badgeLive : ""}`}>{badge}</span>
            <IconButton label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} variant="plain" onClick={toggle}>
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </IconButton>
          </div>
        </div>
      </header>
      <main className={styles.main} id="main" tabIndex={-1}>
        <Outlet />
      </main>
      {!chatPage && (
        <footer className={styles.footer}>
          <span>Battery Science proof of concept, on Amplifi</span>
        </footer>
      )}
      <DetailDialogs />
    </div>
  );
}
