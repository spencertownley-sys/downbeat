import { format } from "date-fns";
import { ALL_DAY_BLOCK, DAYS_OF_WEEK, TIME_BLOCKS } from "@/lib/constants";

export interface BandScheduleSettings {
  activeDays: number[];
  useTimeBlocks: boolean;
  activeTimeBlocks: string[];
  startDate: string | null;
  endDate: string | null;
}

export interface BandEventLabel {
  eventLabel: string | null;
  venue: string | null;
}

/** "Gig at The Attic", "Band Practice", or null if nothing's been set. */
export function describeEvent(band: BandEventLabel): string | null {
  if (!band.eventLabel && !band.venue) return null;
  if (band.eventLabel && band.venue) return `${band.eventLabel} — ${band.venue}`;
  return band.eventLabel ?? band.venue;
}

/** The days of the week this band actually wants availability for. */
export function getActiveDays(band: Pick<BandScheduleSettings, "activeDays">) {
  const days = DAYS_OF_WEEK.filter((d) => band.activeDays.includes(d.value));
  return days.length > 0 ? days : DAYS_OF_WEEK;
}

/** The time-of-day rows to render — a single "All day" row if time-of-day is off. */
export function getActiveTimeBlocks(
  band: Pick<BandScheduleSettings, "useTimeBlocks" | "activeTimeBlocks">
) {
  if (!band.useTimeBlocks) return [ALL_DAY_BLOCK];
  const blocks = TIME_BLOCKS.filter((b) => band.activeTimeBlocks.includes(b.value));
  return blocks.length > 0 ? blocks : TIME_BLOCKS;
}

/** Human-readable summary shown to both the leader and members. */
export function describeSchedule(band: BandScheduleSettings): string {
  const days = getActiveDays(band);
  const dayPart =
    days.length === 7 ? "every day" : days.map((d) => d.short).join(", ");
  const timePart = band.useTimeBlocks
    ? getActiveTimeBlocks(band)
        .map((b) => b.label)
        .join(", ")
    : "all day";
  const fmt = (d: string) => format(new Date(`${d}T00:00:00`), "MMM d, yyyy");
  const rangePart =
    band.startDate && band.endDate
      ? ` between ${fmt(band.startDate)} and ${fmt(band.endDate)}`
      : band.startDate
        ? ` starting ${fmt(band.startDate)}`
        : band.endDate
          ? ` through ${fmt(band.endDate)}`
          : "";
  return `${dayPart} — ${timePart}${rangePart}`;
}
