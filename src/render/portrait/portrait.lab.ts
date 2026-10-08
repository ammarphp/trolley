/**
 * Portrait lab scenes.
 *   portrait-stages   stages 0..6 and an aged, cracked variant, as seen in the mirror
 *   portrait-single   one portrait at 1:1; params {stage, seed, t, crack, glitch, flip, atViewer, blink, speed}
 *   portrait-seeds    identity variation at stage 0
 *   portrait-mirror   WebGL: the texture on a small tilted plane at mirror size
 *   portrait-cab      WebGL: the real cab with the portrait on its mirror glass
 *   portrait-faces    face crops of every stage (params: seed, atViewer)
 *   portrait-perf     timings: build slices, paint cost, a live 0→4 transition
 *   portrait-calib    measures the cab print-map grey→ink transfer
 *   portrait-clay / portrait-ink   debug views of the geometry and the bare engraving
 * portrait-cab accepts {"nomip":true} to compare sampling without mipmaps.
 */
import * as THREE from "three";
import type { FaceState } from "../api.ts";
import { inkMaterial } from "../core/ink-material.ts";
import { inSituStage } from "../lab/stage-kit.ts";
import type { LabContext, LabScene } from "../lab/types.ts";
import { EyeSystem } from "./eyes.ts";
import { drawFigure } from "./figure.ts";
import { FACE_PRESETS, createPortrait, flipPlaneU, mirrorGlassUV, portraitBuildSteps, type PortraitDrawOptions } from "./index.ts";
import { BUILD_TRACE } from "./math.ts";
import { DepthBuffer } from "./raster.ts";
import { exprFromFace, makeIdentity } from "./rig.ts";
import { buildScene } from "./scene.ts";

const STAGE_NAMES = ["0 composed", "1 shock", "2 withdrawn", "3 fatigue", "4 grief", "5 dissociation", "6 afterimage"];

/** Render a portrait canvas at time t by stepping draw() like a running game. */
function renderPortrait(seed: string, face: FaceState, t: number, o: Partial<PortraitDrawOptions> = {}, mirrored = false): HTMLCanvasElement {
  const p = createPortrait({ seed, mirrored });
  p.settle(face);
  const opts: PortraitDrawOptions = { speed: 45, crack: 0, reducedMotion: false, ...o };
  for (let s = Math.max(0, t - 1.5); s <= t + 1e-6; s += 1 / 30) p.draw(face, s, opts);
  return p.canvas;
}

function cell(root: HTMLElement, cv: HTMLCanvasElement, caption: string, scale: number, flip: boolean, crop?: [number, number, number, number]): void {
  const wrap = document.createElement("figure");
  wrap.style.cssText = "margin:0;display:flex;flex-direction:column;align-items:center;gap:4px";
  const img = document.createElement("canvas");
  const [sx, sy, sw, sh] = crop ?? [0, 0, cv.width, cv.height];
  img.width = Math.round(sw * (crop ? scale : 1));
  img.height = Math.round(sh * (crop ? scale : 1));
  const ig = img.getContext("2d")!;
  ig.imageSmoothingEnabled = !crop;
  ig.drawImage(cv, sx, sy, sw, sh, 0, 0, img.width, img.height);
  const dw = crop ? img.width : sw * scale,
    dh = crop ? img.height : sh * scale;
  img.style.cssText = `width:${dw}px;height:${dh}px;border-radius:${crop ? 0 : 18}px;box-shadow:0 0 0 3px #111, 0 0 0 7px #ddd;${flip ? "transform:scaleX(-1)" : ""}`;
  const cap = document.createElement("figcaption");
  cap.textContent = caption;
  cap.style.cssText = "font:13px/1.2 ui-monospace,monospace;color:#111";
  wrap.append(img, cap);
  root.append(wrap);
}

function gridStage(ctx: LabContext): HTMLElement {
  const root = ctx.domStage();
  root.style.display = "flex";
  root.style.flexWrap = "wrap";
  root.style.gap = "18px 14px";
  root.style.padding = "14px";
  root.style.alignContent = "flex-start";
  return root;
}

let showFacing = false;

