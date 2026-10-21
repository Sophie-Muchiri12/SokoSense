import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth-guard";
import { createFileRoute } from "@tanstack/react-router";
import type { LMarket } from "@/components/leaflet-market-map";
import {
  MarketSubcountyPanel,
  type SubcountyRecord,
} from "@/components/market-subcounty-panel";
import { TRANSPORT_KSH_PER_KM_BAG } from "@/lib/config";
import { haversineKm, nearestTrackedMarket } from "@/lib/geo";
import {
  assignMarketSignals,
  decideMarketRecommendation,
  recommendationHeadline,
} from "@/lib/marketSignals";
import type { MarketPricePoint } from "@/lib/sokosense-api";
import { ArrowLeft, Bean, Carrot, Cherry, LeafyGreen, Sprout, Wheat } from "lucide-react";
import { useMarketPrices } from "@/lib/useMarketPrices";

const LeafletMarketMap = lazy(() => import("@/components/leaflet-market-map"));

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market Prices Map — SokoSense" },
      {
        name: "description",
        content:
          "Today's crop prices in the main markets across Kenya — and which market pays you most.",
      },
      { property: "og:title", content: "Market Intelligence Map — SokoSense" },
      {
        property: "og:description",
        content: "Today's crop prices across Kenyan markets, on one simple map.",
      },
    ],
  }),
  component: () => (<RequireAuth><MarketMapPage /></RequireAuth>),
});

const CROPS = [
  { label: "Maize", key: "maize", icon: Wheat },
  { label: "Beans", key: "beans", icon: Bean },
  { label: "Sorghum", key: "sorghum", icon: Sprout },
  { label: "Millet", key: "millet", icon: LeafyGreen },
  { label: "Potatoes", key: "potatoes", icon: Carrot },
  { label: "Tomatoes", key: "tomatoes", icon: Cherry },
] as const;

const COUNTY_MAP: Record<string, string> = {
  Nairobi: "Nairobi",
  Nakuru: "Nakuru",
  Eldoret: "Uasin Gishu",
  Kisumu: "Kisumu",
  Mombasa: "Mombasa",
  Kitale: "Trans-Nzoia",
  Nyeri: "Nyeri",
};

function toMarkets(points: MarketPricePoint[]): LMarket[] {
  const base = points.map((p) => ({
    id: p.name.toLowerCase().replace(/\s+/g, "-"),
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    price: Math.round(p.price_kes),
  }));
  const signals = assignMarketSignals(base);
  return base.map((m) => ({ ...m, signal: signals.get(m.id) ?? "hold" }));
}

