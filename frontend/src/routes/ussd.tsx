import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "./market";

export const Route = createFileRoute("/ussd")({
  head: () => ({
    meta: [
      { title: "USSD Flow Explorer — SokoSense" },
      {
        name: "description",
        content:
          "Interactive walkthrough of the *384*543# USSD journey: main menu, crop selection, location and AI recommendation.",
      },
      { property: "og:title", content: "USSD Flow Explorer — SokoSense" },
      {
        property: "og:description",
        content: "Visual explorer of the SokoSense USSD experience for feature phones.",
      },
    ],
  }),
  component: UssdPage,
});

// ─────────────────────────── data ───────────────────────────

type Node = {
  id: string;
  label: string;
  step: number;
  input: string;
  screen: string[];
  explanation: string;
  latency: string;
  children?: string[];
};

const NODES: Record<string, Node> = {
  dial: {
    id: "dial",
    label: "Dial code",
    step: 0,
    input: "*384*543#",
    screen: [
      "Connecting to SokoSense...",
      "",
      "Session established.",
      "Carrier: Safaricom",
    ],
    explanation:
      "The farmer dials the shortcode on any feature phone. Our USSD aggregator routes the request to the SokoSense gateway in under 400ms.",
    latency: "~380ms",
    children: ["main"],
  },
  main: {
    id: "main",
    label: "Main menu",
    step: 1,
    input: "(menu shown)",
    screen: [
      "SokoSense · Karibu Achieng",
      "",
      "1. Market prices",
      "2. Sell my crop",
      "3. Loan check",
      "4. Weather alerts",
      "5. My account",
      "0. English / Kiswahili",
    ],
    explanation:
      "Farmer-personalised greeting using their registered name. Menu is intentionally 5 items — under the 182-character USSD limit and readable on a Nokia 105 screen.",
    latency: "120ms",
    children: ["crop"],
  },
  crop: {
    id: "crop",
    label: "Crop selection",
    step: 2,
    input: "2",
    screen: [
      "Which crop are you selling?",
      "",
      "1. Maize",
      "2. Beans",
      "3. Coffee",
      "4. Dairy",
      "5. Horticulture",
      "9. More crops",
      "0. Back",
    ],
    explanation:
      "Top 5 crops are pre-loaded based on the farmer's county and historical queries — 94% of queries are served from this shortlist without pagination.",
    latency: "140ms",
    children: ["location"],
  },
  location: {
    id: "location",
    label: "Location selection",
    step: 3,
    input: "1",
    screen: [
      "Maize · Where are you?",
      "",
      "1. Kitale (home)",
      "2. Eldoret",
      "3. Nakuru",
      "4. Nairobi",
      "5. Other...",
      "0. Back",
    ],
    explanation:
      "Defaults to the farmer's registered village. Other markets are sorted by transport feasibility — Kitale → Eldoret is 70km, well within a single-day truck round-trip.",
    latency: "190ms",
    children: ["recommend"],
  },
  recommend: {
    id: "recommend",
    label: "AI recommendation",
    step: 4,
    input: "2",
    screen: [
      "MAIZE · ELDORET",
      "Price: KSh 4,820/bag",
      "Trend: +6.2% (7d)",
      "",
      "✓ SELL this week",
      "Net: +KSh 412/bag",
      "after transport",
      "",
      "1. SMS full report",
      "0. Main menu",
    ],
    explanation:
      "Engine combines cached market data from the local SQLite store with transport cost logic. The final SMS returns a clear action for the farmer and can be followed by a full report.",
    latency: "620ms",
  },
};

const ORDER = ["dial", "main", "crop", "location", "recommend"];

// ─────────────────────────── page ───────────────────────────

