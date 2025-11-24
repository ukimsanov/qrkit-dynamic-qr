interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  API_BASE_URL: string; // e.g., https://api.yourdomain.com
}

type ResolveResponse = { long_url: string };

const REDIS_TTL_SECONDS = 60 * 60 * 24;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return new Response("ok");
    }
    const code = url.pathname.replace(/^\//, "");
    if (!code || code.includes("/")) {
      return new Response("Not found", { status: 404 });
    }

    const cached = await redisGet(env, code);
    if (cached) {
      return redirect(cached);
    }

    const resolved = await resolveViaApi(env, code);
    if (!resolved) {
      return new Response("Not found", { status: 404 });
    }

    await redisSet(env, code, resolved.long_url, REDIS_TTL_SECONDS);
    void sendHit(env, code);
    return redirect(resolved.long_url);
  }
};

function redirect(target: string): Response {
  return Response.redirect(target, 301);
}

async function resolveViaApi(env: Env, code: string): Promise<ResolveResponse | null> {
  const res = await fetch(`${env.API_BASE_URL}/api/resolve/${code}`, {
    method: "GET",
    headers: { accept: "application/json" }
  });
  if (!res.ok) return null;
  return (await res.json()) as ResolveResponse;
}

async function sendHit(env: Env, code: string): Promise<void> {
  try {
    await fetch(`${env.API_BASE_URL}/api/analytics/hit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code })
    });
  } catch {
    // ignore failures
  }
}

async function redisGet(env: Env, code: string): Promise<string | null> {
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(code)}`, {
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | null };
  return typeof data.result === "string" ? data.result : null;
}

async function redisSet(env: Env, code: string, value: string, ttlSeconds: number): Promise<void> {
  await fetch(`${env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(code)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify({ ex: ttlSeconds })
  });
}
