'use strict';

const pino = require('pino');

// Structured JSON logs to stdout. In the docker-compose stack, Promtail tails
// the container's stdout and ships these lines to Loki, tagged with the
// service name so they can be correlated with metrics and traces.
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: process.env.SERVICE_NAME || 'checkout-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
