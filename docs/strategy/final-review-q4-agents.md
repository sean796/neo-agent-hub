# Final review: Q4 agent plan (mandatory)

**Date:** 2026-10-01  
**Scope:** Documentation + registry only (no runtime agents shipped in this pass)

## Logic (claims vs evidence)

| Claim | Evidence |
|-------|----------|
| Three priorities match the attached plan | [q4-priority-selection.md](./q4-priority-selection.md) selects #2, #1, #3 |
| GSC data should come from Pulse | Pulse uses service account + `/api/gsc/fetch-reporting-bundle` (documented in [seo-pulse-integration-map.md](../engineering/seo-pulse-integration-map.md)) |
| Drive publish extends existing OAuth | [meeting-notes-drive-publish-map.md](../engineering/meeting-notes-drive-publish-map.md) lists scope deltas on existing `google-oauth.ts` |
| Registry reflects planned work | `packages/core/src/agents.ts` adds three `disabled` rows; `meeting-notes` stays `beta` |

## Occam's razor

- No new dashboards; Slack + Drive deliverables only.
- No duplicate GSC client in hub; Pulse bridge first.
- Drive publish is a button on existing meeting-notes flow, not a second slash command (unless product asks later).

## Server-side only

- Maps specify hub → Pulse API and hub → Google APIs from server; no browser fetch to GSC or SERP providers.

## No fallbacks / no workarounds

- Engineering maps define fail-fast ephemeral errors; no “if OR fails, post generic digest.”
- LLM steps require schema validation when implemented (called out in seo-pulse map).

## Murphy's Law pass

| Risk | Mitigation documented |
|------|------------------------|
| OAuth missing Drive scopes | Re-consent + 403 message |
| Pulse token missing | 401 ephemeral |
| Empty GSC bundle | Explicit empty state |
| Wrong Slack channel / site | `SEO_PULSE_SITE_MAP_JSON` + list slugs on error |
| Over-promising clients | One-pagers state what is **not** included |

## Over-promise check (one-pagers)

- SEO pulse: not ranking guarantees, not full crawl monitoring.
- Intent check: not auto-publish, not legal/compliance replacement.
- Drive publish: not automatic client email.

## Extra entities avoided

- No new npm packages in this pass.
- No Pulse code changes in this pass (contract proposed only).
- Plan file untouched per user request.

## Sign-off

Documentation and registry sync complete. Next implementation pass: `meeting-notes-drive` button + OAuth scopes, then Pulse internal route + `/seo-pulse`.
