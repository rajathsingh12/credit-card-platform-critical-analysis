'use client'

import { useEffect, useId, useState } from 'react'
import type { CalcResult, TraceEntry } from '@/engine/types'
import type { EvidenceStatus } from '@/catalog/evidence'
import s from './home-client.module.css'

type CardOption = { id: string; name: string; issuer: string; rewardCurrency: string }
type RuleMeta = { evidenceStatus: string; sourceDate: string; retractedAt?: string | null }
type CardResult = { card: CardOption; result: CalcResult; ruleMeta: Record<string, RuleMeta> }

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function categoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? value
}

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inrInt = new Intl.NumberFormat('en-IN')
const inDate = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function formatPaise(paise: number | null): string {
  if (paise === null) return '—'
  const sign = paise < 0 ? '−' : ''
  return `${sign}₹${inr.format(Math.abs(paise) / 100)}`
}

function formatInt(n: number): string {
  return inrInt.format(n)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : inDate.format(d)
}

// Net return in paise; null when unresolved or a direct (non-variable) reward.
function netOf(r: CardResult): number | null {
  return r.result.resolved ? r.result.netReturnCents : null
}

// Resolved by net return desc, unresolved last; shortfall is vs the winner.
type Ranked = CardResult & { rank: number; shortfallCents: number | null }

export function rankResults(results: CardResult[]): Ranked[] {
  const resolved = results.filter(r => netOf(r) !== null)
  const noValue = results.filter(r => r.result.resolved && netOf(r) === null)
  const unresolved = results.filter(r => !r.result.resolved)
  resolved.sort((a, b) => (netOf(b) ?? 0) - (netOf(a) ?? 0))
  const best = resolved.length > 0 ? netOf(resolved[0]) : null
  return [...resolved, ...noValue, ...unresolved].map((r, i) => ({
    ...r,
    rank: i + 1,
    shortfallCents: best !== null && i > 0 && netOf(r) !== null ? (netOf(r) as number) - best : null,
  }))
}

function appliedEntryOf(r: CardResult): TraceEntry | undefined {
  return r.result.ruleApplied ? r.result.trace.entries.find(e => e.ruleId === r.result.ruleApplied) : undefined
}

function appliedMetaOf(r: CardResult): RuleMeta | undefined {
  return r.result.ruleApplied ? r.ruleMeta[r.result.ruleApplied] : undefined
}

const EVIDENCE_TIER: Record<EvidenceStatus, { tier: 1 | 2 | 3 | 4; glyph: string; label: string }> = {
  'officially-documented': { tier: 1, glyph: '●', label: 'Officially documented' },
  'statement-verified': { tier: 2, glyph: '◕', label: 'Statement verified' },
  'inferred': { tier: 3, glyph: '◐', label: 'Inferred' },
  'community-reported': { tier: 4, glyph: '○', label: 'Community reported' },
}

function EvidenceBadge({ status }: { status: string | undefined }) {
  if (!status) return null
  const t = EVIDENCE_TIER[status as EvidenceStatus]
  if (!t) return <span className="badge badge--neutral">{status.replace(/-/g, ' ')}</span>
  return (
    <span className={`badge badge--evidence-${t.tier}`} title={`Evidence tier ${t.tier} of 4`}>
      <span className="badge__glyph" aria-hidden="true">{t.glyph}</span>
      {t.label}
      <span className="visually-hidden">, tier {t.tier} of 4</span>
    </span>
  )
}

