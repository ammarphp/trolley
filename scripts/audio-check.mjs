// Offline audio check for the synthesized engine (src/audio).
//
//   node scripts/audio-check.mjs [--seconds 8] [--sr 48000] [--json out.json] [--only stages|journey|triggers] [--wav dir]
//
// Bundles src/audio with esbuild, opens headless Chromium (Playwright) and
// renders the engine into an OfflineAudioContext, stepping its control clock
// with ctx.suspend() exactly as the realtime timer would. For every stage mood
// it reports RMS, peak, NaN and clipped-sample counts, spectral centroid and
// low/high band energy, for the score alone and for the full mix. A long
// "journey" render checks that stage changes cross-fade without jumps, and
// every trigger is rendered in isolation. Exit code 1 on NaN or clipping.
import { build } from "esbuild";
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SECONDS = Number(opt("seconds", 8));
const SR = Number(opt("sr", 48000));
const ONLY = opt("only", "");
const JSON_OUT = opt("json", "");
const WAV_DIR = opt("wav", "");

const bundle = await build({
  entryPoints: ["src/audio/index.ts"],
  bundle: true,
  format: "iife",
  globalName: "TrolleyAudio",
  write: false,
  target: ["es2022"],
  logLevel: "warning",
});
const engineCode = bundle.outputFiles[0].text;

