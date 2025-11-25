interface Env {
  REDIS_URL: string;
  REDIS_TOKEN: string;
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
    if (url.pathname === "/debug") {
      return new Response(JSON.stringify({
        API_BASE_URL: env.API_BASE_URL,
        has_redis_url: !!env.REDIS_URL,
        has_redis_token: !!env.REDIS_TOKEN
      }));
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
  const url = `${env.API_BASE_URL}/api/resolve/${code}`;
  console.log(`Resolving ${code} via ${url}`);
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" }
  });
  const responseText = await res.text();
  console.log(`API response status: ${res.status}, body: ${responseText}`);
  if (!res.ok) {
    console.log(`API resolve failed for ${code}`);
    return null;
  }
  try {
    const data = JSON.parse(responseText) as ResolveResponse;
    console.log(`Resolved ${code} to ${data.long_url}`);
    return data;
  } catch (e) {
    console.log(`Failed to parse response: ${e}`);
    return null;
  }
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
  const res = await fetch(`${env.REDIS_URL}/get/${encodeURIComponent(code)}`, {
    headers: { Authorization: `Bearer ${env.REDIS_TOKEN}` }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | null };
  return typeof data.result === "string" ? data.result : null;
}

async function redisSet(env: Env, code: string, value: string, ttlSeconds: number): Promise<void> {
  await fetch(`${env.REDIS_URL}/set/${encodeURIComponent(code)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.REDIS_TOKEN}` },
    body: JSON.stringify({ ex: ttlSeconds })
  });
}
