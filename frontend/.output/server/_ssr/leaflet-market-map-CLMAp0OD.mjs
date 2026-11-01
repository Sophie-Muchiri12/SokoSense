import { r as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { n as canonicalCountyName, r as countiesMatch, t as KENYA_BOUNDS } from "./geo-C10ERrIw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/leaflet-market-map-CLMAp0OD.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SIGNAL_COLOR = {
	sell: "#2E7D32",
	hold: "#C58A1E",
	buy: "#516880"
};
var FLY_OPTS = {
	duration: 1.2,
	easeLinearity: .25
};
var REDUCED_FLY_OPTS = {
	duration: .01,
	easeLinearity: .25
};
function prefersReducedMotion() {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function countyNameFromFeature(feature) {
	const props = feature.properties ?? {};
	return props.COUNTY_NAM || props.name || "";
}
function LeafletMarketMap({ markets, loading, selectedCounty, selectedSubcounty, onCountySelect, originMarketId, activeMarketId, bestMarketId, onMarketSelect, onMarketHover }) {
	const containerRef = (0, import_react.useRef)(null);
	const mapRef = (0, import_react.useRef)(null);
	const leafletRef = (0, import_react.useRef)(null);
	const countiesLayerRef = (0, import_react.useRef)(null);
	const marketsLayerRef = (0, import_react.useRef)(null);
	const subcountyLayerRef = (0, import_react.useRef)(null);
	const countyBoundsRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const selectedCountyRef = (0, import_react.useRef)(selectedCounty);
	const onCountySelectRef = (0, import_react.useRef)(onCountySelect);
	selectedCountyRef.current = selectedCounty;
	onCountySelectRef.current = onCountySelect;
	function applyCountyHighlight(county) {
		const layer = countiesLayerRef.current;
		if (!layer) return;
		layer.eachLayer((l) => {
			const feature = l.feature;
			if (!feature) return;
			const name = countyNameFromFeature(feature);
			const path = l;
			if (!county) {
				path.setStyle({
					color: "#9AA89A",
					weight: 1,
					fillColor: "#DDE8DA",
					fillOpacity: .45,
					opacity: 1
				});
				return;
			}
			if (countiesMatch(name, county)) {
				path.setStyle({
					color: "#2E7D32",
					weight: 2,
					fillColor: "#2E7D32",
					fillOpacity: .22,
					opacity: 1
				});
				path.bringToFront();
			} else path.setStyle({
				color: "#C5CEC5",
				weight: 1,
				fillColor: "#E8EDE7",
				fillOpacity: .12,
				opacity: .3
			});
		});
	}
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		(async () => {
			const L = (await import("../_libs/leaflet.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()))).default;
			if (cancelled || !containerRef.current || mapRef.current) return;
			leafletRef.current = L;
			const map = L.map(containerRef.current, {
				center: [.2, 37.2],
				zoom: 6,
				zoomControl: false,
				attributionControl: false,
				scrollWheelZoom: true
			});
			mapRef.current = map;
			L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
			L.control.attribution({
				position: "bottomleft",
				prefix: false
			}).addAttribution("© OpenStreetMap contributors").addTo(map);
			L.control.zoom({ position: "bottomright" }).addTo(map);
			marketsLayerRef.current = L.layerGroup().addTo(map);
			subcountyLayerRef.current = L.layerGroup().addTo(map);
			const flyOpts = prefersReducedMotion() ? REDUCED_FLY_OPTS : FLY_OPTS;
			map.fitBounds(KENYA_BOUNDS, {
				padding: [24, 24],
				...flyOpts
			});
			try {
				const geojson = await (await fetch("/geo/kenya-counties.geojson")).json();
				countiesLayerRef.current = L.geoJSON(geojson, {
					style: {
						color: "#9AA89A",
						weight: 1,
						fillColor: "#DDE8DA",
						fillOpacity: .45
					},
					onEachFeature: (feature, layer) => {
						const name = countyNameFromFeature(feature);
						if (!name) return;
						const bounds = layer.getBounds?.();
						if (bounds?.isValid()) countyBoundsRef.current.set(name, bounds);
						layer.on({
							mouseover: (e) => {
								const active = selectedCountyRef.current;
								if (active && !countiesMatch(name, active)) return;
								e.target.setStyle({
									fillOpacity: .62,
									fillColor: "#C8DCC4"
								});
							},
							mouseout: (e) => {
								countiesLayerRef.current?.resetStyle(e.target);
								applyCountyHighlight(selectedCountyRef.current);
							},
							click: (e) => {
								L.DomEvent.stopPropagation(e);
								onCountySelectRef.current(canonicalCountyName(name));
							}
						});
					}
				}).addTo(map);
			} catch {}
		})();
		return () => {
			cancelled = true;
			mapRef.current?.remove();
			mapRef.current = null;
			countiesLayerRef.current = null;
			marketsLayerRef.current = null;
			subcountyLayerRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map) return;
		applyCountyHighlight(selectedCounty);
		const flyOpts = prefersReducedMotion() ? REDUCED_FLY_OPTS : FLY_OPTS;
		if (selectedCounty) {
			const bounds = [...countyBoundsRef.current.entries()].find(([n]) => countiesMatch(n, selectedCounty))?.[1];
			if (bounds?.isValid()) map.flyToBounds(bounds, {
				padding: [32, 32],
				maxZoom: 10,
				...flyOpts
			});
		} else map.flyToBounds(KENYA_BOUNDS, {
			padding: [24, 24],
			...flyOpts
		});
	}, [selectedCounty]);
	(0, import_react.useEffect)(() => {
		const L = leafletRef.current;
		const layer = marketsLayerRef.current;
		if (!L || !layer) return;
		layer.clearLayers();
		const origin = markets.find((m) => m.id === originMarketId);
		const best = markets.find((m) => m.id === bestMarketId);
		if (origin && best && origin.id !== best.id) L.polyline([[origin.lat, origin.lng], [best.lat, best.lng]], {
			color: "#0D9280",
			weight: 1.2,
			opacity: .75,
			dashArray: "5 4"
		}).addTo(layer);
		if (loading) {
			(markets.length > 0 ? markets : [
				{
					lat: -1.2864,
					lng: 36.8172
				},
				{
					lat: -.3031,
					lng: 36.08
				},
				{
					lat: .5143,
					lng: 35.2698
				}
			]).forEach((pos) => {
				L.circleMarker([pos.lat, pos.lng], {
					radius: 10,
					color: "#DCE2DA",
					weight: 1,
					fillColor: "#EEF2EC",
					fillOpacity: .9,
					className: "soko-marker-skeleton"
				}).addTo(layer);
			});
			return;
		}
		markets.forEach((m) => {
			const isActive = m.id === activeMarketId;
			const color = SIGNAL_COLOR[m.signal];
			const icon = L.divIcon({
				className: "soko-market-marker-wrap",
				html: `<div class="soko-market-marker${isActive ? " soko-market-marker--active" : ""}" style="--signal:${color}">
          <span class="soko-market-marker__dot"></span>
          <span class="soko-market-marker__price">KSh ${m.price.toLocaleString()}</span>
        </div>`,
				iconSize: [0, 0],
				iconAnchor: [0, 0]
			});
			L.marker([m.lat, m.lng], {
				icon,
				zIndexOffset: isActive ? 500 : 100
			}).addTo(layer).on("click", () => onMarketSelect(m.id)).on("mouseover", () => onMarketHover?.(m.id)).on("mouseout", () => onMarketHover?.(null)).bindTooltip(`<strong>${m.name}</strong><br/>KSh ${m.price.toLocaleString()} / 90kg`, {
				direction: "top",
				offset: [0, -6],
				opacity: 1,
				className: "soko-map-tt"
			});
		});
	}, [
		markets,
		loading,
		originMarketId,
		bestMarketId,
		activeMarketId,
		onMarketSelect,
		onMarketHover
	]);
	(0, import_react.useEffect)(() => {
		const L = leafletRef.current;
		const layer = subcountyLayerRef.current;
		if (!L || !layer) return;
		layer.clearLayers();
		if (!selectedSubcounty) return;
		const icon = L.divIcon({
			className: "soko-subcounty-pin-wrap",
			html: `<div class="soko-subcounty-pin" title="${selectedSubcounty.name}"></div>`,
			iconSize: [12, 12],
			iconAnchor: [6, 6]
		});
		L.marker([selectedSubcounty.lat, selectedSubcounty.lng], {
			icon,
			zIndexOffset: 800,
			interactive: false
		}).addTo(layer).bindTooltip(selectedSubcounty.name, {
			direction: "top",
			offset: [0, -4],
			opacity: 1,
			className: "soko-map-tt"
		});
	}, [selectedSubcounty]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "market-map-shell relative h-full min-h-[55vh] w-full overflow-hidden border border-hairline bg-[#EEF2EC] md:min-h-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: containerRef,
			className: "absolute inset-0"
		})
	});
}
//#endregion
export { LeafletMarketMap as default };
