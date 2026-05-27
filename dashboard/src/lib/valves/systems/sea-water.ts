// dashboard/src/lib/valves/systems/sea-water.ts
import type { SystemLayout } from "../types";

export const seaWaterSystem: SystemLayout = {
  meta: { id: "sea-water", label: "SEA WATER", accent: "text-cyan-600", pipeColor: "#06b6d4" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "SC-P", label: "SEA CHEST P", pos: { x: 40, y: 90 }, width: 110, height: 80 },
    { id: "SC-S", label: "SEA CHEST S", pos: { x: 40, y: 410 }, width: 110, height: 80 },
  ],
  pumps: [
    { id: "SW-P-01", label: "SW PUMP A", pos: { x: 320, y: 200 } },
    { id: "SW-P-02", label: "SW PUMP B", pos: { x: 320, y: 400 } },
  ],
  consumers: [
    { id: "ME-COOL", label: "ME COOLERS", pos: { x: 820, y: 195 }, width: 130, height: 50 },
    { id: "GEN-COOL", label: "GEN COOLERS", pos: { x: 820, y: 375 }, width: 130, height: 50 },
    { id: "OVBD", label: "OVERBOARD", pos: { x: 820, y: 510 }, width: 130, height: 50 },
  ],
  pipes: [
    // Sea chest PORT → SW-201 → Pump A
    { from: { x: 150, y: 130 }, to: { x: 230, y: 130 }, gatedBy: "SW-201" },
    { from: { x: 230, y: 130 }, to: { x: 230, y: 200 } },
    { from: { x: 230, y: 200 }, to: { x: 300, y: 200 } },
    // Sea chest STBD → SW-202 → Pump B
    { from: { x: 150, y: 450 }, to: { x: 230, y: 450 }, gatedBy: "SW-202" },
    { from: { x: 230, y: 450 }, to: { x: 230, y: 400 } },
    { from: { x: 230, y: 400 }, to: { x: 300, y: 400 } },
    // Pump A → SW-203 → ME coolers
    { from: { x: 340, y: 200 }, to: { x: 480, y: 220 } },
    { from: { x: 480, y: 220 }, to: { x: 820, y: 220 }, gatedBy: "SW-203" },
    // Pump B → SW-204 → GEN coolers
    { from: { x: 340, y: 400 }, to: { x: 480, y: 400 } },
    { from: { x: 480, y: 400 }, to: { x: 820, y: 400 }, gatedBy: "SW-204" },
    // Joined cooler discharge → overboard header → SW-205 (check) → SW-206 → overboard
    { from: { x: 600, y: 220 }, to: { x: 600, y: 540 } },
    { from: { x: 600, y: 400 }, to: { x: 600, y: 540 } },
    { from: { x: 600, y: 540 }, to: { x: 820, y: 540 }, gatedBy: "SW-206" },
  ],
  valves: [
    { id: "SW-201", pos: { x: 200, y: 130 } },
    { id: "SW-202", pos: { x: 200, y: 450 } },
    { id: "SW-203", pos: { x: 660, y: 220 } },
    { id: "SW-204", pos: { x: 660, y: 400 } },
    { id: "SW-205", pos: { x: 600, y: 480 } },
    { id: "SW-206", pos: { x: 760, y: 540 } },
  ],
  initialValves: [
    { id: "SW-201", name: "SEA CHEST PORT", kind: "gate", state: "open", position: 100, fault: false },
    { id: "SW-202", name: "SEA CHEST STBD", kind: "gate", state: "closed", position: 0, fault: false },
    { id: "SW-203", name: "ME RAW COOL IN", kind: "gate", state: "open", position: 100, fault: false },
    { id: "SW-204", name: "GEN RAW COOL IN", kind: "gate", state: "open", position: 100, fault: false },
    { id: "SW-205", name: "OVBD HEADER", kind: "check", state: "open", position: 100, fault: false },
    { id: "SW-206", name: "OVERBOARD DISCH", kind: "gate", state: "open", position: 100, fault: false },
  ],
};
