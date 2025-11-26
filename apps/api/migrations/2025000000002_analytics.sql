-- Create analytics table for tracking QR code scans
CREATE TABLE IF NOT EXISTS url_scans (
  id BIGSERIAL PRIMARY KEY,
  short_code VARCHAR(10) NOT NULL REFERENCES urls(short_code) ON DELETE CASCADE,
  scanned_at TIMESTAMP DEFAULT NOW(),
  user_agent TEXT,
  country VARCHAR(2),
  city VARCHAR(100),
  referer TEXT
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_scans_short_code ON url_scans(short_code);
CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON url_scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_country ON url_scans(country);

-- Add updated_at column to urls table for tracking when destinations are changed
ALTER TABLE urls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Comment for documentation
COMMENT ON TABLE url_scans IS 'Tracks every scan of a QR code for analytics (device, location, time)';
COMMENT ON COLUMN url_scans.short_code IS 'Foreign key to urls table';
COMMENT ON COLUMN url_scans.scanned_at IS 'Timestamp when the QR code was scanned';
COMMENT ON COLUMN url_scans.user_agent IS 'Browser/device User-Agent header';
COMMENT ON COLUMN url_scans.country IS 'Country code from Cloudflare geolocation (CF-IPCountry)';
COMMENT ON COLUMN url_scans.city IS 'City from Cloudflare geolocation';
COMMENT ON COLUMN url_scans.referer IS 'HTTP Referer header (where scan came from)';
