/**
 * The rail: the one sound that never stops.
 *
 * Joint clacks are scheduled from real geometry: a 18.3 m rail length, a
 * two-axle bogie (1.9 m wheelbase) under the cab and a second bogie 10.4 m
 * behind it, so each joint reads "da-dum ..... da-dum" at any speed. Beneath
 * that: bogie rumble (brown noise), wheel roll (pink noise), a traction-motor
 * whine that rises with speed, flange squeal on curves, a hollow girder
 * resonance on bridges, and a filtered roar with slap echoes in tunnels.
 *
 * In the perfection ending the joints fall silent: the line has been welded
 * smooth. In ruin the rhythm limps.
 */
import type { Bank } from "./bank.ts";
import { glide, type Rig, type VoiceCounter } from "./rig.ts";
import type { RailState } from "./types.ts";
import type { Rng } from "../render/core/rng.ts";

export const SLEEPER_PITCH = 0.65;
const JOINT = 18.3;
const AXLE = 1.9;
const BOGIE = 10.4;
const VMAX = 18;

export interface RailMix {
  /** 0..1: joints welded away. */
  weld: number;
  /** 0..1: loose, limping rhythm. */
  ruin: number;
  /** 0..2 authority level (smoothed). */
  authority: number;
  paused: boolean;
}

export class Rail {
  readonly counter: VoiceCounter = { active: 0 };
  private state: RailState = { sleepersPerSecond: 0, curve: 0, onBridge: false, inTunnel: false };
  v = 0;
  private nextJoint = 0;
  private rng: Rng;
  private clackBus: GainNode;
  private rumble: GainNode;
  private rumbleLp: BiquadFilterNode;
  private roll: GainNode;
  private whine: GainNode;
  private whineOsc: OscillatorNode[] = [];
  private whineBp: BiquadFilterNode;
  private squeal: GainNode;
  private squealPan: StereoPannerNode;
  private bridgeSend: GainNode;
  private tunnelSend: GainNode;
  private roar: GainNode;
  private mix: RailMix = { weld: 0, ruin: 0, authority: 0, paused: false };
  private primed = false;

  constructor(
    private r: Rig,
    private bank: Bank,
  ) {
    this.rng = r.rng.fork("rail");
    const cab = r.bus.cab;

    // Joint clacks: dry into the cab, a little cab-room, plus bridge/tunnel sends.
    this.clackBus = r.gain(1);
    this.clackBus.connect(cab);
    this.clackBus.connect(r.gain(0.35)).connect(r.bus.cabRoom);

    // Bogie rumble.
    this.rumbleLp = r.filter("lowpass", 120, 0.8);
    this.rumble = r.gain(0);
    r.bed("brown", 0.7).connect(this.rumbleLp).connect(this.rumble).connect(cab);

    // Wheel/rail roll.
    this.roll = r.gain(0);
    r.bed("pink", 1.3).connect(r.filter("bandpass", 750, 0.7)).connect(this.roll).connect(cab);

    // Traction whine: two tones through a resonant band.
    this.whineBp = r.filter("bandpass", 600, 3);
    this.whine = r.gain(0);
    for (const [mult, amp] of [
      [1, 1],
      [2.03, 0.45],
    ] as const) {
      const o = r.osc("triangle", 300 * mult);
      o.connect(r.gain(amp)).connect(this.whineBp);
      o.start();
      this.whineOsc.push(o);
    }
    this.whineBp.connect(this.whine).connect(cab);

    // Flange squeal: two inharmonic partials with slow pitch wander and tremolo.
    this.squeal = r.gain(0);
    this.squealPan = r.panner(0);
    const trem = r.gain(0.7);
    const tremLfo = r.osc("sine", 7.3);
    const tremDepth = r.gain(0.3);
    tremLfo.connect(tremDepth).connect(trem.gain);
    tremLfo.start();
    const wander = r.osc("sine", 0.37);
    const wanderDepth = r.gain(28);
    wander.connect(wanderDepth);
    wander.start();
    for (const [f, a] of [
      [3120, 1],
      [4690, 0.5],
      [6240, 0.18],
    ] as const) {
      const o = r.osc("sine", f);
      wanderDepth.connect(o.detune);
      o.connect(r.gain(a)).connect(trem);
      o.start();
    }
    trem.connect(this.squeal).connect(this.squealPan).connect(cab);

    // Bridge: hollow girder resonance (two resonant bands into a short comb).
    this.bridgeSend = r.gain(0);
    const b1 = r.filter("bandpass", 95, 3);
    const b2 = r.filter("bandpass", 380, 5);
    const comb = r.ctx.createDelay(0.1);
    comb.delayTime.value = 0.0113;
    const combFb = r.gain(0.5);
    const bridgeOut = r.gain(1.6);
    const bLp = r.filter("lowpass", 1500, 0.6);
    this.clackBus.connect(this.bridgeSend);
    this.rumble.connect(this.bridgeSend);
    this.bridgeSend.connect(b1).connect(comb);
    this.bridgeSend.connect(b2).connect(comb);
    comb.connect(combFb).connect(comb);
    comb.connect(bLp).connect(bridgeOut).connect(cab);

    // Tunnel: slap echoes and a roar.
    this.tunnelSend = r.gain(0);
    const e1 = r.ctx.createDelay(0.5);
    e1.delayTime.value = 0.043;
    const e2 = r.ctx.createDelay(0.5);
    e2.delayTime.value = 0.091;
    const eFb1 = r.gain(0.42);
    const eFb2 = r.gain(0.3);
    const eLp = r.filter("lowpass", 2400, 0.6);
    this.clackBus.connect(this.tunnelSend);
    this.tunnelSend.connect(eLp);
    eLp.connect(e1).connect(eFb1).connect(e1);
    eLp.connect(e2).connect(eFb2).connect(e2);
    e1.connect(cab);
    e2.connect(cab);
    this.roar = r.gain(0);
    r.bed("pink", 2.9).connect(r.filter("lowpass", 850, 0.7)).connect(r.filter("peaking", 180, 1, 6)).connect(this.roar).connect(cab);
  }

