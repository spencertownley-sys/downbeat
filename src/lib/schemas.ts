import { z } from "zod";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { ALL_DAY_SLOT, AVAILABILITY_STATUSES, TIMEZONES } from "@/lib/constants";

// Server-side caps on everything a leader or member can send. The forms have
// their own limits, but a Server Action can be called with any payload.

export const LIMITS = {
  description: 1000,
  location: 200,
  dayLabel: 60,
  /** Longest event a band can schedule; every page loops over these days. */
  maxRangeDays: 366,
  minYear: 2000,
  maxYear: 2100,
  availabilityUpdates: 500,
  labelDates: 366,
} as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A real calendar date as yyyy-MM-dd (rejects 2026-02-31). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = parseISO(value);
    return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
  });

/** "HH:MM", or the sentinel used by date-only bands. */
export const timeSlot = z.union([z.literal(ALL_DAY_SLOT), z.string().regex(HHMM)]);

export const availabilityUpdates = z
  .array(
    z.object({
      date: isoDate,
      timeSlot,
      status: z.enum(AVAILABILITY_STATUSES).nullable(),
    })
  )
  .max(LIMITS.availabilityUpdates);

export const dayLabel = z.string().trim().min(1).max(LIMITS.dayLabel);

export const labelDates = z.array(isoDate).min(1).max(LIMITS.labelDates);

let knownZones: Set<string> | null = null;

/** An IANA zone this runtime knows. "UTC" is listed separately because some runtimes leave it out. */
export function isSupportedTimezone(tz: string): boolean {
  if (!knownZones) {
    const supported =
      typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    knownZones = new Set<string>([...supported, "UTC", ...TIMEZONES.map((t) => t.value)]);
  }
  return knownZones.has(tz);
}

/** Days from start to end, counting both; assumes both are valid ISO dates. */
export function rangeLengthDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}
