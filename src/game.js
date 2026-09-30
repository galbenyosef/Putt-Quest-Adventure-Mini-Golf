// Game flow: menu → fly-over → aim → charge → swing → roll → (hazard | cup) → scorecard → … → final card.
import * as THREE from 'three';
import { Stage } from './render/stage.js';
import { Batch, U } from './render/toon.js';
import { FX } from './render/fx.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { Putter, AimGuide } from './putter.js';
import { UI, scoreInfo, relText, MAX_STROKES } from './ui.js';
import { store } from './store.js';
import { World, BALL_R, PUTT_MAX } from './physics.js';
import { HOLE_DEFS, buildHole } from './holes/index.js';
import { clamp, angleDiff, TAU, smoothstep } from './util.js';

const AIM_SENS = 0.0021;
const POWER_PX = 230;

export const speedFromPower = (p) => 0.55 + (PUTT_MAX - 0.55) * Math.pow(p, 1.4);

export class Game {
  constructor() {
    this.canvas = document.getElementById('c');
    this.stage = new Stage(this.canvas);
    this.ui = new UI();
    this.sound = new Sound();
    this.input = new Input(this.canvas);
    this.rig = new CameraRig(this.stage.camera);
    this.fx = new FX(this.stage.scene);
    this.putter = new Putter();
    this.stage.scene.add(this.putter.root);
    this.guide = new AimGuide();
    this.stage.scene.add(this.guide.root);
    this.ballMesh = this._makeBall();
    this.stage.scene.add(this.ballMesh);

    this.state = 'boot';
    this.prevState = null;
    this.paused = false;
    this.time = 0;
    this.sens = 1;
    try {
      const s = parseFloat(localStorage.getItem('puttquest.sens.v1'));
      if (s > 0.2 && s < 3) this.sens = s;
    } catch (e) { /* ignore */ }
    this.ui.el.sens.value = String(Math.round(this.sens * 100));

    this.course = null;
    this.world = null;
    this.holeIndex = 0;
    this.scores = Array(HOLE_DEFS.length).fill(null);
    this.mode = 'round'; // 'round' | 'practice'
    this.strokes = 0;
    this.aim = 0;
    this.power = 0;
    this.pullPx = 0;
    this.lastSafe = { x: 0, z: 0, y: 0 };
    this.stateT = 0;
    this.expectUnlock = false;
    this.overviewHeld = false;
    this.slowTicks = 0;
    this.frameEma = 16;
    this.ctxObj = { camera: this.stage.camera, sound: this.sound, fx: this.fx, game: this, rig: this.rig, ball: null };

    this._wireUI();
    this._wireInput();
    this.ui.setMuteIcon(this.sound.muted);
    this.sound.onMute((m) => this.ui.setMuteIcon(m));
    this.last = performance.now();
    window.__golf = this;
  }

  // ---------------------------------------------------------------------------------------------
  // setup
  // ---------------------------------------------------------------------------------------------
  _makeBall() {
    const b = new Batch({ width: 0.55, shadow: true });
    b.vary = 0;
    b.sph(0, 0, 0, BALL_R, '#ffffff', { seg: 18 });
    b.tor(0, 0, 0, BALL_R * 1.004, 0.017, '#ff3d7f', { seg: 20 });
    b.tor(0, 0, 0, BALL_R * 1.004, 0.017, '#3d8bff', { seg: 20, rx: Math.PI / 2 });
    b.tor(0, 0, 0, BALL_R * 1.004, 0.017, '#ffd23f', { seg: 20, rz: Math.PI / 2 });
    const g = b.build();
    g.visible = false;
    return g;
  }

  _wireUI() {
    const ui = this.ui;
    const click = (id, fn) => {
      ui.$(id).addEventListener('click', (e) => {
        this.sound.init();
        this.sound.click();
        fn(e);
      });
    };
    click('m-play', () => this.startRound());
    click('m-select', () => this.openSelect('menu'));
    click('select-back', () => {
      ui.hide('select');
      ui.show(this.selectFrom === 'pause' ? 'pause' : 'menu');
    });
    click('m-help', () => {
      this.helpFrom = 'menu';
      ui.hide('menu');
      ui.show('help');
    });
    click('help-back', () => {
      ui.hide('help');
      ui.show(this.helpFrom === 'pause' ? 'pause' : 'menu');
    });
    click('m-mute', () => this.sound.toggleMute());
    click('btn-mute', () => this.sound.toggleMute());
    click('btn-restart', () => this.restartHole());
    click('btn-pause', () => this.pause());
    document.getElementById('btn-view').addEventListener('mousedown', () => (this.overviewBtnHeld = true));
    window.addEventListener('mouseup', () => {
      this.overviewBtnHeld = false;
    });
    click('p-resume', () => this.resume());
    click('p-restart', () => {
      this.resume();
      this.restartHole();
    });
    click('p-help', () => {
      this.helpFrom = 'pause';
      ui.hide('pause');
      ui.show('help');
    });
    click('p-select', () => this.openSelect('pause'));
    click('p-menu', () => this.toMenu());
    ui.el.sens.addEventListener('input', () => {
      this.sens = ui.el.sens.value / 100;
      try { localStorage.setItem('puttquest.sens.v1', String(this.sens)); } catch (e) { /* ignore */ }
    });
  }

