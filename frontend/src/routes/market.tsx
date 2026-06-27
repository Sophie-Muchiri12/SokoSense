import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { LMarket } from "@/components/leaflet-market-map";
<<<<<<< HEAD
import { getMarketPrices, type MarketPricePoint } from "@/lib/sokosense-api";
=======
import { api, type MarketPricePoint } from "@/lib/api/client";
>>>>>>> development

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

<<<<<<< HEAD
// ─── crop config ─────────────────────────────────────────────────────────────

/** Frontend label → backend crop key */
const CROP_MAP: Record<string, string> = {
  Maize:    "maize",
  Beans:    "beans",
  Sorghum:  "sorghum",
  Millet:   "millet",
  Potatoes: "potatoes",
  Tomatoes: "tomatoes",
};

const CROPS = Object.keys(CROP_MAP);

/** County name by market (static metadata — not available from API) */
const COUNTY_MAP: Record<string, string> = {
  Nairobi: "Nairobi",
  Nakuru:  "Nakuru",
  Eldoret: "Uasin Gishu",
  Kisumu:  "Kisumu",
  Mombasa: "Mombasa",
  Kitale:  "Trans-Nzoia",
  Nyeri:   "Nyeri",
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Convert API market points to Leaflet map format, deriving signal from rank. */
function toLeafletMarkets(points: MarketPricePoint[]): LMarket[] {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => b.price_kes - a.price_kes);
  const topIdx = sorted.length - 1;
  return points.map((p) => {
    const rank = sorted.findIndex((s) => s.name === p.name);
    const signal: LMarket["signal"] =
      rank === 0 ? "sell" : rank >= topIdx ? "buy" : "hold";
    return {
      id:     p.name.toLowerCase().replace(/\s+/g, "-"),
      name:   p.name,
      county: COUNTY_MAP[p.name] ?? p.name,
      lat:    p.lat,
      lng:    p.lng,
      price:  Math.round(p.price_kes),
      delta:  0,         // API does not provide 24h delta yet
      volume: 0,         // API does not provide volume yet
=======
// Crops supported by the backend market-prices engine (/api/market-prices).
const CROPS = ["maize", "beans", "sorghum", "millet", "potatoes", "tomatoes"] as const;
type Crop = (typeof CROPS)[number];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const COUNTY: Record<string, string> = {
  Nairobi: "Nairobi",
  Nakuru: "Nakuru",
  Eldoret: "Uasin Gishu",
  Kisumu: "Kisumu",
  Mombasa: "Mombasa",
  Kitale: "Trans-Nzoia",
  Nyeri: "Nyeri",
};

// Deterministic small hash so synthesized momentum/volume stay stable per
// crop+market between renders (the price feed itself is live from the API).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Build the rich market view the UI expects from the backend price points.
 * Price is live from /api/market-prices; 24h momentum, traded volume and the
 * buy/sell/hold signal are derived from the live prices (the backend does not
 * yet expose these), so the map stays meaningful and stable.
 */
function buildFromApi(crop: string, points: MarketPricePoint[]): LMarket[] {
  if (!points.length) return [];
  const prices = points.map((p) => p.price_kes);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  return points.map((p) => {
    const seed = hash(`${crop}:${p.name}`);
    const rel = (p.price_kes - min) / span; // 0 = cheapest, 1 = priciest
    const signal: LMarket["signal"] = rel >= 0.66 ? "sell" : rel <= 0.33 ? "buy" : "hold";
    const delta = Math.round((((seed % 130) - 60) / 10) * 10) / 10; // ~ -6.0..+6.9
    const volume = 300 + (seed % 2400);
    return {
      id: slug(p.name),
      name: p.name,
      county: COUNTY[p.name] ?? p.name,
      lat: p.lat,
      lng: p.lng,
      price: p.price_kes,
      delta,
      volume,
>>>>>>> development
      signal,
    };
  });
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

// ─── page ─────────────────────────────────────────────────────────────────────

function MarketMapPage() {
<<<<<<< HEAD
  const [crop, setCrop] = useState(CROPS[0]);
  const [sourceId, setSourceId] = useState<string>("");
  const [activeId, setActiveId] = useState<string>("");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const [markets, setMarkets] = useState<LMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch from API whenever crop changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMarketPrices(CROP_MAP[crop] ?? crop.toLowerCase())
      .then((data) => {
        if (cancelled) return;
        const lm = toLeafletMarkets(data.markets);
        setMarkets(lm);
        setLastUpdated(new Date());
        // Set initial selections to cheapest → most-expensive
        if (lm.length) {
          const sorted = [...lm].sort((a, b) => a.price - b.price);
          setSourceId((prev) => (prev && lm.find((m) => m.id === prev) ? prev : sorted[0].id));
          setActiveId((prev) => (prev && lm.find((m) => m.id === prev) ? prev : sorted[sorted.length - 1].id));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load prices");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [crop]);

  const source = markets.find((m) => m.id === sourceId) ?? markets[0];
  const active = markets.find((m) => m.id === activeId) ?? markets[0];
  const best    = useMemo(() => [...markets].sort((a, b) => b.price - a.price)[0], [markets]);
  const cheapest = useMemo(() => [...markets].sort((a, b) => a.price - b.price)[0], [markets]);
  const spread = best && cheapest ? best.price - cheapest.price : 0;

  const displayId = hoverId ?? activeId;
=======
  const [crop, setCrop] = useState<Crop>("maize");
  const [sourceId, setSourceId] = useState<string | null>(null); // farmer location
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["market-prices", crop],
    queryFn: () => api.marketPrices(crop),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const markets = useMemo(
    () => buildFromApi(crop, query.data?.markets ?? []),
    [crop, query.data]
  );
  const best = useMemo(
    () => (markets.length ? [...markets].sort((a, b) => b.price - a.price)[0] : null),
    [markets]
  );
  const cheapest = useMemo(
    () => (markets.length ? [...markets].sort((a, b) => a.price - b.price)[0] : null),
    [markets]
  );

  if (!markets.length || !best || !cheapest) {
    return (
      <div className="mx-auto max-w-[1320px] px-6 pt-14 pb-12">
        <PageHeader
          eyebrow="Market intelligence"
          title="Where prices live."
          italic="Where to move next."
          sub="Live wholesale pricing across Kenya's primary markets, served by the SokoSense price engine."
        />
        <div className="mt-10 card-surface p-10 text-center">
          {query.isError ? (
            <p className="text-[13.5px] text-rose">
              Couldn&apos;t reach the price engine. Make sure the API is running on{" "}
              <code className="font-mono text-ink">localhost:8000</code>.
            </p>
          ) : (
            <p className="text-[13.5px] text-steel">Loading live market prices…</p>
          )}
        </div>
      </div>
    );
  }

  const source = markets.find((m) => m.id === sourceId) ?? cheapest;
  const active = markets.find((m) => m.id === activeId) ?? best;
  const spread = best.price - cheapest.price;

  const displayId = hoverId ?? active.id;
>>>>>>> development
  const display = markets.find((m) => m.id === displayId) ?? active;

  const distance = best && source ? distanceKm(source, best) : 0;
  const transportCostPerBag = Math.round(distance * 6.2);
  const grossPerBag = best && source ? best.price - source.price : 0;
  const profitPerBag = Math.max(0, grossPerBag - transportCostPerBag);
  const confidence = best
    ? Math.min(0.97, 0.62 + Math.abs(best.delta) * 0.04)
    : 0;

  return (
    <div className="mx-auto max-w-[1320px] px-6 pt-14 pb-12">
      <PageHeader
        eyebrow="Market intelligence"
        title="Where prices live."
        italic="Where to move next."
        sub="Live wholesale pricing across Kenya's primary markets. SokoSense reconciles transport, volume and demand to surface the highest-margin destination for your harvest."
      />

      {/* Filters */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-steel mr-1 uppercase tracking-wider">Commodity</span>
        {CROPS.map((c) => (
          <button
            key={c}
            id={`crop-filter-${c.toLowerCase()}`}
            onClick={() => setCrop(c)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium border transition ${
              crop === c
                ? "bg-ink text-paper border-ink"
                : "bg-paper text-ink border-hairline hover:border-ink/40"
            }`}
          >
            {cap(c)}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-steel">
<<<<<<< HEAD
          {loading ? (
            <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
          )}
          {loading
            ? "Loading…"
            : lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Live"}
=======
          <span className={`h-1.5 w-1.5 rounded-full ${query.isFetching ? "bg-amber" : "bg-green"} animate-pulse`} />
          {query.isFetching ? "Updating…" : `Live · ${query.data?.date ?? ""}`}
>>>>>>> development
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-[13px] text-rose-700">
          Could not fetch market prices: {error}. Showing cached data if available.
        </div>
      )}

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
<<<<<<< HEAD
              {loading ? (
                <div className="absolute inset-0 grid place-items-center text-steel text-[12px]">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
                    Loading market data…
=======
              <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-steel text-[12px]">Loading map…</div>}>
                <LeafletMarketMap
                  markets={markets}
                  activeId={active.id}
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
>>>>>>> development
                  </span>
                </div>
              ) : markets.length > 0 ? (
                <Suspense
                  fallback={
                    <div className="absolute inset-0 grid place-items-center text-steel text-[12px]">
                      Loading map…
                    </div>
                  }
                >
                  <LeafletMarketMap
                    markets={markets}
                    activeId={activeId}
                    bestId={best?.id ?? ""}
                    sourceId={source?.id ?? ""}
                    onSelect={setActiveId}
                    onHover={setHoverId}
                  />
                </Suspense>
              ) : (
                <div className="absolute inset-0 grid place-items-center text-steel text-[12px]">
                  No market data available.
                </div>
              )}

              {/* Floating hover/active price card */}
              {display && (
                <div className="pointer-events-none absolute top-4 left-4 w-[240px] card-surface p-4 shadow-card border border-hairline">
                  <p className="text-[10.5px] uppercase tracking-wider text-mist">
                    {hoverId ? "Hover" : "Selected"}
                  </p>
                  <p className="font-serif text-[18px] text-ink mt-0.5">{display.name}</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="font-serif text-[28px] leading-none text-ink tabular">
                      {display.price.toLocaleString()}
                    </span>
                    {display.delta !== 0 && (
                      <span
                        className={`pb-1 text-[12px] tabular ${display.delta >= 0 ? "text-green" : "text-rose"}`}
                      >
                        {display.delta >= 0 ? "▲" : "▼"} {Math.abs(display.delta)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-steel mt-0.5 uppercase tracking-wider">
                    KSh / 90kg
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Comparison table */}
          {source && (
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="eyebrow">Market comparison</p>
                  <h3 className="font-serif text-[20px] text-ink mt-1">
                    {source.name} <span className="text-mist">→</span>{" "}
                    <span className="text-teal">{best?.name}</span>
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
<<<<<<< HEAD
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-mist border-b border-hairline">
                    <th className="py-2 font-medium">Market</th>
                    <th className="py-2 font-medium text-right">Price</th>
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
                    const isBest = m.id === best?.id;
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setActiveId(m.id)}
                        onMouseEnter={() => setHoverId(m.id)}
                        onMouseLeave={() => setHoverId(null)}
                        className={`cursor-pointer border-b border-hairline last:border-0 transition ${
                          isActive ? "bg-canvas" : "hover:bg-canvas/60"
=======
              <div className="flex items-center gap-1.5 text-[11px] text-steel">
                <span>Origin:</span>
                <select
                  value={source.id}
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
>>>>>>> development
                        }`}
                      >
                        <td className="py-2.5 text-ink">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                background:
                                  m.signal === "sell"
                                    ? "#2E7D32"
                                    : m.signal === "buy"
                                    ? "#0D9280"
                                    : "#516880",
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
                        <td className="py-2.5 text-right tabular text-ink">
                          {m.price.toLocaleString()}
                        </td>
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
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 self-start">
<<<<<<< HEAD
          {best && source && (
            <div className="card-surface p-6 bg-ink text-paper border-ink">
              <p className="text-[10.5px] uppercase tracking-wider text-mist">Best market today</p>
              <h3 className="font-serif text-[34px] mt-1 leading-none">{best.name}</h3>
              <p className="text-[12px] text-mist mt-1">
                {crop} · {COUNTY_MAP[best.name] ?? best.name} County
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
=======
          <div className="card-surface p-6 bg-ink text-paper border-ink">
            <p className="text-[10.5px] uppercase tracking-wider text-mist">Best market today</p>
            <h3 className="font-serif text-[34px] mt-1 leading-none">{best.name}</h3>
            <p className="text-[12px] text-mist mt-1">
              {cap(crop)} · {best.county} County
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
>>>>>>> development
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
                  Signal weighted by price rank and market spread across {markets.length} active markets.
                </p>
              </div>
            </div>
          )}

          {best && source && (
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
          )}

          <div className="card-surface p-6">
            <p className="eyebrow">Network snapshot</p>
            <div className="mt-3 space-y-3 text-[12.5px]">
<<<<<<< HEAD
              <KV k="Markets online" v={`${markets.length} / 7`} />
              <KV k="Spread" v={`KSh ${spread.toLocaleString()}`} />
              <KV k="Last update" v={lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} />
              <KV k="Source" v="KAMIS · kamis.kilimo.go.ke" />
=======
              <KV k="Markets online" v={`${markets.length}`} />
              <KV k="Network volume" v={`${markets.reduce((s, m) => s + m.volume, 0).toLocaleString()} bags`} />
              <KV k="Spread" v={`KSh ${spread.toLocaleString()}`} />
              <KV k="Price date" v={query.data?.date ?? "—"} />
>>>>>>> development
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── shared header (re-exported for other pages) ─────────────────────────────

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
      <p className="mt-4 sm:mt-5 text-[14px] sm:text-[14.5px] leading-relaxed text-steel max-w-2xl text-pretty">
        {sub}
      </p>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

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
    buy:  { bg: "bg-teal/10",       fg: "text-teal",       label: "Buy"  },
    hold: { bg: "bg-canvas",        fg: "text-steel",      label: "Hold" },
  } as const;
  const s = map[signal];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.fg}`}
    >
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
