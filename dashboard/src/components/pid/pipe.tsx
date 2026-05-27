// dashboard/src/components/pid/pipe.tsx
import type { PipeSegment } from "@/lib/valves/types";

export function Pipe({ seg, flowing, accent }: { seg: PipeSegment; flowing: boolean; accent: string }) {
  const { from, to } = seg;
  return (
    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
      stroke={flowing ? accent : "#2a2a3a"} strokeWidth={flowing ? 2 : 1.4} opacity={flowing ? 0.9 : 0.6} />
  );
}
