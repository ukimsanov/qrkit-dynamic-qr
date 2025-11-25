# Deploy Everything to Cloudflare (November 2025)

Complete guide to deploy your entire stack on Cloudflare using modern tools.

## Why Cloudflare for Everything?

✅ **Performance**: 15-50ms p99 latency globally
✅ **Cost**: Free tier handles 100K+ requests/day
✅ **Simplicity**: Single platform for all services
✅ **Scale**: Auto-scales to millions of requests
✅ **DDoS Protection**: Built-in

---

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│         Cloudflare Global Network            │
│  (300+ locations, auto-scales, zero-config) │
└──────────────────────────────────────────────┘
         │                    │
    [Workers]            [Pages/Workers]
    Redirector           Next.js Web
         │                    │
         ├────────────────────┤
         │                    │
    [Workers]            [Supabase]
    API (Fastify)        REST API
         │
    [Upstash Redis]
```

**Key insight:** Supabase REST API + Workers = No connection pooling needed!

---

## Prerequisites

1. **Cloudflare account** (free)
2. **Supabase account** (free tier)
3. **Upstash account** (free tier)
4. **Wrangler CLI**:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

---

## Step 1: Set Up Supabase

### 1.1 Create Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Wait 2 minutes for provisioning

### 1.2 Get API Keys

Go to **Settings → API**:

```
Project URL: https://xxx.supabase.co
API Key (publishable): sb_publishable_xxx
Secret Key: eyJhbG...
```

**Important:** As of Nov 1, 2025:
- ✅ Use **publishable key** (replaces old "anon" key)
- ✅ Use **secret key** (replaces old "service_role" key)

### 1.3 Run Migrations

```bash
cd apps/api

# Create .env with Supabase REST API credentials
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...
PUBLIC_BASE_URL=https://api-worker.your-subdomain.workers.dev
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=xxx
REDIS_TTL_SECONDS=86400
EOF

# Run migrations (uses PostgreSQL connection)
npm run migrate:up
```

---

## Step 2: Set Up Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create new Redis database
3. Region: **Global** (replicated to multiple regions)
4. Copy **REST URL** and **REST TOKEN**

---

## Step 3: Deploy API to Workers

### 3.1 Choose Database Method

**Option A: Supabase REST API (Recommended)** ✅

```typescript
// Use db-supabase.ts - no connection pooling needed
import { createUrl, findUrlByCode } from './db-supabase.js';
```

**Option B: Direct PostgreSQL** (requires Hyperdrive)

```typescript
// Use db.ts - needs connection pooling
import { createUrl, findUrlByCode } from './db.js';
```

We'll use **Option A** (Supabase REST API).

### 3.2 Update server.ts to use Supabase

```bash
cd apps/api/src
```

Change import in [server.ts](apps/api/src/server.ts):
```typescript
// Before:
import { createUrl, findUrlByCode, incrementClick } from "./db.js";

// After:
import { createUrl, findUrlByCode, incrementClick } from "./db-supabase.js";
```

### 3.3 Create wrangler.toml

```bash
cd apps/api
cat > wrangler.toml << 'EOF'
name = "qr-api"
main = "src/server.ts"
compatibility_date = "2025-11-24"

[vars]
PUBLIC_BASE_URL = "https://qr-api.your-subdomain.workers.dev"

# Secrets (set via wrangler secret put)
# SUPABASE_URL
# SUPABASE_SERVICE_KEY
# REDIS_URL
# REDIS_TOKEN
# QR_SERVICE_URL (optional)
EOF
```

### 3.4 Set Secrets

```bash
wrangler secret put SUPABASE_URL
# Paste: https://xxx.supabase.co

wrangler secret put SUPABASE_SERVICE_KEY
# Paste: eyJhbG... (secret key from Supabase)

wrangler secret put REDIS_URL
# Paste: https://xxx.upstash.io

wrangler secret put REDIS_TOKEN
# Paste: your_upstash_token
```

### 3.5 Deploy

```bash
npm run build
wrangler deploy
```

Copy the deployed URL: `https://qr-api.your-subdomain.workers.dev`

---

## Step 4: Deploy Web to Cloudflare

### Option A: Pages (Git Integration) - Easiest

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pages → Create project → Connect to Git
3. Select your repo
4. Configure:
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Build output**: `.next`
   - **Root directory**: `apps/web`
5. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://qr-api.your-subdomain.workers.dev
   ```
6. Deploy!

### Option B: Workers with OpenNext - More Control

```bash
cd apps/web

# Install OpenNext adapter
npm install --save-dev @opennextjs/cloudflare

# Create wrangler.toml
cat > wrangler.toml << 'EOF'
name = "qr-web"
compatibility_date = "2025-11-24"
pages_build_output_dir = ".vercel/output/static"

[vars]
NEXT_PUBLIC_API_URL = "https://qr-api.your-subdomain.workers.dev"
EOF

# Build and deploy
npm run build
wrangler deploy
```

---

## Step 5: Deploy Redirector Worker

```bash
cd apps/worker

# Set secrets
wrangler secret put UPSTASH_REDIS_REST_URL
# Paste: https://xxx.upstash.io

wrangler secret put UPSTASH_REDIS_REST_TOKEN
# Paste: your_upstash_token

wrangler secret put API_BASE_URL
# Paste: https://qr-api.your-subdomain.workers.dev

