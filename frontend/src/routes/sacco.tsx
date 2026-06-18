import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./market";

export const Route = createFileRoute("/sacco")({
  head: () => ({
    meta: [
      { title: "SACCO Partner Dashboard — SokoSense" },
      {
        name: "description",
        content:
          "Operations console for SACCO managers and Mercy Corps program officers: live farmer queries, regional activity, market trends and AI recommendations.",
      },
      { property: "og:title", content: "SACCO Partner Dashboard — SokoSense" },
      {
        property: "og:description",
        content:
          "A deployable operations console for SACCOs and agricultural partners across East Africa.",
      },
    ],
  }),
  component: SaccoPage,
});

// ─────────────────────────── data ───────────────────────────

const KPIS = [
  { label: "Queries today", value: "8,412", delta: "+11.4% vs yesterday", positive: true },
  { label: "Farmers served (30d)", value: "24,108", delta: "+1,204 new", positive: true },
  { label: "Top crop", value: "Maize", delta: "42% of queries" },
  { label: "Top market", value: "Eldoret", delta: "Best margin · KSh 4,820/bag" },
];

const HOTSPOTS = [
  { x: 22, y: 46, r: 5.4, name: "Trans-Nzoia", q: "1,820" },
  { x: 30, y: 36, r: 4.2, name: "Uasin Gishu", q: "1,210" },
  { x: 26, y: 58, r: 3.4, name: "Kakamega", q: "740" },
  { x: 44, y: 30, r: 3.0, name: "Meru", q: "612" },
  { x: 40, y: 52, r: 3.6, name: "Nakuru", q: "880" },
  { x: 36, y: 70, r: 2.4, name: "Kisii", q: "318" },
  { x: 58, y: 64, r: 2.8, name: "Machakos", q: "402" },
  { x: 70, y: 78, r: 2.6, name: "Kilifi", q: "356" },
  { x: 12, y: 62, r: 2.2, name: "Busia", q: "248" },
];

const FEED = [
  { t: "08:42", msisdn: "+254 7•• ••• 412", txt: "MAIZE ELDORET", crop: "Maize", reply: "Sell Eldoret · KSh 4,820/bag", tag: "sell" },
  { t: "08:42", msisdn: "+254 7•• ••• 098", txt: "BEANS NAKURU", crop: "Beans", reply: "Hold · spread KSh 110", tag: "hold" },
  { t: "08:41", msisdn: "+254 7•• ••• 553", txt: "LOAN 40000 6", crop: "Loan", reply: "APR 22.4% · Caution", tag: "warn" },
  { t: "08:41", msisdn: "+254 7•• ••• 221", txt: "COFFEE MERU", crop: "Coffee", reply: "Sell Mombasa export · +5.0%", tag: "sell" },
  { t: "08:40", msisdn: "+254 7•• ••• 776", txt: "DAIRY KISUMU", crop: "Dairy", reply: "Feed prices easing · buy now", tag: "buy" },
  { t: "08:40", msisdn: "+254 7•• ••• 044", txt: "MAIZE KITALE", crop: "Maize", reply: "Transport Eldoret · +12% net", tag: "sell" },
  { t: "08:39", msisdn: "+254 7•• ••• 309", txt: "RICE MWEA", crop: "Rice", reply: "Hold 7d · demand rising", tag: "hold" },
];

const TREND_MAIZE = [3820, 3910, 4020, 3980, 4110, 4240, 4380, 4490, 4520, 4610, 4720, 4820];
const TREND_BEANS = [9400, 9320, 9280, 9220, 9180, 9150, 9210, 9280, 9240, 9180, 9120, 9080];

const RECOS = [
  { crop: "Maize", market: "Eldoret", action: "Sell", confidence: 94, members: 312, lift: "+6.2%" },
  { crop: "Coffee", market: "Mombasa", action: "Sell · export", confidence: 91, members: 88, lift: "+5.0%" },
  { crop: "Beans", market: "Nakuru", action: "Hold", confidence: 78, members: 144, lift: "0.0%" },
  { crop: "Dairy", market: "Kisumu", action: "Buy feed", confidence: 86, members: 96, lift: "-2.1%" },
  { crop: "Horticulture", market: "Nairobi", action: "Sell · same-day", confidence: 89, members: 64, lift: "+8.3%" },
];

// ─────────────────────────── page ───────────────────────────

function SaccoPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <PageHeader
          eyebrow="Partner console · Tumaini SACCO + Mercy Corps"
          title="The pulse of"
          italic="every farmer."
          sub="A live operations view of SMS queries, market signals, loan risk and recommendations across 9 counties in Western and Rift Valley Kenya."
        />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-surface px-3 py-1.5 text-[11.5px] text-green-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
            Live · 12 nodes
          </span>
          <button className="rounded-full border border-hairline bg-paper px-4 py-2 text-[12.5px] text-ink hover:border-ink/40">
            Export CSV
          </button>
          <button className="rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] hover:bg-ink-soft">
            Weekly digest
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded-2xl overflow-hidden border border-hairline">
        {KPIS.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      {/* Map + activity feed */}
      <div className="mt-6 grid lg:grid-cols-[1.55fr_1fr] gap-5">
        <RegionalMap />
        <ActivityFeed />
      </div>

      {/* Trends + engagement */}
      <div className="mt-6 grid lg:grid-cols-[1.2fr_1fr] gap-5">
        <MarketTrends />
        <Engagement />
      </div>

      {/* Recommendations */}
      <div className="mt-6">
        <Recommendations />
      </div>

      <p className="mt-10 text-[11.5px] text-mist">
        Data refreshes every 60s · Powered by SokoSense AI · 2 USSD aggregators · 4 market feeds
      </p>
    </div>
  );
}

