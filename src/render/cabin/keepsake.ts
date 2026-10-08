/**
 * What rides in the cup holder: the depot coffee (paper cup, lid, sleeve)
 * that was saved early on, or a roll of forms that replaced it.
 */
import * as THREE from "three";
import { Kit, cylinder, lathe } from "../core/geometry.ts";
import { IDS, cabMaterial, cabMesh, roundedBox } from "./util.ts";

export type KeepsakeKind = "coffee" | "forms" | null;

export interface KeepsakeParts {
  group: THREE.Group;
  set(kind: KeepsakeKind): void;
}

function coffee(): THREE.BufferGeometry {
  const k = new Kit();
  // Paper cup, 12 oz: 90 mm rim, 60 mm base, 110 mm tall.
  k.add(
    lathe(
      [
        [0.0, 0.0],
        [0.029, 0.0],
        [0.03, 0.004],
        [0.044, 0.104],
        [0.0455, 0.107],
      ],
      28,
    ),
    { tone: "paper" },
  );
  // Card sleeve (mid) with a printed band.
  k.add(
    lathe(
      [
        [0.0348, 0.028],
        [0.0345, 0.03],
        [0.041, 0.078],
        [0.0413, 0.08],
      ],
      28,
    ),
    { tone: "mid" },
  );
  // Lid: rim bead, raised dome, sip hole slot.
  k.add(
    lathe(
      [
        [0.0455, 0.104],
        [0.0475, 0.108],
        [0.0465, 0.113],
        [0.037, 0.118],
        [0.03, 0.122],
        [0.0, 0.122],
      ],
      28,
    ),
    { tone: "deep" },
  );
  k.add(roundedBox(0.016, 0.004, 0.006, 0.0015), { tone: "paper", position: [0, 0.1225, 0.028] });
  return k.build();
}

function forms(): THREE.BufferGeometry {
  const k = new Kit();
  // A rolled sheaf of forms, standing in the holder, one sheet peeling loose.
  const roll = lathe(
    [
      [0.03, 0.0],
      [0.031, 0.002],
      [0.031, 0.19],
      [0.029, 0.192],
    ],
    24,
  );
  k.add(roll, { tone: "paper" });
  // Inner turn visible at the top.
  k.add(cylinder(0.022, 0.022, 0.19, 18, true), { tone: "pale", position: [0, 0.096, 0] });
  // Rubber band.
  k.add(new THREE.TorusGeometry(0.0318, 0.0025, 6, 24), { tone: "dark", position: [0, 0.11, 0], rotation: [Math.PI / 2, 0, 0] });
  // Loose sheet corner.
  const sheet = new THREE.PlaneGeometry(0.05, 0.12, 1, 6);
  const p = sheet.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setZ(i, 0.012 * ((y + 0.06) / 0.12) ** 2);
  }
  sheet.computeVertexNormals();
  k.add(sheet, { tone: "paper", position: [0.022, 0.13, 0.024], rotation: [0.1, 0.8, 0.12] });
  return k.build();
}

export function buildKeepsake(holder: THREE.Matrix4): KeepsakeParts {
  const group = new THREE.Group();
  group.name = "cab-keepsake";
  group.matrixAutoUpdate = false;
  group.matrix.copy(holder);
  const mat = cabMaterial(IDS.keepsake, { shade: 0.38 });
  const matDouble = cabMaterial(IDS.keepsake, { side: THREE.DoubleSide, shade: 0.38 });
  const cup = cabMesh(coffee(), mat, "cab-keepsake-coffee");
  cup.position.y = 0.006;
  cup.scale.setScalar(0.86);
  cup.rotation.y = 0.6;
  const sheaf = cabMesh(forms(), matDouble, "cab-keepsake-forms");
  sheaf.position.y = 0.006;
  // Shorter than the sheet it was: it should not stand in front of the gauges.
  sheaf.scale.set(0.92, 0.58, 0.92);
  sheaf.rotation.set(0.05, -0.3, -0.06);
  group.add(cup, sheaf);
  const api: KeepsakeParts = {
    group,
    set(kind) {
      cup.visible = kind === "coffee";
      sheaf.visible = kind === "forms";
    },
  };
  api.set("coffee");
  return api;
}
