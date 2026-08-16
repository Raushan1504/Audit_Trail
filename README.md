# Audit Trail

**14-Day Team Development, GitHub & AI-Assisted Coding Workflow**

MERN • Event Sourcing • CQRS • 42 planned commits • Mid-Project Review by Day 14

## 1. Purpose

This document is the single source of truth for the three-person development team. It combines project architecture, folder structure, ownership, the 14-day commit plan, AI-assisted coding rules, prompt context, Git workflow, testing expectations, and the Mid-Project Review checklist.

The source project brief defines Audit Trail as an Event-Sourced Inventory & Logistics Ledger. It specifically calls for a MongoDB append-only Event Store, a Node.js Event Sourcing Engine, CQRS, and a React/Recharts forensic dashboard.

The official Week 2 milestone is the Mid-Project Review: prove Event Store immutability and prove shipment-state reconstruction by replaying historical events.

## 2. Team Target

Three members × one meaningful commit per member per day × 14 days = **42 planned commits**.

- Exactly one meaningful commit per person per day.
- No meaningless commits such as `update`, `changes`, or `final`.
- Each commit must correspond to a real engineering contribution.
- All code is AI-assisted, but every team member remains responsible for understanding, testing and reviewing their code.
- The Day 14 goal is the Mid-Project Review, not the completion of every Week 3/Week 4 feature.

## 3. Technology & Architecture

- **MongoDB + Mongoose** — persistence and Event Store.
- **Express.js + Node.js** — API and Event Sourcing engine.
- **React.js** — forensic dashboard.
- **Recharts** — later-stage sensor visualization.
- **Event Sourcing** — historical events are the source of truth.
- **CQRS** — separate command/write and query/read responsibilities.

```
React Forensic Dashboard
        │
        │ REST API
        ▼
Express / Node.js
        │
        ├───────────────┐
        │               │
   COMMAND SIDE     QUERY SIDE
        │               │
        ▼               ▼
Shipment Domain     Read/Query Layer
   Aggregate             │
        │                │
        ▼                │
Immutable Event Store ◄──┘
        │
        ▼
   Event Replay
        │
        ▼
Current Shipment State
```

### Core Event Flow

```
User Action
    ↓
React
    ↓
POST /api/commands/...
    ↓
Express Command Route
    ↓
Command Service
    ↓
Shipment Aggregate / Domain Validation
    ↓
Create Domain Event
    ↓
Append Event to MongoDB Event Store
    ↓
Historical Events remain immutable
    ↓
Query / Replay
    ↓
Reconstruct Current State
    ↓
React Timeline + State
```

### Example Event Stream

```
CONTAINER_CREATED
        ↓
LOADED_ON_SHIP
        ↓
TEMPERATURE_SPIKE
        ↓
ARRIVED_AT_PORT
```

The project brief uses this type of chronological event stream to illustrate reconstruction of a shipment's state.

## 4. Team Ownership

| Member | Primary Ownership | Main Areas |
|---|---|---|
| Person 1 | Event Sourcing & Domain | `events/`, `domain/`, replay, state reconstruction, concurrency later |
| Person 2 | CQRS, MongoDB & Backend | `config/`, `models/`, `commands/`, `queries/`, Event Store persistence, tests |
| Person 3 | React Forensic Dashboard | `components/`, `pages/`, `hooks/`, API integration, timeline, visualization |

> Ownership is not isolation. All three members must understand the end-to-end flow well enough to explain it during review.

## 5. Repository Structure

