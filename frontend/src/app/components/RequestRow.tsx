import { useState } from "react";
import { Eye, CheckCircle, Shield, Package, Check, Banknote, Printer } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { toast } from "sonner";
import { openCertificatePdf } from "../lib/certificate";
import type { ApiRequest, RequestStatus, Role } from "../lib/api";

const actionButtonClass = "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors";
const PRINTABLE_STATUSES: RequestStatus[] = ["Approved", "Ready for Pickup", "Released"];

export function RequestRow({ req, onView, showActions, role, onStatusChange, onMarkPaid, onPrintCertificate }: {
  req: ApiRequest;
  onView: (r: ApiRequest) => void;
  showActions?: boolean;
  role?: Role;
  onStatusChange?: (id: string, status: RequestStatus) => void;
  onMarkPaid?: (id: string) => void;
  onPrintCertificate?: (id: string) => Promise<ApiRequest | null>;
}) {
  const [printing, setPrinting] = useState(false);

  // Staff owns the whole decision pipeline -- verify, approve, print, payment, ready, release.
  // Admin's role here is read-only (mirrors the backend's canTransition rule).
  const canMarkPaid = showActions && !!onMarkPaid && role === "staff" && !req.paid && req.fee > 0 && req.status !== "Rejected" && !!req.printedAt;
  const canVerify = showActions && !!onStatusChange && role === "staff" && req.status === "Pending";
  const canApprove = showActions && !!onStatusChange && role === "staff" && req.status === "Verified";
  // The first print shows "Print Certificate"; once printedAt is set, the same slot becomes "Reprint".
  const canPrint = showActions && !!onPrintCertificate && role === "staff" && PRINTABLE_STATUSES.includes(req.status);
  // Can't be marked ready until it's both printed and paid for.
  const canMarkReady = showActions && !!onStatusChange && role === "staff" && req.status === "Approved" && !!req.printedAt && req.paid;
  const canMarkReleased = showActions && !!onStatusChange && role === "staff" && req.status === "Ready for Pickup";

  async function handlePrint() {
    if (!onPrintCertificate) return;
    setPrinting(true);
    try {
      await openCertificatePdf(() => onPrintCertificate(req.id), { soft: false });
    } catch {
      toast.error("Could not generate the certificate PDF.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <tr className="border-b border-border">
      <td className="px-5 py-3.5">
        <span className="text-sm font-mono text-primary font-semibold">{req.id}</span>
        {req.source === "Walk-in" && (
          <div><span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700">Walk-in</span></div>
        )}
      </td>
      <td className="px-5 py-3.5">
        <div className="font-semibold text-base text-foreground">{req.residentName}</div>
        <div className="text-sm text-muted-foreground">{req.contactNo}</div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-base text-foreground">{req.docType}</span>
        <div className="text-sm text-muted-foreground">{req.purpose}</div>
      </td>
      <td className="px-5 py-3.5"><StatusBadge status={req.status} /></td>
      <td className="px-5 py-3.5">
        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${req.paid ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {req.paid ? "Paid" : `₱${req.fee} Due`}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm text-muted-foreground">{req.submittedAt}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onView(req)} className={`${actionButtonClass} text-primary hover:bg-primary/10`} title="Open the full request details">
            <Eye size={14} /> View
          </button>
          {canVerify && (
            <button onClick={() => onStatusChange!(req.id, "Verified")} className={`${actionButtonClass} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`} title="Confirm the submitted requirements are complete and correct">
              <CheckCircle size={14} /> Verify
            </button>
          )}
          {canApprove && (
            <button onClick={() => onStatusChange!(req.id, "Approved")} className={`${actionButtonClass} text-indigo-700 bg-indigo-50 hover:bg-indigo-100`} title="Give final approval to release this document">
              <Shield size={14} /> Approve
            </button>
          )}
          {canPrint && (
            <button
              onClick={handlePrint}
              disabled={printing}
              className={`${actionButtonClass} text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60`}
              title={req.printedAt ? "Already printed once — this reprints it" : "Print the official certificate and notify staff to collect payment"}
            >
              <Printer size={14} /> {printing ? "Printing..." : req.printedAt ? "Reprint" : "Print"}
            </button>
          )}
          {canMarkPaid && (
            <button onClick={() => onMarkPaid!(req.id)} className={`${actionButtonClass} text-amber-700 bg-amber-50 hover:bg-amber-100`} title="Record that the fee has been paid at the Barangay Hall">
              <Banknote size={14} /> Mark Paid
            </button>
          )}
          {canMarkReady && (
            <button onClick={() => onStatusChange!(req.id, "Ready for Pickup")} className={`${actionButtonClass} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`} title="Document is printed and paid for -- waiting at the Barangay Hall">
              <Package size={14} /> Ready
            </button>
          )}
          {canMarkReleased && (
            <button onClick={() => onStatusChange!(req.id, "Released")} className={`${actionButtonClass} text-green-700 bg-green-50 hover:bg-green-100`} title="Resident has claimed the document in person">
              <Check size={14} /> Released
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
