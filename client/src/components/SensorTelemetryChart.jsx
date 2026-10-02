import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend
} from 'recharts';
import { getShipmentTelemetry } from '../services/api';
import './SensorTelemetryChart.css';

/**
 * SensorTelemetryChart Component (Day 24)
 *
 * Visualizes chronological IoT sensor metrics across shipment lifecycle events using Recharts.
 * Plots cold-chain cargo temperature against critical regulatory thresholds, tracks humidity
 * and battery reserves, and flags thermal anomaly breaches.
 */
export default function SensorTelemetryChart({
  shipmentId,
  initialTelemetry = null,
  activeScrubberVersion = null,
  onPointClick
}) {
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metricView, setMetricView] = useState('temp'); // 'temp' | 'humidity' | 'voltage' | 'all'

  useEffect(() => {
    if (!shipmentId) return;

    let isMounted = true;
    const fetchTelemetry = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getShipmentTelemetry(shipmentId);
        if (isMounted) setTelemetry(data);
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load sensor telemetry time-series.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTelemetry();
    return () => {
      isMounted = false;
    };
  }, [shipmentId]);

  if (loading && !telemetry) {
    return (
      <div className="telemetry-card telemetry-card--loading">
        <div className="telemetry-spinner" />
        <p>Loading real-time sensor telemetry and IoT time-series...</p>
      </div>
    );
  }

  if (error && !telemetry) {
    return (
      <div className="telemetry-card telemetry-card--error">
        <span className="error-icon">⚠</span>
        <p>{error}</p>
      </div>
    );
  }

  if (!telemetry || !telemetry.timeSeries || telemetry.timeSeries.length === 0) {
    return null;
  }

  const { metrics, timeSeries } = telemetry;
  const threshold = metrics?.criticalThreshold ?? 4.0;

  // Format data for chart display
  const chartData = timeSeries.map((item) => ({
    name: `v${item.version} ${item.eventType.replace(/_/g, ' ')}`,
    shortName: `v${item.version}`,
    version: item.version,
    eventType: item.eventType,
    temperature: item.temperature,
    threshold: item.threshold ?? threshold,
    ambientTemp: item.ambientTemp,
    humidity: item.humidity,
    batteryVoltage: item.batteryVoltage,
    sensorId: item.sensorId,
    timestamp: item.timestamp,
    isAnomaly: item.isAnomaly
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="telemetry-tooltip">
        <div className="tooltip-header">
          <span className="tooltip-version">Version {data.version}</span>
          <span className={`tooltip-tag ${data.isAnomaly ? 'tooltip-tag--alert' : ''}`}>
            {data.eventType}
          </span>
        </div>

        <div className="tooltip-body">
          <div className="tooltip-row">
            <span className="metric-dot metric-dot--cargo" />
            <span className="tooltip-label">Cargo Temp:</span>
            <span className={`tooltip-val ${data.temperature > data.threshold ? 'tooltip-val--spike' : ''}`}>
              {data.temperature}°C
            </span>
          </div>

          <div className="tooltip-row">
            <span className="metric-dot metric-dot--threshold" />
            <span className="tooltip-label">Safe Threshold:</span>
            <span className="tooltip-val">{data.threshold}°C</span>
          </div>

          {data.ambientTemp !== undefined && (
            <div className="tooltip-row">
              <span className="metric-dot metric-dot--ambient" />
              <span className="tooltip-label">Ambient Temp:</span>
              <span className="tooltip-val">{data.ambientTemp}°C</span>
            </div>
          )}

          {data.humidity !== undefined && (
            <div className="tooltip-row">
              <span className="metric-dot metric-dot--humidity" />
              <span className="tooltip-label">Humidity:</span>
              <span className="tooltip-val">{data.humidity}% RH</span>
            </div>
          )}

          {data.batteryVoltage !== undefined && (
            <div className="tooltip-row">
              <span className="metric-dot metric-dot--voltage" />
              <span className="tooltip-label">Battery:</span>
              <span className="tooltip-val">{data.batteryVoltage} V</span>
            </div>
          )}

          <div className="tooltip-meta">
            <span>Sensor: <code>{data.sensorId}</code></span>
            <span>{new Date(data.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        {data.isAnomaly && (
          <div className="tooltip-anomaly-warning">
            🔥 THERMAL SPIKE EXCEEDS CRITICAL THRESHOLD
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="telemetry-card">
      <div className="telemetry-header">
        <div className="telemetry-title-row">
          <div className="telemetry-icon">📡</div>
          <div>
            <h3 className="telemetry-title">Sensor Telemetry & Environmental Time-Series</h3>
            <p className="telemetry-subtitle">
              Continuous IoT sensor telemetry with cold-chain threshold compliance (Day 24 Recharts Integration)
            </p>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="telemetry-view-tabs" role="tablist">
          <button
            type="button"
            className={`tab-btn ${metricView === 'temp' ? 'tab-btn--active' : ''}`}
            onClick={() => setMetricView('temp')}
          >
            🌡 Temperature & Threshold
          </button>
          <button
            type="button"
            className={`tab-btn ${metricView === 'humidity' ? 'tab-btn--active' : ''}`}
            onClick={() => setMetricView('humidity')}
          >
            💧 Humidity (% RH)
          </button>
          <button
            type="button"
            className={`tab-btn ${metricView === 'voltage' ? 'tab-btn--active' : ''}`}
            onClick={() => setMetricView('voltage')}
          >
            🔋 Battery Reserve (V)
          </button>
          <button
            type="button"
            className={`tab-btn ${metricView === 'all' ? 'tab-btn--active' : ''}`}
            onClick={() => setMetricView('all')}
          >
            📊 Multi-Metric Overview
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="telemetry-metrics-grid">
        <div className="metric-kpi-card">
          <span className="kpi-label">MIN RECORDED</span>
          <span className="kpi-value">{metrics.minTemperature ?? 4.0}°C</span>
          <span className="kpi-sub">Cold-chain floor</span>
        </div>

        <div className="metric-kpi-card">
          <span className="kpi-label">MAX RECORDED</span>
          <span className={`kpi-value ${metrics.maxTemperature > threshold ? 'kpi-value--alert' : ''}`}>
            {metrics.maxTemperature ?? 4.0}°C
          </span>
          <span className="kpi-sub">Peak temperature reached</span>
        </div>

        <div className="metric-kpi-card">
          <span className="kpi-label">CRITICAL THRESHOLD</span>
          <span className="kpi-value kpi-value--threshold">{threshold}°C</span>
          <span className="kpi-sub">Max safe tolerance</span>
        </div>

        <div className="metric-kpi-card">
          <span className="kpi-label">THERMAL ANOMALIES</span>
          <span className={`kpi-value ${metrics.anomaliesDetected > 0 ? 'kpi-value--alert' : 'kpi-value--ok'}`}>
            {metrics.anomaliesDetected}
          </span>
          <span className="kpi-sub">{metrics.anomaliesDetected > 0 ? 'Breaches flagged' : 'Within safe range'}</span>
        </div>

        <div className="metric-kpi-card">
          <span className="kpi-label">LATEST BATTERY</span>
          <span className="kpi-value">{metrics.latestBatteryVoltage ?? 3.8} V</span>
          <span className="kpi-sub">Sensor operational</span>
        </div>
      </div>

      {/* Recharts Chart Area */}
      <div className="telemetry-chart-wrapper">
        <ResponsiveContainer width="100%" height={320}>
          {metricView === 'temp' ? (
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0] && onPointClick) {
                  onPointClick(e.activePayload[0].payload);
                }
              }}
            >
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="ambientGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
              <XAxis dataKey="shortName" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis
                unit="°C"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                domain={['dataMin - 2', 'dataMax + 4']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 12 }} />

              <ReferenceLine
                y={threshold}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `THRESHOLD ${threshold}°C`,
                  fill: '#ef4444',
                  fontSize: 11,
                  position: 'top'
                }}
              />

              {activeScrubberVersion && (
                <ReferenceLine
                  x={`v${activeScrubberVersion}`}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  label={{
                    value: `SCRUBBED v${activeScrubberVersion}`,
                    fill: '#38bdf8',
                    fontSize: 11,
                    position: 'insideTopLeft'
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="ambientTemp"
                name="Ambient Temp"
                stroke="#fbbf24"
                fillOpacity={1}
                fill="url(#ambientGradient)"
                strokeWidth={2}
              />

              <Area
                type="monotone"
                dataKey="temperature"
                name="Cargo Temperature"
                stroke="#38bdf8"
                fillOpacity={1}
                fill="url(#tempGradient)"
                strokeWidth={3}
                dot={{ stroke: '#38bdf8', strokeWidth: 2, r: 4, fill: '#0f172a' }}
                activeDot={{ stroke: '#f87171', strokeWidth: 2, r: 7, fill: '#ef4444' }}
              />
            </AreaChart>
          ) : metricView === 'humidity' ? (
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="humidityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
              <XAxis dataKey="shortName" stroke="#94a3b8" />
              <YAxis unit="%" stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="humidity"
                name="Relative Humidity (% RH)"
                stroke="#2dd4bf"
                fill="url(#humidityGrad)"
                strokeWidth={3}
              />
            </AreaChart>
          ) : metricView === 'voltage' ? (
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
              <XAxis dataKey="shortName" stroke="#94a3b8" />
              <YAxis unit="V" stroke="#94a3b8" domain={[3.0, 4.2]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="batteryVoltage"
                name="Battery Voltage"
                stroke="#a855f7"
                strokeWidth={3}
                dot={{ stroke: '#a855f7', strokeWidth: 2, r: 5 }}
              />
            </LineChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
              <XAxis dataKey="shortName" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="temperature" name="Cargo Temp (°C)" stroke="#38bdf8" strokeWidth={3} />
              <Line type="monotone" dataKey="ambientTemp" name="Ambient Temp (°C)" stroke="#fbbf24" strokeWidth={2} />
              <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#2dd4bf" strokeWidth={2} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
