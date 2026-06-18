import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "SMS Intelligence Simulator — SokoSense" },
      {
        name: "description",
        content:
          "Operations-grade simulator for the SokoSense SMS engine. Inspect parsed intent, market signals, credit recommendations and live pipeline state.",
      },
      { property: "og:title", content: "SMS Intelligence Simulator — SokoSense" },
      {
        property: "og:description",
        content: "Inspect the SokoSense SMS engine: parsed intent, market signals, credit and pipeline state.",
      },
    ],
  }),
  component: SimulatorPage,
});

type Lang = "en" | "sw";
type StageState = "pending" | "running" | "completed";
type Stage = { id: string; label: string; detail: string };

const STAGES: Stage[] = [
  { id: "sms-in", label: "SMS received", detail: "Telco gateway · Safaricom 21455" },
  { id: "market", label: "Market engine called", detail: "Spatial price + arbitrage graph" },
  { id: "loan", label: "Loan engine called", detail: "Credit scoring · risk tier model" },
  { id: "compose", label: "Response generated", detail: "gemini-flash-agri · 160-char shaping" },
  { id: "sms-out", label: "SMS delivered", detail: "DLR confirmed · session closed" },
];

type Recommendation = {
  crop: string;
  market: string;
  price: string;
  recommendation: string;
  confidence: number;
  explanation: string;
};

const COPY = {
  en: {
    eyebrow: "SMS Intelligence Simulator",
    title: "Inspect every message",
    titleItalic: "the engine touches.",
    subtitle:
      "Type a farmer message in the format the shortcode expects. We parse intent, run the market and credit engines, then return a 160-character reply.",
    inputCardTitle: "Inbound SMS",
    inputCardSub: "Farmer message · shortcode 21455",
    placeholder: "MAIZE NAKURU",
    send: "Run engine",
    sending: "Running…",
    langLabel: "Language",
    chars: "characters",
    limit: "160 char limit",
    aiTitle: "AI recommendation",
    aiSub: "Decision payload returned to the farmer",
    crop: "Crop",
    market: "Market",
    price: "Reference price",
    rec: "Recommendation",
    conf: "Confidence",
    why: "Decision explanation",
    pipelineTitle: "Live pipeline",
    pipelineSub: "Engine stages for the active request",
    empty: "Run the engine to see a recommendation.",
    reset: "Reset",
    hint: "Try: PRICE MAIZE NAKURU · LOAN 35000 BEANS 6 MONTHS · WEATHER MERU",
  },
  sw: {
    eyebrow: "Simulator ya Akili ya SMS",
    title: "Chunguza kila ujumbe",
    titleItalic: "unaopita kwenye injini.",
    subtitle:
      "Andika ujumbe wa mkulima kwa muundo unaotarajiwa. Tunafafanua nia, tunaita injini ya soko na mkopo, kisha tunarudisha jibu la herufi 160.",
    inputCardTitle: "SMS ya kuingia",
    inputCardSub: "Ujumbe wa mkulima · namba fupi 21455",
    placeholder: "MAHINDI NAKURU",
    send: "Endesha injini",
    sending: "Inafanya kazi…",
    langLabel: "Lugha",
    chars: "herufi",
    limit: "kikomo herufi 160",
    aiTitle: "Pendekezo la AI",
    aiSub: "Jibu linalorudi kwa mkulima",
    crop: "Zao",
    market: "Soko",
    price: "Bei ya rejeleo",
    rec: "Pendekezo",
    conf: "Uhakika",
    why: "Maelezo ya uamuzi",
    pipelineTitle: "Hatua za moja kwa moja",
    pipelineSub: "Hatua za injini kwa ombi la sasa",
    empty: "Endesha injini kuona pendekezo.",
    reset: "Anza upya",
    hint: "Jaribu: BEI MAHINDI NAKURU · MKOPO 35000 MAHARAGE MIEZI 6 · HALI YA HEWA MERU",
  },
} as const;

