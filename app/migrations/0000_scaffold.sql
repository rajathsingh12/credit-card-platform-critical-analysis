-- Scaffold migration: verifies that the migration runner and database connection work.
-- Domain tables (cards, rule_versions, verification_records, sources, redemption_scenarios)
-- are added in the next migration (issue 04 — Core domain schema).
DO $$ BEGIN
  RAISE NOTICE 'Schema scaffold initialised.';
END $$;
