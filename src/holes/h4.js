// Hole 4 – Rex Territory: a huge T-Rex straddles the fairway. Slip past its snapping jaws and its sweeping tail.
import * as THREE from 'three';
import * as P from '../props.js';
import { buildTRex, REX } from '../dino.js';
import { rng, TAU } from '../util.js';

const ZC = -10; // dino centre (world z)

export default {
  id: 4,
  name: 'Rex Territory',
  par: 4,
  solverPeriod: 4.2,
  hint: 'Sneak under the T-Rex’s jaws when they open, then dodge the tail at the far end.',
  theme: {
    sky: { top: '#7a4fb0', mid: '#ff9a6a', bottom: '#ffe0a0', sun: [0.5, 0.35, -0.7], sunColor: '#ffd08a', clouds: 0.55, cloudCol: '#ffd9c0', cloudShade: '#d08a9a' },
    fog: { color: '#f5c9a0', near: 45, far: 170 },
    hemi: { sky: '#ffd9c0', ground: '#5a8a3a', intensity: 1.35 },
    sun: { color: '#ffc890', intensity: 2.7, dir: [-0.45, 0.6, 0.55] },
    water: { shallow: '#8fd8a0', deep: '#2a7a6a', sky: '#ffe0c0' },
    flagColor: '#ffd23f',
    music: { root: 7, scale: 'minor', tempo: 88, wave: 'triangle', arp: 0.55 },
  },
  build(c) {
    const R = rng(44);
    c.sy = -0.08;
    const W = 2.6;
    const wallO = { color: '#a89a86', top: '#d8ccb6', h: 0.5, t: 0.22 };
    const s = c.strip([[-3.0, 7], [-3.0, 3], [-1.4, -0.4], [0, -3], [0, -12], [0, -26.5]], W, 'grass', {
      cell: 0.6,
      color: '#66b04c',
      pattern: 'dots',
      tint: (x, z) => 0.94 + 0.08 * Math.sin(x * 1.3 + z * 0.4),
    });
    const splitWall = (pts, o) => {
      const i1 = pts.findIndex((p) => p[1] <= -14.6);
      const i2 = pts.findIndex((p) => p[1] <= -21.6);
      c.wall(pts.slice(0, i1 + 1), o);
      c.wall(pts.slice(i1, i2 + 1), { ...o, h: 0.13, color: '#8a7c6a', top: '#c8bca6' });
      c.wall(pts.slice(i2), o);
    };
    splitWall(s.left, wallO);
    splitWall(s.right, wallO);
    const e = s.left.length - 1;
    c.wall([s.left[0], s.right[0]], wallO);
    c.wall([s.left[e], s.right[e]], wallO);
    c.setTee(-3.0, 5.6, 0);
    c.setCup(0, -24.2);
    c.setRoute([[-3.0, 0, 5.6], [-3.0, 0, 3], [-1.4, 0, -0.4], [0, 0, -3], [0, 0, -12], [0, 0, -24.2]]);
    c.flyKeys = [
      { p: [-7, 6, 10], l: [-1, 1.5, -2] },
      { p: [8, 5, 0], l: [0, 2.5, -8] },
      { p: [7, 3.5, -8], l: [0, 2.2, -10] },
      { p: [6, 2.8, -14], l: [0, 0.8, -20] },
      { p: [3.5, 2.5, -22], l: [0, 0.6, -24] },
      { p: [-4, 3.5, 10], l: [-2, 0.5, -4] },
    ];
    c.flyDur = 6.5;

    // ---------------------------------------------------------------- the T-Rex
    const rex = buildTRex(c, { zc: ZC, wallHalf: W / 2 });
    c.onFrame((t, dt, ctx) => rex.update(t, dt, ctx));

    // ---------------------------------------------------------------- nest around the cup
    const nest = c.b;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU;
      nest.cyl(Math.cos(a) * 1.02, 0, -24.2 + Math.sin(a) * 1.02, 0.06, 0.07, 0.34, '#8a6a3a', { seg: 4, rx: Math.cos(a) * 0.6, rz: Math.sin(a) * 0.6, ry: a, tint: 0.8 + R() * 0.4 });
    }
    // eggs
    const eggs = [];
    [[-0.95, -25.2], [0.95, -25.4], [1.1, -23.2], [-1.05, -23.3]].forEach(([x, z], i) => {
      const egg = c.make((eb) => {
        eb.sph(0, 0.28, 0, 0.3, i % 2 ? '#f2e6c8' : '#c8e6c8', { seg: 10, sy: 1.3 });
        eb.sph(0.12, 0.35, 0.22, 0.06, '#7a9a5a', { seg: 5 });
        eb.sph(-0.1, 0.22, 0.24, 0.05, '#7a9a5a', { seg: 5 });
      });
      c.place(egg, x, 0, z, i);
      eggs.push(egg);
    });
    c.onFrame((t) => eggs.forEach((e, i) => (e.rotation.z = Math.sin(t * (2 + i * 0.4) + i) * 0.06 * (Math.sin(t * 0.7 + i) > 0.7 ? 1 : 0.15))));
    const baby = c.make((bb) => {
      bb.sph(0, 0.18, 0, 0.22, '#7ad06a', { seg: 9, sz: 1.2 });
      bb.sph(0, 0.42, 0.2, 0.17, '#7ad06a', { seg: 8 });
      bb.sph(-0.09, 0.47, 0.32, 0.05, '#fff', { seg: 5 });
      bb.sph(0.09, 0.47, 0.32, 0.05, '#fff', { seg: 5 });
      bb.sph(-0.09, 0.47, 0.35, 0.025, '#000', { seg: 4 });
      bb.sph(0.09, 0.47, 0.35, 0.025, '#000', { seg: 4 });
      bb.cone(0, 0.29, -0.25, 0.1, 0.4, '#7ad06a', { seg: 5, rx: -Math.PI / 2 });
      bb.sph(-0.13, 0.55, 0.18, 0.05, '#ffd23f', { seg: 4 });
    });
    c.place(baby, 1.6, 0.0, -25.4, -1.0);
    c.onFrame((t) => {
      const k = Math.max(0, Math.sin(t * 0.9));
      baby.position.y = -0.4 + 0.4 * k * k;
      baby.rotation.z = Math.sin(t * 4) * 0.08 * k;
    });

    // ---------------------------------------------------------------- scenery
    P.scenery(c, { y: -0.08, color: '#5f9e44', r: 170, cx: 0, cz: -10 });
    P.hills(c, { cx: 0, cz: -10, colors: ['#5f8a3c', '#4a7a35', '#7a6a3a'], seed: 21, hMin: 6, hMax: 18, count: 22 });
    // volcano
    const vx = -30, vz = -52;
    c.b.cone(vx, -1, vz, 20, 26, '#5a4048', { seg: 12 });
    c.b.cone(vx, 21, vz, 6.5, 6, '#3a2a30', { seg: 12 });
    c.g.cyl(vx, 24.5, vz, 4.8, 5.4, 0.4, '#ff6a2a', { seg: 12, tint: 1.7 });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25 + 0.4;
      c.g.cyl(vx + Math.cos(a) * 3.8, 20 - i * 1.2, vz + Math.sin(a) * 3.8 + 1, 0.3, 0.6, 5.5, '#ff5a1a', { seg: 5, tint: 1.6, rx: Math.sin(a) * 0.4, rz: Math.cos(a) * 0.4 });
    }
    P.halo(c, vx, 26, vz, 26, '#ff6a2a', 0.9);
    P.drifters(c, { count: 120, box: [vx - 6, vx + 10, 25, 55, vz - 6, vz + 6], color: '#8a7a7a', size: 2.4, mode: 'rise', speed: 1.0, additive: false, twinkle: 0 });
    P.drifters(c, { count: 60, box: [vx - 5, vx + 5, 25, 45, vz - 5, vz + 5], color: '#ff9a3a', size: 0.5, mode: 'rise', speed: 2.2, twinkle: 1 });
    // far brachiosaurus wading
    const brach = c.make((b) => {
      b.sph(0, 3.4, 0, 1.0, '#7a9a8a', { sx: 1.6, sy: 1.3, sz: 3.0, seg: 12 });
      b.cyl(0, 4, 2.6, 0.4, 0.75, 6, '#7a9a8a', { seg: 8, rx: 0.5 });
      b.sph(0, 9.6, 5.1, 0.7, '#7a9a8a', { seg: 8, sz: 1.3 });
      b.sph(0.4, 9.8, 5.5, 0.12, '#000', { seg: 4 });
      b.cone(0, 3.8, -3.2, 0.7, 5, '#7a9a8a', { seg: 8, rx: -Math.PI / 2 - 0.3 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * 1.4, 0, sz * 2, 0.5, 0.6, 3, '#6a8a7a', { seg: 8 });
    });
    c.place(brach, 24, -0.08, -34, -1.2);
    c.onFrame((t) => {
      brach.children[0] && (brach.rotation.z = Math.sin(t * 0.4) * 0.01);
    });
    // giant ferns + cycads + mushrooms
    const ferns = [[-9, 11], [8.5, 9], [-7, -1], [6.8, -2], [-6.5, -8], [6.5, -9], [-6.5, -17], [6.5, -16], [-5.5, -26], [5.5, -25], [-4, -30], [3, -31], [9, 5], [-10, 4], [10, -12], [-11, -12], [11, -21], [-11, -22]];
    ferns.forEach(([x, z], i) => fern(c, x + R.range(-0.5, 0.5), z, 0.9 + R() * 0.7));
    [[-8, 10], [9, 10], [-9, -4], [8, -6], [-9, -19], [9, -18], [7, -29]].forEach(([x, z], i) => cycad(c, x, z, 0.9 + (i % 3) * 0.25));
    [[-4.4, 5], [4, -5.5], [-4.2, -13], [4.4, -20], [-4.8, -27]].forEach(([x, z], i) => P.mushroom(c, x, z, 1.6 + (i % 2), { cap: i % 2 ? '#ff7a3a' : '#c26aff' }));
    [[-5, -6], [5.5, -13], [-5.8, -21], [4.5, 1]].forEach(([x, z], i) => P.rock(c, x, z, 1.2 + (i % 3) * 0.4, '#8f8577'));
    // bones & footprints
    bones(c, 7.2, -8.5, 0.6);
    bones(c, -7, -24, 1.1);
    for (let i = 0; i < 6; i++) c.d.cyl(4.6 + (i % 2) * 0.6, -0.07, 6 - i * 1.6, 0.4, 0.4, 0.02, '#4a7a34', { seg: 7 });
    // swamp / tar pits (decor water)
    c.disc(-9.5, -9, 2.6, -0.3, 'water', { seg: 20 });
    c.disc(9.5, -21, 2.2, -0.3, 'water', { seg: 20 });
    // pterodactyls
    for (let i = 0; i < 3; i++) ptero(c, 0, -14, 15 + i * 2.5, 13 + i * 3, 0.25 + i * 0.05, i * 2.1);
    P.birdFlock(c, { cx: 12, cz: -30, y: 18, radius: 9, count: 3, speed: 0.3, color: '#4a3550' });
    P.butterfly(c, 4, -14, 2, { y: 1.0, colors: ['#ff9a3c', '#a0ff8c'] });
    P.drifters(c, { count: 70, box: [-12, 12, 0.3, 4, -32, 8], color: '#d8ff7a', size: 0.14, mode: 'float', speed: 0.5, twinkle: 1 });
    P.grassField(c, { x0: -20, x1: 20, z0: -40, z1: 16, count: 2400, y: -0.08, base: '#2f7f36', tip: '#a8d868', height: 0.6 });
    c.sign(-1.5, 6.3, 'HOLE 4\nPAR 4', { ry: 0.3, w: 1.2, hh: 0.6 });
    c.sign(1.9, -1.2, 'BEWARE OF\nREX!', { ry: -0.35, w: 1.35, hh: 0.62, tex: { bg: '#4a1c10', fg: '#ffd23f', border: '#ff5a2a', font: '900 46px "Trebuchet MS", sans-serif' } });
  },
};

