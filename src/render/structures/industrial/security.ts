/**
 * Control and surveillance: the road checkpoint, the tiling security-fence
 * segment, and the antenna/radar array.
 */
import * as THREE from "three";
import { Kit, block, extrude, lathe, sphere } from "../../core/geometry.ts";
import type { Rng } from "../../core/rng.ts";
import { Build, actorMaterial, fence, latticeMast, razorCoil, rectPath, rubble, signMesh, signTexture, type Vec3 } from "./common.ts";
import { createPlume } from "./effects.ts";

// =================================================================== security fence

/** Tiling pitch of the security-fence segment along X (metres). */
export const SECURITY_FENCE_SEGMENT = 12;

/**
 * One 12 m bay run of high-security fence along X, facing +Z. Posts sit at
 * x = -6, -3, 0, 3; the next segment supplies the post at +6, so segments
 * placed at a 12 m pitch tile seamlessly.
 */
export function buildSecurityFence(b: Build): THREE.Group {
  const L = SECURITY_FENCE_SEGMENT;
  const H = 3.6;
  const r = b.rng;
  if (b.pristine) {
    // Anti-climb wall: seamless, featureless white, nothing to hold.
    b.box(L, 4.8, 0.4, 0, 0, 0, "paper");
    b.box(L, 0.14, 0.62, 0, 4.8, 0, "paper");
    const g = b.finish({ width: L, depth: 1, height: 5 }, "security-fence");
    g.userData.segmentLength = L;
    return g;
  }
  b.box(L, 0.35, 0.4, 0, 0, 0, "pale");
  for (let i = 0; i < 4; i++) {
    const x = -L / 2 + i * 3;
    const lean = b.ruin && r.chance(0.4) ? r.range(-0.35, 0.35) : 0;
    const top: Vec3 = [x + lean * 0.4, H, lean * H];
    b.beam([x, 0, 0], top, 0.11, "mid");
    // Y-shaped outrigger carrying the coil.
    b.beam(top, [top[0], H + 0.6, top[2] + 0.5], 0.06, "mid");
    b.beam(top, [top[0], H + 0.6, top[2] - 0.5], 0.06, "mid");
  }
  for (let i = 0; i < 4; i++) {
    const x0 = -L / 2 + i * 3;
    const torn = b.ruin && r.chance(0.45);
    if (!torn) b.fabric.add(block(3, H - 0.3, 0.02), { tone: 0.2, position: [x0 + 1.5, 0.3, 0] });
    else b.fabric.add(new THREE.BoxGeometry(3, H * 0.5, 0.02), { tone: 0.2, position: [x0 + 1.5, H * 0.25, 0.7], rotation: [-0.8, 0, 0] });
  }
  b.line([-L / 2, H - 0.05, 0], [L / 2, H - 0.05, 0]);
  b.line([-L / 2, 0.36, 0], [L / 2, 0.36, 0], true);
  b.line([-L / 2, H / 2, 0.02], [L / 2, H / 2, 0.02], true);
  for (const z of [0.5, -0.5]) b.line([-L / 2, H + 0.6, z], [L / 2, H + 0.6, z], true);
  if (!b.ruin || r.chance(0.5)) razorCoil(b, [-L / 2, H + 0.45, 0], [L / 2, H + 0.45, 0], 0.42, 0.28);
  // Ground concertina in front on alternate segments.
  if (r.chance(0.5)) razorCoil(b, [-L / 2, 0.45, 1.6], [L / 2, 0.45, 1.6], 0.45, 0.35, true);
  // Warning plate.
  if (r.chance(0.5)) {
    b.box(0.7, 0.5, 0.03, r.range(-4, 3), 1.7, 0.04, "paper", { accent: "signal", accentAmount: 0.85 });
  }
  const g = b.finish({ width: L, depth: 4, height: H + 0.9 }, "security-fence");
  g.userData.segmentLength = L;
  return g;
}

