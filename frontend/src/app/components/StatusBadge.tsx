import { Clock, CheckCircle, Shield, Package, Check, X, Ban } from "lucide-react";
import type { RequestStatus } from "../lib/api";

export function StatusBadge({ status }: { status: RequestStatus }) {
  const config: Record<RequestStatus, { color: string; icon: React.ReactNode }> = {
    "Pending": { color: "bg-amber-50 text-amber-700 border border-amber-200", icon: <Clock size={14} /> },
    "Verified": { color: "bg-blue-50 text-blue-700 border border-blue-200", icon: <CheckCircle size={14} /> },
    "Approved": { color: "bg-indigo-50 text-indigo-700 border border-indigo-200", icon: <Shield size={14} /> },
    "Ready for Pickup": { color: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: <Package size={14} /> },
    "Released": { color: "bg-green-50 text-green-700 border border-green-200", icon: <Check size={14} /> },
    "Rejected": { color: "bg-red-50 text-red-700 border border-red-200", icon: <X size={14} /> },
    "Cancelled": { color: "bg-slate-100 text-slate-600 border border-slate-200", icon: <Ban size={14} /> },
  };
  const { color, icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${color}`} style={{ fontFamily: "'DM Mono', monospace" }}>
      {icon} {status}
    </span>
  );
}
