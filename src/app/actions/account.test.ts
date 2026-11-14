import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { availability, bands, profiles } from "@/db/schema";
import { createTestDb, insertBand, insertMember, insertPreClerkLeader, resetTestDb, type TestDb } from "@/test/db";

const holder = vi.hoisted(() => ({
  db: null as unknown as TestDb,
  profile: null as unknown,
  authConfigured: false,
  deleteUser: null as unknown as ReturnType<typeof vi.fn>,
}));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => holder.profile }));
vi.mock("@/lib/auth-config", () => ({ isAuthConfigured: () => holder.authConfigured }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { deleteUser: holder.deleteUser } }),
}));

const { deleteMyAccount, exportMyData } = await import("./account");

let leader: Awaited<ReturnType<typeof insertPreClerkLeader>>;

beforeAll(async () => {
  holder.db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(holder.db);
  leader = await insertPreClerkLeader(holder.db, []);
  holder.profile = leader;
  holder.authConfigured = false;
  holder.deleteUser = vi.fn(async () => ({}));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteMyAccount", () => {
  it("deletes the leader's profile, bands, members and availability, and leaves other leaders alone", async () => {
    const band = await insertBand(holder.db, leader.id, "Basement Tapes");
    const alex = await insertMember(holder.db, band.id, "Alex");
    await holder.db.insert(availability).values({ memberId: alex.id, date: "2026-11-02", timeSlot: "all_day", status: "available" });
    const [other] = await holder.db
      .insert(profiles)
      .values({ id: crypto.randomUUID(), fullName: "Other Leader" })
      .returning();
    await insertBand(holder.db, other.id, "Other Band");

    expect(await deleteMyAccount()).toEqual({ ok: true });

    expect(await holder.db.select().from(profiles).where(eq(profiles.id, leader.id))).toHaveLength(0);
    expect((await holder.db.select().from(bands)).map((b) => b.name)).toEqual(["Other Band"]);
    expect(await holder.db.select().from(availability)).toHaveLength(0);
    expect(holder.deleteUser).not.toHaveBeenCalled();
  });

  it("also deletes the Clerk user when sign-in is configured", async () => {
    const [clerkLeader] = await holder.db
      .update(profiles)
      .set({ clerkUserId: "user_123" })
      .where(eq(profiles.id, leader.id))
      .returning();
    holder.profile = clerkLeader;
    holder.authConfigured = true;

    expect(await deleteMyAccount()).toEqual({ ok: true });
    expect(holder.deleteUser).toHaveBeenCalledWith("user_123");
  });

  it("requires a signed-in leader", async () => {
    holder.profile = null;
    expect(await deleteMyAccount()).toEqual({ ok: false, error: "You must be signed in." });
    expect(await holder.db.select().from(profiles)).toHaveLength(1);
  });
});

describe("exportMyData", () => {
  it("returns the leader's bands, members and availability without member credentials", async () => {
    const band = await insertBand(holder.db, leader.id, "Basement Tapes");
    const alex = await insertMember(holder.db, band.id, "Alex", "secret-hash");
    await holder.db.insert(availability).values({ memberId: alex.id, date: "2026-11-02", timeSlot: "all_day", status: "maybe" });

    const result = await exportMyData();
    if (!result.ok || !result.data) throw new Error("expected an export");
    const data = JSON.parse(result.data.json);

    expect(result.data.filename).toMatch(/^downbeat-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(data.profile.id).toBe(leader.id);
    expect(data.bands[0].name).toBe("Basement Tapes");
    expect(data.bands[0].members[0].name).toBe("Alex");
    expect(data.bands[0].members[0].availability).toEqual([
      expect.objectContaining({ date: "2026-11-02", status: "maybe" }),
    ]);
    expect(result.data.json).not.toContain(alex.memberToken);
    expect(result.data.json).not.toContain("secret-hash");
  });
});
