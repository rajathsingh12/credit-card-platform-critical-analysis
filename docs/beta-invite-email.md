# Beta invite email

The email the operator sends to each invited cardholder. Copy it verbatim — the notice block
in particular is fixed text, decided in the beta compliance review and reproduced unchanged on
`/invite`.

**One code per person.** Generate a code, send it, keep the code → name mapping in the
steward's off-git list (it is the only thing that can re-identify an invitee).

## Template

**Subject:** Invite: 30-day beta of a credit card rewards calculator

---

Hi [FIRST_NAME],

I'm [SENDER_NAME]. I've built a calculator for choosing among your own credit cards for a
purchase — it covers 36 Indian credit cards and compares their real rewards value, with every
figure carrying its evidence tier and source date. I'm running it as a 30-day closed beta and
would like you in it.

Your invite code is below. Enter it once at [BETA_URL] — it lasts the whole beta on that device.

[INVITE_CODE]

**What this is and what we keep**

This is a 30-day closed beta of a credit card rewards calculator, not a live product.

We record which card you calculated for, whether a result was shown, and how many calculations
you have made — all tied to your invite code — plus anything you type into "Report an issue". We
do not store the amounts, merchants or dates you enter. There is no account, no card number and no
statement. Your invite code is kept in a cookie on this device for 30 days.

Results are worked out from the issuer's published terms and shown with their evidence status and
working. They are not financial advice, and this is not a channel for complaints about your issuer.

Within 30 days of the beta verdict, usage records and the code-to-name list are deleted; reports
are kept, unattributed, as the catalog's correction record. To stop early, reply to your invite
email: your code is revoked and your usage records deleted within 7 days.

Reply to this email to stop, or with anything you notice.

[SENDER_NAME]

---

## Placeholders

| Placeholder | Fill with |
|---|---|
| `[FIRST_NAME]` | The invitee's first name |
| `[SENDER_NAME]` | The operator's name — no title, no company line |
| `[BETA_URL]` | The production host, currently `https://credit-card-platform-critical-analy-zeta.vercel.app` |
| `[INVITE_CODE]` | The 24-hex-character code generated for this person, on its own line |

## What must not be added

The beta has no accounts, no statement upload, no signup link and no affiliate flow. Do not add
lines offering any of those, and do not add a compliance claim or an Act citation — the notice
makes no legal assertion deliberately, and the review that approved it vetted exactly that.

## Stop requests

When someone replies to stop, revoke their code and delete their usage records. The procedure is
in `.scratch/mvp/issues/40-compliance-review-before-closed-beta.md` under "Stop request"; the
turnaround target is 7 days, which is what the notice promises.
