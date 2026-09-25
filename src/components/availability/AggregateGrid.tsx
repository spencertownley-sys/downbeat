"use client";

import { DAYS_OF_WEEK, TIME_BLOCKS } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AggregateGrid as AggregateGridType, TimeBlock } from "@/types";
import { cn } from "@/lib/utils";

/** Heat intensity: share of the band that's fully available in that slot. */
function heatClass(pctAvailable: number, total: number): string {
  if (total === 0) return "bg-secondary";
  if (pctAvailable === 0) return "bg-secondary";
  if (pctAvailable < 0.34) return "bg-primary/20";
  if (pctAvailable < 0.67) return "bg-primary/50";
  if (pctAvailable < 1) return "bg-primary/75";
  return "bg-primary text-primary-foreground";
}

export function AggregateGrid({
  grid,
  memberCount,
  days = DAYS_OF_WEEK,
  timeBlocks = TIME_BLOCKS,
}: {
  grid: AggregateGridType;
  memberCount: number;
  days?: readonly { value: number; label: string; short: string }[];
  timeBlocks?: readonly { value: string; label: string; hint: string }[];
}) {
  if (memberCount === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Share your band&apos;s link to start collecting availability.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}
        >
          <div />
          {days.map((day) => (
            <div key={day.value} className="pb-1 text-center text-xs font-medium text-muted-foreground">
              {day.short}
            </div>
          ))}
          {timeBlocks.map((block) => (
            <div key={block.value} className="contents">
              <div className="flex flex-col justify-center pr-2 text-right text-xs font-medium text-muted-foreground">
                {block.label}
              </div>
              {days.map((day) => {
                const counts = grid[day.value]?.[block.value as TimeBlock];
                const total = counts?.total ?? 0;
                const available = counts?.available ?? 0;
                const pct = total > 0 ? available / total : 0;

                return (
                  <Popover key={`${day.value}-${block.value}`}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={total === 0}
                        title={`${day.label} ${block.label}`}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-md text-[11px] font-semibold transition-opacity sm:h-12",
                          heatClass(pct, total),
                          total > 0 && "hover:opacity-80"
                        )}
                      >
                        {total > 0 ? `${available}/${total}` : ""}
                      </button>
                    </PopoverTrigger>
                    {counts && total > 0 && (
                      <PopoverContent className="w-64 space-y-3 text-sm" align="center">
                        <p className="font-medium">
                          {day.label} · {block.label}
                        </p>
                        <NameList label="Available" names={counts.availableNames} dot="bg-emerald-500" />
                        <NameList label="Maybe" names={counts.maybeNames} dot="bg-amber-400" />
                        <NameList
                          label="Can't make it"
                          names={counts.unavailableNames}
                          dot="bg-border"
                          emphasize
                        />
                      </PopoverContent>
                    )}
                  </Popover>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Each square shows how many of your {memberCount} member{memberCount === 1 ? "" : "s"} are
        available. Tap a square to see who. Darker means more of the band is free.
      </p>
    </div>
  );
}

function NameList({
  label,
  names,
  dot,
  emphasize,
}: {
  label: string;
  names: string[];
  dot: string;
  emphasize?: boolean;
}) {
  if (names.length === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
        <span className={cn("text-xs font-medium", emphasize && "text-foreground")}>
          {label} ({names.length})
        </span>
      </div>
      <p className={cn("text-xs text-muted-foreground", emphasize && "text-foreground/80")}>
        {names.join(", ")}
      </p>
    </div>
  );
}
