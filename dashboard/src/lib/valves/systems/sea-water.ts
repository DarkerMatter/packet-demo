// dashboard/src/lib/valves/systems/sea-water.ts
import type { SystemLayout } from "../types";

export const seaWaterSystem: SystemLayout = {
  meta: { id: "sea-water", label: "SEA WATER", accent: "text-cyan-600", pipeColor: "#06b6d4" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "SC-P", label: "SEA CHEST P", pos: { x: 60, y: 100 }, width: 100, height: 80 },
    { id: "SC-S", label: "SEA CHEST S", pos: { x: 60, y: 420 }, width: 100, height: 80 },
  ],
  pumps: [
    { id: "SW-P-01", label: "SW PUMP A", pos: { x: 300, y: 200 } },
    { id: "SW-P-02", label: "SW PUMP B", pos: { x: 300, y: 400 } },
  ],
  consumers: [
    { id: "ME-COOL", label: "ME COOLERS", pos: { x: 760, y: 220 } },
    { id: "GEN-COOL", label: "GEN COOLERS", pos: { x: 760, y: 380 } },
    { id: "OVBD", label: "OVERBOARD", pos: { x: 880, y: 540 } },
  ],
  pipes: [
    { from: { x: 160, y: 140 }, to: { x: 280, y: 200 }, gatedBy: "SW-201" },
    { from: { x: 160, y: 460 }, to: { x: 280, y: 400 }, gatedBy: "SW-202" },
    { from: { x: 340, y: 200 }, to: { x: 500, y: 200 } },
    { from: { x: 340, y: 400 }, to: { x: 500, y: 400 } },
    { from: { x: 500, y: 200 }, to: { x: 740, y: 220 }, gatedBy: "SW-203" },
    { from: { x: 500, y: 400 }, to: { x: 740, y: 380 }, gatedBy: "SW-204" },
    { from: { x: 740, y: 250 }, to: { x: 740, y: 540 }, gatedBy: "SW-205" },
    { from: { x: 740, y: 540 }, to: { x: 860, y: 540 }, gatedBy: "SW-206" },
  ],
  valves: [
    { id: "SW-201", pos: { x: 220, y: 170 } },
    { id: "SW-202", pos: { x: 220, y: 430 } },
    { id: "SW-203", pos: { x: 620, y: 210 } },
    { id: "SW-204", pos: { x: 620, y: 390 } },
    { id: "SW-205", pos: { x: 740, y: 480 } },
    { id: "SW-206", pos: { x: 800, y: 540 } },
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