  _wireInput() {
    const inp = this.input;
    inp.onLockChange = (locked) => {
      if (!locked) {
        if (this.expectUnlock) {
          this.expectUnlock = false;
          return;
        }
        if (['aim', 'charge', 'swing', 'roll', 'flyover'].includes(this.state) && !this.paused) this.pause();
      }
    };
    inp.onKey = (code, e) => {
      if (this.state === 'boot') return;
      this.sound.init();
      if (code === 'KeyM') this.sound.toggleMute();
      if (this.state === 'menu') return;
      if (code === 'Escape') {
        if (this.paused) this.resume();
        else if (this.state === 'flyover') this.skipFly();
        else if (this.state === 'charge') this.cancelCharge();
        else if (['aim', 'roll', 'swing'].includes(this.state)) this.pause();
        return;
      }
      if (this.state === 'card' || this.state === 'final') {
        if (code === 'Enter' || code === 'Space') this.ui.$('card-next')?.click();
        return;
      }
      if (this.paused) return;
      // practice mode: [ and ] hop to the previous / next hole
      if (this.mode === 'practice' && (code === 'BracketLeft' || code === 'BracketRight' || code === 'PageUp' || code === 'PageDown')) {
        if (['aim', 'charge', 'roll', 'swing', 'flyover', 'hazard'].includes(this.state)) {
          if (this.state === 'charge') this.cancelCharge();
          const n = HOLE_DEFS.length;
          const dir = code === 'BracketRight' || code === 'PageDown' ? 1 : -1;
          this.holeIndex = (this.holeIndex + dir + n) % n;
          this.loadHole(this.holeIndex, { fly: !this.debugFast });
          this.ui.toast(`Hole ${this.holeIndex + 1} · ${HOLE_DEFS[this.holeIndex].name}`);
        }
        return;
      }
      if (code === 'KeyR') this.restartHole();
      if (this.state === 'flyover' && (code === 'Space' || code === 'Enter')) this.skipFly();
      if (this.state === 'aim' && code === 'KeyF') this.startFly();
    };
    this.canvas.addEventListener('mousedown', () => {
      this.sound.init();
    });
  }

  // ---------------------------------------------------------------------------------------------
  // flow
  // ---------------------------------------------------------------------------------------------
  boot() {
    const params = new URLSearchParams(location.search);
    const h = parseInt(params.get('hole') || '0', 10);
    this.debugFast = params.get('fly') === '0';
    if (h >= 1 && h <= HOLE_DEFS.length) {
      this.mode = 'practice';
      this.holeIndex = h - 1;
      this.loadHole(this.holeIndex, { fly: !this.debugFast });
      this.ui.showHud(true);
    } else {
      this.toMenu(true);
    }
    this.ui.hideLoading();
    requestAnimationFrame(() => this.loop());
  }

  toMenu(first = false) {
    this.paused = false;
    this.expectUnlock = this.input.locked;
    this.input.exitLock();
    this.ui.hideAllScreens();
    this.ui.clearBanner();
    this.ui.showHud(false);
    this.ui.fly(false);
    const idx = first ? 1 : Math.floor(Math.random() * HOLE_DEFS.length);
    this.loadHole(Math.min(idx, HOLE_DEFS.length - 1), { menu: true });
    this.state = 'menu';
    this.rig.mode = 'menu';
    this.rig.t = 0;
    this.ui.menuBest();
    this.ui.show('menu');
    this.ballMesh.visible = false;
    this.putter.root.visible = false;
    this.guide.visible = false;
    this.sound.stopMusic();
  }

  /** Hole picker – used from the main menu and from the pause menu. */
  openSelect(from) {
    this.selectFrom = from;
    this.ui.buildSelect(HOLE_DEFS, (i) => {
      this.sound.init();
      this.sound.click();
      this.paused = false;
      this.startPractice(i);
    }, this.mode === 'practice' || from === 'menu' ? this.holeIndex : -1);
    this.ui.$('select-sub').textContent =
      from === 'pause' ? 'Jump to any hole. This starts practice play (the current round is not scored).' : 'Jump straight to any hole – your best strokes are saved on this device.';
    this.ui.hide(from === 'pause' ? 'pause' : 'menu');
    this.ui.show('select');
  }

