// dashboard/src/lib/valves/systems/fresh-water.ts
import type { SystemLayout } from "../types";

export const freshWaterSystem: SystemLayout = {
  meta: { id: "fresh-water", label: "FRESH WATER", accent: "text-cyan-600", pipeColor: "#0891b2" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "FW-EXP", label: "EXPANSION TK", pos: { x: 80, y: 60 }, width: 120, height: 100, fillLevel: 73 },
  ],
  pumps: [
    { id: "FW-P-01", label: "FW CIRC PUMP", pos: { x: 300, y: 320 } },
  ],
  consumers: [
    { id: "ME-JKT", label: "ME COOLING JKT", pos: { x: 700, y: 200 } },
    { id: "FW-HX", label: "FW/SW HX", pos: { x: 700, y: 440 } },
  ],
  pipes: [
    { from: { x: 200, y: 110 }, to: { x: 320, y: 320 }, gatedBy: "FW-401" },
    { from: { x: 340, y: 320 }, to: { x: 700, y: 240 }, gatedBy: "FW-403" },
    { from: { x: 700, y: 290 }, to: { x: 700, y: 440 } },
    { from: { x: 700, y: 480 }, to: { x: 280, y: 480 }, gatedBy: "FW-404" },
    { from: { x: 280, y: 480 }, to: { x: 280, y: 110 }, gatedBy: "FW-402" },
  ],
  valves: [
    { id: "FW-401", pos: { x: 260, y: 220 } },
    { id: "FW-402", pos: { x: 280, y: 300 } },
    { id: "FW-403", pos: { x: 520, y: 280 } },
    { id: "FW-404", pos: { x: 480, y: 480 } },
  ],
  initialValves: [
    { id: "FW-401", name: "EXPANSION TK FILL", kind: "globe", state: "throttled", position: 25, fault: false },
    { id: "FW-402", name: "FW RTN BYPASS", kind: "globe", state: "throttled", position: 40, fault: false },
    { id: "FW-403", name: "ME COOL JKT IN", kind: "gate", state: "open", position: 100, fault: false },
    { id: "FW-404", name: "ME COOL JKT OUT", kind: "gate", state: "open", position: 100, fault: false },
  ],
};
