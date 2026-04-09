<!-- [Your Name], [Your Student ID] -->
<!-- Volume Testing - Seed Data Setup -->
<!-- Milestone 3 - Non-Functional Testing -->

# Seed Instructions for Volume Testing

This guide prepares large data volume before running k6 volume tests.

## Target Seed Volume
- Orders: 500 to 1000 records for one or more test users
- Users: 500+ user records

## Safe Data Setup Principles
- Use non-production environment only.
- Use dedicated test accounts where possible.
- Do not hardcode credentials in source files.
- Keep JWT tokens outside version control (runtime env vars only).
- Prefer passing AUTH_EMAIL/AUTH_PASSWORD and ADMIN_EMAIL/ADMIN_PASSWORD so scripts log in during setup().

## Option A: Seed Users Through API (Recommended if registration endpoint is open)
Use /api/v1/auth/register repeatedly with generated emails.

PowerShell one-liner idea:
1. Loop from 1 to 500
2. POST generated user payload
3. Add small delay (100-200ms) per request

Sample payload fields expected by backend:
- name
- email
- password
- phone
- address
- answer

## Option B: Seed Users Directly in Database
If API registration has constraints, use MongoDB script to insert many users.

Suggested fields:
- name
- email (unique)
- password (hashed)
- phone
- address
- answer
- role (0 for normal users, at least one role 1 admin)

## Option C: Seed Orders Through Existing Payment Endpoint
Backend currently creates orders in /api/v1/product/braintree/payment.

Important:
- This route depends on Braintree sandbox credentials.
- If payment integration is unavailable locally, use database seeding for orders.

If available, send repeated POST calls with:
- nonce: fake-valid-nonce
- cart: [{ _id: <productId>, price: <number> }]

## Option D: Seed Orders Directly in Database
Insert order documents with:
- products: array of product ObjectIds
- payment: object (can store stub object for testing)
- buyer: existing user ObjectId
- status: one of Not Process, Processing, Shipped, deliverd, cancel
- timestamps spread over realistic dates

## Example Mongo Shell Pseudocode
Use this as a conceptual template and adapt to your environment:

1. Create or locate test user IDs and product IDs.
2. Insert 1000 orders distributed across users.
3. Randomize status and createdAt for realistic filter/pagination testing.

Pseudo steps:
- for i in range(1, 1001):
  - choose random user
  - choose 1-3 products
  - choose random status
  - insert order document

## Optional k6 Setup Seeding Phase
If your team has a dedicated seed endpoint, you can call it in setup() in orders-volume.js.

Recommended env toggle pattern:
- ENABLE_SEED=true
- SEED_ENDPOINT=/api/v1/test/seed-orders

Then in setup():
- check if ENABLE_SEED is true
- call seed endpoint once
- validate success before running test iterations

## Verification Before Running Volume Tests
1. Verify user count in DB is at least 500.
2. Verify order count in DB is at least 500 (preferably 1000).
3. Verify admin and regular user tokens are valid.
4. Verify critical endpoints respond normally with a single request.

## Example Runtime Flow
1. Start backend server.
2. Seed data (API script or DB script).
3. Set AUTH_EMAIL/AUTH_PASSWORD and ADMIN_EMAIL/ADMIN_PASSWORD in your shell.
4. Run one script first (for example ./performance-testing/k6/volume/protected-routes-volume.js).
5. Run all scripts using ./performance-testing/k6/volume/run-all.ps1 or ./performance-testing/k6/volume/run-all.sh.

## Token Retrieval Reminder
Regular user login endpoint:
curl -X POST http://localhost:6060/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"existinguser@example.com","password":"theirpassword"}'

Admin token:
Repeat the same login call with admin credentials and store token as ADMIN_TOKEN.
