# Database Schema

## Tables

### `urls` - URL Storage & Metadata

```sql
CREATE TABLE urls (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code    VARCHAR(16) UNIQUE NOT NULL,
  long_url      TEXT NOT NULL,
  alias         VARCHAR(32) UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  qr_status     VARCHAR(16),
  qr_url        TEXT,
  content_type  VARCHAR(16) NOT NULL DEFAULT 'url'
);
```

**Indexes:**
- Primary key on `id` (UUID v4)
- Unique constraint on `short_code` (collision prevention)
- Unique constraint on `alias` (custom short codes)
- B-tree index on `short_code` for fast lookups
- Partial index on `expires_at` (WHERE expires_at IS NOT NULL)

**Fields:**
- `id`: Unique identifier for each URL record
- `short_code`: 7-character base62 code (e.g., "abc123x")
- `long_url`: Original URL to redirect to
- `alias`: Optional custom short code (max 7 characters)
- `created_at`: Timestamp when URL was created
- `expires_at`: Optional expiration timestamp
- `qr_status`: QR generation status (`ready`, `failed`, or null)
- `qr_url`: URL to generated QR code image
- `content_type`: Always `'url'` (simplified from previous multi-type support)

---

### `click_totals` - Analytics

```sql
CREATE TABLE click_totals (
  short_code    VARCHAR(16) PRIMARY KEY REFERENCES urls(short_code) ON DELETE CASCADE,
  total_clicks  BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- Primary key on `short_code`
- B-tree index on `updated_at` for analytics queries

**Relationships:**
- Foreign key to `urls(short_code)` with CASCADE DELETE
- 1:1 relationship with urls table

**Atomic upsert pattern:**
```sql
INSERT INTO click_totals (short_code, total_clicks, updated_at)
VALUES ($1, 1, NOW())
ON CONFLICT (short_code)
DO UPDATE SET
  total_clicks = click_totals.total_clicks + 1,
  updated_at = NOW();
```

**Fields:**
- `short_code`: Reference to the shortened URL
- `total_clicks`: Cumulative click count
- `updated_at`: Last time this record was updated
- `created_at`: When the first click was recorded

---

## Extensions

- **uuid-ossp** - Enables `uuid_generate_v4()` for auto-generated UUIDs
