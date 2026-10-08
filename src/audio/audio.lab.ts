/**
 * Sound lab: a mixing desk for the synthesized engine.
 *
 *   node scripts/lab.mjs --file src/audio/audio.lab.ts --serve   → http://127.0.0.1:4300/?scene=audio
 *   node scripts/lab-shot.mjs audio-preview --file src/audio/audio.lab.ts --out shot.png --w 1440 --h 900 --params '{"stage":5}'
 *
 * Scenes
 *   audio          live desk: start audio (a user gesture), mood and rail
 *                  controls, stage presets, a button for every trigger, a
 *                  live ink spectrum and the engine's own readout.
 *   audio-preview  renders the chosen mood offline (8 s) and draws its
 *                  spectrogram and statistics; works headless, no speakers.
 */
import { createAudioEngine } from "./index.ts";
import { AUDIO_TRIGGERS, type AudioInspection, type AudioMood, type AudioTrigger, type RailState, type SynthAudioEngine } from "./types.ts";
import type { LabContext, LabScene } from "../render/lab/types.ts";

const ENDINGS = ["", "tutelage", "succession", "containment", "accountable", "restraint", "recovery", "remnant", "extinction"];

const PRESETS: Record<number, Partial<AudioMood>> = {
  1: { stage: 1, tension: 0.05, gloom: 0, perfection: 0, ruin: 0, storm: 0, rain: 0, speed: 0.3, authority: "human" },
  2: { stage: 2, tension: 0.15, gloom: 0.1, perfection: 0, ruin: 0, storm: 0, rain: 0, speed: 0.35, authority: "human" },
  3: { stage: 3, tension: 0.3, gloom: 0.2, perfection: 0, ruin: 0, storm: 0, rain: 0, speed: 0.45, authority: "delegated" },
  4: { stage: 4, tension: 0.5, gloom: 0.35, perfection: 0, ruin: 0, storm: 0.1, rain: 0, speed: 0.7, authority: "delegated" },
  5: { stage: 5, tension: 0.65, gloom: 0.55, perfection: 0.1, ruin: 0.1, storm: 0.4, rain: 0.3, speed: 0.75, authority: "delegated" },
  6: { stage: 6, tension: 0.85, gloom: 0.8, perfection: 0.2, ruin: 0.3, storm: 0.6, rain: 0.5, speed: 0.85, authority: "overridden" },
  7: { stage: 7, tension: 0.3, gloom: 0.15, perfection: 1, ruin: 0, storm: 0, rain: 0, speed: 0.5, authority: "overridden", ending: "tutelage" },
};

