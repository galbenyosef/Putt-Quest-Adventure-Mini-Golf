// Hole 8 – Volcano Ridge: ride the stone ferry across the lava river, climb the ridge, then blast through the loop over the crater.
import * as THREE from 'three';
import * as P from '../props.js';
import { rng, TAU, smoothstep, lerp } from '../util.js';

const FERRY_T = 10;
const FZ_S = -5.4; // ferry centre at the south dock
const FZ_N = -9.1; // ferry centre at the north dock
const YB = 2.2; // summit height
export function ferryZ(t) {
  const u = (t % FERRY_T) / FERRY_T;
  if (u < 0.2) return FZ_S;
  if (u < 0.45) return lerp(FZ_S, FZ_N, smoothstep(0.2, 0.45, u));
  if (u < 0.65) return FZ_N;
  if (u < 0.9) return lerp(FZ_N, FZ_S, smoothstep(0.65, 0.9, u));
  return FZ_S;
}

export default {
  id: 8,
  name: 'Volcano Ridge',
  par: 5,
  solverPeriod: FERRY_T,
  hint: 'Roll gently onto the stone ferry, ride it across the lava, then blast through the loop for the summit cup!',
  theme: {
    sky: { top: '#24081a', mid: '#8a2a2a', bottom: '#ff9a4a', sun: [0.3, 0.18, -0.9], sunColor: '#ff7a3a', clouds: 0.9, cloudCol: '#5a3a3a', cloudShade: '#2a1a24' },
    fog: { color: '#c0644a', near: 50, far: 210 },
    hemi: { sky: '#ffc0a0', ground: '#8a5a5a', intensity: 2.2 },
    sun: { color: '#ffb088', intensity: 2.9, dir: [0.4, 0.55, 0.6] },
    water: { shallow: '#7be9ff', deep: '#2483e0' },
    lava: { hot: '#ffe14a', mid: '#ff5a12', crust: '#5a1a12', glow: 1.3 },
    flagColor: '#ffd23f',
    bloom: 0.55,
    bloomThreshold: 1.05,
    vignette: 0.36,
    music: { root: 2, scale: 'minor', tempo: 100, wave: 'sawtooth', arp: 0.3 },
  },
  build(c) {
    const R = rng(88);
    c.sy = -1.4;
    const RW = { color: '#5a3c46', top: '#a06a58', h: 0.55, t: 0.24 };
    const ROCK = '#6a4a54';

    // --------------------------------------------------------------- tee plateau + south dock
    c.rect(0, 2.0, 4.8, 12, 0, 'rock', { color: ROCK }); // z 8 .. -4
    c.setTee(0, 6.2, 0);
    c.wall([[-2.4, 8], [-2.4, -4]], RW);
    c.wall([[2.4, 8], [2.4, -4]], RW);
    c.wall([[-2.4, 8], [2.4, 8]], RW);
    c.skirt([[-2.4, 8], [-2.4, -4], [2.4, -4], [2.4, 8], [-2.4, 8]].map(([x, z]) => [x, z, 0]), 2.2, '#3a2630');
    // south dock lip glow
    c.g.box(0, 0.005, -3.9, 4.8, 0.02, 0.1, '#ff7a2a', { tint: 1.6 });

    // --------------------------------------------------------------- lava river
    c.rect(0, -7.25, 120, 6.5, -0.6, 'lava');
    c.rect(0, -7.25, 120, 8, -3, 'rock', { color: '#2a1a20' });

    // --------------------------------------------------------------- north dock
    c.rect(0, -12.5, 4.8, 4, 0, 'rock', { color: ROCK }); // z -10.5 .. -14.5
    c.wall([[-2.4, -10.5], [-2.4, -14.5]], RW);
    c.wall([[2.4, -10.5], [2.4, -14.5]], RW);
    c.skirt([[-2.4, -10.5], [2.4, -10.5]].map(([x, z]) => [x, z, 0]), 2.2, '#3a2630');
    c.g.box(0, 0.005, -10.6, 4.8, 0.02, 0.1, '#ff7a2a', { tint: 1.6 });

    // --------------------------------------------------------------- the ferry (moving platform)
    const ferry = c.mover();
    c.rect(0, 0, 2.6, 2.8, 0, 'stone', { mover: ferry, color: '#8a7a8a' });
    const fv = c.make((b) => {
      b.box(0, -0.5, 0, 2.7, 0.5, 2.9, '#4a3a48');
      for (const sx of [-1, 1]) {
        b.box(sx * 1.32, 0, 0, 0.2, 0.42, 3.0, '#7a5a6a');
        b.box(sx * 1.32, 0.42, 0, 0.24, 0.06, 3.04, '#d8a888');
        b.cyl(sx * 1.32, 0.45, -1.4, 0.13, 0.13, 0.5, '#5a3a4a', { seg: 6 });
        b.cyl(sx * 1.32, 0.45, 1.4, 0.13, 0.13, 0.5, '#5a3a4a', { seg: 6 });
        b.sph(sx * 1.32, 0.98, -1.4, 0.13, '#ff8a3a', { seg: 6 });
        b.sph(sx * 1.32, 0.98, 1.4, 0.13, '#ff8a3a', { seg: 6 });
      }
    });
    ferry.group.add(fv);
    const rune = c.make((b) => {
      b.tor(0, 0.012, 0, 0.6, 0.03, '#ff9a3a', { seg: 24, tint: 1.9 });
      b.box(0, 0.012, 0, 0.9, 0.012, 0.05, '#ff9a3a', { tint: 1.9 });
      b.box(0, 0.012, 0, 0.05, 0.012, 0.9, '#ff9a3a', { tint: 1.9 });
    }, { glow: true, outline: false });
    ferry.group.add(rune);
    const fk = c.kin((t) => {
      ferry.setPose(0, 0, ferryZ(t), 0);
      const w = [0, 0, 0], w2 = [0, 0, 0];
      for (let i = 0; i < 2; i++) {
        const sx = i ? 1 : -1;
        ferry.toWorld(sx * 1.32, 0.32, -1.4, w);
        ferry.toWorld(sx * 1.32, 0.32, 1.4, w2);
        const cp = rails[i];
        cp.ax = w[0]; cp.ay = w[1]; cp.az = w[2]; cp.bx = w2[0]; cp.by = w2[1]; cp.bz = w2[2];
      }
    }, [ferry]);
    const rails = [fk.cap(0.15, { e: 0.6 }), fk.cap(0.15, { e: 0.6 })];
    c.navRects = [{ x0: -1.3, x1: 1.3, z0: -10.5, z1: -4.0, y: 0 }];
    // chains from the ferry to posts on both banks (decor)
    for (const sx of [-1, 1]) {
      for (const z of [-3.8, -10.7]) {
        c.b.cyl(sx * 2.8, -1.2, z, 0.18, 0.24, 2.3, '#4a3440', { seg: 6 });
        c.g.sph(sx * 2.8, 1.25, z, 0.16, '#ff8a3a', { seg: 8, tint: 2.2 });
      }
    }

    // --------------------------------------------------------------- climbing ridge
    const ramp = c.strip([[0, -14.5], [0, -17], [3.4, -20], [3.4, -23], [0.8, -25.6], [0, -27.5]], 2.6, 'rock', {
      cell: 0.6,
      color: '#6f4c56',
      prof: [[0, 0], [0.6, 0], [15.8, YB]],
      tint: (x, z) => 0.95 + 0.05 * Math.sin(z * 1.1),
    });
    c.wall(ramp.left, RW);
    c.wall(ramp.right, RW);
    c.skirt(ramp.left, 1.6, '#3a2630');
    c.skirt(ramp.right, 1.6, '#3a2630');
    for (let i = 3; i < ramp.center.length; i += 6) {
      const p = ramp.center[i];
      c.b.cyl(p[0], -2.6, p[1], 0.45, 0.65, p[2] + 2.4, '#4a3440', { seg: 7 });
    }

    // --------------------------------------------------------------- summit plateau + funnel + crater
    c.rect(0, -29.25, 5, 3.5, YB, 'rock', { color: '#7a5560' }); // z -27.5 .. -31
    c.poly([[-2.5, -31], [2.5, -31], [0.35, -32.3], [-1.15, -32.3]], YB, 'rock', { color: '#7a5560' });
    c.wall([[-2.5, -27.5], [-2.5, -28.4]], RW);
    c.wall([[-2.5, -30.4], [-2.5, -31], [-1.15, -32.3]], RW);
    c.wall([[2.5, -27.5], [2.5, -31], [0.35, -32.3]], RW);
    c.skirt([[-2.5, -27.5], [-2.5, -31], [-1.15, -32.3], [0.35, -32.3], [2.5, -31], [2.5, -27.5]].map(([x, z]) => [x, z, YB]), 1.6, '#3a2630');
    // crater lava
    c.disc(0.4, -35.6, 3.3, YB - 0.7, 'lava', { seg: 28 });
    c.b.cyl(0.4, YB - 2.2, -35.6, 4.2, 3.6, 1.6, '#3a2630', { seg: 20 });
    // the loop (tube)
    const yb = YB + 0.11;
    const pts = [[-0.4, yb, -32.4], [-0.4, yb, -33.7]];
    const s0 = -33.8, rr = 1.25;
    for (let k = 1; k <= 16; k++) {
      const phi = (k / 16) * TAU;
      pts.push([-0.4 + 0.8 * (k / 16), yb + rr * (1 - Math.cos(phi)), s0 - rr * Math.sin(phi)]);
    }
    pts.push([0.4, yb, -35.4], [0.4, yb, -37.2], [0.4, yb, -38.9]);
    c.pipe(pts, { color: '#ffd8b0', rib: '#ff7a2a', radius: 0.32, r: 0.42, ribGap: 1.0 });
    for (const z of [-36.4, -37.9]) c.b.cyl(0.4, YB - 0.7, z, 0.28, 0.4, 0.9, '#5a3c46', { seg: 7 });
    c.b.cyl(0, YB, -33.8, 0.25, 0.35, 1.0, '#5a3c46', { seg: 6 });
    // entrance arch
    c.b.box(-1.15, YB, -32.35, 0.24, 1.0, 0.3, '#7a5560');
    c.b.box(0.35, YB, -32.35, 0.24, 1.0, 0.3, '#7a5560');
    c.b.box(-0.4, YB + 0.9, -32.35, 1.75, 0.24, 0.3, '#a06a58');
    c.g.box(-0.4, YB + 0.7, -32.5, 1.2, 0.05, 0.05, '#ff9a3a', { tint: 2.4 });
    // rim path (risky – no rails on the lava side)
    const rim = c.strip([[-2.5, -29.4], [-4.4, -31.2], [-4.9, -35.4], [-3.7, -38.5], [-2, -39.6]], 1.7, 'rock', { y: YB, cell: 0.6, color: '#7a5560' });
    c.wall(rim.right, { ...RW, h: 0.4 });
    c.skirt(rim.left, 1.4, '#3a2630');
    c.skirt(rim.right, 1.4, '#3a2630');
    // ash pit with the cup
    c.rect(0.2, -41.3, 7, 5, YB, 'mud', { color: '#4a3a40' }); // z -38.8 .. -43.8
    c.wall([[-3.3, -38.8], [-3.3, -43.8], [3.7, -43.8], [3.7, -38.8]], RW);
    c.wall([[-3.3, -38.8], [-2.85, -38.8]], RW);
    c.wall([[0.9, -38.8], [3.7, -38.8]], RW);
    c.skirt([[-3.3, -38.8], [-3.3, -43.8], [3.7, -43.8], [3.7, -38.8]].map(([x, z]) => [x, z, YB]), 1.6, '#3a2630');
    c.setCup(0.4, -41.3);
    c.g.tor(0.4, YB + 0.02, -41.3, 0.62, 0.03, '#ffcf4a', { seg: 22, tint: 1.8 });

    c.setRoute([[0, 0, 6.2], [0, 0, -3], [0, 0, -7.3], [0, 0, -11], [0, 0.4, -15], [3.4, 1.0, -21], [0.6, 2.0, -26], [0, YB, -30], [-0.4, YB, -33], [0.4, YB, -38], [0.4, YB, -41.3]]);
    c.flyKeys = [
      { p: [-8, 6, 12], l: [0, 0.5, 0] },
      { p: [7, 4, -1], l: [0, 0, -8] },
      { p: [-7, 4.5, -12], l: [0, 1, -18] },
      { p: [7, 6, -20], l: [1, 2, -27] },
      { p: [-9, 7, -30], l: [0, 2.5, -36] },
      { p: [5, 5.5, -46], l: [0.4, 2.2, -40] },
      { p: [0, 2.6, 11], l: [0, 0.8, -3] },
    ];
    c.flyDur = 7.5;

    // --------------------------------------------------------------- scenery
    P.scenery(c, { y: -3.2, color: '#5a3840', r: 200, cx: 0, cz: -20 });
    // glowing cracks
    const cracks = c.make((b) => {
      for (let i = 0; i < 34; i++) {
        const x = R.range(-30, 30), z = R.range(-70, 20);
        if (Math.abs(x) < 7 && z > -46 && z < 10) continue;
        for (let k = 0; k < 4; k++) b.box(x + k * 1.2, -3.15, z + Math.sin(k + i) * 0.9, 1.4, 0.03, 0.14, '#ff6a1a', { ry: R() * 1.2 - 0.6, tint: 1.6 });
      }
    }, { glow: true, outline: false });
    c.add(cracks);
    // giant volcano behind the summit
    const V = { x: 0, z: -95 };
    c.b.cone(V.x, -3, V.z, 46, 62, '#6a4550', { seg: 12 });
    c.b.cone(V.x, 52, V.z, 13, 10, '#4a3038', { seg: 12 });
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + 0.3;
      c.g.cyl(V.x + Math.cos(a) * 7.5 * 0.8, 44 - i * 5, V.z + 10 + Math.sin(a) * 7, 0.8, 1.6, 20, '#ff5a1a', { seg: 5, tint: 1.7, rx: 0.3, rz: Math.cos(a) * 0.2 });
    }
    c.g.cyl(V.x, 61.5, V.z, 10, 11, 0.6, '#ff6a2a', { seg: 14, tint: 1.9 });
    P.halo(c, V.x, 64, V.z, 60, '#ff6a2a', 0.85);
    P.drifters(c, { count: 200, box: [-25, 25, 62, 140, V.z - 20, V.z + 20], color: '#4a3a3a', size: 7, mode: 'rise', speed: 1.3, additive: false, twinkle: 0 });
    P.drifters(c, { count: 140, box: [-14, 14, 60, 100, V.z - 10, V.z + 10], color: '#ff9a3a', size: 1.0, mode: 'rise', speed: 3.0, twinkle: 1 });
    // erupting lava bombs
    for (let i = 0; i < 4; i++) lavaBomb(c, V.x + R.range(-4, 4), 62, V.z + R.range(-3, 3), R.range(0, 6), R.range(6, 9));
    // side mountains
    for (const [x, z, s] of [[-44, -60, 1], [50, -70, 1.2], [-70, -20, 1.3], [72, -10, 1.1], [30, -50, 0.7], [-30, -46, 0.8]]) {
      c.b.cone(x, -3, z, 18 * s, 26 * s, '#6a4550', { seg: 8 });
      c.g.cyl(x, 20 * s, z + 4 * s, 0.4, 0.9, 6 * s, '#ff5a1a', { seg: 4, tint: 1.5, rx: 0.4 });
    }
    // basalt columns + obsidian spikes + dead trees + skulls
    [[-6.5, 5], [6.5, 4], [-7, -8], [7.4, -9], [-7.5, -20], [8, -25], [-8, -36], [8.6, -34], [-7.5, -44], [8, -44]].forEach(([x, z], i) => basalt(c, x, z, 0.9 + (i % 3) * 0.35));
    [[-9, 1], [10, 0], [-10, -16], [10, -18], [-11, -30], [11.5, -28], [-10.5, -47]].forEach(([x, z], i) => deadTree(c, x, z, 0.9 + (i % 3) * 0.3));
    [[3.6, -5], [-3.8, -12], [4.4, 3]].forEach(([x, z], i) => skull(c, x, z, i));
    for (const [x, z] of [[-2.8, 7], [2.8, 7], [-2.8, -13.5], [2.8, -13.5], [-3.6, -42], [4.2, -42]]) P.torch(c, x, x < 0 ? 0 : 0, z, { y: 0 });
    P.torch(c, -2.9, 0, 7.2, { light: true, intensity: 11, dist: 14, lightColor: '#ff8a3a' });
    P.torch(c, 2.9, 0, 7.2, { light: true, intensity: 11, dist: 14, lightColor: '#ff8a3a' });
    // (summit torches sit at summit height)
    P.torch(c, -2.7, YB, -28.2, { light: true, intensity: 10, dist: 13, lightColor: '#ff8a3a' });
    P.torch(c, 2.7, YB, -28.2, { light: true, intensity: 10, dist: 13, lightColor: '#ff8a3a' });
    lavaWorm(c, 6.5, -7.3);
    lavaWorm(c, -7, -6.8);
    P.birdFlock(c, { cx: 0, cz: -40, y: 20, radius: 14, count: 4, color: '#2a1a24', speed: 0.22 });
    P.drifters(c, { count: 240, box: [-25, 25, -2, 22, -60, 14], color: '#ffa04a', size: 0.14, mode: 'rise', speed: 1.1, twinkle: 1 });
    P.drifters(c, { count: 300, box: [-30, 30, 0, 26, -70, 20], color: '#5a4a4a', size: 0.12, mode: 'fall', speed: 0.5, twinkle: 0, additive: false });
    P.clouds(c, { count: 9, y: 34, spread: 100, seed: 5, color: '#7a5a5a', shade: '#3a2a30' });
    c.sign(-2.0, 7.4, 'HOLE 8\nPAR 5', { ry: 0.3, w: 1.2, hh: 0.6 });
    c.sign(2.0, -1.4, 'FERRY ⛴', { ry: -0.5, w: 1.3, hh: 0.5, tex: { bg: '#3a1420', fg: '#ffb060', border: '#ff7a2a', font: '900 44px "Trebuchet MS", sans-serif' } });
    c.sign(1.8, -30.2, 'LOOP! ↻', { y: YB, ry: -0.4, w: 1.3, hh: 0.5, tex: { bg: '#3a1420', fg: '#ffe27a', border: '#ff7a2a', font: '900 44px "Trebuchet MS", sans-serif' } });
  },
};

