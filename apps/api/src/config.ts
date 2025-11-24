const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  publicBaseUrl: required("PUBLIC_BASE_URL", "http://localhost:3001"),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  redisToken: required("REDIS_TOKEN"),
  redisTtlSeconds: Number(process.env.REDIS_TTL_SECONDS ?? 60 * 60 * 24),
  qrServiceUrl: process.env.QR_SERVICE_URL // optional; best-effort
};
