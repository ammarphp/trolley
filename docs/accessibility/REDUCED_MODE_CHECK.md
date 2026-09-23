# Reduced-mode browser check

Date: 2026-09-23 UTC. Local development build at `http://127.0.0.1:4181/`, tested in the Codex in-app Chromium browser through visible controls and accessibility labels. This is an independent slice acceptance check, not a full accessibility certification.

## Result

A fresh private run completed all ten requested choices and reached **Enough, for now** (`restraint`). Less motion, Less graphic detail, and Scene descriptions were enabled before Start and remained enabled at the ending. Sound remained off. The source drawer, decision record, record export, and saved-ending recovery were usable. No console warnings or errors were captured. No requests or POSTs were observed within the bounded network-monitoring interval described below.

The agent did not change the global viewport, force application state, invoke gameplay hooks, or edit a saved run. Screenshots were 1280 × 720. The temporary test tab was closed after verification.

## Procedure and route

On the opening screen, Settings was used to enable all three requested preferences. Sharing remained off; the development collector was disabled. Each decision used its visible route button to arm the choice and the grip to commit. At decision nine, Enter activated both the route button and the grip. Other commits used pointer clicks.

| Decision | Visible choice | Exported semantic option |
| --- | --- | --- |
| 1 | Save the coffee | `coffee` |
| 2 | Keep the sandwiches dry | `lunch` |
| 3 | Turn. One will die. | `divert` |
| 4 | Use the side track | `obstruction` |
| 5 | Check its route first | `check` |
| 6 | Use it in this clinic | `clinic` |
| 7 | Approve each change | `bounded` |
| 8 | Test the new scope | `new-test` |
| 9 | Keep it. Practice using it. | `fallback` |
| 10 | Pause. Verify both labs. | `agreement` |

Scene descriptions appeared in the accessibility status text at each decision. The descriptions explicitly stated that travel was represented without continuous camera motion. The cabin and world remained understandable in the observed reduced-motion frames. This check did not quantify temporal motion or flash thresholds.

At decision three, **Look closer** exposed the receipt, scene description, and fictional-parameter disclaimer. **Sources for this decision** exposed Philippa Foot's *The Problem of Abortion and the Doctrine of the Double Effect*, a source locator, and scope limitations. Its displayed link was `https://sites.pitt.edu/~mthompso/readings/foot.pdf`. The external PDF was not opened during this check. Closing each drawer left the decision uncommitted.

At the ending, **Read your decisions** exposed all ten records. Expanding **10. A pause that means something** showed the requested and executed choice as `agreement`, executor `human`, status `free`, and the consequence that inspectors could enter. The ending's chart descriptions exposed these fictional sequences:

- GDP index: `1000, 1000, 1000, 1000, 1000, 1050, 1080, 1080, 1000, 940`.
- Recorded deaths: `0, 0, 1, 2, 2, 2, 2, 2, 2, 2`.

**Export this run** produced an actual JSON download. Filesystem inspection confirmed ten journal entries, ending `restraint`, a private run, the exact options above, and preferences `{reducedMotion: true, reducedGraphics: true, audio: false, descriptions: true}`. Ending Settings independently showed all three requested preferences still checked and sound off.

## Observations and repair verification

The first ending rendered **What changed the route** using only two early casualty choices. This omitted the fallback and inspections that explain the restraint ending. The root agent repaired event selection. After the new build, this test reloaded, opened **Saved records**, selected the exact **10 decisions · Enough, for now** record, and opened **View this ending**. The corrected summary named independent review, crews practicing the manual network, and a joint pause with reciprocal inspections. The ending screenshot was replaced with this corrected version. No choices were replayed or altered during that repair check.

One minor copy issue remains: composed scene descriptions occasionally contain doubled terminal punctuation, such as `die..`. This did not block comprehension or interaction in this check.

## Network and console evidence

The documented browser CDP capability enabled `Network` before preference changes and before Start, but **after the initial page load**. `Network.requestWillBeSent` events were read from cursor 24 through cursor 32 after the ending, decision-record export, and Settings verification. The returned request list was empty, with `hasMore: false` and `truncated: false`. Thus there were zero observed requests and zero observed POSTs during that interval. This statement does not cover the initial document load, the later reload used to verify the debrief repair, other consent states, or a live collector.

The tab's captured warning/error log query returned `[]`. This was an application run in the in-app browser, not an assertion about every browser or platform.

## Artifacts

Evidence files remain under the ignored validation area, outside the public build. The raw synthetic run download remains in Downloads; it was not copied into the repository or published.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `reports/validation/screenshots/reduced-mode-decision10.png` | 87,978 | `8fceca1ff648ace855a555fb4ee94a7f2f16e95b1be904218de12f58dcf3f489` |
| `reports/validation/screenshots/reduced-mode-restraint.png` (corrected debrief) | 72,117 | `f7186b99abb3a335d7c4615728ae4b9007ee14069677dd97f11e269be5c60e33` |
| `/Users/ammaraziz/Downloads/trolley-run (2).json` | 44,809 | `a10291d28cae21518fecadeefc7a291fe71d5ff9a15600f35b83197757376f9f` |

The post-route `dist/game.js` file inspected at 04:12 UTC had SHA-256 `b55474adf6ab23bf8b10c631f442b37590c9e97edc5243af1f1b114553544f02`. After the debrief repair/reload, the post-check local bundle had SHA-256 `5f6905cc97e2254f30dcfcc1f9872b5f65d6c83169c782765d2adc27c1826eff`. These are filesystem bundle hashes, not hashes recovered from browser response bodies. The root agent rebuilt concurrently; the two observations are intentionally distinguished.

## Remaining acceptance limits

- This early closure does not exercise late visceral imagery or prove narrative equivalence throughout the reduced-graphic campaign.
- Accessibility-tree observations and one keyboard activation pair do not substitute for a complete keyboard/focus audit or actual screen-reader testing.
- No phone, Safari, assistive-technology, hearing, vestibular, color-contrast, or photosensitivity certification is implied.
- The exact ten-choice route and this ending passed. Other endings, timing, long-session pacing, collector operation, and publication gates require their own evidence.
- Owner review of immersion, art, pacing, and the visceral/reduced-graphic treatment remains pending.
