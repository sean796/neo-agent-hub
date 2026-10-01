import type { ReactNode } from "react";

export type HubSection = "agents" | "settings";

interface HubShellProps {
  section: HubSection;
  onSectionChange: (section: HubSection) => void;
  children: ReactNode;
}

function NavIconAgents() {
  return (
    <svg className="hub-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h6v6H4V6zm10 0h6v6h-6V6zM4 16h6v6H4v-6zm10 0h6v6h-6v-6z"
        fill="currentColor"
      />
    </svg>
  );
}

function NavIconSettings() {
  return (
    <svg className="hub-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8.94 4a7.96 7.96 0 0 0-.12-1l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a8.06 8.06 0 0 0-1.73-1l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a8.06 8.06 0 0 0-1.73 1l-2.39-.96a.5.5 0 0 0-.6.22L2.03 9.78a.5.5 0 0 0 .12.64L4.18 12a7.96 7.96 0 0 0 0 2l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.52.4 1.1.73 1.73 1l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.63-.27 1.21-.6 1.73-1l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64L20.94 12c.08-.33.12-.66.12-1z"
        fill="currentColor"
      />
    </svg>
  );
}

export function HubShell({ section, onSectionChange, children }: HubShellProps) {
  return (
    <div className="hub-shell">
      <aside className="hub-sidebar" aria-label="Hub navigation">
        <div className="hub-brand">
          <img className="hub-brand-mark" src="/neo-mark.svg" alt="" width={24} height={24} />
          <h1 className="hub-brand-title">Neo Agent Hub</h1>
        </div>
        <nav className="hub-nav">
          <button
            type="button"
            className={`hub-nav-item ${section === "agents" ? "hub-nav-item-active" : ""}`}
            onClick={() => onSectionChange("agents")}
            aria-current={section === "agents" ? "page" : undefined}
          >
            <NavIconAgents />
            Agents
          </button>
          <button
            type="button"
            className={`hub-nav-item ${section === "settings" ? "hub-nav-item-active" : ""}`}
            onClick={() => onSectionChange("settings")}
            aria-current={section === "settings" ? "page" : undefined}
          >
            <NavIconSettings />
            Settings
          </button>
        </nav>
      </aside>
      <div className="hub-main">{children}</div>
    </div>
  );
}
