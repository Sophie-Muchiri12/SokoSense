import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { AuthShell, inputCls, labelCls } from "./login";

export const Route = createFileRoute("/admin-login")({
  head: () => ({ meta: [{ title: "Admin access — SokoSense" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { adminLogin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{7}$/.test(pin)) {
      setError("Enter the 7-digit admin PIN.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminLogin(pin);
      navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Operations · restricted"
      title="Admin"
      italic="access."
      sub="Enter the 7-digit admin PIN to open the operations dashboard. This is separate from farmer and SACCO accounts."
    >
      {isAdmin ? (
        <div className="text-center">
          <p className="text-[13.5px] text-steel">You're already signed in as admin.</p>
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="mt-4 w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft"
          >
            Open the admin portal
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="pin">Admin PIN (7 digits)</label>
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              className={`${inputCls} text-center font-mono text-[22px] tracking-[0.5em]`}
              placeholder="•••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          {error && <p className="text-[12.5px] text-rose-600 text-center">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50"
          >
            {busy ? "Checking PIN…" : "Enter admin portal"}
          </button>
          <p className="text-center text-[11.5px] text-mist">
            Attempts are rate-limited. The PIN is configured server-side and never sent to your browser.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
