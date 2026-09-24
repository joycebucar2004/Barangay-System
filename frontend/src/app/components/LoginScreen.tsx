import { useState } from "react";
import { Shield, User, Briefcase, Star, ArrowLeft, FileCheck2, BellRing, Clock3 } from "lucide-react";
import { BarangayLogo } from "./BarangayLogo";
import { PasswordInput } from "./PasswordInput";
import { api } from "../lib/api";
import type { ApiUser, CivilStatus, Gender, Role } from "../lib/api";

const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-[#f0f3f8] text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

export function LoginScreen({
  onAuthenticated,
  onBack,
}: {
  onAuthenticated: (token: string, user: ApiUser, password: string) => void;
  onBack?: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState<Role>("resident");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [civilStatus, setCivilStatus] = useState<CivilStatus | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);

  const roles: { role: Role; label: string; icon: React.ReactNode; desc: string }[] = [
    { role: "resident", label: "Resident", icon: <User size={18} />, desc: "Submit & track requests" },
    { role: "staff", label: "Barangay Staff", icon: <Briefcase size={18} />, desc: "Review applications" },
    { role: "admin", label: "Officer / Admin", icon: <Shield size={18} />, desc: "Approve & manage" },
  ];

  function selectRole(role: Role) {
    setSelectedRole(role);
    setMode("login");
    setError("");
  }

  async function handleSubmit() {
    setError("");
    if (mode === "register") {
      if (!firstName || !lastName || !email || !gender || !civilStatus || !dateOfBirth) {
        setError("First name, last name, gender, civil status, date of birth and email are required.");
        return;
      }
      setSubmitting(true);
      try {
        await api.register({ firstName, middleName, lastName, gender, civilStatus, dateOfBirth, email, address, contactNo });
        setRegistrationSubmitted(true);
      } catch (err: any) {
        setError(err.message || "Registration failed.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { token, user } = await api.login(email, password, selectedRole);
      onAuthenticated(token, user, password);
    } catch (err: any) {
      setError(err.message || "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (registrationSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#f0f3f8]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Shield size={24} />
          </div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Registration submitted</h2>
          <p className="text-sm text-muted-foreground">
            Thanks, {firstName}! Your registration is now pending review by the barangay admin. Once approved, your login credentials will be emailed to <span className="font-semibold text-foreground">{email}</span>.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Back to home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="relative hidden lg:flex lg:w-[55%] flex-col justify-between overflow-hidden p-12" style={{ background: "linear-gradient(145deg, #1a3a6b 0%, #0d2244 100%)" }}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(212,160,23,0.28) 0%, rgba(212,160,23,0) 70%)" }} />
        <img src="/seals/barangay-campagao.jpg" alt="" aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full object-cover opacity-[0.07] mix-blend-luminosity" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <BarangayLogo size={56} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Barangay Campagao</div>
              <div className="text-blue-200 text-sm">Document Request System</div>
            </div>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-blue-200 text-sm font-semibold hover:text-white transition-colors"
            >
              <ArrowLeft size={15} /> Back to home
            </button>
          )}
        </div>

        <div className="relative space-y-8">
          <div>
            <div className="mb-5 h-1 w-16 rounded-full bg-[#d4a017]" />
            <h1 className="text-white text-5xl font-extrabold leading-tight mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Fast. Transparent.<br />At Your Service.
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed max-w-md">
              Submit and track your barangay document requests online. No more long queues — complete your transactions from anywhere.
            </p>
          </div>
          <div className="grid max-w-lg gap-3">
            {[
              { icon: <FileCheck2 size={18} />, title: "Request online", desc: "Clearances and certificates in a few clicks" },
              { icon: <Clock3 size={18} />, title: "Track every step", desc: "From review to ready for pickup" },
              { icon: <BellRing size={18} />, title: "Get notified", desc: "Know the moment your document is ready" },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#d4a017]/20 text-[#f3d27a]">{f.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <div className="text-sm text-blue-200/90">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-blue-300 text-sm">
          <Star size={14} className="fill-blue-300" />
          <span>Serving the residents of Barangay Campagao since 1972</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-[#f0f3f8]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-muted-foreground text-sm font-semibold hover:text-primary transition-colors mb-5"
              >
                <ArrowLeft size={15} /> Back to home
              </button>
            )}
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                <BarangayLogo size={48} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Barangay Campagao</div>
                <div className="text-muted-foreground text-xs">Document Request System</div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {mode === "register" ? "Create your resident account" : "Sign in to your account"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "register" ? "Register to submit and track document requests" : "Select your role and enter your credentials"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {roles.map(({ role, label, icon, desc }) => (
              <button
                key={role}
                onClick={() => selectRole(role)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all duration-150 ${
                  selectedRole === role
                    ? "border-primary bg-primary text-white shadow-md"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {icon}
                <span className="text-xs font-semibold leading-tight">{label}</span>
                <span className={`text-[10px] leading-tight ${selectedRole === role ? "text-blue-100" : "text-muted-foreground"}`}>{desc}</span>
              </button>
            ))}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
            )}

            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Last Name</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dela Cruz" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">First Name</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Middle Name</label>
                  <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={inputClass}>
                      <option value="" disabled>Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Date of Birth</label>
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Civil Status</label>
                  <select value={civilStatus} onChange={(e) => setCivilStatus(e.target.value as CivilStatus)} className={inputClass}>
                    <option value="" disabled>Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Divorced">Divorced</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Address</label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House No., Street, Brgy. Campagao" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Contact Number</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value.replace(/\D/g, ""))}
                      placeholder="09XXXXXXXXX"
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            {mode === "login" && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  autoComplete="current-password"
                />
              </div>
            )}
            {mode === "register" && (
              <p className="text-xs text-muted-foreground bg-[#f0f3f8] border border-border rounded-lg px-3 py-2">
                No password needed here — once the barangay approves your registration, your login credentials will be emailed to you.
              </p>
            )}
            {mode === "login" && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                  <input type="checkbox" className="rounded border-border" />
                  Remember me
                </label>
                <button className="text-primary font-semibold hover:underline">Forgot password?</button>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {submitting ? "Please wait..." : mode === "register" ? "Create Account" : "Sign In"}
            </button>
          </div>

          {selectedRole === "resident" && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              {mode === "login" ? (
                <>
                  {"Don't have an account? "}
                  <button onClick={() => { setMode("register"); setError(""); }} className="text-primary font-semibold hover:underline">Register here</button>
                </>
              ) : (
                <>
                  {"Already have an account? "}
                  <button onClick={() => { setMode("login"); setError(""); }} className="text-primary font-semibold hover:underline">Sign in</button>
                </>
              )}
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            Protected by the Data Privacy Act of 2012 (R.A. 10173)
          </p>
        </div>
      </div>
    </div>
  );
}