  startRound() {
    this.mode = 'round';
    this.scores = Array(HOLE_DEFS.length).fill(null);
    this.holeIndex = 0;
    this.begin();
  }
  startPractice(i) {
    this.mode = 'practice';
    this.scores = Array(HOLE_DEFS.length).fill(null);
    this.holeIndex = i;
    this.begin();
  }
  begin() {
    this.ui.hideAllScreens();
    this.ui.showHud(true);
    this.input.requestLock();
    this.loadHole(this.holeIndex, { fly: !this.debugFast });
  }

  loadHole(i, { fly = false, menu = false } = {}) {
    let course;
    try {
      course = buildHole(i);
    } catch (err) {
      console.error('hole build failed', err);
      this.ui.toast('Failed to build hole ' + (i + 1), true, 4000);
      return;
    }
    this.fx.clear();
    this.stage.setCourse(course);
    this.rig.setCourse(course);
    this.course = course;
    this.world = new World(course);
    this.world.place(course.tee.x, course.tee.z);
    this.ctxObj.ball = this.world.ball;
    this.holeIndex = i;
    this.strokes = 0;
    this.power = 0;
    this.pullPx = 0;
    this.lastSafe = { x: course.tee.x, z: course.tee.z, y: course.tee.y + BALL_R };
    this.aim = this.routeAim();
    this.rig.aim = this.aim;
    this.rig.elev = 0.22;
    this.rig.overview = 0;
    this.stage.vignette.uniforms.uDip.value = 1;
    this.putter.reset();
    this.guide.visible = false;
    this.ballMesh.visible = !menu;
    this.updateBallMesh(0, true);
    if (menu) return;
    const def = HOLE_DEFS[i];
    this.ui.setHole(i, HOLE_DEFS.length, def.name, def.par);
    this.ui.setStrokes(0);
    this.updateTotal();
    this.ui.clearBanner();
    this.ui.tip(null);
    if (this.sound.ctx) this.sound.startMusic(course.theme.music);
    if (fly) this.startFly();
    else {
      this.rig.snapToAim(this.world.ball);
      this.beginAim();
    }
  }

  /** Debug helper (also handy for demos): drop the ball into the cup as if holed with `strokes` strokes. */
  cheat(strokes = 2) {
    if (!this.world || !this.course.cup) return;
    const c = this.course.cup;
    const b = this.world.ball;
    this.strokes = strokes;
    this.ui.setStrokes(strokes);
    this.world.place(c.x + 0.35, c.z, c.y);
    b.vx = -1.0;
    b.vz = 0;
    this.state = 'roll';
    this.ballMesh.visible = true;
    this.rig.setMode('follow');
  }

  updateTotal() {
    let tot = 0;
    let par = 0;
    let has = false;
    this.scores.forEach((s, i) => {
      if (s != null) {
        tot += s;
        par += HOLE_DEFS[i].par;
        has = true;
      }
    });
    this.ui.setTotal(tot - par, has);
  }

  startFly() {
    this.state = 'flyover';
    this.stateT = 0;
    this.rig.startFly();
    this.putter.setVisible(false);
    this.guide.visible = false;
    this.ui.fly(true, HOLE_DEFS[this.holeIndex], this.holeIndex, HOLE_DEFS.length);
    this.ui.showHint(false);
    this.ui.setPower(0, false);
    this.sound.whoosh();
  }
  skipFly() {
    if (this.state !== 'flyover') return;
    this.ui.fly(false);
    this.beginAim(true);
  }

  beginAim(fromFly = false) {
    this.state = 'aim';
    this.stateT = 0;
    this.rig.setMode('aim');
    this.rig.blend = fromFly ? 0 : this.rig.blend;
    this.putter.reset();
    this.putter.setVisible(true);
    this.guide.visible = true;
    this.ui.fly(false);
    this.ui.showHint(true);
    this.ui.setHint(
      this.input.lockFailed
        ? '<kbd>Mouse</kbd>/<kbd>←</kbd><kbd>→</kbd> aim &nbsp;•&nbsp; hold <kbd>Click</kbd> &amp; drag down to charge, release to putt &nbsp;•&nbsp; hold <kbd>Space</kbd> overview'
        : '<kbd>Mouse</kbd> aim &nbsp;•&nbsp; hold <kbd>Click</kbd> &amp; drag back to charge, release to putt &nbsp;•&nbsp; hold <kbd>Space</kbd> overview'
    );
    this.input.clearEdges();
    this.power = 0;
    this.pullPx = 0;
    this.ui.setPower(0, false);
    if (this.strokes === 0 && this.course.hintText) this.ui.tip(this.course.hintText);
  }

