---
status: accepted
---

# Evidence Standard for Publication

Only `officially-documented` and `statement-verified` Verification Records may pass the Publication Gate into the Verified Card Set. `inferred` and `community-reported` evidence may still create a Data Lead so the Data Steward can see it, but the lead stays pending until stronger evidence replaces it. An `officially-documented` record must cite the issuer's own domain, and a `community-reported` record must not; this makes the evidence label checkable rather than self-asserted. The cost is narrower card coverage; the gain is that the weakest evidence can never reach a Transaction Outcome.

## Amendment 1 — Domain check enforced at record creation (2026-08-19)

The issuer-domain rule is now enforced on the live verify route (`app/src/app/api/admin/leads/[id]/verify/route.ts`), where the Verification Record is created. The route joins the lead's `issuer` from `cards` via `card_id`, calls `validateEvidence({ issuer, evidenceStatus, sourceUrl })`, and returns 422 with the validator's error on failure — so a Data Steward can no longer stamp `officially-documented` on a non-issuer URL (or `community-reported` on an issuer URL). Enforcement stays at record creation, not in `publishLead`; the seed's `--approve` path goes through `publishLead` and is unaffected.
