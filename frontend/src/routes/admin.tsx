import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "./market";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — SokoSense" },
      {
        name: "description",
        content:
          "System health, API latency, engine status and live request logs for the SokoSense intelligence platform.",
      },
      { property: "og:title", content: "Operations Dashboard — SokoSense" },
      {
        property: "og:description",
        content: "Internal operations console for engine health, latency and request logs.",
      },
    ],
  }),
  component: AdminPage,
});

// ─────────────────────────── data ───────────────────────────

const ENGINES = [
  { id: "market", name: "Market engine", desc: "Price feeds · arbitrage", p50: 124, p95: 312, rps: 184, uptime: "99.98%", status: "ok" },
  { id: "loan", name: "Loan engine", desc: "APR · risk classification", p50: 86, p95: 198, rps: 42, uptime: "99.99%", status: "ok" },
  { id: "language", name: "Language engine", desc: "EN ↔ SW · intent parser", p50: 212, p95: 540, rps: 226, uptime: "99.91%", status: "degraded" },
] as const;

const LATENCY_SERIES = [142, 138, 156, 149, 161, 144, 138, 152, 168, 174, 162, 158, 148, 142, 156, 172, 188, 176, 164, 152, 148, 156, 162, 158];

const LOGS = [
  { ts: "08:42:17", sms: "MAIZE ELDORET", engine: "market", resp: "Sell · KSh 4,820", ms: 142, status: 200 },
  { ts: "08:42:14", sms: "LOAN 40000 6", engine: "loan", resp: "APR 22.4% · Caution", ms: 88, status: 200 },
  { ts: "08:42:11", sms: "BEI YA MAHINDI", engine: "language", resp: "→ price.maize", ms: 224, status: 200 },
  { ts: "08:42:09", sms: "BEANS NAKURU", engine: "market", resp: "Hold · spread 110", ms: 138, status: 200 },
  { ts: "08:42:06", sms: "COFFEE MERU", engine: "market", resp: "Sell Mombasa +5%", ms: 156, status: 200 },
  { ts: "08:42:03", sms: "MKOPO 20000", engine: "loan", resp: "APR 18.1% · Safe", ms: 94, status: 200 },
  { ts: "08:41:58", sms: "????", engine: "language", resp: "Unparseable input", ms: 312, status: 422 },
  { ts: "08:41:55", sms: "DAIRY KISUMU", engine: "market", resp: "Buy feed · -2.1%", ms: 148, status: 200 },
  { ts: "08:41:51", sms: "RICE MWEA", engine: "market", resp: "Hold 7d", ms: 162, status: 200 },
  { ts: "08:41:47", sms: "LOAN 80000 3", engine: "loan", resp: "APR 31.2% · Danger", ms: 102, status: 200 },
  { ts: "08:41:44", sms: "HORTI NAIROBI", engine: "market", resp: "Sell same-day +8.3%", ms: 136, status: 200 },
  { ts: "08:41:40", sms: "MAIZE ___", engine: "market", resp: "Missing location", ms: 78, status: 400 },
  { ts: "08:41:36", sms: "WEATHER KITALE", engine: "language", resp: "→ weather.lookup", ms: 198, status: 200 },
  { ts: "08:41:32", sms: "MAIZE NAKURU", engine: "market", resp: "Sell · KSh 4,640", ms: 152, status: 200 },
  { ts: "08:41:28", sms: "BEANS ELDORET", engine: "market", resp: "Sell · +3.4%", ms: 144, status: 200 },
  { ts: "08:41:23", sms: "—", engine: "market", resp: "Upstream timeout", ms: 5000, status: 504 },
  { ts: "08:41:19", sms: "COFFEE NYERI", engine: "market", resp: "Hold · auction Thu", ms: 168, status: 200 },
  { ts: "08:41:14", sms: "LOAN 12000 3", engine: "loan", resp: "APR 14.9% · Safe", ms: 84, status: 200 },
];