  routeAim() {
    const c = this.course;
    const b = this.world.ball;
    const cup = c.cup;
    const dc = Math.hypot(cup.x - b.x, cup.z - b.z);
    let tx = cup.x, tz = cup.z;
    const routes = c.routes || (c.route ? [c.route] : []);
    if (dc > 7 && routes.length) {
      // pick the route that passes closest to the ball, then look ~6 units ahead along it
      let R = routes[0], best = 1e9, bi = 0, bt = 0;
      for (const rt of routes) {
        for (let i = 0; i < rt.length - 1; i++) {
          const ax = rt[i][0], az = rt[i][2], bx = rt[i + 1][0], bz = rt[i + 1][2];
          const dx = bx - ax, dz = bz - az;
          const l2 = dx * dx + dz * dz || 1;
          const t = clamp(((b.x - ax) * dx + (b.z - az) * dz) / l2, 0, 1);
          const d = Math.hypot(b.x - (ax + dx * t), b.z - (az + dz * t));
          if (d < best) { best = d; bi = i; bt = t; R = rt; }
        }
      }
      let remain = 6;
      let i = bi;
      let t = bt;
      let px = R[i][0] + (R[i + 1][0] - R[i][0]) * t, pz = R[i][2] + (R[i + 1][2] - R[i][2]) * t;
      while (remain > 0 && i < R.length - 1) {
        const nx = R[i + 1][0], nz = R[i + 1][2];
        const seg = Math.hypot(nx - px, nz - pz);
        if (seg >= remain) {
          px += ((nx - px) / seg) * remain;
          pz += ((nz - pz) / seg) * remain;
          remain = 0;
        } else {
          remain -= seg;
          px = nx; pz = nz;
          i++;
        }
      }
      tx = px; tz = pz;
    }
    if (Math.hypot(tx - b.x, tz - b.z) < 0.3) return this.aim || 0;
    return Math.atan2(tx - b.x, -(tz - b.z));
  }

  restartHole() {
    if (!this.world || ['menu', 'card', 'final', 'boot'].includes(this.state)) return;
    this.strokes = 0;
    this.ui.setStrokes(0);
    const c = this.course;
    this.world.place(c.tee.x, c.tee.z);
    this.lastSafe = { x: c.tee.x, z: c.tee.z, y: c.tee.y + BALL_R };
    this.aim = this.routeAim();
    this.rig.aim = this.aim;
    this.fx.clear();
    this.ballMesh.visible = true;
    this.fx.poof(c.tee.x, c.tee.y + 0.2, c.tee.z);
    this.ui.toast('Hole restarted');
    this.ui.clearBanner();
    this.rig.mode = 'aim';
    this.rig.blend = 0;
    this.beginAim();
  }

  cancelCharge() {
    this.putter.cancel();
    this.power = 0;
    this.pullPx = 0;
    this.ui.setPower(0, false);
    this.state = 'aim';
    this.input.clearEdges();
  }

  pause() {
    if (this.paused || this.state === 'menu' || this.state === 'card' || this.state === 'final') return;
    this.paused = true;
    if (this.state === 'charge') this.cancelCharge();
    this.expectUnlock = this.input.locked;
    this.input.exitLock();
    this.ui.$('pause-sub').textContent = `Hole ${this.holeIndex + 1} · ${HOLE_DEFS[this.holeIndex].name}`;
    this.ui.show('pause');
    this.ui.hide('help');
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ui.hide('pause');
    this.ui.hide('help');
    this.input.requestLock();
    this.input.clearEdges();
    this.last = performance.now();
  }

  // ---------------------------------------------------------------------------------------------
  // shot handling
  // ---------------------------------------------------------------------------------------------
  hit(power) {
    const w = this.world;
    const b = w.ball;
    const speed = speedFromPower(power);
    w.putt(this.aim, speed);
    this.strokes++;
    this.ui.setStrokes(this.strokes, true);
    if (!b.mover) this.lastSafe = { x: b.x, z: b.z, y: b.y };
    this.sound.putt(power);
    this.fx.dust(b.x, b.y - BALL_R, b.z, 5, '#f2ecd0');
    this.fx.sparks(b.x, b.y, b.z, '#ffffff', 8, 2 + power * 3);
    this.rig.fdir.set(Math.sin(this.aim), 0, -Math.cos(this.aim));
    this.rig.setMode('follow');
    this.rig.addShake(power * 0.3);
    this.state = 'roll';
    this.stateT = 0;
    this.guide.visible = false;
    this.ui.setPower(0, false);
    this.ui.showHint(false);
    this.ui.tip(null);
  }

