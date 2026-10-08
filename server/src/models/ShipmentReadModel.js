const mongoose = require('mongoose');

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

    humidity: {
      type: Number,
      default: null,
      min: [0, 'humidity cannot be negative'],
      max: [100, 'humidity cannot exceed 100']
    },

    batteryVoltage: {
      type: Number,
      default: null,
      min: [0, 'batteryVoltage cannot be negative']
    },

    ambientTemp: {
      type: Number,
      default: null
    },

    coordinates: {
      lat: {
        type: Number,
        min: [-90, 'latitude cannot be below -90'],
        max: [90, 'latitude cannot exceed 90']
      },
      lng: {
        type: Number,
        min: [-180, 'longitude cannot be below -180'],
        max: [180, 'longitude cannot exceed 180']
      }
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
          return (
            val.description ||
            val.name ||
            val.type ||
            JSON.stringify(val)
          ).trim();
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

ShipmentReadModelSchema.index(
  { shipmentId: 1 },
  { unique: true }
);

ShipmentReadModelSchema.index({ status: 1 });

ShipmentReadModelSchema.index({ currentLocation: 1 });

ShipmentReadModelSchema.index({ temperature: 1 });

ShipmentReadModelSchema.index({ lastAppliedVersion: 1 });

ShipmentReadModelSchema.index({
  status: 1,
  updatedAt: -1
});

ShipmentReadModelSchema.index({
  shipmentId: 1,
  lastAppliedVersion: 1
});

const ShipmentReadModel = mongoose.model(
  'ShipmentReadModel',
  ShipmentReadModelSchema
);

module.exports = ShipmentReadModel;