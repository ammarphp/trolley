import { Application, Container, Graphics } from "pixi.js";
import {
  clamp,
  junctionPose,
  railPose,
  localPoint,
  offsetPoint,
  project,
  cabinEye,
  RouteGeometry,
  railTravelPlan,
  railTravelAt,
  LOOP_CONTACT_DISTANCE,
  LOOP_BRAKE_DISTANCE,
  LOOP_MAIN_DISTANCE,
  type RailTravelPlan,
  wrap,
  type Pose,
  type Side,
} from "./geometry";
import {
  cabinSvg,
  cabinLayers,
  InkGlyph,
  INK,
  PAPER,
  RED,
  GREEN,
  type ArtKind,
} from "./ink-art";
import { ANIMATED } from "./glyph-catalogue";
import { backdropArt, rearViewArt } from "./environment-art";
import { svg } from "./technical-art";
import { visualIntensity } from "./visual-state";
import { createRailAudio } from "./rail-audio";
import type { CabinScene, Executor, SceneSettings, SceneView } from "./types";
export type { CabinScene, SceneSettings, SceneView } from "./types";

const INITIAL: SceneView = {
  stage: 1,
  biome: "field",
  speed: 0,
  strain: 0,
  damage: 0,
  authority: "human",
  figures: { left: 1, right: 1 },
  routeLabels: { left: "Left route", right: "Right route" },
};
const biomeObjects: Record<SceneView["biome"], ArtKind[]> = {
  field: [
    "tree",
    "cow",
    "deer",
    "rabbit",
    "flower",
    "house",
    "pig",
    "dog",
    "sheep",
  ],
  town: ["house", "tree", "clinic", "house", "person", "dog", "tree", "pylon"],
  lab: [
    "clinic",
    "tree",
    "house",
    "server",
    "pylon",
    "tree",
    "person",
    "flower",
  ],
  industrial: [
    "server",
    "pylon",
    "server",
    "house",
    "drone",
    "server",
    "bare-tree",
    "pylon",
  ],
  scarred: [
    "bare-tree",
    "ruin",
    "server",
    "bare-tree",
    "ruin",
    "drone",
    "pylon",
    "ruin",
  ],
  pristine: [
    "column",
    "tree",
    "column",
    "column",
    "robot",
    "column",
    "tree",
    "column",
  ],
  aftermath: [
    "ruin",
    "bare-tree",
    "house",
    "ruin",
    "person",
    "bare-tree",
    "pylon",
    "ruin",
  ],
};