  onStopped() {
    if (this.strokes >= MAX_STROKES) {
      this.finishHole(true);
      return;
    }
    const b = this.world.ball;
    if (!b.mover) this.lastSafe = { x: b.x, z: b.z, y: b.y };
    this.aim = this.routeAim();
    this.rig.aim = this.aim;
    this.beginAim();
  }

  onHazard(ev) {
    this.state = 'hazard';
    this.stateT = 0;
    this.ballMesh.visible = false;
    const kind = ev.kind;
    if (kind === 'lava') {
      this.sound.lava();
      this.fx.lavaSplash(ev.x, ev.y, ev.z);
      this.ui.toast('🔥 Burnt! +1 stroke', true, 2200);
    } else if (kind === 'water') {
      this.sound.splash();
      this.fx.splash(ev.x, ev.y, ev.z, this.course.theme.water ? this.course.theme.water.shallow : '#bfefff');
      this.ui.toast('💦 Splash! +1 stroke', true, 2200);
    } else {
      this.sound.oob();
      this.ui.toast('Out of bounds! +1 stroke', true, 2200);
    }
    this.strokes++;
    this.ui.setStrokes(this.strokes, true);
    this.rig.addShake(0.25);
  }

  respawn() {
    if (this.strokes >= MAX_STROKES) {
      this.finishHole(true);
      return;
    }
    const s = this.lastSafe;
    this.world.place(s.x, s.z, s.y);
    this.ballMesh.visible = true;
    this.fx.poof(s.x, s.y, s.z, '#ffffff');
    this.aim = this.routeAim();
    this.rig.aim = this.aim;
    this.rig.blend = 0;
    this.beginAim();
  }

  onCup() {
    this.state = 'holed';
    this.stateT = 0;
    this.celebrated = false;
    this.holedKind = null;
    this.sound.cup();
    this.ui.setPower(0, false);
    this.guide.visible = false;
    this.putter.setVisible(false);
    this.ui.tip(null);
    this.ui.showHint(false);
    this.rig.setMode('cup');
    this.rig.cupOrbit = Math.atan2(this.rig.pos.z - this.course.cup.z, this.rig.pos.x - this.course.cup.x);
  }

  celebrate() {
    const def = HOLE_DEFS[this.holeIndex];
    const info = scoreInfo(this.strokes, def.par);
    this.scores[this.holeIndex] = this.strokes;
    const improved = store.recordHole(this.holeIndex, this.strokes);
    this.updateTotal();
    const cup = this.course.cup;
    this.ui.banner(info.name.toUpperCase(), info.sub, info.kind === 'ace' ? 3800 : 2600);
    this.sound.fanfare(info.kind);
    this.result = { info, improved };
    this.rig.addShake(info.kind === 'ace' ? 0.7 : 0.25);
    if (info.kind === 'ace' || info.kind === 'eagle' || info.kind === 'birdie') {
      this.fx.confetti(cup.x, cup.y + 0.4, cup.z, info.kind === 'ace' ? 260 : info.kind === 'eagle' ? 200 : 140, 1);
      this.fx.ring(cup.x, cup.y + 0.1, cup.z, '#fff3a0');
    } else if (info.kind === 'par') {
      this.fx.confetti(cup.x, cup.y + 0.4, cup.z, 40, 0.7);
      this.fx.ring(cup.x, cup.y + 0.1, cup.z, '#bfffe0', 30, 2.6);
    } else {
      this.fx.sparks(cup.x, cup.y + 0.2, cup.z, '#ffd23f', 20, 2);
    }
    if (info.kind === 'ace' || info.kind === 'eagle') {
      for (let k = 0; k < (info.kind === 'ace' ? 7 : 4); k++) {
        setTimeout(() => this.state === 'holed' && this.fx.firework(cup.x + (Math.random() - 0.5) * 6, cup.y, cup.z + (Math.random() - 0.5) * 6), 300 + k * 420);
      }
    }
    this.holedKind = info.kind;
  }

  finishHole(capped) {
    const def = HOLE_DEFS[this.holeIndex];
    this.state = 'holed';
    this.stateT = 0;
    this.strokes = MAX_STROKES;
    this.ui.setStrokes(this.strokes);
    const info = scoreInfo(this.strokes, def.par, true);
    this.scores[this.holeIndex] = this.strokes;
    store.recordHole(this.holeIndex, this.strokes);
    this.updateTotal();
    this.result = { info, improved: false, capped: true };
    this.holedKind = 'bad';
    this.ui.banner('PICK UP!', info.sub, 2600);
    this.sound.fanfare('bad');
    this.ui.setPower(0, false);
    this.guide.visible = false;
    this.putter.setVisible(false);
    this.ballMesh.visible = false;
    this.celebrated = true;
    this.rig.setMode('cup');
  }