```
audit-trail/
│
├── client/                         # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar/
│   │   │   ├── EventTimeline/
│   │   │   ├── ShipmentState/
│   │   │   └── LoadingState/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── ShipmentDetails.jsx
│   │   ├── hooks/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                         # Node + Express backend
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   │   ├── Event.js
│   │   │   └── ShipmentReadModel.js
│   │   ├── events/
│   │   │   ├── eventTypes.js
│   │   │   ├── eventStore.js
│   │   │   └── eventHandlers.js
│   │   ├── domain/
│   │   │   ├── shipmentAggregate.js
│   │   │   └── shipmentState.js
│   │   ├── commands/
│   │   │   ├── commandController.js
│   │   │   ├── commandRoutes.js
│   │   │   └── commandService.js
│   │   ├── queries/
│   │   │   ├── queryController.js
│   │   │   ├── queryRoutes.js
│   │   │   └── queryService.js
│   │   ├── middleware/
│   │   └── app.js
│   ├── tests/
│   └── package.json
│
├── docs/
│   ├── architecture.md
│   ├── event-sourcing.md
│   ├── cqrs.md
│   └── ai-context.md
│
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## 6. GitHub Workflow

```
main
  │
  └── develop
        ├── feature/person-1-event-sourcing
        ├── feature/person-2-cqrs-backend
        └── feature/person-3-dashboard
```

- Pull the latest `develop` before starting the day's work.
- Work only in the assigned area unless integration requires coordination.
- Run the application and relevant tests.
- Inspect `git diff` before committing.
- Make exactly one meaningful commit for the day's assigned work.
- Push the branch and open/update a Pull Request.
- At least one teammate reviews the change before it is merged.
- Do not directly push unfinished work to `main`.

## 7. AI-Assisted / Vibe Coding Rules

The entire project may be developed with AI assistance. AI is the implementation accelerator; the team remains responsible for architecture, correctness and verification.

```
Context → Prompt → Generate → Understand → Test → Review → Commit
```

**Never do this**

```
Prompt → Copy → Commit
```

**Do this**

```
Context → Specific task → Existing code → Constraints → AI output → Human review → Tests → Git diff → Commit
```

### Standard AI Context

```
We are building a MERN application called "Audit Trail — Event-Sourced Inventory & Logistics Ledger".

STACK
- MongoDB + Mongoose
- Express.js
- Node.js
- React.js
- Recharts later in the project

ARCHITECTURE
- Event Sourcing
- CQRS
- Append-only MongoDB Event Store
- Shipment Aggregate / Domain Logic
- Event Replay / State Reconstruction
- Later: Projection / Read Model
- Later: Optimistic Concurrency Control
- Later: React + Recharts forensic analytics

CORE IDEA
The Event Store is the source of truth. We do NOT treat a mutable current-state document as the primary source of truth.
A shipment's current state is reconstructed by replaying its historical events.

EXAMPLE EVENT STREAM
CONTAINER_CREATED
→ LOADED_ON_SHIP
→ TEMPERATURE_SPIKE
→ ARRIVED_AT_PORT

EVENT SHAPE
{
  aggregateId,
  eventType,
  payload,
  timestamp,
  version
}

CQRS
Commands change the system by producing events.
Queries read/reconstruct state.
Do not mix command and query responsibilities.

IMMUTABILITY
Historical events must not be updated or deleted.
Only append/read behavior is allowed for the historical Event Store.

CURRENT REPOSITORY STRUCTURE
[PASTE THE CURRENT TREE HERE]

CURRENT IMPLEMENTATION STATUS
[PASTE WHAT HAS ALREADY BEEN COMPLETED]

TODAY'S ASSIGNED TASK
[PASTE THE EXACT TASK FROM THE 14-DAY PLAN]

CONSTRAINTS
- MERN only unless the team explicitly approves another dependency.
- Do not change the architecture without discussing it with the team.
- Do not rewrite unrelated files.
- Do not introduce unnecessary dependencies.
- Reuse existing naming conventions and modules.
- Preserve existing working behavior.
- Prefer small, modular functions.
- Explain important architectural decisions.
- Provide tests for meaningful backend logic.
```

### Standard Task Prompt

```
You are assisting with the Audit Trail MERN project.

PROJECT CONTEXT
[PASTE THE STANDARD PROJECT CONTEXT ABOVE]

CURRENT CODE
[PASTE ONLY THE RELEVANT FILES/CODE]

MY TASK TODAY
[PASTE ONE TASK FROM THE DAILY PLAN]

