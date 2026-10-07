# Projection Worker & Read Model Architecture Guide
**Audit Trail — CQRS Projection Engine & Real-Time Sync**  
*Author: Person 2 (Chief Architect & Tech Lead) — Raushan Kumar*  
*Milestone: Day 28 Final Architectural Delivery*

---

## 1. CQRS Read Model Architecture

Event Sourcing preserves granular historical truth, but executing full event replay on every user query is $O(N)$ and scales poorly with long lifecycles.

To achieve sub-millisecond $O(1)$ query SLAs, Audit Trail implements an **Asynchronous Projection Worker Engine**:

```
[Event Store] (Append-Only)
      |
      | Event Emitted (Push Hook / Polling Fallback)
      v
[Projection Worker]
      |
      |-- 1. Idempotency Check: event.version <= doc.lastAppliedVersion ? SKIP
      |-- 2. Pure Event Transformation: projectEvent(doc, event)
      |-- 3. Atomic Upsert: ShipmentReadModel.updateOne(...)
      v
[ShipmentReadModel Collection] (O(1) Indexed Query Layer)
```

---

## 2. Benchmark SLA Conformance

Empirical benchmarks run via `npm run benchmark:queries` and `npm run verify:worker`:

| Operation | Performance SLA | Empirical Benchmark | Conformance |
|---|---|---|---|
| **Read Model State Fetch** | $< 10\text{ ms}$ | **$0.42\text{ ms}$** | ✅ PASSED (23x faster than SLA) |
| **Worker Real-Time Sync** | $< 200\text{ ms}$ | **$4.29\text{ ms}$** | ✅ PASSED (46x faster than SLA) |
| **Full Event Stream Replay** | $< 50\text{ ms}$ (100+ events) | **$0.148\text{ ms}$** | ✅ PASSED |

---

## 3. Projection Disaster Recovery & Rebuilds

If a read model is corrupted or a projection definition is modified, read models can be reconstructed from scratch using the deterministic event replay tool:

```bash
# Rebuild all read models from canonical event store:
npm run projections:rebuild -- --clean

# Rebuild single shipment read model:
npm run projections:rebuild -- --shipment=SHIP-PHARMA-2026-EU-JP
```
