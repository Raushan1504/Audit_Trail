# Domain Event Catalog & State Transition Invariants
**Audit Trail — Event-Sourced Logistics & Cold-Chain Ledger**  
*Author: Person 1 (Lead Domain Architect) — Yash Kamble (yk3144779@gmail.com)*  
*Milestone: Day 28 Final Architectural Delivery*

---

## 1. Architectural Philosophy: Event Sourcing & Immutability

In Audit Trail, the **Event Store** is the absolute and single source of truth. Rather than storing only the mutable current state in a database, every state transition is recorded as an immutable domain event.

$$\text{Current State } S_n = \text{Initial State } S_0 \star E_1 \star E_2 \star \dots \star E_n$$

Where $\star$ represents the pure, deterministic event applicator function (`applyEvent`).

### Core Ledger Invariants:
1. **Append-Only Immutability:** Existing events can **never** be updated or deleted (`HTTP 405 Method Not Allowed` enforced via `immutabilityGuard`).
2. **Strict Sequential Versioning:** Every event for a shipment has a strictly monotonic version number ($1, 2, 3, \dots, n$).
3. **Optimistic Version Verification:** Command execution requires assertable `expectedVersion`.
4. **Deterministic Reconstruction:** Replaying identical event streams on any node guaranteed produces byte-for-byte identical aggregate states.

---

## 2. Canonical Domain Event Catalog

### Event 1: `CONTAINER_CREATED`
- **Aggregate:** `Shipment`
- **Version:** `1` (Genesis Block)
- **Status Transition:** `null` $\rightarrow$ `CREATED`
- **Payload Schema:**
  ```json
  {
    "cargo": "Pfizer mRNA Cold-Chain Vaccines",
    "origin": "Berlin Central Hub, Germany",
    "destination": "Port of Tokyo, Japan",
    "temperature": 4.0,
    "threshold": 8.0,
    "sensorId": "IOT-REEFER-01"
  }
  ```
- **Business Invariants:**
  - `shipmentId`, `origin`, and `destination` are mandatory.
  - Initial version must be exactly `1`.

---

### Event 2: `LOADED_ON_SHIP`
- **Aggregate:** `Shipment`
- **Version:** `2`
- **Status Transition:** `CREATED` $\rightarrow$ `LOADED`
- **Payload Schema:**
  ```json
  {
    "vessel": "Polar Frost Express",
    "port": "Port of Hamburg",
    "location": "North Sea Maritime Transit",
    "temperature": 4.2,
    "threshold": 8.0,
    "batteryVoltage": 3.88,
    "coordinates": { "lat": 53.5511, "lng": 9.9937 }
  }
  ```
- **Business Invariants:**
  - Cannot occur before `CONTAINER_CREATED`.
  - `vessel` and `port` are mandatory.

---

### Event 3: `TEMPERATURE_SPIKE` (Thermal Anomaly)
- **Aggregate:** `Shipment`
- **Version:** $\ge 3$
- **Status Transition:** `LOADED` $\rightarrow$ `TEMPERATURE_SPIKE`
- **Payload Schema:**
  ```json
  {
    "temperature": 11.8,
    "threshold": 8.0,
    "humidity": 79.5,
    "ambientTemp": 29.4,
    "batteryVoltage": 3.65,
    "sensorId": "SENSOR-PHARMA-01",
    "coordinates": { "lat": 12.8797, "lng": 121.774 }
  }
  ```
- **Business Invariants:**
  - `temperature` and `threshold` are mandatory numbers.
  - Automatically flagged by `anomalyDetector` as `CRITICAL` or `WARNING`.

---

### Event 4: `ARRIVED_AT_PORT` (Terminal State)
- **Aggregate:** `Shipment`
- **Version:** Terminal ($n$)
- **Status Transition:** `LOADED` / `TEMPERATURE_SPIKE` $\rightarrow$ `ARRIVED`
- **Payload Schema:**
  ```json
  {
    "port": "Port of Tokyo",
    "location": "Discharged at Berth 7, Tokyo Cold Terminal",
    "temperature": 3.9,
    "threshold": 8.0,
    "humidity": 52.0,
    "batteryVoltage": 3.52,
    "coordinates": { "lat": 35.6762, "lng": 139.6503 }
  }
  ```
- **Business Invariants:**
  - Terminal event; no subsequent commands permitted.
  - Requires destination `port`.
