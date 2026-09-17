export function StatCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
      </div>
      <div className="text-3xl font-bold text-foreground mb-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</div>
      <div className="text-base text-muted-foreground">{label}</div>
    </div>
  );
}