function description(
  view: SceneView,
  settings: SceneSettings,
  stoppedBy?: string | null,
) {
  const worlds = {
    field: "Open fields, animals and a few small houses.",
    town: "Homes and a working clinic beside the tracks.",
    lab: "A clinic and new machine infrastructure share the landscape.",
    industrial:
      "Server buildings, power lines and hovering machines line the route.",
    scarred: "Damaged homes and bare trees remain beside the machinery.",
    pristine:
      "Immaculate repeated structures stand in a strangely uniform landscape.",
    aftermath:
      "Scattered human structures remain among damaged infrastructure.",
  };
  const punctuate = (text: string) => text.trim().replace(/[.!?]+$/, "") + ".";
  return [
    `From behind a uniformed controller wearing a conductor's cap inside a fixed trolley cabin.`,
    worlds[view.biome],
    stoppedBy
      ? `The trolley is stopped at ${stoppedBy === "independent-brake" ? "the independent brake" : "the occupied obstruction"}. The five beyond the join remain ahead.`
      : settings.reducedMotion
        ? "Travel is represented without continuous camera motion. Animal and human poses are held still."
        : "Sleepers and landscape pass continuously beneath the windshield. Animals walk or hop in small stepped poses.",
    view.loopSide
      ? "A siding curves away and returns to the main track ahead. The small mirror reflects the railway behind."
      : "Two branches share one clear railway junction ahead. The small mirror reflects the receding railway behind the trolley.",
    view.mechanismDescription || "",
    view.damage > 0.2
      ? settings.reducedGraphics
        ? "Window cracks, torn cloth and damaged structures accumulate."
        : "Window cracks and damaged structures accumulate, with dark red injury marks only at high damage."
      : "",
    view.authority === "overridden"
      ? "An automatic actuator is attached to the lever."
      : "",
    punctuate(`Left: ${view.routeLabels.left}`),
    punctuate(`Right: ${view.routeLabels.right}`),
    view.detail || "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function createFallbackScene(
  host: HTMLElement,
  initialSettings: SceneSettings,
): CabinScene {
  let view = { ...INITIAL },
    settings = { ...initialSettings },
    side: Side = "right",
    stoppedBy: string | null = null,
    destroyed = false;
  const frame = document.createElement("div");
  frame.className = "cabin-static-fallback";
  frame.style.cssText =
    "position:absolute;inset:0;overflow:hidden;background:#faf9f3;pointer-events:none";
  frame.innerHTML =
    '<svg viewBox="0 0 1440 900" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true"><rect width="1440" height="900" fill="#faf9f3"/><g fill="none" stroke="#272924" stroke-width="2"><path d="M300 740Q560 460 640 230M390 740Q610 460 665 230M1050 740Q830 460 760 230M1140 740Q880 460 785 230"/><path d="M0 280Q170 251 340 283T720 280T1100 280T1440 277"/></g>' +
    cabinSvg().replace(/<\/?svg[^>]*>/g, "") +
    "</svg>";
  host.append(frame);
  host.dataset.rendererFallback = "true";
  const refresh = () => {
    frame.setAttribute(
      "data-description",
      description(view, settings, stoppedBy),
    );
    frame.setAttribute("data-lever", side);
  };
  refresh();
  return {
    update(next) {
      if (!destroyed) {
        view = next;
        stoppedBy = null;
        refresh();
      }
    },
    commit(next, _actor, outcome) {
      side = next;
      stoppedBy = outcome?.stoppedBy ?? null;
      refresh();
      return Promise.resolve();
    },
    setLever(next) {
      side = next;
      refresh();
    },
    pause() {},
    settings(patch) {
      settings = { ...settings, ...patch };
      refresh();
    },
    describe: () => description(view, settings, stoppedBy),
    destroy() {
      destroyed = true;
      frame.remove();
      delete host.dataset.rendererFallback;
    },
  };
}

/** Bounded illustration spike: the engine owns every consequence and choice. */
export async function createCabinScene(
  host: HTMLElement,
  initialSettings: SceneSettings,
): Promise<CabinScene> {
  let settings = { ...initialSettings };
  const app = new Application();
  try {
    await app.init({
      preference: "webgl",
      backgroundColor: PAPER,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
      antialias: true,
      autoDensity: true,
      autoStart: false,
    });
  } catch {
    try {
      app.destroy(true);
    } catch {
      /* Failed initialization may be incomplete. */
    }
    return createFallbackScene(host, settings);
  }
  const failedSetupCleanups: (() => void)[] = [];
  try {
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);

    const world = new Container(),
      objects = new Container(),
      cabin = new Container();
    app.stage.addChild(world, objects, cabin);
    world.eventMode = objects.eventMode = cabin.eventMode = "none";
    const sky = new Graphics(),
      hills = new Graphics(),
      ballast = new Graphics(),
      rails = new Graphics(),
      verges = new Graphics();
    world.addChild(sky, hills, ballast, rails, verges);
    const cabinSources = cabinLayers();
    const cabinFrame = new Graphics().svg(cabinSources.frame),
      controller = new Graphics().svg(cabinSources.controller),
      mirror = new Graphics().svg(cabinSources.mirror);
    const mirrorReflection = new Graphics(),
      damage = new Graphics(),
      actuator = new Graphics(),
      lever = new Graphics();
    cabin.addChild(
      cabinFrame,
      controller,
      mirror,
      mirrorReflection,
      actuator,
      damage,
      lever,
    );
    const placements: {
      graphic: InkGlyph;
      index: number;
      offset: number;
      distance: number;
      kind: ArtKind;
    }[] = [];
    const targets: Record<Side, InkGlyph[]> = { left: [], right: [] };

    const route = new RouteGeometry();
    const audio = createRailAudio();
    failedSetupCleanups.push(() => audio.destroy());
    let view: SceneView = { ...INITIAL },
      oldBiome = "",
      oldFigures = "",
      width = host.clientWidth,
      height = host.clientHeight;
    let paused = false,
      destroyed = false,
      frame = 0,
      lastTime = performance.now(),
      time = 0,
      cosmeticTravel = 0;
    let latched: Side = "right",
      visualLever = 1,
      executor: Executor = "human";
    let transition: {
      side: Side;
      elapsed: number;
      plan: RailTravelPlan;
      resolve: () => void;
      promise: Promise<void>;
    } | null = null;
    let held: { side: Side; distance: number; stoppedBy: string } | null = null;
    let lastFaceKey = "",
      lastSkyKey = "",
      lastLeverKey = "",
      targetReveal = 1,
      anatomyAspect = 1,
      contextFallback: CabinScene | null = null;
    failedSetupCleanups.push(() => cancelAnimationFrame(frame));

    const appearance = () =>
      visualIntensity(view.stage, view.damage, view.strain, view.biome);
    const glyphMood = () => appearance().mood;

    function createLandscape() {
      const key = `${view.biome}:${view.landmark || "none"}:${Math.floor(view.damage * 4)}:${view.stage}:${settings.reducedGraphics}`;
      if (key === oldBiome) return;
      oldBiome = key;
      for (const item of placements) {
        objects.removeChild(item.graphic);
        item.graphic.destroy({ children: true });
      }
      placements.length = 0;
      const landmarkKinds: Partial<
        Record<NonNullable<SceneView["landmark"]>, ArtKind>
      > = {
        cows: "cow",
        parade: "person",
        clinic: "clinic",
        lab: "server",
        "data-center": "server",
        drones: "drone",
        checkpoint: "robot",
        ruins: "ruin",
        garden: "flower",
      };
      const kinds = [...biomeObjects[view.biome]];
      const landmark = view.landmark && landmarkKinds[view.landmark];
      if (landmark && landmark !== "cow") {
        kinds[0] = landmark;
        kinds[3] = landmark;
      }
      for (let i = 0; i < 20; i++) {
        const kind = kinds[i % kinds.length];
        const graphic = new InkGlyph(kind, i);
        graphic.setState(
          glyphMood(),
          view.biome === "pristine" ? 0 : appearance().wear,
          settings.reducedGraphics,
        );
        objects.addChild(graphic);
        placements.push({
          graphic,
          index: i,
          offset: (i % 2 ? -1 : 1) * (3.3 + ((i * 7) % 13) * 0.42),
          distance: 7 + i * 4.1,
          kind,
        });
      }
    }

    function createTargets() {
      const key = JSON.stringify([
        view.figureKind || {},
        glyphMood(),
        Math.floor(view.damage * 4),
        settings.reducedGraphics,
      ]);
      if (key === oldFigures) return;
      oldFigures = key;
      for (const side of ["left", "right"] as Side[]) {
        for (const graphic of targets[side]) {
          objects.removeChild(graphic);
          graphic.destroy({ children: true });
        }
        targets[side].length = 0;
        const kind = view.figureKind?.[side] || "person";
        if (kind === "none") continue;
        for (let i = 0; i < 5; i++) {
          const graphic = new InkGlyph(kind, i);
          graphic.setState(
            glyphMood(),
            appearance().wear,
            settings.reducedGraphics,
          );
          objects.addChild(graphic);
          targets[side].push(graphic);
        }
      }
    }

    function drawSky(camera: Pose) {
      const skyKey = `${width}:${height}:${view.biome}:${view.stage}`;
      if (skyKey !== lastSkyKey) {
        lastSkyKey = skyKey;
        sky.clear().rect(0, 0, width, height).fill(PAPER);
        hills.clear().svg(svg(backdropArt(view.biome, view.stage)));
        hills.scale.set(width / 1440, height / 900);
      }
      // Only a distant parallax offset; cabin and semantic controls never shake.
      hills.x = Math.sin(camera.heading) * width * 0.007;
    }

    function worldPose(distance: number, nextSide: Side): Pose {
      if (!transition && !held)
        return railPose(route.pose, nextSide, distance, view.loopSide);
      if (distance < 26)
        return railPose(
          route.pose,
          transition?.side ?? held!.side,
          distance,
          route.segment?.loopSide,
        );
      const after = railPose(
        route.pose,
        transition?.side ?? held!.side,
        26,
        route.segment?.loopSide,
      );
      return junctionPose(after, nextSide, distance - 26);
    }

    function drawTracks(camera: Pose, distance: number) {
      rails.clear();
      ballast.clear();
      verges.clear();
      // Draw the shared approach exactly once. Branches begin at the same turnout,
      // and the next fork remains ahead while passing through a committed turn.
      const split = transition || held ? 34 : 8;
      const far = distance + 87;
      const sections: { branch: Side; from: number; to: number }[] = [
        { branch: "left", from: distance + 0.65, to: Math.min(split, far) },
        { branch: "left", from: Math.max(split, distance + 0.65), to: far },
        { branch: "right", from: Math.max(split, distance + 0.65), to: far },
      ];
      if (view.loopSide && !transition && !held) {
        sections[1] = {
          branch: view.loopSide === "left" ? "right" : "left",
          from: Math.max(split, distance + 0.65),
          to: far,
        };
        sections[2] = {
          branch: view.loopSide,
          from: Math.max(split, distance + 0.65),
          to: Math.min(26, far),
        };
      }
      const railWidth = Math.max(2.4, Math.min(3.2, width / 235));
      for (const section of sections) {
        if (section.to <= section.from) continue;
        const bedPoints: number[] = [];
        for (let z = section.from; z <= section.to; z += 1.2) {
          const pt = project(
            localPoint(
              offsetPoint(worldPose(z, section.branch), -0.91),
              camera,
            ),
            width,
            height,
          );
          bedPoints.push(pt.x, pt.y);
        }
        for (let z = section.to; z >= section.from; z -= 1.2) {
          const pt = project(
            localPoint(offsetPoint(worldPose(z, section.branch), 0.91), camera),
            width,
            height,
          );
          bedPoints.push(pt.x, pt.y);
        }
        ballast
          .poly(bedPoints)
          .fill(view.stage >= 5 ? 0xbac1b4 : 0xd2d6c7)
          .stroke({ color: 0x959f8e, width: 0.7, alpha: 0.6 });
        for (let i = 0; i < 40; i++) {
          const z = distance + 1.5 + wrap(i * 2.13 + cosmeticTravel, 84);
          if (z < section.from || z >= section.to || z - distance > 43)
            continue;
          const offset = Math.sin(i * 13.3) * 0.87;
          const q = project(
            localPoint(
              offsetPoint(worldPose(z, section.branch), offset),
              camera,
            ),
            width,
            height,
          );
          const r = Math.min(3.5, q.scale * 13);
          ballast
            .moveTo(q.x - r, q.y)
            .lineTo(q.x, q.y - r * 0.6)
            .lineTo(q.x + r, q.y + 0.2)
            .stroke({ color: 0x77826f, width: 0.9, alpha: 0.5 });
        }
        // Perpendicular sleepers stay inside their branch; the few shared sleepers
        // at the toe are drawn once rather than colliding across the fork.
        for (let i = 0; i < 77; i++) {
          const z = distance + 0.8 + wrap(i * 1.14 + cosmeticTravel, 87.78);
          if (
            z < section.from ||
            z >= section.to ||
            (section.branch === "right" && z < split + 4)
          )
            continue;
          const path = worldPose(z, section.branch);
          const a = project(
            localPoint(offsetPoint(path, -0.72), camera),
            width,
            height,
          );
          const b = project(
            localPoint(offsetPoint(path, 0.72), camera),
            width,
            height,
          );
          const nextPoint = project(
            localPoint(worldPose(z + 1.14, section.branch), camera),
            width,
            height,
          );
          if (
            a.y > height * 0.82 ||
            Math.hypot(
              nextPoint.x - (a.x + b.x) / 2,
              nextPoint.y - (a.y + b.y) / 2,
            ) < 3.3
          )
            continue;
          const aa = project(
            localPoint(
              offsetPoint(worldPose(z + 0.14, section.branch), -0.72),
              camera,
            ),
            width,
            height,
          );
          const bb = project(
            localPoint(
              offsetPoint(worldPose(z + 0.14, section.branch), 0.72),
              camera,
            ),
            width,
            height,
          );
          rails
            .poly([a.x, a.y, b.x, b.y, bb.x, bb.y, aa.x, aa.y])
            .fill(view.stage >= 5 ? 0x5b665b : 0x737767)
            .stroke({ color: INK, width: 1.15, alpha: 0.85 });
          rails
            .moveTo(aa.x, aa.y)
            .lineTo(bb.x, bb.y)
            .stroke({ color: 0xe4e6d9, width: 0.8, alpha: 0.85 });
        }
        const samples: Pose[] = [];
        for (let z = section.from; z <= section.to; z += 0.65)
          samples.push(worldPose(z, section.branch));
        samples.push(worldPose(section.to, section.branch));
        for (const offset of [-0.47, 0.47])
          for (const surface of [0, 1]) {
            let begun = false;
            const ink = surface ? 0xe1e5d8 : INK,
              stroke = surface ? 1.05 : railWidth + 1.1;
            for (const path of samples) {
              const local = localPoint(offsetPoint(path, offset), camera);
              if (local.z <= 0.4) continue;
              const point = project(local, width, height);
              if (!begun) {
                rails.moveTo(point.x, point.y);
                begun = true;
              } else rails.lineTo(point.x, point.y);
              if (local.z > 24) {
                rails.stroke({
                  color: ink,
                  width: stroke,
                  alpha: clamp((55 - local.z) / 30) * 0.88,
                });
                rails.moveTo(point.x, point.y);
              }
            }
            rails.stroke({ color: ink, width: stroke, alpha: 0.96 });
          }
      }
      const frogPose = worldPose(split + 7.8, "left");
      const frog = project(
        localPoint(offsetPoint(frogPose, 0.47), camera),
        width,
        height,
      );
      const fs = Math.min(1.2, frog.scale * 11);
      if (frog.y < height * 0.77) {
        verges
          .moveTo(frog.x, frog.y - 6 * fs)
          .lineTo(frog.x + 4 * fs, frog.y)
          .lineTo(frog.x, frog.y + 7 * fs)
          .lineTo(frog.x - 4 * fs, frog.y)
          .closePath()
          .fill(PAPER)
          .stroke({ color: INK, width: 2 });
        for (const branch of ["left", "right"] as Side[]) {
          const sign = branch === "left" ? -1 : 1;
          const a = project(
            localPoint(
              offsetPoint(worldPose(split + 6.3, branch), sign * 0.66),
              camera,
            ),
            width,
            height,
          );
          const b = project(
            localPoint(
              offsetPoint(worldPose(split + 9.5, branch), sign * 0.66),
              camera,
            ),
            width,
            height,
          );
          verges
            .moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ color: INK, width: 2 });
        }
      }
      // A compact point-machine beside the toe makes the junction read as built
      // railway infrastructure instead of four unrelated lines.
      const toe = project(
        localPoint(worldPose(split + 1, "left"), camera),
        width,
        height,
      );
      const toeScale = Math.min(1.2, toe.scale * 8);
      if (toe.y < height * 0.78) {
        verges
          .rect(
            toe.x + 18 * toeScale,
            toe.y - 4 * toeScale,
            19 * toeScale,
            8 * toeScale,
          )
          .fill(PAPER)
          .stroke({ color: INK, width: 2.4 });
        verges
          .moveTo(toe.x + 18 * toeScale, toe.y)
          .lineTo(toe.x, toe.y)
          .stroke({ color: INK, width: 2.4 });
      }
      if (view.loopSide && view.brakeOnLoop) {
        const brake = railPose(
          route.pose,
          view.loopSide,
          LOOP_BRAKE_DISTANCE,
          view.loopSide,
        );
        const center = localPoint(brake, camera);
        if (center.z > 0.6) {
          const points = [-0.72, 0.72].map((offset) =>
            project(
              localPoint(offsetPoint(brake, offset), camera),
              width,
              height,
            ),
          );
          const [a, b] = points;
          const size = Math.max(
            3,
            Math.min(16, project(center, width, height).scale * 55),
          );
          verges
            .moveTo(a.x, a.y)
            .lineTo(a.x, a.y - size)
            .lineTo(b.x, b.y - size)
            .lineTo(b.x, b.y)
            .stroke({ color: INK, width: 3 });
          verges
            .moveTo(a.x, a.y - size)
            .lineTo(b.x, b.y - size)
            .stroke({ color: RED, width: 5 });
          for (const point of points)
            verges
              .circle(point.x, point.y, size * 0.25)
              .fill(PAPER)
              .stroke({ color: INK, width: 2 });
        }
      }
      for (let i = 0; i < 46; i++) {
        const z = distance + 2 + wrap(i * 1.59 + cosmeticTravel, 73.14),
          sign = i % 2 ? -1 : 1;
        const path = worldPose(z, sign < 0 ? "left" : "right");
        const p = project(
          localPoint(offsetPoint(path, sign * (1.5 + (i % 3) * 0.6)), camera),
          width,
          height,
        );
        const size = Math.min(10, p.scale * 45);
        verges
          .moveTo(p.x - size, p.y)
          .lineTo(p.x, p.y - size * 0.65)
          .lineTo(p.x + size * 0.7, p.y + 1)
          .stroke({
            color: INK,
            width: 1.5,
            alpha: view.biome === "pristine" ? 0.16 : 0.34,
          });
      }
    }

    function drawObjects(camera: Pose, distance: number) {
      const scaleBase = Math.min(width, height * 1.65) / 95;
      for (const item of placements) {
        const z =
          distance + 5 + wrap(item.distance + cosmeticTravel * 0.45, 76);
        const side = item.offset < 0 ? "left" : "right";
        const path = worldPose(z, side);
        const point = project(
          localPoint(offsetPoint(path, item.offset), camera),
          width,
          height,
        );
        item.graphic.position.set(point.x, point.y);
        item.graphic.showFrame(
          settings.reducedMotion
            ? 0
            : Math.floor(
                time * (item.kind === "rabbit" ? 3 : 2.2) + item.index,
              ),
        );
        const objectScale = Math.min(2, point.scale * scaleBase);
        item.graphic.scale.set(objectScale);
        item.graphic.alpha =
          clamp((z - distance - 5) / 3) * clamp((49 - (z - distance)) / 12);
        const detailedEnough = ANIMATED.has(item.kind)
          ? objectScale > 0.23
          : objectScale > 0.12;
        item.graphic.zIndex = Math.round(point.y);
        if (item.kind === "drone")
          item.graphic.y -=
            height * 0.11 +
            (settings.reducedMotion
              ? 0
              : Math.sin(time * 0.7 + item.index) * 3);
        item.graphic.visible =
          detailedEnough &&
          z - distance < 49 &&
          point.x > -180 &&
          point.x < width + 180 &&
          point.y < height * 0.78;
      }
      for (const branch of ["left", "right"] as Side[]) {
        const targetDistance = view.loopSide
          ? branch === view.loopSide
            ? LOOP_CONTACT_DISTANCE
            : LOOP_MAIN_DISTANCE
          : 25;
        const path = railPose(
          route.pose,
          branch,
          targetDistance,
          view.loopSide,
        );
        const center = localPoint(path, camera);
        for (let i = 0; i < targets[branch].length; i++) {
          const graphic = targets[branch][i];
          const count = Math.min(5, Math.max(0, view.figures[branch]));
          graphic.visible =
            i < count &&
            center.z > 1 &&
            (!transition ||
              Boolean(transition.plan.stoppedBy) ||
              transition.elapsed / transition.plan.travelDuration < 0.88);
          if (!graphic.visible) continue;
          const p = project(center, width, height);
          const s = Math.max(0.62, Math.min(1.5, p.scale * scaleBase * 2.1));
          graphic.showFrame(
            settings.reducedMotion ? 0 : Math.floor(time * 1.3 + i),
          );
          graphic.position.set(
            p.x + (i - (count - 1) / 2) * s * 29,
            p.y + (i % 2) * 5 * s,
          );
          graphic.scale.set(s);
          graphic.alpha =
            (transition && branch === transition.side
              ? clamp((center.z - 2) / 4)
              : 1) * targetReveal;
          graphic.zIndex = Math.round(p.y + 10);
        }
      }
      objects.sortableChildren = true;
    }

    function drawReflectionAndDamage() {
      const key = [
        Math.round(view.strain * 10),
        Math.round(view.damage * 10),
        view.authority,
        view.biome,
        view.stage,
        settings.reducedGraphics,
      ].join(":");
      if (key === lastFaceKey) return;
      lastFaceKey = key;
      // This high mirror sees the rear window and the railway behind the trolley.
      // It never shows a frontal face from an impossible camera angle.
      mirrorReflection.clear().svg(svg(rearViewArt(view.stage, view.damage)));
      damage.clear();
      const wear = appearance().wear;
      const cracks = Math.floor(wear * 7);
      for (let i = 0; i < cracks; i++) {
        const x = i % 2 ? 1230 - i * 29 : 173 + i * 31,
          y = 570 - i * 48;
        damage
          .moveTo(x, y)
          .lineTo(x + 15, y - 32)
          .lineTo(x + 5, y - 50)
          .lineTo(x + 31, y - 87)
          .moveTo(x + 15, y - 32)
          .lineTo(x + 45, y - 24)
          .lineTo(x + 61, y - 46)
          .stroke({ color: INK, width: 2.1 + i * 0.1, alpha: 0.65 });
      }
      if (wear > 0.32) {
        if (settings.reducedGraphics || !appearance().injury) {
          damage
            .moveTo(788, 840)
            .lineTo(808, 859)
            .moveTo(793, 836)
            .lineTo(813, 855)
            .moveTo(798, 833)
            .lineTo(818, 852)
            .stroke({ color: INK, width: 3, alpha: 0.7 });
        } else {
          for (let i = 0; i < Math.floor(wear * 9); i++) {
            const x = 1180 + Math.sin(i * 8) * 58,
              y = 492 + Math.cos(i * 4) * 91;
            damage
              .ellipse(x, y, 1.5 + i * 0.35, 3 + i * 0.8)
              .fill({ color: RED, alpha: 0.66 });
            damage
              .moveTo(x, y)
              .quadraticCurveTo(x + 3, y + 13, x + 1, y + 20 + i * 3)
              .stroke({ color: RED, width: 1.6, alpha: 0.65 });
          }
          damage
            .moveTo(800, 841)
            .quadraticCurveTo(814, 852, 827, 839)
            .stroke({ color: RED, width: 4, alpha: 0.75 });
        }
      }
      actuator.clear();
      if (view.authority !== "human") {
        actuator
          .moveTo(1260, 860)
          .lineTo(1195, 817)
          .lineTo(1101, 823)
          .lineTo(1040, 852)
          .stroke({
            color: INK,
            width: view.authority === "overridden" ? 8 : 5,
          });
        for (const [x, y] of [
          [1195, 817],
          [1101, 823],
          [1040, 852],
        ])
          actuator.circle(x, y, 9).fill(PAPER).stroke({ color: INK, width: 2 });
      }
    }

    function drawLever(dt: number) {
      const target = latched === "left" ? -1 : 1;
      visualLever +=
        (target - visualLever) *
        (settings.reducedMotion ? 1 : Math.min(1, dt * 12));
      const key = `${Math.round(visualLever * 1000)}:${executor}`;
      if (key === lastLeverKey) return;
      lastLeverKey = key;
      lever.clear();
      lever
        .poly([963, 821, 1075, 806, 1110, 860, 978, 879])
        .fill(0x7b8479)
        .stroke({ color: INK, width: 3.6 });
      lever
        .poly([970, 814, 1075, 800, 1100, 843, 977, 859])
        .fill(0xd4d9cd)
        .stroke({ color: INK, width: 3.4 });
      lever
        .roundRect(996, 811, 68, 12, 5)
        .fill(0x343c37)
        .stroke({ color: INK, width: 2.4 });
      const topX = 1035 + visualLever * 49,
        topY = 713;
      lever
        .poly([1026, 822, topX - 7, topY + 15, topX + 7, topY + 15, 1044, 819])
        .fill(0x555e55)
        .stroke({ color: INK, width: 3.4 });
      lever
        .moveTo(1031, 817)
        .lineTo(topX - 2, topY + 17)
        .stroke({ color: 0xe7e9df, width: 2.3 });
      lever
        .roundRect(topX - 34, topY - 8, 68, 29, 7)
        .fill(0x974d40)
        .stroke({ color: INK, width: 3.6 });
      lever
        .moveTo(topX - 25, topY - 3)
        .lineTo(topX + 22, topY - 3)
        .stroke({ color: 0xda9985, width: 2.2 });
      lever
        .moveTo(topX - 27, topY + 17)
        .lineTo(topX + 28, topY + 17)
        .stroke({ color: 0x592f29, width: 2.5 });
      lever
        .ellipse(topX - 31, topY + 6, 4, 11)
        .fill(0x613d33)
        .stroke({ color: INK, width: 1.5 });
      for (const [x, y] of [
        [979, 819],
        [1071, 807],
        [986, 848],
        [1088, 838],
      ]) {
        lever.circle(x, y, 4).fill(0xb7c0b0).stroke({ color: INK, width: 1.5 });
        lever
          .moveTo(x - 2, y + 2)
          .lineTo(x + 2, y - 2)
          .stroke({ color: INK, width: 1 });
      }
    }

    function draw(dt = 0) {
      if (destroyed || contextFallback) return;
      const distance = transition
        ? railTravelAt(
            transition.plan,
            transition.elapsed,
            settings.reducedMotion,
          ).distance
        : (held?.distance ?? 0);
      const physicalPose =
        transition || held
          ? railPose(
              route.pose,
              transition?.side ?? held!.side,
              distance,
              route.segment?.loopSide,
            )
          : route.pose;
      const camera = cabinEye(physicalPose);
      drawSky(camera);
      drawTracks(camera, distance);
      drawObjects(camera, distance);
      drawReflectionAndDamage();
      drawLever(dt);
      cabin.scale.set(width / 1440, height / 900);
      // No camera shake: fixed surfaces provide a stable reference even late in a run.
      app.renderer.render(app.stage);
    }

    function tick(now: number) {
      if (destroyed || contextFallback) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (!paused && !document.hidden) {
        if (!settings.reducedMotion) {
          time += dt;
          const stopped =
            held ||
            (transition &&
              railTravelAt(transition.plan, transition.elapsed, false).holding);
          const slowing = transition?.plan.stoppedBy
            ? (1 -
                clamp(transition.elapsed / transition.plan.travelDuration)) **
              2
            : 1;
          if (!stopped)
            cosmeticTravel -= dt * (1.4 + clamp(view.speed) * 2) * slowing;
        }
        targetReveal = Math.min(1, targetReveal + dt * 2);
        if (transition) {
          transition.elapsed += dt;
          const travel = railTravelAt(
            transition.plan,
            transition.elapsed,
            settings.reducedMotion,
          );
          if (travel.holding) audio.set({ paused: true });
          if (travel.complete) {
            const resolved = transition;
            if (resolved.plan.stoppedBy)
              held = {
                side: resolved.side,
                distance: resolved.plan.endDistance,
                stoppedBy: resolved.plan.stoppedBy,
              };
            else route.finish(resolved.plan.endDistance);
            transition = null;
            draw(dt);
            resolved.resolve();
          } else draw(dt);
        } else if (
          !settings.reducedMotion ||
          Math.abs(visualLever - (latched === "left" ? -1 : 1)) > 0.001
        )
          draw(dt);
      }
      if (
        !paused &&
        !document.hidden &&
        (!settings.reducedMotion || transition)
      )
        frame = requestAnimationFrame(tick);
      else frame = 0;
    }
    function schedule() {
      if (!frame && !destroyed && !contextFallback) {
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    function resize() {
      if (destroyed || contextFallback) return;
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      anatomyAspect = clamp(height / 900 / (width / 1440), 0.8, 3.6);
      const mirrorSquash = Math.min(1, 1 / anatomyAspect);
      controller.scale.x = anatomyAspect;
      controller.x = 642 * (1 - anatomyAspect);
      mirror.scale.y = mirrorSquash;
      mirror.y = 160 * (1 - mirrorSquash);
      mirrorReflection.scale.y = mirrorSquash;
      mirrorReflection.y = 160 * (1 - mirrorSquash);
      app.renderer.resize(width, height);
      draw();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    failedSetupCleanups.push(() => observer.disconnect());
    const visibility = () => {
      audio.set({ paused: paused || document.hidden || Boolean(held) });
      if (!document.hidden) schedule();
    };
    document.addEventListener("visibilitychange", visibility);
    failedSetupCleanups.push(() =>
      document.removeEventListener("visibilitychange", visibility),
    );
    const lost = (event: Event) => {
      event.preventDefault();
      if (destroyed || contextFallback) return;
      contextFallback = createFallbackScene(host, settings);
      contextFallback.update(view);
      contextFallback.setLever(latched);
      if (held)
        void contextFallback.commit(latched, executor, {
          stoppedBy: held.stoppedBy,
        });
      canvas.style.display = "none";
      cancelAnimationFrame(frame);
      frame = 0;
      if (transition) {
        route.finish(
          railTravelAt(
            transition.plan,
            transition.elapsed,
            settings.reducedMotion,
          ).distance,
        );
        transition.resolve();
        transition = null;
      }
    };
    canvas.addEventListener("webglcontextlost", lost);
    failedSetupCleanups.push(() =>
      canvas.removeEventListener("webglcontextlost", lost),
    );
    createLandscape();
    createTargets();
    draw();
    schedule();
    audio.set({ enabled: settings.audio, speed: view.speed });

    return {
      update(next) {
        if (held) {
          route.finish(held.distance);
          held = null;
        }
        view = {
          ...next,
          speed: clamp(next.speed),
          strain: clamp(next.strain),
          damage: clamp(next.damage),
          figures: { ...next.figures },
          routeLabels: { ...next.routeLabels },
        };
        route.loopSide = view.loopSide;
        targetReveal = settings.reducedMotion ? 1 : 0;
        if (contextFallback) {
          contextFallback.update(view);
          return;
        }
        createLandscape();
        createTargets();
        audio.set({ speed: view.speed, paused: paused || document.hidden });
        draw();
        schedule();
      },
      commit(side, actor, outcome) {
        if (destroyed) return Promise.resolve();
        if (contextFallback)
          return contextFallback.commit(side, actor, outcome);
        if (transition) return transition.promise;
        if (held) return Promise.resolve();
        latched = side;
        executor = actor;
        route.begin(side);
        let resolve!: () => void;
        const promise = new Promise<void>((done) => {
          resolve = done;
        });
        transition = {
          side,
          elapsed: 0,
          plan: railTravelPlan(
            view.loopSide,
            outcome?.stoppedBy ?? null,
            settings.reducedMotion,
          ),
          resolve,
          promise,
        };
        schedule();
        return promise;
      },
      setLever(side) {
        latched = side;
        contextFallback?.setLever(side);
        draw();
        schedule();
      },
      pause(value) {
        paused = value;
        contextFallback?.pause(value);
        audio.set({
          paused:
            value ||
            document.hidden ||
            Boolean(held) ||
            Boolean(
              transition &&
              railTravelAt(
                transition.plan,
                transition.elapsed,
                settings.reducedMotion,
              ).holding,
            ),
        });
        if (!value) schedule();
      },
      settings(patch) {
        settings = { ...settings, ...patch };
        contextFallback?.settings(patch);
        lastFaceKey = "";
        createLandscape();
        createTargets();
        if (settings.reducedMotion && transition) {
          transition.plan.staticTravel = true;
          transition.plan.travelDuration = Math.min(
            transition.plan.travelDuration,
            transition.elapsed + 0.08,
          );
          transition.plan.holdDuration = Math.min(
            transition.plan.holdDuration,
            0.08,
          );
        }
        audio.set({ enabled: settings.audio });
        draw();
        schedule();
      },
      describe: () => description(view, settings, held?.stoppedBy),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        canvas.removeEventListener("webglcontextlost", lost);
        audio.destroy();
        contextFallback?.destroy();
        transition?.resolve();
        transition = null;
        app.destroy(true, { children: true, context: true });
      },
    };
  } catch (error) {
    // An art parser/GPU failure must not destroy the participant's run. Keep
    // this diagnostic visible to developer tooling rather than claiming a pass.
    console.warn("Trolley illustration failed; using the static scene.", error);
    for (const cleanup of failedSetupCleanups) cleanup();
    try {
      app.destroy(true, { children: true, context: true });
    } catch {
      /* best effort cleanup */
    }
    const scene = createFallbackScene(host, settings);
    host.dataset.rendererFallback = "true";
    return scene;
  }
}
