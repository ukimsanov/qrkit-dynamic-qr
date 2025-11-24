import { Redis } from "@upstash/redis";
import { config } from "./config.js";

const redis = new Redis({
  url: config.redisUrl,
  token: config.redisToken
});

const key = (code: string) => `r:${code}`;

export async function cacheGet(code: string): Promise<string | null> {
  return await redis.get<string>(key(code));
}

export async function cacheSet(code: string, longUrl: string): Promise<void> {
  await redis.set(key(code), longUrl, { ex: config.redisTtlSeconds });
}
