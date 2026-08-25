const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    aggregateId: {
      type: String,
      required: true,
      index: true
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
    // Disable the Mongoose default __v field since we manage our own domain 'version'
    versionKey: false
  }
);

// Compound index to ensure uniqueness of version per aggregate (concurrency control)
EventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;
