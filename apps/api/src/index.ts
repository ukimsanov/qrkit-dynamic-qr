import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { generateCode } from "./codegen.js";

// Cloudflare Workers environment bindings
type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  PUBLIC_BASE_URL: string;
  QR_SERVICE_URL?: string;
};

type ShortenRequestBody = {
  long_url: string;
  alias?: string;
  expires_at?: string;
};

type UrlRow = {
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

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use("*", secureHeaders());
app.use("*", cors({ origin: "*" }));

// Helper functions
const isValidUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return !!u.protocol && !!u.host;
  } catch {
    return false;
  }
};

// Database functions (Supabase REST API)
async function createUrl(env: Bindings, params: {
  shortCode: string;
  longUrl: string;
  alias?: string;
  expiresAt?: string | null;
  qrStatus?: string;
  qrUrl?: string | null;
  contentType?: string;
}): Promise<UrlRow> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { shortCode, longUrl, alias, expiresAt, qrStatus, qrUrl, contentType } = params;

  const { data, error } = await supabase
    .from('urls')
    .insert({
      short_code: shortCode,
      long_url: longUrl,
      alias: alias ?? null,
      expires_at: expiresAt ?? null,
      qr_status: qrStatus ?? null,
      qr_url: qrUrl ?? null,
      content_type: contentType ?? 'url'
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const err = new Error(error.message) as any;
      err.code = '23505';
      throw err;
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data as UrlRow;
}

async function findUrlByCode(env: Bindings, code: string): Promise<UrlRow | null> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('urls')
    .select('*')
    .eq('short_code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data as UrlRow;
}

async function incrementClick(env: Bindings, code: string): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: existing } = await supabase
    .from('click_totals')
    .select('total_clicks')
    .eq('short_code', code)
    .single();

  if (existing) {
    await supabase
      .from('click_totals')
      .update({
        total_clicks: existing.total_clicks + 1,
        updated_at: new Date().toISOString()
      })
      .eq('short_code', code);
  } else {
    await supabase
      .from('click_totals')
      .insert({
        short_code: code,
        total_clicks: 1,
        updated_at: new Date().toISOString()
      });
  }
}

// Cache functions (Redis)
async function cacheGet(env: Bindings, code: string): Promise<string | null> {
  const redis = new Redis({
    url: env.REDIS_URL,
    token: env.REDIS_TOKEN
  });
  return await redis.get<string>(`r:${code}`);
}

async function cacheSet(env: Bindings, code: string, longUrl: string, ttlSeconds?: number): Promise<void> {
  const redis = new Redis({
    url: env.REDIS_URL,
    token: env.REDIS_TOKEN
  });
  const ttl = ttlSeconds ?? 86400; // Default 24 hours
  await redis.set(`r:${code}`, longUrl, { ex: ttl });
}

// QR generation function (simplified - just generates QR for the short URL)
async function generateQr(env: Bindings, shortUrl: string): Promise<{ status: "ready" | "failed"; qrUrl: string | null }> {
  if (!env.QR_SERVICE_URL) {
    return { status: "failed", qrUrl: null };
  }

  try {
    const response = await fetch(env.QR_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: shortUrl
      })
    });

    if (!response.ok) {
      return { status: "failed", qrUrl: null };
    }

    const result = await response.json() as { qr_url: string };
    return { status: "ready", qrUrl: result.qr_url };
  } catch (error) {
    console.error("QR generation failed:", error);
    return { status: "failed", qrUrl: null };
  }
}

// Routes

// Shorten URL endpoint
app.post("/api/shorten", async (c) => {
  const body = await c.req.json<ShortenRequestBody>();

  if (!body?.long_url) {
    return c.json({ error: "long_url is required" }, 400);
  }

  if (!isValidUrl(body.long_url)) {
    return c.json({ error: "long_url is invalid" }, 400);
  }

  const expiresAt = body.expires_at ?? null;
  const alias = body.alias?.trim() || undefined;

  // Validate alias length (max 7 characters)
  if (alias && alias.length > 7) {
    return c.json({ error: "alias must be 7 characters or less" }, 400);
  }

  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    const code = alias ?? generateCode(7);
    const shortUrl = `${c.env.PUBLIC_BASE_URL}/${code}`;

    try {
      // Generate QR code for the short URL
      const qrResult = await generateQr(c.env, shortUrl);

      const row = await createUrl(c.env, {
        shortCode: code,
        longUrl: body.long_url,
        alias,
        expiresAt,
        qrStatus: qrResult.status,
        qrUrl: qrResult.qrUrl,
        contentType: "url"
      });

      // Calculate TTL: use expiration time if set, otherwise default 24hrs
      const cacheTtl = row.expires_at
        ? Math.max(60, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000))
        : undefined;
      void cacheSet(c.env, row.short_code, row.long_url, cacheTtl);

      return c.json({
        code: row.short_code,
        short_url: shortUrl,
        qr_url: row.qr_url
      });
    } catch (err: any) {
      lastError = err;
      if (err?.code === "23505") {
        if (alias) {
          return c.json({ error: "alias already in use" }, 409);
        }
        continue;
      }
      throw err;
    }
  }

  console.error({ err: lastError }, "Failed to generate short code after retries");
  return c.json({ error: "failed to generate code" }, 500);
});

// Resolve URL endpoint
app.get("/api/resolve/:code", async (c) => {
  const code = c.req.param("code");

  if (!code) {
    return c.json({ error: "not found" }, 404);
  }

  const cached = await cacheGet(c.env, code);
  if (cached) {
    return c.json({ long_url: cached });
  }

  const row = await findUrlByCode(c.env, code);
  if (!row) {
    return c.json({ error: "not found" }, 404);
  }

  if (row.expires_at) {
    const expires = new Date(row.expires_at);
    if (expires.getTime() < Date.now()) {
      return c.json({ error: "expired" }, 410);
    }
  }

  // Calculate TTL: use expiration time if set, otherwise default 24hrs
  const cacheTtl = row.expires_at
    ? Math.max(60, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000))
    : undefined;
  void cacheSet(c.env, code, row.long_url, cacheTtl);
  return c.json({ long_url: row.long_url });
});

// Analytics hit endpoint
app.post("/api/analytics/hit", async (c) => {
  const body = await c.req.json<{ code?: string }>();

  if (!body?.code) {
    return c.json({ error: "code is required" }, 400);
  }

  await incrementClick(c.env, body.code);
  return c.json({ ok: true });
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Catch-all route for short code redirects (must be last!)
app.get("/:code", async (c) => {
  const code = c.req.param("code");

  if (!code || code.includes("/")) {
    return c.json({ error: "not found" }, 404);
  }

  // Check cache first
  const cached = await cacheGet(c.env, code);
  if (cached) {
    return c.redirect(cached, 301);
  }

  // Look up in database
  const row = await findUrlByCode(c.env, code);
  if (!row) {
    return c.json({ error: "not found" }, 404);
  }

  // Check if expired
  if (row.expires_at) {
    const expires = new Date(row.expires_at);
    if (expires.getTime() < Date.now()) {
      return c.json({ error: "expired" }, 410);
    }
  }

  // Calculate TTL: use expiration time if set, otherwise default 24hrs
  const cacheTtl = row.expires_at
    ? Math.max(60, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000))
    : undefined;

  // Cache and redirect
  void cacheSet(c.env, code, row.long_url, cacheTtl);
  void incrementClick(c.env, code);
  return c.redirect(row.long_url, 301);
});

export default app;
