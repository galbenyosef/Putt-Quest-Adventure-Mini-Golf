// A big animated cartoon T-Rex that straddles the fairway. Its snapping head and sweeping tail are real colliders.
import * as THREE from 'three';
import { TAU, clamp, lerp, smoothstep } from './util.js';

const C = {
  skin: '#54bb5c',
  skin2: '#3f9c4a',
  belly: '#e6ea86',
  plate: '#ff9a3c',
  tooth: '#fbfaf0',
  eye: '#ffd23f',
  dark: '#1c1233',
  mouth: '#d24a68',
};

export const REX = {
  period: 4.2, // head cycle
  tailPeriod: 3.3,
  openY: 1.95,
  closedY: 0.06,
  headZ: 5.7, // local (towards the tee)
  gateZ: 1.15, // gate bar relative to head origin
  corridor: 1.02, // half length of the gate bar
};

/** Head gate opening height over time (bottom of the teeth). */
export function jawY(t) {
  const u = (t % REX.period) / REX.period;
  const { openY, closedY } = REX;
  if (u < 0.33) return openY;
  if (u < 0.4) {
    const k = (u - 0.33) / 0.07;
    return lerp(openY, closedY, k * k);
  }
  if (u < 0.8) return closedY;
  const k = (u - 0.8) / 0.2;
  return lerp(closedY, openY, 1 - Math.pow(1 - k, 2));
}

const TAIL_R = [1.0, 0.86, 0.72, 0.6, 0.5, 0.42, 0.36, 0.3];
const TAIL_Y = [3.6, 3.15, 2.5, 1.7, 1.0, 0.62, 0.42, 0.34];
const TAIL_L = 1.15;
const TAIL_AMP = [0.0, 0.09, 0.18, 0.3, 0.45, 0.54, 0.6];

/** Tail joint positions in dino-local space. */
export function tailPose(t, out) {
  let x = 0, z = -2.7, h = 0;
  const w = (TAU * t) / REX.tailPeriod;
  out[0] = [x, TAIL_Y[0], z];
  for (let i = 0; i < TAIL_R.length - 1; i++) {
    h += TAIL_AMP[i] * Math.sin(w - i * 0.62);
    const dy = TAIL_Y[i + 1] - TAIL_Y[i];
    const lh = Math.sqrt(Math.max(0.01, TAIL_L * TAIL_L - dy * dy));
    x += Math.sin(h) * lh;
    z -= Math.cos(h) * lh;
    out[i + 1] = [x, TAIL_Y[i + 1], z];
  }
  return out;
}

