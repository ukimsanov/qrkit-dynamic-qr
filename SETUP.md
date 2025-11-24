# Setup Guide

## Prerequisites

- Node.js 20+ installed
- PostgreSQL database (local or hosted like Supabase/Neon)
- Upstash Redis account (free tier available)
- Cloudflare account (for Worker deployment)

---

## 1. Clone and Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

---

## 2. API Service Setup

### Configure Environment Variables

Create `apps/api/.env`:

```bash
# Copy example file
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your values:

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
PUBLIC_BASE_URL=http://localhost:3001
REDIS_URL=https://YOUR-REDIS.upstash.io
REDIS_TOKEN=YOUR_REDIS_TOKEN
QR_SERVICE_URL=  # Optional: Your QR service endpoint
REDIS_TTL_SECONDS=86400
```

### Run Database Migrations

```bash
cd apps/api

# Run migrations to create tables
npm run migrate:up
```

### Start API Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

API will be available at `http://localhost:3001`

**Test it:**
```bash
curl http://localhost:3001/api/shorten \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"long_url": "https://example.com/very/long/url"}'
```

---

## 3. Web App Setup

### Configure Environment (Optional)

For production, create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

For development, the rewrite defaults to `http://localhost:3001`.

### Start Next.js Dev Server

```bash
cd apps/web
npm run dev
```

Web app will be available at `http://localhost:3000`

---

## 4. Cloudflare Worker Setup

### Configure Secrets

```bash
cd apps/worker

# Set environment secrets
wrangler secret put UPSTASH_REDIS_REST_URL
# Paste: https://YOUR-REDIS.upstash.io

wrangler secret put UPSTASH_REDIS_REST_TOKEN
# Paste: YOUR_REDIS_TOKEN

wrangler secret put API_BASE_URL
# For production: https://api.yourdomain.com
# For dev: http://localhost:3001
```

### Deploy Worker

```bash
# Development
npm run dev

# Production
npm run deploy
```

---

## 5. Upstash Redis Setup

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the **REST URL** and **REST TOKEN**
4. Use these in your `.env` files

**Free Tier:** 500K commands/month ([Pricing](https://upstash.com/pricing/redis))

---

## 6. Database Migration Commands

```bash
cd apps/api

# Run all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create my-migration-name
```

New migrations are created in `apps/api/migrations/` with timestamp prefixes.

---

## Architecture Overview

```
User Creates Short URL:
  Next.js (localhost:3000)
    → Proxy /api/* to API
    → Fastify API (localhost:3001)
    → Postgres (persistent storage)
    → Redis (cache)
    → QR Service (optional)
    → Returns: { code, short_url, qr_url }

User Clicks Short URL:
  Cloudflare Worker (edge)
    → Check Redis cache
      → HIT: Redirect immediately
      → MISS: Call API → Cache result → Redirect
    → Track analytics (fire-and-forget)
```

---

## Verification Checklist

- [ ] API responds at `http://localhost:3001/api/shorten`
- [ ] Database migrations ran successfully
- [ ] Redis cache is accessible
- [ ] Next.js app loads at `http://localhost:3000`
- [ ] Can create short URLs via web UI
- [ ] Cloudflare Worker deploys successfully
- [ ] Short URL redirects work

---

## Common Issues

### "DATABASE_URL is not defined"
Make sure `apps/api/.env` exists with valid `DATABASE_URL`.

### "Cannot connect to Redis"
Verify `REDIS_URL` and `REDIS_TOKEN` in `apps/api/.env`. Check Upstash dashboard.

### "Migration failed: uuid-ossp extension"
Run as superuser or ask your DB admin to enable the extension:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### "Next.js /api/shorten returns 404"
Ensure API is running on port 3001 and `next.config.ts` rewrites are configured.

---

## Production Deployment

### API Service
- Deploy to any Node.js hosting (Fly.io, Railway, Render, etc.)
- Set all environment variables
- Run `npm run migrate:up` on first deployment
- Ensure port 3001 (or custom) is exposed

### Next.js Web App
- Deploy to Vercel, Netlify, or Cloudflare Pages
- Set `NEXT_PUBLIC_API_URL` to your API URL
- Build command: `npm run build`
- Start command: `npm start`

### Cloudflare Worker
- Deploy via `wrangler deploy`
- Set all secrets (see step 4 above)
- Configure custom domain in Cloudflare dashboard

---

## Technologies Used

- **Next.js 16.0.4** - Frontend ([Release Notes](https://nextjs.org/blog/next-16))
- **Fastify 5.0.0** - API Server ([GitHub](https://github.com/fastify/fastify))
- **PostgreSQL** - Database
- **Upstash Redis** - Cache ([Pricing](https://upstash.com/pricing/redis))
- **Cloudflare Workers** - Edge redirector
- **node-pg-migrate** - Database migrations ([Docs](https://salsita.github.io/node-pg-migrate/))

---

## Sources

- [Next.js 16 Release](https://nextjs.org/blog/next-16)
- [Upstash Redis Pricing](https://upstash.com/pricing/redis)
- [node-pg-migrate Documentation](https://salsita.github.io/node-pg-migrate/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