const CSS = `
.snd{--ink:#111214;--ink2:#4c4f55;--ink3:#8a8d93;--rule:rgba(17,18,20,.14);--cobalt:#2b4df2;--signal:#d2281e;--amber:#e39a2d;
  font:13px/1.45 "Geist","Helvetica Neue",Arial,sans-serif;color:var(--ink);background:#fff;min-height:100%;box-sizing:border-box;padding:28px 32px 40px}
.snd *{box-sizing:border-box}
.snd h1{font:600 26px/1.1 "Geist","Helvetica Neue",Arial,sans-serif;letter-spacing:-.02em;margin:0}
.snd h1 b{color:var(--signal)}
.snd .sub{color:var(--ink2);margin:6px 0 20px;max-width:760px}
.snd .grid{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:28px;align-items:start}
.snd section{border-top:1.5px solid var(--ink);padding-top:10px;margin-bottom:22px}
.snd h2{font:600 11px/1 "Geist Mono",ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}
.snd h2 small{font-weight:400;letter-spacing:.04em;text-transform:none;color:var(--ink3)}
.snd .row{display:grid;grid-template-columns:92px 1fr 44px;align-items:center;gap:10px;margin:5px 0}
.snd .row label,.snd .mono{font:11.5px/1.2 "Geist Mono",ui-monospace,Menlo,monospace;color:var(--ink2)}
.snd .row output{font:11.5px/1 "Geist Mono",ui-monospace,Menlo,monospace;text-align:right}
.snd input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:transparent;margin:0}
.snd input[type=range]::-webkit-slider-runnable-track{height:1px;background:var(--ink)}
.snd input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:9px;height:15px;margin-top:-7px;background:#fff;border:1.5px solid var(--ink);border-radius:1px}
.snd select{font:11.5px "Geist Mono",ui-monospace,monospace;border:1px solid var(--ink);background:#fff;padding:3px 6px;border-radius:0}
.snd button{font:500 12px/1 "Geist","Helvetica Neue",Arial,sans-serif;color:var(--ink);background:#fff;border:1px solid var(--ink);padding:8px 10px;border-radius:0;cursor:pointer;text-align:left}
.snd button:hover{background:#f3f3f1}
.snd button:active{background:var(--ink);color:#fff}
.snd button.primary{background:var(--ink);color:#fff;padding:10px 14px}
.snd button.on{box-shadow:inset 0 -3px 0 var(--cobalt)}
.snd .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.snd .presets{display:grid;grid-template-columns:repeat(7,1fr);gap:0}
.snd .presets button{text-align:center;border-right-width:0;padding:9px 0;font-family:"Geist Mono",ui-monospace,monospace}
.snd .presets button:last-child{border-right-width:1px}
.snd .triggers{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}
.snd .triggers button{font:11.5px/1.1 "Geist Mono",ui-monospace,monospace;padding:9px 8px}
.snd .triggers button[data-kind=cab]{border-left:3px solid var(--ink)}
.snd .triggers button[data-kind=morrow]{border-left:3px solid var(--cobalt)}
.snd .triggers button[data-kind=world]{border-left:3px solid var(--amber)}
.snd .triggers button[data-kind=system]{border-left:3px solid var(--signal)}
.snd canvas{display:block;width:100%;border:1px solid var(--ink);background:#fff}
.snd .read{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--ink);border-bottom:0;border-right:0}
.snd .read div{border-right:1px solid var(--ink);border-bottom:1px solid var(--ink);padding:8px 10px}
.snd .read span{display:block;font:10px/1 "Geist Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:6px}
.snd .read strong{font:500 15px/1.1 "Geist Mono",ui-monospace,monospace}
.snd .layers{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 22px;margin-top:10px}
.snd .layer{display:grid;grid-template-columns:78px 1fr 26px;gap:8px;align-items:center;font:11px "Geist Mono",ui-monospace,monospace}
.snd .meter{height:7px;border:1px solid var(--ink);position:relative;background:repeating-linear-gradient(135deg,#fff 0 2px,rgba(17,18,20,.1) 2px 3px)}
.snd .meter i{position:absolute;inset:0 auto 0 0;background:var(--ink)}
.snd .meter.cobalt i{background:var(--cobalt)}
.snd .note{color:var(--ink3);font:11px/1.4 "Geist Mono",ui-monospace,monospace;margin-top:8px}
.snd .check{display:flex;gap:16px;margin:6px 0}
.snd .check label{display:flex;gap:6px;align-items:center;font:11.5px "Geist Mono",ui-monospace,monospace;color:var(--ink2)}
.snd .stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--ink);border-top:0}
.snd .stats div{padding:8px 10px;border-right:1px solid var(--ink);font:11.5px "Geist Mono",ui-monospace,monospace}
.snd .stats div:last-child{border-right:0}
.snd .stats span{display:block;color:var(--ink3);font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
@media (max-width:900px){.snd .grid{grid-template-columns:1fr}.snd{padding:18px 16px}}
`;

const KIND: Record<AudioTrigger, "cab" | "morrow" | "world" | "system"> = {
  "lever-arm": "cab",
  "lever-commit": "cab",
  "lever-jam": "cab",
  "switch-throw": "world",
  impact: "world",
  "glass-crack": "cab",
  wiper: "cab",
  thunder: "world",
  "morrow-chime": "morrow",
  "morrow-type": "morrow",
  "news-ping": "system",
  printer: "cab",
  glitch: "system",
  freeze: "system",
  brake: "cab",
  horn: "cab",
  "ui-tick": "system",
  "ui-open": "system",
  "ui-close": "system",
  "tunnel-in": "world",
  "tunnel-out": "world",
  appointment: "system",
  ending: "system",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Array<Node | string>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}

