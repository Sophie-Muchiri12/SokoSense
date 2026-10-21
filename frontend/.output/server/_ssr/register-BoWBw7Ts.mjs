import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { r as useAuth } from "./auth-7f7W3twp.mjs";
import { N as useNavigate, g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as labelCls, i as inputCls, n as PasswordInput, t as AuthShell } from "./login-BSeEY8T7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/register-BoWBw7Ts.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ROLES = [{
	id: "farmer",
	label: "Farmer",
	desc: "Market prices, sell timing, loan checks and crop advisory for my farm."
}, {
	id: "sacco",
	label: "SACCO / partner",
	desc: "Cooperative or lender account — includes the SACCO dashboard."
}];
function RegisterPage() {
	const { register } = useAuth();
	const navigate = useNavigate();
	const [name, setName] = (0, import_react.useState)("");
	const [phone, setPhone] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("farmer");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const submit = async (e) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			navigate({ to: (await register(name.trim(), phone.trim(), password, role)).role === "sacco" ? "/sacco" : "/market" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Registration failed — try again.");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthShell, {
		eyebrow: "Join SokoSense",
		title: "Create your",
		italic: "account.",
		sub: "One account for market intelligence, credit checks and advisory — on the web here, and the same phone number works on SMS/USSD.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: submit,
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: labelCls,
					htmlFor: "name",
					children: "Full name / organisation"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "name",
					className: inputCls,
					placeholder: "Amina Njoroge",
					autoComplete: "name",
					value: name,
					onChange: (e) => setName(e.target.value),
					required: true
				})] }),
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
					placeholder: "At least 6 characters",
					autoComplete: "new-password",
					value: password,
					onChange: (e) => setPassword(e.target.value),
					required: true
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: labelCls,
					children: "I am joining as"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-2",
					children: ROLES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: `flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${role === r.id ? "border-teal/60 bg-teal/5" : "border-hairline bg-paper hover:border-ink/30"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "radio",
							name: "role",
							value: r.id,
							checked: role === r.id,
							onChange: () => setRole(r.id),
							className: "mt-1 accent-teal"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-[13.5px] font-medium text-ink",
							children: r.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-[12px] text-steel mt-0.5",
							children: r.desc
						})] })]
					}, r.id))
				})] }),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[12.5px] text-rose-600",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					disabled: busy,
					className: "w-full rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50",
					children: busy ? "Creating account…" : "Create account"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-5 text-center text-[12.5px] text-steel",
			children: [
				"Already registered?",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					className: "text-teal font-medium hover:underline",
					children: "Log in"
				})
			]
		})]
	});
}
//#endregion
export { RegisterPage as component };
