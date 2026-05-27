// dashboard/src/lib/valves/systems/fire-main.ts
import type { SystemLayout } from "../types";

export const fireMainSystem: SystemLayout = {
  meta: { id: "fire-main", label: "FIRE MAIN", accent: "text-red-500", pipeColor: "#ef4444" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "FOAM-TK", label: "FOAM CONCENTRATE", pos: { x: 40, y: 430 }, width: 150, height: 100, fillLevel: 98 },
  ],
  pumps: [
    { id: "FP-01", label: "FIRE PUMP 1", pos: { x: 240, y: 140 } },
    { id: "FP-02", label: "FIRE PUMP 2", pos: { x: 240, y: 320 } },
  ],
  consumers: [
    { id: "Z1", label: "ZONE 1 SPRINK", pos: { x: 820, y: 90 }, width: 130, height: 40 },
    { id: "Z2", label: "ZONE 2 SPRINK", pos: { x: 820, y: 200 }, width: 130, height: 40 },
    { id: "Z3", label: "ZONE 3 SPRINK", pos: { x: 820, y: 310 }, width: 130, height: 40 },
    { id: "DECK-HOSE", label: "DECK HOSES", pos: { x: 820, y: 440 }, width: 130, height: 50 },
  ],
  pipes: [
    // Pump 1 + Pump 2 → common discharge header
    { from: { x: 260, y: 140 }, to: { x: 420, y: 140 } },
    { from: { x: 420, y: 140 }, to: { x: 420, y: 230 } },
    { from: { x: 260, y: 320 }, to: { x: 420, y: 320 } },
    { from: { x: 420, y: 320 }, to: { x: 420, y: 230 } },
    // FM-601 (combined discharge) → vertical fire main
    { from: { x: 420, y: 230 }, to: { x: 540, y: 230 }, gatedBy: "FM-601" },
    { from: { x: 540, y: 110 }, to: { x: 540, y: 460 } },
    // Zone branches off fire main
    { from: { x: 540, y: 110 }, to: { x: 820, y: 110 }, gatedBy: "FM-602" },
    { from: { x: 540, y: 220 }, to: { x: 820, y: 220 }, gatedBy: "FM-603" },
    { from: { x: 540, y: 330 }, to: { x: 820, y: 330 }, gatedBy: "FM-604" },
    { from: { x: 540, y: 460 }, to: { x: 820, y: 460 } },
    // Foam concentrate → FM-605 proportioner → fire main (injects into header upstream of FM-601)
    { from: { x: 190, y: 480 }, to: { x: 380, y: 480 }, gatedBy: "FM-605" },
    { from: { x: 380, y: 480 }, to: { x: 380, y: 230 } },
    { from: { x: 380, y: 230 }, to: { x: 420, y: 230 } },
  ],
  valves: [
    { id: "FM-601", pos: { x: 480, y: 230 } },
    { id: "FM-602", pos: { x: 700, y: 110 } },
    { id: "FM-603", pos: { x: 700, y: 220 } },
    { id: "FM-604", pos: { x: 700, y: 330 } },
    { id: "FM-605", pos: { x: 290, y: 480 } },
  ],
  initialValves: [
    { id: "FM-601", name: "FIRE PUMP DISCH", kind: "gate", state: "open", position: 100, fault: false },
    { id: "FM-602", name: "ZONE 1 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "FM-603", name: "ZONE 2 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "FM-604", name: "ZONE 3 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "FM-605", name: "FOAM PROPORTIONER", kind: "globe", state: "closed", position: 0, fault: false },
  ],
};