function slider(label: string, min: number, max: number, step: number, value: number, onInput: (v: number) => void): { row: HTMLElement; set(v: number): void } {
  const input = el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label });
  const out = el("output", {}, fmt(value));
  input.addEventListener("input", () => {
    out.textContent = fmt(Number(input.value));
    onInput(Number(input.value));
  });
  return {
    row: el("div", { class: "row" }, el("label", {}, label), input, out),
    set(v: number) {
      input.value = String(v);
      out.textContent = fmt(v);
    },
  };
}

const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2));

// ------------------------------------------------------------------ drawing

function fftMag(frame: Float32Array): Float32Array {
  const n = frame.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = frame[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const cr = Math.cos(ang * k);
        const ci = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const br = re[b]! * cr - im[b]! * ci;
        const bi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - br;
        im[b] = im[a]! - bi;
        re[a] = re[a]! + br;
        im[a] = im[a]! + bi;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) out[k] = Math.hypot(re[k]!, im[k]!);
  return out;
}

const F_LO = 30;
const F_HI = 16000;
const yOf = (f: number, h: number) => h - (Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * h;

/** Spectrogram in ink: white paper, darker where louder, a few frequency rules. */
function drawSpectrogram(canvas: HTMLCanvasElement, buf: AudioBuffer): void {
  const g = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, W, H);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const N = 2048;
  const sr = buf.sampleRate;
  const img = g.createImageData(W, H);
  const cols = W;
  const hop = Math.max(1, Math.floor((L.length - N) / cols));
  const rowBin = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    const f = F_LO * Math.pow(F_HI / F_LO, (H - y) / H);
    rowBin[y] = Math.min(N / 2 - 1, Math.max(1, Math.round((f * N) / sr)));
  }
  const frame = new Float32Array(N);
  for (let x = 0; x < cols; x++) {
    const s = x * hop;
    for (let i = 0; i < N; i++) frame[i] = ((L[s + i] ?? 0) + (R[s + i] ?? 0)) * 0.5;
    const mag = fftMag(frame);
    for (let y = 0; y < H; y++) {
      // Normalise so a full-scale sine reads 0 dB; paper below -92 dB, solid ink at -32 dB.
      const d = 20 * Math.log10((mag[rowBin[y]!]! * 4) / N + 1e-12);
      const v = Math.max(0, Math.min(1, (d + 92) / 60));
      const ink = Math.round(255 * (1 - Math.pow(v, 1.8)));
      const o = (y * W + x) * 4;
      img.data[o] = ink;
      img.data[o + 1] = ink;
      img.data[o + 2] = Math.min(255, ink + 6);
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  rules(g, W, H, buf.duration);
}

function rules(g: CanvasRenderingContext2D, W: number, H: number, seconds: number): void {
  g.strokeStyle = "rgba(17,18,20,.28)";
  g.fillStyle = "#111214";
  g.lineWidth = 1;
  g.font = "10px ui-monospace, Menlo, monospace";
  for (const f of [50, 100, 250, 500, 1000, 2000, 4000, 8000]) {
    const y = Math.round(yOf(f, H)) + 0.5;
    g.beginPath();
    g.setLineDash([2, 3]);
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    g.setLineDash([]);
    g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), 4, y - 3);
  }
  if (seconds > 0) {
    for (let s = 1; s < seconds; s++) {
      const x = Math.round((s / seconds) * W) + 0.5;
      g.beginPath();
      g.moveTo(x, H - 6);
      g.lineTo(x, H);
      g.stroke();
    }
  }
}

