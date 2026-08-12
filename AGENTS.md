# AGENTS.md

This repo holds the credit card platform critical analysis plus Matt Pocock engineering-skill adapters.

## Repo layout

- `credit_card_platform_critical_analysis.md` — the analysis writeup
- `docs/agents/` — Matt Pocock skill adapters (`issue-tracker.md`, `triage-labels.md`, `domain.md`)
- `.scratch/` — local-markdown issue tracker (created lazily)
- `CONTEXT.md`, `docs/adr/` — domain docs (created lazily by `/domain-modeling`)

## User Preferences

- `CLAUDE.md` is a symlink to this file so Claude Code and Codex/Grok share one contract. Do not replace the symlink with a separate file.
- Re-running `setup-matt-pocock-skills` must update the `## Agent skills` block in this file and the matching files under `docs/agents/`. Do not create a second skills block in a new `CLAUDE.md`.
- Skills that publish issues, triage, or read domain docs follow `docs/agents/` and the `## Agent skills` block here. They do not invent a second tracker or glossary location.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.
