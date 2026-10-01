import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "./api";
import { SettingsPanel } from "./SettingsPanel";
import "./App.css";

interface AgentRecord {
  id: string;
  name: string;
  status: string;
  description: string;
  enabled: boolean;
}

type HubTab = "agents" | "settings";

export function App() {
  const [tab, setTab] = useState<HubTab>("agents");
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl("/api/agents"));
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as { agents: AgentRecord[] };
        if (!cancelled) setAgents(data.agents);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load agents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!statusFilter) return agents;
    return agents.filter((a) => a.status === statusFilter);
  }, [agents, statusFilter]);

  return (
    <div className="hub">
      <header className="band band-title">
        <span className="icon" aria-hidden>
          ◆
        </span>
        <h1>Neo Agent Hub</h1>
        <nav className="title-nav" aria-label="Hub sections">
          <button
            type="button"
            className={`pill tab ${tab === "agents" ? "tab-active" : ""}`}
            onClick={() => setTab("agents")}
          >
            Agents
          </button>
          <button
            type="button"
            className={`pill tab ${tab === "settings" ? "tab-active" : ""}`}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
        </nav>
      </header>
      {tab === "settings" ? (
        <SettingsPanel />
      ) : (
        <>
          <div className="band band-toolbar">
            <input
              className="field"
              placeholder="Filter by status (active, beta, disabled)"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value.trim())}
              aria-label="Filter by status"
            />
            <span className="count tabular-nums">{filtered.length} agents</span>
          </div>
          <div className="band band-progress">
            <span>{loading ? "Loading registry…" : error ? `Error: ${error}` : "Registry synced"}</span>
          </div>
          <main className="content">
            <ul className="agent-list">
              {loading
                ? [1, 2].map((i) => (
                    <li key={i} className="agent-row skeleton" aria-hidden>
                      <span className="skeleton-line" />
                      <span className="skeleton-line short" />
                    </li>
                  ))
                : filtered.map((a) => (
                    <li key={a.id} className="agent-row">
                      <div className="agent-head">
                        <strong>{a.name}</strong>
                        <span className={`pill pill-${a.status}`}>{a.status}</span>
                        <span className="pill">{a.enabled ? "On" : "Off"}</span>
                      </div>
                      <p className="muted">{a.description}</p>
                      <p className="mono">id: {a.id}</p>
                    </li>
                  ))}
            </ul>
          </main>
        </>
      )}
    </div>
  );
}
