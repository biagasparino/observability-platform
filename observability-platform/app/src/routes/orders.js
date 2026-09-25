const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { ordersCreatedTotal } = require('../telemetry/metrics');
const { chaosState } = require('./chaos');
const logger = require('../logger');

// GET /orders -> list recent orders
router.get('/orders', async (req, res) => {
  try {
    await maybeInjectLatency();
    maybeInjectError(req);

    const result = await query('list_orders', 'SELECT id, item, amount_cents, created_at FROM orders ORDER BY id DESC LIMIT 50');
    res.json({ orders: result.rows });
  } catch (err) {
    logger.error({ err, path: req.path }, 'Failed to list orders');
    res.status(err.statusCode || 500).json({ error: err.publicMessage || 'Could not retrieve orders' });
  }
});

// POST /orders -> create an order
router.post('/orders', async (req, res) => {
  const { item, amount_cents: amountCents } = req.body || {};

  if (!item || !Number.isInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: '"item" and a positive integer "amount_cents" are required' });
  }

  try {
    await maybeInjectLatency();
    maybeInjectError(req);

    const result = await query(
      'create_order',
      'INSERT INTO orders (item, amount_cents) VALUES ($1, $2) RETURNING id, item, amount_cents, created_at',
      [item, amountCents]
    );
    ordersCreatedTotal.inc();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error({ err, path: req.path }, 'Failed to create order');
    res.status(err.statusCode || 500).json({ error: err.publicMessage || 'Could not create order' });
  }
});

async function maybeInjectLatency() {
  if (chaosState.latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, chaosState.latencyMs));
  }
}

function maybeInjectError(req) {
  if (chaosState.errorRate > 0 && Math.random() < chaosState.errorRate) {
    logger.warn({ path: req.path, chaos: 'error-injection' }, 'Injected synthetic 5xx for chaos testing');
    const err = new Error('Injected failure (chaos testing)');
    err.statusCode = 503;
    err.publicMessage = 'Service temporarily unavailable';
    throw err;
  }
}

module.exports = router;
