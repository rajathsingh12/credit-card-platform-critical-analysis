import { Suspense } from 'react'
import styles from './invite.module.css'
import InviteForm from './invite-form'

export default function InvitePage() {
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
          <section className={`card ${styles.card}`} aria-labelledby="invite-title">
            <p className="eyebrow">Beta access</p>
            <h1 id="invite-title" className={styles.title}>Enter your invite code</h1>
            <p className={styles.context}>
              Credit Card Intelligence compares verified credit-card rewards for Indian cardholders —
              every figure carries its evidence tier and source date. Access is invite-only during
              the private beta.
            </p>

            <section className={styles.notice} aria-labelledby="invite-notice">
              <h2 id="invite-notice">What this is and what we keep</h2>
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

            <Suspense>
              <InviteForm />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  )
}
