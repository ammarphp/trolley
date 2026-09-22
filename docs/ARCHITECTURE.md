# Architecture

The public game is static HTML, CSS, and native ES modules. It is built to `dist/` and deployed under the repository path on GitHub Pages. Every frontend asset uses a relative URL. No route rewrite is required. Dilemma links use query parameters, so reloads work on Pages.

## Experience

The Canvas renderer projects world coordinates into a moving rear-view scene. Sleepers and verge marks flow toward the camera while the trolley goes forward. An unanswered dilemma has no time limit. Targets remain available until a choice; no countdown secretly chooses for the player. A choice steers the trolley toward the selected branch, briefly shows the consequence, and advances. Reduced motion requires manual advancement.

Presentation deteriorates continuously as a function of stop depth. Narrative chapters change at stops 1, 4, 9, 15, 22, 30, and 39. Visual decay is separate from those discrete chapters. Calm mode changes presentation only. The scene includes staged pauses at three turning points, each with a visible skip and a short timeout. It never imitates an operating-system security alert or locks the user into the game.

`engine.js` samples compatible parameters inside authored templates. It does not freely combine arbitrary premises. `descent.js` selects a chapter pool using the run seed and recent choice history. The branching is bounded and reconvergent. Choices alter selections, not an exponential tree of handcrafted endings. The exact selected template and seed are stored with every response.

## Run isolation

`runs.js` creates two random values for each run: a run ID and a secret withdrawal key. There is no persistent visitor identifier. The server hashes the key and assigns an integer run number. A browser may retain several independent run keys locally, but it never sends an archive containing multiple runs, a browser identifier, or their local grouping.

The server stores `runs` and `responses`. Responses refer to exactly one run. `response_id` and `(run_number, ordinal)` uniqueness prevent retry duplicates. A response choice cannot be edited server-side after initial submission; optional reflections can be updated under the same key. Public statistics do not expose either IDs or keys.

The app sends a response when it is made, then sends updated optional reflections when continuing. Unsent eligible responses remain locally queued after a network error. Leaving immediately can prevent the last request from reaching the collector. The UI never claims that a request attempt is confirmed delivery.

## Hosting

- **GitHub Pages:** public game and aggregate snapshot.
- **Cloudflare Workers/D1, deployed through Sites:** writable run collector.
- **GitHub Actions:** scheduled read-only pull from `/stats`, allowlisted aggregate fields, a snapshot commit, and a Pages deployment in the same workflow.

The collector does not hold a GitHub credential. The client does not hold a service credential. The snapshot workflow uses the repository-scoped Actions token. Scheduled workflows may be delayed and public repository schedules may be disabled after inactivity; check Actions when freshness matters.

The collector schema is initialized idempotently on first database use. It can also be applied manually from `collector/migrations/0001.sql`. The local adapter uses the same SQL against a real SQLite database. SQLite tests cover application behavior; deployment verification covers the production Worker. They do not simulate every Cloudflare platform failure.
