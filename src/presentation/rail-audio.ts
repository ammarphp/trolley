/** Original quiet procedural rail bed. No recordings, samples or network I/O. */
export function createRailAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let motor: OscillatorNode | null = null;
  let pulse: OscillatorNode | null = null;
  let wind: AudioBufferSourceNode | null = null;
  let enabled = false,
    paused = false,
    destroyed = false,
    speed = 0;
  async function start() {
    if (destroyed || !enabled || paused) return;
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        motor = context.createOscillator();
        motor.type = "sine";
        motor.frequency.value = 62;
        const tone = context.createGain();
        tone.gain.value = 0.1;
        motor.connect(tone).connect(master);
        motor.start();
        pulse = context.createOscillator();
        pulse.type = "sine";
        pulse.frequency.value = 2.4;
        const modulation = context.createGain();
        modulation.gain.value = 0.025;
        pulse.connect(modulation).connect(tone.gain);
        pulse.start();
        const buffer = context.createBuffer(
          1,
          context.sampleRate * 2,
          context.sampleRate,
        );
        const samples = buffer.getChannelData(0);
        let noiseState = 7319;
        for (let i = 0; i < samples.length; i++) {
          noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
          samples[i] = noiseState / 2147483648 - 1;
        }
        wind = context.createBufferSource();
        wind.buffer = buffer;
        wind.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 460;
        filter.Q.value = 0.25;
        const air = context.createGain();
        air.gain.value = 0.018;
        wind.connect(filter).connect(air).connect(master);
        wind.start();
      }
      await context.resume();
      if (master && context && !destroyed)
        master.gain.setTargetAtTime(
          enabled && !paused ? 0.16 : 0,
          context.currentTime,
          0.4,
        );
    } catch {
      /* Silent play always remains valid. */
    }
  }
  return {
    set(value: { enabled?: boolean; paused?: boolean; speed?: number }) {
      if (value.enabled !== undefined) enabled = value.enabled;
      if (value.paused !== undefined) paused = value.paused;
      if (value.speed !== undefined)
        speed = Math.max(0, Math.min(1, value.speed));
      if (context && motor && pulse && master) {
        motor.frequency.setTargetAtTime(
          62 + speed * 29,
          context.currentTime,
          1,
        );
        pulse.frequency.setTargetAtTime(
          2.4 + speed * 2.2,
          context.currentTime,
          1,
        );
        master.gain.setTargetAtTime(
          enabled && !paused ? 0.16 : 0,
          context.currentTime,
          0.25,
        );
      }
      if (enabled && !paused) void start();
    },
    destroy() {
      destroyed = true;
      try {
        motor?.stop();
        pulse?.stop();
        wind?.stop();
        void context?.close();
      } catch {
        /* Already stopped. */
      }
      context = null;
      master = null;
    },
  };
}
