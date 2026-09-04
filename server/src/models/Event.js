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


EventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });
EventSchema.index({ aggregateId: 1, timestamp: 1 });
EventSchema.index({ timestamp: 1 });
EventSchema.index({ eventType: 1, timestamp: 1 });
const Event = mongoose.model('Event', EventSchema);
module.exports = Event;

