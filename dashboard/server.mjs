import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { randomBytes } from "crypto";
import next from "next";
import { initialValves } from "./src/lib/valves/server-seed.mjs";

const dev = process.env.NODE_ENV !== "production";
const port = 3000;
const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

const usvPort = process.argv[2];
const gndPort = process.argv[3];

// Demo state
const state = {
  usvConnected: false,
  gndConnected: false,
  handshakeState: "idle",
  handshakeMode: "unknown",
  pingCount: 0,
  pongCount: 0,
  usvIp: "",
  gndIp: "",
  lastActivity: "",
};
const keyExchange = [];
const logs = [];
const clients = new Set();
let sessionEstablished = false;
let handshakeRunning = false;
// Ship state
const ship = {
  nav: { lat: 37.7749, lon: -122.4194, sog: 12.4, cog: 45, heading: 43, depth: 28.5 },
  thrusters: [
    { id: "T1-PS-FWD", angle: 0, thrust: 85, reversed: false },
    { id: "T2-SB-FWD", angle: 0, thrust: 87, reversed: false },
    { id: "T3-PS-AFT", angle: -5, thrust: 82, reversed: false },
    { id: "T4-SB-AFT", angle: 5, thrust: 80, reversed: false },
    { id: "T5-CTR", angle: 0, thrust: 90, reversed: false },
  ],
  engines: [
    { id: "ME1", rpm: 1850, temp: 185, oilPsi: 62, fuelFlow: 42 },
    { id: "ME2", rpm: 1840, temp: 183, oilPsi: 64, fuelFlow: 41 },
    { id: "ME3", rpm: 1855, temp: 187, oilPsi: 61, fuelFlow: 43 },
    { id: "ME4", rpm: 1830, temp: 182, oilPsi: 63, fuelFlow: 40 },
    { id: "ME5", rpm: 1845, temp: 186, oilPsi: 62, fuelFlow: 42 },
  ],
  transmissions: [
    { id: "TX1", gear: "FWD", ratio: 2.5, temp: 165 },
    { id: "TX2", gear: "FWD", ratio: 2.5, temp: 163 },
    { id: "TX3", gear: "FWD", ratio: 2.5, temp: 167 },
    { id: "TX4", gear: "FWD", ratio: 2.5, temp: 164 },
    { id: "TX5", gear: "FWD", ratio: 2.5, temp: 166 },
  ],
  generators: [
    { id: "GEN1", kw: 420, voltage: 480, hz: 60.0, fuelLevel: 87 },
    { id: "GEN2", kw: 385, voltage: 479, hz: 60.0, fuelLevel: 87 },
    { id: "GEN3", kw: 0, voltage: 0, hz: 0, fuelLevel: 87 },
  ],
  hvac: [
    { id: "HVAC-FWD", zoneTemp: 72, setpoint: 72, mode: "AUTO" },
    { id: "HVAC-AFT", zoneTemp: 74, setpoint: 72, mode: "COOL" },
  ],
  waste: { grayLevel: 34, blackLevel: 22, grayPump: "OFF", blackPump: "OFF" },
  bowThruster: { angle: 0, thrust: 0 },
  fire: { zones: [0,0,0,0,0,0], alarm: false, agentLevel: 98 },
  radarContacts: [
    { id: "R1", bearing: 45, range: 2.4, speed: 8, cpa: 0.8 },
    { id: "R2", bearing: 178, range: 5.1, speed: 14, cpa: 3.2 },
    { id: "R3", bearing: 290, range: 1.8, speed: 6, cpa: 1.1 },
  ],
};

let valves = initialValves();
let scenarioRunning = null;
const scenarios = {};

function ts() { return new Date().toISOString().slice(11, 23); }

function addLog(source, text, isKeyExchange = false) {
  const entry = { ts: ts(), source, text };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
  state.lastActivity = entry.ts;
  broadcast({ type: "log", ...entry });
  broadcast({ type: "state", state });
  if (isKeyExchange) {
    keyExchange.push(entry);
    broadcast({ type: "keyexchange", steps: keyExchange });
  }
  console.log(`${entry.ts} ${text}`);
}