  showCard() {
    this.state = 'card';
    this.expectUnlock = this.input.locked;
    this.input.exitLock();
    const def = HOLE_DEFS[this.holeIndex];
    const ui = this.ui;
    const r = this.result;
    const last = this.holeIndex === HOLE_DEFS.length - 1;
    const t = ui.table(HOLE_DEFS, this.scores, this.holeIndex);
    const rel = t.total - t.playedPar;
    const nextLabel = this.mode === 'round' ? (last ? 'Final Scorecard →' : 'Next Hole →') : last ? 'Main Menu' : 'Next Hole →';
    ui.el.scorePanel.innerHTML = `
      <div class="card-title">Hole ${this.holeIndex + 1} · ${def.name}</div>
      <div class="result-line">${r.info.name} <span style="font-weight:800;font-size:20px">— ${this.strokes} stroke${this.strokes === 1 ? '' : 's'} (par ${def.par})</span></div>
      ${r.improved ? '<div class="newbest">★ NEW PERSONAL BEST FOR THIS HOLE ★</div>' : ''}
      <div class="card-sub">Running total: ${t.total} strokes (${relText(rel)})</div>
      ${t.html}
      <div class="card-actions">
        <button class="btn green" id="card-next">${nextLabel}</button>
        <button class="btn secondary" id="card-retry">Retry Hole</button>
        <button class="btn secondary small" id="card-menu">Menu</button>
      </div>`;
    ui.show('scorecard');
    ui.$('card-next').onclick = () => {
      this.sound.init();
      this.sound.click();
      this.nextHole();
    };
    ui.$('card-retry').onclick = () => {
      this.sound.click();
      ui.hide('scorecard');
      this.input.requestLock();
      this.mode === 'round' ? (this.scores[this.holeIndex] = null) : null;
      this.updateTotal();
      this.loadHole(this.holeIndex, { fly: false });
    };
    ui.$('card-menu').onclick = () => {
      this.sound.click();
      this.toMenu();
    };
  }

  nextHole() {
    this.ui.hide('scorecard');
    if (this.holeIndex >= HOLE_DEFS.length - 1) {
      if (this.mode === 'round') this.showFinal();
      else this.toMenu();
      return;
    }
    this.input.requestLock();
    this.loadHole(this.holeIndex + 1, { fly: !this.debugFast });
  }

  showFinal() {
    this.state = 'final';
    const ui = this.ui;
    const t = ui.table(HOLE_DEFS, this.scores, -1);
    const rel = t.total - t.par;
    const best = store.recordRound(t.total);
    let stars = 1;
    if (rel <= 4) stars = 2;
    if (rel <= 0) stars = 3;
    if (rel <= -4) stars = 4;
    if (rel <= -8) stars = 5;
    const title = rel <= -8 ? 'Mini Golf Legend!' : rel <= -4 ? 'Adventure Champion!' : rel <= 0 ? 'Great Round!' : rel <= 6 ? 'Nice Round!' : rel <= 14 ? 'Round Complete' : 'You Made It!';
    this.sound.fanfare(rel <= -4 ? 'eagle' : rel <= 0 ? 'birdie' : 'par');
    if (rel <= 0) this.fx.confetti(this.rig.look.x, this.rig.look.y + 2, this.rig.look.z, 200, 1.2);
    ui.el.scorePanel.innerHTML = `
      <div class="card-title">${title}</div>
      <div class="stars">${'★'.repeat(stars)}<span style="opacity:.25">${'★'.repeat(5 - stars)}</span></div>
      <div class="result-line">${t.total} strokes <span style="font-weight:800;font-size:20px">(${relText(rel)} vs par ${t.par})</span></div>
      ${best === 'new' ? '<div class="newbest">★ NEW BEST ROUND! ★</div>' : best === 'first' ? '<div class="newbest">★ FIRST ROUND RECORDED ★</div>' : ''}
      <div class="card-sub">Best round: ${store.bestRound} strokes · Rounds played: ${store.rounds}</div>
      ${t.html}
      <div class="card-actions">
        <button class="btn green" id="card-next">▶ Play Again</button>
        <button class="btn secondary" id="card-menu">Main Menu</button>
      </div>`;
    ui.show('scorecard');
    ui.$('card-next').onclick = () => {
      this.sound.click();
      this.ui.hide('scorecard');
      this.startRound();
    };
    ui.$('card-menu').onclick = () => {
      this.sound.click();
      this.toMenu();
    };
  }

