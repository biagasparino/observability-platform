# Real Observability Platform

[![App CI](https://img.shields.io/badge/app%20ci-lint%20%2B%20test-2563eb)](.github/workflows/app-ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Prometheus](https://img.shields.io/badge/metrics-Prometheus-E6522C?logo=prometheus&logoColor=white)](observability/prometheus)
[![Grafana](https://img.shields.io/badge/dashboards-Grafana-F46800?logo=grafana&logoColor=white)](observability/grafana)
[![OpenTelemetry](https://img.shields.io/badge/traces-OpenTelemetry-425CC7?logo=opentelemetry&logoColor=white)](app/src/telemetry)

[![Portuguese Version](https://img.shields.io/badge/🇧🇷_Read_in_Portuguese-E8D5B7?style=for-the-badge&logoColor=594A3C)](README.pt-br.md)

This is a small instrumented service wired to a full observability stack: metrics, logs, and traces, correlated with each other, plus **real, reproducible failures you can trigger on demand** and a runbook that walks through detecting and investigating each one, end to end.

## What this project demonstrates

A working RED dashboard for the application, a working USE dashboard for infrastructure, alerting rules that actually fire, and a documented investigation flow that goes from a dashboard spike to the exact root cause using logs and distributed traces.

## Architecture

![Architecture diagram](docs/images/architecture-diagram.svg)

```
Application
    |
    +---- Metrics ----> Prometheus
    |
    +---- Logs -------> Loki (via Promtail)
    |
    +---- Traces ------> OpenTelemetry Collector ---> Tempo
                              |
                           Grafana
```

| Signal | Tool | What it's for |
|---|---|---|
| Metrics | Prometheus + Alertmanager | RED/USE time series, alerting rules |
| Logs | Loki + Promtail | structured JSON logs, correlated by `trace_id` |
| Traces | OpenTelemetry SDK/Collector + Tempo | distributed request timelines |
| Visualization | Grafana | dashboards + one-click trace ↔ log ↔ metric correlation |
| Host/infra metrics | node-exporter, cAdvisor, postgres-exporter | CPU, memory, disk, network, DB connections, container restarts |

## Dashboards

### RED — for the application (request-level golden signals)

![RED dashboard](docs/images/red-dashboard-mock.svg)

- **Rate** — requests/sec, overall and per route
- **Errors** — HTTP 5xx rate (%), status code breakdown
- **Duration** — p50 / p95 / p99 latency

### USE — for infrastructure and dependencies

![USE dashboard](docs/images/use-dashboard-mock.svg)

- **Utilization** — CPU %, memory %, disk %, network throughput
- **Saturation** — load average, swap usage, disk I/O time, DB connection pool (in-use vs. max)
- **Errors** — OOM kills, throttled CPU cycles, container restarts, HTTP 5xx

## Detect it, don't just look at it

The application ships with `/chaos/*` endpoints that trigger real failure modes — not screenshots of a healthy system. Generate a traffic baseline, break something on purpose, then find it:

```bash
docker compose up -d --build
./scripts/generate-traffic.sh          # baseline load
./scripts/inject-fault.sh latency 2500 # or: errors 0.5 / db-exhaust 9
```

![Investigation flow](docs/images/investigation-flow.svg)

Full walkthroughs for all three scenarios — latency spike, 5xx spike, and connection pool saturation — including exactly which panel moves, which alert fires, and how to trace it back to the root cause with logs and Tempo spans, live in the **[Incident Investigation Runbook](runbooks/incident-investigation.md)**.

## What's monitored

| Category | Examples |
|---|---|
| Application (RED) | request rate, HTTP 5xx rate, p50/p95/p99 latency, throughput, in-flight requests |
| Compute | CPU utilization & saturation (load average), memory utilization & swap |
| Storage | disk utilization, disk I/O saturation |
| Network | inbound/outbound throughput |
| Database | connection pool utilization/saturation, query duration |
| Reliability | container/pod restarts, OOM kills, CPU throttling |

## Repository structure

```
observability-platform/
├── app/                          # instrumented Node.js service
│   ├── src/telemetry/            # OpenTelemetry tracing + Prometheus metrics
│   ├── src/routes/chaos.js       # fault-injection endpoints
│   └── Dockerfile
├── observability/
│   ├── prometheus/                # prometheus.yml + alerts.yml
│   ├── alertmanager/
│   ├── loki/ & promtail/
│   ├── otel-collector/ & tempo/
│   └── grafana/
│       ├── provisioning/           # datasources with trace<->log<->metric correlation
│       └── dashboards/             # red-dashboard.json, use-dashboard.json
├── runbooks/                     # incident-investigation.md (EN) + .pt-br.md
├── scripts/                      # generate-traffic.sh, inject-fault.sh, reset-chaos.sh
├── docs/images/                  # architecture & dashboard diagrams
└── docker-compose.yml
```

## Technologies used

- **Prometheus** + **Alertmanager** (metrics & alerting)
- **Grafana** (dashboards, correlated data sources)
- **Loki** + **Promtail** (log aggregation)
- **OpenTelemetry** (auto-instrumented Node.js SDK + Collector) + **Tempo** (trace storage)
- **node-exporter**, **cAdvisor**, **postgres-exporter** (infrastructure metrics)
- **Node.js 20 / Express / prom-client / pino** for the sample service
- **Docker Compose** to run the entire stack locally
- **GitHub Actions** for CI (lint + test)

## Getting started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- `curl` (used by the helper scripts)

### 1. Start everything

```bash
git clone https://github.com/your-username/observability-platform.git
cd observability-platform

cp app/.env.example app/.env
docker compose up -d --build
```

### 2. Open the tools

| Tool | URL | Credentials |
|---|---|---|
| Application | http://localhost:3000 | — |
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | — |
| Alertmanager | http://localhost:9093 | — |
| Tempo (via Grafana Explore) | — | — |

### 3. Generate traffic and break something on purpose

```bash
./scripts/generate-traffic.sh
./scripts/inject-fault.sh errors 0.5
./scripts/reset-chaos.sh
```

Then follow the [runbook](runbooks/incident-investigation.md) to investigate it using the dashboards, Loki, and Tempo.

## Environment variables

Documented in `app/.env.example`:

| Variable | Description |
|---|---|
| `PORT`, `SERVICE_NAME` | app listening port and name (used in logs/traces) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX` | PostgreSQL connection + pool size |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | where traces are sent |
| `LOG_LEVEL` | pino log verbosity |

**Never commit `.env` files** — only the `.env.example` templates are tracked.

## Testing & code quality

```bash
cd app && npm install && npm run lint && npm test
```

- ESLint and Node's built-in test runner check every PR that touches `app/**` (see `.github/workflows/app-ci.yml`).
- No secrets, tokens, or credentials are committed.

## Contributing

1. Fork the repo and create a branch from `main`.
2. Make your change; run the app tests locally.
3. Open a Pull Request — CI runs lint + tests automatically.
4. If you add a new metric or panel, update the relevant dashboard JSON and the runbook.

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

Distributed under the [MIT License](LICENSE).