  set(s: RailState): void {
    const n = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
    this.state = {
      sleepersPerSecond: Math.max(0, n(s.sleepersPerSecond, 0)),
      curve: Math.max(-1, Math.min(1, n(s.curve, 0))),
      onBridge: !!s.onBridge,
      inTunnel: !!s.inTunnel,
    };
  }

  get rail(): RailState {
    return { ...this.state };
  }

  update(now: number, dt: number, mix: RailMix): void {
    this.mix = mix;
    const target = mix.paused ? 0 : this.state.sleepersPerSecond * SLEEPER_PITCH;
    this.v += (target - this.v) * (1 - Math.exp(-Math.max(0, dt) / 0.35));
    if (dt <= 0) this.v = target;
    const vn = Math.min(1, this.v / VMAX);
    // The first update lands instantly (no audible glide from default values at start-up).
    const k = (tc: number) => (this.primed ? tc : 0.004);
    const s = this.state;
    const bridge = s.onBridge ? 1 : 0;
    glide(this.rumble.gain, 0.1 * Math.pow(vn, 1.1) * (1 + bridge * 0.6), now, k(0.25));
    glide(this.rumbleLp.frequency, 90 + 300 * vn, now, k(0.3));
    glide(this.roll.gain, 0.065 * Math.pow(vn, 1.5) * (1 - mix.weld * 0.4), now, k(0.3));
    const wf = 140 + 38 * this.v;
    this.whineOsc.forEach((o, i) => glide(o.frequency, wf * (i ? 2.03 : 1), now, k(0.2)));
    glide(this.whineBp.frequency, wf * 1.2, now, k(0.2));
    // The machine-driven cab sounds smoother and more even.
    glide(this.whine.gain, 0.012 * vn * (0.6 + 0.3 * Math.min(1, mix.authority)), now, k(0.3));
    const bend = Math.max(0, Math.abs(s.curve) - 0.28) / 0.72;
    glide(this.squeal.gain, 0.03 * bend * Math.min(1, this.v / 7), now, k(0.35));
    glide(this.squealPan.pan, -Math.sign(s.curve) * 0.5, now, k(0.3));
    glide(this.bridgeSend.gain, bridge * 0.9, now, k(0.25));
    const tun = s.inTunnel ? 1 : 0;
    glide(this.tunnelSend.gain, tun * 0.8, now, k(0.2));
    glide(this.roar.gain, tun * 0.16 * (0.25 + vn), now, k(0.25));
    // The world outside closes in inside a tunnel.
    glide(this.r.worldFilter.frequency, tun ? 520 : 9000, now, k(tun ? 0.12 : 0.4));
    glide(this.r.worldGate.gain, tun ? 0.35 : 1, now, k(0.2));
    glide(this.r.worldGateWet.gain, tun ? 0.2 : 1, now, k(0.2));
    this.primed = true;
  }

  schedule(until: number, now: number): void {
    const v = this.v;
    if (v < 0.5 || this.mix.paused) {
      this.nextJoint = 0;
      return;
    }
    const period = JOINT / v;
    if (!this.nextJoint || this.nextJoint < now - 0.05) this.nextJoint = now + 0.05 + this.rng.next() * Math.min(period, 1.2);
    let guard = 0;
    while (this.nextJoint < until && guard++ < 64) {
      this.joint(this.nextJoint, v);
      this.nextJoint += period * (1 + this.rng.range(-0.012, 0.012));
    }
  }

  private joint(t: number, v: number): void {
    const weld = this.mix.weld;
    if (weld > 0.97) return;
    const speedAmp = 0.35 + 0.65 * Math.min(1, v / 14);
    const axles: Array<[number, number, "clack-near" | "clack-far"]> = [
      [0, 1, "clack-near"],
      [AXLE, 0.82, "clack-near"],
      [BOGIE, 0.46, "clack-far"],
      [BOGIE + AXLE, 0.4, "clack-far"],
    ];
    for (const [d, a, kind] of axles) {
      if (this.mix.ruin > 0.2 && this.rng.chance(this.mix.ruin * 0.22)) continue;
      const when = t + d / v + (this.mix.ruin > 0.2 ? this.rng.range(-0.02, 0.03) * this.mix.ruin : 0);
      const amp = 0.26 * a * speedAmp * (1 - weld) * this.rng.range(0.85, 1.1);
      if (amp < 0.01) continue;
      const src = this.r.source(this.bank.next(kind));
      src.playbackRate.value = this.rng.range(0.94, 1.06) * (kind === "clack-far" ? 0.95 : 1);
      const g = this.r.gain(amp);
      src.connect(g).connect(this.clackBus);
      src.start(when);
      this.r.track(src, () => g.disconnect(), this.counter);
    }
  }
}
