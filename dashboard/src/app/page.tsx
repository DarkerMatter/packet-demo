"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  ts: string;
  source: string;
  text: string;
}

interface DemoState {
  usvConnected: boolean;
  gndConnected: boolean;
  handshakeState: string;
  handshakeMode: string;
  pingCount: number;
  pongCount: number;
  usvIp: string;
  gndIp: string;
  lastActivity: string;
}

const defaultState: DemoState = {
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

function StatusDot({ active, color = "green", pulse = false }: { active: boolean; color?: string; pulse?: boolean }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-400 shadow-emerald-400/50",
    yellow: "bg-amber-400 shadow-amber-400/50",
    red: "bg-red-400 shadow-red-400/50",
    blue: "bg-blue-400 shadow-blue-400/50",
    gray: "bg-zinc-600",
  };
  const c = active ? colors[color] || colors.green : colors.gray;
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full shadow-sm ${c} ${pulse ? "animate-pulse" : ""}`} />
  );
}

function HandshakeStatus({ state }: { state: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    idle: { label: "Idle", variant: "secondary" },
    waiting: { label: "Waiting", variant: "outline" },
    bundle_sent: { label: "Bundle Sent", variant: "outline" },
    handshaking: { label: "Handshaking", variant: "default" },
    established: { label: "Established", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const info = map[state] || map.idle;
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

const sourceColors: Record<string, string> = {
  usv: "text-blue-400",
  gnd: "text-emerald-400",
  eve: "text-red-400 font-bold",
  system: "text-zinc-500",
};

export default function Home() {
  const [state, setState] = useState<DemoState>(defaultState);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(`ws://${window.location.hostname}:3001`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") setState(msg.state);
        if (msg.type === "log") {
          setLogs((prev) => {
            const next = [...prev, { ts: msg.ts, source: msg.source, text: msg.text }];
            return next.length > 500 ? next.slice(-500) : next;
          });
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Keyboard trigger: Space or Enter sends a ping
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        fetch("/api/ping", { method: "POST" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              <span className="text-indigo-400">PQXDH</span> Demo
            </h1>
            <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
              Post-Quantum Key Exchange
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <StatusDot active={state.usvConnected} color="blue" />
              <span className="text-zinc-400">USV</span>
              {state.usvIp && <span className="text-zinc-600 text-xs">{state.usvIp}</span>}
            </div>
            <div className="flex items-center gap-2">
              <StatusDot active={state.gndConnected} color="green" />
              <span className="text-zinc-400">Ground Station</span>
              {state.gndIp && <span className="text-zinc-600 text-xs">{state.gndIp}</span>}
            </div>
            <Separator orientation="vertical" className="h-5 bg-zinc-700" />
            <div className="flex items-center gap-2">
              <StatusDot
                active={connected}
                color={connected ? "green" : "red"}
              />
              <span className="text-zinc-500 text-xs">
                {connected ? "Live" : "Reconnecting..."}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Handshake
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <StatusDot
                  active={state.handshakeState === "established"}
                  color={state.handshakeState === "failed" ? "red" : state.handshakeState === "handshaking" ? "yellow" : "green"}
                  pulse={state.handshakeState === "handshaking"}
                />
                <HandshakeStatus state={state.handshakeState} />
              </div>
              {state.handshakeMode !== "unknown" && (
                <p className="text-xs text-zinc-500 mt-2">
                  {state.handshakeMode === "hybrid"
                    ? "X25519 + ML-KEM-768"
                    : "X25519 only (classical)"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Encrypted Pings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-100">{state.pingCount}</p>
              <p className="text-xs text-zinc-500 mt-1">USV &rarr; Ground Station</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Encrypted Pongs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-100">{state.pongCount}</p>
              <p className="text-xs text-zinc-500 mt-1">Ground Station &rarr; USV</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Last Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium text-zinc-300">
                {state.lastActivity || "--"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {state.handshakeState === "established"
                  ? "Secure channel active"
                  : "Waiting for connection"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Send Ping Button */}
        {state.handshakeState === "established" && (
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => fetch("/api/ping", { method: "POST" })}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
            >
              Send Encrypted Ping
            </button>
            <span className="text-zinc-500 text-sm">or press Space / Enter</span>
          </div>
        )}

        {/* Log Feed */}
        <Card className="mt-6 bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Live Log
              </CardTitle>
              <div className="flex gap-4 text-xs">
                <span className="text-blue-400">USV</span>
                <span className="text-emerald-400">Ground Station</span>
                <span className="text-red-400">Eve (Adversary)</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="h-[400px] overflow-y-auto px-4 pb-4"
            >
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Waiting for serial data...
                </div>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="py-0.5 text-[13px] leading-relaxed">
                    <span className="text-zinc-600 mr-2">{entry.ts}</span>
                    <span className={sourceColors[entry.source] || "text-zinc-400"}>
                      {entry.text}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