  // ---------------------------------------------------------------------------------------------
  // per-frame
  // ---------------------------------------------------------------------------------------------
  groundAt(x, z, y) {
    const h = this.world.tris.query(x, z, y + 0.35);
    if (h) return h.y;
    return null;
  }

  updateBallMesh(dt, snap = false) {
    const b = this.world.ball;
    const m = this.ballMesh;
    m.position.set(b.x, b.y, b.z);
    if (dt > 0 && b.mode !== 'cup') {
      const vx = b.vx, vz = b.vz;
      const hs = Math.hypot(vx, vz);
      if (hs > 0.02) {
        this._axis = this._axis || new THREE.Vector3();
        this._q = this._q || new THREE.Quaternion();
        this._axis.set(vz, 0, -vx).normalize();
        this._q.setFromAxisAngle(this._axis, (hs * dt) / BALL_R);
        m.quaternion.premultiply(this._q);
      }
    }
    if (b.mode === 'cup') {
      const k = clamp(1 - b.holeT / 0.3, 0.001, 1);
      m.scale.setScalar(k);
    } else m.scale.setScalar(1);
  }

  handleEvents() {
    const w = this.world;
    const evs = w.events;
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      switch (ev.type) {
        case 'wall':
          if (this.course.def.wallSound === 'metal') this.sound.metal(ev.speed);
          else this.sound.wall(ev.speed);
          if (ev.speed > 3) this.fx.sparks(ev.x, ev.y, ev.z, '#fff6c8', 5, 1.5);
          break;
        case 'metal':
          this.sound.metal(ev.speed);
          this.fx.sparks(ev.x, ev.y, ev.z, '#ffd27a', 8, 2.5);
          break;
        case 'bumper':
          this.sound.bumper();
          if (ev.ref) ev.ref.pulse = 1;
          this.fx.sparks(ev.x, w.ball.y, ev.z, '#ffe27a', 12, 3);
          break;
        case 'land':
          this.sound.land(ev.speed);
          this.fx.dust(ev.x, ev.y, ev.z, 6);
          break;
        case 'portal':
          this.sound.portal();
          this.fx.poof(ev.from.x, ev.from.ty + 0.2, ev.from.z, '#b9a0ff');
          this.fx.poof(ev.to.x, ev.to.ty + 0.2, ev.to.z, '#7ff5ff');
          this.rig.fdir.set(Math.sin(ev.to.exit), 0, -Math.cos(ev.to.exit));
          break;
        case 'boost':
          this.sound.boost();
          this.fx.sparks(ev.ref.x, ev.ref.y, ev.ref.z, '#7dffb5', 14, 3);
          break;
        case 'pipeIn':
        case 'pipeOut':
          this.sound.whoosh();
          break;
        case 'cup':
          if (this.state === 'roll') this.onCup();
          break;
        case 'hazard':
          if (this.state === 'roll' || this.state === 'swing') this.onHazard(ev);
          else if (this.state === 'aim' || this.state === 'charge') {
            // ball drifted into a hazard while waiting (e.g. carried by a platform)
            this.onHazard(ev);
          }
          break;
        default:
          break;
      }
    }
    evs.length = 0;
  }

  loop() {
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    // adaptive quality
    this.frameEma += (dt * 1000 - this.frameEma) * 0.05;
    if (this.frameEma > 24 && !this.paused) {
      this.slowTicks++;
      if (this.slowTicks > 150) {
        this.slowTicks = 0;
        if (this.stage.pixelRatio > 1.05) this.stage.setPixelRatio(Math.max(1, this.stage.pixelRatio - 0.4));
        else if (this.stage.bloomEnabled) this.stage.setBloom(false);
        this.frameEma = 16;
      }
    } else this.slowTicks = Math.max(0, this.slowTicks - 1);
    try {
      this.tick(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(() => this.loop());
  }

  tick(dt) {
    const world = this.world;
    if (!world) return;
    const b = world.ball;
    if (!this.paused) {
      this.time += dt;
      U.uTime.value = this.time;
      world.stepFrame(dt);
      this.handleEvents();
      this.course.update(world.t, dt, this.ctxObj);
      this.stateT += dt;
      this.updateState(dt, b);
    }
    // visuals that always update
    this.updateBallMesh(this.paused ? 0 : dt);
    this.putter.update(this.paused ? 0 : dt, b, this.aim, this.state === 'charge' ? this.power : 0, this.time);
    if (this.guide.visible) this.guide.update(b, this.aim, this.power, (x, z, y) => this.groundAt(x, z, y), this.time, this.state === 'charge');
    else this.guide.root.visible = false;
    this.rig.aim = this.aim;
    if (!this.paused) this.fx.update(dt);
    const dip = this.stage.vignette.uniforms.uDip;
    if (dip.value > 0) dip.value = Math.max(0, dip.value - dt * 2.2);
    this.rig.update(this.paused ? 0 : dt, b);
    this.stage.render();
  }

  updateState(dt, b) {
    const inp = this.input;
    switch (this.state) {
      case 'menu':
        break;
      case 'flyover': {
        const e = inp.takeEdges();
        if (e.pressed) this.skipFly();
        else if (this.rig.flyDone()) this.skipFly();
        break;
      }
      case 'aim':
      case 'charge': {
        this.updateAim(dt, b);
        break;
      }
      case 'swing':
        inp.takeDelta();
        inp.takeEdges();
        break;
      case 'roll': {
        // trail
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        if (sp > 6) this.fx.trail(b.x, b.y, b.z, '#ffffff');
        inp.takeDelta();
        inp.takeEdges();
        if (b.mode === 'free' && b.rest > 0.4 && this.world.shotTime > 0.35) this.onStopped();
        else if (this.world.shotTime > 40 && sp < 0.6) this.onStopped();
        break;
      }
      case 'hazard':
        inp.takeDelta();
        inp.takeEdges();
        if (this.stateT > 1.25) this.respawn();
        break;
      case 'holed': {
        inp.takeDelta();
        inp.takeEdges();
        if (!this.celebrated && this.stateT > 0.45) {
          this.celebrated = true;
          this.ballMesh.visible = false;
          this.celebrate();
        }
        const wait = this.holedKind === 'ace' ? 4.2 : this.holedKind === 'bad' ? 2.4 : 3.0;
        if (this.celebrated && this.stateT > wait) {
          this.celebrated = false;
          this.showCard();
        }
        break;
      }
      default:
        break;
    }
  }

  updateAim(dt, b) {
    const inp = this.input;
    const d = inp.takeDelta();
    const e = inp.takeEdges();
    const keys = inp.keys;
    const s = this.sens;
    // overview
    this.overviewHeld = keys.has('Space') || this.overviewBtnHeld;
    const target = this.overviewHeld ? 1 : 0;
    this.rig.overview += (target - this.rig.overview) * (1 - Math.exp(-7 * dt));
    if (this.state === 'aim') {
      this.aim += d.x * AIM_SENS * s;
      this.rig.elev = clamp(this.rig.elev + d.y * 0.0028 * s, 0, 1);
      const fine = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 0.3 : 1;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) this.aim -= 0.9 * dt * fine;
      if (keys.has('ArrowRight') || keys.has('KeyD')) this.aim += 0.9 * dt * fine;
      if (keys.has('ArrowUp') || keys.has('KeyW')) this.rig.elev = clamp(this.rig.elev - 0.7 * dt, 0, 1);
      if (keys.has('ArrowDown') || keys.has('KeyS')) this.rig.elev = clamp(this.rig.elev + 0.7 * dt, 0, 1);
      if (b.mode !== 'free' || this.overviewHeld) return;
      if (e.pressed && b.rest > 0.05) {
        this.state = 'charge';
        this.pullPx = 0;
        this.power = 0;
        this.chargeStartY = inp.curY;
        this.sound.tick(0);
      }
    } else {
      // charging: drag back (toward the player = mouse down) to add power
      if (inp.locked || !inp.lockFailed) this.pullPx = Math.max(0, this.pullPx + d.y * s);
      else this.pullPx = Math.max(0, inp.curY - inp.downY);
      this.aim += d.x * AIM_SENS * 0.18 * s;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) this.aim -= 0.35 * dt;
      if (keys.has('ArrowRight') || keys.has('KeyD')) this.aim += 0.35 * dt;
      const p = clamp(this.pullPx / POWER_PX, 0, 1);
      if (Math.floor(p * 12) !== Math.floor(this.power * 12)) this.sound.tick(p);
      this.power = p;
      this.ui.setPower(p, true);
      if (e.cancel || !inp.down && !e.released) {
        if (e.cancel) this.cancelCharge();
      }
      if (e.released) {
        if (p < 0.04) {
          this.cancelCharge();
          this.ui.toast('Drag further back to charge', false, 1500);
        } else {
          this.state = 'swing';
          this.stateT = 0;
          const pw = p;
          this.sound.swing(pw);
          this.ui.setPower(pw, true);
          this.putter.swing(pw, () => this.hit(pw));
        }
      }
    }
  }
}
