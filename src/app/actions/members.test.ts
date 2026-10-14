import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bandMembers } from "@/db/schema";
import { createTestDb, getMember, insertBand, insertMember, insertPreClerkLeader, resetTestDb, type TestDb } from "@/test/db";

const holder = vi.hoisted(() => ({ db: null as unknown as TestDb, profile: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => holder.profile }));

const { joinBand, updateMemberProfile } = await import("./members");
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
