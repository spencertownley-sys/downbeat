import { describe, expect, it } from "vitest";
import { getDateColumns } from "@/lib/band-settings";
import { ALL_DAY_SLOT } from "@/lib/constants";
import { buildGridLayout, calendarDayLabel, weekRangeLabel } from "./grid-layout";
import { parseISO } from "date-fns";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
// Wed Oct 1 2025 → Sun Oct 19 2025
const band = { startDate: "2025-10-01", endDate: "2025-10-19", activeDays: ALL_DAYS };

function cellDates(layout: ReturnType<typeof buildGridLayout>) {
  return layout.cells.map((row) => row.map((cell) => cell?.date ?? null));
}

describe("buildGridLayout for all-day events", () => {
  it("puts one week per row, starting on Monday by default", () => {
    const layout = buildGridLayout(getDateColumns(band), [ALL_DAY_SLOT]);

    expect(layout.kind).toBe("weeks");
    expect(layout.cols.map((c) => c.primary)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(layout.rows.map((r) => r.primary)).toEqual(["Sep 29 – Oct 5", "Oct 6–12", "Oct 13–19"]);
    expect(cellDates(layout)[0]).toEqual([
      null,
      null,
      "2025-10-01",
      "2025-10-02",
      "2025-10-03",
      "2025-10-04",
      "2025-10-05",
    ]);
    expect(cellDates(layout)[2][6]).toBe("2025-10-19");
  });

  it("starts weeks on whichever day is chosen", () => {
    const layout = buildGridLayout(getDateColumns(band), [ALL_DAY_SLOT], 0);

    expect(layout.cols.map((c) => c.primary)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(layout.rows.map((r) => r.primary)).toEqual(["Sep 28 – Oct 4", "Oct 5–11", "Oct 12–18", "Oct 19–25"]);
    expect(cellDates(layout)[3]).toEqual(["2025-10-19", null, null, null, null, null, null]);

    const saturday = buildGridLayout(getDateColumns(band), [ALL_DAY_SLOT], 6);
    expect(saturday.cols[0].primary).toBe("Sat");
    expect(saturday.cols[6].primary).toBe("Fri");
  });

  it("only shows columns for the event's active days, in week order", () => {
    const weekends = { ...band, activeDays: [0, 6] }; // Sat + Sun
    const mondayStart = buildGridLayout(getDateColumns(weekends), [ALL_DAY_SLOT], 1);
    const sundayStart = buildGridLayout(getDateColumns(weekends), [ALL_DAY_SLOT], 0);

    expect(mondayStart.cols.map((c) => c.primary)).toEqual(["Sat", "Sun"]);
    expect(cellDates(mondayStart)).toEqual([
      ["2025-10-04", "2025-10-05"],
      ["2025-10-11", "2025-10-12"],
      ["2025-10-18", "2025-10-19"],
    ]);
    expect(sundayStart.cols.map((c) => c.primary)).toEqual(["Sun", "Sat"]);
    expect(cellDates(sundayStart)[0]).toEqual([null, "2025-10-04"]);
  });

  it("carries day labels onto cells", () => {
    const layout = buildGridLayout(
      getDateColumns(band, [{ date: "2025-10-10", label: "Gig" }]),
      [ALL_DAY_SLOT]
    );
    const friday = layout.cells[1][4];
    expect(friday).toEqual({ date: "2025-10-10", slot: ALL_DAY_SLOT, dayLabel: "Gig" });
  });

  it("handles an event with no dates", () => {
    const layout = buildGridLayout([], [ALL_DAY_SLOT]);
    expect(layout).toMatchObject({ kind: "weeks", rows: [], cols: [], cells: [] });
  });
});

describe("buildGridLayout for date-and-time events", () => {
  it("keeps one column per date and one row per time slot", () => {
    const columns = getDateColumns({ ...band, endDate: "2025-10-02" });
    const layout = buildGridLayout(columns, ["17:00", "18:00"], 0);

    expect(layout.kind).toBe("slots");
    expect(layout.cols.map((c) => `${c.primary} ${c.secondary}`)).toEqual(["Wed 10/1", "Thu 10/2"]);
    expect(layout.rows.map((r) => r.primary)).toEqual(["5:00 PM", "6:00 PM"]);
    expect(layout.cells[1][0]).toEqual({ date: "2025-10-01", slot: "18:00", dayLabel: null });
  });
});

describe("labels", () => {
  it("formats week ranges within and across months", () => {
    expect(weekRangeLabel(parseISO("2025-10-13"))).toBe("Oct 13–19");
    expect(weekRangeLabel(parseISO("2025-12-29"))).toBe("Dec 29 – Jan 4");
  });

  it("shows the month only on the 1st", () => {
    expect(calendarDayLabel("2025-11-01")).toBe("Nov 1");
    expect(calendarDayLabel("2025-11-14")).toBe("14");
  });
});
