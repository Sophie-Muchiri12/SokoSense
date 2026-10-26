import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { n as RequireAuth } from "./auth-guard-CUFQePul.mjs";
import { a as getMarketPrices } from "./sokosense-api-BEmahCSf.mjs";
import { a as Sprout, g as Carrot, h as Cherry, l as LeafyGreen, t as Wheat, v as Bean } from "../_libs/lucide-react.mjs";
import { a as nearestTrackedMarket, i as haversineKm, r as countiesMatch } from "./geo-C10ERrIw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market-DF5VQrls.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MarketSubcountyPanel({ county, selectedSubcounty, nearestMarketLabel, onSelectSubcounty, onClose, className = "" }) {
	const [items, setItems] = (0, import_react.useState)([]);
	const [loadError, setLoadError] = (0, import_react.useState)(null);
	const [visible, setVisible] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		setLoadError(null);
		fetch("/geo/kenya-subcounties.json").then((r) => {
			if (!r.ok) throw new Error("Could not load subcounty data");
			return r.json();
		}).then((file) => {
			if (cancelled) return;
			setItems(file.subcounties.filter((s) => countiesMatch(s.county, county)));
			requestAnimationFrame(() => setVisible(true));
		}).catch((err) => {
			if (!cancelled) {
				setLoadError(err instanceof Error ? err.message : "Load failed");
				setItems([]);
			}
		});
		return () => {
			cancelled = true;
			setVisible(false);
		};
	}, [county]);
	const staggerClass = (0, import_react.useMemo)(() => (index) => ({
		transitionDelay: `${index * 40}ms`,
		opacity: visible ? 1 : 0,
		transform: visible ? "translateY(0)" : "translateY(8px)"
	}), [visible]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: `market-panel flex flex-col bg-paper border border-hairline ${className}`,
		"aria-label": `Subcounties in ${county}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3 border-b border-hairline px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] uppercase tracking-wider text-teal",
						children: "Subcounties"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-serif text-[20px] text-ink leading-tight mt-0.5",
						children: county
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] text-steel mt-1 leading-snug",
						children: "Pick your area. We map you to the closest of Kenya's seven tracked wholesale markets — not subcounty-level quotes."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					className: "shrink-0 text-[11px] text-steel hover:text-ink border border-hairline px-2 py-1",
					"aria-label": "Close panel",
					children: "✕"
				})]
			}),
			nearestMarketLabel && selectedSubcounty && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-4 mt-3 border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-steel",
					children: "Nearest market: "
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: nearestMarketLabel
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto px-2 py-2",
				children: [
					loadError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-2 py-3 text-[12px] text-rose",
						children: loadError
					}),
					!loadError && items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-2 py-3 text-[12px] text-steel",
						children: "No subcounties listed."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-1",
						children: items.map((sub, index) => {
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => onSelectSubcounty(sub),
								className: `market-subcounty-item w-full text-left px-3 py-2.5 border text-[13px] transition ${selectedSubcounty === sub.name ? "border-ink bg-canvas text-ink" : "border-transparent hover:border-hairline hover:bg-canvas/70 text-ink"}`,
								style: staggerClass(index),
								children: sub.name
							}) }, `${sub.county}-${sub.name}`);
						})
					})
				]
			})
		]
	});
}
/** KSh per km to move one 90 kg bag — used for est. freight on the market map. */
var TRANSPORT_KSH_PER_KM_BAG = 6.2;
/**
* Assign Sell / Buy / Hold from price rank across tracked markets.
* Must stay aligned with ranking used in engines/market.py (highest → sell, lowest → buy).
*/
function assignMarketSignals(markets) {
	const signals = /* @__PURE__ */ new Map();
	if (!markets.length) return signals;
	const sorted = [...markets].sort((a, b) => b.price - a.price);
	const lastRank = sorted.length - 1;
	for (const market of markets) {
		const rank = sorted.findIndex((s) => s.id === market.id);
		const signal = rank === 0 ? "sell" : rank >= lastRank ? "buy" : "hold";
		signals.set(market.id, signal);
	}
	return signals;
}
/**
* Mirror POST /api/market recommendation thresholds (engines/market.py).
* Transport cost is applied separately in the UI for net margin.
*/
function decideMarketRecommendation(localPrice, bestPrice, sameMarket) {
	if (sameMarket || bestPrice <= localPrice) return "SELL_HERE";
	if ((localPrice > 0 ? (bestPrice - localPrice) / localPrice : 0) >= .08) return "SELL_IN_MARKET";
	return "WAIT";
}
function recommendationHeadline(rec, crop, originName, bestName, profitPerBag) {
	const cropLabel = crop.toLowerCase();
	switch (rec) {
		case "SELL_IN_MARKET": return profitPerBag > 0 ? `Move ${cropLabel} from ${originName} to ${bestName} this week.` : `Hold ${cropLabel} — est. freight erases the spread.`;
		case "SELL_HERE": return `Sell ${cropLabel} at ${originName} — best price today.`;
		case "WAIT": return `Hold ${cropLabel} — spread does not justify travel.`;
	}
}
var sessionCache = /* @__PURE__ */ new Map();
function useMarketPrices(cropKey) {
	const [data, setData] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const [isStale, setIsStale] = (0, import_react.useState)(false);
	const [lastUpdated, setLastUpdated] = (0, import_react.useState)(null);
	const [sourceDate, setSourceDate] = (0, import_react.useState)(null);
	const [tick, setTick] = (0, import_react.useState)(0);
	const mounted = (0, import_react.useRef)(true);
	const retry = (0, import_react.useCallback)(() => setTick((n) => n + 1), []);
	(0, import_react.useEffect)(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const key = cropKey.toLowerCase();
		const cached = sessionCache.get(key);
		if (cached && Date.now() - cached.fetchedAt < 6e5) {
			setData(cached.data);
			setLastUpdated(new Date(cached.fetchedAt));
			setSourceDate(cached.data.date ?? null);
			setLoading(false);
			setError(null);
			setIsStale(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		setIsStale(false);
		getMarketPrices(key).then((response) => {
			if (cancelled || !mounted.current) return;
			sessionCache.set(key, {
				data: response,
				fetchedAt: Date.now()
			});
			setData(response);
			setLastUpdated(/* @__PURE__ */ new Date());
			setSourceDate(response.date ?? null);
			setError(null);
			setIsStale(false);
		}).catch((err) => {
			if (cancelled || !mounted.current) return;
			const message = err instanceof Error ? err.message : "Failed to load prices";
			if (cached) {
				setData(cached.data);
				setLastUpdated(new Date(cached.fetchedAt));
				setSourceDate(cached.data.date ?? null);
				setIsStale(true);
				setError(message);
			} else {
				setData(null);
				setError(message);
			}
		}).finally(() => {
			if (!cancelled && mounted.current) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [cropKey, tick]);
	return {
		data,
		loading,
		error,
		isStale,
		lastUpdated,
		sourceDate,
		retry
	};
}
var LeafletMarketMap = (0, import_react.lazy)(() => import("./leaflet-market-map-CLMAp0OD.mjs"));
var CROPS = [
	{
		label: "Maize",
		key: "maize",
		icon: Wheat
	},
	{
		label: "Beans",
		key: "beans",
		icon: Bean
	},
	{
		label: "Sorghum",
		key: "sorghum",
		icon: Sprout
	},
	{
		label: "Millet",
		key: "millet",
		icon: LeafyGreen
	},
	{
		label: "Potatoes",
		key: "potatoes",
		icon: Carrot
	},
	{
		label: "Tomatoes",
		key: "tomatoes",
		icon: Cherry
	}
];
var COUNTY_MAP = {
	Nairobi: "Nairobi",
	Nakuru: "Nakuru",
	Eldoret: "Uasin Gishu",
	Kisumu: "Kisumu",
	Mombasa: "Mombasa",
	Kitale: "Trans-Nzoia",
	Nyeri: "Nyeri"
};
function toMarkets(points) {
	const base = points.map((p) => ({
		id: p.name.toLowerCase().replace(/\s+/g, "-"),
		name: p.name,
		lat: p.lat,
		lng: p.lng,
		price: Math.round(p.price_kes)
	}));
	const signals = assignMarketSignals(base);
	return base.map((m) => ({
		...m,
		signal: signals.get(m.id) ?? "hold"
	}));
}
function MarketMapPage() {
	const [cropIdx, setCropIdx] = (0, import_react.useState)(0);
	const crop = CROPS[cropIdx];
	const { data, loading, error, isStale, lastUpdated, sourceDate, retry } = useMarketPrices(crop.key);
	const [selectedCounty, setSelectedCounty] = (0, import_react.useState)(null);
	const [selectedSubcounty, setSelectedSubcounty] = (0, import_react.useState)(null);
	const [activeMarketId, setActiveMarketId] = (0, import_react.useState)("");
	const [hoverMarketId, setHoverMarketId] = (0, import_react.useState)(null);
	const markets = (0, import_react.useMemo)(() => toMarkets(data?.markets ?? []), [data]);
	const originResolution = (0, import_react.useMemo)(() => {
		if (!selectedSubcounty) return null;
		const { market, distanceKm } = nearestTrackedMarket(selectedSubcounty.lat, selectedSubcounty.lng);
		const live = markets.find((m) => m.id === market.id);
		return {
			marketId: market.id,
			marketName: market.name,
			distanceKm,
			price: live?.price ?? 0
		};
	}, [selectedSubcounty, markets]);
	const originMarketId = originResolution?.marketId ?? "";
	const best = (0, import_react.useMemo)(() => [...markets].sort((a, b) => b.price - a.price)[0], [markets]);
	const cheapest = (0, import_react.useMemo)(() => [...markets].sort((a, b) => a.price - b.price)[0], [markets]);
	const spread = best && cheapest ? best.price - cheapest.price : 0;
	const origin = markets.find((m) => m.id === originMarketId);
	const active = markets.find((m) => m.id === activeMarketId) ?? best;
	const display = markets.find((m) => m.id === (hoverMarketId ?? activeMarketId)) ?? active;
	(0, import_react.useEffect)(() => {
		if (best?.id) setActiveMarketId((prev) => markets.some((m) => m.id === prev) ? prev : best.id);
	}, [best?.id, markets]);
	const distanceToBest = origin && best ? haversineKm(origin.lat, origin.lng, best.lat, best.lng) : 0;
	const transportCostPerBag = Math.round(distanceToBest * TRANSPORT_KSH_PER_KM_BAG);
	const grossPerBag = origin && best ? best.price - origin.price : 0;
	const profitPerBag = Math.max(0, grossPerBag - transportCostPerBag);
	const recommendation = origin && best ? decideMarketRecommendation(origin.price, best.price, origin.id === best.id) : null;
	const updatedLabel = lastUpdated ? lastUpdated.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	}) : "—";
	function handleCountySelect(county) {
		setSelectedCounty(county);
		setSelectedSubcounty(null);
	}
	function handleResetCounties() {
		setSelectedCounty(null);
		setSelectedSubcounty(null);
	}
	function handleSelectSubcounty(sub) {
		setSelectedSubcounty(sub);
	}
	const showArbitrage = Boolean(selectedSubcounty && origin && best && !loading && markets.length);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-[1320px] min-w-0 px-4 sm:px-6 pt-10 sm:pt-14 pb-10 sm:pb-12",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				eyebrow: "Market prices",
				title: "Today's prices,",
				italic: "and where to sell.",
				sub: "See what each market is paying today. Choose your county and your area — we show your nearest market and whether travelling to a better-paying market is worth it."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 sm:mt-10 flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "w-full sm:w-auto text-[12px] text-steel sm:mr-1 uppercase tracking-wider",
					children: "Crop"
				}), CROPS.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					id: `crop-filter-${c.key}`,
					onClick: () => setCropIdx(i),
					className: `market-crop-pill px-3 py-1.5 text-[12.5px] font-medium border transition ${cropIdx === i ? "bg-ink text-paper border-ink" : "bg-paper text-ink border-hairline hover:border-ink/40"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(c.icon, {
						className: "mr-1.5 inline h-4 w-4 align-[-2px]",
						"aria-hidden": "true"
					}), c.label]
				}, c.key))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-[11.5px] text-steel tabular",
				children: [
					"Prices checked at ",
					updatedLabel,
					sourceDate ? ` · newest reports ${sourceDate}` : "",
					" · Prices from KAMIS (the government market price service)",
					loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-amber",
						children: "Refreshing…"
					})
				]
			}),
			isStale && error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 border border-amber/40 bg-[#FFF8E8] px-4 py-2.5 text-[12.5px] text-ink",
				role: "status",
				children: ["Showing the last prices we received — we could not refresh just now.", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: retry,
					className: "ml-2 underline text-teal",
					children: "Retry"
				})]
			}),
			!isStale && error && !markets.length && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 border border-rose/30 bg-rose/5 px-5 py-8 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-serif text-[20px] text-ink",
						children: "We could not load prices"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[13px] text-steel",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: retry,
						className: "mt-4 border border-ink bg-ink px-4 py-2 text-[12px] text-paper",
						children: "Retry"
					})
				]
			}),
			(!error || markets.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap items-center gap-3",
					children: [selectedCounty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: handleResetCounties,
						className: "text-[12px] font-medium text-teal border border-hairline px-3 py-1.5 hover:border-teal/40",
						children: "All counties"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Legend, {})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-5 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-5 min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "market-flat-card overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "eyebrow",
											children: [
												"Kenya · ",
												crop.label.toLowerCase(),
												" · market prices"
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "font-serif text-[22px] sm:text-[24px] text-ink mt-1",
											children: loading && !markets.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "inline-block h-7 w-48 skeleton" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
												markets.length,
												" markets · difference between highest and lowest:",
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-teal tabular",
													children: ["KSh ", spread.toLocaleString()]
												}),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-steel text-[14px]",
													children: "/ 90kg"
												})
											] })
										})] })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative h-[55vh] md:h-[460px]",
										children: [!error || markets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
											fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "grid h-full place-items-center text-steel text-[12px]",
												children: "Loading map…"
											}),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeafletMarketMap, {
												markets,
												loading,
												selectedCounty,
												selectedSubcounty: selectedSubcounty ? {
													name: selectedSubcounty.name,
													lat: selectedSubcounty.lat,
													lng: selectedSubcounty.lng
												} : null,
												onCountySelect: handleCountySelect,
												originMarketId,
												activeMarketId,
												bestMarketId: best?.id ?? "",
												onMarketSelect: setActiveMarketId,
												onMarketHover: setHoverMarketId
											})
										}) : null, display && markets.length > 0 && !loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "pointer-events-none absolute top-2 left-2 sm:top-3 sm:left-3 max-w-[min(11rem,48vw)] sm:max-w-[220px] market-flat-card p-2 sm:p-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[9px] sm:text-[10px] uppercase tracking-wider text-mist",
													children: hoverMarketId ? "Market" : "Chosen market"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "font-serif text-[14px] sm:text-[17px] text-ink mt-0.5 truncate",
													children: display.name
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "font-serif text-[20px] sm:text-[26px] leading-none text-ink tabular mt-1",
													children: display.price.toLocaleString()
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[9px] sm:text-[10px] text-steel mt-0.5 uppercase tracking-wider",
													children: "Shillings per 90kg bag (wholesale — the price traders pay)"
												})
											]
										})]
									}),
									!selectedCounty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "border-t border-hairline px-4 py-3 text-[12px] text-steel",
										children: "Tap a county to see its areas, then choose yours."
									})
								]
							}),
							selectedCounty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "market-bottom-sheet lg:hidden flex flex-col min-h-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarketSubcountyPanel, {
									county: selectedCounty,
									selectedSubcounty: selectedSubcounty?.name ?? null,
									nearestMarketLabel: originResolution ? `${originResolution.marketName} — ${originResolution.distanceKm} km` : null,
									onSelectSubcounty: handleSelectSubcounty,
									onClose: handleResetCounties,
									className: "min-h-0 flex-1"
								})
							}),
							showArbitrage && origin && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "market-flat-card p-4 sm:p-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "eyebrow",
											children: "Comparing markets for you"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
											className: "font-serif text-[20px] text-ink mt-1",
											children: [
												selectedCounty,
												" · ",
												selectedSubcounty?.name
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-[12.5px] text-steel mt-1 leading-snug",
											children: [
												"Your nearest market:",
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-ink font-medium",
													children: origin.name
												}),
												originResolution ? ` (${originResolution.distanceKm} km)` : "",
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-mist",
													children: "then"
												}),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-teal font-medium",
													children: best?.name
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-steel",
													children: " (pays most today)"
												})
											]
										})
									]
								}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableSkeleton, { rows: markets.length || 7 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "overflow-x-auto",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
										className: "w-full min-w-[480px] text-[12.5px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
											className: "text-left text-[10.5px] uppercase tracking-wider text-mist border-b border-hairline",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "py-2 font-medium",
													children: "Market"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "py-2 font-medium text-right",
													children: "Price"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "py-2 font-medium text-right",
													children: "Distance"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "py-2 font-medium text-right",
													children: "You keep / bag"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "py-2 font-medium" })
											]
										}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: markets.map((m) => {
											const d = haversineKm(origin.lat, origin.lng, m.lat, m.lng);
											const net = m.price - origin.price - Math.round(d * 6.2);
											const isActive = m.id === activeMarketId;
											const isBest = m.id === best?.id;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												onClick: () => setActiveMarketId(m.id),
												onMouseEnter: () => setHoverMarketId(m.id),
												onMouseLeave: () => setHoverMarketId(null),
												className: `cursor-pointer border-b border-hairline last:border-0 transition ${isActive ? "bg-canvas" : "hover:bg-canvas/60"}`,
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-2.5 text-ink",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-2",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalSwatch, { signal: m.signal }),
																m.name,
																isBest && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[9.5px] uppercase tracking-wider text-teal border border-teal/30 px-1 py-px",
																	children: "Best"
																})
															]
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-2.5 text-right tabular text-ink",
														children: m.price.toLocaleString()
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: "py-2.5 text-right tabular text-steel",
														children: [d, " km"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: `py-2.5 text-right tabular font-medium ${net > 0 ? "text-green" : net < 0 ? "text-rose" : "text-steel"}`,
														children: [net > 0 ? "+" : "", net.toLocaleString()]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-2.5 text-right",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalDot, { signal: m.signal })
													})
												]
											}, m.id);
										}) })]
									})
								})]
							}),
							selectedCounty && !selectedSubcounty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[12.5px] text-steel text-center py-2",
								children: "Choose your area to see your nearest market and whether travelling pays."
							})
						]
					}), selectedCounty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "hidden lg:block",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarketSubcountyPanel, {
							county: selectedCounty,
							selectedSubcounty: selectedSubcounty?.name ?? null,
							nearestMarketLabel: originResolution ? `${originResolution.marketName} — ${originResolution.distanceKm} km` : null,
							onSelectSubcounty: handleSelectSubcounty,
							onClose: handleResetCounties,
							className: "market-panel--side sticky top-24 max-h-[calc(100vh-7rem)]"
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr]",
					children: [showArbitrage && origin && best && recommendation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "market-flat-card p-4 sm:p-5 bg-ink text-paper border-ink",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10.5px] uppercase tracking-wider text-mist",
								children: "Best-paying market today"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-[26px] sm:text-[32px] mt-1 leading-none",
								children: best.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[12px] text-mist mt-1",
								children: [
									crop.label,
									" · ",
									COUNTY_MAP[best.name] ?? best.name,
									" County"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 grid grid-cols-2 gap-px bg-ink-soft border border-ink-soft overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DarkStat, {
										label: "You could keep (after travel)",
										value: `KSh ${profitPerBag.toLocaleString()}`,
										sub: "per 90kg bag"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DarkStat, {
										label: "Distance",
										value: `${distanceToBest} km`,
										sub: `from ${origin.name}`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DarkStat, {
										label: "Price difference",
										value: `KSh ${grossPerBag.toLocaleString()}`,
										sub: "compared with your nearest market",
										accent: grossPerBag >= 0 ? "text-teal-glow" : "text-rose"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DarkStat, {
										label: "Cost of transport",
										value: `KSh ${transportCostPerBag.toLocaleString()}`,
										sub: "per bag"
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "market-flat-card p-5 bg-green-surface border-green-surface",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow text-green-deep",
								children: "Our advice"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-[20px] text-green-deep mt-2 leading-snug",
								children: recommendationHeadline(recommendation, crop.label, origin.name, best.name, profitPerBag)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-[12.5px] text-green-deep/80 leading-relaxed",
								children: [
									"You could keep",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-medium",
										children: [
											"KSh ",
											profitPerBag.toLocaleString(),
											" / bag"
										]
									}),
									" ",
									"after paying for ",
									distanceToBest,
									" km of transport (KSh ",
									6.2,
									" per km, per bag).",
									" ",
									best.name,
									" is trading",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: origin.price > 0 ? `${((best.price / origin.price - 1) * 100).toFixed(1)}%` : "—"
									}),
									" ",
									"above your nearest market."
								]
							})
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "market-flat-card p-4 sm:p-5 sm:col-span-2 lg:col-span-2 xl:col-span-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "At a glance"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 space-y-3 text-[12.5px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
									k: "Markets with prices",
									v: `${markets.length}`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
									k: "Difference (highest − lowest)",
									v: loading ? "…" : `KSh ${spread.toLocaleString()}`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
									k: "Last update",
									v: updatedLabel
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
									k: "Prices from",
									v: "KAMIS (government market prices)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
									k: "Change since yesterday",
									v: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-mist text-[11px]",
										children: "Coming soon"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
									k: "Amount traded",
									v: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-mist text-[11px]",
										children: "Coming soon"
									})
								})
							]
						})]
					})]
				})
			] })
		]
	});
}
function PageHeader({ eyebrow, title, italic, sub }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "max-w-3xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "eyebrow",
				children: eyebrow
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				className: "display mt-3 sm:mt-4 text-[34px] sm:text-[48px] md:text-[60px] text-ink text-balance",
				children: [
					title,
					" ",
					italic && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "italic text-teal",
						children: italic
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 sm:mt-5 text-[14px] sm:text-[14.5px] leading-relaxed text-steel max-w-2xl text-pretty",
				children: sub
			})
		]
	});
}
function Legend() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-3 text-[10.5px] text-steel",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-green" }), " Sell"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-amber" }), " Hold"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-steel" }), " Buy"]
			})
		]
	});
}
function SignalSwatch({ signal }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "h-1.5 w-1.5 rounded-full shrink-0",
		style: { background: signal === "sell" ? "#2E7D32" : signal === "hold" ? "#C58A1E" : "#516880" }
	});
}
function SignalDot({ signal }) {
	const s = {
		sell: {
			bg: "bg-green-surface",
			fg: "text-green-deep",
			label: "Sell"
		},
		hold: {
			bg: "bg-amber/10",
			fg: "text-amber",
			label: "Hold"
		},
		buy: {
			bg: "bg-canvas",
			fg: "text-steel",
			label: "Buy"
		}
	}[signal];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.fg}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1 w-1 rounded-full bg-current" }), s.label]
	});
}
function DarkStat({ label, value, sub, accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-ink p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10px] uppercase tracking-wider text-mist",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: `font-serif text-[20px] mt-1 tabular ${accent ?? "text-paper"}`,
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10.5px] text-mist mt-0.5",
				children: sub
			})
		]
	});
}
function KV({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex justify-between border-b border-dashed border-hairline pb-2 last:border-0 gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-steel shrink-0",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-ink tabular text-right",
			children: v
		})]
	});
}
function TableSkeleton({ rows }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: Array.from({ length: rows }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-9 w-full skeleton" }, i))
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequireAuth, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarketMapPage, {}) });
//#endregion
export { PageHeader, SplitComponent as component };
