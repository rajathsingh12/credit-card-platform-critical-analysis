# UI Prompt Pack — Fintech Trust direction

Paste-ready prompts for Claude (design mode) or OpenDesign. Run **Prompt 0 first** in a fresh
conversation, then any screen prompt in that same conversation so the tokens carry over.

## Why the current UI reads as bland

Not a colour problem. Five structural gaps, in priority order:

1. **No ranking.** `home-client.tsx` renders results in `Set` iteration order. The user's actual
   question — "which card wins?" — is never answered visually.
2. **Numbers are not the hero.** `₹133.00` renders at `0.875rem` in a `space-between` metric row,
   the same weight as its label.
3. **Evidence tiers are four unrelated Bootstrap alerts** (`#d4edda`, `#cce5ff`, `#fff3cd`,
   `#f8d7da`). They encode a *confidence ramp* but look like unrelated statuses — and they are
   colour-only, so the ramp is invisible to a colourblind or screen-reader user.
4. **No focus styles anywhere.** Zero `:focus` rules exist; inline `style` objects can't express
   pseudo-states, which is also why there is no hover, no transition, no media query beyond one
   injected `<style>` string at `home-client.tsx:417`.
5. **Flat, borderless hierarchy.** Every container is `#f8f8f8` + `1px solid #ddd`. Nothing
   recedes, nothing advances.

## Current state (facts the prompts rely on)

| Aspect | Reality |
| --- | --- |
| Framework | Next 15 App Router, React 19 |
| Styling | Inline `React.CSSProperties` maps named `s` in each file. **No CSS file exists.** |
| CSS deps | None. No Tailwind, no CSS-in-JS library. |
| Screens | `src/app/home-client.tsx` (493 L), `src/app/invite/page.tsx` (94 L), `src/app/admin/admin-console.tsx` (566 L) |
| Layout | `src/app/layout.tsx` is bare — `<html><body>{children}</body></html>`, no font, no reset |
| a11y | `eslint-plugin-jsx-a11y` active; `useId()` label wiring, `role="group"`/`alert"`/`status"` in place — **must survive** |
| Locked API | `toggleItem()` is exported from `home-client.tsx` and asserted by `home-client.test.ts` |

---

## Prompt 0 — Design system

```text
You are designing a design system for an Indian credit-card rewards comparison tool. The product's
entire value claim is "verified data, with the calculation shown" — every reward figure carries an
evidence tier and a source date, and retracted rules are shown publicly. The visual language must
make that auditability feel like the point, not a footnote.

Direction: FINTECH TRUST. Light, dense, precise. Deep ink/navy foundation, one accent, tabular
numerals, hierarchy from borders and weight rather than shadows and gradients. Reference points:
Stripe Dashboard's density, Mercury's typographic restraint, Plaid's data tables. Explicitly NOT:
dark glassmorphism, gradient meshes, purple SaaS, oversized rounded blobs, emoji.

Produce a token set and component specs. Use these exact values as the starting point and refine
only with a stated reason:

  Ink        --ink-900 #0B1220  --ink-700 #1E293B  --ink-500 #475569
             --ink-400 #64748B  --ink-200 #E2E8F0  --ink-100 #F1F5F9
             --ink-050 #F8FAFC  --surface #FFFFFF
  Accent     --accent-600 #0E7490  --accent-500 #0891B2  --accent-050 #ECFEFF
  Radius     6px controls / 10px cards / 999px badges
  Space      4px base: 4 8 12 16 24 32 48 64
  Type       system-ui stack for UI; ui-monospace/SF Mono/Menlo for rule IDs
             sizes 12 13 14 16 20 28 36; weights 400 500 600 700
             font-variant-numeric: tabular-nums on EVERY currency and points value
  Elevation  borders first. Exactly one shadow, reserved for the winning result card:
             0 1px 2px rgba(11,18,32,.04), 0 8px 24px -12px rgba(11,18,32,.12)
  Focus      0 0 0 3px rgba(8,145,178,.28) — every interactive element, :focus-visible

Design the EVIDENCE TIER RAMP as the system's signature component. Four tiers, ordered by
descending confidence, and the ramp must be legible without colour — pair each tier with a fill
glyph and keep the label text:

  officially-documented  ● highest   text #065F46  bg #ECFDF5  border #A7F3D0
  statement-verified     ◕           text #155E75  bg #ECFEFF  border #A5F3FC
  inferred               ◐           text #92400E  bg #FFFBEB  border #FDE68A
  community-reported     ○ lowest    text #9F1239  bg #FFF1F2  border #FECDD3

Also specify: a "retracted" destructive badge, an "unresolved" neutral-warning card treatment,
input/select/textarea/checkbox at rest + hover + focus + disabled + invalid, primary/secondary/
ghost buttons in the same five states, and skeleton loading blocks.

Deliverables:
1. A single :root CSS custom-property block, semantically named (--color-text-secondary, not
   --gray-3).
2. Component specs as CSS classes, not inline styles — pseudo-states and media queries are
   required, which is exactly what this codebase currently cannot express.
3. A one-screen ASCII or rendered preview of the evidence ramp and the button/input states.

Target: Next.js 15 App Router with plain CSS (a global stylesheet plus CSS Modules). Do NOT assume
Tailwind — it is not installed in this project. Emit no build-tool changes.
```

