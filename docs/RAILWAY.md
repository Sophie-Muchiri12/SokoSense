# Deploying SokoSense on Railway

Two services from one GitHub repo: **API** (Python) + **Web** (Node).

## 1. API service (you may already have this)

| Setting | Value |
|---------|--------|
| **Root Directory** | `/` (empty / repo root) |
| **Config file** | `/railway.toml` |
| **Build** | `pip install -r requirements.txt` |
| **Start** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

1. Connect the GitHub repo (already done if you see a green deploy).
2. **Settings → Networking → Generate Domain** (otherwise the service stays "Unexposed").
3. **Variables** — add secrets from `.env.example`:

```env
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
NEO4J_URI=...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...
NEO4J_DATABASE=neo4j
TAVILY_API_KEY=...          # optional
AT_API_KEY=...              # Africa's Talking SMS/USSD
AT_USERNAME=sandbox
```

4. Verify: `curl https://YOUR-API-DOMAIN/health`

Rename the service to something clear (e.g. `SokoSense` or `sokosense-api`) — the frontend references it by name.

## 2. Web service (frontend)

Click **+ New** → **GitHub Repo** → same SokoSense repository.

| Setting | Value |
|---------|--------|
| **Root Directory** | `frontend` |
| **Config file** | `/frontend/railway.toml` |
| **Build** | `npm install && npm run build` |
| **Start** | `node .output/server/index.mjs` |

**Variables** (API must be deployed and have a domain first):

```env
NITRO_PRESET=node-server
VITE_API_URL=https://${{SokoSense.RAILWAY_PUBLIC_DOMAIN}}
```

Replace `SokoSense` with your **API service name** exactly as shown on the Railway canvas. Railway injects the public hostname at build time.

Then **Settings → Networking → Generate Domain** for the web service.

## 3. Africa's Talking webhooks

Point at the **API** domain only:

| Channel | URL |
|---------|-----|
| USSD | `https://YOUR-API-DOMAIN/ussd` |
| SMS | `https://YOUR-API-DOMAIN/webhook/sms` |

## 4. Deploy order

1. Deploy API → generate domain → confirm `/health`
2. Set `VITE_API_URL` on frontend → deploy frontend → generate domain
3. If you change the API URL later, **redeploy the frontend** (Vite bakes the URL at build time)

## 5. What works without API keys

`/api/market`, `/api/timing`, `/api/loan`, `/ussd`, `/webhook/sms` — rule-based, no LLM.

Agent (`/api/agent`) and advisory (`/api/advisory`) need `GROQ_API_KEY`. Advisory RAG also needs Neo4j vars.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Service "Unexposed" | Generate Domain in Settings → Networking |
| Frontend can't reach API | Check `VITE_API_URL` includes `https://` and matches API service name in reference var |
| Frontend build fails (no `.output/server`) | Set `NITRO_PRESET=node-server` before build |
| Cold / slow first request | Normal on low-tier plans; API stays warm while in use |
