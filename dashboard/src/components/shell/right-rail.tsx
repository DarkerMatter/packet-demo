// dashboard/src/components/shell/right-rail.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { LogEntry, KeyStep } from "@/lib/use-demo-socket";

const srcColor: Record<string, string> = {
  usv: "text-blue-400", gnd: "text-emerald-400", eve: "text-red-400 font-bold", system: "text-zinc-500",
};

interface RightRailProps {
  logs: LogEntry[];
  keySteps: KeyStep[];
  ciphertext: string;
  handshakeEstablished: boolean;
  pingCount: number;
  connected: boolean;
  actionSlot?: React.ReactNode;
  onReset: () => void;
}

export function RightRail({ logs, keySteps, ciphertext, handshakeEstablished, pingCount, connected, actionSlot, onReset }: RightRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showKeyExchange, setShowKeyExchange] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Restore collapse state from localStorage on first mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem("packet-rail-collapsed");
    if (v === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("packet-rail-collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [logs, keySteps]);

  if (collapsed) {
    return (
      <div className="w-10 border-l border-zinc-800 flex flex-col items-center py-3 gap-3 flex-shrink-0 transition-[width] duration-200">
        <button onClick={() => setCollapsed(false)} title="Expand packet log"
          className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">‹</button>
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
        <span className="text-[9px] text-zinc-500 [writing-mode:vertical-rl] rotate-180">TX:{pingCount}</span>
      </div>
    );
  }

  return (
    <div className="w-[600px] border-l border-zinc-800 flex flex-col flex-shrink-0 transition-[width] duration-200 relative">
      <button onClick={() => setCollapsed(true)} title="Collapse packet log"
        className="absolute -left-3 top-3 z-10 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-xs flex items-center justify-center">›</button>

      <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 flex-shrink-0">
        {handshakeEstablished ? (
          actionSlot
        ) : (
          <span className="text-zinc-500 text-[10px]">Waiting for handshake...</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowKeyExchange(!showKeyExchange)}
            className="px-2 py-1 text-[9px] text-zinc-400 border border-zinc-700 rounded hover:bg-zinc-800 transition-colors">
            {showKeyExchange ? "Live Log" : "Key Exchange"}
          </button>
          <button onClick={onReset}
            className="px-2 py-1 text-[9px] text-red-400 border border-red-800 rounded hover:bg-red-950 transition-colors">
            Reset Demo
          </button>
        </div>
      </div>

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
      </div>
    </div>
  );
}
