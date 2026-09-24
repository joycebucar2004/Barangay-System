import { Home, Plus, ClipboardList, Bell, Eye, Shield, Users, FileText, BarChart2, Settings, LogOut, Megaphone, Banknote, UserPlus } from "lucide-react";
import { BarangayLogo } from "./BarangayLogo";
import type { Role } from "../lib/api";

export function Sidebar({
  role,
  userName,
  userId,
  activeSection,
  setActiveSection,
  onLogout,
  notifCount,
}: {
  role: Role;
  userName: string;
  userId: string;
  activeSection: string;
  setActiveSection: (s: string) => void;
  onLogout: () => void;
  notifCount: number;
}) {
  type NavItem = { id: string; label: string; icon: JSX.Element; badge?: number };

  const residentNav: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: <Home size={19} /> },
    { id: "new-request", label: "New Request", icon: <Plus size={19} /> },
    { id: "my-requests", label: "My Requests", icon: <ClipboardList size={19} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={19} />, badge: notifCount },
    { id: "settings", label: "Settings", icon: <Settings size={19} /> },
  ];
  const staffNav: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: <Home size={19} /> },
    { id: "walk-in", label: "Walk-in Request", icon: <UserPlus size={19} /> },
    { id: "queue", label: "Request Queue", icon: <ClipboardList size={19} /> },
    { id: "verified", label: "For Verification", icon: <Eye size={19} /> },
    { id: "release", label: "Payment & Release", icon: <Banknote size={19} /> },
    { id: "residents", label: "Residents", icon: <Users size={19} /> },
    { id: "reports", label: "Reports", icon: <BarChart2 size={19} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={19} />, badge: notifCount },
    { id: "settings", label: "Settings", icon: <Settings size={19} /> },
  ];
  const adminNav: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: <Home size={19} /> },
    { id: "approvals", label: "For Approval", icon: <Shield size={19} /> },
    { id: "all-requests", label: "All Requests", icon: <ClipboardList size={19} /> },
    { id: "users", label: "User Accounts", icon: <Users size={19} /> },
    { id: "documents", label: "Document Types", icon: <FileText size={19} /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone size={19} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={19} />, badge: notifCount },
    { id: "reports", label: "Reports", icon: <BarChart2 size={19} /> },
  ];

  const navItems = role === "resident" ? residentNav : role === "staff" ? staffNav : adminNav;
  const roleLabel = role === "resident" ? "Resident Portal" : role === "staff" ? "Staff Portal" : "Admin Portal";

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-screen sticky top-0" style={{ background: "linear-gradient(180deg, #1a3a6b 0%, #0d2244 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-[0_0_24px_rgba(212,160,23,0.25)]">
            <BarangayLogo size={48} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Brgy. Campagao</div>
            <div className="text-blue-300 text-sm">{roleLabel}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`relative w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-base transition-all duration-150 text-left ${
              activeSection === id
                ? "bg-gradient-to-r from-white/20 to-white/5 text-white font-semibold shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-[#d4a017]"
                : "text-blue-200 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={activeSection === id ? "text-[#d4a017]" : ""}>{icon}</span>
              {label}
            </span>
            {badge && badge > 0 ? (
              <span className="bg-[#d4a017] text-[#0f1c2e] text-sm font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{badge}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/8 mb-1">
          <div className="w-9 h-9 rounded-full bg-[#d4a017] flex items-center justify-center text-[#0f1c2e] font-bold text-base flex-shrink-0">
            {userName[0]}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">{userName}</div>
            <div className="flex items-center gap-1.5 text-blue-300 text-sm">
              <span className="capitalize">{role}</span>
              <span className="text-blue-400/50">·</span>
              <span className="font-mono text-blue-200 truncate">{userId}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-blue-300 hover:text-white hover:bg-white/8 text-base transition-colors"
        >
          <LogOut size={17} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
