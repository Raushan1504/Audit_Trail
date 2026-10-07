import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Day 28: Person 3 React - Live Demo Walkthrough & Forensic Viva Guide', () => {
  const modalJsxPath = path.resolve(__dirname, '../src/components/LiveDemoWalkthroughModal.jsx');
  const modalCssPath = path.resolve(__dirname, '../src/components/LiveDemoWalkthroughModal.css');
  const navbarJsxPath = path.resolve(__dirname, '../src/components/Navbar.jsx');
  const caseStudyDocPath = path.resolve(__dirname, '../../docs/FORENSIC_CASE_STUDY_DEMO.md');

  test('verifies LiveDemoWalkthroughModal component exists and exports default function', () => {
    assert.ok(fs.existsSync(modalJsxPath), 'LiveDemoWalkthroughModal.jsx must exist');
    const content = fs.readFileSync(modalJsxPath, 'utf8');
    assert.match(content, /export default function LiveDemoWalkthroughModal/);
    assert.match(content, /SHIP-PHARMA-2026-EU-JP/);
    assert.match(content, /SHIP-OCEAN-2026-ROT-SGP/);
    assert.match(content, /onSelectPreset/);
    assert.match(content, /onClose/);
  });

  test('verifies LiveDemoWalkthroughModal.css contains modal backdrop and glassmorphic styles', () => {
    assert.ok(fs.existsSync(modalCssPath), 'LiveDemoWalkthroughModal.css must exist');
    const content = fs.readFileSync(modalCssPath, 'utf8');
    assert.match(content, /\.demo-modal-overlay/);
    assert.match(content, /\.demo-modal-container/);
    assert.match(content, /\.demo-modal-backdrop/);
    assert.match(content, /\.demo-preset-card/);
  });

  test('verifies Navbar.jsx integrates the Viva Demo button and modal trigger', () => {
    assert.ok(fs.existsSync(navbarJsxPath), 'Navbar.jsx must exist');
    const content = fs.readFileSync(navbarJsxPath, 'utf8');
    assert.match(content, /LiveDemoWalkthroughModal/);
    assert.match(content, /isDemoModalOpen/);
    assert.match(content, /btn-demo-walkthrough/);
    assert.match(content, /🎓 Viva Demo/);
  });

  test('verifies docs/FORENSIC_CASE_STUDY_DEMO.md contains comprehensive forensic incident breakdown', () => {
    assert.ok(fs.existsSync(caseStudyDocPath), 'FORENSIC_CASE_STUDY_DEMO.md must exist in docs/');
    const content = fs.readFileSync(caseStudyDocPath, 'utf8');
    assert.match(content, /INC-2026-PHARMA-09/);
    assert.match(content, /SHIP-PHARMA-2026-EU-JP/);
    assert.match(content, /TEMPERATURE_SPIKE_DETECTED/);
    assert.match(content, /Optimistic Concurrency Control/);
    assert.match(content, /Recharts/);
    assert.match(content, /Aman Kumar/);
    assert.match(content, /Raushan Kumar/);
    assert.match(content, /Chhotadon/);
  });
});
