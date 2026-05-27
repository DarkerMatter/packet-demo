// dashboard/src/lib/valves/systems/sewage.ts
import type { SystemLayout } from "../types";

export const sewageSystem: SystemLayout = {
  meta: { id: "sewage", label: "SEWAGE", accent: "text-amber-700", pipeColor: "#854d0e" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "GRAY-TK", label: "GRAY HOLDING", pos: { x: 80, y: 100 }, width: 140, height: 140, fillLevel: 34 },
    { id: "BLACK-TK", label: "BLACK HOLDING", pos: { x: 80, y: 320 }, width: 140, height: 140, fillLevel: 22 },
  ],
  pumps: [
    { id: "MAC-01", label: "MACERATOR", pos: { x: 460, y: 390 } },
  ],
  consumers: [
    { id: "TREAT", label: "TREATMENT PLANT", pos: { x: 700, y: 170 } },
    { id: "OVBD", label: "OVERBOARD", pos: { x: 880, y: 460 } },
  ],
  pipes: [
    { from: { x: 220, y: 170 }, to: { x: 700, y: 170 }, gatedBy: "SEW-901" },
    { from: { x: 220, y: 390 }, to: { x: 440, y: 390 }, gatedBy: "SEW-902" },
    { from: { x: 480, y: 390 }, to: { x: 860, y: 460 }, gatedBy: "SEW-903" },
    { from: { x: 700, y: 220 }, to: { x: 500, y: 390 }, gatedBy: "SEW-904" },
  ],
  valves: [
    { id: "SEW-901", pos: { x: 450, y: 170 } },
    { id: "SEW-902", pos: { x: 340, y: 390 } },
    { id: "SEW-903", pos: { x: 700, y: 420 } },
    { id: "SEW-904", pos: { x: 580, y: 290 } },
  ],
  initialValves: [
    { id: "SEW-901", name: "GRAY TO TREATMENT", kind: "gate", state: "open", position: 100, fault: false },
    { id: "SEW-902", name: "BLACK HOLDING OUT", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "SEW-903", name: "MACERATOR DISCH", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "SEW-904", name: "TREATED EFFLUENT", kind: "check", state: "open", position: 100, fault: false },
  ],
};
