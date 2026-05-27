// dashboard/src/lib/valves/systems/hydraulics.ts
import type { SystemLayout } from "../types";

export const hydraulicsSystem: SystemLayout = {
  meta: { id: "hydraulics", label: "HYDRAULICS", accent: "text-slate-400", pipeColor: "#64748b" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "HYD-RES", label: "HYD RESERVOIR", pos: { x: 40, y: 220 }, width: 150, height: 160, fillLevel: 88 },
  ],
  pumps: [
    { id: "HYD-P-01", label: "HYD PUMP", pos: { x: 340, y: 300 } },
  ],
  consumers: [
    { id: "STEER", label: "STEERING GEAR", pos: { x: 820, y: 95 }, width: 130, height: 50 },
    { id: "WINDLASS", label: "ANCHOR WINDLASS", pos: { x: 820, y: 250 }, width: 130, height: 50 },
    { id: "CRANE", label: "DECK CRANE", pos: { x: 820, y: 440 }, width: 130, height: 50 },
  ],
  pipes: [
    // Reservoir → pump suction
    { from: { x: 190, y: 300 }, to: { x: 320, y: 300 } },
    // Pump → trunk
    { from: { x: 360, y: 300 }, to: { x: 460, y: 300 } },
    // Vertical trunk
    { from: { x: 460, y: 120 }, to: { x: 460, y: 465 } },
    // Steering supply (HYD-801)
    { from: { x: 460, y: 120 }, to: { x: 820, y: 120 }, gatedBy: "HYD-801" },
    // Windlass supply (HYD-802)
    { from: { x: 460, y: 275 }, to: { x: 820, y: 275 }, gatedBy: "HYD-802" },
    // Crane supply
    { from: { x: 460, y: 465 }, to: { x: 820, y: 465 } },
    // Windlass return (HYD-803) — return line below trunk
    { from: { x: 820, y: 320 }, to: { x: 600, y: 320 }, gatedBy: "HYD-803" },
    { from: { x: 600, y: 320 }, to: { x: 600, y: 460 } },
    // Common return path → reservoir return (HYD-804 check valve)
    { from: { x: 600, y: 460 }, to: { x: 280, y: 460 } },
    { from: { x: 280, y: 460 }, to: { x: 220, y: 380 }, gatedBy: "HYD-804" },
  ],
  valves: [
    { id: "HYD-801", pos: { x: 640, y: 120 } },
    { id: "HYD-802", pos: { x: 640, y: 275 } },
    { id: "HYD-803", pos: { x: 700, y: 320 } },
    { id: "HYD-804", pos: { x: 250, y: 420 } },
  ],
  initialValves: [
    { id: "HYD-801", name: "STEERING SUPPLY", kind: "gate", state: "open", position: 100, fault: false },
    { id: "HYD-802", name: "WINDLASS SUPPLY", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "HYD-803", name: "WINDLASS RTN", kind: "ball", state: "closed", position: 0, fault: false },
    { id: "HYD-804", name: "RESERVOIR RTN", kind: "check", state: "open", position: 100, fault: false },
  ],
};
