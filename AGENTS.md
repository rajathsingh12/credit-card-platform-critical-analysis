# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits
- Matt Pocock engineering skills are configured for this repo; see ## Agent skills

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be
- The Child DOX Index names every durable child on disk: each child AGENTS.md, and each owned folder that has no AGENTS.md yet, with the files it currently holds
- An existing folder is never omitted because it lacks its own AGENTS.md
- Root owns `credit_card_platform_critical_analysis.md` and `CLAUDE.md` (symlink to this file)
- `docs/` has its own AGENTS.md

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Until a folder has its own AGENTS.md, keep it in the parent's Child DOX Index as parent-owned and list the files it holds
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index: walk the folder on disk, then list each child AGENTS.md and every durable owned folder that exists, including folders with no AGENTS.md of their own
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

- `CLAUDE.md` is a symlink to this file so Claude Code and Codex/Grok share one contract. Do not replace the symlink with a separate file.
- Re-running `setup-matt-pocock-skills` must update the `## Agent skills` block in this file and the matching files under `docs/agents/`. Do not create a second skills block in a new `CLAUDE.md`.
- Skills that publish issues, triage, or read domain docs follow `docs/agents/` and the `## Agent skills` block here. They do not invent a second tracker or glossary location.
- When those skills write durable files (`.scratch/`, `CONTEXT.md`, `docs/adr/`), DOX closeout still applies. Update the owning AGENTS.md if ownership, workflow, or structure changes.
- A child AGENTS.md may specialize local work. It may not drop DOX or the Agent skills contract.
- When refreshing a Child DOX Index, walk the folder on disk. Name every durable child folder and its current files. Do not write "no child AGENTS.md" as the only row if owned folders exist.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

## Child DOX Index

- `docs/AGENTS.md` — durable docs; owns `docs/agents/` now and `docs/adr/` when created
- Root-owned files: `credit_card_platform_critical_analysis.md`, `CLAUDE.md` (symlink to this file)
- No child AGENTS.md yet for `.scratch/` (created lazily by the issue tracker) or `docs/adr/` (created lazily by domain-modeling)
