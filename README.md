# Barangay Campagao Document Request System

Full-stack barangay document request & account management system: a React/Vite frontend backed by an Express API, with MySQL for persistence.

## Project layout

```
Barangay_System/
├── package.json  Root convenience scripts (run frontend + server together)
├── frontend/     React + Vite + Tailwind UI
└── server/       Express API + MySQL
```

- `frontend/src/app/components/` — shared UI pieces (Sidebar, StatusBadge, modals, forms)
- `frontend/src/app/pages/` — the three role dashboards (Resident, Staff, Admin) + Account Settings
- `frontend/src/app/lib/api.ts` — typed API client used by every page/component
- `frontend/src/app/App.tsx` — thin composition root (session/state + routing between pages)
- `server/` — Express, JWT auth, file uploads via multer, MySQL persistence, account-approval emails via Resend
- `server/db/schema.sql` — reference relational schema + stored procedures (documentation only; the running app persists through `server/src/db.js`, not these tables)

## One-time setup

1. **MySQL** — have a MySQL server running and reachable (e.g. via XAMPP). The app creates its own `barangay` database automatically on first run.
2. **`server/.env`** — copy the values below and adjust to your local MySQL credentials:
   ```
   PORT=4000

   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=barangay

   JWT_SECRET=some-random-string

   # Optional — account-approval emails. Leave blank to just log emails to the console.
   RESEND_API_KEY=
   RESEND_FROM=
   GMAIL_USER=
   GMAIL_APP_PASSWORD=
   ```
3. **Install dependencies** for both apps at once from the repo root:
   ```
   npm run install:all
   ```

## Running the code

From the repo root, one command starts both the API and the frontend together:

```
npm run dev
```

- API: http://localhost:4000
- Frontend: http://localhost:5173 (talks to the API at `http://localhost:4000/api` by default — override with `VITE_API_URL` in `frontend/.env`)

To run either one on its own: `npm run dev:server` or `npm run dev:frontend` from the root, or `cd server && npm run dev` / `cd frontend && npm run dev`.

## Demo accounts

MySQL is seeded automatically the first time the server connects, with one account per role:

| Role | Email | Password |
|---|---|---|
| Resident | maria.santos@email.com | resident123 |
| Staff | reyes@brgycampagao.gov.ph | staff123 |
| Admin (Officer) | bautista@brgycampagao.gov.ph | admin123 |

## Account approval workflow

- **Residents** can self-register from the login screen. No password is collected at registration — the account is created as **Pending**, and a temporary password is generated once an admin approves it.
- **Staff** can add resident accounts from **Residents** in their dashboard (role is locked to resident). These also start **Pending**.
- **Admins** add accounts of any role from **User Accounts**; admin-created accounts go **Active** immediately since the admin is already the approving authority.
- Pending accounts can't sign in. From **User Accounts**, an admin can **Approve** (→ Active, credentials emailed) or **Deny** (→ Denied) any pending account.

## Announcements

Admins manage public announcements from **Announcements** in the admin dashboard (post, edit, delete). They're tagged Advisory / Announcement / Event / Notice and shown on the public landing page — no login required to view them.

## Emailing credentials

Account-approval emails are sent via [Resend](https://resend.com) if `RESEND_API_KEY` is set (falls back to Gmail SMTP if only `GMAIL_USER`/`GMAIL_APP_PASSWORD` are set, or just logs to the server console if neither is configured).

Resend's free tier without a verified domain only delivers to the email address you signed up with — to send real credentials to any resident's inbox, verify a domain you own at resend.com/domains and set `RESEND_FROM` to an address on that domain.