REQUIREMENTS
1. First explain the approach in simple terms.
2. Identify which files should change.
3. Do not modify unrelated files.
4. Follow the existing architecture.
5. Keep Event Sourcing and CQRS boundaries intact.
6. Do not introduce CRUD updates/deletes to historical events.
7. Do not invent APIs/models that conflict with the existing code.
8. After the implementation, provide tests or concrete manual test steps.
9. Mention important edge cases.
10. If existing code is wrong or incomplete, point that out before rewriting it.

OUTPUT FORMAT
A. Approach
B. Files to change
C. Implementation
D. Tests
E. Edge cases
F. What I should verify before committing
```

### AI Code Review Prompt

```
Review the following AI-generated change as a senior MERN engineer.

PROJECT ARCHITECTURE
- MongoDB + Express + React + Node.js
- Event Sourcing
- CQRS
- Append-only Event Store
- Event Replay
- Shipment Aggregate

CHECK FOR
- Event Sourcing violations
- CQRS violations
- Accidental UPDATE/DELETE of historical events
- Incorrect event ordering/versioning
- Race conditions
- Async/await mistakes
- MongoDB/Mongoose problems
- Error handling
- Security or secret leakage
- Unnecessary dependencies
- Duplicate logic
- Breaking changes to existing modules
- Missing tests
- Edge cases

Do not rewrite the code immediately.
First list issues by severity:
CRITICAL / HIGH / MEDIUM / LOW
Then explain the safest fixes.
```

### Rules for Giving Context

- Give the AI the project architecture before asking for architectural code.
- Give the current folder tree when asking for new files or modules.
- Give the existing relevant code when modifying an existing module.
- State exactly what is allowed to change and what must not change.
- Ask for the smallest safe change instead of a full rewrite.
- Ask the AI to explain the approach before complex implementation.
- Ask for tests and edge cases after implementation.
- Never paste secrets, passwords, API keys or private credentials into an AI prompt.

### Developer Verification Before Commit

```
AI-generated code
      ↓
Read it
      ↓
Explain it
      ↓
Run it
      ↓
Test normal + edge cases
      ↓
git diff
      ↓
Check for unrelated changes/secrets
      ↓
Commit
```

## 8. 14-Day Work & Commit Plan

### Day 1 — Foundation

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `chore(domain): initialize event sourcing domain structure`<br><br>Create `server/src/domain` and `server/src/events`. Define the initial domain boundaries without implementing business logic. | `chore(server): initialize Express backend structure`<br><br>Initialize Node/Express, src structure, `app.js`, middleware placeholder and environment configuration. | `chore(client): initialize React dashboard`<br><br>Create React app, base layout, routing/page placeholders and initial dashboard shell. |

### Day 2 — Database + Domain

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(domain): define shipment aggregate and state`<br><br>Define shipment aggregate/state concepts: shipmentId, location, status, temperature and version. | `feat(db): configure MongoDB connection`<br><br>Configure MongoDB/Mongoose connection using environment variables. Verify the connection. | `feat(ui): create dashboard layout`<br><br>Create Dashboard, SearchBar and ShipmentDetails component/page structure. |

### Day 3 — Events + CQRS Routes

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(events): define shipment event types`<br><br>Define canonical events such as CONTAINER_CREATED, LOADED_ON_SHIP, TEMPERATURE_SPIKE and ARRIVED_AT_PORT. | `feat(cqrs): create command and query route structure`<br><br>Create separate `/api/commands` and `/api/queries` route boundaries. | `feat(ui): add shipment search component`<br><br>Build shipment/container ID search input and basic interaction state. |

### Day 4 — Event Store Model

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(events): implement domain event creation`<br><br>Define the event object shape and event creation logic. | `feat(event-store): create MongoDB event model`<br><br>Create Event Mongoose model with aggregateId, eventType, payload, timestamp and version. | `feat(ui): create shipment details view`<br><br>Display shipment ID, current state placeholders and version information. |

