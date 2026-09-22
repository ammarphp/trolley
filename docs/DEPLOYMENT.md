# Deployment

## GitHub Pages

The canonical repository is `ammarphp/trolley`, with the game at `https://ammarphp.github.io/trolley/`.

1. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
2. Set the Actions repository variable `COLLECTOR_URL` to the collector origin. It is public configuration, not a secret.
3. Push to `main`, or run **Deploy GitHub Pages** manually.
4. Inspect the build and deployment jobs. The Pages URL is an output of the deployment job.

The Pages build needs Node but no frontend dependency install. It runs the generator/SQLite tests and copies an allowlist of public assets into `dist/`. Server source, local databases, deployment credentials, and private run keys are never copied to Pages.

For a fork, update the homepage URLs and operator/contact values in both Pages workflows. All in-app asset URLs remain relative, so arbitrary repository subpaths work.

## Collector

The deployed collector is a public Cloudflare Worker with a D1 binding named `DB`. The deployment account is managed through Sites; the public game remains on GitHub Pages. Its source is also included in this repository so the service is portable.

- `GET /health`: service status; no database mutation.
- `POST /runs`: create an independent run, or retry its registration. Requires a random `runId`, random `runToken`, mode, engine version, and notice version. Returns `runNumber`.
- `POST /responses`: append an allowlisted, validated response under the run key. Retries are idempotent. Optional reflection updates are supported; changing the original choice is rejected.
- `POST /withdraw`: withdraw one run under its own key. Deletes its raw responses and creates a tombstone against late submissions.
- `GET /stats`: aggregate-only public data. No individual run endpoint or raw-data download exists.

The deployed `ALLOWED_ORIGINS` is `https://ammarphp.github.io`. CORS is a browser boundary, not authentication or proof of human participation. Never put an administrator key in `public/config.json`.

For local development:

```sh
pnpm collector:dev
```

This serves `http://127.0.0.1:8787`. To connect a local frontend, temporarily configure `collectorUrl`, `operatorName`, and `contactUrl` in `public/config.json`. Do not commit a local database. Test requests belong only in this local service.

For another Cloudflare account, create a D1 database, apply `collector/migrations/0001.sql`, bind it as `DB`, set `ALLOWED_ORIGINS`, and deploy `collector/worker.js` through Wrangler. A sample `collector/wrangler.example.jsonc` is included. Platform charges and quotas depend on the deployment account; the project does not promise unlimited free storage.

## Aggregate updates

**Update anonymous run aggregates** runs hourly at minute 23, subject to GitHub scheduling delays. It can also be dispatched manually. The script fetches `/stats`, validates an explicit output schema, and writes only aggregate fields to `public/aggregate.json`. Unexpected fields cannot leak through an object spread.

The same workflow commits the snapshot and deploys Pages. This is deliberate: a push made with the default Actions token does not generally trigger another push workflow. No personal access token is necessary.

If the collector fails or returns invalid data, the workflow fails and leaves the previous snapshot intact. The UI can fetch live aggregates separately. A static snapshot has a visible generation time and is never represented as live data.

GitHub may disable scheduled workflows in inactive public repositories. Check the Actions page if the snapshot stops advancing. The manual dispatch remains available after re-enabling the workflow.

## Updating the generator

Once real data exists, do not silently change the meaning of an existing seed/template/version. Increment `ENGINE_VERSION` for stimulus or sampling changes. Preserve an archive/tag for old versions. The current API accepts the current version only; supporting simultaneous old clients requires an explicit version router. Test old-link behavior when releasing a new version.

## Verification

Run `pnpm test`, `pnpm build`, and `pnpm test:browser`. Inspect at least the clean opening, stop 15, a late stop, the report, and a phone viewport. Test collection against the local adapter. Public deployment smoke tests should use `/health` and `/stats`; browser checks of production should use `?private=1`.