function parseMessage(raw: string, lang: Lang): Recommendation {
  const text = raw.trim().toUpperCase();
  const tokens = text.split(/\s+/).filter(Boolean);

  const cropMap: Record<string, string> = {
    MAIZE: "Maize", MAHINDI: "Maize",
    BEANS: "Beans", MAHARAGE: "Beans", MAHARAGWE: "Beans",
    POTATO: "Potato", VIAZI: "Potato",
    RICE: "Rice", MCHELE: "Rice",
    COFFEE: "Coffee", KAHAWA: "Coffee",
    TEA: "Tea", CHAI: "Tea",
  };
  const marketSet = new Set([
    "NAKURU", "NAIROBI", "ELDORET", "KITALE", "MERU", "KISUMU", "MOMBASA",
    "GARISSA", "MACHAKOS", "MARSABIT", "NYERI", "THIKA",
  ]);

  let crop = "Maize";
  let market = "Nakuru";
  for (const t of tokens) {
    if (cropMap[t]) crop = cropMap[t];
    if (marketSet.has(t)) market = t.charAt(0) + t.slice(1).toLowerCase();
  }

  const isLoan = /^(LOAN|MKOPO)/.test(text);
  const isWeather = /(WEATHER|HALI)/.test(text);

  if (isLoan) {
    const amt = tokens.find((t) => /^\d{3,7}$/.test(t)) ?? "35000";
    return {
      crop,
      market,
      price: `KSh ${Number(amt).toLocaleString()} requested`,
      recommendation: lang === "sw" ? "Idhini ya awali · APR 18.4%" : "Pre-approved · APR 18.4%",
      confidence: 0.72,
      explanation:
        lang === "sw"
          ? `Tier B kwa mzigo wa ${crop}. Historia ya malipo nzuri, msimu wa mavuno wa miezi 6 unalingana.`
          : `Tier B against ${crop} cycle. Repayment history clean, 6-month harvest window aligns with bullet term.`,
    };
  }

  if (isWeather) {
    return {
      crop,
      market,
      price: lang === "sw" ? "38mm mvua / siku 7" : "38mm rain / 7 days",
      recommendation:
        lang === "sw" ? "Nyunyizia dawa ya kuvu kabla ya Jumanne" : "Apply preventative fungicide before Tuesday",
      confidence: 0.88,
      explanation:
        lang === "sw"
          ? "Shinikizo la blight linaongezeka. Siku tatu za mvua zinazokuja huongeza hatari kwa viazi na nyanya."
          : "Late-blight pressure rising. Three wet days forecast lift risk for potato and tomato — preventative window now.",
    };
  }

  // Price intent (default)
  const priceTable: Record<string, number> = {
    Maize: 4520, Beans: 11800, Potato: 3200, Rice: 9800, Coffee: 38500, Tea: 5400,
  };
  const base = priceTable[crop] ?? 4520;
  const delta = base * 0.066;
  const alt = market === "Eldoret" ? "Nakuru" : "Eldoret";
  return {
    crop,
    market,
    price: `KSh ${base.toLocaleString()} / 90kg`,
    recommendation:
      lang === "sw"
        ? `Shikilia wiki 2 · uza ${alt}`
        : `Hold 14 days · sell ${alt}`,
    confidence: 0.92,
    explanation:
      lang === "sw"
        ? `${alt} inalipa KSh ${(base + delta).toFixed(0)} (+6.2%). Baada ya usafiri, faida ni KSh 20/gunia. Utabiri unaonyesha bei kupanda zaidi.`
        : `${alt} pays KSh ${(base + delta).toFixed(0)} (+6.2%). Net of transport you gain KSh 20/bag. Forward curve points to +KSh 180 over 14 days.`,
  };
}

function SimulatorPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [message, setMessage] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [stageStates, setStageStates] = useState<Record<string, StageState>>(
    Object.fromEntries(STAGES.map((s) => [s.id, "pending"])) as Record<string, StageState>
  );
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t = COPY[lang];

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRec(null);
    setRunning(false);
    setStageStates(Object.fromEntries(STAGES.map((s) => [s.id, "pending"])) as Record<string, StageState>);
  };

  const run = () => {
    if (!message.trim() || running) return;
    reset();
    setRunning(true);
    const next: Record<string, StageState> = Object.fromEntries(
      STAGES.map((s) => [s.id, "pending"])
    ) as Record<string, StageState>;

    const tick = (i: number, state: StageState, delay: number) => {
      const handle = setTimeout(() => {
        next[STAGES[i].id] = state;
        setStageStates({ ...next });
      }, delay);
      timers.current.push(handle);
    };

    // sequential running -> completed for each stage
    const step = 280;
    STAGES.forEach((_, i) => {
      tick(i, "running", i * step);
      tick(i, "completed", i * step + step - 40);
    });

    const total = STAGES.length * step + 60;
    const finish = setTimeout(() => {
      setRec(parseMessage(message, lang));
      setRunning(false);
    }, total);
    timers.current.push(finish);
  };

  const charCount = message.length;
  const overLimit = charCount > 160;

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
  };

  return (
    <div className="mx-auto max-w-[1240px] px-5 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
      {/* Header */}
      <header className="max-w-3xl">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="display mt-4 text-[40px] sm:text-[56px] text-ink leading-[1.02]">
          {t.title}
          <br />
          <span className="italic text-teal">{t.titleItalic}</span>
        </h1>
        <p className="mt-5 text-[14px] leading-relaxed text-steel">{t.subtitle}</p>
      </header>

      {/* Two-column workspace */}
      <div className="mt-12 grid lg:grid-cols-2 gap-6">
        {/* LEFT — Input */}
        <section className="card-surface p-7 flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">{t.inputCardTitle}</p>
              <h2 className="font-serif text-[22px] text-ink mt-2">{t.inputCardSub}</h2>
            </div>
            <LangToggle lang={lang} onChange={setLang} label={t.langLabel} />
          </div>

          <label className="mt-6 block text-[11px] uppercase tracking-[0.14em] text-mist">
            Farmer message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onKey}
            placeholder={t.placeholder}
            rows={5}
            className="mt-2 w-full resize-none rounded-xl border border-hairline bg-paper px-4 py-3 font-mono text-[14px] tracking-wider text-ink placeholder:text-mist/70 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/15"
          />

          <div className="mt-2 flex items-center justify-between text-[11.5px]">
            <span className="text-mist">{t.hint}</span>
            <span className={`tabular ${overLimit ? "text-red-600" : "text-steel"}`}>
              {charCount}/160 · {overLimit ? t.limit : t.chars}
            </span>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={run}
              disabled={!message.trim() || running}
              className="rounded-full bg-teal px-5 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {running ? t.sending : t.send}
            </button>
            <button
              onClick={reset}
              disabled={running && !rec}
              className="rounded-full border border-ink/15 bg-paper px-4 py-2.5 text-[12.5px] font-medium text-ink hover:border-ink/40 disabled:opacity-50 transition-colors"
            >
              {t.reset}
            </button>
            <span className="ml-auto text-[11px] text-mist">⌘ + Enter</span>
          </div>
        </section>

        {/* RIGHT — AI Recommendation */}
        <section className="card-surface p-7 flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">{t.aiTitle}</p>
              <h2 className="font-serif text-[22px] text-ink mt-2">{t.aiSub}</h2>
            </div>
            <span className={`chip ${rec ? "border-teal/40 text-teal" : ""}`}>
              {rec ? "● ready" : "○ idle"}
            </span>
          </div>

          {!rec ? (
            <div className="mt-8 flex-1 rounded-xl border border-dashed border-fog bg-canvas/60 p-10 flex items-center justify-center text-center">
              <p className="text-[13px] text-mist max-w-xs">{t.empty}</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
                <Field label={t.crop} value={rec.crop} />
                <Field label={t.market} value={rec.market} />
                <Field label={t.price} value={rec.price} mono />
              </div>

              <div className="rounded-xl border border-teal/25 bg-teal/[0.04] p-5">
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-teal/80">{t.rec}</p>
                <p className="mt-1.5 font-serif text-[20px] leading-snug text-ink">{rec.recommendation}</p>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
                <ConfidenceDial value={rec.confidence} label={t.conf} />
                <div>
                  <p className="text-[10.5px] uppercase tracking-[0.14em] text-mist">{t.why}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">{rec.explanation}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Live Pipeline */}
      <section className="mt-6 card-surface p-7">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow">{t.pipelineTitle}</p>
            <h2 className="font-serif text-[22px] text-ink mt-2">{t.pipelineSub}</h2>
          </div>
          <PipelineLegend />
        </div>

        <ol className="mt-7 grid md:grid-cols-5 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
          {STAGES.map((s, i) => (
            <PipelineStep key={s.id} index={i + 1} stage={s} state={stageStates[s.id]} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function LangToggle({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-mist mb-1.5">{label}</span>
      <div className="inline-flex rounded-full border border-hairline bg-canvas p-0.5">
        {(["en", "sw"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`px-3 py-1 text-[11.5px] font-medium rounded-full transition-colors ${
              lang === l ? "bg-ink text-paper" : "text-steel hover:text-ink"
            }`}
          >
            {l === "en" ? "English" : "Swahili"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-paper p-4">
      <p className="text-[10.5px] uppercase tracking-[0.12em] text-mist">{label}</p>
      <p className={`mt-1.5 text-[14px] text-ink ${mono ? "tabular font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function ConfidenceDial({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  return (
    <div className="flex flex-col items-center">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-mist mb-2">{label}</p>
      <div className="relative h-[72px] w-[72px]">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#E6EAE3" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="#0D9280"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-serif text-[18px] text-ink tabular">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function PipelineLegend() {
  const items: { state: StageState; label: string }[] = [
    { state: "pending", label: "Pending" },
    { state: "running", label: "Running" },
    { state: "completed", label: "Completed" },
  ];
  return (
    <div className="flex items-center gap-4">
      {items.map((i) => (
        <div key={i.state} className="flex items-center gap-2 text-[11px] text-steel">
          <StateDot state={i.state} />
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function StateDot({ state }: { state: StageState }) {
  if (state === "completed") return <span className="h-2 w-2 rounded-full bg-teal" />;
  if (state === "running")
    return <span className="h-2 w-2 rounded-full bg-teal animate-pulse ring-2 ring-teal/25" />;
  return <span className="h-2 w-2 rounded-full border border-mist" />;
}

function PipelineStep({ index, stage, state }: { index: number; stage: Stage; state: StageState }) {
  const stateCopy =
    state === "completed" ? "Completed" : state === "running" ? "Running" : "Pending";
  return (
    <li
      className={`bg-paper p-5 flex flex-col gap-3 transition-colors ${
        state === "running" ? "bg-teal/[0.04]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-mist tabular">
          0{index}
        </span>
        <StateDot state={state} />
      </div>
      <div>
        <p className="font-serif text-[16px] text-ink leading-tight">{stage.label}</p>
        <p className="mt-1.5 text-[11.5px] text-steel leading-relaxed">{stage.detail}</p>
      </div>
      <p
        className={`text-[10.5px] uppercase tracking-[0.14em] tabular ${
          state === "completed"
            ? "text-teal"
            : state === "running"
            ? "text-ink"
            : "text-mist"
        }`}
      >
        {stateCopy}
      </p>
    </li>
  );
}

