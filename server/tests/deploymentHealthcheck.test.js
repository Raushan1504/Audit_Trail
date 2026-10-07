const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Day 27: Person 2 Backend - Deployment Configuration & Health Checks', () => {
  test('verifies render.yaml exists and defines web service with /health probe', () => {
    const renderPath = path.resolve(__dirname, '../../render.yaml');
    assert.ok(fs.existsSync(renderPath), 'render.yaml must exist');

    const content = fs.readFileSync(renderPath, 'utf8');
    assert.match(content, /audit-trail-backend/);
    assert.match(content, /healthCheckPath:\s*\/health/);
    assert.match(content, /startCommand:\s*npm start/);
  });

  test('verifies server/.env.example template exists and contains MONGODB_URI and JWT_SECRET', () => {
    const envExamplePath = path.resolve(__dirname, '../.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist in server');

    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.match(content, /MONGODB_URI/);
    assert.match(content, /JWT_SECRET/);
    assert.match(content, /NODE_ENV/);
  });

  test('verifies multi-stage Dockerfile exists with healthcheck and node runner', () => {
    const dockerPath = path.resolve(__dirname, '../../Dockerfile');
    assert.ok(fs.existsSync(dockerPath), 'Dockerfile must exist');

    const content = fs.readFileSync(dockerPath, 'utf8');
    assert.match(content, /FROM node:20-alpine/);
    assert.match(content, /HEALTHCHECK/);
    assert.match(content, /EXPOSE 5000/);
  });
});
