"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { exportMyData } from "@/app/actions/account";
import { Button } from "@/components/ui/button";

/** Downloads everything Downbeat holds about this leader as a JSON file. */
export function ExportDataButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function download() {
    setError(null);
    startTransition(async () => {
      const result = await exportMyData();
      if (!result.ok || !result.data) {
        setError(result.ok ? "Something went wrong. Please try again." : result.error);
        return;
      }
      const url = URL.createObjectURL(new Blob([result.data.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={download} disabled={pending}>
        <Download className="h-4 w-4" />
        {pending ? "Preparing..." : "Export my data"}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
