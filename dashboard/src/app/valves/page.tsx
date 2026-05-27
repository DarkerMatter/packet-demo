// dashboard/src/app/valves/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TabNav } from "@/components/shell/tab-nav";
import { RightRail } from "@/components/shell/right-rail";
import { useDemoSocket } from "@/lib/use-demo-socket";
import { systems, systemOrder } from "@/lib/valves";
import type { SystemId, Valve as ValveData } from "@/lib/valves/types";
import { Tank } from "@/components/pid/tank";
import { Pump } from "@/components/pid/pump";
import { Pipe } from "@/components/pid/pipe";
import { Valve } from "@/components/pid/valve";

function systemStatus(sid: SystemId, valves: Record<string, ValveData>) {
  const ids = systems[sid].initialValves.map(v => v.id);
  const live = ids.map(id => valves[id]).filter(Boolean);
  if (live.length === 0) return "unknown";
  if (live.some(v => v.fault)) return "fault";
  // amber if any throttled
  if (live.some(v => v.state === "throttled")) return "throttled";
  return "ok";
}

const statusDot = (s: string) =>
  s === "fault" ? "bg-red-500" :
  s === "throttled" ? "bg-amber-400" :
  s === "unknown" ? "bg-zinc-600" :
  "bg-emerald-500";

const scenarioButtons = [
  { name: "fuel-transfer", label: "Fuel Transfer" },
  { name: "engine-start", label: "Engine Start" },
  { name: "fire-drill", label: "Fire Drill" },
  { name: "bilge-pumpout", label: "Bilge Pump-out" },
];

