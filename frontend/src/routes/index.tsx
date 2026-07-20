import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { postAgent, type AgentResponse } from "@/lib/sokosense-api";

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

/** Pre-seeded demo prompts — click any to fire a real agent call */
const DEMO_PROMPTS = [
  { id: "maize",   farmer: "PRICE MAIZE NAKURU" },
  { id: "loan",    farmer: "LOAN 35000 BEANS 6 MONTHS" },
  { id: "weather", farmer: "WEATHER MERU NEXT 7 DAYS" },
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
          <Inline icon="●" text="Live market intelligence" iconClass="text-teal" />
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
  const [activeId, setActiveId] = useState(DEMO_PROMPTS[0].id);
  const [turns, setTurns] = useState<SmsTurn[]>([
    { from: "farmer", text: DEMO_PROMPTS[0].farmer, meta: "+254 7•• ••• 421 · tap to run" },
  ]);
  const [loading, setLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const cancelRef = useRef(false);

  const runPrompt = async (id: string) => {
    const prompt = DEMO_PROMPTS.find((p) => p.id === id);
    if (!prompt || loading) return;

    cancelRef.current = false;
    setActiveId(id);
    setLoading(true);
    setLatencyMs(null);
    setLastResponse(null);
    setTurns([
      { from: "farmer", text: prompt.farmer, meta: "+254 7•• ••• 421 · just now" },
    ]);

    try {
      const start = performance.now();
      const result = await postAgent(prompt.farmer);
      if (cancelRef.current) return;
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setLastResponse(result);
      setTurns([
        { from: "farmer", text: prompt.farmer, meta: "+254 7•• ••• 421 · just now" },
        { from: "engine", text: result.response, meta: `SokoSense · ${elapsed}ms` },
      ]);
    } catch {
      if (cancelRef.current) return;
      setTurns((prev) => [
        ...prev,
        {
          from: "engine",
          text: "Sorry, the engine is not reachable right now. Please try again.",
          meta: "SokoSense · error",
        },
      ]);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6">
      <div className="card-surface overflow-hidden">
        <div className="grid lg:grid-cols-[1.05fr_1.35fr_0.95fr]">
          {/* Left: prompt picker */}
          <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#0F7E70_0%,#0D9280_40%,#0a6a5e_100%)] p-10 text-paper relative">
            <p className="eyebrow text-paper/70">Live SMS simulator</p>
            <h2 className="font-serif text-[36px] leading-[1.05] mt-3 text-paper">
              A farmer texts.
              <br />
              <span className="italic">We listen.</span>
            </h2>
            <p className="mt-4 text-[13px] leading-relaxed text-paper/80 max-w-sm">
              Tap any prompt to fire a real message to the SokoSense AI agent. Responses come live from the engine.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {DEMO_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => runPrompt(p.id)}
                  disabled={loading}
                  className={`text-left rounded-xl border px-4 py-3 text-[12px] transition disabled:opacity-60 ${
                    activeId === p.id
                      ? "border-paper/40 bg-paper/10 text-paper"
                      : "border-paper/15 bg-paper/5 text-paper/80 hover:border-paper/30"
                  }`}
                >
                  <span className="font-mono tracking-wider">{p.farmer}</span>
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
              <span className={`chip ${loading ? "border-amber/40 text-amber" : "border-teal/40 text-teal"}`}>
                {loading ? "● running…" : turns.length > 1 ? "● delivered" : "○ idle"}
              </span>
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

              {loading && (
                <div className="flex justify-end">
                  <div className="max-w-[88%]">
                    <div className="rounded-2xl bg-ink/80 px-5 py-4 rounded-br-md">
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-paper/60 animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-paper/60 animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-paper/60 animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-dashed border-fog bg-paper px-4 py-3 flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${loading ? "bg-amber animate-pulse" : "bg-teal"}`} />
              <p className="text-[12px] text-steel">
                {loading
                  ? "Agent is thinking…"
                  : latencyMs !== null
                  ? <>Engine response time <span className="tabular text-ink font-medium">{latencyMs}ms</span> · powered by SokoSense AI</>
                  : "Tap a prompt to run the engine"}
              </p>
            </div>
          </div>

          {/* Right: engine trace */}
          <div className="bg-paper p-8">
            <p className="eyebrow">Engine trace</p>
            <h3 className="font-serif text-[22px] text-ink mt-2">How we decided</h3>
            {turns.length > 1 ? (
              <ul className="mt-5 divide-y divide-hairline">
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Intent</p>
                  <p className="mt-1 text-[14px] text-ink tabular">
                    {DEMO_PROMPTS.find((p) => p.id === activeId)?.farmer ?? "—"}
                  </p>
                </li>
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Response type</p>
                  <p className="mt-1 text-[14px] text-ink tabular capitalize">
                    {lastResponse?.type ?? "—"}
                  </p>
                </li>
                {lastResponse?.raw?.messages?.some((m) => m.tool_calls?.length) && (
                  <li className="py-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Tools</p>
                    <p className="mt-1 text-[12px] text-ink font-mono">
                      {lastResponse.raw.messages
                        .flatMap((m) => m.tool_calls?.map((t) => t.name) ?? [])
                        .join(", ")}
                    </p>
                  </li>
                )}
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Latency</p>
                  <p className="mt-1 text-[14px] text-ink tabular">
                    {latencyMs !== null ? `${latencyMs}ms` : "—"}
                  </p>
                </li>
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Powered by</p>
                  <p className="mt-1 text-[14px] text-ink tabular">SokoSense Agent</p>
                </li>
              </ul>
            ) : (
              <p className="mt-5 text-[13px] text-mist">Tap a prompt to see the engine trace.</p>
            )}
            <div className="mt-6 rounded-xl bg-green-surface p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-green-deep/70">Status</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-serif text-[24px] leading-none text-green-deep tabular">
                  {loading ? "Running…" : turns.length > 1 ? "Ready" : "Idle"}
                </span>
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
    { v: "7", l: "Live markets across Kenya" },
    { v: "Real-time", l: "AI-powered agent responses" },
    { v: "SMS + USSD", l: "Delivery channels supported" },
    { v: "Neo4j RAG", l: "Knowledge graph powering advisory" },
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
      desc: "Cached crop prices, arbitrage routes and demand heat across every county we serve.",
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
      to: "/timing",
      title: "Sell Timing Engine",
      desc: "SELL_TODAY or WAIT — cached market price trends tell farmers when to move their harvest.",
      tag: "Timing",
    },
    {
      to: "/advisory",
      title: "Crop Advisory (RAG)",
      desc: "Neo4j knowledge graph + weather for disease, pest and agronomy questions.",
      tag: "Advisory",
    },
    {
      to: "/simulator",
      title: "SMS Intelligence Simulator",
      desc: "Send any message to the live agent and inspect the full pipeline — intent, market signal, LLM reply.",
      tag: "Live Agent",
    },
    {
      to: "/admin",
      title: "Operations Dashboard",
      desc: "Engine health, API status and request logs for the SokoSense team.",
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
      </div>
    </section>
  );
}

function NetworkSection() {
  const markets = useMemo(
    () => [
      { x: 38, y: 64, label: "Nairobi",  trend: "+2.1%" },
      { x: 33, y: 50, label: "Nakuru",   trend: "-0.4%" },
      { x: 25, y: 38, label: "Eldoret",  trend: "+6.2%" },
      { x: 28, y: 28, label: "Kitale",   trend: "+3.7%" },
      { x: 50, y: 42, label: "Meru",     trend: "+1.2%" },
      { x: 18, y: 70, label: "Kisumu",   trend: "-1.1%" },
      { x: 72, y: 78, label: "Mombasa",  trend: "+0.8%" },
    ],
    [],
  );

  return (
    <section className="mx-auto max-w-[1240px] px-5 sm:px-6 mt-24">
      <div className="card-surface overflow-hidden grid lg:grid-cols-[1fr_1.15fr]">
        <div className="p-10">
          <p className="eyebrow">Network intelligence</p>
          <h2 className="display mt-4 text-[40px] text-ink">
            A synced map of
            <br />
            <span className="italic text-teal">where food moves.</span>
          </h2>
          <p className="mt-5 text-[14px] leading-relaxed text-steel max-w-md">
            We sync pricing from wholesale markets into a local database on schedule, blend it with weather,
            transport corridors and cooperative reporting — and route advice back to the farmer who needs it most.
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

function KenyaMiniMap({
  markets,
}: {
  markets: { x: number; y: number; label: string; trend: string }[];
}) {
  return (
    <div className="relative w-full aspect-[5/4] rounded-xl border border-hairline bg-paper overflow-hidden">
      <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full">
        <path
          d="M14,28 L20,18 L40,12 L62,16 L78,22 L82,38 L72,52 L78,68 L60,78 L36,80 L22,72 L14,58 Z"
          fill="#F5F7F4"
          stroke="#DCE2DA"
          strokeWidth="0.4"
        />
        {[
          [38, 64, 33, 50],
          [33, 50, 25, 38],
          [25, 38, 28, 28],
          [38, 64, 50, 42],
          [38, 64, 18, 70],
          [38, 64, 72, 78],
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
  const partners = [
    "Tumaini SACCO",
    "Mwea Rice Co-op",
    "Kakuzi Plc",
    "Equity Foundation",
    "Mercy Corps",
    "One Acre Fund",
  ];
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
            to="/simulator"
            className="rounded-full bg-paper px-6 py-3 text-[13px] font-medium text-ink text-center hover:bg-canvas"
          >
            Try the live agent now
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
