import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileScreen,
  isTabletScreen,
  resolveKeyboardStepNavigation,
  buildScreenReaderAnnouncement,
  BREAKPOINTS
} from '../src/utils/keyboardNav.js';

describe('Day 26: Person 3 React - Responsive Design & A11y Audit', () => {
  describe('Responsive Viewport Breakpoint Tests', () => {
    test('accurately classifies mobile viewports below breakpoint', () => {
      assert.equal(isMobileScreen(375), true);  // iPhone SE
      assert.equal(isMobileScreen(414), true);  // iPhone XR
      assert.equal(isMobileScreen(639), true);
      assert.equal(isMobileScreen(640), false);
      assert.equal(isMobileScreen(1024), false);
    });

    test('accurately classifies tablet viewports between mobile and tablet limits', () => {
      assert.equal(isTabletScreen(768), true);  // iPad Mini
      assert.equal(isTabletScreen(820), true);  // iPad Air
      assert.equal(isTabletScreen(1023), true);
      assert.equal(isTabletScreen(639), false);
      assert.equal(isTabletScreen(1024), false);
    });

    test('handles invalid or non-numeric widths safely', () => {
      assert.equal(isMobileScreen(null), false);
      assert.equal(isMobileScreen(undefined), false);
      assert.equal(isMobileScreen('invalid'), false);
    });
  });

  describe('Keyboard Navigation Bindings', () => {
    test('navigates forward with ArrowRight and ArrowDown', () => {
      assert.equal(resolveKeyboardStepNavigation('ArrowRight', 1, 4), 2);
      assert.equal(resolveKeyboardStepNavigation('ArrowDown', 2, 4), 3);
      assert.equal(resolveKeyboardStepNavigation('ArrowRight', 4, 4), 4); // Clamped at max
    });

    test('navigates backward with ArrowLeft and ArrowUp', () => {
      assert.equal(resolveKeyboardStepNavigation('ArrowLeft', 3, 4), 2);
      assert.equal(resolveKeyboardStepNavigation('ArrowUp', 2, 4), 1);
      assert.equal(resolveKeyboardStepNavigation('ArrowLeft', 1, 4), 1); // Clamped at 1
    });

    test('jumps to boundaries with Home and End keys', () => {
      assert.equal(resolveKeyboardStepNavigation('Home', 3, 4), 1);
      assert.equal(resolveKeyboardStepNavigation('End', 2, 4), 4);
    });

    test('returns null for unrecognized keys', () => {
      assert.equal(resolveKeyboardStepNavigation('KeyA', 1, 4), null);
    });
  });

  describe('Screen Reader Announcement Builder', () => {
    test('generates accessible speech output for normal navigation', () => {
      const announcement = buildScreenReaderAnnouncement(2, 'LOADED_ON_SHIP', false);
      assert.match(announcement, /version 2/);
      assert.match(announcement, /LOADED ON SHIP/);
    });

    test('generates critical warning alert announcement for anomalies', () => {
      const alertAnnouncement = buildScreenReaderAnnouncement(3, 'TEMPERATURE_SPIKE', true);
      assert.match(alertAnnouncement, /Critical Alert/);
      assert.match(alertAnnouncement, /thermal anomaly detected/);
    });
  });
});
