# Runbook de Investigação de Incidente

🇺🇸 [Read this in English](incident-investigation.md)

Este documento percorre um ciclo completo de detectar → investigar → encontrar a causa raiz usando os três pilares de observabilidade, com uma falha real e reproduzível. Ele reflete como um engenheiro de plantão trabalha de verdade, não um print de "instalamos o Grafana".

## Cenário 1 — Pico de latência (dependência lenta)

**1. Suba a stack e uma carga base de tráfego**
```bash
docker compose up -d --build
./scripts/generate-traffic.sh
```

**2. Injete a falha**
```bash
./scripts/inject-fault.sh latency 2500
```

**3. Detecte — dashboard RED (`http://localhost:3001`, dashboard "Application — RED")**
- As linhas de p95/p99 no painel **Duration** disparam.
- O painel **Rate** permanece praticamente estável — ou seja, não é um problema de volume de tráfego, é um problema de latência. Essa distinção sozinha já descarta várias hipóteses erradas.

**4. Investigue — Loki (Explore → Loki)**
- Consulta: `{container="observability-platform-app-1"}`.
- Nada parece erro ainda (sem 5xx), o que indica que as requisições estão tendo sucesso, só que lentas. Consistente com o dashboard RED.

**5. Investigue — Tempo (Explore → Tempo → busque pelo serviço `checkout-api`)**
- Abra um trace recente de `POST /orders`. A quebra de spans mostra que quase toda a duração da requisição está dentro do span filho `pg.query`.
- Conclusão: a chamada ao banco de dados é o gargalo, não o código da aplicação ao redor dela — exatamente o que o cenário `latency` injeta por baixo dos panos (ele acontece antes da query).

**6. Resolva**
```bash
./scripts/reset-chaos.sh
```
Confirme no dashboard RED que p95/p99 voltam ao normal em poucos intervalos de coleta.

## Cenário 2 — Pico de taxa de erro (5xx)

```bash
./scripts/inject-fault.sh errors 0.5
```

- **Detecte:** o painel Errors do dashboard RED sobe para perto de 50%; o alerta `HighHttp5xxRate` dispara no Alertmanager (`http://localhost:9093`) em cerca de 2 minutos.
- **Investigue:** no Loki, filtre `{container="...app-1"} |= "chaos"` — os logs de aviso da falha injetada aparecem imediatamente, cada um marcado com um `trace_id`. Clique no `trace_id` pra pular direto pro trace daquela requisição no Tempo e confirmar que nenhuma chamada downstream chegou a ser feita (a falha acontece antes da chamada ao banco).
- **Resolva:** `./scripts/reset-chaos.sh`.

## Cenário 3 — Esgotamento do pool de conexões do banco (saturação)

```bash
./scripts/inject-fault.sh db-exhaust 9
```

- **Detecte:** o painel "Database — connection pool" do dashboard USE mostra o `in use` subindo em direção ao `max` (o tamanho padrão do pool é 10). O alerta `DBConnectionPoolSaturated` dispara quando a utilização passa de 80%.
- **Investigue:** novas requisições em `/orders` começam a enfileirar (Duration subindo no dashboard RED) ou a dar timeout, mesmo com CPU/memória no dashboard USE parecendo completamente normais — um incidente clássico de saturação, que seria invisível se você só observasse métricas de host.
- **Resolva:** `./scripts/reset-chaos.sh` libera as conexões seguras; observe o `in use` cair de volta.

## O padrão geral

1. **Métricas** dizem que *algo* está errado e mais ou menos *que tipo* de problema é (volume vs. erros vs. duração vs. saturação).
2. **Logs** dizem *o que aconteceu*, em texto simples, geralmente com mais contexto por evento, e te entregam um `trace_id`.
3. **Traces** dizem *em que ponto da requisição* o tempo foi gasto ou a falha ocorreu, atravessando limites entre serviço e banco de dados.

Seguir essa ordem — métricas para perceber, logs para explicar, traces para apontar exatamente onde — é a habilidade real que este projeto demonstra, não os dashboards em si.
