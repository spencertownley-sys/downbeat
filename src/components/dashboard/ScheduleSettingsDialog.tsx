"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBandSchedule } from "@/app/actions/bands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DAYS_OF_WEEK, TIME_BLOCKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Band } from "@/types";

export function ScheduleSettingsDialog({ band }: { band: Band }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeDays, setActiveDays] = useState<number[]>(band.activeDays);
  const [useTimeBlocks, setUseTimeBlocks] = useState(band.useTimeBlocks);
  const [activeTimeBlocks, setActiveTimeBlocks] = useState<string[]>(band.activeTimeBlocks);
  const [startDate, setStartDate] = useState(band.startDate ?? "");
  const [endDate, setEndDate] = useState(band.endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDay(value: number) {
    setActiveDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value].sort()
    );
  }

  function toggleBlock(value: string) {
    setActiveTimeBlocks((prev) =>
      prev.includes(value) ? prev.filter((b) => b !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await updateBandSchedule(band.id, {
      activeDays,
      useTimeBlocks,
      activeTimeBlocks,
      startDate: startDate || null,
      endDate: endDate || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4" />
          What to check
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>What should the band consider?</DialogTitle>
            <DialogDescription>
              Only show your bandmates the days, times, and date range that actually matter — e.g.
              just Wed/Fri/Sat for gig nights.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Days of the week</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      activeDays.includes(day.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="use-time-blocks">Break days into times of day</Label>
                <button
                  id="use-time-blocks"
                  type="button"
                  role="switch"
                  aria-checked={useTimeBlocks}
                  onClick={() => setUseTimeBlocks((v) => !v)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    useTimeBlocks ? "bg-primary" : "bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                      useTimeBlocks ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Off = one toggle per day. On = separate morning/afternoon/evening/night.
              </p>
              {useTimeBlocks && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {TIME_BLOCKS.map((block) => (
                    <button
                      key={block.value}
                      type="button"
                      onClick={() => toggleBlock(block.value)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        activeTimeBlocks.includes(block.value)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      {block.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-date">
                  From <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">
                  Until <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
