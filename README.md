# AI-observability

Measurement pros already know how to find out why a system behaves the way it does. This repo points that skill at AI systems, starting with the one you can measure tonight: your own fine-tuning runs and model servers.

**Curriculum (read these first, the repo follows them):**
- [Local-compute guide, section 09: Track the training](https://guide.organizedai.vip/local-compute/#track-training) - the full walkthrough this code comes from
- [DevOps in 90 days, Phase 3: Kubernetes and observability](https://guide.organizedai.vip/devops/#phase-3) - where this stack runs on real infrastructure

## The manifesto

> Measurement pros are in a unique spot right now.
>
> We understand data and the systems around it. In a post-manual-coding world, that matters more than ever.
>
> Everyone's building with AI. Few have systems. Fewer have ways to improve them.
>
> Agents drift. They make mistakes, misuse tools, call the wrong skill. We all know it.
>
> So how do you improve an AI system?
>
> Data.
>
> The same data that explains marketing behavior now explains AI behavior. We're positioned to see how these systems work, where they fail, why, and what to do about it.
>
> Observability isn't just token burn and resets. There are knobs to tune that most people aren't even looking at. Measurement pros know where to look.
>
> Time to plant a flag in AI observability.

Jordaaan Hill, [Organized AI](https://guide.organizedai.vip/), first posted in the MeasureU community, where he mentors.

## What this repo measures first

Three numbers, each tied to a decision:

| Number | Decision it makes |
| --- | --- |
| Peak memory per run | Which machine tier: 64, 96, or 256 GB |
| Tokens per second and wall hours per project | Buy or rent: what the same work costs on a rental |
| Time to first token per model server | The free fix (keep-alive) before you spend anything |

Why these first: they pick your next hardware buy, so you will actually look at the dashboard. The [local-compute guide](https://guide.organizedai.vip/local-compute/#track-training) explains each one.

## How the pieces fit

```
Macs (macmon :9101, node_exporter :9100, *.prom run records)
   |                                   |
   | scraped by                        | run-end script POSTs the same record
   v                                   v
Prometheus + local Grafana        Cloudflare ingestion Worker (worker/)
on an always-on host              |-> Workers Analytics Engine (3 months, off-site dashboards)
(Raspberry Pi 5 in the            |-> D1 (one row per run, full history)
 reference setup)                 '-> GET /query for Grafana via the Infinity data source
                                  
runs.md in git stays the source of truth. D1 can be rebuilt from it.
```

| Store | Keeps | For how long |
| --- | --- | --- |
| Prometheus | One-second hardware streams, run records, TTFT | 15 days by default |
| Analytics Engine | Run records and TTFT, for the off-site dashboards | 3 months |
| D1 | One row per run, queryable with SQL | Until you delete it |
| `runs.md` in git | One line per run, the source of truth | Permanent |
| R2, later | Per-run logs, eval outputs, checkpoint metadata | Until you delete it |

## Repo layout

| Path | What it is | Status |
| --- | --- | --- |
| `worker/worker.js` | Ingestion Worker. `POST /` with `x-ingest-key` writes a record; `GET /query?q=runs` or `q=peak_by_model` with `Authorization: Bearer <READ_KEY>` reads fixed, named queries. Grafana never sends SQL. | Tested locally |
| `worker/schema.sql` | D1 table for run history | Tested locally |
| `worker/wrangler.jsonc` | Worker config: Analytics Engine and D1 bindings | Tested locally (with a placeholder D1 id) |
| `prometheus/prometheus.yml` | Scrape config for macmon and node_exporter on each Mac, plus the monitoring host itself | Untested |
| `examples/r32-l16.prom` | Sample run record for node_exporter's textfile collector | Format only |
| `grafana/training-runs-d1.json` | Dashboard: peak memory per run (64/96 GB lines) and peak by model and rank, read from D1 through the Worker | Panels match the tested setup; this export was not re-imported |
| `docs/stand-up.md` | The nine steps to stand the whole stack up | Guide |
| `docs/dashboard-test.png` | The tested dashboard, reading sample rows | Evidence |

## What was tested, and what was not

Tested (Sept 23-24, 2026, local only):
- `worker.js` under `wrangler dev` with a local D1 database. A POSTed run landed in D1 and `/query` returned it. A wrong ingest key and a wrong read key both got 401. An unknown query name got 404.
- Grafana 13.2.2 OSS with the Infinity 4.0.0 plugin read `/query` through its backend parser, with numbers and timestamps typed correctly. `docs/dashboard-test.png` is that test, on sample rows, not real runs.

Not tested yet:
- A deployed Worker, remote D1, and the Analytics Engine write and its query from Grafana
- Grafana Cloud plugin availability on your tier
- Prometheus and Grafana on the Pi, macmon and node_exporter on the Macs
- The run-end script and the TTFT probe, which are not written yet

## Stand it up

Follow [docs/stand-up.md](docs/stand-up.md). The [local-compute guide](https://guide.organizedai.vip/local-compute/#track-training) has the reasoning behind each step.

## Where this goes next

Training runs are the first AI system measured here. The same pattern (fixed questions, records in a file, two stores that cover each other's failures) extends to agents: tool calls, skill choices, drift. That is the flag this repo plants.

## License

MIT. See [LICENSE](LICENSE).
