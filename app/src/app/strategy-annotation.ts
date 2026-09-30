import type { ComposedStrategy } from '@/strategy/compose'

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatPaise(paise: number): string {
  const sign = paise < 0 ? '−' : ''
  return `${sign}₹${inr.format(Math.abs(paise) / 100)}`
}

/**
 * What a Payment Strategy annotation says. A resolved route shows its Reward
 * Value; an Unresolved one shows only why, never a number.
 */
export function strategyAnnotation(strategy: ComposedStrategy): { label: string; text: string } {
  return {
    label: 'Strategy on this card, not a different card',
    text: strategy.resolved
      ? `Buying a voucher and paying with it earns ${formatPaise(strategy.rewardValueCents)}`
      : `${strategy.reason} · cash value unknown`,
  }
}
