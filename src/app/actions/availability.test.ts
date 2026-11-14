import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { availability } from "@/db/schema";
import { createTestDb, insertBand, insertMember, insertPreClerkLeader, resetTestDb, type TestDb } from "@/test/db";

const holder = vi.hoisted(() => ({ db: null as unknown as TestDb }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => null }));

const { setAvailabilityBulk } = await import("./availability");

let slug: string;
let token: string;

beforeAll(async () => {
  holder.db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(holder.db);
  const leader = await insertPreClerkLeader(holder.db, []);
  const band = await insertBand(holder.db, leader.id, "Basement Tapes"); // 2026-11-01..30
  slug = band.slug;
  token = (await insertMember(holder.db, band.id, "Alex")).memberToken;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setAvailabilityBulk", () => {
  it("saves valid changes inside the band's dates", async () => {
    const result = await setAvailabilityBulk(slug, token, [
      { date: "2026-11-02", timeSlot: "18:00", status: "available" },
      { date: "2026-11-03", timeSlot: "all_day", status: "maybe" },
    ]);
    expect(result).toEqual({ ok: true });
    expect(await holder.db.select().from(availability)).toHaveLength(2);
  });

  it("rejects a 501-item update", async () => {
    const updates = Array.from({ length: 501 }, () => ({ date: "2026-11-02", timeSlot: "18:00", status: "available" as const }));
    expect((await setAvailabilityBulk(slug, token, updates)).ok).toBe(false);
    expect(await holder.db.select().from(availability)).toHaveLength(0);
  });

  it("rejects dates outside the band's range and junk time slots", async () => {
    expect((await setAvailabilityBulk(slug, token, [{ date: "2031-01-01", timeSlot: "18:00", status: "available" }])).ok).toBe(false);
    expect((await setAvailabilityBulk(slug, token, [{ date: "2026-11-02", timeSlot: "x".repeat(5000), status: "available" }])).ok).toBe(false);
    expect(await holder.db.select().from(availability)).toHaveLength(0);
  });
});
