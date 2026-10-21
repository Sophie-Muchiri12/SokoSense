/** Route guards — task pages render only for the right identity. */
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

function GuardShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[560px] px-5 sm:px-6 pt-16 pb-14 text-center">
      {children}
    </div>
  );
}

/** Requires a signed-in user (farmer or SACCO). Optionally restricts roles. */
export function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: string[];
}) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: "/login", search: { redirect: window.location.pathname } });
    }
  }, [ready, user, navigate]);

  if (!ready) {
    return (
      <GuardShell>
        <p className="text-[13px] text-steel flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal animate-pulse" /> Checking your session…
        </p>
      </GuardShell>
    );
  }
  if (!user) return null; // redirecting to /login

  if (roles && !roles.includes(user.role)) {
    return (
      <GuardShell>
        <p className="eyebrow">Restricted</p>
        <h1 className="display mt-3 text-[34px] text-ink">This area is for {roles.join(" / ")} accounts</h1>
        <p className="mt-3 text-[13.5px] text-steel leading-relaxed">
          You're signed in as <span className="text-ink font-medium">{user.name}</span> ({user.role}).
          Switch accounts to continue.
        </p>
        <Link
          to="/market"
          className="inline-flex mt-6 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-paper hover:bg-ink-soft"
        >
          Go to the market map
        </Link>
      </GuardShell>
    );
  }
  return <>{children}</>;
}

/** Requires the admin session (7-digit PIN via /admin-login). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !isAdmin) navigate({ to: "/admin-login" });
  }, [ready, isAdmin, navigate]);

  if (!ready) {
    return (
      <GuardShell>
        <p className="text-[13px] text-steel flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal animate-pulse" /> Checking admin session…
        </p>
      </GuardShell>
    );
  }
  if (!isAdmin) return null; // redirecting to /admin-login
  return <>{children}</>;
}
