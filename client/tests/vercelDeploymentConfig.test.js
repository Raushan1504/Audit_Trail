import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Day 27: Person 3 React - Vercel Deployment & SPA Routing Rules', () => {
  test('verifies root vercel.json contains SPA rewrite and reverse proxy rules', () => {
    const vercelPath = path.resolve(__dirname, '../../vercel.json');
    assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist in root');

    const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    assert.equal(config.framework, 'vite');
    assert.ok(Array.isArray(config.rewrites));

    const apiRewrite = config.rewrites.find((r) => r.source === '/api/(.*)');
    assert.ok(apiRewrite, 'Must contain API reverse proxy rewrite');
    assert.match(apiRewrite.destination, /audit-trail-backend/);

    const spaRewrite = config.rewrites.find((r) => r.source === '/(.*)');
    assert.ok(spaRewrite, 'Must contain SPA catch-all rewrite');
    assert.equal(spaRewrite.destination, '/index.html');
  });

  test('verifies client/.env.production.example template exists', () => {
    const envProdPath = path.resolve(__dirname, '../.env.production.example');
    assert.ok(fs.existsSync(envProdPath), '.env.production.example must exist in client');

    const content = fs.readFileSync(envProdPath, 'utf8');
    assert.match(content, /VITE_API_URL/);
  });
});
