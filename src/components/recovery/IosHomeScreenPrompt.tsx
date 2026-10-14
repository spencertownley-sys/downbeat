"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";

const DISMISS_KEY = "downbeat:ios-home-screen-dismissed";

/** Safari on iPhone/iPad, not already running as a Home Screen app. */
function shouldOffer(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Other iOS browsers and in-app browsers have different (or no) Add to Home Screen steps.
  const safari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|Instagram|FBAN|FBAV/.test(ua);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return iOS && safari && !standalone;
}

/**
 * Safari deletes a site's stored data after seven days of use without a
 * visit, which makes this device forget the member. Home Screen web apps are
 * exempt, so iOS Safari users get a nudge to add Downbeat there.
 */
export function IosHomeScreenPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Storage unavailable — show the prompt.
    }
    setVisible(!dismissed && shouldOffer());
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Can't remember the choice.
    }
  }

  if (!visible) return null;

  return (
    <div className="relative mb-6 rounded-xl border bg-card p-4 pr-10 text-sm shadow-sm">
      <p className="font-medium">Add Downbeat to your Home Screen</p>
      <p className="mt-1 text-muted-foreground">
        Safari erases website data if you don&apos;t visit for 7 days, which would make this phone forget
        you. Saved to your Home Screen, Downbeat keeps you signed in and opens straight to your
        availability.
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-1 text-muted-foreground">
        Tap <Share className="inline h-4 w-4 text-primary" aria-label="Share" /> Share, then
        <SquarePlus className="inline h-4 w-4 text-primary" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Add to Home Screen</span>.
        </span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