# Deploy
npm run deploy
```

---

## Step 6: Test Everything

### Test API
```bash
curl -X POST https://qr-api.your-subdomain.workers.dev/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"long_url": "https://google.com", "content_type": "url"}'

# Expected:
# {"code":"abc123","short_url":"https://qr-api.your-subdomain.workers.dev/abc123","qr_url":null,"content_type":"url"}
```

### Test Web
Open your Cloudflare Pages URL or Worker URL

### Test Redirect
Visit `https://your-worker.workers.dev/abc123` → Should redirect to Google

---

## Environment Variables Summary

### Supabase (from Dashboard)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...  # Secret key (replaces service_role)
```

### Upstash (from Dashboard)
```env
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=xxx
```

### API Worker Secrets
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put REDIS_URL
wrangler secret put REDIS_TOKEN
```

### Web (Pages or Worker)
```env
NEXT_PUBLIC_API_URL=https://qr-api.your-subdomain.workers.dev
```

### Redirector Worker
```bash
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler secret put API_BASE_URL
```

---

## Performance Comparison

| Metric | Railway + Vercel | All Cloudflare |
|--------|-----------------|----------------|
| **Latency (p99)** | 150-300ms | 30-80ms |
| **Cold start** | 200-500ms | 0ms (Workers) |
| **Global** | No (single region) | Yes (300+ locations) |
| **Cost** | $5-20/month | $0-5/month |
| **DDoS protection** | Extra $$$ | Included |
| **Auto-scale** | Manual | Automatic |

---

## Troubleshooting

### "SUPABASE_URL is not defined"
```bash
# Set as secret, not var
wrangler secret put SUPABASE_URL
```

### "Can't connect to Supabase"
- Check you're using the **Project URL** (not pooler URL)
- Verify **Secret Key** (not publishable key for admin operations)
- Test: `curl https://xxx.supabase.co/rest/v1/` -H "apikey: your_secret_key"`

### "Next.js build fails on Workers"
- Make sure you're using OpenNext adapter: `npm install --save-dev @opennextjs/cloudflare`
- Check Node.js runtime (not edge runtime): Remove `export const runtime = "edge"`

### "Worker exceeds CPU limit"
- Free tier: 10ms CPU
- Paid ($5/month): 50ms CPU
- Supabase REST API is fast (~5-10ms per query)
- If still exceeding: Upgrade to Workers Paid plan

---

## Cost Breakdown (Monthly)

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| **Supabase** | 500MB DB, 5GB transfer | 10K URLs, 100K requests | $0 |
| **Upstash** | 10K commands/day | ~300/day | $0 |
| **Cloudflare Workers** | 100K requests/day | ~3K/day | $0 |
| **Cloudflare Pages** | Unlimited | Static hosting | $0 |

**Total: $0/month** for up to 100K requests/day!

When you exceed free tier:
- Cloudflare Workers: $5/month + $0.50 per million requests
- Supabase Pro: $25/month (8GB DB, 250GB transfer)
- Upstash: Pay-as-you-go ($0.20 per 100K commands)

**At 1M requests/month: ~$5-10/month**

---

## Advantages of All-Cloudflare Architecture

### ✅ No Connection Pooling
Supabase REST API uses HTTP (fetch), not PostgreSQL protocol → Works perfectly on Workers

### ✅ Global Performance
- 300+ edge locations
- 15-50ms p99 latency
- No "cold starts"

### ✅ Simplified DevOps
- Single platform (no Railway + Vercel + Cloudflare)
- One dashboard for monitoring
- Unified billing

### ✅ Cost Efficiency
- Free tier handles 100K+ requests/day
- Pay-per-request pricing (no idle costs)
- No server management

### ✅ Auto-Scaling
- Handles traffic spikes automatically
- No manual scaling configuration
- DDoS protection included

---

## When NOT to Use This Architecture

❌ **You need PostgreSQL-specific features**:
- Full-text search (use Supabase, works via REST API)
- PostGIS (Supabase supports this!)
- Complex transactions (Supabase REST API has limitations)

❌ **Your QR service is Java**:
- Workers don't support Java
- Deploy QR service to Railway/Fly.io
- API calls it via HTTP (adds 50-100ms)

✅ **Solution**: Keep QR service on Railway, everything else on Cloudflare

---

## Migration from Railway/Vercel

### Phase 1: Migrate Web (Easy)
```bash
cd apps/web
wrangler pages deploy .next
```
No code changes needed!

### Phase 2: Update API to use Supabase REST API
```bash
# Change one line in server.ts
import { createUrl } from "./db-supabase.js";  # instead of "./db.js"
```

### Phase 3: Deploy API to Workers
```bash
cd apps/api
wrangler deploy
```

### Phase 4: Keep Redirector on Workers
Already done! ✅

---

## Next Steps

1. ✅ Deploy web to Cloudflare Pages
2. ✅ Update API to use `db-supabase.ts`
3. ✅ Deploy API to Workers
4. ✅ Test everything
5. 🎉 Enjoy sub-50ms global latency!

---

## Sources

- [Cloudflare Workers Next.js Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext Cloudflare Adapter](https://opennext.js.org/cloudflare)
- [Supabase with Cloudflare Workers](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/)
- [Supabase API Keys Update (Nov 2025)](https://github.com/orgs/supabase/discussions/29260)
