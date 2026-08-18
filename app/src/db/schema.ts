import { pgEnum, pgTable, uuid, text, timestamp, date, jsonb, integer, numeric, unique } from 'drizzle-orm/pg-core'

export const dataLeadStatusEnum = pgEnum('data_lead_status', [
  'pending',
  'approved',
  'rejected',
])

export const evidenceStatusEnum = pgEnum('evidence_status', [
  'officially-documented',
  'statement-verified',
  'inferred',
  'community-reported',
])

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verificationRecords = pgTable('verification_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull().references(() => sources.id),
  evidenceStatus: evidenceStatusEnum('evidence_status').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    issuer: text('issuer').notNull(),
    network: text('network').notNull(),
    rewardCurrency: text('reward_currency').notNull(),
    annualFeeCents: integer('annual_fee_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({ issuerName: unique('cards_issuer_name_key').on(t.issuer, t.name) })
)

export const ruleVersions = pgTable('rule_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  verificationRecordId: uuid('verification_record_id').notNull().references(() => verificationRecords.id),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  ruleData: jsonb('rule_data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const redemptionScenarios = pgTable('redemption_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  name: text('name').notNull(),
  description: text('description'),
  redemptionType: text('redemption_type').notNull(),
  applicableCategories: jsonb('applicable_categories').notNull().default([]),
  centsPerPoint: numeric('cents_per_point', { precision: 10, scale: 4 }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const inviteCodes = pgTable('invite_codes', {
  code: text('code').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const dataLeads = pgTable('data_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  proposedRuleData: jsonb('proposed_rule_data').notNull(),
  sourceUrl: text('source_url').notNull(),
  status: dataLeadStatusEnum('status').notNull().default('pending'),
  verificationRecordId: uuid('verification_record_id').references(() => verificationRecords.id),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
