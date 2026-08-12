# docs/

Durable agent and domain documentation for this repo.

## Contents

- `agents/` — Matt Pocock skill adapters (`issue-tracker.md`, `triage-labels.md`, `domain.md`). Runtime adapters for the engineering skills; the root `## Agent skills` block points at them and is not a second source of truth.
- `adr/` — architectural decision records, created lazily by `/domain-modeling`.

## Notes

- Changing tracker, labels, or domain layout updates the adapter file and the root `## Agent skills` block in the same pass.
- `domain.md` says proceed silently if `CONTEXT.md` or `docs/adr/` are missing. Create them only when a term or decision is resolved.
- Issue files belong under `.scratch/`, not here.
