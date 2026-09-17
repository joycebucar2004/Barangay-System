export type Role = "resident" | "staff" | "admin";
export type RequestStatus = "Pending" | "Verified" | "Approved" | "Ready for Pickup" | "Released" | "Rejected" | "Cancelled";
export type Gender = "Male" | "Female" | "Other";
export type CivilStatus = "Single" | "Married" | "Widowed" | "Separated" | "Divorced";

export type UserStatus = "Pending" | "Denied" | "Approved";
// What the UI actually shows for status: Approved reads as "Active" (or "Inactive" once dormant
// for a year), while Pending/Denied are shown as-is. Computed server-side in toPublicUser().
export type UserDisplayStatus = "Pending" | "Denied" | "Active" | "Inactive";

export interface ApiUser {
  id: string;
  name: string; // computed full name (first + middle initial + last), for display
  email: string;
  role: Role;
  // Admin accounts (role: "admin") live in a separate table with no profile fields --
  // these are only present for resident/staff accounts.
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: Gender;
  civilStatus?: CivilStatus;
  dateOfBirth?: string;
  address?: string;
  contactNo?: string;
  status?: UserStatus;
  displayStatus?: UserDisplayStatus;
  joined?: string;
  lastLoginAt?: string | null;
}

// Full detail, only fetched on demand for the admin's "View" action -- includes the temporary
// password (if the user hasn't set their own yet), which the list/table view never receives.
export interface ApiUserDetail extends ApiUser {
  tempPassword?: string | null;
}

export interface UserProfileInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: Gender;
  civilStatus: CivilStatus;
  dateOfBirth: string;
  email: string;
  password?: string;
  address?: string;
  contactNo?: string;
}

export interface ApiRequestFile {
  originalName: string;
  storedName: string;
  requirement?: string;
}

export interface ApiRequest {
  id: string;
  residentId: string;
  residentName: string;
  docType: string;
  status: RequestStatus;
  purpose: string;
  submittedAt: string;
  updatedAt: string;
  fee: number;
  paid: boolean;
  printedAt?: string | null;
  remarks?: string;
  address: string;
  contactNo: string;
  dateOfBirth?: string;
  civilStatus?: CivilStatus;
  files: ApiRequestFile[];
}

export interface ApiNotification {
  id: string;
  userId: string | null;
  forRole: Role | null;
  message: string;
  time: string;
  read: boolean;
}

export interface ApiDocumentTypeRequirement {
  requirement: string;
  required: boolean;
}

export interface ApiDocumentType {
  name: string;
  fee: number;
  requirements: ApiDocumentTypeRequirement[];
}

export type AnnouncementTag = "Advisory" | "Announcement" | "Event" | "Notice";

export interface ApiAnnouncement {
  id: string;
  tag: AnnouncementTag;
  title: string;
  body: string;
  date: string;
}

export interface ReportsSummary {
  totalThisMonth: number;
  releasedThisMonth: number;
  revenue: number;
  monthly: { month: string; requests: number }[];
  distribution: { name: string; value: number; color: string }[];
  statusCounts: Record<string, number>;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "barangay_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData) && options.body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  async login(email: string, password: string, role: Role) {
    return request<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
  },
  async register(payload: Omit<UserProfileInput, "password">) {
    return request<{ pending: true; user: ApiUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async me() {
    return request<{ user: ApiUser }>("/auth/me");
  },
  async updateMyProfile(payload: Partial<UserProfileInput>) {
    return request<{ user: ApiUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(payload) });
  },
  async changeMyPassword(currentPassword: string, newPassword: string) {
    return request<{ ok: boolean }>("/auth/me/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async listRequests() {
    return request<{ requests: ApiRequest[] }>("/requests");
  },
  async createRequest(formData: FormData) {
    return request<{ request: ApiRequest }>("/requests", { method: "POST", body: formData });
  },
  async updateRequestStatus(id: string, status: RequestStatus, remarks?: string) {
    return request<{ request: ApiRequest }>(`/requests/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, remarks }),
    });
  },
  async markRequestPaid(id: string) {
    return request<{ request: ApiRequest }>(`/requests/${id}/payment`, { method: "PATCH" });
  },
  async markCertificatePrinted(id: string) {
    return request<{ request: ApiRequest }>(`/requests/${id}/print`, { method: "PATCH" });
  },
  async resubmitRequest(id: string, formData: FormData) {
    return request<{ request: ApiRequest }>(`/requests/${id}/resubmit`, { method: "PATCH", body: formData });
  },
  async cancelRequest(id: string) {
    return request<{ request: ApiRequest }>(`/requests/${id}/cancel`, { method: "PATCH" });
  },

  async listNotifications() {
    return request<{ notifications: ApiNotification[] }>("/notifications");
  },
  async markNotificationRead(id: string) {
    return request<{ notification: ApiNotification }>(`/notifications/${id}/read`, { method: "PATCH" });
  },
  async markAllNotificationsRead() {
    return request<{ success: boolean }>("/notifications/read-all", { method: "PATCH" });
  },
  async deleteNotification(id: string) {
    return request<{ success: boolean }>(`/notifications/${id}`, { method: "DELETE" });
  },
  async deleteAllNotifications() {
    return request<{ success: boolean }>("/notifications", { method: "DELETE" });
  },

  async listDocumentTypes() {
    return request<{ documentTypes: ApiDocumentType[] }>("/document-types");
  },
  async createDocumentType(payload: { name: string; fee: number; requirements: ApiDocumentTypeRequirement[] }) {
    return request<{ documentType: ApiDocumentType }>("/document-types", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateDocumentType(name: string, payload: { fee?: number; requirements?: ApiDocumentTypeRequirement[] }) {
    return request<{ documentType: ApiDocumentType }>(`/document-types/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async listUsers() {
    return request<{ users: ApiUser[] }>("/users");
  },
  async getUserDetail(id: string) {
    return request<{ user: ApiUserDetail }>(`/users/${id}`);
  },
  async createUser(payload: UserProfileInput & { role: Role }) {
    return request<{ user: ApiUser }>("/users", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateUserStatus(id: string, status: UserStatus) {
    return request<{ user: ApiUser }>(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  async reportsSummary() {
    return request<ReportsSummary>("/reports/summary");
  },

  async listAnnouncements() {
    return request<{ announcements: ApiAnnouncement[] }>("/announcements");
  },
  async createAnnouncement(payload: { tag: AnnouncementTag; title: string; body: string; date?: string }) {
    return request<{ announcement: ApiAnnouncement }>("/announcements", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateAnnouncement(id: string, payload: Partial<{ tag: AnnouncementTag; title: string; body: string; date: string }>) {
    return request<{ announcement: ApiAnnouncement }>(`/announcements/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  async deleteAnnouncement(id: string) {
    return request<{ ok: boolean }>(`/announcements/${id}`, { method: "DELETE" });
  },

  fileUrl(storedName: string) {
    return `${API_BASE.replace(/\/api$/, "")}/uploads/${storedName}`;
  },
};
