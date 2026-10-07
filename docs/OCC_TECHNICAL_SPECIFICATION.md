# Optimistic Concurrency Control (OCC) Specification
**Audit Trail — Concurrency Invariants & HTTP 409 Resolution**  
*Author: Person 1 (Lead Domain Architect) — Yash Kamble (yk3144779@gmail.com)*  
*Milestone: Day 28 Final Architectural Delivery*

---

## 1. Concurrency Model Overview

In distributed logistics, multiple port operators, automated IoT hubs, and dispatchers may attempt simultaneous commands against the same container aggregate.

To prevent silent overwrites and lost updates, Audit Trail enforces **Multi-Layer Optimistic Concurrency Control (OCC)**:
1. **Domain Layer Validation:** Commands must explicitly submit `expectedVersion`.
2. **MongoDB Compound Unique Index:** `{ aggregateId: 1, version: 1 }` guarantees atomic hardware-level uniqueness.
3. **Application Layer 409 Conflict:** Express middleware intercepts version disparity or duplicate-key errors and produces standardized `HTTP 409 Conflict` JSON responses.

---

## 2. OCC Verification Flow

```
Client/UI (React)
    |
    | POST /api/commands/... { expectedVersion: 2 }
    v
Express Command Router
    |
    v
Shipment Aggregate OCC Validator
    |-- expectedVersion !== currentVersion?
    |       |--> Throw ConcurrencyException (409)
    |
    v
Mongo Event Store Append
    |-- Duplicate key error E11000 on (aggregateId, version)?
    |       |--> Error Handler maps to 409 CONCURRENCY_CONFLICT
    v
Success: Version 2 -> 3
```

---

## 3. Standardized HTTP 409 Conflict Schema

When a concurrency collision is detected, the API returns:

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONCURRENCY_CONFLICT",
  "message": "Concurrency conflict: expected version 2, but current version is 3.",
  "conflict": {
    "shipmentId": "SHIP-PHARMA-2026-EU-JP",
    "expectedVersion": 2,
    "currentVersion": 3,
    "modifiedBy": "Port Terminal Automated Gateway",
    "resolutionHint": "Shipment 'SHIP-PHARMA-2026-EU-JP' was modified concurrently (current version is v3). Refresh latest state and retry with expectedVersion: 3."
  }
}
```

---

## 4. Frontend Recovery Pattern

The React Forensic Dashboard (`ConcurrencyConflictModal.jsx`) captures this response:
1. Freezes the submission attempt.
2. Displays side-by-side version disparity (Asserted: v2 vs Confirmed: v3).
3. Offers a **1-Click "Refresh with Latest State"** recovery button.
4. Auto-synchronizes the form state with the latest confirmed version vector, enabling zero-data-loss retries.
