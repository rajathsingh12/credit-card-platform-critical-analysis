-- Reverse: DROP TABLE IF EXISTS contextual_reports, correction_history CASCADE;
--          ALTER TABLE rule_versions DROP COLUMN IF EXISTS retracted_at;
--          Restore previous prevent_rule_version_update.

ALTER TABLE rule_versions ADD COLUMN IF NOT EXISTS retracted_at TIMESTAMPTZ;

-- Relax immutability to also allow setting retracted_at (optionally closing effective_to together).
CREATE OR REPLACE FUNCTION prevent_rule_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Allow closing a version (effective_to NULL → non-NULL only).
  IF OLD.effective_to IS NULL
    AND NEW.effective_to IS NOT NULL
    AND OLD.retracted_at IS NOT DISTINCT FROM NEW.retracted_at
    AND NEW.id = OLD.id
    AND NEW.card_id = OLD.card_id
    AND NEW.verification_record_id = OLD.verification_record_id
    AND NEW.effective_from = OLD.effective_from
    AND NEW.rule_data::text = OLD.rule_data::text
  THEN
    RETURN NEW;
  END IF;
  -- Allow retracting (retracted_at NULL → non-NULL; effective_to may also close in same update).
  IF OLD.retracted_at IS NULL
    AND NEW.retracted_at IS NOT NULL
    AND NEW.id = OLD.id
    AND NEW.card_id = OLD.card_id
    AND NEW.verification_record_id = OLD.verification_record_id
    AND NEW.effective_from = OLD.effective_from
    AND NEW.rule_data::text = OLD.rule_data::text
    AND (OLD.effective_to IS NULL OR NEW.effective_to = OLD.effective_to)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'rule_versions rows are immutable; only effective_to may be closed, or retracted_at may be set once';
END;
$$;

CREATE TABLE IF NOT EXISTS correction_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id UUID NOT NULL REFERENCES rule_versions(id),
  card_id         UUID NOT NULL REFERENCES cards(id),
  retraction_reason TEXT NOT NULL,
  retracted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contextual_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES cards(id),
  rule_version_id UUID REFERENCES rule_versions(id),
  trace_context   JSONB,
  description     TEXT NOT NULL,
  source_url      TEXT,
  data_lead_id    UUID REFERENCES data_leads(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
