"use client";

import { useEffect, useState } from "react";

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function LiveDuration({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startMs = new Date(startTime).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="font-mono tabular-nums">{formatHMS(elapsed)}</span>;
}
