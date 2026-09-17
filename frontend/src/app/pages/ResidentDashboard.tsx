import { useEffect, useState } from "react";
import { ClipboardList, Clock, Package, CheckCircle, Bell, ChevronRight } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { RequestRow } from "../components/RequestRow";
import { RequestDetailModal } from "../components/RequestDetailModal";
import { NewRequestForm } from "../components/NewRequestForm";
import { NotificationsPanel } from "../components/NotificationsPanel";
import type { ApiDocumentType, ApiNotification, ApiRequest, ApiUser, RequestStatus } from "../lib/api";

const TABLE_HEADERS = ["Request ID", "Name", "Document / Purpose", "Status", "Payment", "Submitted", "Action"];

export function ResidentDashboard({
  section,
  setSection,
  requests,
  notifications,
  docTypes,
  currentUser,
  onStatusChange,
  onSubmitRequest,
  onResubmitRequest,
  onCancelRequest,
  onNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onDeleteAllNotifications,
}: {
  section: string;
  setSection: (s: string) => void;
  requests: ApiRequest[];
  notifications: ApiNotification[];
  docTypes: ApiDocumentType[];
  currentUser: ApiUser;
  onStatusChange: (id: string, s: RequestStatus, remarks?: string) => void;
  onSubmitRequest: (formData: FormData) => Promise<ApiRequest>;
  onResubmitRequest: (id: string, formData: FormData) => Promise<ApiRequest>;
  onCancelRequest: (id: string) => void;
  onNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onDeleteAllNotifications: () => void;
}) {
  const [selectedRequest, setSelectedRequest] = useState<ApiRequest | null>(null);

  // Keep the open modal's data in sync when the underlying request list updates
  // (e.g. after a status change), instead of showing a stale snapshot.
  useEffect(() => {
    if (!selectedRequest) return;
    const updated = requests.find((r) => r.id === selectedRequest.id);
    if (updated && updated !== selectedRequest) setSelectedRequest(updated);
  }, [requests, selectedRequest]);

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "Pending").length,
    ready: requests.filter((r) => r.status === "Ready for Pickup").length,
    released: requests.filter((r) => r.status === "Released").length,
  };

  if (section === "new-request") {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>New Document Request</h2>
          <p className="text-base text-muted-foreground">Fill out the form below to submit a new request.</p>
        </div>
        <NewRequestForm docTypes={docTypes} onSubmit={onSubmitRequest} onDone={() => setSection("my-requests")} />
      </div>
    );
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
        />
      </div>
    );
  }

  if (section === "my-requests") {
    return (
      <div className="p-8">
        {selectedRequest && (
          <RequestDetailModal req={selectedRequest} docTypes={docTypes} onClose={() => setSelectedRequest(null)} role="resident" onStatusChange={onStatusChange} onResubmit={onResubmitRequest} onCancel={onCancelRequest} />
        )}
        <h2 className="text-3xl font-bold text-foreground mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>My Requests</h2>
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
              {requests.map((r) => (
                <RequestRow key={r.id} req={r} onView={setSelectedRequest} role="resident" />
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-base">You haven't submitted any requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-8 space-y-6">
      {selectedRequest && (
        <RequestDetailModal req={selectedRequest} docTypes={docTypes} onClose={() => setSelectedRequest(null)} role="resident" onStatusChange={onStatusChange} onResubmit={onResubmitRequest} onCancel={onCancelRequest} />
      )}
      <div>
        <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{greeting}, {currentUser.name.split(" ")[0]}!</h2>
        <p className="text-muted-foreground text-base">Here's an overview of your document requests.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={stats.total} icon={<ClipboardList size={20} className="text-primary" />} color="bg-primary/10" />
        <StatCard label="Pending Review" value={stats.pending} icon={<Clock size={20} className="text-amber-600" />} color="bg-amber-50" />
        <StatCard label="Ready for Pickup" value={stats.ready} icon={<Package size={20} className="text-emerald-600" />} color="bg-emerald-50" />
        <StatCard label="Released" value={stats.released} icon={<CheckCircle size={20} className="text-green-600" />} color="bg-green-50" />
      </div>

      {notifications.filter((n) => !n.read).length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">New Updates</div>
          {notifications.filter((n) => !n.read).map((n) => (
            <div key={n.id} className="flex items-start gap-2 text-base text-blue-800 mb-1 last:mb-0">
              <Bell size={15} className="mt-0.5 flex-shrink-0" />
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Recent Requests</h3>
          <button onClick={() => setSection("my-requests")} className="text-sm text-primary font-semibold hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></button>
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
              {requests.slice(0, 3).map((r) => (
                <RequestRow key={r.id} req={r} onView={setSelectedRequest} role="resident" />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
