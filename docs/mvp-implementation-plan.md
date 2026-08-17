# MVP Implementation Plan

## Goal

Build and validate an India-only, English-first, zero-login Transaction Decision tool for existing cardholders with multiple Indian credit cards. The MVP must explain outcomes with a Calculation Trace and visible Evidence Status rather than presenting opaque rankings.

## Non-goals

- Portfolio Optimization
- Consumer Subscription billing
- Affiliate Recommendation flows
- Bank-account connections or financial identity
- Automated public scraping or LLM-authored facts
- Public API availability commitments
- Historical "as of" calculations
- Foreign-issued cards or non-INR calculations

## Phase 0: Readiness and Validation

- Complete the Launch Compliance Review before public launch.
- Name the Data Steward and a second reviewer for material rule changes.
- Select the 30-40-card Verified Card Set across major issuers, categories, reward currencies, and fee bands.
- Define the initial supported Transaction Contexts and create a representative golden calculation set from issuer terms and observed statements.
- Recruit 20-30 Primary Cardholders and prospective Data Customers for Closed Beta.
- Identify two prospective Data Customers for formally scoped pilots.

Exit criteria: the legal gate, ownership, launch card set, evidence standard, golden dataset, and beta cohort are all defined.

## Phase 1: Versioned Data and Calculation Engine

- Create PostgreSQL records for cards, Rule Versions, sources, Verification Records, Evidence Status, redemption scenarios, and effective dates.
- Preserve prior Rule Versions; never overwrite an effective historical fact.
- Implement the deterministic Calculation Engine as a TypeScript module with explicit inputs, assumptions, and unresolved states.
- Support exact direct-value rewards and dated, sourced Redemption Scenarios for variable-value rewards.
- Seed and review the Verified Card Set through the Publication Gate.

Exit criteria: every supported rule has provenance and effective dates, and the golden dataset has zero unresolved Critical Calculation Errors.

## Phase 2: Zero-Login Consumer Workflow

- Build the Transaction Context form for amount, merchant or category, payment channel, and relevant month-to-date spend.
- Show side-by-side Transaction Outcomes and Net Return for selected cards.
- Show the Calculation Trace, assumptions, source dates, Evidence Status, and Unresolved Outcome state.
- Use current effective Rule Versions only; display the effective date.
- Keep beta access gated by revocable invite links or codes without creating user accounts.

Exit criteria: a cardholder can complete a Transaction Decision without login, bank linking, or staff assistance.

## Phase 3: Review and Correction Operations

- Add internal workflows for Data Leads, source capture, rule comparison, human approval, rejection, retraction, and publication.
- Add Contextual Reports attached to a Calculation Trace or rule.
- Preserve Correction History and mark affected outcomes unresolved when a credible material error is reported.
- Review official sources weekly and prioritize detected high-impact changes for next-business-day review during beta.
- Avoid public real-time or response-time claims until the operation proves its Freshness Target.

Exit criteria: the Data Steward can trace every public result to evidence and can correct a material error without destroying prior history.

## Phase 4: Closed Beta

- Run the invite-only beta with 20-30 Primary Cardholders and prospective Data Customers.
- Track completed Transaction Decisions, repeat use, unresolved outcomes, Contextual Reports, and correction turnaround.
- Audit representative calculations continuously against the golden dataset and observed evidence.
- Collect B2B requirements without building a self-serve API.

Phase Gate: at least 50% of beta cardholders complete three or more decisions within 30 days; no open Critical Calculation Errors; two formally scoped Data Customer pilots; and at least one paid conversion commitment.

## Phase 5: Managed B2B Pilot

- Deliver an initial Versioned Catalog to each Data Customer.
- Deliver a weekly Change Feed with Rule Versions and Evidence Status.
- Send material published changes outside the weekly cadence when available.
- Use a time-boxed, paid 90-day Paid Pilot that can credit toward an Integration License.
- Prohibit resale, onward redistribution, and unsupported suitability or marketing claims.

Exit criteria: the paid pilot demonstrates recurring data value and the manual delivery operation is predictable enough to define a durable Integration License.

## Phase 6: First Expansion

After the MVP Phase Gate, prioritize opt-in Portfolio Optimization using saved cards and manually entered spending patterns. Keep bank linking, affiliate flows, consumer billing, and a self-serve API deferred until the expanded product has its own validation and compliance evidence.

## Validation Strategy

- Unit and property tests for the Calculation Engine.
- Golden-data regression tests for caps, exclusions, fees, reward conversion, and effective-date behavior.
- Review tests for every publication and correction path.
- Browser validation of the zero-login workflow at desktop and mobile widths.
- Manual beta observation of the full path from input to Calculation Trace to Contextual Report.
- Ongoing audit of public outcomes against their Verification Records.
