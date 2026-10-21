import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as PageHeader } from "./market-CsderNyk.mjs";
import { n as RequireAuth } from "./auth-guard-CUFQePul.mjs";
import { c as postAgent, u as postTimingDecision } from "./sokosense-api-BEmahCSf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/timing-D5iLM5Op.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CROPS = [
	"maize",
	"beans",
	"tomatoes",
	"sorghum",
	"millet",
	"potatoes"
];
var MARKETS = [
	"Nairobi",
	"Nakuru",
	"Eldoret",
	"Kisumu",
	"Mombasa",
	"Kitale",
	"Nyeri"
];
function TimingPage() {
	const [crop, setCrop] = (0, import_react.useState)(CROPS[0]);
	const [market, setMarket] = (0, import_react.useState)(MARKETS[1]);
	const [result, setResult] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const run = async () => {
		setLoading(true);
		setError(null);
		try {
			setResult(await postTimingDecision(crop, market.toLowerCase()));
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
				wait_days: null
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Agent request failed");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "When to sell",
			title: "Sell today",
			italic: "or wait?",
			sub: "We check how the price of your crop has been moving in recent days, then tell you plainly: sell today, or wait. It is the same answer we send by text message."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-10 grid lg:grid-cols-2 gap-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface p-5 sm:p-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "Your crop and market"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 space-y-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Crop",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: crop,
								onChange: (e) => setCrop(e.target.value),
								className: "w-full rounded-xl border border-hairline bg-paper px-4 py-2.5 text-[14px] text-ink",
								children: CROPS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: c,
									children: c
								}, c))
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Market",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: market,
								onChange: (e) => setMarket(e.target.value),
								className: "w-full rounded-xl border border-hairline bg-paper px-4 py-2.5 text-[14px] text-ink",
								children: MARKETS.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: m,
									children: m
								}, m))
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-col sm:flex-row flex-wrap gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: run,
							disabled: loading,
							className: "rounded-full bg-teal px-5 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-50",
							children: loading ? "Checking…" : "Should I sell today?"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: runViaAgent,
							disabled: loading,
							className: "rounded-full border border-hairline bg-paper px-5 py-2.5 text-[12.5px] font-medium text-ink hover:border-ink/40 disabled:opacity-50",
							children: "Ask in your own words"
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface p-5 sm:p-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "Our advice"
					}),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700",
						children: error
					}),
					!result && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-6 text-[13px] text-mist",
						children: "Choose your crop and market, then ask — we will tell you whether to sell today or wait."
					}),
					result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `inline-flex rounded-full px-4 py-1 text-[12px] font-medium ${result.recommendation === "SELL_TODAY" ? "bg-green-surface text-green-deep" : "bg-amber/10 text-amber"}`,
								children: result.recommendation === "SELL_TODAY" ? "Sell today" : "Wait"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-5 font-serif text-[22px] text-ink leading-snug",
								children: result.short_reply
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 text-[13px] text-steel leading-relaxed",
								children: result.reason
							}),
							(result.price_kes != null || result.kamis_date) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 rounded-xl border border-hairline bg-canvas px-4 py-3 text-[12px] text-steel space-y-1",
								children: [
									result.price_kes != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"Price today (per 90kg bag):",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-ink font-medium tabular",
											children: ["KSh ", result.price_kes.toLocaleString()]
										})
									] }),
									result.trend && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										"How the price is moving:",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-ink font-medium",
											children: result.trend === "rising" ? "Going up" : result.trend === "falling" ? "Going down" : "Steady"
										})
									] }),
									result.kamis_date && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Price from: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-ink",
										children: result.kamis_date
									})] }),
									result.data_source && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-mist",
										children: "Prices from KAMIS (the government market price service)"
									})
								]
							}),
							result.wait_days != null && result.wait_days > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-[12px] text-mist tabular",
								children: [
									"We suggest waiting about ",
									result.wait_days,
									" days"
								]
							})
						]
					})
				]
			})]
		})]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: "text-[11px] uppercase tracking-wider text-mist",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-2",
		children
	})] });
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequireAuth, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimingPage, {}) });
//#endregion
export { SplitComponent as component };
