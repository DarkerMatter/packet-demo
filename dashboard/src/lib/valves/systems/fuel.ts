// dashboard/src/lib/valves/systems/fuel.ts
import type { SystemLayout } from "../types";

export const fuelSystem: SystemLayout = {
  meta: { id: "fuel", label: "FUEL", accent: "text-amber-600", pipeColor: "#a16207" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "F-TK-01", label: "PORT MAIN TK", pos: { x: 40, y: 90 }, width: 110, height: 110, fillLevel: 87 },
    { id: "F-TK-02", label: "STBD MAIN TK", pos: { x: 40, y: 400 }, width: 110, height: 110, fillLevel: 84 },
  ],
  pumps: [
    { id: "F-P-01", label: "XFER PUMP", pos: { x: 240, y: 300 } },
  ],
  consumers: [
    { id: "ME1", label: "ME1", pos: { x: 820, y: 105 }, width: 130, height: 40 },
    { id: "ME2", label: "ME2", pos: { x: 820, y: 195 }, width: 130, height: 40 },
    { id: "ME3", label: "ME3", pos: { x: 820, y: 285 }, width: 130, height: 40 },
    { id: "ME4", label: "ME4", pos: { x: 820, y: 375 }, width: 130, height: 40 },
    { id: "ME5", label: "ME5", pos: { x: 820, y: 465 }, width: 130, height: 40 },
  ],
  pipes: [
    // Tank outlets → manifold inlet
    { from: { x: 150, y: 145 }, to: { x: 420, y: 145 }, gatedBy: "FV-101" },
    { from: { x: 150, y: 455 }, to: { x: 420, y: 455 }, gatedBy: "FV-102" },
    // Cross-feed loop through XFER pump (gated by FV-105)
    { from: { x: 200, y: 145 }, to: { x: 200, y: 300 } },
    { from: { x: 200, y: 300 }, to: { x: 220, y: 300 }, gatedBy: "FV-105" },
    { from: { x: 260, y: 300 }, to: { x: 280, y: 300 } },
    { from: { x: 280, y: 300 }, to: { x: 280, y: 455 } },
    // Vertical manifold (spans all engine branches)
    { from: { x: 420, y: 125 }, to: { x: 420, y: 485 } },
    // Engine branch lines (manifold → engine box)
    { from: { x: 420, y: 125 }, to: { x: 820, y: 125 }, gatedBy: "FV-108" },
    { from: { x: 420, y: 215 }, to: { x: 820, y: 215 }, gatedBy: "FV-109" },
    { from: { x: 420, y: 305 }, to: { x: 820, y: 305 }, gatedBy: "FV-110" },
    { from: { x: 420, y: 395 }, to: { x: 820, y: 395 }, gatedBy: "FV-111" },
    { from: { x: 420, y: 485 }, to: { x: 820, y: 485 }, gatedBy: "FV-112" },
  ],
  valves: [
    { id: "FV-101", pos: { x: 280, y: 145 } },
    { id: "FV-102", pos: { x: 280, y: 455 } },
    { id: "FV-105", pos: { x: 240, y: 300 } },
    { id: "FV-108", pos: { x: 620, y: 125 } },
    { id: "FV-109", pos: { x: 620, y: 215 } },
    { id: "FV-110", pos: { x: 620, y: 305 } },
    { id: "FV-111", pos: { x: 620, y: 395 } },
    { id: "FV-112", pos: { x: 620, y: 485 } },
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
