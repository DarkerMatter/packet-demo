// dashboard/src/lib/valves/systems/hydraulics.ts
import type { SystemLayout } from "../types";

export const hydraulicsSystem: SystemLayout = {
  meta: { id: "hydraulics", label: "HYDRAULICS", accent: "text-slate-400", pipeColor: "#64748b" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "HYD-RES", label: "HYD RESERVOIR", pos: { x: 80, y: 220 }, width: 140, height: 160, fillLevel: 88 },
  ],
  pumps: [
    { id: "HYD-P-01", label: "HYD PUMP", pos: { x: 340, y: 300 } },
  ],
  consumers: [
    { id: "STEER", label: "STEERING GEAR", pos: { x: 700, y: 140 } },
    { id: "WINDLASS", label: "ANCHOR WINDLASS", pos: { x: 700, y: 320 } },
    { id: "CRANE", label: "DECK CRANE", pos: { x: 700, y: 460 } },
  ],
  pipes: [
    { from: { x: 220, y: 300 }, to: { x: 320, y: 300 } },
    { from: { x: 360, y: 300 }, to: { x: 500, y: 300 } },
    { from: { x: 500, y: 300 }, to: { x: 500, y: 460 } },
    { from: { x: 500, y: 460 }, to: { x: 680, y: 460 } },
    { from: { x: 500, y: 160 }, to: { x: 680, y: 160 }, gatedBy: "HYD-801" },
    { from: { x: 500, y: 160 }, to: { x: 500, y: 300 } },
    { from: { x: 580, y: 300 }, to: { x: 680, y: 320 }, gatedBy: "HYD-802" },
    { from: { x: 580, y: 460 }, to: { x: 580, y: 360 }, gatedBy: "HYD-803" },
    { from: { x: 340, y: 460 }, to: { x: 220, y: 380 }, gatedBy: "HYD-804" },
    { from: { x: 580, y: 460 }, to: { x: 340, y: 460 } },
  ],
  valves: [
    { id: "HYD-801", pos: { x: 580, y: 160 } },
    { id: "HYD-802", pos: { x: 620, y: 310 } },
    { id: "HYD-803", pos: { x: 580, y: 410 } },
    { id: "HYD-804", pos: { x: 280, y: 420 } },
  ],
  initialValves: [
    { id: "HYD-801", name: "STEERING SUPPLY", kind: "gate", state: "open", position: 100, fault: false },
    { id: "HYD-802", name: "WINDLASS SUPPLY", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "HYD-803", name: "WINDLASS RTN", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "HYD-804", name: "RESERVOIR RTN", kind: "check", state: "open", position: 100, fault: false },
  ],
};
