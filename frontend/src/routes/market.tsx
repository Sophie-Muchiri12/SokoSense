import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { LMarket } from "@/components/leaflet-market-map";

const LeafletMarketMap = lazy(() => import("@/components/leaflet-market-map"));

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market Intelligence Map — SokoSense" },
      {
        name: "description",
        content:
          "Live wholesale crop pricing, demand heatmaps and arbitrage intelligence across Kenya's seven primary markets.",
      },
      { property: "og:title", content: "Market Intelligence Map — SokoSense" },
      {
        property: "og:description",
        content: "Live crop prices and arbitrage intelligence across Kenyan markets.",
      },
    ],
  }),
  component: MarketMapPage,
});

const CROPS = ["Maize", "Beans", "Rice", "Coffee", "Tea"] as const;
type Crop = (typeof CROPS)[number];

// Real Kenyan market coordinates
const BASE = [
  { id: "nrb", name: "Nairobi", county: "Nairobi", lat: -1.2921, lng: 36.8219 },
  { id: "nku", name: "Nakuru", county: "Nakuru", lat: -0.3031, lng: 36.08 },
  { id: "eld", name: "Eldoret", county: "Uasin Gishu", lat: 0.5143, lng: 35.2698 },
  { id: "ksm", name: "Kisumu", county: "Kisumu", lat: -0.0917, lng: 34.768 },
  { id: "msa", name: "Mombasa", county: "Mombasa", lat: -4.0435, lng: 39.6682 },
  { id: "mru", name: "Meru", county: "Meru", lat: 0.0463, lng: 37.6559 },
  { id: "nyr", name: "Nyeri", county: "Nyeri", lat: -0.4201, lng: 36.9476 },
] as const;

type Stat = { price: number; delta: number; volume: number; signal: LMarket["signal"] };
const STATS: Record<Crop, Record<string, Stat>> = {
  Maize: {
    nrb: { price: 4720, delta: 2.1, volume: 1840, signal: "hold" },
    nku: { price: 4520, delta: -0.4, volume: 1210, signal: "buy" },
    eld: { price: 4380, delta: -1.6, volume: 2240, signal: "buy" },
    ksm: { price: 4460, delta: -1.1, volume: 1140, signal: "hold" },
    msa: { price: 5120, delta: 0.8, volume: 2620, signal: "sell" },
    mru: { price: 4680, delta: 1.2, volume: 920, signal: "hold" },
    nyr: { price: 4600, delta: 0.6, volume: 780, signal: "hold" },
  },
  Beans: {
    nrb: { price: 9800, delta: 1.4, volume: 980, signal: "hold" },
    nku: { price: 9200, delta: -2.1, volume: 640, signal: "buy" },
    eld: { price: 9000, delta: -1.0, volume: 720, signal: "buy" },
    ksm: { price: 9300, delta: -0.8, volume: 520, signal: "hold" },
    msa: { price: 10800, delta: 2.6, volume: 1820, signal: "sell" },
    mru: { price: 10200, delta: 4.2, volume: 1240, signal: "sell" },
    nyr: { price: 9700, delta: 0.4, volume: 460, signal: "hold" },
  },
  Rice: {
    nrb: { price: 13800, delta: 1.0, volume: 1240, signal: "hold" },
    nku: { price: 13200, delta: 0.2, volume: 420, signal: "hold" },
    eld: { price: 13100, delta: -0.4, volume: 380, signal: "buy" },
    ksm: { price: 12800, delta: -1.4, volume: 880, signal: "buy" },
    msa: { price: 14400, delta: 2.2, volume: 1620, signal: "sell" },
    mru: { price: 14100, delta: 3.0, volume: 540, signal: "sell" },
    nyr: { price: 13500, delta: 0.6, volume: 320, signal: "hold" },
  },
  Coffee: {
    nrb: { price: 42000, delta: 3.4, volume: 240, signal: "sell" },
    nku: { price: 38500, delta: 1.2, volume: 140, signal: "hold" },
    eld: { price: 37800, delta: -0.8, volume: 90, signal: "buy" },
    ksm: { price: 37000, delta: -1.2, volume: 80, signal: "buy" },
    msa: { price: 44000, delta: 5.0, volume: 480, signal: "sell" },
    mru: { price: 41500, delta: 4.2, volume: 320, signal: "sell" },
    nyr: { price: 40800, delta: 3.6, volume: 380, signal: "sell" },
  },
  Tea: {
    nrb: { price: 28500, delta: 1.6, volume: 380, signal: "hold" },
    nku: { price: 27200, delta: 0.4, volume: 220, signal: "hold" },
    eld: { price: 26800, delta: -1.0, volume: 240, signal: "buy" },
    ksm: { price: 27000, delta: 0.2, volume: 200, signal: "hold" },
    msa: { price: 30200, delta: 2.8, volume: 880, signal: "sell" },
    mru: { price: 29800, delta: 3.6, volume: 520, signal: "sell" },
    nyr: { price: 29400, delta: 3.0, volume: 460, signal: "sell" },
  },
};

