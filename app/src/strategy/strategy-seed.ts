import type { EvidenceStatus } from '../catalog/evidence'
import type { RouteFactRuleData } from '../strategy/route-fact'

/**
 * Curated Payment Strategy seed, drawn from
 * `.scratch/payment-strategy/research/01-voucher-facts.md` (gathered 2026-09-30).
 *
 * Only the wallet/stored-value exclusion is publishable: issuer documents say the
 * load earns nothing, and no monthly cap governs an exclusion. Every portal
 * multiplier and earn rate in that file is secondary or undocumented, so it is a
 * Data Lead. Any route a monthly cap governs is capped, and a capped route is not
 * seeded at all until its cap is modelled.
 */

export const STRATEGY_VERIFIED_AT = '2026-09-30'

/** The category a wallet/stored-value load (MCC 6540) codes as. */
export const WALLET_LOAD = 'wallet-load'

export type StrategySeedCard = {
  issuer: string
  name: string
}

export type RouteSeed = {
  id: string
  /** The one card the route applies to. */
  card: StrategySeedCard
  evidenceStatus: EvidenceStatus
  sourceName: string
  sourceUrl: string
  /** The date the cited source supports the fact. */
  sourceDate: string
  ruleData: RouteFactRuleData
}

const walletExclusion = (): RouteFactRuleData => ({
  ruleType: 'route-fact',
  effectiveMerchantCategory: WALLET_LOAD,
  exclusions: [WALLET_LOAD],
  pointsPerDollar: 0,
  capPoints: null,
  voucherFeeCents: 0,
  capGoverned: false,
})

/** Publishable. Issuer-documented, uncapped, and the leg earns zero. */
export const PUBLISHABLE_ROUTES: RouteSeed[] = [
  {
    id: 'wallet-exclusion-hdfc-infinia',
    card: { issuer: 'HDFC Bank', name: 'Infinia Metal' },
    evidenceStatus: 'officially-documented',
    sourceName: 'HDFC Infinia Reward Points Program T&C — e-wallet loading earns no reward points',
    sourceUrl: 'https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/',
    sourceDate: '2026-09-30',
    ruleData: walletExclusion(),
  },
  {
    id: 'wallet-exclusion-hdfc-diners-black',
    card: { issuer: 'HDFC Bank', name: 'Diners Club Black Metal' },
    evidenceStatus: 'officially-documented',
    sourceName: 'HDFC SMS communication, 2024-09-01 loyalty revision — wallet loading earns no reward points',
    sourceUrl: 'https://v.hdfcbank.com/htdocs/common/sms-communication-sept.html',
    sourceDate: '2024-09-01',
    ruleData: walletExclusion(),
  },
  {
    id: 'wallet-exclusion-axis-magnus',
    card: { issuer: 'Axis Bank', name: 'Magnus' },
    evidenceStatus: 'officially-documented',
    sourceName: 'Axis Bank Magnus More Benefits — wallet transactions (MCC 6540) are not counted',
    sourceUrl: 'https://a22112017.axisbank.com/retail/cards/credit-card/axis-bank-magnus-card/more-benefits',
    sourceDate: '2026-09-30',
    ruleData: walletExclusion(),
  },
]

/**
 * Not publishable. The research backs these with secondary or community sources,
 * so they stay Data Leads and never become a Rule Version.
 *
 * Axis Atlas's wallet exclusion is issuer-documented, but the card itself is
 * withheld (its base rate is only inferred), and a route fact cannot publish for
 * a card that has no published rule. It stays a lead until the card clears the gate.
 */
export const DATA_LEAD_ROUTES: RouteSeed[] = [
  {
    id: 'wallet-exclusion-axis-atlas',
    card: { issuer: 'Axis Bank', name: 'Atlas' },
    evidenceStatus: 'officially-documented',
    sourceName: 'Axis Bank Atlas terms and conditions — wallet loads earn no EDGE Miles',
    sourceUrl: 'https://www.axisbank.com/docs/default-source/default-document-library/credit-cards/terms-and-conditions-atlas-credit-card.pdf',
    sourceDate: '2026-09-30',
    ruleData: walletExclusion(),
  },
  {
    id: 'wallet-exclusion-axis-reserve',
    card: { issuer: 'Axis Bank', name: 'Reserve' },
    evidenceStatus: 'community-reported',
    sourceName: 'GyFTR GIFT EDGE page reporting Axis Reserve wallet reloads earn nothing — Reserve T&C not located',
    sourceUrl: 'https://www.gyftr.com/edgerewards',
    sourceDate: '2026-06-08',
    ruleData: walletExclusion(),
  },
  {
    id: 'wallet-exclusion-icici-emeralde',
    card: { issuer: 'ICICI Bank', name: 'Emeralde Private Metal' },
    evidenceStatus: 'inferred',
    sourceName: 'Angel One and Economic Times quoting ICICI — Emeralde MITC unparsed, so the exclusion is not issuer-documented',
    sourceUrl: 'https://www.icicibank.com/personal-banking/cards/consumer-cards/debit-card/new-reward-points-structure',
    sourceDate: '2026-01-15',
    ruleData: walletExclusion(),
  },
]

export const ALL_STRATEGY_ROUTES: RouteSeed[] = [...PUBLISHABLE_ROUTES, ...DATA_LEAD_ROUTES]

/**
 * Capped, so not seeded at all. HDFC SmartBuy brand vouchers carry a 3,000
 * RP/month cap from 2026-07-01 and the Swiggy earn rate is unverified; ICICI
 * iShop is capped at ₹20,000/month. Neither has a complete citable source. A
 * capped route present before its cap is modelled prices as Unresolved — the
 * seed check builds one to show that, rather than publishing it.
 */
export const CAPPED_ROUTES_WITHHELD = ['hdfc-smartbuy-brand-voucher', 'icici-ishop-voucher'] as const
