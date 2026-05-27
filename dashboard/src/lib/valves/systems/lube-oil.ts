// dashboard/src/lib/valves/systems/lube-oil.ts
import type { SystemLayout } from "../types";

export const lubeOilSystem: SystemLayout = {
  meta: { id: "lube-oil", label: "LUBE OIL", accent: "text-amber-600", pipeColor: "#854d0e" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "LO-TK-STG", label: "LO STORAGE", pos: { x: 40, y: 60 }, width: 110, height: 100, fillLevel: 92 },
    { id: "LO-TK-SMP", label: "LO SUMP", pos: { x: 40, y: 360 }, width: 110, height: 130, fillLevel: 78 },
  ],
  pumps: [
    { id: "LO-P-02", label: "PRELUBE PUMP", pos: { x: 320, y: 110 } },
    { id: "LO-P-01", label: "MAIN LO PUMP", pos: { x: 320, y: 425 } },
  ],
  consumers: [
    { id: "ME1", label: "ME1", pos: { x: 820, y: 80 }, width: 130, height: 90 },
    { id: "ME2-5", label: "ME2-5", pos: { x: 820, y: 280 }, width: 130, height: 50 },
    { id: "LO-COOLER", label: "LO COOLER", pos: { x: 520, y: 470 }, width: 160, height: 70 },
  ],
  pipes: [
    // STORAGE → LO-302 → PRELUBE pump → ME1 (top)
    { from: { x: 150, y: 110 }, to: { x: 300, y: 110 }, gatedBy: "LO-302" },
    { from: { x: 340, y: 110 }, to: { x: 820, y: 110 } },
    // SUMP → LO-301 → MAIN pump → trunk junction
    { from: { x: 150, y: 425 }, to: { x: 300, y: 425 }, gatedBy: "LO-301" },
    { from: { x: 340, y: 425 }, to: { x: 460, y: 425 } },
    // Trunk → up to ME1 LO supply
    { from: { x: 460, y: 425 }, to: { x: 460, y: 150 } },
    { from: { x: 460, y: 150 }, to: { x: 820, y: 150 }, gatedBy: "LO-303" },
    // Trunk → up to bypass split
    { from: { x: 460, y: 425 }, to: { x: 460, y: 305 } },
    { from: { x: 460, y: 305 }, to: { x: 820, y: 305 }, gatedBy: "LO-305" },
    // Trunk → down to cooler
    { from: { x: 460, y: 425 }, to: { x: 460, y: 505 } },
    { from: { x: 460, y: 505 }, to: { x: 520, y: 505 } },
    // Cooler exit → up → ME2-5 (with LO-304)
    { from: { x: 680, y: 505 }, to: { x: 760, y: 505 } },
    { from: { x: 760, y: 505 }, to: { x: 760, y: 320 } },
    { from: { x: 760, y: 320 }, to: { x: 820, y: 320 }, gatedBy: "LO-304" },
  ],
  valves: [
    { id: "LO-302", pos: { x: 260, y: 110 } },
    { id: "LO-301", pos: { x: 260, y: 425 } },
    { id: "LO-303", pos: { x: 640, y: 150 } },
    { id: "LO-305", pos: { x: 640, y: 305 } },
    { id: "LO-304", pos: { x: 790, y: 320 } },
  ],
  initialValves: [
    { id: "LO-301", name: "ME SUMP SUCT", kind: "gate", state: "open", position: 100, fault: false },
    { id: "LO-302", name: "ME1 PRELUBE", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "LO-303", name: "ME1 LO SUPPLY", kind: "globe", state: "throttled", position: 65, fault: false },
    { id: "LO-304", name: "LO COOLER OUT", kind: "gate", state: "open", position: 100, fault: false },
    { id: "LO-305", name: "LO COOLER BYPASS", kind: "globe", state: "throttled", position: 30, fault: false },
  ],
};
