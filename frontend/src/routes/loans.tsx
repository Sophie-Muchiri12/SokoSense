import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { postAgent, postLoan, type LoanResponse } from "@/lib/sokosense-api";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Loan Risk Analyzer — SokoSense" },
      {
        name: "description",
        content:
          "Evaluate agricultural loan risk with APR calculation, benchmark comparison, and farmer-friendly recommendations.",
      },
      { property: "og:title", content: "Loan Risk Analyzer — SokoSense" },
      {
        property: "og:description",
        content: "AI-powered loan risk analysis for African smallholder farmers and SACCOs.",
      },
    ],
  }),
  component: LoanRiskAnalyzer,
});

const CBR_BENCHMARK = 13; // Kenya Central Bank Rate %
const SACCO_AVG = 18; // Typical SACCO agricultural loan %
const MAX_BAR_APR = 50; // Scale for comparison bars

type Risk = "Safe" | "Caution" | "Danger";

function LoanRiskAnalyzer() {
  const [monthlyRate, setMonthlyRate] = useState(2.5);
  const [amount, setAmount] = useState(35000);
  const [months, setMonths] = useState(6);

  const [engineResult, setEngineResult] = useState<LoanResponse | null>(null);
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setEngineLoading(true);
      setEngineError(null);
      postLoan(monthlyRate)
        .then((res) => {
          if (!cancelled) setEngineResult(res);
        })
        .catch((err) => {
          if (!cancelled) {
            setEngineError(err instanceof Error ? err.message : "Engine unavailable");
            setEngineResult(null);
          }
        })
        .finally(() => {
          if (!cancelled) setEngineLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [monthlyRate]);

  const askAgent = async () => {
    setEngineLoading(true);
    setEngineError(null);
    try {
      const res = await postAgent(
        `LOAN ${amount} BEANS ${months} MONTHS at ${monthlyRate}% monthly interest`,
      );
      setAgentReply(res.response);
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : "Agent unavailable");
    } finally {
      setEngineLoading(false);
    }
  };

  const calc = useMemo(() => {
    const r = monthlyRate / 100;
    const effectiveAPR = (Math.pow(1 + r, 12) - 1) * 100;
    const monthlyPayment =
      r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
    const totalRepayment = monthlyPayment * months;
    const totalInterest = totalRepayment - amount;

    let risk: Risk;
    if (effectiveAPR <= 18) risk = "Safe";
    else if (effectiveAPR <= 32) risk = "Caution";
    else risk = "Danger";

    const vsCBR = effectiveAPR - CBR_BENCHMARK;

    return { effectiveAPR, monthlyPayment, totalRepayment, totalInterest, risk, vsCBR };
  }, [monthlyRate, amount, months]);

  // Live verdict from the SokoSense loan engine (debounced so dragging the
  // slider doesn't flood the backend).
  const debouncedRate = useDebounced(monthlyRate, 350);
  const verdict = useQuery({
    queryKey: ["loan", debouncedRate],
    queryFn: () => postLoan(debouncedRate),
    staleTime: 60_000,
    placeholderData: (prev: LoanResponse | undefined) => prev,
  });

  const riskColor =
    calc.risk === "Safe"
      ? { bg: "bg-green-surface", text: "text-green-deep", dot: "bg-green", border: "border-green-surface", badge: "bg-green text-paper" }
      : calc.risk === "Caution"
      ? { bg: "bg-amber/10", text: "text-amber", dot: "bg-amber", border: "border-amber/20", badge: "bg-amber text-paper" }
      : { bg: "bg-rose/10", text: "text-rose", dot: "bg-rose", border: "border-rose/20", badge: "bg-rose text-paper" };

  const processingFee = amount * 0.02;
  const insurance = amount * 0.015;
  const disbursementFee = 150;
  const hiddenTotal = processingFee + insurance + disbursementFee;

  const whyRisky = useMemo(() => {
    const reasons: string[] = [];
    if (monthlyRate > 3) reasons.push("Monthly interest is high — compounding accelerates your debt faster than most crops appreciate.");
    if (calc.effectiveAPR > CBR_BENCHMARK * 2) reasons.push("Effective APR is more than double the Central Bank benchmark. Lenders at this level rely on penalty income.");
    if (calc.totalInterest > amount * 0.5) reasons.push("Total interest exceeds half the principal. You are paying more for the loan than for the inputs it buys.");
    if (months > 9) reasons.push("Long tenor stretches repayment across multiple seasons. If one harvest fails, you may default before the next.");
    if (amount > 100000) reasons.push("Large principal increases the lender's recovery risk — expect stricter collateral terms.");
    if (reasons.length === 0) reasons.push("This loan is structured within safe parameters for a smallholder.");
    return reasons;
  }, [monthlyRate, calc.effectiveAPR, calc.totalInterest, months, amount]);

  const recommendation = useMemo(() => {
    if (calc.risk === "Safe") {
      return "This rate is fair for the market. Ask your SACCO if they can match it, but this offer is defensible. Keep the term short and use the money for high-yield inputs only.";
    }
    if (calc.risk === "Caution") {
      return "The rate is steeper than a typical SACCO loan. Try shortening the term by 2 months or reducing the principal by 20%. If the lender allows early repayment without penalty, take it and clear the debt fast.";
    }
    return "This loan is expensive. Before signing, visit your cooperative or county agribusiness office. Group lending, input subsidies, or a staged SACCO loan may cost half as much. Do not use this for speculative planting.";
  }, [calc.risk]);

  return (
    <div className="mx-auto max-w-[1240px] px-5 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20">
      <header>
        <p className="eyebrow">Credit intelligence</p>
        <h1 className="display mt-4 text-[40px] sm:text-[52px] text-ink max-w-3xl">
          Loan Risk Analyzer
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-steel max-w-2xl">
          Enter a lender&apos;s terms and see the true cost. We compare effective APR against the Central Bank benchmark and SACCO averages, then translate the risk into plain advice any farmer can act on.
        </p>
      </header>

      <div className="mt-12 grid lg:grid-cols-[1fr_1.1fr] gap-5">
        {/* Inputs */}
        <div className="card-surface p-7">
          <p className="eyebrow">Loan terms</p>
          <h2 className="font-serif text-[26px] text-ink mt-1">Enter the offer</h2>

          <div className="mt-7 space-y-7">
            <Slider
              label="Monthly interest rate"
              suffix="%"
              value={monthlyRate}
              min={0.5}
              max={10}
              step={0.5}
              onChange={setMonthlyRate}
              format={(v) => v.toFixed(1)}
            />
            <Slider
              label="Loan amount"
              suffix="KSh"
              value={amount}
              min={5000}
              max={200000}
              step={1000}
              onChange={setAmount}
              format={(v) => v.toLocaleString()}
            />
            <Slider
              label="Duration"
              suffix="months"
              value={months}
              min={2}
              max={18}
              step={1}
              onChange={setMonths}
              format={(v) => String(v)}
            />
          </div>

          <div className="mt-8 rounded-xl border border-hairline bg-canvas p-4">
            <p className="text-[11px] uppercase tracking-wider text-mist">Monthly payment</p>
            <p className="font-serif text-[32px] text-ink tabular mt-1">
              KSh {Math.round(calc.monthlyPayment).toLocaleString()}
            </p>
            <p className="text-[12px] text-steel mt-1">
              {months} payments of KSh {Math.round(calc.monthlyPayment).toLocaleString()}
            </p>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={askAgent}
              disabled={engineLoading}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50"
            >
              {engineLoading ? "Querying agent…" : "Ask agent for full audit"}
            </button>
          </div>
        </div>

        {/* Analysis */}
        <div className="space-y-5">
          {/* Engine verdict from POST /api/loan */}
          {(engineResult || engineLoading || engineError) && (
            <div className="card-surface p-7 border-teal/20">
              <p className="eyebrow text-teal">SokoSense engine</p>
              {engineLoading && !engineResult && (
                <p className="mt-3 text-[13px] text-steel">Checking loan engine…</p>
              )}
              {engineError && (
                <p className="mt-3 text-[13px] text-rose-600">{engineError}</p>
              )}
              {engineResult && (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="font-serif text-[28px] text-ink tabular">
                      {engineResult.apr_percent.toFixed(1)}% APR
                    </span>
                    <span className="chip capitalize">{engineResult.risk_verdict.toLowerCase().replace("_", " ")}</span>
                  </div>
                  <p className="mt-3 text-[13.5px] text-ink leading-relaxed">{engineResult.short_reply}</p>
                  <p className="mt-2 text-[12px] text-steel">{engineResult.comparison_phrase}</p>
                </>
              )}
            </div>
          )}

          {agentReply && (
            <div className="card-surface p-7 bg-canvas">
              <p className="eyebrow">Agent audit</p>
              <p className="mt-3 text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap">{agentReply}</p>
            </div>
          )}
          {/* Risk classification */}
          <div className={`card-surface p-7 ${riskColor.border}`}>
            <div className="flex items-center justify-between">
              <p className={`eyebrow ${riskColor.text}`}>Risk classification</p>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${riskColor.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${riskColor.dot}`} />
                {calc.risk}
              </span>
            </div>
            <h2 className={`font-serif text-[34px] mt-2 leading-tight ${riskColor.text}`}>
              {calc.risk === "Safe" ? "Manageable debt" : calc.risk === "Caution" ? "Proceed carefully" : "High risk — reconsider"}
            </h2>
            <p className={`mt-3 text-[13.5px] leading-relaxed ${calc.risk === "Safe" ? "text-green-deep/80" : "text-steel"}`}>
              Effective APR of <strong className="text-ink">{calc.effectiveAPR.toFixed(2)}%</strong>.
              {calc.vsCBR > 0
                ? ` That is ${calc.vsCBR.toFixed(1)} percentage points above the Central Bank benchmark.`
                : " That is below the Central Bank benchmark — rare and favorable."}
            </p>
          </div>

          {/* Comparison bars */}
          <div className="card-surface p-7">
            <p className="eyebrow">Benchmark comparison</p>
            <h3 className="font-serif text-[20px] text-ink mt-2">How this loan stacks up</h3>
            <div className="mt-6 space-y-5">
              <BarRow label="Central Bank Rate" value={CBR_BENCHMARK} color="bg-green" max={MAX_BAR_APR} />
              <BarRow label="SACCO average" value={SACCO_AVG} color="bg-teal" max={MAX_BAR_APR} />
              <BarRow label="This loan" value={calc.effectiveAPR} color={calc.risk === "Safe" ? "bg-green" : calc.risk === "Caution" ? "bg-amber" : "bg-rose"} max={MAX_BAR_APR} highlight />
            </div>
          </div>

          {/* Pricing summary */}
          <div className="card-surface p-7">
            <p className="eyebrow">True cost</p>
            <div className="mt-3 grid grid-cols-2 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
              <Stat label="Effective APR" value={`${calc.effectiveAPR.toFixed(2)}%`} hero />
              <Stat label="Total interest" value={`KSh ${Math.round(calc.totalInterest).toLocaleString()}`} hero />
              <Stat label="Principal" value={`KSh ${amount.toLocaleString()}`} />
              <Stat label="Total repayment" value={`KSh ${Math.round(calc.totalRepayment).toLocaleString()}`} />
            </div>
          </div>

          {/* Live verdict from the backend loan engine */}
          <LiveVerdictCard
            monthlyRate={debouncedRate}
            data={verdict.data}
            isLoading={verdict.isLoading}
            isError={verdict.isError}
          />
        </div>
      </div>

      {/* Bottom analysis cards */}
      <div className="mt-6 grid md:grid-cols-3 gap-5">
        {/* Why risky */}
        <div className="card-surface p-7">
          <p className="eyebrow">Risk analysis</p>
          <h3 className="font-serif text-[22px] text-ink mt-2">Why this loan is risky</h3>
          <ul className="mt-5 space-y-3">
            {whyRisky.map((r, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px] leading-relaxed text-steel">
                <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${calc.risk === "Safe" ? "bg-green" : calc.risk === "Caution" ? "bg-amber" : "bg-rose"}`} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Hidden costs */}
        <div className="card-surface p-7">
          <p className="eyebrow">Transparency</p>
          <h3 className="font-serif text-[22px] text-ink mt-2">Potential hidden costs</h3>
          <ul className="mt-5 space-y-3 text-[13px] text-steel">
            <CostRow label="Processing fee (2%)" value={processingFee} />
            <CostRow label="Loan insurance (1.5%)" value={insurance} />
            <CostRow label="Disbursement fee" value={disbursementFee} flat />
            <li className="pt-3 border-t border-hairline flex items-center justify-between">
              <span className="text-ink font-medium">Estimated extra cost</span>
              <span className="font-serif text-ink tabular">KSh {Math.round(hiddenTotal).toLocaleString()}</span>
            </li>
          </ul>
          <p className="mt-4 text-[12px] text-mist leading-relaxed">
            These fees are often deducted upfront, so the amount reaching your phone is smaller than the face value of the loan.
          </p>
        </div>

        {/* Recommendation: friendly recommendation */}
        <div className={`card-surface p-7 ${riskColor.bg} ${riskColor.border}`}>
          <p className={`eyebrow ${riskColor.text}`}>Recommendation</p>
          <h3 className={`font-serif text-[22px] mt-2 ${riskColor.text}`}>What to do next</h3>
          <p className={`mt-5 text-[14px] leading-relaxed ${riskColor.text} opacity-90`}>
            {recommendation}
          </p>
          <div className="mt-6 rounded-xl bg-paper/60 border border-hairline p-4">
            <p className="text-[11px] uppercase tracking-wider text-mist">If you still take it</p>
            <p className="mt-2 text-[13px] text-ink leading-relaxed">
              Use the money only for inputs with a known buyer. Do not spend on consumables. Set aside one installment as a buffer before planting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  suffix,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[12px] text-steel">{label}</label>
        <span className="font-serif text-[22px] text-ink tabular">
          {format(value)} <span className="text-[11px] text-mist tracking-wider uppercase ml-1">{suffix}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2 accent-teal"
      />
    </div>
  );
}

