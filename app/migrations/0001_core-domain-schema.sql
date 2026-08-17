-- Reverse: DROP TABLE IF EXISTS redemption_scenarios, rule_versions, cards, verification_records, sources CASCADE;
--          DROP TYPE IF EXISTS evidence_status;

DO $$ BEGIN
  CREATE TYPE evidence_status AS ENUM (
    'officially-documented',
    'statement-verified',
    'inferred',
    'community-reported'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  evidence_status evidence_status NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  network TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id),
  verification_record_id UUID NOT NULL REFERENCES verification_records(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  rule_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS redemption_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- rule_versions rows are insert-only; the trigger prevents any UPDATE.
CREATE OR REPLACE FUNCTION prevent_rule_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'rule_versions rows are immutable; insert a new version instead';
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER rule_versions_no_update
    BEFORE UPDATE ON rule_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_rule_version_update();
EXCEPTION WHEN duplicate_object THEN null; END $$;
