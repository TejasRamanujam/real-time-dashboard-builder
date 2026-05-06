# Real-Time Dashboard Builder

Drag-and-drop dashboard constructor with custom widgets, SQL data sources, and auto-refresh.

## Architecture

```
┌──────────────────────────────────────────────┐
│  FastAPI Backend                             │
│  ├── /api/dashboards    — CRUD               │
│  ├── /api/widgets       — Widget CRUD        │
│  ├── /api/datasources   — PostgreSQL/REST/CSV│
│  ├── /api/query         — SQL execution      │
│  └── WS /ws/dashboard   — Real-time updates  │
├──────────────────────────────────────────────┤
│  Services                                     │
│  ├── query_engine.py   — SQL validation,     │
│  │                       pg/rest/csv exec    │
│  └── widget_data.py    — Transform raw data  │
│                          to chart formats     │
├──────────────────────────────────────────────┤
│  React Frontend                               │
│  ├── Home — Dashboard list                   │
│  ├── DashboardView — Widget grid + WS        │
│  ├── WidgetConfigPanel — Source + SQL config │
│  └── DataSourceWizard — Connect DB/API/CSV   │
└──────────────────────────────────────────────┘
```

## Quick Start

```bash
docker compose up -d
```

Frontend: `http://localhost:3000` | API: `http://localhost:8000`

## Widget Types

| Type | Description |
|---|---|
| Line Chart | Time-series with X/Y axes |
| Bar Chart | Categorical comparison |
| Pie Chart | Distribution view |
| Data Table | Sortable/filterable table |
| Stat Card | Single metric display |

## Data Sources

- **PostgreSQL** — Direct SQL with read-only validation (sqlparse)
- **REST API** — JSON endpoint with HTTP client
- **CSV** — Inline CSV parsing via Pandas

## Tech Stack

| Layer | Libraries |
|---|---|
| Backend | FastAPI, SQLAlchemy, WebSockets |
| Query Engine | sqlparse, psycopg2, httpx, pandas |
| Frontend | React 19, TypeScript, Vite, Recharts |
| UI | lucide-react icons |
| Infra | Docker, Nginx, PostgreSQL 16 (for data sources) |
