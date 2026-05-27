// dashboard/src/lib/valves/systems/air.ts
import type { SystemLayout } from "../types";

export const airSystem: SystemLayout = {
  meta: { id: "air", label: "COMPRESSED AIR", accent: "text-slate-400", pipeColor: "#94a3b8" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "AIR-RCV-1", label: "AIR RECEIVER 1", pos: { x: 80, y: 100 }, width: 130, height: 120, fillLevel: 82 },
    { id: "AIR-RCV-2", label: "AIR RECEIVER 2", pos: { x: 80, y: 320 }, width: 130, height: 120, fillLevel: 79 },
  ],
  pumps: [
    { id: "COMP-01", label: "AIR COMP", pos: { x: 340, y: 240 } },
  ],
  consumers: [
    { id: "ME-START", label: "ME STARTING AIR", pos: { x: 720, y: 180 } },
    { id: "CTRL-AIR", label: "CONTROL AIR", pos: { x: 720, y: 360 } },
    { id: "SERVICE", label: "SERVICE AIR", pos: { x: 720, y: 500 } },
  ],
  pipes: [
    { from: { x: 210, y: 160 }, to: { x: 360, y: 240 }, gatedBy: "AIR-701" },
    { from: { x: 210, y: 380 }, to: { x: 360, y: 240 }, gatedBy: "AIR-702" },
    { from: { x: 380, y: 240 }, to: { x: 700, y: 200 }, gatedBy: "AIR-704" },
    { from: { x: 500, y: 240 }, to: { x: 500, y: 360 } },
    { from: { x: 500, y: 360 }, to: { x: 700, y: 360 }, gatedBy: "AIR-703" },
    { from: { x: 500, y: 500 }, to: { x: 700, y: 500 } },
    { from: { x: 500, y: 360 }, to: { x: 500, y: 500 } },
  ],
  valves: [
    { id: "AIR-701", pos: { x: 290, y: 200 } },
    { id: "AIR-702", pos: { x: 290, y: 320 } },
    { id: "AIR-703", pos: { x: 600, y: 360 } },
    { id: "AIR-704", pos: { x: 540, y: 220 } },
  ],
  initialValves: [
    { id: "AIR-701", name: "RECEIVER 1 ISOL", kind: "gate", state: "open", position: 100, fault: false },
    { id: "AIR-702", name: "RECEIVER 2 ISOL", kind: "gate", state: "open", position: 100, fault: false },
    { id: "AIR-703", name: "CONTROL AIR REG", kind: "globe", state: "throttled", position: 55, fault: false },
    { id: "AIR-704", name: "ME STARTING AIR", kind: "ball", state: "closed", position: 0, fault: false },
  ],
};
