-- Reverse: ALTER TABLE cards DROP COLUMN reward_currency, DROP COLUMN annual_fee_cents;
--          ALTER TABLE cards DROP CONSTRAINT cards_issuer_name_key;
--          ALTER TABLE redemption_scenarios
--            DROP COLUMN redemption_type, DROP COLUMN applicable_categories,
--            DROP COLUMN cents_per_point, DROP COLUMN effective_from, DROP COLUMN effective_to;

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS reward_currency TEXT NOT NULL DEFAULT 'issuer-points',
  ADD COLUMN IF NOT EXISTS annual_fee_cents INTEGER;

ALTER TABLE cards ALTER COLUMN reward_currency DROP DEFAULT;

DO $$ BEGIN
  ALTER TABLE cards ADD CONSTRAINT cards_issuer_name_key UNIQUE (issuer, name);
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE redemption_scenarios
  ADD COLUMN IF NOT EXISTS redemption_type TEXT NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS applicable_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cents_per_point NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE;

ALTER TABLE redemption_scenarios
  ALTER COLUMN redemption_type DROP DEFAULT,
  ALTER COLUMN cents_per_point DROP DEFAULT,
  ALTER COLUMN effective_from DROP DEFAULT;

DO $$ BEGIN
  ALTER TABLE redemption_scenarios
    ADD CONSTRAINT redemption_scenarios_cents_per_point_positive CHECK (cents_per_point > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;
