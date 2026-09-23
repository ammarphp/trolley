import assert from "node:assert/strict";
import test from "node:test";
import {
  ANIMALS,
  animalPaths,
  figurePaths,
  type AnimalKind,
} from "./glyph-catalogue.ts";
import { backdropArt, structuralArt, rearViewArt } from "./environment-art.ts";
import { visualIntensity } from "./visual-state.ts";
import { GraphicsPath } from "pixi.js";
import { artSvg, cabinLayers, type ArtKind } from "./ink-art.ts";

test("all cabin and catalogue path variants pass the actual Pixi path parser", () => {
  const kinds: ArtKind[] = [
    "cow",
    "deer",
    "pig",
    "dog",
    "rabbit",
    "sheep",
    "person",
    "robot",
    "tree",
    "bare-tree",
    "house",
    "clinic",
    "server",
    "pylon",
    "drone",
    "flower",
    "ruin",
    "column",
    "cup",
    "hat",
    "umbrella",
    "parcel",
  ];
  const sources = Object.values(cabinLayers());
  sources.push(rearViewArt(1, 0), rearViewArt(7, 1));
  for (const biome of [
    "field",
    "town",
    "lab",
    "industrial",
    "scarred",
    "pristine",
    "aftermath",
  ])
    for (let stage = 1; stage <= 7; stage++)
      sources.push(backdropArt(biome, stage));
  for (const kind of kinds)
    for (let variant = 0; variant < 3; variant++) {
      sources.push(structuralArt(kind, variant) || "");
      for (let frame = 0; frame < 4; frame++)
        sources.push(artSvg(kind, { variant, frame }));
    }
  for (const kind of kinds)
    for (const mood of ["calm", "alert", "injured", "vacant"] as const)
      for (let frame = 0; frame < 4; frame++)
        for (const reducedGraphics of [false, true]) {
          sources.push(
            artSvg(kind, { frame, mood, damage: 0.9, reducedGraphics }),
          );
        }
  for (const svg of sources)
    for (const match of svg.matchAll(/ d="([^"]+)"/g)) {
      assert.doesNotThrow(() => new GraphicsPath(match[1]), match[1]);
    }
});

test("six animal species have deterministic, distinct authored gait poses", () => {
  const silhouettes = new Set<string>();
  for (const kind of ANIMALS) {
    const frames = Array.from({ length: 4 }, (_, frame) =>
      animalPaths(kind as AnimalKind, { frame }),
    );
    assert.equal(new Set(frames).size, 4, kind);
    assert.equal(frames[0], animalPaths(kind as AnimalKind, { frame: 4 }));
    assert.ok(
      frames.every(
        (frame) =>
          !frame.includes("NaN") &&
          !frame.includes("undefined") &&
          !frame.includes("transform="),
      ),
    );
    silhouettes.add(frames[0]);
  }
  assert.equal(silhouettes.size, 6);
});

test("reduced graphic injury states retain a changed silhouette without red injury marks", () => {
  for (const kind of ANIMALS) {
    const calm = animalPaths(kind as AnimalKind);
    const injured = animalPaths(kind as AnimalKind, { mood: "injured" });
    const reduced = animalPaths(kind as AnimalKind, {
      mood: "injured",
      reducedGraphics: true,
    });
    assert.ok(injured.includes("#9a4e42"));
    assert.ok(!reduced.includes("#9a4e42"));
    assert.notEqual(calm, reduced);
  }
  assert.ok(figurePaths("person", { mood: "injured" }).includes("#9a4e42"));
  assert.ok(
    !figurePaths("person", { mood: "injured", reducedGraphics: true }).includes(
      "#9a4e42",
    ),
  );
});

test("wear creeps in by stage and graphic injury cannot appear before stage six", () => {
  let previous = 0;
  for (let stage = 1; stage <= 7; stage++) {
    const appearance = visualIntensity(stage, 0.9, 0.2, "field");
    assert.ok(appearance.wear >= previous);
    if (stage < 6) assert.equal(appearance.injury, false);
    if (stage <= 2) assert.equal(appearance.wear, 0);
    previous = appearance.wear;
  }
  assert.equal(visualIntensity(7, 0, 0.9, "pristine").injury, false);
  assert.equal(visualIntensity(7, 0, 0.9, "pristine").mood, "vacant");
});
