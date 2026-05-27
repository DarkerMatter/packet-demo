// dashboard/src/lib/valves/systems/lube-oil.ts
import type { SystemLayout } from "../types";

export const lubeOilSystem: SystemLayout = {
  meta: { id: "lube-oil", label: "LUBE OIL", accent: "text-amber-600", pipeColor: "#854d0e" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "LO-TK-01", label: "LO SUMP", pos: { x: 60, y: 240 }, width: 120, height: 120, fillLevel: 78 },
    { id: "LO-TK-02", label: "STORAGE", pos: { x: 60, y: 60 }, width: 120, height: 100, fillLevel: 92 },
  ],
  pumps: [
    { id: "LO-P-01", label: "MAIN LO PUMP", pos: { x: 280, y: 300 } },
    { id: "LO-P-02", label: "PRELUBE PUMP", pos: { x: 280, y: 180 } },
  ],
  consumers: [
    { id: "ME1", label: "ME1", pos: { x: 760, y: 100 } },
    { id: "ME2-5", label: "ME2-5", pos: { x: 760, y: 280 } },
    { id: "LO-COOLER", label: "LO COOLER", pos: { x: 540, y: 460 } },
  ],
  pipes: [
    { from: { x: 180, y: 300 }, to: { x: 260, y: 300 }, gatedBy: "LO-301" },
    { from: { x: 180, y: 110 }, to: { x: 260, y: 180 } },
    { from: { x: 320, y: 300 }, to: { x: 740, y: 300 } },
    { from: { x: 320, y: 180 }, to: { x: 740, y: 180 }, gatedBy: "LO-302" },
    { from: { x: 420, y: 300 }, to: { x: 540, y: 460 }, gatedBy: "LO-305" },
    { from: { x: 600, y: 460 }, to: { x: 600, y: 300 }, gatedBy: "LO-304" },
    { from: { x: 600, y: 180 }, to: { x: 740, y: 180 }, gatedBy: "LO-303" },
  ],
  valves: [
    { id: "LO-301", pos: { x: 220, y: 300 } },
    { id: "LO-302", pos: { x: 550, y: 180 } },
    { id: "LO-303", pos: { x: 680, y: 180 } },
    { id: "LO-304", pos: { x: 600, y: 380 } },
    { id: "LO-305", pos: { x: 480, y: 380 } },
  ],
  initialValves: [
    { id: "LO-301", name: "ME SUMP SUCT", kind: "gate", state: "open", position: 100, fault: false },
    { id: "LO-302", name: "ME1 PRELUBE", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "LO-303", name: "ME1 LO SUPPLY", kind: "globe", state: "throttled", position: 65, fault: false },
    { id: "LO-304", name: "LO COOLER OUT", kind: "gate", state: "open", position: 100, fault: false },
    { id: "LO-305", name: "LO COOLER BYPASS", kind: "globe", state: "throttled", position: 30, fault: false },
  ],
};
