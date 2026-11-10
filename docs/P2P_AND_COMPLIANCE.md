# Peer-to-peer payments and compliance note

## What BraillePay does today

- **Demo transfers only.** Money moves between demo accounts in the MongoDB ledger. No bank, NPCI system, UPI rail, or real account is involved. Every bank and user in the demo is fictional.
- **Razorpay test mode** is a merchant checkout in test mode. No real money moves in test mode.
- **Real UPI payments are not supported.** The scanner reads UPI links and speaks them, and it can show a simulated payment. A simulated payment is labelled as simulated and never sent to a real network.

BraillePay must not be described as supporting real peer-to-peer (P2P) transfers, real UPI payments, or live money movement.

## What would be needed for real P2P

Real person-to-person payments are regulated. The following are generally needed. This is a checklist to discuss with qualified advisers, not legal advice, and current requirements must be checked:

1. **A licensed entity** that can move money on a payment rail. In India, UPI is accessed through banks and licensed payment service providers, not directly by an app.
2. **Regulatory authorisation** for the activity, for example from the central bank, depending on the structure chosen.
3. **Bank or payment-partner agreements** and the partner's technical integration requirements.
4. **Know-your-customer and anti-money-laundering controls** for every user who can move money.
5. **Security and audit requirements** set by the regulator and the partner, including data retention and incident reporting.
6. **Consumer protection**: disputes, refunds, grievance handling and clear disclosures.
7. **Accessibility obligations** for the product, which apply independently of the payment rules.

## Design consequence

Until the items above are in place, the app should keep its demo labelling, keep demo and live modes separate, and never call a simulated or test transaction a real payment. The Razorpay integration is a merchant checkout and does not make BraillePay a payment provider.

## Data in QR codes

The QR payload contains only the public identifiers the user chooses to share (for demo, a UPI ID). It contains no PIN, balance, bank details or token. Whether a UPI ID counts as personal data under the applicable data-protection law, and what notice is needed, has not been assessed in this build.