function debugCanvas(stage: number, seed: string, mode: "clay" | "ink", yawDeg?: number, zoom = 1): HTMLCanvasElement {
  const id = makeIdentity(seed);
  const ex = exprFromFace(FACE_PRESETS[stage]!, id);
  const t0 = performance.now();
  const sc = buildScene(id, ex, 512, 640, { yaw: yawDeg === undefined ? undefined : (yawDeg * Math.PI) / 180, zoom });
  const t1 = performance.now();
  const cv = document.createElement("canvas");
  cv.width = sc.w;
  cv.height = sc.h;
  const g = cv.getContext("2d")!;
  if (mode === "clay") {
    const zb = new DepthBuffer(sc.w, sc.h);
    zb.attr = new Float32Array(sc.w * sc.h);
    if (showFacing) for (const gr of sc.grids) for (let k = 0; k < gr.n; k++) gr.tone[k] = gr.facing[k]! < 0 ? 1 : 0.5 - 0.5 * gr.facing[k]!;
    for (const gr of sc.grids) zb.grid(gr, false, true);
    const img = g.createImageData(sc.w, sc.h);
    for (let k = 0; k < sc.w * sc.h; k++) {
      const d = zb.depth[k]!;
      const v = d < Infinity ? Math.round(255 * (1 - zb.attr[k]!)) : 235;
      img.data[k * 4] = v;
      img.data[k * 4 + 1] = v;
      img.data[k * 4 + 2] = d < Infinity ? v : 255;
      img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  } else {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, sc.w, sc.h);
    drawFigure(g, sc, { bias: ex.tension * 0.07, weight: 1 });
    new EyeSystem(sc).draw(g, { blink: 0, yaw: 0, pitch: -0.035, atViewer: 0, tears: ex.tears, t: 0, droop: 0, after: ex.after });
  }
  g.fillStyle = "#c00";
  g.font = "12px monospace";
  g.fillText(`scene ${(t1 - t0).toFixed(1)} ms, total ${(performance.now() - t0).toFixed(1)} ms`, 8, 16);
  return cv;
}

