import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-paper mt-24">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-6 py-16 grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink text-paper">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 18c4-10 12-10 16 0" />
                <path d="M12 4v14" />
              </svg>
            </span>
            <span className="font-serif text-[22px] text-ink">Soko<span className="text-teal">Sense</span></span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-steel">
            Agricultural intelligence infrastructure for smallholder farmers and rural lenders across East Africa.
            Built for SMS, USSD and field-grade reliability.
          </p>
          <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-mist">
            Nairobi · Kampala · Kigali
          </p>
        </div>
        <FooterCol
          title="Platform"
          links={[
            { to: "/market", label: "Market Map" },
            { to: "/loans", label: "Loan Analyzer" },
            { to: "/ussd", label: "USSD Journey" },
            { to: "/admin", label: "Operations" },
          ]}
        />
        <FooterCol
          title="Partners"
          links={[
            { to: "/sacco", label: "SACCO Dashboard" },
            { to: "/sacco", label: "Cooperatives" },
            { to: "/sacco", label: "Agribusiness" },
            { to: "/sacco", label: "NGOs" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { to: "/", label: "About" },
            { to: "/", label: "Research" },
            { to: "/", label: "Press" },
            { to: "/", label: "Contact" },
          ]}
        />
      </div>
      <div className="border-t border-hairline">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-steel">
          <span>© {new Date().getFullYear()} SokoSense Intelligence Ltd. All rights reserved.</span>
          <div className="flex gap-5">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Data ethics</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l, i) => (
          <li key={i}>
            <Link to={l.to} className="text-[13px] text-ink/80 hover:text-teal">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
