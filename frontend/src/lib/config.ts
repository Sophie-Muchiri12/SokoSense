/** KSh per km to move one 90 kg bag — used for est. freight on the market map. */
export const TRANSPORT_KSH_PER_KM_BAG = 6.2;

/** Minimum price spread (fraction) before recommending travel — mirrors engines/market.py */
export const PRICE_DIFF_THRESHOLD = 0.08;

/** Session cache TTL for GET /api/market-prices (ms). */
export const MARKET_PRICES_CACHE_MS = 10 * 60 * 1000;
