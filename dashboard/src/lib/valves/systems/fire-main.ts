// dashboard/src/lib/valves/systems/fire-main.ts
import type { SystemLayout } from "../types";

export const fireMainSystem: SystemLayout = {
  meta: { id: "fire-main", label: "FIRE MAIN", accent: "text-red-500", pipeColor: "#ef4444" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "FOAM-TK", label: "FOAM CONCENTRATE", pos: { x: 60, y: 360 }, width: 140, height: 100, fillLevel: 98 },
  ],
  pumps: [
    { id: "FP-01", label: "FIRE PUMP 1", pos: { x: 300, y: 120 } },
    { id: "FP-02", label: "FIRE PUMP 2", pos: { x: 300, y: 240 } },
  ],
  consumers: [
    { id: "Z1", label: "ZONE 1 SPRINK", pos: { x: 720, y: 80 } },
    { id: "Z2", label: "ZONE 2 SPRINK", pos: { x: 720, y: 180 } },
    { id: "Z3", label: "ZONE 3 SPRINK", pos: { x: 720, y: 280 } },
    { id: "DECK-HOSE", label: "DECK HOSES", pos: { x: 720, y: 410 } },
  ],
  pipes: [
    { from: { x: 320, y: 120 }, to: { x: 500, y: 180 }, gatedBy: "FM-601" },
    { from: { x: 320, y: 240 }, to: { x: 500, y: 180 } },
    { from: { x: 500, y: 100 }, to: { x: 700, y: 100 }, gatedBy: "FM-602" },
    { from: { x: 500, y: 200 }, to: { x: 700, y: 200 }, gatedBy: "FM-603" },
    { from: { x: 500, y: 300 }, to: { x: 700, y: 300 }, gatedBy: "FM-604" },
    { from: { x: 500, y: 410 }, to: { x: 700, y: 410 } },
    { from: { x: 200, y: 410 }, to: { x: 500, y: 410 }, gatedBy: "FM-605" },
  ],
  valves: [
    { id: "FM-601", pos: { x: 400, y: 150 } },
    { id: "FM-602", pos: { x: 600, y: 100 } },
    { id: "FM-603", pos: { x: 600, y: 200 } },
    { id: "FM-604", pos: { x: 600, y: 300 } },
    { id: "FM-605", pos: { x: 350, y: 410 } },
  ],
  initialValves: [
    { id: "FM-601", name: "FIRE PUMP DISCH", kind: "gate", state: "open", position: 100, fault: false },
    { id: "FM-602", name: "ZONE 1 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "FM-603", name: "ZONE 2 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "FM-604", name: "ZONE 3 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "FM-605", name: "FOAM PROPORTIONER", kind: "globe", state: "closed", position: 0, fault: false },
  ],
};
