// Hole 5 – Frostbite Peak: a slippery ice luge past pillars, then a curling-rink with sliding penguins and an open, icy edge.
import * as THREE from 'three';
import * as P from '../props.js';
import { rng, TAU } from '../util.js';

const RINK_Y = 1.4;
const PLAT_Y = 4.2;

export default {
  id: 5,
  name: 'Frostbite Peak',
  par: 4,
  solverPeriod: 6,
  hint: 'Ice is slippery! Ride the luge gently, bank off the walls, and use the snow patch to stop at the flag.',
  wallSound: 'wall',
  theme: {
    sky: { top: '#141a52', mid: '#3a63b8', bottom: '#b8dcff', sun: [-0.4, 0.5, -0.7], sunColor: '#e8f2ff', clouds: 0.25, stars: 0.8, aurora: 0.9, cloudCol: '#cfe0ff', cloudShade: '#8aa0d8' },
    fog: { color: '#a8c8f0', near: 40, far: 150 },
    hemi: { sky: '#b4ccff', ground: '#e8f4ff', intensity: 1.85 },
    sun: { color: '#d8e6ff', intensity: 2.3, dir: [-0.4, 0.8, 0.5] },
    water: { shallow: '#9ceeff', deep: '#2a86d8', foam: '#ffffff', sky: '#d0eaff', amp: 0.02 },
    flagColor: '#ff3d5a',
    bloom: 0.6,
    music: { root: 9, scale: 'pent', tempo: 84, wave: 'sine', arp: 0.8 },
  },
  build(c) {
    const R = rng(55);
    c.sy = 0.2;
    const iceWall = { color: '#cfeeff', top: '#ffffff', h: 0.5, t: 0.24 };

    // --------------------------------------------------------------- plateau (snow) + tee
    c.rect(0, 5.0, 5, 5, PLAT_Y, 'snow', { color: '#f4f9ff' });
    c.wall([[-2.5, 7.5], [2.5, 7.5]], iceWall);
    c.wall([[-2.5, 7.5], [-2.5, 2.5], [-1.3, 2.5]], iceWall);
    c.wall([[2.5, 7.5], [2.5, 2.5], [1.3, 2.5]], iceWall);
    c.skirt([[-2.5, 7.5], [2.5, 7.5], [2.5, 2.5], [-2.5, 2.5], [-2.5, 7.5]].map(([x, z]) => [x, z, PLAT_Y]), 1.6, '#a8d4f0');
    c.setTee(0, 6.2, 0);

    // --------------------------------------------------------------- the luge (ice slide)
    const slide = c.strip([[0, 2.5], [0, -2], [-2.5, -6.5], [-2.5, -11], [-5.2, -15.9]], 2.7, 'ice', {
      cell: 0.6,
      color: '#b6e6ff',
      prof: [[0, PLAT_Y], [1.0, PLAT_Y], [22, RINK_Y]],
      tint: (x, z) => 0.95 + 0.05 * Math.sin(z * 0.8),
    });
    c.wall(slide.left, iceWall);
    c.wall(slide.right, iceWall);
    c.skirt(slide.left, 1.0, '#8ec4ea');
    c.skirt(slide.right, 1.0, '#8ec4ea');
    // ice pillars (slalom)
    const pillar = (i, side) => {
      const ce = slide.center[i], le = slide.left[i], ri = slide.right[i];
      const e = side < 0 ? le : ri;
      const x = ce[0] + (e[0] - ce[0]) * 0.42, z = ce[1] + (e[1] - ce[1]) * 0.42;
      c.post(x, z, 0.36, { y: ce[2], h: 1.0, taper: 0.7, color: '#a8dcff', capColor: '#ffffff', seg: 8 });
    };
    [6, 12, 18, 25, 32].forEach((i, k) => pillar(Math.min(i, slide.center.length - 3), k % 2 ? 1 : -1));
    // supports under the slide
    for (let i = 4; i < slide.center.length; i += 6) {
      const p = slide.center[i];
      c.b.cyl(p[0], 0.2, p[1], 0.35, 0.55, p[2] - 0.6, '#9ccae8', { seg: 7 });
    }

    // --------------------------------------------------------------- the rink
    const RX0 = -11, RX1 = -2, RZ0 = -15, RZ1 = -24;
    c.rect((RX0 + RX1) / 2, (RZ0 + RZ1) / 2, RX1 - RX0, RZ0 - RZ1, RINK_Y, 'ice', { color: '#b9e8ff' });
    // snow patch around the cup
    c.disc(-8.3, -21.3, 1.35, RINK_Y + 0.004, 'snow', { color: '#ffffff', seg: 20 });
    c.setCup(-8.3, -21.3);
    c.wall([[RX0, RZ0], [-6.65, RZ0]], iceWall);
    c.wall([[-3.55, RZ0], [RX1, RZ0], [RX1, -16.8]], iceWall);
    c.wall([[RX0, RZ0], [RX0, RZ1], [RX1, RZ1]], iceWall);
    c.skirt([[RX0, RZ0], [RX0, RZ1], [RX1, RZ1], [RX1, RZ0], [RX0, RZ0]].map(([x, z]) => [x, z, RINK_Y]), 1.2, '#8ec4ea');
    // open edge on the right: candy-cane markers instead of a wall
    for (let z = -17.5; z >= -23.5; z -= 1.5) {
      c.b.cyl(RX1 + 0.06, RINK_Y, z, 0.05, 0.05, 0.55, '#ff4d5a', { seg: 6 });
      c.b.sph(RX1 + 0.06, RINK_Y + 0.58, z, 0.09, '#ffffff', { seg: 6 });
    }
    // icy water on the open side
    c.rect(2.5, -20.5, 9, 10, 0.55, 'water');
    // rink pillars
    [[-5.2, -19.4], [-9.0, -17.4], [-6.2, -22.6]].forEach(([x, z]) => c.post(x, z, 0.46, { y: RINK_Y, h: 1.1, taper: 0.75, color: '#a8dcff', capColor: '#ffffff', seg: 9 }));

    // sliding penguins (real colliders)
    const peng = (color) => c.make((pb) => {
      pb.sph(0, 0.2, 0, 0.3, '#232838', { seg: 10, sy: 0.75, sz: 1.35 });
      pb.sph(0, 0.16, 0.05, 0.27, '#f5f8ff', { seg: 10, sy: 0.6, sz: 1.2, sx: 0.85 });
      pb.sph(0, 0.42, 0.34, 0.17, '#232838', { seg: 8 });
      pb.cone(0, 0.42, 0.5, 0.07, 0.2, '#ff9a2a', { seg: 4, rx: Math.PI / 2 });
      pb.sph(-0.08, 0.48, 0.44, 0.045, '#fff', { seg: 5 });
      pb.sph(0.08, 0.48, 0.44, 0.045, '#fff', { seg: 5 });
      pb.sph(-0.08, 0.485, 0.47, 0.022, '#000', { seg: 4 });
      pb.sph(0.08, 0.485, 0.47, 0.022, '#000', { seg: 4 });
      pb.box(-0.32, 0.18, 0.05, 0.05, 0.22, 0.3, '#232838', { rz: 0.5 });
      pb.box(0.32, 0.18, 0.05, 0.05, 0.22, 0.3, '#232838', { rz: -0.5 });
      pb.box(-0.12, 0.02, -0.34, 0.14, 0.03, 0.18, '#ff9a2a');
      pb.box(0.12, 0.02, -0.34, 0.14, 0.03, 0.18, '#ff9a2a');
      if (color) pb.sph(0, 0.66, 0.34, 0.11, color, { seg: 8, sy: 0.5 });
    });
    const p1 = peng('#ff4d6d'), p2 = peng('#4d9dff');
    c.add(p1);
    c.add(p2);
    const wake1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }));
    wake1.rotation.x = -Math.PI / 2;
    c.add(wake1);
    const k = c.kin((t) => {
      // penguin 1: horizontal slider, penguin 2: vertical slider
      const a = (TAU * t) / 6;
      const x1 = -6.5 + 3.6 * Math.sin(a);
      const vx1 = Math.cos(a);
      p1.position.set(x1, RINK_Y, -18.4);
      p1.rotation.y = vx1 > 0 ? Math.PI / 2 : -Math.PI / 2;
      wake1.position.set(x1 - Math.sign(vx1) * 0.9, RINK_Y + 0.012, -18.4);
      wake1.rotation.z = Math.PI / 2;
      c1.ax = c1.bx = x1; c1.ay = c1.by = RINK_Y + 0.22; c1.az = -18.4 - 0.2; c1.bz = -18.4 + 0.2;
      const b2 = (TAU * t) / 7 + 1.7;
      const z2 = -19.6 + 3.0 * Math.sin(b2);
      const vz2 = Math.cos(b2);
      p2.position.set(-9.9, RINK_Y, z2);
      p2.rotation.y = vz2 > 0 ? 0 : Math.PI;
      c2.ax = c2.bx = -9.9; c2.ay = c2.by = RINK_Y + 0.22; c2.az = z2 - 0.2; c2.bz = z2 + 0.2;
    });
    const c1 = k.cap(0.34, { e: 0.8 });
    const c2 = k.cap(0.34, { e: 0.8 });

    c.setRoute([[0, PLAT_Y, 6.2], [0, PLAT_Y, 2.5], [0, 3.4, -2], [-2.5, 2.4, -6.5], [-2.5, 1.9, -11], [-5.2, RINK_Y, -15.9], [-8.3, RINK_Y, -21.3]]);
    c.flyKeys = [
      { p: [-6, 8.5, 12], l: [0, 3, 0] },
      { p: [5, 7, 2], l: [-1, 2, -8] },
      { p: [3, 5.5, -9], l: [-4, 1.8, -14] },
      { p: [3.5, 5.5, -13], l: [-8, 1.4, -20] },
      { p: [-14, 6, -26], l: [-7, 1.4, -20] },
      { p: [-4, 7.5, 10], l: [0, 3.5, 0] },
    ];
    c.flyDur = 6.5;

    // --------------------------------------------------------------- scenery
    P.scenery(c, { y: 0.15, color: '#f0f7ff', r: 200, cx: -3, cz: -8 });
    P.hills(c, { cx: -3, cz: -8, colors: ['#e6f0ff', '#d0e2f8', '#f4f8ff'], seed: 31, shape: 'peak', hMin: 10, hMax: 34, wMin: 8, wMax: 18, count: 28, snow: '#ffffff', rMin: 45, rMax: 85, y: -1 });
    P.clouds(c, { count: 6, y: 32, spread: 80, seed: 12, color: '#dfeaff', shade: '#9db0e0' });
    P.drifters(c, { count: 700, box: [-30, 22, 0, 26, -40, 26], color: '#ffffff', size: 0.16, mode: 'fall', speed: 0.9, twinkle: 0 });
    P.drifters(c, { count: 60, box: [-20, 8, 0.5, 6, -34, -8], color: '#a8e8ff', size: 0.12, mode: 'float', speed: 0.3, twinkle: 1 });

    // snowy pines
    const pines = [[-7, 12], [-11, 7], [7, 10], [10, 3], [8, -6], [10, -14], [5, -28], [-3, -30], [-14, -30], [-18, -22], [-17, -8], [-16, 4], [-13, -12], [14, -24], [2, -34], [-9, -30]];
    pines.forEach(([x, z], i) => P.pine(c, x, z, 1.0 + (i % 3) * 0.3, { snow: '#ffffff', crown: '#2f8a6e' }));
    [[-5, 8], [5, 7.5], [-4.6, -3.5], [3.6, -9], [-12, -14.5], [-12.5, -22.5], [-4, -25.5]].forEach(([x, z], i) => P.rock(c, x, z, 0.9 + (i % 3) * 0.3, '#c9d6e8', { y: 0.15 }));
    // snowman by the tee
    const snowman = c.make((b) => {
      b.sph(0, 0.55, 0, 0.6, '#ffffff', { seg: 12 });
      b.sph(0, 1.35, 0, 0.44, '#ffffff', { seg: 12 });
      b.sph(0, 1.95, 0, 0.32, '#ffffff', { seg: 12 });
      b.cone(0, 1.95, 0.3, 0.06, 0.3, '#ff8a2a', { seg: 5, rx: Math.PI / 2 });
      b.sph(-0.1, 2.05, 0.27, 0.04, '#111', { seg: 4 });
      b.sph(0.1, 2.05, 0.27, 0.04, '#111', { seg: 4 });
      b.cyl(0, 2.22, 0, 0.2, 0.2, 0.05, '#222', { seg: 10 });
      b.cyl(0, 2.25, 0, 0.14, 0.15, 0.3, '#222', { seg: 10 });
      b.tor(0, 1.7, 0, 0.3, 0.06, '#e8394d', { seg: 12 });
      for (let i = 0; i < 3; i++) b.sph(0, 1.45 - i * 0.22, 0.4 - i * 0.02, 0.05, '#222', { seg: 4 });
      b.cyl(-0.45, 1.35, 0, 0.02, 0.02, 0.8, '#6b4426', { seg: 4, rz: 1.1 });
      b.cyl(0.45, 1.35, 0, 0.02, 0.02, 0.8, '#6b4426', { seg: 4, rz: -1.1 });
    });
    c.place(snowman, 4.2, PLAT_Y - 0.05, 6.4, -0.7);
    c.onFrame((t) => (snowman.rotation.z = Math.sin(t * 1.4) * 0.03));
    // igloo
    c.b.sph(-13.5, RINK_Y - 0.6, -13, 2.3, '#f0f8ff', { sy: 0.85, seg: 12 });
    c.b.cyl(-13.5, RINK_Y - 0.3, -11.2, 0.75, 0.75, 1.2, '#f0f8ff', { seg: 10, rx: Math.PI / 2 });
    c.b.box(-13.5, RINK_Y - 0.3, -10.55, 0.75, 0.9, 0.06, '#2a3a5a');
    for (let i = 0; i < 3; i++) c.b.cyl(-13.5, RINK_Y + 0.6 + i * 0.5, -13, 2.05 - i * 0.55, 2.1 - i * 0.55, 0.05, '#c8dcf0', { seg: 12 });
    c.g.sph(-13.5, RINK_Y + 0.2, -10.4, 0.28, '#ffd090', { seg: 8, tint: 1.8 });
    // frozen crystals + lamp posts
    P.crystal(c, -12.6, -18.5, 1.1, '#8fe6ff', { y: RINK_Y, n: 5 });
    P.crystal(c, -12.0, -23, 0.8, '#a5d0ff', { y: RINK_Y, n: 4 });
    P.crystal(c, 3.6, 6, 0.9, '#8fe6ff', { y: PLAT_Y, n: 4 });
    for (const [x, z, y] of [[-2.2, 7.2, PLAT_Y], [-10.6, -15.4, RINK_Y]]) {
      c.b.cyl(x, y, z, 0.05, 0.07, 1.4, '#3a4a6a', { seg: 6 });
      c.g.sph(x, y + 1.5, z, 0.15, '#ffe6b0', { seg: 8, tint: 2.2 });
      P.halo(c, x, y + 1.5, z, 1.4, '#ffdca0', 0.8);
    }
    // waddling penguins on the ground
    for (let i = 0; i < 5; i++) waddler(c, -16 + (i % 3) * 3.4 + R(), -3 - i * 3 + R() * 2, 0.15, 1.2 + R());
    for (let i = 0; i < 3; i++) waddler(c, 6 + i * 2.2, 8.5 - i * 2.4, 0.15, 1.5);
    // frozen waterfall + sparkles
    c.b.box(-6.2, 0.15, 12.6, 6, 8, 3, '#dcecff');
    c.b.cone(-6.2, 7.8, 12.6, 3.2, 3, '#f4f9ff', { seg: 6 });
    for (let i = 0; i < 6; i++) c.b.cone(-8 + i * 0.7, 4.5 - (i % 2) * 0.8, 11, 0.16, 1.3 + (i % 3) * 0.5, '#bfe6ff', { seg: 4, rx: Math.PI });
    c.sign(-1.9, 7.2, 'HOLE 5\nPAR 4', { y: PLAT_Y, ry: 0.35, w: 1.2, hh: 0.6 });
    c.sign(-2.5, -13.8, 'THIN ICE →', { y: RINK_Y, ry: 0.6, w: 1.4, hh: 0.5, tex: { bg: '#123a7a', fg: '#ffffff', border: '#7fe0ff', font: '900 42px "Trebuchet MS", sans-serif' } });
  },
};

