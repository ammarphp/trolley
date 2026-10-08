/**
 * Cab lab: the cab seen through the real camera recommendation, over a
 * straight track. Scenes cover the clean stage-1 cab, lever -1/0/+1, the
 * Morrow screen, heavy damage, rain, overridden authority, and a portrait
 * framing. Params: {"lever": -1..1, "sun": [x,y,z]}.
 */
import * as THREE from "three";
import { Kit, block, cylinder } from "../core/geometry.ts";
import { createInkCanvas, createInkLineMaterial, inkMaterial } from "../core/ink-material.ts";
import { inSituStage } from "../lab/stage-kit.ts";
import type { LabContext, LabScene } from "../lab/types.ts";
import { createCabin, type Cabin } from "./index.ts";

const RAIL_TOP = 0.63;

function masts(): THREE.Mesh {
  // Tram overhead line: masts every 32 m on the left, span wires implied.
  const k = new Kit();
  for (let z = -20; z > -400; z -= 32) {
    k.add(cylinder(0.11, 0.14, 7.2, 8), { tone: "light", position: [-3.4, 3.6, z] });
    k.add(block(0.12, 0.12, 3.2), { tone: "light", position: [-1.85, 6.6, z], rotation: [0, Math.PI / 2, 0] });
    k.add(cylinder(0.05, 0.05, 0.5, 6), { tone: "mid", position: [-0.25, 6.3, z] });
  }
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.12 }));
}

function wires(): THREE.LineSegments {
  const pts: number[] = [];
  for (let z = 0; z > -400; z -= 32) pts.push(0, 6.05, z, 0, 6.05, z - 32);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, createInkLineMaterial({ tone: 0.9 }));
}

function trees(): THREE.Mesh {
  const k = new Kit();
  const spots: Array<[number, number, number]> = [
    [-14, -46, 1.2],
    [-22, -80, 1.6],
    [12, -64, 1.3],
    [26, -120, 2],
    [-40, -150, 2.4],
    [9, -30, 0.9],
  ];
  for (const [x, z, s] of spots) {
    k.add(cylinder(0.14 * s, 0.24 * s, 3.2 * s, 7), { tone: "mid", position: [x, 1.6 * s, z] });
    const blob = new THREE.IcosahedronGeometry(1.8 * s, 1);
    k.add(blob, { tone: "pale", position: [x, 4.4 * s, z] });
    k.add(new THREE.IcosahedronGeometry(1.2 * s, 1), { tone: "pale", position: [x + 1 * s, 3.8 * s, z + 0.4] });
  }
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.16 }));
}

function stage(ctx: LabContext): Cabin {
  const sun = (ctx.params.sun as [number, number, number] | undefined) ?? [35, 48, 30];
  inSituStage(ctx, { sun });
  ctx.scene.add(masts(), wires(), trees());
  const cab = createCabin({ seed: "lab" });
  cab.group.position.set(0, RAIL_TOP + 1.1, 2);
  ctx.scene.add(cab.group);
  const aspect = innerWidth / innerHeight;
  cab.applyCamera(ctx.camera, aspect);
  const lever = typeof ctx.params.lever === "number" ? (ctx.params.lever as number) : 0;
  cab.setLever(lever, 0);
  ctx.onFrame((dt, t) => {
    cab.setLever(lever);
    cab.tick(dt, t);
  });
  (window as unknown as { __cab: Cabin }).__cab = cab;
  return cab;
}

function stage1(cab: Cabin): void {
  cab.setGauges({ speedKmh: 34, pressure: 5.1, clock: "06:40" });
  cab.screen.setState({ mode: "dispatch", lines: ["Dispatch to Unit Four.", "Head office is watching", "the on-time figures today.", "Do not be late."] });
  cab.setKeepsake("coffee");
  cab.setAuthority("human");
}

