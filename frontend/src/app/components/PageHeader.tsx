export function PageHeader({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: "linear-gradient(180deg, #d4a017, #1a3a6b)" }} />
      <div className="relative flex items-center gap-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-[#f3d27a] shadow-md shadow-[#1a3a6b]/25"
          style={{ background: "linear-gradient(135deg, #24508f 0%, #0d2244 100%)" }}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="relative flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
