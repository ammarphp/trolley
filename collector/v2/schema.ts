/** Separate tables only. Root integration owns deployment/migration orchestration. */
export const V2_SCHEMA = `
CREATE TABLE IF NOT EXISTS v2_runs (
 number INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL UNIQUE, token_hash TEXT NOT NULL,
 consent_version TEXT NOT NULL, profile TEXT NOT NULL, started_day TEXT NOT NULL DEFAULT(date('now')),
 manifest_json TEXT, campaign_json TEXT, exposure_json TEXT, last_sequence INTEGER NOT NULL DEFAULT -1,
 withdrawn INTEGER NOT NULL DEFAULT 0, expired INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS v2_events (
 run_number INTEGER NOT NULL REFERENCES v2_runs(number), event_id TEXT NOT NULL, sequence INTEGER NOT NULL,
 event_hash TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_number,event_id), UNIQUE(run_number,sequence)
);
CREATE TABLE IF NOT EXISTS v2_choices (
 id INTEGER PRIMARY KEY AUTOINCREMENT, run_number INTEGER NOT NULL REFERENCES v2_runs(number),
 comparison_key TEXT NOT NULL, decision_id TEXT NOT NULL, option_id TEXT NOT NULL,
 UNIQUE(run_number,comparison_key)
);
CREATE INDEX IF NOT EXISTS v2_choice_cell ON v2_choices(comparison_key,id);
CREATE TABLE IF NOT EXISTS v2_cells (
 comparison_key TEXT PRIMARY KEY, published_counts TEXT, published_n INTEGER,
 as_of TEXT, watermark INTEGER NOT NULL DEFAULT 0, valid INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS v2_rate_windows(window_key TEXT PRIMARY KEY,count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS v2_publication_state (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 generation TEXT NOT NULL DEFAULT(lower(hex(randomblob(16))))
);
INSERT OR IGNORE INTO v2_publication_state(singleton) VALUES (1);
CREATE TRIGGER IF NOT EXISTS v2_publication_update AFTER UPDATE ON v2_cells
WHEN OLD.valid IS NOT NEW.valid OR OLD.published_counts IS NOT NEW.published_counts
 OR OLD.published_n IS NOT NEW.published_n OR OLD.as_of IS NOT NEW.as_of
BEGIN UPDATE v2_publication_state SET generation=lower(hex(randomblob(16))) WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS v2_publication_insert AFTER INSERT ON v2_cells WHEN NEW.valid=1
BEGIN UPDATE v2_publication_state SET generation=lower(hex(randomblob(16))) WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS v2_publication_delete AFTER DELETE ON v2_cells WHEN OLD.valid=1
BEGIN UPDATE v2_publication_state SET generation=lower(hex(randomblob(16))) WHERE singleton=1; END;
`;
