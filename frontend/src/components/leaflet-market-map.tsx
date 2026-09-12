import { useEffect, useRef } from "react";
import type { GeoJSON as GeoJSONType, Map as LeafletMap, LayerGroup, Path } from "leaflet";
import { canonicalCountyName, countiesMatch, KENYA_BOUNDS } from "@/lib/geo";

export type LMarket = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  price: number;
  signal: "buy" | "sell" | "hold";
};

const SIGNAL_COLOR: Record<LMarket["signal"], string> = {
  sell: "#2E7D32",
  hold: "#C58A1E",
  buy: "#516880",
};

const FLY_OPTS = { duration: 1.2, easeLinearity: 0.25 };
const REDUCED_FLY_OPTS = { duration: 0.01, easeLinearity: 0.25 };

type SubcountyPin = { name: string; lat: number; lng: number } | null;

type Props = {
  markets: LMarket[];
  loading: boolean;
  selectedCounty: string | null;
  selectedSubcounty: SubcountyPin;
  onCountySelect: (countyName: string) => void;
  originMarketId: string;
  activeMarketId: string;
  bestMarketId: string;
  onMarketSelect: (id: string) => void;
  onMarketHover?: (id: string | null) => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function countyNameFromFeature(feature: GeoJSON.Feature): string {
  const props = feature.properties ?? {};
  return (props.COUNTY_NAM as string) || (props.name as string) || "";
}

export default function LeafletMarketMap({
  markets,
  loading,
  selectedCounty,
  selectedSubcounty,
  onCountySelect,
  originMarketId,
  activeMarketId,
  bestMarketId,
  onMarketSelect,
  onMarketHover,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const countiesLayerRef = useRef<GeoJSONType | null>(null);
  const marketsLayerRef = useRef<LayerGroup | null>(null);
  const subcountyLayerRef = useRef<LayerGroup | null>(null);
  const countyBoundsRef = useRef<Map<string, import("leaflet").LatLngBounds>>(new Map());
  const selectedCountyRef = useRef<string | null>(selectedCounty);
  const onCountySelectRef = useRef(onCountySelect);

  selectedCountyRef.current = selectedCounty;
  onCountySelectRef.current = onCountySelect;

  function applyCountyHighlight(county: string | null) {
    const layer = countiesLayerRef.current;
    if (!layer) return;
    layer.eachLayer((l) => {
      const feature = (l as GeoJSONType & { feature?: GeoJSON.Feature }).feature;
      if (!feature) return;
      const name = countyNameFromFeature(feature);
      const path = l as Path;
      if (!county) {
        path.setStyle({
          color: "#9AA89A",
          weight: 1,
          fillColor: "#DDE8DA",
          fillOpacity: 0.45,
          opacity: 1,
        });
        return;
      }
      if (countiesMatch(name, county)) {
        path.setStyle({
          color: "#2E7D32",
          weight: 2,
          fillColor: "#2E7D32",
          fillOpacity: 0.22,
          opacity: 1,
        });
        path.bringToFront();
      } else {
        path.setStyle({
          color: "#C5CEC5",
          weight: 1,
          fillColor: "#E8EDE7",
          fillOpacity: 0.12,
          opacity: 0.3,
        });
      }
    });
  }

  // Init map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [0.2, 37.2],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 18,
      }).addTo(map);

      L.control
        .attribution({ position: "bottomleft", prefix: false })
        .addAttribution("© OSM · CARTO")
        .addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      marketsLayerRef.current = L.layerGroup().addTo(map);
      subcountyLayerRef.current = L.layerGroup().addTo(map);

      const flyOpts = prefersReducedMotion() ? REDUCED_FLY_OPTS : FLY_OPTS;
      map.fitBounds(KENYA_BOUNDS, { padding: [24, 24], ...flyOpts });

      try {
        const res = await fetch("/geo/kenya-counties.geojson");
        const geojson = (await res.json()) as GeoJSON.FeatureCollection;

        const counties = L.geoJSON(geojson, {
          style: {
            color: "#9AA89A",
            weight: 1,
            fillColor: "#DDE8DA",
            fillOpacity: 0.45,
          },
          onEachFeature: (feature, layer) => {
            const name = countyNameFromFeature(feature);
            if (!name) return;

            const bounds = (layer as Path).getBounds?.();
            if (bounds?.isValid()) countyBoundsRef.current.set(name, bounds);

            layer.on({
              mouseover: (e) => {
                const active = selectedCountyRef.current;
                if (active && !countiesMatch(name, active)) return;
                (e.target as Path).setStyle({ fillOpacity: 0.62, fillColor: "#C8DCC4" });
              },
              mouseout: (e) => {
                countiesLayerRef.current?.resetStyle(e.target as Path);
                applyCountyHighlight(selectedCountyRef.current);
              },
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onCountySelectRef.current(canonicalCountyName(name));
              },
            });
          },
        }).addTo(map);

        countiesLayerRef.current = counties;
      } catch {
        // County boundaries unavailable
      }
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

  // County zoom + highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyCountyHighlight(selectedCounty);

    const flyOpts = prefersReducedMotion() ? REDUCED_FLY_OPTS : FLY_OPTS;
    if (selectedCounty) {
      const bounds = [...countyBoundsRef.current.entries()].find(([n]) =>
        countiesMatch(n, selectedCounty),
      )?.[1];
      if (bounds?.isValid()) {
        map.flyToBounds(bounds, { padding: [32, 32], maxZoom: 10, ...flyOpts });
      }
    } else {
      map.flyToBounds(KENYA_BOUNDS, { padding: [24, 24], ...flyOpts });
    }
  }, [selectedCounty]);

  // Market markers + route
  useEffect(() => {
    const L = leafletRef.current;
    const layer = marketsLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();

    const origin = markets.find((m) => m.id === originMarketId);
    const best = markets.find((m) => m.id === bestMarketId);

    if (origin && best && origin.id !== best.id) {
      L.polyline(
        [
          [origin.lat, origin.lng],
          [best.lat, best.lng],
        ],
        { color: "#0D9280", weight: 1.2, opacity: 0.75, dashArray: "5 4" },
      ).addTo(layer);
    }

    if (loading) {
      const skeletonPositions =
        markets.length > 0
          ? markets
          : [
              { lat: -1.2864, lng: 36.8172 },
              { lat: -0.3031, lng: 36.08 },
              { lat: 0.5143, lng: 35.2698 },
            ];
      skeletonPositions.forEach((pos) => {
        L.circleMarker([pos.lat, pos.lng], {
          radius: 10,
          color: "#DCE2DA",
          weight: 1,
          fillColor: "#EEF2EC",
          fillOpacity: 0.9,
          className: "soko-marker-skeleton",
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
        iconAnchor: [0, 0],
      });

      L.marker([m.lat, m.lng], { icon, zIndexOffset: isActive ? 500 : 100 })
        .addTo(layer)
        .on("click", () => onMarketSelect(m.id))
        .on("mouseover", () => onMarketHover?.(m.id))
        .on("mouseout", () => onMarketHover?.(null))
        .bindTooltip(
          `<strong>${m.name}</strong><br/>KSh ${m.price.toLocaleString()} / 90kg`,
          { direction: "top", offset: [0, -6], opacity: 1, className: "soko-map-tt" },
        );
    });
  }, [
    markets,
    loading,
    originMarketId,
    bestMarketId,
    activeMarketId,
    onMarketSelect,
    onMarketHover,
  ]);

  // Subcounty centroid pin
  useEffect(() => {
    const L = leafletRef.current;
    const layer = subcountyLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    if (!selectedSubcounty) return;

    const icon = L.divIcon({
      className: "soko-subcounty-pin-wrap",
      html: `<div class="soko-subcounty-pin" title="${selectedSubcounty.name}"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    L.marker([selectedSubcounty.lat, selectedSubcounty.lng], {
      icon,
      zIndexOffset: 800,
      interactive: false,
    })
      .addTo(layer)
      .bindTooltip(selectedSubcounty.name, {
        direction: "top",
        offset: [0, -4],
        opacity: 1,
        className: "soko-map-tt",
      });
  }, [selectedSubcounty]);

  return (
    <div className="market-map-shell relative h-full min-h-[55vh] w-full overflow-hidden border border-hairline bg-[#EEF2EC] md:min-h-0">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
