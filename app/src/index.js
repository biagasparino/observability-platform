require('dotenv').config();
const express = require('express');
const pinoHttp = require('pino-http');

const logger = require('./logger');
const { register, httpMetricsMiddleware } = require('./telemetry/metrics');
const healthRouter = require('./routes/health');
const ordersRouter = require('./routes/orders');
const { router: chaosRouter } = require('./routes/chaos');

const app = express();
const SERVICE_NAME = process.env.SERVICE_NAME || 'checkout-api';

app.use(express.json());
app.use(pinoHttp({ logger })); // access logs, correlated with trace_id when a span is active
app.use(httpMetricsMiddleware); // RED metrics for every request

app.use(healthRouter);
app.use(ordersRouter);
app.use(chaosRouter);

// GET /metrics -> scraped by Prometheus every 15s (see observability/prometheus/prometheus.yml)
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/', (_req, res) => {
  res.json({ service: SERVICE_NAME, message: `${SERVICE_NAME} is running` });
});

// Centralized error handler: keeps stack traces out of client responses,
// but the full error still reaches the logs (and Loki) for investigation.
app.use((err, req, res, _next) => {
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => logger.info({ port: PORT }, `${SERVICE_NAME} listening`));
}
