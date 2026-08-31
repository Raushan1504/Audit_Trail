const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    aggregateId: {
      type: String,
      required: true
    },
    eventType: {
      type: String,
      required: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    version: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    // Disable Mongoose internal __v field since domain-level 'version' is maintained
    versionKey: false
  }
);

// 1. Compound unique index: Enforces version uniqueness per aggregate (concurrency control)
//    and optimizes event replay ordered by version (aggregateId + version).
EventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });

// 2. Compound index: Optimizes aggregate event retrieval ordered by timestamp.
EventSchema.index({ aggregateId: 1, timestamp: 1 });

// 3. Single-field index: Optimizes global chronological event stream retrieval and audit trail ordering.
EventSchema.index({ timestamp: 1 });

// 4. Compound index: Optimizes querying events by type chronologically (e.g., sensor alerts, checkpoints).
EventSchema.index({ eventType: 1, timestamp: 1 });

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;

