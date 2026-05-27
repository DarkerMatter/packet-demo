// dashboard/src/components/pid/tank.tsx
import type { TankDef } from "@/lib/valves/types";

export function Tank({ tank, accent }: { tank: TankDef; accent: string }) {
  const { x, y } = tank.pos;
  const { width: w, height: h, fillLevel } = tank;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="#0a0a14" stroke={accent} strokeWidth="1" />
      {fillLevel !== undefined && (
        <rect x={x + 2} y={y + h - (h - 4) * (fillLevel / 100) - 2}
          width={w - 4} height={(h - 4) * (fillLevel / 100)}
          fill={accent} opacity={0.18} />
      )}
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fill={accent} fontSize="11" fontFamily="monospace" fontWeight="bold">{tank.id}</text>
      <text x={x + w / 2} y={y + h / 2 + 9} textAnchor="middle" fill="#666" fontSize="9" fontFamily="monospace">{tank.label}</text>
      {fillLevel !== undefined && (
        <text x={x + w / 2} y={y + h + 14} textAnchor="middle" fill={accent} fontSize="10" fontFamily="monospace">{fillLevel}%</text>
      )}
    </g>
  );
}
