import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as EyeOff, p as Eye } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-BSeEY8T7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var $$splitComponentImporter = () => import("./login-B9In8yYO.mjs");
var Route = createFileRoute("/login")({
	validateSearch: (s) => ({ redirect: typeof s.redirect === "string" ? s.redirect : void 0 }),
	head: () => ({ meta: [{ title: "Log in — SokoSense" }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
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
var inputCls = "w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-mist focus:outline-none focus:border-teal/60";
var labelCls = "block text-[11px] uppercase tracking-wider text-mist mb-1.5";
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
//#endregion
export { labelCls as a, inputCls as i, PasswordInput as n, Route as r, AuthShell as t };
