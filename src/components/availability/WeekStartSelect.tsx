"use client";

import { useEffect, useState } from "react";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { DEFAULT_WEEK_START, isWeekStart, type WeekStart } from "@/lib/grid-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STORAGE_KEY = "downbeat:week-start";

/** Which day calendars start on — a per-viewer preference remembered on this device. */
export function useWeekStart(): [WeekStart, (value: WeekStart) => void] {
  const [weekStart, setWeekStart] = useState<WeekStart>(DEFAULT_WEEK_START);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const value = stored === null ? null : Number(stored);
      if (isWeekStart(value)) setWeekStart(value);
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, []);

  function update(value: WeekStart) {
    setWeekStart(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // localStorage unavailable — the choice just won't be remembered.
    }
  }

  return [weekStart, update];
}

export function WeekStartSelect({
  value,
  onChange,
}: {
  value: WeekStart;
  onChange: (value: WeekStart) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Week starts on
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v) as WeekStart)}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DAYS_OF_WEEK.map((day) => (
            <SelectItem key={day.value} value={String(day.value)} className="text-xs">
              {day.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
