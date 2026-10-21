import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { r as useAuth } from "./auth-7f7W3twp.mjs";
import { N as useNavigate, g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-guard-CUFQePul.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Route guards — task pages render only for the right identity. */
function GuardShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mx-auto max-w-[560px] px-5 sm:px-6 pt-16 pb-14 text-center",
		children
	});
}
/** Requires a signed-in user (farmer or SACCO). Optionally restricts roles. */
function RequireAuth({ children, roles }) {
	const { user, ready } = useAuth();
	const navigate = useNavigate();
	(0, import_react.useEffect)(() => {
		if (ready && !user) navigate({
			to: "/login",
			search: { redirect: window.location.pathname }
		});
	}, [
		ready,
		user,
		navigate
	]);
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuardShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "text-[13px] text-steel flex items-center justify-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-teal animate-pulse" }), " Checking your session…"]
	}) });
	if (!user) return null;
	if (roles && !roles.includes(user.role)) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GuardShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "eyebrow",
			children: "Restricted"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
			className: "display mt-3 text-[34px] text-ink",
			children: [
				"This area is for ",
				roles.join(" / "),
				" accounts"
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 text-[13.5px] text-steel leading-relaxed",
			children: [
				"You're signed in as ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-ink font-medium",
					children: user.name
				}),
				" (",
				user.role,
				"). Switch accounts to continue."
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/market",
			className: "inline-flex mt-6 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-paper hover:bg-ink-soft",
			children: "Go to the market map"
		})
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/** Requires the admin session (7-digit PIN via /admin-login). */
function RequireAdmin({ children }) {
	const { isAdmin, ready } = useAuth();
	const navigate = useNavigate();
	(0, import_react.useEffect)(() => {
		if (ready && !isAdmin) navigate({ to: "/admin-login" });
	}, [
		ready,
		isAdmin,
		navigate
	]);
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuardShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "text-[13px] text-steel flex items-center justify-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-teal animate-pulse" }), " Checking admin session…"]
	}) });
	if (!isAdmin) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
//#endregion
export { RequireAuth as n, RequireAdmin as t };
