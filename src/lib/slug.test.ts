import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { generateSlug } from "./slug";

describe("generateSlug", () => {
  it("is two words and a 10-character suffix", () => {
    for (let i = 0; i < 200; i++) expect(generateSlug()).toMatch(/^[a-z]+-[a-z]+-[a-z2-9]{10}$/);
  });

  it("doesn't repeat", () => {
    const slugs = new Set(Array.from({ length: 1000 }, generateSlug));
    expect(slugs.size).toBe(1000);
  });

  it("doesn't use Math.random", () => {
    expect(readFileSync(new URL("./slug.ts", import.meta.url), "utf8")).not.toMatch(/Math\.random/);
  });
});
