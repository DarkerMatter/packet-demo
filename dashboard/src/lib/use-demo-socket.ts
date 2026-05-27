// dashboard/src/lib/use-demo-socket.ts
"use client";
import { useEffect, useState } from "react";
import type { Valve } from "./valves";

export interface LogEntry { ts: string; source: string; text: string }
export interface KeyStep { ts: string; source: string; text: string }

export interface ShipData {
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

export interface DemoState {
  usvConnected: boolean; gndConnected: boolean;
  handshakeState: string; handshakeMode: string;
  pingCount: number; pongCount: number; lastActivity: string;
}

export const defaultState: DemoState = {
  usvConnected: false, gndConnected: false, handshakeState: "idle",
  handshakeMode: "unknown", pingCount: 0, pongCount: 0, lastActivity: "",
};

export interface ScenarioStatus { name: string | null; running: boolean }

export function useDemoSocket() {
  const [state, setState] = useState<DemoState>(defaultState);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [keySteps, setKeySteps] = useState<KeyStep[]>([]);
  const [ship, setShip] = useState<ShipData | null>(null);
  const [ciphertext, setCiphertext] = useState("");
  const [valves, setValves] = useState<Record<string, Valve>>({});
  const [scenario, setScenario] = useState<ScenarioStatus>({ name: null, running: false });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function connect() {
      ws = new WebSocket(`ws://${window.location.hostname}:3001`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); timer = setTimeout(connect, 2000); };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") setState(msg.state);
        else if (msg.type === "log") setLogs(p => { const n = [...p, msg]; return n.length > 500 ? n.slice(-500) : n; });
        else if (msg.type === "keyexchange") setKeySteps(msg.steps);
        else if (msg.type === "ship") { setShip(msg.ship); setCiphertext(msg.ciphertext); }
        else if (msg.type === "valves:full") setValves(msg.valves);
        else if (msg.type === "valves:patch") setValves(p => p[msg.id] ? { ...p, [msg.id]: { ...p[msg.id], ...msg.fields } } : p);
        else if (msg.type === "scenario") setScenario({ name: msg.name, running: msg.status === "started" });
      };
    }
    connect();
    return () => { if (timer) clearTimeout(timer); ws?.close(); };
  }, []);

  return { state, logs, keySteps, ship, ciphertext, valves, scenario, connected,
    resetLocal: () => { setLogs([]); setKeySteps([]); setShip(null); setCiphertext(""); } };
}
