# Audit Trail

**Event-Sourced Inventory & Logistics Ledger**  
*MERN • Event Sourcing • CQRS • Optimistic Concurrency Control • 28-Day Team Engineering Roadmap • 84 Planned Commits*

---

### Project Milestone Status

| Phase | Duration | Scope | Status |
|---|---|---|---|
| **Phase 1: Weeks 1 & 2** | Days 1 – 14 | Foundation, CQRS, MongoDB Event Store, React Timeline, Immutability Audit, State Reconstruction | **COMPLETED & VERIFIED** ✅ |
| **Mid-Project Review** | Day 14 | Proof of Event Store Immutability (`APPEND/READ` only, `UPDATE/DELETE` rejected) + Historical Event Replay State Reconstruction | **OFFICIALLY PASSED** ✅ |
| **Phase 2: Week 3** | Days 15 – 21 | High-Performance Read Models (Projections), Background Worker, React Time-Scrubbing Slider | **ACTIVE (Days 15–21)** 🚀 |
| **Phase 3: Week 4** | Days 22 – 28 | Optimistic Concurrency Control (OCC), Recharts Sensor Telemetry, Production Deployment & Final Review | **SCHEDULED (Days 22–28)** 🎯 |

---

## 1. Purpose & Vision

This document is the single source of truth for the three-person engineering team. It provides a complete, month-long roadmap to take **Audit Trail** from the successful Mid-Project Review to an enterprise-grade, publicly deployed MERN application.

Traditional CRUD systems overwrite historical data during updates (e.g., updating stock from 10 to 5 discards the fact that it was ever 10). In regulated logistics, supply chain, and FinTech domains, overwriting state is unacceptable. 

**Audit Trail** implements an **Event-Sourced Architecture with CQRS**:
1. Every state mutation is represented as an **immutable, append-only domain event** stored in MongoDB.
2. Current shipment states can always be mathematically derived by **replaying historical events**.
3. High read performance is achieved via asynchronous **Projections (Read Models)** maintained by a background Node.js worker.
4. Concurrency conflicts are prevented using **Optimistic Concurrency Control (OCC)**.
5. Forensic investigations are supported via **Time-Scrubbing ("Rewind Time")** and **Recharts Sensor Telemetry Visualization**.

---

## 2. Team Target: 1-Month Engineering Workflow

To ensure systematic progress and equal contribution across all teammates, the project follows a disciplined daily commit schedule:

$$\text{3 Team Members} \times \text{1 Meaningful Commit / Day} \times \text{28 Days} = \mathbf{84\ \text{Total Commits}}$$

- **Days 1 – 14 (Commits 1 – 42):** Foundation & Mid-Project Review — **COMPLETED** ✅
- **Days 15 – 28 (Commits 43 – 84):** Projections, Time Travel, OCC, Sensor Analytics & Deployment — **IN PROGRESS / THIS MONTH** 🚀
- Every commit must represent a verifiable feature, test, or architectural component.
- Meaningless commit messages (e.g., `fix`, `update`, `wip`) are strictly prohibited. Follow conventional commit standards (e.g., `feat(projections): ...`, `test(occ): ...`).

---

## 3. Technology & Advanced System Architecture

### Tech Stack
- **Database:** MongoDB Atlas + Mongoose (Event Store collection + Read Model collection)
- **Backend:** Node.js & Express.js (CQRS routers, Domain Aggregates, Background Projection Worker)
- **Frontend:** React 19, Tailwind CSS, React Router v7, Lucide Icons, Recharts (sensor telemetry)
- **Build Tool:** Vite 8
- **Testing:** Node.js Native Test Runner (`node --test`)
- **Deployment:** Vercel (Frontend SPA) + Render / Railway (Backend API & Projection Worker) + MongoDB Atlas

