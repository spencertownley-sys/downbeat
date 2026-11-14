import { SCHEDULE_TYPES, LOCATION_TYPES, type ScheduleType, type LocationType } from "@/lib/constants";
import { LIMITS, isSupportedTimezone, isoDate, rangeLengthDays } from "@/lib/schemas";

export interface BandSettingsInput {
  name: string;
  description?: string;
  scheduleType: ScheduleType;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
  activeDays: number[];
  timeSlotStart: string; // HH:MM
  timeSlotEnd: string; // HH:MM
  timeSlotMinutes: number;
  eventDurationMinutes: number;
  location?: string;
  locationType: LocationType;
  timezone: string;
}

export function validateSettings(input: BandSettingsInput): string[] {
  const errors: string[] = [];

  if (!input.name?.trim()) errors.push("Give your event a name.");
  if (input.name && input.name.trim().length > 80) errors.push("That name's a little long.");

  if (!SCHEDULE_TYPES.some((t) => t.value === input.scheduleType)) {
    errors.push("Pick a schedule type.");
  }
  if (!LOCATION_TYPES.some((t) => t.value === input.locationType)) {
    errors.push("Pick a location type.");
  }

  if ((input.description?.trim().length ?? 0) > LIMITS.description) {
    errors.push(`Keep the description under ${LIMITS.description} characters.`);
  }
  if ((input.location?.trim().length ?? 0) > LIMITS.location) {
    errors.push(`Keep the location under ${LIMITS.location} characters.`);
  }
  if (typeof input.timezone !== "string" || !isSupportedTimezone(input.timezone)) {
    errors.push("Pick a time zone.");
  }

  const startOk = isoDate.safeParse(input.startDate).success;
  const endOk = isoDate.safeParse(input.endDate).success;
  if (!startOk) errors.push("Invalid start date.");
  if (!endOk) errors.push("Invalid end date.");
  if (startOk) {
    const year = Number(input.startDate.slice(0, 4));
    if (year < LIMITS.minYear || year > LIMITS.maxYear) {
      errors.push(`Pick a start date between ${LIMITS.minYear} and ${LIMITS.maxYear}.`);
    }
  }
  if (startOk && endOk) {
    if (input.endDate < input.startDate) {
      errors.push("End date can't be before the start date.");
    } else if (rangeLengthDays(input.startDate, input.endDate) > LIMITS.maxRangeDays) {
      errors.push("An event can cover at most a year. Pick a shorter date range.");
    }
  }

  if (!input.activeDays || input.activeDays.length === 0) {
    errors.push("Pick at least one day of the week.");
  }
  if (input.activeDays?.some((d) => d < 0 || d > 6)) {
    errors.push("Invalid day of week.");
  }

  if (input.scheduleType === "date_time") {
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRe.test(input.timeSlotStart ?? "")) errors.push("Invalid start time.");
    if (!timeRe.test(input.timeSlotEnd ?? "")) errors.push("Invalid end time.");
    if (
      timeRe.test(input.timeSlotStart ?? "") &&
      timeRe.test(input.timeSlotEnd ?? "") &&
      input.timeSlotEnd <= input.timeSlotStart
    ) {
      errors.push("End time must be after start time.");
    }
    if (!input.timeSlotMinutes || input.timeSlotMinutes < 5 || input.timeSlotMinutes > 480) {
      errors.push("Time slot length should be between 5 and 480 minutes.");
    }
  }

  if (input.eventDurationMinutes && (input.eventDurationMinutes < 0 || input.eventDurationMinutes > 1440)) {
    errors.push("Event duration looks off.");
  }

  return errors;
}
