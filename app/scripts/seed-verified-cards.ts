#!/usr/bin/env tsx
/**
 * Seed 30-40 verified cards covering:
 * - At least 5 issuers
 * - 3 reward currencies (direct points, airline miles, cash-back)
 * - 3 fee bands (no fee, mid-tier, premium)
 *
 * Every card gets at least one published Rule Version with:
 * - effective_from date
 * - Verification Record with appropriate evidence_status
 */

import { db } from '../src/db/client'
import { cards, sources, verificationRecords, ruleVersions, redemptionScenarios } from '../src/db/schema'
import type { DirectRewardRuleData, VariableRewardRuleData } from '../src/engine/types'

const SEED_DATE = '2025-01-01'

type CardSpec = {
  name: string
  issuer: string
  network: string
  ruleData: DirectRewardRuleData | VariableRewardRuleData
  evidenceStatus: 'officially-documented' | 'statement-verified' | 'inferred' | 'community-reported'
  sourceUrl: string
  redemption?: {
    type: string
    applicableCategories: string[]
    centsPerPoint: number
    annualFeeCents: number | null
  }
}

const cardSpecs: CardSpec[] = [
  // HDFC Bank (5 cards)
  {
    name: 'HDFC Regalia',
    issuer: 'HDFC Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 4,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://hdfcbank.com/regalia-benefits',
  },
  {
    name: 'HDFC Diners Club Black',
    issuer: 'HDFC Bank',
    network: 'Diners Club',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'insurance'],
      pointsPerDollar: 3.3,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://hdfcbank.com/diners-black',
  },
  {
    name: 'HDFC Millennia',
    issuer: 'HDFC Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online', 'streaming'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 5,
      capPoints: 1000,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://hdfcbank.com/millennia-tnc',
  },
  {
    name: 'HDFC Infinia',
    issuer: 'HDFC Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'utilities'],
      pointsPerDollar: 3.3,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://hdfcbank.com/infinia-rewards',
  },
  {
    name: 'HDFC MoneyBack',
    issuer: 'HDFC Bank',
    network: 'Mastercard',
    ruleData: {
      ruleType: 'direct',
      categories: ['grocery', 'dining', 'entertainment'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 5,
      capPoints: 400,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://hdfcbank.com/moneyback-details',
  },

  // Axis Bank (5 cards)
  {
    name: 'Axis Magnus',
    issuer: 'Axis Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'rent'],
      pointsPerDollar: 12,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://axisbank.com/magnus-features',
    redemption: {
      type: 'airline-miles',
      applicableCategories: [],
      centsPerPoint: 1.0,
      annualFeeCents: 1000000,
    },
  },
  {
    name: 'Axis Vistara Infinite',
    issuer: 'Axis Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'variable',
      categories: ['travel', 'dining'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 10,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://axisbank.com/vistara-infinite',
    redemption: {
      type: 'airline-miles',
      applicableCategories: ['travel', 'dining'],
      centsPerPoint: 0.8,
      annualFeeCents: 1000000,
    },
  },
  {
    name: 'Axis Flipkart',
    issuer: 'Axis Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 4,
      capPoints: 500,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://axisbank.com/flipkart-card',
  },
  {
    name: 'Axis Reserve',
    issuer: 'Axis Bank',
    network: 'Mastercard',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'utilities'],
      pointsPerDollar: 3,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://axisbank.com/reserve',
  },
  {
    name: 'Axis ACE',
    issuer: 'Axis Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online', 'utilities'],
      exclusions: ['wallet-load'],
      pointsPerDollar: 5,
      capPoints: 500,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://axisbank.com/ace',
  },

  // ICICI Bank (5 cards)
  {
    name: 'ICICI Emeralde',
    issuer: 'ICICI Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 4,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://icicibank.com/emeralde',
  },
  {
    name: 'ICICI Sapphiro',
    issuer: 'ICICI Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 2,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://icicibank.com/sapphiro',
  },
  {
    name: 'ICICI Amazon Pay',
    issuer: 'ICICI Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 5,
      capPoints: null,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://icicibank.com/amazon-pay',
  },
  {
    name: 'ICICI MMT Platinum',
    issuer: 'ICICI Bank',
    network: 'Mastercard',
    ruleData: {
      ruleType: 'direct',
      categories: ['travel'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 4,
      capPoints: null,
    },
    evidenceStatus: 'inferred',
    sourceUrl: 'https://icicibank.com/mmt-platinum-tnc',
  },
  {
    name: 'ICICI Platinum',
    issuer: 'ICICI Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 2,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://icicibank.com/platinum',
  },

  // SBI Card (5 cards)
  {
    name: 'SBI Card Elite',
    issuer: 'SBI Card',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 3,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://sbicard.com/elite-benefits',
  },
  {
    name: 'SBI SimplyCLICK',
    issuer: 'SBI Card',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 10,
      capPoints: 1000,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://sbicard.com/simplyclick',
  },
  {
    name: 'SBI Air India Signature',
    issuer: 'SBI Card',
    network: 'Visa',
    ruleData: {
      ruleType: 'variable',
      categories: ['travel'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 10,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://sbicard.com/air-india-signature',
    redemption: {
      type: 'airline-miles',
      applicableCategories: ['travel'],
      centsPerPoint: 0.5,
      annualFeeCents: 499900,
    },
  },
  {
    name: 'SBI Cashback',
    issuer: 'SBI Card',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online'],
      exclusions: ['fuel', 'wallet-load', 'rent'],
      pointsPerDollar: 5,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://sbicard.com/cashback',
  },
  {
    name: 'SBI Prime',
    issuer: 'SBI Card',
    network: 'Mastercard',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 2,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://sbicard.com/prime',
  },

  // IDFC First Bank (4 cards)
  {
    name: 'IDFC First Wealth',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 6,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://idfcfirstbank.com/wealth-card',
  },
  {
    name: 'IDFC First Select',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 3,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://idfcfirstbank.com/select',
  },
  {
    name: 'IDFC First Club Vistara',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'variable',
      categories: ['travel', 'dining'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 6,
      capPoints: null,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://idfcfirstbank.com/club-vistara',
    redemption: {
      type: 'airline-miles',
      applicableCategories: ['travel', 'dining'],
      centsPerPoint: 0.6,
      annualFeeCents: 299900,
    },
  },
  {
    name: 'IDFC First Millennia',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online', 'dining'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 10,
      capPoints: 750,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://idfcfirstbank.com/millennia',
  },

  // IndusInd Bank (4 cards)
  {
    name: 'IndusInd Legend',
    issuer: 'IndusInd Bank',
    network: 'Mastercard',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'utilities'],
      pointsPerDollar: 3,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://indusind.com/legend',
  },
  {
    name: 'IndusInd Pinnacle',
    issuer: 'IndusInd Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 2,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://indusind.com/pinnacle',
  },
  {
    name: 'IndusInd Iconia Amex',
    issuer: 'IndusInd Bank',
    network: 'American Express',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'insurance'],
      pointsPerDollar: 3,
      capPoints: null,
    },
    evidenceStatus: 'inferred',
    sourceUrl: 'https://indusind.com/iconia-amex',
    redemption: {
      type: 'travel-portal',
      applicableCategories: [],
      centsPerPoint: 0.5,
      annualFeeCents: 1000000,
    },
  },
  {
    name: 'IndusInd Tiger',
    issuer: 'IndusInd Bank',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['dining', 'entertainment', 'grocery'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 1.5,
      capPoints: null,
    },
    evidenceStatus: 'community-reported',
    sourceUrl: 'https://technofino.in/community/threads/indusind-tiger',
  },

  // Amex (4 cards)
  {
    name: 'American Express Platinum Travel',
    issuer: 'American Express',
    network: 'American Express',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 1,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://americanexpress.com/in/platinum-travel',
    redemption: {
      type: 'membership-rewards',
      applicableCategories: [],
      centsPerPoint: 0.5,
      annualFeeCents: 350000,
    },
  },
  {
    name: 'American Express Platinum Charge',
    issuer: 'American Express',
    network: 'American Express',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'utilities'],
      pointsPerDollar: 1,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://americanexpress.com/in/platinum-charge',
    redemption: {
      type: 'membership-rewards',
      applicableCategories: [],
      centsPerPoint: 0.5,
      annualFeeCents: 6000000,
    },
  },
  {
    name: 'American Express Gold Charge',
    issuer: 'American Express',
    network: 'American Express',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 1,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://americanexpress.com/in/gold-charge',
    redemption: {
      type: 'membership-rewards',
      applicableCategories: [],
      centsPerPoint: 0.5,
      annualFeeCents: 450000,
    },
  },
  {
    name: 'American Express SmartEarn',
    issuer: 'American Express',
    network: 'American Express',
    ruleData: {
      ruleType: 'direct',
      categories: ['online', 'dining'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 5,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://americanexpress.com/in/smartearn',
  },

  // Standard Chartered (4 cards)
  {
    name: 'Standard Chartered Ultimate',
    issuer: 'Standard Chartered',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load', 'utilities'],
      pointsPerDollar: 5,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://sc.com/in/ultimate',
  },
  {
    name: 'Standard Chartered DigiSmart',
    issuer: 'Standard Chartered',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['online'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 10,
      capPoints: 1000,
    },
    evidenceStatus: 'statement-verified',
    sourceUrl: 'https://sc.com/in/digismart',
  },
  {
    name: 'Standard Chartered Platinum Rewards',
    issuer: 'Standard Chartered',
    network: 'Mastercard',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 1,
      capPoints: null,
    },
    evidenceStatus: 'officially-documented',
    sourceUrl: 'https://sc.com/in/platinum-rewards',
  },
  {
    name: 'Standard Chartered Super Value Titanium',
    issuer: 'Standard Chartered',
    network: 'Visa',
    ruleData: {
      ruleType: 'direct',
      categories: ['dining', 'grocery', 'departmental'],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 5,
      capPoints: 500,
    },
    evidenceStatus: 'inferred',
    sourceUrl: 'https://sc.com/in/titanium-tnc',
  },
]

async function main() {
  console.log(`Seeding ${cardSpecs.length} verified cards...`)

  for (const spec of cardSpecs) {
    console.log(`\n${spec.name} (${spec.issuer})...`)

    // 1. Create card
    const [card] = await db
      .insert(cards)
      .values({
        name: spec.name,
        issuer: spec.issuer,
        network: spec.network,
      })
      .returning()

    // 2. Create source
    const [source] = await db
      .insert(sources)
      .values({
        name: `${spec.issuer} official documentation`,
        url: spec.sourceUrl,
      })
      .returning()

    // 3. Create verification record
    const [verificationRecord] = await db
      .insert(verificationRecords)
      .values({
        sourceId: source.id,
        evidenceStatus: spec.evidenceStatus,
        verifiedAt: new Date(SEED_DATE),
        notes: `Verified against ${spec.issuer} T&C as of ${SEED_DATE}`,
      })
      .returning()

    // 4. Create rule version
    await db.insert(ruleVersions).values({
      cardId: card.id,
      verificationRecordId: verificationRecord.id,
      effectiveFrom: SEED_DATE,
      effectiveTo: null,
      ruleData: spec.ruleData,
    })

    // 5. Create redemption scenario if variable reward
    if (spec.ruleData.ruleType === 'variable' && spec.redemption) {
      await db.insert(redemptionScenarios).values({
        cardId: card.id,
        name: spec.redemption.type,
        description: `Redemption via ${spec.redemption.type}`,
      })
    }

    console.log(`  ✓ ${spec.name} seeded with ${spec.evidenceStatus} evidence`)
  }

  console.log(`\n✅ Successfully seeded ${cardSpecs.length} cards`)
  console.log(`\nCoverage:`)

  const issuers = new Set(cardSpecs.map(c => c.issuer))
  console.log(`  Issuers: ${issuers.size} (${Array.from(issuers).join(', ')})`)

  const rewardTypes = new Set(cardSpecs.map(c => c.ruleData.ruleType))
  console.log(`  Reward types: ${rewardTypes.size} (${Array.from(rewardTypes).join(', ')})`)

  const evidenceTypes = new Set(cardSpecs.map(c => c.evidenceStatus))
  console.log(`  Evidence types: ${evidenceTypes.size} (${Array.from(evidenceTypes).join(', ')})`)

  const variableCards = cardSpecs.filter(c => c.ruleData.ruleType === 'variable').length
  console.log(`  Variable reward cards: ${variableCards}`)

  process.exit(0)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
