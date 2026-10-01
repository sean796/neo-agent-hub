import { useEffect, useState } from "react";
import { apiUrl } from "./api";
import "./App.css";

interface AgentRecord {
  id: string;
  name: string;
  status: string;
  description: string;
  enabled: boolean;
}

export function AgentsPanel() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const subtitle =
    loading ? "Loading…" : error ? `Error: ${error}` : "Available in Slack via slash commands and message shortcuts.";

  return (
    <div className="hub-page">
      <header className="hub-page-header">
        <h2 className="hub-page-title">Agents</h2>
        <p className="hub-page-subtitle">{subtitle}</p>
      </header>
      {!loading && !error && agents.length === 0 ? (
        <p className="muted">No agents registered.</p>
      ) : (
        <ul className="agent-list">
          {loading
            ? [1, 2].map((i) => (
                <li key={i} className="agent-row skeleton" aria-hidden>
                  <span className="skeleton-line" />
                  <span className="skeleton-line short" />
                </li>
              ))
            : error
              ? null
              : agents.map((a) => (
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
      )}
    </div>
  );
}
