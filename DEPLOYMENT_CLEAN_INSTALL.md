## Production deployment (clean install, no sample data)

This guide explains how to deploy with an empty database (no demo stores/customers/items) so your client can set everything up from scratch.

### 1) Environment variables
Required
- DATABASE_URL = postgresql://user:pass@host:port/db?sslmode=require
- JWT_SECRET = a long, random secret for signing auth tokens
- NODE_ENV = production

Optional (recommended to create first admin during seed)
- SEED_MODE = minimal
- FIRST_ADMIN_EMAIL = you@example.com
- FIRST_ADMIN_PASSWORD = strong_password
- FIRST_ADMIN_FIRSTNAME = YourName
- FIRST_ADMIN_LASTNAME = YourSurname

Notes
- When SEED_MODE=minimal, the seed script creates only: permissions, roles, packaging options, and a first admin user if FIRST_ADMIN_* is set. No sample data is added.
- You can also set CLEAN_SEED=true instead of SEED_MODE=minimal.

### 2) Prepare the database
- Run migrations (or push schema) against your production database URL:
  - npx prisma db push
  - or: npx prisma migrate deploy (if you manage migrations)

### 3) Run a minimal seed
- With your production env loaded, run:
  - SEED_MODE=minimal npm run db:seed
- If you provided FIRST_ADMIN_* vars, a first admin user will be created.

### 4) Start the app
- Build: npm run build
- Start: npm run start

### 5) First login and setup
- Log in with FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD.
- Create additional users/roles if needed.
- Add stores, inventory items, customers, etc., via the admin interface.

### 6) Safety checks
- Ensure JWT_SECRET is unique per environment.
- Confirm HTTPS is used in production so cookies (HttpOnly) are secure.
- Verify /api/health loads and pages render.

### 7) Optional: switching from demo to clean later
- If you previously seeded demo data, back up first, then reset and reseed minimally:
  - prisma migrate reset --force
  - SEED_MODE=minimal npm run db:seed
  - This will wipe data. Only do this on non-prod or during a planned maintenance window.
