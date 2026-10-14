import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { profiles } from "@/db/schema";
import {
  bandOwners,
  createTestDb,
  insertBand,
  insertPreClerkLeader,
  resetTestDb,
  type TestDb,
} from "@/test/db";

const holder = vi.hoisted(() => ({ db: null as unknown as TestDb }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

const { claimPreClerkBands, findOrCreateProfileForClerkUser } = await import("./profiles");

const identity = (overrides: Partial<{ fullName: string; verifiedEmail: string | null }> = {}) =>
  vi.fn(async () => ({ fullName: "Jordan Rivers", verifiedEmail: "Jordan@Example.com", ...overrides }));

beforeAll(async () => {
  holder.db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(holder.db);
});

describe("findOrCreateProfileForClerkUser", () => {
  it("creates a profile on first sign-in", async () => {
    const load = identity();
    const profile = await findOrCreateProfileForClerkUser("user_jordan", load);

    expect(profile).toMatchObject({
      clerkUserId: "user_jordan",
      email: "jordan@example.com",
      fullName: "Jordan Rivers",
    });
    expect(load).toHaveBeenCalledOnce();
  });

  it("returns the existing profile without asking Clerk again", async () => {
    const first = await findOrCreateProfileForClerkUser("user_jordan", identity());
    const load = identity({ fullName: "Someone Else" });
    const second = await findOrCreateProfileForClerkUser("user_jordan", load);

    expect(second?.id).toBe(first?.id);
    expect(second?.fullName).toBe("Jordan Rivers");
    expect(load).not.toHaveBeenCalled();
  });

  it("returns null when Clerk has no such user", async () => {
    const profile = await findOrCreateProfileForClerkUser("user_gone", vi.fn(async () => null));
    expect(profile).toBeNull();
    expect(await holder.db.select().from(profiles)).toHaveLength(0);
  });

  it("creates one row when the first requests race", async () => {
    const [a, b] = await Promise.all([
      findOrCreateProfileForClerkUser("user_jordan", identity()),
      findOrCreateProfileForClerkUser("user_jordan", identity()),
    ]);

    expect(a?.id).toBe(b?.id);
    expect(await holder.db.select().from(profiles)).toHaveLength(1);
  });

  it("doesn't take over another profile that already has the email", async () => {
    const legacy = await insertPreClerkLeader(holder.db, []);
    const profile = await findOrCreateProfileForClerkUser(
      "user_imposter",
      identity({ verifiedEmail: "leader@downbeat.test" })
    );

    expect(profile?.id).not.toBe(legacy.id);
    expect(profile?.email).toBeNull();
    expect(profile?.clerkUserId).toBe("user_imposter");
  });
});

describe("claimPreClerkBands", () => {
  it("moves pre-Clerk bands to the user named by Clerk user ID", async () => {
    await insertPreClerkLeader(holder.db, ["The Basement Tapes", "asdf"]);
    const me = await findOrCreateProfileForClerkUser("user_jordan", identity());

    expect(await claimPreClerkBands(me!, "user_jordan")).toBe(2);
    expect(await bandOwners(holder.db)).toEqual({ "The Basement Tapes": me!.id, asdf: me!.id });
  });

  it("matches a verified email case-insensitively", async () => {
    await insertPreClerkLeader(holder.db, ["The Basement Tapes"]);
    const me = await findOrCreateProfileForClerkUser("user_jordan", identity());

    expect(await claimPreClerkBands(me!, "  JORDAN@example.com ")).toBe(1);
  });

  it("can't be matched by an email Clerk hasn't verified", async () => {
    await insertPreClerkLeader(holder.db, ["The Basement Tapes"]);
    const me = await findOrCreateProfileForClerkUser("user_jordan", identity({ verifiedEmail: null }));

    expect(await claimPreClerkBands(me!, "jordan@example.com")).toBe(0);
  });

  it("does nothing when unset or naming someone else", async () => {
    const legacy = await insertPreClerkLeader(holder.db, ["The Basement Tapes"]);
    const me = await findOrCreateProfileForClerkUser("user_jordan", identity());

    expect(await claimPreClerkBands(me!, undefined)).toBe(0);
    expect(await claimPreClerkBands(me!, "")).toBe(0);
    expect(await claimPreClerkBands(me!, "user_someone_else")).toBe(0);
    expect(await claimPreClerkBands(me!, "USER_JORDAN")).toBe(0);
    expect(await bandOwners(holder.db)).toEqual({ "The Basement Tapes": legacy.id });
  });

  it("never takes bands from another Clerk user", async () => {
    await insertPreClerkLeader(holder.db, ["Demo band"]);
    const other = await findOrCreateProfileForClerkUser("user_other", identity({ verifiedEmail: "o@x.com" }));
    await insertBand(holder.db, other!.id, "Other's band");
    const me = await findOrCreateProfileForClerkUser("user_jordan", identity());

    expect(await claimPreClerkBands(me!, "user_jordan")).toBe(1);
    expect(await bandOwners(holder.db)).toEqual({ "Demo band": me!.id, "Other's band": other!.id });
  });

  it("is a no-op once the bands have moved", async () => {
    await insertPreClerkLeader(holder.db, ["The Basement Tapes"]);
    const me = await findOrCreateProfileForClerkUser("user_jordan", identity());

    expect(await claimPreClerkBands(me!, "user_jordan")).toBe(1);
    expect(await claimPreClerkBands(me!, "user_jordan")).toBe(0);
  });
});