function MarketMapPage() {
  const [cropIdx, setCropIdx] = useState(0);
  const crop = CROPS[cropIdx];
  const { data, loading, error, isStale, lastUpdated, sourceDate, retry } =
    useMarketPrices(crop.key);

  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [selectedSubcounty, setSelectedSubcounty] = useState<SubcountyRecord | null>(null);
  const [activeMarketId, setActiveMarketId] = useState("");
  const [hoverMarketId, setHoverMarketId] = useState<string | null>(null);

  const markets = useMemo(() => toMarkets(data?.markets ?? []), [data]);

  const originResolution = useMemo(() => {
    if (!selectedSubcounty) return null;
    const { market, distanceKm } = nearestTrackedMarket(
      selectedSubcounty.lat,
      selectedSubcounty.lng,
    );
    const live = markets.find((m) => m.id === market.id);
    return {
      marketId: market.id,
      marketName: market.name,
      distanceKm,
      price: live?.price ?? 0,
    };
  }, [selectedSubcounty, markets]);

  const originMarketId = originResolution?.marketId ?? "";
  const best = useMemo(
    () => [...markets].sort((a, b) => b.price - a.price)[0],
    [markets],
  );
  const cheapest = useMemo(
    () => [...markets].sort((a, b) => a.price - b.price)[0],
    [markets],
  );
  const spread = best && cheapest ? best.price - cheapest.price : 0;

  const origin = markets.find((m) => m.id === originMarketId);
  const active = markets.find((m) => m.id === activeMarketId) ?? best;
  const display = markets.find((m) => m.id === (hoverMarketId ?? activeMarketId)) ?? active;

  useEffect(() => {
    if (best?.id) setActiveMarketId((prev) => (markets.some((m) => m.id === prev) ? prev : best.id));
  }, [best?.id, markets]);

  const distanceToBest =
    origin && best ? haversineKm(origin.lat, origin.lng, best.lat, best.lng) : 0;
  const transportCostPerBag = Math.round(distanceToBest * TRANSPORT_KSH_PER_KM_BAG);
  const grossPerBag = origin && best ? best.price - origin.price : 0;
  const profitPerBag = Math.max(0, grossPerBag - transportCostPerBag);

  const recommendation = origin && best
    ? decideMarketRecommendation(origin.price, best.price, origin.id === best.id)
    : null;

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  function handleCountySelect(county: string) {
    setSelectedCounty(county);
    setSelectedSubcounty(null);
  }

  function handleResetCounties() {
    setSelectedCounty(null);
    setSelectedSubcounty(null);
  }

  function handleSelectSubcounty(sub: SubcountyRecord) {
    setSelectedSubcounty(sub);
  }

  const showArbitrage = Boolean(selectedSubcounty && origin && best && !loading && markets.length);

  return (
    <div className="mx-auto max-w-[1320px] min-w-0 px-4 sm:px-6 pt-10 sm:pt-14 pb-10 sm:pb-12">
      <PageHeader
        eyebrow="Market prices"
        title="Today's prices,"
        italic="and where to sell."
        sub="See what each market is paying today. Choose your county and your area — we show your nearest market and whether travelling to a better-paying market is worth it."
      />

      {/* Crop pills */}
      <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-2">
        <span className="w-full sm:w-auto text-[12px] text-steel sm:mr-1 uppercase tracking-wider">Crop</span>
        {CROPS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            id={`crop-filter-${c.key}`}
            onClick={() => setCropIdx(i)}
            className={`market-crop-pill px-3 py-1.5 text-[12.5px] font-medium border transition ${
              cropIdx === i
                ? "bg-ink text-paper border-ink"
                : "bg-paper text-ink border-hairline hover:border-ink/40"
            }`}
          >
            <c.icon className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />{c.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] text-steel tabular">
        Prices checked at {updatedLabel}
        {sourceDate ? ` · newest reports ${sourceDate}` : ""} · Prices from KAMIS (the government market price service)
        {loading && <span className="ml-2 text-amber">Refreshing…</span>}
      </p>

      {isStale && error && (
        <div
          className="mt-3 border border-amber/40 bg-[#FFF8E8] px-4 py-2.5 text-[12.5px] text-ink"
          role="status"
        >
          Showing the last prices we received — we could not refresh just now.
          <button type="button" onClick={retry} className="ml-2 underline text-teal">
            Retry
          </button>
        </div>
      )}

      {!isStale && error && !markets.length && (
        <div className="mt-6 border border-rose/30 bg-rose/5 px-5 py-8 text-center">
          <p className="font-serif text-[20px] text-ink">We could not load prices</p>
          <p className="mt-2 text-[13px] text-steel">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 border border-ink bg-ink px-4 py-2 text-[12px] text-paper"
          >
            Retry
          </button>
        </div>
      )}

      {(!error || markets.length > 0) && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {selectedCounty && (
              <button
                type="button"
                onClick={handleResetCounties}
                className="text-[12px] font-medium text-teal border border-hairline px-3 py-1.5 hover:border-teal/40"
              >
                All counties
              </button>
            )}
            <Legend />
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px]">
            {/* Map column */}
            <div className="space-y-5 min-w-0">
              <div className="market-flat-card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-5">
                  <div>
                    <p className="eyebrow">
                      Kenya · {crop.label.toLowerCase()} · market prices
                    </p>
                    <h2 className="font-serif text-[22px] sm:text-[24px] text-ink mt-1">
                      {loading && !markets.length ? (
                        <span className="inline-block h-7 w-48 skeleton" />
                      ) : (
                        <>
                          {markets.length} markets · difference between highest and lowest:{" "}
                          <span className="text-teal tabular">
                            KSh {spread.toLocaleString()}
                          </span>{" "}
                          <span className="text-steel text-[14px]">/ 90kg</span>
                        </>
                      )}
                    </h2>
                  </div>
                </div>

                <div className="relative h-[55vh] md:h-[460px]">
                  {!error || markets.length > 0 ? (
                    <Suspense
                      fallback={
                        <div className="grid h-full place-items-center text-steel text-[12px]">
                          Loading map…
                        </div>
                      }
                    >
                      <LeafletMarketMap
                        markets={markets}
                        loading={loading}
                        selectedCounty={selectedCounty}
                        selectedSubcounty={
                          selectedSubcounty
                            ? {
                                name: selectedSubcounty.name,
                                lat: selectedSubcounty.lat,
                                lng: selectedSubcounty.lng,
                              }
                            : null
                        }
                        onCountySelect={handleCountySelect}
                        originMarketId={originMarketId}
                        activeMarketId={activeMarketId}
                        bestMarketId={best?.id ?? ""}
                        onMarketSelect={setActiveMarketId}
                        onMarketHover={setHoverMarketId}
                      />
                    </Suspense>
                  ) : null}

                  {display && markets.length > 0 && !loading && (
                    <div className="pointer-events-none absolute top-2 left-2 sm:top-3 sm:left-3 max-w-[min(11rem,48vw)] sm:max-w-[220px] market-flat-card p-2 sm:p-3">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-mist">
                        {hoverMarketId ? "Market" : "Chosen market"}
                      </p>
                      <p className="font-serif text-[14px] sm:text-[17px] text-ink mt-0.5 truncate">{display.name}</p>
                      <p className="font-serif text-[20px] sm:text-[26px] leading-none text-ink tabular mt-1">
                        {display.price.toLocaleString()}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-steel mt-0.5 uppercase tracking-wider">
                        Shillings per 90kg bag (wholesale — the price traders pay)
                      </p>
                    </div>
                  )}
                </div>

                {!selectedCounty && (
                  <p className="border-t border-hairline px-4 py-3 text-[12px] text-steel">
                    Tap a county to see its areas, then choose yours.
                  </p>
                )}
              </div>

              {/* Mobile subcounty bottom sheet */}
              {selectedCounty && (
                <div className="market-bottom-sheet lg:hidden flex flex-col min-h-0">
                  <MarketSubcountyPanel
                    county={selectedCounty}
                    selectedSubcounty={selectedSubcounty?.name ?? null}
                    nearestMarketLabel={
                      originResolution
                        ? `${originResolution.marketName} — ${originResolution.distanceKm} km`
                        : null
                    }
                    onSelectSubcounty={handleSelectSubcounty}
                    onClose={handleResetCounties}
                    className="min-h-0 flex-1"
                  />
                </div>
              )}

              {/* Comparison table */}
              {showArbitrage && origin && (
                <div className="market-flat-card p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="eyebrow">Comparing markets for you</p>
                    <h3 className="font-serif text-[20px] text-ink mt-1">
                      {selectedCounty} · {selectedSubcounty?.name}
                    </h3>
                    <p className="text-[12.5px] text-steel mt-1 leading-snug">
                      Your nearest market:{" "}
                      <span className="text-ink font-medium">{origin.name}</span>
                      {originResolution ? ` (${originResolution.distanceKm} km)` : ""}{" "}
                      <span className="text-mist">then</span>{" "}
                      <span className="text-teal font-medium">{best?.name}</span>
                      <span className="text-steel"> (pays most today)</span>
                    </p>
                  </div>

                  {loading ? (
                    <TableSkeleton rows={markets.length || 7} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-[12.5px]">
                        <thead>
                          <tr className="text-left text-[10.5px] uppercase tracking-wider text-mist border-b border-hairline">
                            <th className="py-2 font-medium">Market</th>
                            <th className="py-2 font-medium text-right">Price</th>
                            <th className="py-2 font-medium text-right">Distance</th>
                            <th className="py-2 font-medium text-right">You keep / bag</th>
                            <th className="py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {markets.map((m) => {
                            const d = haversineKm(origin.lat, origin.lng, m.lat, m.lng);
                            const net =
                              m.price - origin.price - Math.round(d * TRANSPORT_KSH_PER_KM_BAG);
                            const isActive = m.id === activeMarketId;
                            const isBest = m.id === best?.id;
                            return (
                              <tr
                                key={m.id}
                                onClick={() => setActiveMarketId(m.id)}
                                onMouseEnter={() => setHoverMarketId(m.id)}
                                onMouseLeave={() => setHoverMarketId(null)}
                                className={`cursor-pointer border-b border-hairline last:border-0 transition ${
                                  isActive ? "bg-canvas" : "hover:bg-canvas/60"
                                }`}
                              >
                                <td className="py-2.5 text-ink">
                                  <span className="inline-flex items-center gap-2">
                                    <SignalSwatch signal={m.signal} />
                                    {m.name}
                                    {isBest && (
                                      <span className="text-[9.5px] uppercase tracking-wider text-teal border border-teal/30 px-1 py-px">
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
              )}

              {selectedCounty && !selectedSubcounty && (
                <p className="text-[12.5px] text-steel text-center py-2">
                  Choose your area to see your nearest market and whether travelling pays.
                </p>
              )}
            </div>

            {/* Desktop subcounty side panel */}
            {selectedCounty && (
              <div className="hidden lg:block">
                <MarketSubcountyPanel
                  county={selectedCounty}
                  selectedSubcounty={selectedSubcounty?.name ?? null}
                  nearestMarketLabel={
                    originResolution
                      ? `${originResolution.marketName} — ${originResolution.distanceKm} km`
                      : null
                  }
                  onSelectSubcounty={handleSelectSubcounty}
                  onClose={handleResetCounties}
                  className="market-panel--side sticky top-24 max-h-[calc(100vh-7rem)]"
                />
              </div>
            )}
          </div>

          {/* Recommendation + stats row */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr]">
            {showArbitrage && origin && best && recommendation && (
              <>
                <div className="market-flat-card p-4 sm:p-5 bg-ink text-paper border-ink">
                  <p className="text-[10.5px] uppercase tracking-wider text-mist">Best-paying market today</p>
                  <h3 className="font-serif text-[26px] sm:text-[32px] mt-1 leading-none">{best.name}</h3>
                  <p className="text-[12px] text-mist mt-1">
                    {crop.label} · {COUNTY_MAP[best.name] ?? best.name} County
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-px bg-ink-soft border border-ink-soft overflow-hidden">
                    <DarkStat
                      label="You could keep (after travel)"
                      value={`KSh ${profitPerBag.toLocaleString()}`}
                      sub="per 90kg bag"
                    />
                    <DarkStat
                      label="Distance"
                      value={`${distanceToBest} km`}
                      sub={`from ${origin.name}`}
                    />
                    <DarkStat
                      label="Price difference"
                      value={`KSh ${grossPerBag.toLocaleString()}`}
                      sub="compared with your nearest market"
                      accent={grossPerBag >= 0 ? "text-teal-glow" : "text-rose"}
                    />
                    <DarkStat
                      label="Cost of transport"
                      value={`KSh ${transportCostPerBag.toLocaleString()}`}
                      sub="per bag"
                    />
                  </div>
                </div>

                <div className="market-flat-card p-5 bg-green-surface border-green-surface">
                  <p className="eyebrow text-green-deep">Our advice</p>
                  <h3 className="font-serif text-[20px] text-green-deep mt-2 leading-snug">
                    {recommendationHeadline(
                      recommendation,
                      crop.label,
                      origin.name,
                      best.name,
                      profitPerBag,
                    )}
                  </h3>
                  <p className="mt-3 text-[12.5px] text-green-deep/80 leading-relaxed">
                    You could keep{" "}
                    <span className="font-medium">KSh {profitPerBag.toLocaleString()} / bag</span>{" "}
                    after paying for {distanceToBest} km of transport (KSh {TRANSPORT_KSH_PER_KM_BAG} per km, per bag).{" "}
                    {best.name} is trading{" "}
                    <span className="font-medium">
                      {origin.price > 0
                        ? `${((best.price / origin.price - 1) * 100).toFixed(1)}%`
                        : "—"}
                    </span>{" "}
                    above your nearest market.
                  </p>
                </div>
              </>
            )}

            <div className="market-flat-card p-4 sm:p-5 sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <p className="eyebrow">At a glance</p>
              <div className="mt-3 space-y-3 text-[12.5px]">
                <KV k="Markets with prices" v={`${markets.length}`} />
                <KV k="Difference (highest − lowest)" v={loading ? "…" : `KSh ${spread.toLocaleString()}`} />
                <KV k="Last update" v={updatedLabel} />
                <KV k="Prices from" v="KAMIS (government market prices)" />
                <KV
                  k="Change since yesterday"
                  v={<span className="text-mist text-[11px]">Coming soon</span>}
                />
                <KV
                  k="Amount traded"
                  v={<span className="text-mist text-[11px]">Coming soon</span>}
                />
              </div>
            </div>
          </div>
        </>
      )}
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
      <p className="mt-4 sm:mt-5 text-[14px] sm:text-[14.5px] leading-relaxed text-steel max-w-2xl text-pretty">
        {sub}
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-steel">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-green" /> Sell
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber" /> Hold
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-steel" /> Buy
      </span>
    </div>
  );
}

function SignalSwatch({ signal }: { signal: LMarket["signal"] }) {
  const color =
    signal === "sell" ? "#2E7D32" : signal === "hold" ? "#C58A1E" : "#516880";
  return (
    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
  );
}

function SignalDot({ signal }: { signal: LMarket["signal"] }) {
  const map = {
    sell: { bg: "bg-green-surface", fg: "text-green-deep", label: "Sell" },
    hold: { bg: "bg-amber/10", fg: "text-amber", label: "Hold" },
    buy: { bg: "bg-canvas", fg: "text-steel", label: "Buy" },
  } as const;
  const s = map[signal];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.fg}`}
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

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between border-b border-dashed border-hairline pb-2 last:border-0 gap-4">
      <span className="text-steel shrink-0">{k}</span>
      <span className="text-ink tabular text-right">{v}</span>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 w-full skeleton" />
      ))}
    </div>
  );
}
