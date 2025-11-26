import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

// Helper functions to create clients (reusable within a request)
function getSupabaseClient(env: Bindings): SupabaseClient {
  console.log("[SUPABASE] Creating client", {
    url: env.SUPABASE_URL,
    hasServiceKey: !!env.SUPABASE_SERVICE_KEY,
    serviceKeyLength: env.SUPABASE_SERVICE_KEY?.length
  });
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

// Memoized Redis client per environment
const redisClientMap = new WeakMap<Bindings, Redis>();

function getRedisClient(env: Bindings): Redis {
  let client = redisClientMap.get(env);
  if (!client) {
    console.log("[REDIS] Creating new client", {
      url: env.REDIS_URL,
      hasToken: !!env.REDIS_TOKEN,
      tokenLength: env.REDIS_TOKEN?.length
    });
    client = new Redis({
      url: env.REDIS_URL,
      token: env.REDIS_TOKEN
    });
    redisClientMap.set(env, client);
  } else {
    console.log("[REDIS] Reusing memoized client");
  }
  return client;
}

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
async function createUrl(supabase: SupabaseClient, params: {
  shortCode: string;
  longUrl: string;
  alias?: string;
  expiresAt?: string | null;
  qrStatus?: string;
  qrUrl?: string | null;
  contentType?: string;
}): Promise<UrlRow> {
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

async function findUrlByCode(supabase: SupabaseClient, code: string): Promise<UrlRow | null> {
  console.log(`[DB] Finding URL by code: ${code}`);
  const { data, error } = await supabase
    .from('urls')
    .select('*')
    .eq('short_code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log(`[DB] URL not found: ${code}`);
      return null;
    }
    console.error(`[DB] Error finding URL:`, error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log(`[DB] Found URL:`, { code, longUrl: data.long_url, expiresAt: data.expires_at });
  return data as UrlRow;
}

async function incrementClick(supabase: SupabaseClient, code: string): Promise<void> {
  console.log(`[DB] Incrementing click count for: ${code}`);
  // Use upsert with onConflict and atomic increment via Postgres function
  const { error } = await supabase
    .rpc('increment_click_total', {
      p_short_code: code
    });
  if (error) {
    console.error(`[DB] Failed to increment click:`, error);
    throw new Error(`Failed to increment click total: ${error.message}`);
  }
  console.log(`[DB] Click incremented successfully for: ${code}`);
}

// Cache functions (Redis)
async function cacheGet(env: Bindings, code: string): Promise<string | null> {
  console.log(`[CACHE] GET r:${code}`);
  const redis = getRedisClient(env);
  const result = await redis.get<string>(`r:${code}`);
  console.log(`[CACHE] ${result ? 'HIT' : 'MISS'} r:${code}`, { result });
  return result;
}

async function cacheSet(env: Bindings, code: string, longUrl: string, ttlSeconds?: number): Promise<void> {
  const ttl = ttlSeconds ?? 86400; // Default 24 hours
  console.log(`[CACHE] SET r:${code}`, { longUrl, ttl });
  const redis = getRedisClient(env);
  await redis.set(`r:${code}`, longUrl, { ex: ttl });
  console.log(`[CACHE] SET SUCCESS r:${code}`);
}

async function cacheDelete(env: Bindings, code: string): Promise<void> {
  console.log(`[CACHE] DELETE r:${code}`);
  const redis = getRedisClient(env);
  await redis.del(`r:${code}`);
  console.log(`[CACHE] DELETE SUCCESS r:${code}`);
}

// Analytics logging function - tracks QR code scans (async, fire-and-forget)
async function logScan(
  supabase: SupabaseClient,
  shortCode: string,
  request: Request
): Promise<void> {
  // Fire and forget - don't await this in the redirect handler
  const analytics = {
    short_code: shortCode,
    scanned_at: new Date().toISOString(),
    user_agent: request.headers.get("User-Agent") || null,
    referer: request.headers.get("Referer") || null,
    country: (request as any).cf?.country || null,
    city: (request as any).cf?.city || null,
  };

  // Insert async (don't slow down redirect)
  try {
    await supabase.from("url_scans").insert(analytics);
    console.log(`[ANALYTICS] Logged scan for ${shortCode}`);
  } catch (error) {
    // Don't fail the redirect if analytics fails
    console.error(`[ANALYTICS] Failed to log scan:`, error);
  }
}

// QR generation function - calls AWS Lambda to generate QR code
async function generateQr(env: Bindings, shortUrl: string): Promise<{ status: "ready" | "failed"; qrUrl: string | null }> {
  if (!env.QR_SERVICE_URL) {
    console.log("[QR] QR_SERVICE_URL not configured, skipping QR generation");
    return { status: "failed", qrUrl: null };
  }

  try {
    console.log(`[QR] Calling Lambda to generate QR for: ${shortUrl}`);
    const response = await fetch(env.QR_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: shortUrl
      })
    });

    if (!response.ok) {
      console.error(`[QR] Lambda returned error: ${response.status} ${response.statusText}`);
      return { status: "failed", qrUrl: null };
    }

    const result = await response.json() as {
      success: boolean;
      dataUrl?: string;
      error?: string;
      version?: number;
      mode?: string;
    };

    if (!result.success || !result.dataUrl) {
      console.error(`[QR] Lambda failed: ${result.error || "Unknown error"}`);
      return { status: "failed", qrUrl: null };
    }

    console.log(`[QR] Generated successfully - Version: ${result.version}, Mode: ${result.mode}`);
    return { status: "ready", qrUrl: result.dataUrl };
  } catch (error) {
    console.error("[QR] QR generation failed:", error);
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
  // Validate expiresAt is in the future if provided
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return c.json({ error: "expires_at must be in the future" }, 400);
  }
  const alias = body.alias?.trim() || undefined;

  // Validate alias length (max 7 characters)
  if (alias && alias.length > 7) {
    return c.json({ error: "alias must be 7 characters or less" }, 400);
  }
  // Validate alias characters (only allow letters, numbers, hyphens, underscores)
  if (alias && !/^[a-zA-Z0-9-_]+$/.test(alias)) {
    return c.json({ error: "alias must contain only letters, numbers, hyphens, and underscores" }, 400);
  }

  // Create clients once per request
  const supabase = getSupabaseClient(c.env);

  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    const code = alias ?? generateCode(7);
    const shortUrl = `${c.env.PUBLIC_BASE_URL}/${code}`;

    try {
      // Generate QR code for the short URL
      const qrResult = await generateQr(c.env, shortUrl);

      const row = await createUrl(supabase, {
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

  // Create clients once per request
  const supabase = getSupabaseClient(c.env);

  const cached = await cacheGet(c.env, code);
  if (cached) {
    return c.json({ long_url: cached });
  }

  const row = await findUrlByCode(supabase, code);
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

// Update URL destination endpoint (enables dynamic QR codes)
app.patch("/api/:code", async (c) => {
  const shortCode = c.req.param("code");
  const body = await c.req.json<{ long_url: string }>();

  if (!body?.long_url) {
    return c.json({ error: "long_url is required" }, 400);
  }

  if (!isValidUrl(body.long_url)) {
    return c.json({ error: "long_url is invalid" }, 400);
  }

  // Create client once per request
  const supabase = getSupabaseClient(c.env);

  // Update database
  const { data, error } = await supabase
    .from("urls")
    .update({
      long_url: body.long_url,
      updated_at: new Date().toISOString()
    })
    .eq("short_code", shortCode)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return c.json({ error: "Short code not found" }, 404);
    }
    console.error(`[UPDATE] Database error:`, error);
    return c.json({ error: "Failed to update URL" }, 500);
  }

  // Invalidate cache to ensure new destination is used immediately
  try {
    const redis = getRedisClient(c.env);
    await redis.del(`r:${shortCode}`);
    console.log(`[UPDATE] Cache invalidated for ${shortCode}`);
  } catch (error) {
    // Don't fail the update if cache invalidation fails
    console.error(`[UPDATE] Failed to invalidate cache:`, error);
  }

  return c.json({
    success: true,
    short_code: shortCode,
    new_url: body.long_url,
    message: "QR code destination updated successfully"
  });
});

// Analytics hit endpoint
app.post("/api/analytics/hit", async (c) => {
  const body = await c.req.json<{ code?: string }>();

  if (!body?.code) {
    return c.json({ error: "code is required" }, 400);
  }

  // Create client once per request
  const supabase = getSupabaseClient(c.env);

  await incrementClick(supabase, body.code);
  return c.json({ ok: true });
});

// Analytics dashboard endpoint - returns aggregated metrics for a QR code
app.get("/api/analytics/:code", async (c) => {
  const shortCode = c.req.param("code");

  if (!shortCode) {
    return c.json({ error: "Short code is required" }, 400);
  }

  const supabase = getSupabaseClient(c.env);

  // Verify the short code exists
  const urlRow = await findUrlByCode(supabase, shortCode);
  if (!urlRow) {
    return c.json({ error: "Short code not found" }, 404);
  }

  try {
    // Get all scans for this short code
    const { data: scans, error: scansError } = await supabase
      .from("url_scans")
      .select("*")
      .eq("short_code", shortCode)
      .order("scanned_at", { ascending: false });

    if (scansError) {
      console.error("[ANALYTICS] Error fetching scans:", scansError);
      return c.json({ error: "Failed to fetch analytics" }, 500);
    }

    const scanData = scans || [];
    const totalScans = scanData.length;

    // Calculate scans today (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const scansToday = scanData.filter(
      (scan) => new Date(scan.scanned_at) >= todayStart
    ).length;

    // Top countries (with counts)
    const countryCounts: Record<string, number> = {};
    scanData.forEach((scan) => {
      if (scan.country) {
        countryCounts[scan.country] = (countryCounts[scan.country] || 0) + 1;
      }
    });
    const topCountries = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Device breakdown (parse user_agent)
    let mobileCount = 0;
    let desktopCount = 0;
    let tabletCount = 0;
    let unknownCount = 0;

    scanData.forEach((scan) => {
      const ua = scan.user_agent?.toLowerCase() || "";
      if (!ua) {
        unknownCount++;
      } else if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
        tabletCount++;
      } else if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) {
        mobileCount++;
      } else if (ua) {
        desktopCount++;
      } else {
        unknownCount++;
      }
    });

    const devices = {
      mobile: mobileCount,
      desktop: desktopCount,
      tablet: tabletCount,
      unknown: unknownCount
    };

    // Time-series data (scans per day for last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setUTCHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = scanData.filter((scan) => {
        const scanDate = new Date(scan.scanned_at);
        return scanDate >= date && scanDate < nextDay;
      }).length;

      last7Days.push({
        date: date.toISOString().split("T")[0],
        count
      });
    }

    // Top cities (with counts)
    const cityCounts: Record<string, number> = {};
    scanData.forEach((scan) => {
      if (scan.city) {
        cityCounts[scan.city] = (cityCounts[scan.city] || 0) + 1;
      }
    });
    const topCities = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Return aggregated analytics
    return c.json({
      short_code: shortCode,
      short_url: `${c.env.PUBLIC_BASE_URL}/${shortCode}`,
      long_url: urlRow.long_url,
      created_at: urlRow.created_at,
      total_scans: totalScans,
      scans_today: scansToday,
      top_countries: topCountries,
      top_cities: topCities,
      devices,
      scans_over_time: last7Days,
      recent_scans: scanData.slice(0, 10).map((scan) => ({
        scanned_at: scan.scanned_at,
        country: scan.country,
        city: scan.city,
        device: scan.user_agent?.toLowerCase().includes("mobile") ? "mobile" : "desktop"
      }))
    });
  } catch (error) {
    console.error("[ANALYTICS] Error processing analytics:", error);
    return c.json({ error: "Failed to process analytics" }, 500);
  }
});

