// dashboard/src/lib/valves/index.ts
import { fuelSystem } from "./systems/fuel";
import { lubeOilSystem } from "./systems/lube-oil";
import { seaWaterSystem } from "./systems/sea-water";
import { freshWaterSystem } from "./systems/fresh-water";
import { bilgeBallastSystem } from "./systems/bilge-ballast";
import { fireMainSystem } from "./systems/fire-main";
import { airSystem } from "./systems/air";
import { hydraulicsSystem } from "./systems/hydraulics";
import { sewageSystem } from "./systems/sewage";
import type { SystemLayout, SystemId, Valve } from "./types";

export const systems: Record<SystemId, SystemLayout> = {
  "fuel": fuelSystem,
  "lube-oil": lubeOilSystem,
  "sea-water": seaWaterSystem,
  "fresh-water": freshWaterSystem,
  "bilge-ballast": bilgeBallastSystem,
  "fire-main": fireMainSystem,
  "air": airSystem,
  "hydraulics": hydraulicsSystem,
  "sewage": sewageSystem,
};

export const systemOrder: SystemId[] = [
  "fuel", "lube-oil", "sea-water", "fresh-water",
  "bilge-ballast", "fire-main", "air", "hydraulics", "sewage",
];

export function initialValveMap(): Record<string, Valve> {
  const out: Record<string, Valve> = {};
  for (const sid of systemOrder) {
    const sys = systems[sid];
    for (const iv of sys.initialValves) {
      out[iv.id] = { ...iv, system: sid };
    }
  }
  return out;
}

export type { SystemLayout, SystemId, Valve } from "./types";
