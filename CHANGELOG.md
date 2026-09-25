# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-09-23
### Added
- Instrumented sample application exposing Prometheus metrics, OpenTelemetry traces, and structured JSON logs.
- Full observability stack via Docker Compose: Prometheus, Grafana, Loki + Promtail, OpenTelemetry Collector, Tempo, Alertmanager, node-exporter, cAdvisor, postgres-exporter.
- Provisioned Grafana dashboards: RED (Rate/Errors/Duration) for the application, and USE (Utilization/Saturation/Errors) for infrastructure.
- Prometheus alerting rules for error rate, latency, CPU, memory, disk, DB connections, and pod/container restarts.
- Built-in fault-injection endpoints (`/chaos/*`) to reproduce incidents on demand.
- Incident investigation runbook documenting the metrics → logs → traces workflow.
