import * as THREE from "three";
import { inkMaterial } from "../core/ink-material.ts";
import { Kit, block, gable, cylinder, sphere, capsule, jitter } from "../core/geometry.ts";
import type { LabScene } from "./types.ts";

function house(): THREE.Mesh {
  const k = new Kit();
  k.add(block(6, 3.2, 5), { tone: "paper" });
  k.add(gable(6, 5, 2.4, 0.35), { tone: "mid", position: [0, 3.2, 0], rotation: [0, Math.PI / 2, 0] });
  k.add(block(0.9, 1.9, 0.12), { tone: "dark", position: [0.8, 0, 2.52] });
  for (const x of [-1.8, 2.2]) k.add(block(1, 1.1, 0.1), { tone: "deep", position: [x, 1.3, 2.52] });
  k.add(block(0.6, 1.6, 0.6), { tone: "light", position: [-1.6, 4.1, -0.8] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}

function tree(): THREE.Mesh {
  const k = new Kit();
  k.add(cylinder(0.14, 0.26, 3.2, 8), { tone: "dark", position: [0, 1.6, 0] });
  const blobs: Array<[number, number, number, number]> = [
    [0, 4.2, 0, 1.6],
    [0.9, 3.7, 0.3, 1.1],
    [-0.8, 3.8, -0.2, 1.2],
    [0.2, 5.1, -0.3, 1.0],
    [-0.3, 3.6, 0.9, 0.9],
  ];
  for (const [x, y, z, r] of blobs) k.add(jitter(sphere(r, 12, 9), r * 0.12, x + y), { tone: "light", position: [x, y, z] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}

function person(): THREE.Mesh {
  const k = new Kit();
  k.add(capsule(0.16, 0.5), { tone: "dark", position: [-0.11, 0.42, 0] });
  k.add(capsule(0.16, 0.5), { tone: "dark", position: [0.11, 0.42, 0] });
  k.add(capsule(0.24, 0.45), { tone: "light", position: [0, 1.22, 0] });
  k.add(capsule(0.07, 0.5), { tone: "light", position: [-0.33, 1.2, 0], rotation: [0, 0, 0.12] });
  k.add(capsule(0.07, 0.5), { tone: "light", position: [0.33, 1.2, 0], rotation: [0, 0, -0.12] });
  k.add(sphere(0.13, 12, 10), { tone: "pale", position: [0, 1.72, 0] });
  k.add(cylinder(0.13, 0.14, 0.08, 12), { tone: "solid", position: [0, 1.82, 0] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: 0.03 }));
}

function cow(): THREE.Mesh {
  const k = new Kit();
  const body = sphere(0.7, 14, 10);
  body.scale(1.35, 0.8, 0.75);
  k.add(body, { tone: "paper", position: [0, 1.1, 0] });
  k.add(sphere(0.32, 10, 8), { tone: "solid", position: [0.35, 1.3, 0.2] });
  k.add(sphere(0.28, 10, 8), { tone: "solid", position: [-0.4, 1.0, -0.25] });
  const head = sphere(0.3, 12, 9);
  head.scale(1.3, 0.9, 0.85);
  k.add(head, { tone: "paper", position: [1.15, 1.35, 0] });
  for (const [x, z] of [
    [0.6, 0.3],
    [0.6, -0.3],
    [-0.6, 0.3],
    [-0.6, -0.3],
  ]) k.add(cylinder(0.08, 0.07, 0.8, 6), { tone: "light", position: [x, 0.4, z] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: 0.05 }));
}

export const scenes: LabScene[] = [
  {
    name: "foundation",
    description: "Calibration sheet for the ink pipeline.",
    build(ctx) {
      ctx.standardStage();
      const h = house();
      h.position.set(-9, 0, -4);
      h.rotation.y = 0.5;
      ctx.scene.add(h);
      const t = tree();
      t.position.set(-2, 0, -6);
      ctx.scene.add(t);
      const t2 = tree();
      t2.position.set(8, 0, -14);
      t2.scale.setScalar(1.3);
      ctx.scene.add(t2);
      const p = person();
      p.position.set(1.5, 0, 1);
      ctx.scene.add(p);
      const p2 = person();
      p2.position.set(2.4, 0, 0.4);
      p2.rotation.y = -0.6;
      ctx.scene.add(p2);
      const c = cow();
      c.position.set(5, 0, -2);
      c.rotation.y = -0.4;
      ctx.scene.add(c);
      const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 120, 16), inkMaterial({ tone: "pale", hatchSpace: "object", hatch: 0.06 }));
      knot.position.set(-4, 1.6, 3);
      ctx.scene.add(knot);
      ctx.onFrame((dt) => (knot.rotation.y += dt * 0.4));
      // rails
      for (const x of [-0.72, 0.72]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 200), inkMaterial({ tone: "mid" }));
        r.position.set(x + 11, 0.3, -60);
        ctx.scene.add(r);
      }
      for (let i = 0; i < 120; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.24), inkMaterial({ tone: "light" }));
        s.position.set(11, 0.14, 30 - i * 0.7);
        ctx.scene.add(s);
      }
      ctx.view([14, 3.2, 12], [2, 1.2, -6], 50);
      ctx.caption("foundation — ink pipeline calibration");
    },
  },
];

import { inSituStage } from "./stage-kit.ts";
scenes.push({
  name: "foundation-insitu",
  description: "Foundation assets seen from the cab eye point.",
  build(ctx) {
    inSituStage(ctx);
    const spots: Array<[() => THREE.Mesh, number, number, number]> = [
      [house, -18, -60, 0.4],
      [house, 26, -120, -0.3],
      [tree, -9, -28, 0],
      [tree, 11, -45, 0],
      [tree, -30, -95, 0],
      [person, -1.6, -22, 0.2],
      [person, 2.2, -30, -0.5],
      [cow, -14, -40, 0.8],
      [cow, 16, -70, -0.6],
    ];
    for (const [make, x, z, r] of spots) {
      const m = make();
      m.position.set(x, 0, z);
      m.rotation.y = r;
      ctx.scene.add(m);
    }
  },
});

import { createInkCanvas } from "../core/ink-material.ts";
scenes.push({
  name: "foundation-sign",
  build(ctx) {
    inSituStage(ctx);
    const { ctx: g, texture } = createInkCanvas(512, 256);
    g.fillStyle = "#fff"; g.fillRect(0, 0, 512, 256);
    g.lineWidth = 10; g.strokeStyle = "#000"; g.strokeRect(8, 8, 496, 240);
    g.fillStyle = "#000"; g.font = "bold 78px sans-serif"; g.textAlign = "center";
    g.fillText("MERIDIAN", 256, 115);
    g.fillStyle = "#e00"; g.font = "bold 56px sans-serif"; g.fillText("CLINIC", 256, 195);
    texture.needsUpdate = true;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), inkMaterial({ map: texture, flat: true }));
    sign.position.set(-3.2, 2.2, -14);
    ctx.scene.add(sign);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7), inkMaterial({ tone: "dark" }));
    post.position.set(-3.2, 0.85, -14.05);
    ctx.scene.add(post);
  },
});
