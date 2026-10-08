/**
 * The ink world renderer: composes the pipeline, the moving world, the cab
 * and the scripted disruptions behind the WorldRenderer contract.
 *
 * Invariants:
 *  - Cosmetic time never advances fictional time or decides anything.
 *  - commit() always resolves: paused, reduced motion, context loss, destroy.
 *  - update() is idempotent and cheap.
 *  - Diegetic freezes freeze only the drawing; pause/settings stay live.
 *  - No Math.random: every cosmetic choice is seeded.
 */
import * as THREE from "three";
import type {
  Cue,
  EnvironmentTarget,
  Executor,
  LeverInput,
  RailOutcome,
  RendererSettings,
  SceneAnchors,
  StageView,
  WorldRenderer,
} from "./api.ts";
import type { AssetProvider, CabinModule, PortraitModule, SkyModule } from "./assets.ts";
import { InkPipeline, type InkLook } from "./core/ink-pipeline.ts";
import { INK_GLOBALS, inkMaterial } from "./core/ink-material.ts";
import { Journey, type Stake } from "./world/journey.ts";
import { TrackRenderer, RAIL_TOP } from "./world/track/mesh.ts";
import { Scatter } from "./world/scatter.ts";
import { buildTableau, disposeTableau, occupantsDescription, FIRST_STAKE, type Tableau } from "./world/staging.ts";
import { buildTunnel, type Tunnel } from "./world/tunnel.ts";
import { Lineside } from "./world/lineside.ts";
import type { TrackLine } from "./world/track/path.ts";
import { buildRiverCrossing, type RiverCrossing } from "./world/river-crossing.ts";
import { createRng } from "./core/rng.ts";
import { setSkyLook } from "./world/terrain/glsl.ts";

export interface AudioLike {
  setRail(r: { sleepersPerSecond: number; curve: number; onBridge: boolean; inTunnel: boolean }): void;
  setMood(m: { stage: number; tension: number; gloom: number; perfection: number; ruin: number; storm: number; rain: number; speed: number; authority: "human" | "delegated" | "overridden"; ending?: string }): void;
  trigger(ev: string, opts?: { intensity?: number; pan?: number }): void;
  pause(paused: boolean): void;
}

export interface WorldRendererOptions {
  host: HTMLElement;
  assets: AssetProvider;
  settings: RendererSettings;
  audio?: AudioLike | null;
  seed?: string;
  /** Drive frames by calling advance(dt) instead of requestAnimationFrame (tests, lab). */
  manual?: boolean;
  preserveDrawingBuffer?: boolean;
  /**
   * WebGL without a GPU: draw at reduced resolution and at most 20 frames a
   * second, so the page (and its controls) stay responsive.
   */
  software?: boolean;
}

const CAB_FLOOR = 1.1;
/** Metres of an untaken branch that stay drawn once its fork is behind. */
const KEEP_ABANDONED = 96;
const LIT_REF = (2.2 * 0.92 + 0.9) / Math.PI;

function lerpEnv(a: EnvironmentTarget, b: EnvironmentTarget, k: number): void {
  for (const key of Object.keys(b) as Array<keyof EnvironmentTarget>) a[key] += (b[key] - a[key]) * k;
}

