import { Bell, BellOff, CheckCheck, Trash2, X, Users } from "lucide-react";
import { PageHeader } from "./PageHeader";
import type { ApiNotification } from "../lib/api";

export function NotificationsPanel({
  notifications,
  onRead,
  onMarkAllRead,
  onDelete,
  onDeleteAll,
  shared,
}: {
  notifications: ApiNotification[];
  onRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  // Staff/admin notifications are a shared team feed (not per-account) -- clearing or deleting
  // one here removes it for every staff/admin user, not just the person clicking. Resident
  // notifications are personal, so this stays false for them.
  shared?: boolean;
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5">
      <PageHeader icon={<Bell size={22} />} title="Notifications" subtitle={unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You're all caught up."}>
        {notifications.length > 0 && (
          <>
            <button
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/20 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCheck size={15} /> Mark all as read
            </button>
            <button
              onClick={() => {
                const msg = shared
                  ? "Delete all notifications? This clears the shared feed for every staff/admin account, not just yours. This can't be undone."
                  : "Delete all notifications? This can't be undone.";
                if (confirm(msg)) onDeleteAll();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} /> Clear all
            </button>
          </>
        )}
      </PageHeader>
      {shared && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users size={13} /> Shared with the rest of your team — marking read or deleting here applies for everyone.
        </p>
      )}
      <div className="space-y-3 max-w-3xl">
        {notifications.length === 0 && (
          <div className="ui-card flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BellOff size={26} /></div>
            <div className="text-lg font-bold text-foreground">No notifications yet</div>
            <div className="text-sm text-muted-foreground">Updates about requests and accounts will show up here.</div>
          </div>
        )}
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.read && onRead(n.id)}
            className={`group relative overflow-hidden rounded-2xl border p-4 pl-5 flex items-start gap-3.5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${
              !n.read ? "border-primary/20 bg-gradient-to-r from-[#eef3fb] to-white shadow-sm" : "border-border bg-card"
            }`}
          >
            {!n.read && <div className="absolute inset-y-0 left-0 w-1 bg-[#d4a017]" />}
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${!n.read ? "bg-primary text-[#f3d27a]" : "bg-muted text-muted-foreground"}`}>
              <Bell size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-base ${!n.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>{n.message}</p>
              <p className="text-sm text-muted-foreground mt-1">{new Date(n.time).toLocaleString()}</p>
            </div>
            {!n.read && <span className="mt-1 rounded-full bg-[#d4a017]/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#9a7410]">New</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(n.id);
              }}
              title="Delete notification"
              className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
