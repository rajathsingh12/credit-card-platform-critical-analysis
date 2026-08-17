import { pgEnum, pgTable, uuid, text, timestamp, date, jsonb } from 'drizzle-orm/pg-core'

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

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  issuer: text('issuer').notNull(),
  network: text('network').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
