# Forensic Case Study & Live Evaluation Walkthrough
**Audit Trail — Cold-Chain Spoilage Investigation Guide**  
*Project Team: Aman Kumar (Lead Forensic Analyst / Person 3), Raushan Kumar (Chief Architect & Tech Lead / Person 2), Yash Kamble (Chhotadon - Lead Domain Architect / Person 1)*  
*Milestone: Day 28 Final Architectural Delivery*

---

## 1. Executive Summary & Incident Scenario

- **Case File:** `#INC-2026-PHARMA-09`
- **Shipment Aggregate:** `SHIP-PHARMA-2026-EU-JP`
- **Cargo:** 10,000 Vials of Pfizer-BioNTech mRNA COVID Vaccines (Value: \$1,200,000 USD)
- **Required Invariant:** Must remain continuously cooled between $2.0^\circ\text{C}$ and $8.0^\circ\text{C}$.
- **Incident:** Consignee in Tokyo reports cargo arrived spoiled and refused delivery. Both maritime carrier and port terminal disclaim liability.
- **Forensic Objective:** Reconstruct chronological state, pinpoint exact temporal breach, verify ledger cryptographic immutability, and assign definitive liability.

---

## 2. Step-by-Step Live Demo Script (For Viva & Presentation)

### Step 1: Shipment Discovery & Read Model Lookup
1. Open dashboard at `http://localhost:5173/`.
2. Enter shipment ID `SHIP-PHARMA-2026-EU-JP` in search bar.
3. Observe instantaneous $O(1)$ response loaded from `ShipmentReadModel` ($< 10\text{ ms}$).

### Step 2: Temporal State Travel & Scrubber Rewind
1. Toggle **Historical Inspection Mode** on the time scrubber slider.
2. Step back to **Version 1 (Genesis Block)**:
   - State shows container created in Berlin at nominal $4.0^\circ\text{C}$.
3. Step to **Version 2 (Ocean Transit)**:
   - State shows loaded aboard *Polar Frost Express* in North Sea at $4.2^\circ\text{C}$.
4. Step to **Version 3 (Thermal Anomaly Event — `TEMPERATURE_SPIKE_DETECTED`)**:
   - Recharts telemetry graph and Event Timeline simultaneously highlight in glowing red.
   - Domain Event `TEMPERATURE_SPIKE_DETECTED` recorded with cryptographic payload integrity.
   - Temperature spiked to $11.8^\circ\text{C}$ (+3.8°C over safe limit), ambient temp was $29.4^\circ\text{C}$, GPS coordinates pinpoint tropical ocean sector.
   - Liability assigned indisputably to vessel operator during open ocean transit.

### Step 3: Interactive Recharts Anomaly Hover
1. Hover cursor over the anomaly spike at Version 3 on Recharts graph.
2. Observe Event Timeline card for Version 3 immediately pulse with badge:  
   `🔥 ANOMALY CORRELATED (+3.8°C BREACH)`.

### Step 4: Optimistic Concurrency Control (OCC) Demonstration
1. While inspecting historical version 2, attempt to dispatch command `ARRIVE_AT_PORT`.
2. Notice the **Optimistic Concurrency Conflict Modal (409)** trigger instantly!
3. Dialog shows:  
   `Asserted Version: v2` $\neq$ `Current Confirmed Version: v4`.
4. Click **"Refresh with Latest State"** to safely recover with 0 data loss.

---

## 3. High-Frequency Viva Questions & Model Answers

**Q1: Why Event Sourcing instead of traditional CRUD?**  
*Answer:* In CRUD, `UPDATE shipments SET temperature = 11.8` overwrites the past, destroying forensic accountability. In Event Sourcing, every state change is an immutable fact appended to history, allowing mathematically deterministic time-travel and auditability.

**Q2: What is the purpose of CQRS?**  
*Answer:* It decouples writes (commands optimized for business invariants and OCC validation) from reads (read models optimized for sub-millisecond query performance). Writes write to the Event Store; an asynchronous projection worker materializes fast queryable read models.

**Q3: How does OCC protect against lost updates?**  
*Answer:* Each command asserts an `expectedVersion`. If another process modified the aggregate in the interim, the version disparity triggers a 409 conflict, rejecting the command and preserving ledger consistency.
