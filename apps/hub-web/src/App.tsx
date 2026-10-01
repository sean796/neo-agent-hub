import { useState } from "react";
import { AgentsPanel } from "./AgentsPanel";
import { HubShell, type HubSection } from "./HubShell";
import { SettingsPanel } from "./SettingsPanel";

export function App() {
  const [section, setSection] = useState<HubSection>("agents");

  return (
    <HubShell section={section} onSectionChange={setSection}>
      {section === "settings" ? <SettingsPanel /> : <AgentsPanel />}
    </HubShell>
  );
}
