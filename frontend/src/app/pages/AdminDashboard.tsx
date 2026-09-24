import { useEffect, useState } from "react";
import {
  ClipboardList,
  Shield,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Download,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Trash2,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { RequestRow } from "../components/RequestRow";
import { RequestDetailModal } from "../components/RequestDetailModal";
import { StatusBadge } from "../components/StatusBadge";
import { AddUserModal } from "../components/AddUserModal";
import { UserDetailModal } from "../components/UserDetailModal";
import { NotificationsPanel } from "../components/NotificationsPanel";
import { CertificateEditorModal } from "../components/CertificateEditorModal";
import type { CertificateContent, AnnouncementTag, ApiAnnouncement, ApiDocumentType, ApiDocumentTypeRequirement, ApiNotification, ApiRequest, ApiUser, ReportsSummary, RequestStatus, Role, UserProfileInput, UserStatus, UserDisplayStatus } from "../lib/api";

const TABLE_HEADERS = ["Request ID", "Name", "Document / Purpose", "Status", "Payment", "Submitted", "Action"];
const STATUS_ORDER: RequestStatus[] = ["Pending", "Verified", "Approved", "Ready for Pickup", "Released", "Rejected", "Cancelled"];

function exportRequestsCsv(requests: ApiRequest[]) {
  const header = "ID,Resident,Document,Source,Encoded By,Status,Fee,Paid,Submitted,Updated\n";
  const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = requests
    .map((r) => [r.id, r.residentName, r.docType, r.source || "Online", r.encodedByName || "", r.status, r.fee, r.paid, r.submittedAt, r.updatedAt].map(csvCell).join(","))
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `barangay-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Pending/Denied are still admin-driven decisions (editable dropdown). Once Approved, the
// account reads as Active and is no longer editable here -- it only ever becomes Inactive
// automatically, after a year with no login.
const USER_STATUS_OPTIONS: UserStatus[] = ["Pending", "Denied", "Approved"];
const USER_STATUS_STYLE: Record<UserStatus, string> = {
  Pending: "text-amber-700 bg-amber-50 border-amber-200",
  Denied: "text-red-700 bg-red-50 border-red-200",
  Approved: "text-green-700 bg-green-50 border-green-200",
};
const DISPLAY_STATUS_STYLE: Record<UserDisplayStatus, string> = {
  Pending: "text-amber-700 bg-amber-50 border-amber-200",
  Denied: "text-red-700 bg-red-50 border-red-200",
  Active: "text-green-700 bg-green-50 border-green-200",
  Inactive: "text-gray-600 bg-gray-100 border-gray-200",
  "Walk-in": "text-orange-700 bg-orange-50 border-orange-200",
};

const ANNOUNCEMENT_TAGS: AnnouncementTag[] = ["Advisory", "Announcement", "Event", "Notice"];
const ANNOUNCEMENT_TAG_STYLE: Record<AnnouncementTag, string> = {
  Advisory: "bg-amber-50 text-amber-700",
  Announcement: "bg-blue-50 text-blue-700",
  Event: "bg-emerald-50 text-emerald-700",
  Notice: "bg-rose-50 text-rose-700",
};

const announcementInputClass = "w-full px-3 py-2 rounded-lg border border-border bg-[#f0f3f8] text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

export function AdminDashboard({
  section,
  requests,
  docTypes,
  users,
  reports,
  announcements,
  notifications,
  onStatusChange,
  onMarkPaid,
  onSaveCertificateTemplate,
  onCreateUser,
  onUpdateUserStatus,
  onUpdateDocumentType,
  onCreateDocumentType,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onDeleteAllNotifications,
}: {
  section: string;
  requests: ApiRequest[];
  docTypes: ApiDocumentType[];
  users: ApiUser[];
  reports: ReportsSummary | null;
  announcements: ApiAnnouncement[];
  notifications: ApiNotification[];
  onStatusChange: (id: string, s: RequestStatus, remarks?: string) => void;
  onMarkPaid: (id: string) => void;
  onSaveCertificateTemplate: (name: string, template: CertificateContent | null) => Promise<void>;
  onCreateUser: (payload: UserProfileInput & { role: Role }) => Promise<void>;
  onUpdateUserStatus: (id: string, status: UserStatus) => Promise<void>;
  onUpdateDocumentType: (name: string, payload: { fee?: number; requirements?: ApiDocumentTypeRequirement[] }) => Promise<void>;
  onCreateDocumentType: (payload: { name: string; fee: number; requirements: ApiDocumentTypeRequirement[] }) => Promise<void>;
  onCreateAnnouncement: (payload: { tag: AnnouncementTag; title: string; body: string; date?: string }) => Promise<void>;
  onUpdateAnnouncement: (id: string, payload: Partial<{ tag: AnnouncementTag; title: string; body: string; date: string }>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onDeleteAllNotifications: () => void;
}) {
  const [selectedRequest, setSelectedRequest] = useState<ApiRequest | null>(null);
  // Keep the open modal's data in sync when the underlying request list updates
  // (e.g. after marking paid or changing status), instead of showing a stale snapshot.
  useEffect(() => {
    if (!selectedRequest) return;
    const updated = requests.find((r) => r.id === selectedRequest.id);
    if (updated && updated !== selectedRequest) setSelectedRequest(updated);
  }, [requests, selectedRequest]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [templateDoc, setTemplateDoc] = useState<string | null>(null);
  const [editFee, setEditFee] = useState(0);
  const [editReqs, setEditReqs] = useState<ApiDocumentTypeRequirement[]>([]);

  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocFee, setNewDocFee] = useState(0);
  const [newDocReqs, setNewDocReqs] = useState<ApiDocumentTypeRequirement[]>([{ requirement: "", required: true }]);
  const [newDocError, setNewDocError] = useState("");

  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [newTag, setNewTag] = useState<AnnouncementTag>("Announcement");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState<string | null>(null);
  const [editTag, setEditTag] = useState<AnnouncementTag>("Announcement");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  // "For Approval" = requests that have been staff-verified and are awaiting staff's approve
  // decision. Admin only views this list -- it has no approve action here.
  const awaitingApproval = requests.filter((r) => r.status === "Verified");
  const allFiltered = requests.filter(
    (r) =>
      r.residentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.docType.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const revenue = requests.filter((r) => r.paid).reduce((sum, r) => sum + (r.fee || 0), 0);

  function startEdit(doc: ApiDocumentType) {
    setEditingDoc(doc.name);
    setEditFee(doc.fee);
    setEditReqs(doc.requirements.map((r) => ({ ...r })));
  }

  function addRequirementRow() {
    setEditReqs((prev) => [...prev, { requirement: "", required: true }]);
  }

  function updateRequirementRow(index: number, patch: Partial<ApiDocumentTypeRequirement>) {
    setEditReqs((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRequirementRow(index: number) {
    setEditReqs((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveEdit(name: string) {
    await onUpdateDocumentType(name, {
      fee: editFee,
      requirements: editReqs.map((r) => ({ requirement: r.requirement.trim(), required: r.required })).filter((r) => r.requirement),
    });
    setEditingDoc(null);
  }

  function addNewDocReqRow() {
    setNewDocReqs((prev) => [...prev, { requirement: "", required: true }]);
  }

  function updateNewDocReqRow(index: number, patch: Partial<ApiDocumentTypeRequirement>) {
    setNewDocReqs((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeNewDocReqRow(index: number) {
    setNewDocReqs((prev) => prev.filter((_, i) => i !== index));
  }

  function resetNewDocForm() {
    setNewDocName("");
    setNewDocFee(0);
    setNewDocReqs([{ requirement: "", required: true }]);
    setNewDocError("");
    setShowNewDoc(false);
  }

  async function submitNewDocumentType() {
    const name = newDocName.trim();
    const requirements = newDocReqs.map((r) => ({ requirement: r.requirement.trim(), required: r.required })).filter((r) => r.requirement);
    if (!name) {
      setNewDocError("Document name is required.");
      return;
    }
    if (docTypes.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      setNewDocError("A document type with this name already exists.");
      return;
    }
    setNewDocError("");
    try {
      await onCreateDocumentType({ name, fee: newDocFee, requirements });
      resetNewDocForm();
    } catch (err: any) {
      setNewDocError(err.message || "Failed to add document type.");
    }
  }

  async function submitNewAnnouncement() {
    if (!newTitle || !newBody) return;
    await onCreateAnnouncement({ tag: newTag, title: newTitle, body: newBody });
    setNewTag("Announcement");
    setNewTitle("");
    setNewBody("");
    setShowNewAnnouncement(false);
  }

  function startEditAnnouncement(a: ApiAnnouncement) {
    setEditingAnnouncement(a.id);
    setEditTag(a.tag);
    setEditTitle(a.title);
    setEditBody(a.body);
  }

  async function saveEditAnnouncement(id: string) {
    await onUpdateAnnouncement(id, { tag: editTag, title: editTitle, body: editBody });
    setEditingAnnouncement(null);
  }

  if (section === "notifications") {
    return (
      <div className="p-8">
        <NotificationsPanel
          notifications={notifications}
          onRead={onNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onDelete={onDeleteNotification}
          onDeleteAll={onDeleteAllNotifications}
          shared
        />
      </div>
    );
  }

  if (section === "reports") {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Reports & Analytics</h2>
            <p className="text-muted-foreground text-base">Barangay Campagao — {new Date().toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</p>
          </div>
          <button onClick={() => exportRequestsCsv(requests)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
            <Download size={16} /> Export Report
          </button>
        </div>

        {!reports ? (
          <div className="text-base text-muted-foreground">Loading reports...</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Total This Month" value={reports.totalThisMonth} icon={<TrendingUp size={20} className="text-primary" />} color="bg-primary/10" />
              <StatCard label="Released This Month" value={reports.releasedThisMonth} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
              <StatCard label="Revenue Collected" value={`₱${reports.revenue.toLocaleString()}`} icon={<DollarSign size={20} className="text-[#d4a017]" />} color="bg-amber-50" />
            </div>

            {reports.sources && (
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h4 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Online vs Walk-in</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { label: "Requests (all time)", online: reports.sources.requests.Online, walkIn: reports.sources.requests["Walk-in"] },
                    { label: "Requests this month", online: reports.sources.requestsThisMonth.Online, walkIn: reports.sources.requestsThisMonth["Walk-in"] },
                    { label: "Resident records", online: reports.sources.residents.Online, walkIn: reports.sources.residents["Walk-in"] },
                  ].map((row) => (
                    <div key={row.label} className="p-3 rounded-lg bg-[#f0f3f8]">
                      <div className="text-sm text-muted-foreground mb-2">{row.label}</div>
                      <div className="flex items-baseline gap-4">
                        <div>
                          <div className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{row.online}</div>
                          <div className="text-xs font-semibold text-blue-700">Online</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{row.walkIn}</div>
                          <div className="text-xs font-semibold text-orange-700">Walk-in</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h4 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Monthly Requests</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={reports.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#5a6a82" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 13, fill: "#5a6a82" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #dde3ed", fontSize: "13px" }} />
                    <Bar dataKey="requests" fill="#1a3a6b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h4 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Document Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={reports.distribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {reports.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #dde3ed", fontSize: "13px" }} />
                    <Legend iconSize={11} iconType="circle" wrapperStyle={{ fontSize: "13px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <h4 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Status Breakdown</h4>
              <div className="grid grid-cols-3 lg:grid-cols-7 gap-3">
                {STATUS_ORDER.map((status) => (
                  <div key={status} className="text-center p-3 rounded-lg bg-[#f0f3f8]">
                    <div className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{reports.statusCounts[status] || 0}</div>
                    <StatusBadge status={status} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (section === "users") {
    return (
      <div className="p-8 space-y-6">
        {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} onCreate={onCreateUser} />}
        {viewUserId && <UserDetailModal userId={viewUserId} onClose={() => setViewUserId(null)} />}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>User Accounts</h2>
            <p className="text-muted-foreground text-base">
              {users.filter((u) => u.accountType === "Walk-in").length} walk-in record(s) added by staff. These have no login.
            </p>
          </div>
          <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Add User
          </button>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-border bg-[#f0f3f8]">
                {["ID", "Name", "Gender", "Date of Birth", "Email", "Contact No.", "Role", "Date Joined", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-[#f0f3f8]/70 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{u.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base">{u.name[0]}</div>
                      <span className="font-semibold text-base text-foreground">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-base text-muted-foreground">{u.gender}</td>
                  <td className="px-5 py-3.5 text-base text-muted-foreground">{u.dateOfBirth}</td>
                  <td className="px-5 py-3.5 text-base text-muted-foreground">{u.email || "—"}</td>
                  <td className="px-5 py-3.5 text-base text-muted-foreground">{u.contactNo || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full capitalize ${u.role === "staff" ? "bg-indigo-50 text-indigo-700" : u.role === "admin" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3.5 text-base text-muted-foreground">{u.joined}</td>
                  <td className="px-5 py-3.5">
                    {u.status === "Approved" || u.accountType === "Walk-in" ? (
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-full border ${DISPLAY_STATUS_STYLE[u.displayStatus || "Active"]}`}>
                        {u.displayStatus}
                      </span>
                    ) : (
                      <select
                        value={u.status}
                        onChange={(e) => onUpdateUserStatus(u.id, e.target.value as UserStatus)}
                        className={`text-sm font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${USER_STATUS_STYLE[u.status || "Pending"]}`}
                      >
                        {USER_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => setViewUserId(u.id)}
                      title="View full account details"
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-base">No user accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === "documents") {
    const templateDocType = docTypes.find((d) => d.name === templateDoc);
    return (
      <div className="p-8 space-y-6">
        {templateDocType && (
          <CertificateEditorModal docType={templateDocType} onClose={() => setTemplateDoc(null)} onSave={onSaveCertificateTemplate} />
        )}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Document Types & Fees</h2>
          <button onClick={() => setShowNewDoc((v) => !v)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={16} /> New Document
          </button>
        </div>

        {showNewDoc && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
            {newDocError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{newDocError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Document Name</label>
                <input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="e.g. Certificate of Cohabitation" className={announcementInputClass} />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Fee (₱)</label>
                <input
                  type="number"
                  value={newDocFee}
                  onChange={(e) => setNewDocFee(Number(e.target.value))}
                  className={announcementInputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Requirements</label>
              <div className="space-y-2">
                {newDocReqs.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={r.requirement}
                      onChange={(e) => updateNewDocReqRow(i, { requirement: e.target.value })}
                      placeholder="e.g. Valid Government ID"
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-[#f0f3f8] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground flex-shrink-0 select-none cursor-pointer">
                      <input type="checkbox" checked={r.required} onChange={(e) => updateNewDocReqRow(i, { required: e.target.checked })} />
                      Required
                    </label>
                    <button onClick={() => removeNewDocReqRow(i)} title="Remove" className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addNewDocReqRow} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
                  <Plus size={14} /> Add requirement
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={resetNewDocForm} className="px-4 py-1.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
              <button onClick={submitNewDocumentType} disabled={!newDocName.trim()} className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">Add Document Type</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {docTypes.map((doc) => (
            <div key={doc.name} className="bg-card border border-border rounded-xl p-5 shadow-sm">
              {editingDoc === doc.name ? (
                <div className="space-y-3">
                  <div className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{doc.name}</div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Fee (₱)</label>
                    <input
                      type="number"
                      value={editFee}
                      onChange={(e) => setEditFee(Number(e.target.value))}
                      className="w-32 px-3 py-2 rounded-lg border border-border bg-[#f0f3f8] text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">Requirements</label>
                    <div className="space-y-2">
                      {editReqs.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={r.requirement}
                            onChange={(e) => updateRequirementRow(i, { requirement: e.target.value })}
                            placeholder="e.g. Valid Government ID"
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-[#f0f3f8] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          />
                          <label className="flex items-center gap-1.5 text-sm text-muted-foreground flex-shrink-0 select-none cursor-pointer">
                            <input type="checkbox" checked={r.required} onChange={(e) => updateRequirementRow(i, { required: e.target.checked })} />
                            Required
                          </label>
                          <button onClick={() => removeRequirementRow(i)} title="Remove" className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button onClick={addRequirementRow} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
                        <Plus size={14} /> Add requirement
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingDoc(null)} className="px-4 py-1.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={() => saveEdit(doc.name)} className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{doc.name}</div>
                      <div className="text-base text-muted-foreground">Fee: <span className="font-semibold text-foreground">{doc.fee === 0 ? "Free (Indigent)" : `₱${doc.fee}`}</span></div>
                      <div className="text-sm text-muted-foreground">Certificate: {doc.certificateTemplate ? <span className="font-semibold text-indigo-700">Custom template</span> : "Default wording"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setTemplateDoc(doc.name)} className="text-sm text-white bg-primary font-semibold px-3 py-1 rounded-lg hover:bg-primary/90 transition-colors" title="Edit the certificate wording used for every request of this type">
                        Edit Certificate
                      </button>
                      <button onClick={() => startEdit(doc)} className="text-sm text-primary font-semibold hover:underline px-3 py-1 rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors">Edit Fee & Requirements</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.requirements.map((r, i) => (
                      <span key={i} className={`text-sm px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${r.required ? "bg-[#f0f3f8] text-muted-foreground border-border" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                        {r.requirement}
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${r.required ? "text-red-500" : "text-slate-400"}`}>{r.required ? "Req" : "Opt"}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "announcements") {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Announcements</h2>
          <button onClick={() => setShowNewAnnouncement((v) => !v)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={16} /> New Announcement
          </button>
        </div>

        {showNewAnnouncement && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Tag</label>
                <select value={newTag} onChange={(e) => setNewTag(e.target.value as AnnouncementTag)} className={announcementInputClass}>
                  {ANNOUNCEMENT_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Title</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Announcement title" className={announcementInputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Details</label>
              <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={3} placeholder="What residents need to know..." className={announcementInputClass} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewAnnouncement(false)} className="px-4 py-1.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
              <button onClick={submitNewAnnouncement} disabled={!newTitle || !newBody} className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">Post</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {announcements.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
              {editingAnnouncement === a.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Tag</label>
                      <select value={editTag} onChange={(e) => setEditTag(e.target.value as AnnouncementTag)} className={announcementInputClass}>
                        {ANNOUNCEMENT_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Title</label>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={announcementInputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Details</label>
                    <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} className={announcementInputClass} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingAnnouncement(null)} className="px-4 py-1.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={() => saveEditAnnouncement(a.id)} className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${ANNOUNCEMENT_TAG_STYLE[a.tag]}`}>{a.tag}</span>
                      <span className="text-muted-foreground text-sm">{a.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => startEditAnnouncement(a)} className="text-sm text-primary font-semibold hover:underline">Edit</button>
                      <button onClick={() => onDeleteAnnouncement(a.id)} className="text-red-600 hover:text-red-700 transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-foreground mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{a.title}</div>
                  <p className="text-base text-muted-foreground">{a.body}</p>
                </>
              )}
            </div>
          ))}
          {announcements.length === 0 && !showNewAnnouncement && (
            <div className="text-center text-muted-foreground text-base py-12">No announcements posted yet.</div>
          )}
        </div>
      </div>
    );
  }

  if (section === "approvals") {
    return (
      <div className="p-8 space-y-6">
        {selectedRequest && (
          <RequestDetailModal req={selectedRequest} docTypes={docTypes} onClose={() => setSelectedRequest(null)} role="admin" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} />
        )}
        <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>For Approval</h2>
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
              {awaitingApproval.map((r) => (
                <RequestRow key={r.id} req={r} onView={setSelectedRequest} showActions role="admin" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} />
              ))}
              {awaitingApproval.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-base">No requests pending approval.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === "all-requests") {
    return (
      <div className="p-8 space-y-6">
        {selectedRequest && (
          <RequestDetailModal req={selectedRequest} docTypes={docTypes} onClose={() => setSelectedRequest(null)} role="admin" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} />
        )}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>All Requests</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-52 transition-all"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-base text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
              <Filter size={15} /> Filter
            </button>
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
              {allFiltered.map((r) => (
                <RequestRow key={r.id} req={r} onView={setSelectedRequest} showActions role="admin" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Admin dashboard home
  return (
    <div className="p-8 space-y-6">
      {selectedRequest && (
        <RequestDetailModal req={selectedRequest} docTypes={docTypes} onClose={() => setSelectedRequest(null)} role="admin" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} />
      )}
      <div>
        <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Admin Overview</h2>
        <p className="text-muted-foreground text-base">Barangay Campagao — {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={requests.length} icon={<ClipboardList size={20} className="text-primary" />} color="bg-primary/10" />
        <StatCard label="For Approval" value={awaitingApproval.length} icon={<Shield size={20} className="text-indigo-600" />} color="bg-indigo-50" />
        <StatCard label="Released" value={requests.filter((r) => r.status === "Released").length} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
        <StatCard label="Revenue" value={`₱${revenue.toLocaleString()}`} icon={<DollarSign size={20} className="text-[#d4a017]" />} color="bg-amber-50" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Requests For Approval</h4>
          {awaitingApproval.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-base">No requests pending approval</div>
          ) : (
            <div className="space-y-2">
              {awaitingApproval.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-[#f0f3f8] hover:bg-indigo-50 transition-colors cursor-pointer" onClick={() => setSelectedRequest(r)}>
                  <div>
                    <div className="text-base font-semibold text-foreground">{r.residentName}</div>
                    <div className="text-sm text-muted-foreground">{r.docType}</div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Status Breakdown</h4>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="text-center p-2 rounded-lg bg-[#f0f3f8]">
                <div className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {requests.filter((r) => r.status === status).length}
                </div>
                <StatusBadge status={status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>All Recent Requests</h3>
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
              {requests.slice(0, 6).map((r) => (
                <RequestRow key={r.id} req={r} onView={setSelectedRequest} showActions role="admin" onStatusChange={onStatusChange} onMarkPaid={onMarkPaid} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
