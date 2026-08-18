import type { RewardRuleData, RuleVersion, RedemptionScenario } from '../engine/types'
import type { EvidenceStatus, RewardCurrency } from './evidence'

// Money is in the minor unit (paise). `pointsPerDollar` is points per major unit (rupee),
// so a cash-back card states its percentage directly: 1.5 = 1.5% back, earned as paise.
export const SEED_VERIFIED_AT = '2025-01-01'
export const SEED_EFFECTIVE_FROM = '2025-01-01'

export type SeedRedemption = {
  name: string
  description: string
  redemptionType: string
  applicableCategories: string[]
  centsPerPoint: number
  effectiveFrom: string
  effectiveTo: string | null
}

export type SeedCard = {
  name: string
  issuer: string
  network: string
  rewardCurrency: RewardCurrency
  annualFeeCents: number | null
  evidenceStatus: EvidenceStatus
  sourceName: string
  sourceUrl: string
  ruleData: RewardRuleData
  redemptions: SeedRedemption[]
}

function redemption(
  redemptionType: string,
  name: string,
  description: string,
  centsPerPoint: number,
  applicableCategories: string[] = []
): SeedRedemption {
  return {
    name,
    description,
    redemptionType,
    applicableCategories,
    centsPerPoint,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    effectiveTo: null,
  }
}

function portalAndCatalogue(portalValue: number, catalogueValue: number): SeedRedemption[] {
  return [
    redemption(
      'travel-portal',
      'Travel portal booking',
      'Points redeemed against flight and hotel bookings on the issuer travel portal.',
      portalValue
    ),
    redemption(
      'catalogue',
      'Rewards catalogue',
      'Points redeemed against merchandise and vouchers in the issuer rewards catalogue.',
      catalogueValue
    ),
  ]
}

function airlineTransfer(value: number): SeedRedemption[] {
  return [
    redemption(
      'airline-transfer',
      'Airline programme transfer',
      'Points transferred to the co-brand airline loyalty programme and redeemed for award travel.',
      value
    ),
  ]
}

function membershipRewards(travelValue: number, statementValue: number): SeedRedemption[] {
  return [
    redemption(
      'membership-rewards-travel',
      'Membership Rewards travel',
      'Membership Rewards points redeemed for travel through American Express Travel.',
      travelValue,
      ['travel']
    ),
    redemption(
      'membership-rewards-statement',
      'Membership Rewards statement credit',
      'Membership Rewards points redeemed as a statement credit.',
      statementValue
    ),
  ]
}

const BASE_EXCLUSIONS = ['fuel', 'wallet-load', 'rent']

/**
 * Each card publishes one Rule Version stating its base earn rate, because the Publication
 * Gate keeps a single active version per card. Category bonuses are deliberately not modelled:
 * publishing a bonus-only rule would report zero on ordinary spend.
 */
