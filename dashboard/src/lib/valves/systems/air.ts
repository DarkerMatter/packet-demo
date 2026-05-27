// dashboard/src/lib/valves/systems/air.ts
import type { SystemLayout } from "../types";

export const airSystem: SystemLayout = {
  meta: { id: "air", label: "COMPRESSED AIR", accent: "text-slate-400", pipeColor: "#94a3b8" },
  viewBox: { w: 1000, h: 600 },
  tanks: [
    { id: "AIR-RCV-1", label: "AIR RECEIVER 1", pos: { x: 40, y: 90 }, width: 140, height: 110, fillLevel: 82 },
    { id: "AIR-RCV-2", label: "AIR RECEIVER 2", pos: { x: 40, y: 320 }, width: 140, height: 110, fillLevel: 79 },
  ],
  pumps: [
    { id: "COMP-01", label: "AIR COMP", pos: { x: 380, y: 480 } },
  ],
  consumers: [
    { id: "ME-START", label: "ME STARTING AIR", pos: { x: 820, y: 140 }, width: 130, height: 50 },
    { id: "CTRL-AIR", label: "CONTROL AIR", pos: { x: 820, y: 290 }, width: 130, height: 50 },
    { id: "SERVICE", label: "SERVICE AIR", pos: { x: 820, y: 440 }, width: 130, height: 50 },
  ],
  pipes: [
    // Receiver 1 → AIR-701 → header junction
    { from: { x: 180, y: 145 }, to: { x: 360, y: 145 }, gatedBy: "AIR-701" },
    { from: { x: 360, y: 145 }, to: { x: 460, y: 145 } },
    // Receiver 2 → AIR-702 → header junction
    { from: { x: 180, y: 375 }, to: { x: 360, y: 375 }, gatedBy: "AIR-702" },
    { from: { x: 360, y: 375 }, to: { x: 460, y: 375 } },
    // Vertical header at x=460
    { from: { x: 460, y: 145 }, to: { x: 460, y: 465 } },
    // Branches off header
    { from: { x: 460, y: 165 }, to: { x: 820, y: 165 }, gatedBy: "AIR-704" },
    { from: { x: 460, y: 315 }, to: { x: 820, y: 315 }, gatedBy: "AIR-703" },
    { from: { x: 460, y: 465 }, to: { x: 820, y: 465 } },
    // Air compressor refills the header
    { from: { x: 400, y: 480 }, to: { x: 460, y: 480 } },
    { from: { x: 460, y: 480 }, to: { x: 460, y: 465 } },
  ],
  valves: [
    { id: "AIR-701", pos: { x: 270, y: 145 } },
    { id: "AIR-702", pos: { x: 270, y: 375 } },
    { id: "AIR-703", pos: { x: 640, y: 315 } },
    { id: "AIR-704", pos: { x: 640, y: 165 } },
  ],
  initialValves: [
    { id: "AIR-701", name: "RECEIVER 1 ISOL", kind: "gate", state: "open", position: 100, fault: false },
    { id: "AIR-702", name: "RECEIVER 2 ISOL", kind: "gate", state: "open", position: 100, fault: false },
    { id: "AIR-703", name: "CONTROL AIR REG", kind: "globe", state: "throttled", position: 55, fault: false },
    { id: "AIR-704", name: "ME STARTING AIR", kind: "ball", state: "closed", position: 0, fault: false },
  ],
};
