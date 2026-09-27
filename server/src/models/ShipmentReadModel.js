const mongoose = require('mongoose');

/**
 * ShipmentReadModel Schema
 *
 * Denormalized read-optimized projection model for shipments in the CQRS architecture.
 * Maintains the current snapshot state (location, status, temperature, version) to serve
 * high-speed O(1) queries on the dashboard without requiring full chronological event replay.
 */
const ShipmentReadModelSchema = new mongoose.Schema(
  {
    shipmentId: {
      type: String,
      required: [true, 'shipmentId is required'],
      trim: true,
      alias: 'aggregateId'
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: ['CREATED', 'LOADED', 'TEMPERATURE_SPIKE', 'ARRIVED'],
        message: 'Invalid shipment status: {VALUE}'
      },
      default: 'CREATED'
    },
    currentLocation: {
      type: String,
      default: null,
      trim: true,
      alias: 'location'
    },
    temperature: {
      type: Number,
      default: null
    },
    lastAppliedVersion: {
      type: Number,
      required: [true, 'lastAppliedVersion is required'],
      default: 0,
      min: [0, 'lastAppliedVersion cannot be negative'],
      alias: 'version'
    },
    vessel: {
      type: String,
      default: null,
      trim: true
    },
    cargo: {
      type: String,
      default: null,
      trim: true,
      set: (val) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'object') {
          return (val.description || val.name || val.type || JSON.stringify(val)).trim();
        }
        return String(val).trim();
      }
    },
    lastEventTimestamp: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ── Indexes for High-Performance Queries ──────────────────────────────
// Primary unique index for fast O(1) shipment lookups by aggregate/shipment ID
ShipmentReadModelSchema.index({ shipmentId: 1 }, { unique: true });

// Index for filtering shipments by operational status (CREATED, LOADED, etc.)
ShipmentReadModelSchema.index({ status: 1 });

// Index for geographic / port location filtering
ShipmentReadModelSchema.index({ currentLocation: 1 });

// Index for sensor telemetry threshold and anomaly filtering
ShipmentReadModelSchema.index({ temperature: 1 });

// Index for projection worker sync verification & lag tracking
ShipmentReadModelSchema.index({ lastAppliedVersion: 1 });

// Compound index for dashboard views filtered by status and sorted by latest update
ShipmentReadModelSchema.index({ status: 1, updatedAt: -1 });

// Compound index for idempotency and version check during projection updates
ShipmentReadModelSchema.index({ shipmentId: 1, lastAppliedVersion: 1 });

const ShipmentReadModel = mongoose.model('ShipmentReadModel', ShipmentReadModelSchema);

module.exports = ShipmentReadModel;