export default function ValvesPage() {
  const sock = useDemoSocket();
  const [selected, setSelected] = useState<SystemId>("fuel");
  const [hoveredValve, setHoveredValve] = useState<string | null>(null);

  // Auto-switch sidebar to the system being acted on during a scenario
  useEffect(() => {
    if (!sock.scenario.running) return;
    if (sock.scenario.name === "fire-drill") setSelected("fire-main");
  }, [sock.scenario]);

  const sys = systems[selected];
  const handshakeEstablished = sock.state.handshakeState === "established";
  const valves = sock.valves;

  const flowingByPipeIdx = useMemo(() => {
    return sys.pipes.map(p => {
      if (!p.gatedBy) return true;
      const v = valves[p.gatedBy];
      return !!v && v.state !== "closed";
    });
  }, [sys, valves]);

  function handleValveClick(v: ValveData) {
    if (!handshakeEstablished) return;
    if (v.kind === "check") return;
    if (v.kind === "globe") {
      const next = window.prompt(`Throttle ${v.id} (${v.name}) to %`, String(v.position));
      if (next === null) return;
      const pos = Math.max(0, Math.min(100, Number(next)));
      if (Number.isNaN(pos)) return;
      fetch(`/api/valve/${v.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ position: pos }) });
      return;
    }
    // gate/ball toggle
    const nextState = v.state === "open" ? "closed" : "open";
    fetch(`/api/valve/${v.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: nextState }) });
  }

  function runScenario(name: string) {
    if (!handshakeEstablished || sock.scenario.running) return;
    fetch(`/api/scenario/${name}`, { method: "POST" });
  }

  const hoveredV = hoveredValve ? valves[hoveredValve] : null;

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col overflow-hidden">
      <header className="border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold"><span className="text-indigo-400">PQXDH</span> Valve Operations</h1>
            <TabNav />
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className={sock.state.usvConnected ? "text-blue-400" : "text-zinc-600"}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${sock.state.usvConnected ? "bg-blue-400" : "bg-zinc-700"}`} />USV
            </span>
            <span className={sock.state.gndConnected ? "text-emerald-400" : "text-zinc-600"}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${sock.state.gndConnected ? "bg-emerald-400" : "bg-zinc-700"}`} />GND
            </span>
            <Separator orientation="vertical" className="h-3.5 bg-zinc-700" />
            {sock.state.handshakeMode === "hybrid" && <Badge variant="outline" className="text-[9px] border-emerald-800 text-emerald-400 py-0">QUANTUM-RESISTANT</Badge>}
            <span className="text-zinc-600">TX:{sock.state.pingCount}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${sock.connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[200px] border-r border-zinc-800 flex-shrink-0 overflow-y-auto py-2">
          <p className="px-3 py-1 text-[9px] text-zinc-600 uppercase">Systems</p>
          {systemOrder.map(sid => {
            const meta = systems[sid].meta;
            const count = systems[sid].initialValves.length;
            const status = systemStatus(sid, valves);
            const active = sid === selected;
            return (
              <button key={sid} onClick={() => setSelected(sid)}
                className={
                  "w-full text-left px-3 py-1.5 flex items-center gap-2 border-l-2 transition-colors " +
                  (active
                    ? "bg-zinc-800/40 border-indigo-500"
                    : "border-transparent hover:bg-zinc-900/60")
                }>
                <span className={`h-2 w-2 rounded-full ${statusDot(status)}`} />
                <span className={`flex-1 text-[11px] ${meta.accent}`}>{meta.label}</span>
                <span className="text-[10px] text-zinc-500">{count}</span>
              </button>
            );
          })}
        </aside>

        {/* Focused panel */}
        <div className="flex-1 p-3 overflow-hidden flex flex-col">
          {/* Scenario row */}
          <div className="flex-shrink-0 flex items-center gap-2 mb-2">
            {scenarioButtons.map(b => {
              const disabled = !handshakeEstablished || sock.scenario.running;
              const active = sock.scenario.running && sock.scenario.name === b.name;
              return (
                <button key={b.name} onClick={() => runScenario(b.name)} disabled={disabled}
                  className={
                    "px-3 py-1 text-[10px] font-medium rounded transition-colors " +
                    (active ? "bg-indigo-500 text-white animate-pulse border border-indigo-300"
                      : disabled ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white")
                  }>
                  {b.label}
                </button>
              );
            })}
            {!handshakeEstablished && <span className="text-zinc-500 text-[10px] ml-2">Waiting for handshake...</span>}
          </div>

          {/* P&ID */}
          <div className="flex-1 bg-zinc-900/40 rounded-lg p-2 overflow-hidden relative">
            <p className="absolute top-2 left-3 text-[10px] uppercase font-semibold" style={{ color: sys.meta.pipeColor }}>{sys.meta.label}</p>
            <svg viewBox={`0 0 ${sys.viewBox.w} ${sys.viewBox.h}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              {sys.pipes.map((p, i) => <Pipe key={i} seg={p} flowing={flowingByPipeIdx[i]} accent={sys.meta.pipeColor} />)}
              {sys.tanks.map(t => <Tank key={t.id} tank={t} accent={sys.meta.pipeColor} />)}
              {sys.pumps.map(pp => <Pump key={pp.id} pump={pp} accent={sys.meta.pipeColor} />)}
              {sys.consumers.map(c => (
                <g key={c.id}>
                  <rect x={c.pos.x} y={c.pos.y} width={c.width ?? 70} height={c.height ?? 40} rx="3"
                    fill="#0a0a14" stroke="#60a5fa" strokeWidth="0.8" />
                  <text x={c.pos.x + (c.width ?? 70) / 2} y={c.pos.y + (c.height ?? 40) / 2 + 4} textAnchor="middle"
                    fill="#60a5fa" fontSize="11" fontFamily="monospace">{c.label}</text>
                </g>
              ))}
              {sys.valves.map(placement => {
                const v = valves[placement.id];
                if (!v) return null;
                return (
                  <Valve key={placement.id} placement={placement} v={v} enabled={handshakeEstablished}
                    onClick={handleValveClick}
                    hovered={hoveredValve === placement.id}
                    onHover={setHoveredValve} />
                );
              })}
            </svg>
            {hoveredV && (
              <div className="absolute bottom-3 right-3 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-[10px] font-mono shadow">
                <div className="text-zinc-300">{hoveredV.id} <span className="text-zinc-500">{hoveredV.name}</span></div>
                <div className="text-zinc-500">{hoveredV.kind} · <span className={
                  hoveredV.state === "open" ? "text-emerald-400" :
                  hoveredV.state === "closed" ? "text-zinc-400" :
                  hoveredV.state === "throttled" ? "text-amber-400" : ""
                }>{hoveredV.state}</span> · {hoveredV.position}%</div>
              </div>
            )}
          </div>
        </div>

        <RightRail
          logs={sock.logs}
          keySteps={sock.keySteps}
          ciphertext={sock.ciphertext}
          handshakeEstablished={handshakeEstablished}
          pingCount={sock.state.pingCount}
          connected={sock.connected}
          onReset={() => { fetch("/api/reset", { method: "POST" }); sock.resetLocal(); }}
        />
      </div>
    </div>
  );
}
