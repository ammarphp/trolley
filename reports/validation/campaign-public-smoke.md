# Campaign Pages smoke check

The public campaign at [ammarphp.github.io/trolley](https://ammarphp.github.io/trolley/) passed the bounded browser smoke check below on 23 September 2026. The publication scope is the game only. Review materials were mistakenly included in an earlier deployment; the coordinator removed them after the owner corrected the scope. The earlier deployment is superseded. No additional synthetic choices were made during the cleanup check.

## Deployed identity and collection configuration

The actual public [build manifest](https://ammarphp.github.io/trolley/build-manifest.json) returned:

- Profile `production`, engine `2.0.0`, content `2.0.0-campaign.1`.
- Content hash `33630493964e3613acaa98e9a825a1698059805f2a73de0cf7bea47dc96bdde3`.
- Manifest hash `fc07d4f2808f970c8855d458984ccaa7cd45da2212ebf0190cdfb54297fd1e56`.
- 154 nodes, 154 reviewed nodes, collector v2 disabled.
- Critical gzip 443,164 bytes; `reviewArtifacts: []`.

The public [configuration](https://ammarphp.github.io/trolley/config.json) independently returned `collectorV2Enabled: false`. These JSON files were read with system curl using normal TLS verification. Direct JSON navigation was blocked by the in-app browser, and the local Python runtime lacked a suitable certificate chain; neither failure was bypassed by disabling certificate verification.

## Actual public-browser actions

Used a fresh public-origin tab in the Codex in-app browser. No viewport override was set or changed during this packet.

1. The opening loaded with its styled layout, rendered cabin and “Your run stays on this device.”
2. Started a fresh private run. The first dilemma, two route actions and unarmed lever appeared.
3. Selected **Save the coffee. Let the forms take it.**, then committed with the lever. The consequence and **Keep going** appeared.
4. Continued to the second dilemma without committing it. Pause opened with “Your place is saved. The world will not advance while you are away.” Back to the controls returned to play.
5. Settings opened and explicitly stated **“This run stays on your device.”** Collection was not enabled or otherwise changed.
6. Reloaded to the opening and opened **Sources**. Research links and the fiction/evidence boundary appeared.
7. Captured public game console warnings/errors: none returned.

Exactly **one** synthetic public-origin choice was committed. No public player data was intentionally submitted. This packet verified the disabled configuration and private UI state; it did not intercept every network request and does not make a separately measured no-POST claim.

The benign second dilemma’s **Decision details and sources** button focused the dilemma without expanding additional content. This is an existing low-priority empty-disclosure behavior, not evidence that its optional detail panel was verified. The opening’s full Sources panel was verified independently.

Evidence: [private settings](screenshots/campaign-public-private.png), [second decision after one commit](screenshots/campaign-public-second-decision.png).

## Game-only deployment and exclusions

[Pages run 35831677075](https://github.com/ammarphp/trolley/actions/runs/35831677075) completed successfully for commit `caa4e437243f4d17dc41e213230c35b9bc96345d`; both build and deploy jobs passed. Read-only GET requests after its completion verified:

| Resource | Result |
| --- | --- |
| Game root | HTTP 200 |
| Build manifest, queried with the deployment commit | Same `336304…` campaign hash; production profile; 154 reviewed nodes; `reviewArtifacts: []`; collector disabled |
| Public configuration, queried with the deployment commit | `collectorV2Enabled: false` |
| `reports/design-audit/index.html` | HTTP 404 |
| `reports/design-audit/assets/current-first-decision.png` | HTTP 404 |
| `reports/design-gallery/index.html` | HTTP 404 |
| `reports/review/index.html` | HTTP 404 |

No positive assessment or publication claim about the private review materials is retained in this report. The mistaken earlier inclusion was corrected by the coordinator. These 404 results establish removal from the current Pages deployment; they do not establish deletion of every historical Git object or externally retained copy.

The game browser actions above were performed before the scope correction on the same campaign content hash. The cleanup check uses read-only HTTP requests and does not imply a second full browser run.

This smoke check supplements the [two completed local campaign journeys and exact replays](full-campaign-browser.md). It does not repeat a full public campaign, certify real-device accessibility/performance, or activate aggregate collection.