export function buildTRex(c, { zc = -12, wallHalf = 1.3 } = {}) {
  const root = new THREE.Group();
  root.position.set(0, 0, zc);
  c.add(root);
  const mk = (fn, opts) => c.make(fn, opts);

  // ------------------------------------------------------------ body
  const body = mk((b) => {
    b.sph(0, 3.9, 0, 1.0, C.skin, { sx: 1.75, sy: 1.6, sz: 2.9, seg: 16 });
    b.sph(0, 3.55, 0.3, 1.0, C.belly, { sx: 1.35, sy: 1.25, sz: 2.55, seg: 14 });
    // back plates
    for (let i = 0; i < 6; i++) {
      const z = 1.9 - i * 0.9;
      const y = 5.35 - Math.abs(i - 2) * 0.18;
      b.cone(0, y, z, 0.32, 0.55 - Math.abs(i - 2) * 0.05, C.plate, { seg: 4, ry: Math.PI / 4 });
    }
    // stripes
    for (let i = 0; i < 4; i++) b.sph(0, 4.6 + (i % 2) * 0.1, -0.3 - i * 0.55, 1.0, C.skin2, { sx: 1.55, sy: 0.24, sz: 0.28, seg: 8 });
  });
  root.add(body);

  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = mk((b) => {
      b.sph(0, 2.9, 0, 1.0, C.skin2, { sx: 0.9, sy: 1.05, sz: 1.1, seg: 12 });
      b.cyl(0, 0.4, 0.15, 0.42, 0.55, 2.4, C.skin, { seg: 10 });
      b.box(0, 0.0, 0.7, 1.15, 0.5, 1.7, C.skin2);
      for (let k = -1; k <= 1; k++) b.cone(k * 0.36, 0.13, 1.7, 0.16, 0.42, C.tooth, { seg: 5, rx: Math.PI / 2 });
    });
    leg.position.set(sx * 2.15, 0, 0.1);
    root.add(leg);
    legs.push(leg);
  }
  // arms
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = mk((b) => {
      b.cyl(0, -0.55, 0, 0.13, 0.17, 0.85, C.skin, { seg: 6 });
      for (let k = -1; k <= 1; k += 2) b.cone(k * 0.06, -0.62, 0.05, 0.05, 0.22, C.tooth, { seg: 4, rx: Math.PI });
    }, { width: 0.7 });
    arm.position.set(sx * 0.85, 4.05, 2.55);
    arm.rotation.x = -0.4;
    root.add(arm);
    arms.push(arm);
  }

  // ------------------------------------------------------------ neck
  const neck = [];
  for (let i = 0; i < 4; i++) {
    const s = mk((b) => b.sph(0, 0, 0, 0.95 - i * 0.06, i % 2 ? C.skin : C.skin2, { seg: 12 }), { width: 0.9 });
    root.add(s);
    neck.push(s);
  }

  // ------------------------------------------------------------ head
  const head = new THREE.Group();
  root.add(head);
  const skull = mk((b) => {
    b.box(0, 0.32, -0.95, 2.05, 1.15, 1.7, C.skin);
    b.box(0, 0.3, 0.6, 1.7, 0.95, 1.6, C.skin);
    b.box(0, 0.3, 1.6, 1.45, 0.78, 1.0, C.skin, { tint: 1.03 });
    b.sph(0, 0.5, 2.1, 0.62, C.skin, { sx: 1.15, sy: 0.8, sz: 0.9, seg: 10 });
    // palate
    b.box(0, 0.3, 0.3, 1.6, 0.05, 2.7, C.mouth);
    // nostrils + brow ridges
    b.sph(-0.35, 1.05, 2.25, 0.09, C.dark, { seg: 5 });
    b.sph(0.35, 1.05, 2.25, 0.09, C.dark, { seg: 5 });
    b.sph(-0.9, 1.3, 0.35, 0.36, C.skin2, { sx: 0.7, seg: 8 });
    b.sph(0.9, 1.3, 0.35, 0.36, C.skin2, { sx: 0.7, seg: 8 });
    // teeth (upper row)
    for (let i = 0; i < 9; i++) {
      const z = -0.9 + i * 0.36;
      const w = z > 1.2 ? 0.66 : 0.85;
      b.cone(-w, 0.06, z, 0.09, 0.3, C.tooth, { seg: 5, rx: Math.PI });
      b.cone(w, 0.06, z, 0.09, 0.3, C.tooth, { seg: 5, rx: Math.PI });
    }
    b.cone(0, 0.06, 2.35, 0.09, 0.26, C.tooth, { seg: 5, rx: Math.PI });
    // top plates
    for (let i = 0; i < 3; i++) b.cone(0, 0.95 + i * 0.05, -1.2 + i * 0.5, 0.2, 0.34, C.plate, { seg: 4, ry: Math.PI / 4 });
  });
  head.add(skull);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = mk((b) => {
      b.sph(0, 0, 0, 0.26, C.eye, { seg: 10 });
    }, { width: 0.7 });
    eye.position.set(sx * 1.0, 0.95, 0.35);
    head.add(eye);
    const pupil = mk((b) => b.sph(0, 0, 0, 0.13, C.dark, { seg: 8 }), { outline: false });
    pupil.position.set(0, 0, 0.17);
    eye.add(pupil);
    const lid = mk((b) => b.sph(0, 0, 0, 0.29, C.skin, { seg: 8, sy: 0.02 }), { outline: false });
    lid.scale.set(1, 0.02, 1);
    lid.position.y = 0.0;
    eye.add(lid);
    eyes.push({ eye, pupil, lid });
  }
  // lower teeth on the floor (decor), placed at the gate area
  const gateTeeth = mk((b) => {
    for (let i = 0; i < 8; i++) {
      const z = -1.0 + i * 0.38;
      b.cone(-0.86, 0, z, 0.09, 0.26, C.tooth, { seg: 5 });
      b.cone(0.86, 0, z, 0.09, 0.26, C.tooth, { seg: 5 });
    }
  }, { width: 0.7 });
  root.add(gateTeeth);

  // ------------------------------------------------------------ tail
  const tailSegs = [];
  for (let i = 0; i < TAIL_R.length; i++) {
    const s = mk((b) => {
      b.sph(0, 0, 0, TAIL_R[i], i % 2 ? C.skin : C.skin2, { seg: 12 });
      b.cone(0, TAIL_R[i] * 0.85, 0, TAIL_R[i] * 0.3, TAIL_R[i] * 0.75, C.plate, { seg: 4, ry: Math.PI / 4 });
    }, { width: 0.9 });
    root.add(s);
    tailSegs.push(s);
  }
  const tp = [];
  for (let i = 0; i < TAIL_R.length; i++) tp.push([0, 0, 0]);

  // ------------------------------------------------------------ colliders
  const k = c.kin((t) => {
    const yb = jawY(t);
    gate.ax = -REX.corridor; gate.bx = REX.corridor;
    gate.ay = gate.by = yb + 0.3;
    gate.az = gate.bz = zc + REX.headZ + REX.gateZ;
    tailPose(t, tp);
    for (let i = 0; i < tailCaps.length; i++) {
      const a = tp[i], b = tp[i + 1];
      const cp = tailCaps[i];
      cp.ax = a[0]; cp.ay = a[1]; cp.az = a[2] + zc;
      cp.bx = b[0]; cp.by = b[1]; cp.bz = b[2] + zc;
    }
  });
  const gate = k.cap(0.3, { e: 0.55 });
  const tailCaps = [];
  for (let i = 0; i < TAIL_R.length - 1; i++) tailCaps.push(k.cap((TAIL_R[i] + TAIL_R[i + 1]) / 2 + 0.02, { e: 0.6 }));

  // ------------------------------------------------------------ animation (visuals)
  let lastCycle = -1;
  let lastStomp = -1;
  let roarT = -10;
  const stompPeriod = 6.4;
  const vec = new THREE.Vector3();
  function update(t, dt, ctx) {
    const breathe = Math.sin(t * 1.8);
    body.scale.set(1, 1 + breathe * 0.012, 1 + breathe * 0.008);
    // head
    const yb = jawY(t);
    const cyc = Math.floor(t / REX.period);
    const u = (t % REX.period) / REX.period;
    let rear = 0;
    if (cyc % 3 === 1 && u < 0.4) rear = Math.sin((u / 0.4) * Math.PI) * 0.6;
    head.position.set(0, yb + rear, REX.headZ);
    head.rotation.x = -0.28 * ((yb - REX.closedY) / (REX.openY - REX.closedY)) - rear * 0.25 + 0.05;
    // neck spheres between chest and head joint
    const hj = new THREE.Vector3(0, yb + rear + 1.35, REX.headZ - 1.3);
    const ch = new THREE.Vector3(0, 4.5, 2.7);
    for (let i = 0; i < neck.length; i++) {
      const f = (i + 0.5) / neck.length;
      vec.copy(ch).lerp(hj, f);
      vec.y += Math.sin(f * Math.PI) * 0.55;
      neck[i].position.copy(vec);
    }
    // cycle events: chomp + roar
    if (cyc !== lastCycle) {
      lastCycle = cyc;
      if (cyc % 3 === 1 && ctx && ctx.sound) {
        const d = ctx.camera ? ctx.camera.position.distanceTo(head.getWorldPosition(vec)) : 10;
        ctx.sound.roar(clamp(1.3 - d / 26, 0.15, 1));
        ctx.rig && ctx.rig.addShake(clamp(1 - d / 20, 0, 0.5));
      }
    }
    // chomp sound when the jaw shuts
    if (u > 0.395 && u < 0.43 && lastCycle >= 0 && !update._chomped) {
      update._chomped = true;
      if (ctx && ctx.sound) ctx.sound.chomp(0.9);
    }
    if (u < 0.3) update._chomped = false;
    // eyes track the ball
    if (ctx && ctx.ball) {
      for (const e of eyes) {
        e.eye.getWorldPosition(vec);
        const dx = ctx.ball.x - vec.x, dy = ctx.ball.y - vec.y, dz = ctx.ball.z - vec.z;
        const l = Math.hypot(dx, dy, dz) || 1;
        e.pupil.position.set(clamp((dx / l) * 0.11, -0.11, 0.11), clamp((dy / l) * 0.09, -0.09, 0.09), 0.17);
      }
    }
    // blink
    const bl = (t % 3.7) < 0.14 ? 1 : 0;
    for (const e of eyes) e.lid.scale.set(1, 0.02 + bl * 0.98, 1);
    // legs: weight shift + stomp
    const st = (t % stompPeriod) / stompPeriod;
    const stompN = Math.floor(t / stompPeriod);
    const left = stompN % 2 === 0;
    let lift = 0;
    if (st > 0.3 && st < 0.5) lift = Math.sin(((st - 0.3) / 0.2) * Math.PI * 0.5);
    else if (st >= 0.5 && st < 0.56) lift = 1 - (st - 0.5) / 0.06;
    legs[0].position.y = left ? lift * 0.55 : 0;
    legs[1].position.y = left ? 0 : lift * 0.55;
    legs[left ? 0 : 1].rotation.x = -lift * 0.25;
    legs[left ? 1 : 0].rotation.x = 0;
    if (st >= 0.5 && st < 0.56 && lastStomp !== stompN) {
      lastStomp = stompN;
      if (ctx && ctx.sound) {
        const wp = legs[left ? 0 : 1].getWorldPosition(vec);
        const d = ctx.camera ? ctx.camera.position.distanceTo(wp) : 10;
        ctx.sound.stomp(clamp(1.2 - d / 24, 0.1, 1));
        ctx.fx && ctx.fx.dust(wp.x + (left ? -0.4 : 0.4), 0.0, wp.z + 1.4, 16, '#d8c8a0');
        ctx.rig && ctx.rig.addShake(clamp(0.7 - d / 24, 0, 0.5));
      }
    }
    // arms
    arms[0].rotation.x = -0.4 + Math.sin(t * 2.4) * 0.25;
    arms[1].rotation.x = -0.4 + Math.sin(t * 2.4 + 1.4) * 0.25;
    // tail
    tailPose(t, tp);
    for (let i = 0; i < tailSegs.length; i++) tailSegs[i].position.set(tp[i][0], tp[i][1], tp[i][2]);
  }
  update._chomped = false;
  return { root, update, head };
}
