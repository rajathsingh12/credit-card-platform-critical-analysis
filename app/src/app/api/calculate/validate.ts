export type CalculateRequest = {
  cardId: string
  amountRupees: number
  merchantName: string
  merchantCategory: string
  transactionDate: string
}

export function validateCalculateInput(
  body: unknown
): { ok: true; data: CalculateRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'request body required' }
  const b = body as Record<string, unknown>

  if (!b.cardId || typeof b.cardId !== 'string') return { ok: false, error: 'cardId is required' }
  if (typeof b.amountRupees !== 'number' || b.amountRupees <= 0)
    return { ok: false, error: 'amountRupees must be a positive number' }
  if (!b.merchantCategory || typeof b.merchantCategory !== 'string')
    return { ok: false, error: 'merchantCategory is required' }
  if (
    !b.transactionDate ||
    typeof b.transactionDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.transactionDate)
  )
    return { ok: false, error: 'transactionDate must be YYYY-MM-DD' }

  return {
    ok: true,
    data: {
      cardId: b.cardId,
      amountRupees: b.amountRupees,
      merchantName: typeof b.merchantName === 'string' ? b.merchantName : '',
      merchantCategory: b.merchantCategory,
      transactionDate: b.transactionDate,
    },
  }
}
