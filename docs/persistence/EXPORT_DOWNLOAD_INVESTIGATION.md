# Export download investigation — 23 September 2026

Status: **the reported in-app-browser failure is unresolved**. No speculative change was made to `safeDownload`, its caller or persistence behavior.

## Inspected path

`src/ui/app.ts` prepares the ending's replay before enabling Export replay. The enabled button calls `safeDownload` synchronously. `src/persistence/index.ts:248` serializes a JSON Blob, creates an object URL, clicks a detached anchor carrying `download`, and revokes the URL after one second. There is no awaited computation between this button click and anchor activation. This inspection does not establish that the native host accepted or completed a download.

Earlier [browser evidence](../../reports/validation/geometric-browser-integration.md) records failure from a long-lived tab, then success after opening that saved ending in a fresh tab. The coordinator reported the same symptom during the new fourteen-choice ending: no file and no captured error. Those are coordinator observations, not reproduced by this agent.

## Actual bounded UI control

This agent's CUA inventory exposed **Chrome only**, through the browser extension. Its browser ID `1` identified Chrome; the coordinator's in-app browser was a different surface with different storage. Explicit in-app browser creation was unavailable. Browser IDs must not be treated as portable between these agent sessions.

A new Chrome tab at `http://127.0.0.1:4181/` showed one five-decision unfinished saved run. Through the actual Saved records UI, Export this saved record was activated twice in that same tab. Both downloads completed:

- `~/Downloads/trolley-saved-run.json`
- `~/Downloads/trolley-saved-run (1).json`

Both are 25,396 bytes with SHA-256 `6d24053c6d9422aa797c759c57eb4e89762757e1df792b794dc8c382a72b1912`. JSON parsing succeeded. The exported run ID is `df9ca52b-6e4b-48a0-a401-3c0284f60241`, content hash `a2db04248a4578e2c0939c390ec3c06d4be490f45a005d501866879d6d2c9efa`, and the secret is absent. **This is not the coordinator's latest fourteen-choice run or its replay artifact.** It is an independent control for the shared download helper, with an older saved payload.

No run was played, modified, shared or withdrawn. No viewport was changed. The temporary Chrome tab was closed; downloaded files were retained. This test was actual UI interaction, not a mocked DOM or injected click handler.

## What the evidence supports

The current detached-anchor/one-second-revocation implementation successfully downloads this payload twice in Chrome. Neither feature is thereby proven safe in every host, and neither has been established as the cause of the in-app failure. The HTML download algorithm allows a browser to decline a download and delegates saving to the implementation; a returned anchor click is not file-completion evidence. See the [HTML downloading algorithm](https://html.spec.whatwg.org/multipage/links.html#downloading-resources).

The File API says requests begun before revocation should succeed, while later dereferences fail. A host that defers resolving the Blob could therefore be affected by early revocation, but **no observation here shows that this happened**. Merely extending the timer would not establish a fix. See [File API revocation](https://w3c.github.io/FileAPI/#dfn-revokeObjectURL).

## Next discriminating check

On the failing in-app tab, capture an export attempt with host download-start/completion/cancellation evidence, alongside whether the enabled button handler ran with active user involvement. Compare the same saved payload in a fresh in-app tab. If host dereferencing starts after the one-second cleanup, test a controlled delayed-cleanup change. If the host blocks or loses the request before it begins, changing Blob lifetime addresses the wrong failure. Any temporary diagnostic should record only event status, filename, byte length, focus/visibility and activation flags, never the run payload or withdrawal secret.

The browser cannot currently confirm successful file delivery to the application. Keep success claims tied to an actual downloaded, parsed artifact. No new unit test was added because a fake anchor would only assert the existing implementation and could not reproduce the host failure.
