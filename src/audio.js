// audio.js -- every sound in the game, synthesised at runtime.
//
// Nothing is sampled; it is all WebAudio oscillators, filtered noise and
// envelopes. The scream is the one that matters: a detuned pair of saws
// sliding down over a bandpassed noise shriek, pushed through a waveshaper so
// it tears rather than simply being loud.

const AC = window.AudioContext || window.webkitAudioContext;

// Shared noise buffer -- generating this per-shot was audible as a hitch.
function makeNoise(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Soft-clipping curve: adds the grit that makes the shriek sound torn.
function makeDistortion(ctx, amount = 40) {
  const n = 2048, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x));
  }
  const ws = ctx.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '4x';
  return ws;
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volMaster = 0.8;
    this.volMusic = 0.5;
    this.volSfx = 0.9;
    this._ambient = null;
  }

  // Browsers refuse to start audio until a gesture, so this is called from the
  // first click or keypress rather than at load.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = this.ctx = new AC();
    this.noise = makeNoise(ctx);

    this.master = ctx.createGain();
    this.master.gain.value = this.volMaster;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.volSfx;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.volMusic;
    this.musicBus.connect(this.master);

    this.ready = true;
  }

  setVolumes({ master, music, sfx }) {
    if (master !== undefined) this.volMaster = master;
    if (music !== undefined) this.volMusic = music;
    if (sfx !== undefined) this.volSfx = sfx;
    if (!this.ready) return;
    this.master.gain.value = this.volMaster;
    this.musicBus.gain.value = this.volMusic;
    this.sfxBus.gain.value = this.volSfx;
  }

  get t() { return this.ctx.currentTime; }

  _noiseSource(dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    return s;
  }

  // Positional-ish: sounds further away are quieter and duller. Cheap stand-in
  // for a full panner graph, and enough to tell "upstairs" from "right here".
  _dist(gainNode, distance) {
    if (distance === undefined) return 1;
    return Math.max(0, 1 - distance / 22);
  }

  /* ------------------------------------------------------------ the scream */

  // Granny's jumpscare.
  //
  // The previous version was a falling saw through a bandpass, which read as a
  // siren rather than a voice. A scream is a voice: a buzzy glottal source,
  // shaped by the resonances of a throat held open on an "aaah", pitched far
  // higher than anyone speaks, and never steady -- real screams jitter in pitch
  // and break into noise at the top. So this builds a source and then puts it
  // through parallel formant filters, which is what makes it read as a mouth.
  scream() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;

    const out = ctx.createGain();
    out.gain.value = 0.9;
    const dist = makeDistortion(ctx, 22);     // the voice tearing, not fuzz
    out.connect(dist);
    dist.connect(this.sfxBus);

    // --- glottal source: a rich buzz, not a pure tone
    const src = ctx.createGain();
    src.gain.value = 1;

    const f0 = ctx.createOscillator();
    f0.type = 'sawtooth';
    // Up into the shriek, held, then collapsing as she runs out of breath.
    f0.frequency.setValueAtTime(420, t);
    f0.frequency.exponentialRampToValueAtTime(1020, t + 0.07);
    f0.frequency.setValueAtTime(1020, t + 0.30);
    f0.frequency.exponentialRampToValueAtTime(880, t + 0.75);
    f0.frequency.exponentialRampToValueAtTime(300, t + 1.35);

    // A second voice slightly off pitch: one larynx never sounds this ragged.
    const f0b = ctx.createOscillator();
    f0b.type = 'sawtooth';
    f0b.detune.value = 31;
    f0b.frequency.setValueAtTime(418, t);
    f0b.frequency.exponentialRampToValueAtTime(1008, t + 0.075);
    f0b.frequency.exponentialRampToValueAtTime(292, t + 1.35);

    // Pitch jitter. Two incommensurate LFOs so it never sounds like vibrato.
    for (const [rate, depth] of [[6.3, 34], [23.7, 13]]) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const lg = ctx.createGain();
      lg.gain.value = depth;
      lfo.connect(lg);
      lg.connect(f0.frequency);
      lg.connect(f0b.frequency);
      lfo.start(t); lfo.stop(t + 1.6);
    }

    f0.connect(src); f0b.connect(src);
    f0.start(t); f0b.start(t);
    f0.stop(t + 1.5); f0b.stop(t + 1.5);

    // --- breath: air forced through a constricted throat
    const breath = this._noiseSource();
    const bhp = ctx.createBiquadFilter();
    bhp.type = 'highpass';
    bhp.frequency.value = 1100;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.16, t + 0.05);
    bg.gain.exponentialRampToValueAtTime(0.012, t + 1.2);
    breath.connect(bhp); bhp.connect(bg); bg.connect(src);
    breath.start(t); breath.stop(t + 1.4);

    // --- vocal tract: parallel formants for an open "aaah"
    // Roughly F1 800, F2 1250, F3 2800, F4 3600. These ratios are what the ear
    // reads as a human vowel rather than an instrument.
    const FORMANTS = [[800, 9, 1.0], [1250, 11, 0.62], [2800, 13, 0.34], [3600, 14, 0.20]];
    for (const [freq, q, amp] of FORMANTS) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq, t);
      // The tract opens wider at the peak of the scream and closes as it dies.
      bp.frequency.linearRampToValueAtTime(freq * 1.14, t + 0.12);
      bp.frequency.linearRampToValueAtTime(freq * 0.88, t + 1.3);
      bp.Q.value = q;
      const fg = ctx.createGain();
      fg.gain.value = amp;
      src.connect(bp); bp.connect(fg); fg.connect(out);
    }
    // A little of the raw source so it keeps its edge.
    const dry = ctx.createGain();
    dry.gain.value = 0.18;
    src.connect(dry); dry.connect(out);

    // --- overall shape: instant attack, then it gives out
    const env = ctx.createGain();
    out.disconnect();
    out.connect(env);
    env.connect(dist);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1.0, t + 0.018);   // no fade-in at all
    env.gain.setValueAtTime(1.0, t + 0.55);
    env.gain.exponentialRampToValueAtTime(0.35, t + 1.0);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    // --- the physical hit, felt rather than heard
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(150, t);
    boom.frequency.exponentialRampToValueAtTime(30, t + 0.45);
    const bmg = ctx.createGain();
    bmg.gain.setValueAtTime(0.85, t);
    bmg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    boom.connect(bmg); bmg.connect(this.sfxBus);
    boom.start(t); boom.stop(t + 0.9);
  }

  /* ------------------------------------------------------------- the world */

  footstep(distance, crouched) {
    if (!this.ready) return;
    const v = this._dist(null, distance) * (crouched ? 0.3 : 1);
    if (v <= 0.01) return;
    const ctx = this.ctx, t = this.t;
    const n = this._noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420 + Math.random() * 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    n.connect(f); f.connect(g); g.connect(this.sfxBus);
    n.start(t); n.stop(t + 0.12);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(90, t);
    thump.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.10 * v, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    thump.connect(tg); tg.connect(this.sfxBus);
    thump.start(t); thump.stop(t + 0.12);
  }

  // Dry, long, and sour -- the sound that tells you she just came through.
  doorCreak(distance) {
    if (!this.ready) return;
    const v = this._dist(null, distance);
    if (v <= 0.01) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = 220 + Math.random() * 130;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 1.7, t + 0.7);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * v, t + 0.12);
    g.gain.linearRampToValueAtTime(0.05 * v, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    o.connect(f); f.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.9);
  }

  floorCreak(distance) {
    if (!this.ready) return;
    const v = this._dist(null, distance);
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(130 + Math.random() * 60, t);
    o.frequency.linearRampToValueAtTime(95, t + 0.28);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 680; f.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14 * v, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(f); f.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.42);
  }

  trapSnap(distance) {
    if (!this.ready) return;
    const v = this._dist(null, distance);
    const ctx = this.ctx, t = this.t;
    const n = this._noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 14;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    n.connect(f); f.connect(g); g.connect(this.sfxBus);
    n.start(t); n.stop(t + 0.25);
  }

  // Her idle mutter, so you can hear roughly where she is.
  mutter(distance) {
    if (!this.ready) return;
    const v = this._dist(null, distance);
    if (v <= 0.02) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    for (let i = 0; i < 5; i++) {
      o.frequency.linearRampToValueAtTime(95 + Math.random() * 90, t + 0.12 * (i + 1));
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * v, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    o.connect(f); f.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.8);
  }

  heartbeat(intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    for (const [delay, amp] of [[0, 0.34], [0.17, 0.22]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(62, t + delay);
      o.frequency.exponentialRampToValueAtTime(34, t + delay + 0.13);
      const g = ctx.createGain();
      g.gain.setValueAtTime(amp * intensity, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.22);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t + delay); o.stop(t + delay + 0.25);
    }
  }

  /* -------------------------------------------------------------- ambience */

  // A low, slowly beating drone. Two oscillators a couple of Hz apart beat
  // against each other, which is what gives it the uneasy, breathing quality.
  startAmbient() {
    if (!this.ready || this._ambient) return;
    const ctx = this.ctx, t = this.t;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 4);
    g.connect(this.musicBus);

    const oscs = [];
    for (const f of [41, 43.6, 61.5]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      oscs.push(o);
    }
    // A breath of filtered noise over the top -- wind in a dead house.
    const n = this._noiseSource();
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 330; nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.035;
    lfo.connect(lfoG); lfoG.connect(ng.gain);
    n.connect(nf); nf.connect(ng); ng.connect(this.musicBus);
    n.start(t); lfo.start(t);

    this._ambient = { g, oscs, n, lfo };
  }

  stopAmbient() {
    if (!this._ambient) return;
    const { g, oscs, n, lfo } = this._ambient;
    const t = this.t;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.8);
    for (const o of oscs) o.stop(t + 1);
    n.stop(t + 1); lfo.stop(t + 1);
    this._ambient = null;
  }

  // Rising dissonance while she is actively hunting you.
  setChase(on) {
    if (!this.ready) return;
    if (on && !this._chase) {
      const ctx = this.ctx, t = this.t;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.4);
      g.connect(this.musicBus);
      const oscs = [];
      for (const f of [98, 103.8, 147]) {     // a deliberately sour cluster
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const fl = ctx.createBiquadFilter();
        fl.type = 'lowpass'; fl.frequency.value = 420;
        o.connect(fl); fl.connect(g);
        o.start(t);
        oscs.push(o);
      }
      this._chase = { g, oscs };
    } else if (!on && this._chase) {
      const { g, oscs } = this._chase;
      const t = this.t;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.6);
      for (const o of oscs) o.stop(t + 0.7);
      this._chase = null;
    }
  }
}
