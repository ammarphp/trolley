/**
 * Cab-local frame and the measured layout every cab part is built against.
 *
 * Origin on the cab floor directly under the driver's eyes. -Z forward, +Y up,
 * +X right. Metres. The renderer places the cab so this floor sits 1.1 m above
 * rail top.
 *
 * The driver sits on the centre line of a narrow tram cab (interior 1.68 m
 * wide at the front). Everything is laid out against the sight lines from the
 * eye point: the instrument visor hides the bottom of the glass, the
 * destination-blind box hangs inside the top of it, and the exterior mirror is
 * seen through the front of the left side window.
 */
import * as THREE from "three";

export const DEG = Math.PI / 180;

/** Driver's eye, cab-local. */
export const EYE: Readonly<[number, number, number]> = [0, 1.3, 0];
/** Base camera pitch (radians, negative looks down). */
export const BASE_PITCH = -3 * DEG;

/** Inner face of the side walls. */
export const WALL_X = 0.84;
export const ROOF_Y = 2.03;

/** Windshield: a raked plane. Local u = +X, v up the glass, w toward the driver. */
export const GLASS = {
  center: [0, 1.44, -1.11] as [number, number, number],
  /** Top leans back toward the driver. */
  rake: 6.6 * DEG,
  halfW: 0.74,
  halfH: 0.37,
  radius: 0.13,
} as const;

/** Lever pivot and swing. */
export const LEVER_PIVOT: [number, number, number] = [0.48, 0.83, -0.645];
export const LEVER_SWING = 28 * DEG;
/** Pivot to top of shaft (start of grip). */
export const LEVER_SHAFT = 0.235;
/** Crossbar length (between the ball ends) and radius. */
export const LEVER_GRIP = 0.13;
export const LEVER_GRIP_R = 0.0165;

/** Console section, (z, y) pairs, driver side first. */
export const CONSOLE_PROFILE: Array<[number, number]> = [
  [-0.5, 0.3],
  [-0.5, 0.852],
  [-0.545, 0.9],
  [-0.885, 0.955],
  [-0.985, 1.062],
  [-0.93, 1.064],
  [-0.93, 1.082],
  [-0.99, 1.09],
  [-1.16, 1.046],
  [-1.16, 0.3],
];

export const DESK = { nearZ: -0.545, nearY: 0.9, farZ: -0.885, farY: 0.955 };
export function deskY(z: number): number {
  const t = (z - DESK.nearZ) / (DESK.farZ - DESK.nearZ);
  return DESK.nearY + t * (DESK.farY - DESK.nearY);
}
/** Desk surface slope angle (rises away from the driver). */
export const DESK_TILT = Math.atan2(DESK.farY - DESK.nearY, DESK.nearZ - DESK.farZ);

/** Instrument panel face between the desk and the visor. */
export const PANEL = {
  bottom: [-0.885, 0.955] as [number, number],
  top: [-0.985, 1.062] as [number, number],
};

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** Matrix that maps a part built in XY (facing +Z) onto the glass plane. */
export function glassMatrix(w = 0): THREE.Matrix4 {
  const [cx, cy, cz] = GLASS.center;
  tmpE.set(GLASS.rake, 0, 0);
  tmpQ.setFromEuler(tmpE);
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(tmpQ);
  return new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz).addScaledVector(n, w), tmpQ.clone(), new THREE.Vector3(1, 1, 1));
}

export function glassPoint(u: number, v: number, w = 0, out = new THREE.Vector3()): THREE.Vector3 {
  const [cx, cy, cz] = GLASS.center;
  const c = Math.cos(GLASS.rake),
    s = Math.sin(GLASS.rake);
  return out.set(cx + u, cy + v * c - w * s, cz + v * s + w * c);
}

/**
 * Frame on the instrument panel: `along` 0..1 from bottom edge to top edge,
 * `lift` metres out from the surface. Parts built in XY facing +Z land flat on
 * the panel.
 */
export function panelMatrix(x: number, along: number, lift = 0): THREE.Matrix4 {
  const [z0, y0] = PANEL.bottom;
  const [z1, y1] = PANEL.top;
  const dz = z1 - z0,
    dy = y1 - y0;
  const len = Math.hypot(dz, dy);
  const up = new THREE.Vector3(0, dy / len, dz / len);
  const normal = new THREE.Vector3(0, -dz / len, dy / len);
  const right = new THREE.Vector3(1, 0, 0);
  const p = new THREE.Vector3(x, y0 + dy * along, z0 + dz * along).addScaledVector(normal, lift);
  return new THREE.Matrix4().makeBasis(right, up, normal).setPosition(p);
}
export const PANEL_LENGTH = Math.hypot(PANEL.top[0] - PANEL.bottom[0], PANEL.top[1] - PANEL.bottom[1]);

/** Frame on the desk top: parts built with Y up land on the (tilted) desk. */
export function deskMatrix(x: number, z: number, yaw = 0, lift = 0): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeRotationX(DESK_TILT);
  const yawM = new THREE.Matrix4().makeRotationY(yaw);
  m.multiply(yawM);
  m.setPosition(x, deskY(z) + lift, z);
  return m;
}
