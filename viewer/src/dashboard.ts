import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const portPath = process.argv[2];
if (!portPath) {
  console.error("Usage: npx tsx src/dashboard.ts <serial-port>");
  console.error("  e.g. npx tsx src/dashboard.ts /dev/cu.usbmodem2101");
  const ports = await SerialPort.list();
  console.error("\nAvailable ports:");
  for (const p of ports) {
    console.error(`  ${p.path}  ${p.manufacturer || ""}`);
  }
  process.exit(1);
}

const baudRate = parseInt(process.argv[3] || "115200", 10);
const HTTP_PORT = 3000;

// --- State tracking ---
interface DemoState {
  usvConnected: boolean;
  gndConnected: boolean;
  handshakeState: "idle" | "bundle_sent" | "handshaking" | "established" | "failed";
  handshakeMode: "hybrid" | "classical" | "unknown";
  pingCount: number;
  pongCount: number;
  usvMac: string;
  gndMac: string;
  lastActivity: string;
  logs: { ts: string; source: string; text: string }[];
}

const state: DemoState = {
  usvConnected: false,
  gndConnected: true,
  handshakeState: "idle",
  handshakeMode: "unknown",
  pingCount: 0,
  pongCount: 0,
  usvMac: "",
  gndMac: "",
  lastActivity: "",
  logs: [],
};

// --- Serial port ---
const serial = new SerialPort({ path: portPath, baudRate });
const parser = serial.pipe(new ReadlineParser({ delimiter: "\n" }));

function timestamp(): string {
  const d = new Date();
  return d.toISOString().slice(11, 23);
}

function addLog(source: string, text: string) {
  const ts = timestamp();
  const entry = { ts, source, text };
  state.logs.push(entry);
  if (state.logs.length > 500) state.logs.shift();
  state.lastActivity = ts;
  broadcast({ type: "log", ...entry });
  broadcast({ type: "state", state });
}

parser.on("data", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let source = "system";
  if (trimmed.startsWith("[USV]")) source = "usv";
  else if (trimmed.startsWith("[GND]")) source = "gnd";
  else if (trimmed.startsWith("[EVE]")) source = "eve";

  if (source === "gnd") {
    if (trimmed.includes("MAC:")) state.gndMac = trimmed.split("MAC:")[1]?.trim() || "";
    if (trimmed.includes("Broadcasting prekey bundle")) state.handshakeState = "bundle_sent";
    if (trimmed.includes("Received InitialMessage")) { state.handshakeState = "handshaking"; state.usvConnected = true; }
    if (trimmed.includes("Handshake complete")) state.handshakeState = "established";
    if (trimmed.includes("Handshake FAILED")) state.handshakeState = "failed";
    if (trimmed.includes("HYBRID")) state.handshakeMode = "hybrid";
    if (trimmed.includes("CLASSICAL")) state.handshakeMode = "classical";
    if (trimmed.includes("Received: ping")) state.pingCount++;
    if (trimmed.includes("Sent encrypted pong")) state.pongCount++;
  }

  if (source === "usv") {
    state.usvConnected = true;
    if (trimmed.includes("MAC:")) state.usvMac = trimmed.split("MAC:")[1]?.trim() || "";
  }

  addLog(source, trimmed);
  console.log(`${timestamp()} ${trimmed}`);
});

serial.on("error", (err) => {
  console.error(`Serial error: ${err.message}`);
});

