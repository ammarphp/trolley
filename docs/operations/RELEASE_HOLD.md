# Publication guard and release authorization

The owner authorized completion of the 154-node campaign, a GitHub push and Pages publication on 23 September 2026. This supersedes the earlier local-only hold; see [decision 004](../decisions/004-full-campaign-and-design-review.md). No new permission request is needed for that authorized release. The source-controlled publication guard remains in force so an unfinished or malformed build cannot publish accidentally.

The campaign has received its editorial review and has been promoted to the `story` manifest with reviewed nodes. The builder maps that manifest to `profile: production` in `dist/build-manifest.json`; a test campaign maps to `development-campaign`. Both the main-push Pages workflow and the scheduled aggregate workflow deny publication unless the built profile is exactly `production`. Final validation and deployment outcomes are recorded separately in the [full campaign release report](../../reports/validation/full-campaign-release.md), which is being assembled during release. This document does not claim those checks or the deployment have already succeeded.

The guard runs after the static build. A development campaign or slice, absent profile, unknown profile, null or other non-production value produces `publish=false`, a visible Actions notice and a job-summary explanation. Pages configuration, artifact upload and deployment are skipped. The aggregate workflow also skips its remote snapshot reads. A missing or malformed manifest file fails the build job with an error; deployment remains blocked.

The default remains deny. Manual dispatch, collector settings and repository variables do not override the profile. There is no workflow input that releases the hold. Tests and local builds continue normally while publication is held. This does not remove or alter an already deployed site.

## Authorized campaign release

Changing the source-controlled campaign from a test profile to `story` is a reviewed release change, not a workaround for a failed workflow. Record the authorization, exact commit/content/manifest hashes, completed checks, route witnesses and remaining limitations. The current release includes the full campaign bank, ordered physical rail cases and population identity additions. The visual audit and mockups are private local review material and are excluded from both the public repository and Pages.

**Public collection remains disabled.** The authorization to publish the game does not enable a research collector, provision its service, or approve live participant recruitment. A production profile also does not waive GitHub environment protections or the service's independent configuration and manifest approvals. Physical-device accessibility, full semantic-model coverage, visual acceptance and collector operations remain separate from build success; their actual status belongs in the release report. Do not claim uninspected remote settings are verified.

## Historical guard verification

The original guard packet parsed both workflow files with Ruby Psych, checked guarded build outputs and deployment steps, and exercised the embedded Node guard against development, absent, unknown, malformed and production profiles. That local work performed no remote action. Its results remain in [the bounded artifact audit](../../reports/validation/artifact-boundaries.md) as historical evidence. Use the current full-campaign release report for the final artifact and workflow revision, rather than treating the earlier slice audit as its validation.
