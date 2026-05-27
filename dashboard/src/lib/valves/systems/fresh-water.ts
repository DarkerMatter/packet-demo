// dashboard/src/lib/valves/systems/fresh-water.ts
import type { SystemLayout } from "../types";

export const freshWaterSystem: SystemLayout = {
  meta: { id: "fresh-water", label: "FRESH WATER", accent: "text-cyan-600", pipeColor: "#0891b2" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "FW-EXP", label: "EXPANSION TK", pos: { x: 40, y: 60 }, width: 130, height: 100, fillLevel: 73 },
  ],
  pumps: [
    { id: "FW-P-01", label: "FW CIRC PUMP", pos: { x: 320, y: 300 } },
  ],
  consumers: [
    { id: "ME-JKT", label: "ME COOLING JKT", pos: { x: 820, y: 175 }, width: 130, height: 50 },
    { id: "FW-HX", label: "FW/SW HX", pos: { x: 820, y: 405 }, width: 130, height: 50 },
  ],
  pipes: [
    // Expansion tank → FW-401 (fill) → main loop (top junction)
    { from: { x: 170, y: 110 }, to: { x: 320, y: 110 }, gatedBy: "FW-401" },
    { from: { x: 320, y: 110 }, to: { x: 320, y: 280 } },
    // FW circ pump suction (from return line) and discharge (to coolant supply)
    { from: { x: 340, y: 300 }, to: { x: 460, y: 300 } },
    // Trunk → up to ME jacket supply
    { from: { x: 460, y: 300 }, to: { x: 460, y: 200 } },
    { from: { x: 460, y: 200 }, to: { x: 820, y: 200 }, gatedBy: "FW-403" },
    // ME jacket return → FW-404 → trunk
    { from: { x: 820, y: 430 }, to: { x: 460, y: 430 }, gatedBy: "FW-404" },
    { from: { x: 460, y: 430 }, to: { x: 460, y: 300 } },
    // FW-402 (return bypass) parallel return path
    { from: { x: 460, y: 430 }, to: { x: 240, y: 430 }, gatedBy: "FW-402" },
    { from: { x: 240, y: 430 }, to: { x: 240, y: 300 } },
    { from: { x: 240, y: 300 }, to: { x: 300, y: 300 } },
  ],
  valves: [
    { id: "FW-401", pos: { x: 240, y: 110 } },
    { id: "FW-402", pos: { x: 340, y: 430 } },
    { id: "FW-403", pos: { x: 640, y: 200 } },
    { id: "FW-404", pos: { x: 640, y: 430 } },
  ],
  initialValves: [
    { id: "FW-401", name: "EXPANSION TK FILL", kind: "globe", state: "throttled", position: 25, fault: false },
    { id: "FW-402", name: "FW RTN BYPASS", kind: "globe", state: "throttled", position: 40, fault: false },
    { id: "FW-403", name: "ME COOL JKT IN", kind: "gate", state: "open", position: 100, fault: false },
    { id: "FW-404", name: "ME COOL JKT OUT", kind: "gate", state: "open", position: 100, fault: false },
  ],
};
