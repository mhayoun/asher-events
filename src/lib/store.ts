import { Redis } from "@upstash/redis";
import seed from "../../data/events.json";
import overridesJson from "../../data/overrides.json";
import type { EventItem, Overrides, SyncReport } from "./types";

const EVENTS_KEY = "events:v1";
const REPORT_KEY = "events:last-sync";

export const overrides = overridesJson as Overrides;

/** Upstash Redis from the Vercel Marketplace sets KV_REST_API_*; plain Upstash uses UPSTASH_REDIS_REST_*. */
export function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

/** Events from Redis; falls back to the committed data/events.json when Redis is not configured or empty. */
export async function loadEvents(): Promise<EventItem[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const stored = await redis.get<EventItem[]>(EVENTS_KEY);
      if (stored?.length) return stored;
    } catch (err) {
      console.error("Redis read failed, using bundled data", err);
    }
  }
  return seed as EventItem[];
}

export async function loadLastSync(): Promise<SyncReport | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<SyncReport>(REPORT_KEY);
  } catch {
    return null;
  }
}

export async function saveToRedis(events: EventItem[], report: SyncReport): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.mset({ [EVENTS_KEY]: events, [REPORT_KEY]: report });
  return true;
}
