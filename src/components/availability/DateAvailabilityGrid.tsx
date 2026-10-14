"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { setAvailabilityBulk, type AvailabilityUpdate } from "@/app/actions/availability";
import { ALL_DAY_SLOT, AVAILABILITY_STATUSES, STATUS_META, UNFILLED_META, formatTimeSlot } from "@/lib/constants";
import { buildGridLayout, calendarDayLabel, type GridCell, type GridLayout } from "@/lib/grid-layout";
import type { AvailabilityStatus, DateColumn, MemberGrid } from "@/types";
import { Button } from "@/components/ui/button";
import { WeekStartSelect, useWeekStart } from "@/components/availability/WeekStartSelect";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface CellPos {
  r: number;
  c: number;
}

function cellTitle(cell: GridCell): string {
  const day = format(parseISO(cell.date), "EEE, MMM d");
  return cell.slot === ALL_DAY_SLOT ? day : `${day} ${formatTimeSlot(cell.slot)}`;
}

/** Every position in the layout that holds a date. */
function answerablePositions(layout: GridLayout): CellPos[] {
  const positions: CellPos[] = [];
  layout.cells.forEach((row, r) => row.forEach((cell, c) => cell && positions.push({ r, c })));
  return positions;
}

export function DateAvailabilityGrid({
  slug,
  token,
  dateColumns,
  timeSlots,
  initialGrid,
}: {
  slug: string;
  token: string;
  dateColumns: DateColumn[];
  timeSlots: string[];
  initialGrid: MemberGrid;
}) {
  const { toast } = useToast();
  const [savedGrid, setSavedGrid] = useState<MemberGrid>(initialGrid);
  const [localGrid, setLocalGrid] = useState<MemberGrid>(initialGrid);
  /** "unset" is a UI-only tool — painting with it clears cells instead of setting a status. */
  const [activeStatus, setActiveStatus] = useState<AvailabilityStatus | "unset">("available");
  const [saving, setSaving] = useState(false);
  const [weekStart, setWeekStart] = useWeekStart();
  const layout = useMemo(
    () => buildGridLayout(dateColumns, timeSlots, weekStart),
    [dateColumns, timeSlots, weekStart]
  );
  // The window mouseup listener is registered once, so it reads the layout through a ref.
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const [dragStart, setDragStart] = useState<CellPos | null>(null);
  const [dragEnd, setDragEnd] = useState<CellPos | null>(null);
  const draggedRef = useRef(false);

  const dragStartRef = useRef<CellPos | null>(null);
  const dragEndRef = useRef<CellPos | null>(null);
  const activeStatusRef = useRef(activeStatus);
  useEffect(() => {
    activeStatusRef.current = activeStatus;
  }, [activeStatus]);
  useEffect(() => {
    dragStartRef.current = dragStart;
  }, [dragStart]);
  useEffect(() => {
    dragEndRef.current = dragEnd;
  }, [dragEnd]);

  function getStatus(grid: MemberGrid, date: string, slot: string): AvailabilityStatus | null {
    return grid[date]?.[slot] ?? null;
  }

  function setCells(cells: CellPos[], paint: AvailabilityStatus | "unset") {
    const value: AvailabilityStatus | null = paint === "unset" ? null : paint;
    setLocalGrid((prev) => {
      const next: MemberGrid = { ...prev };
      for (const { r, c } of cells) {
        const cell = layoutRef.current.cells[r]?.[c];
        if (!cell) continue;
        next[cell.date] = { ...next[cell.date], [cell.slot]: value };
      }
      return next;
    });
  }

  function commitRectFill(start: CellPos, end: CellPos, status: AvailabilityStatus | "unset") {
    const rMin = Math.min(start.r, end.r);
    const rMax = Math.max(start.r, end.r);
    const cMin = Math.min(start.c, end.c);
    const cMax = Math.max(start.c, end.c);
    const cells: CellPos[] = [];
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        cells.push({ r, c });
      }
    }
    setCells(cells, status);
  }

  useEffect(() => {
    function handleMouseUp() {
      const start = dragStartRef.current;
      const end = dragEndRef.current;
      if (start && end && draggedRef.current) {
        commitRectFill(start, end, activeStatusRef.current);
      }
      setDragStart(null);
      setDragEnd(null);
      if (draggedRef.current) {
        // The browser fires a synthetic `click` on the cell right after
        // mouseup — delay clearing so that handler still sees a drag just
        // happened and skips its own single-cell toggle.
        setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCellMouseDown(r: number, c: number) {
    setDragStart({ r, c });
    setDragEnd({ r, c });
  }

  function handleCellMouseEnter(r: number, c: number) {
    if (!dragStartRef.current) return;
    setDragEnd({ r, c });
    if (r !== dragStartRef.current.r || c !== dragStartRef.current.c) {
      draggedRef.current = true;
    }
  }

  function handleCellClick(r: number, c: number) {
    if (draggedRef.current) return; // a drag just finished on this cell
    setCells([{ r, c }], activeStatus);
  }

  const activeToolLabel = activeStatus === "unset" ? "Eraser" : STATUS_META[activeStatus].label;

  function isInDragRect(r: number, c: number): boolean {
    if (!dragStart || !dragEnd) return false;
    const rMin = Math.min(dragStart.r, dragEnd.r);
    const rMax = Math.max(dragStart.r, dragEnd.r);
    const cMin = Math.min(dragStart.c, dragEnd.c);
    const cMax = Math.max(dragStart.c, dragEnd.c);
    return r >= rMin && r <= rMax && c >= cMin && c <= cMax;
  }

  function fillAll() {
    setCells(answerablePositions(layout), activeStatus);
  }

  function fillRow(r: number) {
    const cells = layout.cols.map((_, c) => ({ r, c }));
    setCells(cells, activeStatus);
  }

  function fillColumn(c: number) {
    const cells = layout.rows.map((_, r) => ({ r, c }));
    setCells(cells, activeStatus);
  }

  function fillRemaining() {
    const cells = answerablePositions(layout).filter(({ r, c }) => {
      const cell = layout.cells[r][c]!;
      return !getStatus(localGrid, cell.date, cell.slot);
    });
    setCells(cells, activeStatus);
  }

  /** Marks every cell — including previously saved ones — to be cleared on next save. */
  function clearAllCells() {
    setCells(answerablePositions(layout), "unset");
  }

  function clearPendingChanges() {
    setLocalGrid(savedGrid);
  }

  const dirtyUpdates = useMemo<AvailabilityUpdate[]>(() => {
    const updates: AvailabilityUpdate[] = [];
    for (const row of layout.cells) {
      for (const cell of row) {
        if (!cell) continue;
        const local = getStatus(localGrid, cell.date, cell.slot);
        const saved = getStatus(savedGrid, cell.date, cell.slot);
        if (local !== saved) {
          updates.push({ date: cell.date, timeSlot: cell.slot, status: local });
        }
      }
    }
    return updates;
  }, [localGrid, savedGrid, layout]);

  async function handleSave() {
    if (dirtyUpdates.length === 0) return;
    setSaving(true);
    const result = await setAvailabilityBulk(slug, token, dirtyUpdates);
    setSaving(false);
    if (!result.ok) {
      toast({ title: "Couldn't save", description: result.error, variant: "destructive" });
      return;
    }
    setSavedGrid(localGrid);
    toast({ title: "Saved", description: "Your availability is up to date." });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {AVAILABILITY_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              activeStatus === status
                ? cn(STATUS_META[status].cellClass, "border-transparent")
                : "hover:bg-muted"
            )}
          >
            {STATUS_META[status].label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveStatus("unset")}
          title="Erase — click or drag to clear cells back to not-yet-answered"
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            activeStatus === "unset"
              ? cn(UNFILLED_META.cellClass, "border-foreground/40")
              : "hover:bg-muted"
          )}
        >
          Eraser
        </button>
        <span className="ml-1 text-xs text-muted-foreground">is selected — click or drag cells</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={fillAll}>
          Fill all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={fillRemaining}>
          Fill remaining
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearAllCells}>
          Clear all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearPendingChanges}>
          Clear unsaved changes
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {dirtyUpdates.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {dirtyUpdates.length} unsaved change{dirtyUpdates.length === 1 ? "" : "s"}
            </span>
          )}
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || dirtyUpdates.length === 0}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {layout.kind === "weeks" && (
        <div className="mb-2 flex justify-end">
          <WeekStartSelect value={weekStart} onChange={setWeekStart} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <div
          className="grid select-none"
          style={{
            gridTemplateColumns:
              layout.kind === "weeks"
                ? `64px repeat(${layout.cols.length}, minmax(30px, 1fr))`
                : `120px repeat(${layout.cols.length}, minmax(64px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 border-b border-r bg-card" />
          {layout.cols.map((col, c) => (
            <button
              key={col.key}
              type="button"
              onClick={() => fillColumn(c)}
              title={
                layout.kind === "weeks"
                  ? `Fill every ${col.title} with ${activeToolLabel}`
                  : `Fill ${col.title} with ${activeToolLabel}`
              }
              className="flex flex-col items-center justify-center border-b border-l bg-card px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              <span>{col.primary}</span>
              {col.secondary && <span>{col.secondary}</span>}
              {col.dayLabel && (
                <span className="mt-0.5 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                  {col.dayLabel}
                </span>
              )}
            </button>
          ))}

          {layout.rows.map((row, r) => (
            <div key={row.key} className="contents">
              <button
                type="button"
                onClick={() => fillRow(r)}
                title={
                  layout.kind === "weeks"
                    ? `Fill the ${row.title.toLowerCase()} with ${activeToolLabel}`
                    : `Fill ${row.title} with ${activeToolLabel}`
                }
                className={cn(
                  "sticky left-0 z-10 flex items-center justify-end border-b border-r bg-card py-2 text-right font-medium text-muted-foreground hover:bg-muted",
                  layout.kind === "weeks" ? "px-1.5 text-[10px] leading-tight" : "px-2 text-[11px]"
                )}
              >
                {row.primary}
              </button>
              {layout.cols.map((col, c) => {
                const cell = layout.cells[r][c];
                if (!cell) {
                  return <div key={`${row.key}-${col.key}`} className="border-b border-l bg-muted/40" />;
                }
                const status = localGrid[cell.date]?.[cell.slot];
                const meta = status ? STATUS_META[status] : UNFILLED_META;
                const inRect = isInDragRect(r, c);
                return (
                  <button
                    key={`${cell.date}-${cell.slot}`}
                    type="button"
                    onMouseDown={() => handleCellMouseDown(r, c)}
                    onMouseEnter={() => handleCellMouseEnter(r, c)}
                    onClick={() => handleCellClick(r, c)}
                    title={`${cellTitle(cell)}: ${meta.label}`}
                    className={cn(
                      "border-b border-l text-[10px] font-medium transition-colors",
                      layout.kind === "weeks" ? "flex h-12 flex-col items-center justify-center gap-0.5" : "h-9",
                      meta.cellClass,
                      inRect && "ring-2 ring-inset ring-foreground/60"
                    )}
                  >
                    {layout.kind === "weeks" ? (
                      <>
                        <span className="text-[11px] font-semibold sm:text-xs">{calendarDayLabel(cell.date)}</span>
                        {cell.dayLabel && (
                          <span className="max-w-full truncate px-0.5 text-[9px] font-semibold">
                            {cell.dayLabel}
                          </span>
                        )}
                        <span className="sr-only">{meta.label}</span>
                      </>
                    ) : (
                      <span className="sr-only">{meta.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
