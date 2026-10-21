import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth-guard";
import { useState } from "react";
import { postTimingDecision, postAgent, type TimingResponse } from "@/lib/sokosense-api";
import { PageHeader } from "./market";

export const Route = createFileRoute("/timing")({
  head: () => ({
    meta: [
      { title: "Sell Timing — SokoSense" },
      {
        name: "description",
        content:
          "Should you sell today or wait a few days? We look at how prices have been moving and tell you plainly.",
      },
    ],
  }),
  component: () => (<RequireAuth><TimingPage /></RequireAuth>),
});

const CROPS = ["maize", "beans", "tomatoes", "sorghum", "millet", "potatoes"];
const MARKETS = ["Nairobi", "Nakuru", "Eldoret", "Kisumu", "Mombasa", "Kitale", "Nyeri"];

function TimingPage() {
  const [crop, setCrop] = useState(CROPS[0]);
  const [market, setMarket] = useState(MARKETS[1]);
  const [result, setResult] = useState<TimingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await postTimingDecision(crop, market.toLowerCase());
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not check right now");
    } finally {
      setLoading(false);
    }
  };

  const runViaAgent = async () => {
    setLoading(true);
    setError(null);
    try {
      const agent = await postAgent(`When should I sell ${crop} in ${market}?`);
      setResult({
        crop,
        market,
        recommendation: agent.response.toUpperCase().includes("SELL") ? "SELL_TODAY" : "WAIT",
        short_reply: agent.response,
        reason: "Answer in your own words",
        wait_days: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
      <PageHeader
        eyebrow="When to sell"
        title="Sell today"
        italic="or wait?"
        sub="We check how the price of your crop has been moving in recent days, then tell you plainly: sell today, or wait. It is the same answer we send by text message."
      />

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <section className="card-surface p-5 sm:p-7">
          <p className="eyebrow">Your crop and market</p>
          <div className="mt-6 space-y-5">
            <Field label="Crop">
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-paper px-4 py-2.5 text-[14px] text-ink"
              >
                {CROPS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Market">
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-paper px-4 py-2.5 text-[14px] text-ink"
              >
                {MARKETS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
            <button
              onClick={run}
              disabled={loading}
              className="rounded-full bg-teal px-5 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-50"
            >
              {loading ? "Checking…" : "Should I sell today?"}
            </button>
            <button
              onClick={runViaAgent}
              disabled={loading}
              className="rounded-full border border-hairline bg-paper px-5 py-2.5 text-[12.5px] font-medium text-ink hover:border-ink/40 disabled:opacity-50"
            >
              Ask in your own words
            </button>
          </div>
        </section>

        <section className="card-surface p-5 sm:p-7">
          <p className="eyebrow">Our advice</p>
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {error}
            </div>
          )}
          {!result && !error && (
            <p className="mt-6 text-[13px] text-mist">Choose your crop and market, then ask — we will tell you whether to sell today or wait.</p>
          )}
          {result && (
            <div className="mt-4">
              <span
                className={`inline-flex rounded-full px-4 py-1 text-[12px] font-medium ${
                  result.recommendation === "SELL_TODAY"
                    ? "bg-green-surface text-green-deep"
                    : "bg-amber/10 text-amber"
                }`}
              >
                {result.recommendation === "SELL_TODAY" ? "Sell today" : "Wait"}
              </span>
              <p className="mt-5 font-serif text-[22px] text-ink leading-snug">{result.short_reply}</p>
              <p className="mt-4 text-[13px] text-steel leading-relaxed">{result.reason}</p>
              {(result.price_kes != null || result.kamis_date) && (
                <div className="mt-4 rounded-xl border border-hairline bg-canvas px-4 py-3 text-[12px] text-steel space-y-1">
                  {result.price_kes != null && (
                    <p>
                      Price today (per 90kg bag):{" "}
                      <span className="text-ink font-medium tabular">
                        KSh {result.price_kes.toLocaleString()}
                      </span>
                    </p>
                  )}
                  {result.trend && (
                    <p>
                      How the price is moving:{" "}
                      <span className="text-ink font-medium">{result.trend === "rising" ? "Going up" : result.trend === "falling" ? "Going down" : "Steady"}</span>
                    </p>
                  )}
                  {result.kamis_date && (
                    <p>
                      Price from: <span className="text-ink">{result.kamis_date}</span>
                    </p>
                  )}
                  {result.data_source && (
                    <p className="text-mist">Prices from KAMIS (the government market price service)</p>
                  )}
                </div>
              )}
              {result.wait_days != null && result.wait_days > 0 && (
                <p className="mt-3 text-[12px] text-mist tabular">
                  We suggest waiting about {result.wait_days} days
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-mist">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
