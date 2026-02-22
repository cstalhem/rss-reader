"use client";

import { useState, useEffect } from "react";

/**
 * Subscribes to the system clock and returns seconds remaining until `targetIso`.
 * Returns `null` when no target is provided.
 */
export function useCountdown(targetIso: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!targetIso) {
      setRemaining(null);
      return;
    }

    const target = new Date(targetIso).getTime();
    const tick = () => setRemaining(Math.max(0, Math.round((target - Date.now()) / 1000)));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return remaining;
}