function RetractedBadge() {
  return <span className="badge badge--retracted">✕ Rule retracted</span>
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

function ReportForm({ cardId, ruleVersionId }: { cardId: string; ruleVersionId: string }) {
  const descriptionId = useId()
  const urlId = useId()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, ruleVersionId, description, sourceUrl: sourceUrl || undefined }),
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <div className="alert alert--success" role="status">Report submitted — thank you. A Data Lead has been created for review.</div>
  }
  if (!open) {
    return (
      <button className="btn btn--ghost btn--sm" type="button" onClick={() => setOpen(true)}>
        Report an issue with this rule
      </button>
    )
  }
  return (
    <form className="card card--sunken report-form" onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor={descriptionId}>Describe the issue</label>
        <textarea id={descriptionId} className="input" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. The multiplier for dining is 3x, not 5x" required />
      </div>
      <div className="field">
        <label className="label" htmlFor={urlId}>Source URL (optional)</label>
        <input id={urlId} className="input" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://" />
      </div>
      <div className="report-form__actions">
        <button className="btn btn--primary btn--sm" type="submit" disabled={submitting || !description.trim()}>
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

function Receipt({ entries, ruleMeta, cardId }: { entries: TraceEntry[]; ruleMeta: Record<string, RuleMeta>; cardId: string }) {
  return (
    <div className={`card ${s.receipt}`} aria-label="Calculation receipt">
      <div className={`eyebrow ${s.receiptHead}`}>Calculation receipt</div>
      {entries.map(e => {
        const meta = ruleMeta[e.ruleId]
        return (
          <div key={e.ruleId} className={e.applied ? s.lineApplied : s.line}>
            <div className={s.lineHead}>
              <span className={`mono ${s.ruleId}`}>{e.ruleId}</span>
              {e.applied ? <span className="badge badge--applied">✓ Applied</span> : <span className="badge badge--neutral">Skipped</span>}
              {meta?.retractedAt && <RetractedBadge />}
            </div>
            <p className={s.lineReason}>{e.reason}</p>
            <div className={s.receiptRows}>
              <span className="hint">{categoryLabel(e.inputs.merchantCategory)}</span>
              <span className="hint num">{e.inputs.pointsPerDollar}×</span>
              {e.inputs.capPoints !== null && <span className="hint num">cap {formatInt(e.inputs.capPoints)}</span>}
              {e.inputs.categories.length > 0 && <span className="hint">{e.inputs.categories.join(', ')}</span>}
              {e.inputs.exclusions.length > 0 && <span className="hint">excl. {e.inputs.exclusions.join(', ')}</span>}
              <span className="hint num">eff. {formatDate(e.ruleEffectiveFrom)}</span>
              {e.pointsAfterCap !== null && (
                <span className={`num ${e.applied ? s.linePoints : s.linePointsOff}`}>
                  {formatInt(e.pointsAfterCap)} pts{e.pointsBeforeCap !== null && e.pointsBeforeCap !== e.pointsAfterCap ? ` (was ${formatInt(e.pointsBeforeCap)})` : ''}
                </span>
              )}
            </div>
            {e.assumptions.map((a, i) => <p key={i} className={s.assumption}>{a}</p>)}
            {meta && (
              <div className={s.lineMeta}>
                <EvidenceBadge status={meta.evidenceStatus} />
                <span className="hint num">source {formatDate(meta.sourceDate)}</span>
              </div>
            )}
            <ReportForm cardId={cardId} ruleVersionId={e.ruleId} />
          </div>
        )
      })}
    </div>
  )
}

function BarRow({ r, pct, open, onToggle }: { r: Ranked; pct: number | null; open: boolean; onToggle: () => void }) {
  const meta = appliedMetaOf(r)
  const entry = appliedEntryOf(r)
  const res = r.result
  return (
    <li className={s.row}>
      <button className={`card ${s.rowBtn} ${r.rank === 1 ? s.rowWinner : ''} ${res.resolved ? '' : s.rowUnresolved}`} type="button" onClick={onToggle} aria-expanded={open}>
        <div className={s.rowHead}>
          {r.rank === 1 && <span className="badge badge--winner">★ Best for this spend</span>}
          {meta?.retractedAt && <RetractedBadge />}
          {!res.resolved && <span className="badge badge--unresolved">⚠ Unresolved</span>}
          <span className={s.rowCard}>{r.card.name} <span className="hint">{r.card.issuer}</span></span>
        </div>
        {res.resolved && res.netReturnCents !== null && (
          <span className={s.track} aria-hidden="true">
            <span className={pct === null ? '' : s.bar} style={{ width: `${pct}%` }} />
          </span>
        )}
        <div className={s.rowFoot}>
          {res.resolved ? (
            <>
              <span className={`num ${r.rank === 1 ? s.rowNetHero : s.rowNet}`}>{formatPaise(res.netReturnCents)}</span>
              {r.shortfallCents !== null && <span className="hint num">({formatPaise(r.shortfallCents)} vs best)</span>}
              <span className="hint num">{formatInt(res.rewardsEarned)} pts</span>
              {res.annualFeeAmortizedCents !== null && <span className="hint num">fee {formatPaise(res.annualFeeAmortizedCents)}</span>}
            </>
          ) : (
            <span className={s.unresolvedReason}>{res.reason} · {formatInt(res.rewardsEarned)} pts, cash value unknown</span>
          )}
          {meta && !meta.retractedAt && <EvidenceBadge status={meta.evidenceStatus} />}
          {meta && <span className="hint num">verified {formatDate(meta.sourceDate)}</span>}
          {entry && <span className="hint num">eff. {formatDate(entry.ruleEffectiveFrom)}</span>}
        </div>
        {entry?.assumptions.map((a, i) => <p key={i} className={s.assumption}>{a}</p>)}
        <span className={`hint ${s.rowToggle}`}>{open ? '▾ Hide calculation' : '▸ Show calculation'}</span>
      </button>
      {open && <Receipt entries={res.trace.entries} ruleMeta={r.ruleMeta} cardId={r.card.id} />}
    </li>
  )
}

type CorrectionEntry = {
  id: string
  ruleVersionId: string
  retractionReason: string
  retractedAt: string
  card: { id: string; name: string; issuer: string }
}

function CorrectionHistorySection() {
  const [entries, setEntries] = useState<CorrectionEntry[]>([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    if (loaded) { setOpen(true); return }
    const res = await fetch('/api/correction-history')
    const data = await res.json()
    setEntries(data.entries ?? [])
    setLoaded(true)
    setOpen(true)
  }

  return (
    <section className="corrections" aria-labelledby="corrections-heading">
      <div className="corrections__bar">
        <h2 id="corrections-heading" className="corrections__title">Correction History</h2>
        <span className="hint">Publicly retracted rules, newest first</span>
        <button className="btn btn--secondary btn--sm" type="button" aria-expanded={open} onClick={open ? () => setOpen(false) : load}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <ul className="corrections__list">
          {entries.length === 0 && <li className="hint">No corrections on record.</li>}
          {entries.map(e => (
            <li key={e.id} className="card corrections__item">
              <div className="corrections__head">
                <RetractedBadge />
                <strong>{e.card.issuer} — {e.card.name}</strong>
              </div>
              <p>{e.retractionReason}</p>
              <p className="hint">
                <span className="mono">{e.ruleVersionId.slice(0, 8)}…</span> · retracted <span className="num">{formatDate(e.retractedAt)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function toggleItem(set: Set<string>, key: string): Set<string> {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export default function HomeClient() {
  const cardsGroupId = useId()
  const [cards, setCards] = useState<CardOption[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [amountRupees, setAmountRupees] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [merchantCategory, setMerchantCategory] = useState('dining')
  const [transactionDate, setTransactionDate] = useState(todayIso())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CardResult[]>([])
  const [openTraces, setOpenTraces] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then(({ cards }) => {
        setCards(cards)
        if (cards.length > 0) setSelectedIds(new Set([cards[0].id]))
      })
      .catch(() => setError('Failed to load cards'))
  }, [])

  function toggleCard(id: string) {
    setSelectedIds(prev => toggleItem(prev, id))
  }

  function toggleTrace(cardId: string) {
    setOpenTraces(prev => toggleItem(prev, cardId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResults([])
    const amount = parseFloat(amountRupees)
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return }
    if (selectedIds.size === 0) { setError('Select at least one card'); return }
    setSubmitting(true)
    try {
      const responses = await Promise.all(
        Array.from(selectedIds).map(async cardId => {
          const res = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId, amountRupees: amount, merchantName, merchantCategory, transactionDate }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'Calculation failed')
          const card = cards.find(c => c.id === cardId)!
          return { card, result: data.result as CalcResult, ruleMeta: (data.ruleMeta ?? {}) as Record<string, RuleMeta> }
        })
      )
      setResults(responses)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const ready = cards.length > 0
  const canSubmit = ready && selectedIds.size > 0 && !submitting

  const ranked = rankResults(results)
  const best = ranked.find(r => netOf(r) !== null)
  const bestNet = best ? netOf(best) : null
  const visible = showAll ? ranked : ranked.slice(0, 6)

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Credit Card Intelligence <span className="badge badge--beta">Beta</span></h1>
        <p className={s.subtitle}>Which card wins? The bar says it first.</p>
      </header>

      <form className={`card ${s.form}`} onSubmit={handleSubmit} noValidate>
        <div className={s.two}>
          <Field label="Amount (₹)">{id => (
            <input id={id} className="input num" type="number" min="1" step="0.01" inputMode="decimal" placeholder="2,500" required
              value={amountRupees} onChange={e => setAmountRupees(e.target.value)} />
          )}</Field>
          <Field label="Transaction date">{id => (
            <input id={id} className="input num" type="date" required value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
          )}</Field>
        </div>
        <div className={s.two}>
          <Field label="Category">{id => (
            <select id={id} className="input" required value={merchantCategory} onChange={e => setMerchantCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          )}</Field>
          <Field label="Merchant" hint="Optional">{id => (
            <input id={id} className="input" type="text" placeholder="e.g. Swiggy" value={merchantName} onChange={e => setMerchantName(e.target.value)} />
          )}</Field>
        </div>

        <div className="field" role="group" aria-labelledby={cardsGroupId}>
          <div className={s.tilesHead}>
            <span id={cardsGroupId} className="label">Cards to compare</span>
            <span className="badge badge--neutral num">{selectedIds.size} selected</span>
          </div>
          {!ready ? (
            <div className={s.tileGrid} aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => <span key={i} className={`skeleton ${s.skelTile}`} />)}
            </div>
          ) : (
            <>
              <div className={s.tileGrid}>
                {cards.map(c => (
                  <label key={c.id} className={s.tile}>
                    <input type="checkbox" className="visually-hidden" checked={selectedIds.has(c.id)} onChange={() => toggleCard(c.id)} />
                    <span className={s.tileInitial} aria-hidden="true">{c.issuer.slice(0, 1)}</span>
                    <span className={s.tileName}>{c.name}</span>
                    <span className={`hint ${s.tileIssuer}`}>{c.issuer}</span>
                  </label>
                ))}
              </div>
              <div className={s.tilesFoot}>
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => setSelectedIds(new Set(cards.map(c => c.id)))}>Select all</button>
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => setSelectedIds(new Set())}>Clear</button>
              </div>
            </>
          )}
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={!canSubmit}>
          {submitting ? 'Calculating…' : `Compare ${selectedIds.size > 1 ? `${selectedIds.size} cards` : 'card'}`}
        </button>
        {error && <div className="alert alert--error" role="alert">{error}</div>}
      </form>

      <section aria-live="polite">
        {ranked.length === 0 ? (
          <div className={`card card--sunken ${s.empty}`}>
            <p className={s.emptyTitle}>Compare your first transaction</p>
            <p className="hint">Bars are proportional to net return — longer bar, better card.</p>
          </div>
        ) : (
          <>
            <ul className="chips" aria-label="Transaction compared">
              <li className="badge badge--neutral num">{formatPaise(Math.round(parseFloat(amountRupees) * 100))}</li>
              <li className="badge badge--neutral">{categoryLabel(merchantCategory)}</li>
              <li className="badge badge--neutral num">{formatDate(transactionDate)}</li>
              {merchantName && <li className="badge badge--neutral">{merchantName}</li>}
            </ul>
            <ol className={s.ranked}>{visible.map(r => {
              const net = netOf(r)
              const pct = bestNet !== null && net !== null && bestNet > 0 ? Math.max(4, Math.round((net / bestNet) * 100)) : null
              return <BarRow key={r.card.id} r={r} pct={pct} open={openTraces.has(r.card.id)} onToggle={() => toggleTrace(r.card.id)} />
            })}</ol>
            {ranked.length > 6 && (
              <button className="btn btn--secondary" type="button" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show top 6' : `Show all ${ranked.length} cards`}
              </button>
            )}
          </>
        )}
      </section>

      <CorrectionHistorySection />
    </main>
  )
}
