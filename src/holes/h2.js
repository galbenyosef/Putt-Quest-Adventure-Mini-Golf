// Hole 2 – Windmill Farm: putt through the gap under the spinning sails.
import * as THREE from 'three';
import * as P from '../props.js';
import { rng, TAU } from '../util.js';

const HUB = { x: 0, y: 3.55, z: -13.55 };
const BLADE_LEN = 3.25;
const OMEGA = 0.85;

export default {
  id: 2,
  name: 'Windmill Farm',
  par: 3,
  solverPeriod: (Math.PI / 2) / OMEGA,
  hint: 'Wait for a sail to sweep past, then roll through the arch under the blades.',
  theme: {
    sky: { top: '#3f8fe8', mid: '#8fd0ff', bottom: '#fff0d2', sun: [-0.5, 0.5, -0.6], sunColor: '#fff0c0', clouds: 0.65 },
    fog: { color: '#f4e6cc', near: 55, far: 200 },
    hemi: { sky: '#dcecff', ground: '#a8a050', intensity: 1.55 },
    sun: { color: '#ffe9c0', intensity: 2.7, dir: [0.5, 0.75, 0.45] },
    water: { shallow: '#8ceaff', deep: '#3a8fe0', sky: '#e6f4ff' },
    flagColor: '#ff3d5a',
    music: { root: 5, scale: 'pent', tempo: 104, wave: 'triangle', arp: 0.6 },
  },
  build(c) {
    const R = rng(21);
    const W = 3.4;
    const wallOpts = { color: '#c08a52', top: '#f0cf8c', h: 0.5 };
    const s = c.strip([[-3.6, 4.6], [-3.6, -0.5], [-2.4, -4.5], [0, -8], [0, -13], [0, -24]], W, 'grass', {
      cell: 0.5,
      color: '#6bd05a',
      tint: (x, z) => 0.94 + 0.06 * Math.sin(x * 0.8 + z * 0.3),
    });
    // the straight part beyond the smoothing keeps x = 0 exactly
    c.wall(s.left, wallOpts);
    c.wall(s.right, wallOpts);
    const e = s.left.length - 1;
    c.wall([s.left[0], s.right[0]], wallOpts);
    c.wall([s.left[e], s.right[e]], wallOpts);

    // ------------------------------------------------------------------ windmill body & tunnel
    const TZ0 = -14.2;
    const TZ1 = -16.6;
    const TW = 0.85;
    c.wall([[-1.75, TZ0], [-TW, TZ0]], { hidden: true, h: 1.7 });
    c.wall([[TW, TZ0], [1.75, TZ0]], { hidden: true, h: 1.7 });
    c.wall([[-TW, TZ0], [-TW, TZ1]], { hidden: true, h: 1.5 });
    c.wall([[TW, TZ0], [TW, TZ1]], { hidden: true, h: 1.5 });
    c.wall([[-1.75, TZ1], [-TW, TZ1]], { hidden: true, h: 1.7 });
    c.wall([[TW, TZ1], [1.75, TZ1]], { hidden: true, h: 1.7 });
    const b = c.b;
    const cz = (TZ0 + TZ1) / 2;
    const stone = '#e9d7b4';
    b.box(-1.65, 0, cz, 1.6, 1.75, 2.4, stone);
    b.box(1.65, 0, cz, 1.6, 1.75, 2.4, stone);
    b.box(0, 1.42, cz, 1.7, 0.36, 2.4, '#d9c4a0');
    // stone arch trim
    b.box(-0.9, 0, TZ0 + 0.02, 0.16, 1.45, 0.14, '#b89a70');
    b.box(0.9, 0, TZ0 + 0.02, 0.16, 1.45, 0.14, '#b89a70');
    b.box(0, 1.38, TZ0 + 0.02, 1.96, 0.16, 0.14, '#b89a70');
    // dark tunnel interior hint
    b.box(0, 0.001, cz, 1.7, 0.01, 2.4, '#5a4a38');
    // tapered tower + cap
    b.cyl(0, 1.75, cz, 1.2, 1.95, 4.3, '#f5edda', { seg: 8, ry: Math.PI / 8 });
    for (let i = 0; i < 3; i++) b.cyl(0, 2.3 + i * 1.3, cz, 1.9 - (0.55 + i * 0.3) * 0.78, 1.95 - (0.55 + i * 0.3) * 0.78, 0.12, '#c8483a', { seg: 8, ry: Math.PI / 8, tint: 0.98 });
    b.cone(0, 6.0, cz, 1.55, 1.5, '#c8483a', { seg: 8, ry: Math.PI / 8 });
    b.sph(0, 7.55, cz, 0.16, '#ffd23f', { seg: 8 });
    // windows + little door
    b.box(-0.75, 2.5, TZ0 + 0.55, 0.36, 0.5, 0.1, '#33261f');
    b.box(0.75, 2.5, TZ0 + 0.55, 0.36, 0.5, 0.1, '#33261f');
    b.box(-0.75, 4.35, TZ0 + 1.0, 0.3, 0.45, 0.1, '#33261f');
    b.box(0.75, 4.35, TZ0 + 1.0, 0.3, 0.45, 0.1, '#33261f');
    b.box(0, 4.85, TZ0 + 1.02, 0.34, 0.5, 0.1, '#ffd88a', { tint: 1.2 });
    // rear balcony ring
    b.cyl(0, 4.2, cz, 1.55, 1.55, 0.1, '#8a5a34', { seg: 8, ry: Math.PI / 8 });

    // rotor (hub, arms, sails)
    const rotor = c.make((rb) => {
      rb.cyl(0, -0.16, 0, 0.26, 0.3, 0.32, '#5a3a20', { seg: 10, rx: Math.PI / 2 });
      rb.sph(0, 0, -0.1, 0.32, '#7a4a26', { seg: 10 });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const cs = Math.cos(a), sn = Math.sin(a);
        const dir = (d, off) => [-sn * d + cs * off, cs * d + sn * off];
        const arm = dir(BLADE_LEN / 2 + 0.2, 0);
        rb.boxc(arm[0], arm[1], 0, 0.14, BLADE_LEN - 0.35, 0.12, '#6a4020', { rz: a });
        const sail = dir((BLADE_LEN + 0.7) / 2, 0.4);
        rb.boxc(sail[0], sail[1], 0.02, 0.62, BLADE_LEN - 0.75, 0.05, '#fbf3dc', { rz: a });
        // lattice slats
        for (let k = 0; k < 6; k++) {
          const sl = dir(0.85 + k * 0.42, 0.4);
          rb.boxc(sl[0], sl[1], 0.055, 0.66, 0.05, 0.03, '#a86a34', { rz: a });
        }
        const edge = dir((BLADE_LEN + 0.7) / 2, 0.72);
        rb.boxc(edge[0], edge[1], 0.03, 0.05, BLADE_LEN - 0.75, 0.07, '#a86a34', { rz: a });
      }
    });
    rotor.position.set(HUB.x, HUB.y, HUB.z);
    c.add(rotor);
    // axle
    b.cyl(HUB.x, HUB.y - 0.14, HUB.z - 0.55, 0.14, 0.14, 0.7, '#5a3a20', { seg: 8, rx: Math.PI / 2 });

    const caps = [];
    const k = c.kin((t) => {
      const phi = OMEGA * t;
      rotor.rotation.z = -phi;
      for (let i = 0; i < 4; i++) {
        const a = phi + (i * Math.PI) / 2;
        const dx = Math.sin(a), dy = Math.cos(a);
        const px = Math.cos(a), py = -Math.sin(a);
        const cp = caps[i];
        cp.ax = HUB.x + dx * 0.45 + px * 0.22;
        cp.ay = HUB.y + dy * 0.45 + py * 0.22;
        cp.az = HUB.z;
        cp.bx = HUB.x + dx * BLADE_LEN + px * 0.22;
        cp.by = HUB.y + dy * BLADE_LEN + py * 0.22;
        cp.bz = HUB.z;
      }
    });
    for (let i = 0; i < 4; i++) caps.push(k.cap(0.26, { e: 0.55, sound: 'wall' }));

    // ------------------------------------------------------------------ yard obstacles
    const hayCol = '#eec44a';
    [[-1.0, -19.3], [1.0, -21.9]].forEach(([x, z]) => {
      c.post(x, z, 0.42, { h: 0.62, color: hayCol, seg: 14 });
      c.b.cyl(x, 0.62, z, 0.36, 0.42, 0.06, '#d9a92f', { seg: 14 });
    });
    c.setTee(-3.6, 3.7, 0);
    c.setCup(0.35, -21.0);
    c.setRoute([[-3.6, 0, 3.7], [-3.6, 0, -0.5], [-2.4, 0, -4.5], [0, 0, -8], [0, 0, -13], [0, 0, -16.6], [0.35, 0, -21]]);
    c.flyKeys = null;

    // ------------------------------------------------------------------ scenery
    P.scenery(c, { y: -0.08, color: '#8bd05a', r: 170, cx: 0, cz: -10 });
    // patchwork fields
    const fields = [['#e6c84a', -14, -2, 9, 12], ['#79c65a', -14, -16, 9, 9], ['#d9b23a', 14, -3, 9, 10], ['#5db850', 15, -17, 10, 10], ['#c0d654', 0, 14, 16, 6]];
    fields.forEach(([col, x, z, w, d]) => c.d.box(x, -0.075, z, w, 0.01, d, col, { tint: 1 }));
    P.hills(c, { cx: 0, cz: -10, colors: ['#8fce5a', '#d6c352', '#6fbf58'], seed: 3, count: 24 });
    P.clouds(c, { count: 9, y: 26, spread: 80, seed: 8 });
    P.grassField(c, { x0: -22, x1: 24, z0: -40, z1: 18, count: 3300, y: -0.08, base: '#3a9a3e', tip: '#d8f27a', region: (x, z) => Math.hypot(x, z + 10) < 30 });

    // corn field
    const cornRows = 9;
    for (let r = 0; r < cornRows; r++) {
      for (let q = 0; q < 12; q++) {
        const x = 8 + r * 0.9 + R.range(-0.1, 0.1);
        const z = -6 - q * 0.9 + R.range(-0.1, 0.1);
        c.d.cyl(x, -0.08, z, 0.03, 0.05, 1.4 + R() * 0.3, '#7fbf3f', { seg: 4, sway: 0.5 });
        c.d.boxc(x + 0.12, 0.7, z, 0.32, 0.05, 0.1, '#5da83a', { rz: 0.5, sway: 0.7 });
        c.d.boxc(x - 0.12, 0.9, z, 0.32, 0.05, 0.1, '#5da83a', { rz: -0.5, sway: 0.7 });
        c.d.sph(x, 1.45, z, 0.08, '#f0d24a', { seg: 5, sy: 1.6, sway: 0.6 });
      }
    }
    // sunflowers
    for (let i = 0; i < 26; i++) {
      const x = -8 - R() * 5, z = -18 - R() * 5 + (i % 3);
      const h = 1.0 + R() * 0.6;
      c.d.cyl(x, -0.08, z, 0.03, 0.04, h, '#4a9a3a', { seg: 4, sway: 0.5 });
      c.d.cyl(x, h - 0.08, z, 0.22, 0.22, 0.05, '#ffcc22', { seg: 10, rx: Math.PI / 2 - 0.3, sway: 0.7 });
      c.d.cyl(x, h - 0.08, z + 0.03, 0.12, 0.12, 0.06, '#5a3a1a', { seg: 8, rx: Math.PI / 2 - 0.3, sway: 0.7 });
    }
    // barn
    const bx = -10.5, bz = -3;
    b.box(bx, -0.08, bz, 5.2, 3.2, 6.4, '#c13b30');
    b.box(bx, 3.0, bz, 5.2, 0.2, 6.5, '#8a2a22');
    for (const sgn of [-1, 1]) b.boxc(bx + sgn * 1.32, 3.75, bz, 0.22, 3.1, 6.6, '#7d5a46', { rz: -sgn * 0.7 });
    b.boxc(bx, 4.9, bz, 0.3, 0.3, 6.7, '#5a3a2a');
    b.box(bx + 2.62, 0.2, bz, 0.06, 2.3, 2.4, '#f5efe0');
    b.boxc(bx + 2.66, 1.3, bz, 0.04, 0.16, 3.0, '#c13b30', { rx: 0.7 });
    b.boxc(bx + 2.66, 1.3, bz, 0.04, 0.16, 3.0, '#c13b30', { rx: -0.7 });
    b.box(bx + 2.63, 2.6, bz, 0.05, 0.5, 0.6, '#3a2a20');
    // silo
    b.cyl(-9.0, -0.08, -10.2, 1.05, 1.1, 5.4, '#bfc8d8', { seg: 14 });
    b.sph(-9.0, 5.3, -10.2, 1.1, '#9aa5b8', { seg: 12, sy: 0.7 });
    for (let i = 0; i < 4; i++) b.cyl(-9.0, 0.6 + i * 1.3, -10.2, 1.12, 1.12, 0.1, '#8a94a8', { seg: 14 });
    // tractor
    b.box(6.4, 0.25, 2.2, 1.6, 0.6, 0.9, '#3fae4a');
    b.box(6.15, 0.85, 2.2, 0.75, 0.8, 0.85, '#3fae4a');
    b.box(6.15, 1.65, 2.2, 0.85, 0.06, 0.95, '#2a7a34');
    b.cyl(6.85, 0.05, 1.7, 0.4, 0.4, 0.22, '#222', { seg: 12, rx: Math.PI / 2 });
    b.cyl(6.85, 0.05, 2.7, 0.4, 0.4, 0.22, '#222', { seg: 12, rx: Math.PI / 2 });
    b.cyl(5.6, 0.0, 1.65, 0.6, 0.6, 0.3, '#222', { seg: 12, rx: Math.PI / 2 });
    b.cyl(5.6, 0.0, 2.75, 0.6, 0.6, 0.3, '#222', { seg: 12, rx: Math.PI / 2 });
    // hay stack + bales
    P.hay(c, 4.6, 5.2, 0.5);
    P.hay(c, 5.4, 5.7, 1.2);
    P.hay(c, 5.0, 5.4, 0.2, { y: 0.55 });
    P.hay(c, -6.5, 8, 1.4);
    // fences & trees
    P.fence(c, [[-6.2, 7], [-6.2, -3], [-6.2, -8]], { color: '#f3ead6' });
    P.fence(c, [[3.6, 8], [3.6, -4]], { color: '#f3ead6' });
    const treePos = [[-6, 12], [6, 11], [-12, 8], [12, 10], [16, 0], [-16, -8], [18, -12], [-15, -22], [9, -26], [-4, -28], [4, -30], [-11, -26], [14, -22]];
    treePos.forEach(([x, z], i) => P.tree(c, x, z, 0.9 + (i % 3) * 0.2, { crown: i % 2 ? '#4cbc4e' : '#6acb50', crown2: '#3aa845' }));
    // scarecrow
    const sc = c.make((sb) => {
      sb.cyl(0, 0, 0, 0.04, 0.05, 1.5, '#7a5230', { seg: 6 });
      sb.boxc(0, 1.15, 0, 1.2, 0.07, 0.07, '#7a5230');
      sb.sph(0, 1.55, 0, 0.2, '#f0d090', { seg: 8 });
      sb.cyl(0, 1.7, 0, 0.32, 0.32, 0.03, '#5a3a20', { seg: 10 });
      sb.cyl(0, 1.73, 0, 0.14, 0.2, 0.2, '#5a3a20', { seg: 10 });
      sb.box(0, 0.75, 0.0, 0.5, 0.5, 0.2, '#5b8bd6');
      sb.sph(-0.06, 1.58, 0.17, 0.03, '#222', { seg: 4 });
      sb.sph(0.06, 1.58, 0.17, 0.03, '#222', { seg: 4 });
    });
    c.place(sc, 8.4, -0.08, -14, -0.5);
    c.onFrame((t) => (sc.rotation.z = Math.sin(t * 1.3) * 0.03));
    // windsock on the tower
    const wpole = c.make((wb) => wb.cyl(0, 0, 0, 0.03, 0.04, 1.3, '#666', { seg: 5 }));
    c.place(wpole, 2.2, 1.7, -15, 0);
    const sock = c.make((wb) => {
      wb.cyl(0, 0, 0, 0.1, 0.2, 0.7, '#ff7a2a', { seg: 8, rz: Math.PI / 2 });
      wb.cyl(0.25, 0, 0, 0.13, 0.15, 0.16, '#ffffff', { seg: 8, rz: Math.PI / 2 });
    }, { outline: false });
    sock.position.set(2.2, 3.0, -15);
    c.add(sock);
    c.onFrame((t) => {
      sock.rotation.y = Math.sin(t * 0.5) * 0.4;
      sock.rotation.z = Math.sin(t * 5) * 0.06;
    });
    // pond with ducks
    c.disc(11, 6, 3.0, -0.3, 'water', { seg: 24 });
    b.cyl(11, -0.3, 6, 3.1, 3.2, 0.24, '#8d94a8', { seg: 24 });
    for (let i = 0; i < 3; i++) {
      const duck = c.make((db) => {
        db.sph(0, 0.1, 0, 0.16, '#fff4b0', { seg: 8, sz: 1.3 });
        db.sph(0, 0.28, 0.13, 0.1, '#fff4b0', { seg: 7 });
        db.cone(0, 0.27, 0.22, 0.04, 0.1, '#ff9a2a', { seg: 4, rx: Math.PI / 2 });
        db.sph(-0.05, 0.3, 0.2, 0.02, '#000', { seg: 4 });
        db.sph(0.05, 0.3, 0.2, 0.02, '#000', { seg: 4 });
      });
      c.add(duck);
      const ph = i * 2.1;
      c.onFrame((t) => {
        const a = t * 0.3 + ph;
        duck.position.set(11 + Math.cos(a) * 1.6, -0.25 + Math.sin(t * 2 + ph) * 0.015, 6 + Math.sin(a) * 1.3);
        duck.rotation.y = -a + Math.PI;
      });
    }
    P.jumpingFish(c, 11, 6, -0.3, { period: 6, phase: 2 });
    // animals
    P.sheep(c, -9, 6, 2.5, { rz: 1.4 });
    P.sheep(c, -11, 9.5, 2.0, { rz: 1.2 });
    P.sheep(c, 16, -8, 2.5, { rz: 1.5, fleece: '#ffffff', skin: '#2b2b33', scale: 1.3 });
    P.sheep(c, 14, -14, 2.2, { rz: 1.4, fleece: '#f7e6d0', skin: '#6b4a32', scale: 1.3 });
    for (let i = 0; i < 4; i++) P.chicken(c, -4.8 + R() * 2.2, 8.4 + R() * 2, { ry: R() * TAU });
    P.butterfly(c, 2, -10, 3, { y: 0.9 });
    P.butterfly(c, -6, -20, 3, { y: 1.1 });
    P.bee(c, -9, 0.9, -19, 1.2);
    P.birdFlock(c, { cx: 0, cz: -14, y: 11, radius: 10, count: 5 });
    P.birdFlock(c, { cx: -6, cz: -30, y: 15, radius: 12, count: 3, speed: 0.18 });
    P.flowers(c, -3.9, -2.5, 1.4, 22, { seed: 9 });
    P.flowers(c, 3.5, -22, 1.6, 26, { seed: 4 });
    P.flowers(c, 2.4, 6, 1.8, 26, { seed: 6 });
    c.sign(-1.9, 5.6, 'HOLE 2\nPAR 3', { ry: 0.3, w: 1.2, hh: 0.6 });
    c.sign(2.6, -11, 'MIND THE\nSAILS!', { ry: -0.3, w: 1.3, hh: 0.62, tex: { bg: '#7a1f18', fg: '#fff0c0', font: '900 50px "Trebuchet MS", sans-serif' } });
    // stones & bushes
    [[3.8, 3], [-6, -1], [3.8, -15], [-3.6, -14], [-3.6, -19], [3.8, -24]].forEach(([x, z], i) => P.bush(c, x, z, 0.9 + (i % 2) * 0.3, '#3aad4a'));
  },
};
