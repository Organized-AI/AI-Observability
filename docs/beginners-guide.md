# A beginner's guide to AI observability

No prior knowledge needed. If you have ever opened GTM Preview to find out why a purchase event did not fire, you already know the habit. This guide moves that habit onto AI systems, one small step at a time.

You start with the simplest thing that works (a file per run, then Cloudflare's built-in logs) and finish at the full stack in this repo. Stop at whatever step answers your questions.

**Illustrated version:** [Observability from zero](https://guide.organizedai.vip/observability/beginners/) on the field guide site has this guide with diagrams.

**Read alongside:**
- [Observability field guide](https://guide.organizedai.vip/observability/) - eight short chapters on Cloudflare observability, written for measurement pros
- [The Skill Loop](https://skill.organizedai.vip/loop) and [GTM Autoresearch](https://github.com/Organized-AI/gtm-autoresearch) - the two loops this guide learns from
- [Local-compute guide: Track the training](https://guide.organizedai.vip/local-compute/#track-training) - the full stack, for step 9

## The idea in one paragraph

Observability means you can answer three questions about any run without running it again: **what happened, in what order, and how much or how often.** Logs answer the first. Traces answer the second. Metrics answer the third. That is all the vocabulary you need to start. ([Field guide, chapter 1](https://guide.organizedai.vip/observability/chapters/you-already-do-observability/))

## The two loops you will learn from

Both are Organized AI projects, and both are scoring loops: run a fixed test, score it, compare to last time, keep or change, and put a human in front of anything that ships.

| | The Skill Loop | GTM Autoresearch |
| --- | --- | --- |
| What it does | Catches when a model update quietly breaks an AI skill, researches the fix, and stages it for your approval | Scores a GTM container across up to 12 dimensions, has Claude propose changes overnight, and keeps only the ones that score higher |
| Where its evidence lives | Local engine with saved baselines, versioned test suites, and scores tagged by model. Optional run history in Cloudflare D1. Its site describes the Cloudflare Workers telemetry settings it uses (step 6). | One JSON file per run in `loop-results/`, with the score for every round, every dimension, and whether each change was kept or reverted |
| Source | [skill.organizedai.vip/loop](https://skill.organizedai.vip/loop), [engine source](https://github.com/Organized-AI/plugin-marketplace/tree/codex/skill-loop-engine/plugins/skill-loop) | [github.com/Organized-AI/gtm-autoresearch](https://github.com/Organized-AI/gtm-autoresearch) |

Scores and settings for both projects are as the projects report them.

## Step 1. Keep one record per run

The simplest observability is a file. GTM Autoresearch writes one JSON file per run. Here is the start of a real one from its repo, [`2026-04-08T180812.json`](https://github.com/Organized-AI/gtm-autoresearch/blob/main/content/gtm-templates/HRE/loop-results/2026-04-08T180812.json), trimmed:

```json
{
  "startTime": "2026-04-08T18:08:12.664Z",
  "rounds": 15,
  "startScore": 0.6466,
  "bestScore": 0.7675,
  "results": [
    { "round": 0, "score": 0.6466, "dimensions": { "tagCoverage": 0.18, "deduplication": 0.5 }, "action": "improved" }
  ]
}
```

**Try it:** open that file and answer, without running anything: When did the run start? What did it score at the start and at best? Which dimension was weakest? If you can, you just did observability.

**What a file cannot do:** tell you how long each step took, show you many runs at once, or wake you up when something breaks. Keep going when you need those.

## Step 2. Turn on Cloudflare Workers Logs

If your loop or tool runs as a Cloudflare Worker, logging is one setting. Add this to the Worker's `wrangler.jsonc` ([Cloudflare, Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)):

```jsonc
"observability": { "enabled": true }
```

Cloudflare says new Workers have this on by default. Logs are included on both plans: the Free plan keeps them 3 days, the Paid plan 7 days. Remember those numbers for step 9.

## Step 3. Log facts as JSON, not sentences

`console.log("score was 0.94")` gives you a sentence. `console.log({ score: 0.94 })` gives you a field. Cloudflare's docs recommend JSON because Workers Logs pulls out each key so you can filter and group by it, the same way you filter GA4 by an event parameter.

## Step 4. Log the same five events every run

A run is reviewable when it writes one event per stage. This contract comes from the [field guide, chapter 7](https://guide.organizedai.vip/observability/chapters/evidence-for-the-loop/):

| Stage | Event | Fields |
| --- | --- | --- |
| Trigger | `trigger` | run_id, what started it |
| Score | `score` | run_id, suite, score, model |
| Detect | `detect` | run_id, baseline, delta, threshold |
| Decision | `decision` | run_id, action, reason |
| Human gate | `gate` | run_id, approver, verdict |

`run_id` ties the five together. `model` on every score is what lets you blame a drop on a model update, which is exactly the failure the Skill Loop exists to catch.

## Step 5. Run the example Worker

[`examples/beginner-worker/`](../examples/beginner-worker/) is a pretend scoring loop that writes those five events. From that folder:

```
npx wrangler dev
curl http://localhost:8787
```

Each request is one run. You get back its score and decision, and the terminal shows the five events. It scores randomly, so you will see both "keep" and "staged" runs. Tested locally with `wrangler dev`. When you are ready, `npx wrangler deploy` puts it on your account (untested there).

## Step 6. Choose noise, sampling, and privacy on purpose

The Skill Loop's site describes three settings. Each is a choice you should make yourself ([Cloudflare, Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)):

- **`invocation_logs: false`**: skip the automatic log line for every request, keep only the events you write. Less noise, same evidence.
- **`head_sampling_rate: 1`**: log every run (1 means 100%) while you are learning. Lower it once things are stable and volume grows, and remember that rare failures can slip past a low rate.
- **Query strings stay visible**: useful for debugging, so never put secrets, API keys, or personal data in a URL.

The example's `wrangler.jsonc` uses the first two.

## Step 7. Find one run and review it

After deploying, open your Worker in the Cloudflare dashboard, go to its logs, and filter by one `run_id`. Answer from the logs alone: what ran, what it scored, what changed, and what is waiting on a human. Then delete the `gate` line from the code, run again, and notice what you can no longer prove. ([Field guide, chapter 6: Query it like an exploration](https://guide.organizedai.vip/observability/chapters/query-it-like-an-exploration/))

## Step 8. Check the whole loop, not just one run

One run tells you what happened. Many runs tell you whether the loop is healthy: are scores drifting, did errors rise after a deploy, did a model update line up with a drop? Cloudflare's metrics cover requests, errors, and CPU time with nothing to install ([field guide, chapter 5](https://guide.organizedai.vip/observability/chapters/metrics-are-the-health-check/)).

## Step 9. Know when you have outgrown it

Move to the full stack in this repo when any of these is true:

- You need history longer than 3 or 7 days. (Exporting before logs expire is covered in [field guide, chapter 8](https://guide.organizedai.vip/observability/chapters/exports-and-honest-gaps/).)
- You are measuring machines, not just Workers: memory, swap, GPU power during training.
- You want alerts that still fire when the internet is down.
- You want SQL over every run you have ever done.

The full stack adds Prometheus and Grafana on an always-on box, an ingestion Worker, and D1 for history. Start at the [README](../README.md) and follow [docs/stand-up.md](stand-up.md). The reasoning behind it is in the [local-compute guide](https://guide.organizedai.vip/local-compute/#track-training).

## What this guide checked

- The Workers Logs settings, retention, and JSON advice come from Cloudflare's docs, read September 24, 2026.
- The GTM Autoresearch file is real and in its repo. The Skill Loop settings are as its site states them. I did not find that Worker's config in the Organized-AI repos.
- The example Worker ran locally under `wrangler dev`. It has not been deployed.
