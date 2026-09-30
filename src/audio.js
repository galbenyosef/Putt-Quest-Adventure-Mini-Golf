// Everything you hear is synthesised at runtime with the Web Audio API – no audio files.
const LS_KEY = 'puttquest.muted.v1';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pent: [0, 2, 4, 7, 9],
  mpent: [0, 3, 5, 7, 10],
  whole: [0, 2, 4, 6, 8, 10],
};
const PROGS = {
  major: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]],
  minor: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]],
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(LS_KEY) === '1';
    } catch (e) {
      /* ignore */
    }
    this.music = null;
    this.musicTimer = null;
    this.rand = Math.random;
    this.listeners = [];
  }

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.17;
    this.musicGain.connect(this.master);
    // shared noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // a tiny reverb-ish delay for music / fanfares
    this.delay = this.ctx.createDelay(0.5);
    this.delay.delayTime.value = 0.23;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.32;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(wet);
    wet.connect(this.master);
    this.delayIn = this.ctx.createGain();
    this.delayIn.connect(this.delay);
  }

  setMuted(m) {
    this.muted = m;
    try {
      localStorage.setItem(LS_KEY, m ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.03);
    this.listeners.forEach((f) => f(m));
  }
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
  onMute(fn) {
    this.listeners.push(fn);
  }

  get t() {
    return this.ctx.currentTime;
  }
  ok() {
    return !!this.ctx && !this.muted;
  }

  // -- primitives ----------------------------------------------------------------------------
  tone({ f0 = 440, f1 = null, dur = 0.2, type = 'sine', vol = 0.3, attack = 0.005, delay = 0, wet = 0, dest = null, detune = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    if (wet > 0) {
      const w = c.createGain();
      w.gain.value = wet;
      g.connect(w);
      w.connect(this.delayIn);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, type = 'lowpass', f0 = 1000, f1 = null, q = 1, vol = 0.3, attack = 0.005, delay = 0, dest = null }) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur + 0.05);
  }

  // -- game sounds ---------------------------------------------------------------------------
  putt(p = 0.5) {
    if (!this.ok()) return;
    this.tone({ f0: 240 + p * 60, f1: 62, dur: 0.14, type: 'sine', vol: 0.55 + p * 0.3 });
    this.tone({ f0: 900, f1: 300, dur: 0.05, type: 'triangle', vol: 0.15 + p * 0.1 });
    this.noise({ dur: 0.05, type: 'bandpass', f0: 2200, q: 0.8, vol: 0.2 + p * 0.2 });
  }
  swing(p = 0.5) {
    if (!this.ok()) return;
    this.noise({ dur: 0.18, type: 'bandpass', f0: 500, f1: 2400, q: 1.2, vol: 0.05 + p * 0.09, attack: 0.05 });
  }
  wall(speed = 3) {
    if (!this.ok()) return;
    const v = Math.min(0.42, 0.06 + speed * 0.045);
    const f = 380 + Math.random() * 120;
    this.tone({ f0: f * 1.4, f1: f * 0.8, dur: 0.09, type: 'triangle', vol: v });
    this.tone({ f0: f * 0.5, f1: f * 0.3, dur: 0.07, type: 'sine', vol: v * 0.8 });
    this.noise({ dur: 0.03, type: 'highpass', f0: 3000, vol: v * 0.5 });
  }
  metal(speed = 3) {
    if (!this.ok()) return;
    const v = Math.min(0.32, 0.05 + speed * 0.03);
    this.tone({ f0: 1250, f1: 1180, dur: 0.22, type: 'square', vol: v * 0.35 });
    this.tone({ f0: 1870, f1: 1800, dur: 0.16, type: 'sine', vol: v * 0.5 });
    this.noise({ dur: 0.04, type: 'highpass', f0: 4000, vol: v * 0.4 });
  }
  bumper() {
    if (!this.ok()) return;
    this.tone({ f0: 260, f1: 740, dur: 0.16, type: 'square', vol: 0.16 });
    this.tone({ f0: 880, f1: 1320, dur: 0.22, type: 'sine', vol: 0.22, delay: 0.02, wet: 0.2 });
  }
  land(speed = 3) {
    if (!this.ok()) return;
    this.tone({ f0: 140, f1: 60, dur: 0.12, type: 'sine', vol: Math.min(0.5, speed * 0.1) });
    this.noise({ dur: 0.05, type: 'lowpass', f0: 900, vol: 0.1 });
  }
  cup() {
    if (!this.ok()) return;
    for (let i = 0; i < 4; i++) this.noise({ dur: 0.05, type: 'highpass', f0: 2600 - i * 300, vol: 0.18 - i * 0.03, delay: i * 0.055 });
    this.tone({ f0: 320, f1: 90, dur: 0.22, type: 'sine', vol: 0.5, delay: 0.14 });
    this.tone({ f0: 880, dur: 0.5, type: 'sine', vol: 0.22, delay: 0.3, wet: 0.35 });
    this.tone({ f0: 1318, dur: 0.6, type: 'sine', vol: 0.18, delay: 0.42, wet: 0.35 });
  }
  splash() {
    if (!this.ok()) return;
    this.noise({ dur: 0.75, type: 'lowpass', f0: 3200, f1: 350, vol: 0.5, attack: 0.01 });
    this.noise({ dur: 0.3, type: 'bandpass', f0: 1200, q: 0.6, vol: 0.25 });
    for (let i = 0; i < 4; i++) this.tone({ f0: 260 + Math.random() * 200, f1: 700 + Math.random() * 500, dur: 0.11, type: 'sine', vol: 0.16, delay: 0.1 + i * 0.09 });
    this.tone({ f0: 180, f1: 60, dur: 0.3, type: 'sine', vol: 0.35 });
  }
  lava() {
    if (!this.ok()) return;
    this.noise({ dur: 1.0, type: 'highpass', f0: 3400, f1: 1500, vol: 0.28, attack: 0.02 });
    this.noise({ dur: 0.6, type: 'lowpass', f0: 500, f1: 120, vol: 0.4 });
    this.tone({ f0: 90, f1: 40, dur: 0.6, type: 'sawtooth', vol: 0.25 });
    for (let i = 0; i < 5; i++) this.tone({ f0: 160 + Math.random() * 120, f1: 500, dur: 0.07, type: 'sine', vol: 0.12, delay: 0.1 + i * 0.1 });
  }
  oob() {
    if (!this.ok()) return;
    this.tone({ f0: 700, f1: 120, dur: 0.6, type: 'sawtooth', vol: 0.12 });
    this.noise({ dur: 0.5, type: 'bandpass', f0: 1500, f1: 200, q: 1, vol: 0.2 });
  }
  portal() {
    if (!this.ok()) return;
    this.tone({ f0: 240, f1: 1500, dur: 0.32, type: 'sine', vol: 0.25, wet: 0.3 });
    this.tone({ f0: 1500, f1: 300, dur: 0.3, type: 'triangle', vol: 0.16, delay: 0.18, wet: 0.3 });
    this.noise({ dur: 0.4, type: 'bandpass', f0: 500, f1: 3500, q: 2, vol: 0.14 });
  }
  boost() {
    if (!this.ok()) return;
    this.noise({ dur: 0.4, type: 'bandpass', f0: 400, f1: 3200, q: 1.5, vol: 0.22 });
    this.tone({ f0: 200, f1: 700, dur: 0.3, type: 'sawtooth', vol: 0.09 });
  }
  whoosh() {
    if (!this.ok()) return;
    this.noise({ dur: 0.5, type: 'bandpass', f0: 300, f1: 2000, q: 1.2, vol: 0.2, attack: 0.15 });
  }
  click() {
    if (!this.ok()) return;
    this.tone({ f0: 660, f1: 880, dur: 0.06, type: 'square', vol: 0.1 });
  }
  tick(p = 0) {
    if (!this.ok()) return;
    this.tone({ f0: 420 + p * 700, dur: 0.03, type: 'square', vol: 0.05 });
  }
  roar(vol = 1) {
    if (!this.ok()) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o2.type = 'square';
    o.frequency.setValueAtTime(70, t0);
    o.frequency.linearRampToValueAtTime(130, t0 + 0.35);
    o.frequency.linearRampToValueAtTime(52, t0 + 1.3);
    o2.frequency.setValueAtTime(35, t0);
    o2.frequency.linearRampToValueAtTime(65, t0 + 0.35);
    o2.frequency.linearRampToValueAtTime(26, t0 + 1.3);
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 26;
    lg.gain.value = 25;
    lfo.connect(lg);
    lg.connect(o.frequency);
    f.type = 'bandpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(400, t0);
    f.frequency.linearRampToValueAtTime(1100, t0 + 0.4);
    f.frequency.linearRampToValueAtTime(300, t0 + 1.3);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.6 * vol, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    lfo.start(t0);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 1.4);
    o2.stop(t0 + 1.4);
    lfo.stop(t0 + 1.4);
    this.noise({ dur: 1.0, type: 'bandpass', f0: 900, f1: 300, q: 1, vol: 0.2 * vol });
  }
  stomp(vol = 1) {
    if (!this.ok()) return;
    this.tone({ f0: 90, f1: 32, dur: 0.35, type: 'sine', vol: 0.7 * vol });
    this.noise({ dur: 0.25, type: 'lowpass', f0: 500, f1: 80, vol: 0.4 * vol });
  }
  chomp(vol = 1) {
    if (!this.ok()) return;
    this.tone({ f0: 180, f1: 70, dur: 0.12, type: 'square', vol: 0.18 * vol });
    this.noise({ dur: 0.08, type: 'highpass', f0: 1800, vol: 0.28 * vol });
  }
  cannon() {
    if (!this.ok()) return;
    this.tone({ f0: 160, f1: 38, dur: 0.5, type: 'sine', vol: 0.7 });
    this.noise({ dur: 0.45, type: 'lowpass', f0: 1600, f1: 120, vol: 0.5 });
  }
  gear(vol = 0.3) {
    if (!this.ok()) return;
    this.tone({ f0: 700, f1: 520, dur: 0.04, type: 'square', vol: 0.05 * vol });
  }
  piston() {
    if (!this.ok()) return;
    this.tone({ f0: 110, f1: 55, dur: 0.14, type: 'square', vol: 0.16 });
    this.noise({ dur: 0.12, type: 'bandpass', f0: 1200, q: 1, vol: 0.13 });
  }
  applause(dur = 2.4, vol = 0.22) {
    if (!this.ok()) return;
    for (let i = 0; i < Math.floor(dur * 14); i++) {
      this.noise({ dur: 0.06 + Math.random() * 0.06, type: 'bandpass', f0: 1200 + Math.random() * 1800, q: 0.7, vol: vol * (0.4 + Math.random() * 0.6) * Math.min(1, (dur * 14 - i) / 10), delay: i * 0.07 + Math.random() * 0.05 });
    }
  }
  fanfare(kind = 'par') {
    if (!this.ok()) return;
    const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const seq = {
      par: [[60, 0], [64, 0.11], [67, 0.22]],
      birdie: [[60, 0], [64, 0.1], [67, 0.2], [72, 0.3], [76, 0.42]],
      eagle: [[60, 0], [64, 0.09], [67, 0.18], [72, 0.27], [76, 0.36], [79, 0.45], [84, 0.6]],
      ace: [[60, 0], [64, 0.08], [67, 0.16], [72, 0.24], [76, 0.32], [79, 0.4], [84, 0.48], [88, 0.62], [91, 0.74], [96, 0.9]],
      bad: [[62, 0], [59, 0.16], [55, 0.32]],
    }[kind] || [];
    for (const [m, d] of seq) {
      this.tone({ f0: N(m), dur: kind === 'ace' ? 0.6 : 0.4, type: 'triangle', vol: 0.22, delay: d, wet: 0.4 });
      this.tone({ f0: N(m) * 2, dur: 0.3, type: 'sine', vol: 0.08, delay: d, wet: 0.4 });
    }
    if (kind === 'birdie' || kind === 'eagle' || kind === 'ace') {
      this.applause(kind === 'ace' ? 3.6 : 2.2, kind === 'ace' ? 0.3 : 0.2);
    }
    if (kind === 'ace' || kind === 'eagle') {
      for (let i = 0; i < 10; i++) this.tone({ f0: 1800 + Math.random() * 2600, dur: 0.16, type: 'sine', vol: 0.06, delay: 0.5 + i * 0.13 + Math.random() * 0.1, wet: 0.5 });
      // firework pops
      for (let i = 0; i < 6; i++) {
        this.noise({ dur: 0.25, type: 'lowpass', f0: 1800, f1: 200, vol: 0.28, delay: 0.7 + i * 0.32 });
        this.noise({ dur: 0.5, type: 'highpass', f0: 5000, vol: 0.06, delay: 0.75 + i * 0.32 });
      }
    }
  }
  jingle() {
    if (!this.ok()) return;
    const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
    [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => this.tone({ f0: N(m), dur: 0.22, type: 'triangle', vol: 0.2, delay: i * 0.12, wet: 0.4 }));
  }

  // -- music -------------------------------------------------------------------------------
  startMusic(theme = {}) {
    if (!this.ctx) return;
    this.stopMusic();
    const m = { root: 0, scale: 'major', tempo: 96, wave: 'triangle', arp: 0.5, ...theme };
    this.music = { ...m, step: 0, next: this.ctx.currentTime + 0.15, seed: 1 };
    this.musicTimer = setInterval(() => this._musicTick(), 80);
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.music = null;
  }
  _musicTick() {
    const m = this.music;
    if (!m || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') return;
    const eighth = 60 / m.tempo / 2;
    if (m.next < ctx.currentTime - 0.5) m.next = ctx.currentTime + 0.05;
    while (m.next < ctx.currentTime + 0.35) {
      this._musicStep(m, m.next, eighth);
      m.next += eighth;
      m.step++;
    }
  }
  _musicStep(m, t, eighth) {
    const N = (semi) => 261.63 * Math.pow(2, (semi + m.root) / 12);
    const prog = PROGS[m.scale === 'minor' || m.scale === 'mpent' ? 'minor' : 'major'];
    const bar = Math.floor(m.step / 8) % prog.length;
    const chord = prog[bar];
    const s = m.step % 8;
    const play = (f, dur, vol, type = m.wave, wet = 0.25, delayT = 0) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      const t0 = t + delayT;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.musicGain);
      if (wet) {
        const w = this.ctx.createGain();
        w.gain.value = wet;
        g.connect(w);
        w.connect(this.delayIn);
      }
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    };
    // bass
    if (s === 0 || s === 4) play(N(chord[0] - 24), eighth * 3.6, 0.5, 'sine', 0);
    // arpeggio
    const pat = [0, 1, 2, 1, 2, 1, 0, 2];
    if (s % 2 === 0 || m.arp > 0.7) play(N(chord[pat[s] % 3] - 12 + (s > 3 ? 12 : 0)), eighth * 1.6, 0.16 * m.arp * 2, m.wave, 0.35);
    // pad on chord start
    if (s === 0) {
      chord.forEach((c, i) => play(N(c - 12), eighth * 7.5, 0.06, 'sine', 0.3, i * 0.02));
    }
    // melody
    const sc = SCALES[m.scale] || SCALES.major;
    m.seed = (m.seed * 1664525 + 1013904223) >>> 0;
    const r = (m.seed >>> 8) / 16777216;
    if ((s === 2 || s === 6 || (s === 4 && r > 0.6)) && r > 0.15) {
      const deg = Math.floor(r * 997) % sc.length;
      const oct = r > 0.7 ? 12 : 0;
      play(N(sc[deg] + oct), eighth * 2.4, 0.11, 'sine', 0.5);
    }
  }
}
