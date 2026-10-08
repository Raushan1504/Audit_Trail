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

EventSchema.pre('deleteOne', { document: true, query: false }, function () {
  throw new Error(APPEND_ONLY_MSG);
});

EventSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error(APPEND_ONLY_MSG);
  }
});

EventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });

EventSchema.index({ aggregateId: 1, timestamp: 1 });

EventSchema.index({ timestamp: 1 });

EventSchema.index({ eventType: 1, timestamp: 1 });

const Event = mongoose.model('Event', EventSchema);
Event.APPEND_ONLY_MSG = APPEND_ONLY_MSG;

Event.ensureIndexes = async function () {
  return await Event.init();
};

module.exports = Event;
