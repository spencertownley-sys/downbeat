"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ALL_DAY_SLOT, AVAILABILITY_STATUSES, STATUS_META, UNFILLED_META, formatTimeSlot } from "@/lib/constants";
import { buildGridLayout, calendarDayLabel, type GridCell } from "@/lib/grid-layout";
import type { AggregateGrid, DateColumn, SlotCounts } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WeekStartSelect, useWeekStart } from "@/components/availability/WeekStartSelect";
import { cn } from "@/lib/utils";

const NAME_KEY = {
  conflict: "conflictNames",
  maybe: "maybeNames",
  available: "availableNames",
  preferred: "preferredNames",
} as const;

function cellTitle(cell: GridCell): string {
  const day = format(parseISO(cell.date), "EEE, MMM d");
  return cell.slot === ALL_DAY_SLOT ? day : `${day} — ${formatTimeSlot(cell.slot)}`;
}

function dominant(counts: SlotCounts): "conflict" | "maybe" | "available" | "preferred" | null {
  let best: "conflict" | "maybe" | "available" | "preferred" | null = null;
  let bestCount = 0;
  for (const status of AVAILABILITY_STATUSES) {
    if (counts[status] > bestCount) {
      best = status;
      bestCount = counts[status];
    }
  }
  return best;
}

export function AggregateDateGrid({
  grid,
  dateColumns,
  timeSlots,
  memberCount,
}: {
  grid: AggregateGrid;
  dateColumns: DateColumn[];
  timeSlots: string[];
  memberCount: number;
}) {
  const [weekStart, setWeekStart] = useWeekStart();
  const layout = useMemo(
    () => buildGridLayout(dateColumns, timeSlots, weekStart),
    [dateColumns, timeSlots, weekStart]
  );

  if (memberCount === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Share your invite link to start collecting availability.
      </p>
    );
  }

  const weeks = layout.kind === "weeks";

  return (
    <div>
      {weeks && (
        <div className="mb-2 flex justify-end">
          <WeekStartSelect value={weekStart} onChange={setWeekStart} />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <div
          className="grid"
          style={{
            gridTemplateColumns: weeks
              ? `64px repeat(${layout.cols.length}, minmax(30px, 1fr))`
              : `120px repeat(${layout.cols.length}, minmax(64px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 border-b border-r bg-card" />
          {layout.cols.map((col) => (
            <div
              key={col.key}
              title={col.title}
              className="flex flex-col items-center justify-center border-b border-l bg-card px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground"
            >
              <span>{col.primary}</span>
              {col.secondary && <span>{col.secondary}</span>}
              {col.dayLabel && (
                <span className="mt-0.5 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                  {col.dayLabel}
                </span>
              )}
            </div>
          ))}

          {layout.rows.map((row, r) => (
            <div key={row.key} className="contents">
              <div
                title={row.title}
                className={cn(
                  "sticky left-0 z-10 flex items-center justify-end border-b border-r bg-card py-2 text-right font-medium text-muted-foreground",
                  weeks ? "px-1.5 text-[10px] leading-tight" : "px-2 text-[11px]"
                )}
              >
                {row.primary}
              </div>
              {layout.cols.map((col, c) => {
                const cell = layout.cells[r][c];
                if (!cell) {
                  return <div key={`${row.key}-${col.key}`} className="border-b border-l bg-muted/40" />;
                }
                const counts = grid[cell.date]?.[cell.slot];
                const dayNumber = weeks && (
                  <span className="flex items-center justify-center gap-1 px-0.5 pt-1 text-[11px] font-semibold text-foreground sm:text-xs">
                    {calendarDayLabel(cell.date)}
                    {cell.dayLabel && (
                      <span className="truncate text-[9px] font-semibold text-primary">{cell.dayLabel}</span>
                    )}
                  </span>
                );
                if (!counts) {
                  return (
                    <div
                      key={`${cell.date}-${cell.slot}`}
                      className={cn("border-b border-l", weeks ? "h-14" : "h-10", UNFILLED_META.cellClass)}
                    >
                      {dayNumber}
                    </div>
                  );
                }
                const best = dominant(counts);
                const meta = best ? STATUS_META[best] : UNFILLED_META;
                return (
                  <Popover key={`${cell.date}-${cell.slot}`}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex flex-col border-b border-l text-[9px] font-semibold transition-colors",
                          weeks ? "h-14 bg-card hover:bg-muted" : cn("h-10", meta.cellClass)
                        )}
                        title={cellTitle(cell)}
                      >
                        {dayNumber}
                        <span className={cn("flex w-full flex-1", weeks && "px-1 pb-1 pt-0.5")}>
                          <StackedBar counts={counts} memberCount={memberCount} rounded={weeks} />
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-2" align="center">
                      <p className="text-sm font-semibold">{cellTitle(cell)}</p>
                      {[...AVAILABILITY_STATUSES].reverse().map((status) => {
                        const names = counts[NAME_KEY[status]];
                        if (names.length === 0) return null;
                        return (
                          <div key={status} className="text-xs">
                            <div className="mb-0.5 flex items-center gap-1.5 font-medium">
                              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[status].dotClass)} />
                              {STATUS_META[status].label} ({names.length})
                            </div>
                            <p className="pl-4 text-muted-foreground">{names.join(", ")}</p>
                          </div>
                        );
                      })}
                      {counts.unfilledNames.length > 0 && (
                        <div className="text-xs">
                          <div className="mb-0.5 flex items-center gap-1.5 font-medium">
                            <span className={cn("h-2.5 w-2.5 rounded-full", UNFILLED_META.dotClass)} />
                            {UNFILLED_META.label} ({counts.unfilledNames.length})
                          </div>
                          <p className="pl-4 text-muted-foreground">{counts.unfilledNames.join(", ")}</p>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A thin proportional stacked bar of the 4 statuses (+ unfilled) for this cell. */
function StackedBar({
  counts,
  memberCount,
  rounded = false,
}: {
  counts: SlotCounts;
  memberCount: number;
  rounded?: boolean;
}) {
  const segments: { key: string; count: number; cls: string }[] = [
    { key: "preferred", count: counts.preferred, cls: STATUS_META.preferred.dotClass },
    { key: "available", count: counts.available, cls: STATUS_META.available.dotClass },
    { key: "maybe", count: counts.maybe, cls: STATUS_META.maybe.dotClass },
    { key: "conflict", count: counts.conflict, cls: STATUS_META.conflict.dotClass },
    { key: "unfilled", count: counts.unfilled, cls: UNFILLED_META.dotClass },
  ];

  return (
    <div className={cn("flex h-full w-full overflow-hidden", rounded && "rounded-sm")}>
      {segments
        .filter((s) => s.count > 0)
        .map((s) => (
          <div
            key={s.key}
            className={cn(s.cls)}
            style={{ width: `${(s.count / memberCount) * 100}%` }}
          />
        ))}
    </div>
  );
}
