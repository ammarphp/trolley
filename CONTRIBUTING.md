# Contributing

Keep the play surface small. Put explanation in the field guide or repository, not around every button.

For content changes, read [CONTENT.md](docs/CONTENT.md) and [METHODOLOGY.md](docs/METHODOLOGY.md). Include the exact template ID and seed when reporting a contradictory dilemma. A good new template tests a distinct idea and has clearly specified consequences on both routes.

For code changes:

1. Install with `pnpm install --frozen-lockfile`.
2. Run `pnpm test` and `pnpm build`.
3. Run the browser checks and inspect phone/desktop views for visual changes.
4. Test collection only against a local collector. Use `?private=1` when inspecting the public game.
5. Update documentation when behavior or the data contract changes.

Once the public experiment has responses, stimulus changes require an engine-version decision. Preserve deterministic replay. Never commit local run exports, databases, credentials, or raw response data.

Bug reports should say what happened, what was expected, and a reproducible seed if relevant. Do not post personal information or run keys.
