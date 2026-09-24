import { useEffect, useState } from "react";
import { X, KeyRound, Mail, Phone, MapPin, Calendar, CalendarCheck, Clock, Fingerprint, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import type { ApiUserDetail, UserDisplayStatus } from "../lib/api";

const STATUS_STYLE: Record<UserDisplayStatus, string> = {
  Pending: "text-amber-700 bg-amber-500/15 border-amber-300/40",
  Denied: "text-red-700 bg-red-500/15 border-red-300/40",
  Active: "text-emerald-700 bg-emerald-500/15 border-emerald-300/40",
  Inactive: "text-slate-600 bg-slate-500/15 border-slate-300/40",
  "Walk-in": "text-orange-100 bg-orange-500/20 border-orange-300/40",
};

const ROLE_STYLE: Record<string, string> = {
  resident: "bg-blue-500/15 text-blue-100 border-blue-300/30",
  staff: "bg-indigo-500/15 text-indigo-100 border-indigo-300/30",
};

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-primary/8 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-base font-semibold text-foreground truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

export function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [user, setUser] = useState<ApiUserDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .getUserDetail(userId)
      .then(({ user }) => { if (!cancelled) setUser(user); })
      .catch((err: any) => { if (!cancelled) setError(err.message || "Could not load account details."); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,28,46,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="ui-modal bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {error && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Account Details</h3>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X size={16} /></button>
            </div>
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
          </div>
        )}

        {!user && !error && (
          <div className="p-10 text-center text-base text-muted-foreground">Loading account details...</div>
        )}

        {user && (
          <>
            {/* Header */}
            <div
              className="relative px-6 pt-6 pb-5 rounded-t-2xl"
              style={{ background: "linear-gradient(135deg, #1a3a6b 0%, #0d2244 100%)" }}
            >
              <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                <X size={16} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#d4a017] flex items-center justify-center text-[#0f1c2e] font-bold text-2xl flex-shrink-0 border-2 border-white/20">
                  {user.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-bold text-xl leading-tight truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{user.name}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${ROLE_STYLE[user.role] || ROLE_STYLE.resident}`}>{user.role}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[user.displayStatus || "Pending"]}`}>{user.displayStatus}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 bg-white/8 border border-white/15 rounded-xl px-3.5 py-2.5">
                <Fingerprint size={16} className="text-[#d4a017] flex-shrink-0" />
                <span className="text-xs text-blue-200 font-semibold uppercase tracking-wider">User ID</span>
                <span className="ml-auto text-base font-bold font-mono text-white tracking-wide">{user.id}</span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {user.accountType === "Walk-in" ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3.5 text-sm text-orange-800">
                  <span className="font-bold">Walk-in record.</span> Staff encoded this person at the counter. There's no email or password, so it can't be used to sign in.
                </div>
              ) : (
              <div className={`rounded-xl border px-4 py-3.5 shadow-sm ${user.tempPassword ? "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/60" : "border-border bg-[#f7f9fc]"}`}>
                <div className={`flex items-center gap-2 text-sm font-bold mb-2 ${user.tempPassword ? "text-amber-900" : "text-muted-foreground"}`}>
                  <KeyRound size={16} /> Temporary Password (First Login)
                </div>
                {user.tempPassword ? (
                  <>
                    <div className="font-mono text-lg font-semibold tracking-wide text-amber-900 bg-white border border-amber-200 rounded-lg px-3.5 py-2.5 text-center">
                      {user.tempPassword}
                    </div>
                    <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                      This is the password that was emailed to the user when their account was approved. Kept here permanently for reference — if they've since changed their password, this one will no longer work for signing in.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    None on file — this account predates the temporary password feature, so no record was generated for it.
                  </p>
                )}
              </div>
              )}

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">Contact Information</div>
                <div className="bg-[#f7f9fc] rounded-xl border border-border px-4 divide-y divide-border">
                  <DetailRow icon={<Mail size={15} />} label="Email Address" value={user.email} />
                  <DetailRow icon={<Phone size={15} />} label="Contact Number" value={user.contactNo} />
                  <DetailRow icon={<MapPin size={15} />} label="Address" value={user.address} />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">Personal Information</div>
                <div className="bg-[#f7f9fc] rounded-xl border border-border px-4 divide-y divide-border">
                  <DetailRow icon={<ShieldCheck size={15} />} label="Gender / Civil Status" value={user.gender && user.civilStatus ? `${user.gender} · ${user.civilStatus}` : user.gender || user.civilStatus} />
                  <DetailRow icon={<Calendar size={15} />} label="Date of Birth" value={user.dateOfBirth} />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">Account Activity</div>
                <div className="bg-[#f7f9fc] rounded-xl border border-border px-4 divide-y divide-border">
                  <DetailRow icon={<CalendarCheck size={15} />} label="Date Joined" value={user.joined} />
                  <DetailRow icon={<Clock size={15} />} label="Last Login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never logged in"} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
