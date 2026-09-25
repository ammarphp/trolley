import * as THREE from "three";
import { InkPipeline } from "../core/ink-pipeline.ts";
import { createRng } from "../core/rng.ts";
import { inkMaterial } from "../core/ink-material.ts";
import type { LabContext, LabScene } from "./types.ts";

declare global {
  interface Window {
    __labReady?: boolean;
    __labError?: string;
    __labScenes?: string[];
  }
}

export async function runLab(registry: LabScene[]): Promise<void> {
  const url = new URL(location.href);
  const name = url.searchParams.get("scene") ?? "";
  const fixedT = url.searchParams.has("t") ? Number(url.searchParams.get("t")) : null;
  const params = JSON.parse(url.searchParams.get("params") || "{}") as Record<string, unknown>;
  window.__labScenes = registry.map((s) => s.name).sort();
  const def = registry.find((s) => s.name === name);
  if (!def) {
    document.body.innerHTML = `<main style="font:14px/1.5 system-ui;padding:24px"><h1>Asset lab</h1><p>Pick a scene:</p><ul>${window.__labScenes
      .map((n) => `<li><a href="?scene=${encodeURIComponent(n)}">${n}</a></li>`)
      .join("")}</ul></main>`;
    window.__labReady = true;
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block";
  document.body.append(canvas);
  const pipeline = new InkPipeline({ canvas, preserveDrawingBuffer: true, maxPixelRatio: Number(url.searchParams.get("dpr") || 2) });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1500);
  camera.position.set(6, 3, 8);
  camera.lookAt(0, 1, 0);
  const frames: Array<(dt: number, t: number) => void> = [];
  let dom: HTMLElement | null = null;
  const ctx: LabContext = {
    scene,
    camera,
    pipeline,
    rng: createRng(url.searchParams.get("seed") ?? "lab"),
    params,
    onFrame: (cb) => frames.push(cb),
    standardStage(options = {}) {
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      const s = options.sun ?? [30, 45, 20];
      sun.position.set(s[0], s[1], s[2]);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const cam = sun.shadow.camera;
      cam.left = -40;
      cam.right = 40;
      cam.top = 40;
      cam.bottom = -40;
      cam.near = 1;
      cam.far = 200;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      scene.add(sun);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.9));
      if (options.ground !== false) {
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(400, 400),
          inkMaterial({ tone: options.groundTone ?? 0.04, hatch: 0.2, edge: 0.4 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
      }
      return sun;
    },
    view(position, target, fov) {
      camera.position.set(...position);
      camera.lookAt(...target);
      if (fov) camera.fov = fov;
      camera.updateProjectionMatrix();
    },
    lineup(objects, spacing, axis = "x") {
      const start = (-(objects.length - 1) * spacing) / 2;
      objects.forEach((o, i) => {
        if (axis === "x") o.position.x = start + i * spacing;
        else o.position.z = start + i * spacing;
        scene.add(o);
      });
    },
    caption(text) {
      const el = document.createElement("div");
      el.textContent = text;
      el.style.cssText =
        "position:fixed;left:16px;bottom:12px;font:12px/1.3 ui-monospace,monospace;color:#111;background:rgba(255,255,255,.85);padding:4px 8px;z-index:5;max-width:90vw";
      document.body.append(el);
    },
    domStage() {
      if (!dom) {
        dom = document.createElement("div");
        dom.style.cssText = "position:fixed;inset:0;background:#fff;z-index:3;overflow:auto";
        document.body.append(dom);
      }
      return dom;
    },
  };
  try {
    await def.build(ctx);
  } catch (error) {
    window.__labError = String((error as Error)?.stack || error);
    throw error;
  }
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.noShadow !== true) {
      m.castShadow = m.castShadow || m.userData.castShadow !== false;
      m.receiveShadow = true;
    }
  });
  pipeline.calibrate(scene);
  const resize = () => {
    pipeline.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener("resize", resize);
  let t = 0;
  const step = (dt: number) => {
    t += dt;
    for (const f of frames) f(dt, t);
  };
  if (fixedT !== null) {
    const dt = 1 / 60;
    while (t < fixedT - 1e-6) step(dt);
    pipeline.render(scene, camera, 1 / 60);
    // Two frames so shadow maps and programs settle.
    pipeline.render(scene, camera, 0);
    window.__labReady = true;
    return;
  }
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    pipeline.render(scene, camera, dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__labReady = true;
}