function basalt(c, x, z, s) {
  const b = c.b;
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + x;
    const h = (1.6 + ((i * 37 + Math.abs(x) * 13) % 10) / 4) * s;
    b.cyl(x + Math.cos(a) * 0.5 * s, -1.4, z + Math.sin(a) * 0.5 * s, 0.34 * s, 0.4 * s, h + 1.4, i % 2 ? '#3a2a34' : '#4a3640', { seg: 6 });
  }
}
function deadTree(c, x, z, s) {
  const b = c.b;
  b.cyl(x, -1.4, z, 0.09 * s, 0.2 * s, 2.6 * s + 1.4, '#2a1c22', { seg: 5 });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    b.cyl(x, 1.0 * s + i * 0.35 * s, z, 0.03 * s, 0.07 * s, 1.1 * s, '#2a1c22', { seg: 4, rx: Math.cos(a) * 0.9, rz: Math.sin(a) * 0.9 });
  }
}
function skull(c, x, z, i) {
  const b = c.b;
  b.sph(x, 0.16, z, 0.2, '#f0e6d0', { seg: 8, sz: 1.1 });
  b.box(x, 0.02, z + 0.1, 0.22, 0.1, 0.14, '#f0e6d0');
  b.sph(x - 0.07, 0.2, z + 0.16, 0.05, '#1c1233', { seg: 5 });
  b.sph(x + 0.07, 0.2, z + 0.16, 0.05, '#1c1233', { seg: 5 });
  b.cylc(x + 0.35, 0.06, z - 0.1, 0.03, 0.03, 0.5, '#f0e6d0', { seg: 4, rz: Math.PI / 2, ry: 0.5 + i });
}
function lavaBomb(c, x, y0, z, phase, period) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, 1.0, '#ff7a2a', { seg: 8, tint: 2 });
    b.sph(0, 0, 0, 0.6, '#ffe14a', { seg: 8, tint: 2.4 });
  }, { glow: true, outline: false });
  c.add(g);
  c.onFrame((t) => {
    const u = ((t + phase) % period) / period;
    if (u > 0.5) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const k = u / 0.5;
    g.position.set(x + Math.sin(phase + Math.floor((t + phase) / period)) * 14 * k, y0 + 24 * k * (1 - k) * 2, z + 10 * k);
    g.scale.setScalar(1.4 - k * 0.6);
  });
}
function lavaWorm(c, x, z) {
  const segs = [];
  const root = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = c.make((b) => b.sph(0, 0, 0, 0.4 - i * 0.03, i % 2 ? '#ff5a1a' : '#c8340f', { seg: 8, tint: 1.3 }), { glow: false });
    root.add(s);
    segs.push(s);
  }
  root.position.set(x, -0.6, z);
  c.add(root);
  const ph = Math.random() * 10;
  c.onFrame((t) => {
    const up = Math.max(0, Math.sin(t * 0.5 + ph));
    for (let i = 0; i < segs.length; i++) {
      const u = i / (segs.length - 1);
      segs[i].position.set(Math.sin(t * 1.2 + i * 0.6) * 0.3 * u, up * (0.2 + 1.5 * Math.sin(u * Math.PI) * 1.0) - (1 - up) * 0.9, u * 2.0 * up - u * 0.3);
    }
  });
}
