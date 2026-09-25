'use strict';

const { Pool } = require('pg');
const logger = require('./logger');
const { dbPoolConnectionsInUse, dbPoolConnectionsMax, dbQueryDuration } = require('./telemetry/metrics');

const poolMax = Number(process.env.DB_POOL_MAX || 10);
dbPoolConnectionsMax.set(poolMax);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: poolMax,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

// Track how many connections are currently checked out, so Grafana can show
// pool saturation (in_use / max) next to query latency.
pool.on('acquire', () => dbPoolConnectionsInUse.inc());
pool.on('release', () => dbPoolConnectionsInUse.dec());

async function query(name, text, params) {
  const endTimer = dbQueryDuration.startTimer({ query: name });
  try {
    const result = await pool.query(text, params);
    endTimer();
    return result;
  } catch (err) {
    endTimer();
    logger.error({ err, query: name }, 'Database query failed');
    throw new Error('DATABASE_ERROR');
  }
}

module.exports = { query, pool };
