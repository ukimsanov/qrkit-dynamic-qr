# Dynamic QR Code + URL Shortener

A high-performance **dynamic QR code** service with real-time analytics. Update QR code destinations without reprinting—the same architecture used by Google Pay, Bitly, and QR Tiger.

**Live Demo:** [w.ularkimsanov.com](https://w.ularkimsanov.com)

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Frontend                                                          │
│  Next.js 16 + React 19 (Cloudflare Workers)                       │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  API (Hono 4.10)           Cloudflare Workers Edge Network        │
│                                                                    │
│  POST /api/shorten         Create short URL + QR code             │
│  PATCH /api/:code          Update destination (dynamic QR!)       │
│  GET /:code                302 redirect + analytics               │
│  GET /api/analytics/:code  Real-time scan analytics               │
└──────────┬─────────────────────┬─────────────────────┬─────────────┘
           │                     │                     │
           ▼                     ▼                     ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────────────┐
    │  Supabase   │      │   Upstash   │      │   AWS Lambda        │
    │  PostgreSQL │      │   Redis     │      │   Java 17 + ZXing   │
    │             │      │   (cache)   │      │   QR Generation     │
    └─────────────┘      └─────────────┘      └─────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16.0.4, React 19.2.0, Tailwind CSS v4, Framer Motion, SWR, Recharts |
| API | Hono 4.10.6 on Cloudflare Workers |
| Database | Supabase (PostgreSQL) |
| Cache | Upstash Redis (24hr TTL, 10-50ms redirects) |
| QR Generator | Java 17, ZXing 3.5.3, AWS Lambda |

## Features

- **Dynamic QR Codes** — Update destinations without reprinting
- **Real-time Analytics** — Track scans by device, location, country, time
- **Edge Computing** — Sub-50ms redirects via Cloudflare Workers (300+ locations)
- **302 Redirects** — Temporary redirects enable dynamic updates
- **Custom Short Codes** — Optional aliases (max 7 chars)
- **Expiration Support** — Auto-expire links after specified time

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add: SUPABASE_URL, SUPABASE_SERVICE_KEY, REDIS_URL, REDIS_TOKEN

# 3. Run database migrations
cd apps/api && npm run migrate:up

# 4. Start development servers
cd apps/api && npx wrangler dev    # API on :8787
cd apps/web && npm run dev         # Web on :3000
```

## API Reference

### Create Short URL
```bash
POST /api/shorten
{
  "long_url": "https://example.com",
  "alias": "custom",        # optional, max 7 chars
  "expires_at": "2025-12-31T00:00:00Z"  # optional
}

# Response
{
  "code": "abc1234",
  "short_url": "https://b.ularkimsanov.com/abc1234",
  "qr_url": "data:image/png;base64,..."
}
```

### Update Destination (Dynamic QR)
```bash
PATCH /api/:code
{ "long_url": "https://newdestination.com" }

# Same QR code now redirects to new URL
```

### Get Analytics
```bash
GET /api/analytics/:code

# Response
{
  "total_scans": 127,
  "scans_today": 23,
  "devices": { "mobile": 89, "desktop": 32, "tablet": 6 },
  "top_countries": [{ "country": "US", "count": 45 }],
  "scans_over_time": [{ "date": "2025-12-01", "count": 18 }]
}
```

## Project Structure

```
apps/
├── web/                    Next.js frontend
│   ├── app/
│   │   ├── page.tsx        Home (URL shortener form)
│   │   └── analytics/      Per-QR analytics dashboard
│   └── components/
│       ├── qr-preview.tsx  QR display with states
│       └── ui/             shadcn/ui components
│
├── api/                    Hono API
│   ├── src/
│   │   ├── index.ts        All endpoints
│   │   └── codegen.ts      Short code generation
│   └── migrations/         PostgreSQL migrations
│
└── qr-generator/           Java QR generator
    └── src/main/java/com/qrgen/
        ├── QRCodeGenerator.java   ZXing wrapper
        └── LambdaHandler.java     AWS Lambda handler
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| 302 redirects | Allows dynamic URL updates (browsers don't cache) |
| Fire-and-forget analytics | Uses `waitUntil()` to not block redirects |
| 7-char base62 codes | 3.5 trillion combinations via `crypto.randomBytes()` |
| Redis caching | 80%+ cache hit rate, 10-50ms redirect latency |
| QR version 3 max | 53 bytes (BYTE) / 77 chars (ALPHANUMERIC) capacity |

## Deployment

```bash
# Deploy API to Cloudflare Workers
cd apps/api && npx wrangler deploy

# Deploy Web to Cloudflare Workers
cd apps/web && npm run build:worker && npm run deploy

# Deploy QR Generator to AWS Lambda
cd apps/qr-generator && mvn clean package
# Upload target/qr-generator-lambda.jar to Lambda
```

## License

MIT
