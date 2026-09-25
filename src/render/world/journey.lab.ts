import * as THREE from "three";
import { inkMaterial } from "../core/ink-material.ts";
import { Kit, block, cylinder, sphere, jitter } from "../core/geometry.ts";
import { createRng } from "../core/rng.ts";
import type { LabScene } from "../lab/types.ts";
import { Journey, type Stake } from "./journey.ts";
import { TrackRenderer, RAIL_TOP } from "./track/mesh.ts";

function marker(tone: number): THREE.Mesh {
  const k = new Kit();
  k.add(block(0.5, 1.2, 0.3), { tone, position: [0, 0.2, 0] });
  k.add(sphere(0.16, 10, 8), { tone: "pale", position: [0, 1.6, 0] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: 0.03 }));
}

function tree(seed: number): THREE.Mesh {
  const k = new Kit();
  k.add(cylinder(0.15, 0.3, 3.4, 7), { tone: "mid", position: [0, 1.7, 0] });
  k.add(jitter(sphere(1.8, 12, 9), 0.3, seed), { tone: "pale", position: [0, 4.6, 0] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}

export const scenes: LabScene[] = [
  {
    name: "journey",
    description: "Track network, fork draw-on, approach, commit and passage with placeholder stakes.",
    build(ctx) {
      const sun = ctx.standardStage({ ground: false, sun: [40, 60, 30] });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), inkMaterial({ tone: 0.03, hatch: 0.3, edge: 0.3 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      ctx.scene.add(ground);
      sun.shadow.camera.left = -80;
      sun.shadow.camera.right = 80;
      sun.shadow.camera.top = 80;
      sun.shadow.camera.bottom = -80;
      const journey = new Journey("lab-seed");
      const track = new TrackRenderer();
      ctx.scene.add(track.group);
      const rng = createRng("scatter");
      // Placeholder scenery: trees that avoid the tracks.
      const trees = new THREE.Group();
      ctx.scene.add(trees);
      const stakeObjects = new THREE.Group();
      ctx.scene.add(stakeObjects);
      const script = (ctx.params.script as Array<[number, string, string?]>) ?? [
        [1.5, "prepare", "d1"],
        [9, "commit", "left"],
        [16, "prepare", "d2"],
        [24, "commit", "right"],
        [31, "prepare", "d3"],
        [38, "commit", "left"],
      ];
      let cursor = 0;
      const placeStakes = (key: string) => {
        stakeObjects.clear();
        const stakes: Stake[] = [
          ...[0, 1, 2, 3, 4].map((i): Stake => ({ side: "left", s: 20 + i * 0.1, struck: true })),
          { side: "right", s: 22, struck: true },
        ];
        const j = journey.prepare(key, stakes);
        stakes.forEach((stake, i) => {
          const line = stake.side === "left" ? j.left : j.right;
          const lateral = stake.side === "left" ? (i - 2) * 0.45 : 0;
          line.extendTo(stake.s + 2);
          const p = line.offset(stake.s, lateral);
          const m = marker(stake.side === "left" ? 0.62 : 0.26);
          m.position.set(p.x, RAIL_TOP - 0.2, p.z);
          m.rotation.y = -p.heading + Math.PI;
          stakeObjects.add(m);
        });
      };
      let treeTimer = 0;
      ctx.onFrame((dt, t) => {
        while (cursor < script.length && t >= script[cursor]![0]) {
          const [, action, arg] = script[cursor]!;
          if (action === "prepare") placeStakes(arg ?? `d${cursor}`);
          if (action === "commit") void journey.commit((arg as "left" | "right") ?? "left", null);
          cursor++;
        }
        journey.tick(dt);
        for (const line of journey.network.lines) {
          line.extendTo(line.drawTo + 2);
          journey.network.index(line);
        }
        track.update(journey.network, journey.rig.pose.x, journey.rig.pose.z);
        // Sprinkle trees ahead occasionally.
        treeTimer -= dt;
        if (treeTimer <= 0) {
          treeTimer = 0.35;
          const p = journey.rig.pose;
          for (let n = 0; n < 3; n++) {
            const ahead = rng.range(120, 260);
            const side = rng.chance(0.5) ? -1 : 1;
            const lat = side * rng.range(9, 90);
            const x = p.x + Math.sin(p.heading) * ahead + Math.cos(p.heading) * lat;
            const z = p.z - Math.cos(p.heading) * ahead + Math.sin(p.heading) * lat;
            if (journey.network.distanceToTrack(x, z, 12) < 9) continue;
            const tr = tree(n + treeTimer);
            tr.position.set(x, 0, z);
            trees.add(tr);
          }
          for (const c of [...trees.children]) if (c.position.distanceTo(new THREE.Vector3(p.x, 0, p.z)) > 400) trees.remove(c);
        }
        // Cab eye follows the rig.
        const p = journey.rig.pose;
        const eye = new THREE.Vector3(p.x, RAIL_TOP + 1.1 + 1.3, p.z);
        ctx.camera.position.copy(eye);
        const look = new THREE.Vector3(p.x + Math.sin(p.heading) * 50, eye.y - 2.6, p.z - Math.cos(p.heading) * 50);
        ctx.camera.lookAt(look);
        ctx.camera.fov = 52;
        ctx.camera.updateProjectionMatrix();
        ground.position.set(p.x, 0, p.z);
        sun.position.set(p.x + 40, 60, p.z + 30);
        sun.target.position.set(p.x, 0, p.z);
        sun.target.updateMatrixWorld();
      });
      ctx.caption(`journey — phase shows fork approach, commit, passage`);
    },
  },
];
