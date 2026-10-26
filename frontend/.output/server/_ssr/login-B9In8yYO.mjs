import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { r as useAuth } from "./auth-7f7W3twp.mjs";
import { N as useNavigate, g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as LogIn, m as EyeOff, p as Eye } from "../_libs/lucide-react.mjs";
import { a as labelCls, i as inputCls, r as Route } from "./login-BSeEY8T7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-B9In8yYO.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AuthShell({ eyebrow, title, italic, sub, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-[480px] min-w-0 px-5 sm:px-6 pt-14 sm:pt-20 pb-14",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "eyebrow text-center",
				children: eyebrow
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				className: "display mt-4 text-center text-[38px] sm:text-[44px] text-ink",
				children: [
					title,
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "italic text-teal",
						children: italic
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-center text-[13.5px] leading-relaxed text-steel",
				children: sub
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "card-surface mt-8 p-6 sm:p-8",
				children
			})
		]
	});
}
/** Password field with an eye toggle so users can check what they typed. */
function PasswordInput(props) {
	const [showPassword, setShowPassword] = (0, import_react.useState)(false);
	const label = showPassword ? "Hide password" : "Show password";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			...props,
			type: showPassword ? "text" : "password",
			className: `${inputCls} pr-11 ${props.className ?? ""}`
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => setShowPassword((v) => !v),
			"aria-label": label,
			"aria-pressed": showPassword,
			title: label,
			className: "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-mist transition hover:text-ink focus:outline-none focus-visible:text-teal",
			children: showPassword ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, {
				className: "h-[18px] w-[18px]",
				"aria-hidden": "true"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, {
				className: "h-[18px] w-[18px]",
				"aria-hidden": "true"
			})
		})]
	});
}
function LoginPage() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
	const [phone, setPhone] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const submit = async (e) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const user = await login(phone.trim(), password);
			navigate({ to: redirect ?? (user.role === "sacco" ? "/sacco" : "/market") });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed — try again.");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthShell, {
		eyebrow: "Welcome back",
		title: "Log in to",
		italic: "SokoSense.",
		sub: "Farmers and SACCO partners — sign in with your phone number to reach market prices, loans, timing and advisory.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: submit,
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "phone",
					children: "Phone number"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "phone",
					className: inputCls,
					placeholder: "0712 345 678",
					autoComplete: "tel",
					value: phone,
					onChange: (e) => setPhone(e.target.value),
					required: true
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "password",
					children: "Password"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordInput, {
					id: "password",
					placeholder: "Your password",
					autoComplete: "current-password",
					value: password,
					onChange: (e) => setPassword(e.target.value),
					required: true
				})] }),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[12.5px] text-rose-600",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					disabled: busy,
					className: "w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50",
					children: busy ? "Signing in…" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Log in ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogIn, {
						className: "ml-1.5 inline h-4 w-4 align-[-2px]",
						"aria-hidden": "true"
					})] })
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-5 text-center text-[12.5px] text-steel",
			children: [
				"New to SokoSense?",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/register",
					className: "text-teal font-medium hover:underline",
					children: "Create an account"
				})
			]
		})]
	});
}
//#endregion
export { AuthShell, PasswordInput, LoginPage as component };