function broadcast(data) {
  const json = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(json);
  }
}

function hexDump(buf, len = 32) {
  return Array.from(buf.slice(0, len)).map(b => b.toString(16).padStart(2, "0")).join(" ");
}

function applyValveChange(id, fields, source = "system") {
  const v = valves[id];
  if (!v) return;
  Object.assign(v, fields);
  // derive state from position when not provided
  if (fields.position !== undefined && !fields.state) {
    if (v.position <= 0) v.state = "closed";
    else if (v.position >= 100) v.state = "open";
    else v.state = "throttled";
  }
  broadcast({ type: "valves:patch", id, fields: { ...fields, position: v.position, state: v.state } });
  // packet log triple
  const ct = randomBytes(48);
  state.pingCount++;
  addLog("usv", `[USV] VALVE_CMD ${v.id} (${v.name}) -> ${v.state.toUpperCase()} ${v.position}%`);
  addLog("eve", `[EVE] intercepted 48 bytes: ${hexDump(ct, 24)}...`);
  const ack = randomBytes(16);
  addLog("gnd", `[GND] ACK ${hexDump(ack, 8)}...`);
  broadcast({ type: "state", state });
}

// Simulated PQXDH demo sequence
async function runHandshake() {
  if (handshakeRunning || sessionEstablished) return;
  handshakeRunning = true;
  state.handshakeState = "waiting";
  broadcast({ type: "state", state });

  const ikB = randomBytes(32);
  const spkB = randomBytes(32);
  const pqEk = randomBytes(32);

  addLog("gnd", "[GND] Generating identity keys (X25519 + Ed25519 + ML-KEM-768)...", true);
  await sleep(300);
  addLog("gnd", `[GND] IK_B (X25519 identity): ${hexDump(ikB, 8)}...`, true);
  addLog("gnd", `[GND] SPK_B (X25519 signed prekey): ${hexDump(spkB, 8)}...`, true);
  addLog("gnd", `[GND] PQPK_B (ML-KEM-768 encapsulation key): ${hexDump(pqEk, 8)}... (1184 bytes)`, true);
  addLog("gnd", `[GND] OPK_B (X25519 one-time prekey): ${hexDump(randomBytes(32), 8)}...`, true);
  addLog("gnd", `[GND] Ed25519 signatures computed on SPK_B and PQPK_B`, true);
  await sleep(200);

  state.handshakeState = "bundle_sent";
  broadcast({ type: "state", state });
  addLog("gnd", "[GND] Broadcasting prekey bundle (1440 bytes)", true);
  await sleep(500);

  state.usvConnected = true;
  addLog("usv", "[USV] Received prekey bundle from Ground Station", true);
  addLog("usv", "[USV] Verifying Ed25519 signature on SPK_B... valid", true);
  addLog("usv", "[USV] Verifying Ed25519 signature on PQPK_B... valid", true);
  await sleep(200);

  state.handshakeState = "handshaking";
  broadcast({ type: "state", state });
  addLog("usv", "[USV] Running PQXDH key agreement...", true);
  await sleep(100);

  addLog("usv", "[USV] DH1 = X25519(IK_A, SPK_B) — identity x signed prekey", true);
  await sleep(50);
  addLog("usv", "[USV] DH2 = X25519(EK_A, IK_B) — ephemeral x identity", true);
  await sleep(50);
  addLog("usv", "[USV] DH3 = X25519(EK_A, SPK_B) — ephemeral x signed prekey", true);
  await sleep(50);
  addLog("usv", "[USV] DH4 = X25519(EK_A, OPK_B) — ephemeral x one-time prekey", true);
  await sleep(50);
  addLog("usv", "[USV] ML-KEM-768 Encapsulate(PQPK_B) -> CT (1088 bytes) + SS (32 bytes)", true);
  await sleep(200);

  const sk = randomBytes(32);
  addLog("usv", `[USV] IKM = 0xFF*32 || DH1 || DH2 || DH3 || DH4 || SS (192 bytes)`, true);
  addLog("usv", `[USV] SK = HKDF-SHA256(salt=0, ikm=IKM, info="PQXDH-demo-v1")`, true);
  addLog("usv", `[USV] SK: ${hexDump(sk, 8)}...`, true);
  await sleep(100);

  const ct = randomBytes(48);
  addLog("usv", `[USV] Encrypting "hello ground station!" with ChaCha20-Poly1305`, true);
  addLog("usv", `[USV] AAD: "PQXDH-initial", Nonce: 000000000000`, true);
  addLog("usv", `[USV] Ciphertext: ${hexDump(ct)}`, true);
  addLog("usv", "[USV] Sent InitialMessage to Ground Station", true);
  await sleep(300);

  addLog("gnd", "[GND] Received InitialMessage from USV", true);
  addLog("gnd", "[GND] ML-KEM-768 Decapsulate(CT, dk_B) -> SS recovered", true);
  await sleep(100);
  addLog("gnd", "[GND] Computing mirror DH1..DH4 with own private keys", true);
  await sleep(100);
  addLog("gnd", `[GND] SK derived: ${hexDump(sk, 8)}... (matches USV!)`, true);
  addLog("gnd", "[GND] Decrypting initial payload with ChaCha20-Poly1305...", true);
  await sleep(100);
  addLog("gnd", '[GND] Decrypted: "hello ground station!"', true);
  addLog("gnd", "[GND] Handshake complete!", true);
  await sleep(50);

  state.handshakeState = "established";
  state.handshakeMode = "hybrid";
  broadcast({ type: "state", state });

  addLog("gnd", "[GND] Mode: HYBRID (X25519 + ML-KEM-768)", true);
  addLog("eve", "[EVE] Recorded full handshake transcript.", true);
  addLog("eve", "[EVE] Has: IK_A_pub, EK_A_pub, CT, all public keys", true);
  addLog("eve", "[EVE] Missing: private keys + ML-KEM decapsulation key", true);
  addLog("eve", "[EVE] X25519 alone: breakable by quantum computer (Shor's algorithm)", true);
  addLog("eve", "[EVE] ML-KEM-768: resistant to known quantum attacks", true);
  addLog("eve", "[EVE] Combined: CANNOT DECRYPT. Harvest-now-decrypt-later defeated.", true);
  addLog("gnd", "[GND] Secure channel established. Awaiting telemetry...");

  sessionEstablished = true;
  handshakeRunning = false;
}