function build(crop: Crop): LMarket[] {
  return BASE.map((b) => ({ ...b, ...STATS[crop][b.id] }));
}

// haversine km
function distanceKm(a: LMarket, b: LMarket) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

function MarketMapPage() {
  const [crop, setCrop] = useState<Crop>("Maize");
  const [sourceId, setSourceId] = useState<string>("eld"); // farmer location
  const [activeId, setActiveId] = useState<string>("msa");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const markets = useMemo(() => build(crop), [crop]);
  const active = markets.find((m) => m.id === activeId) || markets[0];
  const source = markets.find((m) => m.id === sourceId) || markets[0];
  const best = useMemo(() => [...markets].sort((a, b) => b.price - a.price)[0], [markets]);
  const cheapest = useMemo(() => [...markets].sort((a, b) => a.price - b.price)[0], [markets]);
  const spread = best.price - cheapest.price;

  const displayId = hoverId ?? activeId;
  const display = markets.find((m) => m.id === displayId) || active;

  // Bloomberg-ish "expected profit" estimate
  const distance = distanceKm(source, best);
  const transportCostPerBag = Math.round(distance * 6.2); // KSh/bag, rough
  const grossPerBag = best.price - source.price;
  const profitPerBag = Math.max(0, grossPerBag - transportCostPerBag);
  const confidence = Math.min(0.97, 0.62 + Math.abs(best.delta) * 0.04 + (best.volume / 5000));

  return (
    <div className="mx-auto max-w-[1320px] px-6 pt-14 pb-12">
      <PageHeader
        eyebrow="Market intelligence"
        title="Where prices live."
        italic="Where to move next."
        sub="Live wholesale pricing across Kenya's seven primary markets. SokoSense reconciles transport, volume and demand to surface the highest-margin destination for your harvest."
      />

      {/* Filters */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-steel mr-1 uppercase tracking-wider">Commodity</span>
        {CROPS.map((c) => (
          <button
            key={c}
            onClick={() => setCrop(c)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium border transition ${
              crop === c
                ? "bg-ink text-paper border-ink"
                : "bg-paper text-ink border-hairline hover:border-ink/40"
            }`}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-steel">
          <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
          Live · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="mt-6 grid lg:grid-cols-[1.65fr_1fr] gap-5">
        {/* Map + comparison */}
        <div className="space-y-5">
          <div className="card-surface p-0 overflow-hidden">
            <div className="flex items-start justify-between px-6 py-5 border-b border-hairline">
              <div>
                <p className="eyebrow">Kenya · {crop.toLowerCase()} network</p>
                <h2 className="font-serif text-[24px] text-ink mt-1">
                  {markets.length} markets · spread{" "}
                  <span className="text-teal tabular">KSh {spread.toLocaleString()}</span>{" "}
                  <span className="text-steel text-[14px]">/ 90kg</span>
                </h2>
              </div>
              <Legend />
            </div>
            <div className="relative h-[460px] w-full bg-canvas">
              <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-steel text-[12px]">Loading map…</div>}>
                <LeafletMarketMap
                  markets={markets}
                  activeId={activeId}
                  bestId={best.id}
                  sourceId={source.id}
                  onSelect={setActiveId}
                  onHover={setHoverId}
                />
              </Suspense>
              {/* Floating hover/active price card */}
              <div className="pointer-events-none absolute top-4 left-4 w-[240px] card-surface p-4 shadow-card border border-hairline">
                <p className="text-[10.5px] uppercase tracking-wider text-mist">
                  {hoverId ? "Hover" : "Selected"}
                </p>
                <p className="font-serif text-[18px] text-ink mt-0.5">{display.name}</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="font-serif text-[28px] leading-none text-ink tabular">
                    {display.price.toLocaleString()}
                  </span>
                  <span
                    className={`pb-1 text-[12px] tabular ${display.delta >= 0 ? "text-green" : "text-rose"}`}
                  >
                    {display.delta >= 0 ? "▲" : "▼"} {Math.abs(display.delta)}%
                  </span>
                </div>
                <p className="text-[10.5px] text-steel mt-0.5 uppercase tracking-wider">
                  KSh / 90kg · {display.volume.toLocaleString()} bags
                </p>
              </div>
            </div>
          </div>

          {/* Comparison panel */}
          <div className="card-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="eyebrow">Market comparison</p>
                <h3 className="font-serif text-[20px] text-ink mt-1">
                  {source.name} <span className="text-mist">→</span>{" "}
                  <span className="text-teal">{best.name}</span>
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-steel">
                <span>Origin:</span>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="border border-hairline rounded-md px-2 py-1 bg-paper text-ink text-[11.5px]"
                >
                  {markets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-mist border-b border-hairline">
                  <th className="py-2 font-medium">Market</th>
                  <th className="py-2 font-medium text-right">Price</th>
                  <th className="py-2 font-medium text-right">24h</th>
                  <th className="py-2 font-medium text-right">Vol</th>
                  <th className="py-2 font-medium text-right">Dist.</th>
                  <th className="py-2 font-medium text-right">Net / bag</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => {
                  const d = distanceKm(source, m);
                  const net = m.price - source.price - Math.round(d * 6.2);
                  const isActive = m.id === activeId;
                  const isBest = m.id === best.id;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setActiveId(m.id)}
                      onMouseEnter={() => setHoverId(m.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={`cursor-pointer border-b border-hairline last:border-0 transition ${
                        isActive ? "bg-canvas" : "hover:bg-canvas/60"
                      }`}
                    >
                      <td className="py-2.5 text-ink">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background:
                                m.signal === "sell" ? "#2E7D32" : m.signal === "buy" ? "#0D9280" : "#516880",
                            }}
                          />
                          {m.name}
                          {isBest && (
                            <span className="text-[9.5px] uppercase tracking-wider text-teal border border-teal/30 rounded px-1 py-px">
                              Best
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular text-ink">{m.price.toLocaleString()}</td>
                      <td className={`py-2.5 text-right tabular ${m.delta >= 0 ? "text-green" : "text-rose"}`}>
                        {m.delta >= 0 ? "+" : ""}
                        {m.delta}%
                      </td>
                      <td className="py-2.5 text-right tabular text-steel">{m.volume.toLocaleString()}</td>
                      <td className="py-2.5 text-right tabular text-steel">{d} km</td>
                      <td
                        className={`py-2.5 text-right tabular font-medium ${
                          net > 0 ? "text-green" : net < 0 ? "text-rose" : "text-steel"
                        }`}
                      >
                        {net > 0 ? "+" : ""}
                        {net.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <SignalDot signal={m.signal} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 self-start">
          <div className="card-surface p-6 bg-ink text-paper border-ink">
            <p className="text-[10.5px] uppercase tracking-wider text-mist">Best market today</p>
            <h3 className="font-serif text-[34px] mt-1 leading-none">{best.name}</h3>
            <p className="text-[12px] text-mist mt-1">
              {crop} · {best.county} County
            </p>
            <div className="mt-5 grid grid-cols-2 gap-px bg-ink-soft border border-ink-soft rounded-lg overflow-hidden">
              <DarkStat label="Expected profit" value={`KSh ${profitPerBag.toLocaleString()}`} sub="per 90kg bag" />
              <DarkStat label="Distance" value={`${distance} km`} sub={`from ${source.name}`} />
              <DarkStat
                label="Gross spread"
                value={`KSh ${grossPerBag.toLocaleString()}`}
                sub="vs your origin"
                accent={grossPerBag >= 0 ? "text-teal-glow" : "text-rose"}
              />
              <DarkStat
                label="Transport"
                value={`KSh ${transportCostPerBag.toLocaleString()}`}
                sub="est. logistics"
              />
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] text-mist">
                <span className="uppercase tracking-wider">Confidence</span>
                <span className="tabular text-paper">{confidence.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-ink-soft overflow-hidden">
                <div
                  className="h-full bg-teal-glow"
                  style={{ width: `${Math.round(confidence * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[11.5px] text-mist leading-relaxed">
                Signal weighted by 24h volume, momentum and 14 active reporters at destination.
              </p>
            </div>
          </div>

          <div className="card-surface p-6 bg-green-surface border-green-surface">
            <p className="eyebrow text-green-deep">SokoSense recommendation</p>
            <h3 className="font-serif text-[20px] text-green-deep mt-2 leading-snug">
              {profitPerBag > 0
                ? `Move ${crop.toLowerCase()} from ${source.name} to ${best.name} this week.`
                : `Hold ${crop.toLowerCase()} — transport cost erases the spread.`}
            </h3>
            <p className="mt-3 text-[12.5px] text-green-deep/80 leading-relaxed">
              Net margin{" "}
              <span className="font-medium">KSh {profitPerBag.toLocaleString()} / bag</span>{" "}
              after {distance} km of road freight. {best.name} is trading{" "}
              <span className="font-medium">
                {((best.price / source.price - 1) * 100).toFixed(1)}%
              </span>{" "}
              above your origin.
            </p>
          </div>

          <div className="card-surface p-6">
            <p className="eyebrow">Network snapshot</p>
            <div className="mt-3 space-y-3 text-[12.5px]">
              <KV k="Markets online" v={`${markets.length} / 7`} />
              <KV k="Network volume" v={`${markets.reduce((s, m) => s + m.volume, 0).toLocaleString()} bags`} />
              <KV k="Spread" v={`KSh ${spread.toLocaleString()}`} />
              <KV k="Last update" v="6 min ago" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  italic,
  sub,
}: {
  eyebrow: string;
  title: string;
  italic?: string;
  sub: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display mt-3 sm:mt-4 text-[34px] sm:text-[48px] md:text-[60px] text-ink text-balance">
        {title} {italic && <span className="italic text-teal">{italic}</span>}
      </h1>
      <p className="mt-4 sm:mt-5 text-[14px] sm:text-[14.5px] leading-relaxed text-steel max-w-2xl text-pretty">{sub}</p>
    </div>
  );
}


function Legend() {
  return (
    <div className="flex items-center gap-3 text-[10.5px] text-steel">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-green" /> Sell
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-teal" /> Buy
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-steel" /> Hold
      </span>
    </div>
  );
}

function SignalDot({ signal }: { signal: LMarket["signal"] }) {
  const map = {
    sell: { bg: "bg-green-surface", fg: "text-green-deep", label: "Sell" },
    buy: { bg: "bg-teal/10", fg: "text-teal", label: "Buy" },
    hold: { bg: "bg-canvas", fg: "text-steel", label: "Hold" },
  } as const;
  const s = map[signal];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.fg}`}>
      <span className="h-1 w-1 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function DarkStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="bg-ink p-4">
      <p className="text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className={`font-serif text-[20px] mt-1 tabular ${accent ?? "text-paper"}`}>{value}</p>
      <p className="text-[10.5px] text-mist mt-0.5">{sub}</p>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-hairline pb-2 last:border-0">
      <span className="text-steel">{k}</span>
      <span className="text-ink tabular">{v}</span>
    </div>
  );
}

// keep import to avoid unused warning if needed
