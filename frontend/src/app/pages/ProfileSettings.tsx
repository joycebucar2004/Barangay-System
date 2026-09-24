import { useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { PasswordInput } from "../components/PasswordInput";
import { PageHeader } from "../components/PageHeader";
import { Settings } from "lucide-react";
import type { ApiUser, CivilStatus, Gender } from "../lib/api";

const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-[#f0f3f8] text-foreground placeholder:text-muted-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
const cardClass = "ui-card p-6 h-fit";

export function ProfileSettings({ currentUser, onProfileUpdated, knownPassword, onPasswordChanged }: {
  currentUser: ApiUser;
  onProfileUpdated: (user: ApiUser) => void;
  /** The password used to sign in this session, held in memory only, so it can pre-fill Current Password below. */
  knownPassword?: string | null;
  onPasswordChanged?: (newPassword: string) => void;
}) {
  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [middleName, setMiddleName] = useState(currentUser.middleName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [gender, setGender] = useState<Gender>(currentUser.gender);
  const [civilStatus, setCivilStatus] = useState<CivilStatus | "">(currentUser.civilStatus || "");
  const [dateOfBirth, setDateOfBirth] = useState(currentUser.dateOfBirth);
  const [email, setEmail] = useState(currentUser.email);
  const [address, setAddress] = useState(currentUser.address);
  const [contactNo, setContactNo] = useState(currentUser.contactNo);
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState(knownPassword || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveProfile() {
    if (!firstName || !lastName || !email || !gender || !civilStatus || !dateOfBirth) {
      setProfileError("First name, last name, gender, civil status, date of birth and email are required.");
      return;
    }
    setProfileError("");
    setSavingProfile(true);
    try {
      const { user } = await api.updateMyProfile({ firstName, middleName, lastName, gender, civilStatus, dateOfBirth, email, address, contactNo });
      onProfileUpdated(user);
      toast.success("Profile updated.");
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setPasswordError("");
    setSavingPassword(true);
    try {
      await api.changeMyPassword(currentPassword, newPassword);
      onPasswordChanged?.(newPassword);
      setCurrentPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed.");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader icon={<Settings size={22} />} title="Account Settings" subtitle="Manage your profile information and password." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
      <div className={cardClass}>
        <h3 className="text-lg font-bold text-foreground mb-4">Profile Information</h3>
        {profileError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{profileError}</div>
        )}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-base font-semibold text-foreground mb-1.5">First Name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-base font-semibold text-foreground mb-1.5">Last Name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-base font-semibold text-foreground mb-1.5">Middle Name</label>
            <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-base font-semibold text-foreground mb-1.5">Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={inputClass}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-foreground mb-1.5">Date of Birth</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-base font-semibold text-foreground mb-1.5">Civil Status</label>
            <select value={civilStatus} onChange={(e) => setCivilStatus(e.target.value as CivilStatus)} className={inputClass}>
              <option value="" disabled>Select</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
              <option value="Divorced">Divorced</option>
            </select>
          </div>
          <div>
            <label className="block text-base font-semibold text-foreground mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-base font-semibold text-foreground mb-1.5">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-base font-semibold text-foreground mb-1.5">Contact No.</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                value={contactNo}
                onChange={(e) => setContactNo(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="mt-4 px-5 py-3 rounded-lg bg-primary text-white font-semibold text-base hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {savingProfile ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className={cardClass}>
        <h3 className="text-lg font-bold text-foreground mb-4">Change Password</h3>
        {passwordError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{passwordError}</div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
        >
          {/* Hidden username field so browser password managers can match & autofill the current-password field below. */}
          <input type="email" value={currentUser.email} readOnly autoComplete="username" className="sr-only" tabIndex={-1} aria-hidden="true" />
          <div className="space-y-3">
            <div>
              <label className="block text-base font-semibold text-foreground mb-1.5">Current Password</label>
              <PasswordInput
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {knownPassword
                  ? "Pre-filled from your sign-in this session — change it below if it's not correct."
                  : "Your browser's saved password can autofill this if you've saved it before."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-base font-semibold text-foreground mb-1.5">New Password</label>
                <PasswordInput
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-foreground mb-1.5">Confirm New Password</label>
                <PasswordInput
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="mt-4 px-5 py-3 rounded-lg bg-primary text-white font-semibold text-base hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {savingPassword ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