// ---------------------------------------------------------------- page side
const pageCode = String.raw`
(() => {
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k], ai = im[i + k];
          const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br; im[i + k] = ai + bi;
          re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  function analyze(buf, from, to) {
    const sr = buf.sampleRate;
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const a = Math.floor(from * sr), b = Math.min(L.length, Math.floor(to * sr));
    let nan = 0, clip = 0, peak = 0, sum = 0;
    for (let i = a; i < b; i++) {
      for (const x of [L[i], R[i]]) {
        if (!Number.isFinite(x)) { nan++; continue; }
        const ax = Math.abs(x);
        if (ax > peak) peak = ax;
        if (ax >= 0.999) clip++;
        sum += x * x;
      }
    }
    const rms = Math.sqrt(sum / Math.max(1, 2 * (b - a)));
    // Spectral centroid (magnitude-weighted), band shares, frame-energy weighted.
    const N = 4096;
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    let cSum = 0, eSum = 0, lowE = 0, highE = 0, totE = 0;
    for (let s = a; s + N <= b; s += N / 2) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = ((L[s + i] + R[s + i]) * 0.5 || 0) * win[i];
      fft(re, im);
      let num = 0, den = 0, e = 0;
      for (let k = 1; k < N / 2; k++) {
        const f = k * sr / N;
        const p = re[k] * re[k] + im[k] * im[k];
        const mag = Math.sqrt(p);
        num += f * mag; den += mag; e += p;
        if (f < 250) lowE += p; else if (f > 2000) highE += p;
        totE += p;
      }
      if (den > 1e-9) { cSum += (num / den) * e; eSum += e; }
    }
    // Short-term loudness steps (100 ms windows), ignoring near-silence.
    const W = Math.floor(0.1 * sr);
    let prev = null, maxJump = 0;
    const env = [];
    for (let s = a; s + W <= b; s += W) {
      let q = 0;
      for (let i = s; i < s + W; i++) q += (L[i] * L[i] + R[i] * R[i]) * 0.5;
      const d = db(Math.sqrt(q / W));
      env.push(d);
      if (prev !== null && d > -70 && prev > -70) maxJump = Math.max(maxJump, Math.abs(d - prev));
      prev = d;
    }
    // 1 s loudness steps (hop 0.5 s): mood/stage transitions, not note onsets.
    const W1 = sr, H1 = Math.floor(sr / 2);
    let prev1 = null, maxJump1 = 0;
    for (let s = a; s + W1 <= b; s += H1) {
      let q = 0;
      for (let i = s; i < s + W1; i++) q += (L[i] * L[i] + R[i] * R[i]) * 0.5;
      const d = db(Math.sqrt(q / W1));
      if (prev1 !== null && d > -70 && prev1 > -70) maxJump1 = Math.max(maxJump1, Math.abs(d - prev1));
      prev1 = d;
    }
    return {
      maxStep1sDb: +maxJump1.toFixed(1),
      rmsDb: +db(rms).toFixed(1),
      peakDb: +db(peak).toFixed(1),
      nan, clip,
      centroidHz: eSum > 0 ? Math.round(cSum / eSum) : 0,
      lowShare: totE ? +(lowE / totE).toFixed(3) : 0,
      highShare: totE ? +(highE / totE).toFixed(3) : 0,
      maxStepDb: +maxJump.toFixed(1),
      silentWindows: env.filter((d) => d < -70).length,
    };
  }
  window.__render = async (cfg) => {
    const { seconds, sr, seed, volumes, mood, rail, events = [], segments = null, solo, skip } = cfg;
    const frames = Math.ceil(seconds * sr);
    const ctx = new OfflineAudioContext(2, frames, sr);
    const engine = TrolleyAudio.createAudioEngine({ context: ctx, manual: true, seed, lookahead: 0.25, solo });
    await engine.unlock();
    engine.setVolumes(volumes);
    engine.setMood(mood);
    engine.setRail(rail);
    engine.step();
    const pending = events.slice().sort((x, y) => x.at - y.at);
    const hop = 128 * 32;
    const snapshots = [];
    for (let f = hop; f < frames; f += hop) {
      const t = f / sr;
      ctx.suspend(t).then(() => {
        while (pending.length && pending[0].at <= t + 1e-9) {
          const e = pending.shift();
          if (e.mood) engine.setMood(e.mood);
          if (e.rail) engine.setRail(e.rail);
          if (e.trigger) engine.trigger(e.trigger, e.opts || {});
        }
        engine.step();
        if (Math.abs(t % 1) < hop / sr) snapshots.push(engine.inspect());
        ctx.resume();
      });
    }
    const t0 = performance.now();
    const buf = await ctx.startRendering();
    const wall = (performance.now() - t0) / 1000;
    const whole = analyze(buf, skip ?? Math.min(0.5, seconds / 4), seconds);
    const segs = segments ? segments.map(([a, b]) => analyze(buf, a, b)) : null;
    const last = engine.inspect();
    engine.dispose();
    let wav = null;
    if (cfg.wav) {
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      const n = L.length;
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const w4 = (o, s) => { for (let i = 0; i < 4; i++) out.setUint8(o + i, s.charCodeAt(i)); };
      w4(0, "RIFF"); out.setUint32(4, 36 + n * 4, true); w4(8, "WAVE"); w4(12, "fmt ");
      out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
      out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 4, true);
      out.setUint16(32, 4, true); out.setUint16(34, 16, true); w4(36, "data"); out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) {
        out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] || 0)) * 32767, true);
        out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] || 0)) * 32767, true);
      }
      const bytes = new Uint8Array(out.buffer);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      wav = btoa(bin);
    }
    return { wav, ...whole, segments: segs, renderSeconds: +wall.toFixed(3), realtimeFactor: +(seconds / wall).toFixed(1), voicesStarted: last.voicesStarted, voicesAtEnd: last.voices, palette: last.palette, chord: last.chord, bpm: last.bpm, layers: last.layers.filter((l) => l.weight > 0.02).map((l) => l.name + ":" + l.weight).join(" ") };
  };
})();
`;

