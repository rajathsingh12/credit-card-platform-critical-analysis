'use client'

import { useEffect, useState } from 'react'
import type { CalcResult } from '@/engine/types'

type CardOption = { id: string; name: string; issuer: string; rewardCurrency: string }

const CATEGORIES = [
  { value: 'dining', label: 'Dining' },
  { value: 'travel', label: 'Travel' },
  { value: 'online', label: 'Online Shopping' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'rent', label: 'Rent' },
  { value: 'wallet-load', label: 'Wallet Load' },
  { value: 'other', label: 'Other' },
]

const CHANNELS = [
  { value: 'online', label: 'Online' },
  { value: 'contactless', label: 'Contactless / Tap' },
  { value: 'chip-and-pin', label: 'Chip & PIN' },
  { value: 'swipe', label: 'Swipe (Magnetic Stripe)' },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', color: '#1a1a1a' },
  heading: { fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { fontSize: '0.875rem', color: '#555', marginBottom: '1.75rem' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' },
  input: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem', fontSize: '0.9375rem', border: '1px solid #ccc', borderRadius: 6, background: '#fff' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  button: { marginTop: '0.5rem', width: '100%', padding: '0.65rem 1rem', fontSize: '1rem', fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  buttonDisabled: { marginTop: '0.5rem', width: '100%', padding: '0.65rem 1rem', fontSize: '1rem', fontWeight: 600, background: '#888', color: '#fff', border: 'none', borderRadius: 6, cursor: 'not-allowed' },
  error: { marginTop: '1rem', padding: '0.75rem', background: '#fff0f0', border: '1px solid #f5c6c6', borderRadius: 6, fontSize: '0.875rem', color: '#b00' },
  result: { marginTop: '1.5rem', padding: '1rem', background: '#f8f8f8', border: '1px solid #ddd', borderRadius: 8 },
  resultHeading: { fontWeight: 700, marginBottom: '0.75rem', fontSize: '1rem' },
  resultRow: { display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #eee', fontSize: '0.9rem' },
  resultLabel: { color: '#555' },
  resultValue: { fontWeight: 600 },
  badge: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 },
  note: { fontSize: '0.775rem', color: '#777', marginTop: '0.5rem' },
}

function formatPaise(paise: number | null): string {
  if (paise === null) return '—'
  return `₹${(paise / 100).toFixed(2)}`
}

function OutcomePanel({ result }: { result: CalcResult }) {
  const resolved = result.resolved
  return (
    <div style={s.result}>
      <div style={s.resultHeading}>Transaction Outcome</div>
      <div style={s.resultRow}>
        <span style={s.resultLabel}>Status</span>
        <span style={{ ...s.badge, background: resolved ? '#d4edda' : '#fff3cd', color: resolved ? '#155724' : '#856404' }}>
          {resolved ? 'Resolved' : 'Unresolved'}
        </span>
      </div>
      <div style={s.resultRow}>
        <span style={s.resultLabel}>Rewards earned</span>
        <span style={s.resultValue}>{result.rewardsEarned} pts</span>
      </div>
      {resolved && (
        <>
          <div style={s.resultRow}>
            <span style={s.resultLabel}>Net return</span>
            <span style={s.resultValue}>{formatPaise(result.netReturnCents)}</span>
          </div>
          <div style={s.resultRow}>
            <span style={s.resultLabel}>Annual fee (monthly)</span>
            <span style={s.resultValue}>{formatPaise(result.annualFeeAmortizedCents)}</span>
          </div>
        </>
      )}
      {!resolved && <p style={s.note}>{result.reason}</p>}
      <p style={s.note}>Rule applied: {result.ruleApplied ?? 'none'}</p>
    </div>
  )
}

export default function Home() {
  const [cards, setCards] = useState<CardOption[]>([])
  const [cardId, setCardId] = useState('')
  const [amountRupees, setAmountRupees] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [merchantCategory, setMerchantCategory] = useState('dining')
  const [paymentChannel, setPaymentChannel] = useState('online')
  const [transactionDate, setTransactionDate] = useState(todayIso())
  const [mtdSpend, setMtdSpend] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CalcResult | null>(null)

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then(({ cards }) => {
        setCards(cards)
        if (cards.length > 0) setCardId(cards[0].id)
      })
      .catch(() => setError('Failed to load cards'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    const amount = parseFloat(amountRupees)
    if (!amount || amount <= 0) {
      setError('Enter a valid amount')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, amountRupees: amount, merchantName, merchantCategory, paymentChannel, transactionDate }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Calculation failed'); return }
      setResult(data.result)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const ready = cards.length > 0

  return (
    <main style={s.page}>
      <h1 style={s.heading}>Credit Card Intelligence Platform</h1>
      <p style={s.sub}>Enter a transaction to see rewards earned — no login required.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div style={s.field}>
          <label style={s.label} htmlFor="card">Card</label>
          <select id="card" style={s.input} value={cardId} onChange={e => setCardId(e.target.value)} disabled={!ready} required>
            {!ready && <option value="">Loading cards…</option>}
            {cards.map(c => (
              <option key={c.id} value={c.id}>{c.issuer} — {c.name}</option>
            ))}
          </select>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label} htmlFor="amount">Amount (₹)</label>
            <input id="amount" type="number" min="1" step="0.01" style={s.input} value={amountRupees}
              onChange={e => setAmountRupees(e.target.value)} placeholder="e.g. 2500" required />
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="date">Transaction date</label>
            <input id="date" type="date" style={s.input} value={transactionDate}
              onChange={e => setTransactionDate(e.target.value)} required />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="merchant">Merchant name (optional)</label>
          <input id="merchant" type="text" style={s.input} value={merchantName}
            onChange={e => setMerchantName(e.target.value)} placeholder="e.g. Swiggy" />
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label} htmlFor="category">Merchant category</label>
            <select id="category" style={s.input} value={merchantCategory} onChange={e => setMerchantCategory(e.target.value)} required>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="channel">Payment channel</label>
            <select id="channel" style={s.input} value={paymentChannel} onChange={e => setPaymentChannel(e.target.value)} required>
              {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="mtd">Month-to-date spend (₹, informational)</label>
          <input id="mtd" type="number" min="0" step="0.01" style={s.input} value={mtdSpend}
            onChange={e => setMtdSpend(e.target.value)} placeholder="e.g. 15000" />
        </div>

        <button type="submit" style={submitting || !ready ? s.buttonDisabled : s.button} disabled={submitting || !ready}>
          {submitting ? 'Calculating…' : 'Calculate rewards'}
        </button>
      </form>

      {error && <div role="alert" style={s.error}>{error}</div>}
      {result && <OutcomePanel result={result} />}
    </main>
  )
}
