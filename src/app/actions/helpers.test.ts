import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/action-errors";

vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => null }));
const { toActionError } = await import("./helpers");

describe("toActionError", () => {
  it("logs the error type and Postgres code, never the query or its parameters", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const secretToken = "6f1c2a52-58a4-4c4b-9d1e-1b2c3d4e5f60";
    const dbError = new Error(`Failed query: select * from band_members where member_token = $1\nparams: ${secretToken},alex@example.com`);
    dbError.name = "DrizzleQueryError";
    Object.assign(dbError, { cause: Object.assign(new Error("duplicate key"), { code: "23505" }) });

    const result = await toActionError(dbError);

    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("DrizzleQueryError");
    expect(logged).toContain("23505");
    expect(logged).not.toContain(secretToken);
    expect(logged).not.toContain("alex@example.com");
    log.mockRestore();
  });

  it("passes validation messages through to the user", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await toActionError(new ValidationError("Enter your name."))).toEqual({ ok: false, error: "Enter your name." });
  });
});
