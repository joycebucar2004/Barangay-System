import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { LoginScreen } from "./components/LoginScreen";
import { LandingPage } from "./components/LandingPage";
import { Sidebar } from "./components/Sidebar";
import { ResidentDashboard } from "./pages/ResidentDashboard";
import { StaffDashboard } from "./pages/StaffDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { ProfileSettings } from "./pages/ProfileSettings";
import { api, getToken, setToken } from "./lib/api";
import type {
  AnnouncementInput,
  ApiAnnouncement,
  ApiDocumentType,
  ApiDocumentTypeRequirement,
  ApiNotification,
  ApiRequest,
  ApiUser,
  CertificateContent,
  ReportsSummary,
  Role,
  RequestStatus,
  UserProfileInput,
  UserStatus,
} from "./lib/api";

export default function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [docTypes, setDocTypes] = useState<ApiDocumentType[]>([]);
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [reports, setReports] = useState<ReportsSummary | null>(null);
  // Held in memory only (never persisted) so the Change Password form can be pre-filled
  // without retyping it. Cleared on logout and lost on page refresh.
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);

  // Document types and announcements are public and used on the login-less parts of the flow too.
  useEffect(() => {
    api.listDocumentTypes().then(({ documentTypes }) => setDocTypes(documentTypes)).catch(() => {});
    api.listAnnouncements().then(({ announcements }) => setAnnouncements(announcements)).catch(() => {});
  }, []);

  // Restore session from a stored token on first load.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setAuthChecked(true));
  }, []);

  async function refreshRequests() {
    try {
      const { requests } = await api.listRequests();
      setRequests(requests);
    } catch (err: any) {
      toast.error(err.message || "Could not load requests.");
    }
  }

  async function refreshNotifications() {
    try {
      const { notifications } = await api.listNotifications();
      setNotifications(notifications);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    if (!user) return;
    refreshRequests();
    refreshNotifications();
    // Other roles can change a request's state at any time (e.g. admin printing a certificate
    // while staff is already on their dashboard) -- poll so that shows up without a manual reload.
    const interval = setInterval(() => {
      refreshRequests();
      refreshNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (activeSection === "users" && user.role === "admin") {
      api.listUsers().then(({ users }) => setUsers(users)).catch((err: any) => toast.error(err.message));
    }
    if ((activeSection === "residents" || activeSection === "walk-in") && user.role === "staff") {
      api.listUsers().then(({ users }) => setUsers(users)).catch((err: any) => toast.error(err.message));
    }
    if (activeSection === "reports" && (user.role === "admin" || user.role === "staff")) {
      api.reportsSummary().then(setReports).catch((err: any) => toast.error(err.message));
    }
  }, [activeSection, user]);

  function handleAuthenticated(token: string, authedUser: ApiUser, password: string) {
    setToken(token);
    setUser(authedUser);
    setSessionPassword(password);
    setActiveSection("dashboard");
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setRequests([]);
    setNotifications([]);
    setUsers([]);
    setReports(null);
    setSessionPassword(null);
    setActiveSection("dashboard");
    setShowLanding(true);
  }

  async function handleStatusChange(id: string, status: RequestStatus, remarks?: string) {
    try {
      const { request } = await api.updateRequestStatus(id, status, remarks);
      setRequests((prev) => prev.map((r) => (r.id === id ? request : r)));
      toast.success(`Request ${id} marked as ${status}.`);
      refreshNotifications();
    } catch (err: any) {
      toast.error(err.message || "Could not update request status.");
    }
  }

  async function handleMarkPaid(id: string) {
    try {
      const { request } = await api.markRequestPaid(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? request : r)));
      toast.success(`Payment recorded for ${id}.`);
    } catch (err: any) {
      toast.error(err.message || "Could not record payment.");
    }
  }

  async function handlePrintCertificate(id: string) {
    try {
      const { request } = await api.markCertificatePrinted(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? request : r)));
      return request;
    } catch (err: any) {
      toast.error(err.message || "Could not print the certificate.");
      return null;
    }
  }

  async function handleSaveCertificateTemplate(name: string, template: CertificateContent | null) {
    const { documentType } = await api.saveCertificateTemplate(name, template);
    setDocTypes((prev) => prev.map((d) => (d.name === name ? documentType : d)));
    toast.success(template ? `${name} certificate template saved.` : `${name} certificate reset to the default wording.`);
  }

  async function handleSubmitRequest(formData: FormData) {
    const { request } = await api.createRequest(formData);
    setRequests((prev) => [request, ...prev]);
    toast.success(`Request ${request.id} submitted.`);
    refreshNotifications();
    return request;
  }

  async function handleCreateWalkInRequest(formData: FormData) {
    const { request, resident } = await api.createWalkInRequest(formData);
    setRequests((prev) => [request, ...prev]);
    setUsers((prev) => (prev.some((u) => u.id === resident.id) ? prev : [resident, ...prev]));
    toast.success(`Walk-in request ${request.id} saved.`);
    return request;
  }

  async function handleResubmitRequest(id: string, formData: FormData) {
    const { request } = await api.resubmitRequest(id, formData);
    setRequests((prev) => prev.map((r) => (r.id === id ? request : r)));
    toast.success(`Request ${id} resubmitted for review.`);
    refreshNotifications();
    return request;
  }

  async function handleCancelRequest(id: string) {
    try {
      const { request } = await api.cancelRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? request : r)));
      toast.success(`Request ${id} cancelled.`);
      refreshNotifications();
    } catch (err: any) {
      toast.error(err.message || "Could not cancel the request.");
    }
  }

  async function handleNotificationRead(id: string) {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // non-critical
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      toast.error(err.message || "Could not mark notifications as read.");
    }
  }

  async function handleDeleteNotification(id: string) {
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Could not delete the notification.");
    }
  }

  async function handleDeleteAllNotifications() {
    try {
      await api.deleteAllNotifications();
      setNotifications([]);
    } catch (err: any) {
      toast.error(err.message || "Could not clear notifications.");
    }
  }

  async function handleCreateUser(payload: UserProfileInput & { role: Role }) {
    const { user: created } = await api.createUser(payload);
    setUsers((prev) => [...prev, created]);
    toast.success(
      created.status === "Pending"
        ? `Account created for ${created.name} — pending admin approval.`
        : `Account created for ${created.name}.`
    );
  }

  async function handleUpdateUserStatus(id: string, status: UserStatus) {
    try {
      const { user: updated } = await api.updateUserStatus(id, status);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      toast.success(`${updated.name}'s account marked as ${status}.`);
    } catch (err: any) {
      toast.error(err.message || "Could not update account status.");
    }
  }

  async function handleUpdateDocumentType(name: string, payload: { fee?: number; requirements?: ApiDocumentTypeRequirement[] }) {
    const { documentType } = await api.updateDocumentType(name, payload);
    setDocTypes((prev) => prev.map((d) => (d.name === name ? documentType : d)));
    toast.success(`${name} updated.`);
  }

  async function handleCreateDocumentType(payload: { name: string; fee: number; requirements: ApiDocumentTypeRequirement[] }) {
    const { documentType } = await api.createDocumentType(payload);
    setDocTypes((prev) => [...prev, documentType]);
    toast.success(`${documentType.name} added.`);
  }

  async function handleCreateAnnouncement(payload: AnnouncementInput) {
    const { announcement } = await api.createAnnouncement(payload);
    setAnnouncements((prev) => [announcement, ...prev]);
    toast.success("Announcement posted.");
  }

  async function handleUpdateAnnouncement(id: string, payload: Partial<AnnouncementInput>) {
    const { announcement } = await api.updateAnnouncement(id, payload);
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? announcement : a)));
    toast.success("Announcement updated.");
  }

  async function handleDeleteAnnouncement(id: string) {
    await api.deleteAnnouncement(id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    toast.success("Announcement removed.");
  }

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f3f8] text-muted-foreground text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        Loading Barangay Campagao portal...
      </div>
    );
  }

  if (!user) {
    if (showLanding) {
      return (
        <>
          <Toaster />
          <LandingPage docTypes={docTypes} announcements={announcements} onSignIn={() => setShowLanding(false)} />
        </>
      );
    }
    return (
      <>
        <Toaster />
        <LoginScreen onAuthenticated={handleAuthenticated} onBack={() => setShowLanding(true)} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-background" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Toaster />
      <Sidebar
        role={user.role}
        userName={user.name}
        userId={user.id}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onLogout={handleLogout}
        notifCount={unreadNotifs}
      />
      <main className="ui-app-bg flex-1 overflow-y-auto min-h-screen">
        <div key={activeSection} className="ui-page">
        {activeSection === "settings" && user.role !== "admin" && (
          <ProfileSettings
            currentUser={user}
            onProfileUpdated={setUser}
            knownPassword={sessionPassword}
            onPasswordChanged={setSessionPassword}
          />
        )}
        {activeSection !== "settings" && user.role === "resident" && (
          <ResidentDashboard
            section={activeSection}
            setSection={setActiveSection}
            requests={requests}
            notifications={notifications}
            docTypes={docTypes}
            currentUser={user}
            onStatusChange={handleStatusChange}
            onSubmitRequest={handleSubmitRequest}
            onResubmitRequest={handleResubmitRequest}
            onCancelRequest={handleCancelRequest}
            onNotificationRead={handleNotificationRead}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onDeleteNotification={handleDeleteNotification}
            onDeleteAllNotifications={handleDeleteAllNotifications}
          />
        )}
        {activeSection !== "settings" && user.role === "staff" && (
          <StaffDashboard
            section={activeSection}
            setSection={setActiveSection}
            requests={requests}
            notifications={notifications}
            docTypes={docTypes}
            users={users}
            reports={reports}
            onStatusChange={handleStatusChange}
            onMarkPaid={handleMarkPaid}
            onPrintCertificate={handlePrintCertificate}
            onNotificationRead={handleNotificationRead}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onDeleteNotification={handleDeleteNotification}
            onDeleteAllNotifications={handleDeleteAllNotifications}
            onCreateUser={handleCreateUser}
            onCreateWalkInRequest={handleCreateWalkInRequest}
          />
        )}
        {user.role === "admin" && (
          <AdminDashboard
            section={activeSection}
            setSection={setActiveSection}
            requests={requests}
            docTypes={docTypes}
            users={users}
            reports={reports}
            announcements={announcements}
            notifications={notifications}
            onStatusChange={handleStatusChange}
            onMarkPaid={handleMarkPaid}
            onSaveCertificateTemplate={handleSaveCertificateTemplate}
            onCreateUser={handleCreateUser}
            onUpdateUserStatus={handleUpdateUserStatus}
            onUpdateDocumentType={handleUpdateDocumentType}
            onCreateDocumentType={handleCreateDocumentType}
            onCreateAnnouncement={handleCreateAnnouncement}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onNotificationRead={handleNotificationRead}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onDeleteNotification={handleDeleteNotification}
            onDeleteAllNotifications={handleDeleteAllNotifications}
          />
        )}
        </div>
      </main>
    </div>
  );
}
