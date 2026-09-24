# Stand it up

Nine steps, in order. Each one links back to the guide section that explains it:
- [Local-compute guide, section 09: Track the training](https://guide.organizedai.vip/local-compute/#track-training)
- [DevOps in 90 days, Phase 3](https://guide.organizedai.vip/devops/#phase-3)

1. **The monitoring host (a Raspberry Pi 5 in the reference setup).** Mount a USB SSD or NVMe drive for Prometheus data. Do not keep Prometheus data on the SD card, because Prometheus writes to disk constantly. Install Prometheus from its [linux-arm64 release](https://github.com/prometheus/prometheus/releases) with `--storage.tsdb.path` on that drive, and Grafana from [Grafana's APT repository](https://grafana.com/docs/grafana/latest/setup-grafana/installation/debian/) (`sudo apt-get install grafana`, then `sudo systemctl enable --now grafana-server`). Copy `prometheus/prometheus.yml` and swap in your hostnames. Raise `--storage.tsdb.retention.time` if you want more than 15 days hot. *Untested.*
2. **Each Mac.** `brew install macmon node_exporter`, run `macmon serve -p 9101 --install` (its default port 9090 collides with Prometheus), and start node_exporter with `--collector.textfile.directory=$HOME/train-metrics`. See [macmon](https://github.com/vladkens/macmon) and [node_exporter](https://github.com/prometheus/node_exporter). *Untested on your Macs.*
3. **Run-end script and TTFT probe.** At the end of each run: append a line to `runs.md`, write a `.prom` file like `examples/r32-l16.prom`, and POST the same record to the Worker, with an outbox folder that retries after outages. The TTFT probe is a cron job that sends one fixed prompt to each Ollama server and records `load_duration + prompt_eval_duration`. mlx-lm already reports loss, learning rate, tok/s and peak memory on every report. *Not written yet.*
4. **Deploy the Worker.** From `worker/`:
   ```
   npx wrangler d1 create training          # paste the id into wrangler.jsonc
   npx wrangler d1 execute training --remote --file=schema.sql
   npx wrangler secret put INGEST_KEY
   npx wrangler secret put READ_KEY
   npx wrangler deploy
   ```
   Background: [Cloudflare D1, get started](https://developers.cloudflare.com/d1/get-started/). *Untested against real Cloudflare.*
5. **First live check.** POST one record, then read it back:
   ```
   curl -X POST "$WORKER_URL/" -H "x-ingest-key: $INGEST_KEY" \
     -d '{"kind":"run","host":"devbox","model":"qwen3.8-27b-8bit","run":"r32-l16","rank":32,"layers":16,"seq_len":1024,"peak_gb":71.4,"tok_s":212,"wall_s":5400}'
   curl "$WORKER_URL/query?q=runs" -H "Authorization: Bearer $READ_KEY"
   ```
   This is the first test against real Cloudflare.
6. **Local Grafana.** Add three data sources: Prometheus; the [Infinity plugin](https://grafana.com/docs/plugins/yesoreyeram-infinity-datasource) for D1 (Bearer = READ_KEY, allowed hosts = the Worker URL, backend parser); and the Altinity ClickHouse plugin for Analytics Engine ([Cloudflare, querying from Grafana](https://developers.cloudflare.com/analytics/analytics-engine/grafana/)). Import `grafana/training-runs-d1.json`, set the `worker_url` variable, then add the Prometheus panels (dev-box swap with an alert when it grows during a run, TTFT per server) and the swap alert.
7. **Off-site Grafana.** Grafana Cloud, or the Pi if it ever lives off your LAN: the Cloudflare side only (Altinity plus Infinity). Confirm both plugins install on your Grafana Cloud tier, then add an alert for a Mac that stops sending TTFT readings. *Untested.*
8. **Failure drill.** Stop Prometheus and confirm the off-site view still shows runs. Pull the network and confirm local alerts fire.
9. **Later: R2.** Create an R2 bucket, upload per-run artifacts through the S3 API (a Worker request body caps at 100 MB), and fill `artifacts_key` in D1.
