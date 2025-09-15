## Local and Production Setup

This app uses Next.js 15, Prisma, and PostgreSQL. Auth is JWT via HttpOnly cookie.

### 1) Prereqs
- Node 18+ and npm
- Docker (for local Postgres)

### 2) Configure env
- Copy .env.example to .env.local and adjust as needed.

### 3) Start local Postgres
- Start the DB: docker compose up -d
- DB URL used by default: postgresql://stocktake:stocktake@localhost:5433/stocktake?schema=public

### 4) Install + migrate + seed
- Install deps: npm install
- Push schema: npm run db:push
- Seed data: npm run db:seed

### 5) Run dev
- Start: npm run dev
- Health: http://localhost:3000/api/health
- Login: admin@stocktake.com / admin123

### Vercel deployment
1) Create a Postgres DB (e.g., Neon, Supabase, Railway) and get a DATABASE_URL (ssl required).
2) In Vercel Project Settings > Environment Variables, add:
	- DATABASE_URL = postgresql://... (with sslmode=require if needed)
	- JWT_SECRET = strong random secret
	- NODE_ENV = production
3) Deploy. On first deploy, run a one-time migration via Vercel CLI or run a job locally:
	- Locally: set DATABASE_URL to prod DB, then run `npm run db:push` and `npm run db:seed` once.
4) Visit your site. Health at /api/health.

Notes
- Middleware protects non-API routes; /login is public and redirects if already authenticated.
- All client fetches to protected APIs include credentials and no-store cache.
