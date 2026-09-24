import { CalendarDays } from "lucide-react";

export type HeroAction = { label: string; icon?: React.ReactNode; onClick: () => void; primary?: boolean };

export function DashboardHero({ eyebrow, title, subtitle, actions = [] }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: HeroAction[];
}) {
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-8 py-7 text-white shadow-lg"
      style={{ background: "linear-gradient(120deg, #0d2244 0%, #1a3a6b 55%, #24508f 100%)" }}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(212,160,23,0.35) 0%, rgba(212,160,23,0) 70%)" }} />
      <img
        src="/seals/barangay-campagao.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-6 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full object-cover opacity-[0.12] mix-blend-luminosity"
      />
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: "linear-gradient(90deg, #d4a017, rgba(212,160,23,0.2) 60%, transparent)" }} />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#f3d27a]">
            {eyebrow}
          </div>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h2>
          <p className="mt-1.5 text-base text-blue-100/90">{subtitle}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-200">
            <CalendarDays size={14} /> {today}
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                  a.primary
                    ? "bg-[#d4a017] text-[#0f1c2e] shadow-md shadow-black/20 hover:bg-[#e0ae26]"
                    : "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
