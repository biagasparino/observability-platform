# Incident Investigation Runbook

🇧🇷 [Leia isto em português](incident-investigation.pt-br.md)

This walks through a full detect → investigate → root-cause loop using the three pillars of observability, with a real, reproducible fault. It mirrors how an on-call engineer actually works, not a "we installed Grafana" screenshot.

## Scenario 1 — Latency spike (slow dependency)

**1. Start the stack and a traffic baseline**
```bash
docker compose up -d --build
./scripts/generate-traffic.sh
```

**2. Inject the fault**
```bash
./scripts/inject-fault.sh latency 2500
```

**3. Detect — RED dashboard (`http://localhost:3001`, dashboard "Application — RED")**
- The **Duration** panel's p95/p99 lines jump sharply.
- The **Rate** panel stays roughly flat — this isn't a traffic problem, it's a latency problem. That distinction alone rules out several wrong hypotheses.

**4. Investigate — Loki (Explore → Loki)**
- Query: `{container="observability-platform-app-1"}`.
- Nothing looks like an error yet (no 5xx), which tells you the requests are succeeding, just slow. That's consistent with the RED dashboard.

**5. Investigate — Tempo (Explore → Tempo → search by service `checkout-api`)**
- Open a recent trace for `POST /orders`. The span breakdown shows almost all of the request duration sitting inside the `pg.query` child span.
- Conclusion: the database call is the bottleneck, not the application code around it — exactly what the injected `latency` scenario does under the hood (it precedes the query).

**6. Resolve**
```bash
./scripts/reset-chaos.sh
```
Confirm on the RED dashboard that p95/p99 drop back to baseline within a couple of scrape intervals.

## Scenario 2 — Error rate spike (5xx)

```bash
./scripts/inject-fault.sh errors 0.5
```

- **Detect:** RED dashboard's Errors panel jumps toward 50%; the `HighHttp5xxRate` alert fires in Alertmanager (`http://localhost:9093`) within ~2 minutes.
- **Investigate:** In Loki, filter `{container="...app-1"} |= "chaos"` — the injected-failure warning logs show up immediately, each one tagged with a `trace_id`. Click a `trace_id` to jump straight into that request's trace in Tempo and confirm no downstream call was actually made (the failure happens before the database call).
- **Resolve:** `./scripts/reset-chaos.sh`.

## Scenario 3 — Database connection pool exhaustion (saturation)

```bash
./scripts/inject-fault.sh db-exhaust 9
```

- **Detect:** USE dashboard's "Database — connection pool" panel shows `in use` climbing toward `max` (default pool size is 10). The `DBConnectionPoolSaturated` alert fires once utilization crosses 80%.
- **Investigate:** New `/orders` requests start queuing (rising Duration on the RED dashboard) or timing out, even though CPU/memory on the USE dashboard look completely normal — a textbook saturation incident that would be invisible if you only watched host-level metrics.
- **Resolve:** `./scripts/reset-chaos.sh` releases the held connections; watch `in use` drop back down.

## The general pattern

1. **Metrics** tell you *something* is wrong and roughly *what kind* of problem it is (rate vs. errors vs. duration vs. saturation).
2. **Logs** tell you *what happened*, in plain text, usually with more context per event, and hand you a `trace_id`.
3. **Traces** tell you *where inside the request* the time went or the failure occurred, across service and database boundaries.

Following that order — metrics to notice, logs to explain, traces to pinpoint — is the actual skill this project demonstrates, not the dashboards themselves.
