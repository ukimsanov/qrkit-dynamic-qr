# Quick Start Guide 🚀

Get your QR Code + URL Shortener running in 5 minutes!

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Set Up Database & Redis

### Option A: Use Supabase (Free)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy the connection string from Settings → Database

### Option B: Use Neon (Free)
1. Go to [neon.tech](https://neon.tech)
2. Create new project
3. Copy the connection string

### Set Up Upstash Redis (Free)
1. Go to [console.upstash.com](https://console.upstash.com)
2. Create new Redis database
3. Copy **REST URL** and **REST TOKEN**

---

## Step 3: Configure API

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
PUBLIC_BASE_URL=http://localhost:3001
REDIS_URL=https://YOUR-UPSTASH.upstash.io
REDIS_TOKEN=YOUR_TOKEN_HERE
REDIS_TTL_SECONDS=86400
```

---

## Step 4: Run Migrations

```bash
cd apps/api
npm run migrate:up
```

---

## Step 5: Start Everything

```bash
# Terminal 1: API (port 3001)
cd apps/api
npm run dev

# Terminal 2: Web (port 3000)
cd apps/web
npm run dev
```

---

## Step 6: Test It!

1. Open [http://localhost:3000](http://localhost:3000)
2. Enter a long URL: `https://example.com/very/long/path?with=params`
3. Click "Create short URL"
4. You'll get: `http://localhost:3001/aB3xY9z`

---

## Optional: Deploy Cloudflare Worker

```bash
cd apps/worker

# Set secrets
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler secret put API_BASE_URL

# Deploy
npm run deploy
```

---

## Troubleshooting

**"Cannot connect to database"**
- Verify `DATABASE_URL` in `apps/api/.env`
- Test connection: `psql $DATABASE_URL`

**"Redis error"**
- Check `REDIS_URL` and `REDIS_TOKEN` are correct
- Verify Redis instance is active in Upstash dashboard

**"API returns 404"**
- Make sure API is running on port 3001
- Check `apps/api/.env` has all required variables

---

## What You Get

✅ **Short URLs** - `https://short.link/abc123`
✅ **Custom Aliases** - `https://short.link/my-link`
✅ **Click Analytics** - Track total clicks per URL
✅ **URL Expiration** - Set expiry dates
✅ **QR Codes** - When your teammate's QR service is ready
✅ **Edge Redirects** - Fast global redirects via Cloudflare
✅ **Redis Caching** - 24-hour cache for speed

---

## Architecture

```
┌─────────────┐
│  Next.js 16 │  ← User creates short URL
│  (Port 3000)│
└──────┬──────┘
       │ Proxy /api/*
       ↓
┌─────────────┐
│  Fastify 5  │  ← URL shortening logic
│  (Port 3001)│
└──────┬──────┘
       │
       ├─→ Postgres (persistent storage)
       ├─→ Redis (cache, 24hr TTL)
       └─→ QR Service (optional, your teammate)

┌──────────────────┐
│ Cloudflare Worker│  ← User clicks short URL
│   (Global Edge)  │
└──────┬───────────┘
       │
       ├─→ Redis (check cache)
       ├─→ API (if cache miss)
       └─→ 301 Redirect!
```

---

## Tech Stack

- **Next.js 16.0.4** - Latest, released Nov 24, 2025
- **React 19.2.0** - Latest stable
- **Fastify 5.0.0** - 5-10% faster than v4
- **PostgreSQL** - Persistent storage
- **Upstash Redis** - Serverless cache
- **Cloudflare Workers** - Edge compute
- **Tailwind CSS 4** - Modern styling

---

## Need Help?

📖 **Full Setup Guide:** See [SETUP.md](./SETUP.md)
🔧 **Changes Applied:** See [CHANGES.md](./CHANGES.md)
📋 **Architecture Details:** See [README.md](./README.md)

---

**You're all set!** 🎉
