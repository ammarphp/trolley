export const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (number INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL UNIQUE, token_hash TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('descent','explore')), engine_version TEXT NOT NULL, notice_version TEXT NOT NULL, started_day TEXT NOT NULL DEFAULT (date('now')), withdrawn INTEGER NOT NULL DEFAULT 0 CHECK(withdrawn IN (0,1)));
CREATE TABLE IF NOT EXISTS responses (response_id TEXT PRIMARY KEY, run_number INTEGER NOT NULL REFERENCES runs(number) ON DELETE CASCADE, ordinal INTEGER NOT NULL, template_id TEXT NOT NULL, family TEXT NOT NULL, choice TEXT NOT NULL CHECK(choice IN ('pull','stay','skip')), mode TEXT NOT NULL, stage INTEGER, depth INTEGER, active_ms INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(run_number, ordinal));
CREATE INDEX IF NOT EXISTS response_run ON responses(run_number);
CREATE INDEX IF NOT EXISTS response_family ON responses(family,mode);
CREATE TABLE IF NOT EXISTS rate_windows (window_key TEXT PRIMARY KEY, count INTEGER NOT NULL);
`;
