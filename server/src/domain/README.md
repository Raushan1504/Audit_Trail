# Domain

This directory contains the Event Sourcing domain layer for shipments.

Person 1 owns the shipment aggregate and shipment state logic.

The domain layer is responsible for:
- Shipment aggregate behavior
- Shipment state
- Domain validation
- Applying domain events during replay

Persistence and HTTP/API concerns should remain outside this layer.