export const scenes: LabScene[] = [
  {
    name: "cabin-clean",
    description: "Stage-1 cab, lever centred.",
    build(ctx) {
      stage1(stage(ctx));
    },
  },
  {
    name: "cabin-lever-left",
    build(ctx) {
      ctx.params.lever = -1;
      stage1(stage(ctx));
    },
  },
  {
    name: "cabin-lever-right",
    build(ctx) {
      ctx.params.lever = 1;
      stage1(stage(ctx));
    },
  },
  {
    name: "cabin-morrow",
    description: "Morrow installed and thinking; delegated authority; a receipt printed.",
    build(ctx) {
      const cab = stage(ctx);
      cab.setGauges({ speedKmh: 46, pressure: 4.9, clock: "09:12" });
      cab.screen.setState({
        mode: "morrow",
        thinking: true,
        lines: ["I found a route nobody noticed.", "The old freight bridge will hold.", "Six minutes."],
      });
      cab.setAuthority("delegated");
      cab.setKeepsake("coffee");
      cab.printReceipt("Authority delegated to Morrow.\nRoute selection: assisted.\nController retains override.");
    },
  },
  {
    name: "cabin-morrow-flash",
    description: "Morrow alert state with the mark flashing signal red (logo-flash cue); render at t = 1.0.",
    build(ctx) {
      const cab = stage(ctx);
      cab.setGauges({ speedKmh: 52, pressure: 5, clock: "11:04" });
      cab.setAuthority("delegated");
      cab.screen.setState({ mode: "morrow", alert: true, lines: ["I have revised my last answer.", "The earlier figure was wrong."] });
      let fired = false;
      ctx.onFrame((_dt, t) => {
        if (!fired && t > 0.9) {
          fired = true;
          cab.screen.flashMark();
        }
      });
      const target = new THREE.Vector3(0.172, 1.05, -0.8).add(cab.group.position);
      if (ctx.params.close) {
        ctx.camera.position.copy(target).add(new THREE.Vector3(-0.05, 0.08, 0.32));
        ctx.camera.lookAt(target);
        ctx.camera.fov = 40;
        ctx.camera.updateProjectionMatrix();
      }
    },
  },
  {
    name: "cabin-damage",
    description: "Heavy damage: several impacts with blood, drips run, cracks grown.",
    build(ctx) {
      const cab = stage(ctx);
      cab.setGauges({ speedKmh: 58, pressure: 3.2, clock: "17:48" });
      cab.screen.setState({ mode: "jam", lines: ["Controller input suspended.", "Awaiting institutional review."] });
      cab.setAuthority("overridden");
      cab.setKeepsake("forms");
      const hits: Array<[number, number, number, boolean]> = [
        [0.36, 0.52, 0.9, true],
        [0.62, 0.38, 0.6, true],
        [0.2, 0.7, 0.4, false],
        [0.78, 0.66, 0.8, true],
        [0.5, 0.3, 0.5, true],
      ];
      for (const [u, v, s, b] of hits) cab.windshield.impact({ u, v, severity: s, blood: b });
    },
  },
  {
    name: "cabin-damage-wiped",
    description: "Blood smeared by one wiper pass.",
    build(ctx) {
      const cab = stage(ctx);
      cab.setGauges({ speedKmh: 52, pressure: 4.6, clock: "17:50" });
      cab.screen.setState({ mode: "morrow", lines: ["Continuing.", "Visibility is sufficient."] });
      cab.setAuthority("delegated");
      cab.setKeepsake(null);
      cab.windshield.impact({ u: 0.42, v: 0.5, severity: 0.8, blood: true });
      cab.windshield.impact({ u: 0.6, v: 0.62, severity: 0.5, blood: true });
      let wiped = false;
      ctx.onFrame((_dt, t) => {
        if (!wiped && t > 2.5) {
          wiped = true;
          cab.windshield.wipe();
        }
      });
    },
  },
  {
    name: "cabin-rain",
    build(ctx) {
      const cab = stage(ctx);
      stage1(cab);
      cab.windshield.setRain(0.8);
      cab.windshield.setAutoWipe(false);
      let wiped = false;
      ctx.onFrame((_dt, t) => {
        if (!wiped && t > 3.2) {
          wiped = true;
          cab.windshield.wipe();
        }
      });
    },
  },
  {
    name: "cabin-overridden",
    build(ctx) {
      ctx.params.lever = 1;
      const cab = stage(ctx);
      cab.setGauges({ speedKmh: 40, pressure: 5, clock: "12:58" });
      cab.screen.setState({ mode: "jam", lines: ["The lever will move", "under another's command."] });
      cab.setAuthority("overridden");
    },
  },
  {
    name: "cabin-hands",
    description: "Close study of the right hand on the lever (not a game view).",
    build(ctx) {
      const cab = stage(ctx);
      stage1(cab);
      const p = new THREE.Vector3(0.44, 1.14, -0.645).add(cab.group.position);
      const eye = (ctx.params.eye as [number, number, number] | undefined) ?? [-0.2, 0.075, 0.29];
      ctx.camera.position.copy(p).add(new THREE.Vector3(...eye));
      ctx.camera.lookAt(p);
      ctx.camera.fov = (ctx.params.fov as number | undefined) ?? 40;
      ctx.camera.updateProjectionMatrix();
    },
  },
  {
    name: "cabin-api",
    description: "Exercises screen off, setDestination, setMirrorTexture (external canvas), setKeepsake(null), and a lever caught mid-spring.",
    build(ctx) {
      // Target +1 every frame, but start snapped at -1: the lever swings over.
      ctx.params.lever = 1;
      const cab = stage(ctx);
      cab.setLever(-1, 0);
      cab.setGauges({ speedKmh: 0, pressure: 5, clock: "05:58" });
      cab.screen.setState({ mode: "off", lines: [] });
      cab.setDestination("Not in service");
      cab.setKeepsake(null);
      const { ctx: g, texture } = createInkCanvas(360, 504);
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 360, 504);
      g.strokeStyle = "#111";
      g.lineWidth = 10;
      g.strokeRect(20, 20, 320, 464);
      g.fillStyle = "#111";
      g.font = "bold 48px sans-serif";
      g.textAlign = "center";
      g.fillText("PORTRAIT", 180, 240);
      g.fillText("MODULE", 180, 300);
      texture.needsUpdate = true;
      cab.setMirrorTexture(texture);
      const tag = document.createElement("div");
      tag.style.cssText = "position:fixed;left:16px;bottom:12px;font:12px monospace;background:#fff;padding:3px 6px;z-index:6";
      document.body.append(tag);
      ctx.onFrame((_dt, t) => (tag.textContent = `t ${t.toFixed(2)}s  leverValue ${cab.leverValue.toFixed(3)} (target 1, from -1)`));
    },
  },
  {
    name: "cabin-anchors",
    description: "Draws cabin.anchors() rects over the frame and marks windshield.uvAt() for a trackside point.",
    build(ctx) {
      const cab = stage(ctx);
      stage1(cab);
      // Resolve after the lab's resize so the projection matches the canvas.
      requestAnimationFrame(() => {
        ctx.camera.aspect = innerWidth / innerHeight;
        cab.applyCamera(ctx.camera, ctx.camera.aspect);
        const a = cab.anchors(ctx.camera);
        const colors: Record<string, string> = { lever: "#e00", mirror: "#06f", dash: "#0a0", windshield: "#f90", screen: "#a0f" };
        for (const key of ["lever", "mirror", "dash", "windshield", "screen"] as const) {
          const r = a[key];
          const el = document.createElement("div");
          el.style.cssText = `position:fixed;left:${r.x * 100}%;top:${r.y * 100}%;width:${r.width * 100}%;height:${r.height * 100}%;border:2px dashed ${colors[key]};z-index:6;font:11px monospace;color:${colors[key]}`;
          el.textContent = `${key}${a.visible[key] ? "" : " (hidden)"}`;
          document.body.append(el);
        }
        // A point on the track 20 m ahead: where does it cross the glass?
        const p = new THREE.Vector3(0, RAIL_TOP, cab.group.position.z - 20);
        const uv = cab.windshield.uvAt(p, ctx.camera);
        if (uv) cab.windshield.impact({ u: uv.u, v: uv.v, severity: 0.35, blood: false });
        ctx.caption(`uvAt(track 20 m) = ${uv ? `${uv.u.toFixed(3)}, ${uv.v.toFixed(3)}` : "null"}`);
      });
    },
  },
  {
    name: "cabin-stats",
    description: "Clean cab with a caption of triangle and draw-call counts for the cab alone.",
    build(ctx) {
      const cab = stage(ctx);
      stage1(cab);
      let tris = 0;
      let calls = 0;
      let meshes = 0;
      const byName: Array<[string, number]> = [];
      cab.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible || (m.material as THREE.Material).visible === false) return;
        let visible = true;
        for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) visible = false;
        if (!visible) return;
        const g = m.geometry;
        const n = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
        tris += n;
        calls++;
        meshes++;
        byName.push([m.name, Math.round(n)]);
      });
      byName.sort((a, b) => b[1] - a[1]);
      ctx.caption(`cab: ${Math.round(tris)} tris, ${calls} draw calls (${meshes} meshes). top: ${byName.slice(0, 8).map(([n, c]) => `${n} ${c}`).join(", ")}`);
    },
  },
  {
    name: "cabin-detail",
    description: 'Close study of any cab point: params {"target":[x,y,z] cab-local, "eye":[dx,dy,dz], "fov":deg}.',
    build(ctx) {
      const cab = stage(ctx);
      stage1(cab);
      if (ctx.params.morrow) {
        cab.screen.setState({ mode: "morrow", thinking: true, lines: ["I found a route nobody noticed.", "Six minutes."] });
        cab.printReceipt("Authority delegated to Morrow.\nRoute selection: assisted.");
      }
      if (ctx.params.authority) cab.setAuthority(ctx.params.authority as "human" | "delegated" | "overridden");
      const target = (ctx.params.target as [number, number, number] | undefined) ?? [-0.6, 1.0, -0.8];
      const p = new THREE.Vector3(...target).add(cab.group.position);
      const eye = (ctx.params.eye as [number, number, number] | undefined) ?? [0.25, 0.15, 0.35];
      ctx.camera.position.copy(p).add(new THREE.Vector3(...eye));
      ctx.camera.lookAt(p);
      ctx.camera.fov = (ctx.params.fov as number | undefined) ?? 40;
      ctx.camera.near = 0.02;
      ctx.camera.updateProjectionMatrix();
    },
  },
  {
    name: "cabin-hand-left",
    build(ctx) {
      const cab = stage(ctx);
      stage1(cab);
      const p = new THREE.Vector3(-0.26, 1.03, -0.6).add(cab.group.position);
      const eye = (ctx.params.eye as [number, number, number] | undefined) ?? [0.13, 0.135, 0.3];
      ctx.camera.position.copy(p).add(new THREE.Vector3(...eye));
      ctx.camera.lookAt(p);
      ctx.camera.fov = 40;
      ctx.camera.updateProjectionMatrix();
    },
  },
];