### End-to-End Enterprise Architecture Diagram

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                 CLIENT TIER (React + Vite)              │
                              │  - Forensic Dashboard       - Time-Scrubbing Slider     │
                              │  - Event Timeline View      - Recharts Sensor Graph     │
                              └───────────────────────────┬─────────────────────────────┘
                                                          │ HTTPS / REST
                                     ┌────────────────────┴────────────────────┐
                                     │                                         │
                         COMMANDS    ▼                                         ▼  QUERIES
                   (POST /api/commands)                              (GET /api/queries)
                                     │                                         │
┌────────────────────────────────────┼─────────────────────────────────────────┼────────────────────────────────────┐
│ EXPRESS BACKEND                    │                                         │                                    │
│                                    ▼                                         │                                    │
│                       ┌─────────────────────────┐                            │                                    │
│                       │   Command Controller    │                            │                                    │
│                       └────────────┬────────────┘                            │                                    │
│                                    │                                         │                                    │
│                                    ▼                                         │                                    │
│                       ┌─────────────────────────┐                            │                                    │
│                       │  Shipment Aggregate &   │                            │                                    │
│                       │  OCC Version Validation │                            │                                    │
│                       └────────────┬────────────┘                            │                                    │
│                                    │ Emits Validated Events                  │                                    │
│                                    ▼                                         │                                    │
│                       ┌─────────────────────────┐                            │                                    │
│                       │  Immutable Event Store  │                            │                                    │
│                       │  (Append-Only Log)      │                            │                                    │
│                       └────────────┬────────────┘                            │                                    │
│                                    │                                         │                                    │
│                                    ├──────────────────────┐                  │                                    │
│                                    │                      │                  │                                    │
│                                    ▼                      ▼                  ▼                                    │
│                       ┌─────────────────────────┐    ┌─────────────────────────────────┐                          │
│                       │  Event Replay Engine    │    │ Background Projection Worker    │                          │
│                       │  (Forensic Time-Travel) │    │ (Asynchronous Event Consumer)   │                          │
│                       └────────────┬────────────┘    └────────────────┬────────────────┘                          │
│                                    │                                  │                                           │
└────────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┘
                                     │                                  │ Updates
                                     │ Historical Fold                  ▼
                                     │                     ┌─────────────────────────────┐
                                     │                     │ MongoDB Read Model          │
                                     │                     │ (ShipmentReadModel Cache)   │
                                     │                     └────────────┬────────────────┘
                                     │                                  │ Fast O(1) Reads
                                     └──────────────────┬───────────────┘
                                                        │
                                                        ▼
                                          JSON Response to Dashboard
