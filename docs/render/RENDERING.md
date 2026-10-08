# Drawing a moving world in ink

This note documents how the game draws a continuously moving 3D world so that every frame reads as one technical pen drawing. Everything in it is original procedural code in `src/render/`. There are no downloaded models, textures or shaders.

## Goals and constraints

- **One hand.** Hundreds of assets built by different people must look drawn by the same illustrator, with the same pen, on the same paper.
- **White paper.** The owner's rule: white surfaces, black line work, colour only where it means something. Darkness in the world must come from ink density, never from a dark theme.
- **Motion without swimming.** The camera travels constantly and turns with the track. Hatching must stay attached to surfaces rather than sliding across them like a screen-door texture.
- **Legibility at distance.** Most of what matters (people on a track, a sign, a data hall) is seen at 20–200 m. Silhouette and contrast have to survive that.
- **Truthfulness.** The world must be derivable from the simulation's visible state and must not decide anything. Cosmetic randomness is seeded, never `Math.random`.

## The two-pass pipeline

`src/render/core/ink-pipeline.ts` renders the scene once into a two-attachment render target (MRT, half-float), then composites to the screen.

### Pass 1: materials write ink, not colour

`src/render/core/ink-material.ts` starts from Three's `MeshLambertMaterial`, so it keeps directional light, hemisphere light and PCF shadow maps. It injects code at three points: the vertex header, the end of the vertex shader, and the opaque output. The fragment shader outputs:

| Attachment | R | G | B | A |
|---|---|---|---|---|
| 0 (ink) | coverage 0..1 | pigment amount | pigment index / 8 | contour weight |
| 1 (info) | view normal x | view normal y | view normal z | object id |

Coverage is computed in three steps:

1. The Lambert result is converted to a light level relative to a fixed daylight reference (`uInkLitRef`), so night and storms really are darker.
2. A *tone* is formed from the surface's albedo (`paper`, `pale`, `light`, `mid`, `dark`, `deep`, `solid`) plus a shadow term.
3. The tone is rendered as pen strokes:
   - **Hatching:** up to three families of parallel strokes (±45° and near-horizontal). Each stroke's width breathes along its length with value noise, strokes occasionally lift, and each family fades to its mean coverage where it would alias (`fwidth`).
   - **Stippling** (`pattern: "stipple"`): one jittered dot per cell, radius growing with tone. Used for ballast, earth and cloud.
   - Tones above 0.9 become solid ink fills, such as a Holstein's patches, a coat or an open doorway.

Strokes are placed **triplanar** with blended weights, in one of three spaces:

- **world** space for scenery, so hatching is anchored to the landscape (a floating-origin offset keeps it continuous);
- **object** space for moving actors, whose hatching travels with them (skinned bodies hatch in their posed frame);
- **view** space for the cab, which never moves relative to the eye.

Geometry may carry a per-vertex `inkAttr` (tone, pigment amount, pigment index). An asset is built from primitive *parts* with the `Kit` in `src/render/core/geometry.ts`, merged into one geometry, and drawn in **one draw call** with per-part albedo.

Signs, documents and screens use an *inked canvas* (`createInkCanvas`). Dark texels become ink, bright red becomes signal pigment, dark red becomes blood, and transparent texels are cut out.

### Pass 2: contours, paper and pigment

The composite shader detects three kinds of line:

1. **Depth creases and silhouettes.** The *second difference* of inverse depth, `|w(−o) + w(+o) − 2w(0)| / w(0)` with `w = 1/z`, is sampled along four axes. Because `1/z` is affine across a plane in screen space, flat ground produces no lines at grazing angles, while folds and occluding edges do. Lines are one-sided (only the nearer surface draws), so strokes hug objects instead of haloing them.
2. **Normal discontinuities**, for box edges and roof ridges.
3. **Object-id changes**, for separate objects touching at similar depth: feet on ground, a cup on a rail.

Then:

- Line radius grows for near silhouettes (heavier pen close up).
- Lines and hatching fade with distance: aerial perspective as lighter pen pressure.
- Pigment sits *under* the hatching like watercolour under ink.
- Paper grain is fixed in screen space, because the paper is the screen.
- A hand-drawn **wobble** displaces all sampling by a coherent pixel or two.

Global effects are uniforms of the same pass:

- **boil** (lines redrawn at ~7 Hz when the controller is exhausted);
- **haze** (storm wash);
- **negative** (lightning inverts paper and ink; skipped when *No flashing* is on);
- **glitch** (bands slip sideways when control is seized);
- **vignette** (dissociation).

## The palette is a grammar

`src/render/core/palette.ts` defines paper, ink, seven named tones and seven pigments. Pigment is scarce and meaningful:

- **amber:** selection and hi-vis;
- **signal red:** danger, the jam, the brand's full stop;
- **blood:** consequence only; removed by *Less graphic detail*;
- **cobalt:** Morrow and nothing else;
- **leaf, ember, cyan:** rare accents for recovery, fire and server lamps.

