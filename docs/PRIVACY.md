# Data and privacy

The game has no accounts. Every new run gets a random ID and a separate random withdrawal key. No identifier links different runs on the server. The key is hashed before database storage. The public run number is a sequence number, not a person number.

## Stored by the application

**Run:** random ID, hashed run key, run number, opening mode, generator/notice version, start day, and withdrawal state.

**Response:** random response ID, run number, within-run ordinal, generator version, template, seed, choice or skip, optional confidence and categorical reason, rounded active/elapsed time, left/right position, source, narrative mode/stage/depth, and selected filters.

The client sends only an explicit allowlist. It does not send the local wall-clock timestamp, names, emails, free text, a user identifier, IP addresses, or browser metadata. The application does not inspect or persist IP/forwarded-IP headers or user-agent strings. The hosting and network providers still handle normal connection metadata. “Anonymous runs” describes the application model, not a promise of untraceable network traffic.

The browser keeps local run records and per-run withdrawal keys in local storage. Exports omit those keys. A maximum of 5,000 local responses is retained. Shared raw responses are eligible for cleanup after 365 days, with cleanup performed during subsequent run registration. Run registration metadata remains for the aggregate count and withdrawal tombstones. Clearing browser storage can remove the only copy of a withdrawal key.

## Choice and withdrawal

With a configured collector, the notice beside the play controls says anonymous run data is shared and links to an opt-out. Disabling sharing stops future submissions. It does not silently delete earlier submissions. Withdraw a run in settings to delete its responses and exclude it from future aggregate counts. A withdrawal tombstone prevents a delayed request from recreating the run.

For entirely private play, disable sharing or open the game with `?private=1`. Private runs retain local reports and exports. A refresh resumes the current run. Starting over generates a new unrelated run. Local preferences may persist, but preference state is not a server-side identity.

## Public outputs

The API exposes overall run/response counts and aggregate charts. Detailed groups require at least ten independent run IDs. This limits small-cell disclosure but does not prove anonymity, prevent differencing attacks, or guarantee the runs came from distinct people. These are descriptive public statistics, not a formally privacy-preserving research release.

GitHub contains aggregate snapshots only. No raw runs, deletion keys, response lists, local databases, or exact client timestamps are committed. Earlier aggregate snapshots can remain in Git history after withdrawal. A withdrawal changes current/future summaries; it cannot remove already downloaded aggregates.

The operator is **ammarphp**. Contact through the [repository](https://github.com/ammarphp/trolley). Do not post personal information or withdrawal keys in public issues.
