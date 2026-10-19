import { useEffect, useState } from "react";
import { BarChart2, CheckCircle, Download, TrendingUp, Wallet, HandCoins, CalendarCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "./PageHeader";
import { StatCard } from "./StatCard";
import { api } from "../lib/api";
import type { ApiRequest, ReportsSummary } from "../lib/api";

const HEADING = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const TOOLTIP_STYLE = { borderRadius: "10px", border: "1px solid #dde3ed", fontSize: "13px" };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function exportRequestsCsv(requests: ApiRequest[], period: string, date: string) {
  const header = "ID,Resident,Document,Source,Encoded By,Status,Fee,Paid,Submitted,Updated\n";
  const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = requests
    .map((r) => [r.id, r.residentName, r.docType, r.source || "Online", r.encodedByName || "", r.status, r.fee, r.paid, r.submittedAt, r.updatedAt].map(csvCell).join(","))
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `barangay-requests-${period}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({ requests }: { requests: ApiRequest[] }) {
  const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filteredReports, setFilteredReports] = useState<ReportsSummary | null>(null);
  const [reportsError, setReportsError] = useState("");
  const [reportsLoading, setReportsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const reportDate = period === "daily" ? selectedDate.slice(0, 10) : period === "monthly" ? selectedDate.slice(0, 7) : selectedDate.slice(0, 4);
  const [selectedYear, selectedMonth, selectedDay] = selectedDate.split("-").map(Number);
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const periodLabel = period === "daily"
    ? new Date(`${reportDate}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
    : period === "monthly"
    ? new Date(`${reportDate}-01T00:00:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" })
    : reportDate;
  const reports = filteredReports;
  const byDocTotal = (reports?.revenueByDocType ?? []).reduce((total, item) => total + item.total, 0);

  useEffect(() => {
    let active = true;
    setReportsLoading(true);
    setReportsError("");
    api.reportsSummary(period, reportDate)
      .then((result) => { if (active) setFilteredReports(result); })
      .catch((error: unknown) => {
        if (active) {
          setFilteredReports(null);
          setReportsError(error instanceof Error ? error.message : "Unable to load the report.");
        }
      })
      .finally(() => { if (active) setReportsLoading(false); });
    return () => { active = false; };
  }, [period, reportDate, retryCount]);

  const periodRequests = requests.filter((request) => request.submittedAt.slice(0, period === "daily" ? 10 : period === "monthly" ? 7 : 4) === reportDate);
  function updatePeriod(next: "daily" | "monthly" | "yearly") {
    setPeriod(next);
  }

  function updateDatePart(part: "day" | "month" | "year", value: number) {
    let year = selectedYear;
    let month = selectedMonth;
    let day = selectedDay;
    if (part === "day") day = value;
    if (part === "month") month = value;
    if (part === "year") year = value;
    day = Math.min(day, new Date(year, month, 0).getDate());
    setSelectedDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader icon={<BarChart2 size={22} />} title="Reports & Analytics" subtitle={`Barangay Campagao · ${periodLabel}`}>
        <label className="text-sm font-semibold text-muted-foreground">Period
          <select value={period} onChange={(event) => updatePeriod(event.target.value as "daily" | "monthly" | "yearly")} className="ml-2 rounded-lg border border-border bg-white px-3 py-2.5 text-foreground">
            <option value="daily">Daily</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-muted-foreground">Day
          <select disabled={period !== "daily"} value={selectedDay} onChange={(event) => updateDatePart("day", Number(event.target.value))} className="ml-2 rounded-lg border border-border bg-white px-3 py-2.5 text-foreground disabled:bg-slate-100 disabled:text-muted-foreground">
            {Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-muted-foreground">Month
          <select disabled={period === "yearly"} value={selectedMonth} onChange={(event) => updateDatePart("month", Number(event.target.value))} className="ml-2 rounded-lg border border-border bg-white px-3 py-2.5 text-foreground disabled:bg-slate-100 disabled:text-muted-foreground">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{new Date(2000, month - 1, 1).toLocaleDateString("en-PH", { month: "long" })}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-muted-foreground">Year
          <select value={selectedYear} onChange={(event) => updateDatePart("year", Number(event.target.value))} className="ml-2 rounded-lg border border-border bg-white px-3 py-2.5 text-foreground">
            {Array.from({ length: 21 }, (_, index) => 2020 + index).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <button onClick={() => exportRequestsCsv(periodRequests, period, reportDate)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
          <Download size={16} /> Export Report
        </button>
      </PageHeader>

      {reportsLoading ? (
        <div className="ui-card p-10 text-center text-base text-muted-foreground">Loading reports...</div>
      ) : reportsError ? (
        <div role="alert" className="ui-card p-8 text-center">
          <p className="font-semibold text-foreground">Could not load this report</p>
          <p className="mt-2 text-sm text-muted-foreground">{reportsError}</p>
          <button onClick={() => setRetryCount((count) => count + 1)} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" aria-label="Retry report loading">
            Retry
          </button>
        </div>
      ) : !reports ? (
        <div className="ui-card p-10 text-center text-base text-muted-foreground">No report data is available.</div>
      ) : (
        <>
          {/* Barangay funds from certificate fees */}
          <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg" style={{ background: "linear-gradient(120deg, #0d2244 0%, #1a3a6b 55%, #24508f 100%)" }}>
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(212,160,23,0.3) 0%, rgba(212,160,23,0) 70%)" }} />
            <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: "linear-gradient(90deg, #d4a017, rgba(212,160,23,0.15))" }} />
            <div className="relative flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#f3d27a]">
              <Wallet size={16} /> Barangay Collections
            </div>
            <div className="relative mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Expected Charges", value: peso(reports.totalBilled), icon: <HandCoins size={18} />, note: "Fees for selected requests filed" },
                { label: "Collections Received", value: peso(reports.revenue), icon: <Wallet size={18} />, note: `Payments received ${periodLabel}` },
                { label: "Requests Filed", value: reports.totalThisMonth, icon: <CalendarCheck size={18} />, note: periodLabel },
                { label: "Outstanding Balance", value: peso(reports.outstanding ?? 0), icon: <HandCoins size={18} />, note: `${reports.outstandingCount ?? 0} unpaid request${reports.outstandingCount === 1 ? "" : "s"} filed in period` },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-blue-100"><span className="text-[#f3d27a]">{m.icon}</span>{m.label}</div>
                  <div className="mt-2 text-3xl font-extrabold tracking-tight" style={HEADING}>{m.value}</div>
                  <div className="mt-0.5 text-xs text-blue-200">{m.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="ui-card p-5 lg:col-span-3">
              <h4 className="text-lg font-bold text-foreground mb-1" style={HEADING}>Collections in selected period</h4>
              <p className="text-sm text-muted-foreground mb-4">Collection trend for {periodLabel}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reports.monthly}>
                  <defs>
                    <linearGradient id="revenueBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e0ae26" />
                      <stop offset="100%" stopColor="#b8860b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#5a6a82" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: "#5a6a82" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [peso(v), "Collected"]} cursor={{ fill: "rgba(212,160,23,0.08)" }} />
                  <Bar dataKey="revenue" fill="url(#revenueBar)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ui-card p-5 lg:col-span-2">
              <h4 className="text-lg font-bold text-foreground mb-1" style={HEADING}>Collections by Document</h4>
              <p className="text-sm text-muted-foreground mb-4">Where the collected fees came from</p>
              {(reports.revenueByDocType ?? []).length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No payments recorded yet.</div>
              ) : (
                <div className="space-y-3.5">
                  {reports.revenueByDocType!.map((d) => (
                    <div key={d.name}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-semibold text-foreground">{d.name}</span>
                        <span className="whitespace-nowrap font-bold text-foreground">{peso(d.total)} <span className="font-normal text-muted-foreground">· {d.count} paid</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#eef2f8]">
                        <div className="h-full rounded-full" style={{ width: `${byDocTotal ? (d.total / byDocTotal) * 100 : 0}%`, background: "linear-gradient(90deg, #1a3a6b, #3b6fb6)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Requests in Period" value={reports.totalThisMonth} icon={<TrendingUp size={20} className="text-primary" />} color="bg-primary/10" />
            <StatCard label="Released Requests in Period" value={reports.releasedThisMonth} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
            <StatCard label="Unpaid Requests in Period" value={reports.outstandingCount ?? 0} icon={<HandCoins size={20} className="text-amber-600" />} color="bg-amber-50" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="ui-card p-5">
              <h4 className="text-lg font-bold text-foreground mb-4" style={HEADING}>Requests in selected period</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={reports.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#5a6a82" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: "#5a6a82" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(26,58,107,0.06)" }} />
                  <Bar dataKey="requests" fill="#1a3a6b" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ui-card p-5">
              <h4 className="text-lg font-bold text-foreground mb-4" style={HEADING}>Document Distribution</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={reports.distribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {reports.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconSize={11} iconType="circle" wrapperStyle={{ fontSize: "13px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
