-- Reverse: DROP TABLE IF EXISTS data_leads CASCADE;
--          DROP TYPE IF EXISTS data_lead_status;
--          Restore original prevent_rule_version_update (unconditional RAISE EXCEPTION).

DO $$ BEGIN
  CREATE TYPE data_lead_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS data_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id),
  proposed_rule_data JSONB NOT NULL,
  source_url TEXT NOT NULL,
  status data_lead_status NOT NULL DEFAULT 'pending',
  verification_record_id UUID REFERENCES verification_records(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relax immutability to allow closing a version (NULL → non-NULL effective_to only).
CREATE OR REPLACE FUNCTION prevent_rule_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.effective_to IS NULL
    AND NEW.effective_to IS NOT NULL
    AND NEW.id = OLD.id
    AND NEW.card_id = OLD.card_id
    AND NEW.verification_record_id = OLD.verification_record_id
    AND NEW.effective_from = OLD.effective_from
    AND NEW.rule_data::text = OLD.rule_data::text
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'rule_versions rows are immutable; only effective_to may be set once to close a version';
END;
$$;
