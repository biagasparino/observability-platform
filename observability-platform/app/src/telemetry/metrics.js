'use strict';

const client = require('prom-client');

// Default Node.js process metrics: CPU seconds, resident memory, event loop lag,
// active handles, GC duration — this is what backs the "utilization" side of USE
// for the application process itself.
client.collectDefaultMetrics({ prefix: 'app_' });

// ---- RED metrics (Rate, Errors, Duration) for every HTTP request ----
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// ---- Saturation signal: how many requests are in flight right now ----
const httpRequestsInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
});

// ---- Database connection pool: utilization + saturation for the DB dependency ----
const dbPoolConnectionsInUse = new client.Gauge({
  name: 'db_pool_connections_in_use',
  help: 'Number of PostgreSQL connections currently checked out of the pool',
});

const dbPoolConnectionsMax = new client.Gauge({
  name: 'db_pool_connections_max',
  help: 'Maximum size of the PostgreSQL connection pool',
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of PostgreSQL queries in seconds',
  labelNames: ['query'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

// ---- Business-ish counters, useful to prove throughput on dashboards ----
const ordersCreatedTotal = new client.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders successfully created',
});

function httpMetricsMiddleware(req, res, next) {
  const route = req.route ? req.baseUrl + req.route.path : req.path;
  httpRequestsInFlight.inc();
  const endTimer = httpRequestDuration.startTimer({ method: req.method, route });

  res.on('finish', () => {
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestsTotal.inc(labels);
    endTimer(labels);
    httpRequestsInFlight.dec();
  });

  next();
}

module.exports = {
  register: client.register,
  httpMetricsMiddleware,
  dbPoolConnectionsInUse,
  dbPoolConnectionsMax,
  dbQueryDuration,
  ordersCreatedTotal,
};