// ---------------------------------------------------------------- cases
const base = { stage: 1, tension: 0, gloom: 0, perfection: 0, ruin: 0, storm: 0, rain: 0, speed: 0.4, authority: "human" };
// Cruise speed as the renderer sets it (9.5 + speed * 8.5 m/s); speed 0 means halted (endings).
const railAt = (speed) => ({ sleepersPerSecond: speed > 0 ? (9.5 + speed * 8.5) / 0.65 : 0, curve: 0, onBridge: false, inTunnel: false });
const STAGES = [
  { label: "1 pastoral", mood: { ...base, stage: 1, tension: 0.05, speed: 0.3 } },
  { label: "2 academy", mood: { ...base, stage: 2, tension: 0.15, gloom: 0.1, speed: 0.35 } },
  { label: "3 institution", mood: { ...base, stage: 3, tension: 0.3, gloom: 0.2, speed: 0.45, authority: "delegated" } },
  { label: "4 momentum", mood: { ...base, stage: 4, tension: 0.5, gloom: 0.35, speed: 0.7, authority: "delegated" } },
  { label: "5 dread", mood: { ...base, stage: 5, tension: 0.65, gloom: 0.55, storm: 0.4, rain: 0.3, speed: 0.75, authority: "delegated" } },
  { label: "6 abyss", mood: { ...base, stage: 6, tension: 0.85, gloom: 0.8, storm: 0.6, rain: 0.5, speed: 0.85, authority: "overridden" } },
  { label: "7 perfection", mood: { ...base, stage: 7, tension: 0.3, gloom: 0.15, perfection: 1, speed: 0.5, authority: "overridden", ending: "tutelage" } },
  { label: "7 ruin", mood: { ...base, stage: 7, tension: 0.6, gloom: 0.9, ruin: 1, storm: 0.3, speed: 0, authority: "overridden", ending: "extinction" } },
  { label: "7 dawn", mood: { ...base, stage: 7, tension: 0.2, gloom: 0.3, speed: 0.2, authority: "human", ending: "accountable" } },
];
const DEFAULT = { master: 0.7, music: 0.75, ambience: 0.8, sfx: 0.85 };
const MUSIC_ONLY = { ...DEFAULT, ambience: 0, sfx: 0 };
const TRIGGERS = ["lever-arm", "lever-commit", "lever-jam", "switch-throw", "impact", "glass-crack", "wiper", "thunder", "morrow-chime", "morrow-type", "news-ping", "printer", "glitch", "freeze", "brake", "horn", "ui-tick", "ui-open", "ui-close", "tunnel-in", "tunnel-out", "appointment", "ending"];

const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ content: engineCode });
await page.addScriptTag({ content: pageCode });
const render = (cfg) => page.evaluate((c) => window.__render(c), { seconds: SECONDS, sr: SR, seed: "check", volumes: DEFAULT, rail: railAt(0.4), wav: !!WAV_DIR, ...cfg });

const report = { seconds: SECONDS, sampleRate: SR, stages: [], journey: null, triggers: [] };
if (WAV_DIR) await mkdir(WAV_DIR, { recursive: true });
const saveWav = async (name, r) => {
  if (WAV_DIR && r.wav) await writeFile(path.join(WAV_DIR, name.replace(/[^a-z0-9-]+/gi, "_") + ".wav"), Buffer.from(r.wav, "base64"));
  delete r.wav;
};
let failed = false;
const flag = (r) => {
  if (r.nan > 0 || r.clip > 0) failed = true;
};

if (!ONLY || ONLY === "stages") {
  console.log(`\nPer-stage renders, ${SECONDS}s each at ${SR} Hz, default volumes (analysis skips the first 0.5 s).`);
  console.log("stage            | score: RMS dB  peak dB  centroid Hz  <250Hz  >2kHz | full mix: RMS dB  peak dB  centroid Hz | NaN clip | x realtime voices | layers (weight)");
  for (const s of STAGES) {
    const rail = railAt(s.mood.speed);
    const music = await render({ mood: s.mood, rail, volumes: MUSIC_ONLY });
    const full = await render({ mood: s.mood, rail, volumes: DEFAULT });
    flag(music);
    flag(full);
    await saveWav(`stage-${s.label}-score`, music);
    await saveWav(`stage-${s.label}-full`, full);
    report.stages.push({ stage: s.label, mood: s.mood, music, full });
    const pad = (v, n) => String(v).padStart(n);
    console.log(
      `${s.label.padEnd(16)} | ${pad(music.rmsDb, 13)} ${pad(music.peakDb, 8)} ${pad(music.centroidHz, 12)} ${pad(music.lowShare, 7)} ${pad(music.highShare, 6)} | ${pad(full.rmsDb, 16)} ${pad(full.peakDb, 8)} ${pad(full.centroidHz, 12)} | ${pad(music.nan + full.nan, 3)} ${pad(music.clip + full.clip, 4)} | ${pad(full.realtimeFactor, 10)} ${pad(full.voicesAtEnd, 6)} | ${music.layers}`,
    );
  }
}

