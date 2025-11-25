# Deployment Guide

## Quick Start (Free Tier)

### 1. Database - Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Wait ~2 minutes for provisioning
4. Go to **Settings → Database**
5. Copy **Connection string (Pooler)** - Use "Transaction" mode
   - Format: `postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres`
6. Save as `DATABASE_URL`

### 2. Redis - Upstash

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create new Redis database
3. Region: Choose closest to your API deployment
4. Copy **REST URL** and **REST TOKEN** from the REST API section
5. Save both values

### 3. Run Migrations

```bash
cd apps/api

# Create .env with your values
cat > .env << 'ENVFILE'
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
PUBLIC_BASE_URL=https://your-api.railway.app
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=xxx
REDIS_TTL_SECONDS=86400
ENVFILE

# Run migrations
npm run migrate:up
```

### 4. API - Railway

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Configure:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
6. Add environment variables:
   ```
   DATABASE_URL=<from Supabase>
   PUBLIC_BASE_URL=https://your-api.railway.app (update after deployment)
   REDIS_URL=<from Upstash>
   REDIS_TOKEN=<from Upstash>
   REDIS_TTL_SECONDS=86400
   PORT=3001
   ```
7. Deploy and copy the URL (e.g., `https://your-api.railway.app`)
8. Update `PUBLIC_BASE_URL` with the Railway URL

### 5. Web - Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Import your repo
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: Leave default
   - **Install Command**: Leave default
6. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.railway.app
   ```
7. Deploy

### 6. Worker - Cloudflare (Optional)

```bash
cd apps/worker

# Set secrets
npx wrangler secret put UPSTASH_REDIS_REST_URL
# Paste your Upstash REST URL

npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
# Paste your Upstash REST TOKEN

npx wrangler secret put API_BASE_URL
# Paste: https://your-api.railway.app

# Deploy
npm run deploy
```

---

## Test Your Deployment

### 1. Test API directly
```bash
curl -X POST https://your-api.railway.app/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"long_url": "https://google.com"}'

# Expected response:
# {"code":"abc123","short_url":"https://your-api.railway.app/abc123","qr_url":null,"content_type":"url"}
```

### 2. Test Web UI
- Open your Vercel URL (e.g., `https://your-app.vercel.app`)
- Enter a URL
- Click "Create URL QR Code"
- You should get a short URL

### 3. Test Redirect
- Click the short URL
- Should redirect to the long URL

---

## Alternative Deployment Options

### API Alternatives
- **Fly.io** - Similar to Railway, free tier
- **Render** - Free tier with 750 hours/month
- **Heroku** - No free tier anymore

### Web Alternatives
- **Netlify** - Similar to Vercel
- **Cloudflare Pages** - Free, fast

### Database Alternatives
- **Neon** - Serverless Postgres, generous free tier
- **Supabase** - 500MB storage, 2GB transfer/month free

---

## Environment Variables Summary

### API (.env)
```env
DATABASE_URL=postgresql://...
PUBLIC_BASE_URL=https://your-api.railway.app
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=xxx_token
REDIS_TTL_SECONDS=86400
PORT=3001
QR_SERVICE_URL=  # Leave empty until teammate deploys
```

### Web (Vercel)
```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

### Worker (Cloudflare Secrets)
```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx_token
API_BASE_URL=https://your-api.railway.app
```

---

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL is the **pooler** URL with port 6543
- Verify password is correct
- Check if IP is whitelisted (Supabase allows all by default)

### "Redis error"
- Verify REDIS_URL and REDIS_TOKEN are from the **REST API** section
- Test Redis: `curl https://xxx.upstash.io/get/test -H "Authorization: Bearer xxx_token"`

### "API returns 404"
- Check Railway logs for errors
- Verify PORT=3001 is set
- Check build succeeded

### "Web can't reach API"
- Verify NEXT_PUBLIC_API_URL matches Railway URL
- Check CORS is enabled in API (it is by default)
- Redeploy Web after changing env vars

---

## Cost Estimate (Monthly)

| Service | Free Tier | Usage |
|---------|-----------|-------|
| Supabase | 500MB DB | ✅ Plenty |
| Upstash | 10K commands/day | ✅ ~300/day expected |
| Railway | $5 credit/month | ✅ ~$3-5 usage |
| Vercel | 100GB bandwidth | ✅ Light usage |
| Cloudflare | 100K requests/day | ✅ Way under |

**Total: $0-5/month** for testing/demo

---

## Production Checklist

Before going live:
- [ ] Remove `origin: "*"` from CORS, whitelist domains
- [ ] Add rate limiting (Upstash Rate Limit)
- [ ] Set up monitoring (Railway metrics, Sentry)
- [ ] Add custom domain
- [ ] Enable HTTPS redirect
- [ ] Add analytics dashboard
- [ ] Deploy QR service (teammate)
- [ ] Test all content types (vCard, WiFi, etc.)
- [ ] Load test with `wrk` or `k6`
- [ ] Set up backups (Supabase auto-backups)
- [ ] Add error tracking
