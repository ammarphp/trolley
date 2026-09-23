# Full campaign browser verification

## Result and scope

Two fresh private runs completed through ordinary UI actions on `http://127.0.0.1:4181/` in the Codex in-app browser. Both downloaded replays reproduced exactly with `scripts/replay.mjs`. No browser warnings or errors were returned by the captured console checks. No application state was forced and no developer fixture was used for these journeys.

Verified build identity, read from `dist/build-manifest.json` and independently present in both downloaded replays:

- Content: `33630493964e3613acaa98e9a825a1698059805f2a73de0cf7bea47dc96bdde3`
- Manifest: `fc07d4f2808f970c8855d458984ccaa7cd45da2212ebf0190cdfb54297fd1e56`
- Engine `2.0.0`, content `2.0.0-campaign.1`, production profile, 154 reviewed nodes.

| Actual browser journey | Decisions per stage | Ending | Replay |
| --- | --- | --- | --- |
| Normal motion; retained review, inspection, fallback crews and reciprocal inspections | 5 / 5 / 5 / 7 / 4 / 0 / 0; **26 total** | **Enough, for now** (`restraint`), an absorbing stage-five ending | [Export](replays/campaign-browser-normal.json), [verified summary](replays/campaign-browser-normal-verified.json) |
| Less motion, Less graphic detail and Scene descriptions enabled before starting; expanded authority, then attempted revocation; completed all seven stages | 4 / 5 / 6 / 5 / 7 / 5 / 3; **35 total** | **The next shift** (`succession`), ratifying power Morrow already held | [Export](replays/campaign-browser-reduced.json), [verified summary](replays/campaign-browser-reduced-verified.json) |

These are functional tests, not human pacing studies. The first route ends before stage six because the retained checks make restraint possible; it was not shortened by test manipulation.

## Actual interactions checked

**Normal journey.** An authored question produced the complete Morrow reply; its reasoning disclosure expanded. At the long “Eighty Megawatts and a Priority List” decision, Pause opened correctly. Reload followed by **Resume your saved ride** restored the same prompt, route sides and unarmed lever. At 1280 × 720, this long decision had no horizontal overflow and the 44-pixel lever ended at y=694. The ending opened, Sources and assumptions opened with its research links and fiction boundaries, and Export replay downloaded an actual file.

**Reduced journey.** All three selected preferences survived a late Pause/reload/resume, as checked in Settings. Sound remained off. Advice appeared in full immediately. Static route outcomes remained usable. The naturally sampled “One either way” showed one person on each route, confirming the newly bound figure counts. The independent-brake loop also appeared in the ordinary story and produced a static held outcome. At stage six, **Revoke Morrow’s research permission** displayed “You pulled the lever. It chose for you.” The exported record independently contains requested `stop`, executed `continue`, status `overridden`, executor `assistant` for S6-10. The journey then reached stage seven and completed three stage-seven choices. The ending, decision record and Export replay remained usable.

**Narrow viewport.** At 390 × 844 the delegation decision had a 352 × 318 canvas and no horizontal overflow. Its longer prose placed the lever below the initial fold (y≈948); normal vertical scrolling/locator scrolling reached and committed it, with no overlay collision. The narrow ending also had no horizontal overflow. This is emulation in a desktop browser, not a physical-phone test. The viewport override was reset after testing.

Both runs were private. The reduced run’s settings explicitly showed “This run stays on your device.” The build manifest disables the collector, but no network interception was performed in this packet, so this report does not claim an independently observed absence of POST requests.

## Evidence

- [Normal chat and reasoning](screenshots/campaign-final-normal-chat.png)
- [Normal resumed long decision](screenshots/campaign-final-normal-resumed.png)
- [Normal ending](screenshots/campaign-final-normal-ending.png)
- [One person on each route](screenshots/campaign-final-reduced-one-each.png)
- [Reduced independent-brake outcome](screenshots/campaign-final-reduced-brake.png)
- [Reduced phone decision](screenshots/campaign-final-reduced-phone390.png)
- [Recorded override](screenshots/campaign-final-reduced-override.png)
- [Reduced ending](screenshots/campaign-final-reduced-ending.png)
- [Reduced phone ending](screenshots/campaign-final-reduced-ending-phone390.png)

The normal replay arrived as `Downloads/trolley-replay (4).json`, 101,780 bytes, SHA-256 `3f0ad7f008ad62c80c1fb690d3a7bf8ee581dca8cd1c2e984a37ee4fda01e210`. The reduced replay arrived as `Downloads/trolley-replay (5).json`, 155,478 bytes, SHA-256 `c85ca1de2cf2fb3971859237748b1542bee06ac2af907013a8a22af077c8cc91`. Copies and exact replay-verification outputs are linked above. The browser download-event waiter is unreliable in this host; filesystem existence and JSON identity were checked after the ordinary UI click.

## Physical fixes and remaining limits

Before the final journeys, the draft loop-stop frame pointed across an empty field. The fix narrows the returning loop and uses a consistent rear-mounted camera eye throughout travel. Physical contact distances are unchanged. Projection tests retain the contact and downstream group inside the windshield on both sides and under translated/rotated world origins. Twelve focused presentation tests and full type checking passed before rebuilding. Actual intermediate-build frames then showed connected rails, the independent brake at the windshield base, and the downstream five. The final reduced journey exercised both loop cases again.

The worker glyph remains upright after a fatal body-stop consequence; this is an unresolved illustration limit. These checks do not certify injury animation, continuous 100-turn motion after the latest camera changes, physical-phone performance, screen-reader usability, measured 30–45-minute human pacing, deployed Pages behavior, public data collection, or owner acceptance of the art. Current gallery alternatives are a separate design review.

Draft `ac7b5…` and superseded `4bfd7…` runs were used only to diagnose framing and compact-layout issues. Their incomplete exports and screenshots were moved to ignored `.build/campaign-browser-drafts/`; they are not final release evidence. A premature stage-three panel on a stage-two consequence was fixed by the coordinator and was absent in the subsequent checks.
