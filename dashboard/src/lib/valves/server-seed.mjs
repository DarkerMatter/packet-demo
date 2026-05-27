// dashboard/src/lib/valves/server-seed.mjs
export function initialValves() {
  return {
    // Fuel
    "FV-101": { id: "FV-101", system: "fuel", name: "PORT MAIN TK SUPPLY", kind: "gate", state: "open", position: 100, fault: false },
    "FV-102": { id: "FV-102", system: "fuel", name: "STBD MAIN TK SUPPLY", kind: "gate", state: "open", position: 100, fault: false },
    "FV-105": { id: "FV-105", system: "fuel", name: "PORT-STBD XFER", kind: "ball", state: "closed", position: 0, fault: false },
    "FV-108": { id: "FV-108", system: "fuel", name: "ME1 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    "FV-109": { id: "FV-109", system: "fuel", name: "ME2 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    "FV-110": { id: "FV-110", system: "fuel", name: "ME3 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    "FV-111": { id: "FV-111", system: "fuel", name: "ME4 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    "FV-112": { id: "FV-112", system: "fuel", name: "ME5 SUPPLY ISOL", kind: "ball", state: "open", position: 100, fault: false },
    // Lube oil
    "LO-301": { id: "LO-301", system: "lube-oil", name: "ME SUMP SUCT", kind: "gate", state: "open", position: 100, fault: false },
    "LO-302": { id: "LO-302", system: "lube-oil", name: "ME1 PRELUBE", kind: "ball", state: "closed", position: 0, fault: false },
    "LO-303": { id: "LO-303", system: "lube-oil", name: "ME1 LO SUPPLY", kind: "globe", state: "throttled", position: 65, fault: false },
    "LO-304": { id: "LO-304", system: "lube-oil", name: "LO COOLER OUT", kind: "gate", state: "open", position: 100, fault: false },
    "LO-305": { id: "LO-305", system: "lube-oil", name: "LO COOLER BYPASS", kind: "globe", state: "throttled", position: 30, fault: false },
    // Sea water
    "SW-201": { id: "SW-201", system: "sea-water", name: "SEA CHEST PORT", kind: "gate", state: "open", position: 100, fault: false },
    "SW-202": { id: "SW-202", system: "sea-water", name: "SEA CHEST STBD", kind: "gate", state: "closed", position: 0, fault: false },
    "SW-203": { id: "SW-203", system: "sea-water", name: "ME RAW COOL IN", kind: "gate", state: "open", position: 100, fault: false },
    "SW-204": { id: "SW-204", system: "sea-water", name: "GEN RAW COOL IN", kind: "gate", state: "open", position: 100, fault: false },
    "SW-205": { id: "SW-205", system: "sea-water", name: "OVBD HEADER", kind: "check", state: "open", position: 100, fault: false },
    "SW-206": { id: "SW-206", system: "sea-water", name: "OVERBOARD DISCH", kind: "gate", state: "open", position: 100, fault: false },
    // Fresh water
    "FW-401": { id: "FW-401", system: "fresh-water", name: "EXPANSION TK FILL", kind: "globe", state: "throttled", position: 25, fault: false },
    "FW-402": { id: "FW-402", system: "fresh-water", name: "FW RTN BYPASS", kind: "globe", state: "throttled", position: 40, fault: false },
    "FW-403": { id: "FW-403", system: "fresh-water", name: "ME COOL JKT IN", kind: "gate", state: "open", position: 100, fault: false },
    "FW-404": { id: "FW-404", system: "fresh-water", name: "ME COOL JKT OUT", kind: "gate", state: "open", position: 100, fault: false },
    // Bilge/ballast
    "BL-501": { id: "BL-501", system: "bilge-ballast", name: "FWD BILGE SUCT", kind: "ball", state: "closed", position: 0, fault: false },
    "BL-502": { id: "BL-502", system: "bilge-ballast", name: "ENG RM BILGE SUCT", kind: "ball", state: "closed", position: 0, fault: false },
    "BL-503": { id: "BL-503", system: "bilge-ballast", name: "OIL/WTR SEP IN", kind: "gate", state: "open", position: 100, fault: false },
    "BL-504": { id: "BL-504", system: "bilge-ballast", name: "BALLAST FILL", kind: "ball", state: "closed", position: 0, fault: false },
    "BL-505": { id: "BL-505", system: "bilge-ballast", name: "OVERBOARD DISCH", kind: "ball", state: "closed", position: 0, fault: false },
    // Fire
    "FM-601": { id: "FM-601", system: "fire-main", name: "FIRE PUMP DISCH", kind: "gate", state: "open", position: 100, fault: false },
    "FM-602": { id: "FM-602", system: "fire-main", name: "ZONE 1 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    "FM-603": { id: "FM-603", system: "fire-main", name: "ZONE 2 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    "FM-604": { id: "FM-604", system: "fire-main", name: "ZONE 3 SPRINKLER", kind: "ball", state: "closed", position: 0, fault: false },
    "FM-605": { id: "FM-605", system: "fire-main", name: "FOAM PROPORTIONER", kind: "globe", state: "closed", position: 0, fault: false },
    // Air
    "AIR-701": { id: "AIR-701", system: "air", name: "RECEIVER 1 ISOL", kind: "gate", state: "open", position: 100, fault: false },
    "AIR-702": { id: "AIR-702", system: "air", name: "RECEIVER 2 ISOL", kind: "gate", state: "open", position: 100, fault: false },
    "AIR-703": { id: "AIR-703", system: "air", name: "CONTROL AIR REG", kind: "globe", state: "throttled", position: 55, fault: false },
    "AIR-704": { id: "AIR-704", system: "air", name: "ME STARTING AIR", kind: "ball", state: "closed", position: 0, fault: false },
    // Hydraulics
    "HYD-801": { id: "HYD-801", system: "hydraulics", name: "STEERING SUPPLY", kind: "gate", state: "open", position: 100, fault: false },
    "HYD-802": { id: "HYD-802", system: "hydraulics", name: "WINDLASS SUPPLY", kind: "ball", state: "closed", position: 0, fault: false },
    "HYD-803": { id: "HYD-803", system: "hydraulics", name: "WINDLASS RTN", kind: "ball", state: "closed", position: 0, fault: false },
    "HYD-804": { id: "HYD-804", system: "hydraulics", name: "RESERVOIR RTN", kind: "check", state: "open", position: 100, fault: false },
    // Sewage
    "SEW-901": { id: "SEW-901", system: "sewage", name: "GRAY TO TREATMENT", kind: "gate", state: "open", position: 100, fault: false },
    "SEW-902": { id: "SEW-902", system: "sewage", name: "BLACK HOLDING OUT", kind: "ball", state: "closed", position: 0, fault: false },
    "SEW-903": { id: "SEW-903", system: "sewage", name: "MACERATOR DISCH", kind: "ball", state: "closed", position: 0, fault: false },
    "SEW-904": { id: "SEW-904", system: "sewage", name: "TREATED EFFLUENT", kind: "check", state: "open", position: 100, fault: false },
  };
}
