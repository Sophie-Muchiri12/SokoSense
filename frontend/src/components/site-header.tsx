import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { SokoSenseLogo } from "./sokosense-logo";
import { useAuth } from "@/lib/auth";
import { ArrowRight } from "lucide-react";

/**
 * Account tools — these live inside the signed-in user's account menu,
 * never as loose links on the public homepage/header.
 * `roles` restricts an item (SACCO Dashboard is SACCO-only).
 */
const accountNav = [
  { to: "/simulator", label: "SMS Simulator" },
  { to: "/market", label: "Market Map" },
  { to: "/timing", label: "Sell Timing" },
  { to: "/advisory", label: "Advisory" },
  { to: "/loans", label: "Loan Analyzer" },
  { to: "/sacco", label: "SACCO Dashboard", roles: ["sacco"] },
  { to: "/ussd", label: "USSD" },
] as const;

export function SiteHeader() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false); // mobile menu
  const [accountOpen, setAccountOpen] = useState(false); // account dropdown
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const accountRef = useRef<HTMLDivElement>(null);

  const tools = accountNav.filter(
    (item) => !("roles" in item) || (user && (item.roles as readonly string[]).includes(user.role)),
  );

  // Close menus when route changes
  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open && !accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, accountOpen]);

  // Close the account dropdown on outside click
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 group" aria-label="SokoSense home">
          <SokoSenseLogo />
        </Link>

        {/* Right side: account menu when signed in, auth CTAs when not.
            No tool links are shown to signed-out visitors. */}
        <div className="hidden lg:flex items-center gap-2">
          {user ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2.5 rounded-full border border-hairline bg-paper py-1.5 pl-1.5 pr-3.5 hover:border-ink/40 transition"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal text-paper text-[12px] font-semibold uppercase">
                  {user.name.trim().charAt(0) || "?"}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-[12.5px] font-medium text-ink">{user.name}</span>
                  <span className="block text-[10.5px] capitalize text-mist">{user.role} account</span>
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-mist transition ${accountOpen ? "rotate-180" : ""}`} aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {accountOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-hairline bg-paper shadow-card">
                  <div className="border-b border-hairline px-4 py-3">
                    <p className="text-[13px] font-medium text-ink">{user.name}</p>
                    <p className="text-[11.5px] text-mist mt-0.5">
                      {user.phone} · <span className="capitalize">{user.role}</span>
                    </p>
                  </div>
                  <nav aria-label="Account" className="py-1.5">
                    {tools.map((item) => {
                      const active = pathname.startsWith(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          role="menuitem"
                          className={`flex items-center justify-between px-4 py-2.5 text-[13px] transition ${
                            active ? "bg-canvas font-medium text-ink" : "text-steel hover:bg-canvas hover:text-ink"
                          }`}
                        >
                          {item.label}
                          <ArrowRight className="h-3.5 w-3.5 text-mist" aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="border-t border-hairline py-1.5">
                    <button
                      onClick={logout}
                      className="w-full px-4 py-2.5 text-left text-[13px] text-rose-600 hover:bg-rose-50 transition"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="text-[13px] font-medium text-steel hover:text-ink">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:bg-ink-soft"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6l-12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="lg:hidden border-t border-hairline bg-paper">
          <nav aria-label="Mobile" className="mx-auto max-w-[1240px] px-5 py-3 flex flex-col gap-0.5">
            {user ? (
              <>
                <div className="px-3 py-2">
                  <p className="text-[13.5px] font-medium text-ink">{user.name}</p>
                  <p className="text-[11.5px] text-mist mt-0.5">
                    {user.phone} · <span className="capitalize">{user.role} account</span>
                  </p>
                </div>
                {tools.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-lg px-3 py-2.5 text-[14px] font-medium ${
                        active ? "bg-canvas text-ink" : "text-steel hover:bg-canvas hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  onClick={logout}
                  className="mt-2 rounded-full border border-hairline bg-paper px-4 py-2.5 text-center text-[13px] font-medium text-rose-600"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="mt-1 rounded-full border border-ink/15 bg-paper px-4 py-2.5 text-center text-[13px] font-medium text-ink"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="mt-1 rounded-full bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-paper hover:bg-ink-soft"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
