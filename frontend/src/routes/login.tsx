import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useAuth } from "@/lib/auth";
import { Eye, EyeOff, LogIn } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Log in — SokoSense" }] }),
  component: LoginPage,
});

export function AuthShell({
  eyebrow,
  title,
  italic,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  italic: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[480px] min-w-0 px-5 sm:px-6 pt-14 sm:pt-20 pb-14">
      <p className="eyebrow text-center">{eyebrow}</p>
      <h1 className="display mt-4 text-center text-[38px] sm:text-[44px] text-ink">
        {title} <span className="italic text-teal">{italic}</span>
      </h1>
      <p className="mt-4 text-center text-[13.5px] leading-relaxed text-steel">{sub}</p>
      <div className="card-surface mt-8 p-6 sm:p-8">{children}</div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-mist focus:outline-none focus:border-teal/60";
export const labelCls = "block text-[11px] uppercase tracking-wider text-mist mb-1.5";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with an eye toggle so users can check what they typed. */
export function PasswordInput(props: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const label = showPassword ? "Hide password" : "Show password";
  return (
    <div className="relative">
      <input
        {...props}
        type={showPassword ? "text" : "password"}
        className={`${inputCls} pr-11 ${props.className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={label}
        aria-pressed={showPassword}
        title={label}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-mist transition hover:text-ink focus:outline-none focus-visible:text-teal"
      >
        {showPassword ? (
          <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
        ) : (
          <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(phone.trim(), password);
      navigate({ to: redirect ?? (user.role === "sacco" ? "/sacco" : "/market") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to"
      italic="SokoSense."
      sub="Farmers and SACCO partners — sign in with your phone number to reach market prices, loans and advisory."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="phone">Phone number</label>
          <input
            id="phone"
            className={inputCls}
            placeholder="0712 345 678"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            placeholder="Your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-[12.5px] text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50"
        >
          {busy ? "Signing in…" : (<>Log in <LogIn className="ml-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" /></>)}
        </button>
      </form>
      <p className="mt-5 text-center text-[12.5px] text-steel">
        New to SokoSense?{" "}
        <Link to="/register" className="text-teal font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
