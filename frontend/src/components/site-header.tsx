import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SokoSenseLogo } from "./sokosense-logo";

const nav = [
  { to: "/", label: "Overview" },
  { to: "/simulator", label: "SMS Simulator" },
  { to: "/market", label: "Market Map" },
  { to: "/timing", label: "Sell Timing" },
  { to: "/advisory", label: "Advisory" },
  { to: "/loans", label: "Loan Analyzer" },
  { to: "/sacco", label: "SACCO Dashboard" },
  { to: "/ussd", label: "USSD" },
  { to: "/admin", label: "Operations" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close mobile menu when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 group" aria-label="SokoSense home">
          <SokoSenseLogo />
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-steel transition hover:text-ink hover:bg-paper"
              activeProps={{ className: "rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ink bg-paper shadow-card" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <a className="text-[13px] font-medium text-steel hover:text-ink" href="#docs">
            Docs
          </a>
          <Link
            to="/sacco"
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:bg-ink-soft"
          >
            Partner login
          </Link>
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
            {nav.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
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
            <Link
              to="/sacco"
              className="mt-2 rounded-full bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-paper hover:bg-ink-soft"
            >
              Partner login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
