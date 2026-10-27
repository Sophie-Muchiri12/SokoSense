import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { SokoSenseLogo } from "./sokosense-logo";

export function SiteFooter() {
  const { user } = useAuth();
  return (
    <footer className="border-t border-hairline bg-paper mt-16 sm:mt-24">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-6 py-12 sm:py-16 grid gap-10 sm:gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <SokoSenseLogo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-steel">
            Today's market prices, farming advice and honest loan checks for farmers and SACCOs across East Africa — by text message, on any phone.
          </p>
          <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-mist">
            Nairobi · Kampala · Kigali
          </p>
        </div>
        {user && (
          <>
            <FooterCol
              title="My account"
              links={[
                { to: "/simulator", label: "SMS Simulator" },
                { to: "/market", label: "Market Map" },
                { to: "/advisory", label: "Advisory" },
                { to: "/loans", label: "Loan Analyzer" },
                ...(user.role === "sacco"
                  ? [{ to: "/sacco", label: "SACCO Dashboard" }]
                  : []),
                { to: "/ussd", label: "USSD" },
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
          </>
        )}
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
          <div className="flex items-center gap-5">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Data ethics</span>
            <Link
              to="/admin-login"
              className="rounded-full border border-ink/20 bg-paper px-4 py-1.5 text-[12px] font-medium text-ink hover:border-ink/50"
            >
              Admin
            </Link>
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
