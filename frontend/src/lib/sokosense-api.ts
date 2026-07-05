/**
 * SokoSense API client — typed fetch wrappers for the FastAPI backend.
 * In dev, Vite on :8081 proxies /api and /health to the backend on :8000.
 */

const BASE_URL =
  typeof window !== "undefined"
    ? (import.meta.env?.VITE_API_URL ?? "")
    : (process.env.VITE_API_URL ?? "");

// ─── types ───────────────────────────────────────────────────────────────────

export interface AgentRequest {
  message: string;
}

export interface AgentResponse {
  response: string;
  type: "advisory" | "market" | "weather" | "loan" | "general";
  raw?: {
    messages: Array<{
      role: string;
      content_preview: string;
      tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
    }>;
    error?: string;
  };
}

export interface MarketPricePoint {
  name: string;
  lat: number;
  lng: number;
  price_kes: number;
  recommended: boolean;
}

export interface MarketMapResponse {
  crop: string;
  date: string;
  markets: MarketPricePoint[];
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface LogItem {
  id?: string;
  timestamp?: string;
  message?: string;
  level?: string;
  [key: string]: unknown;
}

export interface LogListResponse {
  total: number;
  page: number;
  page_size: number;
  items: LogItem[];
}

export interface LoanRequest {
  monthly_rate_percent: number;
}

export interface LoanResponse {
  monthly_rate_percent: number;
  apr_percent: number;
  cbk_rate_percent: number;
  risk_verdict: "SAFE" | "CAUTION" | "HIGH_RISK" | "AVOID";
  short_reply: string;
  comparison_phrase: string;
  payment_id?: string | null;
}

export interface MarketDecisionRequest {
  crop: string;
  location: string;
}

export interface MarketDecisionResponse {
  crop: string;
  location: string;
  recommendation: "SELL_HERE" | "SELL_IN_MARKET" | "WAIT";
  short_reply: string;
  market_name?: string | null;
  best_market?: string | null;
  local_price_kes?: number | null;
  best_price_kes?: number | null;
  price_diff_kes?: number | null;
}

export interface TimingRequest {
  crop: string;
  market: string;
}

export interface TimingResponse {
  crop: string;
  market: string;
  recommendation: "SELL_TODAY" | "WAIT";
  short_reply: string;
  wait_days?: number | null;
  reason: string;
}

export interface AdvisoryRequest {
  query: string;
}

export interface AdvisoryResponse {
  query: string;
  answer: string;
  location?: string | null;
  weather?: Record<string, unknown> | null;
  sources: string[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`SokoSense API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── API calls ───────────────────────────────────────────────────────────────

/** Send a message to the LangGraph agent. */
export async function postAgent(message: string): Promise<AgentResponse> {
  return apiFetch<AgentResponse>("/api/agent", {
    method: "POST",
    body: JSON.stringify({ message } satisfies AgentRequest),
  });
}

/** Fetch live wholesale prices for a given crop (KAMIS-backed). */
export async function getMarketPrices(
  crop: string,
): Promise<MarketMapResponse> {
  return apiFetch<MarketMapResponse>(
    `/api/market-prices?crop=${encodeURIComponent(crop.toLowerCase())}`,
  );
}

/** Best-market decision engine. */
export async function postMarketDecision(
  crop: string,
  location: string,
): Promise<MarketDecisionResponse> {
  return apiFetch<MarketDecisionResponse>("/api/market", {
    method: "POST",
    body: JSON.stringify({ crop, location } satisfies MarketDecisionRequest),
  });
}

/** Sell-timing decision engine. */
export async function postTimingDecision(
  crop: string,
  market: string,
): Promise<TimingResponse> {
  return apiFetch<TimingResponse>("/api/timing", {
    method: "POST",
    body: JSON.stringify({ crop, market } satisfies TimingRequest),
  });
}

/** Loan risk assessment engine. */
export async function postLoan(
  monthlyRatePercent: number,
): Promise<LoanResponse> {
  return apiFetch<LoanResponse>("/api/loan", {
    method: "POST",
    body: JSON.stringify({
      monthly_rate_percent: monthlyRatePercent,
    } satisfies LoanRequest),
  });
}

/** RAG advisory engine — crop/disease/weather questions. */
export async function postAdvisory(query: string): Promise<AdvisoryResponse> {
  return apiFetch<AdvisoryResponse>("/api/advisory", {
    method: "POST",
    body: JSON.stringify({ query } satisfies AdvisoryRequest),
  });
}

/** Check API health. */
export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

// ─── USSD (Africa's Talking webhook shape) ───────────────────────────────────

export interface UssdRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

export type UssdResponseKind = "CON" | "END";

export interface UssdResponse {
  kind: UssdResponseKind;
  body: string;
  raw: string;
}

const USSD_SERVICE_CODE = "*384*543#";

/** Parse a CON/END USSD screen from the FastAPI plain-text handler. */
export function parseUssdResponse(raw: string): UssdResponse {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("END ")) {
    return { kind: "END", body: trimmed.slice(4), raw };
  }
  if (trimmed.startsWith("CON ")) {
    return { kind: "CON", body: trimmed.slice(4), raw };
  }
  return { kind: "END", body: trimmed, raw };
}

/** Invoke the live USSD webhook (same path Africa's Talking POSTs to). */
export async function postUssd(params: UssdRequest): Promise<UssdResponse> {
  const body = new URLSearchParams({
    sessionId: params.sessionId,
    serviceCode: params.serviceCode,
    phoneNumber: params.phoneNumber,
    text: params.text,
  });
  // In dev the /ussd URL is the React page route (GET only). Proxy via /api/ussd instead.
  const path = BASE_URL ? "/ussd" : "/api/ussd";
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`SokoSense USSD ${res.status}: ${text}`);
  }
  return parseUssdResponse(await res.text());
}

export { USSD_SERVICE_CODE };

/** Fetch recent request logs (page / page_size). */
export async function getLogs(
  page = 1,
  pageSize = 50,
): Promise<LogListResponse> {
  return apiFetch<LogListResponse>(
    `/api/logs?page=${page}&page_size=${pageSize}`,
  );
}
