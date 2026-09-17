import { CheckCheck, Trash2, X, Users } from "lucide-react";
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
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Notifications</h2>
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} /> Clear all
            </button>
          </div>
        )}
      </div>
      {shared && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5">
          <Users size={13} /> Shared with the rest of your team — marking read or deleting here applies for everyone.
        </p>
      )}
      <div className={`space-y-3 max-w-2xl ${shared ? "" : "mt-6"}`}>
        {notifications.length === 0 && (
          <div className="text-base text-muted-foreground">No notifications yet.</div>
        )}
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.read && onRead(n.id)}
            className={`group bg-card border rounded-xl p-4 flex items-start gap-3 cursor-pointer ${!n.read ? "border-primary/20" : "border-border"}`}
          >
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!n.read ? "bg-primary" : "bg-muted-foreground/30"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-base text-foreground">{n.message}</p>
              <p className="text-sm text-muted-foreground mt-1">{new Date(n.time).toLocaleString()}</p>
            </div>
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