export const scenes: LabScene[] = [
  {
    name: "portrait-stages",
    description: "Stages 0-6 and an aged, cracked variant, as the player sees them in the mirror (flipped).",
    build(ctx) {
      const root = gridStage(ctx);
      const seed = String(ctx.params.seed ?? "lab");
      const flip = ctx.params.flip !== false;
      const scale = Number(ctx.params.scale ?? 0.5);
      FACE_PRESETS.forEach((f, i) => cell(root, renderPortrait(seed, f, 2.2 + i * 0.37, { crack: 0 }), STAGE_NAMES[i]!, scale, flip));
      const aged: FaceState = { ...FACE_PRESETS[4]!, age: 1, fatigue: 0.95 };
      cell(root, renderPortrait(seed, aged, 3.1, { crack: 0.85, speed: 70 }), "aged + cracked", scale, flip);
    },
  },
  {
    name: "portrait-faces",
    description: "Face crops of every stage at 1:1 (as seen in the mirror).",
    build(ctx) {
      const root = gridStage(ctx);
      const seed = String(ctx.params.seed ?? "lab");
      const crop = (ctx.params.crop as [number, number, number, number] | undefined) ?? [120, 170, 300, 330];
      const scale = Number(ctx.params.scale ?? 1);
      const eyes = ctx.params.atViewer !== undefined ? { atViewer: Number(ctx.params.atViewer) } : undefined;
      FACE_PRESETS.forEach((f, i) => cell(root, renderPortrait(seed, f, 2.2 + i * 0.37, { crack: 0, eyes }), STAGE_NAMES[i]!, scale, true, crop));
    },
  },
  {
    name: "portrait-single",
    description: "One portrait at 1:1. Params: stage, seed, t, crack, glitch, flip, atViewer, blink, speed.",
    build(ctx) {
      const root = gridStage(ctx);
      const p = ctx.params;
      const stage = Number(p.stage ?? 0);
      const face: FaceState = { ...FACE_PRESETS[Math.round(stage)]!, ...((p.face as Partial<FaceState>) ?? {}) };
      const eyes: PortraitDrawOptions["eyes"] = {};
      if (p.atViewer !== undefined) eyes.atViewer = Number(p.atViewer);
      if (p.blink !== undefined) eyes.blink = Number(p.blink);
      const cv = renderPortrait(String(p.seed ?? "lab"), face, Number(p.t ?? 2), {
        crack: Number(p.crack ?? 0),
        glitch: Number(p.glitch ?? 0),
        speed: Number(p.speed ?? 45),
        eyes,
      });
      cell(root, cv, `stage ${stage}`, Number(p.scale ?? 1), p.flip === true, p.crop as [number, number, number, number] | undefined);
    },
  },
  {
    name: "portrait-seeds",
    description: "Identity variation: eight seeds at stage 0.",
    build(ctx) {
      const root = gridStage(ctx);
      const scale = Number(ctx.params.scale ?? 0.5);
      const st = Number(ctx.params.stage ?? 0);
      for (const s of ["lab", "ada", "bram", "cyra", "dov", "enna", "fitz", "gale"]) cell(root, renderPortrait(s, FACE_PRESETS[st]!, 2), s, scale, true);
    },
  },
  {
    name: "portrait-mirror",
    description: "WebGL: the portrait texture on a small tilted plane at mirror size (~180x220 px).",
    build(ctx) {
      inSituStage(ctx);
      const stage = Number(ctx.params.stage ?? 0);
      const face = FACE_PRESETS[stage]!;
      const p = createPortrait({ seed: String(ctx.params.seed ?? "lab") });
      p.settle(face);
      const geo = flipPlaneU(new THREE.PlaneGeometry(0.2, 0.25));
      const mat = inkMaterial({ map: p.texture, flat: true, hatchSpace: "view", hatch: 0.0012 });
      const plane = new THREE.Mesh(geo, mat);
      plane.userData.noShadow = true;
      // Held in front of the camera, like the cab's mirror seen from the seat.
      const cam = ctx.camera;
      const holder = new THREE.Group();
      ctx.scene.add(holder);
      holder.add(plane);
      ctx.onFrame((_dt, t) => {
        p.draw(face, t, { speed: 45, crack: Number(ctx.params.crack ?? 0), reducedMotion: false });
        holder.position.copy(cam.position);
        holder.quaternion.copy(cam.quaternion);
        plane.position.set(-0.38, 0.07, -1.0);
        plane.rotation.set(0.05, 0.42, 0.03);
      });
      ctx.caption(`portrait on a tilted plane, stage ${stage}`);
    },
  },
  {
    name: "portrait-cab",
    description: "WebGL: the real cab with the portrait on its left mirror.",
    async build(ctx) {
      inSituStage(ctx);
      const stage = Number(ctx.params.stage ?? 0);
      const face = FACE_PRESETS[stage]!;
      const p = createPortrait({ seed: String(ctx.params.seed ?? "lab") });
      p.settle(face);
      if (ctx.params.nomip === true) {
        p.texture.generateMipmaps = false;
        p.texture.minFilter = THREE.LinearFilter;
        p.texture.needsUpdate = true;
      }
      try {
        const mod = await import("../cabin/index.ts");
        const cab = mod.createCabin({ seed: "lab" });
        cab.group.position.set(0, 0.63 + 1.1, 2);
        ctx.scene.add(cab.group);
        cab.applyCamera(ctx.camera, innerWidth / innerHeight);
        cab.setMirrorTexture(p.texture);
        // Recommended integration: crop U to the glass aspect, then flip it.
        cab.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.name === "cab-mirror-glass") mirrorGlassUV(m.geometry, 0.2 / 0.28);
        });
        cab.setGauges({ speedKmh: 44, pressure: 5, clock: "06:40" });
        ctx.onFrame((dt, t) => {
          p.draw(face, t, { speed: 44, crack: Number(ctx.params.crack ?? 0), reducedMotion: false });
          cab.tick(dt, t);
        });
        ctx.caption(`cab mirror, stage ${stage} (glass UVs cropped + flipped via mirrorGlassUV)`);
      } catch (e) {
        ctx.caption(`cab unavailable: ${String(e)}`);
      }
    },
  },
  {
    name: "portrait-perf",
    description: "Timings: first build, a full rebuild, steady-state paint cost, and a live 0→4 transition.",
    build(ctx) {
      const root = gridStage(ctx);
      const pre = document.createElement("pre");
      pre.style.cssText = "font:13px/1.45 ui-monospace,monospace;margin:0 16px 0 0";
      const lines: string[] = [];
      const t0 = performance.now();
      const p = createPortrait({ seed: "perf" });
      p.draw(FACE_PRESETS[0]!, 0, { speed: 45, crack: 0, reducedMotion: false });
      lines.push(`first draw (background only; the figure builds time-sliced): ${(performance.now() - t0).toFixed(1)} ms`);
      const t1 = performance.now();
      p.settle(FACE_PRESETS[4]);
      lines.push(`settle(stage 4), synchronous (target + stage-0 builds): ${(performance.now() - t1).toFixed(1)} ms`);
      // Steady state: paint cost only (12 fps cap bypassed by stepping 1/12 s).
      const samples: number[] = [];
      for (let i = 1; i <= 60; i++) {
        const s = performance.now();
        p.draw(FACE_PRESETS[4]!, 10 + i / 12, { speed: 45, crack: 0.3, reducedMotion: false });
        samples.push(performance.now() - s);
      }
      samples.sort((a, b) => a - b);
      lines.push(`paint: median ${samples[30]!.toFixed(2)} ms, p90 ${samples[54]!.toFixed(2)} ms (512x640, 60 frames)`);
      // Live transition 0 -> 4 at 60 fps with the default 5 ms budget.
      const q = createPortrait({ seed: "perf" });
      q.draw(FACE_PRESETS[0]!, 0, { speed: 45, crack: 0, reducedMotion: false });
      const per: number[] = [];
      let worst = 0;
      for (let i = 1; i <= 360; i++) {
        const s = performance.now();
        q.draw(FACE_PRESETS[4]!, i / 60, { speed: 45, crack: 0, reducedMotion: false });
        const d = performance.now() - s;
        per.push(d);
        worst = Math.max(worst, d);
      }
      per.sort((a, b) => a - b);
      lines.push(`live transition 0→4 over 6 s @60 fps: median ${per[180]!.toFixed(2)} ms/frame, p95 ${per[342]!.toFixed(2)}, worst ${worst.toFixed(1)}`);
      // Step profile of one build: the slowest slices.
      const steps: Array<[string, number]> = [];
      const gen = portraitBuildSteps("perf", FACE_PRESETS[4]!);
      let total = 0;
      for (;;) {
        const s = performance.now();
        const r = gen.next();
        const d = performance.now() - s;
        total += d;
        steps.push([BUILD_TRACE.label, d]);
        if (r.done) break;
      }
      steps.sort((a, b) => b[1] - a[1]);
      lines.push(`one build: ${steps.length} slices, ${total.toFixed(1)} ms total; slowest:`);
      for (const [l, d] of steps.slice(0, 10)) lines.push(`   ${d.toFixed(2).padStart(6)} ms  ${l}`);
      pre.textContent = lines.join("\n");
      root.append(pre);
      cell(root, q.canvas, "after 6 s transition to stage 4", 0.6, true);
    },
  },
  {
    name: "portrait-calib",
    description: "Measures the print-map transfer: 17 grey steps on a plane with the cab's map material settings.",
    build(ctx) {
      inSituStage(ctx);
      const cv = document.createElement("canvas");
      cv.width = 17 * 16;
      cv.height = 16;
      const g = cv.getContext("2d")!;
      for (let i = 0; i < 17; i++) {
        const v = Math.round(255 * (1 - i / 16));
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(i * 16, 0, 16, 16);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(17 * 0.1, 0.1), inkMaterial({ map: tex, flat: true, hatchSpace: "view", hatch: 0.0012 }));
      plane.userData.noShadow = true;
      const holder = new THREE.Group();
      ctx.scene.add(holder);
      holder.add(plane);
      ctx.onFrame(() => {
        holder.position.copy(ctx.camera.position);
        holder.quaternion.copy(ctx.camera.quaternion);
        plane.position.set(0, 0.3, -1.2);
      });
    },
  },
  {
    name: "portrait-clay",
    description: "Debug: shaded clay render of the bust geometry (params.facing: show N·V).",
    build(ctx) {
      const root = gridStage(ctx);
      showFacing = ctx.params.facing === true;
      const seed = String(ctx.params.seed ?? "lab");
      const stages = (ctx.params.stages as number[] | undefined) ?? [0, 4];
      const yaws = (ctx.params.yaws as number[] | undefined) ?? [];
      const zoom = Number(ctx.params.zoom ?? 1);
      if (yaws.length) for (const y of yaws) root.append(debugCanvas(stages[0] ?? 0, seed, "clay", y, zoom));
      else for (const s of stages) root.append(debugCanvas(s, seed, "clay", undefined, zoom));
    },
  },
  {
    name: "portrait-ink",
    description: "Debug: engraved bust without background or glass.",
    build(ctx) {
      const root = gridStage(ctx);
      const seed = String(ctx.params.seed ?? "lab");
      const stages = (ctx.params.stages as number[] | undefined) ?? [0, 4];
      const yaws = (ctx.params.yaws as number[] | undefined) ?? [];
      const zoom = Number(ctx.params.zoom ?? 1);
      if (yaws.length) for (const y of yaws) root.append(debugCanvas(stages[0] ?? 0, seed, "ink", y, zoom));
      else for (const s of stages) root.append(debugCanvas(s, seed, "ink", undefined, zoom));
    },
  },
];
