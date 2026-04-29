"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface LogEntry { ts: string; source: string; text: string }
interface KeyStep { ts: string; source: string; text: string }
interface ShipData {
  nav: { lat: number; lon: number; sog: number; cog: number; heading: number; depth: number };
  thrusters: { id: string; angle: number; thrust: number; reversed: boolean }[];
  engines: { id: string; rpm: number; temp: number; oilPsi: number; fuelFlow: number }[];
  transmissions: { id: string; gear: string; ratio: number; temp: number }[];
  generators: { id: string; kw: number; voltage: number; hz: number; fuelLevel: number }[];
  hvac: { id: string; zoneTemp: number; setpoint: number; mode: string }[];
  waste: { grayLevel: number; blackLevel: number; grayPump: string; blackPump: string };
  bowThruster: { angle: number; thrust: number };
  fire: { zones: number[]; alarm: boolean; agentLevel: number };
  radarContacts: { id: string; bearing: number; range: number; speed: number; cpa: number }[];
}
interface DemoState {
  usvConnected: boolean; gndConnected: boolean;
  handshakeState: string; handshakeMode: string;
  pingCount: number; pongCount: number; lastActivity: string;
}
const defaultState: DemoState = {
  usvConnected: false, gndConnected: false, handshakeState: "idle",
  handshakeMode: "unknown", pingCount: 0, pongCount: 0, lastActivity: "",
};
const srcColor: Record<string, string> = {
  usv: "text-blue-400", gnd: "text-emerald-400", eve: "text-red-400 font-bold", system: "text-zinc-500",
};

// Color helper for temp ranges
function tempColor(t: number, warn = 200, crit = 220) {
  if (t >= crit) return "text-red-400";
  if (t >= warn) return "text-amber-400";
  return "text-zinc-300";
}

