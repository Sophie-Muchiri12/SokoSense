/** Seven wholesale markets tracked by SokoSense (mirrors engines/market_prices.py). */
export const TRACKED_MARKETS = [
  { id: "nairobi", name: "Nairobi", lat: -1.2864, lng: 36.8172 },
  { id: "nakuru", name: "Nakuru", lat: -0.3031, lng: 36.08 },
  { id: "eldoret", name: "Eldoret", lat: 0.5143, lng: 35.2698 },
  { id: "kisumu", name: "Kisumu", lat: -0.1022, lng: 34.7617 },
  { id: "mombasa", name: "Mombasa", lat: -4.0435, lng: 39.6682 },
  { id: "kitale", name: "Kitale", lat: 1.0167, lng: 35.0 },
  { id: "nyeri", name: "Nyeri", lat: -0.4197, lng: 36.9475 },
] as const;

/** GeoJSON feature labels → canonical county names in kenya-subcounties.json */
const GEOJSON_COUNTY_ALIASES: Record<string, string> = {
  "Elgeyo Marakwet": "Elgeyo-Marakwet",
  "Tharaka Nithi": "Tharaka-Nithi",
  "Taita Taveta": "Taita-Taveta",
  "Trans Nzoia": "Trans-Nzoia",
  Muranga: "Murang'a",
  Homabay: "Homa Bay",
};

export function normalizeCountyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function countyKey(name: string): string {
  return normalizeCountyName(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Map a county label from GeoJSON or UI to the canonical name used in subcounty data. */
export function canonicalCountyName(name: string): string {
  const trimmed = normalizeCountyName(name);
  if (GEOJSON_COUNTY_ALIASES[trimmed]) return GEOJSON_COUNTY_ALIASES[trimmed];
  return trimmed;
}

/** Case-insensitive county equality across naming variants. */
export function countiesMatch(a: string, b: string): boolean {
  return countyKey(canonicalCountyName(a)) === countyKey(canonicalCountyName(b));
}

/** Approximate Kenya bounds for initial map fit. */
export const KENYA_BOUNDS: [[number, number], [number, number]] = [
  [-4.75, 33.85],
  [5.05, 41.95],
];

const R_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_KM * Math.asin(Math.sqrt(a)));
}

export function nearestTrackedMarket(lat: number, lng: number) {
  let best = TRACKED_MARKETS[0];
  let bestDist = haversineKm(lat, lng, best.lat, best.lng);

  for (const market of TRACKED_MARKETS) {
    const d = haversineKm(lat, lng, market.lat, market.lng);
    if (d < bestDist) {
      best = market;
      bestDist = d;
    }
  }

  return { market: best, distanceKm: bestDist };
}
