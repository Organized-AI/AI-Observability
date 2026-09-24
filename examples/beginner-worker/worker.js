// A pretend scoring loop that writes the five-event evidence contract to Workers Logs.
// Walkthrough: docs/beginners-guide.md
// Contract source: https://guide.organizedai.vip/observability/chapters/evidence-for-the-loop/
// Never put secrets, API keys, or personal data in these logs or in query strings.

function log(stage, fields) {
  // One JSON object per line. Workers Logs turns each key into a filterable field.
  console.log({ loop: "demo-loop", stage, ...fields });
}

export default {
  async fetch(req) {
    const run_id = crypto.randomUUID();
    const model = "example-model-1";      // tag every score with the model that produced it
    const baseline = 0.92;

    log("trigger", { run_id, trigger: "manual" });

    const score = Math.round((0.55 + Math.random() * 0.4) * 100) / 100;  // stand-in for a real test suite
    log("score", { run_id, suite: "demo-suite", score, model });

    const delta = Math.round((score - baseline) * 100) / 100;
    const threshold = -0.05;
    log("detect", { run_id, baseline, delta, threshold });

    const action = delta < threshold ? "staged" : "keep";
    log("decision", { run_id, action, reason: action === "staged" ? "regression" : "no_drift" });

    if (action === "staged") {
      // A real loop waits here for a person. This demo only records that it is waiting.
      log("gate", { run_id, approver: null, verdict: "waiting" });
    }

    return Response.json({ run_id, score, delta, action });
  },
};
