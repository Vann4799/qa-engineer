# Test Case: Login with valid credentials

- **ID**: TC-LOGIN-001
- **Title**: Login with valid credentials
- **Priority**: P0
- **Type**: smoke

## Precondition

The staging app is reachable and the QA test account exists.

## Steps

1. Navigate to the login page.
2. Enter a valid email and the password from the QA_SECRETS env var.
3. Submit the form.

## Test Data

email qa@example.com, password read from the environment

## Expected Result

The server returns 200, the session endpoint reports role=admin, and the dashboard route renders.
