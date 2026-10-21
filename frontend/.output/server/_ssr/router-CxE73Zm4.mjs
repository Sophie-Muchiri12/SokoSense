import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, n as QueryClientProvider, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { r as useAuth, t as AuthProvider } from "./auth-7f7W3twp.mjs";
import { P as useRouter, c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, l as useRouterState, m as createFileRoute, p as lazyRouteComponent, s as Scripts } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Route$12 } from "./market-CsderNyk.mjs";
import { y as ArrowRight } from "../_libs/lucide-react.mjs";
import { r as Route$13 } from "./login-BSeEY8T7.mjs";
import { n as QueryClient } from "../_libs/tanstack__query-core.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-CxE73Zm4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-RojMU_Db.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
var markSizes = {
	sm: "h-7 w-7",
	md: "h-10 w-10",
	lg: "h-16 w-16",
	xl: "h-24 w-24"
};
var iconSizes = {
	sm: "h-4 w-4",
	md: "h-5 w-5",
	lg: "h-8 w-8",
	xl: "h-12 w-12"
};
function SokoSenseLogoMark({ className = "", size = "sm", variant = "boxed", animate = false }) {
	const isPlain = variant === "plain";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `relative inline-flex items-center justify-center ${isPlain ? "text-teal" : "rounded-md bg-ink text-paper"} ${markSizes[size]} ${animate ? "splash-logo-float" : ""} ${className}`,
		children: [isPlain && animate && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "absolute inset-0 rounded-full bg-teal/10 splash-glow-pulse",
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 24 24",
			className: `relative ${iconSizes[size]} ${animate ? "splash-logo-draw" : ""}`,
			fill: "none",
			stroke: "currentColor",
			strokeWidth: isPlain ? 2 : 1.8,
			strokeLinecap: "round",
			"aria-hidden": "true",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				className: animate ? "splash-path-draw" : void 0,
				style: animate ? {
					strokeDasharray: 32,
					strokeDashoffset: 32
				} : void 0,
				d: "M4 18c4-10 12-10 16 0"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				className: animate ? "splash-path-draw splash-path-draw-delay" : void 0,
				style: animate ? {
					strokeDasharray: 18,
					strokeDashoffset: 18
				} : void 0,
				d: "M12 4v14"
			})]
		})]
	});
}
function SokoSenseLogo({ size = "sm", showWordmark = true, className = "", variant = "boxed", animate = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `inline-flex items-center gap-2.5 ${className}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SokoSenseLogoMark, {
			size,
			variant,
			animate
		}), showWordmark && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: `font-serif leading-none text-ink ${{
				sm: "text-[22px]",
				md: "text-[28px]",
				lg: "text-[40px]",
				xl: "text-[56px]"
			}[size]} ${animate ? "splash-rise splash-rise-delay-2" : ""}`,
			children: ["Soko", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-teal",
				children: "Sense"
			})]
		})]
	});
}
/**
* Account tools — these live inside the signed-in user's account menu,
* never as loose links on the public homepage/header.
* `roles` restricts an item (SACCO Dashboard is SACCO-only).
*/
var accountNav = [
	{
		to: "/simulator",
		label: "SMS Simulator"
	},
	{
		to: "/market",
		label: "Market Map"
	},
	{
		to: "/timing",
		label: "Sell Timing"
	},
	{
		to: "/advisory",
		label: "Advisory"
	},
	{
		to: "/loans",
		label: "Loan Analyzer"
	},
	{
		to: "/sacco",
		label: "SACCO Dashboard",
		roles: ["sacco"]
	},
	{
		to: "/ussd",
		label: "USSD"
	}
];
function SiteHeader() {
	const { user, logout } = useAuth();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [accountOpen, setAccountOpen] = (0, import_react.useState)(false);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const accountRef = (0, import_react.useRef)(null);
	const tools = accountNav.filter((item) => !("roles" in item) || user && item.roles.includes(user.role));
	(0, import_react.useEffect)(() => {
		setOpen(false);
		setAccountOpen(false);
	}, [pathname]);
	(0, import_react.useEffect)(() => {
		if (!open && !accountOpen) return;
		const onKey = (e) => {
			if (e.key === "Escape") {
				setOpen(false);
				setAccountOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, accountOpen]);
	(0, import_react.useEffect)(() => {
		if (!accountOpen) return;
		const onClick = (e) => {
			if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
		};
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, [accountOpen]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "flex shrink-0 items-center gap-2.5 group",
					"aria-label": "SokoSense home",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SokoSenseLogo, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "hidden lg:flex items-center gap-2",
					children: user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						ref: accountRef,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setAccountOpen((v) => !v),
							"aria-expanded": accountOpen,
							"aria-haspopup": "menu",
							className: "flex items-center gap-2.5 rounded-full border border-hairline bg-paper py-1.5 pl-1.5 pr-3.5 hover:border-ink/40 transition",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal text-paper text-[12px] font-semibold uppercase",
									children: user.name.trim().charAt(0) || "?"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-left leading-tight",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block text-[12.5px] font-medium text-ink",
										children: user.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "block text-[10.5px] capitalize text-mist",
										children: [user.role, " account"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
									width: "12",
									height: "12",
									viewBox: "0 0 24 24",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2",
									className: `text-mist transition ${accountOpen ? "rotate-180" : ""}`,
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 9 6 6 6-6" })
								})
							]
						}), accountOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "menu",
							className: "absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-hairline bg-paper shadow-card",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border-b border-hairline px-4 py-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[13px] font-medium text-ink",
										children: user.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-[11.5px] text-mist mt-0.5",
										children: [
											user.phone,
											" · ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "capitalize",
												children: user.role
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
									"aria-label": "Account",
									className: "py-1.5",
									children: tools.map((item) => {
										const active = pathname.startsWith(item.to);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
											to: item.to,
											role: "menuitem",
											className: `flex items-center justify-between px-4 py-2.5 text-[13px] transition ${active ? "bg-canvas font-medium text-ink" : "text-steel hover:bg-canvas hover:text-ink"}`,
											children: [item.label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, {
												className: "h-3.5 w-3.5 text-mist",
												"aria-hidden": "true"
											})]
										}, item.to);
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border-t border-hairline py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: logout,
										className: "w-full px-4 py-2.5 text-left text-[13px] text-rose-600 hover:bg-rose-50 transition",
										children: "Log out"
									})
								})
							]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						className: "text-[13px] font-medium text-steel hover:text-ink",
						children: "Log in"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/register",
						className: "rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:bg-ink-soft",
						children: "Create account"
					})] })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": open ? "Close menu" : "Open menu",
					"aria-expanded": open,
					"aria-controls": "mobile-nav",
					onClick: () => setOpen((v) => !v),
					className: "lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper text-ink",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
						width: "16",
						height: "16",
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.8",
						"aria-hidden": "true",
						children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 6l12 12M18 6l-12 12" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 7h16M4 12h16M4 17h16" })
					})
				})
			]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			id: "mobile-nav",
			className: "lg:hidden border-t border-hairline bg-paper",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				"aria-label": "Mobile",
				className: "mx-auto max-w-[1240px] px-5 py-3 flex flex-col gap-0.5",
				children: user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13.5px] font-medium text-ink",
							children: user.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11.5px] text-mist mt-0.5",
							children: [
								user.phone,
								" · ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "capitalize",
									children: [user.role, " account"]
								})
							]
						})]
					}),
					tools.map((item) => {
						const active = pathname.startsWith(item.to);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: item.to,
							className: `rounded-lg px-3 py-2.5 text-[14px] font-medium ${active ? "bg-canvas text-ink" : "text-steel hover:bg-canvas hover:text-ink"}`,
							children: item.label
						}, item.to);
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: logout,
						className: "mt-2 rounded-full border border-hairline bg-paper px-4 py-2.5 text-center text-[13px] font-medium text-rose-600",
						children: "Log out"
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					className: "mt-1 rounded-full border border-ink/15 bg-paper px-4 py-2.5 text-center text-[13px] font-medium text-ink",
					children: "Log in"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/register",
					className: "mt-1 rounded-full bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-paper hover:bg-ink-soft",
					children: "Create account"
				})] })
			})
		})]
	});
}
function SiteFooter() {
	const { user } = useAuth();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
		className: "border-t border-hairline bg-paper mt-16 sm:mt-24",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-[1240px] px-5 sm:px-6 py-12 sm:py-16 grid gap-10 sm:gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink text-paper",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
								viewBox: "0 0 24 24",
								className: "h-4 w-4",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.8",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 18c4-10 12-10 16 0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 4v14" })]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-serif text-[22px] text-ink",
							children: ["Soko", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-teal",
								children: "Sense"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 max-w-sm text-sm leading-relaxed text-steel",
						children: "Today's market prices, selling advice and honest loan checks for farmers and SACCOs across East Africa — by text message, on any phone."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-6 text-[11px] uppercase tracking-[0.14em] text-mist",
						children: "Nairobi · Kampala · Kigali"
					})
				] }),
				user && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FooterCol, {
					title: "My account",
					links: [
						{
							to: "/simulator",
							label: "SMS Simulator"
						},
						{
							to: "/market",
							label: "Market Map"
						},
						{
							to: "/timing",
							label: "Sell Timing"
						},
						{
							to: "/advisory",
							label: "Advisory"
						},
						{
							to: "/loans",
							label: "Loan Analyzer"
						},
						...user.role === "sacco" ? [{
							to: "/sacco",
							label: "SACCO Dashboard"
						}] : [],
						{
							to: "/ussd",
							label: "USSD"
						}
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FooterCol, {
					title: "Partners",
					links: [
						{
							to: "/sacco",
							label: "SACCO Dashboard"
						},
						{
							to: "/sacco",
							label: "Cooperatives"
						},
						{
							to: "/sacco",
							label: "Agribusiness"
						},
						{
							to: "/sacco",
							label: "NGOs"
						}
					]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FooterCol, {
					title: "Company",
					links: [
						{
							to: "/",
							label: "About"
						},
						{
							to: "/",
							label: "Research"
						},
						{
							to: "/",
							label: "Press"
						},
						{
							to: "/",
							label: "Contact"
						}
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-t border-hairline",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-[1240px] px-5 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-steel",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"© ",
					(/* @__PURE__ */ new Date()).getFullYear(),
					" SokoSense Intelligence Ltd. All rights reserved."
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Privacy" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Terms" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Data ethics" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/admin-login",
							className: "rounded-full border border-ink/20 bg-paper px-4 py-1.5 text-[12px] font-medium text-ink hover:border-ink/50",
							children: "Admin"
						})
					]
				})]
			})
		})]
	});
}
function FooterCol({ title, links }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "eyebrow",
		children: title
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mt-4 space-y-2.5",
		children: links.map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: l.to,
			className: "text-[13px] text-ink/80 hover:text-teal",
			children: l.label
		}) }, i))
	})] });
}
var STORAGE_KEY = "sokosense-welcome-seen";
var AUTO_DISMISS_MS = 4500;
function SplashScreen() {
	const [visible, setVisible] = (0, import_react.useState)(false);
	const [exiting, setExiting] = (0, import_react.useState)(false);
	const [entered, setEntered] = (0, import_react.useState)(false);
	const dismiss = (0, import_react.useCallback)(() => {
		sessionStorage.setItem(STORAGE_KEY, "1");
		setExiting(true);
		window.setTimeout(() => setVisible(false), 600);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!sessionStorage.getItem(STORAGE_KEY)) setVisible(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!visible) return;
		const frame = window.requestAnimationFrame(() => setEntered(true));
		const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
		return () => {
			window.cancelAnimationFrame(frame);
			window.clearTimeout(timer);
		};
	}, [visible, dismiss]);
	if (!visible) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `fixed inset-0 z-100 flex items-center justify-center overflow-hidden transition-opacity duration-600 ${exiting ? "pointer-events-none opacity-0" : "opacity-100"}`,
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "Welcome to SokoSense",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 bg-canvas",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "splash-bg-orb splash-bg-orb-a",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "splash-bg-orb splash-bg-orb-b",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `relative mx-auto max-w-lg px-6 text-center transition-all duration-600 ${exiting ? "translate-y-3 scale-[0.97] opacity-0" : entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.98] opacity-0"}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-center splash-rise",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SokoSenseLogo, {
							size: "xl",
							variant: "plain",
							animate: true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow mt-10 splash-rise splash-rise-delay-1",
						children: "Welcome"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "display mt-4 text-[36px] sm:text-[44px] text-ink splash-rise splash-rise-delay-2",
						children: [
							"Agricultural intelligence",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "italic text-teal",
								children: "for East Africa."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-steel splash-rise splash-rise-delay-3",
						children: "Real-time market prices, AI advisory and credit scoring — built for farmers, SACCOs and agribusinesses across the region."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: dismiss,
						className: "mt-10 rounded-full bg-teal px-8 py-3.5 text-[13px] font-medium text-paper transition hover:bg-teal-soft splash-rise splash-rise-delay-4",
						children: "Enter SokoSense"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-6 text-[11px] text-mist splash-rise splash-rise-delay-5",
						children: "Markets · Credit · Advice · at the speed of SMS"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-x-0 bottom-0 px-6 pb-8",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto h-0.5 max-w-xs overflow-hidden rounded-full bg-hairline",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full origin-left rounded-full bg-teal splash-progress-bar" })
				})
			})
		]
	});
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-canvas px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "404 · Off the map"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "display mt-4 text-6xl text-ink",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-sm text-steel",
					children: "The signal didn't reach this route. Let's get you back to the network."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft",
						children: "Return to SokoSense"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-canvas px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "display text-3xl text-ink",
					children: "Connection interrupted"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-steel",
					children: "The intelligence engine couldn't render this page. Try reconnecting."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-teal-soft",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$11 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "SokoSense — Agricultural Intelligence for East Africa" },
			{
				name: "description",
				content: "Today's market prices, farming advice and honest loan checks for farmers and SACCOs — by text message on any phone."
			},
			{
				property: "og:title",
				content: "SokoSense — Agricultural Intelligence for East Africa"
			},
			{
				property: "og:description",
				content: "Today's market prices, farming advice and honest loan checks for farmers and SACCOs — by text message on any phone."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			{
				name: "theme-color",
				content: "#0D9280"
			}
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml"
			},
			{
				rel: "apple-touch-icon",
				href: "/favicon.svg"
			},
			{
				rel: "manifest",
				href: "/site.webmanifest"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$11.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SplashScreen, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-h-screen bg-canvas text-ink flex flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "flex-1 min-w-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
			]
		})] })
	});
}
var $$splitComponentImporter$9 = () => import("./ussd-DGHkqW0Q.mjs");
var Route$10 = createFileRoute("/ussd")({
	head: () => ({ meta: [
		{ title: "USSD Simulator — SokoSense" },
		{
			name: "description",
			content: "Try the phone menu farmers use: dial the code, choose from simple menus, and get real prices and advice."
		},
		{
			property: "og:title",
			content: "USSD Simulator — SokoSense"
		},
		{
			property: "og:description",
			content: "See exactly what a farmer sees on a basic phone — simple menus, real answers."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./timing-D5iLM5Op.mjs");
var Route$9 = createFileRoute("/timing")({
	head: () => ({ meta: [{ title: "Sell Timing — SokoSense" }, {
		name: "description",
		content: "Should you sell today or wait a few days? We look at how prices have been moving and tell you plainly."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var BASE_URL = "";
var Route$8 = createFileRoute("/sitemap.xml")({ server: { handlers: { GET: async () => {
	const xml = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
		...[
			"/",
			"/market",
			"/loans",
			"/sacco",
			"/ussd",
			"/admin"
		].map((p) => `  <url><loc>${BASE_URL}${p}</loc><changefreq>weekly</changefreq></url>`),
		`</urlset>`
	].join("\n");
	return new Response(xml, { headers: {
		"Content-Type": "application/xml",
		"Cache-Control": "public, max-age=3600"
	} });
} } } });
var $$splitComponentImporter$7 = () => import("./simulator-JVzE6lY-.mjs");
var Route$7 = createFileRoute("/simulator")({
	head: () => ({ meta: [
		{ title: "Try It by Text Message — SokoSense" },
		{
			name: "description",
			content: "Send a message the way a farmer would, and see the reply we would text back."
		},
		{
			property: "og:title",
			content: "SMS Intelligence Simulator — SokoSense"
		},
		{
			property: "og:description",
			content: "Try SokoSense by text message and see our reply, step by step."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
/** Map agent type → badge colours */
var $$splitComponentImporter$6 = () => import("./sacco-DX9e95cD.mjs");
var Route$6 = createFileRoute("/sacco")({
	head: () => ({ meta: [
		{ title: "SACCO Partner Dashboard — SokoSense" },
		{
			name: "description",
			content: "For SACCO managers: see what farmers are asking, where they are, and what we advised them — all in one place."
		},
		{
			property: "og:title",
			content: "SACCO Partner Dashboard — SokoSense"
		},
		{
			property: "og:description",
			content: "One simple page for SACCOs and farming partners to follow farmers and prices."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./register-BoWBw7Ts.mjs");
var Route$5 = createFileRoute("/register")({
	head: () => ({ meta: [{ title: "Create account — SokoSense" }] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./loans-D0e8f7El.mjs");
var Route$4 = createFileRoute("/loans")({
	head: () => ({ meta: [
		{ title: "Is This Loan Fair? — SokoSense" },
		{
			name: "description",
			content: "Enter a loan offer and see what it will really cost you — and whether it is fair."
		},
		{
			property: "og:title",
			content: "Loan Risk Analyzer — SokoSense"
		},
		{
			property: "og:description",
			content: "A simple loan check for farmers and SACCOs: the true cost, in plain language."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./advisory-V2OMjDFS.mjs");
var Route$3 = createFileRoute("/advisory")({
	head: () => ({ meta: [{ title: "Crop Advisory — SokoSense" }, {
		name: "description",
		content: "Ask about pests, disease, planting and caring for your crops — and get clear, trusted answers."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./admin-login-5CEONsd6.mjs");
var Route$2 = createFileRoute("/admin-login")({
	head: () => ({ meta: [{ title: "Admin access — SokoSense" }] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./admin-DlVsKOEg.mjs");
var Route$1 = createFileRoute("/admin")({
	head: () => ({ meta: [
		{ title: "Operations Dashboard — SokoSense" },
		{
			name: "description",
			content: "System health, API latency, engine status and live request logs for the SokoSense intelligence platform."
		},
		{
			property: "og:title",
			content: "Operations Dashboard — SokoSense"
		},
		{
			property: "og:description",
			content: "Internal operations console for engine health, latency and request logs."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./routes-BQlgKmqv.mjs");
var Route = createFileRoute("/")({
	head: () => ({ meta: [
		{ title: "SokoSense — Better prices and good advice for farmers" },
		{
			name: "description",
			content: "Check today's market prices, get farming advice and fair-loan checks by text message — on any phone. Made for farmers, SACCOs and farmer groups."
		},
		{
			property: "og:title",
			content: "SokoSense — Better prices and good advice for farmers"
		},
		{
			property: "og:description",
			content: "Today's market prices, farming advice and fair-loan checks for farmers and their SACCOs."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
/** Pre-seeded demo prompts — click any to fire a real agent call */
/** Homepage-only nav: jumps to the sections on this page, in plain words. */
var UssdRoute = Route$10.update({
	id: "/ussd",
	path: "/ussd",
	getParentRoute: () => Route$11
});
var TimingRoute = Route$9.update({
	id: "/timing",
	path: "/timing",
	getParentRoute: () => Route$11
});
var SitemapDotxmlRoute = Route$8.update({
	id: "/sitemap.xml",
	path: "/sitemap.xml",
	getParentRoute: () => Route$11
});
var SimulatorRoute = Route$7.update({
	id: "/simulator",
	path: "/simulator",
	getParentRoute: () => Route$11
});
var SaccoRoute = Route$6.update({
	id: "/sacco",
	path: "/sacco",
	getParentRoute: () => Route$11
});
var RegisterRoute = Route$5.update({
	id: "/register",
	path: "/register",
	getParentRoute: () => Route$11
});
var MarketRoute = Route$12.update({
	id: "/market",
	path: "/market",
	getParentRoute: () => Route$11
});
var LoginRoute = Route$13.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$11
});
var LoansRoute = Route$4.update({
	id: "/loans",
	path: "/loans",
	getParentRoute: () => Route$11
});
var AdvisoryRoute = Route$3.update({
	id: "/advisory",
	path: "/advisory",
	getParentRoute: () => Route$11
});
var AdminLoginRoute = Route$2.update({
	id: "/admin-login",
	path: "/admin-login",
	getParentRoute: () => Route$11
});
var AdminRoute = Route$1.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$11
});
var rootRouteChildren = {
	IndexRoute: Route.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$11
	}),
	AdminRoute,
	AdminLoginRoute,
	AdvisoryRoute,
	LoansRoute,
	LoginRoute,
	MarketRoute,
	RegisterRoute,
	SaccoRoute,
	SimulatorRoute,
	SitemapDotxmlRoute,
	TimingRoute,
	UssdRoute
};
var routeTree = Route$11._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
