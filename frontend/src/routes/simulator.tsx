import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { api, ApiError } from "@/lib/api/client";
import { parseAgent } from "@/lib/api/agent-format";

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
type StageState = "pending" | "running" | "completed" | "error";
type Stage = { id: string; label: string; detail: string };

const STAGES: Stage[] = [
  { id: "sms-in", label: "Message received", detail: "Inbound query · shortcode 21455" },
  { id: "agent", label: "Agent engine", detail: "LangGraph orchestrator · /api/agent" },
  { id: "tools", label: "Tools invoked", detail: "KAMIS prices · loan · weather · RAG" },
  { id: "compose", label: "Response composed", detail: "Featherless LLM · SMS shaping" },
  { id: "sms-out", label: "Reply delivered", detail: "JSON returned to gateway" },
];

const TYPE_LABEL: Record<string, string> = {
  market: "Market intelligence",
  loan: "Credit assessment",
  weather: "Weather advisory",
  advisory: "Agronomic advisory",
  general: "General assistant",
};

type Recommendation = {
  type: string;
  reply: string;
  tool: string | null;
  data: Record<string, unknown> | null;
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

const allPending = () =>
  Object.fromEntries(STAGES.map((s) => [s.id, "pending"])) as Record<string, StageState>;

function SimulatorPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [message, setMessage] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [stageStates, setStageStates] = useState<Record<string, StageState>>(allPending());
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t = COPY[lang];

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const reset = () => {
    clearTimers();
    setRec(null);
    setError(null);
    setLatencyMs(null);
    setRunning(false);
    setStageStates(allPending());
  };

  const run = async () => {
    if (!message.trim() || running) return;
    clearTimers();
    setRec(null);
    setError(null);
    setLatencyMs(null);
    setRunning(true);

    // Drive the pipeline animation while the real request is in flight.
    const next = allPending();
    next["sms-in"] = "completed";
    next["agent"] = "running";
    setStageStates({ ...next });

    const advance = (id: string, state: StageState, delay: number) => {
      const handle = setTimeout(() => {
        next[id] = state;
        setStageStates({ ...next });
      }, delay);
      timers.current.push(handle);
    };
    advance("tools", "running", 500);

    const started = performance.now();
    try {
      const res = await api.agent(message.trim());
      const parsed = parseAgent(res);
      clearTimers();
      setLatencyMs(Math.round(performance.now() - started));
      setStageStates({
        "sms-in": "completed",
        agent: "completed",
        tools: "completed",
        compose: "completed",
        "sms-out": "completed",
      });
      setRec({ type: res.type, reply: parsed.text, tool: parsed.tool, data: parsed.data });
    } catch (e) {
      clearTimers();
      const msg = e instanceof ApiError ? e.message : "Unexpected error contacting the agent.";
      setError(msg);
      setStageStates((prev) => {
        const errored = { ...prev };
        for (const s of STAGES) if (errored[s.id] === "running") errored[s.id] = "error";
        return errored;
      });
    } finally {
      setRunning(false);
    }
  };

  const charCount = message.length;
  const overLimit = charCount > 160;

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void run();
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
              onClick={() => void run()}
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
            <span
              className={`chip ${
                error ? "border-rose/40 text-rose" : rec ? "border-teal/40 text-teal" : ""
              }`}
            >
              {running ? "● running" : error ? "● error" : rec ? "● ready" : "○ idle"}
            </span>
          </div>

          {error ? (
            <div className="mt-8 flex-1 rounded-xl border border-rose/30 bg-rose/4 p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-rose/80">Request failed</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{error}</p>
              <p className="mt-3 text-[12px] text-steel">
                Make sure the backend is running on{" "}
                <code className="font-mono text-ink">localhost:8000</code> (uvicorn main:app).
              </p>
            </div>
          ) : !rec ? (
            <div className="mt-8 flex-1 rounded-xl border border-dashed border-fog bg-canvas/60 p-10 flex items-center justify-center text-center">
              <p className="text-[13px] text-mist max-w-xs">{t.empty}</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
                <Field label="Response type" value={TYPE_LABEL[rec.type] ?? rec.type} />
                <Field label="Tool invoked" value={rec.tool ?? "direct answer"} mono />
              </div>

              <div className="rounded-xl border border-teal/25 bg-teal/4 p-5">
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-teal/80">{t.rec}</p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink whitespace-pre-wrap">
                  {rec.reply}
                </p>
              </div>

              {rec.data && (
                <div>
                  <p className="text-[10.5px] uppercase tracking-[0.14em] text-mist">
                    Structured payload
                  </p>
                  <pre className="mt-1.5 max-h-56 overflow-auto rounded-xl border border-hairline bg-canvas p-4 font-mono text-[11.5px] leading-relaxed text-ink">
                    {JSON.stringify(rec.data, null, 2)}
                  </pre>
                </div>
              )}

              {latencyMs != null && (
                <p className="text-[11.5px] text-mist">
                  Live response from <code className="font-mono text-steel">/api/agent</code> ·{" "}
                  <span className="tabular text-ink">{latencyMs}ms</span>
                </p>
              )}
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
  if (state === "error") return <span className="h-2 w-2 rounded-full bg-rose" />;
  return <span className="h-2 w-2 rounded-full border border-mist" />;
}

function PipelineStep({ index, stage, state }: { index: number; stage: Stage; state: StageState }) {
  const stateCopy =
    state === "completed"
      ? "Completed"
      : state === "running"
      ? "Running"
      : state === "error"
      ? "Failed"
      : "Pending";
  return (
    <li
      className={`bg-paper p-5 flex flex-col gap-3 transition-colors ${
        state === "running" ? "bg-teal/4" : ""
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
            : state === "error"
            ? "text-rose"
            : "text-mist"
        }`}
      >
        {stateCopy}
      </p>
    </li>
  );
}