// =================================================================== checkpoint

function checkpointSign(): THREE.Texture | null {
  return signTexture("checkpoint-fascia", 1024, 128, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, 10);
    g.fillRect(0, h - 10, w, 10);
    g.font = "bold 72px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("CONTROL  POINT  7", w * 0.42, h / 2 + 4);
    g.fillStyle = "#e00";
    g.fillRect(w * 0.8, 22, w * 0.18, h - 44);
    g.fillStyle = "#fff";
    g.font = "bold 58px sans-serif";
    g.fillText("HALT", w * 0.89, h / 2 + 3);
  });
}

function stopSign(): THREE.Texture | null {
  return signTexture("checkpoint-stop", 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0)";
    g.fillRect(0, 0, w, h);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      g.lineTo(w / 2 + Math.cos(a) * w * 0.48, h / 2 + Math.sin(a) * h * 0.48);
    }
    g.closePath();
    g.fillStyle = "#000";
    g.fill();
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      g.lineTo(w / 2 + Math.cos(a) * w * 0.43, h / 2 + Math.sin(a) * h * 0.43);
    }
    g.closePath();
    g.fillStyle = "#e00";
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 66px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("STOP", w / 2, h / 2 + 3);
  });
}

function jersey(b: Build, x: number, z: number, ry: number, tone: "paper" | "pale" | "light" = "pale"): void {
  const prof = extrude(
    [
      [-0.3, 0],
      [0.3, 0],
      [0.14, 0.3],
      [0.1, 0.82],
      [-0.1, 0.82],
      [-0.14, 0.3],
    ],
    3.8,
  );
  b.add(prof, { tone, position: [x, 0, z], rotation: [0, ry, 0] });
}

function sandbags(b: Build, cx: number, cz: number, len: number, rows: number, ry: number): void {
  const n = Math.round(len / 0.62);
  const c = Math.cos(ry),
    s = Math.sin(ry);
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < n - (row % 2); i++) {
      const lx = -len / 2 + (i + 0.5 + (row % 2) * 0.5) * (len / n);
      const g = new THREE.CapsuleGeometry(0.16, 0.34, 2, 6);
      g.rotateZ(Math.PI / 2);
      g.scale(1, 0.72, 1.35);
      b.add(g, { tone: row % 2 ? "light" : "pale", position: [cx + lx * c, 0.13 + row * 0.22, cz - lx * s], rotation: [0, ry + b.rng.range(-0.08, 0.08), 0] });
    }
  }
}