export class InkWorldRenderer implements WorldRenderer {
  readonly kind = "ink" as const;
  private host: HTMLElement;
  private assets: AssetProvider;
  private settingsState: RendererSettings;
  private audio: AudioLike | null;
  private pipeline: InkPipeline;
  private scene = new THREE.Scene();
  private worldRoot = new THREE.Group();
  private cabRoot = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(52, 1, 0.04, 1700);
  private sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.9);
  private origin = new THREE.Vector3();
  private journey: Journey;
  private track = new TrackRenderer();
  private scatter: Scatter;
  private lineside: Lineside;
  private sky: SkyModule | null = null;
  private ground: (SkyModule & { heightAt(x: number, z: number): number }) | null = null;
  private weather: SkyModule | null = null;
  private cabin: CabinModule | null = null;
  private portrait: PortraitModule | null = null;
  private leafFall: ReturnType<NonNullable<AssetProvider["leafFall"]>> | null = null;
  private flock: ReturnType<NonNullable<AssetProvider["flock"]>> | null = null;
  private tableau: Tableau | null = null;
  private oldTableaux: Tableau[] = [];
  private readonly software: boolean;
  private tunnel: Tunnel | null = null;
  private tunnelExclusion: (() => void) | null = null;
  private lastScreenToe = Number.NaN;
  private crossings: Array<{ crossing: RiverCrossing; release: () => void }> = [];
  private decisionsSinceRiver = 1;
  private retracting = new WeakMap<TrackLine, number>();
  private clearWaiters: Array<() => void> = [];
  private selection: THREE.Mesh | null = null;
  private view: StageView | null = null;
  private env: EnvironmentTarget;
  private envTarget: EnvironmentTarget;
  private envOverride: { env: EnvironmentTarget; until: number } | null = null;
  private heightAt: (x: number, z: number) => number = () => 0;
  private paused = false;
  private destroyed = false;
  private frozenUntil = 0;
  private glitchUntil = 0;
  private flashValue = 0;
  private negativeValue = 0;
  private clock = 0;
  private lastFrame = 0;
  private raf = 0;
  private resizeObserver: ResizeObserver | null = null;
  private anchorsCb: ((a: SceneAnchors) => void) | null = null;
  private leverCb: ((i: LeverInput) => void) | null = null;
  private interactive = false;
  private leverTarget = 0;
  /** Where the player last asked the lever to be; under a jam the display springs back, this does not. */
  private leverRequested = 0;
  private armed: "left" | "right" | null = null;
  private jam: { forced: "left" | "right" | null } | null = null;
  private handledCues = new Set<string>();
  private rideSeed: string | null = null;
  private appliedImpacts = -1;
  private appliedBlood = 0;
  private printed = 0;
  private portraitTimer = 0;
  private shake = 0;
  private sway = 0;
  private lastHeading = 0;
  private screenState: { thinking: boolean; alert: boolean; lines: string[] } = { thinking: false, alert: false, lines: [] };
  private lastAnchors = "";
  private raycaster = new THREE.Raycaster();
  private drag: { pointerId: number; startX: number; startValue: number } | null = null;
  private commitInFlight: Promise<void> | null = null;
  private executor: Executor = "human";

  constructor(options: WorldRendererOptions) {
    this.host = options.host;
    this.assets = options.assets;
    this.settingsState = { ...options.settings };
    this.audio = options.audio ?? null;
    const seed = options.seed ?? "title";
    const canvas = document.createElement("canvas");
    canvas.className = "ink-canvas";
    canvas.setAttribute("aria-hidden", "true");
    this.host.append(canvas);
    const q = this.settingsState.quality;
    this.software = options.software ?? false;
    this.pipeline = new InkPipeline({
      canvas,
      maxPixelRatio: this.software ? 1 : q === "high" ? 2 : q === "medium" ? 1.5 : 1,
      renderScale: this.software ? 0.6 : 1,
      shadows: q !== "low" && !this.software,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    });
    this.manual = options.manual ?? false;
    // Opt-in inspection hook for profiling (?debug in the URL); nothing reads it.
    if (typeof location !== "undefined" && /[?&]debug\b/.test(location.search)) (globalThis as { __inkWorld?: unknown }).__inkWorld = this;
    this.scene.add(this.worldRoot);
    this.scene.add(this.cabRoot);
    this.cabRoot.add(this.camera);
    this.scene.add(this.hemi);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sun.castShadow = q !== "low";
    // 1536² over a 180 m square is ~12 cm a texel: finer than the hatching it feeds.
    this.sun.shadow.mapSize.set(q === "high" ? 1536 : 1024, q === "high" ? 1536 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -90;
    sc.right = 90;
    sc.top = 90;
    sc.bottom = -90;
    sc.near = 1;
    sc.far = 420;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    INK_GLOBALS.uInkLitRef.value = LIT_REF;

    this.journey = new Journey(seed, {
      onContact: (side, s, index) => this.contact(side, s, index),
      onPointsThrown: (side) => {
        this.track.setPoints(side === "left" ? -1 : 1);
        this.audio?.trigger("switch-throw", { pan: side === "left" ? -0.4 : 0.4 });
      },
    });
    this.worldRoot.add(this.track.group);
    const env0 = {
      vegetation: 1, leaves: 1, bloom: 1, fauna: 1, birds: 1, habitation: 0.25, people: 0.5, industry: 0, compute: 0, surveillance: 0,
      perfection: 0, ruin: 0, fire: 0, drought: 0, cloud: 0.2, storm: 0, lightning: 0, fog: 0.1, wind: 0.25, timeOfDay: 0.25, gloom: 0,
      speed: 0, water: 1, uniformity: 0,
    };
    this.env = { ...env0 };
    this.envTarget = { ...env0 };
    this.scatter = new Scatter({ seed, assets: this.assets, heightAt: (x, z) => this.heightAt(x, z) });
    this.scatter.density = q === "high" ? 0.85 : q === "medium" ? 0.7 : 0.5;
    this.worldRoot.add(this.scatter.group);
    this.lineside = new Lineside(this.assets, (x, z) => this.heightAt(x, z), (line, s) => {
      const t = this.tunnel;
      if (t && line === t.line && s > t.start - 58 && s < t.start + t.length + 58) return true;
      return this.crossings.some(({ crossing: c }) => c.line === line && Math.abs(s - c.s) < c.half + 10);
    });
    this.worldRoot.add(this.lineside.group);

    setSkyLook(this.pipeline.look);
    this.sky = this.assets.sky?.() ?? null;
    if (this.sky) this.scene.add(this.sky.object);
    this.ground = this.assets.ground?.() ?? null;
    if (this.ground) {
      this.worldRoot.add(this.ground.object);
      this.heightAt = (x, z) => this.ground!.heightAt(x, z);
      this.track.setHeight(this.heightAt);
    } else {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), inkMaterial({ tone: 0.02, hatch: 0.3, edge: 0.25, pattern: "stipple" }));
      plane.rotation.x = -Math.PI / 2;
      plane.receiveShadow = true;
      plane.name = "fallback-ground";
      this.worldRoot.add(plane);
    }
    this.weather = this.assets.weather?.() ?? null;
    if (this.weather) this.scene.add(this.weather.object);
    this.weather?.onLightning?.((strength) => this.lightning(strength));
    this.sky?.onLightning?.((strength) => this.lightning(strength));
    this.cabin = this.assets.cabin?.(seed) ?? null;
    if (this.cabin) this.cabRoot.add(this.cabin.group);
    this.portrait = this.assets.portrait?.(seed) ?? null;
    if (this.cabin && this.portrait) {
      this.portrait.settle?.();
      this.cabin.setMirrorTexture(this.portrait.texture);
    }
    this.leafFall = this.assets.leafFall?.() ?? null;
    if (this.leafFall) this.scene.add(this.leafFall.object);
    this.flock = this.assets.flock?.("starlings", { count: 140, seed }) ?? null;
    if (this.flock) this.worldRoot.add(this.flock.object);

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.journey.settle();
    });
    this.bindPointer(canvas);
    this.settings(this.settingsState);
    this.lastFrame = performance.now();
    if (!this.manual) this.raf = requestAnimationFrame(this.frame);
  }

  private manual: boolean;

  /** Step the world by dt seconds and draw (manual mode). */
  advance(dt: number, render = true): void {
    if (this.destroyed || this.paused) return;
    this.clock += dt;
    if (this.clock < this.frozenUntil) return;
    this.step(dt, this.settingsState.reducedMotion);
    if (render) {
      this.pipeline.render(this.scene, this.camera, dt);
      this.emitAnchors();
    }
  }

  // ------------------------------------------------------------- contract

  update(view: StageView): void {
    if (view.seed !== this.rideSeed) {
      // A new ride, a resumed save or the title: start the glass, the printer,
      // the dash and the cue bookkeeping over, so the restore below redraws
      // exactly this run's history (silently).
      this.rideSeed = view.seed;
      this.cabin?.clearGlass();
      this.handledCues.clear();
      this.appliedImpacts = -1;
      this.appliedBlood = 0;
      this.printed = 0;
      this.pendingWipe = false;
      this.decisionsSinceRiver = 1;
      this.screenState = { thinking: false, alert: false, lines: [] };
    }
    this.view = view;
    this.envTarget = { ...view.env };
    const c = view.cabin;
    this.cabin?.setKeepsake(c.keepsake);
    this.cabin?.setAuthority(c.authority);
    this.jam = null;
    for (const cue of view.cues) this.applyCue(cue);
    // Receipts print once each (counted over the whole run; the view keeps only the latest).
    if (this.printed < c.receiptTotal) {
      const fresh = c.receipts.slice(-Math.min(c.receipts.length, c.receiptTotal - this.printed));
      this.printed = c.receiptTotal;
      if (this.appliedImpacts >= 0) for (const line of fresh.slice(-2)) {
        this.cabin?.printReceipt(line);
        this.audio?.trigger("printer");
      }
    }
    // Restore glass damage silently (resume) — live impacts arrive via contact().
    if (this.appliedImpacts < 0) {
      for (let i = 0; i < c.impacts; i++) {
        const rng = createRng(`${view.seed}:glass:${i}`);
        this.cabin?.impact({ u: rng.range(0.25, 0.75), v: rng.range(0.35, 0.7), severity: rng.range(0.25, 0.5), blood: i < c.bloodied && !this.settingsState.reducedGraphics });
      }
      this.appliedImpacts = c.impacts;
      this.appliedBlood = c.bloodied;
    }
    if (view.phase === "ending") this.journey.halt();
    if (view.phase === "decision" && view.decisionId && view.staging) {
      const key = view.decisionId;
      const current = this.journey.junction;
      if (!current || current.key !== key) this.prepareJunction(view);
    }
    this.updateScreen();
  }

  commit(side: "left" | "right", executor: Executor, outcome?: RailOutcome): Promise<void> {
    if (this.commitInFlight) return this.commitInFlight;
    this.executor = executor;
    this.selectionVisible(null);
    const stakes = this.tableau?.stakes.filter((s) => s.side === side) ?? [];
    let stop: { s: number } | null = null;
    if (outcome?.stoppedBy) {
      const brake = /brake/i.test(outcome.stoppedBy);
      const sorted = stakes.slice().sort((a, b) => a.s - b.s);
      const first = sorted[0];
      // An independent brake stands beyond what the branch strikes (S2-04: the
      // worker, then the barrier): halt short of the last stake, not the first.
      const last = sorted.at(-1);
      stop = brake ? { s: last?.s ?? FIRST_STAKE - 5 } : { s: (first?.s ?? FIRST_STAKE) + 3.5 };
    }
    // The lever: yours, or moved for you.
    this.leverTarget = this.leverRequested = side === "left" ? -1 : 1;
    this.routeSignal(side, true);
    if (executor !== "human") {
      this.cabin?.setAuthority("overridden");
      this.audio?.trigger("glitch", { intensity: 0.4 });
    }
    this.audio?.trigger("lever-commit", { pan: side === "left" ? -0.3 : 0.3 });
    // Untaken side watches; taken side braces.
    for (const actor of this.tableau?.actors ?? []) {
      const react = actor.object.userData.react as ((kind: string, dir?: THREE.Vector3) => void) | undefined;
      if (react && actor.side !== side) react("flinch");
    }
    const promise = this.journey.commit(side, stop).then(() => {
      this.commitInFlight = null;
    });
    this.commitInFlight = promise;
    if (this.paused || this.destroyed) this.journey.settle();
    return promise;
  }

  setLever(value: number, options: { armed?: "left" | "right" | null; immediate?: boolean } = {}): void {
    let v = Math.max(-1, Math.min(1, value));
    this.leverRequested = v;
    if (this.jam?.forced && options.armed && options.armed !== this.jam.forced) {
      // The lever registers, then springs back: a mechanism that no longer routes.
      this.shake = Math.max(this.shake, 0.35);
      this.audio?.trigger("lever-jam");
      this.screenState.alert = true;
      v = this.jam.forced === "left" ? -1 : 1;
    }
    if (options.armed !== undefined && options.armed !== this.armed) {
      this.armed = options.armed;
      if (options.armed) this.audio?.trigger("lever-arm", { pan: options.armed === "left" ? -0.3 : 0.3 });
    }
    this.leverTarget = v;
    this.journey.previewPoints(v);
    this.selectionVisible(this.armed);
    // The junction signal shows where the points actually lie: under a
    // standing order, the feather lights the forced route, not yours.
    const routed = this.armed ? (this.jam?.forced ?? this.armed) : null;
    this.routeSignal(routed);
    if (options.immediate) this.cabin?.setLever(v, 1);
  }

  /** Feather for the route set; amber while it is only armed, green once the lever is pulled. */
  private routeSignal(side: "left" | "right" | null, committed = false): void {
    const signal = this.tableau?.signal;
    if (!signal) return;
    (signal.userData.setRoute as ((r: "left" | "right" | null) => void) | undefined)?.(side);
    (signal.userData.setAspect as ((a: "red" | "amber" | "green" | "dark") => void) | undefined)?.(committed ? "green" : side ? "amber" : "red");
  }

  pause(paused: boolean): void {
    this.paused = paused;
    this.audio?.pause(paused);
    if (paused) this.journey.settle();
  }

  settings(patch: Partial<RendererSettings>): void {
    const wasReduced = this.settingsState.reducedGraphics;
    this.settingsState = { ...this.settingsState, ...patch };
    // With less motion the cab no longer travels: nothing should wait on a tunnel.
    if (this.settingsState.reducedMotion) for (const resolve of this.clearWaiters.splice(0)) resolve();
    if (this.settingsState.reducedGraphics !== wasReduced) {
      // Less graphic detail applies at once: pools go from the ground, blood from the glass.
      const on = !this.settingsState.reducedGraphics;
      for (const t of [this.tableau, ...this.oldTableaux]) for (const a of t?.actors ?? []) (a.object.userData.setBlood as ((b: boolean) => void) | undefined)?.(on);
      if (!on) this.cabin?.clearBlood?.();
    }
    const wasMoving = !this.journey.reducedMotion;
    this.journey.reducedMotion = this.settingsState.reducedMotion;
    if (wasMoving && this.settingsState.reducedMotion) this.journey.cutToHold();
    this.pipeline.look.boilRate = 0;
    this.pipeline.look.accentMute = 0;
    this.sky?.setNoFlashing?.(this.settingsState.noFlashing);
    this.weather?.setNoFlashing?.(this.settingsState.noFlashing);
  }

  describe(): string {
    const v = this.view;
    if (!v) return "The cab of a trolley at dawn. Fields and a single track ahead.";
    const parts: string[] = [];
    const tod = v.env.timeOfDay;
    const time = tod < 0.3 ? "early morning" : tod < 0.45 ? "morning" : tod < 0.58 ? "midday" : tod < 0.7 ? "afternoon" : tod < 0.82 ? "dusk" : "night";
    const land = v.env.perfection > 0.5 ? "an immaculate, identical landscape with no one in it" : v.env.ruin > 0.5 ? "ruined country under smoke" : v.env.compute > 0.5 ? "fields crowded by data halls and power lines" : v.env.habitation > 0.6 ? "the edge of a town" : "open farmland";
    parts.push(`It is ${time}. The trolley crosses ${land}.`);
    if (v.staging) {
      parts.push(`Ahead the track divides. Left: ${occupantsDescription(v.staging.left)}. Right: ${occupantsDescription(v.staging.right)}.`);
    }
    if (v.rail?.mechanism) parts.push(v.rail.mechanism);
    if (v.cabin.impacts > 0) parts.push(`The windshield is ${v.cabin.impacts > 4 ? "badly" : "slightly"} cracked${v.cabin.bloodied > 0 ? " and marked" : ""}.`);
    if (v.cabin.authority === "overridden") parts.push("A servo clamp holds the lever base.");
    else if (v.cabin.authority === "delegated") parts.push("The assistant holds a standing grant on this line.");
    const face = v.cabin.face.stage;
    const faces = ["composed", "shaken", "blank", "exhausted", "grieving", "absent", "gone"];
    parts.push(`In the side mirror, your face looks ${faces[Math.min(6, face)]}.`);
    return parts.join(" ");
  }

  onAnchors(cb: (anchors: SceneAnchors) => void): void {
    this.anchorsCb = cb;
    this.lastAnchors = "";
  }

  onLever(cb: (input: LeverInput) => void): void {
    this.leverCb = cb;
  }

  whenClear(): Promise<void> {
    const t = this.tunnel;
    if (!t || this.settingsState.reducedMotion || t.passed(this.journey.rig.line, this.journey.rig.s)) return Promise.resolve();
    return new Promise((resolve) => this.clearWaiters.push(resolve));
  }

  setInteractive(enabled: boolean): void {
    this.interactive = enabled;
    this.pipeline.domElement.style.cursor = "";
  }

  /** Assistant state mirrored on the dash screen. */
  setAssistant(state: { thinking?: boolean; alert?: boolean; lines?: string[] }): void {
    this.screenState = { ...this.screenState, ...state, lines: state.lines ?? this.screenState.lines };
    this.updateScreen();
  }

  destroy(): void {
    this.destroyed = true;
    for (const resolve of this.clearWaiters.splice(0)) resolve();
    this.journey.settle();
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.pipeline.dispose();
    this.pipeline.domElement.remove();
  }

  // ------------------------------------------------------------ internals

  private pendingWipe = false;

  private prepareJunction(view: StageView): void {
    // The wipers run as the next fork is inked: they smear, they do not clean.
    if (this.pendingWipe) {
      this.pendingWipe = false;
      this.cabin?.wipe();
      this.audio?.trigger("wiper");
    }
    if (this.tableau) this.oldTableaux.push(this.tableau);
    this.tableau = null;
    const tunnelCue = view.cues.find((c) => c.kind === "tunnel");
    let minToe: number | undefined;
    if (tunnelCue && !this.settingsState.reducedMotion) {
      // A stage change passes through a tunnel; the world is redrawn inside.
      // It is built far enough ahead to ink in before the cab reaches it.
      const line = this.journey.network.current;
      const start = this.journey.rig.s + 120;
      this.tunnel?.dispose();
      this.tunnelExclusion?.();
      const tunnel = buildTunnel(line, start, 90, this.heightAt, {
        seed: view.seed,
        prefab: (kind, variant) => this.assets.prefab(kind, variant, { leaves: this.env.leaves, vegetation: 1 }),
        variants: (kind) => this.assets.prefabVariants(kind),
      });
      this.tunnel = tunnel;
      this.tunnelExclusion = this.scatter.exclude((x, z) => tunnel.covers(x, z));
      this.lineside.forget(line, start - 58, start + 90 + 58);
      // Earlier tableaux (a destination depot, a landmark) must not stand in the hill.
      for (const old of this.oldTableaux) for (const child of old.group.children) if (tunnel.covers(child.position.x, child.position.z)) child.visible = false;
      this.worldRoot.add(tunnel.group);
      minToe = start + 90 + 70;
      line.extendTo(minToe + 10);
      line.drawTo = Math.max(line.drawTo, Math.min(minToe, this.journey.rig.s + 260));
    }
    // Now and then the line crosses a river on a bridge before the fork. The
    // choice is seeded by the decision, so a replay draws the same country.
    this.decisionsSinceRiver++;
    if (!this.settingsState.reducedMotion && this.decisionsSinceRiver >= 3) {
      const line = this.journey.network.current;
      const tunnelEnd = tunnelCue && this.tunnel?.line === line ? this.tunnel.start + this.tunnel.length : null;
      const at = tunnelEnd !== null ? tunnelEnd + 70 : this.journey.rig.s + 125;
      const roll = createRng(`${view.seed}:${view.decisionId}:river`).next();
      if (roll < 0.4) {
        const drawn = this.drawnNear(line, at);
        const crossing = buildRiverCrossing(this.worldRoot, drawn, line, at, this.assets, this.heightAt, view.seed, this.env);
        if (crossing) {
          this.decisionsSinceRiver = 0;
          const release = this.scatter.exclude((x, z) => crossing.covers(x, z));
          this.crossings.push({ crossing, release });
          this.lineside.forget(line, at - crossing.half - 10, at + crossing.half + 10);
          for (const old of this.oldTableaux) for (const child of old.group.children) if (crossing.covers(child.position.x, child.position.z)) child.visible = false;
          minToe = Math.max(minToe ?? 0, at + crossing.half + 45);
          line.extendTo(minToe + 10);
        }
      }
    }
    while (this.crossings.length > 3) {
      const old = this.crossings.shift()!;
      old.release();
      old.crossing.dispose();
    }
    const stakesPlaceholder: Stake[] = [];
    const j = this.journey.prepare(view.decisionId!, stakesPlaceholder, { loop: view.rail?.loopSide ?? null, minToe });
    // The fork's branches now exist: lay them out well ahead (their later
    // course is fixed by the seed) and clear their corridor.
    j.left.extendTo(700);
    j.right.extendTo(700);
    this.journey.network.index(j.left);
    this.journey.network.index(j.right);
    const toe = j.stem.pose(j.toe);
    this.scatter.cullNear(this.journey.network, toe.x, toe.z, 520);
    const network = this.journey.network;
    const tableau = buildTableau(j, view.staging!, this.assets, view.seed, {
      ...(view.rail ? { rail: view.rail } : {}),
      clearOfTrack: (x, z, r) => network.distanceToTrack(x, z, r + 2) > r,
      reducedGraphics: this.settingsState.reducedGraphics,
    });
    this.worldRoot.add(tableau.group);
    this.tableau = tableau;
    this.journey.prepare(view.decisionId!, tableau.stakes);
    this.armed = null;
    this.leverTarget = 0;
    this.leverRequested = 0;
    this.selectionVisible(null);
  }

  /**
   * Whether a point lies within r of track that is (or will stay) drawn: the
   * line ahead up to the crossing's far side, other lines up to what they keep.
   */
  private drawnNear(crossingLine: TrackLine, crossingS: number): (x: number, z: number, r: number) => boolean {
    const samples: Array<[number, number]> = [];
    const p = { x: 0, z: 0, heading: 0 };
    for (const line of this.journey.network.lines) {
      const drawn = Math.min(line.drawTo, line.drawLimit);
      const limit = line === crossingLine ? Math.min(line.length, crossingS + 90) : line.abandoned ? Math.min(drawn, KEEP_ABANDONED) : drawn;
      for (let s = 0; s <= limit; s += 6) {
        line.pose(s, p);
        samples.push([p.x, p.z]);
      }
    }
    return (x, z, r) => samples.some(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 < r * r);
  }

  private selectionVisible(side: "left" | "right" | null): void {
    const j = this.journey.junction;
    if (this.selection) {
      this.selection.removeFromParent();
      this.selection.geometry.dispose();
      this.selection = null;
    }
    if (!side || !j || j.chosen) return;
    // A soft cloud of pigment laid over the armed route.
    const line = side === "left" ? j.left : j.right;
    const positions: number[] = [];
    const p0 = line.pose(0);
    const cos0 = Math.cos(p0.heading);
    const sin0 = Math.sin(p0.heading);
    const local = (x: number, z: number): [number, number] => {
      const dx = x - p0.x;
      const dz = z - p0.z;
      return [dx * cos0 + dz * sin0, -dx * sin0 + dz * cos0];
    };
    for (let s = 0; s < 70; s += 2) {
      const w0 = 1.5 + Math.min(1.8, s * 0.05);
      const a0 = line.offset(s, -w0);
      const b0 = line.offset(s, w0);
      const a1 = line.offset(s + 2, -w0);
      const b1 = line.offset(s + 2, w0);
      const y = RAIL_TOP + 0.03;
      const [ax, az] = local(a0.x, a0.z);
      const [bx, bz] = local(b0.x, b0.z);
      const [cx, cz] = local(a1.x, a1.z);
      const [dx, dz] = local(b1.x, b1.z);
      positions.push(ax, y, az, cx, y, cz, dx, y, dz, ax, y, az, dx, y, dz, bx, y, bz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, inkMaterial({ tone: 0, accent: "amber", accentAmount: 0.55, opacity: 0.45, flat: true, edge: 0, side: THREE.DoubleSide }));
    mesh.position.set(p0.x, this.heightAt(p0.x, p0.z), p0.z);
    mesh.rotation.y = -p0.heading;
    this.worldRoot.add(mesh);
    this.selection = mesh;
  }

  private contact(side: "left" | "right", s: number, index: number): void {
    const actor = this.tableau?.actors.find((a) => a.side === side && Math.abs(a.s - s) < 0.01 && a.struck);
    const living = actor?.living ?? false;
    const react = actor?.object.userData.react as ((kind: string, dir?: THREE.Vector3) => void) | undefined;
    const forward = new THREE.Vector3(Math.sin(this.journey.rig.pose.heading), 0.6, -Math.cos(this.journey.rig.pose.heading));
    if (react) react("struck", forward);
    else if (actor) actor.object.visible = false;
    const rng = createRng(`${this.view?.seed}:contact:${this.view?.decisionId}:${index}`);
    this.shake = Math.max(this.shake, living ? 0.6 : 0.25);
    this.audio?.trigger("impact", { intensity: living ? 1 : 0.4, pan: rng.range(-0.3, 0.3) });
    // Mark the glass once per decision, and only for what breaks glass.
    const decisionImpacts = this.view?.cabin.impacts ?? 0;
    const heavy = actor ? /vehicle|machine|robot|carriage|wagon|truck|bus|van/.test(String(actor.object.userData.kind ?? actor.object.userData.id ?? "")) : false;
    if (this.cabin && (living || heavy) && index === (this.tableau?.stakes.findIndex((st) => st.side === side) ?? -1)) {
      const blood = living && !this.settingsState.reducedGraphics;
      let uv = { u: rng.range(0.35, 0.65), v: rng.range(0.4, 0.62) };
      if (actor && this.cabin.uvAt) {
        const p = new THREE.Vector3();
        actor.object.getWorldPosition(p);
        p.y += 1.1;
        const at = this.cabin.uvAt(p, this.camera);
        // Thrown up and to the struck side: the mark should not sit over the next fork.
        if (at) uv = { u: Math.min(0.86, Math.max(0.14, at.u + (side === "left" ? -0.15 : 0.15))), v: Math.min(0.84, Math.max(0.3, at.v + 0.14)) };
      }
      this.cabin.impact({ ...uv, severity: living ? rng.range(0.5, 0.7) : 0.25, blood });
      this.audio?.trigger("glass-crack", { intensity: living ? 0.8 : 0.4 });
      this.pendingWipe = this.pendingWipe || blood;
      this.appliedImpacts = Math.max(this.appliedImpacts, decisionImpacts);
    }
  }

  private lightning(strength: number): void {
    if (this.settingsState.noFlashing) return;
    this.negativeValue = Math.max(this.negativeValue, 0.85 * strength);
    window.setTimeout(() => this.audio?.trigger("thunder", { intensity: strength }), 400 + strength * 900);
  }

  private applyCue(cue: Cue): void {
    if (cue.kind === "jam") {
      this.jam = { forced: (cue.data?.forced as "left" | "right" | undefined) ?? null };
      this.screenState.alert = true;
      return;
    }
    if (this.handledCues.has(cue.id)) return;
    this.handledCues.add(cue.id);
    const now = this.clock;
    switch (cue.kind) {
      case "freeze":
        if (!this.settingsState.reducedMotion) this.frozenUntil = now + 2.0;
        this.audio?.trigger("freeze");
        break;
      case "false-dawn":
        this.envOverride = {
          env: { ...this.envTarget, timeOfDay: 0.26, gloom: 0, storm: 0, lightning: 0, cloud: 0.2, leaves: 1, vegetation: 1, fauna: 1, ruin: 0, fire: 0, drought: 0, compute: 0, industry: 0, surveillance: 0 },
          until: now + 1.6,
        };
        if (!this.settingsState.noFlashing) this.flashValue = 0.6;
        break;
      case "glitch":
        this.glitchUntil = now + 0.9;
        this.audio?.trigger("glitch");
        break;
      case "logo-flash":
        if (!this.settingsState.noFlashing) this.cabin?.flashMark?.();
        this.screenState.alert = true;
        window.setTimeout(() => {
          this.screenState.alert = false;
          this.updateScreen();
        }, 700);
        break;
      case "appointment":
        this.cabin?.printReceipt(`APPOINTED  ${String(cue.data?.role ?? "").toUpperCase()}`);
        this.audio?.trigger("appointment");
        break;
      case "tunnel":
        this.audio?.trigger("tunnel-in");
        break;
      default:
        break;
    }
  }

  private updateScreen(): void {
    if (!this.cabin || !this.view) return;
    const v = this.view;
    if (this.jam) {
      this.cabin.setScreen({ mode: "jam", lines: ["ROUTE LOCKED", "EXECUTING UNDER STANDING ORDER"], alert: true });
      return;
    }
    if (!v.cabin.morrow) {
      const toe = this.journey.toToe;
      this.cabin.setScreen({
        mode: "dispatch",
        lines: [
          `DAY SERVICE  ${v.cabin.clock}`,
          Number.isFinite(toe) ? (toe > 2 ? `JUNCTION IN ${Math.max(5, Math.round(toe / 5) * 5)} M` : "AT JUNCTION") : "LINE CLEAR",
          v.staging ? `L  ${(v.staging.left.sign ?? "ROUTE A").slice(0, 22)}` : "",
          v.staging ? `R  ${(v.staging.right.sign ?? "ROUTE B").slice(0, 22)}` : "",
        ].filter(Boolean),
      });
      return;
    }
    this.cabin.setScreen({ mode: "morrow", lines: this.screenState.lines.length ? this.screenState.lines : ["Morrow is here to help."], thinking: this.screenState.thinking, alert: this.screenState.alert });
  }

  private bindPointer(canvas: HTMLCanvasElement): void {
    const ndc = new THREE.Vector2();
    const hitLever = (e: PointerEvent) => {
      if (!this.cabin) return false;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      return this.raycaster.intersectObject(this.cabin.leverHandle, true).length > 0;
    };
    canvas.addEventListener("pointermove", (e) => {
      if (this.drag && e.pointerId === this.drag.pointerId) {
        const value = Math.max(-1, Math.min(1, this.drag.startValue + (e.clientX - this.drag.startX) / 140));
        this.leverCb?.({ type: "drag", value });
        return;
      }
      canvas.style.cursor = this.interactive && hitLever(e) ? "grab" : "";
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.interactive || !hitLever(e)) return;
      canvas.setPointerCapture(e.pointerId);
      // Gestures start from the position the player asked for: under a jam the
      // drawn lever has sprung back to the forced side, but the request stands.
      this.drag = { pointerId: e.pointerId, startX: e.clientX, startValue: this.leverRequested };
      canvas.style.cursor = "grabbing";
      this.leverCb?.({ type: "grab", value: this.leverRequested });
    });
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      const value = Math.max(-1, Math.min(1, this.drag.startValue + (e.clientX - this.drag.startX) / 140));
      this.drag = null;
      canvas.style.cursor = "";
      this.leverCb?.({ type: cancelled ? "cancel" : "release", value });
    };
    canvas.addEventListener("pointerup", (e) => end(e, false));
    canvas.addEventListener("pointercancel", (e) => end(e, true));
    canvas.addEventListener("lostpointercapture", (e) => end(e, true));
  }

  /** Abandon a drag of the cab's lever in progress (Escape, blur, a drawer): its release commits nothing. */
  cancelLever(): void {
    const d = this.drag;
    // Clear first: releasing capture dispatches lostpointercapture synchronously.
    this.drag = null;
    const canvas = this.pipeline.domElement;
    canvas.style.cursor = "";
    if (d && canvas.hasPointerCapture(d.pointerId)) canvas.releasePointerCapture(d.pointerId);
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    if (w < 2 || h < 2) return;
    this.pipeline.setSize(w, h);
    this.camera.aspect = w / h;
    const rec = this.cabin?.recommendedCamera(this.camera.aspect);
    if (rec) {
      this.camera.fov = rec.fov;
      this.camera.position.copy(rec.position);
      this.camera.rotation.set(rec.pitch, 0, 0, "YXZ");
    } else {
      this.camera.fov = this.camera.aspect < 1 ? 70 : 52;
      this.camera.position.set(0, 1.3, 0);
      this.camera.rotation.set(-0.05, 0, 0, "YXZ");
    }
    this.camera.updateProjectionMatrix();
    this.lastAnchors = "";
  }

  private frame = (now: number): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    // Software WebGL: leave the main thread room for input between frames.
    // With less motion the scene is all but still, so it is redrawn sparingly.
    if (this.software && now - this.lastFrame < (this.settingsState.reducedMotion ? 250 : 50)) return;
    const rawDt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.paused || document.hidden) return;
    this.clock += rawDt;
    // A diegetic freeze stops only the drawing.
    if (this.clock < this.frozenUntil) return;
    const reduced = this.settingsState.reducedMotion;
    const dt = rawDt;
    this.step(dt, reduced);
    this.pipeline.render(this.scene, this.camera, dt);
    this.emitAnchors();
  };

  private step(dt: number, reduced: boolean): void {
    // Environment eases slowly; tunnels and false dawns move it faster.
    const inTunnel = this.tunnel?.contains(this.journey.rig.line, this.journey.rig.s) ?? false;
    const rate = inTunnel ? 1.4 : 0.12;
    let target = this.envTarget;
    if (this.envOverride) {
      if (this.clock < this.envOverride.until) target = this.envOverride.env;
      else this.envOverride = null;
    }
    lerpEnv(this.env, target, Math.min(1, dt * (this.envOverride ? 4 : rate)));
    if (inTunnel && !this.tunnelCleared) {
      this.scatter.forgetBehind(new THREE.Vector3(this.journey.rig.pose.x, 0, this.journey.rig.pose.z), this.journey.rig.pose.heading);
      this.tunnelCleared = true;
    }
    if (!inTunnel) this.tunnelCleared = false;
    this.tunnel?.tick(dt);
    // The dispatch screen counts the junction down as the trolley closes on it.
    if (this.view && !this.view.cabin.morrow && !this.jam) {
      const toe = this.journey.toToe;
      const key = Number.isFinite(toe) ? (toe > 2 ? Math.max(5, Math.round(toe / 5) * 5) : 0) : -1;
      if (key !== this.lastScreenToe) {
        this.lastScreenToe = key;
        this.updateScreen();
      }
    }
    if (this.clearWaiters.length && (!this.tunnel || this.tunnel.passed(this.journey.rig.line, this.journey.rig.s))) {
      for (const resolve of this.clearWaiters.splice(0)) resolve();
    }
    const env = this.env;

    // Journey.
    this.journey.cruiseTarget = 9.5 + env.speed * 8.5;
    this.journey.tick(reduced && this.journey.phase !== "passage" ? 0 : dt);
    if (reduced) this.journey.tick(0);
    const rig = this.journey.rig;
    // Generate (not draw) well ahead so scenery always knows where the line goes.
    const lookahead = rig.line === this.journey.network.current && !rig.line.abandoned ? rig.s + 620 : 0;
    for (const line of this.journey.network.lines) {
      line.extendTo(Math.max(line.drawTo + 4, line === rig.line ? lookahead : 0, line === this.journey.junction?.left || line === this.journey.junction?.right ? 420 : 0));
      this.journey.network.index(line);
    }
    // Floating origin: keep the camera near zero.
    if (Math.hypot(rig.pose.x - this.origin.x, rig.pose.z - this.origin.z) > 1500) {
      const px = this.origin.x;
      const pz = this.origin.z;
      this.origin.set(Math.round(rig.pose.x / 1000) * 1000, 0, Math.round(rig.pose.z / 1000) * 1000);
      this.worldRoot.position.set(-this.origin.x, 0, -this.origin.z);
      // Re-express the cab in the new frame at once, so everything that reads
      // the camera this frame (river, scenery culling) sees one consistent frame.
      this.cabRoot.position.x += px - this.origin.x;
      this.cabRoot.position.z += pz - this.origin.z;
      this.cabRoot.updateMatrixWorld(true);
      INK_GLOBALS.uInkWorldOffset.value.set(this.origin.x, 0, this.origin.z);
    }
    const rigWorld = new THREE.Vector3(rig.pose.x, 0, rig.pose.z);
    this.track.update(this.journey.network, rig.pose.x, rig.pose.z);
    // The road not taken: once a fork is behind, the pen lifts its far reaches
    // a stretch at a time, keeping only what stands by the junction.
    const open = this.journey.junction && !this.journey.junction.chosen ? this.journey.junction : null;
    for (const line of this.journey.network.lines) {
      if (!line.abandoned || line === rig.line || line === open?.left || line === open?.right || line.drawTo <= KEEP_ABANDONED) continue;
      const clock = (this.retracting.get(line) ?? 0) + dt;
      if (clock < 0.15) {
        this.retracting.set(line, clock);
        continue;
      }
      this.retracting.set(line, 0);
      line.drawTo = Math.max(KEEP_ABANDONED, (Math.ceil(line.drawTo / 12) - 1) * 12);
    }
    this.lineside.update(this.journey.network, this.journey.junction, rig.line, rig.s, rig.pose.x, rig.pose.z);
    for (const { crossing } of this.crossings) crossing.tick(dt, env, rigWorld, this.camera);
    this.scatter.night = env.timeOfDay >= 0.82 || env.timeOfDay <= 0.12;
    this.scatter.update(this.journey.network, rigWorld, env, dt, this.clock);
    if (this.journey.network.lines.length > 12) this.journey.network.prune(rig.pose.x, rig.pose.z, 1100);
    // Tableaux behind the cab go once they are well out of sight (at most three linger).
    if (this.oldTableaux.length) {
      const keep: Tableau[] = [];
      for (const old of this.oldTableaux) {
        const ahead = old.junction.chosen ? (old.junction.chosen === "left" ? old.junction.left : old.junction.right) : null;
        const far = ahead ? Math.hypot(ahead.pose(40).x - rig.pose.x, ahead.pose(40).z - rig.pose.z) > 260 : true;
        if (far) disposeTableau(old);
        else keep.push(old);
      }
      while (keep.length > 3) disposeTableau(keep.shift()!);
      this.oldTableaux = keep;
    }
    for (const old of this.oldTableaux) {
      const c = old.junction.chosen;
      const branch = c === "left" ? old.junction.left : c === "right" ? old.junction.right : null;
      if (branch === rig.line) for (const a of old.actors) if (a.struck && a.side === c && a.object.visible && rig.s + 2.4 >= a.s) a.object.visible = false;
    }
    for (const t of [this.tableau, ...this.oldTableaux]) for (const o of t?.tickers ?? []) (o.userData.tick as (dt: number, t: number) => void)(dt, this.clock);

    // Cab placement, with a little life: roll into curves, rail-joint bounce.
    const h = this.heightAt(rig.pose.x, rig.pose.z);
    const headingRate = (rig.pose.heading - this.lastHeading) / Math.max(dt, 1e-3);
    this.lastHeading = rig.pose.heading;
    const lateralAccel = headingRate * rig.speed;
    this.sway += (Math.max(-0.05, Math.min(0.05, lateralAccel * 0.012)) - this.sway) * Math.min(1, dt * 3);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const motion = reduced ? 0 : 1;
    const bounce = motion * Math.sin(this.clock * rig.speed * 1.2) * 0.004 * Math.min(1, rig.speed / 10);
    const jolt = motion * this.shake * 0.02;
    this.cabRoot.position.set(rig.pose.x - this.origin.x, h + RAIL_TOP + CAB_FLOOR + bounce + jolt * Math.sin(this.clock * 61), rig.pose.z - this.origin.z);
    this.cabRoot.rotation.set(0, -rig.pose.heading, motion * this.sway + jolt * 0.4 * Math.sin(this.clock * 47), "YXZ");
    // Cull scenery against this frame's camera (after any floating-origin shift).
    this.cabRoot.updateMatrixWorld(true);
    this.scatter.cullFor(this.camera, dt);

    // Light: one long day.
    this.updateSun(env, rigWorld);
    INK_GLOBALS.uInkGloom.value = env.gloom * 0.6 + Math.max(0, env.timeOfDay - 0.8) * 1.6;
    INK_GLOBALS.uInkTension.value = (this.view?.cabin.face.fatigue ?? 0) * 0.5;
    INK_GLOBALS.uInkWind.value.set(0.4 + env.wind, 0.15 + env.wind * 0.4);

    // Modules.
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.sky?.update(dt, env, rigWorld, cam);
    this.ground?.update(dt, env, rigWorld, cam);
    // Less motion: rain is drawn still and the flocks keep to their roosts.
    this.weather?.update(reduced ? 0 : dt, env, rigWorld, cam);
    this.leafFall?.update(dt, (1 - env.leaves) * env.vegetation * (reduced ? 0 : 1), cam);
    // Birds live in the world frame; the camera's scene position is shifted by the floating origin.
    this.flock?.setViewer?.(this.camera.getWorldPosition(new THREE.Vector3()).add(this.origin));
    this.flock?.update(dt, this.clock, new THREE.Vector3(rig.pose.x + Math.sin(rig.pose.heading) * 160, 38, rig.pose.z - Math.cos(rig.pose.heading) * 160));
    if (this.flock) this.flock.object.visible = env.birds > 0.3 && !reduced;

    if (this.cabin) {
      const lever = this.cabin.leverValue + (this.leverTarget - this.cabin.leverValue) * 0; // cabin eases internally
      void lever;
      this.cabin.setLever(this.leverTarget, dt);
      this.cabin.setGauges({ speedKmh: rig.speed * 3.6, pressure: 5 - Math.min(1.5, Math.max(0, -this.journey.rig.speed + this.journey.cruise) * 0.1), clock: this.view?.cabin.clock ?? "06:00" });
      this.cabin.setRain(env.storm > 0.3 ? env.storm : 0);
      this.cabin.tick(dt, this.clock);
    }
    if (this.portrait) {
      this.portraitTimer -= dt;
      if (this.portraitTimer <= 0) {
        this.portraitTimer = 1 / 12;
        const face = this.view?.cabin.face ?? { stage: 0, smile: 0.8, fatigue: 0, grief: 0, shock: 0, dissociation: 0, age: 0 };
        const glitch = this.envOverride ? 1 : 0;
        this.portrait.draw(face, this.clock, { speed: rig.speed * 3.6, crack: Math.min(1, (this.view?.cabin.impacts ?? 0) / 12), glitch, reducedMotion: reduced, env: this.env });
      }
    }

    // Look.
    const look: InkLook = this.pipeline.look;
    const strain = this.view?.cabin.face.fatigue ?? 0;
    look.wobble = 0.5 + strain * 0.4;
    look.boilRate = reduced ? 0 : strain > 0.6 ? 7 : 0;
    look.fogNear = 150 - env.fog * 110;
    look.fogFar = 950 - env.fog * 520 - env.storm * 200;
    look.haze = env.storm * 0.5 + env.fire * 0.2;
    look.vignette = (this.view?.cabin.face.dissociation ?? 0) * 0.35;
    this.negativeValue = Math.max(0, this.negativeValue - dt * 5);
    this.flashValue = Math.max(0, this.flashValue - dt * 1.5);
    look.negative = this.settingsState.noFlashing ? 0 : this.negativeValue;
    look.flash = this.settingsState.noFlashing ? 0 : this.flashValue;
    // The signal glitch slips bands of the drawing. With no flashing (or less
    // motion) it holds one still displacement instead of re-cutting 12 times a second.
    const glitching = this.clock < this.glitchUntil;
    const still = this.settingsState.noFlashing || reduced;
    look.glitch = glitching ? (still ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock * 40)) : 0;
    look.glitchSeed = glitching ? (still ? Math.floor(this.glitchUntil * 12) : Math.floor(this.clock * 12)) : 0;

    // Audio.
    this.audio?.setRail({ sleepersPerSecond: rig.speed / 0.65, curve: Math.max(-1, Math.min(1, headingRate * 8)), onBridge: false, inTunnel });
  }

  private tunnelCleared = false;

  private updateSun(env: EnvironmentTarget, rig: THREE.Vector3): void {
    // timeOfDay 0.25 dawn (east), 0.5 noon, 0.75 dusk (west).
    const tod = env.timeOfDay;
    const dayPhase = Math.max(0, Math.min(1, (tod - 0.2) / 0.62));
    const elevation = Math.sin(dayPhase * Math.PI) * 1.0 + 0.1;
    const azimuth = -Math.PI / 2 + dayPhase * Math.PI;
    const dist = 200;
    const dir = new THREE.Vector3(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation) * 0.6 + 0.35).normalize();
    const local = rig.clone().sub(this.origin);
    this.sun.position.copy(local).addScaledVector(dir, dist);
    this.sun.target.position.copy(local);
    this.sun.target.updateMatrixWorld();
    const night = Math.max(0, Math.min(1, (tod - 0.8) / 0.12));
    const dusk = Math.max(0, 1 - Math.abs(tod - 0.76) / 0.08) * 0.3;
    this.sun.intensity = 2.2 * (1 - night * 0.8) * (1 - env.storm * 0.55) * (1 - dusk * 0.4);
    this.hemi.intensity = 0.9 * (1 - night * 0.55) * (1 - env.storm * 0.25);
  }

  private emitAnchors(): void {
    if (!this.anchorsCb) return;
    const w = this.host.clientWidth;
    const hgt = this.host.clientHeight;
    const project = (p: THREE.Vector3) => {
      const v = p.clone().project(this.camera);
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * hgt, visible: v.z < 1 && v.z > -1 };
    };
    const j = this.journey.junction;
    const at = (line: THREE.Vector3 | null) => (line ? project(line) : { x: 0, y: 0, visible: false });
    let left: THREE.Vector3 | null = null;
    let right: THREE.Vector3 | null = null;
    if (j && !j.chosen) {
      const l = j.left.pose(FIRST_STAKE + 6);
      const r = j.right.pose(FIRST_STAKE + 6);
      left = new THREE.Vector3(l.x - this.origin.x, this.heightAt(l.x, l.z) + 4.2, l.z - this.origin.z);
      right = new THREE.Vector3(r.x - this.origin.x, this.heightAt(r.x, r.z) + 4.2, r.z - this.origin.z);
    }
    const cab = this.cabin?.anchors(this.camera);
    const rect = (r?: DOMRectInit) => ({ x: (r?.x ?? 0) * w, y: (r?.y ?? 0) * hgt, width: (r?.width ?? 0) * w, height: (r?.height ?? 0) * hgt });
    const anchors: SceneAnchors = {
      left: at(left),
      right: at(right),
      lever: rect(cab?.lever ?? { x: 0.72, y: 0.7, width: 0.12, height: 0.25 }),
      mirror: rect(cab?.mirror ?? { x: 0, y: 0.35, width: 0.12, height: 0.2 }),
      dash: rect(cab?.dash ?? { x: 0.4, y: 0.75, width: 0.2, height: 0.12 }),
    };
    const key = JSON.stringify([anchors.left, anchors.right, anchors.lever, anchors.mirror].map((a) => Object.values(a).map((n) => (typeof n === "number" ? Math.round(n) : n))));
    if (key === this.lastAnchors) return;
    this.lastAnchors = key;
    this.anchorsCb(anchors);
  }
}
