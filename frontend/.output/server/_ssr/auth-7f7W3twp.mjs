import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-7f7W3twp.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Client auth state — user sessions (farmer / SACCO) and the admin session.
*
* Tokens are JWTs from the FastAPI backend (`/api/auth/*`), kept in
* localStorage. The admin session is separate: it comes from the 7-digit
* ADMIN_PIN (footer → /admin-login) and unlocks only /admin.
*/
var USER_TOKEN_KEY = "sokosense_token";
var USER_KEY = "sokosense_user";
var ADMIN_TOKEN_KEY = "sokosense_admin_token";
function getUserToken() {
	return typeof window === "undefined" ? null : localStorage.getItem(USER_TOKEN_KEY);
}
function getAdminToken() {
	return typeof window === "undefined" ? null : localStorage.getItem(ADMIN_TOKEN_KEY);
}
/** Token for an API path: admin endpoints use the admin session. */
function getTokenForPath(path) {
	if (path.startsWith("/api/admin") || path.startsWith("/api/logs")) return getAdminToken() ?? getUserToken();
	return getUserToken();
}
async function authFetch(path, body) {
	const res = await fetch(`${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		let detail = res.statusText;
		try {
			const data = await res.json();
			if (data.detail) detail = data.detail;
		} catch {}
		throw new Error(detail);
	}
	return res.json();
}
var AuthContext = (0, import_react.createContext)(null);
function AuthProvider({ children }) {
	const [user, setUser] = (0, import_react.useState)(null);
	const [isAdmin, setIsAdmin] = (0, import_react.useState)(false);
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			const raw = localStorage.getItem(USER_KEY);
			if (raw) setUser(JSON.parse(raw));
			setIsAdmin(Boolean(localStorage.getItem(ADMIN_TOKEN_KEY)));
		} catch {}
		setReady(true);
	}, []);
	const login = (0, import_react.useCallback)(async (phone, password) => {
		const r = await authFetch("/api/auth/login", {
			phone,
			password
		});
		localStorage.setItem(USER_TOKEN_KEY, r.access_token);
		localStorage.setItem(USER_KEY, JSON.stringify(r.user));
		setUser(r.user);
		return r.user;
	}, []);
	const register = (0, import_react.useCallback)(async (name, phone, password, role) => {
		const r = await authFetch("/api/auth/register", {
			name,
			phone,
			password,
			role
		});
		localStorage.setItem(USER_TOKEN_KEY, r.access_token);
		localStorage.setItem(USER_KEY, JSON.stringify(r.user));
		setUser(r.user);
		return r.user;
	}, []);
	const adminLogin = (0, import_react.useCallback)(async (pin) => {
		const r = await authFetch("/api/auth/admin-login", { pin });
		localStorage.setItem(ADMIN_TOKEN_KEY, r.access_token);
		setIsAdmin(true);
	}, []);
	const logout = (0, import_react.useCallback)(() => {
		localStorage.removeItem(USER_TOKEN_KEY);
		localStorage.removeItem(USER_KEY);
		setUser(null);
	}, []);
	const adminLogout = (0, import_react.useCallback)(() => {
		localStorage.removeItem(ADMIN_TOKEN_KEY);
		setIsAdmin(false);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthContext.Provider, {
		value: {
			user,
			ready,
			isAdmin,
			login,
			register,
			adminLogin,
			logout,
			adminLogout
		},
		children
	});
}
function useAuth() {
	const ctx = (0, import_react.useContext)(AuthContext);
	if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
	return ctx;
}
//#endregion
export { getTokenForPath as n, useAuth as r, AuthProvider as t };
