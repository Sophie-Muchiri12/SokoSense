globalThis.__nitro_main__ = import.meta.url;
import { a as toEventHandler, c as NodeResponse, i as defineLazyEventHandler, l as serve, n as HTTPError, r as defineHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/robots.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"17-ZZkCVrbr4BSdjt/K43J0tq8+Qq4\"",
		"mtime": "2026-10-21T12:40:39.753Z",
		"size": 23,
		"path": "../public/robots.txt"
	},
	"/site.webmanifest": {
		"type": "application/manifest+json",
		"etag": "\"13c-63MU9ZmMh78DjtlXxxnQKALT53s\"",
		"mtime": "2026-10-21T12:40:39.753Z",
		"size": 316,
		"path": "../public/site.webmanifest"
	},
	"/assets/admin-BdPYX1E_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"34f3-ZsDvmZsHMDhlV+OkS/hnez8hIcg\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 13555,
		"path": "../public/assets/admin-BdPYX1E_.js"
	},
	"/assets/admin-login-iT0SZDtg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"811-KfUCV1vmwPCFP7NCY/56t0XOsX8\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 2065,
		"path": "../public/assets/admin-login-iT0SZDtg.js"
	},
	"/assets/advisory-DzZHCph1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10ab-hdzNbqqNN0rcIzkJo5751XWGjoU\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 4267,
		"path": "../public/assets/advisory-DzZHCph1.js"
	},
	"/assets/auth-BdY23c8a.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6f96-WZJDE3mfzLuy4pJ/JDPTxjjF+uE\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 28566,
		"path": "../public/assets/auth-BdY23c8a.js"
	},
	"/favicon.svg": {
		"type": "image/svg+xml",
		"etag": "\"14c-PMIOS1ABoFxCRxlC3p0yH4h0DAM\"",
		"mtime": "2026-10-21T12:40:39.752Z",
		"size": 332,
		"path": "../public/favicon.svg"
	},
	"/assets/auth-guard-BYkH_nsH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72c-MqVESrxQ2juXPrBHpt7iWnOu9Os\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 1836,
		"path": "../public/assets/auth-guard-BYkH_nsH.js"
	},
	"/assets/index-ybZ1DdxA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"51455-ZeCzt/UmLoEyg6jA1ZBfIFZPIVE\"",
		"mtime": "2026-10-21T12:40:37.031Z",
		"size": 332885,
		"path": "../public/assets/index-ybZ1DdxA.js"
	},
	"/assets/jsx-runtime-BHz_hoGM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1edb-yHkFp40Xr8eWRIQ4n1jjobd9u08\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 7899,
		"path": "../public/assets/jsx-runtime-BHz_hoGM.js"
	},
	"/assets/leaflet-market-map-DCSsSUQ2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1315-FV6DSfzQZ/CeVKZ+O1kAe5j5gdg\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 4885,
		"path": "../public/assets/leaflet-market-map-DCSsSUQ2.js"
	},
	"/assets/leaflet-src-DJ6ctPOt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455d-3LDrr7tsPe+xQpXfT5wsQQkatlo\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 148829,
		"path": "../public/assets/leaflet-src-DJ6ctPOt.js"
	},
	"/assets/loans-UhPwikCx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5de4-3QDbP8Wt4zCOnDaOdNX8O2Ib8RA\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 24036,
		"path": "../public/assets/loans-UhPwikCx.js"
	},
	"/assets/login-_P-LAyrJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d63-5/cMK0dxCEh7wwtpBCYeVlARwpo\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 3427,
		"path": "../public/assets/login-_P-LAyrJ.js"
	},
	"/assets/market-BCFdIwXc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"53d0-TbjnZwi22+wvNqws+BTtLC4jaoA\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 21456,
		"path": "../public/assets/market-BCFdIwXc.js"
	},
	"/assets/register-BEDJnsQy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c35-wc6FRY5HPdPEFGNfedm3EYznWr4\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 3125,
		"path": "../public/assets/register-BEDJnsQy.js"
	},
	"/assets/routes-DbnGEBFv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6c20-pPdLIiKdQBnohCY845zh1ablTxE\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 27680,
		"path": "../public/assets/routes-DbnGEBFv.js"
	},
	"/assets/rolldown-runtime-Bh1tDfsg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"237-RWMfWL++Hyx/oSoFmTJgBJkEveY\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 567,
		"path": "../public/assets/rolldown-runtime-Bh1tDfsg.js"
	},
	"/assets/sokosense-api-ibtfKK8i.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7fe-rteCHzYru6sP6RRRNncbfjnQSp8\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 2046,
		"path": "../public/assets/sokosense-api-ibtfKK8i.js"
	},
	"/assets/simulator-DdXyRcSa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2d4f-Wt0X7qSC6GDa5Y4NVIdObaGxen4\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 11599,
		"path": "../public/assets/simulator-DdXyRcSa.js"
	},
	"/assets/timing-CNlXwwDb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12ea-Z57C28kP54vM1Xi3JS8xBdNQ0sE\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 4842,
		"path": "../public/assets/timing-CNlXwwDb.js"
	},
	"/assets/sprout-FLNyHfMR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12a-HhWCZw6L3yOdC4FIjPtIMrtGw2c\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 298,
		"path": "../public/assets/sprout-FLNyHfMR.js"
	},
	"/assets/styles-RojMU_Db.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"1bb9d-1c2aaQQCCbaOmab/PweZqHAcpVI\"",
		"mtime": "2026-10-21T12:40:37.034Z",
		"size": 113565,
		"path": "../public/assets/styles-RojMU_Db.css"
	},
	"/assets/sacco-BklzlfBw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf9-ccmeIp+k24e1UaWMfOJW8MkDi08\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 15609,
		"path": "../public/assets/sacco-BklzlfBw.js"
	},
	"/assets/geo-CfzsyZmV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4c8-UO4764Mru4jwUdhI4oMwdhCIH6A\"",
		"mtime": "2026-10-21T12:40:37.032Z",
		"size": 1224,
		"path": "../public/assets/geo-CfzsyZmV.js"
	},
	"/assets/ussd-BsAV9BGV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2477-V2NeupXF8qZD7Z5/rjugc/wK2L8\"",
		"mtime": "2026-10-21T12:40:37.033Z",
		"size": 9335,
		"path": "../public/assets/ussd-BsAV9BGV.js"
	},
	"/images/healthy-crops.jpg": {
		"type": "image/jpeg",
		"etag": "\"50c43-Ia0yPAhOb0BzbLsk5hIj+Ui18CM\"",
		"mtime": "2026-10-21T12:40:39.746Z",
		"size": 330819,
		"path": "../public/images/healthy-crops.jpg"
	},
	"/images/farmers-group.jpg": {
		"type": "image/jpeg",
		"etag": "\"70434-Jn2wSXlJtzYz+/t360hB/SPOuk8\"",
		"mtime": "2026-10-21T12:40:39.784Z",
		"size": 459828,
		"path": "../public/images/farmers-group.jpg"
	},
	"/geo/kenya-subcounties.json": {
		"type": "application/json",
		"etag": "\"c717-VUfoU33i8VJPv/y9PqTv+7/+8Kc\"",
		"mtime": "2026-10-21T12:40:39.748Z",
		"size": 50967,
		"path": "../public/geo/kenya-subcounties.json"
	},
	"/images/hero-farmer-market.jpg": {
		"type": "image/jpeg",
		"etag": "\"61b64-/00Fr3DSDtF+uDzuU4Cn4/KLE1Y\"",
		"mtime": "2026-10-21T12:40:39.767Z",
		"size": 400228,
		"path": "../public/images/hero-farmer-market.jpg"
	},
	"/geo/coord-list.json": {
		"type": "application/json",
		"etag": "\"c1bd-TyQH8Co1TGzeidce+mbzF0elHdw\"",
		"mtime": "2026-10-21T12:40:39.744Z",
		"size": 49597,
		"path": "../public/geo/coord-list.json"
	},
	"/geo/kenya-counties.geojson": {
		"type": "application/geo+json",
		"etag": "\"14bfc6-hs2Vp2mqpKm7BaZY0qI5tP4CCv0\"",
		"mtime": "2026-10-21T12:40:39.749Z",
		"size": 1359814,
		"path": "../public/geo/kenya-counties.geojson"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_vt03bk = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_vt03bk
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
