const test = require('node:test');
const assert = require('node:assert');
const Event = require('../src/models/Event');

test('Event model schema defines expected event store indexes', () => {
  const indexes = Event.schema.indexes();

  // Find index definitions
  const hasAggregateVersionUnique = indexes.some(
    ([fields, options]) => fields.aggregateId === 1 && fields.version === 1 && options?.unique === true
  );
  const hasAggregateTimestamp = indexes.some(
    ([fields]) => fields.aggregateId === 1 && fields.timestamp === 1
  );
  const hasTimestampGlobal = indexes.some(
    ([fields]) => fields.timestamp === 1 && Object.keys(fields).length === 1
  );
  const hasEventTypeTimestamp = indexes.some(
    ([fields]) => fields.eventType === 1 && fields.timestamp === 1
  );

  assert.strictEqual(hasAggregateVersionUnique, true, 'Should define unique compound index on { aggregateId: 1, version: 1 }');
  assert.strictEqual(hasAggregateTimestamp, true, 'Should define compound index on { aggregateId: 1, timestamp: 1 }');
  assert.strictEqual(hasTimestampGlobal, true, 'Should define index on { timestamp: 1 } for global ordering');
  assert.strictEqual(hasEventTypeTimestamp, true, 'Should define compound index on { eventType: 1, timestamp: 1 }');
});

test('Event model schema disables Mongoose versionKey', () => {
  assert.strictEqual(Event.schema.options.versionKey, false, 'Mongoose versionKey (__v) should be disabled');
});
