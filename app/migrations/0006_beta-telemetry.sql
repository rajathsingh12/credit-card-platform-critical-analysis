-- Reverse: DROP TABLE IF EXISTS beta_events CASCADE;

CREATE TABLE IF NOT EXISTS beta_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name    TEXT        NOT NULL,
  session_token TEXT,
  payload       JSONB       NOT NULL DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS beta_events_event_occurred
  ON beta_events (event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS beta_events_session_event
  ON beta_events (session_token, event_name, occurred_at DESC)
  WHERE session_token IS NOT NULL;

-- Phase 4 gate metric query (≥50% of sessions complete 3+ decisions within 30 days):
--
-- SELECT
--   COUNT(*) FILTER (WHERE decisions >= 3) AS met_gate,
--   COUNT(*) AS total_sessions,
--   ROUND(100.0 * COUNT(*) FILTER (WHERE decisions >= 3) / NULLIF(COUNT(*), 0), 1) AS pct_met
-- FROM (
--   SELECT session_token, COUNT(*) AS decisions
--   FROM beta_events
--   WHERE event_name = 'decision_completed'
--     AND occurred_at >= NOW() - INTERVAL '30 days'
--   GROUP BY session_token
-- ) per_session;
--
-- Correction turnaround query (retraction to next published Rule Version, per card):
--
-- SELECT
--   ch.id, ch.card_id, ch.retracted_at,
--   MIN(rv.effective_from) AS next_published_date,
--   MIN(rv.effective_from) - ch.retracted_at::date AS turnaround_days
-- FROM correction_history ch
-- LEFT JOIN rule_versions rv
--   ON rv.card_id = ch.card_id AND rv.retracted_at IS NULL AND rv.effective_from > ch.retracted_at::date
-- GROUP BY ch.id, ch.card_id, ch.retracted_at;
