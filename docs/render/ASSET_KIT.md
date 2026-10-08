# Ink asset kit: conventions for the asset library

The new renderer draws a real-time 3D world as technical pen work: contour lines from depth/normal discontinuities, cross-hatching driven by light and shadow, solid ink fills, and a few pigments. Everything on screen is procedural TypeScript geometry. No downloaded models, textures or fonts inside the 3D scene.

The look to aim for is a skilled illustrator's technical ink drawing: Moebius, architectural pen renderings, engraved railway manuals and field guides. It should not look like clip-art, toy blocks or low-poly mobile games. The drawing reads because proportions are right, silhouettes are specific, and detail sits where the eye lands. Hatching comes from lighting, so give surfaces real orientation: bevels, overhangs, recesses, folds.

## Coordinates and units

- Metres, Y up. The ground is y = 0 at the asset origin.
- Assets face **+Z** (their front/face/door looks toward +Z). The origin is at the base centre.
- Real-world scale matters. A person is 1.55–1.90 m, a cow 1.4 m at the shoulder, a two-storey house 7–9 m to the ridge, a data hall 12–18 m tall and 60–200 m long, standard gauge 1.435 m.
- Seen from the cab, the player views most assets at 20–200 m. Silhouette and major masses matter most. Fine detail matters for props within 5–30 m.

## Building geometry

Use `Kit` from `src/render/core/geometry.ts`:

```ts
const k = new Kit();
k.add(block(6, 3.2, 5), { tone: "paper" });                  // walls, white
k.add(gable(6, 5, 2.4), { tone: "mid", position: [0, 3.2, 0], rotation: [0, Math.PI / 2, 0] });
k.add(block(0.9, 1.9, 0.12), { tone: "dark", position: [0.8, 0, 2.52] }); // door
const mesh = new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
```

- One asset is one merged geometry with per-part albedo in the `inkAttr` attribute: one draw call. Animated assets are the exception (see below).
- **Tones:**
  - `paper` 0: the default for most walls, bodies and skies.
  - `pale` 0.12 and `light` 0.26: slight greys.
  - `mid` 0.42: roofs and trousers.
  - `dark` 0.62 and `deep` 0.8: coats, tyres, window glass.
  - `solid` 1: pure ink, used for cow patches, hair, black paint and openings.

  Keep a white-dominant world. Most surfaces should be `paper` or `pale`, so lighting provides the hatching. A dark tone is a design decision, not a default.
- **Pigment** is rare and meaningful: `blood`, `signal` red, `amber` (hi-vis, beacons), `cobalt` (Morrow only), `leaf` (living green, used sparingly), `ember` (fire), `cyan` (server status lamps). Pass `{ accent: "amber" }` on a part. Never use pigment for decoration alone.
- **Hatch space:** `inkMaterial({ vertexInk: true, hatchSpace })`
  - `"world"` for static scenery.
  - `"object"` for things that move: people, animals, vehicles, anything animated. Their hatching then travels with them.
  - `"view"` is reserved for the cab.
- `hatch` sets the stroke period in metres. The defaults are 0.16 for world and 0.035 for actors. Very large buildings may use 0.25–0.4; small props 0.015–0.03.
- `edge: 0` disables contours. Use it for grass tufts and particles only.
- Add small asymmetries with `jitter()` for organic forms (foliage, rocks, animals, cloth). Keep architecture crisp.
- Materials are shared through `inkMaterial(options)`; don't create new materials per instance.

## Budgets

| Class | Triangles (typical, max) |
|---|---|
| Person / animal | 1,200 / 2,500 |
| Small prop | 300 / 1,000 |
| Vehicle, machine | 1,500 / 4,000 |
| Tree / scatter item | 800 / 1,600 |
| House-scale building | 2,000 / 5,000 |
| Landmark (data centre, power station) | 6,000 / 15,000 |

Scatter items are rendered with `InstancedMesh`. A builder that feeds scatter must return a **single geometry** (no hierarchy) and should offer 3–6 seeded variants.

## Animation

Animated actors (people, animals, drones, turbines, wipers) return an `THREE.Object3D` whose `userData.tick = (dt: number, t: number) => void` advances its motion. The renderer calls `tick` only while the actor is on screen. Animation uses only the actor's own seeded phase. Never call `Math.random()` anywhere in `src/render`: take an `Rng` (from `src/render/core/rng.ts`) or a seed.

People and animals may use rigid-part skinning (a `THREE.SkinnedMesh` where each part's vertices bind 100% to one bone). This keeps one draw call per actor with jointed motion. Poses are procedural bone rotations, not keyframe files.

## Factories and catalogues

Each category exposes a typed factory plus a catalogue for the lab and for coverage tests. For example:

```ts
export function buildLandmark(id: LandmarkId, options: { seed: number | string; env?: Partial<EnvironmentTarget> }): THREE.Object3D;
export const LANDMARKS: readonly LandmarkId[];
```

The ids come from `src/render/api.ts`. Every id in the relevant union must be buildable, and an exhaustive `switch` keeps the compiler honest. Environment channels (`leaves`, `ruin`, `perfection`, `uniformity`, `drought`, `fire`) may change which variant you build (bare trees, scorched walls, sealed windows, identical copies).

## Verify visually, every time

Each asset directory has one or more `*.lab.ts` files exporting `scenes: LabScene[]` (see `src/render/lab/types.ts`). Provide:

1. A **lineup** sheet showing every id and variant side by side with captions, viewed from about 25° above eye level.
2. An **in-situ** view from the cab's viewpoint: camera at y = 2.5, looking down the track (−Z), 55° fov, with your assets placed at realistic distances (15–150 m) on either side of a straight track. This is how the player sees them.

Render a scene through the real pipeline on the GPU:

```sh
node scripts/lab-shot.mjs <scene-name> --file src/render/<dir>/<file>.lab.ts --out <scratch>/shot.png --w 1280 --h 720 --t 1
```

Judge the PNG against the quality bar above, and iterate on proportions, silhouette, detail placement and tone until it reads as a professional illustration. `pnpm typecheck` must pass.

## Boundaries

- `src/render/core/*`, `src/render/api.ts`, `package.json` and lockfiles are shared core; change them deliberately, since every asset depends on them.
- Don't import from `src/ui`, `src/simulation`, `src/content` or `src/persistence`.
