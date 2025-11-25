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
    API (Hono)           Next.js Web
         │                    │
         ├────────────────────┤
         │                    │
    [Upstash Redis]      [Supabase]
                         REST API
```

**Key insight:** Supabase REST API + Workers = No connection pooling needed!

**Note:** The API worker handles both URL creation (`POST /api/shorten`) and redirects (`GET /:code`) in a single service.

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
# Create .env at repository root
cat > .env << 'EOF'
# Database Configuration (Supabase)
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...

# Redis Configuration (Upstash)
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=xxx
REDIS_TTL_SECONDS=86400

# QR Service (Optional)
QR_SERVICE_URL=https://qr-service.example

# Next.js Web App
NEXT_PUBLIC_API_URL=https://qr-shortener-api.your-subdomain.workers.dev
EOF

# Run migrations (uses PostgreSQL connection)
cd apps/api
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

✅ **Already configured!** The API now uses Supabase REST API by default.

See [server.ts:8](apps/api/src/server.ts#L8):
```typescript
import { createUrl, findUrlByCode, incrementClick } from "./db-supabase.js";
```

### 3.3 Create wrangler.toml

✅ **Already created!** See [apps/api/wrangler.toml](apps/api/wrangler.toml):
```toml
name = "qr-shortener-api"
main = "src/server.ts"
compatibility_date = "2025-11-24"
compatibility_flags = ["nodejs_compat"]

[vars]
PUBLIC_BASE_URL = "https://qr-shortener-api.your-subdomain.workers.dev"

# Secrets (set via wrangler secret put):
# SUPABASE_URL
# SUPABASE_SERVICE_KEY
# REDIS_URL
# REDIS_TOKEN
# QR_SERVICE_URL (optional)
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

## Step 4: Deploy Web to Cloudflare Workers

✅ **Already configured!** Your Next.js app is ready to deploy to Workers using OpenNext.

### Configuration Files

- [open-next.config.ts](apps/web/open-next.config.ts) - OpenNext configuration
- [wrangler.toml](apps/web/wrangler.toml) - Cloudflare Worker configuration
- [package.json](apps/web/package.json) - Updated with OpenNext scripts

### Deploy

```bash
cd apps/web

# Build Next.js app for Workers
npm run build

# Preview locally (optional)
npm run preview

# Deploy to Cloudflare Workers
npm run deploy
```

**Note:** Before deploying, update the `NEXT_PUBLIC_API_URL` in [.env](.env) at the repository root with your actual API Worker URL.

---

## Step 5: Deployment Verification Checklist

### Pre-Deployment
- [ ] Supabase project created and migrations run
- [ ] Upstash Redis database created
- [ ] All secrets configured in wrangler (use `wrangler secret put`)
- [ ] Updated Worker URLs in wrangler.toml files

### Deploy Services

```bash
# 1. Deploy API Worker
cd apps/api
wrangler deploy

# 2. Deploy Web Worker
cd ../web
npm run build
npm run deploy
```

### Post-Deployment Testing

**Test API:**
```bash
curl -X POST https://qr-shortener-api.your-subdomain.workers.dev/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"long_url": "https://google.com", "content_type": "url"}'

# Expected response:
# {"code":"abc123","short_url":"https://...workers.dev/abc123","qr_url":"...","content_type":"url"}
```

**Test Web UI:**
1. Open `https://qr-shortener-web.your-subdomain.workers.dev`
2. Enter a URL and generate QR code
3. Verify QR code displays and short URL is created

**Test Redirects (via API Worker):**
Visit `https://qr-shortener-api.your-subdomain.workers.dev/abc123` → Should redirect to Google

**Test Content Types:**
```bash
# Test vCard
curl -X POST https://qr-shortener-api.your-subdomain.workers.dev/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"long_url":"https://example.com","content_type":"vcard","qr_data":{"name":"John Doe","phone":"+1234567890"}}'

# Test WiFi
curl -X POST https://qr-shortener-api.your-subdomain.workers.dev/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"long_url":"https://example.com","content_type":"wifi","qr_data":{"ssid":"MyWiFi","password":"secret123","encryption":"WPA"}}'
```

### Verification Checklist
- [ ] API responds to `/api/shorten` requests
- [ ] API responds to `/api/resolve/:code` requests
- [ ] API responds to `/:code` requests (redirects short code to long URL)
- [ ] Web UI loads and renders correctly
- [ ] QR codes are generated (check `qr_url` in response)
- [ ] Redis caching works (check logs for cache hits)
- [ ] All content types work (url, vcard, wifi, email, sms)
- [ ] QR customization works (colors, error correction)

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

The API worker handles both URL creation and redirects - no separate redirector worker needed!

---

## Next Steps

**Your repository is now fully configured for Cloudflare Workers deployment!**

### ✅ Completed Configuration
1. ✅ OpenNext adapter installed and configured
2. ✅ Next.js build scripts updated
3. ✅ API updated to use Supabase REST API
4. ✅ Wrangler configurations created for both Web and API
5. ✅ Deployment verification checklist ready

### 🚀 Ready to Deploy
1. Set up Supabase project and run migrations
2. Create Upstash Redis database
3. Configure secrets using `wrangler secret put`
4. Deploy using the commands in Step 5
5. 🎉 Enjoy sub-50ms global latency!

### 📂 Key Files Updated
- [apps/web/open-next.config.ts](apps/web/open-next.config.ts) - OpenNext configuration
- [apps/web/wrangler.toml](apps/web/wrangler.toml) - Web Worker config
- [apps/web/package.json](apps/web/package.json) - Updated build scripts
- [apps/api/wrangler.toml](apps/api/wrangler.toml) - API Worker config
- [apps/api/src/server.ts](apps/api/src/server.ts) - Now uses Supabase REST API

---

## Sources

- [Cloudflare Workers Next.js Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext Cloudflare Adapter](https://opennext.js.org/cloudflare)
- [Supabase with Cloudflare Workers](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/)
- [Supabase API Keys Update (Nov 2025)](https://github.com/orgs/supabase/discussions/29260)
