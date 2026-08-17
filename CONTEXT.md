# Credit Card Intelligence Platform

A decision-support context for Indian credit-card users and the organizations that need trustworthy card and rewards data.

## Product Concepts

**Cardholder**:
A person who owns or uses one or more credit cards to make purchases and redeem rewards.
_Avoid_: User, customer, account holder

**Consumer Wedge**:
The auditable comparison of card outcomes for a specific purchase or spending pattern, beginning with the reward calculator and transaction simulator.
_Avoid_: Card discovery, card marketplace

**Reward Rule**:
A condition that determines how a card converts an eligible purchase or milestone into rewards, including earn rates, caps, exclusions, and qualification requirements.
_Avoid_: Benefit, offer

**Transaction Outcome**:
The calculated result of applying a card's reward rules to a purchase, including earned rewards, fees, and estimated net value.
_Avoid_: Reward result, cashback result

**Primary Cardholder**:
An existing Indian cardholder with multiple cards who needs to choose among them for a particular purchase.
_Avoid_: New applicant, lead

**Transaction Decision**:
A cardholder's choice of which card to use for a purchase, based on the applicable transaction outcome and its supporting evidence.
_Avoid_: Card recommendation, best-card ranking

**Zero-Login Calculation**:
A transaction decision produced from manually supplied card and purchase details without creating an account or connecting a financial institution.
_Avoid_: Guest account, anonymous profile

**Transaction Context**:
The purchase information needed to evaluate a Transaction Decision: amount, merchant or category, payment channel, and relevant month-to-date spend.
_Avoid_: MCC input, transaction history

**Net Return**:
The value delivered by a card after considering its rewards and the card's associated costs.
_Avoid_: Reward rate, annual-fee waiver

**Redemption Scenario**:
A dated, sourced way to exchange a variable-value reward for a stated benefit.
_Avoid_: Point value, exchange rate

**Calculation Trace**:
The visible chain of inputs, rules, assumptions, and evidence that explains a Transaction Outcome.
_Avoid_: Best-card score, recommendation rationale

**MVP Boundary**:
The deliberately limited product scope consisting of zero-login Transaction Decisions for the Verified Card Set.
_Avoid_: Initial roadmap, launch catalog

**Calculation Engine**:
The deterministic application of Reward Rules to a Transaction Context to produce a Transaction Outcome and Calculation Trace.
_Avoid_: Recommendation model, ranking algorithm

**Current Outcome**:
A Transaction Outcome calculated using the Rule Version currently effective for the transaction date.
_Avoid_: Historical simulation, as-of result

**Contextual Report**:
A Community Report attached to the specific Calculation Trace or rule that prompted it.
_Avoid_: General feedback, support ticket

## Data Trust

**Evidence Status**:
The level of support for a fact about a card or reward rule: officially documented, verified from observed statements, inferred from issuer terms, or reported by the community.
_Avoid_: Confidence score

**Verification Record**:
The dated evidence and source history supporting a card fact or reward rule.
_Avoid_: Data note, citation

**Data Lead**:
A potentially relevant change or fact detected from an external source that requires human verification before becoming platform knowledge.
_Avoid_: Scraped fact, published extraction

**Verified Card Set**:
The deliberately limited collection of widely held, reward-relevant cards whose relevant reward rules and exclusions have been checked to the platform's evidence standard.
_Avoid_: Card catalog, supported cards

**Rule Version**:
A dated form of a Reward Rule that remains reproducible for the period in which it applied.
_Avoid_: Current rule, historical note

**Publication Gate**:
The required human approval that turns a verified fact or rule change into public platform knowledge.
_Avoid_: Automated publish, extraction approval

**Unresolved Outcome**:
A transaction outcome that cannot be stated as a single value because relevant evidence is missing or materially conflicts.
_Avoid_: Estimated result, low-confidence answer

**Critical Calculation Error**:
A published Transaction Outcome whose materially wrong value, eligibility, cap, exclusion, fee, or evidence could mislead a cardholder's Transaction Decision.
_Avoid_: Display defect, minor discrepancy

**Community Report**:
A privacy-preserving, evidence-backed submission from a cardholder about a potential card fact or Reward Rule change.
_Avoid_: Community edit, public correction

**Data Steward**:
The named person accountable for approving, rejecting, retracting, and versioning platform knowledge.
_Avoid_: Moderator, automation owner

**Correction History**:
A public record of Critical Calculation Errors and their resulting Rule Version changes.
_Avoid_: Silent correction, changelog

**Freshness Target**:
The internal review cadence for official sources and priority handling of detected material changes, without a public real-time promise.
_Avoid_: Real-time guarantee, public SLA

## Business Model

**Structured Data Product**:
A paid, machine-readable representation of verified card, reward, redemption, and change data for business customers.
_Avoid_: Data resale, affiliate feed

**Data Customer**:
A fintech, budgeting app, or personal-finance tool that pays for maintained structured card data.
_Avoid_: Bank client, API consumer

**Versioned Catalog**:
A dated, machine-readable collection of card facts and Reward Rules that preserves prior versions rather than replacing them.
_Avoid_: Live catalog, current-state feed

**Change Feed**:
A dated sequence of verified changes to the Versioned Catalog.
_Avoid_: News feed, scrape feed

**Phase Gate**:
A measurable condition that must be met before the product expands beyond its MVP Boundary.
_Avoid_: Roadmap milestone, feature release

**Launch Market**:
The geographic, currency, card-issuer, and language boundary within which the product makes a verified promise.
_Avoid_: Target market, supported region

**Consumer Subscription**:
A paid access tier for cardholders that provides value beyond the free calculator and public trust information.
_Avoid_: Premium card, membership

**Affiliate Recommendation**:
A card application or offer path that may generate compensation for the platform and must remain visibly distinct from outcome calculations and editorial facts.
_Avoid_: Sponsored recommendation, paid ranking

**Launch Compliance Review**:
An India-qualified legal assessment of the platform's consumer language, disclosures, data collection, and commercial relationships required before public launch.
_Avoid_: Compliance patch, disclaimer review

**Integration License**:
A non-exclusive, time-limited right for a Data Customer to embed the Versioned Catalog and Change Feed in its own product without resale or onward redistribution.
_Avoid_: Data ownership, unrestricted API access

**Closed Beta**:
A limited, invite-only release used to test the MVP Boundary with Primary Cardholders and prospective Data Customers before public launch.
_Avoid_: Public launch, open waitlist

**Paid Pilot**:
A time-boxed commercial engagement in which a Data Customer receives managed catalog delivery and Change Feed updates before committing to an Integration License.
_Avoid_: Free trial, self-serve plan

**Managed Delivery**:
A human-supported supply of a Versioned Catalog and Change Feed without a public API availability commitment.
_Avoid_: Real-time API, self-serve integration

**Portfolio Optimization**:
A future, opt-in comparison of a Cardholder's saved cards and manually entered spending patterns to improve multiple Transaction Decisions together.
_Avoid_: Bank-linked optimization, auto-switching
