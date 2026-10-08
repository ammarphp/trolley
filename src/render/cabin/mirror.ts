/**
 * The left exterior mirror: a bracket on the cab's front corner, a cranked
 * tubular arm, and a rounded mirror head angled back so the driver sees
 * their own face. Until the portrait module supplies a canvas, the glass
 * shows a placeholder pen sketch of the controller.
 */
import * as THREE from "three";
import { Kit, cylinder, sphere } from "../core/geometry.ts";
import { createInkCanvas } from "../core/ink-material.ts";
import { createRng } from "../core/rng.ts";
import { EYE } from "./layout.ts";
import { IDS, cabMaterial, cabMesh, cylinderBetween, mapMaterial, roundedBox, roundedRectPts, slab, v3 } from "./util.ts";

export const MIRROR_W = 0.2;
export const MIRROR_H = 0.28;
export const MIRROR_CENTER: [number, number, number] = [-1.07, 1.39, -1.215];

export interface MirrorParts {
  group: THREE.Group;
  glass: THREE.Mesh;
  setTexture(tex: THREE.Texture): void;
  /** World-space corners of the glass for anchors. */
  corners(): THREE.Vector3[];
  /** The placeholder portrait texture (owned by the cab). */
  placeholder: THREE.Texture;
}

/** Placeholder: the controller's face in a convex exterior mirror, pen and ink. */
export function drawPlaceholderFace(ctx: CanvasRenderingContext2D, w: number, h: number, seed = "face"): void {
  const rng = createRng(seed);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  const s = w / 360;
  ctx.scale(s, s);
  const W = 360,
    H = h / s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111";
  ctx.fillStyle = "#111";

  // Reflected cab behind the head: window frame, ceiling, hatched interior.
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, 118);
  ctx.lineTo(W + 10, 88);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  for (let x = -H; x < W; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 100, 100 - 0.08 * x);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(262, H + 10);
  ctx.lineTo(282, 96);
  ctx.lineTo(W + 10, 90);
  ctx.lineTo(W + 10, H + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Window light beyond the frame (paper) with a few far strokes.
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const y = 250 + i * 9 + rng.range(-2, 2);
    ctx.beginPath();
    ctx.moveTo(292, y);
    ctx.lineTo(W, y - 4);
    ctx.stroke();
  }

  // Shoulders and uniform.
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-10, H + 10);
  ctx.bezierCurveTo(10, 400, 60, 372, 118, 356);
  ctx.lineTo(236, 352);
  ctx.bezierCurveTo(300, 366, 346, 396, W + 10, H - 10);
  ctx.lineTo(W + 10, H + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Jacket hatching (dark serge), cross-hatched on the shadow side.
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 2;
  for (let x = -H; x < W + H; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 140, H - 140);
    ctx.stroke();
  }
  ctx.lineWidth = 1.6;
  for (let x = 160; x < W + H; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x - 150, H - 150);
    ctx.stroke();
  }
  ctx.restore();
  // Shirt collar and tie (white V, black tie).
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(132, 346);
  ctx.lineTo(180, 408);
  ctx.lineTo(226, 342);
  ctx.lineTo(212, 322);
  ctx.lineTo(150, 324);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(170, 352);
  ctx.lineTo(190, 352);
  ctx.lineTo(186, 366);
  ctx.lineTo(196, 420);
  ctx.lineTo(180, 436);
  ctx.lineTo(164, 420);
  ctx.lineTo(174, 366);
  ctx.closePath();
  ctx.fill();
  // Lapel edges and a collar badge.
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(118, 356);
  ctx.lineTo(166, 440);
  ctx.moveTo(240, 352);
  ctx.lineTo(196, 440);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(250, 392, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Neck.
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(146, 262);
  ctx.lineTo(148, 330);
  ctx.lineTo(214, 330);
  ctx.lineTo(218, 262);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let y = 280; y < 330; y += 6) {
    ctx.beginPath();
    ctx.moveTo(190, y);
    ctx.lineTo(216, y - 12);
    ctx.stroke();
  }

  // Head: 3/4 toward the viewer's left, lit from the windshield (viewer's left).
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(116, 150);
  ctx.bezierCurveTo(110, 210, 118, 262, 150, 292);
  ctx.bezierCurveTo(168, 308, 196, 310, 214, 294);
  ctx.bezierCurveTo(238, 272, 250, 232, 248, 196);
  ctx.bezierCurveTo(247, 170, 244, 150, 240, 138);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ear (far side).
  ctx.beginPath();
  ctx.moveTo(246, 190);
  ctx.bezierCurveTo(268, 178, 272, 220, 250, 238);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(252, 198);
  ctx.bezierCurveTo(262, 200, 260, 218, 252, 224);
  ctx.stroke();
  // Shadow side of the face: hatch.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(196, 140);
  ctx.bezierCurveTo(214, 200, 230, 250, 206, 300);
  ctx.lineTo(260, 300);
  ctx.lineTo(260, 140);
  ctx.closePath();
  ctx.clip();
  ctx.lineWidth = 1.7;
  for (let x = 120; x < 320; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 310);
    ctx.lineTo(x + 60, 140);
    ctx.stroke();
  }
  ctx.restore();
  // Eyebrows, eyes (looking at us), nose, mouth, cheek line.
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(130, 186);
  ctx.quadraticCurveTo(150, 176, 170, 184);
  ctx.moveTo(196, 184);
  ctx.quadraticCurveTo(214, 178, 230, 186);
  ctx.stroke();
  const eye = (cx: number, cy: number, wid: number) => {
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx - wid, cy);
    ctx.quadraticCurveTo(cx, cy - 11, cx + wid, cy);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - wid * 0.8, cy + 3);
    ctx.quadraticCurveTo(cx, cy + 8, cx + wid * 0.8, cy + 2);
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx + 1, cy - 1, 5.5, 0, Math.PI * 2);
    ctx.fill();
  };
  eye(151, 204, 16);
  eye(212, 204, 14);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(184, 202);
  ctx.bezierCurveTo(180, 224, 172, 238, 176, 246);
  ctx.quadraticCurveTo(186, 252, 196, 246);
  ctx.stroke();
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(162, 270);
  ctx.quadraticCurveTo(182, 276, 204, 268);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(168, 283);
  ctx.quadraticCurveTo(182, 287, 196, 282);
  ctx.stroke();
  // Tired lines under the eyes.
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(140, 220);
  ctx.quadraticCurveTo(152, 226, 164, 221);
  ctx.moveTo(203, 220);
  ctx.quadraticCurveTo(213, 225, 224, 220);
  ctx.stroke();

  // Uniform cap: crown, band, peak (solid), badge.
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(98, 150);
  ctx.bezierCurveTo(92, 104, 132, 72, 190, 70);
  ctx.bezierCurveTo(244, 70, 272, 98, 268, 142);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 1.8;
  for (let x = 60; x < 320; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 150);
    ctx.lineTo(x + 50, 60);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(100, 142);
  ctx.lineTo(266, 136);
  ctx.lineTo(266, 158);
  ctx.lineTo(102, 166);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(96, 162);
  ctx.bezierCurveTo(130, 186, 220, 186, 252, 160);
  ctx.lineTo(250, 152);
  ctx.bezierCurveTo(210, 168, 140, 170, 102, 152);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(176, 118, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = `700 16px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("4", 176, 119);

  // Convex glass: a dark rim vignette and one bright glint.
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#111";
  ctx.strokeRect(0, 0, W, H);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(30, 60);
  ctx.quadraticCurveTo(40, 30, 76, 22);
  ctx.stroke();
  ctx.restore();
}

export function buildMirror(): MirrorParts {
  const group = new THREE.Group();
  group.name = "cab-mirror";
  const [mx, my, mz] = MIRROR_CENTER;
  const head = new THREE.Group();
  head.position.set(mx, my, mz);
  head.lookAt(new THREE.Vector3(...EYE));
  group.add(head);

  // Head housing: rounded shell behind the glass.
  const k = new Kit();
  const rim = roundedRectPts(MIRROR_W + 0.026, MIRROR_H + 0.026, 0.045, 8);
  const inner = roundedRectPts(MIRROR_W, MIRROR_H, 0.034, 8);
  k.add(slab(rim, 0.012, { holes: [inner], bevel: 0.0035, z0: -0.006 }), { tone: "deep" });
  const back = roundedBox(MIRROR_W + 0.02, MIRROR_H + 0.02, 0.05, 0.02, 3);
  k.add(back, { tone: "light", position: [0, 0, -0.03] });
  // Clamp boss on top where the arm's ball joint seats.
  k.add(roundedBox(0.05, 0.03, 0.03, 0.008), { tone: "mid", position: [0, MIRROR_H / 2 + 0.01, -0.024] });
  const headMesh = cabMesh(k.build(), cabMaterial(IDS.mirror), "cab-mirror-head");
  head.add(headMesh);

  // Glass.
  const { ctx, texture } = createInkCanvas(360, 504);
  drawPlaceholderFace(ctx, 360, 504, "placeholder");
  texture.needsUpdate = true;
  const glassGeo = new THREE.PlaneGeometry(MIRROR_W, MIRROR_H);
  const glass = cabMesh(glassGeo, mapMaterial(texture, IDS.mirrorGlass), "cab-mirror-glass");
  glass.position.z = -0.0005;
  head.add(glass);
  // Round the glass corners with the rim (the rim overlaps them).

  // Arm and bracket (cab-local): from the cab's front corner above the
  // window line, cranked outward, then down to a ball joint on the head.
  const ak = new Kit();
  const bracket = v3(-0.9, 1.66, -1.1);
  const elbow = v3(-1.035, 1.655, -1.19);
  head.updateMatrix();
  const ball = new THREE.Vector3(0, MIRROR_H / 2 + 0.018, -0.022).applyMatrix4(head.matrix);
  ak.add(roundedBox(0.026, 0.1, 0.07, 0.008), { tone: "light", position: [bracket.x + 0.008, bracket.y, bracket.z] });
  for (const dy of [-0.032, 0.032]) ak.add(cylinder(0.0055, 0.0055, 0.012, 6), { tone: "mid", position: [bracket.x - 0.006, bracket.y + dy, bracket.z], rotation: [0, 0, Math.PI / 2] });
  ak.add(cylinderBetween(bracket.clone().add(v3(-0.005, 0, 0)), elbow, 0.0125, 0.0125, 12), { tone: "paper" });
  ak.add(sphere(0.016, 12, 10), { tone: "light", position: [elbow.x, elbow.y, elbow.z] });
  ak.add(cylinderBetween(elbow, ball, 0.0115, 0.0105, 12), { tone: "paper" });
  ak.add(sphere(0.0145, 12, 10), { tone: "mid", position: [ball.x, ball.y, ball.z] });
  group.add(cabMesh(ak.build(), cabMaterial(IDS.exterior), "cab-mirror-arm"));

  return {
    group,
    glass,
    placeholder: texture,
    setTexture(tex: THREE.Texture) {
      glass.material = mapMaterial(tex, IDS.mirrorGlass);
    },
    corners() {
      group.updateWorldMatrix(true, true);
      const hw = MIRROR_W / 2,
        hh = MIRROR_H / 2;
      return [v3(-hw, -hh, 0), v3(hw, -hh, 0), v3(hw, hh, 0), v3(-hw, hh, 0)].map((p) => p.applyMatrix4(glass.matrixWorld));
    },
  };
}
