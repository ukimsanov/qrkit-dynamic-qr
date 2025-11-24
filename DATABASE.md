# Database Schema

## Tables

### 1. `urls` - Main URL Storage

| Column | Type | Description |
|--------|------|-------------|
| **id** | UUID | Primary key (auto-generated) |
| **short_code** | varchar(16) | **UNIQUE** - The short code (e.g., "wh99eqZ") |
| **long_url** | text | Original long URL |
| **alias** | varchar(32) | **UNIQUE** - Optional custom alias |
| **created_at** | timestamptz | When URL was created (auto) |
| **expires_at** | timestamptz | Optional expiration date |
| **qr_status** | varchar(16) | "ready" or "failed" |
| **qr_url** | text | Link to QR code image |

**Indexes:**
- Primary key on `id`
- Unique constraint on `short_code` (prevents collisions)
- Unique constraint on `alias` (prevents duplicate custom aliases)

---

### 2. `click_totals` - Analytics

| Column | Type | Description |
|--------|------|-------------|
| **short_code** | varchar(16) | **PRIMARY KEY** - References urls.short_code |
| **total_clicks** | bigint | Click counter (default: 0) |
| **updated_at** | timestamptz | Last updated timestamp |

**Constraints:**
- Foreign key to `urls(short_code)`
- ON DELETE CASCADE (auto-deletes when URL is deleted)

**Atomic Upsert Pattern:**
```sql
INSERT INTO click_totals (short_code, total_clicks, updated_at)
VALUES ('code', 1, NOW())
ON CONFLICT (short_code)
DO UPDATE SET
  total_clicks = click_totals.total_clicks + 1,
  updated_at = NOW()
```

---

### 3. `pgmigrations` - Migration Tracking

Automatically created by `node-pg-migrate`.

| Column | Type | Description |
|--------|------|-------------|
| **id** | serial | Auto-increment ID |
| **name** | varchar(255) | Migration filename |
| **run_on** | timestamptz | When migration was executed |

---

## Extensions

- **uuid-ossp** - Enables `uuid_generate_v4()` for auto-generating UUIDs

---

## Relationships

```
urls (1) ──────< (many) click_totals
  │                        │
  └─ short_code  →  short_code (FK, CASCADE DELETE)
```
