import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// This uses Supabase REST API - works on Cloudflare Workers!
// No connection pooling needed
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey
);

export type UrlRow = {
  id: string;
  short_code: string;
  long_url: string;
  alias: string | null;
  created_at: string;
  expires_at: string | null;
  qr_status: string | null;
  qr_url: string | null;
  content_type: string;
  qr_config: Record<string, any> | null;
};

export async function createUrl(params: {
  shortCode: string;
  longUrl: string;
  alias?: string;
  expiresAt?: string | null;
  qrStatus?: string;
  qrUrl?: string | null;
  contentType?: string;
  qrConfig?: Record<string, any>;
}): Promise<UrlRow> {
  const { shortCode, longUrl, alias, expiresAt, qrStatus, qrUrl, contentType, qrConfig } = params;

  const { data, error } = await supabase
    .from('urls')
    .insert({
      short_code: shortCode,
      long_url: longUrl,
      alias: alias ?? null,
      expires_at: expiresAt ?? null,
      qr_status: qrStatus ?? null,
      qr_url: qrUrl ?? null,
      content_type: contentType ?? 'url',
      qr_config: qrConfig ?? {}
    })
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation (duplicate short_code or alias)
    if (error.code === '23505') {
      const err = new Error(error.message) as any;
      err.code = '23505';
      throw err;
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data as UrlRow;
}

export async function findUrlByCode(code: string): Promise<UrlRow | null> {
  const { data, error } = await supabase
    .from('urls')
    .select('*')
    .eq('short_code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data as UrlRow;
}

export async function incrementClick(code: string): Promise<void> {
  // Supabase doesn't support UPSERT in the same way
  // Try to increment first
  const { data: existing } = await supabase
    .from('click_totals')
    .select('total_clicks')
    .eq('short_code', code)
    .single();

  if (existing) {
    // Update existing record
    await supabase
      .from('click_totals')
      .update({
        total_clicks: existing.total_clicks + 1,
        updated_at: new Date().toISOString()
      })
      .eq('short_code', code);
  } else {
    // Insert new record
    await supabase
      .from('click_totals')
      .insert({
        short_code: code,
        total_clicks: 1,
        updated_at: new Date().toISOString()
      });
  }
}
