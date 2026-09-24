-- D1 schema for run history. Guide: https://guide.organizedai.vip/local-compute/#track-training
CREATE TABLE runs (
  run TEXT PRIMARY KEY, host TEXT, model TEXT,
  rank INTEGER, layers INTEGER, seq_len INTEGER,
  peak_gb REAL, tok_s REAL, wall_s REAL,
  artifacts_key TEXT,                 -- R2 prefix, filled in once artifacts go there
  created_at TEXT DEFAULT (datetime('now'))
);
