import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { memberPasskeys, webauthnChallenges } from "@/db/schema";
import { createTestDb, insertBand, insertMember, insertPreClerkLeader, resetTestDb, type TestDb } from "@/test/db";

const holder = vi.hoisted(() => ({ db: null as unknown as TestDb }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

// The cryptographic checks belong to SimpleWebAuthn; these tests cover what
// surrounds them — challenges, scoping, storage — so verification is stubbed.
const webauthn = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(async () => ({ challenge: `reg-${crypto.randomUUID()}` })),
  generateAuthenticationOptions: vi.fn(async () => ({ challenge: `auth-${crypto.randomUUID()}` })),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));
vi.mock("@simplewebauthn/server", () => webauthn);

const {
  countPasskeys,
  finishPasskeyRegistration,
  finishPasskeySignIn,
  relyingPartyFor,
  startPasskeyRegistration,
  startPasskeySignIn,
} = await import("./passkeys");

const rp = { rpID: "trydownbeat.app", origins: ["https://trydownbeat.app"] };

function clientData(challenge: string) {
  return Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: rp.origins[0] })).toString(
    "base64url"
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const registration = (challenge: string, id = "cred-1") =>
  ({ id, rawId: id, type: "public-key", response: { clientDataJSON: clientData(challenge) } }) as any;
const assertion = (challenge: string, id = "cred-1") =>
  ({ id, rawId: id, type: "public-key", response: { clientDataJSON: clientData(challenge) } }) as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function verifiesRegistration(id = "cred-1") {
  webauthn.verifyRegistrationResponse.mockResolvedValue({
    verified: true,
    registrationInfo: { credential: { id, publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] } },
  });
}

let band: Awaited<ReturnType<typeof insertBand>>;
let otherBand: Awaited<ReturnType<typeof insertBand>>;
let alex: Awaited<ReturnType<typeof insertMember>>;

async function registerPasskey(member = alex, bandName = band.name, id = "cred-1") {
  const { challenge } = await startPasskeyRegistration(member, bandName, rp);
  verifiesRegistration(id);
  await finishPasskeyRegistration(member, registration(challenge, id), rp);
}

beforeAll(async () => {
  holder.db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(holder.db);
  vi.clearAllMocks();
  const leader = await insertPreClerkLeader(holder.db, []);
  band = await insertBand(holder.db, leader.id, "Basement Tapes");
  otherBand = await insertBand(holder.db, leader.id, "Other Band");
  alex = await insertMember(holder.db, band.id, "Alex");
});

describe("relyingPartyFor", () => {
  it("binds passkeys to the bare domain so www works too", () => {
    expect(relyingPartyFor("trydownbeat.app", "https")).toEqual({
      rpID: "trydownbeat.app",
      origins: ["https://trydownbeat.app"],
    });
    expect(relyingPartyFor("www.trydownbeat.app", "https").rpID).toBe("trydownbeat.app");
    expect(relyingPartyFor("localhost:3400", "http")).toEqual({ rpID: "localhost", origins: ["http://localhost:3400"] });
  });

  it("refuses an override that doesn't cover the host", () => {
    expect(relyingPartyFor("www.trydownbeat.app", "https", "trydownbeat.app").rpID).toBe("trydownbeat.app");
    expect(() => relyingPartyFor("evil.example", "https", "trydownbeat.app")).toThrow();
  });
});

