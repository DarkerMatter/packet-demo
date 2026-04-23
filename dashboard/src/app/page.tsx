"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface LogEntry { ts: string; source: string; text: string }
interface KeyStep { ts: string; source: string; text: string }
interface ShipData {
  nav: { lat: number; lon: number; sog: number; cog: number; heading: number; depth: number; rudder: number };
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
  pingCount: number; pongCount: number;
  lastActivity: string;
}

const defaultState: DemoState = {
  usvConnected: false, gndConnected: false,
  handshakeState: "idle", handshakeMode: "unknown",
  pingCount: 0, pongCount: 0, lastActivity: "",
};

function Dot({ on, color = "emerald", pulse = false }: { on: boolean; color?: string; pulse?: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${on ? `bg-${color}-400 shadow-sm shadow-${color}-400/50` : "bg-zinc-700"} ${pulse ? "animate-pulse" : ""}`} />;
}

const srcColor: Record<string, string> = {
  usv: "text-blue-400", gnd: "text-emerald-400", eve: "text-red-400 font-bold", system: "text-zinc-500",
};

// --- Ship SVG Diagram ---
function ShipDiagram({ ship, ciphertext }: { ship: ShipData | null; ciphertext: string }) {
  if (!ship) return <div className="flex items-center justify-center h-full text-zinc-600">Awaiting telemetry...</div>;
  const s = ship;

  return (
    <div className="h-full flex flex-col text-[11px] overflow-y-auto pr-1">
      {/* Nav Header */}
      <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Navigation</span>
          <span className="text-emerald-400 text-[10px]">ACTIVE</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><p className="text-zinc-500">LAT</p><p className="text-zinc-100 font-mono">{s.nav.lat.toFixed(4)}N</p></div>
          <div><p className="text-zinc-500">LON</p><p className="text-zinc-100 font-mono">{Math.abs(s.nav.lon).toFixed(4)}W</p></div>
          <div><p className="text-zinc-500">SOG</p><p className="text-zinc-100 font-mono">{s.nav.sog.toFixed(1)} kn</p></div>
          <div><p className="text-zinc-500">HDG</p><p className="text-zinc-100 font-mono">{s.nav.heading.toFixed(0)}°</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mt-2">
          <div><p className="text-zinc-500">COG</p><p className="text-zinc-100 font-mono">{s.nav.cog.toFixed(0)}°</p></div>
          <div><p className="text-zinc-500">DEPTH</p><p className="text-zinc-100 font-mono">{s.nav.depth.toFixed(1)}m</p></div>
          <div><p className="text-zinc-500">RUDDER</p><p className="text-zinc-100 font-mono">{s.nav.rudder.toFixed(0)}°</p></div>
        </div>
      </div>

      {/* Ship Top-Down SVG */}
      <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
        <svg viewBox="0 0 200 400" className="w-full max-w-[180px] mx-auto" style={{ height: 220 }}>
          {/* Hull */}
          <path d="M100,20 L140,60 L145,180 L140,300 L130,360 L100,380 L70,360 L60,300 L55,180 L60,60 Z"
            fill="none" stroke="#3f3f46" strokeWidth="2" />
          <path d="M100,20 L140,60 L145,180 L140,300 L130,360 L100,380 L70,360 L60,300 L55,180 L60,60 Z"
            fill="#18181b" opacity="0.5" />
          {/* Center line */}
          <line x1="100" y1="30" x2="100" y2="370" stroke="#27272a" strokeWidth="1" strokeDasharray="4,4" />

          {/* Bow label */}
          <text x="100" y="14" textAnchor="middle" fill="#52525b" fontSize="8">BOW</text>
          <text x="100" y="396" textAnchor="middle" fill="#52525b" fontSize="8">STERN</text>

          {/* Bow thruster */}
          <rect x="75" y="48" width="50" height="12" rx="2" fill="#1e1e2e" stroke="#4a4a5a" strokeWidth="0.5" />
          <text x="100" y="57" textAnchor="middle" fill="#71717a" fontSize="7">BOW THR</text>

          {/* Forward thrusters T1 (PS) T2 (SB) */}
          {[{ x: 65, t: s.thrusters[0] }, { x: 125, t: s.thrusters[1] }].map((d, i) => (
            <g key={`ft${i}`}>
              <rect x={d.x - 12} y="85" width="24" height="30" rx="2" fill={d.t.thrust > 50 ? "#1a2e1a" : "#1e1e2e"} stroke={d.t.thrust > 50 ? "#4ade80" : "#4a4a5a"} strokeWidth="0.5" />
              <text x={d.x} y="96" textAnchor="middle" fill="#a1a1aa" fontSize="6">{d.t.id.split("-")[0]}</text>
              <text x={d.x} y="108" textAnchor="middle" fill={d.t.thrust > 50 ? "#4ade80" : "#71717a"} fontSize="7">{d.t.thrust.toFixed(0)}%</text>
            </g>
          ))}

          {/* Engines E1-E5 in engine room */}
          {s.engines.map((e, i) => {
            const x = 70 + i * 15;
            const y = 190;
            return (
              <g key={e.id}>
                <rect x={x - 6} y={y} width="12" height="20" rx="1" fill={e.rpm > 0 ? "#1a1a2e" : "#1e1e1e"} stroke={e.rpm > 0 ? "#60a5fa" : "#333"} strokeWidth="0.5" />
                <text x={x} y={y + 8} textAnchor="middle" fill="#71717a" fontSize="5">{e.id}</text>
                <text x={x} y={y + 16} textAnchor="middle" fill={e.rpm > 0 ? "#60a5fa" : "#444"} fontSize="5">{e.rpm}</text>
              </g>
            );
          })}
          <text x="100" y="185" textAnchor="middle" fill="#52525b" fontSize="6">ENGINE ROOM</text>

          {/* Generators */}
          {s.generators.map((g, i) => {
            const x = 78 + i * 22;
            return (
              <g key={g.id}>
                <rect x={x - 8} y="240" width="16" height="16" rx="1" fill={g.kw > 0 ? "#2e1a2e" : "#1e1e1e"} stroke={g.kw > 0 ? "#c084fc" : "#333"} strokeWidth="0.5" />
                <text x={x} y="250" textAnchor="middle" fill={g.kw > 0 ? "#c084fc" : "#444"} fontSize="5">{g.id.replace("GEN","G")}</text>
                <text x={x} y="258" textAnchor="middle" fill={g.kw > 0 ? "#c084fc" : "#444"} fontSize="4">{g.kw}kW</text>
              </g>
            );
          })}

          {/* Aft thrusters T3 (PS) T4 (SB) T5 (CTR) */}
          {[{ x: 68, t: s.thrusters[2] }, { x: 100, t: s.thrusters[4] }, { x: 132, t: s.thrusters[3] }].map((d, i) => (
            <g key={`at${i}`}>
              <rect x={d.x - 10} y="310" width="20" height="26" rx="2" fill={d.t.thrust > 50 ? "#1a2e1a" : "#1e1e2e"} stroke={d.t.thrust > 50 ? "#4ade80" : "#4a4a5a"} strokeWidth="0.5" />
              <text x={d.x} y="320" textAnchor="middle" fill="#a1a1aa" fontSize="5">{d.t.id.split("-")[0]}</text>
              <text x={d.x} y="330" textAnchor="middle" fill={d.t.thrust > 50 ? "#4ade80" : "#71717a"} fontSize="6">{d.t.thrust.toFixed(0)}%</text>
            </g>
          ))}

          {/* Fire zones */}
          {s.fire.zones.map((z, i) => (
            <circle key={`fire${i}`} cx={72 + i * 12} cy="280" r="3" fill={z > 0 ? "#ef4444" : "#1a1a1a"} stroke={z > 0 ? "#ef4444" : "#333"} strokeWidth="0.5" />
          ))}
          <text x="100" y="276" textAnchor="middle" fill="#52525b" fontSize="5">FIRE ZONES</text>
        </svg>
      </div>

      {/* Systems Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Engines Summary */}
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-zinc-500 text-[10px] uppercase mb-1">Engines</p>
          {s.engines.map(e => (
            <div key={e.id} className="flex justify-between text-[10px]">
              <span className="text-zinc-500">{e.id}</span>
              <span className="text-blue-400 font-mono">{e.rpm}rpm {e.temp}°F</span>
            </div>
          ))}
        </div>
        {/* Generators */}
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-zinc-500 text-[10px] uppercase mb-1">Generators</p>
          {s.generators.map(g => (
            <div key={g.id} className="flex justify-between text-[10px]">
              <span className="text-zinc-500">{g.id}</span>
              <span className={`font-mono ${g.kw > 0 ? "text-purple-400" : "text-zinc-600"}`}>{g.kw > 0 ? `${g.kw}kW ${g.voltage}V` : "OFF"}</span>
            </div>
          ))}
        </div>
        {/* HVAC */}
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-zinc-500 text-[10px] uppercase mb-1">HVAC</p>
          {s.hvac.map(h => (
            <div key={h.id} className="flex justify-between text-[10px]">
              <span className="text-zinc-500">{h.id.replace("HVAC-","")}</span>
              <span className="text-cyan-400 font-mono">{h.zoneTemp}°F/{h.setpoint}°F {h.mode}</span>
            </div>
          ))}
        </div>
        {/* Waste */}
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-zinc-500 text-[10px] uppercase mb-1">Waste Systems</p>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Gray</span>
            <span className="text-amber-400 font-mono">{s.waste.grayLevel.toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Black</span>
            <span className="text-amber-400 font-mono">{s.waste.blackLevel.toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Fire Agent</span>
            <span className="text-emerald-400 font-mono">{s.fire.agentLevel}%</span>
          </div>
        </div>
      </div>

      {/* Radar Contacts */}
      <div className="bg-zinc-800/50 rounded-lg p-2 mb-3">
        <p className="text-zinc-500 text-[10px] uppercase mb-1">Radar Contacts</p>
        <div className="grid grid-cols-4 text-[9px] text-zinc-600 mb-0.5">
          <span>ID</span><span>BRG/RNG</span><span>SPD</span><span>CPA</span>
        </div>
        {s.radarContacts.map(r => (
          <div key={r.id} className="grid grid-cols-4 text-[10px]">
            <span className={`font-mono ${r.cpa < 1 ? "text-red-400" : "text-yellow-400"}`}>{r.id}</span>
            <span className="text-zinc-300 font-mono">{r.bearing}°/{r.range}nm</span>
            <span className="text-zinc-300 font-mono">{r.speed}kn</span>
            <span className={`font-mono ${r.cpa < 1 ? "text-red-400" : "text-zinc-300"}`}>{r.cpa}nm</span>
          </div>
        ))}
      </div>

      {/* Eve's encrypted view */}
      {ciphertext && (
        <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-2">
          <p className="text-red-400 text-[10px] uppercase mb-1">Eve sees:</p>
          <p className="text-red-300/40 text-[9px] font-mono break-all leading-tight">{ciphertext}</p>
        </div>
      )}
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
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    function connect() {
      ws = new WebSocket(`ws://${window.location.hostname}:3001`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); timer = setTimeout(connect, 2000); };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") setState(msg.state);
        if (msg.type === "log") setLogs(prev => {
          const next = [...prev, { ts: msg.ts, source: msg.source, text: msg.text }];
          return next.length > 500 ? next.slice(-500) : next;
        });
        if (msg.type === "keyexchange") setKeySteps(msg.steps);
        if (msg.type === "ship") { setShip(msg.ship); setCiphertext(msg.ciphertext); }
      };
    }
    connect();
    return () => { clearTimeout(timer); ws?.close(); };
  }, []);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && !e.repeat) {
        e.preventDefault();
        fetch("/api/ping", { method: "POST" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const hsLabels: Record<string, string> = {
    idle: "Idle", waiting: "Waiting", bundle_sent: "Bundle Sent",
    handshaking: "Handshaking...", established: "Established", failed: "Failed",
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              <span className="text-indigo-400">PQXDH</span> USV Demo
            </h1>
            <Link href="/explain" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              How it works &rarr;
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span className={`flex items-center gap-1.5 ${state.usvConnected ? "text-blue-400" : "text-zinc-600"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${state.usvConnected ? "bg-blue-400" : "bg-zinc-700"}`} /> USV
              </span>
              <span className={`flex items-center gap-1.5 ${state.gndConnected ? "text-emerald-400" : "text-zinc-600"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${state.gndConnected ? "bg-emerald-400" : "bg-zinc-700"}`} /> GND
              </span>
            </div>
            <Separator orientation="vertical" className="h-4 bg-zinc-700" />
            <span className="text-zinc-500">{hsLabels[state.handshakeState]}</span>
            {state.handshakeMode === "hybrid" && <Badge variant="outline" className="text-[10px] border-emerald-800 text-emerald-400">ML-KEM-768</Badge>}
            <Separator orientation="vertical" className="h-4 bg-zinc-700" />
            <span className="text-zinc-600">TX:{state.pingCount} RX:{state.pongCount}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
          </div>
        </div>
      </header>

      {/* Main Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Logs + Controls */}
        <div className="w-1/2 border-r border-zinc-800 flex flex-col">
          {/* Controls */}
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-3 flex-shrink-0">
            {state.handshakeState === "established" && (
              <>
                <button
                  onClick={() => fetch("/api/ping", { method: "POST" })}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors"
                >
                  Send Telemetry
                </button>
                <span className="text-zinc-600 text-[10px]">or Space</span>
              </>
            )}
            <div className="ml-auto">
              <button
                onClick={() => setShowKeyExchange(!showKeyExchange)}
                className="px-3 py-1.5 text-[10px] font-medium text-zinc-400 border border-zinc-700 rounded hover:bg-zinc-800 transition-colors"
              >
                {showKeyExchange ? "Show Live Log" : "Key Exchange"}
              </button>
            </div>
          </div>

          {/* Log or Key Exchange */}
          <div ref={logContainerRef} className="flex-1 overflow-y-auto px-4 py-2">
            {showKeyExchange ? (
              keySteps.length === 0 ? (
                <p className="text-zinc-600 text-sm mt-4">Waiting for handshake...</p>
              ) : (
                keySteps.map((step, i) => (
                  <div key={i} className="py-0.5 text-[12px] leading-relaxed">
                    <span className="text-zinc-600 mr-2">{step.ts}</span>
                    <span className={srcColor[step.source] || "text-zinc-400"}>{step.text}</span>
                  </div>
                ))
              )
            ) : (
              logs.length === 0 ? (
                <p className="text-zinc-600 text-sm mt-4">Waiting for data...</p>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="py-0.5 text-[12px] leading-relaxed">
                    <span className="text-zinc-600 mr-2">{entry.ts}</span>
                    <span className={srcColor[entry.source] || "text-zinc-400"}>{entry.text}</span>
                  </div>
                ))
              )
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* RIGHT: Ship Diagram */}
        <div className="w-1/2 p-4 overflow-hidden">
          <ShipDiagram ship={ship} ciphertext={ciphertext} />
        </div>
      </div>
    </div>
  );
}