const DATE_RANGES = ["1h", "24h", "7d", "30d"];
const STATUSES = ["all", "2xx", "4xx", "5xx"];

// ─────────────────────────── page ───────────────────────────

function AdminPage() {
  const [range, setRange] = useState("24h");
  const [engine, setEngine] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return LOGS.filter((l) => {
      if (engine !== "all" && l.engine !== engine) return false;
      if (status === "2xx" && !(l.status >= 200 && l.status < 300)) return false;
      if (status === "4xx" && !(l.status >= 400 && l.status < 500)) return false;
      if (status === "5xx" && l.status < 500) return false;
      if (q && !l.sms.toLowerCase().includes(q.toLowerCase()) && !l.resp.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [engine, status, q]);

  return (
    <div className="mx-auto max-w-[1320px] px-5 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <PageHeader
          eyebrow="Operations · internal"
          title="System health,"
          italic="end to end."
          sub="Realtime telemetry for the SokoSense intelligence platform — engines, latency, request volumes and recent activity across all USSD aggregators."
        />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-surface px-3 py-1.5 text-[11.5px] text-green-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
            All systems operational
          </span>
          <div className="inline-flex rounded-full border border-hairline bg-paper p-0.5">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-[11.5px] tabular rounded-full transition ${
                  range === r ? "bg-ink text-paper" : "text-steel hover:text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Health KPIs */}
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded-2xl overflow-hidden border border-hairline">
        <Kpi label="Uptime · 30d" value="99.97%" sub="SLO 99.9%" positive />
        <Kpi label="Requests · 24h" value="412,804" sub="+8.2% vs prev" />
        <Kpi label="API latency · p95" value="312 ms" sub="Target ≤ 500ms" positive />
        <Kpi label="Error rate" value="0.18%" sub="Budget 0.50%" positive />
      </div>

      {/* Latency chart */}
      <div className="mt-6 card-surface p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">API latency · last 24h</p>
            <h3 className="font-serif text-[22px] text-ink mt-1">p50 and p95, in milliseconds</h3>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-teal">
              <span className="h-2 w-2 rounded-full bg-teal" /> p50 · 152ms
            </span>
            <span className="inline-flex items-center gap-1.5 text-steel">
              <span className="h-2 w-2 rounded-full bg-ink" /> p95 · 312ms
            </span>
          </div>
        </div>
        <div className="mt-5 relative h-[160px]">
          <LatencyChart data={LATENCY_SERIES} />
          <div className="absolute inset-x-0 -bottom-5 flex justify-between text-[10px] text-mist tabular">
            {["00:00","04:00","08:00","12:00","16:00","20:00","24:00"].map((t) => <span key={t}>{t}</span>)}
          </div>
        </div>
      </div>

      {/* Engine status */}
      <div className="mt-12 grid lg:grid-cols-3 gap-5">
        {ENGINES.map((e) => (
          <EngineCard key={e.id} engine={e} />
        ))}
      </div>

      {/* Logs */}
      <div className="mt-6 card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-hairline flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Recent requests</p>
            <h3 className="font-serif text-[22px] text-ink mt-0.5">Live request log · {filtered.length} of {LOGS.length}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Engine" value={engine} onChange={setEngine} options={["all","market","loan","language"]} />
            <Select label="Status" value={status} onChange={setStatus} options={STATUSES} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search SMS or response..."
              className="rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-[12px] text-ink placeholder:text-mist focus:outline-none focus:border-teal/50 w-56"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-mist bg-canvas">
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">SMS</th>
                <th className="px-4 py-3 font-medium">Engine</th>
                <th className="px-4 py-3 font-medium">Response</th>
                <th className="px-4 py-3 font-medium text-right">Latency</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {filtered.map((l, i) => (
                <tr key={i} className="border-t border-hairline hover:bg-canvas">
                  <td className="px-6 py-3 text-mist tabular">{l.ts}</td>
                  <td className="px-4 py-3 text-ink">{l.sms}</td>
                  <td className="px-4 py-3">
                    <EngineTag id={l.engine} />
                  </td>
                  <td className="px-4 py-3 text-steel">{l.resp}</td>
                  <td className={`px-4 py-3 text-right tabular ${l.ms > 500 ? "text-amber" : l.ms > 2000 ? "text-rose-600" : "text-steel"}`}>
                    {l.ms}ms
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge code={l.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-mist">No requests match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-hairline text-[11.5px] text-mist flex justify-between">
          <span>Tail · updated 2s ago</span>
          <span className="font-mono text-steel">env=prod · region=af-south-1</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── components ───────────────────────────

function Kpi({ label, value, sub, positive }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="bg-paper p-6">
      <p className="text-[11px] uppercase tracking-wider text-mist">{label}</p>
      <p className="font-serif text-[34px] text-ink mt-2 tabular leading-none">{value}</p>
      <p className={`mt-2 text-[12px] tabular ${positive ? "text-green" : "text-steel"}`}>{sub}</p>
    </div>
  );
}

function LatencyChart({ data }: { data: number[] }) {
  const min = 100;
  const max = 220;
  const p50 = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / (max - min)) * 100}`)
    .join(" ");
  const p95 = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v * 2 - min) / (max * 2 - min)) * 100}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#E5E9E2" strokeWidth="0.2" />
      ))}
      <polygon points={`0,100 ${p50} 100,100`} fill="#0D9280" fillOpacity="0.06" />
      <polyline points={p50} fill="none" stroke="#0D9280" strokeWidth="0.7" strokeLinejoin="round" />
      <polyline points={p95} fill="none" stroke="#0F1A0E" strokeWidth="0.5" strokeDasharray="1.4 1.4" />
    </svg>
  );
}

function EngineCard({ engine }: { engine: typeof ENGINES[number] }) {
  const dotColor =
    engine.status === "ok" ? "bg-green" : engine.status === "degraded" ? "bg-amber" : "bg-rose-600";
  return (
    <div className="card-surface p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{engine.id}</p>
          <h4 className="font-serif text-[20px] text-ink mt-1">{engine.name}</h4>
          <p className="text-[12px] text-steel mt-1">{engine.desc}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas border border-hairline px-2.5 py-1 text-[11px] capitalize text-steel">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${engine.status === "ok" ? "animate-pulse" : ""}`} />
          {engine.status}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-px bg-hairline rounded-lg overflow-hidden border border-hairline">
        <Mini label="p50" value={`${engine.p50}ms`} />
        <Mini label="p95" value={`${engine.p95}ms`} />
        <Mini label="RPS" value={engine.rps.toString()} />
        <Mini label="Uptime" value={engine.uptime} />
      </div>
      <div className="mt-4 text-[11px] text-mist flex justify-between">
        <span>v2.4.{engine.id === "language" ? 1 : 0}</span>
        <span className="font-mono text-steel">healthcheck OK · {Math.floor(engine.rps * 0.6)}ms</span>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className="font-mono text-[13.5px] text-ink tabular mt-0.5">{value}</p>
    </div>
  );
}

function EngineTag({ id }: { id: string }) {
  const map: Record<string, string> = {
    market: "bg-teal/10 text-teal border-teal/20",
    loan: "bg-green-surface text-green-deep border-green/20",
    language: "bg-ink/5 text-ink border-ink/15",
  };
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10.5px] font-medium ${map[id] ?? "bg-canvas border-hairline text-steel"}`}>
      {id}
    </span>
  );
}

function StatusBadge({ code }: { code: number }) {
  const cls =
    code < 300 ? "bg-green-surface text-green-deep"
    : code < 500 ? "bg-amber/15 text-amber"
    : "bg-rose-50 text-rose-700";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10.5px] font-medium tabular ${cls}`}>
      {code}
    </span>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-hairline bg-paper px-3 py-1 text-[11.5px]">
      <span className="text-mist uppercase tracking-wider text-[10px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-ink focus:outline-none capitalize"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