export const VERIFIED_CARD_SET: SeedCard[] = [
  // HDFC Bank
  {
    name: 'Regalia Gold',
    issuer: 'HDFC Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 250000,
    evidenceStatus: 'officially-documented',
    sourceName: 'HDFC Bank Regalia Gold product terms and conditions',
    sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.026667,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(50, 20),
  },
  {
    name: 'Infinia Metal',
    issuer: 'HDFC Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 1250000,
    evidenceStatus: 'officially-documented',
    sourceName: 'HDFC Bank Infinia Metal Edition key features and fees',
    sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-metal',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.033333,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(100, 30),
  },
  {
    name: 'Diners Club Black Metal',
    issuer: 'HDFC Bank',
    network: 'Diners Club',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 1000000,
    evidenceStatus: 'officially-documented',
    sourceName: 'HDFC Bank Diners Club Black Metal terms and conditions',
    sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-club-black-metal',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.033333,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(100, 30),
  },
  {
    name: 'Millennia',
    issuer: 'HDFC Bank',
    network: 'Mastercard',
    rewardCurrency: 'cash-back',
    annualFeeCents: 100000,
    evidenceStatus: 'officially-documented',
    sourceName: 'HDFC Bank Millennia cashback terms',
    sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 1,
      capPoints: null,
    },
    redemptions: [],
  },
  {
    name: 'MoneyBack+',
    issuer: 'HDFC Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 50000,
    evidenceStatus: 'officially-documented',
    sourceName: 'HDFC Bank MoneyBack+ reward point terms',
    sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/moneyback-plus',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: 2000,
    },
    redemptions: portalAndCatalogue(25, 20),
  },
  {
    name: 'Freedom',
    issuer: 'HDFC Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 50000,
    evidenceStatus: 'statement-verified',
    sourceName: 'HDFC Bank Freedom rewards summary, confirmed against cardholder statements',
    sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/freedom-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.01,
      capPoints: 1000,
    },
    redemptions: portalAndCatalogue(25, 15),
  },

  // Axis Bank
  {
    name: 'Magnus',
    issuer: 'Axis Bank',
    network: 'Mastercard',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 1250000,
    evidenceStatus: 'officially-documented',
    sourceName: 'Axis Bank Magnus most important terms and conditions',
    sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/magnus-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'government', 'insurance'],
      pointsPerDollar: 0.06,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(20, 20),
  },
  {
    name: 'Reserve',
    issuer: 'Axis Bank',
    network: 'Mastercard',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 5000000,
    evidenceStatus: 'officially-documented',
    sourceName: 'Axis Bank Reserve most important terms and conditions',
    sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/reserve-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'government', 'insurance'],
      pointsPerDollar: 0.075,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(20, 20),
  },
  {
    name: 'ACE',
    issuer: 'Axis Bank',
    network: 'Visa',
    rewardCurrency: 'cash-back',
    annualFeeCents: 49900,
    evidenceStatus: 'officially-documented',
    sourceName: 'Axis Bank ACE cashback terms and conditions',
    sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/ace-credit-card',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 1.5,
      capPoints: null,
    },
    redemptions: [],
  },
  {
    name: 'Vistara Infinite',
    issuer: 'Axis Bank',
    network: 'Visa',
    rewardCurrency: 'airline-miles',
    annualFeeCents: 1000000,
    evidenceStatus: 'officially-documented',
    sourceName: 'Axis Bank Vistara Infinite co-brand terms',
    sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/vistara-infinite-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.03,
      capPoints: null,
    },
    redemptions: airlineTransfer(60),
  },
  {
    name: 'Neo',
    issuer: 'Axis Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 25000,
    evidenceStatus: 'statement-verified',
    sourceName: 'Axis Bank Neo rewards summary, confirmed against cardholder statements',
    sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/neo-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.01,
      capPoints: 500,
    },
    redemptions: portalAndCatalogue(20, 15),
  },
  {
    name: 'Select',
    issuer: 'Axis Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 300000,
    evidenceStatus: 'officially-documented',
    sourceName: 'Axis Bank Select most important terms and conditions',
    sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/select-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.05,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(20, 20),
  },

  // ICICI Bank
  {
    name: 'Emeralde Private Metal',
    issuer: 'ICICI Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 1250000,
    evidenceStatus: 'officially-documented',
    sourceName: 'ICICI Bank Emeralde Private Metal features and fees',
    sourceUrl: 'https://www.icicibank.com/personal-banking/cards/credit-card/emeralde-private-metal-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'government'],
      pointsPerDollar: 0.06,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(100, 40),
  },
  {
    name: 'Sapphiro',
    issuer: 'ICICI Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 650000,
    evidenceStatus: 'officially-documented',
    sourceName: 'ICICI Bank Sapphiro features and fees',
    sourceUrl: 'https://www.icicibank.com/personal-banking/cards/credit-card/sapphiro-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'Amazon Pay',
    issuer: 'ICICI Bank',
    network: 'Visa',
    rewardCurrency: 'cash-back',
    annualFeeCents: null,
    evidenceStatus: 'officially-documented',
    sourceName: 'ICICI Bank Amazon Pay cashback terms',
    sourceUrl: 'https://www.icicibank.com/personal-banking/cards/credit-card/amazon-pay-credit-card',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 1,
      capPoints: null,
    },
    redemptions: [],
  },
  {
    name: 'Coral',
    issuer: 'ICICI Bank',
    network: 'Mastercard',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 50000,
    evidenceStatus: 'officially-documented',
    sourceName: 'ICICI Bank Coral features and fees',
    sourceUrl: 'https://www.icicibank.com/personal-banking/cards/credit-card/coral-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: 1000,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'Rubyx',
    issuer: 'ICICI Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 300000,
    evidenceStatus: 'statement-verified',
    sourceName: 'ICICI Bank Rubyx rewards summary, confirmed against cardholder statements',
    sourceUrl: 'https://www.icicibank.com/personal-banking/cards/credit-card/rubyx-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 25),
  },

  // SBI Card
  {
    name: 'ELITE',
    issuer: 'SBI Card',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 499900,
    evidenceStatus: 'officially-documented',
    sourceName: 'SBI Card ELITE most important terms and conditions',
    sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/travel-and-shopping/sbi-card-elite.page',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'PRIME',
    issuer: 'SBI Card',
    network: 'Mastercard',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 299900,
    evidenceStatus: 'officially-documented',
    sourceName: 'SBI Card PRIME most important terms and conditions',
    sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/rewards/sbi-card-prime.page',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'Cashback',
    issuer: 'SBI Card',
    network: 'Visa',
    rewardCurrency: 'cash-back',
    annualFeeCents: 99900,
    evidenceStatus: 'officially-documented',
    sourceName: 'Cashback SBI Card cashback terms and conditions',
    sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/shopping/cashback-sbi-card.page',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'insurance', 'utilities'],
      pointsPerDollar: 1,
      capPoints: null,
    },
    redemptions: [],
  },
  {
    name: 'SimplyCLICK',
    issuer: 'SBI Card',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 49900,
    evidenceStatus: 'officially-documented',
    sourceName: 'SBI Card SimplyCLICK most important terms and conditions',
    sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/shopping/simplyclick-sbi-card.page',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.01,
      capPoints: 1000,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'Air India Signature',
    issuer: 'SBI Card',
    network: 'Visa',
    rewardCurrency: 'airline-miles',
    annualFeeCents: 499900,
    evidenceStatus: 'officially-documented',
    sourceName: 'Air India SBI Signature Card co-brand terms',
    sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/travel/air-india-sbi-signature-card.page',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.04,
      capPoints: null,
    },
    redemptions: airlineTransfer(50),
  },
  {
    name: 'Pulse',
    issuer: 'SBI Card',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 149900,
    evidenceStatus: 'statement-verified',
    sourceName: 'SBI Card Pulse rewards summary, confirmed against cardholder statements',
    sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/lifestyle/sbi-card-pulse.page',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 25),
  },

  // IDFC First Bank
  {
    name: 'FIRST Wealth',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: null,
    evidenceStatus: 'officially-documented',
    sourceName: 'IDFC FIRST Wealth credit card fees and rewards',
    sourceUrl: 'https://www.idfcfirstbank.com/credit-card/wealth',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'insurance'],
      pointsPerDollar: 0.03,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'FIRST Select',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: null,
    evidenceStatus: 'officially-documented',
    sourceName: 'IDFC FIRST Select credit card fees and rewards',
    sourceUrl: 'https://www.idfcfirstbank.com/credit-card/select',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'insurance'],
      pointsPerDollar: 0.03,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'FIRST Millennia',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: null,
    evidenceStatus: 'officially-documented',
    sourceName: 'IDFC FIRST Millennia credit card fees and rewards',
    sourceUrl: 'https://www.idfcfirstbank.com/credit-card/millennia',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'insurance'],
      pointsPerDollar: 0.03,
      capPoints: 2000,
    },
    redemptions: portalAndCatalogue(25, 25),
  },
  {
    name: 'FIRST Club Vistara',
    issuer: 'IDFC First Bank',
    network: 'Visa',
    rewardCurrency: 'airline-miles',
    annualFeeCents: 299900,
    evidenceStatus: 'statement-verified',
    sourceName: 'IDFC FIRST Club Vistara rewards summary, confirmed against cardholder statements',
    sourceUrl: 'https://www.idfcfirstbank.com/credit-card/club-vistara',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.03,
      capPoints: null,
    },
    redemptions: airlineTransfer(60),
  },

  // IndusInd Bank
  {
    name: 'Legend',
    issuer: 'IndusInd Bank',
    network: 'Mastercard',
    rewardCurrency: 'issuer-points',
    annualFeeCents: null,
    evidenceStatus: 'officially-documented',
    sourceName: 'IndusInd Bank Legend credit card key features',
    sourceUrl: 'https://www.indusind.com/in/en/personal/cards/credit-card/legend-credit-card.html',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.01,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 20),
  },
  {
    name: 'Pinnacle',
    issuer: 'IndusInd Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 1200000,
    evidenceStatus: 'officially-documented',
    sourceName: 'IndusInd Bank Pinnacle credit card key features',
    sourceUrl: 'https://www.indusind.com/in/en/personal/cards/credit-card/pinnacle-credit-card.html',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.025,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 20),
  },
  {
    name: 'Platinum RuPay',
    issuer: 'IndusInd Bank',
    network: 'RuPay',
    rewardCurrency: 'issuer-points',
    annualFeeCents: null,
    evidenceStatus: 'statement-verified',
    sourceName: 'IndusInd Bank Platinum RuPay rewards summary, confirmed against cardholder statements',
    sourceUrl: 'https://www.indusind.com/in/en/personal/cards/credit-card/platinum-rupay-credit-card.html',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 0.01,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 20),
  },

  // American Express
  {
    name: 'Membership Rewards Credit Card',
    issuer: 'American Express',
    network: 'American Express',
    rewardCurrency: 'membership-rewards',
    annualFeeCents: 449900,
    evidenceStatus: 'officially-documented',
    sourceName: 'American Express Membership Rewards Credit Card terms and conditions',
    sourceUrl: 'https://www.americanexpress.com/in/credit-cards/membership-rewards-credit-card/',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'insurance', 'utilities'],
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: membershipRewards(50, 25),
  },
  {
    name: 'Platinum Travel Credit Card',
    issuer: 'American Express',
    network: 'American Express',
    rewardCurrency: 'membership-rewards',
    annualFeeCents: 600000,
    evidenceStatus: 'officially-documented',
    sourceName: 'American Express Platinum Travel Credit Card terms and conditions',
    sourceUrl: 'https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'insurance', 'utilities'],
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: membershipRewards(50, 25),
  },
  {
    name: 'SmartEarn Credit Card',
    issuer: 'American Express',
    network: 'American Express',
    rewardCurrency: 'membership-rewards',
    annualFeeCents: 49500,
    evidenceStatus: 'officially-documented',
    sourceName: 'American Express SmartEarn Credit Card terms and conditions',
    sourceUrl: 'https://www.americanexpress.com/in/credit-cards/smart-earn-credit-card/',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: [...BASE_EXCLUSIONS, 'insurance', 'utilities'],
      pointsPerDollar: 0.02,
      capPoints: 500,
    },
    redemptions: membershipRewards(50, 25),
  },

  // Standard Chartered
  {
    name: 'Smart',
    issuer: 'Standard Chartered',
    network: 'Visa',
    rewardCurrency: 'cash-back',
    annualFeeCents: 49900,
    evidenceStatus: 'officially-documented',
    sourceName: 'Standard Chartered Smart Credit Card key facts statement',
    sourceUrl: 'https://www.sc.com/in/credit-cards/smart-credit-card/',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 1,
      capPoints: null,
    },
    redemptions: [],
  },
  {
    name: 'Ultimate',
    issuer: 'Standard Chartered',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 500000,
    evidenceStatus: 'officially-documented',
    sourceName: 'Standard Chartered Ultimate Credit Card key facts statement',
    sourceUrl: 'https://www.sc.com/in/credit-cards/ultimate-credit-card/',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.05,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(100, 30),
  },
  {
    name: 'EaseMyTrip',
    issuer: 'Standard Chartered',
    network: 'Visa',
    rewardCurrency: 'cash-back',
    annualFeeCents: 35000,
    evidenceStatus: 'officially-documented',
    sourceName: 'Standard Chartered EaseMyTrip Credit Card key facts statement',
    sourceUrl: 'https://www.sc.com/in/credit-cards/easemytrip-credit-card/',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 1,
      capPoints: null,
    },
    redemptions: [],
  },
]

