import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { n as RequireAuth } from "./auth-guard-CUFQePul.mjs";
import { d as postUssd, t as USSD_SERVICE_CODE } from "./sokosense-api-BEmahCSf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ussd-DGHkqW0Q.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEMO_PHONE = "+254712345678";
function newSessionId() {
	return crypto.randomUUID();
}
function UssdPage() {
	const [sessionId, setSessionId] = (0, import_react.useState)(null);
	const [sessionText, setSessionText] = (0, import_react.useState)("");
	const [screenBody, setScreenBody] = (0, import_react.useState)(null);
	const [sessionOpen, setSessionOpen] = (0, import_react.useState)(false);
	const [currentInput, setCurrentInput] = (0, import_react.useState)("");
	const [steps, setSteps] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [connecting, setConnecting] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [lastLatencyMs, setLastLatencyMs] = (0, import_react.useState)(null);
	const inputRef = (0, import_react.useRef)(null);
	const reset = (0, import_react.useCallback)(() => {
		setSessionId(null);
		setSessionText("");
		setScreenBody(null);
		setSessionOpen(false);
		setCurrentInput("");
		setSteps([]);
		setLoading(false);
		setConnecting(false);
		setError(null);
		setLastLatencyMs(null);
	}, []);
	const invokeUssd = (0, import_react.useCallback)(async (text, inputLabel, overrideSessionId) => {
		const sid = overrideSessionId ?? sessionId ?? newSessionId();
		setSessionId(sid);
		setLoading(true);
		setError(null);
		const start = performance.now();
		try {
			const response = await postUssd({
				sessionId: sid,
				serviceCode: USSD_SERVICE_CODE,
				phoneNumber: DEMO_PHONE,
				text
			});
			const latencyMs = Math.round(performance.now() - start);
			setLastLatencyMs(latencyMs);
			setSessionText(text);
			setScreenBody(response.body);
			setSessionOpen(response.kind === "CON");
			setSteps((prev) => [...prev, {
				input: inputLabel,
				response,
				latencyMs
			}]);
			setCurrentInput("");
			return response;
		} catch (err) {
			setError(err instanceof Error ? err.message : "We could not connect right now. Please try again.");
			throw err;
		} finally {
			setLoading(false);
			setConnecting(false);
		}
	}, [sessionId]);
	const dial = async () => {
		if (loading || connecting) return;
		reset();
		setConnecting(true);
		await invokeUssd("", "(dialled)", newSessionId());
	};
	const sendInput = async () => {
		if (!sessionOpen || loading || !currentInput.trim()) return;
		await invokeUssd(sessionText === "" ? currentInput.trim() : `${sessionText}*${currentInput.trim()}`, currentInput.trim());
	};
	const appendDigit = (digit) => {
		if (!sessionOpen || loading) return;
		setCurrentInput((v) => (v + digit).slice(0, 12));
		inputRef.current?.focus();
	};
	const onKeyDown = (e) => {
		if (e.key === "Enter") sendInput();
	};
	const lastStep = steps[steps.length - 1];
	const sessionEnded = steps.length > 0 && lastStep?.response.kind === "END";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "max-w-3xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "eyebrow",
					children: ["On any basic phone · ", USSD_SERVICE_CODE]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "display mt-4 text-[40px] sm:text-[56px] text-ink leading-[1.02]",
					children: [
						"Dial the code.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "italic text-teal",
							children: "Get a real answer."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-5 text-[14px] leading-relaxed text-steel",
					children: "This is exactly what happens on a basic phone — no internet needed. Dial the code, choose from the simple menus, and get today's prices, selling advice and loan checks."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-12 grid lg:grid-cols-2 gap-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface p-5 sm:p-7 bg-ink text-paper flex flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow text-teal-glow",
							children: "A basic phone"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-serif text-[22px] text-paper mt-2",
							children: USSD_SERVICE_CODE
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `chip border-paper/20 ${sessionEnded ? "text-paper/70" : sessionOpen ? "border-teal-glow/40 text-teal-glow" : "text-paper/60"}`,
							children: connecting || loading ? "Connecting" : sessionEnded ? "Finished" : sessionOpen ? "Connected" : "Not started"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 mx-auto w-full max-w-[300px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-[32px] border-2 border-paper/15 bg-[#1a1f18] p-3 shadow-card",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-t-[20px] bg-[#0A1109] px-4 py-2 flex items-center justify-between text-[10px] text-paper/50",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Safaricom" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular",
									children: "21:14"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-b-[20px] bg-[#C5D2A8] text-[#102610] font-mono p-4 min-h-[280px] text-[12.5px] leading-[1.65] whitespace-pre-wrap flex flex-col",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1",
									children: connecting && !screenBody ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										"Connecting to SokoSense…",
										"\n\n",
										"Please wait…"
									] }) : screenBody ? screenBody : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										"Dial ",
										USSD_SERVICE_CODE,
										"\n\n",
										"Press the green Dial button below to start."
									] })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 border-t border-[#102610]/20 pt-2 text-[10.5px] text-[#102610]/70 flex justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reply" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Cancel" })]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-[10.5px] uppercase tracking-[0.14em] text-paper/50",
									children: "Type your choice"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										ref: inputRef,
										id: "ussd-input",
										value: currentInput,
										onChange: (e) => setCurrentInput(e.target.value),
										onKeyDown,
										disabled: !sessionOpen || loading,
										placeholder: sessionOpen ? "e.g. 1" : "Dial first",
										inputMode: "numeric",
										className: "flex-1 rounded-xl border border-paper/15 bg-[#0A1109] px-4 py-2.5 font-mono text-[14px] text-paper placeholder:text-paper/30 focus:border-teal-glow/50 focus:outline-none focus:ring-2 focus:ring-teal-glow/15 disabled:opacity-40"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										id: "ussd-send-btn",
										onClick: () => void sendInput(),
										disabled: !sessionOpen || loading || !currentInput.trim(),
										className: "rounded-xl bg-teal px-4 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
										children: "Send"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid grid-cols-3 gap-2",
									children: [
										"1",
										"2",
										"3",
										"4",
										"5",
										"6",
										"7",
										"8",
										"9",
										"*",
										"0",
										"#"
									].map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => key === "*" || key === "#" ? void 0 : appendDigit(key),
										disabled: !sessionOpen || loading || key === "*" || key === "#",
										className: "rounded-lg border border-paper/10 bg-[#0A1109] py-2.5 font-mono text-[15px] text-paper hover:border-teal-glow/30 hover:bg-teal/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors",
										children: key
									}, key))
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex flex-wrap items-center gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								id: "ussd-dial-btn",
								onClick: () => void dial(),
								disabled: loading || connecting,
								className: "rounded-full bg-teal px-5 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
								children: connecting ? "Connecting…" : `Dial ${USSD_SERVICE_CODE}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								id: "ussd-reset-btn",
								onClick: reset,
								disabled: loading && !screenBody,
								className: "rounded-full border border-paper/20 bg-transparent px-4 py-2.5 text-[12.5px] font-medium text-paper hover:border-paper/40 disabled:opacity-50 transition-colors",
								children: "Start again"
							}),
							lastLatencyMs !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "ml-auto text-[11px] text-paper/50 tabular",
								children: ["Last step took ", lastLatencyMs < 1e3 ? "under a second" : `${Math.round(lastLatencyMs / 100) / 10} seconds`]
							})
						]
					}),
					sessionText && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 text-[11px] text-paper/45 font-mono break-all",
						children: ["Your choices so far: ", sessionText || "(start)"]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface p-5 sm:p-7 flex flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "What happened"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-serif text-[22px] text-ink mt-2",
							children: "Step by step"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "chip",
							children: [
								steps.length,
								" step",
								steps.length === 1 ? "" : "s"
							]
						})]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex-1 rounded-xl border border-rose/30 bg-rose/4 p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] uppercase tracking-[0.14em] text-rose/80",
								children: "Request failed"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[13.5px] leading-relaxed text-ink",
								children: error
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-[12px] text-steel",
								children: ["Please try again shortly.", " "]
							})
						]
					}) : steps.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8 flex-1 rounded-xl border border-dashed border-fog bg-canvas/60 p-10 flex items-center justify-center text-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[13px] text-mist max-w-xs",
							children: [
								"Dial the shortcode to open a session, then reply with menu numbers (e.g.",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-steel",
									children: "1"
								}),
								" for English, then",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-steel",
									children: "1"
								}),
								" for market prices)."
							]
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-6 space-y-4 flex-1 overflow-y-auto max-h-[520px] pr-1",
						children: steps.map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-xl border border-hairline bg-canvas/40 p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[10.5px] uppercase tracking-[0.14em] text-mist",
									children: [
										"Step ",
										i + 1,
										" · you chose",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-ink",
											children: step.input
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${step.response.kind === "CON" ? "bg-teal/10 text-teal" : "bg-green-surface text-green-deep"}`,
										children: step.response.kind === "CON" ? "Menu continues" : "Finished"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] tabular text-steel",
										children: step.latencyMs < 1e3 ? "Under a second" : `${Math.round(step.latencyMs / 100) / 10}s`
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "mt-3 font-mono text-[12.5px] text-ink whitespace-pre-wrap leading-relaxed",
								children: step.response.body
							})]
						}, `${i}-${step.input}`))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 pt-5 border-t border-hairline",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] uppercase tracking-wider text-mist",
							children: "Quick path"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-[12.5px] text-steel leading-relaxed",
							children: [
								"Market price for maize in Nairobi: dial, then send",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "font-mono text-ink bg-canvas px-1 rounded",
									children: "1"
								}),
								",",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "font-mono text-ink bg-canvas px-1 rounded",
									children: "1"
								}),
								",",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "font-mono text-ink bg-canvas px-1 rounded",
									children: "1"
								}),
								",",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "font-mono text-ink bg-canvas px-1 rounded",
									children: "1"
								}),
								" ",
								"(English, then Market, then Maize, then Nairobi)."
							]
						})]
					})
				]
			})]
		})]
	});
}
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequireAuth, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UssdPage, {}) });
//#endregion
export { SplitComponent as component };
