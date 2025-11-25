-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main URLs table
CREATE TABLE IF NOT EXISTS urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code VARCHAR(16) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  alias VARCHAR(32) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  qr_status VARCHAR(16),
  qr_url TEXT
);

-- Click analytics table
CREATE TABLE IF NOT EXISTS click_totals (
  short_code VARCHAR(16) PRIMARY KEY REFERENCES urls(short_code) ON DELETE CASCADE,
  total_clicks BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
