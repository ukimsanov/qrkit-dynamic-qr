-- Migration: Add increment_click_total RPC function
-- Description: Atomic upsert function for incrementing click totals
-- Date: 2025-11-25

-- Create function for atomic click increment
CREATE OR REPLACE FUNCTION increment_click_total(p_short_code VARCHAR)
RETURNS VOID AS $$
BEGIN
  INSERT INTO click_totals (short_code, total_clicks, updated_at, created_at)
  VALUES (p_short_code, 1, NOW(), NOW())
  ON CONFLICT (short_code)
  DO UPDATE SET
    total_clicks = click_totals.total_clicks + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_click_total(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_click_total(VARCHAR) TO anon;
