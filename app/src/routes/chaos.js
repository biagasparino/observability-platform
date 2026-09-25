'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const { pool } = require('../db');

// Shared mutable state read by other routes (orders.js) to decide whether to
// misbehave. This is intentionally simple — the point is to have a lever you
// can pull on purpose and then go find the evidence in the dashboards.
const chaosState = {
  latencyMs: 0,
  errorRate: 0,
  heldConnections: [],
};

// POST /chaos/latency  { "ms": 2000 }
// Adds artificial latency to every /orders request. Watch the Duration (p95/p99)
// panel on the RED dashboard climb, then confirm the slow span in a trace.
router.post('/chaos/latency', express.json(), (req, res) => {
  const ms = Number(req.body?.ms ?? 2000);
  chaosState.latencyMs = ms;
  logger.warn({ chaos: 'latency', ms }, 'Chaos: latency injection enabled');
  res.json({ chaos: 'latency', latencyMs: chaosState.latencyMs });
});

// POST /chaos/errors  { "rate": 0.5 }
// Makes a fraction of /orders requests fail with 503. Watch the Errors panel
// and the HTTP 5xx rate spike, then correlate with the error logs in Loki.
router.post('/chaos/errors', express.json(), (req, res) => {
  const rate = Number(req.body?.rate ?? 0.5);
  chaosState.errorRate = Math.min(Math.max(rate, 0), 1);
  logger.warn({ chaos: 'errors', rate: chaosState.errorRate }, 'Chaos: error injection enabled');
  res.json({ chaos: 'errors', errorRate: chaosState.errorRate });
});

// POST /chaos/db-exhaust  { "connections": 10 }
// Checks out and holds real connections from the pool without releasing them,
// simulating a leak. Watch db_pool_connections_in_use approach db_pool_connections_max,
// then requests start queuing/timing out — a classic "saturation" incident.
router.post('/chaos/db-exhaust', express.json(), async (req, res) => {
  const count = Number(req.body?.connections ?? 8);
  logger.warn({ chaos: 'db-exhaust', count }, 'Chaos: holding database connections without releasing them');

  try {
    for (let i = 0; i < count; i += 1) {
      const client = await pool.connect(); // intentionally never released
      chaosState.heldConnections.push(client);
    }
    res.json({ chaos: 'db-exhaust', heldConnections: chaosState.heldConnections.length });
  } catch (err) {
    logger.error({ err }, 'Chaos: could not acquire connection to hold (pool likely already exhausted)');
    res.status(200).json({ chaos: 'db-exhaust', heldConnections: chaosState.heldConnections.length, note: 'pool already exhausted' });
  }
});

// POST /chaos/reset -> clears every active chaos scenario
router.post('/chaos/reset', (_req, res) => {
  chaosState.latencyMs = 0;
  chaosState.errorRate = 0;
  chaosState.heldConnections.splice(0).forEach((client) => client.release());
  logger.info({ chaos: 'reset' }, 'Chaos: all scenarios reset to normal');
  res.json({ chaos: 'reset', status: 'normal' });
});

// GET /chaos/status -> current chaos configuration, handy for the runbook
router.get('/chaos/status', (_req, res) => {
  res.json({
    latencyMs: chaosState.latencyMs,
    errorRate: chaosState.errorRate,
    heldConnections: chaosState.heldConnections.length,
  });
});

module.exports = { router, chaosState };
