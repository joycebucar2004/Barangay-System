import { useEffect, useRef, useState } from "react";
import { CheckCircle, Check, ChevronRight, FileText, Upload, X } from "lucide-react";
import type { ApiDocumentType, ApiRequest } from "../lib/api";

export function NewRequestForm({ docTypes, onSubmit, onDone }: {
  docTypes: ApiDocumentType[];
  onSubmit: (formData: FormData) => Promise<ApiRequest>;
  onDone: () => void;
}) {
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [purpose, setPurpose] = useState("");
  const [step, setStep] = useState(1);
  // One upload slot per requirement, keyed by the requirement's label.
  const [filesByRequirement, setFilesByRequirement] = useState<Record<string, File | null>>({});
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedDocConfig = docTypes.find((d) => d.name === selectedDoc);
  const requirements = selectedDocConfig?.requirements ?? [];
  const requiredMissing = requirements.filter((r) => r.required && !filesByRequirement[r.requirement]);

  // Reset upload slots whenever the chosen document type changes.
  useEffect(() => {
    setFilesByRequirement({});
  }, [selectedDoc]);

  function handleFileSelected(requirementLabel: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setFilesByRequirement((prev) => ({ ...prev, [requirementLabel]: file }));
    e.target.value = "";
  }

  function removeFile(requirementLabel: string) {
    setFilesByRequirement((prev) => ({ ...prev, [requirementLabel]: null }));
  }

  async function handleSubmit() {
    if (!selectedDoc) return;
    if (requiredMissing.length > 0) {
      setError(`Please attach: ${requiredMissing.map((r) => r.requirement).join(", ")}`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("docType", selectedDoc);
      formData.append("purpose", purpose);
      for (const r of requirements) {
        const file = filesByRequirement[r.requirement];
        if (file) {
          formData.append("requirementLabels", r.requirement);
          formData.append("files", file);
        }
      }
      const created = await onSubmit(formData);
      setSubmittedId(created.id);
    } catch (err: any) {
      setError(err.message || "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-4">
          <CheckCircle size={28} className="text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Request Submitted!</h3>
        <p className="text-muted-foreground text-sm mb-1">Your request ID is <span className="font-mono font-bold text-primary">{submittedId}</span></p>
        <p className="text-muted-foreground text-sm mb-6">We will notify you once your request has been reviewed.</p>
        <button onClick={onDone} className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step >= s ? "bg-primary border-primary text-white" : "bg-card border-border text-muted-foreground"}`}>{step > s ? <Check size={12} /> : s}</div>
            <span className={`text-xs ${step >= s ? "text-primary font-semibold" : "text-muted-foreground"}`}>{["Select Document", "Requirements", "Confirm"][s - 1]}</span>
            {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Select Document Type</h3>
          {docTypes.length === 0 ? (
            <div className="text-sm text-muted-foreground">Loading document types...</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {docTypes.map((doc) => (
                <button
                  key={doc.name}
                  onClick={() => setSelectedDoc(doc.name)}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${selectedDoc === doc.name ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedDoc === doc.name ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      <FileText size={16} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{doc.name}</div>
                      <div className="text-xs text-muted-foreground">Fee: {doc.fee === 0 ? "Free" : `₱${doc.fee}`}</div>
                    </div>
                  </div>
                  {selectedDoc === doc.name && <Check size={16} className="text-primary" />}
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Purpose of Request</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Employment, Scholarship, Bank Requirement..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-[#f0f3f8] text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!selectedDoc || !purpose}
            className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ChevronRight size={14} className="inline" />
          </button>
        </div>
      )}

      {step === 2 && selectedDocConfig && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Upload Requirements</h3>
          <p className="text-xs text-muted-foreground -mt-2">Attach a file for each item below. <span className="font-semibold text-foreground">Required</span> items must be attached before you can continue — optional ones can be skipped.</p>

          <div className="space-y-2.5">
            {requirements.map((r) => {
              const file = filesByRequirement[r.requirement];
              return (
                <div key={r.requirement} className={`rounded-xl border p-3.5 ${file ? "border-emerald-200 bg-emerald-50/40" : r.required ? "border-border bg-card" : "border-border bg-[#f7f9fc]"}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">{r.requirement}</span>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${r.required ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                        {r.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    {file && <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />}
                  </div>

                  <input
                    ref={(el) => { fileInputRefs.current[r.requirement] = el; }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileSelected(r.requirement, e)}
                  />

                  {file ? (
                    <div className="flex items-center justify-between text-xs text-foreground bg-white border border-emerald-200 rounded-lg px-3 py-2">
                      <span className="truncate">{file.name}</span>
                      <button onClick={() => removeFile(r.requirement)} className="text-muted-foreground hover:text-red-600 flex-shrink-0 ml-2"><X size={12} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRefs.current[r.requirement]?.click()}
                      className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-lg py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
                    >
                      <Upload size={13} /> Attach file
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Back</button>
            <button
              onClick={() => { setError(""); setStep(3); }}
              disabled={requiredMissing.length > 0}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight size={14} className="inline" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && selectedDocConfig && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Review & Submit</h3>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="ui-card p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Document Type</span>
              <span className="font-semibold text-foreground">{selectedDoc}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Purpose</span>
              <span className="font-semibold text-foreground">{purpose}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processing Fee</span>
              <span className="font-bold text-foreground">{selectedDocConfig.fee === 0 ? "Free" : `₱${selectedDocConfig.fee}`}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated Processing</span>
              <span className="font-semibold text-foreground">2–3 working days</span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1.5">Attached files</div>
              <ul className="space-y-1">
                {requirements.filter((r) => filesByRequirement[r.requirement]).map((r) => (
                  <li key={r.requirement} className="flex items-center gap-1.5 text-xs text-foreground">
                    <CheckCircle size={12} className="text-emerald-500" /> {r.requirement} — <span className="truncate">{filesByRequirement[r.requirement]?.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
            By submitting, you certify that all information and documents provided are true and correct. False statements may result in legal action.
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Back</button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
