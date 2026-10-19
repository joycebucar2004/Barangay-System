import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock, Eye, CheckCircle, Search, Plus, ClipboardList, ShieldCheck, Package, ScrollText, Info, Banknote, UserPlus, Users, X, Printer, ArrowLeft } from "lucide-react";
import { DashboardHero } from "../components/DashboardHero";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { RequestRow } from "../components/RequestRow";
import { RequestDetailModal } from "../components/RequestDetailModal";
import { AddUserModal } from "../components/AddUserModal";
import { NotificationsPanel } from "../components/NotificationsPanel";
import { WalkInRequestForm } from "../components/WalkInRequestForm";
import type { ApiDocumentType, ApiNotification, ApiPaymentReceipt, ApiRequest, ApiUser, Role, RequestStatus, UserProfileInput } from "../lib/api";

const TABLE_HEADERS = ["Request ID", "Name", "Document / Purpose", "Status", "Payment", "Submitted", "Action"];

const STAFF_STATUS_STYLE: Record<string, string> = {
  Pending: "text-amber-700 bg-amber-50",
  Approved: "text-green-700 bg-green-50",
  Denied: "text-red-700 bg-red-50",
};

function escapeReceiptText(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}

function printReceipt(request: ApiRequest, receipt: ApiPaymentReceipt, balanceAfter: number) {
  const printWindow = window.open("", "_blank", "width=680,height=800");
  if (!printWindow) {
    toast.error("Allow pop-ups to print the receipt.");
    return;
  }
  printWindow.opener = null;
  const row = (label: string, value: string, strong = false) => `<div class="row ${strong ? "strong" : ""}"><span>${escapeReceiptText(label)}</span><span>${escapeReceiptText(value)}</span></div>`;
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeReceiptText(receipt.receiptNumber)}</title><style>*{box-sizing:border-box}body{margin:0;padding:36px;background:#f1f5f9;color:#14233a;font:15px Arial,sans-serif}.receipt{max-width:520px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:14px;padding:30px}.brand{text-align:center;border-bottom:1px dashed #9aa9bc;padding-bottom:20px}.brand h1{margin:0;font-size:21px;color:#173966}.brand p{margin:7px 0 0;color:#64748b;font-size:13px}.number{margin:20px 0;padding:13px;background:#f1f6fc;text-align:center;border-radius:8px}.number small{display:block;color:#64748b;margin-bottom:4px}.number b{font:700 18px monospace;color:#173966}.meta{margin:16px 0 20px}.row{display:flex;justify-content:space-between;gap:20px;margin:11px 0;font-size:14px}.row span:first-child{color:#64748b}.row span:last-child{text-align:right}.strong{border-top:1px solid #dbe3ef;padding-top:13px;margin-top:15px;font-size:16px;font-weight:bold}.thankyou{text-align:center;border-top:1px dashed #9aa9bc;padding-top:17px;margin-top:22px;color:#64748b;font-size:12px}@media print{body{padding:0;background:#fff}.receipt{border:0;border-radius:0}}</style></head><body><main class="receipt"><header class="brand"><h1>Barangay Campagao</h1><p>Payment Receipt</p></header><div class="number"><small>Receipt Number</small><b>${escapeReceiptText(receipt.receiptNumber)}</b></div><section class="meta">${row("Date paid", new Date(receipt.paidAt).toLocaleString())}${row("Resident", `${request.residentName} (${request.residentId})`)}${row("Request", request.id)}${row("Document", request.docType)}${row("Purpose", request.purpose)}</section><section>${row("Request fee", `₱${request.fee.toFixed(2)}`)}${row("Payment applied", `₱${receipt.amount.toFixed(2)}`)}${row("Cash received", `₱${receipt.amountTendered.toFixed(2)}`)}${row("Change", `₱${receipt.change.toFixed(2)}`)}${row("Balance after payment", `₱${balanceAfter.toFixed(2)}`, true)}</section><footer class="thankyou">Thank you. Please keep this receipt for your records.</footer></main></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

export function StaffDashboard({
  section,
  setSection,
  requests,
  notifications,
  docTypes,
  users,
  onStatusChange,
  onMarkPaid,
  onPrintCertificate,
  onNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onDeleteAllNotifications,
  onCreateUser,
  onCreateWalkInRequest,
}: {
  section: string;
  setSection: (s: string) => void;
  requests: ApiRequest[];
  notifications: ApiNotification[];
  docTypes: ApiDocumentType[];
  users: ApiUser[];
  onStatusChange: (id: string, s: RequestStatus, remarks?: string) => void;
  onMarkPaid: (id: string, amountTendered: number) => Promise<void>;
  onPrintCertificate: (id: string) => Promise<ApiRequest | null>;
  onNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onDeleteAllNotifications: () => void;
  onCreateUser: (payload: UserProfileInput & { role: Role }) => Promise<void>;
  onCreateWalkInRequest: (formData: FormData) => Promise<ApiRequest>;
}) {
  type ReceiptSelection = { request: ApiRequest; receipt: ApiPaymentReceipt; balanceAfter: number };
  const [selectedRequest, setSelectedRequest] = useState<ApiRequest | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptSelection | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [billingSearch, setBillingSearch] = useState("");
  const [releasedSearch, setReleasedSearch] = useState("");
  const [selectedBillingResident, setSelectedBillingResident] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const residents = users.filter((u) => u.role === "resident");

  // Keep the open modal's data in sync when the underlying request list updates
  // (e.g. after marking paid or changing status), instead of showing a stale snapshot.
  useEffect(() => {
    if (!selectedRequest) return;
    const updated = requests.find((r) => r.id === selectedRequest.id);
    if (updated && updated !== selectedRequest) setSelectedRequest(updated);
  }, [requests, selectedRequest]);

  const today = new Date().toISOString().split("T")[0];
  const pending = requests.filter((r) => r.status === "Pending");
  const verified = requests.filter((r) => r.status === "Verified");
  // This is the active payment and pickup workflow; the billing ledger keeps completed receipts.
  const forRelease = requests.filter((r) => r.status === "Approved" || r.status === "Ready for Pickup");
  const releasedRequests = requests.filter((r) => r.status === "Released").sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const filteredReleasedRequests = releasedRequests.filter((request) =>
    [request.id, request.residentName, request.residentId, request.docType, request.purpose]
      .some((value) => String(value || "").toLowerCase().includes(releasedSearch.toLowerCase()))
  );
  const newToday = requests.filter((r) => r.submittedAt === today);

  const displayQueue = section === "verified" ? verified : section === "release" || section === "billing" ? forRelease : pending;
  const filtered = displayQueue.filter(
      (r) =>
      r.residentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.residentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.docType.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const billingResidentGroups = section === "billing" ? Array.from(filtered.reduce((groups, request) => {
    const key = request.residentId || request.residentName;
    const group = groups.get(key) || { key, name: request.residentName, residentId: request.residentId, requests: [] as ApiRequest[] };
    group.requests.push(request);
    groups.set(key, group);
    return groups;
  }, new Map<string, { key: string; name: string; residentId: string; requests: ApiRequest[] }>()).values()) : [];
  const selectedBillingRequests = selectedBillingResident
    ? requests.filter((request) => (request.residentId || request.residentName) === selectedBillingResident)
    : [];
  const selectedBillingName = selectedBillingRequests[0]?.residentName || "Client";
  const billingTransactions = requests.flatMap((request) => (request.receipts || []).map((receipt, index) => ({
    request,
    receipt,
    balanceAfter: Math.max(0, request.fee - (request.receipts || []).slice(0, index + 1).reduce((sum, payment) => sum + payment.amount, 0)),
  }))).sort((a, b) => new Date(b.receipt.paidAt).getTime() - new Date(a.receipt.paidAt).getTime());
  const filteredBillingTransactions = billingTransactions.filter(({ request, receipt }) =>
    [receipt.receiptNumber, request.id, request.residentName, request.residentId]
      .some((value) => String(value || "").toLowerCase().includes(billingSearch.toLowerCase()))
  );
  // Count money actually recorded in payment receipts. The legacy paid flag alone has no receipt
  // number or amount and must not inflate staff collection totals.
  const totalCollected = billingTransactions.reduce((sum, transaction) => sum + transaction.receipt.amount, 0);
  const billableRequests = requests.filter((request) => (request.status !== "Rejected" && request.status !== "Cancelled") || request.paid || (request.receipts || []).length > 0);
  const collectedForRequest = (request: ApiRequest) => (request.receipts || []).length
    ? request.receipts!.reduce((sum, receipt) => sum + receipt.amount, 0)
    : request.amountPaid || 0;
  const totalBilled = billableRequests.reduce((sum, request) => sum + (request.status === "Rejected" || request.status === "Cancelled" ? collectedForRequest(request) : request.fee), 0);
  const totalOutstanding = billableRequests.filter((request) => request.status !== "Rejected" && request.status !== "Cancelled" && request.fee > 0)
    .reduce((sum, request) => sum + Math.max(0, request.balance ?? (request.fee - collectedForRequest(request))), 0);

  return (
    <div className="p-8 space-y-6">
      {selectedRequest && (
        <RequestDetailModal req={selectedRequest} docTypes={docTypes} onClose={() => setSelectedRequest(null)} role="staff" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} onPrintCertificate={onPrintCertificate} />
      )}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedReceipt(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="billing-receipt-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-border bg-[#1a3a6b] px-6 py-5 text-white">
              <div><h2 id="billing-receipt-title" className="text-xl font-bold">Payment Receipt</h2><p className="mt-1 font-mono text-sm text-blue-100">{selectedReceipt.receipt.receiptNumber}</p></div>
              <button aria-label="Close receipt" onClick={() => setSelectedReceipt(null)} className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-6">
              <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Date paid</span><span className="text-right font-medium">{new Date(selectedReceipt.receipt.paidAt).toLocaleString()}</span></div>
              <div className="border-t border-dashed border-border pt-4">
                <div className="font-semibold text-foreground">{selectedReceipt.request.residentName}</div>
                <div className="text-sm text-muted-foreground">{selectedReceipt.request.residentId}{selectedReceipt.request.contactNo ? ` · ${selectedReceipt.request.contactNo}` : ""}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <div className="font-semibold text-foreground">{selectedReceipt.request.docType}</div>
                <div className="mt-1 text-muted-foreground">Request {selectedReceipt.request.id} · {selectedReceipt.request.purpose}</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Request fee</span><span>₱{selectedReceipt.request.fee.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold"><span>Payment received for fee</span><span>₱{selectedReceipt.receipt.amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cash received</span><span>₱{selectedReceipt.receipt.amountTendered.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Change</span><span>₱{selectedReceipt.receipt.change.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Balance after payment</span><span>₱{selectedReceipt.balanceAfter.toFixed(2)}</span></div>
              </div>
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button onClick={() => printReceipt(selectedReceipt.request, selectedReceipt.receipt, selectedReceipt.balanceAfter)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"><Printer size={16} />Print Receipt</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {showAddUser && (
        <AddUserModal onClose={() => setShowAddUser(false)} onCreate={onCreateUser} lockRoleToResident />
      )}

      {section === "walk-in" && (
        <>
          <PageHeader icon={<UserPlus size={22} />} title="Walk-in Request" subtitle="For someone at the counter who doesn't have an online account. The request joins the normal queue." />
          <div className="ui-card p-8">
            <WalkInRequestForm docTypes={docTypes} residents={residents} onSubmit={onCreateWalkInRequest} />
          </div>
        </>
      )}

      {section === "residents" && (
        <>
          <PageHeader icon={<Users size={22} />} title="Residents" subtitle="Add resident accounts — new accounts need admin approval before they can sign in.">
            <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
              <Plus size={16} /> Add User
            </button>
          </PageHeader>
          <div className="ui-table-card">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="ui-thead">
                  {["Name", "Email", "Contact No.", "Date Joined", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {residents.map((u) => (
                  <tr key={u.id} className="border-b border-border">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base">{u.name[0]}</div>
                        <span className="font-semibold text-base text-foreground">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-base text-muted-foreground">{u.email || "—"}</td>
                    <td className="px-5 py-3.5 text-base text-muted-foreground">{u.contactNo || "—"}</td>
                    <td className="px-5 py-3.5 text-base text-muted-foreground">{u.joined}</td>
                    <td className="px-5 py-3.5">
                      {u.accountType === "Walk-in" ? (
                        <span className="text-sm font-semibold px-2 py-0.5 rounded-full text-orange-700 bg-orange-50">Walk-in</span>
                      ) : (
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${STAFF_STATUS_STYLE[u.status || "Pending"]}`}>{u.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {residents.length === 0 && (
                  <tr><td colSpan={5} className="ui-empty text-base">No resident accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === "dashboard" && (
        <>
          <DashboardHero
            eyebrow="Staff Portal"
            title="Staff Dashboard"
            subtitle={pending.length > 0 ? `${pending.length} request${pending.length === 1 ? "" : "s"} waiting for your review today.` : "All caught up — no requests waiting for review."}
            actions={[
              { label: "Walk-in Request", icon: <UserPlus size={16} />, onClick: () => setSection("walk-in"), primary: true },
              { label: "Request Queue", icon: <ClipboardList size={16} />, onClick: () => setSection("queue") },
            ]}
          />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="New Today" value={newToday.length} icon={<Calendar size={20} className="text-primary" />} color="bg-primary/10" />
            <StatCard label="Pending Review" value={pending.length} icon={<Clock size={20} className="text-amber-600" />} color="bg-amber-50" />
            <StatCard label="Awaiting Approval" value={verified.length} icon={<Eye size={20} className="text-indigo-600" />} color="bg-indigo-50" />
            <StatCard label="Payments Queue" value={forRelease.length} icon={<Banknote size={20} className="text-amber-600" />} color="bg-amber-50" />
            <StatCard label="Released Total" value={releasedRequests.length} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Info size={18} className="text-primary" />
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>How Requests &amp; Certificates Work</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
              {[
                { icon: <ClipboardList size={16} />, label: "Pending", desc: "Resident submits online, or you encode a Walk-in Request at the counter." },
                { icon: <Eye size={16} />, label: "Verified", desc: "You check the uploaded files and verify or reject them." },
                { icon: <ShieldCheck size={16} />, label: "Approved", desc: "You give final approval, then print the official certificate." },
                { icon: <Package size={16} />, label: "Ready for Pickup", desc: "Once printed and the fee is paid, mark it ready at the Barangay Hall." },
                { icon: <CheckCircle size={16} />, label: "Released", desc: "Resident claims the printed, signed certificate." },
              ].map((step, i) => (
                <div key={step.label} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">{step.icon}</div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{i + 1}. {step.label}</div>
                    <div className="text-xs text-muted-foreground leading-snug">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2.5 bg-[#f0f3f8] border border-border rounded-lg px-3.5 py-3">
              <ScrollText size={16} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Once a request is <span className="font-semibold text-foreground">Verified</span>, open it and use <span className="font-semibold text-foreground">Soft Copy (PDF)</span> to check the certificate — name, address, purpose and civil status are filled in from the resident's request. The wording itself comes from the admin's certificate template for that document type. After you approve the request, record payment first so the receipt number is available, then print the official copy. Mark it <span className="font-semibold text-foreground">Ready for Pickup</span> and, once claimed, <span className="font-semibold text-foreground">Released</span>.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Pending Applications</h3>
            <div className="ui-table-card">
              <table className="w-full">
                <thead>
                  <tr className="ui-thead">
                    {TABLE_HEADERS.map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.slice(0, 5).map((r) => (
                    <RequestRow key={r.id} req={r} onView={setSelectedRequest} showActions role="staff" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} onPrintCertificate={onPrintCertificate} />
                  ))}
                  {pending.length === 0 && (
                    <tr><td colSpan={7} className="ui-empty text-base">No pending applications.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {(section === "queue" || section === "verified" || section === "billing") && (
        <>
          <PageHeader
            icon={section === "queue" ? <ClipboardList size={22} /> : section === "verified" ? <Eye size={22} /> : <Banknote size={22} />}
            title={section === "queue" ? "Request Queue" : section === "verified" ? "For Verification" : section === "billing" && selectedBillingResident ? selectedBillingName : "Billing & Releasing"}
            subtitle={section === "billing" ? selectedBillingResident ? `${selectedBillingRequests.length} certificate request${selectedBillingRequests.length === 1 ? "" : "s"} for this client` : "Manage approved requests through payment, pickup, and handover. Released documents are kept in Released Documents." : `${filtered.length} request${filtered.length === 1 ? "" : "s"} found`}
          >
            {section === "billing" && selectedBillingResident ? (
              <button onClick={() => setSelectedBillingResident(null)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:bg-muted"><ArrowLeft size={16} /> Back to clients</button>
            ) : <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={section === "billing" ? "Search client, request or certificate..." : "Search by name or ID..."}
                className="pl-9 pr-3 py-2.5 rounded-xl border border-border bg-[#f7f9fc] text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white w-60 transition-all"
              />
            </div>}
          </PageHeader>
          {section === "billing" && !selectedBillingResident && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Total Billed" value={`₱${totalBilled.toFixed(2)}`} icon={<ClipboardList size={20} className="text-primary" />} color="bg-primary/10" />
              <StatCard label="Total Collected" value={`₱${totalCollected.toFixed(2)}`} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
              <StatCard label="Outstanding Balance" value={`₱${totalOutstanding.toFixed(2)}`} icon={<Banknote size={20} className="text-amber-600" />} color="bg-amber-50" />
            </div>
          )}
          {section === "billing" && selectedBillingResident && (
            <div className="flex items-center justify-end rounded-2xl border border-border bg-white px-6 py-4 shadow-sm">
              <div className="text-right"><div className="text-sm text-muted-foreground">Total paid by {selectedBillingName}</div><div className="text-2xl font-bold text-foreground">₱{selectedBillingRequests.reduce((sum, request) => sum + collectedForRequest(request), 0).toFixed(2)}</div></div>
            </div>
          )}
          <div className="ui-table-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="ui-thead">
                  {(section === "billing" ? selectedBillingResident ? TABLE_HEADERS : ["Client", "Certificates", "Status", "Paid / Due"] : TABLE_HEADERS).map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section === "billing" && selectedBillingResident ? selectedBillingRequests.map((request) => (
                  <RequestRow key={request.id} req={request} onView={setSelectedRequest} showActions role="staff" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} onPrintCertificate={onPrintCertificate} />
                )) : section === "billing" ? billingResidentGroups.map((group) => {
                  const paidTotal = group.requests.reduce((sum, request) => sum + collectedForRequest(request), 0);
                  const dueTotal = group.requests.reduce((sum, request) => sum + (request.fee > 0 ? Math.max(0, request.balance ?? (request.fee - collectedForRequest(request))) : 0), 0);
                  return <tr key={group.key} onClick={() => setSelectedBillingResident(group.key)} className="border-b border-border cursor-pointer hover:bg-muted/30" title={`View ${group.name}'s client record`}>
                      <td className="px-5 py-3.5"><div className="font-semibold">{group.name}</div><div className="text-xs text-muted-foreground">{group.residentId}</div></td>
                      <td className="px-5 py-3.5 text-sm">{group.requests.length} certificate{group.requests.length === 1 ? "" : "s"}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{group.requests.map((request) => request.status).filter((value, index, all) => all.indexOf(value) === index).join(", ")}</td>
                      <td className="px-5 py-3.5 text-sm"><span className="font-semibold text-green-700">₱{paidTotal.toFixed(2)} paid</span><div className="text-amber-700">₱{dueTotal.toFixed(2)} due</div></td>
                  </tr>;
                }) : filtered.map((r) => (
                  <RequestRow key={r.id} req={r} onView={setSelectedRequest} showActions role="staff" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} onPrintCertificate={onPrintCertificate} />
                ))}
                {(section === "billing" ? (selectedBillingResident ? selectedBillingRequests.length === 0 : billingResidentGroups.length === 0) : filtered.length === 0) && (
                  <tr><td colSpan={section === "billing" && !selectedBillingResident ? 4 : 7} className="ui-empty text-base">{section === "billing" && selectedBillingResident ? "No certificate requests found for this client." : "No requests found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === "release" && (
        <div className="space-y-6">
          <PageHeader icon={<ClipboardList size={22} />} title="Payment Transactions" subtitle={`${filteredBillingTransactions.length} of ${billingTransactions.length} transactions`}>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={billingSearch} onChange={(e) => setBillingSearch(e.target.value)} placeholder="Search receipt, resident or request..." className="pl-9 pr-3 py-2.5 rounded-xl border border-border bg-[#f7f9fc] text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white w-72 transition-all" />
            </div>
          </PageHeader>
          <div className="ui-table-card overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr className="ui-thead">{["Receipt No.", "Date & Time", "Resident", "Request ID", "Fee", "Payment", "Cash Received", "Change", "Balance After"].map((heading) => <th key={heading} className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{heading}</th>)}</tr></thead>
              <tbody>
                {filteredBillingTransactions.map(({ request, receipt, balanceAfter }) => (
                  <tr key={receipt.receiptNumber} onClick={() => setSelectedReceipt({ request, receipt, balanceAfter })} className="border-b border-border hover:bg-muted/30 cursor-pointer" title="View receipt">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-primary">{receipt.receiptNumber}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{new Date(receipt.paidAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm"><div className="font-semibold">{request.residentName}</div><div className="text-xs text-muted-foreground">{request.residentId}</div></td>
                    <td className="px-4 py-3 text-sm font-mono">{request.id}</td>
                    <td className="px-4 py-3 text-sm">₱{request.fee.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-700">₱{receipt.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">₱{receipt.amountTendered.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">₱{receipt.change.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-semibold">₱{balanceAfter.toFixed(2)}</td>
                  </tr>
                ))}
                {filteredBillingTransactions.length === 0 && <tr><td colSpan={9} className="ui-empty text-base">{billingTransactions.length ? "No transactions match your search." : "No payments have been recorded yet."}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Select a transaction to view its receipt. Active requests awaiting payment or pickup are managed in Payments &amp; Releasing.</p>
        </div>
      )}

      {section === "released" && (
        <>
          <PageHeader icon={<CheckCircle size={22} />} title="Released Documents" subtitle={`${filteredReleasedRequests.length} of ${releasedRequests.length} document${releasedRequests.length === 1 ? "" : "s"} recorded as released`}>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={releasedSearch} onChange={(event) => setReleasedSearch(event.target.value)} placeholder="Search resident, request or document..." className="pl-9 pr-3 py-2.5 rounded-xl border border-border bg-[#f7f9fc] text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white w-72 transition-all" />
            </div>
          </PageHeader>
          <div className="ui-table-card overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead><tr className="ui-thead">{["Request ID", "Resident", "Document", "Purpose", "Released On", "Payment", "Record"].map((heading) => <th key={heading} className="px-5 py-3.5 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">{heading}</th>)}</tr></thead>
              <tbody>
                {filteredReleasedRequests.map((request) => (
                  <tr key={request.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-5 py-3.5 font-mono text-sm font-semibold">{request.id}</td>
                    <td className="px-5 py-3.5 text-sm">{request.residentName}</td>
                    <td className="px-5 py-3.5 text-sm">{request.docType}</td>
                    <td className="px-5 py-3.5 text-sm">{request.purpose}</td>
                    <td className="px-5 py-3.5 text-sm">{request.updatedAt ? new Date(`${request.updatedAt.slice(0, 10)}T00:00:00`).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3.5 text-sm">{request.fee === 0 ? "Free" : request.paid ? "Paid" : `₱${(request.balance ?? request.fee).toFixed(2)} due`}</td>
                    <td className="px-5 py-3.5"><button onClick={() => setSelectedRequest(request)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-primary hover:bg-muted"><Eye size={14} /> View</button></td>
                  </tr>
                ))}
                {filteredReleasedRequests.length === 0 && <tr><td colSpan={7} className="ui-empty text-base">{releasedRequests.length ? "No released documents match your search." : "No documents have been released yet."}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === "notifications" && (
        <NotificationsPanel
          notifications={notifications}
          onRead={onNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onDelete={onDeleteNotification}
          onDeleteAll={onDeleteAllNotifications}
          shared
        />
      )}
    </div>
  );
}