## The world is drawn as you approach it

- **Track** (`world/track/`): lines are arc-length curves grown from eased bends. A fork is a pair of constant-radius turnouts (~40 m) that separate the two routes by more than 14 m where the stakes stand. Rails are swept profiles, sleepers are aligned boxes, ballast is stippled, and the switch blades pivot at their heel when the points are thrown.
  - New track is **inked outward** at 180 m/s from the toe, so a fork visibly draws itself.
  - Chunks are built in local frames, so geometry precision holds across tens of kilometres.
- **Journey** (`world/journey.ts`): the trolley eases toward a hold point 6 m short of the fork. Speed decays like `min(v, √(2·a·gap), k·gap)`: it approaches forever and never arrives, so reading time is unlimited while the scenery keeps moving. After commit it takes the executed branch, meets what is on it, and brakes smoothly where a mechanism stops it.
- **Scatter** (`world/scatter.ts`): world-anchored cells are populated as they enter a 560 m radius, using the *environment at that moment*. Change therefore arrives with new landscape rather than popping in place. Repeated prefabs are instanced.
- **Tableaux** (`world/staging.ts`): each option's occupants are placed along its branch, with a destination beyond and an enamel sign at the toe. Crews bent over the rail have their backs to the trolley; people on the move are side-on; everyone else has seen it coming. A colour-light junction signal stands beside the fork: it shows red while the decision is open, turns amber and lights the feather of the armed route (or of the forced route, under a standing order), and clears to green only when the lever is pulled. Authored staging covers all 154 nodes (`render/staging/`), outside the hashed content bank.
- **The road not taken** is drawn for a while, then the pen lifts its far reaches a stretch at a time, keeping only what stands by the junction.
- **Tunnels** (`world/tunnel.ts`): a stage change runs through a cutting into a wooded hill, under a masonry headwall with wing walls, through a ribbed bore lit by lamps. The tunnel inks in over a second and a half, ahead of the cab. The world outside is redrawn while the cab is inside, and the next dilemma waits until the cab is out of the far portal (a key aimed at the page, or a click on the world, skips ahead), so it is read in the world it belongs to. While it waits, nothing about it is recorded: it is exposed, consulted and timed only once revealed.
- **Lineside** (`world/lineside.ts`): a pole route of telegraph poles with sagging wires follows the line, and runs out along both branches of an open fork so the two routes diverge with the track. Poles are instanced; the wires are one batch of hairlines rebuilt only when a pole comes or goes.
- **River crossings** (`world/river-crossing.ts`): now and then, seeded by the decision, the line crosses a river on a bridge before the fork: a through truss over wide water, plate girders over narrow, sometimes a masonry viaduct. Reeds line both waterlines and willows stand on the banks. Each arm of the river bends away behind the crossing and stops short of any other drawn track.

## The director

`src/presentation/derive.ts` is a pure function from the immutable campaign to a `StageView`:

- **Environment channels**, all 0..1: vegetation, leaves, fauna, habitation, industry, compute, surveillance, perfection, ruin, fire, drought, cloud, storm, lightning, fog, speed, time of day and more.
- **The controller's face stage**: composed, then shock at the first death, then withdrawn, exhausted, grieving and absent.
- **Monotone windshield history**: impacts and blood.
- **A deterministic, bounded schedule of scripted disruptions**: one freeze, one false dawn, one revised reply, one logo flash, and the jam where the content predicts an override.

The game spans **one long day**: the first decision is at 06:40 and late decisions fall at dusk and night. Recovery endings wake to the next dawn; tutelage endings sit in a flat, perpetual noon.

## Budgets and quality tiers

| Tier | Pixel ratio | Shadows | Scatter density |
|---|---|---|---|
| high | ≤ 2 | 1536² PCF | 85% |
| medium | ≤ 1.5 | 1024² PCF | 70% |
| low | 1 | off | 50% |
| software WebGL (no GPU) | 0.6 | off | 50%, at most 20 frames a second (4 under Less motion) |

The pipeline costs one scene pass plus one fullscreen composite. Instanced scenery is culled per instance against the view (keeping everything within 90 m for the shadows it casts into view), and small prefabs drop out beyond the distance where the pen can no longer resolve them. The HUD panels are frosted paper rather than a backdrop blur: a blur over the live drawing would be recomputed every frame. Browsers without WebGL2 get `render/fallback.ts`: a static drawing with the same controls and scene descriptions.

## Verifying art

`scripts/lab-shot.mjs` renders any `*.lab.ts` scene through the real pipeline on the GPU (Metal locally, SwiftShader in CI) and writes a PNG. Every asset family ships a lineup sheet and a view from the cab's eye point. Assets were iterated against those renders, not judged as isolated models.
