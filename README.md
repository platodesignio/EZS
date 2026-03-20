# Generative Power Space Explorer (GPSE)

A production-grade, public-facing urban generative-power simulation platform that computes and visualises **Power Potential** and **Power-Potential Gradient Rate** for future-city districts from urban geometry, climate inputs, and boundary-condition updates.

---

## Scientific Model Disclosure

> **This application implements a REDUCED-ORDER URBAN MODEL.**
>
> All computed values — Solar Exposure Proxy, Wind Accessibility Proxy, Thermal Differential Proxy, Power Potential, PPGR, and all derived metrics — are dimensionless proxies in the range [0, 1]. They are relative comparison indicators computed from simplified geometric and network approximations.
>
> **This is not:**
> - A full computational fluid dynamics (CFD) solver
> - A full radiative-transfer or spectral solar model
> - A full urban microclimate solver or urban heat island model
> - A power-flow or electrical circuit simulation
>
> **It is designed to be:** scientifically honest, deterministic, reproducible, and useful as a relative tool for comparing urban district configurations and boundary-condition interventions.

---

## Invariant Conceptual Definitions

These definitions are invariant and must not be paraphrased throughout any use of this system:

- **Power Potential**: The degree to which a space under a given boundary configuration can organise physical asymmetries into reachable energetic difference that can be converted into electrical form and made systemically available.

- **Boundary Conditions**: The dynamically updateable spatiotemporal, material, behavioural, and control constraints that determine how physical resource flux becomes reachable energetic difference and whether that difference can be converted and propagated into usable electrical availability.

- **Information Generation Rate**: The rate at which a spatial system opens new distinguishable power-possible states per unit time under boundary-condition updating.

- **Power-Potential Gradient Rate**: The rate at which power potential changes in response to change in boundary conditions.

---

## Simulation Engine — Mathematical Summary

### 1. Spatial Cell Grid
- 2D axis-aligned grid over site extent (default cell size: 20 m; range 10–50 m)
- Each cell stores aggregated geometry, exposure, adjacency, movement, and network values

### 2. Solar Exposure Proxy
Simplified solar geometry (Spencer 1971) with hourly sun-position sampling across a representative day. Shadow occlusion uses 2D polygon projection (shadow length = height / tan(elevation)). Result is sky-weighted exposure, attenuated by cloud-condition scalar. **Not a radiative-transfer computation.**

### 3. Wind Accessibility Proxy
Urban canyon approximation after Oke (1987). Upstream blockage fraction is estimated from building heights and projected widths within a 5-cell search radius. Blended with user BC channel-openness scalar. **Not a CFD or Navier-Stokes solution.**

### 4. Thermal Differential Proxy
Local solar-exposure contrast (population std deviation across cell and neighbours). Higher contrast → higher thermal differential. Amplified by surface class factor. **Not a heat-transfer simulation.**

### 5. Movement-Coupled Event Proxy
Traversable-neighbour degree centrality + weighted proximity to user-defined attractor nodes. **Not an agent-based model.**

### 6. Resource Flux
`RF = w_solar × solar + w_wind × wind + w_thermal × thermal + w_movement × movement`
(all inputs ∈ [0,1]; weights default 0.40/0.20/0.20/0.20)

### 7. Reachable Energetic Difference
`RED = σ(8 × contrast × accessibility − 2)` where σ is the logistic sigmoid.

### 8. Conversion Realizability
Per-layer source-type fit score: PV→solar×0.9, piezo→movement×0.75, thermo→thermal×0.8, hybrid→mean×0.85.

### 9. Systemic Availability
`SA = exp(−0.1 × hop_distance_to_storage) × 0.6 + routing_accessibility × 0.4`
Graph computed by multi-source BFS from storage nodes.

### 10. Boundary-Condition Update Vector
11-dimensional normalised delta vector across: building height, canyon openness, roof orientation, surface exposure, wind channels, thermal exposure, movement density, routing, conversion surfaces, wind direction, solar profile.

### 11. Information Generation Rate
`IGR = 0.7 × new_state_rate + 0.3 × new_transition_rate`
A cell enters a new distinguishable state when any key metric changes by > threshold (default 0.10).

### 12. Broadcast Reach Rate
`BRR ∝ exp(−0.05 × d) × (connectivity) × log(1 + reachable_endpoints)`

### 13. Power Potential (Minimal Mode)
`PP = RF × RED × CR × SA`

### 14. PPGR Minimal Mode
`PPGR_min = |ΔPP| / |ΔBC_vector|`

### 15. PPGR Coupled Mode
`PPGR_coupled = BCUR × IGR × CCE × BRR`

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router (TypeScript) |
| Database | PostgreSQL via Prisma 5 |
| Map | deck.gl 8 + react-map-gl 7 + MapLibre GL |
| Charts | Recharts |
| Deployment | Vercel |
| Package manager | pnpm 9 |

---

## Local Development Setup

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)
- PostgreSQL 14+ running locally

### 1. Clone and install

```bash
git clone https://github.com/platodesignio/EZS.git
cd EZS
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL and DIRECT_URL
```

### 3. Database setup

```bash
# Create the database
createdb gpse

# Run migrations
pnpm db:migrate:dev

# Seed with demo data
pnpm db:seed
```

### 4. Start development server

```bash
pnpm dev
# Open http://localhost:3000
```

