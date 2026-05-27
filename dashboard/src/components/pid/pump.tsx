// dashboard/src/components/pid/pump.tsx
import type { PumpDef } from "@/lib/valves/types";

export function Pump({ pump, accent, running }: { pump: PumpDef; accent: string; running?: boolean }) {
  const { x, y } = pump.pos;
  return (
    <g>
      <circle cx={x} cy={y} r="20" fill="#0a0a14" stroke={accent} strokeWidth="1" />
      <g style={{ transformOrigin: `${x}px ${y}px`, animation: running ? "pid-spin 2s linear infinite" : undefined }}>
        <line x1={x - 14} y1={y} x2={x + 14} y2={y} stroke={accent} strokeWidth="1.5" />
        <line x1={x} y1={y - 14} x2={x} y2={y + 14} stroke={accent} strokeWidth="1.5" />
      </g>
      <text x={x} y={y + 36} textAnchor="middle" fill="#888" fontSize="9" fontFamily="monospace">{pump.label}</text>
      <style>{`@keyframes pid-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </g>
  );
}