export function buildCheckpoint(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const ruin = b.ruin,
    pristine = b.pristine;
  // Concrete apron with lane lines and a spike strip.
  b.box(18, 0.08, 76, 0, 0, 0, "pale");
  for (const x of [-2.6, 2.6]) for (let z = -36; z < 36; z += 4) if (Math.abs(z) > 8) b.line([x, 0.1, z], [x, 0.1, z + 2.2], true);
  b.box(16, 0.1, 0.7, 0, 0, 11, "dark");
  for (let i = 0; i < 26; i++) b.line([-8 + i * 0.62, 0.11, 10.8], [-8 + i * 0.62, 0.35, 11], true);
  b.box(16, 0.16, 1.8, 0, 0, 18, "light");
  // Islands between lanes, booths on the islands.
  for (const x of [-2.6, 2.6]) {
    b.box(1.8, 0.22, 16, x, 0, 1, "light");
    for (const z of [-7, 9]) b.cyl(0.4, 1.1, x, 0.22, z, "paper", 8);
    b.cyl(0.41, 0.2, x, 0.9, 9, "paper", 8, 0.41, { accent: "amber", accentAmount: 0.9 });
  }
  const booth = (x: number) => {
    b.box(1.6, 0.9, 3.2, x, 0.22, 1.5, pristine ? "paper" : "light");
    b.box(1.64, 1.3, 3.24, x, 1.12, 1.5, b.glass);
    for (const dz of [-1.2, 0, 1.2]) b.box(1.66, 1.3, 0.08, x, 1.12, 1.5 + dz, "paper");
    b.box(1.6, 0.5, 3.2, x, 2.42, 1.5, pristine ? "paper" : "pale");
    b.box(2.3, 0.18, 3.9, x, 2.92, 1.5, "light");
    if (!ruin) b.lamp(x, 3.3, 1.5, 0.3, "amber", true);
  };
  if (ruin) {
    b.box(1.6, 1.4, 3.2, -2.6, 0.22, 1.5, "dark");
    b.box(2.3, 0.18, 3.9, -2.1, 0.5, 3.4, "dark", { rz: 0.6, rx: 0.3 });
    booth(2.6);
  } else {
    booth(-2.6);
    booth(2.6);
  }
  // Canopy on slender columns, with the lane-control lamps and fascia sign.
  const cy = 6.4;
  const cz = 1;
  if (!ruin) {
    // A deep fascia so the name reads from the line.
    b.box(27, 1.9, 13, 0, cy, cz, "paper");
    b.box(27.4, 0.25, 13.4, 0, cy + 1.9, cz, "pale");
    b.box(26.6, 0.18, 12.6, 0, cy - 0.18, cz, "light");
    b.box(27.05, 0.16, 13.05, 0, cy + 0.08, cz, "solid");
  } else {
    b.box(15, 0.9, 13, -6, cy, cz, "light");
    b.box(13, 0.9, 13, 7, 2.6, cz, "dark", { rz: -0.42, rx: 0.08 });
  }
  for (const x of [-12.5, 0, 12.5])
    for (const z of [cz - 5.5, cz + 5.5]) {
      if (ruin && x > 6) continue;
      b.cyl(0.26, cy, x, 0, z, "light", 10);
      b.cyl(0.45, 0.4, x, 0, z, "mid", 10);
    }
  const fascia = checkpointSign();
  const fm = signMesh(fascia, 12.8, 1.6);
  if (fm && !ruin) {
    fm.position.set(0, cy + 1.02, cz + 6.53);
    b.group.add(fm);
  }
  // Lane signals: red crosses on the closed lanes, amber arrow on the open one.
  for (const [x, open] of [
    [-5.3, false],
    [0, true],
    [5.3, false],
  ] as const) {
    if (ruin) break;
    b.box(1.3, 1.3, 0.3, x, cy - 1.45, cz + 6.2, "solid");
    if (!open || pristine) {
      b.lamps.add(new THREE.BoxGeometry(1.1, 0.16, 0.1), { tone: "paper", accent: "signal", position: [x, cy - 0.8, cz + 6.38], rotation: [0, 0, Math.PI / 4] });
      b.lamps.add(new THREE.BoxGeometry(1.1, 0.16, 0.1), { tone: "paper", accent: "signal", position: [x, cy - 0.8, cz + 6.38], rotation: [0, 0, -Math.PI / 4] });
    } else {
      b.lamps.add(new THREE.BoxGeometry(0.16, 0.8, 0.1), { tone: "paper", accent: "amber", position: [x, cy - 0.85, cz + 6.38] });
      b.lamps.add(new THREE.ConeGeometry(0.32, 0.4, 3), { tone: "paper", accent: "amber", position: [x, cy - 1.25, cz + 6.38], rotation: [Math.PI, 0, 0] });
    }
  }
  // Drop-arm barriers (striped signal red), posts on the islands and verges.
  const arms: Array<{ px: number; dir: number; len: number }> = [
    { px: -7.6, dir: 1, len: 4.6 },
    { px: -2.6, dir: 1, len: 4.8 },
    { px: 2.6, dir: 1, len: 4.6 },
  ];
  const armMeshes: THREE.Object3D[] = [];
  const liftsIdx = !ruin && !pristine ? 1 : -1;
  arms.forEach((a, ai) => {
    const z = -4.5;
    b.box(0.5, 1.1, 0.5, a.px, 0.2, z, pristine ? "paper" : "light");
    const k = new Kit();
    const segs = Math.round(a.len / 0.55);
    for (let i = 0; i < segs; i++) {
      const red = i % 2 === 0;
      k.add(new THREE.BoxGeometry(a.len / segs, 0.12, 0.1), { tone: "paper", accent: red ? "signal" : undefined, accentAmount: red ? 0.9 : 0, position: [((i + 0.5) * a.len) / segs, 0, 0] });
    }
    const arm = new THREE.Mesh(k.build(), actorMaterial(0.04));
    arm.position.set(a.px + 0.25, 1.1, z);
    if (ruin) {
      arm.rotation.z = -0.5;
      arm.rotation.y = 0.4;
      arm.scale.x = 0.55;
    }
    arm.name = "barrier-arm";
    if (ai === liftsIdx) {
      b.group.add(arm);
      armMeshes.push(arm);
    } else {
      arm.updateMatrix();
      b.k.addGeometry(arm.geometry, arm.matrix);
    }
  });
  if (liftsIdx >= 0) {
    // The middle barrier lifts now and then, lets something through, drops.
    const mid = armMeshes[0]!;
    const ph = r.next() * 20;
    b.tick((_dt, t) => {
      const c = ((t + ph) % 24) / 24;
      const up = c < 0.08 ? c / 0.08 : c < 0.28 ? 1 : c < 0.36 ? 1 - (c - 0.28) / 0.08 : 0;
      mid.rotation.z = up * 1.45;
    });
  }
  if (pristine) {
    // Sealed: sliding steel gates replace the arms.
    for (const x of [-5.3, 0, 5.3]) b.box(4.4, 2.6, 0.3, x, 0.2, -6, "paper");
  }
  // Chicane of jersey barriers on the approach.
  for (let i = 0; i < 4; i++) {
    const z = 16 + i * 5.5;
    const side = i % 2 ? 1 : -1;
    for (let j = 0; j < 2; j++) jersey(b, side * (6.2 - j * 3.9), z, Math.PI / 2, ruin && r.chance(0.3) ? "light" : "pale");
  }
  if (ruin) for (let i = 0; i < 3; i++) jersey(b, r.range(-6, 6), r.range(14, 30), r.range(0, 3), "light");
  // STOP sign.
  const stop = signMesh(stopSign(), 1.2, 1.2);
  if (stop && !ruin) {
    stop.position.set(-8.4, 2.4, 14);
    b.group.add(stop);
    b.cyl(0.05, 1.8, -8.4, 0, 13.95, "mid", 6);
  }
  // Camera masts with panning PTZ heads.
  const camPos: Vec3[] = [
    [-8.9, 9.5, 8],
    [8.9, 9.5, 8],
    [-8.9, 9.5, -8],
    [8.9, 9.5, -8],
  ];
  for (const [x, y, z] of camPos) {
    b.cyl(0.14, y, x, 0, z, "mid", 8, 0.1);
    b.box(1.6, 0.12, 0.12, x, y - 0.5, z, "mid");
    b.box(0.3, 0.3, 0.7, x + 0.7, y - 0.8, z + 0.2, "dark", { ry: 0.5 });
  }
  const ck = new Kit();
  ck.add(new THREE.BoxGeometry(0.34, 0.12, 0.34), { tone: "mid", position: [0, 0.06, 0] });
  ck.add(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { tone: "deep", rotation: [Math.PI, 0, 0] });
  ck.add(new THREE.BoxGeometry(0.2, 0.2, 0.46), { tone: "light", position: [0, -0.12, 0.22] });
  const heads = new THREE.InstancedMesh(ck.build(), actorMaterial(0.03), camPos.length);
  heads.name = "ptz-heads";
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  b.group.add(heads);
  const hm = new THREE.Matrix4();
  const hq = new THREE.Quaternion();
  const hv = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const camPh = camPos.map(() => r.next() * 10);
  const panCams = (t: number) => {
    camPos.forEach(([x, y, z], i) => {
      const base = z > 0 ? 0 : Math.PI;
      const yaw = base + (x > 0 ? 0.5 : -0.5) + (pristine ? Math.sin(t * 0.25) * 0.7 : Math.sin(t * 0.21 + camPh[i]!) * 0.8);
      hq.setFromEuler(new THREE.Euler(0.25, yaw, 0, "YXZ"));
      hv.set(x, y + 0.06, z);
      hm.compose(hv, hq, one);
      heads.setMatrixAt(i, hm);
    });
    heads.instanceMatrix.needsUpdate = true;
  };
  panCams(0);
  if (!ruin) b.tick((_dt, t) => panCams(t));
  // Floodlight towers.
  for (const x of [-15, 15]) {
    b.cyl(0.28, 15, x, 0, -2, pristine ? "paper" : "light", 8, 0.14);
    b.box(2.6, 0.7, 0.3, x, 15, -2, "mid");
    for (let l = 0; l < 3; l++) b.flood(x - 0.8 + l * 0.8, 15.35, -1.8, 0.6, 0.5);
  }
  // Watchtower beside the road.
  if (!pristine) {
    const wx = -17,
      wz = -12;
    const lean = ruin ? 0.12 : 0;
    for (const [dx, dz] of [
      [-1.4, -1.4],
      [1.4, -1.4],
      [1.4, 1.4],
      [-1.4, 1.4],
    ])
      b.beam([wx + dx * 1.3, 0, wz + dz * 1.3], [wx + dx + lean * 8, 8, wz + dz], 0.22, "mid");
    for (let y = 2; y < 8; y += 2.6) {
      b.line([wx - 1.6, y, wz + 1.6], [wx + 1.6, y + 2.6, wz + 1.6]);
      b.line([wx + 1.6, y, wz - 1.6], [wx + 1.6, y + 2.6, wz + 1.6]);
    }
    const cx = wx + lean * 8;
    b.box(3.6, 0.3, 3.6, cx, 8, wz, "light");
    b.box(3.4, 1.1, 3.4, cx, 8.3, wz, "pale");
    b.box(3.44, 1, 3.44, cx, 9.4, wz, ruin ? "solid" : "deep");
    for (const d of [-1, 0, 1]) b.box(0.1, 1, 3.5, cx + d * 1.7, 9.4, wz, "paper");
    b.box(4.2, 0.25, 4.2, cx, 10.4, wz, "light");
    b.add(new THREE.ConeGeometry(3, 1, 4), { tone: "mid", position: [cx, 11.1, wz], rotation: [0, Math.PI / 4, 0] });
    b.flood(cx + 1.8, 10, wz + 1.8, 0.5, 0.5, Math.PI / 4);
    const ladder: Vec3[] = [];
    for (let i = 0; i <= 8; i++) ladder.push([wx + 1.9, i, wz + 1.9]);
    b.polyline(ladder, true);
  }
  // Fences out to either side, with ground concertina coils in front.
  const fenceX = 26;
  for (const s of [-1, 1]) {
    fence(b, [
      [s * 9.6, -5],
      [s * fenceX, -5],
    ], { height: 3.4, postGap: 3, outrigger: !pristine, razor: !pristine, solid: pristine, damage: ruin ? 0.5 : 0 });
    if (!pristine) {
      const zc = -3.2;
      razorCoil(b, [s * 10, 0.45, zc], [s * fenceX, 0.45, zc], 0.46, 0.34);
      razorCoil(b, [s * 10, 0.45, zc + 0.9], [s * fenceX, 0.45, zc + 0.9], 0.46, 0.34, true);
      razorCoil(b, [s * 10, 1.2, zc + 0.45], [s * fenceX, 1.2, zc + 0.45], 0.46, 0.34);
      for (let x = 12; x < fenceX; x += 3) b.line([s * x, 0, zc + 0.45], [s * x, 1.3, zc + 0.45], true);
    }
  }
  // Sandbag emplacement and two site cabins behind.
  if (!pristine) {
    sandbags(b, 11.4, 7, 5, 5, -0.25);
    sandbags(b, 13.7, 5.2, 3, 5, -1.5);
    for (let i = 0; i < 2; i++) {
      const x = 15 + i * 7,
        z = -14;
      b.box(6, 2.6, 2.5, x, 0.3, z, b.wear("paper"));
      b.box(6.1, 0.12, 2.6, x, 2.9, z, "light");
      b.box(1.4, 0.9, 0.08, x - 1.4, 1.4, z + 1.27, b.glass);
      b.box(0.9, 2, 0.08, x + 1.6, 0.3, z + 1.27, "mid");
      for (const dx of [-2.6, 2.6]) b.box(0.4, 0.3, 2.3, x + dx, 0, z, "mid");
    }
  }
  if (ruin) {
    rubble(b, 7, 3, 4, 1.6, 10, "light");
    const smoke = createPlume({ origin: [-2.6, 1.6, 1.5], rng: seed.fork("cpsmoke"), count: 14, life: 16, height: 40, r0: 1.2, r1: 6, drift: [16, -8], tone: 0.62, toneTop: 0.4, thinFrom: 0.42, hatch: 0.2 });
    b.effect(smoke);
  }
  return b.finish({ width: fenceX * 2 + 4, depth: 78, height: 16 }, "checkpoint");
}

