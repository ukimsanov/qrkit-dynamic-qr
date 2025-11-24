# QR Shortener (Cloudflare Worker + TS API + Postgres + Redis)

Architecture
- Edge redirector: Cloudflare Worker (apps/worker) → Upstash Redis → API resolve → 301.
*- API service: Fastify + TypeScript (apps/api) → Postgres (Supabase/Neon) for persistence, Upstash Redis for cache/rate limits, Java QR service for PNG/SVG.
- Web app: Next.js + TS + Tailwind (apps/web) for create + view.
- QR encoder: separate Java service (`POST /qr`) returning PNG/SVG.

Data model (Postgres)
- `urls(id uuid default gen_random_uuid(), short_code unique, long_url, alias unique?, created_at timestamptz default now(), expires_at?, qr_status, qr_url?)`
- `click_totals(short_code pk/fk, total_clicks bigint default 0, updated_at timestamptz)`

Redis keys (Upstash, Workers SDK compatible)
- `r:<code>` -> long_url (TTL ~24h)
- `rc:<code>` -> optional hot counter
- `rl:create:<ip>` -> optional rate-limit

Key generation
- Random base62 (generateCode) length 7; retry on unique violation. Custom alias honored. Avoid MD5 truncation and distributed counters.

Flows
1) Create: Web → API `/api/shorten` → generate code → insert DB → call QR service → return `{ short_url, qr_url? }` and warm Redis.
2) Redirect: User → Worker `/{code}` → Redis hit? redirect : API resolve → cache → redirect; send best-effort analytics hit.
3) Analytics: API increments `click_totals` (simple upsert).

Repo layout
- `apps/web/` — Next.js frontend (App Router, Tailwind).
- `apps/api/` — Fastify API (TS) with Postgres/Redis/QR helpers.
- `apps/worker/` — Cloudflare Worker (TS) with Upstash REST.

Env (apps/api/.env)
- `DATABASE_URL` Postgres connection string
- `PUBLIC_BASE_URL` e.g., `https://url-shortner.workers.dev`
- `REDIS_URL`, `REDIS_TOKEN` from Upstash Redis
- `QR_SERVICE_URL` Java QR service base URL (optional; best-effort)
- `REDIS_TTL_SECONDS` cache TTL (default 86400)

Deploy reminders
- Worker: set `API_BASE_URL` and bind Upstash Redis creds as secrets/vars via Wrangler.
- API: set envs above; expose over HTTPS so Worker can reach it.
- Web: point form calls to API.
