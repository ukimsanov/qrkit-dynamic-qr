# System Design: QR Code + URL Shortener

## Problem Statement

Design a globally distributed URL shortening service with QR code generation that:
- Handles high read traffic with low latency (<100ms p99)
- Supports custom aliases and QR code generation
- Scales to millions of URLs with collision-free short codes
- Provides click analytics

## Requirements

### Functional
- Generate short URLs from long URLs (7-character base62 codes)
- Support custom aliases (max 7 characters)
- Generate QR codes for each short URL
- Track click analytics
- Support URL expiration

### Non-Functional
- **Latency**: p99 < 100ms for redirects
- **Availability**: 99.9% uptime
- **Scalability**: Handle 10M URLs, 100M clicks/month
- **Consistency**: Eventual consistency acceptable for analytics

## High-Level Architecture

```
┌──────────┐     ┌─────────────────┐
│  Client  │────▶│   Hono API      │  • POST /api/shorten
└──────────┘     │ (Cloudflare)    │  • GET /:code (redirect)
                 └────────┬────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │  Redis  │     │ Postgres│     │   QR    │
    │ (Cache) │     │  (DB)   │     │ Service │
    └─────────┘     └─────────┘     └─────────┘
```

**Key Insight**: Single API worker handles both URL creation and redirects using catch-all route.

## Core Components

### 1. API Layer (Hono on Cloudflare Workers)
**Purpose**: URL creation, resolution, QR orchestration, and redirects

**Why Hono?**
- Ultra-lightweight (~12KB)
- Optimized for edge/Workers (faster than Express/Fastify)
- Native TypeScript support
- Middleware ecosystem (CORS, secure-headers)

**Why Cloudflare Workers?**
- 300+ data centers globally (p99 latency: 15-50ms)
- Native Upstash Redis integration
- Pay-per-request pricing (~$0.50 per million requests)
- No cold starts

**Architectural Simplification**:
- Single worker handles both creation (`POST /api/shorten`) and redirects (`GET /:code`)
- Eliminated separate redirector worker (simpler deployment, lower latency)

**Key Endpoints**:
- `POST /api/shorten` - Create URL + generate QR
- `GET /api/resolve/:code` - Resolve short code
- `POST /api/analytics/hit` - Increment click counter

**Collision Handling**:
```typescript
// Retry up to 3 times on unique constraint violation
for (let i = 0; i < 3; i++) {
  const code = generateCode(7); // Base62: 3.5 trillion combinations
  try {
    await createUrl({ shortCode: code, ... });
    break;
  } catch (err) {
    if (err.code === '23505') continue; // UNIQUE_VIOLATION
    throw err;
  }
}
```

**Why not MD5/Hash?**
- ❌ Risk of collisions (birthday paradox)
- ❌ Predictable codes (security concern)
- ✅ Random base62: cryptographically secure, collision probability ~0

---

### 2. Database (Supabase PostgreSQL)
**Purpose**: Persistent storage for URLs and analytics

**Schema Design**:
```sql
urls: (id, short_code UNIQUE, long_url, alias UNIQUE, created_at, expires_at, qr_status, qr_url)
click_totals: (short_code PK, total_clicks, updated_at) ON DELETE CASCADE
```

**Why PostgreSQL?**
- Strong consistency for URL creation (prevent duplicate codes)
- ACID transactions for atomic upserts
- JSON support for future extensibility (QR customization metadata)
- Mature ecosystem (Supabase, Neon offer generous free tiers)

**Index Strategy**:
- `short_code` UNIQUE index (B-tree) - O(log n) lookups
- `alias` UNIQUE index - Custom alias validation
- No index on `long_url` - Writes > Reads for this column

---

### 3. Cache Layer (Upstash Redis)
**Purpose**: High-speed cache for frequent redirects

**Why Upstash?**
- REST API (Cloudflare Worker compatible)
- Global replication (11 regions)
- Serverless pricing (500K commands/month free)
- 24-hour TTL balances freshness vs hit rate

**Cache Strategy**: Cache-aside pattern
```
Read: Check cache → Miss → Query DB → Store in cache → Return
Write: Update DB → Invalidate/warm cache
```

**Key Design**:
- `r:<code>` → long_url (TTL: 86400s)
- No cache for analytics (eventual consistency acceptable)

**Why 24-hour TTL?**
- ✅ High hit rate (80-90% of traffic is repeat clicks)
- ✅ Handles URL updates within reasonable time
- ❌ Alternative: No expiry + manual invalidation (complex)

---

### 4. QR Service (External Microservice)
**Purpose**: Generate QR codes for short URLs

**Why separate service?**
- Teammate owns implementation
- Language isolation (allows use of specialized QR libraries)
- Failure isolation (best-effort QR generation)

**Simplified API Contract**:
```json
POST /qr
{
  "content": "https://short.link/abc123x"
}

Response: { "qr_url": "https://cdn.../qr.png" }
```

**Simplifications**:
- Only generates QR for the short URL itself (not custom content)
- No customization options (removed colors, error correction, size)
- ~33 byte payload for 7-character short codes

**Failure Handling**:
- QR generation is **best-effort** (non-blocking)
- If QR service is down: `qr_status = "failed"`, `qr_url = null`
- User still gets short URL (core functionality preserved)

---

## Data Flow

### URL Creation
```
1. User submits long URL + options (alias, expiry, QR settings)
2. API generates random 7-char base62 code
3. Call QR service (async, best-effort)
4. Insert into DB (retry on collision)
5. Warm Redis cache (fire-and-forget)
6. Return { code, short_url, qr_url }
```