---

## Prompt 1 — Calculator (the money screen)

```text
Using the design system above, redesign the primary screen of a credit-card rewards comparison
tool. Single-page, no login, mobile-first, then a 1100px max-width desktop layout.

INPUT SECTION — one form, currently five stacked fields:
- Multi-select card list. Real data: {id, name, issuer, rewardCurrency}; display as
  "HDFC Bank — Infinia". 10-40 cards, needs scroll. Has "Select all" / "Clear" / "N selected".
  Currently a 200px-tall scrolling box of bare checkboxes — redesign this; it is the screen's
  worst element.
- Amount in ₹ (number), transaction date (date, defaults today).
- Merchant name (optional text), merchant category (select, 11 options: Dining, Travel, Online
  Shopping, Grocery, Entertainment, Utilities, Insurance, Fuel, Rent, Wallet Load, Other).
- Submit button whose label is dynamic: "Compare 3 cards" / "Compare card".

RESULTS SECTION — one card per selected credit card. THE CRITICAL CHANGE: results are currently
unordered. Rank them by net return descending, give the top result a distinct winning treatment
(the single allowed shadow, an accent border, a "Best for this spend" badge), and on every other
card show its shortfall against the winner, e.g. "−₹108.00 vs best".

Per-card data, all real:
- Card name + issuer.
- resolved | unresolved. Unresolved cards show a plain-language reason instead of figures and must
  sort last regardless of ranking.
- rewardsEarned (integer points), netReturnCents, annualFeeAmortizedCents — render as ₹ with two
  decimals, tabular numerals. Make the net-return figure the largest text on the card (28-36px);
  points are secondary.
- Evidence tier badge for the applied rule (use the ramp from the design system).
- Source-verified date, rule-effective-from date.
- Optional "rule retracted" destructive badge, which must visually override the evidence badge.
- Optional assumption notes (short italic strings).
- A disclosure toggle: "Calculation trace (3 rules)".

CALCULATION TRACE — currently a vertical stack of identical grey boxes; redesign as a legible
audit trail. Per entry: a monospace rule ID, an "applied" marker (usually 1 of N applied, the rest
were evaluated and skipped), a human reason string, points before/after cap when they differ, the
rule inputs (category · multiplier · cap · included categories · exclusions), assumptions, an
evidence badge, a source date, and a "Report an issue with this rule" affordance that expands into
a textarea + optional source-URL field. Applied vs. skipped entries must be distinguishable at a
glance. Consider a stepper or timeline over stacked boxes.

Also design: a page header (product name + "Beta" marker), the transaction echoed as a compact
summary chip row once results exist, a collapsed "Correction History" section listing publicly
retracted rules, an inline form-level error state, and a card-list skeleton for first load (today
it says "Loading cards…" inside an input-shaped box).

CONSTRAINTS
- Keep semantics: the card list is role="group" with aria-labelledby, errors are role="alert",
  every input keeps a programmatically associated <label>. jsx-a11y is enforced in CI.
- Never convey status by colour alone.
- Currency is ₹, dates are Indian format, integers use Indian digit grouping (2,500 / 1,00,000).
- Plain CSS + CSS Modules only. No new runtime dependencies.

Deliver the desktop and mobile layouts, then the CSS.
```

