-- Migration to clean up schema
-- Remove qr_config column (added in earlier migration, no longer using QR customization)
-- Keep content_type (we use it, always 'url' now)

-- Drop qr_config column (added in earlier migration, not used anymore)
ALTER TABLE urls DROP COLUMN IF EXISTS qr_config;

-- Ensure content_type exists and has correct default
ALTER TABLE urls
ADD COLUMN IF NOT EXISTS content_type VARCHAR(16) NOT NULL DEFAULT 'url';

-- Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_click_totals_updated_at ON click_totals(updated_at);

-- Add created_at to click_totals if missing
ALTER TABLE click_totals
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
