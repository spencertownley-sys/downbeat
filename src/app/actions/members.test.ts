import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bandMembers, profiles, rateLimits } from "@/db/schema";
import { createTestDb, getMember, insertBand, insertMember, insertPreClerkLeader, resetTestDb, type TestDb } from "@/test/db";

const holder = vi.hoisted(() => ({ db: null as unknown as TestDb, profile: null as unknown, ip: "203.0.113.1" }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": holder.ip }) }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => holder.profile }));
vi.mock("@/lib/auth-config", () => ({ isAuthConfigured: () => true }));

const { claimMemberRow, joinBand, leaveBand, removeMember, rotateMemberToken, updateMemberProfile } = await import("./members");
const { createMemberRejoinLink, newRecoveryCode, recoverMember, spendRejoinLink } = await import("./recovery");
const { hashRecoveryCode } = await import("@/lib/recovery");

let leader: Awaited<ReturnType<typeof insertPreClerkLeader>>;
let band: Awaited<ReturnType<typeof insertBand>>;

beforeAll(async () => {
  holder.db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(holder.db);
  leader = await insertPreClerkLeader(holder.db, []);
  band = await insertBand(holder.db, leader.id, "Basement Tapes");
  holder.profile = leader;
  holder.ip = "203.0.113.1";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("joinBand", () => {
  it("creates a member and hands back a recovery code once", async () => {
    const result = await joinBand(band.slug, "Alex", "Guitar");

    if (!result.ok || !result.data) throw new Error("expected success");
    expect(result.data.memberName).toBe("Alex");
    expect(result.data.recoveryCode).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    const [row] = await holder.db.select().from(bandMembers);
    expect(row.memberToken).toBe(result.data.token);
    expect(row.recoveryCodeHash).toBe(hashRecoveryCode(result.data.recoveryCode));
  });

  it("no longer gives an existing member's link to someone who types their name", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");

    for (const name of ["Alex", "alex", "  ALEX  "]) {
      const result = await joinBand(band.slug, name);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(alex.memberToken);
      if (!result.ok) expect(result.error).toMatch(/already goes by that name/);
    }
    expect(await holder.db.select().from(bandMembers)).toHaveLength(1);
  });

  it("treats % and _ in names literally", async () => {
    await insertMember(holder.db, band.id, "Alex");

    expect((await joinBand(band.slug, "%")).ok).toBe(true);
    expect((await joinBand(band.slug, "A__x")).ok).toBe(true);
  });

  it("allows the same name in a different band", async () => {
    const other = await insertBand(holder.db, leader.id, "Other Band");
    await insertMember(holder.db, band.id, "Alex");

    expect((await joinBand(other.slug, "Alex")).ok).toBe(true);
  });
});

describe("updateMemberProfile", () => {
  it("won't rename someone to a name another member uses", async () => {
    await insertMember(holder.db, band.id, "Alex");
    const jordan = await insertMember(holder.db, band.id, "Jordan");

    const taken = await updateMemberProfile(band.slug, jordan.memberToken, { name: "alex" });
    const ownName = await updateMemberProfile(band.slug, jordan.memberToken, { name: "JORDAN" });

    expect(taken.ok).toBe(false);
    expect(ownName.ok).toBe(true);
  });
});

describe("recovery actions", () => {
  it("recovers with the code from joining, then the old link and code stop working", async () => {
    const joined = await joinBand(band.slug, "Alex");
    if (!joined.ok || !joined.data) throw new Error("join failed");

    const recovered = await recoverMember(band.slug, joined.data.recoveryCode);
    if (!recovered.ok || !recovered.data) throw new Error("recovery failed");

    expect(recovered.data.token).not.toBe(joined.data.token);
    const again = await recoverMember(band.slug, joined.data.recoveryCode);
    expect(again).toEqual({ ok: false, error: expect.stringMatching(/doesn't match anyone/) });
  });

  it("explains a wrong code", async () => {
    await joinBand(band.slug, "Alex");
    const result = await recoverMember(band.slug, "AAAA-BBBB-CCCC");
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/doesn't match anyone/) });
  });

  it("lets a member replace their code from their page", async () => {
    const joined = await joinBand(band.slug, "Alex");
    if (!joined.ok || !joined.data) throw new Error("join failed");

    const fresh = await newRecoveryCode(band.slug, joined.data.token);
    if (!fresh.ok || !fresh.data) throw new Error("expected a code");

    expect((await recoverMember(band.slug, joined.data.recoveryCode)).ok).toBe(false);
    expect((await recoverMember(band.slug, fresh.data.recoveryCode)).ok).toBe(true);
    expect((await newRecoveryCode(band.slug, "00000000-0000-4000-8000-000000000000")).ok).toBe(false);
  });

  it("lets the band's leader make a rejoin link that works once", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");

    const link = await createMemberRejoinLink(band.id, alex.id);
    if (!link.ok || !link.data) throw new Error("expected a link");
    const token = link.data.path.replace("/rejoin/", "");

    const first = await spendRejoinLink(token);
    const second = await spendRejoinLink(token);

    expect(first).toMatchObject({ ok: true, data: { slug: band.slug, memberName: "Alex" } });
    expect(second).toEqual({ ok: false, error: expect.stringMatching(/already been used/) });
  });

  it("won't let another leader make a rejoin link for this band's members", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const strangersBand = await insertBand(holder.db, leader.id, "Stranger's Band");
    holder.profile = { ...leader, id: crypto.randomUUID() };

    expect((await createMemberRejoinLink(band.id, alex.id)).ok).toBe(false);
    // Nor by pairing their own band id with someone else's member.
    holder.profile = leader;
    expect((await createMemberRejoinLink(strangersBand.id, alex.id)).ok).toBe(false);
    expect((await getMember(holder.db, alex.id)).memberToken).toBe(alex.memberToken);
  });

  it("requires a signed-in leader to make a rejoin link", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    holder.profile = null;

    expect(await createMemberRejoinLink(band.id, alex.id)).toEqual({ ok: false, error: "You must be signed in." });
  });
});

describe("removing members", () => {
  it("lets the band's leader remove a member", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");

    expect(await removeMember(band.id, alex.id)).toEqual({ ok: true });
    expect(await getMember(holder.db, alex.id)).toBeUndefined();
  });

  it("won't let another leader remove someone, even by pairing their own band", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const strangersBand = await insertBand(holder.db, leader.id, "Stranger's Band");

    holder.profile = { ...leader, id: crypto.randomUUID() };
    expect((await removeMember(band.id, alex.id)).ok).toBe(false);
    holder.profile = leader;
    expect((await removeMember(strangersBand.id, alex.id)).ok).toBe(false);
    expect(await getMember(holder.db, alex.id)).toBeDefined();
  });

  it("lets a member leave with their own link only", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const jordan = await insertMember(holder.db, band.id, "Jordan");

    expect((await leaveBand(band.slug, "00000000-0000-4000-8000-000000000000")).ok).toBe(false);
    expect(await leaveBand(band.slug, alex.memberToken)).toEqual({ ok: true });
    expect(await getMember(holder.db, alex.id)).toBeUndefined();
    expect(await getMember(holder.db, jordan.id)).toBeDefined();
  });
});

