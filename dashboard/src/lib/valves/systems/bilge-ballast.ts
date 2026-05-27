// dashboard/src/lib/valves/systems/bilge-ballast.ts
import type { SystemLayout } from "../types";

export const bilgeBallastSystem: SystemLayout = {
  meta: { id: "bilge-ballast", label: "BILGE/BALLAST", accent: "text-violet-400", pipeColor: "#a78bfa" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "BL-FWD", label: "FWD BILGE WELL", pos: { x: 60, y: 80 }, width: 120, height: 80 },
    { id: "BL-ENG", label: "ENG RM BILGE", pos: { x: 60, y: 220 }, width: 120, height: 80 },
    { id: "BAL-P", label: "PORT BAL TK", pos: { x: 60, y: 420 }, width: 120, height: 100, fillLevel: 45 },
  ],
  pumps: [
    { id: "BL-P-01", label: "BILGE PUMP", pos: { x: 350, y: 200 } },
    { id: "BAL-P-01", label: "BALLAST PUMP", pos: { x: 350, y: 470 } },
  ],
  consumers: [
    { id: "OBL-OVBD", label: "OIL/WATER SEP", pos: { x: 700, y: 180 } },
    { id: "OVBD", label: "OVERBOARD", pos: { x: 880, y: 520 } },
  ],
  pipes: [
    { from: { x: 180, y: 120 }, to: { x: 330, y: 200 }, gatedBy: "BL-501" },
    { from: { x: 180, y: 260 }, to: { x: 330, y: 200 }, gatedBy: "BL-502" },
    { from: { x: 370, y: 200 }, to: { x: 700, y: 200 }, gatedBy: "BL-503" },
    { from: { x: 180, y: 470 }, to: { x: 330, y: 470 }, gatedBy: "BL-504" },
    { from: { x: 370, y: 470 }, to: { x: 740, y: 470 } },
    { from: { x: 740, y: 470 }, to: { x: 860, y: 520 }, gatedBy: "BL-505" },
  ],
  valves: [
    { id: "BL-501", pos: { x: 260, y: 140 } },
    { id: "BL-502", pos: { x: 260, y: 240 } },
    { id: "BL-503", pos: { x: 520, y: 200 } },
    { id: "BL-504", pos: { x: 260, y: 470 } },
    { id: "BL-505", pos: { x: 800, y: 500 } },
  ],
  initialValves: [
    { id: "BL-501", name: "FWD BILGE SUCT", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "BL-502", name: "ENG RM BILGE SUCT", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "BL-503", name: "OIL/WTR SEP IN", kind: "gate", state: "open", position: 100, fault: false },
    { id: "BL-504", name: "BALLAST FILL", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "BL-505", name: "OVERBOARD DISCH", kind: "ball", state: "closed", position: 0, fault: false },
  ],
};
