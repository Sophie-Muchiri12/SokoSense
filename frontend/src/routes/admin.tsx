import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "./market";
import { getHealth, getLogs, type LogItem } from "@/lib/sokosense-api";

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

// ─── static engine metadata (telemetry TBD) ──────────────────────────────────

const ENGINES = [
  {
    id: "agent",
    name: "Agent engine",
    desc: "LangGraph · tool-calling loop",
    p50: null,
    p95: null,
    rps: null,
    uptime: null,
  },
  {
    id: "market",
    name: "Market engine",
    desc: "SQLite market cache · arbitrage",
    p50: null,
    p95: null,
    rps: null,
    uptime: null,
  },
  {
    id: "advisory",
    name: "Advisory engine",
    desc: "Neo4j RAG · weather + crop",
    p50: null,
    p95: null,
    rps: null,
    uptime: null,
  },
] as const;

const DATE_RANGES = ["1h", "24h", "7d", "30d"];
const STATUSES = ["all", "2xx", "4xx", "5xx"];

// ─── page ─────────────────────────────────────────────────────────────────────

function AdminPage() {
  const [range, setRange] = useState("24h");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  // Health check
  const [health, setHealth] = useState<"ok" | "error" | "loading">("loading");
  const [healthService, setHealthService] = useState<string | null>(null);

  // Logs from API
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = () => {
    getHealth()
      .then((h) => {
        setHealth(h.status === "ok" ? "ok" : "error");
        setHealthService(h.service ?? null);
      })
      .catch(() => setHealth("error"));
  };

  const fetchLogs = () => {
    setLogsLoading(true);
    getLogs(1, 50)
      .then((r) => {
        setLogs(r.items);
        setLogsTotal(r.total);
        setLogsError(null);
        setLastRefresh(new Date());
      })
      .catch((err) => {
        setLogsError(err instanceof Error ? err.message : "Failed to load logs");
      })
      .finally(() => setLogsLoading(false));
  };

  // Initial load + polling every 15 s
  useEffect(() => {
    fetchHealth();
    fetchLogs();
    intervalRef.current = setInterval(() => {
      fetchHealth();
      fetchLogs();
    }, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const status = typeof l.status === "number" ? l.status : 200;
      if (statusFilter === "2xx" && !(status >= 200 && status < 300)) return false;
      if (statusFilter === "4xx" && !(status >= 400 && status < 500)) return false;
      if (statusFilter === "5xx" && status < 500) return false;
      if (q) {
        const haystack = JSON.stringify(l).toLowerCase();
        if (!haystack.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [logs, statusFilter, q]);

  const healthLabel =
    health === "ok"
      ? "All systems operational"
      : health === "loading"
      ? "Checking health…"
      : "API unreachable";

  const healthCls =
    health === "ok"
      ? "bg-green-surface text-green-deep"
      : health === "loading"
      ? "bg-canvas text-steel"
      : "bg-rose-50 text-rose-700";

  const dotCls =
    health === "ok"
      ? "bg-green"
      : health === "loading"
      ? "bg-amber animate-pulse"
      : "bg-rose-500";

  return (
    <div className="mx-auto max-w-[1320px] px-5 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <PageHeader
          eyebrow="Operations · internal"
          title="System health,"
          italic="end to end."
          sub={`Realtime telemetry for the SokoSense intelligence platform — engines, latency, request volumes and recent activity.${healthService ? ` Service: ${healthService}.` : ""}`}
        />
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] ${healthCls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
            {healthLabel}
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
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-hairline rounded-2xl overflow-hidden border border-hairline">
        <Kpi
          label="API status"
          value={health === "ok" ? "Online" : health === "loading" ? "Checking…" : "Offline"}
          sub={`GET /health · ${health === "ok" ? "200 OK" : "unreachable"}`}
          positive={health === "ok"}
        />
        <Kpi
          label="Log entries"
          value={logsTotal.toLocaleString()}
          sub={logsError ? "Failed to load" : logsLoading ? "Loading…" : "Total stored"}
        />
        <Kpi
          label="Last refresh"
          value={lastRefresh ? lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
          sub="Auto-refresh every 15s"
          positive
        />
      </div>

      {/* Engine status cards */}
      <div className="mt-8 grid lg:grid-cols-3 gap-5">
        {ENGINES.map((e) => (
          <EngineCard key={e.id} engine={e} apiHealthy={health === "ok"} />
        ))}
      </div>

      {/* Logs */}
      <div className="mt-6 card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-hairline flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Request log</p>
            <h3 className="font-serif text-[22px] text-ink mt-0.5">
              {logsLoading
                ? "Loading…"
                : logsError
                ? "Failed to load logs"
                : `${filtered.length} of ${logsTotal} entries`}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUSES}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search logs…"
              className="rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-[12px] text-ink placeholder:text-mist focus:outline-none focus:border-teal/50 w-56"
            />
            <button
              onClick={() => { fetchHealth(); fetchLogs(); }}
              className="rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-[12px] text-ink hover:border-ink/40"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {logsError ? (
            <div className="px-6 py-10 text-center text-rose-600 text-[13px]">
              {logsError}
            </div>
          ) : logsLoading ? (
            <div className="px-6 py-10 text-center text-steel text-[13px] flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
              Loading request log…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-mist text-[13px]">
              {logs.length === 0
                ? "No log entries yet — logs are written as requests arrive."
                : "No entries match these filters."}
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-mist bg-canvas">
                  <th className="px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {filtered.map((l, i) => {
                  const status = typeof l.status === "number" ? l.status : null;
                  const level = typeof l.level === "string" ? l.level : "info";
                  const msg = typeof l.message === "string" ? l.message : JSON.stringify(l);
                  const ts = typeof l.timestamp === "string" ? l.timestamp : "";
                  return (
                    <tr key={i} className="border-t border-hairline hover:bg-canvas">
                      <td className="px-6 py-3 text-mist tabular">{ts}</td>
                      <td className="px-4 py-3">
                        <LevelTag level={level} />
                      </td>
                      <td className="px-4 py-3 text-steel max-w-[480px] truncate">{msg}</td>
                      <td className="px-4 py-3 text-right">
                        {status !== null ? <StatusBadge code={status} /> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-hairline text-[11.5px] text-mist flex justify-between">
          <span>
            {lastRefresh
              ? `Refreshed ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Waiting for first refresh…"}
          </span>
          <span className="font-mono text-steel">GET /api/logs · FastAPI</span>
        </div>
      </div>
    </div>
  );
}

// ─── components ───────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-paper p-6">
      <p className="text-[11px] uppercase tracking-wider text-mist">{label}</p>
      <p className="font-serif text-[34px] text-ink mt-2 tabular leading-none">{value}</p>
      <p className={`mt-2 text-[12px] tabular ${positive ? "text-green" : "text-steel"}`}>{sub}</p>
    </div>
  );
}

function EngineCard({
  engine,
  apiHealthy,
}: {
  engine: (typeof ENGINES)[number];
  apiHealthy: boolean;
}) {
  const status = apiHealthy ? "ok" : "unknown";
  const dotColor =
    status === "ok" ? "bg-green animate-pulse" : "bg-amber";

  return (
    <div className="card-surface p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{engine.id}</p>
          <h4 className="font-serif text-[20px] text-ink mt-1">{engine.name}</h4>
          <p className="text-[12px] text-steel mt-1">{engine.desc}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas border border-hairline px-2.5 py-1 text-[11px] capitalize text-steel">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
          {status}
        </span>
      </div>
      <p className="mt-5 text-[11.5px] text-mist leading-relaxed">
        Live telemetry (p50 / p95 / RPS) will appear here once the logging middleware is wired.
      </p>
    </div>
  );
}

function LevelTag({ level }: { level: string }) {
  const map: Record<string, string> = {
    error:   "bg-rose-50 text-rose-700",
    warning: "bg-amber/15 text-amber",
    warn:    "bg-amber/15 text-amber",
    info:    "bg-teal/10 text-teal",
    debug:   "bg-canvas text-steel",
  };
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[10.5px] font-medium ${
        map[level.toLowerCase()] ?? "bg-canvas border-hairline text-steel"
      }`}
    >
      {level}
    </span>
  );
}

function StatusBadge({ code }: { code: number }) {
  const cls =
    code < 300
      ? "bg-green-surface text-green-deep"
      : code < 500
      ? "bg-amber/15 text-amber"
      : "bg-rose-50 text-rose-700";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10.5px] font-medium tabular ${cls}`}>
      {code}
    </span>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-hairline bg-paper px-3 py-1 text-[11.5px]">
      <span className="text-mist uppercase tracking-wider text-[10px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-ink focus:outline-none capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
