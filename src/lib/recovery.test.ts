import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { memberRejoinLinks } from "@/db/schema";
import {
  createTestDb,
  getMember,
  insertBand,
  insertMember,
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

const {
  createRejoinLink,
  generateRecoveryCode,
  getRejoinLinkStatus,
  hashRecoveryCode,
  issueRecoveryCode,
  recoverWithCode,
  redeemRejoinLink,
  REJOIN_LINK_TTL_MS,
} = await import("./recovery");

const HOUR = 60 * 60 * 1000;

let band: Awaited<ReturnType<typeof insertBand>>;
let otherBand: Awaited<ReturnType<typeof insertBand>>;

beforeAll(async () => {
  holder.db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(holder.db);
  const leader = await insertPreClerkLeader(holder.db, []);
  band = await insertBand(holder.db, leader.id, "Basement Tapes");
  otherBand = await insertBand(holder.db, leader.id, "Other Band");
});

describe("recovery codes", () => {
  it("look like XXXX-XXXX-XXXX without ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRecoveryCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("move the member to a new token and a new code", async () => {
    const code = generateRecoveryCode();
    const alex = await insertMember(holder.db, band.id, "Alex", hashRecoveryCode(code));

    const reclaimed = await recoverWithCode(band.slug, code);

    expect(reclaimed).toMatchObject({ slug: band.slug, memberName: "Alex" });
    expect(reclaimed!.token).not.toBe(alex.memberToken);
    expect(reclaimed!.recoveryCode).not.toBe(code);
    const after = await getMember(holder.db, alex.id);
    expect(after.memberToken).toBe(reclaimed!.token);
    expect(after.recoveryCodeHash).toBe(hashRecoveryCode(reclaimed!.recoveryCode));
  });

  it("only store a hash of the code", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const code = await issueRecoveryCode(alex.id);

    const stored = (await getMember(holder.db, alex.id)).recoveryCodeHash!;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(code.replace(/-/g, ""));
  });

  it("can't be used twice", async () => {
    const code = generateRecoveryCode();
    await insertMember(holder.db, band.id, "Alex", hashRecoveryCode(code));

    expect(await recoverWithCode(band.slug, code)).not.toBeNull();
    expect(await recoverWithCode(band.slug, code)).toBeNull();
  });

  it("let only one of two simultaneous uses through", async () => {
    const code = generateRecoveryCode();
    await insertMember(holder.db, band.id, "Alex", hashRecoveryCode(code));

    const results = await Promise.all([recoverWithCode(band.slug, code), recoverWithCode(band.slug, code)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("reject a wrong code without touching anyone", async () => {
    const code = generateRecoveryCode();
    const alex = await insertMember(holder.db, band.id, "Alex", hashRecoveryCode(code));

    expect(await recoverWithCode(band.slug, generateRecoveryCode())).toBeNull();
    expect(await recoverWithCode(band.slug, "")).toBeNull();
    expect(await recoverWithCode(band.slug, "not-a-code")).toBeNull();
    expect((await getMember(holder.db, alex.id)).memberToken).toBe(alex.memberToken);
  });

  it("only work in their own band", async () => {
    const code = generateRecoveryCode();
    await insertMember(holder.db, band.id, "Alex", hashRecoveryCode(code));

    expect(await recoverWithCode(otherBand.slug, code)).toBeNull();
    expect(await recoverWithCode("no-such-band", code)).toBeNull();
  });

  it("accept any case, spacing, or missing dashes", async () => {
    const code = generateRecoveryCode();
    await insertMember(holder.db, band.id, "Alex", hashRecoveryCode(code));

    const sloppy = ` ${code.toLowerCase().replace(/-/g, " ")} `;
    expect(await recoverWithCode(band.slug, sloppy)).not.toBeNull();
  });

  it("stop working once the member makes a new one", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const first = await issueRecoveryCode(alex.id);
    const second = await issueRecoveryCode(alex.id);

    expect(await recoverWithCode(band.slug, first)).toBeNull();
    expect(await recoverWithCode(band.slug, second)).not.toBeNull();
  });
});

describe("rejoin links", () => {
  it("move the member to a new token and issue a new recovery code", async () => {
    const code = generateRecoveryCode();
    const alex = await insertMember(holder.db, band.id, "Alex", hashRecoveryCode(code));
    const { token, expiresAt } = await createRejoinLink(alex.id);

    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(REJOIN_LINK_TTL_MS - 60_000);
    expect(await getRejoinLinkStatus(token)).toMatchObject({ ok: true, memberName: "Alex", bandName: band.name });

    const result = await redeemRejoinLink(token);

    expect(result).toMatchObject({ ok: true, slug: band.slug, memberName: "Alex" });
    if (!result.ok) throw new Error("expected success");
    const after = await getMember(holder.db, alex.id);
    expect(after.memberToken).toBe(result.token);
    expect(after.memberToken).not.toBe(alex.memberToken);
    // The old recovery code is replaced too.
    expect(await recoverWithCode(band.slug, code)).toBeNull();
    expect(after.recoveryCodeHash).toBe(hashRecoveryCode(result.recoveryCode));
  });

  it("only store a hash of the token", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const { token } = await createRejoinLink(alex.id);

    const [row] = await holder.db.select().from(memberRejoinLinks);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tokenHash).not.toBe(token);
  });

  it("work only once", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const { token } = await createRejoinLink(alex.id);

    const first = await redeemRejoinLink(token);
    const tokenAfterFirst = (await getMember(holder.db, alex.id)).memberToken;

    expect(first.ok).toBe(true);
    expect(await redeemRejoinLink(token)).toEqual({ ok: false, reason: "used" });
    expect(await getRejoinLinkStatus(token)).toEqual({ ok: false, reason: "used" });
    expect((await getMember(holder.db, alex.id)).memberToken).toBe(tokenAfterFirst);
  });

  it("let only one of two simultaneous uses through", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const { token } = await createRejoinLink(alex.id);

    const results = await Promise.all([redeemRejoinLink(token), redeemRejoinLink(token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, reason: "used" });
  });

  it("expire after 24 hours", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const { token } = await createRejoinLink(alex.id, new Date(Date.now() - 25 * HOUR));

    expect(await getRejoinLinkStatus(token)).toEqual({ ok: false, reason: "expired" });
    expect(await redeemRejoinLink(token)).toEqual({ ok: false, reason: "expired" });
    expect((await getMember(holder.db, alex.id)).memberToken).toBe(alex.memberToken);
  });

  it("still work just before 24 hours", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const { token } = await createRejoinLink(alex.id, new Date(Date.now() - 23 * HOUR));

    expect((await redeemRejoinLink(token)).ok).toBe(true);
  });

  it("are replaced when the leader makes a new one", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const old = await createRejoinLink(alex.id);
    const fresh = await createRejoinLink(alex.id);

    expect(await redeemRejoinLink(old.token)).toEqual({ ok: false, reason: "invalid" });
    expect((await redeemRejoinLink(fresh.token)).ok).toBe(true);
  });

  it("reject made-up tokens", async () => {
    expect(await getRejoinLinkStatus("nope")).toEqual({ ok: false, reason: "invalid" });
    expect(await redeemRejoinLink("nope")).toEqual({ ok: false, reason: "invalid" });
  });

  it("don't affect other members", async () => {
    const alex = await insertMember(holder.db, band.id, "Alex");
    const jordan = await insertMember(holder.db, band.id, "Jordan");
    const { token } = await createRejoinLink(alex.id);
    await createRejoinLink(jordan.id);

    await redeemRejoinLink(token);

    expect((await getMember(holder.db, jordan.id)).memberToken).toBe(jordan.memberToken);
    expect(await holder.db.select().from(memberRejoinLinks)).toHaveLength(2);
  });
});