describe("rate limits", () => {
  it("refuses the 11th join from one IP for one band within the hour", async () => {
    for (let i = 1; i <= 10; i++) expect((await joinBand(band.slug, `Player ${i}`)).ok).toBe(true);

    expect(await joinBand(band.slug, "Player 11")).toEqual({ ok: false, error: "Too many attempts. Try again later." });

    // Another visitor, or the same visitor on another band, isn't affected.
    holder.ip = "203.0.113.2";
    expect((await joinBand(band.slug, "Player 11")).ok).toBe(true);
    holder.ip = "203.0.113.1";
    const other = await insertBand(holder.db, leader.id, "Other Band");
    expect((await joinBand(other.slug, "Player 1")).ok).toBe(true);
  });

  it("starts counting again once the window has passed", async () => {
    for (let i = 1; i <= 10; i++) await joinBand(band.slug, `Player ${i}`);
    await holder.db.update(rateLimits).set({ windowStart: new Date(Date.now() - 2 * 60 * 60 * 1000) });

    expect((await joinBand(band.slug, "Player 11")).ok).toBe(true);
  });

  it("stores no raw IP address", async () => {
    await joinBand(band.slug, "Alex");
    const rows = await holder.db.select().from(rateLimits);
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain("203.0.113.1");
  });

  it("limits recovery code guesses", async () => {
    for (let i = 0; i < 10; i++) await recoverMember(band.slug, "AAAA-BBBB-CCCC");
    expect(await recoverMember(band.slug, "AAAA-BBBB-CCCC")).toEqual({
      ok: false,
      error: "Too many attempts. Try again later.",
    });
  });

  it("refuses the 51st member of a band", async () => {
    for (let i = 1; i <= 50; i++) await insertMember(holder.db, band.id, `Member ${i}`);

    const result = await joinBand(band.slug, "One Too Many");
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/50 members/) });
    expect(await holder.db.select().from(bandMembers)).toHaveLength(50);
  });
});