function waddler(c, x, z, y, s) {
  const g = c.make((b) => {
    b.sph(0, 0.5, 0, 0.36, '#232838', { seg: 9, sy: 1.25 });
    b.sph(0, 0.45, 0.1, 0.3, '#f5f8ff', { seg: 9, sy: 1.15, sx: 0.85 });
    b.sph(0, 1.05, 0.02, 0.24, '#232838', { seg: 8 });
    b.cone(0, 1.02, 0.24, 0.06, 0.2, '#ff9a2a', { seg: 4, rx: Math.PI / 2 });
    b.sph(-0.09, 1.1, 0.2, 0.05, '#fff', { seg: 5 });
    b.sph(0.09, 1.1, 0.2, 0.05, '#fff', { seg: 5 });
    b.sph(-0.09, 1.11, 0.24, 0.025, '#000', { seg: 4 });
    b.sph(0.09, 1.11, 0.24, 0.025, '#000', { seg: 4 });
    b.box(-0.4, 0.55, 0, 0.06, 0.4, 0.25, '#232838', { rz: 0.4 });
    b.box(0.4, 0.55, 0, 0.06, 0.4, 0.25, '#232838', { rz: -0.4 });
    b.box(-0.15, 0.02, 0.15, 0.2, 0.04, 0.3, '#ff9a2a');
    b.box(0.15, 0.02, 0.15, 0.2, 0.04, 0.3, '#ff9a2a');
  });
  g.scale.setScalar(s * 0.75);
  c.add(g);
  const ph = Math.random() * 20;
  const r = 1.2 + Math.random();
  c.onFrame((t) => {
    const a = t * 0.25 + ph;
    g.position.set(x + Math.cos(a) * r, y + Math.abs(Math.sin(t * 6 + ph)) * 0.05, z + Math.sin(a) * r);
    g.rotation.y = -a + Math.PI;
    g.rotation.z = Math.sin(t * 6 + ph) * 0.14;
  });
}
