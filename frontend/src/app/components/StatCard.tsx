// Accent gradient is picked from the tint class callers already pass (e.g. "bg-amber-50").
const ACCENTS: [string, string][] = [
  ["amber", "linear-gradient(90deg, #f59e0b, #fbbf24)"],
  ["indigo", "linear-gradient(90deg, #4f46e5, #818cf8)"],
  ["emerald", "linear-gradient(90deg, #059669, #34d399)"],
  ["green", "linear-gradient(90deg, #16a34a, #4ade80)"],
  ["red", "linear-gradient(90deg, #dc2626, #f87171)"],
];
const DEFAULT_ACCENT = "linear-gradient(90deg, #1a3a6b, #3b6fb6)";

export function StatCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }) {
  const accent = ACCENTS.find(([key]) => color.includes(key))?.[1] ?? DEFAULT_ACCENT;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1a3a6b]/10">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-110 ${color}`}>{icon}</div>
        {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
      </div>
      <div className="mt-3 text-4xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</div>
      <div className="mt-0.5 text-sm font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}
