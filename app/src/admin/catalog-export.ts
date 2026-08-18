import type { Pool } from 'pg'
import { toIsoDate } from '../catalog/db-mapping'

export type CatalogRuleVersion = {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  evidenceStatus: string
  ruleData: unknown
}

export type CatalogRedemptionScenario = {
  id: string
  name: string
  description: string | null
  redemptionType: string
  applicableCategories: string[]
  centsPerPoint: number
  effectiveFrom: string
  effectiveTo: string | null
}

export type CatalogCard = {
  id: string
  name: string
  issuer: string
  network: string
  rewardCurrency: string
  annualFeeCents: number | null
  ruleVersions: CatalogRuleVersion[]
  redemptionScenarios: CatalogRedemptionScenario[]
}

export type CatalogExport = {
  catalogVersion: string
  exportedAt: string
  cards: CatalogCard[]
}

export type RvRow = {
  card_id: string
  card_name: string
  card_issuer: string
  card_network: string
  reward_currency: string
  annual_fee_cents: number | null
  rv_id: string
  rv_effective_from: string | Date
  rv_effective_to: string | Date | null
  rv_rule_data: unknown
  evidence_status: string
}

export type RsRow = {
  id: string
  card_id: string
  name: string
  description: string | null
  redemption_type: string
  applicable_categories: string[]
  cents_per_point: string | number
  effective_from: string | Date
  effective_to: string | Date | null
}

export function catalogVersionLabel(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function assembleCatalog(rvRows: RvRow[], rsRows: RsRow[], now: Date): CatalogExport {
  const cardMap = new Map<string, CatalogCard>()

  for (const row of rvRows) {
    if (!cardMap.has(row.card_id)) {
      cardMap.set(row.card_id, {
        id: row.card_id,
        name: row.card_name,
        issuer: row.card_issuer,
        network: row.card_network,
        rewardCurrency: row.reward_currency,
        annualFeeCents: row.annual_fee_cents,
        ruleVersions: [],
        redemptionScenarios: [],
      })
    }
    // card was inserted in the if-block above, so the get is always defined
    cardMap.get(row.card_id)!.ruleVersions.push({
      id: row.rv_id,
      effectiveFrom: toIsoDate(row.rv_effective_from),
      effectiveTo: row.rv_effective_to === null ? null : toIsoDate(row.rv_effective_to),
      evidenceStatus: row.evidence_status,
      ruleData: row.rv_rule_data,
    })
  }

  for (const row of rsRows) {
    const card = cardMap.get(row.card_id)
    if (!card) continue
    card.redemptionScenarios.push({
      id: row.id,
      name: row.name,
      description: row.description,
      redemptionType: row.redemption_type,
      applicableCategories: row.applicable_categories,
      centsPerPoint: Number(row.cents_per_point),
      effectiveFrom: toIsoDate(row.effective_from),
      effectiveTo: row.effective_to === null ? null : toIsoDate(row.effective_to),
    })
  }

  return {
    catalogVersion: catalogVersionLabel(now),
    exportedAt: now.toISOString(),
    cards: Array.from(cardMap.values()),
  }
}

export async function exportCatalog(pool: Pool, now: Date): Promise<CatalogExport> {
  const rvRes = await pool.query<RvRow>(`
    SELECT
      c.id               AS card_id,
      c.name             AS card_name,
      c.issuer           AS card_issuer,
      c.network          AS card_network,
      c.reward_currency,
      c.annual_fee_cents,
      rv.id              AS rv_id,
      rv.effective_from  AS rv_effective_from,
      rv.effective_to    AS rv_effective_to,
      rv.rule_data       AS rv_rule_data,
      vr.evidence_status
    FROM rule_versions rv
    INNER JOIN cards c ON c.id = rv.card_id
    LEFT JOIN verification_records vr ON vr.id = rv.verification_record_id
    WHERE rv.retracted_at IS NULL
    ORDER BY c.issuer, c.name, rv.effective_from
  `)

  if (rvRes.rows.length === 0) {
    return { catalogVersion: catalogVersionLabel(now), exportedAt: now.toISOString(), cards: [] }
  }

  const cardIds = [...new Set(rvRes.rows.map(r => r.card_id))]

  const rsRes = await pool.query<RsRow>(`
    SELECT
      id,
      card_id,
      name,
      description,
      redemption_type,
      applicable_categories,
      cents_per_point,
      effective_from,
      effective_to
    FROM redemption_scenarios
    WHERE card_id = ANY($1)
    ORDER BY effective_from
  `, [cardIds])

  return assembleCatalog(rvRes.rows, rsRes.rows, now)
}
