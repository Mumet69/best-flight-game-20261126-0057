// audio.js — WebAudio synth for Sky Courier: Ridge Run.
// One tiny job: engine hum, ring chime, landing thud and wind, all
// synthesised in code. No audio files, no network.
export function makeAudio() {
  const state = { ctx: null, master: null, engine: null, engineGain: null, wind: null, windGain: null, muted: false };
  return {
    get muted() { return state.muted; },
    toggleMute() { state.muted = !state.muted; if (state.master) state.master.gain.value = state.muted ? 0 : 0.5; return state.muted; },

    // Must be called from a user gesture at least once.
    ensure() {
      if (state.ctx) { if (state.ctx.state === 'suspended') state.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const master = ctx.createGain(); master.gain.value = state.muted ? 0 : 0.5;
        master.connect(ctx.destination);
        // Engine: two detuned sawtooths through a lowpass.
        const eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 70;
        const eng2 = ctx.createOscillator(); eng2.type = 'square'; eng2.frequency.value = 35;
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 320;
        const eg = ctx.createGain(); eg.gain.value = 0;
        eng.connect(filt); eng2.connect(filt); filt.connect(eg); eg.connect(master);
        eng.start(); eng2.start();
        // Wind: looped noise buffer through a bandpass.
        const len = ctx.sampleRate;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
        const wg = ctx.createGain(); wg.gain.value = 0;
        src.connect(bp); bp.connect(wg); wg.connect(master); src.start();
        Object.assign(state, { ctx, master, engine: eng, engine2: eng2, engineGain: eg, windGain: wg });
      } catch (e) { /* audio is a garnish; the game plays without it */ }
    },

    // Call every frame while flying: throttle 0..1, speed m/s.
    update(throttle, speed, flying) {
      if (!state.ctx) return;
      const t = state.ctx.currentTime;
      const hum = 55 + throttle * 75 + speed * 0.35;
      state.engine.frequency.setTargetAtTime(hum, t, 0.08);
      state.engine2.frequency.setTargetAtTime(hum * 0.5, t, 0.08);
      state.engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.075 : 0, t, 0.15);
      state.windGain.gain.setTargetAtTime(flying ? Math.min(0.12, speed * 0.0016) : 0, t, 0.2);
    },

    chime() {
      if (!state.ctx || state.muted) return;
      const ctx = state.ctx;
      [880, 1318.5].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ctx.createGain();
        const t0 = ctx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
        o.connect(g); g.connect(state.master);
        o.start(t0); o.stop(t0 + 0.6);
      });
    },

    thud() {
      if (!state.ctx || state.muted) return;
      const ctx = state.ctx;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g); g.connect(state.master);
      o.start(); o.stop(ctx.currentTime + 0.4);
    },
  };
}
