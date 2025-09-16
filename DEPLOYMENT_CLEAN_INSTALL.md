## Production deployment (clean install, no sample data)

This guide explains how to deploy with an empty database (no demo stores/customers/items) so your instance can be set up from scratch.

### 1) Environment variables
Required
- DATABASE_URL = postgresql://user:pass@host:port/db?sslmode=require
- JWT_SECRET = a long, random secret for signing auth tokens
- NODE_ENV = production

Optional (to create first admin during seed)
- SEED_MODE = minimal
- FIRST_ADMIN_EMAIL = you@example.com
- FIRST_ADMIN_PASSWORD = strong_password
- FIRST_ADMIN_FIRSTNAME = YourName
- FIRST_ADMIN_LASTNAME = YourSurname

Optional (alternative bootstrap method)
- BOOTSTRAP_TOKEN = some-long-random-string (used to allow registration beyond first user if ALLOW_PUBLIC_REGISTRATION is not set)
- ALLOW_PUBLIC_REGISTRATION = false (default). Set true only if you want open registration in non-production.

Notes
- When SEED_MODE=minimal, the seed script creates only: permissions, roles, packaging options, and a first admin user if FIRST_ADMIN_* is set. No sample data is added.
- You can also set CLEAN_SEED=true instead of SEED_MODE=minimal.

### 2) Prepare the database
- Run migrations (or push schema) against your production database URL:
  - npm run db:migrate:deploy
  - or: npm run db:push (if not using migrations)

### 3) Run a minimal seed (optional but recommended)
- With your production env loaded, run:
  - npm run db:seed:minimal
- If you provided FIRST_ADMIN_* vars, a first admin user will be created.

### 4) Build and start
- npm run prisma:generate
- npm run build
- npm run start

### 5) First login and setup
- Log in using the FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD you configured.
- Create additional users/roles if needed.
- Add stores, items, customers, etc., via the admin interface.

### 6) Safety checks
- Ensure JWT_SECRET is unique and strong.
- Confirm HTTPS is used in production so cookies are secure.
- Verify basic pages and endpoints respond (e.g., /api/auth/status).

### 7) Reset to clean data later (destructive!)
- If you previously loaded demo data, back up first, then reset and reseed minimally:
  - npm run db:reset
  - npm run db:seed:minimal
  - Only perform this in non-prod or during a planned maintenance window.
