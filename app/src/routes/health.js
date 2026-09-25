const express = require('express');
const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: process.env.SERVICE_NAME || 'checkout-api' });
});

module.exports = router;