// ─────────────────────────── components ───────────────────────────

function Kpi({ label, value, delta, positive }: { label: string; value: string; delta: string; positive?: boolean }) {
  return (
    <div className="bg-paper p-6">
      <p className="text-[11px] uppercase tracking-wider text-mist">{label}</p>
      <p className="font-serif text-[34px] text-ink mt-2 tabular leading-none">{value}</p>
      <p className={`mt-2 text-[12px] tabular ${positive ? "text-green" : "text-steel"}`}>{delta}</p>
    </div>
  );
}

function RegionalMap() {
  const total = HOTSPOTS.reduce((s, h) => s + parseInt(h.q.replace(/,/g, "")), 0);
  return (
    <div className="card-surface p-7">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Regional activity</p>
          <h2 className="font-serif text-[24px] text-ink mt-1">Where farmers are querying</h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-steel">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal" /> SMS query
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal/30" /> Catchment
          </span>
        </div>
      </div>

      <div className="mt-5 relative aspect-[16/10] rounded-xl border border-hairline bg-[radial-gradient(80%_80%_at_50%_30%,#F0F5EE_0%,#E8EFE5_100%)] overflow-hidden">
        <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full">
          {/* Kenya-ish silhouette */}
          <path
            d="M8,28 L18,16 L34,10 L52,8 L68,12 L82,18 L92,30 L94,46 L86,62 L76,72 L60,76 L42,74 L26,70 L14,58 L6,42 Z"
            fill="#fff"
            stroke="#DCE2DA"
            strokeWidth="0.3"
          />
          {/* lake victoria */}
          <ellipse cx="14" cy="64" rx="6" ry="5" fill="#E1ECF1" />
          {/* grid */}
          {[20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#E5E9E2" strokeWidth="0.1" />
          ))}
          {HOTSPOTS.map((h) => (
            <g key={h.name}>
              <circle cx={h.x} cy={h.y} r={h.r + 4} fill="#0D9280" fillOpacity="0.08" />
              <circle cx={h.x} cy={h.y} r={h.r + 1.5} fill="#0D9280" fillOpacity="0.18" />
              <circle cx={h.x} cy={h.y} r={h.r} fill="#0D9280" />
              <circle cx={h.x} cy={h.y} r={1} fill="#fff" />
            </g>
          ))}
        </svg>
        {HOTSPOTS.map((h) => (
          <div
            key={h.name}
            className="absolute -translate-x-1/2 -translate-y-full pb-1.5 pointer-events-none"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            <div className="rounded-md bg-paper border border-hairline shadow-card px-2 py-0.5 text-[10px] whitespace-nowrap">
              <span className="text-ink font-medium">{h.name}</span>
              <span className="ml-1.5 text-teal tabular">{h.q}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-px bg-hairline rounded-lg overflow-hidden border border-hairline">
        <Stat label="Counties active" value="9" />
        <Stat label="Queries last hour" value="612" />
        <Stat label="Total today" value={total.toLocaleString()} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper px-4 py-3">
      <p className="text-[10.5px] uppercase tracking-wider text-mist">{label}</p>
      <p className="font-serif text-[18px] text-ink tabular mt-0.5">{value}</p>
    </div>
  );
}

function ActivityFeed() {
  return (
    <div className="card-surface overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
        <div>
          <p className="eyebrow">Live query feed</p>
          <h3 className="font-serif text-[22px] text-ink mt-0.5">Last 60 seconds</h3>
        </div>
        <span className="chip">Stream</span>
      </div>
      <ul className="divide-y divide-hairline text-[12.5px] overflow-hidden">
        {FEED.map((f, i) => (
          <li key={i} className="px-6 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center hover:bg-canvas">
            <span className="text-[10.5px] tabular text-mist">{f.t}</span>
            <div className="min-w-0">
              <p className="text-ink truncate">
                <span className="font-mono text-[11.5px] text-steel">{f.txt}</span>
                <span className="mx-1.5 text-mist">→</span>
                <span className="text-ink">{f.reply}</span>
              </p>
              <p className="text-[10.5px] text-mist mt-0.5">{f.msisdn} · {f.crop}</p>
            </div>
            <SignalDot tag={f.tag} />
          </li>
        ))}
      </ul>
      <div className="px-6 py-3 border-t border-hairline text-[11.5px] text-steel flex justify-between">
        <span>7 shown · 8,405 earlier today</span>
        <button className="text-teal font-medium hover:text-teal-soft">Open inbox →</button>
      </div>
    </div>
  );
}

function SignalDot({ tag }: { tag: string }) {
  const map: Record<string, { c: string; label: string }> = {
    sell: { c: "bg-green text-paper", label: "Sell" },
    buy: { c: "bg-teal text-paper", label: "Buy" },
    hold: { c: "bg-steel/15 text-steel", label: "Hold" },
    warn: { c: "bg-amber/15 text-amber", label: "Risk" },
  };
  const s = map[tag] ?? map.hold;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${s.c}`}>{s.label}</span>;
}

function MarketTrends() {
  return (
    <div className="card-surface p-7">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Market trends · 12 weeks</p>
          <h3 className="font-serif text-[22px] text-ink mt-1">Reference prices, KSh</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-teal">
            <span className="h-2 w-2 rounded-full bg-teal" /> Maize / 90kg
          </span>
          <span className="inline-flex items-center gap-1.5 text-steel">
            <span className="h-2 w-2 rounded-full bg-ink" /> Beans / 90kg
          </span>
        </div>
      </div>

      <div className="mt-6 relative h-[200px]">
        <Sparkline data={TREND_MAIZE} color="#0D9280" />
        <Sparkline data={TREND_BEANS} color="#0F1A0E" dashed />
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-mist tabular">
          {["W1","W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12"].map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-px bg-hairline border border-hairline rounded-lg overflow-hidden">
        <Stat label="Maize spot" value="4,820" />
        <Stat label="12w Δ" value="+26.2%" />
        <Stat label="Beans spot" value="9,080" />
        <Stat label="12w Δ" value="-3.4%" />
      </div>
    </div>
  );
}

function Sparkline({ data, color, dashed }: { data: number[]; color: string; dashed?: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / (max - min || 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-[170px]">
      {!dashed && (
        <polygon
          points={`0,100 ${pts} 100,100`}
          fill={color}
          fillOpacity="0.06"
        />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "1.4 1.4" : undefined}
      />
    </svg>
  );
}

function Engagement() {
  const channels = [
    { name: "SMS", pct: 71, n: "5,972" },
    { name: "USSD *483#", pct: 22, n: "1,850" },
    { name: "Field agent", pct: 5, n: "421" },
    { name: "WhatsApp", pct: 2, n: "169" },
  ];
  return (
    <div className="card-surface p-7">
      <p className="eyebrow">Farmer engagement</p>
      <h3 className="font-serif text-[22px] text-ink mt-1">Channels & retention</h3>

      <div className="mt-5 grid grid-cols-3 gap-px bg-hairline border border-hairline rounded-lg overflow-hidden">
        <Stat label="DAU" value="3,140" />
        <Stat label="WAU" value="11.2k" />
        <Stat label="Retention 30d" value="68%" />
      </div>

      <ul className="mt-6 space-y-4">
        {channels.map((c) => (
          <li key={c.name}>
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-ink">{c.name}</span>
              <span className="tabular text-steel">{c.n} · {c.pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-hairline overflow-hidden">
              <div className="h-full bg-teal" style={{ width: `${c.pct}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 pt-5 border-t border-hairline text-[12px] text-steel">
        <p>
          <span className="text-ink font-medium">Median response time</span>
          <span className="float-right tabular">1.8s</span>
        </p>
        <p className="mt-2">
          <span className="text-ink font-medium">SMS delivery success</span>
          <span className="float-right tabular text-green">99.4%</span>
        </p>
      </div>
    </div>
  );
}

function Recommendations() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
        <div>
          <p className="eyebrow">Recent recommendations</p>
          <h3 className="font-serif text-[22px] text-ink mt-0.5">Issued in the last hour</h3>
        </div>
        <div className="text-[11.5px] text-steel">
          <span className="text-ink font-medium tabular">704</span> issued · <span className="text-green tabular">92%</span> followed
        </div>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-mist bg-canvas">
            <th className="px-6 py-3 font-medium">Crop</th>
            <th className="px-4 py-3 font-medium">Market</th>
            <th className="px-4 py-3 font-medium">Action</th>
            <th className="px-4 py-3 font-medium text-right">Members</th>
            <th className="px-4 py-3 font-medium text-right">Expected lift</th>
            <th className="px-4 py-3 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {RECOS.map((r) => (
            <tr key={r.crop} className="border-t border-hairline hover:bg-canvas">
              <td className="px-6 py-4 text-ink">{r.crop}</td>
              <td className="px-4 py-4 text-steel">{r.market}</td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-green-surface text-green-deep px-2.5 py-0.5 text-[11px] font-medium">
                  {r.action}
                </span>
              </td>
              <td className="px-4 py-4 text-right tabular text-ink">{r.members}</td>
              <td className={`px-4 py-4 text-right tabular ${r.lift.startsWith("+") ? "text-green" : r.lift.startsWith("-") ? "text-amber" : "text-steel"}`}>
                {r.lift}
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-hairline overflow-hidden">
                    <div className="h-full bg-teal" style={{ width: `${r.confidence}%` }} />
                  </div>
                  <span className="text-[11.5px] tabular text-steel">{r.confidence}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