### Day 5 — Command Flow

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(domain): implement shipment command validation`<br><br>Validate commands before events are generated. Cover valid and invalid state transitions. | `feat(commands): implement shipment command service`<br><br>Implement controller/service flow: HTTP request → command service → domain. | `feat(ui): connect shipment search to API`<br><br>Connect React search to the backend query endpoint/service layer. |

### Day 6 — Persisting Events

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(event-store): integrate domain events with persistence`<br><br>Connect domain event creation to Event Store persistence. | `feat(event-store): implement append-only event repository`<br><br>Implement `appendEvent` and `getEventsByAggregateId`. Do not implement update/delete operations for historical events. | `feat(timeline): create event timeline component`<br><br>Create the initial vertical timeline component for shipment history. |

### Day 7 — Query Flow

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(replay): implement event replay reducer`<br><br>Implement the reducer/fold logic that applies events sequentially to a shipment state. | `feat(queries): implement shipment query service`<br><br>Implement the query service and `GET /api/queries/shipment/:id`. | `feat(timeline): render shipment event history`<br><br>Render events chronologically with event type and timestamp. |

### Day 8 — Reconstruction

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(replay): reconstruct shipment state from events`<br><br>Fetch an aggregate's event stream and reconstruct its current state by replay. | `feat(queries): expose reconstructed shipment state`<br><br>Connect replay logic to the Query API and return the reconstructed state. | `feat(state): display reconstructed shipment state`<br><br>Display the backend-reconstructed state in the React UI. |

### Day 9 — Event Metadata

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(events): add event versioning and timestamps`<br><br>Ensure every event has aggregateId, eventType, payload, timestamp and version. | `feat(db): add event store indexes`<br><br>Add indexes needed for aggregate/event retrieval and ordering. | `feat(timeline): display event metadata`<br><br>Show event type, timestamp, version and shipment/aggregate ID. |

### Day 10 — Validation + Errors

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `feat(domain): add invalid command handling`<br><br>Reject invalid commands and impossible state transitions. | `feat(api): add backend validation and error middleware`<br><br>Standardize validation errors, not-found responses and server errors. | `feat(ui): add loading and error states`<br><br>Handle loading, not-found, empty timeline and server-error states. |

### Day 11 — Integration Testing

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `test(replay): add aggregate reconstruction tests`<br><br>Test multiple event sequences and verify the final reconstructed state. | `test(event-store): add event persistence tests`<br><br>Verify events are appended and retrieved in the correct order. | `test(ui): validate shipment investigation flow`<br><br>Verify search → shipment state → event timeline flow. |

### Day 12 — Immutability

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `test(events): verify historical events remain unchanged`<br><br>Verify replay and domain logic never mutate historical events. | `feat(event-store): enforce append-only persistence`<br><br>Ensure the Event Store exposes append/read behavior only for historical events; explicitly test that update/delete paths are unavailable or rejected. | `feat(timeline): add immutable event indicators`<br><br>Make the UI clearly distinguish historical immutable events. |

### Day 13 — Full Reconstruction Check

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `test(replay): validate complete shipment reconstruction`<br><br>Test a complete sequence such as CREATED → LOADED → TEMPERATURE_SPIKE → ARRIVED_AT_PORT and verify the resulting state. | `test(integration): validate command-to-event workflow`<br><br>Verify Command → Domain → Event → MongoDB end-to-end. | `test(integration): validate forensic dashboard workflow`<br><br>Verify Search → API → Events → Timeline → Current State. |

### Day 14 — Mid-Project Review

| Person 1 — Event Sourcing | Person 2 — Backend / CQRS | Person 3 — React |
|---|---|---|
| `test(review): complete event sourcing reconstruction audit`<br><br>Prepare the reconstruction demonstration: historical event sequence → replay → current shipment state. | `test(review): complete event store immutability audit`<br><br>Prepare the immutability demonstration: APPEND works; UPDATE/DELETE of historical events are rejected/prevented. | `feat(review): finalize forensic event timeline`<br><br>Polish the timeline and make the review flow easy to demonstrate to the reviewer. |

## 9. Daily Definition of Done

- Assigned task is implemented.
- Application still runs.
- Relevant tests or manual verification are completed.
- No unrelated files were changed.
- AI-generated code was reviewed by the developer.
- `git diff` was inspected.
- No secrets or credentials were committed.
- One meaningful commit was created.
- Branch was pushed and the change is ready for review.

## 10. Mid-Project Review — Day 14

The source brief defines two explicit checks for this milestone.

### A. Immutability Audit

```
APPEND  → ✓
READ    → ✓
UPDATE  → ✗
DELETE  → ✗
```

- Show the MongoDB Event Store.
- Show that events contain aggregateId, eventType, payload, timestamp and version.
- Demonstrate that historical events are not updated.
- Demonstrate that historical events are not deleted.
- Explain why append-only storage preserves the audit trail.

### B. Reconstruction Check

```
Historical Events
       ↓
