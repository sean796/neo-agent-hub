import { HUB_DEFAULT_OPENROUTER_MODEL } from "@neo-agent-hub/core";
import { useCallback, useEffect, useState } from "react";
import {
  fetchHubSettings,
  loadAdminToken,
  saveAdminToken,
  saveOpenRouterSettings,
  type HubSettingsPublic,
} from "./api";
import "./App.css";

export function SettingsPanel() {
  const [settings, setSettings] = useState<HubSettingsPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState(loadAdminToken);
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [openRouterModel, setOpenRouterModel] = useState(HUB_DEFAULT_OPENROUTER_MODEL);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchHubSettings();
      setSettings(s);
      setOpenRouterModel(s.openRouterModel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);
    if (!adminToken.trim()) {
      setSaveMessage("Hub admin token is required to save.");
      return;
    }
    if (!openRouterApiKey.trim()) {
      setSaveMessage("OpenRouter API key is required.");
      return;
    }
    saveAdminToken(adminToken);
    setSaving(true);
    try {
      const next = await saveOpenRouterSettings(
        adminToken.trim(),
        openRouterApiKey.trim(),
        openRouterModel.trim(),
      );
      setSettings(next);
      setOpenRouterApiKey("");
      setSaveMessage("Saved.");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const account = settings?.openRouterAccountEmail ?? "matt@neodigital.ca";
  const subtitle = loading
    ? "Loading settings…"
    : error
      ? `Error: ${error}`
      : settings?.openRouter.configured
        ? `OpenRouter configured for ${account} (…${settings.openRouter.suffix ?? "????"})`
        : `OpenRouter not configured (${account})`;

  return (
    <div className="hub-page">
      <header className="hub-page-header">
        <h2 className="hub-page-title">Settings</h2>
        <p className="hub-page-subtitle">{subtitle}</p>
      </header>
      <p className="muted settings-note">
        Agent Hub OpenRouter billing: {account}. Use the API key from that account only (not Cursor MCP).
      </p>
      <form className="settings-form" onSubmit={(e) => void onSave(e)}>
        <div className="settings-row">
          <input
            className="field field-wide"
            type="password"
            placeholder="Hub admin token"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            aria-label="Hub admin token"
            autoComplete="off"
          />
          <input
            className="field field-wide"
            type="password"
            placeholder="OpenRouter API key (sk-or-…)"
            value={openRouterApiKey}
            onChange={(e) => setOpenRouterApiKey(e.target.value)}
            aria-label="OpenRouter API key"
            autoComplete="off"
          />
          <input
            className="field field-wide"
            placeholder="OpenRouter model"
            value={openRouterModel}
            onChange={(e) => setOpenRouterModel(e.target.value)}
            aria-label="OpenRouter model"
          />
        </div>
        <div className="settings-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save OpenRouter settings"}
          </button>
          {saveMessage ? <span className="muted">{saveMessage}</span> : null}
        </div>
      </form>
    </div>
  );
}