if (!ONLY || ONLY === "realtime") {
  // A real AudioContext driven by the engine's own 50 ms timer: lifecycle and main-thread cost.
  const rt = await page.evaluate(async () => {
    const out = { steps: 0, stepMsMean: 0, stepMsMax: 0, states: [], rmsDb: [], errors: [] };
    const engine = TrolleyAudio.createAudioEngine({ seed: "rt" });
    const origStep = engine.step.bind(engine);
    let total = 0;
    engine.step = () => {
      const t0 = performance.now();
      origStep();
      const dt = performance.now() - t0;
      total += dt;
      out.steps++;
      out.stepMsMax = Math.max(out.stepMsMax, dt);
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const level = () => {
      const an = engine.analyser;
      const buf = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const x of buf) s += x * x;
      return +(10 * Math.log10(s / buf.length + 1e-12)).toFixed(1);
    };
    try {
      engine.setMood({ stage: 1, tension: 0.05, gloom: 0, perfection: 0, ruin: 0, storm: 0, rain: 0, speed: 0.3, authority: "human" });
      engine.setRail({ sleepersPerSecond: 19, curve: 0, onBridge: false, inTunnel: false });
      await engine.unlock();
      out.states.push("after unlock: " + engine.context.state);
      await wait(2500);
      out.rmsDb.push(["playing", level()]);
      for (const ev of ["lever-arm", "lever-commit", "morrow-chime", "ui-tick", "impact"]) engine.trigger(ev, { intensity: 0.8 });
      engine.setMood({ stage: 5, tension: 0.7, gloom: 0.6, perfection: 0, ruin: 0.1, storm: 0.5, rain: 0.4, speed: 0.8, authority: "overridden" });
      await wait(1500);
      out.rmsDb.push(["after triggers + stage 5", level()]);
      engine.pause(true);
      await wait(1200);
      out.rmsDb.push(["paused (ui still live)", level()]);
      engine.trigger("ui-tick");
      engine.pause(false);
      await wait(800);
      out.rmsDb.push(["resumed", level()]);
      engine.setEnabled(false);
      await wait(700);
      out.states.push("disabled: " + engine.context.state);
      engine.setEnabled(true);
      await wait(600);
      out.states.push("re-enabled: " + engine.context.state);
      out.rmsDb.push(["re-enabled", level()]);
      const ctx = engine.context;
      engine.dispose();
      await wait(200);
      out.states.push("disposed: " + ctx.state);
    } catch (e) {
      out.errors.push(String(e && e.stack || e));
    }
    out.stepMsMean = +(total / Math.max(1, out.steps)).toFixed(3);
    out.stepMsMax = +out.stepMsMax.toFixed(2);
    return out;
  });
  report.realtime = rt;
  console.log("\nRealtime AudioContext (engine timer, 50 ms control steps):");
  console.log(`  context states: ${rt.states.join(" | ")}`);
  console.log(`  analyser RMS: ${rt.rmsDb.map(([k, v]) => `${k} ${v} dB`).join(" | ")}`);
  console.log(`  control step on main thread: mean ${rt.stepMsMean} ms, max ${rt.stepMsMax} ms over ${rt.steps} steps (includes lazy foley rendering)`);
  if (rt.errors.length) {
    failed = true;
    console.log("  errors: " + rt.errors.join("\n"));
  }
}

if (ONLY === "ambience") {
  console.log("\nAmbience only (score and sfx muted):");
  for (const s of STAGES) {
    const r = await render({ mood: s.mood, rail: railAt(s.mood.speed), volumes: { ...DEFAULT, music: 0, sfx: 0 } });
    await saveWav(`amb-${s.label}`, r);
    console.log(`  ${s.label.padEnd(14)} RMS ${String(r.rmsDb).padStart(6)} dB  peak ${String(r.peakDb).padStart(6)} dB  centroid ${String(r.centroidHz).padStart(5)} Hz  <250 ${r.lowShare}  >2k ${r.highShare}`);
  }
}