describe("rotateMemberToken", () => {
  it("gives the member a new link and the old one stops working", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");

    const result = await rotateMemberToken(band.slug, alex.memberToken);
    if (!result.ok || !result.data) throw new Error("expected a new token");

    expect(result.data.token).not.toBe(alex.memberToken);
    expect((await getMember(holder.db, alex.id)).memberToken).toBe(result.data.token);
    expect((await rotateMemberToken(band.slug, alex.memberToken)).ok).toBe(false);
    expect((await updateMemberProfile(band.slug, alex.memberToken, { name: "Alex" })).ok).toBe(false);
  });
});

describe("claimMemberRow", () => {
  it("links an unlinked spot to the signed-in account, and is safe to repeat", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");

    expect(await claimMemberRow(band.slug, alex.memberToken)).toEqual({ ok: true });
    expect(await claimMemberRow(band.slug, alex.memberToken)).toEqual({ ok: true });
    expect((await getMember(holder.db, alex.id)).profileId).toBe(leader.id);
  });

  it("won't move a spot that is already linked to someone else's account", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    await claimMemberRow(band.slug, alex.memberToken);
    const [intruder] = await holder.db
      .insert(profiles)
      .values({ id: crypto.randomUUID(), fullName: "Someone Else" })
      .returning();
    holder.profile = intruder;

    expect(await claimMemberRow(band.slug, alex.memberToken)).toEqual({
      ok: false,
      error: "This spot is already linked to another account.",
    });
    expect((await getMember(holder.db, alex.id)).profileId).toBe(leader.id);
  });
});

describe("unique member names", () => {
  it("lets only one of two simultaneous joins take a name", async () => {
    const results = await Promise.all([joinBand(band.slug, "Alex"), joinBand(band.slug, "alex")]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: expect.stringMatching(/already goes by that name/) });
    expect(await holder.db.select().from(bandMembers)).toHaveLength(1);
  });

  it("is enforced by the database, ignoring case", async () => {
    await insertMember(holder.db, band.id, "Alex");
    await expect(insertMember(holder.db, band.id, "ALEX")).rejects.toThrow();
  });

  it("migration 0009 renames existing duplicates before building the index", async () => {
    const sqlText = readFileSync("src/db/migrations/0009_unique_member_names.sql", "utf8");
    const [dedupe, createIndex] = sqlText.split("--> statement-breakpoint");
    await holder.db.execute(sql.raw("DROP INDEX uq_band_members_band_name"));
    const first = await insertMember(holder.db, band.id, "Alex");
    const second = await insertMember(holder.db, band.id, "alex");

    await holder.db.execute(sql.raw(dedupe));
    await holder.db.execute(sql.raw(createIndex));

    expect((await getMember(holder.db, first.id)).name).toBe("Alex");
    expect((await getMember(holder.db, second.id)).name).toBe(`alex (${second.id.slice(0, 4)})`);
  });
});