function Stat({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div className="bg-paper p-5">
      <p className="text-[10.5px] uppercase tracking-wider text-mist">{label}</p>
      <p className={`font-serif tabular text-ink mt-1 ${hero ? "text-[36px]" : "text-[22px]"}`}>{value}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  color,
  max,
  highlight,
}: {
  label: string;
  value: number;
  color: string;
  max: number;
  highlight?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className={highlight ? "font-medium text-ink" : "text-steel"}>{label}</span>
        <span className={`tabular font-medium ${highlight ? "text-ink" : "text-steel"}`}>{value.toFixed(2)}%</span>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-hairline overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CostRow({ label, value, flat }: { label: string; value: number; flat?: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className="tabular text-ink">
        {flat ? `KSh ${value.toLocaleString()}` : `KSh ${Math.round(value).toLocaleString()}`}
      </span>
    </li>
  );
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

const VERDICT_STYLE: Record<LoanResponse["risk_verdict"], { badge: string; text: string }> = {
  SAFE: { badge: "bg-green text-paper", text: "text-green-deep" },
  CAUTION: { badge: "bg-amber text-paper", text: "text-amber" },
  HIGH_RISK: { badge: "bg-rose text-paper", text: "text-rose" },
  AVOID: { badge: "bg-rose text-paper", text: "text-rose" },
};

function LiveVerdictCard({
  monthlyRate,
  data,
  isLoading,
  isError,
}: {
  monthlyRate: number;
  data?: LoanResponse;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div className="card-surface p-7 bg-ink text-paper border-ink">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow text-teal-glow">SokoSense engine · live</p>
          <h3 className="font-serif text-[20px] mt-1">Official SMS verdict</h3>
        </div>
        {data && (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${VERDICT_STYLE[data.risk_verdict].badge}`}
          >
            {data.risk_verdict.replace("_", " ")}
          </span>
        )}
      </div>

      {isError ? (
        <p className="mt-4 text-[13px] text-paper/80">
          Couldn&apos;t reach the loan engine. Confirm the API is running on{" "}
          <code className="font-mono">localhost:8000</code>.
        </p>
      ) : !data ? (
        <p className="mt-4 text-[13px] text-paper/60">{isLoading ? "Scoring…" : "Adjust the rate to score this loan."}</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-px bg-ink-soft border border-ink-soft rounded-lg overflow-hidden">
            <div className="bg-ink p-4">
              <p className="text-[10px] uppercase tracking-wider text-mist">Real APR</p>
              <p className="font-serif text-[24px] mt-1 tabular text-paper">{data.apr_percent}%</p>
            </div>
            <div className="bg-ink p-4">
              <p className="text-[10px] uppercase tracking-wider text-mist">CBK benchmark</p>
              <p className="font-serif text-[24px] mt-1 tabular text-teal-glow">{data.cbk_rate_percent}%</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-paper/5 border border-paper/10 p-4">
            <p className="text-[10px] uppercase tracking-wider text-mist">160-char SMS reply</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-paper">{data.short_reply}</p>
          </div>
          <p className="mt-3 text-[11.5px] text-mist">
            {data.comparison_phrase} · scored at {monthlyRate}%/month via{" "}
            <code className="font-mono text-paper/80">/api/loan</code>
          </p>
        </>
      )}
    </div>
  );
}
