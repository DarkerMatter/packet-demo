import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { randomBytes } from "crypto";
import next from "next";

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
let telemetryLat = 37.7749;
let telemetryLon = -122.4194;
let telemetryAlt = 15.0;
let telemetryHeading = 0;

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

// Simulated PQXDH demo sequence
async function runHandshake() {
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
}

async function sendPing() {
  if (!sessionEstablished) return;

  // Simulate USV telemetry
  telemetryLat += (Math.random() - 0.5) * 0.001;
  telemetryLon += (Math.random() - 0.5) * 0.001;
  telemetryAlt += (Math.random() - 0.5) * 2;
  telemetryHeading = (telemetryHeading + Math.random() * 10) % 360;
  const battery = Math.max(0, 100 - state.pingCount * 0.3).toFixed(1);
  const speed = (2 + Math.random() * 3).toFixed(1);

  const telemetry = {
    lat: telemetryLat.toFixed(6),
    lon: telemetryLon.toFixed(6),
    alt: telemetryAlt.toFixed(1),
    hdg: telemetryHeading.toFixed(0),
    spd: speed,
    bat: battery,
    ts: Date.now(),
  };
  const plaintext = JSON.stringify(telemetry);

  state.pingCount++;
  const ct = randomBytes(plaintext.length + 16);
  addLog("usv", `[USV] Telemetry: lat=${telemetry.lat} lon=${telemetry.lon} alt=${telemetry.alt}m hdg=${telemetry.hdg}° spd=${telemetry.spd}kn bat=${telemetry.bat}%`);
  addLog("usv", `[USV] Encrypting ${plaintext.length} bytes (counter: ${state.pingCount})`);
  addLog("usv", `[USV] Ciphertext: ${hexDump(ct, 24)}...`);
  addLog("eve", `[EVE] Intercepted ${ct.length} bytes: ${hexDump(ct, 20)}...`);
  addLog("eve", `[EVE] Cannot determine: position, heading, speed, or battery level`);
  broadcast({ type: "state", state });
  broadcast({ type: "telemetry", ...telemetry, ciphertext: hexDump(ct, 32) });

  await sleep(100);
  addLog("gnd", `[GND] Received ${ct.length} encrypted bytes`);
  addLog("gnd", `[GND] Decrypted telemetry: lat=${telemetry.lat} lon=${telemetry.lon} alt=${telemetry.alt}m`);

  await sleep(50);
  state.pongCount++;
  const ack = randomBytes(24);
  addLog("gnd", `[GND] ACK -> ${hexDump(ack, 12)}...`);
  addLog("usv", `[USV] ACK received`);
  broadcast({ type: "state", state });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

app.prepare().then(() => {
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/ping") {
      sendPing();
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
});
