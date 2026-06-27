// Typed client for the SokoSense FastAPI backend.
//
// The base URL is read from VITE_API_URL (see frontend/.env) and falls back to
// the local dev backend. Because it uses the VITE_ prefix it is safe to read on
// both client and server.

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiError(
      `Cannot reach the SokoSense API at ${API_BASE_URL}. Is the backend running?`,
      0
    );
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(detail, res.status);
  }

  return (await res.json()) as T;
}

// ─────────────────────────── types ───────────────────────────

export type AgentResponse = {
  response: string;
  type: "advisory" | "market" | "weather" | "loan" | "general";
  raw?: {
    messages?: {
      role: string;
      content_preview: string;
      tool_calls?: { name: string; args: Record<string, unknown> }[];
    }[];
    error?: string;
  } | null;
};

export type LoanResponse = {
  monthly_rate_percent: number;
  apr_percent: number;
  cbk_rate_percent: number;
  risk_verdict: "SAFE" | "CAUTION" | "HIGH_RISK" | "AVOID";
  short_reply: string;
  comparison_phrase: string;
  payment_id: string | null;
};

export type MarketDecisionResponse = {
  crop: string;
  location: string;
  recommendation: "SELL_HERE" | "SELL_IN_MARKET" | "WAIT";
  short_reply: string;
  market_name?: string | null;
  best_market?: string | null;
  local_price_kes?: number | null;
  best_price_kes?: number | null;
  price_diff_kes?: number | null;
};

export type TimingResponse = {
  crop: string;
  market: string;
  recommendation: "SELL_TODAY" | "WAIT";
  short_reply: string;
  wait_days?: number | null;
  reason: string;
};

export type AdvisoryResponse = {
  query: string;
  answer: string;
  location?: string | null;
  weather?: Record<string, unknown> | null;
  sources: string[];
};

export type MarketPricePoint = {
  name: string;
  lat: number;
  lng: number;
  price_kes: number;
  recommended: boolean;
};

export type MarketMapResponse = {
  crop: string;
  date: string;
  markets: MarketPricePoint[];
};

export type HealthResponse = { status: string; service: string };

// ─────────────────────────── endpoints ───────────────────────────

export const api = {
  health: () => request<HealthResponse>("/health"),

  agent: (message: string) =>
    request<AgentResponse>("/api/agent", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  loan: (monthly_rate_percent: number) =>
    request<LoanResponse>("/api/loan", {
      method: "POST",
      body: JSON.stringify({ monthly_rate_percent }),
    }),

  marketDecision: (crop: string, location: string) =>
    request<MarketDecisionResponse>("/api/market", {
      method: "POST",
      body: JSON.stringify({ crop, location }),
    }),

  timing: (crop: string, market: string) =>
    request<TimingResponse>("/api/timing", {
      method: "POST",
      body: JSON.stringify({ crop, market }),
    }),

  advisory: (query: string) =>
    request<AdvisoryResponse>("/api/advisory", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  marketPrices: (crop: string) =>
    request<MarketMapResponse>(`/api/market-prices?crop=${encodeURIComponent(crop)}`),
};