The app loads the demo district automatically on first start. Click **Run Simulation** in the left sidebar to compute all metrics.

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "feat: initial deployment"
git push origin main
```

### 2. Create Vercel project

- Connect your GitHub repository at vercel.com
- Set the following environment variables in the Vercel dashboard:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled, e.g. Neon/Supabase) |
| `DIRECT_URL` | Direct PostgreSQL connection string |

### 3. Database (recommended: Neon)

```bash
# Neon provides a free PostgreSQL database with automatic scaling
# Create a project at neon.tech
# Copy the connection string to Vercel env vars
```

### 4. Deploy

The `vercel.json` `buildCommand` runs `prisma generate && prisma migrate deploy && next build` automatically.

### 5. Run seed on Vercel (first deploy only)

```bash
vercel env pull .env.local
pnpm db:seed
```

---

## Usage Guide

### Static District Analysis (Mode 1)
1. The app loads the demo district (Tokyo Grid) on startup
2. Click **▶ Run Simulation** to compute all metrics
3. Switch layers in the **Layers** tab to inspect different metrics
4. Click any cell on the map to open the **Cell Inspector** with full metric decomposition

### Scenario Delta Analysis (Mode 2)
1. Create a new scenario via **Scenarios → New Scenario**
2. Adjust **Boundary Conditions** in the **BC** tab
3. Run the simulation — the app computes PPGR (minimal and coupled)
4. Compare results in the **Bottom Panel → Baseline vs. Intervention**
5. View **Hotspot Ranking** to identify highest PPGR cells

### Publication Mode
- Click **Publication Mode** in the Scenarios tab to hide editing controls
- Exports citation-ready figure styling
- Use **↓ PNG** to export the map view
- Use **↓ CSV** to export all cell data

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/projects` | GET, POST | List/create projects |
| `/api/scenarios?projectId=` | GET, POST | List/create scenarios |
| `/api/scenarios/[id]` | GET, PATCH, DELETE | Scenario CRUD |
| `/api/simulate` | POST | Run simulation for a scenario |
| `/api/runs/[id]` | GET | Load full run data (cells + summary) |
| `/api/runs/[id]/export` | GET | Download run as CSV |
| `/api/feedback` | POST, GET | Submit/list run feedback |

---

## Expected Failure Cases and Remedies

| Symptom | Cause | Remedy |
|---|---|---|
| Map shows blank/white screen | MapLibre tile server unreachable | Check network; the demo tile server is `demotiles.maplibre.org` (free, occasionally slow). Set `NEXT_PUBLIC_MAP_STYLE` to a self-hosted or Mapbox style. |
| Simulation returns "No valid building geometry" | No GeoJSON on scenario | Upload a GeoJSON via the demo district or paste buildings |
| `prisma generate` fails on build | Missing DATABASE_URL | Set `DATABASE_URL` and `DIRECT_URL` in Vercel env vars |
| `prisma migrate deploy` fails | Database not reachable | Verify connection string; use direct (non-pooled) URL for migrations |
| Very slow simulation (> 30s) | Too many cells / small cell size | Increase cell size to 30–50m; district larger than 2km² will be slow |
| `deck.gl` SSR error | Map component not client-only | Verify `DistrictMap` uses `dynamic(..., { ssr: false })` |
| PPGR Minimal = 0 everywhere | Running baseline (no delta) | Create an intervention scenario and simulate against the baseline |
| Cells all showing 0 | No conversion layers selected | Enable at least one layer in **BC → Conversion Surface Assignment** |

---

## Folder Structure

```
EZS/
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── seed.ts              # Demo data seeder
│   └── migrations/          # Migration files
├── public/
│   └── demo/
│       └── district.geojson # Demo building footprints (Tokyo Grid)
└── src/
    ├── app/
    │   ├── layout.tsx       # Root layout
    │   ├── page.tsx         # Main application (single-page)
    │   ├── globals.css      # Global styles
    │   └── api/             # API routes
    │       ├── projects/
    │       ├── scenarios/
    │       ├── simulate/
    │       ├── runs/
    │       └── feedback/
    ├── components/
    │   ├── layout/          # Sidebar, inspector, bottom panel
    │   ├── visualization/   # DistrictMap (deck.gl)
    │   └── feedback/        # FeedbackForm
    ├── lib/
    │   ├── db.ts            # Prisma client singleton
    │   ├── simulation/      # Engine modules
    │   │   ├── engine.ts    # Main orchestrator
    │   │   ├── solar.ts     # Solar exposure proxy
    │   │   ├── wind.ts      # Wind accessibility proxy
    │   │   ├── thermal.ts   # Thermal differential proxy
    │   │   ├── movement.ts  # Movement-coupled event proxy
    │   │   ├── graph.ts     # SA, BRR (BFS graph)
    │   │   ├── boundary.ts  # BC update vector
    │   │   └── normalize.ts # Math utilities
    │   └── utils/
    │       ├── geojson.ts   # GeoJSON parsing
    │       └── export.ts    # CSV export
    └── types/
        ├── simulation.ts    # Core simulation types
        ├── project.ts       # Project/scenario types
        └── api.ts           # API schemas (Zod)
```

---

## Citation

If you use GPSE in academic work, please cite:

> Generative Power Space Explorer (GPSE). Reduced-order urban power-potential simulation platform. platodesignio/EZS. https://github.com/platodesignio/EZS

---

*All values produced by this application are dimensionless proxies computed from simplified geometric approximations. They are not absolute physical quantities and should not be used as the sole basis for engineering decisions.*
