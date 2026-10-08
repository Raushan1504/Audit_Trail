import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OCC_COMMAND_TYPES, buildOccCommandPayload } from '../utils/concurrency';
import { createShipmentCommand } from '../services/api';
import './CreateShipmentModal.css';

export default function CreateShipmentModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    shipmentId: '',
    origin: 'Port of Antwerp',
    destination: 'Port of Singapore',
    cargo: 'Precision Medical Equipment'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.shipmentId.trim()) return;

    setSubmitting(true);
    setError(null);

    try {

      const payload = buildOccCommandPayload(
        OCC_COMMAND_TYPES.CREATE_CONTAINER,
        formData.shipmentId,
        formData,
        0
      );

      await createShipmentCommand(payload);
      onClose();
      navigate(`/shipment/${formData.shipmentId.trim().toUpperCase()}`);
    } catch (err) {
      setError(err.message || 'Failed to dispatch container creation command');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="create-shipment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-badge">
            <span className="badge-icon">🔒</span>

            <span>OCC GENESIS CREATION · EXPECTED VERSION: 0</span>

          </div>

          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>

        </div>

        <h2 className="modal-title">Initialize New Container Aggregate</h2>

        <p className="modal-sub">
          Dispatches <code>CREATE_CONTAINER</code> command to the write model.

          Enforces <code>expectedVersion: 0</code> to guarantee zero prior events exist.

        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-field">
            <label htmlFor="createShipmentId">SHIPMENT IDENTIFIER (AGGREGATE ID)</label>

            <input
              id="createShipmentId"
              type="text"
              name="shipmentId"
              value={formData.shipmentId}
              onChange={handleChange}
              placeholder="e.g. SHIP-2026-X1"
              required
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label htmlFor="createOrigin">ORIGIN FACILITY / PORT</label>

            <input
              id="createOrigin"
              type="text"
              name="origin"
              value={formData.origin}
              onChange={handleChange}
              placeholder="e.g. Port of Antwerp"
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="createDestination">DESTINATION PORT</label>

            <input
              id="createDestination"
              type="text"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder="e.g. Port of Singapore"
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="createCargo">CARGO DESCRIPTION</label>

            <input
              id="createCargo"
              type="text"
              name="cargo"
              value={formData.cargo}
              onChange={handleChange}
              placeholder="e.g. Temperature-Sensitive Vaccines"
              required
            />
          </div>

          <div className="modal-field modal-field--occ">
            <label>
              <span>OCC VERSION LOCK</span>

              <span className="occ-tag">v0 (GENESIS)</span>

            </label>

            <input
              type="text"
              value="expectedVersion: 0 (Enforced by Domain)"
              readOnly
              disabled
              className="locked-input"
            />
          </div>

          {error && (
            <div className="modal-error" role="alert">
              <span>⚠</span>

              <span>{error}</span>

            </div>

          )}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>

            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Creating Container...' : '⚡ Append Genesis Event (v1)'}
            </button>

          </div>

        </form>

      </div>

    </div>

  );
}