/**
 * Cards whose evidence does not meet the standard in ADR 0003. They are seeded as pending
 * Data Leads so the Data Steward can see them, and they never reach the Verified Card Set.
 */
export const WITHHELD_CARD_SET: SeedCard[] = [
  {
    name: 'Swiggy',
    issuer: 'HDFC Bank',
    network: 'Mastercard',
    rewardCurrency: 'cash-back',
    annualFeeCents: 50000,
    evidenceStatus: 'inferred',
    sourceName: 'Base rate inferred from HDFC Bank Swiggy card general terms; not stated explicitly',
    sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-bank-credit-card',
    ruleData: {
      ruleType: 'direct',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 1,
      capPoints: null,
    },
    redemptions: [],
  },
  {
    name: 'Atlas',
    issuer: 'Axis Bank',
    network: 'Visa',
    rewardCurrency: 'airline-miles',
    annualFeeCents: 500000,
    evidenceStatus: 'inferred',
    sourceName: 'Base EDGE Mile rate inferred from Axis Bank Atlas tier terms; not stated explicitly',
    sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/atlas-credit-card',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: airlineTransfer(100),
  },
  {
    name: 'Tiger',
    issuer: 'IndusInd Bank',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: null,
    evidenceStatus: 'community-reported',
    sourceName: 'Community forum thread reporting IndusInd Tiger earn rates',
    sourceUrl: 'https://www.technofino.in/community/threads/indusind-tiger-credit-card.1/',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.015,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 20),
  },
  {
    name: 'Rewards',
    issuer: 'Standard Chartered',
    network: 'Visa',
    rewardCurrency: 'issuer-points',
    annualFeeCents: 100000,
    evidenceStatus: 'community-reported',
    sourceName: 'Community blog post reporting Standard Chartered Rewards earn rates',
    sourceUrl: 'https://www.cardexpert.in/standard-chartered-rewards-credit-card-review/',
    ruleData: {
      ruleType: 'variable',
      categories: [],
      exclusions: BASE_EXCLUSIONS,
      pointsPerDollar: 0.02,
      capPoints: null,
    },
    redemptions: portalAndCatalogue(25, 20),
  },
]

