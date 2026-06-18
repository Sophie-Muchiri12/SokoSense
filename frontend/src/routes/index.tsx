import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SokoSense — Agricultural intelligence for East Africa" },
      {
        name: "description",
        content:
          "Real-time market prices, AI advisory and credit scoring delivered to any farmer with a feature phone. Built for SACCOs, cooperatives and agribusinesses.",
      },
      { property: "og:title", content: "SokoSense — Agricultural intelligence for East Africa" },
      {
        property: "og:description",
        content: "AI advisory, market intelligence and credit scoring for smallholder farmers and rural lenders.",
      },
    ],
  }),
  component: LandingPage,
});

type SmsTurn = { from: "farmer" | "engine"; text: string; meta?: string };

const SCRIPTS: { id: string; farmer: string; analysis: { label: string; value: string }[]; reply: string }[] = [
  {
    id: "maize",
    farmer: "PRICE MAIZE NAKURU",
    analysis: [
      { label: "Intent", value: "Spot price · maize · Nakuru" },
      { label: "Market signal", value: "Eldoret KSh 4,820 / 90kg (+6.2%)" },
      { label: "Logistics", value: "Distance 162km · transport KSh 280/bag" },
      { label: "Recommendation", value: "Hold 2 weeks · sell Eldoret" },
    ],
    reply:
      "Maize Nakuru: KSh 4,520. Eldoret pays KSh 4,820 (+6.2%). After transport you gain KSh 20/bag. We suggest holding 14 days — forecast +KSh 180.",
  },
  {
    id: "loan",
    farmer: "LOAN 35000 BEANS 6 MONTHS",
    analysis: [
      { label: "Intent", value: "Credit eligibility · input loan" },
      { label: "Risk band", value: "Tier B · 0.72 confidence" },
      { label: "Suggested APR", value: "18.4% · 6 month bullet" },
      { label: "Decision", value: "Pre-approved subject to SACCO review" },
    ],
    reply:
      "KSh 35,000 beans loan, 6m: Pre-approved at 18.4% APR. Monthly KSh 6,420. Visit Tumaini SACCO branch with national ID to finalize.",
  },
  {
    id: "weather",
    farmer: "WEATHER MERU NEXT 7 DAYS",
    analysis: [
      { label: "Intent", value: "Localized weather · 7d" },
      { label: "Signal", value: "Rain 38mm cumulative · 3 wet days" },
      { label: "Risk", value: "Late blight pressure rising" },
      { label: "Recommendation", value: "Apply preventative fungicide" },
    ],
    reply:
      "Meru 7d: 38mm rain, wet Tue–Thu. Blight risk HIGH for potato. Spray Mancozeb before Tuesday. Next check Friday.",
  },
];

function LandingPage() {
  return (
    <>
      <Hero />
      <SmsSimulator />
      <Stats />
      <ProductGrid />
      <NetworkSection />
      <PartnersStrip />
      <CTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-6 pt-20 pb-10 lg:pt-28 lg:pb-16 text-center">
        <p className="eyebrow">Agricultural intelligence · East Africa</p>
        <h1 className="display mt-6 text-[44px] sm:text-[64px] lg:text-[84px] text-ink">
          Markets, credit and advice
          <br />
          <span className="italic text-teal">at the speed of SMS.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-[15px] leading-relaxed text-steel">
          SokoSense is the AI-powered intelligence layer for African agriculture. Real-time prices, credit scoring
          and agronomic advisory — delivered to any farmer with a feature phone, and to the SACCOs that serve them.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/market"
            className="rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-paper hover:bg-ink-soft"
          >
            Explore the market map
          </Link>
          <Link
            to="/sacco"
            className="rounded-full border border-ink/15 bg-paper px-6 py-3 text-[13px] font-medium text-ink hover:border-ink/40"
          >
            For SACCOs & partners
          </Link>
        </div>
        <div className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[12px] text-steel">
          <Inline icon="📡" text="Works on USSD & SMS" />
          <Inline icon="●" text="42 markets · 8 counties live" iconClass="text-teal" />
          <Inline icon="◇" text="SACCO-grade credit engine" />
          <Inline icon="✓" text="Swahili · English · Kikuyu" />
        </div>
      </div>
    </section>
  );
}

