import { useRef, useState } from "react";
import { X, Check, CheckCircle, Circle, Shield, Package, Printer, FileText, Banknote, ScrollText, Upload, Ban, RefreshCw } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { api } from "../lib/api";
import { printCertificate, previewCertificateSoftCopy } from "../lib/certificate";
import type { ApiDocumentType, ApiRequest, Role, RequestStatus } from "../lib/api";

const PRINTABLE_STATUSES: RequestStatus[] = ["Approved", "Ready for Pickup", "Released"];
// Once staff has verified the submitted files, a watermarked soft-copy preview of the
// certificate becomes available so staff/admin can review it ahead of formal approval.
const SOFT_COPY_STATUSES: RequestStatus[] = ["Verified", "Approved", "Ready for Pickup", "Released"];
const NON_CANCELLABLE_STATUSES: RequestStatus[] = ["Released", "Rejected", "Cancelled"];
// A resident can add or fix requirement files any time before the request is formally decided --
// not just after a staff rejection. Editing a Verified request sends it back to Pending, since
// the earlier verification no longer covers the new file.
const EDITABLE_STATUSES: RequestStatus[] = ["Pending", "Verified", "Rejected"];

export function RequestDetailModal({ req, docTypes, onClose, role, onStatusChange, onMarkPaid, onPrintCertificate, onResubmit, onCancel }: {
  req: ApiRequest;
  docTypes: ApiDocumentType[];
  onClose: () => void;
  role: Role;
  onStatusChange: (id: string, status: RequestStatus, remarks?: string) => void;
  onMarkPaid?: (id: string) => void;
  onPrintCertificate?: (id: string) => Promise<ApiRequest | null>;
  onResubmit?: (id: string, formData: FormData) => Promise<ApiRequest>;
  onCancel?: (id: string) => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [resubmitFiles, setResubmitFiles] = useState<Record<string, File | null>>({});
  const [resubmitSubmitting, setResubmitSubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState("");
  const resubmitInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const steps: RequestStatus[] = ["Pending", "Verified", "Approved", "Ready for Pickup", "Released"];
  const currentStep = steps.indexOf(req.status);
  const isSideExit = req.status === "Rejected" || req.status === "Cancelled";
  const requirements = docTypes.find((d) => d.name === req.docType)?.requirements ?? [];
  // Staff owns the whole decision pipeline, including payment, ready for pickup, and release.
  const canCollectPayment = role === "staff" && !req.paid && req.status !== "Rejected" && !!req.printedAt && !!onMarkPaid;
  // Printing the official certificate is staff's job, and no longer waits on payment -- that's
  // collected afterward. Residents never print it themselves, and admin is view-only here.
  const canPrintCertificate = role === "staff" && PRINTABLE_STATUSES.includes(req.status) && !!onPrintCertificate;
  const canPreviewSoftCopy = (role === "staff" || role === "admin") && SOFT_COPY_STATUSES.includes(req.status);
  const canMarkReady = role === "staff" && req.status === "Approved" && !!req.printedAt && req.paid;
  const canMarkReleased = role === "staff" && req.status === "Ready for Pickup";
  const canResubmit = role === "resident" && EDITABLE_STATUSES.includes(req.status) && !!onResubmit;
  const isRejected = req.status === "Rejected";
  const canCancel = role === "resident" && !!onCancel && !NON_CANCELLABLE_STATUSES.includes(req.status);
  const anySubFormOpen = showRejectForm || showResubmitForm || showCancelConfirm;

  async function handlePrint() {
    if (!onPrintCertificate) return;
    setPrinting(true);
    try {
      const updated = await onPrintCertificate(req.id);
      printCertificate(updated || req);
    } finally {
      setPrinting(false);
    }
  }

  function confirmReject() {
    if (!rejectReason.trim()) {
      setRejectError("Please explain what's incomplete or incorrect so the resident knows how to comply.");
      return;
    }
    onStatusChange(req.id, "Rejected", rejectReason.trim());
    onClose();
  }

  function handleResubmitFileSelected(requirementLabel: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setResubmitFiles((prev) => ({ ...prev, [requirementLabel]: file }));
    e.target.value = "";
  }

  function stillMissingForResubmit() {
    return requirements.filter((r) => {
      if (!r.required) return false;
      const hasExisting = req.files.some((f) => f.requirement === r.requirement);
      const hasNew = !!resubmitFiles[r.requirement];
      return !hasExisting && !hasNew;
    });
  }

  async function confirmResubmit() {
    const missing = stillMissingForResubmit();
    if (missing.length > 0) {
      setResubmitError(`Still missing: ${missing.map((r) => r.requirement).join(", ")}`);
      return;
    }
    const entries = Object.entries(resubmitFiles).filter(([, f]) => f) as [string, File][];
    if (entries.length === 0) {
      setResubmitError("Attach at least one corrected file before resubmitting.");
      return;
    }
    setResubmitError("");
    setResubmitSubmitting(true);
    try {
      const formData = new FormData();
      for (const [label, file] of entries) {
        formData.append("requirementLabels", label);
        formData.append("files", file);
      }
      await onResubmit!(req.id, formData);
      onClose();
    } catch (err: any) {
      setResubmitError(err.message || "Failed to resubmit. Please try again.");
    } finally {
      setResubmitSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,28,46,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <div className="text-sm font-mono text-primary font-semibold mb-1">{req.id}</div>
            <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{req.docType}</h3>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={req.status} />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!isSideExit && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Request Progress</div>
              <div className="flex items-center gap-0">
                {steps.map((step, i) => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                        i <= currentStep ? "bg-primary border-primary text-white" : "bg-card border-border text-muted-foreground"
                      }`}>
                        {i < currentStep ? <Check size={14} /> : i + 1}
                      </div>
                      <div className={`text-[12px] mt-1 text-center w-16 leading-tight ${i <= currentStep ? "text-primary font-semibold" : "text-muted-foreground"}`}>{step}</div>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mb-4 ${i < currentStep ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Resident Name", value: req.residentName },
              { label: "Contact Number", value: req.contactNo },
              { label: "Purpose", value: req.purpose },
              { label: "Submitted", value: req.submittedAt },
              { label: "Last Updated", value: req.updatedAt },
              { label: "Fee", value: req.fee === 0 ? "Free" : `₱${req.fee}` },
              { label: "Payment", value: req.paid ? "Paid" : "Unpaid" },
              { label: "Certificate", value: req.printedAt ? `Printed ${new Date(req.printedAt).toLocaleDateString()}` : "Not yet printed" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-sm text-muted-foreground mb-0.5">{label}</div>
                <div className="text-base font-semibold text-foreground">{value}</div>
              </div>
            ))}
            <div className="col-span-2">
              <div className="text-sm text-muted-foreground mb-0.5">Address</div>
              <div className="text-base font-semibold text-foreground">{req.address}</div>
            </div>
          </div>

          {req.remarks && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="text-sm font-semibold text-red-600 mb-1 uppercase tracking-wider">Remarks / Notes</div>
              <p className="text-base text-red-700">{req.remarks}</p>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Requirements Checklist</div>
            <div className="space-y-1.5">
              {requirements.map((r, i) => {
                const matchingFile = req.files.find((f) => f.requirement === r.requirement);
                return (
                  <div key={i} className="flex items-center gap-2 text-base">
                    {matchingFile ? (
                      <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Circle size={16} className={`flex-shrink-0 ${r.required ? "text-red-400" : "text-muted-foreground/40"}`} />
                    )}
                    <span className={matchingFile ? "text-foreground" : r.required ? "text-red-600" : "text-muted-foreground"}>{r.requirement}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${r.required ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                      {r.required ? "Required" : "Optional"}
                    </span>
                    {!matchingFile && r.required && <span className="text-xs text-red-500 font-semibold ml-auto">Missing</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {req.files.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Uploaded Files</div>
              <div className="space-y-1.5">
                {req.files.map((f, i) => (
                  <a key={i} href={api.fileUrl(f.storedName)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-base text-primary hover:underline">
                    <FileText size={16} className="flex-shrink-0" />
                    <span>{f.originalName}</span>
                    {f.requirement && <span className="text-sm text-muted-foreground">— {f.requirement}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {req.status === "Approved" && !req.printedAt && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {role === "staff"
                ? "This request is approved — print the certificate to move it forward."
                : "Waiting on staff to print the certificate before payment can be collected."}
            </div>
          )}
          {!req.paid && req.fee > 0 && !!req.printedAt && req.status !== "Rejected" && req.status !== "Cancelled" && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {role === "resident"
                ? "The certificate has been printed — please settle payment at the Barangay Hall to claim it."
                : role === "admin"
                ? "The certificate has been printed by staff and is awaiting payment collection and release."
                : "The certificate has been printed. Collect payment to move this to Ready for Pickup."}
            </div>
          )}

          {showRejectForm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <div className="text-sm font-semibold text-red-700">Reason for rejection</div>
              <textarea
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); setRejectError(""); }}
                rows={3}
                placeholder="e.g. Uploaded ID is expired, please resubmit with a valid government ID."
                className="w-full px-3 py-2 rounded-lg border border-red-200 bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all"
              />
              {rejectError && <div className="text-xs text-red-600">{rejectError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowRejectForm(false); setRejectReason(""); setRejectError(""); }} className="flex-1 py-2 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={confirmReject} className="flex-1 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors">Confirm Rejection</button>
              </div>
            </div>
          )}

          {showResubmitForm && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-800">{isRejected ? "Update your requirements and resubmit" : "Add or update your requirements"}</div>
              <p className="text-xs text-amber-700 -mt-1">
                {isRejected
                  ? "Only attach a new file for the item(s) that need fixing — everything else stays as it is."
                  : "Attach a file for anything missing, or replace one that's already there. Doing so sends this back to Pending for a fresh review."}
              </p>
              <div className="space-y-2">
                {requirements.map((r) => {
                  const existing = req.files.find((f) => f.requirement === r.requirement);
                  const newFile = resubmitFiles[r.requirement];
                  return (
                    <div key={r.requirement} className="rounded-lg border border-amber-200 bg-white p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">{r.requirement}</span>
                        <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${r.required ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                          {r.required ? "Required" : "Optional"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1.5">
                        {newFile ? (
                          <span className="text-emerald-600 font-semibold">Will replace with: {newFile.name}</span>
                        ) : existing ? (
                          <span>Currently attached: {existing.originalName}</span>
                        ) : (
                          <span className={r.required ? "text-red-500 font-semibold" : ""}>Not attached</span>
                        )}
                      </div>
                      <input
                        ref={(el) => { resubmitInputRefs.current[r.requirement] = el; }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => handleResubmitFileSelected(r.requirement, e)}
                      />
                      <button
                        onClick={() => resubmitInputRefs.current[r.requirement]?.click()}
                        className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900"
                      >
                        <Upload size={12} /> {existing ? "Replace file" : "Attach file"}
                      </button>
                    </div>
                  );
                })}
              </div>
              {resubmitError && <div className="text-xs text-red-600">{resubmitError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowResubmitForm(false); setResubmitFiles({}); setResubmitError(""); }} className="flex-1 py-2 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={confirmResubmit} disabled={resubmitSubmitting} className="flex-1 py-2 rounded-lg bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition-colors disabled:opacity-60">
                  {resubmitSubmitting ? "Submitting..." : isRejected ? "Resubmit for Review" : "Submit for Review"}
                </button>
              </div>
            </div>
          )}

          {showCancelConfirm && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-sm font-semibold text-slate-700">Cancel this request?</div>
              <p className="text-xs text-slate-600">This can't be undone — you'll need to submit a new request if you change your mind.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-2 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Keep Request</button>
                <button onClick={() => { onCancel!(req.id); onClose(); }} className="flex-1 py-2 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-800 transition-colors">
                  Yes, Cancel It
                </button>
              </div>
            </div>
          )}

          {(role === "staff" || role === "admin" || canPrintCertificate || canResubmit || canCancel) && !anySubFormOpen && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              {canCollectPayment && (
                <button
                  onClick={() => onMarkPaid!(req.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-base font-semibold hover:bg-amber-600 transition-colors"
                >
                  <Banknote size={16} /> Mark as Paid
                </button>
              )}
              {role === "staff" && req.status === "Pending" && (
                <>
                  <button onClick={() => { onStatusChange(req.id, "Verified"); onClose(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
                    <CheckCircle size={16} /> Verify
                  </button>
                  <button onClick={() => setShowRejectForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-base font-semibold hover:bg-red-100 transition-colors">
                    <X size={16} /> Reject
                  </button>
                </>
              )}
              {role === "staff" && req.status === "Verified" && (
                <button onClick={() => { onStatusChange(req.id, "Approved"); onClose(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-base font-semibold hover:bg-indigo-700 transition-colors">
                  <Shield size={16} /> Approve
                </button>
              )}
              {canMarkReady && (
                <button onClick={() => { onStatusChange(req.id, "Ready for Pickup"); onClose(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700 transition-colors">
                  <Package size={16} /> Mark Ready
                </button>
              )}
              {canMarkReleased && (
                <button onClick={() => { onStatusChange(req.id, "Released"); onClose(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-base font-semibold hover:bg-green-700 transition-colors">
                  <Check size={16} /> Mark Released
                </button>
              )}
              {canResubmit && (
                <button onClick={() => setShowResubmitForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-base font-semibold hover:bg-amber-600 transition-colors">
                  <RefreshCw size={16} /> {isRejected ? "Fix & Resubmit" : "Add/Edit Requirements"}
                </button>
              )}
              {canCancel && (
                <button onClick={() => setShowCancelConfirm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-base font-semibold hover:bg-slate-100 transition-colors">
                  <Ban size={16} /> Cancel Request
                </button>
              )}
              {(canPreviewSoftCopy || canPrintCertificate) && (
                <div className="flex items-center gap-2 ml-auto">
                  {canPreviewSoftCopy && (
                    <button
                      onClick={() => previewCertificateSoftCopy(req)}
                      title="Preview the auto-filled certificate — click any text in it to correct details before formal approval"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-muted-foreground text-base font-semibold hover:bg-muted transition-colors"
                    >
                      <ScrollText size={16} /> Soft Copy Preview
                    </button>
                  )}
                  {canPrintCertificate && (
                    <button
                      onClick={handlePrint}
                      disabled={printing}
                      title={req.printedAt ? "Already printed once — this reprints it" : "Print the official certificate and notify staff to collect payment"}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-muted-foreground text-base font-semibold hover:bg-muted transition-colors disabled:opacity-60"
                    >
                      <Printer size={16} /> {printing ? "Printing..." : req.printedAt ? "Reprint Certificate" : "Print Certificate"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
