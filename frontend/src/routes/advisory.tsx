import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth-guard";
import { useState } from "react";
import { postAdvisory, postAgent, formatAdvisoryAnswer, type AdvisoryResponse } from "@/lib/sokosense-api";
import { PageHeader } from "./market";

export const Route = createFileRoute("/advisory")({
  head: () => ({
    meta: [
      { title: "Crop Advisory — SokoSense" },
      {
        name: "description",
        content:
          "Ask about pests, disease, planting and caring for your crops — and get clear, trusted answers.",
      },
    ],
  }),
  component: () => (<RequireAuth><AdvisoryPage /></RequireAuth>),
});

const EXAMPLES = [
  "What causes maize rust in Nakuru?",
  "How do I control fall armyworm on beans?",
  "When should I spray tomatoes in Meru?",
  "Best fertilizer for sorghum in dry season?",
];

function AdvisoryPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AdvisoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viaAgent, setViaAgent] = useState(false);

  const run = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q || loading) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (viaAgent) {
        const agent = await postAgent(q);
        setResult({
          query: q,
          answer: formatAdvisoryAnswer(agent.response),
          location: null,
          weather: null,
          sources: agent.raw?.messages
            ?.flatMap((m) => m.tool_calls?.map((t) => t.name) ?? [])
            .filter(Boolean) ?? [],
        });
      } else {
        const res = await postAdvisory(q);
        setResult({ ...res, answer: formatAdvisoryAnswer(res.answer) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not answer right now");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
      <PageHeader
        eyebrow="Farming advice"
        title="Ask anything about"
        italic="your farm."
        sub="We answer from trusted farming guides and your local weather — the same help we send farmers by text message."
      />

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <section className="card-surface p-5 sm:p-7">
          <p className="eyebrow">Your question</p>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
            }}
            rows={5}
            placeholder="What causes maize rust in Nakuru?"
            className="mt-4 w-full resize-none rounded-xl border border-hairline bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-mist/70 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/15"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => run(ex)}
                disabled={loading}
                className="rounded-full border border-hairline bg-canvas px-3 py-1.5 text-[11.5px] text-steel hover:border-teal/40 hover:text-ink disabled:opacity-50"
              >
                {ex.length > 42 ? `${ex.slice(0, 42)}…` : ex}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => run()}
              disabled={!query.trim() || loading}
              className="rounded-full bg-teal px-5 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-50"
            >
              {loading ? "Finding your answer…" : "Get advice"}
            </button>
            <label className="inline-flex items-center gap-2 text-[12px] text-steel cursor-pointer">
              <input
                type="checkbox"
                checked={viaAgent}
                onChange={(e) => setViaAgent(e.target.checked)}
                className="accent-teal"
              />
              Ask in a conversation instead
            </label>
          </div>
        </section>

        <section className="card-surface p-5 sm:p-7 flex flex-col">
          <p className="eyebrow">Answer</p>
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {error}
            </div>
          )}
          {!result && !error && !loading && (
            <p className="mt-6 text-[13px] text-mist flex-1">
              Ask about a crop, a pest, or anything on your farm, and we will answer here.
            </p>
          )}
          {loading && (
            <div className="mt-6 flex items-center gap-2 text-[13px] text-steel">
              <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
              Looking up farming guides and weather…
            </div>
          )}
          {result && (
            <div className="mt-4 flex flex-col gap-4 flex-1">
              {result.location && (
                <p className="text-[11px] uppercase tracking-wider text-mist">
                  Your area: <span className="text-ink">{result.location}</span>
                </p>
              )}
              <div className="rounded-xl border border-teal/25 bg-teal/[0.04] p-5 flex-1">
                <p className="text-[14px] leading-relaxed text-ink whitespace-pre-wrap">
                  {result.answer}
                </p>
              </div>
              {result.sources.length > 0 && (
                <div>
                  <p className="text-[10.5px] uppercase tracking-wider text-mist mb-2">Where this answer came from</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.sources.map((s) => (
                      <span key={s} className="chip text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
