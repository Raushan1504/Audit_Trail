# Events

This directory contains the Event Sourcing event layer.

Person 1 owns the domain event definitions and event-related behavior.

The event layer is responsible for:
- Canonical shipment event types
- Domain event creation
- Event replay support
- Event handling boundaries

Historical events must remain immutable and append-only.
MongoDB persistence is handled separately from the domain event definitions.