CONTAINER_CREATED
       ↓
LOADED_ON_SHIP
       ↓
TEMPERATURE_SPIKE
       ↓
ARRIVED_AT_PORT
       ↓
Event Replay / Fold
       ↓
Current Shipment State
```

- Choose a shipment.
- Display its historical events in chronological order.
- Replay those events in the backend.
- Show the reconstructed current state.
- Explain that the historical event sequence is the source of truth.

## 11. Review Checklist

**CQRS**
- [ ] Command and Query routes are separated.
- [ ] Command flow produces events.
- [ ] Query flow reads/reconstructs state.
- [ ] Controllers/services are not one monolithic route.

**Event Store**
- [ ] MongoDB Event model exists.
- [ ] aggregateId exists.
- [ ] eventType exists.
- [ ] payload exists.
- [ ] timestamp exists.
- [ ] version exists.
- [ ] Historical events cannot be updated/deleted.

**Event Sourcing**
- [ ] Historical events are the source of truth.
- [ ] Shipment state can be reconstructed by replay.
- [ ] Multiple event sequences are tested.

**React**
- [ ] Shipment search works.
- [ ] Shipment details work.
- [ ] Event timeline renders chronologically.
- [ ] Current reconstructed state is visible.
- [ ] Loading/error/empty states exist.

**GitHub**
- [ ] 42 planned meaningful commits.
- [ ] Branches and PRs are used.
- [ ] Commit messages are descriptive.
- [ ] No secrets are committed.
- [ ] Every member has reviewed the final milestone.

## 12. After Day 14

Do not force Week 3/Week 4 features into the first 14 days. After the Mid-Project Review, continue with the source brief's remaining milestones:

```
Week 3
  ├── Projection / Read Model
  ├── Background Node.js Projection Worker
  └── React State Scrubbing

Week 4
  ├── Optimistic Concurrency Control
  ├── Recharts Sensor Visualization
  ├── Refinement / Polish
  └── Final Review
```

The source brief explicitly assigns projections/read models and state scrubbing to Week 3, and OCC plus sensor visualization to Week 4.

## 13. Team Rules — One Page Summary

1. One person = one meaningful commit per day.
2. Three people = three meaningful commits per day.
3. 14 days = 42 planned commits.
4. AI may generate code; humans own correctness.
5. Always provide project context + current code + exact task + constraints.
6. Never ask AI to rewrite the whole project when a small change is enough.
7. Test AI-generated code before committing.
8. Inspect `git diff` before every commit.
9. Never commit secrets.
10. Keep Event Sourcing and CQRS boundaries intact.
11. Historical events are append-only.
12. Day 14 must demonstrate Immutability Audit + Reconstruction Check.

## 14. Source Alignment

This workflow is based on the supplied Audit Trail project brief. The brief describes the project as an Event-Sourced Inventory & Logistics Ledger and identifies MongoDB Event Store, Node.js Event Sourcing Engine, CQRS, and React/Recharts Forensic Dashboard as its key modules.

The brief's Week 1–2 plan covers CQRS, the MongoDB append-only event log, and the React event timeline; its Mid-Project Review requires the Immutability Audit and Reconstruction Check.
