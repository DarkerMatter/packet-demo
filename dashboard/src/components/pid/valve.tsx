// dashboard/src/components/pid/valve.tsx
import type { Valve as ValveState, ValveKind, ValvePlacement } from "@/lib/valves/types";

const stateFill = (state: string, position: number) => {
  if (state === "open") return "#22c55e";
  if (state === "closed") return "#444";
  if (state === "throttled") return "#fbbf24";
  return "#666";
};

interface ValveProps {
  placement: ValvePlacement;
  v: ValveState;
  enabled: boolean;
  onClick: (v: ValveState) => void;
  hovered: boolean;
  onHover: (id: string | null) => void;
}

export function Valve({ placement, v, enabled, onClick, hovered, onHover }: ValveProps) {
  const { x, y } = placement.pos;
  const fill = stateFill(v.state, v.position);

  const symbol = (() => {
    if (v.kind === "gate") {
      // bowtie
      return (
        <>
          <polygon points={`${x - 12},${y - 8} ${x},${y} ${x - 12},${y + 8}`} fill={fill} stroke="#000" strokeWidth="0.5" />
          <polygon points={`${x + 12},${y - 8} ${x},${y} ${x + 12},${y + 8}`} fill={fill} stroke="#000" strokeWidth="0.5" />
        </>
      );
    }
    if (v.kind === "ball") {
      // circle with bar (horizontal = open, vertical = closed)
      const barRot = v.state === "open" ? 0 : 90;
      return (
        <>
          <circle cx={x} cy={y} r="10" fill="#0a0a14" stroke={fill} strokeWidth="1.5" />
          <line x1={x - 8} y1={y} x2={x + 8} y2={y} stroke={fill} strokeWidth="2" transform={`rotate(${barRot} ${x} ${y})`} />
        </>
      );
    }
    if (v.kind === "globe") {
      return (
        <>
          <circle cx={x} cy={y} r="10" fill="#0a0a14" stroke={fill} strokeWidth="1.5" />
          <line x1={x} y1={y - 10} x2={x} y2={y + 10} stroke={fill} strokeWidth="1.5" />
          <line x1={x} y1={y - 14} x2={x} y2={y - 10} stroke={fill} strokeWidth="1.5" />
        </>
      );
    }
    // check
    return (
      <>
        <polygon points={`${x - 10},${y - 8} ${x + 8},${y} ${x - 10},${y + 8}`} fill="none" stroke={fill} strokeWidth="1.5" />
        <line x1={x + 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={fill} strokeWidth="1.5" />
      </>
    );
  })();

  return (
    <g
      onClick={() => enabled && onClick(v)}
      onMouseEnter={() => onHover(v.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.5 }}
    >
      {hovered && <circle cx={x} cy={y} r="18" fill="none" stroke={fill} strokeWidth="1" opacity="0.5" />}
      {symbol}
      <text x={x} y={y - 20} textAnchor="middle" fill="#888" fontSize="8" fontFamily="monospace">{v.id}</text>
      {v.kind === "globe" && (
        <text x={x} y={y + 30} textAnchor="middle" fill={fill} fontSize="8" fontFamily="monospace">{v.position}%</text>
      )}
    </g>
  );
}