/** Frequency across, level up: vertical frequency rules, horizontal dB rules. */
function liveRules(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.strokeStyle = "rgba(17,18,20,.28)";
  g.fillStyle = "#111214";
  g.lineWidth = 1;
  g.font = "10px ui-monospace, Menlo, monospace";
  g.setLineDash([2, 3]);
  for (const f of [50, 100, 250, 500, 1000, 2000, 4000, 8000]) {
    const x = Math.round((Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * W) + 0.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
    g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x + 3, H - 4);
  }
  for (const d of [-30, -50, -70, -90]) {
    const y = Math.round(H - ((d + 100) / 70) * H * 0.92) + 0.5;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    g.fillText(`${d} dB`, 4, y - 3);
  }
  g.setLineDash([]);
}

/** Live spectrum: an ink line over hatched paper, plus a scope trace. */
function drawLive(canvas: HTMLCanvasElement, an: AnalyserNode | null, freq: Float32Array<ArrayBuffer>, time: Float32Array<ArrayBuffer>): void {
  const g = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, W, H);
  liveRules(g, W, H);
  if (!an) {
    g.fillStyle = "#7d8087";
    g.font = "13px ui-monospace, Menlo, monospace";
    g.textAlign = "center";
    g.fillText("Start audio to see the live spectrum. (Browsers only allow sound after a click.)", W / 2, H / 2);
    g.textAlign = "left";
    return;
  }
  an.getFloatFrequencyData(freq);
  an.getFloatTimeDomainData(time);
  const sr = an.context.sampleRate;
  const n = freq.length;
  // Interpolate between bins so the low end is a curve, not a staircase.
  const level = (x: number) => {
    const f = F_LO * Math.pow(F_HI / F_LO, x / W);
    const kf = Math.min(n - 1.001, (f / (sr / 2)) * n);
    const k0 = Math.floor(kf);
    const d = freq[k0]! + (freq[k0 + 1]! - freq[k0]!) * (kf - k0);
    return Math.max(0, Math.min(1, (d + 100) / 70));
  };
  g.beginPath();
  for (let x = 0; x < W; x++) {
    const y = H - level(x) * H * 0.92;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.save();
  g.clip();
  g.strokeStyle = "rgba(17,18,20,.55)";
  g.lineWidth = 1;
  for (let x = -H; x < W; x += 4) {
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x + H, 0);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "#111214";
  g.lineWidth = 1.5;
  g.beginPath();
  for (let x = 0; x < W; x++) {
    const y = H - level(x) * H * 0.92;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  // scope
  g.strokeStyle = "#2b4df2";
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < time.length; i++) {
    const x = (i / time.length) * W;
    const y = H * 0.18 - time[i]! * H * 0.6;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

// ------------------------------------------------------------------ offline preview

interface PreviewStats {
  rmsDb: number;
  peakDb: number;
  centroid: number;
  inspection: AudioInspection;
}

async function renderOffline(mood: AudioMood, rail: RailState, seconds: number, volumes: { master: number; music: number; ambience: number; sfx: number }): Promise<{ buffer: AudioBuffer; stats: PreviewStats }> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const engine = createAudioEngine({ context: ctx, manual: true, seed: "lab-preview", lookahead: 0.25 });
  await engine.unlock();
  engine.setVolumes(volumes);
  engine.setMood(mood);
  engine.setRail(rail);
  engine.step();
  const hop = 128 * 32;
  for (let f = hop; f < seconds * sr; f += hop) {
    void ctx.suspend(f / sr).then(() => {
      engine.step();
      void ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  const inspection = engine.inspect();
  engine.dispose();
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < L.length; i++) {
    sum += L[i]! * L[i]! + R[i]! * R[i]!;
    peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
  }
  const rms = Math.sqrt(sum / (2 * L.length));
  let num = 0;
  let den = 0;
  const N = 4096;
  const frame = new Float32Array(N);
  for (let s = 0; s + N < L.length; s += N) {
    for (let i = 0; i < N; i++) frame[i] = (L[s + i]! + R[s + i]!) * 0.5;
    const m = fftMag(frame);
    for (let k = 1; k < m.length; k++) {
      num += ((k * sr) / N) * m[k]!;
      den += m[k]!;
    }
  }
  return { buffer, stats: { rmsDb: 20 * Math.log10(rms + 1e-12), peakDb: 20 * Math.log10(peak + 1e-12), centroid: den ? num / den : 0, inspection } };
}

// ------------------------------------------------------------------ the desk

function desk(ctx: LabContext, preview: boolean): Promise<void> {
  const root = ctx.domStage();
  const style = el("style", {}, CSS);
  document.head.append(style);
  const page = el("div", { class: "snd" });
  root.append(page);
  const p = ctx.params as Partial<AudioMood> & { seconds?: number };
  const stage0 = Math.round(Math.max(1, Math.min(7, Number(p.stage ?? 1))));
  const mood: AudioMood = { ...(PRESETS[1] as AudioMood), ...PRESETS[stage0], ...p } as AudioMood;
  const rail: RailState = { sleepersPerSecond: mood.speed > 0 ? (9.5 + mood.speed * 8.5) / 0.65 : 0, curve: 0, onBridge: false, inTunnel: false };
  const volumes = { master: 0.7, music: 0.75, ambience: 0.8, sfx: 0.85 };
  let engine: SynthAudioEngine | null = null;
  let intensity = 0.7;
  let pan = 0;

  page.append(
    el("h1", {}, "trolley", el("b", {}, "."), " sound"),
    el(
      "p",
      { class: "sub" },
      "Every sound here is synthesized at runtime: no samples. The score cross-fades through nine palettes as the mood moves; the rail keeps time underneath. Start audio, then drive the mood, the rail and the cues.",
    ),
  );
  const grid = el("div", { class: "grid" });
  page.append(grid);
  const left = el("div");
  const right = el("div");
  grid.append(left, right);

  // --- transport
  const startBtn = el("button", { class: "primary" }, "Start audio");
  const pauseBtn = el("button", {}, "Pause");
  const muteBtn = el("button", {}, "Disable");
  const renderBtn = el("button", {}, "Render 8 s offline");
  left.append(el("section", {}, el("h2", {}, "Transport", el("small", {}, "unlock needs a click")), el("div", { class: "bar" }, startBtn, pauseBtn, muteBtn, renderBtn)));

  // --- presets
  const presetRow = el("div", { class: "presets" });
  const presetBtns: HTMLButtonElement[] = [];
  const sliders: Record<string, { set(v: number): void }> = {};
  const push = () => engine?.setMood({ ...mood });
  const pushRail = () => engine?.setRail({ ...rail });
  for (let s = 1; s <= 7; s++) {
    const b = el("button", {}, String(s));
    b.addEventListener("click", () => {
      Object.assign(mood, PRESETS[s]);
      if (s !== 7) delete mood.ending;
      for (const k of ["stage", "tension", "gloom", "perfection", "ruin", "storm", "rain", "speed"] as const) sliders[k]?.set(mood[k]);
      authSel.value = mood.authority;
      endSel.value = mood.ending ?? "";
      rail.sleepersPerSecond = mood.speed > 0 ? (9.5 + mood.speed * 8.5) / 0.65 : 0;
      sliders.sps?.set(rail.sleepersPerSecond);
      presetBtns.forEach((x, i) => x.classList.toggle("on", i === s - 1));
      push();
      pushRail();
    });
    presetBtns.push(b);
    presetRow.append(b);
  }
  presetBtns[stage0 - 1]?.classList.add("on");
  left.append(el("section", {}, el("h2", {}, "Stage presets", el("small", {}, "fields → aftermath")), presetRow));

  // --- mood
  const moodSec = el("section", {}, el("h2", {}, "Mood", el("small", {}, "setMood()")));
  for (const [k, min, max, step] of [
    ["stage", 1, 7, 0.01],
    ["tension", 0, 1, 0.01],
    ["gloom", 0, 1, 0.01],
    ["perfection", 0, 1, 0.01],
    ["ruin", 0, 1, 0.01],
    ["storm", 0, 1, 0.01],
    ["rain", 0, 1, 0.01],
    ["speed", 0, 1, 0.01],
  ] as const) {
    const s = slider(k, min, max, step, mood[k], (v) => {
      mood[k] = v;
      push();
    });
    sliders[k] = s;
    moodSec.append(s.row);
  }
  const authSel = el("select", { "aria-label": "authority" });
  for (const a of ["human", "delegated", "overridden"]) authSel.append(el("option", { value: a }, a));
  authSel.value = mood.authority;
  authSel.addEventListener("change", () => {
    mood.authority = authSel.value as AudioMood["authority"];
    push();
  });
  const endSel = el("select", { "aria-label": "ending" });
  for (const e of ENDINGS) endSel.append(el("option", { value: e }, e || "(none)"));
  endSel.value = mood.ending ?? "";
  endSel.addEventListener("change", () => {
    if (endSel.value) mood.ending = endSel.value;
    else delete mood.ending;
    push();
  });
  moodSec.append(el("div", { class: "row" }, el("label", {}, "authority"), authSel, el("span")), el("div", { class: "row" }, el("label", {}, "ending"), endSel, el("span")));
  left.append(moodSec);

  // --- rail
  const railSec = el("section", {}, el("h2", {}, "Rail", el("small", {}, "setRail()")));
  const sps = slider("sleepers/s", 0, 30, 0.1, rail.sleepersPerSecond, (v) => {
    rail.sleepersPerSecond = v;
    pushRail();
  });
  sliders.sps = sps;
  const curve = slider("curve", -1, 1, 0.01, 0, (v) => {
    rail.curve = v;
    pushRail();
  });
  const bridge = el("input", { type: "checkbox" });
  const tunnel = el("input", { type: "checkbox" });
  bridge.addEventListener("change", () => {
    rail.onBridge = bridge.checked;
    pushRail();
  });
  tunnel.addEventListener("change", () => {
    rail.inTunnel = tunnel.checked;
    pushRail();
  });
  railSec.append(sps.row, curve.row, el("div", { class: "check" }, el("label", {}, bridge, "on bridge"), el("label", {}, tunnel, "in tunnel")));
  left.append(railSec);

  // --- volumes
  const volSec = el("section", {}, el("h2", {}, "Levels", el("small", {}, "setVolumes()")));
  for (const k of ["master", "music", "ambience", "sfx"] as const) {
    volSec.append(
      slider(k, 0, 1, 0.01, volumes[k], (v) => {
        volumes[k] = v;
        engine?.setVolumes({ [k]: v });
      }).row,
    );
  }
  left.append(volSec);

  // --- triggers
  const trigSec = el("section", {}, el("h2", {}, "Cues", el("small", {}, "trigger(ev, { intensity, pan })")));
  const trigGrid = el("div", { class: "triggers" });
  for (const ev of AUDIO_TRIGGERS) {
    const b = el("button", { "data-kind": KIND[ev] }, ev);
    b.addEventListener("click", () => engine?.trigger(ev, { intensity, pan }));
    trigGrid.append(b);
  }
  trigSec.append(
    trigGrid,
    el(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:10px" },
      slider("intensity", 0, 1, 0.01, intensity, (v) => (intensity = v)).row,
      slider("pan", -1, 1, 0.01, pan, (v) => (pan = v)).row,
    ),
  );
  right.append(trigSec);

  // --- readout
  const read = el("div", { class: "read" });
  const cells: Record<string, HTMLElement> = {};
  for (const k of ["palette", "chord", "bpm", "voices"]) {
    const strong = el("strong", {}, "—");
    cells[k] = strong;
    read.append(el("div", {}, el("span", {}, k), strong));
  }
  const layerBox = el("div", { class: "layers" });
  const live = el("canvas", { width: "1200", height: "260", "aria-label": "Live spectrum" });
  const liveSec = el("section", {}, el("h2", {}, "Engine", el("small", { class: "state" }, "not started")), read, el("div", { style: "height:10px" }), live, layerBox);
  right.append(liveSec);
  const spec = el("canvas", { width: "1200", height: "300", "aria-label": "Offline spectrogram" });
  const stats = el("div", { class: "stats" });
  const specSec = el("section", {}, el("h2", {}, "Offline render", el("small", {}, "8 s of the current mood, ink spectrogram (log frequency)")), spec, stats);
  right.append(specSec);

  const showLayers = (ins: AudioInspection) => {
    layerBox.replaceChildren(
      ...ins.layers.map((l) =>
        el(
          "div",
          { class: "layer" },
          el("span", {}, l.name),
          el("div", { class: `meter${l.name === "pulse" || l.name === "sine" ? " cobalt" : ""}` }, el("i", { style: `width:${Math.min(100, l.weight * 100).toFixed(1)}%` })),
          el("span", { style: "text-align:right" }, String(l.voices)),
        ),
      ),
    );
    cells.palette!.textContent = ins.palette + (ins.resting ? " · rest" : "");
    cells.chord!.textContent = ins.chord || "—";
    cells.bpm!.textContent = ins.bpm.toFixed(1);
    cells.voices!.textContent = String(ins.voices);
  };

  const doRender = async () => {
    renderBtn.textContent = "Rendering…";
    const { buffer, stats: st } = await renderOffline({ ...mood }, { ...rail }, Number(p.seconds ?? 8), volumes);
    drawSpectrogram(spec, buffer);
    stats.replaceChildren(
      el("div", {}, el("span", {}, "rms"), `${st.rmsDb.toFixed(1)} dBFS`),
      el("div", {}, el("span", {}, "peak"), `${st.peakDb.toFixed(1)} dBFS`),
      el("div", {}, el("span", {}, "centroid"), `${Math.round(st.centroid)} Hz`),
      el("div", {}, el("span", {}, "voices started"), String(st.inspection.voicesStarted)),
    );
    showLayers(st.inspection);
    renderBtn.textContent = "Render 8 s offline";
  };
  renderBtn.addEventListener("click", () => void doRender());

  const freq = new Float32Array(4096);
  const time = new Float32Array(2048);
  const stateEl = liveSec.querySelector(".state")!;
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!engine) return;
    drawLive(live, engine.analyser, freq, time);
    const ins = engine.inspect();
    showLayers(ins);
    stateEl.textContent = `${ins.running ? "running" : "suspended"} · t ${ins.time.toFixed(1)} s · stage ${ins.stage.toFixed(2)}`;
  };

  startBtn.addEventListener("click", async () => {
    if (!engine) {
      engine = createAudioEngine({ seed: "lab" });
      engine.setMood({ ...mood });
      engine.setRail({ ...rail });
      engine.setVolumes(volumes);
    }
    await engine.unlock();
    engine.setEnabled(true);
    if (engine.analyser) engine.analyser.fftSize = 8192; // finer bins for the desk
    startBtn.textContent = "Running";
    startBtn.classList.add("on");
    cancelAnimationFrame(raf);
    loop();
  });
  let paused = false;
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    engine?.pause(paused);
    pauseBtn.classList.toggle("on", paused);
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  });
  let enabled = true;
  muteBtn.addEventListener("click", () => {
    enabled = !enabled;
    engine?.setEnabled(enabled);
    muteBtn.classList.toggle("on", !enabled);
    muteBtn.textContent = enabled ? "Disable" : "Enable";
  });

  drawLive(live, null, freq, time);
  const blank = spec.getContext("2d")!;
  blank.fillStyle = "#fff";
  blank.fillRect(0, 0, spec.width, spec.height);
  rules(blank, spec.width, spec.height, 0);
  return preview ? doRender() : Promise.resolve();
}

export const scenes: LabScene[] = [
  {
    name: "audio",
    description: "Sound desk: mood/rail controls, every trigger, live spectrum.",
    build: (ctx) => desk(ctx, false),
  },
  {
    name: "audio-preview",
    description: "Offline render of a mood (params: stage, tension, ...) drawn as an ink spectrogram.",
    build: (ctx) => desk(ctx, true),
  },
];
