# Open Design brief pack — Fintech Trust

Paste-ready inputs for **Open Design** (`github.com/nexu-io/open-design`) to generate the invite
gate and admin console so they match the already-shipped Fintech Trust calculator. Companion to
`ui-prompt-pack.md` (which holds the long-form prompts and the integration steps).

The anchor is the **DESIGN.md** below: install it once as the project's design system, then every
screen brief binds to it and comes back consistent. Do **not** regenerate the calculator — it already
ships this system (`app/src/app/home-client.tsx`); its brief is included only as a reference so Open
Design matches it.

## How to run it (local, no hosting)

Open Design is local-first. On macOS the shell resolves `od` to `/usr/bin/od` (octal-dump), so prefer
the desktop app; use the CLI only via the app's **Settings → MCP server** snippet (absolute paths).

1. Install the desktop app (DMG or Homebrew cask), open it, create a project for this repo.
2. Add the **DESIGN.md** below as the project's design system / direction (Studio → design system →
   paste). This is what keeps all screens on one look.
3. For each screen, run a **new-generation** brief (composer, or `od plugin apply od-new-generation
   --input brief="…"`) with the text from the sections below. Output is a single-page HTML/CSS
   artifact rendered in a sandboxed iframe.
4. Iterate with **od-design-refine** until a screen looks right.
5. Hand off: keep the HTML/CSS and lift it into the app by hand (plain CSS + CSS Modules — see
   ticket 03 / Prompt 4). `od-nextjs-export` exists but emits its own component conventions (likely
   Tailwind), which fights this repo's zero-dependency setup, so the by-hand lift is cleaner.

## DESIGN.md — the Fintech Trust design system (install once)

```markdown
# DESIGN.md — Fintech Trust

Product: a verified credit-card rewards comparison tool for Indian cardholders. The whole value
claim is "verified data, with the calculation shown" — every reward figure carries an evidence tier
and a source date. The visual language must make that auditability feel like the point.

Direction: light, dense, precise. Deep ink/navy foundation, one accent, tabular numerals, hierarchy
from borders and weight — not shadows and gradients. Reference: Stripe Dashboard density, Mercury
typographic restraint, Plaid data tables. NOT: dark glassmorphism, gradient meshes, purple SaaS,
oversized rounded blobs, emoji.

## Tokens
Ink      --ink-900 #0B1220  --ink-700 #1E293B  --ink-500 #475569  --ink-400 #64748B
         --ink-200 #E2E8F0  --ink-100 #F1F5F9  --ink-050 #F8FAFC  --surface #FFFFFF
Accent   --accent-600 #0E7490  --accent-500 #0891B2  --accent-050 #ECFEFF
Radius   6px controls · 10px cards · 999px badges
Space    4px base: 4 8 12 16 24 32 48 64
Type     system-ui for UI; ui-monospace/SF Mono/Menlo for rule IDs
         sizes 12 13 14 16 20 28 36; weights 400 500 600 700
         font-variant-numeric: tabular-nums on EVERY currency and points value
Elevation  borders first. Exactly one shadow, reserved for the winning result card:
           0 1px 2px rgba(11,18,32,.04), 0 8px 24px -12px rgba(11,18,32,.12)
Focus      0 0 0 3px rgba(8,145,178,.28) on every interactive element, :focus-visible

## Evidence tier ramp (the signature component)
Four tiers, descending confidence. Legible without colour — each pairs a fill glyph + label text
with the colour, so the ramp survives colourblindness and screen readers.
  officially-documented  ●  text #065F46  bg #ECFDF5  border #A7F3D0   (highest)
  statement-verified     ◕  text #155E75  bg #ECFEFF  border #A5F3FC
  inferred               ◐  text #92400E  bg #FFFBEB  border #FDE68A
  community-reported      ○  text #9F1239  bg #FFF1F2  border #FECDD3   (lowest)
Plus: a "retracted" destructive badge (#9F1239 on #FFF1F2) that visually overrides the evidence
badge; an "unresolved" neutral-warning treatment for cards with no computed figure.

## Component states (specify all — this is what inline styles can't express)
input / select / textarea / checkbox: rest · hover · focus (focus ring) · disabled · invalid
buttons: primary / secondary / ghost, each in rest · hover · focus · disabled
skeleton loading blocks for first load; never convey status by colour alone.

## Locale
₹ currency, two decimals, tabular numerals; Indian digit grouping (2,500 · 1,00,000); Indian dates.
```

