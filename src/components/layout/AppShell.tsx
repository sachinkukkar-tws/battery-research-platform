import { useCallback, useEffect, useId, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { titleForPath } from "@/components/navigation/navItems";
import { DetailDialogs } from "@/components/detail/DetailDialogs";
import { useStoredState } from "@/hooks/useStoredState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import styles from "./Layout.module.css";

export function AppShell() {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);
  const chatMode = pathname.startsWith("/ask");
  const navId = useId();
  const [navOpen, setNavOpen] = useState(false);
  const [side, setSide] = useStoredState("brp-side", "expanded", ["expanded", "collapsed"] as const);
  const collapsed = side === "collapsed";
  usePageTitle(title);

  const closeNav = useCallback(() => setNavOpen(false), []);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // Each page starts at the top, like a fresh page load.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const shellClass = [styles.wrapper, collapsed ? "side-collapsed" : "", navOpen ? styles.navOpen : "", chatMode ? styles.chatMode : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar id={navId} collapsed={collapsed} onToggleCollapsed={() => setSide(collapsed ? "expanded" : "collapsed")} onNavigate={closeNav} />
      <div className={styles.scrim} onClick={closeNav} aria-hidden="true" />
      <div className={styles.main}>
        <TopBar title={title} navOpen={navOpen} navId={navId} chatPage={chatMode} onOpenNav={() => setNavOpen(true)} />
        <main className={styles.content} id="main" tabIndex={-1}>
          <Outlet />
        </main>
        {!chatMode && (
          <footer className={styles.footer}>
            <span>Battery Research Platform, proof of concept</span>
            <span>Data: the client’s hard carbon papers and the lithium-ion knowledge base</span>
          </footer>
        )}
      </div>
      <DetailDialogs />
    </div>
  );
}
