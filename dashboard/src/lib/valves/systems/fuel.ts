// dashboard/src/lib/valves/systems/fuel.ts
import type { SystemLayout } from "../types";

export const fuelSystem: SystemLayout = {
  meta: { id: "fuel", label: "FUEL", accent: "text-amber-600", pipeColor: "#a16207" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "F-TK-01", label: "PORT MAIN TK", pos: { x: 60, y: 80 }, width: 120, height: 140, fillLevel: 87 },
    { id: "F-TK-02", label: "STBD MAIN TK", pos: { x: 60, y: 360 }, width: 120, height: 140, fillLevel: 84 },
  ],
  pumps: [
    { id: "F-P-01", label: "XFER PUMP", pos: { x: 260, y: 290 } },
  ],
  consumers: [
    { id: "ME1", label: "ME1", pos: { x: 760, y: 60 } },
    { id: "ME2", label: "ME2", pos: { x: 760, y: 170 } },
    { id: "ME3", label: "ME3", pos: { x: 760, y: 280 } },
    { id: "ME4", label: "ME4", pos: { x: 760, y: 390 } },
    { id: "ME5", label: "ME5", pos: { x: 760, y: 500 } },
  ],
  pipes: [
    // Tank outlets to manifold
    { from: { x: 180, y: 150 }, to: { x: 360, y: 150 }, gatedBy: "FV-101" },
    { from: { x: 180, y: 430 }, to: { x: 360, y: 430 }, gatedBy: "FV-102" },
    // Cross-feed between tanks (vertical), gated by xfer valve
    { from: { x: 240, y: 150 }, to: { x: 240, y: 430 }, gatedBy: "FV-105" },
    // Manifold from tank outlets to engines
    { from: { x: 360, y: 150 }, to: { x: 360, y: 500 } },
    { from: { x: 360, y: 430 }, to: { x: 360, y: 500 } },
    // Engine branches off manifold (one per engine)
    { from: { x: 360, y: 100 }, to: { x: 740, y: 100 }, gatedBy: "FV-108" },
    { from: { x: 360, y: 210 }, to: { x: 740, y: 210 }, gatedBy: "FV-109" },
    { from: { x: 360, y: 320 }, to: { x: 740, y: 320 }, gatedBy: "FV-110" },
    { from: { x: 360, y: 430 }, to: { x: 740, y: 430 }, gatedBy: "FV-111" },
    { from: { x: 360, y: 540 }, to: { x: 740, y: 540 }, gatedBy: "FV-112" },
  ],
  valves: [
    { id: "FV-101", pos: { x: 270, y: 150 } },
    { id: "FV-102", pos: { x: 270, y: 430 } },
    { id: "FV-105", pos: { x: 240, y: 290 } },
    { id: "FV-108", pos: { x: 550, y: 100 } },
    { id: "FV-109", pos: { x: 550, y: 210 } },
    { id: "FV-110", pos: { x: 550, y: 320 } },
    { id: "FV-111", pos: { x: 550, y: 430 } },
    { id: "FV-112", pos: { x: 550, y: 540 } },
  ],
  initialValves: [
    { id: "FV-101", name: "PORT MAIN TK SUPPLY", kind: "gate", state: "open", position: 100, fault: false },
    { id: "FV-102", name: "STBD MAIN TK SUPPLY", kind: "gate", state: "open", position: 100, fault: false },
    { id: "FV-105", name: "PORT-STBD XFER", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "FV-108", name: "ME1 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    { id: "FV-109", name: "ME2 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    { id: "FV-110", name: "ME3 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    { id: "FV-111", name: "ME4 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    { id: "FV-112", name: "ME5 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
  ],
};
