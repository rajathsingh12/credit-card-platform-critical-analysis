## Context

The overall reward calculation appears to be correct, but I believe the **recommendation/suggestion logic is incomplete**.

The current logic seems to evaluate cards primarily based on their **base reward rate for a transaction**. That works for identifying the best card when paying directly, but it does not account for **reward multipliers available through voucher purchases**, which can materially change the optimal payment method.

### Example: HDFC Infinia

For regular spending on HDFC Infinia:

* Spend: ₹150
* Base reward: 5 reward points
* Therefore, ₹2,500 direct spend generates:

`(₹2,500 / ₹150) × 5 = ~83 reward points`

So, ignoring the monetary valuation of points for the moment:

`₹2,500 - 83 = ₹2,417 effective cost`

The current recommendation that **Infinia is the best card based on base reward points** is therefore reasonable.

However, there is an additional optimization opportunity.

### Voucher optimization

If I purchase a Swiggy voucher through GyFTR and then use that voucher to pay for Swiggy Dineout:

* The same ₹2,500 spend would initially generate approximately 83 base points.
* If the voucher transaction receives a 5× reward multiplier:

`83 × 5 = 415 reward points`

Therefore:

`₹2,500 - 415 = ₹2,085 effective cost`

The key point is:

> **The best card for direct payment is not necessarily the best optimized payment method.**

The recommendation engine should therefore distinguish between:

1. **Direct card payment**
2. **Card → voucher purchase → merchant payment**
3. Potentially other eligible reward-optimization routes

---

## Required Change

Please review the recommendation logic and modify the system so that it does **not stop after identifying the card with the highest base reward rate**.

The recommendation engine should operate at two levels:

### Level 1 — Base Card Recommendation

Determine the best card assuming the user pays the merchant directly with the card.

Example:

> "Based on direct card rewards, HDFC Infinia provides the highest reward for this transaction."

This part of the existing logic appears to be correct.

### Level 2 — Optimization Opportunities

After identifying the best direct-payment card, check whether the transaction can be optimized further through:

* Gift/voucher purchases
* Merchant-specific voucher multipliers
* Partner portals
* Accelerated reward categories
* Other documented reward mechanisms
* Applicable caps, exclusions, minimum/maximum transaction values, etc.

For the Swiggy example, the system should therefore be able to say conceptually:

> "HDFC Infinia is the best card for direct payment. However, purchasing a Swiggy voucher through GyFTR and using it for the transaction may provide a higher effective reward, subject to the applicable voucher multiplier, eligibility, and reward caps."

---

## Important: Separate "Card" from "Payment Strategy"

The recommendation model should not treat the answer simply as:

**Best Card = Infinia**

Instead, it should model:

**Best Direct Card**
→ HDFC Infinia

**Best Optimized Payment Strategy**
→ HDFC Infinia + eligible Swiggy voucher route

This distinction is important because the user ultimately cares about the **lowest effective cost / highest total reward**, rather than simply which card has the highest base reward rate.

---

## Calculation Framework

Please consider implementing a framework similar to:

### Direct payment

`Base Points = Eligible Spend / Reward Threshold × Base Reward Points`

`Effective Value = Transaction Value - Monetary Value of Rewards`

### Voucher route

`Base Voucher Points = Eligible Voucher Spend / Reward Threshold × Base Reward Points`

`Accelerated Points = Base Voucher Points × Applicable Multiplier`

`Total Rewards = Base/Accelerated Points + Any Additional Eligible Benefits`

`Effective Value = Transaction Value - Monetary Value of Total Rewards`

The system should also account for:

* Reward caps
* Voucher purchase limits
* Monthly/quarterly limits
* Merchant/category exclusions
* Minimum transaction values
* Maximum eligible spend
* Whether the voucher itself qualifies for accelerated rewards
* Whether the subsequent merchant transaction qualifies for additional rewards
* Voucher denomination constraints
* Voucher validity/expiry
* Any fees or discounts associated with purchasing the voucher
* Whether the voucher route is actually eligible at the time of calculation

Do **not** assume that every voucher receives a multiplier. The multiplier and eligibility should come from the underlying rules/data.

---

## Recommendation Output

I would like the final recommendation to be transparent rather than simply returning one card.

For example:

### Direct Payment

**HDFC Infinia**

Expected base rewards: ~83 points

### Optimized Strategy

**HDFC Infinia → Swiggy Voucher via GyFTR → Swiggy Dineout**

Expected rewards: ~415 points, assuming the applicable 5× multiplier and eligibility.

### Insight

"Direct payment with Infinia gives the highest base card reward. However, using an eligible Swiggy voucher route can increase the reward substantially."

The UI should clearly communicate that the second recommendation is an **optimization strategy**, not a different card.

---

## Important Validation Requirement

Before changing the calculation engine, inspect the existing implementation carefully.

The core calculation may already be correct. The likely issue is that the **recommendation layer is only evaluating base card rewards and is not exploring reward-optimization strategies**.

Therefore:

1. Do not unnecessarily rewrite the existing reward calculation logic.
2. Identify where the system determines the "best card."
3. Determine whether the recommendation engine can support multiple payment strategies.
4. Extend the recommendation logic to evaluate voucher/partner-based optimization opportunities.
5. Preserve the existing direct-card calculation unless an actual calculation bug is found.
6. Add appropriate tests comparing:

   * Direct card payment
   * Voucher-based payment
   * Voucher multiplier
   * Reward caps
   * Ineligible voucher scenarios
   * Cases where voucher optimization does not provide additional value.

## Goal

The ultimate goal is for the application to answer two different questions:

**"Which card should I use?"**

and

**"What is the most reward-efficient way to make this purchase using my available cards and eligible payment mechanisms?"**

The second question is the more powerful recommendation capability and should build on top of the existing correct calculation engine rather than replacing it.