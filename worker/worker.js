// Ingestion Worker for AI-observability. Guide: https://guide.organizedai.vip/local-compute/#track-training
// Write: POST / with header x-ingest-key. Read: GET /query?q=<name> with Authorization: Bearer <READ_KEY>.
// Fixed, read-only queries. Grafana picks one by name and never sends SQL.
const QUERIES = {
  runs: `SELECT run, host, model, rank, layers, seq_len, peak_gb, tok_s, wall_s,
                strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS time
         FROM runs
         WHERE created_at BETWEEN datetime(?1 / 1000, 'unixepoch') AND datetime(?2 / 1000, 'unixepoch')
         ORDER BY created_at LIMIT 1000`,
  peak_by_model: `SELECT model, rank, MAX(peak_gb) AS peak_gb, AVG(tok_s) AS tok_s, COUNT(*) AS runs
                  FROM runs
                  WHERE created_at BETWEEN datetime(?1 / 1000, 'unixepoch') AND datetime(?2 / 1000, 'unixepoch')
                  GROUP BY model, rank ORDER BY model, rank`,
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // Read path for Grafana: GET /query?q=runs&from=<ms>&to=<ms>
    if (req.method === "GET" && url.pathname === "/query") {
      if (req.headers.get("authorization") !== `Bearer ${env.READ_KEY}`) return new Response("no", { status: 401 });
      const sql = QUERIES[url.searchParams.get("q")];
      if (!sql) return new Response("unknown query", { status: 404 });
      const from = Number(url.searchParams.get("from") ?? 0);
      const to = Number(url.searchParams.get("to") ?? Date.now());
      const { results } = await env.DB.prepare(sql).bind(from, to).all();
      return Response.json(results);
    }

    // Write path for the Macs: POST / with a run record or TTFT reading
    if (req.method !== "POST") return new Response("not found", { status: 404 });
    if (req.headers.get("x-ingest-key") !== env.INGEST_KEY) return new Response("no", { status: 401 });
    const r = await req.json();
    env.TRAINING.writeDataPoint({
      blobs: [r.host, r.model, r.run, r.kind],          // kind: "run" or "ttft"
      doubles: [r.peak_gb ?? 0, r.tok_s ?? 0, r.wall_s ?? 0, r.ttft_s ?? 0],
      indexes: [r.host],
    });
    if (r.kind === "run") {
      await env.DB.prepare(
        "INSERT OR REPLACE INTO runs (run, host, model, rank, layers, seq_len, peak_gb, tok_s, wall_s, artifacts_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(r.run, r.host, r.model, r.rank, r.layers, r.seq_len, r.peak_gb, r.tok_s, r.wall_s, r.artifacts_key ?? null).run();
    }
    return new Response("ok");
  },
};
