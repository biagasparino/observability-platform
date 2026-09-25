The `postgres-exporter` service (quay.io/prometheuscommunity/postgres-exporter)
needs no custom config file for this demo — it reads the target DSN from the
`DATA_SOURCE_NAME` environment variable set in `docker-compose.yml` and exposes
built-in queries (connections, transactions, replication lag) on `:9187/metrics`.