function fern(c, x, z, s) {
  const y = -0.08;
  const b = c.b;
  b.cyl(x, y, z, 0.05 * s, 0.08 * s, 0.6 * s, '#6a4a2a', { seg: 5 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    b.boxc(x + Math.cos(a) * 0.9 * s, y + 1.0 * s - 0.15 * s, z + Math.sin(a) * 0.9 * s, 1.9 * s, 0.05, 0.42 * s, i % 2 ? '#2f9a3c' : '#3fb04a', { ry: -a, rz: -0.55, sway: 1.0, tint: 0.9 + (i % 3) * 0.08 });
  }
}
function cycad(c, x, z, s) {
  const y = -0.08;
  const b = c.b;
  b.cyl(x, y, z, 0.28 * s, 0.4 * s, 1.5 * s, '#7a5a3a', { seg: 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    b.boxc(x + Math.cos(a) * 0.9 * s, y + 1.65 * s, z + Math.sin(a) * 0.9 * s, 1.8 * s, 0.06, 0.34 * s, '#3fae4a', { ry: -a, rz: -0.35, sway: 1.1, tint: 0.85 + (i % 2) * 0.2 });
  }
  b.sph(x, y + 1.6 * s, z, 0.3 * s, '#c86a3a', { seg: 7 });
}
function bones(c, x, z, s) {
  const b = c.b;
  b.cylc(x, 0.12 * s, z, 0.09 * s, 0.09 * s, 1.5 * s, '#f0ead6', { seg: 6, rz: Math.PI / 2, ry: 0.4 });
  b.sph(x - 0.75 * s, 0.14 * s, z - 0.3 * s, 0.17 * s, '#f0ead6', { seg: 6 });
  b.sph(x + 0.75 * s, 0.14 * s, z + 0.3 * s, 0.17 * s, '#f0ead6', { seg: 6 });
  for (let i = 0; i < 5; i++) b.cylc(x + 1.3 * s, 0.25 * s, z + (i - 2) * 0.22 * s, 0.05 * s, 0.05 * s, 0.9 * s, '#f0ead6', { seg: 5, rz: 0.9 + i * 0.05, ry: 0.2 });
  b.sph(x + 2.0 * s, 0.3 * s, z, 0.42 * s, '#f0ead6', { seg: 8, sz: 1.3 });
  b.sph(x + 2.0 * s - 0.12, 0.42 * s, z + 0.32 * s, 0.11 * s, '#1c1233', { seg: 5 });
  b.sph(x + 2.0 * s + 0.12, 0.42 * s, z + 0.32 * s, 0.11 * s, '#1c1233', { seg: 5 });
}
function ptero(c, cx, cz, y, r, spd, ph) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, 0.5, '#8a5a6a', { seg: 8, sz: 1.5 });
    b.cone(0, 0.06, 0.95, 0.16, 0.9, '#8a5a6a', { seg: 5, rx: Math.PI / 2 });
    b.cone(0, 0.42, -0.5, 0.14, 0.7, '#ff7a4a', { seg: 4, rx: -Math.PI / 2 + 0.4 });
    b.sph(-0.1, 0.12, 0.75, 0.05, '#ffe', { seg: 4 });
  }, { shadow: false });
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = c.make((b) => {
      b.tris([[0, 0, 0.5], [sx * 2.8, 0.1, -0.2], [0, 0, -0.6]], '#9a6a7a');
      b.tris([[0, 0, -0.6], [sx * 2.8, 0.1, -0.2], [0, 0, 0.5]], '#7a4a5a');
    }, { shadow: false });
    g.add(w);
    wings.push({ w, sx });
  }
  g.scale.setScalar(1.4);
  c.add(g);
  c.onFrame((t) => {
    const a = t * spd + ph;
    g.position.set(cx + Math.cos(a) * r, y + Math.sin(a * 2) * 1.0, cz + Math.sin(a) * r * 0.8);
    g.rotation.y = -a;
    g.rotation.z = Math.sin(a) * 0.1;
    const f = Math.sin(t * 3.2 + ph) * 0.5;
    wings[0].w.rotation.z = f;
    wings[1].w.rotation.z = -f;
  });
}