export const ALL_SEED_CARDS: SeedCard[] = [...VERIFIED_CARD_SET, ...WITHHELD_CARD_SET]

export function cardKey(spec: SeedCard): string {
  return `${spec.issuer}::${spec.name}`
}

export function findSeedCard(issuer: string, name: string): SeedCard {
  const spec = ALL_SEED_CARDS.find(c => c.issuer === issuer && c.name === name)
  if (!spec) throw new Error(`no seed card for ${issuer} ${name}`)
  return spec
}

export function toRuleVersion(spec: SeedCard): RuleVersion {
  return {
    id: `rv::${cardKey(spec)}`,
    cardId: cardKey(spec),
    effectiveFrom: SEED_EFFECTIVE_FROM,
    effectiveTo: null,
    ruleData: spec.ruleData,
  }
}

// The annual fee lives on the card, so it is joined onto every scenario the engine sees.
export function toRedemptionScenarios(spec: SeedCard): RedemptionScenario[] {
  return spec.redemptions.map(r => ({
    id: `rs::${cardKey(spec)}::${r.redemptionType}`,
    cardId: cardKey(spec),
    redemptionType: r.redemptionType,
    applicableCategories: r.applicableCategories,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    centsPerPoint: r.centsPerPoint,
    annualFeeCents: spec.annualFeeCents,
  }))
}