// --- HTTP + WebSocket server ---
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PQXDH Demo Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    background: #0a0e17;
    color: #c5cdd9;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  header {
    background: #111827;
    border-bottom: 1px solid #1f2937;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  }
  header h1 { font-size: 18px; font-weight: 600; color: #f9fafb; white-space: nowrap; }
  header h1 span { color: #818cf8; }
  .status-bar { display: flex; gap: 20px; flex-wrap: wrap; align-items: center; }
  .status-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .dot-green { background: #34d399; box-shadow: 0 0 6px #34d39966; }
  .dot-yellow { background: #fbbf24; box-shadow: 0 0 6px #fbbf2466; }
  .dot-red { background: #f87171; box-shadow: 0 0 6px #f8717166; }
  .dot-gray { background: #6b7280; }
  .dot-blue { background: #60a5fa; box-shadow: 0 0 6px #60a5fa66; }
  .dot-pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    padding: 16px 24px;
  }
  .card {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 8px;
    padding: 16px;
  }
  .card-label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
  .card-value { font-size: 24px; font-weight: 700; color: #f9fafb; margin-top: 4px; }
  .card-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
  .log-container {
    flex: 1;
    overflow: hidden;
    padding: 0 24px 16px;
    display: flex;
    flex-direction: column;
  }
  .log-header {
    font-size: 12px;
    text-transform: uppercase;
    color: #6b7280;
    letter-spacing: 0.05em;
    padding: 8px 0;
    border-bottom: 1px solid #1f2937;
  }
  #log {
    flex: 1;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.6;
    padding-top: 8px;
  }
  #log::-webkit-scrollbar { width: 6px; }
  #log::-webkit-scrollbar-track { background: transparent; }
  #log::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
  .log-line { white-space: pre-wrap; word-break: break-all; }
  .log-ts { color: #4b5563; }
  .log-usv { color: #60a5fa; }
  .log-gnd { color: #34d399; }
  .log-eve { color: #f87171; font-weight: 700; }
  .log-system { color: #6b7280; }
</style>
</head>
<body>
<header>
  <h1><span>PQXDH</span> Demo Dashboard</h1>
  <div class="status-bar">
    <div class="status-item">
      <div class="status-dot dot-gray" id="dot-usv"></div>
      <span>USV</span>
      <span style="color:#4b5563" id="usv-mac"></span>
    </div>
    <div class="status-item">
      <div class="status-dot dot-gray" id="dot-gnd"></div>
      <span>Ground Station</span>
      <span style="color:#4b5563" id="gnd-mac"></span>
    </div>
    <div class="status-item">
      <div class="status-dot dot-gray" id="dot-link"></div>
      <span id="link-status">No Link</span>
    </div>
  </div>
</header>
<div class="cards">
  <div class="card">
    <div class="card-label">Handshake</div>
    <div class="card-value" id="hs-state">Idle</div>
    <div class="card-sub" id="hs-mode"></div>
  </div>
  <div class="card">
    <div class="card-label">Pings Received</div>
    <div class="card-value" id="ping-count">0</div>
    <div class="card-sub">USV &rarr; Ground Station</div>
  </div>
  <div class="card">
    <div class="card-label">Pongs Sent</div>
    <div class="card-value" id="pong-count">0</div>
    <div class="card-sub">Ground Station &rarr; USV</div>
  </div>
  <div class="card">
    <div class="card-label">Last Activity</div>
    <div class="card-value" id="last-activity" style="font-size:16px">--</div>
    <div class="card-sub" id="ws-status">Connecting...</div>
  </div>
</div>
<div class="log-container">
  <div class="log-header">Live Log</div>
  <div id="log"></div>
</div>
<script>
const logEl = document.getElementById('log');
let autoScroll = true;

logEl.addEventListener('scroll', () => {
  autoScroll = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 30;
});

function appendLog(ts, source, text) {
  const div = document.createElement('div');
  div.className = 'log-line';
  const tsSpan = document.createElement('span');
  tsSpan.className = 'log-ts';
  tsSpan.textContent = ts + ' ';
  const msgSpan = document.createElement('span');
  msgSpan.className = 'log-' + source;
  msgSpan.textContent = text;
  div.appendChild(tsSpan);
  div.appendChild(msgSpan);
  logEl.appendChild(div);
  if (logEl.children.length > 500) logEl.removeChild(logEl.firstChild);
  if (autoScroll) logEl.scrollTop = logEl.scrollHeight;
}

function updateState(s) {
  const dUsv = document.getElementById('dot-usv');
  dUsv.className = 'status-dot ' + (s.usvConnected ? 'dot-green' : 'dot-gray');
  document.getElementById('usv-mac').textContent = s.usvMac || '';
  document.getElementById('dot-gnd').className = 'status-dot dot-green';
  document.getElementById('gnd-mac').textContent = s.gndMac || '';
  const dLink = document.getElementById('dot-link');
  const linkLabel = document.getElementById('link-status');
  const linkMap = {
    established: ['dot-green', 'Encrypted Link'],
    handshaking: ['dot-yellow dot-pulse', 'Handshaking...'],
    bundle_sent: ['dot-blue dot-pulse', 'Broadcasting...'],
    failed: ['dot-red', 'Failed'],
    idle: ['dot-gray', 'No Link']
  };
  const [cls, lbl] = linkMap[s.handshakeState] || linkMap.idle;
  dLink.className = 'status-dot ' + cls;
  linkLabel.textContent = lbl;
  const hsNames = { idle: 'Idle', bundle_sent: 'Broadcasting', handshaking: 'Handshaking', established: 'Established', failed: 'Failed' };
  document.getElementById('hs-state').textContent = hsNames[s.handshakeState] || s.handshakeState;
  document.getElementById('hs-mode').textContent = s.handshakeMode === 'hybrid' ? 'X25519 + ML-KEM-768'
    : s.handshakeMode === 'classical' ? 'X25519 only' : '';
  document.getElementById('ping-count').textContent = s.pingCount;
  document.getElementById('pong-count').textContent = s.pongCount;
  document.getElementById('last-activity').textContent = s.lastActivity || '--';
}

function connect() {
  const ws = new WebSocket('ws://' + location.host);
  document.getElementById('ws-status').textContent = 'Connecting...';
  ws.onopen = () => { document.getElementById('ws-status').textContent = 'Connected'; };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'log') appendLog(msg.ts, msg.source, msg.text);
    if (msg.type === 'state') updateState(msg.state);
  };
  ws.onclose = () => {
    document.getElementById('ws-status').textContent = 'Disconnected — reconnecting...';
    setTimeout(connect, 2000);
  };
}
connect();
</script>
</body>
</html>`;

const clients = new Set<WebSocket>();

function broadcast(data: object) {
  const json = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "state", state }));
  for (const entry of state.logs) {
    ws.send(JSON.stringify({ type: "log", ...entry }));
  }
  ws.on("close", () => clients.delete(ws));
});

server.listen(HTTP_PORT, () => {
  console.log(`Dashboard: http://localhost:${HTTP_PORT}`);
  console.log(`Serial: ${portPath} @ ${baudRate} baud\n`);
});
