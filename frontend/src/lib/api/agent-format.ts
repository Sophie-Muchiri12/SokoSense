import type { AgentResponse } from "./client";

export type ParsedAgent = {
  /** Best human-readable text to show the farmer. */
  text: string;
  /** Structured fields when the agent returned JSON (prices, etc). */
  data: Record<string, unknown> | null;
  /** Tool the agent invoked, if any (price lookup, loan, weather...). */
  tool: string | null;
};

/**
 * The agent sometimes returns plain text and sometimes a JSON (or near-JSON)
 * string. This normalises both into something the UI can render.
 */
export function parseAgent(res: AgentResponse): ParsedAgent {
  const tool =
    res.raw?.messages?.flatMap((m) => m.tool_calls ?? []).map((t) => t.name)[0] ??
    null;

  const data = tryParseJson(res.response);
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const text =
      pickString(obj, ["response", "answer", "message", "reply", "text", "recommendation"]) ??
      res.response;
    return { text, data: obj, tool };
  }

  return { text: res.response, data: null, tool };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function tryParseJson(raw: string): unknown {
  const s = raw.trim();
  const candidates = [s];
  // The agent occasionally drops the leading "{" — repair common cases.
  if (!s.startsWith("{") && /"\s*:/.test(s)) candidates.push(`{${s}`);
  if (!s.endsWith("}") && s.includes('"')) candidates.push(`{${s}}`);

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}