```

---

## 4. Team Ownership & Responsibilities

| Role | Primary Ownership | Phase 1 Completed (Days 1–14) | Phase 2 Scope (Days 15–28 / Rest of Month) |
|---|---|---|---|
| **Person 1** | **Event Sourcing & Domain Architecture** | Aggregate root, Domain events, Replay fold engine, Immutability guards | Time-travel state reconstruction (`as-of`), OCC domain validation rules, version conflict detection, temporal delta algorithms |
| **Person 2** | **CQRS, MongoDB & Background Workers** | Express setup, Mongoose Event model, CQRS routes, Immutability verification tests | Background projection worker, `ShipmentReadModel` schema & pipeline, OCC persistence verification, production deployment config |
| **Person 3** | **React Forensic Dashboard & Visualizations** | Search bar, initial layout, chronological timeline, current state card | State-scrubbing slider UI ("Rewind Time"), Recharts sensor graphs (temperature & shock spikes), OCC conflict toast alerts, mobile responsiveness |

---

## 5. Repository Structure

```
audit-trail/
├── client/                                  # React 19 Frontend (Vite)
│   ├── public/                              # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── EventTimeline/               # Vertical chronological event stream
│   │   │   ├── SearchBar/                   # Shipment ID lookup & filters
│   │   │   ├── SensorChart/                 # [NEW] Recharts sensor telemetry (temp/humidity)
│   │   │   ├── ShipmentState/               # Active & reconstructed shipment status
│   │   │   ├── TimeSlider/                  # [NEW] State scrubbing rewind slider
│   │   │   └── ui/                          # Alerts, badges, loading skeletons, modal dialogs
│   │   ├── hooks/                           # Custom React hooks (useShipment, useTimeTravel)
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx                # Main forensic operations center
│   │   │   └── ShipmentDetails.jsx          # Deep-dive chronological audit view
│   │   ├── services/
│   │   │   └── api.js                       # Axios/fetch service configured via VITE_API_URL
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vercel.json                          # [NEW] Vercel SPA routing rewrites
│   └── vite.config.js
│
├── server/                                  # Express Backend & Event Engine
│   ├── src/
│   │   ├── audit/                           # Immutability audit demo endpoints & scripts
│   │   ├── commands/                        # CQRS Command layer (Writes only)
│   │   │   ├── commandController.js
│   │   │   ├── commandRoutes.js
│   │   │   └── commandService.js
│   │   ├── config/
│   │   │   └── db.js                        # MongoDB Atlas connection
│   │   ├── domain/                          # Pure business logic & aggregates
│   │   │   ├── shipmentAggregate.js
│   │   │   └── shipmentState.js
│   │   ├── events/                          # Event definitions and repository
│   │   │   ├── eventHandlers.js
│   │   │   └── eventStore.js
│   │   ├── events/eventTypes.js
│   │   ├── middleware/                      # Immutability guard, error & OCC handlers
│   │   ├── models/                          # Mongoose schemas
│   │   │   ├── Event.js                     # Immutable append-only log
│   │   │   └── ShipmentReadModel.js         # [NEW] Denormalized read-optimized model
│   │   ├── queries/                         # CQRS Query layer (Reads only)
│   │   │   ├── queryController.js
│   │   │   ├── queryRoutes.js
│   │   │   └── queryService.js
│   │   ├── workers/                         # [NEW] Background projection workers
│   │   │   └── projectionWorker.js          # Consumes events & updates ShipmentReadModel
│   │   ├── scripts/                         # [NEW] Data seeders & audit verification scripts
│   │   │   └── seedAuditData.js
│   │   └── app.js                           # Express app entry point
│   ├── tests/                               # Node.js native unit & integration test suites
│   ├── package.json
│   └── render.yaml                          # [NEW] Render background worker & web service config
│
├── docs/                                    # System documentation
│   ├── architecture.md
│   ├── cqRS.md
│   ├── event-sourcing.md
│   └── deployment.md                        # [NEW] Step-by-step production deployment guide
│
├── .gitignore
├── README.md
└── package.json                             # Root monorepo dev orchestrator
```

---

## 6. Month-Long Development & Commit Plan

### Phase 1: Foundation & Mid-Project Review (Days 1–14) — [COMPLETED ✅]

All 42 commits for Days 1 through 14 have been committed, peer-reviewed, and merged. Key achievements include:
- **Event Store Model & Immutability:** Strict append-only MongoDB persistence where `PUT`, `PATCH`, and `DELETE` are rejected by middleware and database rules.
- **CQRS Isolation:** Full segregation between `/api/commands` and `/api/queries`.
- **Event Replay State Reconstruction:** Verified mathematical folding of events (`CONTAINER_CREATED` $\rightarrow$ `LOADED_ON_SHIP` $\rightarrow$ `TEMPERATURE_SPIKE` $\rightarrow$ `ARRIVED_AT_PORT`) to reconstruct live shipment states.
- **Mid-Project Review Demonstrations:** Verified using automated audit scripts and interactive UI tests.

---

### Phase 2: Projections & State Scrubbing (Days 15–21 / Week 3) — [ACTIVE]

> **Goal:** High-performance read models to avoid replaying thousands of events on every dashboard page view, paired with a dynamic React Time-Slider to "rewind time" and inspect historical states.

#### Day 15 — Read Model Schema & Event Projection Interface
- **Person 1 (Domain):** `feat(domain): define projection state contract and event apply interfaces`  
  Define strict projection reducer mapping for updating read models on each canonical event.
- **Person 2 (Backend/Worker):** `feat(models): create ShipmentReadModel schema with indexed fields`  
  Design MongoDB `ShipmentReadModel` collection storing current location, status, temperature, and last applied version.
- **Person 3 (React):** `feat(ui): scaffold time-travel control bar and temporal view modes`  
  Build the UI toolbar allowing users to toggle between "Live Current State" and "Historical Inspection Mode".

#### Day 16 — Background Projection Worker
- **Person 1 (Domain):** `feat(projections): implement pure event projection updater logic`  
  Implement the stateless transformer that receives an event and mutates a read model snapshot safely.
- **Person 2 (Backend/Worker):** `feat(workers): implement background Node.js projection worker`  
  Create worker loop / event hook that detects new events appended to the Event Store and updates `ShipmentReadModel`.
- **Person 3 (React):** `feat(ui): design state scrubber slider component`  
  Implement the interactive slider component showing discrete tick marks for each version/event in the shipment lifecycle.

#### Day 17 — Optimized Query Layer (Read Model vs Replay)
- **Person 1 (Domain):** `feat(replay): implement point-in-time state reconstruction algorithm`  
  Build `reconstructStateAsOf(aggregateId, targetVersion)` allowing deterministic state folding up to a specific historical event.
- **Person 2 (Backend/Worker):** `feat(queries): route standard dashboard reads to fast ShipmentReadModel`  
  Update `GET /api/queries/shipments/:id` to fetch directly from the read model with sub-millisecond response times.
- **Person 3 (React):** `feat(ui): connect time slider to temporal state updates`  
  Bind slider adjustments to client-side temporal state rendering with smooth transition animations.

#### Day 18 — Historical "As-Of" API Endpoints
- **Person 1 (Domain):** `feat(domain): add timestamp-based historical cutoff validation`  
  Support reconstructing shipment state as of an ISO timestamp or date range (e.g., "3 days ago").
- **Person 2 (Backend/Worker):** `feat(queries): implement GET /api/queries/shipments/:id/as-of/:target`  
  Create endpoint serving historical reconstructed state without mutating the live read model.
- **Person 3 (React):** `feat(ui): add visual historical state diff indicator`  
  Show clear UI tags comparing the past scrubbed state against the current live state (e.g., "Viewing state at Version 2 of 5").

#### Day 19 — Projection Resiliency & Catch-Up Sync
- **Person 1 (Domain):** `test(projections): test projection accuracy against full historical replay`  
  Write automated tests verifying that `ShipmentReadModel` identically matches state generated by replaying the raw event log.
- **Person 2 (Backend/Worker):** `feat(workers): implement projection catch-up and rebuild script`  
  Add CLI utility `npm run projections:rebuild` that replays all events from scratch to reconstruct the read model if out of sync.
- **Person 3 (React):** `feat(ui): add step-by-step playback controls (Play/Pause/Rewind)`  
  Add automated "playback" controls so logistics managers can click "Play" to watch the shipment evolve over time.

#### Day 20 — Read Model Performance & Load Testing
- **Person 1 (Domain):** `test(replay): test temporal replay with 100+ sequential logistics events`  
  Benchmark memory and execution time when reconstructing deep event histories.
- **Person 2 (Backend/Worker):** `perf(queries): benchmark read model query latency vs raw replay`  
  Document performance gains: show that querying the read model takes <10ms vs >300ms for raw multi-event replay.
- **Person 3 (React):** `feat(ui): add timeline event jump interaction`  
  Enable clicking any event card on the vertical timeline to immediately jump the time slider to that exact moment.

#### Day 21 — Week 3 Milestone Verification & Audit
- **Person 1 (Domain):** `test(review): verify projection consistency across all event types`  
  Ensure `CONTAINER_CREATED`, `LOADED_ON_SHIP`, `TEMPERATURE_SPIKE`, and `ARRIVED_AT_PORT` accurately project to read models.
- **Person 2 (Backend/Worker):** `test(review): verify background worker real-time sync`  
  Demonstrate that dispatching a new command immediately updates the read model within 200ms.
- **Person 3 (React):** `feat(review): polish temporal scrubber UI and historical banner`  
  Ensure scrubbed view displays high-contrast alerts to prevent operators from mistaking past states for live data.

---

### Phase 3: Optimistic Concurrency Control, Recharts & Production Deployment (Days 22–28 / Week 4)

> **Goal:** Enterprise concurrency guarantees (OCC), rich telemetry data visualization using Recharts, stress testing, and public deployment to the cloud.

#### Day 22 — Optimistic Concurrency Control (OCC) Core
- **Person 1 (Domain):** `feat(domain): implement OCC version checking in ShipmentAggregate`  
  Validate that commands provide `expectedVersion`. If the database current version $\neq$ `expectedVersion`, reject with a concurrency conflict.
- **Person 2 (Backend/Worker):** `feat(db): enforce compound unique index on aggregateId and version`  
  Add MongoDB unique index `{ aggregateId: 1, version: 1 }` ensuring two simultaneous commands cannot write the same version number.
- **Person 3 (React):** `feat(ui): track aggregate version in React form state`  
  Capture current loaded version during query fetch and forward it inside subsequent command payloads.

#### Day 23 — Concurrency Conflict Handling & 409 Responses
- **Person 1 (Domain):** `feat(domain): define domain ConcurrencyException with resolution hints`  
  Structure rich error objects explaining who modified the resource and which version was expected.
- **Person 2 (Backend/Worker):** `feat(api): add HTTP 409 Conflict middleware and error response format`  
  Catch OCC violations in Express and return standardized `409 Conflict` responses with current database version.
- **Person 3 (React):** `feat(ui): build optimistic concurrency conflict modal`  
  Display an interactive conflict dialog when a 409 occurs, offering the user a one-click "Refresh with Latest State" action.

#### Day 24 — Recharts Sensor Telemetry Integration
- **Person 1 (Domain):** `feat(domain): enrich TEMPERATURE_SPIKE events with telemetry metrics`  
  Add humidity, battery voltage, ambient temp, and GPS coordinates to domain event payloads.
- **Person 2 (Backend/Worker):** `feat(queries): implement sensor telemetry time-series endpoint`  
  Create `GET /api/queries/shipments/:id/telemetry` returning structured time-series data optimized for charting.
- **Person 3 (React):** `feat(viz): integrate Recharts Line/AreaChart for sensor metrics`  
  Embed an interactive Recharts component plotting temperature and environmental variations across the shipment lifecycle.

#### Day 25 — Sensor Visualization Overlaid on Event Timeline
- **Person 1 (Domain):** `feat(domain): add automated anomaly threshold detection`  
  Flag events that exceed safe thresholds (e.g., temperatures above -18°C for frozen cargo).
- **Person 2 (Backend/Worker):** `feat(queries): correlate sensor anomalies with historical events`  
  Provide query filters highlighting exactly which event coincided with temperature spikes or physical shocks.
- **Person 3 (React):** `feat(viz): synchronize Recharts hover tooltip with timeline cards`  
  Hovering over a sensor spike on the Recharts graph highlights the corresponding `TEMPERATURE_SPIKE` event card.

#### Day 26 — Enterprise Polish, Seeding & UI Feedback
- **Person 1 (Domain):** `feat(scripts): build comprehensive logistics scenario seed generator`  
  Create realistic datasets: pharmaceutical cold chain, trans-oceanic container shipping, and hazardous cargo routes.
- **Person 2 (Backend/Worker):** `perf(api): implement HTTP response caching and compression`  
  Add compression middleware, CORS hardening, rate limiting, and production environment guards.
- **Person 3 (React):** `feat(ui): responsive design audit, dark mode accents & keyboard navigation`  
  Polish typography, mobile layout, accessibility (ARIA), and micro-interactions.

#### Day 27 — Production Cloud Deployment Setup
- **Person 1 (Domain):** `test(e2e): execute full-system end-to-end integration test suite`  
  Validate the complete loop: Command $\rightarrow$ OCC check $\rightarrow$ Event append $\rightarrow$ Projection worker $\rightarrow$ Dashboard update.
- **Person 2 (Backend/Worker):** `chore(deploy): configure backend on Render/Railway and Atlas`  
  Configure production MongoDB Atlas cluster, environment secrets, and backend web service deployment.
- **Person 3 (React):** `chore(deploy): configure Vercel frontend deployment and rewrite rules`  
  Deploy client application to Vercel, connect production API URL, and verify SSL and custom routing.

#### Day 28 — Final Architectural Review & Delivery Sign-Off
- **Person 1 (Domain):** `docs: finalize domain event catalog and OCC technical documentation`  
  Document all domain events, invariants, and aggregate lifecycles.
- **Person 2 (Backend/Worker):** `docs: finalize API reference and projection architecture guide`  
  Publish complete Swagger/Markdown API specifications and system benchmark figures.
- **Person 3 (React):** `docs: prepare live demo walkthrough and forensic case study`  
  Create interactive presentation showing live command dispatch, conflict handling, time-travel scrubbing, and sensor analytics.

---

## 7. Production Deployment Guide: Vercel vs Netlify

### Architectural Evaluation: Where to Deploy?

| Platform | Frontend (React/Vite) | Backend (Express/Node.js) & Background Worker | Recommendation |
|---|---|---|---|
| **Vercel** | ⭐ **Best-in-Class:** Native Vite/React support, instant edge propagation, automatic SSL, preview deployments for GitHub PRs. | ⚠️ **Serverless Only:** Vercel functions are stateless and time out after 10–15s. They **cannot run persistent background workers** (like our projection worker). | **Deploy Frontend on Vercel** |
| **Netlify** | ✅ Good: Supports static SPAs and basic edge functions. | ⚠️ **Serverless Only:** Same limitation as Vercel; cannot run continuous Express servers or persistent database listeners. | Viable frontend alternative |
| **Render / Railway** | ⚠️ Not optimized for static SPA hosting (slower CDN than Vercel). | ⭐ **Best-in-Class for Backend:** Runs continuous, persistent Docker/Node.js processes, background workers, and persistent MongoDB connections with 0 serverless timeouts. | **Deploy Backend on Render or Railway** |

> ### 💡 Recommended Production Architecture
> - **Frontend:** Deploy to **Vercel** (Free, ultrafast global CDN, zero-config for Vite).
> - **Backend & Worker:** Deploy to **Render** (Free Web Service tier, supports persistent Node.js servers).
> - **Database:** **MongoDB Atlas** (Free M0 shared cluster with global access).

---

### Step-by-Step Deployment Instructions

#### Step 1: Configure MongoDB Atlas
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Network Access**, add `0.0.0.0/0` (Allow Access from Anywhere) so Render/Vercel can connect.
3. Under **Database Access**, create a user (e.g., `audit_admin`) with a secure password.
4. Obtain the connection string:
   ```
   mongodb+srv://audit_admin:<password>@cluster0.xxxxx.mongodb.net/audit_trail?retryWrites=true&w=majority
   ```

#### Step 2: Deploy Backend to Render
1. Create a free account on [Render](https://render.com).
2. Click **New +** $\rightarrow$ **Web Service** $\rightarrow$ Connect your GitHub repository `Audit_Trail`.
3. Configure the service:
   - **Name:** `audit-trail-backend`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/app.js`
