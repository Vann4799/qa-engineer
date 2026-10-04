# Test Plan: Payments

- **Scope**: card and wallet checkout on staging
- **Objectives**: confirm totals, coupons and refunds persist correctly
- **Entry criteria**: staging deployed and seeded with the QA account
- **Exit criteria**: zero open P0/P1 bugs and the smoke suite green

## Test scenarios

- SC-1 happy path card payment authorises and records the order
- SC-2 percentage coupon applies before tax
- SC-3 refund reverses the charge and updates the ledger
