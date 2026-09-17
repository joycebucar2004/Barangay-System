import { useEffect, useState } from "react";
import { Calendar, Clock, Eye, CheckCircle, Search, Plus, ClipboardList, ShieldCheck, Package, ScrollText, Info, Banknote } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { RequestRow } from "../components/RequestRow";
import { RequestDetailModal } from "../components/RequestDetailModal";
import { AddUserModal } from "../components/AddUserModal";
import { NotificationsPanel } from "../components/NotificationsPanel";
import type { ApiDocumentType, ApiNotification, ApiRequest, ApiUser, Role, RequestStatus, UserProfileInput } from "../lib/api";

const TABLE_HEADERS = ["Request ID", "Name", "Document / Purpose", "Status", "Payment", "Submitted", "Action"];

const STAFF_STATUS_STYLE: Record<string, string> = {
  Pending: "text-amber-700 bg-amber-50",
  Approved: "text-green-700 bg-green-50",
  Denied: "text-red-700 bg-red-50",
};

export function StaffDashboard({
  section,
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
}: {
  section: string;
  requests: ApiRequest[];
  notifications: ApiNotification[];
  docTypes: ApiDocumentType[];
  users: ApiUser[];
  onStatusChange: (id: string, s: RequestStatus, remarks?: string) => void;
  onMarkPaid: (id: string) => void;
  onPrintCertificate: (id: string) => Promise<ApiRequest | null>;
  onNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onDeleteAllNotifications: () => void;
  onCreateUser: (payload: UserProfileInput & { role: Role }) => Promise<void>;
}) {
  const [selectedRequest, setSelectedRequest] = useState<ApiRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
  // Everything admin has approved (and, once printed, handed off) -- this is staff's queue for
  // collecting payment and moving the request through Ready for Pickup to Released.
  const forRelease = requests.filter((r) => r.status === "Approved" || r.status === "Ready for Pickup");
  const newToday = requests.filter((r) => r.submittedAt === today);

  const displayQueue = section === "verified" ? verified : section === "release" ? forRelease : pending;
  const filtered = displayQueue.filter(
    (r) =>
      r.residentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.docType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      {selectedRequest && (
        <RequestDetailModal req={selectedRequest} docTypes={docTypes} onClose={() => setSelectedRequest(null)} role="staff" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} onPrintCertificate={onPrintCertificate} />
      )}
      {showAddUser && (
        <AddUserModal onClose={() => setShowAddUser(false)} onCreate={onCreateUser} lockRoleToResident />
      )}

      {section === "residents" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Residents</h2>
              <p className="text-muted-foreground text-base">Add resident accounts — new accounts need admin approval before they can sign in.</p>
            </div>
            <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
              <Plus size={16} /> Add User
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-[#f0f3f8]">
                  {["Name", "Email", "Contact No.", "Date Joined", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {residents.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-[#f0f3f8]/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base">{u.name[0]}</div>
                        <span className="font-semibold text-base text-foreground">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-base text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3.5 text-base text-muted-foreground">{u.contactNo || "—"}</td>
                    <td className="px-5 py-3.5 text-base text-muted-foreground">{u.joined}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${STAFF_STATUS_STYLE[u.status]}`}>{u.status}</span>
                    </td>
                  </tr>
                ))}
                {residents.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-base">No resident accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === "dashboard" && (
        <>
          <div>
            <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Staff Dashboard</h2>
            <p className="text-muted-foreground text-base">Barangay Campagao — {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="New Today" value={newToday.length} icon={<Calendar size={20} className="text-primary" />} color="bg-primary/10" />
            <StatCard label="Pending Review" value={pending.length} icon={<Clock size={20} className="text-amber-600" />} color="bg-amber-50" />
            <StatCard label="Awaiting Approval" value={verified.length} icon={<Eye size={20} className="text-indigo-600" />} color="bg-indigo-50" />
            <StatCard label="For Payment/Release" value={forRelease.length} icon={<Banknote size={20} className="text-amber-600" />} color="bg-amber-50" />
            <StatCard label="Released Total" value={requests.filter((r) => r.status === "Released").length} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Info size={18} className="text-primary" />
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>How Requests &amp; Certificates Work</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
              {[
                { icon: <ClipboardList size={16} />, label: "Pending", desc: "Resident submits a request with required files attached." },
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
                Once a request is <span className="font-semibold text-foreground">Verified</span>, open it and use <span className="font-semibold text-foreground">Soft Copy Preview</span> to check the auto-filled certificate — name, address, purpose and civil status are pulled straight from the resident's request. If anything autofilled looks wrong, click directly into the text to fix it before you approve it. After you approve and print the official copy, collect payment, then mark the request <span className="font-semibold text-foreground">Ready for Pickup</span> and, once claimed, <span className="font-semibold text-foreground">Released</span>. Admin can view the certificate and its status, but the approval and printing are yours to handle.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Pending Applications</h3>
            <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#f0f3f8]">
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
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-base">No pending applications.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {(section === "queue" || section === "verified" || section === "release") && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {section === "queue" ? "Request Queue" : section === "verified" ? "For Verification" : "Payment & Release"}
              </h2>
              <p className="text-muted-foreground text-base">
                {section === "release" ? "Approved requests, printed by the admin, waiting on payment and pickup." : `${filtered.length} requests found`}
              </p>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or ID..."
                className="pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-60 transition-all"
              />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-[#f0f3f8]">
                  {TABLE_HEADERS.map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <RequestRow key={r.id} req={r} onView={setSelectedRequest} showActions role="staff" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} onPrintCertificate={onPrintCertificate} />
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-base">No requests found.</td></tr>
                )}
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
