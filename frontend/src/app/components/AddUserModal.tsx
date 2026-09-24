import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import type { CivilStatus, Gender, Role } from "../lib/api";

const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-[#f0f3f8] text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

function generateTempPassword({ firstName, lastName, dateOfBirth }: { firstName: string; lastName: string; dateOfBirth: string }) {
  const namePart = `${firstName.slice(0, 2)}${lastName.slice(0, 2)}`.replace(/[^a-zA-Z]/g, "") || "brgy";
  const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
  const yearPart = dateOfBirth ? dateOfBirth.slice(2, 4) : String(new Date().getFullYear()).slice(2, 4);
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${capitalized}${yearPart}${randomDigits}!`;
}

export function AddUserModal({ onClose, onCreate, lockRoleToResident }: {
  onClose: () => void;
  onCreate: (payload: {
    firstName: string;
    middleName?: string;
    lastName: string;
    gender: Gender;
    civilStatus: CivilStatus;
    dateOfBirth: string;
    email: string;
    password: string;
    role: Role;
    address?: string;
    contactNo?: string;
  }) => Promise<void>;
  lockRoleToResident?: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [civilStatus, setCivilStatus] = useState<CivilStatus | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("resident");
  const [address, setAddress] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Generated silently in the background -- not shown here. It's only ever revealed to the
  // user via the approval email, so it never has to be displayed (or typed) in this form.
  useEffect(() => {
    if (!firstName || !lastName) return;
    setPassword(generateTempPassword({ firstName, lastName, dateOfBirth }));
  }, [firstName, lastName, dateOfBirth]);

  async function handleSubmit() {
    if (!firstName || !lastName || !email || !password || !gender || !civilStatus || !dateOfBirth) {
      setError("First name, last name, gender, civil status, date of birth, email and password are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onCreate({ firstName, middleName, lastName, gender, civilStatus, dateOfBirth, email, password, role, address, contactNo });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,28,46,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="ui-modal bg-card rounded-2xl border border-border shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-[#f3d27a]" style={{ background: "linear-gradient(135deg, #24508f 0%, #0d2244 100%)" }}><UserPlus size={18} /></div>
            <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Add User Account</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X size={16} /></button>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
          <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Last Name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dela Cruz" className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">First Name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" className={inputClass} />
            </div>
            
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Middle Name</label>
            <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={inputClass}>
                <option value="" disabled>Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Date of Birth</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Civil Status</label>
            <select value={civilStatus} onChange={(e) => setCivilStatus(e.target.value as CivilStatus)} className={inputClass}>
              <option value="" disabled>Select</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
              <option value="Divorced">Divorced</option>
            </select>
          </div>

          {lockRoleToResident ? (
            <div className="text-xs text-muted-foreground bg-[#f0f3f8] border border-border rounded-lg px-3 py-2">
              This account will be created with the <span className="font-semibold">Resident</span> role and sent to the admin for approval. A temporary password will be generated and emailed to them once approved.
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
                  <option value="resident">Resident</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <div className="text-xs text-muted-foreground bg-[#f0f3f8] border border-border rounded-lg px-3 py-2">
                This account will be created with <span className="font-semibold">Pending</span> status. Approve it from User Accounts to activate it — a temporary password will be generated and emailed to them at that point.
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter address" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Contact No.</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                value={contactNo}
                onChange={(e) => setContactNo(e.target.value.replace(/\D/g, ""))}
                placeholder="9XXXXXXXXXX"
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
              <p className="text-xs text-muted-foreground mt-1.5">Their temporary password is sent to this address — it isn't shown here.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
            {submitting ? "Creating..." : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
