const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/middleware/rateLimiter');
const { cacheControlMiddleware, computeETag } = require('../src/middleware/cacheControl');
const { securityHeadersMiddleware } = require('../src/middleware/securityHeaders');

describe('Day 26: Person 2 Backend - HTTP Response Caching, Compression & Security', () => {
  describe('securityHeadersMiddleware', () => {
    test('attaches hardened enterprise security headers', () => {
      const req = { method: 'GET' };
      const headers = {};
      const res = {
        setHeader: (k, v) => { headers[k] = v; }
      };

      securityHeadersMiddleware(req, res, () => {});

      assert.equal(headers['X-Content-Type-Options'], 'nosniff');
      assert.equal(headers['X-Frame-Options'], 'DENY');
      assert.equal(headers['X-XSS-Protection'], '1; mode=block');
      assert.ok(headers['Content-Security-Policy']);
    });

    test('handles CORS preflight OPTIONS requests with 204 status', () => {
      const req = { method: 'OPTIONS' };
      const headers = {};
      let ended = false;
      let statusCode = null;

      const res = {
        setHeader: (k, v) => { headers[k] = v; },
        status: (code) => {
          statusCode = code;
          return { end: () => { ended = true; } };
        }
      };

      securityHeadersMiddleware(req, res, () => {});

      assert.equal(statusCode, 204);
      assert.equal(ended, true);
      assert.match(headers['Access-Control-Allow-Methods'], /GET, POST, OPTIONS/);
    });
  });

  describe('cacheControlMiddleware', () => {
    test('computes deterministic md5 etag', () => {
      const tag1 = computeETag(JSON.stringify({ a: 1 }));
      const tag2 = computeETag(JSON.stringify({ a: 1 }));
      assert.equal(tag1, tag2);
    });

    test('applies immutable public caching headers on /events paths', () => {
      const req = { method: 'GET', path: '/api/queries/shipments/SHIP-1/events', headers: {} };
      const headers = {};
      const res = {
        setHeader: (k, v) => { headers[k] = v; },
        json: (data) => data
      };

      cacheControlMiddleware(req, res, () => {});

      assert.match(headers['Cache-Control'], /public/);
      assert.match(headers['Cache-Control'], /max-age=60/);
    });

    test('enforces no-store headers on mutating commands', () => {
      const req = { method: 'POST', path: '/api/commands/create' };
      const headers = {};
      const res = {
        setHeader: (k, v) => { headers[k] = v; }
      };

      cacheControlMiddleware(req, res, () => {});

      assert.match(headers['Cache-Control'], /no-store/);
    });
  });

  describe('createRateLimiter', () => {
    test('permits requests within quota and enforces 429 when quota exceeded', () => {
      const limiter = createRateLimiter({ windowMs: 10000, maxRequests: 2 });
      const req = {
        ip: '192.168.1.100',
        headers: { 'x-test-rate-limit': 'true' }
      };
      const headers = {};
      let statusCode = 200;
      let jsonBody = null;

      const res = {
        setHeader: (k, v) => { headers[k] = v; },
        status: (code) => {
          statusCode = code;
          return {
            json: (b) => { jsonBody = b; }
          };
        }
      };

      let nextCalled = 0;
      const next = () => { nextCalled++; };

      // Request 1
      limiter(req, res, next);
      assert.equal(nextCalled, 1);

      // Request 2
      limiter(req, res, next);
      assert.equal(nextCalled, 2);

      // Request 3 (exceeds limit)
      limiter(req, res, next);
      assert.equal(statusCode, 429);
      assert.equal(jsonBody?.code, 'RATE_LIMIT_EXCEEDED');
      assert.equal(nextCalled, 2); // next should not be called
    });
  });
});