// Update destination URL for a QR code - enables dynamic QR codes!
app.post("/api/update", async (c) => {
  try {
    const body = await c.req.json();
    const { code, new_url } = body;

    // Validate inputs
    if (!code || typeof code !== "string") {
      return c.json({ error: "Short code is required" }, 400);
    }

    if (!new_url || typeof new_url !== "string") {
      return c.json({ error: "New URL is required" }, 400);
    }

    // Validate URL format
    try {
      new URL(new_url);
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Check if URL exists
    const urlRow = await findUrlByCode(supabase, code);
    if (!urlRow) {
      return c.json({ error: "Short code not found" }, 404);
    }

    console.log(`[UPDATE] Updating ${code} from ${urlRow.long_url} to ${new_url}`);

    // Update the URL in database
    const { error: updateError } = await supabase
      .from("urls")
      .update({
        long_url: new_url,
        updated_at: new Date().toISOString()
      })
      .eq("short_code", code);

    if (updateError) {
      console.error("[UPDATE] Database error:", updateError);
      return c.json({ error: "Failed to update URL" }, 500);
    }

    // CRITICAL: Invalidate cache so new URL takes effect immediately
    console.log(`[UPDATE] Invalidating cache for ${code}`);
    await cacheDelete(c.env, code);

    console.log(`[UPDATE] Successfully updated ${code} ✓`);

    return c.json({
      short_code: code,
      new_url,
      message: "QR code destination updated successfully"
    });
  } catch (error) {
    console.error("[UPDATE] Error:", error);
    return c.json({ error: "Failed to update URL" }, 500);
  }
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Catch-all route for short code redirects (must be last!)
app.get("/:code", async (c) => {
  const startTime = Date.now();
  const code = c.req.param("code");

  console.log(`\n[REDIRECT] ===== New request for code: ${code} =====`);
  console.log(`[REDIRECT] Request URL: ${c.req.url}`);
  console.log(`[REDIRECT] Environment vars check:`, {
    hasSupabaseUrl: !!c.env.SUPABASE_URL,
    hasSupabaseKey: !!c.env.SUPABASE_SERVICE_KEY,
    hasRedisUrl: !!c.env.REDIS_URL,
    hasRedisToken: !!c.env.REDIS_TOKEN,
    publicBaseUrl: c.env.PUBLIC_BASE_URL
  });

  if (!code || code.includes("/")) {
    console.log(`[REDIRECT] Invalid code format: ${code}`);
    return c.json({ error: "not found" }, 404);
  }

  try {
    // Create clients once per request
    console.log(`[REDIRECT] Creating Supabase client...`);
    const supabase = getSupabaseClient(c.env);
    console.log(`[REDIRECT] Supabase client created`);

    // Check cache first
    console.log(`[REDIRECT] Checking cache...`);
    const cached = await cacheGet(c.env, code);
    if (cached) {
      console.log(`[REDIRECT] Cache HIT! Redirecting to: ${cached}`);
      // Log scan asynchronously (fire and forget - don't slow down redirect)
      c.executionCtx.waitUntil(logScan(supabase, code, c.req.raw));
      console.log(`[REDIRECT] Total time: ${Date.now() - startTime}ms\n`);
      // Use 302 (temporary redirect) to allow dynamic URL updates
      return c.redirect(cached, 302);
    }
    console.log(`[REDIRECT] Cache MISS, checking database...`);

    // Look up in database
    const row = await findUrlByCode(supabase, code);
    if (!row) {
      console.log(`[REDIRECT] URL not found in database`);
      console.log(`[REDIRECT] Total time: ${Date.now() - startTime}ms\n`);
      return c.json({ error: "not found" }, 404);
    }

    // Check if expired
    if (row.expires_at) {
      const expires = new Date(row.expires_at);
      const now = Date.now();
      console.log(`[REDIRECT] Checking expiration:`, {
        expiresAt: row.expires_at,
        expiresTimestamp: expires.getTime(),
        now,
        isExpired: expires.getTime() < now
      });
      if (expires.getTime() < now) {
        console.log(`[REDIRECT] URL expired`);
        console.log(`[REDIRECT] Total time: ${Date.now() - startTime}ms\n`);
        return c.json({ error: "expired" }, 410);
      }
    }

    // Calculate TTL: use expiration time if set, otherwise default 24hrs
    const cacheTtl = row.expires_at
      ? Math.max(60, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000))
      : undefined;
    console.log(`[REDIRECT] Cache TTL calculated:`, { cacheTtl });

    // Cache and redirect
    console.log(`[REDIRECT] Caching URL and incrementing click count...`);
    c.executionCtx.waitUntil(cacheSet(c.env, code, row.long_url, cacheTtl));
    c.executionCtx.waitUntil(incrementClick(supabase, code));
    // Log scan asynchronously (fire and forget - don't slow down redirect)
    c.executionCtx.waitUntil(logScan(supabase, code, c.req.raw));

    console.log(`[REDIRECT] SUCCESS! Redirecting to: ${row.long_url}`);
    console.log(`[REDIRECT] Total time: ${Date.now() - startTime}ms\n`);
    // Use 302 (temporary redirect) to allow dynamic URL updates
    return c.redirect(row.long_url, 302);
  } catch (error) {
    console.error(`[REDIRECT] ERROR:`, error);
    console.error(`[REDIRECT] Error stack:`, (error as Error).stack);
    console.log(`[REDIRECT] Total time: ${Date.now() - startTime}ms\n`);
    throw error;
  }
});

export default app;