describe("saving a passkey", () => {
  it("stores the credential for the member", async () => {
    await registerPasskey();

    const [saved] = await holder.db.select().from(memberPasskeys);
    expect(saved).toMatchObject({ memberId: alex.id, credentialId: "cred-1", counter: 0, transports: ["internal"] });
    expect(await countPasskeys(alex.id)).toBe(1);
    expect(webauthn.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ rpID: "trydownbeat.app", userName: "Alex · Basement Tapes" })
    );
  });

  it("can't replay the same challenge", async () => {
    const { challenge } = await startPasskeyRegistration(alex, band.name, rp);
    verifiesRegistration();
    await finishPasskeyRegistration(alex, registration(challenge), rp);

    await expect(finishPasskeyRegistration(alex, registration(challenge, "cred-2"), rp)).rejects.toThrow(/expired/);
    expect(await countPasskeys(alex.id)).toBe(1);
  });

  it("won't use a challenge issued to a different member", async () => {
    const jordan = await insertMember(holder.db, band.id, "Jordan");
    const { challenge } = await startPasskeyRegistration(alex, band.name, rp);
    verifiesRegistration();

    await expect(finishPasskeyRegistration(jordan, registration(challenge), rp)).rejects.toThrow(/expired/);
    expect(await countPasskeys(jordan.id)).toBe(0);
  });

  it("rejects an expired challenge", async () => {
    const { challenge } = await startPasskeyRegistration(alex, band.name, rp);
    await holder.db
      .update(webauthnChallenges)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(webauthnChallenges.challenge, challenge));
    verifiesRegistration();

    await expect(finishPasskeyRegistration(alex, registration(challenge), rp)).rejects.toThrow(/expired/);
  });

  it("stores nothing when the device's response doesn't verify", async () => {
    const { challenge } = await startPasskeyRegistration(alex, band.name, rp);
    webauthn.verifyRegistrationResponse.mockResolvedValue({ verified: false });

    await expect(finishPasskeyRegistration(alex, registration(challenge), rp)).rejects.toThrow(/couldn't save/);
    webauthn.verifyRegistrationResponse.mockRejectedValue(new Error("bad attestation"));
    const second = await startPasskeyRegistration(alex, band.name, rp);
    await expect(finishPasskeyRegistration(alex, registration(second.challenge), rp)).rejects.toThrow(/couldn't save/);
    expect(await countPasskeys(alex.id)).toBe(0);
  });

  it("rejects a response that isn't from a challenge we issued", async () => {
    verifiesRegistration();
    await expect(finishPasskeyRegistration(alex, registration("made-up"), rp)).rejects.toThrow(/expired/);
    const garbled = { id: "x", response: { clientDataJSON: "%%%" } } as never;
    await expect(finishPasskeyRegistration(alex, garbled, rp)).rejects.toThrow(/wasn't valid/);
  });
});

describe("signing in with a passkey", () => {
  beforeEach(async () => {
    await registerPasskey();
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 7 },
    });
  });

  it("returns the member's current link without replacing it", async () => {
    const { challenge } = await startPasskeySignIn(band.id, rp);
    const result = await finishPasskeySignIn(band.id, assertion(challenge), rp);

    expect(result).toEqual({ token: alex.memberToken, memberName: "Alex" });
    const [saved] = await holder.db.select().from(memberPasskeys);
    expect(saved.counter).toBe(7);
    expect(saved.lastUsedAt).not.toBeNull();
    expect(webauthn.verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: challenge,
        expectedRPID: "trydownbeat.app",
        credential: expect.objectContaining({ id: "cred-1", counter: 0 }),
      })
    );
  });

  it("rejects a passkey saved for a different band", async () => {
    const otherMember = await insertMember(holder.db, otherBand.id, "Alex");
    await registerPasskey(otherMember, otherBand.name, "cred-other");
    const { challenge } = await startPasskeySignIn(band.id, rp);

    await expect(finishPasskeySignIn(band.id, assertion(challenge, "cred-other"), rp)).rejects.toThrow(
      /different event/
    );
  });

  it("rejects an unknown passkey", async () => {
    const { challenge } = await startPasskeySignIn(band.id, rp);
    await expect(finishPasskeySignIn(band.id, assertion(challenge, "cred-unknown"), rp)).rejects.toThrow(
      /isn't saved/
    );
  });

  it("can't replay a sign-in or reuse another band's challenge", async () => {
    const { challenge } = await startPasskeySignIn(band.id, rp);
    await finishPasskeySignIn(band.id, assertion(challenge), rp);
    await expect(finishPasskeySignIn(band.id, assertion(challenge), rp)).rejects.toThrow(/expired/);

    const other = await startPasskeySignIn(otherBand.id, rp);
    await expect(finishPasskeySignIn(band.id, assertion(other.challenge), rp)).rejects.toThrow(/expired/);
  });

  it("won't accept a registration challenge for sign-in", async () => {
    const { challenge } = await startPasskeyRegistration(alex, band.name, rp);
    await expect(finishPasskeySignIn(band.id, assertion(challenge), rp)).rejects.toThrow(/expired/);
  });

  it("fails when the signature doesn't verify", async () => {
    webauthn.verifyAuthenticationResponse.mockResolvedValue({ verified: false });
    const { challenge } = await startPasskeySignIn(band.id, rp);

    await expect(finishPasskeySignIn(band.id, assertion(challenge), rp)).rejects.toThrow(/couldn't be verified/);
    const [saved] = await holder.db.select().from(memberPasskeys);
    expect(saved.counter).toBe(0);
  });
});
