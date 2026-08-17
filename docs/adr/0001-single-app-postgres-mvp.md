---
status: accepted
---

# Use a Single TypeScript App with PostgreSQL for the MVP

The MVP will use one TypeScript/Next.js application with PostgreSQL, a deterministic Calculation Engine, and an internal rule-review interface. This keeps the first product small while preserving the versioned data model; FastAPI, Redis, scraping workers, LLM extraction, and service decomposition are deferred until measurable operational demand justifies them.