4. Add **Environment Variables**:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   - `CORS_ORIGIN`: `https://your-frontend-domain.vercel.app` (or `*` during initial testing)
5. Click **Deploy Web Service**. Once deployed, copy your backend URL (e.g., `https://audit-trail-backend.onrender.com`).
6. Verify deployment by visiting `https://audit-trail-backend.onrender.com/health` $\rightarrow$ should return `{"status":"ok"}`.

#### Step 3: Deploy Frontend to Vercel
1. Create a free account on [Vercel](https://vercel.com).
2. Click **Add New...** $\rightarrow$ **Project** $\rightarrow$ Import your GitHub repository `Audit_Trail`.
3. Configure the project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Expand **Environment Variables**:
   - `VITE_API_URL`: `https://audit-trail-backend.onrender.com/api`
5. Configure client-side routing rewrites:
   Create a `client/vercel.json` file in the repo to support React Router:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
6. Click **Deploy**. Vercel will build and assign a public URL (e.g., `https://audit-trail.vercel.app`).

#### Alternative: Deploying Frontend to Netlify
If you prefer Netlify:
1. Connect repository on [Netlify](https://www.netlify.com).
2. Set **Base directory** to `client`, **Build command** to `npm run build`, and **Publish directory** to `client/dist`.
3. Add environment variable `VITE_API_URL` pointing to your Render backend.
4. Add a `client/public/_redirects` file with:
   ```
   /*    /index.html   200
   ```

---

## 8. AI-Assisted Development Protocol

The team leverages AI as an implementation accelerator while maintaining human ownership of architectural correctness.

```
Context → Prompt → AI Generation → Critical Code Review → Unit Tests → Git Diff Verification → Commit
```

### Standard AI Engineering Prompt Format

When collaborating with an AI coding assistant, always provide this structural context:

```markdown
You are assisting the Audit Trail engineering team.

PROJECT CONTEXT:
- Architecture: MERN, Event Sourcing, CQRS, Optimistic Concurrency Control (OCC)
- Source of Truth: Append-only MongoDB Event Store (No UPDATE/DELETE)
- Read Optimization: Asynchronous MongoDB ShipmentReadModel populated by background worker
- Visualizations: React 19, Recharts for telemetry, Time-Scrubbing Slider for temporal replay

MY ASSIGNED TASK TODAY:
[PASTE EXACT TASK FROM ROADMAP, e.g., Day 22 OCC version checking]

CONSTRAINTS:
1. Maintain strict CQRS boundaries.
2. Never introduce direct mutation to historical events.
3. Validate all inputs with descriptive domain error objects.
4. Provide unit tests using Node.js native test runner.
```

---

## 9. Comprehensive Review & Evaluation Rubric

### 1. Mid-Project Review (Completed ✅)
- [x] Append-only Event Store in MongoDB.
- [x] Immutability Audit: Server prevents `PUT`, `PATCH`, and `DELETE` on historical events.
- [x] State Reconstruction: Calculating current state by replaying historical events.
- [x] CQRS route segregation: `/api/commands` vs `/api/queries`.
- [x] Chronological React timeline rendering.

### 2. Final Project Review Checklist (Target: Day 28)
- [ ] **Read Model Projections:** `ShipmentReadModel` updated in real time by background worker.
- [ ] **State Scrubbing:** Working UI slider allowing time-travel through past shipment states.
- [ ] **Optimistic Concurrency Control:** Concurrency conflicts return `409 Conflict` and prompt UI recovery.
- [ ] **Sensor Telemetry:** Recharts visualization plotting temperature variations against shipment milestones.
- [ ] **Production Deployment:** Publicly accessible live URLs on Vercel and Render with zero console/CORS errors.
- [ ] **Commit Discipline:** Exactly 84 planned commits across all 3 team members.

---

## 10. Local Development Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Local MongoDB or MongoDB Atlas URI

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/Raushan1504/Audit_Trail.git
cd Audit_Trail

# 2. Install dependencies
npm install
npm install --prefix server
npm install --prefix client

# 3. Configure environment variables
cp server/.env.example server/.env
# Update MONGODB_URI in server/.env

# 4. Launch both Server and Client concurrently
npm run dev

# 5. Run test suites
npm test --prefix server
npm test --prefix client
```

---

*Audit Trail is developed in alignment with Axlero Solutions Advanced MERN Stack Engineering Specifications.*
