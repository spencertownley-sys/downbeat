import { addDays, format, isSameMonth, parseISO, startOfWeek } from "date-fns";
import { ALL_DAY_SLOT, DAYS_OF_WEEK, formatTimeSlot } from "@/lib/constants";
import type { DateColumn } from "@/lib/band-settings";

/** 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DEFAULT_WEEK_START: WeekStart = 1; // Monday

export function isWeekStart(value: unknown): value is WeekStart {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
}

/** One answerable cell: a member's status for `slot` on `date`. */
export interface GridCell {
  date: string; // yyyy-MM-dd
  slot: string; // "HH:MM" or ALL_DAY_SLOT
  dayLabel: string | null;
}

export interface GridHeader {
  key: string;
  primary: string;
  secondary?: string;
  dayLabel?: string | null;
  /** Long form for tooltips, e.g. "Wed, Oct 15" or "Week of Oct 13". */
  title: string;
}

export interface GridLayout {
  /** "slots": rows are times, columns are dates. "weeks": rows are weeks, columns are weekdays. */
  kind: "slots" | "weeks";
  rows: GridHeader[];
  cols: GridHeader[];
  /** cells[row][col]; null where the calendar has no date (outside the range or an inactive day). */
  cells: (GridCell | null)[][];
}

/**
 * Lays out a band's dates for the availability grids. Date-and-time events
 * keep one column per date and one row per time slot; all-day events become
 * a calendar with one row per week, starting on `weekStartsOn`.
 */
export function buildGridLayout(
  dateColumns: DateColumn[],
  timeSlots: string[],
  weekStartsOn: WeekStart = DEFAULT_WEEK_START
): GridLayout {
  const allDay = timeSlots.length === 1 && timeSlots[0] === ALL_DAY_SLOT;
  return allDay ? weekLayout(dateColumns, weekStartsOn) : slotLayout(dateColumns, timeSlots);
}

function slotLayout(dateColumns: DateColumn[], timeSlots: string[]): GridLayout {
  return {
    kind: "slots",
    cols: dateColumns.map((col) => {
      const d = parseISO(col.date);
      return {
        key: col.date,
        primary: format(d, "EEE"),
        secondary: format(d, "M/d"),
        dayLabel: col.label,
        title: format(d, "EEE, MMM d"),
      };
    }),
    rows: timeSlots.map((slot) => ({ key: slot, primary: formatTimeSlot(slot), title: formatTimeSlot(slot) })),
    cells: timeSlots.map((slot) =>
      dateColumns.map((col) => ({ date: col.date, slot, dayLabel: col.label }))
    ),
  };
}

function weekLayout(dateColumns: DateColumn[], weekStartsOn: WeekStart): GridLayout {
  // Only weekdays the event actually uses get a column, in week order.
  const offset = (dayOfWeek: number) => (dayOfWeek - weekStartsOn + 7) % 7;
  const weekdays = Array.from(new Set(dateColumns.map((c) => c.dayOfWeek))).sort(
    (a, b) => offset(a) - offset(b)
  );

  const weeks = new Map<string, Map<number, DateColumn>>();
  for (const col of dateColumns) {
    const weekKey = format(startOfWeek(parseISO(col.date), { weekStartsOn }), "yyyy-MM-dd");
    if (!weeks.has(weekKey)) weeks.set(weekKey, new Map());
    weeks.get(weekKey)!.set(col.dayOfWeek, col);
  }
  const weekKeys = Array.from(weeks.keys()).sort();

  return {
    kind: "weeks",
    cols: weekdays.map((dow) => ({
      key: String(dow),
      primary: DAYS_OF_WEEK[dow].short,
      title: DAYS_OF_WEEK[dow].label,
    })),
    rows: weekKeys.map((key) => {
      const start = parseISO(key);
      return { key, primary: weekRangeLabel(start), title: `Week of ${format(start, "MMM d")}` };
    }),
    cells: weekKeys.map((key) =>
      weekdays.map((dow) => {
        const col = weeks.get(key)!.get(dow);
        return col ? { date: col.date, slot: ALL_DAY_SLOT, dayLabel: col.label } : null;
      })
    ),
  };
}

/** "Oct 13–19", or "Sep 29 – Oct 5" when the week spans two months. */
export function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return isSameMonth(weekStart, end)
    ? `${format(weekStart, "MMM d")}–${format(end, "d")}`
    : `${format(weekStart, "MMM d")} – ${format(end, "MMM d")}`;
}

/** Day number for a calendar cell, with the month on the 1st so month changes stand out. */
export function calendarDayLabel(date: string): string {
  const d = parseISO(date);
  return d.getDate() === 1 ? format(d, "MMM d") : format(d, "d");
}
