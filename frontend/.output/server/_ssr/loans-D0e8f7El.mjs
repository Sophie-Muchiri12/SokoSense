import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { n as RequireAuth } from "./auth-guard-CUFQePul.mjs";
import { c as postAgent, l as postLoan } from "./sokosense-api-BEmahCSf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/loans-D0e8f7El.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CBR_BENCHMARK = 13;
var SACCO_AVG = 18;
var MAX_BAR_APR = 50;
function LoanRiskAnalyzer() {
	const [monthlyRate, setMonthlyRate] = (0, import_react.useState)(2.5);
	const [amount, setAmount] = (0, import_react.useState)(35e3);
	const [months, setMonths] = (0, import_react.useState)(6);
	const [engineResult, setEngineResult] = (0, import_react.useState)(null);
	const [agentReply, setAgentReply] = (0, import_react.useState)(null);
	const [engineLoading, setEngineLoading] = (0, import_react.useState)(false);
	const [engineError, setEngineError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		const timer = setTimeout(() => {
			setEngineLoading(true);
			setEngineError(null);
			postLoan(monthlyRate).then((res) => {
				if (!cancelled) setEngineResult(res);
			}).catch((err) => {
				if (!cancelled) {
					setEngineError(err instanceof Error ? err.message : "Engine unavailable");
					setEngineResult(null);
				}
			}).finally(() => {
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
			setAgentReply((await postAgent(`LOAN ${amount} BEANS ${months} MONTHS at ${monthlyRate}% monthly interest`)).response);
		} catch (err) {
			setEngineError(err instanceof Error ? err.message : "Agent unavailable");
		} finally {
			setEngineLoading(false);
		}
	};
	const calc = (0, import_react.useMemo)(() => {
		const r = monthlyRate / 100;
		const effectiveAPR = (Math.pow(1 + r, 12) - 1) * 100;
		const monthlyPayment = r === 0 ? amount / months : amount * r / (1 - Math.pow(1 + r, -months));
		const totalRepayment = monthlyPayment * months;
		const totalInterest = totalRepayment - amount;
		let risk;
		if (effectiveAPR <= 18) risk = "Safe";
		else if (effectiveAPR <= 32) risk = "Caution";
		else risk = "Danger";
		const vsCBR = effectiveAPR - CBR_BENCHMARK;
		return {
			effectiveAPR,
			monthlyPayment,
			totalRepayment,
			totalInterest,
			risk,
			vsCBR
		};
	}, [
		monthlyRate,
		amount,
		months
	]);
	const debouncedRate = useDebounced(monthlyRate, 350);
	const verdict = useQuery({
		queryKey: ["loan", debouncedRate],
		queryFn: () => postLoan(debouncedRate),
		staleTime: 6e4,
		placeholderData: (prev) => prev
	});
	const riskColor = calc.risk === "Safe" ? {
		bg: "bg-green-surface",
		text: "text-green-deep",
		dot: "bg-green",
		border: "border-green-surface",
		badge: "bg-green text-paper"
	} : calc.risk === "Caution" ? {
		bg: "bg-amber/10",
		text: "text-amber",
		dot: "bg-amber",
		border: "border-amber/20",
		badge: "bg-amber text-paper"
	} : {
		bg: "bg-rose/10",
		text: "text-rose",
		dot: "bg-rose",
		border: "border-rose/20",
		badge: "bg-rose text-paper"
	};
	const processingFee = amount * .02;
	const insurance = amount * .015;
	const disbursementFee = 150;
	const hiddenTotal = processingFee + insurance + disbursementFee;
	const whyRisky = (0, import_react.useMemo)(() => {
		const reasons = [];
		if (monthlyRate > 3) reasons.push("The monthly interest is high, so the debt grows faster than most crops can earn.");
		if (calc.effectiveAPR > CBR_BENCHMARK * 2) reasons.push("Over a year this costs more than double the Central Bank rate. Lenders this expensive often make their money from late-payment fines.");
		if (calc.totalInterest > amount * .5) reasons.push("The interest alone is more than half of what you borrowed — you would pay a lot for the loan itself.");
		if (months > 9) reasons.push("Repaying over many seasons is risky: if one harvest fails, you may be unable to pay before the next.");
		if (amount > 1e5) reasons.push("A big loan usually means the lender will ask for strong security — like land or group guarantees.");
		if (reasons.length === 0) reasons.push("This loan looks reasonable for a farmer to manage.");
		return reasons;
	}, [
		monthlyRate,
		calc.effectiveAPR,
		calc.totalInterest,
		months,
		amount
	]);
	const recommendation = (0, import_react.useMemo)(() => {
		if (calc.risk === "Safe") return "This price is fair. You could ask your SACCO if they can do better, but this offer is reasonable. Borrow for a short time, and spend it only on things that will earn.";
		if (calc.risk === "Caution") return "This costs more than a typical SACCO loan. Try borrowing for 2 fewer months, or borrow about a fifth less. If you can repay early without a fine, do so and clear the debt quickly.";
		return "This loan is expensive. Before you sign, visit your SACCO or county agriculture office. A group loan or SACCO loan paid in stages could cost half as much. Do not borrow this for a gamble.";
	}, [calc.risk]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "Loan check"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "display mt-4 text-[40px] sm:text-[52px] text-ink max-w-3xl",
					children: "Is this loan fair?"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-[15px] leading-relaxed text-steel max-w-2xl",
					children: "Type in what a lender is offering and see the true cost — how much extra you will pay on top of what you borrow. We compare it with typical bank and SACCO rates, then tell you plainly what to do."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-12 grid lg:grid-cols-[1fr_1.1fr] gap-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "card-surface p-5 sm:p-7",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "The loan offer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-serif text-[26px] text-ink mt-1",
							children: "What are they offering you?"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-7 space-y-7",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
									label: "Interest charged each month",
									suffix: "%",
									value: monthlyRate,
									min: .5,
									max: 10,
									step: .5,
									onChange: setMonthlyRate,
									format: (v) => v.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
									label: "How much you borrow",
									suffix: "KSh",
									value: amount,
									min: 5e3,
									max: 2e5,
									step: 1e3,
									onChange: setAmount,
									format: (v) => v.toLocaleString()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
									label: "How long to repay",
									suffix: "months",
									value: months,
									min: 2,
									max: 18,
									step: 1,
									onChange: setMonths,
									format: (v) => String(v)
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-8 rounded-xl border border-hairline bg-canvas p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] uppercase tracking-wider text-mist",
									children: "Monthly payment"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-serif text-[32px] text-ink tabular mt-1",
									children: ["KSh ", Math.round(calc.monthlyPayment).toLocaleString()]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[12px] text-steel mt-1",
									children: [
										months,
										" payments of KSh ",
										Math.round(calc.monthlyPayment).toLocaleString()
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-5 flex gap-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: askAgent,
								disabled: engineLoading,
								className: "rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50",
								children: engineLoading ? "Checking…" : "Explain this loan to me"
							})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-5",
					children: [
						(engineResult || engineLoading || engineError) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "card-surface p-5 sm:p-7 border-teal/20",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "eyebrow text-teal",
									children: "Our verdict"
								}),
								engineLoading && !engineResult && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-[13px] text-steel",
									children: "Checking this loan…"
								}),
								engineError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-[13px] text-rose-600",
									children: engineError
								}),
								engineResult && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-serif text-[28px] text-ink tabular",
											children: [engineResult.apr_percent.toFixed(1), "% a year"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "chip capitalize",
											children: engineResult.risk_verdict.toLowerCase().replace("_", " ")
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-3 text-[13.5px] text-ink leading-relaxed",
										children: engineResult.short_reply
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-[12px] text-steel",
										children: engineResult.comparison_phrase
									})
								] })
							]
						}),
						agentReply && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "card-surface p-5 sm:p-7 bg-canvas",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "In simple words"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap",
								children: agentReply
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `card-surface p-5 sm:p-7 ${riskColor.border}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: `eyebrow ${riskColor.text}`,
										children: "How risky is it?"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${riskColor.badge}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full ${riskColor.dot}` }), calc.risk]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: `font-serif text-[34px] mt-2 leading-tight ${riskColor.text}`,
									children: calc.risk === "Safe" ? "This looks fair" : calc.risk === "Caution" ? "Be careful with this one" : "Too costly — think again"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: `mt-3 text-[13.5px] leading-relaxed ${calc.risk === "Safe" ? "text-green-deep/80" : "text-steel"}`,
									children: [
										"Over a year, this loan costs about ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "text-ink",
											children: [calc.effectiveAPR.toFixed(2), "%"]
										}),
										" on top of what you borrow.",
										calc.vsCBR > 0 ? ` That is ${calc.vsCBR.toFixed(1)} points higher than the Central Bank rate — loans near that rate are much cheaper.` : " That is below even the Central Bank rate — a very good offer."
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "card-surface p-5 sm:p-7",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "eyebrow",
									children: "Compare the cost"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-serif text-[20px] text-ink mt-2",
									children: "How this loan compares"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-6 space-y-5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarRow, {
											label: "Central Bank rate (cheapest guide)",
											value: CBR_BENCHMARK,
											color: "bg-green",
											max: MAX_BAR_APR
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarRow, {
											label: "Typical SACCO loan",
											value: SACCO_AVG,
											color: "bg-teal",
											max: MAX_BAR_APR
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarRow, {
											label: "This loan",
											value: calc.effectiveAPR,
											color: calc.risk === "Safe" ? "bg-green" : calc.risk === "Caution" ? "bg-amber" : "bg-rose",
											max: MAX_BAR_APR,
											highlight: true
										})
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "card-surface p-5 sm:p-7",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "What you will really pay"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 grid grid-cols-2 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Cost per year",
										value: `${calc.effectiveAPR.toFixed(2)}%`,
										hero: true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Extra you pay (interest)",
										value: `KSh ${Math.round(calc.totalInterest).toLocaleString()}`,
										hero: true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "You borrow",
										value: `KSh ${amount.toLocaleString()}`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "You pay back in total",
										value: `KSh ${Math.round(calc.totalRepayment).toLocaleString()}`
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveVerdictCard, {
							monthlyRate: debouncedRate,
							data: verdict.data,
							isLoading: verdict.isLoading,
							isError: verdict.isError
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 grid md:grid-cols-3 gap-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "card-surface p-5 sm:p-7",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "Things to watch"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-[22px] text-ink mt-2",
								children: "Why this loan could hurt"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-5 space-y-3",
								children: whyRisky.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-start gap-3 text-[13px] leading-relaxed text-steel",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${calc.risk === "Safe" ? "bg-green" : calc.risk === "Caution" ? "bg-amber" : "bg-rose"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r })]
								}, i))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "card-surface p-5 sm:p-7",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "Watch out"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-[22px] text-ink mt-2",
								children: "Extra costs that may be added"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "mt-5 space-y-3 text-[13px] text-steel",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostRow, {
										label: "Paperwork fee (2%)",
										value: processingFee
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostRow, {
										label: "Loan insurance (1.5%)",
										value: insurance
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostRow, {
										label: "Release fee",
										value: disbursementFee,
										flat: true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "pt-3 border-t border-hairline flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-ink font-medium",
											children: "Estimated extra cost"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-serif text-ink tabular",
											children: ["KSh ", Math.round(hiddenTotal).toLocaleString()]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 text-[12px] text-mist leading-relaxed",
								children: "These fees are often taken off at the start, so the money that reaches you is less than the amount you asked for."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `card-surface p-5 sm:p-7 ${riskColor.bg} ${riskColor.border}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `eyebrow ${riskColor.text}`,
								children: "Recommendation"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: `font-serif text-[22px] mt-2 ${riskColor.text}`,
								children: "What to do next"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `mt-5 text-[14px] leading-relaxed ${riskColor.text} opacity-90`,
								children: recommendation
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 rounded-xl bg-paper/60 border border-hairline p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] uppercase tracking-wider text-mist",
									children: "If you still borrow it"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-[13px] text-ink leading-relaxed",
									children: "Spend it only on farming inputs you already have a buyer for. Keep one payment aside as a safety net before you plant."
								})]
							})
						]
					})
				]
			})
		]
	});
}
function Slider({ label, suffix, value, min, max, step, onChange, format }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-baseline justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
			className: "text-[12px] text-steel",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "font-serif text-[22px] text-ink tabular",
			children: [
				format(value),
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] text-mist tracking-wider uppercase ml-1",
					children: suffix
				})
			]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type: "range",
		min,
		max,
		step,
		value,
		onChange: (e) => onChange(Number(e.target.value)),
		className: "w-full mt-2 accent-teal"
	})] });
}
function Stat({ label, value, hero }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-paper p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[10.5px] uppercase tracking-wider text-mist",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: `font-serif tabular text-ink mt-1 ${hero ? "text-[36px]" : "text-[22px]"}`,
			children: value
		})]
	});
}
function BarRow({ label, value, color, max, highlight }) {
	const pct = Math.min(100, Math.max(0, value / max * 100));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between text-[12px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: highlight ? "font-medium text-ink" : "text-steel",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: `tabular font-medium ${highlight ? "text-ink" : "text-steel"}`,
			children: [value.toFixed(2), "%"]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-2 h-2.5 rounded-full bg-hairline overflow-hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `h-full rounded-full ${color} transition-all duration-500`,
			style: { width: `${pct}%` }
		})
	})] });
}
function CostRow({ label, value, flat }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-center justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "tabular text-ink",
			children: flat ? `KSh ${value.toLocaleString()}` : `KSh ${Math.round(value).toLocaleString()}`
		})]
	});
}
function useDebounced(value, delayMs) {
	const [debounced, setDebounced] = (0, import_react.useState)(value);
	(0, import_react.useEffect)(() => {
		const handle = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(handle);
	}, [value, delayMs]);
	return debounced;
}
var VERDICT_STYLE = {
	SAFE: {
		badge: "bg-green text-paper",
		text: "text-green-deep"
	},
	CAUTION: {
		badge: "bg-amber text-paper",
		text: "text-amber"
	},
	HIGH_RISK: {
		badge: "bg-rose text-paper",
		text: "text-rose"
	},
	AVOID: {
		badge: "bg-rose text-paper",
		text: "text-rose"
	}
};
function LiveVerdictCard({ monthlyRate, data, isLoading, isError }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "card-surface p-5 sm:p-7 bg-ink text-paper border-ink",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "eyebrow text-teal-glow",
				children: "Our official answer"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-serif text-[20px] mt-1",
				children: "The same answer we send by text"
			})] }), data && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${VERDICT_STYLE[data.risk_verdict].badge}`,
				children: data.risk_verdict.replace("_", " ")
			})]
		}), isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 text-[13px] text-paper/80",
			children: ["We could not check this loan right now. Please try again.", " "]
		}) : !data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-[13px] text-paper/60",
			children: isLoading ? "Checking…" : "Move the interest slider to check a loan."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid grid-cols-2 gap-px bg-ink-soft border border-ink-soft rounded-lg overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-ink p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] uppercase tracking-wider text-mist",
						children: "Cost per year"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-serif text-[24px] mt-1 tabular text-paper",
						children: [data.apr_percent, "%"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-ink p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] uppercase tracking-wider text-mist",
						children: "Central Bank rate"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-serif text-[24px] mt-1 tabular text-teal-glow",
						children: [data.cbk_rate_percent, "%"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-lg bg-paper/5 border border-paper/10 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[10px] uppercase tracking-wider text-mist",
					children: "The text message a farmer receives"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1.5 text-[13.5px] leading-relaxed text-paper",
					children: data.short_reply
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-[11.5px] text-mist",
				children: [
					data.comparison_phrase,
					" · checked at ",
					monthlyRate,
					"% per month",
					" "
				]
			})
		] })]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequireAuth, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoanRiskAnalyzer, {}) });
//#endregion
export { SplitComponent as component };
