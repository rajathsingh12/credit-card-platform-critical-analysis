# 07 — Internal Publication Gate

**What to build:** Staff-only admin pages where the Data Steward can create a Data Lead, attach a source URL and Verification Record, compare the proposed rule against the current published Rule Version, and approve or reject. Approval publishes a new Rule Version with effective date; rejection retains the lead with a reason.

**Blocked by:** 04 — Core domain schema.

**Status:** done

- [x] Data Lead list shows pending leads with source, proposed change, and Evidence Status
- [x] Data Steward can attach a Verification Record with source URL and evidence type
- [x] Approve action creates a new Rule Version; prior version is preserved with effective_to set
- [x] Reject action records reason and retains the lead for re-review
- [x] Unauthenticated requests to admin routes return 401
- [x] No automated path can publish a Rule Version without Data Steward approval
