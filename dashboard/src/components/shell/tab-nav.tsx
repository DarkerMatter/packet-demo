// dashboard/src/components/shell/tab-nav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Telemetry" },
  { href: "/valves", label: "Valves" },
  { href: "/explain", label: "Explain" },
];

export function TabNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {tabs.map(t => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href}
            className={
              "px-2.5 py-1 text-[11px] rounded transition-colors " +
              (active
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/60"
                : "text-zinc-500 hover:text-zinc-200 border border-transparent")
            }>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
