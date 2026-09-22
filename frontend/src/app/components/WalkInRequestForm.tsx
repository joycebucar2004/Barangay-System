import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle, ChevronRight, FileText, Search, Upload, UserPlus, Users, X } from "lucide-react";
import type { ApiDocumentType, ApiRequest, ApiUser, CivilStatus, Gender } from "../lib/api";

const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-[#f0f3f8] text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
const STEPS = ["Requester", "Document", "Requirements", "Confirm"];

type Mode = "new" | "existing";

export function WalkInRequestForm({ docTypes, residents, onSubmit }: {
  docTypes: ApiDocumentType[];
  residents: ApiUser[];
  onSubmit: (formData: FormData) => Promise<ApiRequest>;
}) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>("new");

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [civilStatus, setCivilStatus] = useState<CivilStatus | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [contactNo, setContactNo] = useState("");

  const [search, setSearch] = useState("");
  const [selectedResident, setSelectedResident] = useState<ApiUser | null>(null);

  const [selectedDoc, setSelectedDoc] = useState("");
  const [purpose, setPurpose] = useState("");
  const [presented, setPresented] = useState<Record<string, boolean>>({});
  const [filesByRequirement, setFilesByRequirement] = useState<Record<string, File | null>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ApiRequest | null>(null);

  const docConfig = docTypes.find((d) => d.name === selectedDoc);
  const requirements = docConfig?.requirements ?? [];
  const requiredMissing = requirements.filter((r) => r.required && !presented[r.requirement] && !filesByRequirement[r.requirement]);

  useEffect(() => {
    setPresented({});
    setFilesByRequirement({});
  }, [selectedDoc]);

  const selectableResidents = residents.filter((u) => u.role === "resident" && (u.accountType === "Walk-in" || u.status === "Approved"));
  const searchLower = search.trim().toLowerCase();
  const matches = searchLower
    ? selectableResidents.filter((u) =>
        u.name.toLowerCase().includes(searchLower) ||
        u.id.toLowerCase().includes(searchLower) ||
        (u.contactNo || "").includes(searchLower)
      ).slice(0, 8)
    : [];

  const newDetailsComplete = firstName.trim() && lastName.trim() && gender && civilStatus && dateOfBirth;
  const requesterReady = mode === "existing" ? !!selectedResident : !!newDetailsComplete;
  const requesterName = mode === "existing"
    ? selectedResident?.name
    : [firstName.trim(), middleName.trim() ? `${middleName.trim()[0]}.` : "", lastName.trim()].filter(Boolean).join(" ");

  function reset() {
    setStep(1);
    setMode("new");
    setFirstName(""); setMiddleName(""); setLastName(""); setGender(""); setCivilStatus(""); setDateOfBirth(""); setAddress(""); setContactNo("");
    setSearch(""); setSelectedResident(null);
    setSelectedDoc(""); setPurpose(""); setPresented({}); setFilesByRequirement({});
    setError(""); setCreated(null);
  }

  function handleFileSelected(label: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setFilesByRequirement((prev) => ({ ...prev, [label]: file }));
    e.target.value = "";
  }

  async function handleSubmit() {
    if (requiredMissing.length > 0) {
      setError(`Still missing: ${requiredMissing.map((r) => r.requirement).join(", ")}`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (mode === "existing" && selectedResident) {
        formData.append("residentId", selectedResident.id);
      } else {
        formData.append("firstName", firstName.trim());
        formData.append("middleName", middleName.trim());
        formData.append("lastName", lastName.trim());
        formData.append("gender", gender);
        formData.append("civilStatus", civilStatus);
        formData.append("dateOfBirth", dateOfBirth);
        formData.append("address", address.trim());
        formData.append("contactNo", contactNo);
      }
      formData.append("docType", selectedDoc);
      formData.append("purpose", purpose.trim());
      formData.append("requirementsPresented", JSON.stringify(requirements.filter((r) => presented[r.requirement]).map((r) => r.requirement)));
      for (const r of requirements) {
        const file = filesByRequirement[r.requirement];
        if (file) {
          formData.append("requirementLabels", r.requirement);
          formData.append("files", file);
        }
      }
      setCreated(await onSubmit(formData));
    } catch (err: any) {
      setError(err.message || "Failed to save the walk-in request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-4">
          <CheckCircle size={28} className="text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Walk-in Request Saved</h3>
        <p className="text-muted-foreground text-sm mb-1">
          Request <span className="font-mono font-bold text-primary">{created.id}</span> for <span className="font-semibold text-foreground">{created.residentName}</span>
        </p>
        <p className="text-muted-foreground text-sm mb-6 max-w-md">
          It's now in the Request Queue as <span className="font-semibold">Pending</span> — verify, approve, print and release it the same way as online requests. Give the requester this ID so they can follow up.
        </p>
        <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors">
          Encode Another Walk-in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => {
          const s = i + 1;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step >= s ? "bg-primary border-primary text-white" : "bg-card border-border text-muted-foreground"}`}>{step > s ? <Check size={12} /> : s}</div>
              <span className={`text-xs ${step >= s ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</span>
              {s < STEPS.length && <div className={`flex-1 h-0.5 ${step > s ? "bg-primary" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "new", label: "New walk-in", desc: "Enter their personal details", icon: <UserPlus size={16} /> },
              { id: "existing", label: "Existing record", desc: "Came in before or has an account", icon: <Users size={16} /> },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${mode === opt.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${mode === opt.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{opt.icon}</div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {mode === "new" ? (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Last Name *</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dela Cruz" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">First Name *</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Middle Name</label>
                <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Gender *</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={inputClass}>
                    <option value="" disabled>Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Civil Status *</label>
                  <select value={civilStatus} onChange={(e) => setCivilStatus(e.target.value as CivilStatus)} className={inputClass}>
                    <option value="" disabled>Select</option>
                    {["Single", "Married", "Widowed", "Separated", "Divorced"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Date of Birth *</label>
                  <input type="date" max={new Date().toISOString().split("T")[0]} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Purok / Street, Brgy. Campagao" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Contact No.</label>
                  <input type="tel" inputMode="numeric" maxLength={11} value={contactNo} onChange={(e) => setContactNo(e.target.value.replace(/\D/g, ""))} placeholder="09XXXXXXXXX" className={inputClass} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-[#f0f3f8] border border-border rounded-lg px-3 py-2">
                This saves a <span className="font-semibold">walk-in record</span> in User Accounts. It has no email or password, so it can't be used to sign in.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              {selectedResident ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{selectedResident.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{selectedResident.id}</span> · {selectedResident.accountType === "Walk-in" ? "Walk-in record" : "Online account"} · {selectedResident.address || "No address"}
                    </div>
                  </div>
                  <button onClick={() => setSelectedResident(null)} className="text-xs font-semibold text-primary hover:underline">Change</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID or contact number..." className={`${inputClass} pl-9`} autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    {matches.map((u) => (
                      <button key={u.id} onClick={() => setSelectedResident(u)} className="w-full flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors">
                        <div>
                          <div className="font-semibold text-sm text-foreground">{u.name}</div>
                          <div className="text-xs text-muted-foreground"><span className="font-mono">{u.id}</span> · {u.dateOfBirth} · {u.contactNo || "no contact"}</div>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.accountType === "Walk-in" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>{u.accountType === "Walk-in" ? "Walk-in" : "Online"}</span>
                      </button>
                    ))}
                    {searchLower && matches.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">No matching resident. Switch to <button onClick={() => setMode("new")} className="font-semibold text-primary hover:underline">New walk-in</button> to add them.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!requesterReady} className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Continue <ChevronRight size={14} className="inline" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Select Certificate Type</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {docTypes.map((doc) => (
              <button
                key={doc.name}
                onClick={() => setSelectedDoc(doc.name)}
                className={`flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${selectedDoc === doc.name ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedDoc === doc.name ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}><FileText size={15} /></div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">Fee: {doc.fee === 0 ? "Free" : `₱${doc.fee}`}</div>
                  </div>
                </div>
                {selectedDoc === doc.name && <Check size={16} className="text-primary" />}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Purpose of Request *</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Employment, Scholarship, Bank Requirement..." className={inputClass} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Back</button>
            <button onClick={() => setStep(3)} disabled={!selectedDoc || !purpose.trim()} className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Continue <ChevronRight size={14} className="inline" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && docConfig && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Check Requirements</h3>
          <p className="text-xs text-muted-foreground -mt-2">
            Tick each document the requester showed you in person. Attaching a scan is optional. All <span className="font-semibold text-foreground">Required</span> items must be ticked or attached.
          </p>
          <div className="space-y-2.5">
            {requirements.map((r) => {
              const file = filesByRequirement[r.requirement];
              const done = presented[r.requirement] || !!file;
              return (
                <div key={r.requirement} className={`rounded-xl border p-3.5 ${done ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-card"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!presented[r.requirement]}
                        onChange={(e) => setPresented((prev) => ({ ...prev, [r.requirement]: e.target.checked }))}
                        className="w-4 h-4 accent-[#1a3a6b]"
                      />
                      <span className="text-sm font-semibold text-foreground truncate">{r.requirement}</span>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${r.required ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>{r.required ? "Required" : "Optional"}</span>
                    </label>
                    <input ref={(el) => { fileInputRefs.current[r.requirement] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleFileSelected(r.requirement, e)} />
                    {file ? (
                      <span className="flex items-center gap-1.5 text-xs text-foreground bg-white border border-emerald-200 rounded-lg px-2 py-1 max-w-[45%]">
                        <span className="truncate">{file.name}</span>
                        <button onClick={() => setFilesByRequirement((prev) => ({ ...prev, [r.requirement]: null }))} className="text-muted-foreground hover:text-red-600"><X size={12} /></button>
                      </span>
                    ) : (
                      <button onClick={() => fileInputRefs.current[r.requirement]?.click()} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary flex-shrink-0">
                        <Upload size={12} /> Attach scan
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Back</button>
            <button onClick={() => { setError(""); setStep(4); }} disabled={requiredMissing.length > 0} className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Continue <ChevronRight size={14} className="inline" />
            </button>
          </div>
        </div>
      )}

      {step === 4 && docConfig && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Review & Save</h3>
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-sm">
            {[
              ["Requester", `${requesterName}${mode === "existing" && selectedResident ? ` (${selectedResident.id})` : " — new walk-in record"}`],
              ["Document Type", selectedDoc],
              ["Purpose", purpose.trim()],
              ["Processing Fee", docConfig.fee === 0 ? "Free" : `₱${docConfig.fee} (collect after printing)`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground text-right">{value}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1.5">Requirements</div>
              <ul className="space-y-1">
                {requirements.filter((r) => presented[r.requirement] || filesByRequirement[r.requirement]).map((r) => (
                  <li key={r.requirement} className="flex items-center gap-1.5 text-xs text-foreground">
                    <CheckCircle size={12} className="text-emerald-500" /> {r.requirement}
                    <span className="text-muted-foreground">— {[presented[r.requirement] && "presented", filesByRequirement[r.requirement] && "scan attached"].filter(Boolean).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Back</button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
              {submitting ? "Saving..." : "Save Walk-in Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
