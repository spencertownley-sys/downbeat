import { describe, expect, it } from "vitest";
import { validateSettings, type BandSettingsInput } from "./band-validation";
import { availabilityUpdates, isoDate, timeSlot } from "./schemas";

const valid: BandSettingsInput = {
  name: "Basement Tapes",
  description: "Weekly rehearsal",
  scheduleType: "date_time",
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  activeDays: [1, 3, 5],
  timeSlotStart: "17:00",
  timeSlotEnd: "22:00",
  timeSlotMinutes: 60,
  eventDurationMinutes: 120,
  location: "Studio B",
  locationType: "in_person",
  timezone: "America/New_York",
};

describe("validateSettings", () => {
  it("accepts a normal event", () => {
    expect(validateSettings(valid)).toEqual([]);
    expect(validateSettings({ ...valid, timezone: "UTC" })).toEqual([]);
    expect(validateSettings({ ...valid, startDate: "2026-01-01", endDate: "2027-01-01" })).toEqual([]);
  });

  it("rejects a 10-year date range", () => {
    expect(validateSettings({ ...valid, startDate: "2026-01-01", endDate: "2036-01-01" })).toEqual([
      expect.stringMatching(/at most a year/),
    ]);
  });

  it("rejects years far outside the present", () => {
    expect(validateSettings({ ...valid, startDate: "0001-01-01", endDate: "0001-01-02" })).toEqual([
      expect.stringMatching(/between 2000 and 2100/),
    ]);
  });

  it("rejects impossible dates", () => {
    expect(validateSettings({ ...valid, startDate: "2026-02-31" })).toContain("Invalid start date.");
  });

  it("rejects a 5000-character description and an overlong location", () => {
    expect(validateSettings({ ...valid, description: "x".repeat(5000) })).toEqual([
      expect.stringMatching(/description under 1000/),
    ]);
    expect(validateSettings({ ...valid, location: "x".repeat(201) })).toEqual([
      expect.stringMatching(/location under 200/),
    ]);
  });

  it("rejects an unknown time zone", () => {
    expect(validateSettings({ ...valid, timezone: "Mars/Olympus_Mons" })).toEqual(["Pick a time zone."]);
  });
});

describe("availability schemas", () => {
  const update = { date: "2026-11-02", timeSlot: "18:00", status: "available" as const };

  it("accepts real slots and the all-day sentinel", () => {
    expect(timeSlot.safeParse("18:00").success).toBe(true);
    expect(timeSlot.safeParse("all_day").success).toBe(true);
    expect(availabilityUpdates.safeParse([update, { ...update, status: null }]).success).toBe(true);
  });

  it("rejects junk slots, statuses and dates", () => {
    expect(timeSlot.safeParse("25:00").success).toBe(false);
    expect(timeSlot.safeParse("x".repeat(1000)).success).toBe(false);
    expect(availabilityUpdates.safeParse([{ ...update, status: "busy" }]).success).toBe(false);
    expect(isoDate.safeParse("2026-13-01").success).toBe(false);
  });

  it("rejects a 501-item update", () => {
    expect(availabilityUpdates.safeParse(Array.from({ length: 500 }, () => update)).success).toBe(true);
    expect(availabilityUpdates.safeParse(Array.from({ length: 501 }, () => update)).success).toBe(false);
  });
});
