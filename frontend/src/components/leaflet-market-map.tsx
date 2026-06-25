import { useEffect, useRef } from "react";

export type LMarket = {
  id: string;
  name: string;
  county: string;
  lat: number;
  lng: number;
  price: number;
  delta: number;
  volume: number;
  signal: "buy" | "sell" | "hold";
};

const SIGNAL_COLOR: Record<LMarket["signal"], string> = {
  sell: "#2E7D32",
  buy: "#0D9280",
  hold: "#516880",
};

type Props = {
  markets: LMarket[];
  activeId: string;
  bestId: string;
  sourceId: string;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
};

export default function LeafletMarketMap({ markets, activeId, bestId, sourceId, onSelect, onHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  // init once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, {
        center: [0.2, 37.2],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        zoomSnap: 0.25,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 18,
        }
      ).addTo(map);

      // subtle label overlay
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 18, opacity: 0.55 }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // re-render markers + route on state changes
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();

    const source = markets.find((m) => m.id === sourceId);
    const best = markets.find((m) => m.id === bestId);

    if (source && best && source.id !== best.id) {
      L.polyline(
        [
          [source.lat, source.lng],
          [best.lat, best.lng],
        ],
        {
          color: "#0D9280",
          weight: 1.2,
          opacity: 0.85,
          dashArray: "4 4",
        }
      ).addTo(layer);
    }

    markets.forEach((m) => {
      const isActive = m.id === activeId;
      const isBest = m.id === bestId;
      const color = SIGNAL_COLOR[m.signal];
      const radius = 6 + Math.min(14, m.volume / 200);

      // outer halo
      L.circleMarker([m.lat, m.lng], {
        radius: radius + (isBest ? 8 : 4),
        color,
        weight: isBest ? 1.5 : 0.5,
        opacity: isBest ? 0.7 : 0.25,
        fillOpacity: 0.06,
        fillColor: color,
        interactive: false,
      }).addTo(layer);

      const dot = L.circleMarker([m.lat, m.lng], {
        radius: isActive ? radius + 2 : radius,
        color: isActive ? "#1B2128" : color,
        weight: isActive ? 2 : 1,
        fillColor: color,
        fillOpacity: 0.92,
      })
        .addTo(layer)
        .on("click", () => onSelect(m.id))
        .on("mouseover", () => onHover?.(m.id))
        .on("mouseout", () => onHover?.(null));

      const html = `<div style="font-family:Inter,sans-serif;font-size:11px;background:#1B2128;color:#fff;padding:6px 9px;border-radius:6px;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.25)">
        <div style="font-weight:600;letter-spacing:.01em">${m.name}</div>
        <div style="opacity:.7;margin-top:2px;font-variant-numeric:tabular-nums">KSh ${m.price.toLocaleString()} · ${m.delta >= 0 ? "+" : ""}${m.delta}%</div>
      </div>`;
      dot.bindTooltip(html, { direction: "top", offset: [0, -4], opacity: 1, className: "soko-tt" });
    });
  }, [markets, activeId, bestId, sourceId, onSelect, onHover]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-hairline bg-[#EEF2EC]">
      <div ref={containerRef} className="absolute inset-0" />
      {/* scanline / terminal overlay */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-hairline rounded-xl" />
    </div>
  );
}