## Brief 1 — Calculator (reference only; already shipped — match it, don't rebuild)

```text
Bind to DESIGN.md (Fintech Trust). This screen already exists in the product; generate it only as
the visual reference the other screens must match. Single page, no login, mobile-first then a
1100px desktop layout.

A transaction-input form (multi-select card list with select-all/clear; amount in ₹; date; optional
merchant; category select) and a ranked results area: one card per selected credit card, sorted by
reward value descending, the top card given the single allowed shadow + accent border + a "Best for
this spend" badge, every other card showing its shortfall vs best. Each result card leads with the
reward-value figure as the largest text (28–36px, tabular), then points, the evidence-tier badge from
the ramp, source + effective dates, an optional "rule retracted" badge, and a "Calculation trace"
disclosure that expands a legible audit trail (monospace rule IDs, applied vs skipped rules,
reasons, inputs, assumptions, evidence badge, a "report an issue" affordance). Unresolved cards sort
last and show a plain-language reason instead of figures.
```

## Brief 2 — Invite gate

```text
Bind to DESIGN.md (Fintech Trust). Design a beta invite gate — the first screen every user sees, so
it carries the whole first impression while holding exactly one input.

Content: product name, one line of context, a 24-character invite-code field (monospace, autocomplete
off, spellcheck off), a submit button reading "Enter" / "Verifying…", an inline error for an invalid
code, and a distinct pre-filled warning state for arriving revoked ("Your invite code has been
revoked. Contact the team for a new one."). Currently a bare 400px column on white — give it presence
through typography and a considered card treatment, not decoration; segmented/grouped character entry
for the code is worth exploring. Keep the revoked notice and the error as assertive live-region
banners. Deliver desktop + mobile.
```

## Brief 3 — Admin / steward console

```text
Bind to DESIGN.md (Fintech Trust). Design an internal data-steward console — dense, keyboard-driven,
staff-only. Optimise for scanning and safe destructive actions, not delight.

An admin-token password gate before anything loads. Then four sections, currently four flat blocks
on one endless scroll — give them a real navigation shell (sidebar or tabs) with the work queue as
the default view: (1) Data Lead queue — user-submitted corrections with status pending/verified/
approved/rejected, submitted evidence, an evidence-tier selector, a source date, approve/verify/
reject actions, a queue-length indicator and an empty state; (2) Retract a published Rule Version —
a destructive action taking a rule-version ID + reason, with a confirmation pattern proportional to
its being publicly visible and irreversible; (3) Managed delivery — catalog export + change feed;
(4) Contextual Report detail — look up a report by ID, render its JSON in a readable monospace block.
Reuse the evidence-tier ramp and status badges from DESIGN.md so admin and public surfaces match.
Keep assertive/status live-region banners. Deliver the nav shell, the queue view, one expanded lead
card, and the destructive-action confirmation.
```

## Handoff into the app

Once a screen looks right, integration is ticket 03 (see Prompt 4 of `ui-prompt-pack.md`): add
`src/app/globals.css` with the token block + reset + focus rules, import it once in `layout.tsx`,
convert each screen from its inline `s` style-map to a CSS Module, and lift shared components
(EvidenceBadge, StatusBadge, Badge, Banner, Button, Field) into `src/components/`. Preserve every
`role`/`aria-*`/`htmlFor` pairing; no Tailwind, no new runtime deps. Gate with
`npm run lint && npm run typecheck && npm test && npm run build` from `app/`.




