"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, AuthError } from "@/stores/auth";
import { VALIDATION } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  Section,
  Row,
  FormInput,
  StatusMessage,
} from "@/components/shared/FormPrimitives";

export default function ProfilePage() {
  const router = useRouter();
  const { token, role, email, logout } = useAuth();

  // Redirect guests to login
  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-neutral-100">Account</h1>

      {/* Account Info */}
      <Section title="Account Info">
        <Row label="Email">
          <span className="text-sm text-neutral-300">{email ?? "—"}</span>
        </Row>
        <Row label="Role">
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              role === "admin"
                ? "bg-purple-500/20 text-purple-400"
                : "bg-blue-500/20 text-blue-400",
            )}
          >
            {role}
          </span>
        </Row>
      </Section>

      {/* Change Email */}
      <ChangeEmailForm />

      {/* Change Password */}
      <ChangePasswordForm />

      {/* Logout */}
      <button
        onClick={() => {
          logout();
          router.push("/");
        }}
        className="w-full text-sm font-medium rounded-lg px-4 py-2.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
      >
        Log Out
      </button>

      {/* Delete Account */}
      <DeleteAccountForm />
    </div>
  );
}

/* ── Change Email Form ─────────────────────────────────────── */

function ChangeEmailForm() {
  const updateEmail = useAuth((s) => s.updateEmail);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!newEmail || !password) {
      setError("Both fields are required");
      return;
    }
    setLoading(true);
    try {
      await updateEmail(newEmail, password);
      setSuccess("Email updated");
      setNewEmail("");
      setPassword("");
    } catch (err) {
      setError(
        err instanceof AuthError ? err.message : "Failed to update email",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Change Email">
      <form onSubmit={handleSubmit} className="py-3 space-y-3">
        <FormInput
          label="New Email"
          type="email"
          value={newEmail}
          onChange={setNewEmail}
          autoComplete="email"
        />
        <FormInput
          label="Current Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <StatusMessage error={error} success={success} />
        <div className="px-4 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="text-sm font-medium rounded-lg px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {loading ? "Saving..." : "Update Email"}
          </button>
        </div>
      </form>
    </Section>
  );
}

/* ── Change Password Form ──────────────────────────────────── */

function ChangePasswordForm() {
  const updatePassword = useAuth((s) => s.updatePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setSuccess("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof AuthError ? err.message : "Failed to update password",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Change Password">
      <form onSubmit={handleSubmit} className="py-3 space-y-3">
        <FormInput
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <FormInput
          label="New Password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Min 8 characters"
          autoComplete="new-password"
        />
        <FormInput
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
        <StatusMessage error={error} success={success} />
        <div className="px-4 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="text-sm font-medium rounded-lg px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {loading ? "Saving..." : "Update Password"}
          </button>
        </div>
      </form>
    </Section>
  );
}

/* ── Delete Account ────────────────────────────────────────── */

function DeleteAccountForm() {
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Enter your password to confirm");
      return;
    }
    setLoading(true);
    try {
      await deleteAccount(password);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof AuthError ? err.message : "Failed to delete account",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold text-red-400/70 uppercase tracking-wide px-1 mb-2">
        Danger Zone
      </h2>
      <div className="rounded-lg border border-red-900/30 bg-neutral-900">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="w-full text-sm text-red-400 px-4 py-3 text-left hover:bg-red-950/20 transition-colors rounded-lg"
          >
            Delete Account
          </button>
        ) : (
          <form onSubmit={handleDelete} className="p-4 space-y-3">
            <p className="text-xs text-neutral-400">
              This will permanently delete your account and all associated data.
              This action cannot be undone.
            </p>
            <FormInput
              label="Confirm Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <StatusMessage error={error} success={null} />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="text-sm font-medium rounded-lg px-4 py-2 bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
              >
                {loading ? "Deleting..." : "Delete My Account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPassword("");
                  setError(null);
                }}
                className="text-sm font-medium rounded-lg px-4 py-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
