/**
 * The console: desk, instrument panel and visor as one pressed-steel section,
 * with its fittings (fascia plates, toggles, jewel lamps, the train radio,
 * the brake valve, a cup holder and the clipboard with the route card).
 */
import * as THREE from "three";
import { Kit, cylinder, lathe, sphere } from "../core/geometry.ts";
import type { AccentName } from "../core/palette.ts";
import type { LabelAtlas } from "./labels.ts";
import { CONSOLE_PROFILE, DESK_TILT, WALL_X, deskMatrix, deskY, panelMatrix } from "./layout.ts";
import { IDS, atlasPlane, cabMaterial, cabMesh, cylinderBetween, mat4, roundedBox, roundedRectPts, slab, v3 } from "./util.ts";

export interface Lamp {
  mesh: THREE.Mesh;
  accent: AccentName;
  on: boolean;
  blink: number; // Hz, 0 = steady
  phase: number;
}

export interface ConsoleParts {
  group: THREE.Group;
  lamps: Record<"brake" | "line" | "link", Lamp>;
  /** Top of the brake-valve knob (cab-local) where the left palm rests. */
  brakeKnob: THREE.Vector3;
  /** Hook on the radio where the handset hangs (cab-local). */
  radioHook: THREE.Vector3;
  /** Jack on the radio's side where the coiled cord enters. */
  radioJack: THREE.Vector3;
  /** Cup holder ring centre (cab-local) and its desk frame. */
  cupHolder: THREE.Matrix4;
}

const LAMP_SPECS: Array<{ id: "brake" | "line" | "link"; accent: AccentName; x: number }> = [
  { id: "brake", accent: "signal", x: -0.53 },
  { id: "line", accent: "amber", x: -0.465 },
  { id: "link", accent: "cobalt", x: -0.4 },
];

function toggle(k: Kit, m: THREE.Matrix4, x: number, y: number, up: boolean): void {
  k.add(cylinder(0.0085, 0.0085, 0.0035, 6), { tone: "light", position: [x, y, 0.002], rotation: [Math.PI / 2, 0, 0], matrix: m });
  k.add(cylinder(0.0048, 0.0048, 0.009, 12), { tone: "paper", position: [x, y, 0.0075], rotation: [Math.PI / 2, 0, 0], matrix: m });
  const a = v3(x, y, 0.011).applyMatrix4(m);
  const tip = v3(x, y + (up ? 0.011 : -0.011), 0.03).applyMatrix4(m);
  k.add(cylinderBetween(a, tip, 0.0022, 0.0032, 10), { tone: "paper" });
  k.add(sphere(0.0038, 10, 8), { tone: "paper", position: [tip.x, tip.y, tip.z] });
}

