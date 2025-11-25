# QR Code + URL Shortener

High-performance URL shortening service with QR code generation, deployed on Cloudflare Workers edge network.

## Architecture

```
┌─────────────────┐
│  Next.js 16.0.4 │  User creates short URL + QR code
│ (Cloudflare)    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Hono API      │  URL shortening + QR orchestration + Redirects
│ (Cloudflare)    │  • POST /api/shorten - Create short URLs
└────────┬────────┘  • GET /:code - Redirect to long URL
         │
         ├─→ Supabase (PostgreSQL) - Persistent storage
         ├─→ Upstash Redis - 24hr cache for fast redirects
         └─→ QR Service - External microservice (optional)
```

**Key Feature**: Single API worker handles both creation and redirects using catch-all route.

## Tech Stack

- **Next.js 16.0.4** - React 19, App Router, deployed on Cloudflare Workers
- **Hono** - Ultra-fast web framework optimized for edge
- **Supabase (PostgreSQL)** - Persistent storage with REST API
- **Upstash Redis** - Serverless cache with global replication
- **Cloudflare Workers** - Global edge deployment (300+ locations)
- **TypeScript 5.6** - End-to-end type safety

## Repository Structure

```
apps/
├── api/          Hono API service (deployed to Workers)
│   ├── src/
│   └── migrations/
└── web/          Next.js frontend (deployed to Workers)
    └── app/
```

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase, Redis credentials

# Run database migrations
cd apps/api
npm run migrate:up

# Deploy to Cloudflare Workers
# API
cd apps/api
wrangler deploy

# Web (after setting NEXT_PUBLIC_API_URL in .env)
cd apps/web
npm run build:worker
npm run deploy
```

See [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) for detailed setup instructions.

## API Endpoints

- `POST /api/shorten` - Create short URL with QR code
- `GET /api/resolve/:code` - Resolve short code to long URL
- `POST /api/analytics/hit` - Record click event

## Key Design Decisions

See [DESIGN.md](DESIGN.md) for detailed system design rationale.

## Database Schema

See [DATABASE.md](DATABASE.md) for schema documentation.

## Environment Variables

All environment variables are stored in [.env](.env) at the repository root. Use [.env.example](.env.example) as a template.

### Required Variables
```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres.xxx:pass@aws-0-us-east-2.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Cache (Upstash Redis)
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=xxx
REDIS_TTL_SECONDS=86400

# Next.js Web App
NEXT_PUBLIC_API_URL=https://qr-shortener-api.your-account.workers.dev
```

### Optional Variables
```env
# QR Service (your teammate's implementation)
QR_SERVICE_URL=https://qr-service.example
```

### Cloudflare Secrets
Some sensitive values must be set as Cloudflare secrets:
```bash
cd apps/api
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put REDIS_URL
wrangler secret put REDIS_TOKEN
```

## License

MIT
