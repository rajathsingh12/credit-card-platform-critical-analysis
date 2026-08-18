# 13 — Beta telemetry

**What to build:** Anonymous event log capturing the Phase 4 gate metrics. No PII stored. Events keyed to an anonymous session token only.

**Blocked by:** 11 — Beta invite gate.

**Status:** completed

- [x] Events logged: decision_completed, session_repeat, unresolved_outcome_shown, contextual_report_submitted
- [x] No PII stored; events keyed to anonymous session token only
- [x] Phase 4 gate metric — at least 50% of beta cardholders complete three or more Transaction Decisions within 30 days — is computable from the log
- [x] Correction turnaround time tracked from retraction event to next published Rule Version
