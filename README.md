# Lead Lens

FastAPI + PostgreSQL + Redis backend and React (Leaflet + Chart.js) UI for Indian pincode–keyed lead analytics, mapping, filters, portfolio charts, and cross-sell recommendations.


## Portal

Map/dashboard view:
![](./images/Map.png)
![](./images/Portfolio.png)

Cross-sell + similar leads:
![](./images/MapFilters.png)

Leads table (filtered):
![](./images/Leads.png)


## Prerequisites

- Python 3.10+
- Node.js 18+ (recommended; Node 16 works with the pinned Vite 4 stack)
- Docker (for Postgres and Redis)

## Quick local deploy

From the repo root:

```bash
./scripts/deploy-local.sh
```

This starts Docker (Postgres + Redis), creates/uses `backend/.venv`, seeds the DB, flushes Redis, and runs the API on port 8000 and the Vite UI on 5173. Logs: `.logs/`. Stop with `./scripts/deploy-local.sh stop`. Set `SKIP_SEED=1` or `SKIP_DOCKER=1` if needed.

## Database

1. Start services:

   ```bash
   docker compose up -d
   ```

2. On first run, `db/init.sql` creates the `lead_lens` schema, enums, `leads` table, and indexes (including `pincode`).

3. Seed synthetic data (defaults to `postgresql+asyncpg://postgres:postgres@localhost:5432/local`):

   ```bash
   cd backend && python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/local
   python ../scripts/seed_leads.py
   ```

4. After re-seeding, flush Redis so aggregation caches refresh:

   ```bash
   docker compose exec redis redis-cli FLUSHDB
   ```

## Backend

```bash
cd backend && source .venv/bin/activate
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/local
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optional env: `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGINS` (comma-separated).

### APIs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/token` | JWT (demo: `admin` / `admin123`) |
| GET | `/api/leads/count-by-pincode` | Counts per pincode (cached) |
| GET | `/api/leads/metadata-by-pincode` | Aggregates + distributions per pincode (cached) |
| GET | `/api/leads/recommendation/{pincode}` | Similar leads + cross-sell suggestions |
| POST | `/api/leads/filter` | Filtered leads with pagination |
| GET | `/api/leads/portfolio-summary` | Global portfolio breakdown (cached) |
| POST | `/api/leads/export.csv` | CSV export for current filter set |

## Sample cURL Requests

Set API base URL:
```bash
export API_URL="http://127.0.0.1:8000"
```

Health:
```bash
curl -s "$API_URL/api/health"
```

Demo JWT token (optional; most endpoints work without it):
```bash
curl -s -X POST "$API_URL/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Counts by pincode:
```bash
curl -s "$API_URL/api/leads/count-by-pincode"
```

Metadata by pincode:
```bash
curl -s "$API_URL/api/leads/metadata-by-pincode"
```

Recommendation for a pincode:
```bash
curl -s "$API_URL/api/leads/recommendation/110001"
```

Filtered leads (pagination):
```bash
curl -s -X POST "$API_URL/api/leads/filter" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"page_size":25,"pincode":"110001"}'
```

Portfolio summary:
```bash
curl -s "$API_URL/api/leads/portfolio-summary"
```

CSV export (downloads matching leads; no pagination in response):
```bash
curl -s -L -X POST "$API_URL/api/leads/export.csv" \
  -H "Content-Type: application/json" \
  -d '{"pincode":"110001","page":1,"page_size":500}' \
  -o leads_export.csv
```

## Frontend

```bash
cd frontend && npm install && npm run dev
```

Opens Vite on port 5173 with a proxy to `http://127.0.0.1:8000`. Override with `VITE_API_URL` if the API is on another origin.

To run backend + frontend together (no Docker), you can use:
```bash
./scripts/start-local-app.sh start
```

## Map note

Full India postal polygon TopoJSON is large and not bundled. The UI plots **pincode centroids** (see `frontend/public/data/pincodes_geo.json`, aligned with seed pincodes) with **circle markers** sized and colored by lead density—hover shows aggregated metadata; click selects the pincode for the table and cross-sell panel.