// =================================================================== antenna array

function dishGeometry(D: number): THREE.BufferGeometry {
  const R = D / 2;
  const depth = R * 0.32;
  const k = new Kit();
  // Paraboloid shell: front (concave) and back surfaces joined at the rim.
  const n = 9;
  // Closed section traversed clockwise: back surface out to the rim, then the
  // concave front surface back to the axis (normals face outward).
  const prof: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const rr = (R * i) / n;
    prof.push([rr, depth * (rr / R) ** 2 - 0.45 - (1 - rr / R) * 0.7]);
  }
  for (let i = n; i >= 0; i--) {
    const rr = (R * i) / n;
    prof.push([rr, depth * (rr / R) ** 2]);
  }
  const shell = lathe(prof, 28);
  // Lathe axis is +Y; boresight should be +Z: rotate so concave faces +Z.
  k.add(shell, { tone: "paper", rotation: [Math.PI / 2, 0, 0], position: [0, 0, -depth * 0.5] });
  // Backing cone and counterweight arm.
  k.add(new THREE.CylinderGeometry(R * 0.28, R * 0.12, R * 0.5, 10), { tone: "light", rotation: [Math.PI / 2, 0, 0], position: [0, 0, -depth * 0.5 - R * 0.25 - 0.4] });
  k.add(new THREE.BoxGeometry(R * 0.5, R * 0.14, R * 0.14), { tone: "mid", position: [0, 0, -depth * 0.5 - 0.6] });
  // Quadripod carrying the subreflector at the focus.
  const f = R * 0.78;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p0 = new THREE.Vector3(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, depth * 0.384 - depth * 0.5);
    const p1 = new THREE.Vector3(0, 0, f - depth * 0.5);
    const len = p0.distanceTo(p1);
    const g = new THREE.CylinderGeometry(0.12, 0.12, len, 5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    const m = new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    k.add(g, { tone: "mid", matrix: m });
  }
  k.add(new THREE.CylinderGeometry(R * 0.1, R * 0.06, 0.8, 12), { tone: "light", rotation: [Math.PI / 2, 0, 0], position: [0, 0, f - depth * 0.5] });
  return k.build();
}

