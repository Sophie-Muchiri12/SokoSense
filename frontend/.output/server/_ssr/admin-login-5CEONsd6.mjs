import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { r as useAuth } from "./auth-7f7W3twp.mjs";
import { N as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as labelCls, i as inputCls, t as AuthShell } from "./login-BSeEY8T7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-login-5CEONsd6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminLoginPage() {
	const { adminLogin, isAdmin } = useAuth();
	const navigate = useNavigate();
	const [pin, setPin] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const submit = async (e) => {
		e.preventDefault();
		if (!/^\d{7}$/.test(pin)) {
			setError("Enter the 7-digit admin PIN.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await adminLogin(pin);
			navigate({ to: "/admin" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Admin login failed.");
			setPin("");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthShell, {
		eyebrow: "Operations · restricted",
		title: "Admin",
		italic: "access.",
		sub: "Enter the 7-digit admin PIN to open the operations dashboard. This is separate from farmer and SACCO accounts.",
		children: isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13.5px] text-steel",
				children: "You're already signed in as admin."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => navigate({ to: "/admin" }),
				className: "mt-4 w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft",
				children: "Open the admin portal"
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: submit,
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "pin",
					children: "Admin PIN (7 digits)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "pin",
					inputMode: "numeric",
					autoComplete: "one-time-code",
					maxLength: 7,
					className: `${inputCls} text-center font-mono text-[22px] tracking-[0.5em]`,
					placeholder: "•••••••",
					value: pin,
					onChange: (e) => setPin(e.target.value.replace(/\D/g, "")),
					required: true
				})] }),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[12.5px] text-rose-600 text-center",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					disabled: busy,
					className: "w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50",
					children: busy ? "Checking PIN…" : "Enter admin portal"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-center text-[11.5px] text-mist",
					children: "Attempts are rate-limited. The PIN is configured server-side and never sent to your browser."
				})
			]
		})
	});
}
//#endregion
export { AdminLoginPage as component };