export function buildConsole(atlas: LabelAtlas, labels: THREE.BufferGeometry[]): ConsoleParts {
  const group = new THREE.Group();
  group.name = "cab-console";

  // ----------------------------------------------------------- the body
  const body = new Kit();
  body.add(
    (() => {
      const shape = new THREE.Shape(CONSOLE_PROFILE.map(([z, y]) => new THREE.Vector2(-z, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: WALL_X * 2, bevelEnabled: false });
      g.rotateY(Math.PI / 2);
      g.translate(-WALL_X, 0, 0);
      return g;
    })(),
    { tone: "paper" },
  );
  // Visor lip: a rolled edge (reads as a heavy line casting a hatched shadow).
  body.add(cylinder(0.011, 0.011, WALL_X * 2, 12), { tone: "pale", position: [0, 1.073, -0.93], rotation: [0, 0, Math.PI / 2] });
  // Desk front roll (armrest edge).
  body.add(cylinder(0.024, 0.024, WALL_X * 2, 14), { tone: "light", position: [0, 0.878, -0.528], rotation: [0, 0, Math.PI / 2] });
  // Panel joints on the desk: raised seams with screw heads.
  for (const x of [-0.46, 0.62]) {
    const a = v3(x, deskY(-0.56) + 0.001, -0.56);
    const b = v3(x, deskY(-0.88) + 0.001, -0.88);
    body.add(cylinderBetween(a, b, 0.0022, 0.0022, 6), { tone: "light" });
    for (let i = 0; i < 4; i++) {
      const z = -0.59 - i * 0.09;
      body.add(cylinder(0.0045, 0.0045, 0.003, 10), { tone: "light", position: [x + 0.012, deskY(z) + 0.0015, z], rotation: [DESK_TILT, 0, 0] });
    }
  }
  // Seam where the desk meets the panel, and one along the visor top.
  body.add(cylinder(0.0025, 0.0025, WALL_X * 2, 6), { tone: "light", position: [0, 0.956, -0.884], rotation: [0, 0, Math.PI / 2] });
  group.add(cabMesh(body.build(), cabMaterial(IDS.console), "cab-console-body"));

  // ------------------------------------------------------------ fittings
  const k = new Kit();
  // Fascia plates on the instrument panel.
  const fasciaL = panelMatrix(-0.25, 0.47, 0.001);
  k.add(slab(roundedRectPts(0.8, 0.128, 0.012, 4), 0.005), { tone: "paper", matrix: fasciaL });
  for (const [x, y] of [
    [-0.385, 0.052],
    [0.385, 0.052],
    [-0.385, -0.052],
    [0.385, -0.052],
  ] as Array<[number, number]>) {
    k.add(cylinder(0.0042, 0.0042, 0.003, 10), { tone: "light", position: [x, y, 0.0065], rotation: [Math.PI / 2, 0, 0], matrix: fasciaL });
  }
  const fasciaR = panelMatrix(0.64, 0.47, 0.001);
  k.add(slab(roundedRectPts(0.3, 0.128, 0.012, 4), 0.005), { tone: "paper", matrix: fasciaR });

  // Left toggles (behind the radio's shoulder) and right toggles.
  const toggles: Array<[number, boolean]> = [
    [-0.605, true],
    [-0.56, false],
    [-0.515, true],
    [-0.47, true],
  ];
  for (const [x, up] of toggles) toggle(k, panelMatrix(x, 0.3, 0.006), 0, 0, up);
  labels.push(atlasPlane(0.18, 0.02, atlas.rect("switchesL"), panelMatrix(-0.5375, 0.1, 0.0065)));
  const rToggles: Array<[number, boolean]> = [
    [0.545, false],
    [0.605, true],
    [0.665, true],
    [0.725, false],
  ];
  for (const [x, up] of rToggles) toggle(k, panelMatrix(x, 0.58, 0.006), 0, 0, up);
  labels.push(atlasPlane(0.24, 0.027, atlas.rect("switchesR"), panelMatrix(0.635, 0.3, 0.0065)));

  // Jewel lamp bezels (domes are separate so they can light).
  const lampMatOff = cabMaterial(IDS.lamps, { vertexInk: false, tone: "pale" });
  const lamps = {} as ConsoleParts["lamps"];
  for (const spec of LAMP_SPECS) {
    const m = panelMatrix(spec.x, 0.72, 0.006);
    const bez = lathe(
      [
        [0.0125, 0],
        [0.0125, 0.004],
        [0.0105, 0.0075],
        [0.0085, 0.0075],
      ],
      20,
    );
    bez.rotateX(Math.PI / 2);
    k.add(bez, { tone: "light", matrix: m });
    const dome = new THREE.SphereGeometry(0.0082, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.rotateX(Math.PI / 2);
    const mesh = cabMesh(dome, lampMatOff, `cab-lamp-${spec.id}`);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(m).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0055));
    group.add(mesh);
    lamps[spec.id] = { mesh, accent: spec.accent, on: false, blink: 0, phase: 0 };
  }
  labels.push(atlasPlane(0.19, 0.03, atlas.rect("lampsL"), panelMatrix(-0.465, 0.46, 0.0065)));
  // A note from home taped to the fascia between the speedometer and the terminal.
  labels.push(atlasPlane(0.05, 0.05, atlas.rect("note"), panelMatrix(0.014, 0.5, 0.007).multiply(mat4([0, 0, 0], [0, 0, 0.09]))));

  // ------------------------------------------------------------- radio
  const radioM = deskMatrix(-0.655, -0.84, 0.46, 0.0).multiply(new THREE.Matrix4().makeScale(0.8, 0.8, 0.8));
  {
    const shape: Array<[number, number]> = [
      [0.095, 0],
      [0.095, 0.058],
      [0.062, 0.116],
      [-0.1, 0.116],
      [-0.1, 0],
    ];
    // Section in (z, y), extruded across the radio's width.
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(shape.map(([z, y]) => new THREE.Vector2(-z, y))), {
      depth: 0.25,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelOffset: -0.006,
      bevelSegments: 2,
    });
    g.rotateY(Math.PI / 2);
    g.translate(-0.125, 0, 0);
    k.add(g, { tone: "pale", matrix: radioM });
    // Speaker louvres across the lower face.
    for (let i = 0; i < 6; i++) {
      k.add(roundedBox(0.105, 0.004, 0.008, 0.0015), { tone: "mid", position: [-0.058, 0.01 + i * 0.0085, 0.098], rotation: [-0.4, 0, 0], matrix: radioM });
    }
    // Sloped upper face frame: two knobs and the channel window.
    const faceM = radioM.clone().multiply(mat4([0, 0.087, 0.0785], [-Math.atan2(0.033, 0.058), 0, 0]));
    labels.push(atlasPlane(0.14, 0.061, atlas.rect("radio"), faceM.clone().multiply(mat4([0.036, 0.0, 0.0012]))));
    for (const [x, r] of [
      [-0.085, 0.014],
      [-0.045, 0.01],
    ] as Array<[number, number]>) {
      k.add(cylinder(r, r * 1.08, 0.014, 18), { tone: "dark", position: [x, 0.0, 0.007], rotation: [Math.PI / 2, 0, 0], matrix: faceM });
      k.add(roundedBox(0.003, r * 1.6, 0.003, 0.001), { tone: "paper", position: [x, 0.0, 0.0145], matrix: faceM });
    }
    // Mounting bracket feet.
    for (const x of [-0.11, 0.11]) k.add(roundedBox(0.02, 0.012, 0.21, 0.003), { tone: "mid", position: [x, 0.004, 0], matrix: radioM });
  }
  const radioHook = v3(0.14, 0.085, 0.045).applyMatrix4(radioM);
  const radioJack = v3(0.128, 0.03, -0.02).applyMatrix4(radioM);
  {
    // Handset hook: a bent rod on the radio's right cheek.
    const a = v3(0.125, 0.085, 0.045).applyMatrix4(radioM);
    const b = v3(0.15, 0.085, 0.045).applyMatrix4(radioM);
    const c = v3(0.152, 0.1, 0.045).applyMatrix4(radioM);
    k.add(cylinderBetween(a, b, 0.0035, 0.0035, 8), { tone: "paper" });
    k.add(cylinderBetween(b, c, 0.0035, 0.0035, 8), { tone: "paper" });
    k.add(cylinder(0.0065, 0.0065, 0.008, 12), { tone: "dark", position: [0.128, 0.03, -0.02], rotation: [0, 0, Math.PI / 2], matrix: radioM });
  }

  // -------------------------------------------------------- brake valve
  const bvM = deskMatrix(-0.325, -0.7, 0, 0);
  {
    k.add(cylinder(0.06, 0.064, 0.012, 28), { tone: "light", position: [0, 0.006, 0], matrix: bvM });
    k.add(cylinder(0.049, 0.052, 0.048, 28), { tone: "pale", position: [0, 0.036, 0], matrix: bvM });
    // Ribbed body.
    for (let i = 0; i < 3; i++) k.add(new THREE.TorusGeometry(0.051, 0.0022, 6, 28), { tone: "light", position: [0, 0.02 + i * 0.012, 0], rotation: [Math.PI / 2, 0, 0], matrix: bvM });
    k.add(
      lathe(
        [
          [0.055, 0.06],
          [0.055, 0.066],
          [0.045, 0.072],
          [0.026, 0.076],
          [0.018, 0.084],
        ],
        28,
      ),
      { tone: "paper", matrix: bvM },
    );
    // Notched position ring around the cap.
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      k.add(roundedBox(0.006, 0.006, 0.012, 0.001), { tone: "dark", position: [Math.sin(a) * 0.052, 0.07, Math.cos(a) * 0.052], rotation: [0, a, 0], matrix: bvM });
    }
    labels.push(atlasPlane(0.1, 0.025, atlas.rect("brake"), bvM.clone().multiply(mat4([0, 0.0005, 0.085], [-Math.PI / 2, 0, 0]))));
  }
  // Handle arm (at RUN) to the knob.
  const handleYaw = 0.55;
  const hub = v3(0, 0.086, 0).applyMatrix4(bvM);
  const knobBase = v3(Math.sin(handleYaw) * 0.12, 0.094, Math.cos(handleYaw) * 0.12).applyMatrix4(bvM);
  k.add(cylinder(0.02, 0.02, 0.014, 18), { tone: "light", position: [0, 0.088, 0], matrix: bvM });
  k.add(cylinderBetween(hub, knobBase, 0.0075, 0.0068, 10), { tone: "paper" });
  {
    const kb = new THREE.Matrix4().makeRotationX(DESK_TILT).setPosition(knobBase);
    k.add(
      lathe(
        [
          [0.0, 0.0],
          [0.012, 0.001],
          [0.014, 0.012],
          [0.017, 0.026],
          [0.016, 0.034],
          [0.0, 0.036],
        ],
        20,
      ),
      { tone: "deep", matrix: kb },
    );
  }
  const brakeKnob = v3(0, 0.036, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(DESK_TILT).setPosition(knobBase));

  // ---------------------------------------------------------- cup holder
  const cupM = deskMatrix(-0.14, -0.655, 0, 0);
  {
    k.add(cylinder(0.034, 0.036, 0.006, 24), { tone: "mid", position: [0, 0.003, 0], matrix: cupM });
    k.add(new THREE.TorusGeometry(0.041, 0.0038, 8, 32), { tone: "paper", position: [0, 0.058, 0], rotation: [Math.PI / 2, 0, 0], matrix: cupM });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const p0 = v3(Math.cos(a) * 0.03, 0.004, Math.sin(a) * 0.03).applyMatrix4(cupM);
      const p1 = v3(Math.cos(a) * 0.041, 0.058, Math.sin(a) * 0.041).applyMatrix4(cupM);
      k.add(cylinderBetween(p0, p1, 0.0028, 0.0028, 6), { tone: "paper" });
    }
  }

  // --------------------------------------------------------- clipboard
  {
    const cbM = deskMatrix(0.012, -0.745, 0.08, 0.002);
    const ck = new Kit();
    ck.add(roundedBox(0.165, 0.005, 0.235, 0.002), { tone: "light", position: [0, 0.0025, 0], matrix: cbM });
    // Clip: pressed-steel jaw and spring roll at the far end.
    ck.add(roundedBox(0.09, 0.008, 0.03, 0.003), { tone: "paper", position: [0, 0.011, -0.098], rotation: [0.12, 0, 0], matrix: cbM });
    ck.add(cylinder(0.006, 0.006, 0.07, 12), { tone: "paper", position: [0, 0.009, -0.113], rotation: [0, 0, Math.PI / 2], matrix: cbM });
    ck.add(roundedBox(0.04, 0.004, 0.012, 0.0015), { tone: "mid", position: [0, 0.017, -0.12], matrix: cbM });
    // A pencil left across the route card: hex body, sharpened cone, ferrule, eraser.
    {
      const pm = cbM.clone().multiply(mat4([0.018, 0.0105, 0.035], [0, 0.62, Math.PI / 2]));
      ck.add(cylinder(0.0037, 0.0037, 0.15, 6), { tone: "paper", matrix: pm });
      ck.add(cylinder(0.0, 0.0037, 0.018, 6), { tone: "pale", position: [0, -0.084, 0], rotation: [Math.PI, 0, 0], matrix: pm });
      ck.add(cylinder(0.0011, 0.0011, 0.006, 6), { tone: "solid", position: [0, -0.092, 0], matrix: pm });
      ck.add(cylinder(0.0039, 0.0039, 0.012, 10), { tone: "light", position: [0, 0.081, 0], matrix: pm });
      ck.add(cylinder(0.0036, 0.0036, 0.008, 10), { tone: "mid", position: [0, 0.091, 0], matrix: pm });
    }
    group.add(cabMesh(ck.build(), cabMaterial(IDS.clipboard), "cab-clipboard"));
    // Route card (under the clip) and two loose sheets offset beneath it.
    labels.push(atlasPlane(0.148, 0.202, atlas.rect("routeCard"), cbM.clone().multiply(mat4([0.001, 0.0056, 0.008], [-Math.PI / 2, 0, 0.012]))));
  }

  group.add(cabMesh(k.build(), cabMaterial(IDS.fittings), "cab-console-fittings"));

  return { group, lamps, brakeKnob, radioHook, radioJack, cupHolder: cupM };
}
