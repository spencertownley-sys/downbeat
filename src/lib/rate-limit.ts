import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { ValidationError } from "@/lib/action-errors";

export const TOO_MANY_ATTEMPTS = "Too many attempts. Try again later.";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Limits for the public, unauthenticated actions. */
export const LIMITS = {
  join: { limit: 10, windowMs: HOUR },
  recover: { limit: 10, windowMs: 15 * MINUTE },
  rejoin: { limit: 10, windowMs: 15 * MINUTE },
  passkey: { limit: 30, windowMs: HOUR },
  availability: { limit: 120, windowMs: MINUTE },
} as const;

export type LimitName = keyof typeof LIMITS;

/** The most members one band can have; stops a leaked link from flooding a band. */
export const MAX_MEMBERS_PER_BAND = 50;

/**
 * The visitor's IP address. Railway's edge sets X-Real-IP and appends the
 * client to X-Forwarded-For, so the last X-Forwarded-For entry is the one the
 * proxy saw; earlier entries can be typed by the client.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = h.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? "unknown";
}

/**
 * Fixed-window limiter in Postgres: counts one attempt for `name` + `scope`
 * and throws a ValidationError once the window's limit is passed. One upsert
 * per call, so parallel requests can't slip past the count.
 */
export async function rateLimit(name: LimitName, scope: string): Promise<void> {
  const { limit, windowMs } = LIMITS[name];
  const key = createHash("sha256").update(`${name}\u0000${scope}`).digest("hex");
  const now = new Date();
  const windowOpen = sql`${new Date(now.getTime() - windowMs).toISOString()}::timestamptz`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} <= ${windowOpen} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} <= ${windowOpen} THEN excluded.window_start ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count });

  // Old windows are useless; sweep them now and then rather than on every call.
  if (Math.random() < 0.02) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 24 * HOUR)));
  }

  if (row.count > limit) throw new ValidationError(TOO_MANY_ATTEMPTS);
}

/** Rate-limits by the caller's IP address, optionally narrowed to a band. */
export async function rateLimitByIp(name: LimitName, scope = ""): Promise<void> {
  await rateLimit(name, `${await clientIp()}\u0000${scope}`);
}