function jitter(val, range) { return val + (Math.random() - 0.5) * range; }

function evolveShip() {
  const s = ship;
  s.nav.lat += (Math.random() - 0.5) * 0.0005;
  s.nav.lon += (Math.random() - 0.5) * 0.0005;
  s.nav.sog = Math.max(0, jitter(s.nav.sog, 0.4));
  s.nav.cog = (s.nav.cog + (Math.random() - 0.5) * 3 + 360) % 360;
  s.nav.heading = (s.nav.heading + (Math.random() - 0.5) * 2 + 360) % 360;
  s.nav.depth = Math.max(5, jitter(s.nav.depth, 1));

  for (const t of s.thrusters) {
    t.thrust = Math.max(0, Math.min(100, jitter(t.thrust, 3)));
    t.angle = Math.max(-15, Math.min(15, jitter(t.angle, 1)));
  }
  for (const e of s.engines) {
    e.rpm = Math.max(0, Math.round(jitter(e.rpm, 20)));
    e.temp = Math.round(jitter(e.temp, 2));
    e.oilPsi = Math.round(jitter(e.oilPsi, 2));
    e.fuelFlow = Math.max(0, Math.round(jitter(e.fuelFlow, 2)));
  }
  for (const t of s.transmissions) {
    t.temp = Math.round(jitter(t.temp, 1));
  }
  for (const g of s.generators) {
    // GEN2 and GEN3 randomly toggle on/off
    if (g.id === "GEN2" || g.id === "GEN3") {
      if (Math.random() < 0.05) {
        if (g.kw === 0) { g.kw = 350 + Math.round(Math.random() * 80); g.voltage = 480; g.hz = 60.0; }
        else { g.kw = 0; g.voltage = 0; g.hz = 0; }
      }
    }
    if (g.kw > 0) {
      g.kw = Math.max(0, Math.round(jitter(g.kw, 10)));
      g.voltage = Math.round(jitter(g.voltage, 1));
      g.hz = Math.round(jitter(g.hz * 10, 1)) / 10;
    }
    g.fuelLevel = Math.max(0, +(g.fuelLevel - 0.02).toFixed(1));
  }
  for (const h of s.hvac) {
    h.zoneTemp = Math.round(jitter(h.zoneTemp, 1.5));
    if (Math.random() < 0.03) h.setpoint = [68, 70, 72, 74, 76][Math.floor(Math.random() * 5)];
    if (Math.random() < 0.04) h.mode = ["AUTO", "COOL", "HEAT", "FAN"][Math.floor(Math.random() * 4)];
  }
  s.waste.grayLevel = Math.max(0, Math.min(100, jitter(s.waste.grayLevel, 3)));
  s.waste.blackLevel = Math.max(0, Math.min(100, jitter(s.waste.blackLevel, 2)));
  if (Math.random() < 0.04) s.waste.grayPump = s.waste.grayPump === "OFF" ? "ON" : "OFF";
  if (Math.random() < 0.04) s.waste.blackPump = s.waste.blackPump === "OFF" ? "ON" : "OFF";

  // Bow thruster
  s.bowThruster.thrust = Math.max(0, Math.min(100, jitter(s.bowThruster.thrust, 5)));
  s.bowThruster.angle = Math.max(-45, Math.min(45, jitter(s.bowThruster.angle, 3)));

  // Fire zones - occasional random flicker for demo
  for (let i = 0; i < s.fire.zones.length; i++) {
    if (Math.random() < 0.02) s.fire.zones[i] = s.fire.zones[i] ? 0 : 1;
  }
  s.fire.alarm = s.fire.zones.some(z => z > 0);
  s.fire.agentLevel = Math.max(0, +(s.fire.agentLevel - 0.01).toFixed(1));

  for (const r of s.radarContacts) {
    r.bearing = Math.round((r.bearing + (Math.random() - 0.5) * 3 + 360) % 360);
    r.range = Math.max(0.1, +(r.range + (Math.random() - 0.5) * 0.3).toFixed(1));
    r.speed = Math.max(0, +(r.speed + (Math.random() - 0.5) * 0.5).toFixed(1));
    r.cpa = Math.max(0, +(r.cpa + (Math.random() - 0.5) * 0.1).toFixed(1));
  }
}

