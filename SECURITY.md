# Security and abuse model

Report a suspected vulnerability privately through GitHub’s private vulnerability reporting if available. Do not include personal data or run withdrawal keys in public issues. Until a private route is available, open a minimal issue requesting a private contact channel.

The public collector accepts untrusted visitors. It validates types, bounds, allowed values, template IDs, and generator versions; reconstructs stimuli from the catalog; limits request bodies; hashes per-run keys; and never returns raw records. Tokens for different runs are unrelated. Original decisions cannot be overwritten by later reflection updates.

Public output is an allowlist of aggregates. There is no SQL, administrative, raw export, or arbitrary fetch endpoint. Parameterized SQL is used throughout. The Pages artifact excludes server/deployment directories. CSV exports neutralize leading spreadsheet formula markers.

**Known limits:** CORS does not stop scripts, bots can create new runs, and a run is not a distinct human. The collector rate-limits run registrations globally and submissions by run, without storing an IP or browser fingerprint. This bounds ordinary bursts but is not a comprehensive denial-of-service defense or Sybil defense. Production operators should monitor provider quotas and use platform-level rate controls if traffic becomes hostile. Do not mistake public counts for verified human participation.

The application does not log request bodies, tokens, IP headers, or user-agent strings. Hosting providers may maintain their own logs. Local storage can be read by anyone with access to that browser profile. A lost run key cannot be recovered through an account because no account exists.

The public aggregate threshold reduces small cells but does not provide differential privacy. Repeated snapshots can reveal changes in a cell. Do not add sensitive demographics or free-text responses to this model without redesigning the privacy protections.
