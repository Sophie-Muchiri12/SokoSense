import { PRICE_DIFF_THRESHOLD } from "@/lib/config";

export type MarketSignal = "sell" | "buy" | "hold";

export type MarketRecommendation = "SELL_HERE" | "SELL_IN_MARKET" | "WAIT";

export interface SignalMarket {
  id: string;
  price: number;
}

/**
 * Assign Sell / Buy / Hold from price rank across tracked markets.
 * Must stay aligned with ranking used in engines/market.py (highest → sell, lowest → buy).
 */
export function assignMarketSignals(markets: SignalMarket[]): Map<string, MarketSignal> {
  const signals = new Map<string, MarketSignal>();
  if (!markets.length) return signals;

  const sorted = [...markets].sort((a, b) => b.price - a.price);
  const lastRank = sorted.length - 1;

  for (const market of markets) {
    const rank = sorted.findIndex((s) => s.id === market.id);
    const signal: MarketSignal =
      rank === 0 ? "sell" : rank >= lastRank ? "buy" : "hold";
    signals.set(market.id, signal);
  }

  return signals;
}

/**
 * Mirror POST /api/market recommendation thresholds (engines/market.py).
 * Transport cost is applied separately in the UI for net margin.
 */
export function decideMarketRecommendation(
  localPrice: number,
  bestPrice: number,
  sameMarket: boolean,
): MarketRecommendation {
  if (sameMarket || bestPrice <= localPrice) return "SELL_HERE";
  const pct = localPrice > 0 ? (bestPrice - localPrice) / localPrice : 0;
  if (pct >= PRICE_DIFF_THRESHOLD) return "SELL_IN_MARKET";
  return "WAIT";
}

export function recommendationHeadline(
  rec: MarketRecommendation,
  crop: string,
  originName: string,
  bestName: string,
  profitPerBag: number,
): string {
  const cropLabel = crop.toLowerCase();
  switch (rec) {
    case "SELL_IN_MARKET":
      return profitPerBag > 0
        ? `Move ${cropLabel} from ${originName} to ${bestName} this week.`
        : `Hold ${cropLabel} — est. freight erases the spread.`;
    case "SELL_HERE":
      return `Sell ${cropLabel} at ${originName} — best price today.`;
    case "WAIT":
      return `Hold ${cropLabel} — spread does not justify travel.`;
  }
}