function Inline({ icon, text, iconClass = "" }: { icon: string; text: string; iconClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`text-[11px] ${iconClass}`}>{icon}</span>
      <span>{text}</span>
    </span>
  );
}

function SmsSimulator() {
  const [active, setActive] = useState(SCRIPTS[0]);
  const [turns, setTurns] = useState<SmsTurn[]>([
    { from: "farmer", text: SCRIPTS[0].farmer, meta: "+254 7•• ••• 421 · 03:42" },
    { from: "engine", text: SCRIPTS[0].reply, meta: "SokoSense · 03:42" },
  ]);

  const onSelect = (id: string) => {
    const s = SCRIPTS.find((x) => x.id === id)!;
    setActive(s);
    setTurns([
      { from: "farmer", text: s.farmer, meta: "+254 7•• ••• 421 · just now" },
      { from: "engine", text: s.reply, meta: "SokoSense · just now" },
    ]);
  };

  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6">
      <div className="card-surface overflow-hidden">
        <div className="grid lg:grid-cols-[1.05fr_1.35fr_0.95fr]">
          {/* Left: phone */}
          <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#0F7E70_0%,#0D9280_40%,#0a6a5e_100%)] p-10 text-paper relative">
            <p className="eyebrow text-paper/70">Live SMS simulator</p>
            <h2 className="font-serif text-[36px] leading-[1.05] mt-3 text-paper">
              A farmer texts.
              <br />
              <span className="italic">We listen.</span>
            </h2>
            <p className="mt-4 text-[13px] leading-relaxed text-paper/80 max-w-sm">
              Tap any prompt to see how SokoSense parses the message, queries our intelligence graph, and replies
              within 1.4 seconds.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {SCRIPTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`text-left rounded-xl border px-4 py-3 text-[12px] transition ${
                    active.id === s.id
                      ? "border-paper/40 bg-paper/10 text-paper"
                      : "border-paper/15 bg-paper/5 text-paper/80 hover:border-paper/30"
                  }`}
                >
                  <span className="font-mono tracking-wider">{s.farmer}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Middle: conversation */}
          <div className="border-x border-hairline bg-canvas p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-steel">SMS thread</p>
                <p className="font-serif text-[20px] text-ink mt-0.5">Shortcode 21455</p>
              </div>
              <span className="chip">● delivered</span>
            </div>
            <div className="mt-6 space-y-4">
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.from === "farmer" ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[88%]">
                    <div
                      className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                        t.from === "farmer"
                          ? "bg-paper border border-hairline text-ink rounded-bl-md"
                          : "bg-ink text-paper rounded-br-md"
                      }`}
                    >
                      {t.text}
                    </div>
                    <p className="text-[10.5px] text-mist mt-1.5 px-1">{t.meta}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-dashed border-fog bg-paper px-4 py-3 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-teal animate-pulse" />
              <p className="text-[12px] text-steel">
                Engine response time <span className="tabular text-ink font-medium">1.42s</span> · 14 tokens · model
                gemini-flash-agri
              </p>
            </div>
          </div>

          {/* Right: analysis */}
          <div className="bg-paper p-8">
            <p className="eyebrow">Engine trace</p>
            <h3 className="font-serif text-[22px] text-ink mt-2">How we decided</h3>
            <ul className="mt-5 divide-y divide-hairline">
              {active.analysis.map((a) => (
                <li key={a.label} className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">{a.label}</p>
                  <p className="mt-1 text-[14px] text-ink tabular">{a.value}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-green-surface p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-green-deep/70">Confidence</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-serif text-[40px] leading-none text-green-deep tabular">92%</span>
                <span className="text-[11px] text-green-deep/80 pb-1.5">cross-checked across 3 markets</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const data = [
    { v: "42", l: "Live markets across Kenya" },
    { v: "1.4s", l: "Median SMS round-trip latency" },
    { v: "18,420", l: "Farmers reached this quarter" },
    { v: "KSh 240M", l: "Loan portfolio underwritten" },
  ];
  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6 mt-20">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded-2xl overflow-hidden border border-hairline">
        {data.map((d) => (
          <div key={d.l} className="bg-paper p-7">
            <p className="font-serif text-[44px] leading-none text-ink tabular">{d.v}</p>
            <p className="mt-3 text-[12.5px] text-steel">{d.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductGrid() {
  const items = [
    {
      to: "/market",
      title: "Market Intelligence Map",
      desc: "Live crop prices, arbitrage routes and demand heat across every county we serve.",
      tag: "Spatial",
    },
    {
      to: "/loans",
      title: "Loan Risk Analyzer",
      desc: "Underwrite input loans in seconds. Tiered APR, repayment shape, smallholder-tuned signals.",
      tag: "Credit",
    },
    {
      to: "/sacco",
      title: "SACCO Partner Dashboard",
      desc: "Regional cooperatives see their farmers, top crops, market exposure and risk in one view.",
      tag: "Operator",
    },
    {
      to: "/ussd",
      title: "USSD Experience Explorer",
      desc: "Walk through the *483# menu farmers see on any feature phone, in any region.",
      tag: "Field",
    },
    {
      to: "/admin",
      title: "Operations Dashboard",
      desc: "Engine health, API traffic, model latency and message volumes for the SokoSense team.",
      tag: "Internal",
    },
  ];
  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6 mt-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <p className="eyebrow">The platform</p>
          <h2 className="display mt-3 text-[40px] sm:text-[52px] text-ink max-w-2xl">
            One intelligence engine.
            <br />
            <span className="italic">Six surfaces for the field.</span>
          </h2>
        </div>
        <p className="text-[14px] text-steel max-w-sm">
          Whether through SMS, USSD or our SACCO console, every interaction is powered by the same retrieval graph
          and credit model.
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((it) => (
          <Link
            key={it.title}
            to={it.to}
            className="card-surface p-6 group hover:border-teal/40 transition flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="chip">{it.tag}</span>
              <span className="text-mist group-hover:text-teal transition">→</span>
            </div>
            <h3 className="font-serif text-[24px] text-ink mt-6 leading-tight">{it.title}</h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-steel flex-1">{it.desc}</p>
            <p className="mt-6 text-[12px] font-medium text-teal">Open module →</p>
          </Link>
        ))}
        <div className="card-surface p-6 bg-ink text-paper flex flex-col">
          <span className="chip bg-paper/10 text-paper">API · v2</span>
          <h3 className="font-serif text-[24px] mt-6 leading-tight">Developer API</h3>
          <p className="mt-3 text-[13.5px] leading-relaxed text-paper/70 flex-1">
            REST + webhook access to the prices, scoring and advisory engines. Bring SokoSense intelligence into
            your own field apps.
          </p>
          <p className="mt-6 text-[12px] font-medium text-teal-glow">Read the docs →</p>
        </div>
      </div>
    </section>
  );
}

function NetworkSection() {
  const markets = useMemo(
    () => [
      { x: 38, y: 64, label: "Nairobi", trend: "+2.1%" },
      { x: 33, y: 50, label: "Nakuru", trend: "-0.4%" },
      { x: 25, y: 38, label: "Eldoret", trend: "+6.2%" },
      { x: 28, y: 28, label: "Kitale", trend: "+3.7%" },
      { x: 50, y: 42, label: "Meru", trend: "+1.2%" },
      { x: 55, y: 30, label: "Marsabit", trend: "+4.0%" },
      { x: 18, y: 70, label: "Kisumu", trend: "-1.1%" },
      { x: 72, y: 78, label: "Mombasa", trend: "+0.8%" },
      { x: 60, y: 60, label: "Garissa", trend: "+5.4%" },
      { x: 42, y: 75, label: "Machakos", trend: "+0.2%" },
    ],
    []
  );

  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6 mt-24">
      <div className="card-surface overflow-hidden grid lg:grid-cols-[1fr_1.15fr]">
        <div className="p-10">
          <p className="eyebrow">Network intelligence</p>
          <h2 className="display mt-4 text-[40px] text-ink">
            A live map of
            <br />
            <span className="italic text-teal">where food moves.</span>
          </h2>
          <p className="mt-5 text-[14px] leading-relaxed text-steel max-w-md">
            We ingest pricing from 42 wholesale markets every hour, blend it with weather, transport corridors and
            cooperative reporting — and route advice back to the farmer who needs it most.
          </p>
          <ul className="mt-8 space-y-3 text-[13px] text-ink">
            <Bullet>Bottom-up data from cooperative reporters in every county</Bullet>
            <Bullet>AI-detected arbitrage routes with logistics-adjusted margin</Bullet>
            <Bullet>Designed for last-mile reach over 2G networks</Bullet>
          </ul>
          <Link
            to="/market"
            className="inline-flex items-center gap-2 mt-8 text-[13px] font-medium text-teal hover:text-teal-soft"
          >
            Open the full market map →
          </Link>
        </div>
        <div className="relative bg-[radial-gradient(80%_80%_at_50%_30%,#F0F5EE_0%,#E8EFE5_100%)] p-6">
          <KenyaMiniMap markets={markets} />
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-teal" />
      <span>{children}</span>
    </li>
  );
}

function KenyaMiniMap({ markets }: { markets: { x: number; y: number; label: string; trend: string }[] }) {
  return (
    <div className="relative w-full aspect-[5/4] rounded-xl border border-hairline bg-paper overflow-hidden">
      <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full">
        {/* abstract Kenya silhouette */}
        <path
          d="M14,28 L20,18 L40,12 L62,16 L78,22 L82,38 L72,52 L78,68 L60,78 L36,80 L22,72 L14,58 Z"
          fill="#F5F7F4"
          stroke="#DCE2DA"
          strokeWidth="0.4"
        />
        {/* routes */}
        {[
          [38, 64, 33, 50],
          [33, 50, 25, 38],
          [25, 38, 28, 28],
          [38, 64, 50, 42],
          [38, 64, 18, 70],
          [38, 64, 72, 78],
          [50, 42, 55, 30],
          [38, 64, 60, 60],
          [38, 64, 42, 75],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#0D9280"
            strokeOpacity="0.25"
            strokeWidth="0.3"
            strokeDasharray="0.6 0.6"
          />
        ))}
        {markets.map((m) => (
          <g key={m.label}>
            <circle cx={m.x} cy={m.y} r="1.6" fill="#0D9280" />
            <circle cx={m.x} cy={m.y} r="3.4" fill="#0D9280" fillOpacity="0.12" />
          </g>
        ))}
      </svg>
      {markets.map((m) => (
        <div
          key={m.label}
          className="absolute -translate-x-1/2 -translate-y-full pb-1"
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          <div className="rounded-md bg-paper border border-hairline shadow-card px-2 py-1 text-[10px] whitespace-nowrap">
            <span className="text-ink font-medium">{m.label}</span>
            <span
              className={`ml-1.5 tabular ${m.trend.startsWith("+") ? "text-green" : "text-rose"}`}
            >
              {m.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PartnersStrip() {
  const partners = ["Tumaini SACCO", "Mwea Rice Co-op", "Kakuzi Plc", "Equity Foundation", "Mercy Corps", "One Acre"];
  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6 mt-24">
      <p className="text-center eyebrow">Built with operators on the ground</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {partners.map((p) => (
          <span key={p} className="font-serif text-[20px] text-steel/70">
            {p}
          </span>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6 mt-24">
      <div className="card-surface bg-ink text-paper p-12 lg:p-16 flex flex-col lg:flex-row gap-10 lg:items-center justify-between">
        <div className="max-w-xl">
          <p className="eyebrow text-teal-glow">Deploy with us</p>
          <h2 className="font-serif text-[36px] lg:text-[44px] mt-4 leading-[1.05]">
            Intelligence belongs in every farmer's pocket — even when that pocket holds a feature phone.
          </h2>
        </div>
        <div className="flex flex-col gap-3 lg:w-auto">
          <Link
            to="/sacco"
            className="rounded-full bg-paper px-6 py-3 text-[13px] font-medium text-ink text-center hover:bg-canvas"
          >
            Pilot SokoSense with your network
          </Link>
          <Link
            to="/admin"
            className="rounded-full border border-paper/25 px-6 py-3 text-[13px] font-medium text-paper text-center hover:border-paper/60"
          >
            See engine operations
          </Link>
        </div>
      </div>
    </section>
  );
}