---

## Prompt 2 — Invite gate

```text
Using the design system above, redesign a beta invite gate. It is the first thing every user sees,
so it carries all of the product's first impression while containing exactly one input.

Content: product name, one line of context, a 24-character invite code field (monospace,
autocomplete off, spellcheck off), a submit button that reads "Enter" / "Verifying…", an inline
error for an invalid code, and a distinct pre-filled warning state when arriving at ?revoked=1
("Your invite code has been revoked. Contact the team for a new one.").

Currently: a 400px column, 6rem from the top, on bare white. Give it presence without decoration —
earn it through typography, a considered card treatment, and something that signals what is behind
the gate. Segmented or grouped character entry for the code is worth exploring.

Keep the revoked notice and the error as role="alert". Deliver desktop and mobile, then the CSS.
```

---

## Prompt 3 — Admin console (data steward)

```text
Using the design system above, redesign an internal data-steward console. Dense, keyboard-driven,
staff-only. Optimise for scanning and safe destructive actions, not for delight.

Gate: an admin-token password field before anything loads.

Four working sections, currently four flat `border-top` blocks on one endless scroll — give this a
real navigation structure (sidebar or tabs) with the work queue as the default view:

1. Data Lead queue — user-submitted corrections awaiting review. Each lead shows its status
   (pending | verified | approved | rejected), the submitted evidence, an evidence-tier selector,
   a source date, and approve / verify / reject actions. Needs a queue-length indicator and an
   empty state.
2. Retract a published Rule Version — a destructive action taking a rule-version ID and a
   retraction reason. Design a confirmation pattern proportional to the fact that this is publicly
   visible and irreversible.
3. Managed delivery — catalog export download plus a change feed.
4. Contextual Report detail — look up one report by ID; renders JSON in a scrolling monospace
   block. Make that block readable rather than raw.

Reuse the evidence-tier ramp and status badges from the design system so admin and public surfaces
stay consistent. Keep role="alert" / role="status" banners. Plain CSS + CSS Modules.

Deliver the navigation shell, the queue view, one expanded lead card, and the destructive-action
confirmation, then the CSS.
```

---

## Prompt 4 — Integration (run after you pick a design)

```text
Convert the approved design into this codebase with the smallest possible diff.

Current styling: every component holds a local `const s: Record<string, React.CSSProperties>` map
and applies it via inline `style={s.x}` and spread merges like `{...s.card, ...s.cardUnresolved}`.
There is no CSS file in the project and `src/app/layout.tsx` is bare.

Do this:
1. Add `src/app/globals.css` with the :root token block, a minimal reset, base typography, and
   focus-visible rules. Import it once in `layout.tsx`.
2. Add one CSS Module per screen. Replace the `s` maps. Conditional styling becomes conditional
   class names, not object spreads.
3. Extract the components that now exist in all three screens — EvidenceBadge, StatusBadge,
   Badge, Banner, Button, Field — into a shared `src/components/` directory. EvidenceBadge is
   currently duplicated verbatim in `home-client.tsx` and `admin-console.tsx`.
4. Implement result ranking in `home-client.tsx`: sort resolved results by netReturnCents
   descending, unresolved last, and derive each card's shortfall from the winner.

Hard constraints:
- `toggleItem(set, key)` stays exported from `home-client.tsx` with its current signature;
  `home-client.test.ts` asserts it.
- Preserve every `role`, `aria-*`, `htmlFor`/`useId()` pairing and `required` attribute.
- Delete the injected `<style>` string at `home-client.tsx:417`; the media query belongs in CSS.
- No new runtime dependencies. Adding Tailwind is out of scope.
- Then run: `npm run typecheck && npm run lint && npm test`. Report pass/fail.
```

---

## Sequencing

Prompt 0 → Prompt 1 → iterate on the calculator until the results section is right → Prompts 2 and
3 → Prompt 4. Prompt 1 is 80% of the perceived quality; the invite gate and admin console inherit
whatever the calculator settles on.

If the design tool returns Tailwind despite the constraint, keep the visual output and re-run
Prompt 4 — the tokens and layout survive; only the delivery mechanism changes.
