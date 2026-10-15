'use client'

import { Suspense, useId, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './invite.module.css'

const SEG_COUNT = 6
const SEG_LEN = 4
const CODE_LEN = SEG_COUNT * SEG_LEN

function sanitize(raw: string): string {
  return raw.toLowerCase().replace(/[^0-9a-f]/g, '')
}

function InviteForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const revoked = searchParams.get('revoked') === '1'
  const uid = useId()
  const labelId = `${uid}-label`
  const helpId = `${uid}-help`

  const [segs, setSegs] = useState<string[]>(() => Array(SEG_COUNT).fill(''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const code = segs.join('')
  const canSubmit = !submitting && code.length === CODE_LEN

  function focusSeg(i: number) {
    refs.current[Math.max(0, Math.min(i, SEG_COUNT - 1))]?.focus()
  }

  function setSeg(i: number, raw: string) {
    const v = sanitize(raw).slice(0, SEG_LEN)
    setSegs(prev => {
      const next = [...prev]
      next[i] = v
      return next
    })
    setInvalid(false)
    setError(null)
    if (v.length === SEG_LEN && i < SEG_COUNT - 1) focusSeg(i + 1)
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !segs[i] && i > 0) focusSeg(i - 1)
    else if (e.key === 'ArrowLeft' && i > 0) focusSeg(i - 1)
    else if (e.key === 'ArrowRight' && i < SEG_COUNT - 1) focusSeg(i + 1)
  }

  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    let chars = sanitize(e.clipboardData.getData('text')).slice(0, CODE_LEN - i * SEG_LEN)
    const next = [...segs]
    let j = i
    for (; j < SEG_COUNT && chars.length > 0; j++) {
      next[j] = chars.slice(0, SEG_LEN)
      chars = chars.slice(SEG_LEN)
    }
    setSegs(next)
    setInvalid(false)
    setError(null)
    focusSeg(Math.min(j, SEG_COUNT - 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (code.length < CODE_LEN) {
      setInvalid(true)
      setError('Enter all 24 characters of your invite code.')
      const empty = segs.findIndex(seg => seg.length < SEG_LEN)
      focusSeg(empty < 0 ? 0 : empty)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInvalid(true)
        setError(data.error ?? 'Invalid invite code')
        return
      }
      router.push('/')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l7 3v5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <span className={styles.brandName}>Credit Card Intelligence</span>
          <span className={`badge badge--beta ${styles.topBadge}`}>Beta</span>
        </div>
      </header>

      <main className={styles.gateWrap}>
        <div className={styles.gate}>
          <section className={`card ${styles.card}`} aria-labelledby={`${uid}-title`}>
            <p className="eyebrow">Beta access</p>
            <h1 id={`${uid}-title`} className={styles.title}>Enter your invite code</h1>
            <p className={styles.context}>
              Credit Card Intelligence compares verified credit-card rewards for Indian cardholders —
              every figure carries its evidence tier and source date. Access is invite-only during
              the private beta.
            </p>

            <section className={styles.notice} aria-labelledby={`${uid}-notice`}>
              <h2 id={`${uid}-notice`}>What this is and what we keep</h2>
              <p>
                This is a 30-day closed beta of a credit card rewards calculator, not a live product.
              </p>
              <p>
                We record which card you calculated for, whether a result was shown, and how many
                calculations you have made — all tied to your invite code — plus anything you type
                into &ldquo;Report an issue&rdquo;. We do not store the amounts, merchants or dates
                you enter. There is no account, no card number and no statement. Your invite code is
                kept in a cookie on this device for 30 days.
              </p>
              <p>
                Results are worked out from the issuer&rsquo;s published terms and shown with their
                evidence status and working. They are not financial advice, and this is not a
                channel for complaints about your issuer.
              </p>
              <p>
                Within 30 days of the beta verdict, usage records and the code-to-name list are
                deleted; reports are kept, unattributed, as the catalog&rsquo;s correction record.
                To stop early, reply to your invite email: your code is revoked and your usage
                records deleted within 7 days.
              </p>
            </section>

            {revoked && (
              <div className={`alert alert--warning ${styles.banner}`} role="alert">
                Your invite code has been revoked. Contact the team for a new one.
              </div>
            )}
            {error && (
              <div className={`alert alert--error ${styles.banner}`} role="alert">{error}</div>
            )}
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.fieldHead}>
                <span className="label" id={labelId}>Invite code</span>
                <span className="hint">24 hex characters</span>
              </div>
              <div
                className={`${styles.segs} ${invalid ? styles.segsInvalid : ''}`}
                role="group"
                aria-labelledby={labelId}
                aria-describedby={helpId}
              >
                {segs.map((seg, i) => (
                  <input
                    key={i}
                    ref={el => { refs.current[i] = el }}
                    className={`${styles.seg} num`}
                    type="text"
                    inputMode="text"
                    maxLength={SEG_LEN}
                    value={seg}
                    onChange={e => setSeg(i, e.target.value)}
                    onKeyDown={e => onKeyDown(i, e)}
                    onPaste={e => onPaste(i, e)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    disabled={submitting}
                    aria-label={`Invite code, group ${i + 1} of ${SEG_COUNT}`}
                  />
                ))}
              </div>
              <p id={helpId} className={styles.codeHelp}>
                Paste your full code into any box — it fills the rest.
              </p>
              <button type="submit" className="btn btn--primary btn--block" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />Verifying…
                  </>
                ) : 'Enter'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteForm />
    </Suspense>
  )
}
