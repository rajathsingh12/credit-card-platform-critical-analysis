# Docs DOX

## Purpose

- Own durable agent and domain documentation for this repo

## Ownership

- `agents/` — Matt Pocock skill adapters (`issue-tracker.md`, `triage-labels.md`, `domain.md`)
- `adr/` — architectural decision records, created lazily by `/domain-modeling`

## Local Contracts

- `agents/*.md` are the runtime adapters for Matt Pocock engineering skills. The root `## Agent skills` block points at them; it is not a second source of truth.
- Changing tracker, labels, or domain layout updates the adapter file and the root `## Agent skills` block in the same pass.
- `domain.md` says proceed silently if `CONTEXT.md` or `docs/adr/` are missing. Create them only when a term or decision is resolved.
- Issue files belong under `.scratch/`, not here.

## Work Guidance

- Keep adapters operational and current. Delete stale mapping text instead of explaining history.

## Verification

## Child DOX Index

- `agents/` — parent-owned (no `agents/AGENTS.md`). Matt Pocock skill adapters: `issue-tracker.md`, `triage-labels.md`, `domain.md`
- `adr/` — not created yet; parent-owned when `/domain-modeling` adds it. No `adr/AGENTS.md` until that folder becomes its own durable boundary
