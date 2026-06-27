# Suggested Modifications for `contract.json`


---

## 1. Upgrade `TimingResponse` for Sell/Buy/Hold Actions

Currently, the `recommendation` for timing is restricted to `SELL_TODAY` or `WAIT`. To support complete action decisions (Sell, Buy, or Hold), update the recommendation literal types and schema.

### Proposed Changes

```diff
     "POST /api/timing": {
       "description": "Sell timing engine — when to sell",
       "request": {
         "crop": "string (required)",
-        "market": "string (required)"
+        "market": "string (required)",
+        "intent": "string (optional) — sell | buy (defaults to sell)"
       },
       "response": {
         "crop": "string",
         "market": "string",
-        "recommendation": "string — SELL_TODAY | WAIT",
+        "recommendation": "string — SELL_TODAY | BUY_TODAY | WAIT",
         "short_reply": "string (max 320)",
         "wait_days": "integer | null",
         "reason": "string"
       }
     }
```

---

## 2. Upgrade `MarketDecisionRequest` for Buy/Sell Support

The market engine can recommend where to buy or sell. Adding an `intent` field allows the decision logic to tailor its price comparison (e.g., maximizing profit for sellers vs. minimizing cost for buyers).

### Proposed Changes

```diff
     "POST /api/market": {
       "description": "Market decision engine — where to sell",
       "request": {
         "crop": "string (required) — e.g. maize",
-        "location": "string (required) — farmer's market or county, e.g. nakuru"
+        "location": "string (required) — farmer's market or county, e.g. nakuru",
+        "intent": "string (optional) — sell | buy (defaults to sell)"
       },
       "response": {
         "crop": "string",
         "location": "string",
-        "recommendation": "string — SELL_HERE | SELL_IN_MARKET | WAIT",
+        "recommendation": "string — SELL_HERE | SELL_IN_MARKET | BUY_HERE | BUY_IN_MARKET | WAIT",
         "short_reply": "string (max 320) — SMS-ready one-line decision",
         "market_name": "string | null — farmer's local market",
         "best_market": "string | null — recommended market if different",
         "local_price_kes": "number | null — price at local market per 90kg bag",
         "best_price_kes": "number | null — price at best market",
         "price_diff_kes": "number | null — gain/savings per bag if farmer travels"
       }
     }
```

---

## 3. Upgrade `LoanRequest` to Support Full Parameters

The current `/api/loan` schema only accepts `monthly_rate_percent`. However, the core loaning engine (`loaning.py`) supports complex and realistic calculations including principal, term, period, and compounding frequency. Exposing these variables yields a significantly more robust API.

### Proposed Changes

```diff
     "POST /api/loan": {
       "description": "Loan APR engine — safe or not safe",
       "request": {
-        "monthly_rate_percent": "number (required) — e.g. 10 for 10% per month"
+        "principal": "number (required) — e.g. 50000",
+        "interest_rate": "number (required) — stated interest rate percent",
+        "rate_period": "string (required) — annual | monthly | weekly | daily",
+        "term_value": "number (required) — term length duration",
+        "term_unit": "string (required) — years | months | weeks | days",
+        "compounding_frequency": "string (optional) — annually | monthly | weekly | daily (defaults to monthly)",
+        "is_simple_interest": "boolean (optional) — defaults to false"
       },
       "response": {
         "monthly_rate_percent": "number",
+        "principal": "number",
+        "term_value": "number",
+        "term_unit": "string",
         "apr_percent": "number",
         "cbk_rate_percent": "number — benchmark, ~13",
         "risk_verdict": "string — SAFE | CAUTION | HIGH_RISK | AVOID",
         "short_reply": "string (max 320)",
         "comparison_phrase": "string (max 320)",
         "payment_id": "string | null — Masumi mock ID from Lucy"
       }
     }
```
