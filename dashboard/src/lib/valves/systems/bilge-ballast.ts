// dashboard/src/lib/valves/systems/bilge-ballast.ts
import type { SystemLayout } from "../types";

export const bilgeBallastSystem: SystemLayout = {
  meta: { id: "bilge-ballast", label: "BILGE/BALLAST", accent: "text-violet-400", pipeColor: "#a78bfa" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "BL-FWD", label: "FWD BILGE WELL", pos: { x: 40, y: 70 }, width: 130, height: 70 },
    { id: "BL-ENG", label: "ENG RM BILGE", pos: { x: 40, y: 200 }, width: 130, height: 70 },
    { id: "BAL-P", label: "PORT BAL TK", pos: { x: 40, y: 410 }, width: 130, height: 110, fillLevel: 45 },
  ],
  pumps: [
    { id: "BL-P-01", label: "BILGE PUMP", pos: { x: 380, y: 170 } },
    { id: "BAL-P-01", label: "BALLAST PUMP", pos: { x: 380, y: 470 } },
  ],
  consumers: [
    { id: "OBL-OVBD", label: "OIL/WATER SEP", pos: { x: 820, y: 145 }, width: 130, height: 50 },
    { id: "OVBD", label: "OVERBOARD", pos: { x: 820, y: 460 }, width: 130, height: 50 },
  ],
  pipes: [
    // FWD bilge well → BL-501 → bilge pump suction
    { from: { x: 170, y: 105 }, to: { x: 360, y: 105 }, gatedBy: "BL-501" },
    { from: { x: 360, y: 105 }, to: { x: 360, y: 170 } },
    // ENG RM bilge → BL-502 → bilge pump suction (same)
    { from: { x: 170, y: 235 }, to: { x: 360, y: 235 }, gatedBy: "BL-502" },
    { from: { x: 360, y: 235 }, to: { x: 360, y: 170 } },
    // Bilge pump discharge → BL-503 → oil/water sep
    { from: { x: 400, y: 170 }, to: { x: 820, y: 170 }, gatedBy: "BL-503" },
    // PORT BAL → BL-504 → ballast pump suction
    { from: { x: 170, y: 465 }, to: { x: 360, y: 465 }, gatedBy: "BL-504" },
    { from: { x: 360, y: 465 }, to: { x: 360, y: 470 } },
    // Ballast pump discharge → BL-505 → overboard
    { from: { x: 400, y: 470 }, to: { x: 660, y: 470 } },
    { from: { x: 660, y: 470 }, to: { x: 820, y: 485 }, gatedBy: "BL-505" },
  ],
  valves: [
    { id: "BL-501", pos: { x: 270, y: 105 } },
    { id: "BL-502", pos: { x: 270, y: 235 } },
    { id: "BL-503", pos: { x: 640, y: 170 } },
    { id: "BL-504", pos: { x: 270, y: 465 } },
    { id: "BL-505", pos: { x: 740, y: 478 } },
  ],
  initialValves: [
    { id: "BL-501", name: "FWD BILGE SUCT", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "BL-502", name: "ENG RM BILGE SUCT", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "BL-503", name: "OIL/WTR SEP IN", kind: "gate", state: "open", position: 100, fault: false },
    { id: "BL-504", name: "BALLAST FILL", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "BL-505", name: "OVERBOARD DISCH", kind: "ball", state: "closed", position: 0, fault: false },
  ],
};