function UssdPage() {
  const [activeId, setActiveId] = useState("main");
  const active = NODES[activeId];

  return (
    <div className="mx-auto max-w-[1240px] px-5 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <PageHeader
          eyebrow="USSD flow explorer · *384*543#"
          title="The journey on"
          italic="every feature phone."
          sub="Click any node to inspect the input the farmer dials, the screen the carrier renders, and the engine call behind it."
        />
        <div className="flex items-center gap-2 text-[11.5px]">
          <span className="chip">No data plan required</span>
          <span className="chip">Works on Nokia 105+</span>
        </div>
      </div>

      <div className="mt-10 grid lg:grid-cols-[1.35fr_1fr] gap-6">
        {/* Tree column */}
        <div className="card-surface p-7">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Menu tree</p>
            <span className="text-[11px] text-mist tabular">5 steps · avg 1.4s end-to-end</span>
          </div>

          <ol className="mt-6 relative">
            <span className="absolute left-[18px] top-2 bottom-2 w-px bg-hairline" />
            {ORDER.map((id, i) => {
              const n = NODES[id];
              const isActive = id === activeId;
              return (
                <li key={id} className="relative pl-12 pb-4 last:pb-0">
                  <button
                    onClick={() => setActiveId(id)}
                    className={`absolute left-0 top-1 inline-flex h-9 w-9 items-center justify-center rounded-full border text-[12px] tabular transition ${
                      isActive
                        ? "bg-teal text-paper border-teal shadow-card"
                        : "bg-paper text-steel border-hairline hover:border-teal/40 hover:text-teal"
                    }`}
                    aria-label={`Step ${i}`}
                  >
                    {i}
                  </button>
                  <button
                    onClick={() => setActiveId(id)}
                    className={`block w-full text-left rounded-xl border p-4 transition ${
                      isActive
                        ? "border-teal/40 bg-teal/5"
                        : "border-hairline bg-paper hover:border-ink/30"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <p className="text-[10.5px] uppercase tracking-wider text-mist">Step {i}</p>
                        <h3 className="font-serif text-[18px] text-ink mt-0.5">{n.label}</h3>
                      </div>
                      <span className="font-mono text-[11px] text-teal whitespace-nowrap">{n.input}</span>
                    </div>
                    <p className="mt-2 text-[12.5px] text-steel line-clamp-2">{n.explanation}</p>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Inspector column */}
        <div className="space-y-5">
          {/* Phone */}
          <div className="card-surface p-7 bg-ink text-paper">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-teal-glow">Live screen</p>
              <span className="text-[10.5px] tabular text-paper/60">Safaricom · 21:14</span>
            </div>
            <div className="mt-4 mx-auto max-w-[280px] rounded-[28px] border border-paper/10 bg-[#0A1109] p-3 shadow-card">
              <div className="rounded-[18px] bg-[#C5D2A8] text-[#102610] font-mono p-4 min-h-[260px] text-[12.5px] leading-[1.65] whitespace-pre-wrap">
                {active.screen.join("\n")}
                <div className="mt-3 border-t border-[#102610]/20 pt-2 text-[10.5px] text-[#102610]/70">
                  Reply | Cancel
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-paper/60">
              <span>Input: <span className="font-mono text-teal-glow">{active.input}</span></span>
              <span>Latency: <span className="tabular text-paper">{active.latency}</span></span>
            </div>
          </div>

          {/* Explanation */}
          <div className="card-surface p-7">
            <p className="eyebrow">What happens here</p>
            <h4 className="font-serif text-[20px] text-ink mt-1">{active.label}</h4>
            <p className="mt-3 text-[13.5px] text-ink/85 leading-relaxed">{active.explanation}</p>

            <div className="mt-5 grid grid-cols-2 gap-px bg-hairline rounded-lg overflow-hidden border border-hairline">
              <div className="bg-paper px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-mist">User input</p>
                <p className="font-mono text-[13px] text-ink mt-1">{active.input}</p>
              </div>
              <div className="bg-paper px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-mist">Engine latency</p>
                <p className="font-mono text-[13px] text-teal mt-1">{active.latency}</p>
              </div>
            </div>

            {active.children && (
              <div className="mt-5 pt-5 border-t border-hairline">
                <p className="text-[11px] uppercase tracking-wider text-mist">Next step</p>
                <button
                  onClick={() => setActiveId(active.children![0])}
                  className="mt-2 inline-flex items-center gap-2 text-[13px] text-teal font-medium hover:text-teal-soft"
                >
                  {NODES[active.children[0]].label} →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: pipeline summary */}
      <div className="mt-6 card-surface p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">End-to-end journey</p>
            <h3 className="font-serif text-[22px] text-ink mt-1">From dial to decision in 1.4 seconds</h3>
          </div>
          <span className="chip">5 hops · 1 SMS confirmation</span>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-px bg-hairline border border-hairline rounded-lg overflow-hidden">
          {ORDER.map((id, i) => {
            const n = NODES[id];
            const isActive = id === activeId;
            return (
              <button
                key={id}
                onClick={() => setActiveId(id)}
                className={`text-left bg-paper px-4 py-4 hover:bg-canvas transition ${
                  isActive ? "ring-2 ring-inset ring-teal/40" : ""
                }`}
              >
                <p className="text-[10px] uppercase tracking-wider text-mist">Hop {i}</p>
                <p className="font-serif text-[16px] text-ink mt-1">{n.label}</p>
                <p className="mt-1 font-mono text-[10.5px] text-teal">{n.latency}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
