// dashboard/src/lib/valves/systems/sewage.ts
import type { SystemLayout } from "../types";

export const sewageSystem: SystemLayout = {
  meta: { id: "sewage", label: "SEWAGE", accent: "text-amber-700", pipeColor: "#854d0e" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "GRAY-TK", label: "GRAY HOLDING", pos: { x: 40, y: 90 }, width: 150, height: 130, fillLevel: 34 },
    { id: "BLACK-TK", label: "BLACK HOLDING", pos: { x: 40, y: 340 }, width: 150, height: 130, fillLevel: 22 },
  ],
  pumps: [
    { id: "MAC-01", label: "MACERATOR", pos: { x: 460, y: 405 } },
  ],
  consumers: [
    { id: "TREAT", label: "TREATMENT PLANT", pos: { x: 820, y: 130 }, width: 130, height: 50 },
    { id: "OVBD", label: "OVERBOARD", pos: { x: 820, y: 460 }, width: 130, height: 50 },
  ],
  pipes: [
    // Gray holding → SEW-901 → treatment plant
    { from: { x: 190, y: 155 }, to: { x: 820, y: 155 }, gatedBy: "SEW-901" },
    // Black holding → SEW-902 → macerator suction
    { from: { x: 190, y: 405 }, to: { x: 440, y: 405 }, gatedBy: "SEW-902" },
    // Macerator → SEW-903 → overboard
    { from: { x: 480, y: 405 }, to: { x: 700, y: 405 } },
    { from: { x: 700, y: 405 }, to: { x: 820, y: 485 }, gatedBy: "SEW-903" },
    // Treatment effluent → SEW-904 (check) → return path (back to system)
    { from: { x: 820, y: 200 }, to: { x: 620, y: 200 } },
    { from: { x: 620, y: 200 }, to: { x: 620, y: 405 }, gatedBy: "SEW-904" },
  ],
  valves: [
    { id: "SEW-901", pos: { x: 440, y: 155 } },
    { id: "SEW-902", pos: { x: 330, y: 405 } },
    { id: "SEW-903", pos: { x: 760, y: 445 } },
    { id: "SEW-904", pos: { x: 620, y: 290 } },
  ],
  initialValves: [
    { id: "SEW-901", name: "GRAY TO TREATMENT", kind: "gate", state: "open", position: 100, fault: false },
    { id: "SEW-902", name: "BLACK HOLDING OUT", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "SEW-903", name: "MACERATOR DISCH", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "SEW-904", name: "TREATED EFFLUENT", kind: "check", state: "open", position: 100, fault: false },
  ],
};
