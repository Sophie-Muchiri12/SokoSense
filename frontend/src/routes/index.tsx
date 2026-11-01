import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { postAgent, type AgentResponse } from "@/lib/sokosense-api";
import {
  ArrowRight,
  HandCoins,
  Languages,
  Leaf,
  MessageSquareText,
  Phone,
  Sprout,
  Store,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SokoSense — Better prices and good advice for farmers" },
      {
        name: "description",
        content:
          "Check today's market prices, get farming advice and fair-loan checks by text message — on any phone. Made for farmers, SACCOs and farmer groups.",
      },
      { property: "og:title", content: "SokoSense — Better prices and good advice for farmers" },
      {
        property: "og:description",
        content: "Today's market prices, farming advice and fair-loan checks for farmers and their SACCOs.",
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
      <HomeNav />
      <Hero />
      <HowItWorks />
      <SmsSimulator />
      <Stats />
      <ProductGrid />
      <NetworkSection />
      <WhoItsFor />
      <ImageStrip />
      <Faq />
      <PartnersStrip />
      <CTA />
    </>
  );
}

const HOME_SECTIONS = [
  { href: "#home", label: "Home" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#what-we-offer", label: "What we offer" },
  { href: "#try-it", label: "Try it" },
  { href: "#who-its-for", label: "Who it's for" },
  { href: "#questions", label: "Questions" },
];

/** Homepage-only nav: jumps to the sections on this page, in plain words. */
function HomeNav() {
  return (
    <div className="sticky top-16 z-30 border-b border-hairline bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-6">
        <nav aria-label="On this page" className="flex items-center gap-1 overflow-x-auto py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {HOME_SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-steel transition hover:bg-paper hover:text-ink"
            >
              {s.label}
            </a>
          ))}
          <a
            href="#get-started"
            className="ml-auto whitespace-nowrap rounded-full bg-teal px-4 py-1.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft"
          >
            Get started — free
          </a>
        </nav>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Ask a question",
      desc: "Text us on any phone, or log in here. Ask about prices, a loan, or a problem with your crops.",
    },
    {
      n: "2",
      title: "We check for you",
      desc: "We look at today's prices from markets across Kenya and trusted farming know-how.",
    },
    {
      n: "3",
      title: "Get a clear answer",
      desc: "One short, clear reply: sell here, this loan is too costly — and why. No jargon, no guesswork.",
    },
  ];
  return (
    <section id="how-it-works" className="mx-auto max-w-[1240px] min-w-0 scroll-mt-32 px-5 sm:px-6 mt-16 sm:mt-24">
      <p className="eyebrow">How it works</p>
      <h2 className="display mt-3 text-[36px] sm:text-[48px] text-ink">
        Three simple steps, <span className="italic text-teal">on any phone.</span>
      </h2>
      <div className="mt-10 grid md:grid-cols-3 gap-5">
        {steps.map((s) => (
          <div key={s.n} className="card-surface p-6">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal text-paper font-serif text-[18px]">
              {s.n}
            </span>
            <h3 className="font-serif text-[22px] text-ink mt-5">{s.title}</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-steel">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImageStrip() {
  return (
    <section className="mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 mt-16 sm:mt-24">
      <div className="relative overflow-hidden rounded-[28px] border border-hairline shadow-card">
        <img
          src="/images/healthy-crops.jpg"
          alt="A farmer's hands checking a healthy green maize leaf in the field"
          className="h-[300px] w-full object-cover sm:h-[360px]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-paper/80">
            <Leaf className="h-4 w-4" aria-hidden="true" /> Healthy crops, fair prices
          </p>
          <p className="mt-2 max-w-md font-serif text-[26px] leading-snug text-paper sm:text-[32px]">
            Care for your crop, then sell it where it earns the most.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhoItsFor() {
  const groups = [
    {
      title: "For farmers",
      points: [
        "Know today's price before you travel to market",
        "Sell where you earn most — and know when to wait",
        "Check a loan before you sign, in plain language",
        "Get help with pests, disease and planting",
      ],
    },
    {
      title: "For SACCOs & farmer groups",
      points: [
        "See your members' main crops and where they sell",
        "Spot risky loans early and support members better",
        "Share one trusted price with the whole group",
        "Help members earn more from every harvest",
      ],
    },
  ];
  return (
    <section id="who-its-for" className="mx-auto max-w-[1240px] min-w-0 scroll-mt-32 px-5 sm:px-6 mt-16 sm:mt-24">
      <p className="eyebrow">Who it's for</p>
      <h2 className="display mt-3 text-[36px] sm:text-[48px] text-ink">
        Made for the farm, <span className="italic text-teal">and the group behind it.</span>
      </h2>
      <div className="mt-10 overflow-hidden rounded-[24px] border border-hairline shadow-card">
        <img
          src="/images/farmers-group.jpg"
          alt="Farmers from a cooperative sitting together under a tree, planning with a notebook"
          className="h-[240px] w-full object-cover sm:h-[300px]"
          loading="lazy"
        />
      </div>
      <div className="mt-6 grid md:grid-cols-2 gap-5">
        {groups.map((g) => (
          <div key={g.title} className="card-surface p-6 sm:p-8">
            <h3 className="font-serif text-[24px] text-ink">{g.title}</h3>
            <ul className="mt-5 space-y-3">
              {g.points.map((pt) => (
                <Bullet key={pt}>{pt}</Bullet>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Do I need a smartphone or internet?",
      a: "No. SokoSense works by text message (SMS and USSD) on any phone — even the simplest one. If you do have internet, you can also use this website.",
    },
    {
      q: "What can I ask?",
      a: "Today's price for your crop and where to sell it, whether to sell now or wait, whether a loan is fair, and advice on pests, disease and growing your crops.",
    },
    {
      q: "Where do the prices come from?",
      a: "From market reports collected at wholesale markets across Kenya (KAMIS, the government market information service). We refresh them regularly and always use the newest reports.",
    },
    {
      q: "How do I start?",
      a: "Create a free account with your phone number, then log in and ask your first question. The same phone number is your identity on SMS and USSD too.",
    },
    {
      q: "Which languages are supported?",
      a: "English and Swahili, written in short, simple messages that are easy to read on any screen.",
    },
  ];
  return (
    <section id="questions" className="mx-auto max-w-[1240px] min-w-0 scroll-mt-32 px-5 sm:px-6 mt-16 sm:mt-24">
      <p className="eyebrow">Questions</p>
      <h2 className="display mt-3 text-[36px] sm:text-[48px] text-ink">
        Things farmers <span className="italic text-teal">often ask us.</span>
      </h2>
      <div className="mt-10 grid md:grid-cols-2 gap-5">
        {items.map((it) => (
          <div key={it.q} className="card-surface p-6">
            <h3 className="text-[15px] font-semibold text-ink">{it.q}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-steel">{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section id="home" className="relative scroll-mt-32 overflow-hidden">
      <div className="mx-auto grid max-w-[1240px] min-w-0 items-center gap-10 px-5 sm:px-6 pt-12 sm:pt-16 pb-10 lg:grid-cols-[1.02fr_0.98fr] lg:pt-20 lg:pb-16">
        <div>
          <p className="eyebrow">Helping farmers sell well · East Africa</p>
          <h1 className="display mt-6 text-[42px] sm:text-[58px] lg:text-[68px] text-ink">
            Better prices and good advice,
            <br />
            <span className="italic text-teal">straight to your phone.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-steel">
            SokoSense helps you check today's market prices, decide when and where to sell, tell whether a loan
            is fair, and get farming advice — by text message on any phone, or right here on the web.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-paper hover:bg-ink-soft"
            >
              Create your account <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="rounded-full border border-ink/15 bg-paper px-6 py-3 text-[13px] font-medium text-ink hover:border-ink/40"
            >
              Log in
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-steel">
            <Inline icon={MessageSquareText} text="Works by text message — no smartphone needed" />
            <Inline icon={Store} text="Today's prices from markets across Kenya" />
            <Inline icon={HandCoins} text="Honest loan checks, in plain language" />
            <Inline icon={Languages} text="English and Swahili" />
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-[28px] border border-hairline shadow-card">
            <img
              src="/images/hero-farmer-market.jpg"
              alt="A farmer smiling at a market stall full of maize, tomatoes and greens, checking prices on his phone"
              className="aspect-[4/3] w-full object-cover"
              loading="eager"
            />
          </div>
          <div className="absolute -bottom-5 left-5 right-5 sm:right-auto sm:min-w-[280px] rounded-2xl border border-hairline bg-paper/95 p-4 shadow-card backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink">Know before you travel</p>
                <p className="text-[11.5px] leading-snug text-steel">
                  Check which market pays most today — then decide.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Inline({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
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
        { from: "engine", text: result.response, meta: `SokoSense · answered in ${elapsed < 1000 ? "less than a second" : `${Math.round(elapsed / 100) / 10} seconds`}` },
      ]);
    } catch {
      if (cancelRef.current) return;
      setTurns((prev) => [
        ...prev,
        {
          from: "engine",
          text: "Sorry, we could not answer right now. Please try again in a moment.",
          meta: "SokoSense · please try again",
        },
      ]);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  };

  return (
    <section id="try-it" className="mx-auto max-w-[1240px] min-w-0 scroll-mt-32 px-5 sm:px-6 mt-16 sm:mt-24">
      <div className="card-surface overflow-hidden">
        <div className="grid lg:grid-cols-[1.05fr_1.35fr_0.95fr]">
          {/* Left: prompt picker */}
          <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#0F7E70_0%,#0D9280_40%,#0a6a5e_100%)] p-6 sm:p-8 lg:p-10 text-paper relative">
            <p className="eyebrow text-paper/70">Try it here</p>
            <h2 className="font-serif text-[36px] leading-[1.05] mt-3 text-paper">
              A farmer sends a text.
              <br />
              <span className="italic">We reply with help.</span>
            </h2>
            <p className="mt-4 text-[13px] leading-relaxed text-paper/80 max-w-sm">
              Tap an example below to send it, just like a farmer would — and read our real reply.
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
          <div className="border-x border-hairline bg-canvas p-5 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-steel">Text messages</p>
                <p className="font-serif text-[20px] text-ink mt-0.5">Our number: 21455</p>
              </div>
              <span className={`chip ${loading ? "border-amber/40 text-amber" : "border-teal/40 text-teal"}`}>
                {loading ? "● sending…" : turns.length > 1 ? "● answered" : "○ ready"}
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
                  ? "Checking prices and preparing your answer…"
                  : latencyMs !== null
                  ? <>Answered in <span className="tabular text-ink font-medium">{latencyMs < 1000 ? "less than a second" : `${Math.round(latencyMs / 100) / 10} seconds`}</span></>
                  : "Tap an example on the left to try"}
              </p>
            </div>
          </div>

          {/* Right: why this answer */}
          <div className="bg-paper p-5 sm:p-8">
            <p className="eyebrow">Your question, answered</p>
            <h3 className="font-serif text-[22px] text-ink mt-2">Why this answer?</h3>
            {turns.length > 1 ? (
              <ul className="mt-5 divide-y divide-hairline">
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">What was asked</p>
                  <p className="mt-1 text-[14px] text-ink tabular">
                    {DEMO_PROMPTS.find((p) => p.id === activeId)?.farmer ?? "—"}
                  </p>
                </li>
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Type of help</p>
                  <p className="mt-1 text-[14px] text-ink tabular capitalize">
                    {lastResponse?.type ?? "—"}
                  </p>
                </li>
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Time to answer</p>
                  <p className="mt-1 text-[14px] text-ink tabular">
                    {latencyMs !== null ? (latencyMs < 1000 ? "Less than a second" : `${Math.round(latencyMs / 100) / 10} seconds`) : "—"}
                  </p>
                </li>
                <li className="py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-mist">Answered by</p>
                  <p className="mt-1 text-[14px] text-ink tabular">SokoSense</p>
                </li>
              </ul>
            ) : (
              <p className="mt-5 text-[13px] text-mist">Tap an example on the left and we will explain our answer here.</p>
            )}
            <div className="mt-6 rounded-xl bg-green-surface p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-green-deep/70">Status</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-serif text-[24px] leading-none text-green-deep tabular">
                  {loading ? "Working…" : turns.length > 1 ? "Answered" : "Ready"}
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
    { v: "7", l: "Markets across Kenya whose prices we follow" },
    { v: "Today's", l: "Prices, checked from the newest market reports" },
    { v: "Any phone", l: "Works by text message — no smartphone or internet needed" },
    { v: "Free", l: "To start — create an account and ask your first question" },
  ];
  return (
    <section className="mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 mt-16 sm:mt-20">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded-2xl overflow-hidden border border-hairline">
        {data.map((d) => (
          <div key={d.l} className="bg-paper p-5 sm:p-7">
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
      icon: Store,
      to: "/market",
      title: "Today's market prices",
      desc: "See what buyers are paying today in markets near you — and which market pays you most.",
      tag: "Prices",
    },
    {
      icon: HandCoins,
      to: "/loans",
      title: "Is this loan fair?",
      desc: "Thinking of borrowing? Enter what the loan will cost and we tell you if it is fair — or too expensive.",
      tag: "Loans",
    },
    {
      icon: Sprout,
      to: "/advisory",
      title: "Help with your crops",
      desc: "Ask about pests, disease, planting and caring for your crops, in simple everyday language.",
      tag: "Farming advice",
    },
    {
      icon: MessageSquareText,
      to: "/simulator",
      title: "See it work by text",
      desc: "Try SokoSense the way a farmer uses it: send a question by text message and read our reply.",
      tag: "Try it",
    },
    {
      icon: Phone,
      to: "/ussd",
      title: "Works on any phone",
      desc: "No smartphone? Dial our code and follow simple menus to get prices and advice.",
      tag: "Any phone",
    },
    {
      icon: Users,
      to: "/sacco",
      title: "For SACCOs & groups",
      desc: "See your members' main crops, where they sell, and which loans need attention — all in one place.",
      tag: "Groups",
    },
  ];
  return (
    <section id="what-we-offer" className="mx-auto max-w-[1240px] min-w-0 scroll-mt-32 px-5 sm:px-6 mt-16 sm:mt-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <p className="eyebrow">What we offer</p>
          <h2 className="display mt-3 text-[40px] sm:text-[52px] text-ink max-w-2xl">
            Everything you need
            <br />
            <span className="italic text-teal">to sell well.</span>
          </h2>
        </div>
        <p className="text-[14px] text-steel max-w-sm">
          Prices, loans and farming advice — the same help whether you reach us by text message or here on the web.
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
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 text-teal">
                <it.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="chip">{it.tag}</span>
            </div>
            <h3 className="font-serif text-[24px] text-ink mt-6 leading-tight">{it.title}</h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-steel flex-1">{it.desc}</p>
            <p className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-teal">Open <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></p>
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
    <section className="mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 mt-16 sm:mt-24">
      <div className="card-surface overflow-hidden grid lg:grid-cols-[1fr_1.15fr]">
        <div className="p-6 sm:p-10">
          <p className="eyebrow">Where our prices come from</p>
          <h2 className="display mt-4 text-[40px] text-ink">
            Real prices,
            <br />
            <span className="italic text-teal">from real markets.</span>
          </h2>
          <p className="mt-5 text-[14px] leading-relaxed text-steel max-w-md">
            Prices are reported from wholesale markets across Kenya. We collect the newest reports,
            check them, and use them to tell you where your crop earns the most — before you spend money travelling.
          </p>
          <ul className="mt-8 space-y-3 text-[13px] text-ink">
            <Bullet>Price reports from markets in the counties we serve</Bullet>
            <Bullet>We compare markets for you, so you can see where selling pays most</Bullet>
            <Bullet>Works even on slow connections and the simplest phones</Bullet>
          </ul>
          <Link
            to="/market"
            className="inline-flex items-center gap-2 mt-8 text-[13px] font-medium text-teal hover:text-teal-soft"
          >
            See prices on the map
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
    <section className="mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 mt-16 sm:mt-24">
      <p className="text-center eyebrow">Working together with</p>
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
    <section id="get-started" className="mx-auto max-w-[1240px] min-w-0 scroll-mt-32 px-5 sm:px-6 mt-16 sm:mt-24">
      <div className="card-surface bg-ink text-paper p-8 sm:p-12 lg:p-16 flex flex-col lg:flex-row gap-8 lg:gap-10 lg:items-center justify-between">
        <div className="max-w-xl">
          <p className="eyebrow text-teal-glow">Start today</p>
          <h2 className="font-serif text-[36px] lg:text-[44px] mt-4 leading-[1.05]">
            Good prices and good advice belong in every farmer's pocket — even when that pocket holds a simple phone.
          </h2>
        </div>
        <div className="flex flex-col gap-3 lg:w-auto">
          <Link
            to="/register"
            className="rounded-full bg-paper px-6 py-3 text-[13px] font-medium text-ink text-center hover:bg-canvas"
          >
            Create my free account
          </Link>
          <Link
            to="/login"
            className="rounded-full border border-paper/25 px-6 py-3 text-[13px] font-medium text-paper text-center hover:border-paper/60"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  );
}
