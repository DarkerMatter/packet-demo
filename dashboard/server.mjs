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
const logs = [];
const clients = new Set();
let sessionEstablished = false;

function ts() { return new Date().toISOString().slice(11, 23); }

function addLog(source, text) {
  const entry = { ts: ts(), source, text };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
  state.lastActivity = entry.ts;
  broadcast({ type: "log", ...entry });
  broadcast({ type: "state", state });
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

  addLog("gnd", "[GND] Generating identity keys (X25519 + Ed25519 + ML-KEM-768)...");
  await sleep(300);

  const ikB = randomBytes(32);
  const spkB = randomBytes(32);
  const pqEk = randomBytes(32); // show prefix only
  addLog("gnd", `[GND] IK_B: ${hexDump(ikB, 8)}...`);
  addLog("gnd", `[GND] SPK_B: ${hexDump(spkB, 8)}...`);
  addLog("gnd", `[GND] PQPK_B (ML-KEM-768): ${hexDump(pqEk, 8)}... (1184 bytes)`);
  await sleep(200);

  state.handshakeState = "bundle_sent";
  broadcast({ type: "state", state });
  addLog("gnd", "[GND] Broadcasting prekey bundle (1440 bytes)");
  await sleep(500);

  state.usvConnected = true;
  addLog("usv", "[USV] Received prekey bundle from Ground Station");
  addLog("usv", "[USV] Verifying Ed25519 signatures on SPK and PQPK...");
  await sleep(200);
  addLog("usv", "[USV] Signatures valid");
  await sleep(100);

  state.handshakeState = "handshaking";
  broadcast({ type: "state", state });
  addLog("usv", "[USV] Running PQXDH key agreement...");
  await sleep(100);

  addLog("usv", "[USV] DH1 = X25519(IK_A, SPK_B)");
  await sleep(50);
  addLog("usv", "[USV] DH2 = X25519(EK_A, IK_B)");
  await sleep(50);
  addLog("usv", "[USV] DH3 = X25519(EK_A, SPK_B)");
  await sleep(50);
  addLog("usv", "[USV] DH4 = X25519(EK_A, OPK_B)");
  await sleep(50);
  addLog("usv", "[USV] ML-KEM-768 Encapsulate -> ciphertext (1088 bytes) + shared secret");
  await sleep(200);

  const sk = randomBytes(32);
  addLog("usv", `[USV] SK = HKDF-SHA256(F || DH1 || DH2 || DH3 || DH4 || SS)`);
  addLog("usv", `[USV] SK: ${hexDump(sk, 8)}...`);
  await sleep(100);

  const ct = randomBytes(48);
  addLog("usv", `[USV] Encrypting initial payload with ChaCha20-Poly1305`);
  addLog("usv", `[USV] Ciphertext: ${hexDump(ct)}`);
  addLog("usv", "[USV] Sent InitialMessage (1284 bytes)");
  await sleep(300);

  addLog("gnd", "[GND] Received InitialMessage from USV");
  addLog("gnd", "[GND] ML-KEM-768 Decapsulate -> recovered shared secret");
  await sleep(100);
  addLog("gnd", "[GND] Computing mirror DH values...");
  await sleep(100);
  addLog("gnd", `[GND] SK derived: ${hexDump(sk, 8)}...`);
  addLog("gnd", "[GND] Decrypting initial payload...");
  await sleep(100);
  addLog("gnd", '[GND] Handshake complete! Payload: "hello ground station!"');
  await sleep(50);

  state.handshakeState = "established";
  state.handshakeMode = "hybrid";
  broadcast({ type: "state", state });

  addLog("gnd", "[GND] Mode: HYBRID (X25519 + ML-KEM-768)");
  addLog("eve", "[EVE] Recorded full handshake. Cannot decrypt — quantum-resistant key exchange.");
  addLog("gnd", "[GND] Secure channel established. Waiting for messages...");

  sessionEstablished = true;
}

async function sendPing() {
  if (!sessionEstablished) return;

  state.pingCount++;
  const ct = randomBytes(36);
  addLog("usv", `[USV] Encrypting "ping" with ChaCha20-Poly1305 (counter: ${state.pingCount})`);
  addLog("usv", `[USV] Ciphertext: ${hexDump(ct)}`);
  addLog("eve", `[EVE] Intercepted ${ct.length} bytes: ${hexDump(ct, 16)}... (gibberish)`);
  broadcast({ type: "state", state });

  await sleep(100);
  addLog("gnd", `[GND] Received ${ct.length} encrypted bytes`);
  addLog("gnd", '[GND] Decrypted: "ping"');

  await sleep(100);
  state.pongCount++;
  const ct2 = randomBytes(36);
  addLog("gnd", `[GND] Encrypting "pong" -> ${hexDump(ct2, 16)}...`);
  addLog("usv", '[USV] Received encrypted pong, decrypted: "pong"');
  broadcast({ type: "state", state });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "state", state }));
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

  server.listen(port, () => {
    console.log(`\nDashboard: http://localhost:${port}`);
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
