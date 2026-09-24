import { useEffect, useState } from "react";
import { Calendar, Clock, Eye, CheckCircle, Search, Plus, ClipboardList, ShieldCheck, Package, ScrollText, Info, Banknote, UserPlus, Users } from "lucide-react";
import { DashboardHero } from "../components/DashboardHero";
import { PageHeader } from "../components/PageHeader";
import { ReportsView } from "../components/ReportsView";
import { StatCard } from "../components/StatCard";
import { RequestRow } from "../components/RequestRow";
import { RequestDetailModal } from "../components/RequestDetailModal";
import { AddUserModal } from "../components/AddUserModal";
import { NotificationsPanel } from "../components/NotificationsPanel";
import { WalkInRequestForm } from "../components/WalkInRequestForm";
import type { ReportsSummary, ApiDocumentType, ApiNotification, ApiRequest, ApiUser, Role, RequestStatus, UserProfileInput } from "../lib/api";

const TABLE_HEADERS = ["Request ID", "Name", "Document / Purpose", "Status", "Payment", "Submitted", "Action"];

const STAFF_STATUS_STYLE: Record<string, string> = {
  Pending: "text-amber-700 bg-amber-50",
  Approved: "text-green-700 bg-green-50",
  Denied: "text-red-700 bg-red-50",
};

export function StaffDashboard({
  section,
  setSection,
  requests,
  notifications,
  docTypes,
  users,
  reports,
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
  reports: ReportsSummary | null;
  onStatusChange: (id: string, s: RequestStatus, remarks?: string) => void;
  onMarkPaid: (id: string) => void;
  onPrintCertificate: (id: string) => Promise<ApiRequest | null>;
  onNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onDeleteAllNotifications: () => void;
  onCreateUser: (payload: UserProfileInput & { role: Role }) => Promise<void>;
  onCreateWalkInRequest: (formData: FormData) => Promise<ApiRequest>;
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
            <StatCard label="For Payment/Release" value={forRelease.length} icon={<Banknote size={20} className="text-amber-600" />} color="bg-amber-50" />
            <StatCard label="Released Total" value={requests.filter((r) => r.status === "Released").length} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
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
                Once a request is <span className="font-semibold text-foreground">Verified</span>, open it and use <span className="font-semibold text-foreground">Soft Copy (PDF)</span> to check the certificate — name, address, purpose and civil status are filled in from the resident's request. The wording itself comes from the admin's certificate template for that document type. After you approve and print the official copy, collect payment, then mark the request <span className="font-semibold text-foreground">Ready for Pickup</span> and, once claimed, <span className="font-semibold text-foreground">Released</span>.
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

      {(section === "queue" || section === "verified" || section === "release") && (
        <>
          <PageHeader
            icon={section === "queue" ? <ClipboardList size={22} /> : section === "verified" ? <Eye size={22} /> : <Banknote size={22} />}
            title={section === "queue" ? "Request Queue" : section === "verified" ? "For Verification" : "Payment & Release"}
            subtitle={section === "release" ? "Approved requests waiting on printing, payment and pickup." : `${filtered.length} request${filtered.length === 1 ? "" : "s"} found`}
          >
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or ID..."
                className="pl-9 pr-3 py-2.5 rounded-xl border border-border bg-[#f7f9fc] text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white w-60 transition-all"
              />
            </div>
          </PageHeader>
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
                {filtered.map((r) => (
                  <RequestRow key={r.id} req={r} onView={setSelectedRequest} showActions role="staff" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} onPrintCertificate={onPrintCertificate} />
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="ui-empty text-base">No requests found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === "reports" && (
        <div className="-m-8">
          <ReportsView reports={reports} requests={requests} />
        </div>
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