if (ONLY === "layers") {
  // Debug: each score layer alone, in the stage where it leads.
  const home = { pad: 0, musicbox: 0, reed: 1, pulse: 2, ostinato: 3, drone: 4, cluster: 5, choir: 5, sub: 5, sine: 6, bell: 7, broken: 7 };
  console.log("\nLayers solo (score only):");
  for (const [layer, si] of Object.entries(home)) {
    const s = STAGES[si];
    const r = await render({ mood: s.mood, rail: railAt(s.mood.speed), volumes: MUSIC_ONLY, solo: [layer] });
    await saveWav(`layer-${layer}`, r);
    console.log(`  ${layer.padEnd(9)} in ${s.label.padEnd(14)} RMS ${String(r.rmsDb).padStart(6)} dB  peak ${String(r.peakDb).padStart(6)} dB  centroid ${String(r.centroidHz).padStart(5)} Hz  <250 ${r.lowShare}`);
  }
}

if (!ONLY || ONLY === "journey") {
  // Stage steps every 10 s; ending (ruin) at 60 s. Stage cross-fades take ~16 s by design.
  const seg = 10;
  const events = [];
  for (let st = 2; st <= 6; st++) events.push({ at: (st - 1) * seg, mood: STAGES[st - 1].mood, rail: railAt(STAGES[st - 1].mood.speed) });
  events.push({ at: 6 * seg, mood: STAGES[7].mood, rail: railAt(0.1) });
  const segments = Array.from({ length: 7 }, (_, i) => [i * seg + 1, (i + 1) * seg]);
  const j = await page.evaluate((c) => window.__render(c), { seconds: 7 * seg, sr: SR, seed: "journey", volumes: MUSIC_ONLY, mood: STAGES[0].mood, rail: railAt(0.3), events, segments, skip: 2, wav: !!WAV_DIR });
  flag(j);
  await saveWav("journey-score", j);
  report.journey = j;
  console.log(`\nJourney (score only): stage 1→6 in 10 s steps, then the ruin ending, 70 s continuous (whole-render stats skip the opening 2 s fade-in).`);
  console.log(`  whole: RMS ${j.rmsDb} dB, peak ${j.peakDb} dB, NaN ${j.nan}, clipped ${j.clip}, largest loudness step: ${j.maxStepDb} dB per 100 ms (note onsets), ${j.maxStep1sDb} dB per 1 s, x${j.realtimeFactor} realtime`);
  j.segments.forEach((s, i) => console.log(`  ${String(i * seg).padStart(2)}-${String((i + 1) * seg).padEnd(2)} s: RMS ${String(s.rmsDb).padStart(6)} dB  centroid ${String(s.centroidHz).padStart(5)} Hz  <250Hz ${s.lowShare}  max step 100ms ${s.maxStepDb} dB, 1s ${s.maxStep1sDb} dB`));
}

if (!ONLY || ONLY === "triggers") {
  console.log(`\nTriggers in isolation (music and ambience muted, sfx at default).`);
  const quiet = { ...DEFAULT, music: 0, ambience: 0 };
  for (const ev of TRIGGERS) {
    const long = ev === "thunder" || ev === "ending" || ev === "freeze" || ev === "brake";
    const secs = long ? 8 : 3;
    const volumes = ev === "freeze" || ev === "glitch" ? DEFAULT : quiet;
    const r = await page.evaluate((c) => window.__render(c), {
      seconds: secs,
      sr: SR,
      seed: `trig-${ev}`,
      volumes,
      mood: { ...STAGES[2].mood, tension: 0.4 },
      rail: railAt(0.4),
      events: [{ at: 0.5, trigger: ev, opts: ev === "thunder" ? { intensity: 0.9 } : ev === "impact" ? { intensity: 1 } : {} }],
      wav: !!WAV_DIR,
    });
    flag(r);
    await saveWav(`trigger-${ev}`, r);
    report.triggers.push({ trigger: ev, ...r });
    console.log(`  ${ev.padEnd(13)} peak ${String(r.peakDb).padStart(6)} dB  RMS ${String(r.rmsDb).padStart(6)} dB  centroid ${String(r.centroidHz).padStart(5)} Hz  NaN ${r.nan}  clip ${r.clip}`);
  }
}

if (errors.length) {
  console.log("\nPage errors:");
  for (const e of errors) console.log("  " + e);
  failed = true;
}
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(report, null, 2));
await browser.close();
console.log(failed ? "\nFAIL: NaN, clipping or page errors." : "\nOK: no NaN, no clipped samples, no page errors.");
process.exit(failed ? 1 : 0);
