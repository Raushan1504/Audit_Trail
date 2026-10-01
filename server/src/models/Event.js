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
    versionKey: false
  }
);

// ── Append-only guards ──────────────────────────────────────────────
// Reject every mutating Mongoose operation except initial save (insert).
// This guarantees events are immutable once persisted.
const APPEND_ONLY_MSG = 'Event store is append-only: update/delete operations are not permitted';

['updateOne', 'updateMany', 'replaceOne', 'findOneAndUpdate', 'findOneAndReplace'].forEach(
  (op) => {
    EventSchema.pre(op, function () {
      throw new Error(APPEND_ONLY_MSG);
    });
  }
);

['deleteOne', 'deleteMany', 'findOneAndDelete'].forEach(
  (op) => {
    EventSchema.pre(op, function () {
      throw new Error(APPEND_ONLY_MSG);
    });
  }
);

// Document-level delete guard (for doc.deleteOne())
EventSchema.pre('deleteOne', { document: true, query: false }, function () {
  throw new Error(APPEND_ONLY_MSG);
});

// Document-level update guard (for doc.save() on existing document)
EventSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error(APPEND_ONLY_MSG);
  }
});

// ── Event Store Indexes & Optimistic Concurrency Control (OCC) ────────
// 1. Compound unique index: Enforces strict version uniqueness per aggregate root.
//    Guarantees Optimistic Concurrency Control (OCC) at the database layer so that
//    two simultaneous commands cannot write the same version number for an aggregate.
EventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });

// 2. Compound index: Optimizes aggregate event retrieval ordered by timestamp.
EventSchema.index({ aggregateId: 1, timestamp: 1 });

// 3. Single-field index: Optimizes global chronological audit trail retrieval.
EventSchema.index({ timestamp: 1 });

// 4. Compound index: Optimizes querying events by type chronologically.
EventSchema.index({ eventType: 1, timestamp: 1 });

const Event = mongoose.model('Event', EventSchema);
Event.APPEND_ONLY_MSG = APPEND_ONLY_MSG;

/**
 * Ensures all schema indexes (especially { aggregateId: 1, version: 1 } unique)
 * are built and synchronized in MongoDB.
 * @returns {Promise<Event>}
 */
Event.ensureIndexes = async function () {
  return await Event.init();
};

module.exports = Event;