### URL Redirect
```
1. User clicks short URL
2. Worker checks Redis (r:<code>)
3. If cached: Return 301 redirect
4. If not cached: Call API /resolve/:code
5. API checks DB, returns long_url
6. Worker caches result (24hr TTL)
7. Worker fires analytics hit (async)
8. Return 301 redirect
```

### Analytics
```
1. Worker sends POST /analytics/hit { code }
2. API performs atomic upsert:
   INSERT ... ON CONFLICT DO UPDATE total_clicks++
3. No cache invalidation (eventual consistency)
```

---

## Key Design Decisions

### 1. Why Base62 instead of sequential IDs?
- ✅ Unpredictable (security)
- ✅ No counter synchronization (distributed systems)
- ✅ 7 chars = 3.5 trillion combinations (no exhaustion risk)
- ❌ Sequential: Leaks business metrics, requires distributed counter

### 2. Why single API worker instead of separate redirector?
- ✅ Simpler deployment (one service instead of two)
- ✅ Lower latency (no inter-worker communication)
- ✅ Easier to maintain (single codebase)
- ❌ Separate worker: Added complexity, potential communication failures

### 3. Why cache-aside instead of write-through?
- ✅ Simpler implementation
- ✅ Cache failures don't block writes
- ❌ Write-through: Adds latency to URL creation

### 4. Why 24-hour TTL instead of no expiry?
- ✅ Handles URL updates/deletes automatically
- ✅ Reduces stale cache risk
- ❌ No expiry: Requires complex invalidation logic

### 5. Why eventual consistency for analytics?
- ✅ Reduces latency for redirects (fire-and-forget)
- ✅ Analytics rarely need real-time accuracy
- ❌ Strong consistency: Adds 50-100ms to redirect path

---

## Scalability Considerations

### Horizontal Scaling
- **API**: Stateless, scale horizontally (add more Fastify instances)
- **Worker**: Auto-scales (Cloudflare handles this)
- **DB**: Connection pooling (PgBouncer), read replicas for analytics queries
- **Redis**: Upstash handles replication

### Bottlenecks & Solutions
| Bottleneck | Solution |
|------------|----------|
| DB writes (URL creation) | Batch inserts, write-ahead log tuning |
| DB reads (cold cache) | Read replicas, index optimization |
| QR service latency | Async generation, fallback to CDN-hosted QR service |
| Redis memory | Evict least-used keys, increase TTL variance (12-36hrs) |

### Capacity Planning (10M URLs, 100M clicks/month)
- **Storage**: 10M URLs × 500 bytes ≈ **5GB**
- **Redis**: 10M keys × 200 bytes ≈ **2GB** (assuming 20% hot set)
- **Bandwidth**: 100M redirects × 500 bytes ≈ **50GB/month**
- **Cost** (AWS free tier + Cloudflare + Upstash): **~$0-10/month**

---

## Edge Cases & Failure Modes

### 1. Short Code Collision
**Probability**: 1/3.5 trillion per attempt
**Mitigation**: Retry up to 3 times, throw error on exhaustion

### 2. QR Service Down
**Mitigation**: Best-effort generation, return URL without QR
**UX**: Display "QR code generation failed, retry later"

### 3. Redis Down
**Mitigation**: Fallback to API (degraded performance)
**Impact**: Latency increases from 50ms to 200ms

### 4. Database Connection Pool Exhausted
**Mitigation**: PgBouncer connection pooling, queue requests
**Alert**: Monitor connection count, auto-scale DB instances

### 5. Expired URL Clicked
**Handling**: Return 410 Gone with user-friendly message

---

## Monitoring & Observability

### Key Metrics
- **Latency**: p50, p95, p99 for Worker, API, DB
- **Cache Hit Rate**: Target >80%
- **Error Rate**: 4xx, 5xx by endpoint
- **QR Service Success Rate**: Target >95%

### Alerts
- Worker latency p99 > 200ms
- Cache hit rate < 70%
- Error rate > 1%
- DB connection pool > 80% utilized

---

## Future Enhancements

### Phase 1: Core Improvements
- [ ] Custom domains (`brand.link/code`)
- [ ] Bulk URL creation API
- [ ] Link preview metadata (Open Graph)

### Phase 2: Analytics
- [ ] Detailed click analytics (geo, device, referrer)
- [ ] Real-time dashboard (WebSockets)
- [ ] A/B testing for QR variants

### Phase 3: Advanced QR
- [ ] Dynamic QR codes (update destination without changing QR)
- [ ] QR analytics (scan tracking)
- [ ] QR templates library

---

## Trade-Offs Summary

| Decision | Pro | Con |
|----------|-----|-----|
| Cloudflare Workers | Ultra-low latency, global | Can't run Java |
| Base62 random codes | Secure, distributed | Can't predict next code |
| 24hr cache TTL | Balance freshness/hit rate | Some stale data |
| Eventual analytics | Fast redirects | Analytics delayed |
| External QR service | Language flexibility | Network dependency |
| PostgreSQL | ACID, mature | Limited horizontal scaling |

---

## Tech Stack Rationale

- **Next.js 16**: Modern React, App Router, deployed on Cloudflare Workers
- **Hono**: Ultra-fast edge framework, optimized for Workers (~12KB)
- **Supabase (PostgreSQL)**: ACID, strong consistency, REST API
- **Upstash Redis**: Serverless, global replication, REST API
- **Cloudflare Workers**: Global edge (300+ locations), no cold starts
- **TypeScript**: End-to-end type safety, fewer runtime errors
