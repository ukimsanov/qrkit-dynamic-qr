import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000
});

export type UrlRow = {
  id: string;
  short_code: string;
  long_url: string;
  alias: string | null;
  created_at: string;
  expires_at: string | null;
  qr_status: string | null;
  qr_url: string | null;
};

export async function createUrl(params: {
  shortCode: string;
  longUrl: string;
  alias?: string;
  expiresAt?: string | null;
  qrStatus?: string;
  qrUrl?: string | null;
}): Promise<UrlRow> {
  const { shortCode, longUrl, alias, expiresAt, qrStatus, qrUrl } = params;
  const res = await pool.query<UrlRow>(
    `INSERT INTO urls (short_code, long_url, alias, expires_at, qr_status, qr_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [shortCode, longUrl, alias ?? null, expiresAt ?? null, qrStatus ?? null, qrUrl ?? null]
  );
  return res.rows[0];
}

export async function findUrlByCode(code: string): Promise<UrlRow | null> {
  const res = await pool.query<UrlRow>(
    `SELECT * FROM urls WHERE short_code = $1`,
    [code]
  );
  return res.rows[0] ?? null;
}

export async function incrementClick(code: string): Promise<void> {
  await pool.query(
    `INSERT INTO click_totals (short_code, total_clicks, updated_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (short_code)
     DO UPDATE SET total_clicks = click_totals.total_clicks + 1, updated_at = NOW()`,
    [code]
  );
}
