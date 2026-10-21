import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { AuthShell, inputCls, labelCls, PasswordInput } from "./login";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — SokoSense" }] }),
  component: RegisterPage,
});

const ROLES = [
  { id: "farmer", label: "Farmer", desc: "Market prices, sell timing, loan checks and crop advisory for my farm." },
  { id: "sacco", label: "SACCO / partner", desc: "Cooperative or lender account — includes the SACCO dashboard." },
] as const;

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("farmer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await register(name.trim(), phone.trim(), password, role);
      navigate({ to: user.role === "sacco" ? "/sacco" : "/market" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Join SokoSense"
      title="Create your"
      italic="account."
      sub="One account for market intelligence, credit checks and advisory — on the web here, and the same phone number works on SMS/USSD."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="name">Full name / organisation</label>
          <input id="name" className={inputCls} placeholder="Amina Njoroge" autoComplete="name"
            value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls} htmlFor="phone">Phone number</label>
          <input id="phone" className={inputCls} placeholder="0712 345 678" autoComplete="tel"
            value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls} htmlFor="password">Password</label>
          <PasswordInput id="password" placeholder="At least 6 characters"
            autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <fieldset>
          <legend className={labelCls}>I am joining as</legend>
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <label
                key={r.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                  role === r.id ? "border-teal/60 bg-teal/5" : "border-hairline bg-paper hover:border-ink/30"
                }`}
              >
                <input type="radio" name="role" value={r.id} checked={role === r.id}
                  onChange={() => setRole(r.id)} className="mt-1 accent-teal" />
                <span>
                  <span className="block text-[13.5px] font-medium text-ink">{r.label}</span>
                  <span className="block text-[12px] text-steel mt-0.5">{r.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-[12.5px] text-rose-600">{error}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-[12.5px] text-steel">
        Already registered?{" "}
        <Link to="/login" className="text-teal font-medium hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
