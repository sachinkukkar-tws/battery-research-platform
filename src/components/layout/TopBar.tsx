import { Menu, Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/common/Button";
import { useServices } from "@/state/ServicesContext";
import { useTheme } from "@/hooks/useTheme";
import styles from "./Layout.module.css";

interface TopBarProps {
  title: string;
  navOpen: boolean;
  navId: string;
  /** Ask Amplifi can be live while the other screens use sample data. */
  chatPage: boolean;
  onOpenNav: () => void;
}

export function TopBar({ title, navOpen, navId, chatPage, onOpenNav }: TopBarProps) {
  const { config } = useServices();
  const { theme, toggle } = useTheme();
  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const liveChat = chatPage && config.chatMode === "live";
  const modeLabel = config.mode === "live" ? "Connected" : liveChat ? "Live Amplifi" : "Demo data";
  return (
    <header className={styles.bar}>
      <button type="button" className={styles.burger} aria-label="Open menu" aria-expanded={navOpen} aria-controls={navId} onClick={onOpenNav}>
        <Menu aria-hidden="true" />
      </button>
      <h1 className={styles.pageTitle}>{title}</h1>
      <IconButton label={themeLabel} onClick={toggle}>
        {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </IconButton>
      <span className={`${styles.mode} ${config.mode === "live" || liveChat ? styles.modeLive : ""}`}>{modeLabel}</span>
    </header>
  );
}
