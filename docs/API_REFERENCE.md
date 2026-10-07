# CQRS API Reference & Specification
**Audit Trail — Command & Query API Specification**  
*Author: Person 2 (Chief Architect & Tech Lead) — Raushan Kumar*  
*Milestone: Day 28 Final Architectural Delivery*

---

## 1. Overview & CQRS Separation

Audit Trail strictly enforces Command-Query Responsibility Segregation (CQRS):
- **Command Routes (`/api/commands/*`):** Write side. Accepts intentions, executes OCC checks, emits domain events, appends to immutable Event Store.
- **Query Routes (`/api/queries/*`):** Read side. Pure queries against read models or deterministic historical event replay. Zero side-effects.

---

## 2. Command API (Write Side)

### `POST /api/commands/create`
Creates a new container aggregate on the ledger (Genesis version 1).
```bash
curl -X POST http://localhost:5000/api/commands/create \
  -H "Content-Type: application/json" \
  -d '{
    "shipmentId": "SHIP-PHARMA-2026-EU-JP",
    "cargo": "Pfizer mRNA Vaccines",
    "origin": "Berlin Central Hub",
    "destination": "Port of Tokyo",
    "expectedVersion": 0
  }'
```

### `POST /api/commands/load`
Transitions container status to `LOADED`.
```bash
curl -X POST http://localhost:5000/api/commands/load \
  -H "Content-Type: application/json" \
  -d '{
    "shipmentId": "SHIP-PHARMA-2026-EU-JP",
    "vessel": "Polar Frost Express",
    "port": "Port of Hamburg",
    "expectedVersion": 1
  }'
```

### `POST /api/commands/temperature-spike`
Logs an environmental thermal anomaly with telemetry metrics.
```bash
curl -X POST http://localhost:5000/api/commands/temperature-spike \
  -H "Content-Type: application/json" \
  -d '{
    "shipmentId": "SHIP-PHARMA-2026-EU-JP",
    "temperature": 11.8,
    "threshold": 8.0,
    "humidity": 79.5,
    "batteryVoltage": 3.65,
    "expectedVersion": 2
  }'
```

---

## 3. Query API (Read Side)

### `GET /api/queries/shipments`
Returns a list of all shipment read models with O(1) query latency (< 10ms SLA).

### `GET /api/queries/shipments/:id`
Retrieves live snapshot from `ShipmentReadModel`.

### `GET /api/queries/shipments/:id/events`
Returns full chronological append-only event stream for forensic investigation.

### `GET /api/queries/shipments/:id/as-of/:target`
Point-in-time time-travel state reconstruction as of a target version ($v$) or ISO timestamp without database mutation.

### `GET /api/queries/shipments/:id/telemetry`
Returns structured time-series sensor points for Recharts visualization.
- **Query Parameters:**
  - `?filter=anomalies`: Filter to only anomaly points
  - `?severity=CRITICAL`: Filter by critical severity

### `GET /api/queries/shipments/:id/anomalies`
Returns correlated anomaly catalog with event coincidence linkages.