function ShipView({ ship }: { ship: ShipData | null }) {
  if (!ship) return <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Awaiting first telemetry frame...</div>;
  const s = ship;

  // Each thruster line: thruster <- transmission <- engine
  const driveLines = s.thrusters.map((t, i) => ({
    thruster: t,
    transmission: s.transmissions[i],
    engine: s.engines[i],
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Nav Bar */}
      <div className="flex-shrink-0 bg-zinc-800/40 rounded-lg px-4 py-2.5 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase">Position</p>
              <p className="text-sm text-zinc-100 font-mono">{s.nav.lat.toFixed(4)}N {Math.abs(s.nav.lon).toFixed(4)}W</p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-zinc-700" />
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase">SOG</p>
              <p className="text-lg text-zinc-100 font-mono font-bold">{s.nav.sog.toFixed(1)}<span className="text-xs text-zinc-500 ml-0.5">kn</span></p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase">COG</p>
              <p className="text-lg text-zinc-100 font-mono font-bold">{s.nav.cog.toFixed(0)}<span className="text-xs text-zinc-500">°</span></p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase">HDG</p>
              <p className="text-lg text-zinc-100 font-mono font-bold">{s.nav.heading.toFixed(0)}<span className="text-xs text-zinc-500">°</span></p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase">Depth</p>
              <p className="text-lg text-zinc-100 font-mono font-bold">{s.nav.depth.toFixed(1)}<span className="text-xs text-zinc-500 ml-0.5">m</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            {s.generators.map(g => (
              <div key={g.id} className={`text-center px-2 py-1 rounded ${g.kw > 0 ? "bg-purple-950/40 border border-purple-800/30" : "bg-zinc-800/50 border border-zinc-700/30"}`}>
                <p className="text-zinc-500">{g.id}</p>
                <p className={g.kw > 0 ? "text-purple-400 font-mono" : "text-zinc-600 font-mono"}>{g.kw > 0 ? `${g.kw}kW` : "OFF"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ship Body - SVG + Drive Lines */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 800 580" className="w-full h-full max-h-full" preserveAspectRatio="xMidYMid meet">
          {/* Hull outline */}
          <path d="M400,30 L490,70 L505,200 L505,420 L485,510 L400,540 L315,510 L295,420 L295,200 L310,70 Z"
            fill="#0f0f17" stroke="#2a2a3a" strokeWidth="1.5" />
          {/* Deck lines */}
          <line x1="400" y1="40" x2="400" y2="530" stroke="#1a1a2a" strokeWidth="0.5" strokeDasharray="3,6" />
          <ellipse cx="400" cy="130" rx="75" ry="15" fill="none" stroke="#1a1a2a" strokeWidth="0.5" />
          <text x="400" y="134" textAnchor="middle" fill="#333" fontSize="8">BRIDGE</text>
          <text x="400" y="24" textAnchor="middle" fill="#444" fontSize="9" fontWeight="bold">BOW</text>
          <text x="400" y="562" textAnchor="middle" fill="#444" fontSize="9" fontWeight="bold">STERN</text>

          {/* Bow Thruster */}
          <rect x="330" y="55" width="140" height="28" rx="3" fill="#0a0a14" stroke={s.bowThruster.thrust > 0 ? "#22c55e33" : "#333"} strokeWidth="0.8" />
          <text x="400" y="67" textAnchor="middle" fill="#4ade80" fontSize="7" fontWeight="bold">BOW THRUSTER</text>
          <text x="360" y="78" textAnchor="middle" fill="#888" fontSize="6">Thrust</text>
          <text x="390" y="78" fill="#4ade80" fontSize="7" fontFamily="monospace">{s.bowThruster.thrust.toFixed(0)}%</text>
          <text x="420" y="78" fill="#888" fontSize="6">Angle</text>
          <text x="452" y="78" fill="#60a5fa" fontSize="7" fontFamily="monospace">{s.bowThruster.angle.toFixed(0)}°</text>

          {/* Fire suppression zones */}
          <g>
            <rect x="320" y="155" width="160" height="34" rx="3" fill="#0a0a14" stroke={s.fire.alarm ? "#ef444444" : "#222"} strokeWidth="0.8" />
            <text x="400" y="166" textAnchor="middle" fill={s.fire.alarm ? "#ef4444" : "#555"} fontSize="7" fontWeight="bold">
              FIRE SUPPRESSION {s.fire.alarm ? "⚠ ALARM" : ""}
            </text>
            {s.fire.zones.map((z, i) => (
              <g key={`fz${i}`}>
                <circle cx={342 + i * 16} cy="178" r="5" fill={z > 0 ? "#ef4444" : "#111"} stroke={z > 0 ? "#f87171" : "#2a2a2a"} strokeWidth="0.5" />
                <text x={342 + i * 16} y="181" textAnchor="middle" fill={z > 0 ? "#fff" : "#444"} fontSize="5">{i + 1}</text>
              </g>
            ))}
            <text x="435" y="181" fill="#555" fontSize="6">Agent: <tspan fill={s.fire.agentLevel < 50 ? "#fbbf24" : "#4ade80"}>{s.fire.agentLevel}%</tspan></text>
          </g>

          {/* HVAC */}
          {s.hvac.map((h, i) => {
            const y = 195 + i * 22;
            return (
              <g key={h.id}>
                <rect x="310" y={y} width="180" height="18" rx="2" fill="#0d1117" stroke="#1e3a4a" strokeWidth="0.5" />
                <text x="320" y={y + 12} fill="#06b6d4" fontSize="7">{h.id}</text>
                <text x="415" y={y + 12} fill="#67e8f9" fontSize="7" fontFamily="monospace">{h.zoneTemp}°F / {h.setpoint}°F</text>
                <text x="480" y={y + 12} fill="#555" fontSize="6">{h.mode}</text>
              </g>
            );
          })}

          {/* Waste */}
          <g>
            <rect x="320" y="245" width="80" height="18" rx="2" fill="#0d1117" stroke="#854d0e44" strokeWidth="0.5" />
            <text x="325" y="257" fill="#a16207" fontSize="7">GRAY {s.waste.grayLevel.toFixed(0)}%</text>
            <rect x="405" y="245" width="80" height="18" rx="2" fill="#0d1117" stroke="#854d0e44" strokeWidth="0.5" />
            <text x="410" y="257" fill="#a16207" fontSize="7">BLACK {s.waste.blackLevel.toFixed(0)}%</text>
          </g>

          {/* ===== DRIVE TRAINS ===== */}
          {/* Layout: 2 forward (PS/SB at y~300), center (y~340), 2 aft (PS/SB at y~380) */}
          {(() => {
            const positions = [
              { x: 335, y: 280, label: "PS FWD" },  // T1
              { x: 465, y: 280, label: "SB FWD" },  // T2
              { x: 335, y: 355, label: "PS AFT" },  // T3
              { x: 465, y: 355, label: "SB AFT" },  // T4
              { x: 400, y: 430, label: "CENTER" },   // T5
            ];
            return positions.map((pos, i) => {
              const dl = driveLines[i];
              if (!dl) return null;
              const { thruster: t, transmission: tx, engine: e } = dl;
              const isCenter = i === 4;
              const w = isCenter ? 120 : 100;
              const left = pos.x - w / 2;

              return (
                <g key={`drive${i}`}>
                  {/* Drive train box */}
                  <rect x={left} y={pos.y} width={w} height={isCenter ? 55 : 65} rx="3"
                    fill="#0a0a14" stroke={t.thrust > 50 ? "#22c55e33" : "#222"} strokeWidth="0.8" />

                  {/* Thruster */}
                  <text x={pos.x} y={pos.y + 10} textAnchor="middle" fill="#4ade80" fontSize="7" fontWeight="bold">
                    JET {pos.label}
                  </text>
                  <text x={left + 4} y={pos.y + 22} fill="#888" fontSize="6">Thrust</text>
                  <text x={left + w - 4} y={pos.y + 22} textAnchor="end" fill="#4ade80" fontSize="7" fontFamily="monospace">
                    {t.thrust.toFixed(0)}%
                  </text>
                  <text x={left + 4} y={pos.y + 31} fill="#888" fontSize="6">Angle</text>
                  <text x={left + w - 4} y={pos.y + 31} textAnchor="end" fill="#60a5fa" fontSize="7" fontFamily="monospace">
                    {t.angle.toFixed(1)}°
                  </text>

                  {/* Transmission */}
                  <text x={left + 4} y={pos.y + 41} fill="#888" fontSize="6">Trans</text>
                  <text x={left + w - 4} y={pos.y + 41} textAnchor="end" fontSize="7" fontFamily="monospace"
                    className={tempColor(tx.temp, 170, 190)}>
                    <tspan fill={tx.temp >= 190 ? "#f87171" : tx.temp >= 170 ? "#fbbf24" : "#a78bfa"}>{tx.gear} {tx.temp}°F</tspan>
                  </text>

                  {/* Engine */}
                  <text x={left + 4} y={pos.y + 51} fill="#888" fontSize="6">Engine</text>
                  <text x={left + w - 4} y={pos.y + 51} textAnchor="end" fontSize="7" fontFamily="monospace">
                    <tspan fill="#60a5fa">{e.rpm}rpm</tspan>
                  </text>
                  {!isCenter && (
                    <>
                      <text x={left + 4} y={pos.y + 60} fill="#888" fontSize="6">Eng Temp</text>
                      <text x={left + w - 4} y={pos.y + 60} textAnchor="end" fontSize="7" fontFamily="monospace">
                        <tspan fill={e.temp >= 210 ? "#f87171" : e.temp >= 195 ? "#fbbf24" : "#60a5fa"}>{e.temp}°F</tspan>
                      </text>
                    </>
                  )}

                  {/* Thrust indicator arrow */}
                  {t.thrust > 10 && (
                    <line
                      x1={pos.x} y1={pos.y - 2}
                      x2={pos.x + Math.sin(t.angle * Math.PI / 180) * 15}
                      y2={pos.y - 2 - Math.cos(t.angle * Math.PI / 180) * (t.thrust / 100 * 15)}
                      stroke="#4ade80" strokeWidth="1.5" markerEnd="none" opacity={0.6}
                    />
                  )}
                </g>
              );
            });
          })()}

          {/* Engine Room label */}
          <text x="400" y="282" textAnchor="middle" fill="#333" fontSize="8" fontWeight="bold">ENGINE ROOM</text>
        </svg>
      </div>

      {/* Radar bar */}
      <div className="flex-shrink-0 bg-zinc-800/40 rounded-lg px-4 py-2 mt-3">
        <div className="flex items-center justify-center gap-6">
          <span className="text-[10px] text-zinc-500 uppercase font-semibold">Radar</span>
          {s.radarContacts.map(r => (
            <div key={r.id} className={`flex items-center gap-2 text-[11px] font-mono ${r.cpa < 1 ? "text-red-400" : "text-yellow-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${r.cpa < 1 ? "bg-red-400 animate-pulse" : "bg-yellow-400"}`} />
              <span>{r.bearing}°/{r.range}nm</span>
              <span className="text-zinc-500">{r.speed}kn</span>
              <span className={r.cpa < 1 ? "text-red-400 font-bold" : "text-zinc-400"}>CPA {r.cpa}nm</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<DemoState>(defaultState);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [keySteps, setKeySteps] = useState<KeyStep[]>([]);
  const [ship, setShip] = useState<ShipData | null>(null);
  const [ciphertext, setCiphertext] = useState("");
  const [connected, setConnected] = useState(false);
  const [showKeyExchange, setShowKeyExchange] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket; let timer: ReturnType<typeof setTimeout>;
    function connect() {
      ws = new WebSocket(`ws://${window.location.hostname}:3001`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); timer = setTimeout(connect, 2000); };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") setState(msg.state);
        if (msg.type === "log") setLogs(p => { const n = [...p, msg]; return n.length > 500 ? n.slice(-500) : n; });
        if (msg.type === "keyexchange") setKeySteps(msg.steps);
        if (msg.type === "ship") { setShip(msg.ship); setCiphertext(msg.ciphertext); }
      };
    }
    connect();
    return () => { clearTimeout(timer); ws?.close(); };
  }, []);

  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [logs, keySteps]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && !e.repeat) { e.preventDefault(); fetch("/api/ping", { method: "POST" }); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold"><span className="text-indigo-400">PQXDH</span> USV Telemetry</h1>
            <Link href="/explain" className="text-[10px] text-indigo-400 hover:text-indigo-300">How it works &rarr;</Link>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className={state.usvConnected ? "text-blue-400" : "text-zinc-600"}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${state.usvConnected ? "bg-blue-400" : "bg-zinc-700"}`} />USV
            </span>
            <span className={state.gndConnected ? "text-emerald-400" : "text-zinc-600"}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${state.gndConnected ? "bg-emerald-400" : "bg-zinc-700"}`} />GND
            </span>
            <Separator orientation="vertical" className="h-3.5 bg-zinc-700" />
            {state.handshakeMode === "hybrid" && <Badge variant="outline" className="text-[9px] border-emerald-800 text-emerald-400 py-0">QUANTUM-RESISTANT</Badge>}
            <span className="text-zinc-600">TX:{state.pingCount}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
          </div>
        </div>
      </header>

      {/* Main Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Ship */}
        <div className="flex-1 p-3 overflow-hidden">
          <ShipView ship={ship} />
        </div>

        {/* RIGHT: Log + Controls */}
        <div className="w-[600px] border-l border-zinc-800 flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 flex-shrink-0">
            {state.handshakeState === "established" ? (
              <>
                <button onClick={() => fetch("/api/ping", { method: "POST" })}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium rounded transition-colors">
                  Send Telemetry
                </button>
                <span className="text-zinc-600 text-[9px]">Space</span>
              </>
            ) : (
              <span className="text-zinc-500 text-[10px]">Waiting for handshake...</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowKeyExchange(!showKeyExchange)}
                className="px-2 py-1 text-[9px] text-zinc-400 border border-zinc-700 rounded hover:bg-zinc-800 transition-colors">
                {showKeyExchange ? "Live Log" : "Key Exchange"}
              </button>
              <button onClick={() => { fetch("/api/reset", { method: "POST" }); setLogs([]); setKeySteps([]); setShip(null); setCiphertext(""); }}
                className="px-2 py-1 text-[9px] text-red-400 border border-red-800 rounded hover:bg-red-950 transition-colors">
                Reset Demo
              </button>
            </div>
          </div>

          {/* Eve intercept */}
          {ciphertext && (
            <div className="px-3 py-2 border-b border-red-900/30 bg-red-950/10 flex-shrink-0">
              <p className="text-[9px] text-red-400 uppercase font-semibold mb-0.5">Eve intercept</p>
              <p className="text-[9px] text-red-300/30 font-mono break-all leading-tight">{ciphertext}</p>
            </div>
          )}

          <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-2">
            {(showKeyExchange ? keySteps : logs).length === 0 ? (
              <p className="text-zinc-600 text-xs mt-2">Waiting...</p>
            ) : (
              (showKeyExchange ? keySteps : logs).map((e, i) => (
                <div key={i} className="py-px text-[11px] leading-relaxed">
                  <span className="text-zinc-700 mr-1.5">{e.ts}</span>
                  <span className={srcColor[e.source] || "text-zinc-400"}>{e.text}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