function driftValve() {
  if (scenarioRunning) return;
  if (state.handshakeState !== "established") return;
  const eligible = Object.values(valves).filter(v => v.kind === "globe" && v.state === "throttled");
  if (!eligible.length) return;
  const v = eligible[Math.floor(Math.random() * eligible.length)];
  const delta = Math.round((Math.random() - 0.5) * 20); // -10..+10
  const newPos = Math.max(5, Math.min(95, v.position + delta));
  if (newPos === v.position) return;
  applyValveChange(v.id, { position: newPos }, "drift");
}

async function sendPing() {
  if (!sessionEstablished) return;

  evolveShip();
  const plaintext = JSON.stringify(ship);
  const plaintextBytes = Buffer.byteLength(plaintext);

  state.pingCount++;
  const ct = randomBytes(plaintextBytes + 16);

  addLog("usv", `[USV] Telemetry frame #${state.pingCount}: ${plaintextBytes} bytes plaintext`);
  addLog("usv", `[USV] Nav: ${ship.nav.lat.toFixed(4)}N ${Math.abs(ship.nav.lon).toFixed(4)}W SOG:${ship.nav.sog.toFixed(1)}kn HDG:${ship.nav.heading.toFixed(0)}°`);
  addLog("usv", `[USV] Encrypting with ChaCha20-Poly1305 (nonce: ${state.pingCount})`);
  addLog("usv", `[USV] Ciphertext: ${hexDump(ct, 28)}...`);
  addLog("eve", `[EVE] Intercepted ${ct.length} bytes: ${hexDump(ct, 24)}...`);
  broadcast({ type: "state", state });
  broadcast({ type: "ship", ship, ciphertext: hexDump(ct, 40) });

  await sleep(80);
  addLog("gnd", `[GND] Received ${ct.length} encrypted bytes -> decrypted ${plaintextBytes} bytes`);
  addLog("gnd", `[GND] Nav: ${ship.nav.lat.toFixed(4)}N ${Math.abs(ship.nav.lon).toFixed(4)}W | Engines: ${ship.engines.map(e=>e.rpm).join("/")} RPM`);

  state.pongCount++;
  const ack = randomBytes(24);
  addLog("gnd", `[GND] ACK #${state.pongCount} -> ${hexDump(ack, 12)}...`);
  broadcast({ type: "state", state });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

app.prepare().then(() => {
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url.startsWith("/api/valve/")) {
      const id = req.url.slice("/api/valve/".length);
      if (!valves[id]) { res.writeHead(404); res.end("unknown valve"); return; }
      if (state.handshakeState !== "established") { res.writeHead(409); res.end("handshake not established"); return; }
      let body = "";
      req.on("data", c => body += c);
      req.on("end", () => {
        let parsed = {};
        try { parsed = JSON.parse(body || "{}"); } catch { res.writeHead(400); res.end("bad json"); return; }
        const fields = {};
        if (typeof parsed.position === "number") fields.position = Math.max(0, Math.min(100, parsed.position));
        if (parsed.state === "open" || parsed.state === "closed") {
          fields.state = parsed.state;
          fields.position = parsed.state === "open" ? 100 : 0;
        }
        applyValveChange(id, fields, "user");
        res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end("ok");
      });
      return;
    }
    if (req.method === "POST" && req.url.startsWith("/api/scenario/")) {
      const name = req.url.slice("/api/scenario/".length);
      if (scenarioRunning) { res.writeHead(409); res.end("scenario in flight"); return; }
      if (state.handshakeState !== "established") { res.writeHead(409); res.end("handshake not established"); return; }
      const fn = scenarios[name];
      if (!fn) { res.writeHead(404); res.end("unknown scenario"); return; }
      scenarioRunning = name;
      broadcast({ type: "scenario", name, status: "started" });
      fn().then(() => {
        scenarioRunning = null;
        broadcast({ type: "scenario", name, status: "ended" });
      }).catch(e => {
        console.error("scenario error:", e);
        scenarioRunning = null;
        broadcast({ type: "scenario", name, status: "ended" });
      });
      res.writeHead(202); res.end("started");
      return;
    }
    if (req.method === "POST" && req.url === "/api/ping") {
      sendPing();
      res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
      res.end("ok");
      return;
    }
    if (req.method === "POST" && req.url === "/api/reset") {
      // Reset entire demo state
      state.usvConnected = false;
      state.gndConnected = false;
      state.handshakeState = "idle";
      state.handshakeMode = "unknown";
      state.pingCount = 0;
      state.pongCount = 0;
      state.lastActivity = "";
      sessionEstablished = false;
      handshakeRunning = false;
      keyExchange.length = 0;
      logs.length = 0;
      valves = initialValves();
      scenarioRunning = null;
      broadcast({ type: "valves:full", valves });
      broadcast({ type: "state", state });
      broadcast({ type: "keyexchange", steps: [] });
      // Re-run handshake after brief pause
      setTimeout(() => {
        state.usvConnected = true;
        state.gndConnected = true;
        addLog("gnd", "[GND] Board connected");
        addLog("usv", "[USV] Board connected");
        runHandshake();
      }, 500);
      res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
      res.end("ok");
      return;
    }
    handle(req, res);
  });

  // WebSocket on separate port to avoid Next.js HMR conflicts
  const wsServer = createServer();
  const wss = new WebSocketServer({ server: wsServer });

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "valves:full", valves }));
    ws.send(JSON.stringify({ type: "state", state }));
    if (keyExchange.length) ws.send(JSON.stringify({ type: "keyexchange", steps: keyExchange }));
    for (const entry of logs.slice(-200)) {
      ws.send(JSON.stringify({ type: "log", ...entry }));
    }
    ws.on("close", () => clients.delete(ws));
  });

  // Connect to USV serial for button events
  if (usvPort) {
    try {
      const serial = new SerialPort({ path: usvPort, baudRate: 115200 });
      const parser = serial.pipe(new ReadlineParser({ delimiter: "\n" }));
      parser.on("data", (line) => {
        const trimmed = line.trim();
        if (trimmed.includes("[USV] Ready") || trimmed.includes("[USV] BOOT")) {
          state.usvConnected = true;
          addLog("usv", "[USV] Board connected");
          if (!sessionEstablished && state.handshakeState === "idle") {
            runHandshake();
          }
        }
        if (trimmed.includes("[USV] BUTTON")) {
          sendPing();
        }
      });
      // Auto-detect: if we get any data at all, the board is connected
      serial.on("open", () => {
        setTimeout(() => {
          if (!state.usvConnected) {
            state.usvConnected = true;
            addLog("usv", "[USV] Board connected");
            if (state.handshakeState === "idle") runHandshake();
          }
        }, 2000);
      });
      serial.on("error", (e) => console.error("USV serial:", e.message));
      console.log(`USV serial: ${usvPort}`);
    } catch (e) {
      console.error("USV port error:", e.message);
    }
  }

  // Connect to GND serial (just for status)
  if (gndPort) {
    try {
      const serial = new SerialPort({ path: gndPort, baudRate: 115200 });
      const parser = serial.pipe(new ReadlineParser({ delimiter: "\n" }));
      parser.on("data", (line) => {
        if (line.trim().includes("[GND] Ready")) {
          state.gndConnected = true;
          addLog("gnd", "[GND] Board connected");
        }
      });
      serial.on("open", () => {
        setTimeout(() => {
          if (!state.gndConnected) {
            state.gndConnected = true;
            addLog("gnd", "[GND] Board connected");
          }
        }, 2000);
      });
      serial.on("error", (e) => console.error("GND serial:", e.message));
      console.log(`GND serial: ${gndPort}`);
    } catch (e) {
      console.error("GND port error:", e.message);
    }
  }

  wsServer.listen(3001, () => {
    console.log("WebSocket: ws://localhost:3001");
  });

  server.listen(port, () => {
    console.log(`Dashboard: http://localhost:${port}`);
    console.log(`Usage: node server.mjs <usv-port> [gnd-port]`);
    if (!usvPort) {
      console.log("\nNo serial ports — running in demo mode");
      console.log("Press Enter to simulate handshake, then Enter again for pings\n");

      process.stdin.setEncoding("utf8");
      let handshakeDone = false;
      process.stdin.on("data", () => {
        if (!handshakeDone) {
          state.usvConnected = true;
          state.gndConnected = true;
          runHandshake();
          handshakeDone = true;
        } else {
          sendPing();
        }
      });
    }
  });

  function scheduleDrift() {
    const delay = 4000 + Math.random() * 4000;
    setTimeout(() => { driftValve(); scheduleDrift(); }, delay);
  }
  scheduleDrift();
});
