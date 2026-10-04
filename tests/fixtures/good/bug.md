# Bug: Checkout total shows NaN

- **Severity**: Major
- **Priority**: P1
- **Reproducibility**: Always
- **Environment**: staging, Chrome 126, account qa@example.com

## Steps to Reproduce

1. Add one item to the cart.
2. Open the checkout page.
3. Apply a percentage coupon.

## Expected

The order total shows the discounted amount.

## Actual

The order total renders as NaN.

## Evidence

POST /api/checkout returned 200 with body total:"NaN"; the selector .order-total textContent is "NaN".

## Suggested Area

checkout total calculation