function yokeGeometry(D: number): THREE.BufferGeometry {
  const R = D / 2;
  const k = new Kit();
  k.add(block(R * 0.7, 3.2, R * 0.7), { tone: "pale" });
  for (const s of [-1, 1]) k.add(block(1.2, R * 0.62, 2.4), { tone: "paper", position: [s * R * 0.32, 3.2, 0] });
  k.add(new THREE.CylinderGeometry(0.8, 0.8, R * 0.72, 10), { tone: "mid", rotation: [0, 0, Math.PI / 2], position: [0, 3.2 + R * 0.55, 0] });
  return k.build();
}

export function buildAntennaArray(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const ruin = b.ruin,
    pristine = b.pristine;
  const n = pristine ? 4 : 3;
  const D = 30;
  const spacing = 52;
  const drumH = 7;
  // Control building with a small radome.
  b.box(34, 6, 14, 0, 0, 44, b.wear("paper"));
  b.box(34.6, 0.5, 14.6, 0, 6, 44, "pale");
  for (let i = 0; i < 8; i++) b.box(2, 1.2, 0.1, -14 + i * 4, 3, 51.02, b.glass);
  b.cyl(2.4, 1.2, 10, 6.5, 44, "light", 12);
  b.add(sphere(2.6, 12, 8), { tone: "paper", position: [10, 8.2, 44] });
  const sites: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) sites.push([(i - (n - 1) / 2) * spacing, 0]);
  // Pedestal drums.
  for (const [x, z] of sites) {
    b.cyl(6, drumH, x, 0, z, b.wear("paper"), 20, 5.2);
    b.cyl(6.6, 0.8, x, 0, z, "light", 20);
    b.box(1.4, 2.4, 0.2, x, 0, z + 5.6, "dark");
    const rail: Vec3[] = [];
    for (let s = 0; s <= 20; s++) rail.push([x + Math.cos((s / 20) * Math.PI * 2) * 5.4, drumH + 1.1, z + Math.sin((s / 20) * Math.PI * 2) * 5.4]);
    b.polyline(rail, true);
  }
  // Yokes and dishes as instanced moving parts.
  const alive = sites.map((_, i) => !(ruin && i === 1));
  const yokes = new THREE.InstancedMesh(yokeGeometry(D), actorMaterial(0.2), n);
  const dishes = new THREE.InstancedMesh(dishGeometry(D), actorMaterial(0.2), n);
  yokes.name = "antenna-yokes";
  dishes.name = "antenna-dishes";
  yokes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dishes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  b.group.add(yokes, dishes);
  const ph = sites.map(() => r.next() * 100);
  const az0 = pristine ? 0.3 : r.range(-0.6, 0.6);
  const my = new THREE.Matrix4();
  const md = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const hingeY = 3.2 + (D / 2) * 0.55;
  const pose = (t: number) => {
    sites.forEach(([x, z], i) => {
      let az: number, el: number;
      if (pristine) {
        az = az0 + Math.sin(t * 0.05) * 0.5;
        el = 0.75 + Math.sin(t * 0.03) * 0.15;
      } else if (ruin) {
        az = az0 + i * 0.7;
        el = 0.1 + i * 0.2;
      } else {
        az = az0 + i * 0.35 + Math.sin(t * 0.04 + ph[i]!) * 0.6;
        el = 0.55 + 0.3 * Math.sin(t * 0.027 + ph[i]! * 1.3);
      }
      my.makeRotationY(az).setPosition(x, drumH, z);
      if (!alive[i]) {
        // Collapsed: dish face-down beside the pedestal.
        my.makeRotationY(az).setPosition(x, 0, z);
        md.compose(new THREE.Vector3(x + 12, 5, z + 6), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.9, 0.5, 0.3)), new THREE.Vector3(1, 1, 1));
        yokes.setMatrixAt(i, tmp.makeScale(0, 0, 0));
        dishes.setMatrixAt(i, md);
        return;
      }
      yokes.setMatrixAt(i, my);
      md.copy(my).multiply(tmp.makeTranslation(0, hingeY, 0)).multiply(new THREE.Matrix4().makeRotationX(-el));
      dishes.setMatrixAt(i, md);
    });
    yokes.instanceMatrix.needsUpdate = true;
    dishes.instanceMatrix.needsUpdate = true;
  };
  pose(0);
  if (!ruin) b.tick((_dt, t) => pose(t));
  const reach = spacing * (n - 1) / 2 + D;
  yokes.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 20, 0), reach + 10);
  dishes.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 20, 0), reach + 20);
  // Radomes: faceted spheres on drum bases.
  const domes: Array<[number, number]> = [
    [-60, -48],
    [-30, -52],
  ];
  domes.forEach(([x, z], i) => {
    b.cyl(9.2, 6, x, 0, z, b.wear("pale"), 20);
    const geo = new THREE.IcosahedronGeometry(10, 2);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const ink = new Float32Array(pos.count * 3);
    for (let f = 0; f < pos.count / 3; f++) {
      const tone = pristine ? 0 : f % 4 === 0 ? 0.3 : f % 3 === 0 ? 0.18 : 0.02;
      for (let v = 0; v < 3; v++) ink[(f * 3 + v) * 3] = tone;
    }
    geo.setAttribute("inkAttr", new THREE.BufferAttribute(ink, 3));
    if (ruin && i === 0) {
      // Split open: the upper shell torn away, dark interior.
      for (let v = 0; v < pos.count; v++) if (pos.getY(v) > 3 && pos.getX(v) > -2) pos.setY(v, 3 + (pos.getY(v) - 3) * 0.15);
      geo.computeVertexNormals();
      b.cyl(8.6, 2, x, 6, z, "solid", 16);
    }
    b.add(geo, { position: [x, 6 + 7.4, z] });
  });
  // Guyed lattice mast with panel antennas.
  const mx = 70,
    mz = -40;
  if (ruin) {
    for (let i = 0; i < 6; i++) b.beam([mx + i * 9, 0.6, mz + i * 2], [mx + (i + 1) * 9, 0.6 + (i % 2) * 1.5, mz + (i + 1) * 2], 0.4, "dark");
  } else {
    const mh = 64;
    latticeMast(b, mx, mz, mh, 2.2, 2.2, { panels: Math.round(mh / 2.4), leg: 0.18, fine: true });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      for (const y of [mh * 0.95, mh * 0.6, mh * 0.3]) b.line([mx, y, mz], [mx + Math.cos(a) * 34, 0, mz + Math.sin(a) * 34], true);
      b.box(1.4, 0.8, 1.4, mx + Math.cos(a) * 34, 0, mz + Math.sin(a) * 34, "light");
      for (const y of [mh - 6, mh - 16]) b.box(0.5, 3.2, 0.9, mx + Math.cos(a) * 1.6, y, mz + Math.sin(a) * 1.6, "pale", { ry: -a });
    }
    b.line([mx, mh, mz], [mx, mh + 8, mz]);
    b.lamp(mx, mh + 8.3, mz, 0.8, "signal", true);
    b.lamp(mx, mh * 0.5, mz + 1.4, 0.7, "signal", true);
  }
  fence(b, rectPath(0, -2, spacing * (n - 1) + 90, 130), { height: 2.6, postGap: 4, outrigger: true, solid: pristine, damage: ruin ? 0.35 : 0 });
  if (ruin) {
    rubble(b, sites[1]![0] + 8, 4, 7, 2.6, 14);
    const smoke = createPlume({ origin: [-60, 12, -48], rng: seed.fork("dome"), count: 14, life: 18, height: 60, r0: 3, r1: 10, drift: [28, -14], tone: 0.62, toneTop: 0.4, thinFrom: 0.42, hatch: 0.35 });
    b.effect(smoke);
  }
  return b.finish({ width: spacing * (n - 1) + 94, depth: 134, height: 72 }, "antenna-array");
}
