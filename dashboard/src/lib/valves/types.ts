// dashboard/src/lib/valves/types.ts
export type ValveKind = "gate" | "ball" | "globe" | "check";
export type ValveState = "open" | "closed" | "throttled";

export interface Valve {
  id: string;
  system: SystemId;
  name: string;
  kind: ValveKind;
  state: ValveState;
  position: number; // 0..100, percent open
  fault: boolean;
}

export type SystemId =
  | "fuel" | "lube-oil" | "sea-water" | "fresh-water"
  | "bilge-ballast" | "fire-main" | "air" | "hydraulics" | "sewage";

export interface SystemMeta {
  id: SystemId;
  label: string;
  accent: string; // tailwind text color class, e.g. "text-amber-600"
  pipeColor: string; // hex, used in SVG, e.g. "#a16207"
}

export interface Point { x: number; y: number }

export interface TankDef {
  id: string;
  label: string;
  pos: Point;
  width: number;
  height: number;
  fillLevel?: number; // 0..100 cosmetic
}

export interface PumpDef {
  id: string;
  label: string;
  pos: Point;
}

export interface ConsumerDef {
  id: string;
  label: string;
  pos: Point;
  width?: number;
  height?: number;
}

export interface PipeSegment {
  from: Point;
  to: Point;
  // Optional: an id of a valve that gates this segment (the segment is dimmed
  // when that valve is closed/throttled). If undefined, the segment is always live.
  gatedBy?: string;
}

export interface ValvePlacement {
  id: string; // matches Valve.id
  pos: Point;
  rotation?: 0 | 90 | 180 | 270;
}

export interface SystemLayout {
  meta: SystemMeta;
  viewBox: { w: number; h: number };
  tanks: TankDef[];
  pumps: PumpDef[];
  consumers: ConsumerDef[];
  pipes: PipeSegment[];
  valves: ValvePlacement[]; // visual placements, separate from the Valve[] state list
  initialValves: Omit<Valve, "system">[]; // valve definitions for state seeding
}
