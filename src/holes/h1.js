// Hole 1 – Sunny Meadow: a friendly warm-up with a rolling hill, a dogleg and a tempting sand trap.
import * as THREE from 'three';
import { bump } from '../util.js';
import * as P from '../props.js';
import { makeWaterfallMaterial } from '../render/shaders.js';

export default {
  id: 1,
  name: 'Sunny Meadow',
  par: 2,
  hint: 'Warm up: the hill nudges your ball sideways – aim just off the crest.',
  theme: {
    sky: { top: '#2f86e0', mid: '#7cc8ff', bottom: '#e6f6ff', sun: [0.5, 0.65, -0.55], clouds: 0.75 },
    fog: { color: '#d3efff', near: 60, far: 210 },
    hemi: { sky: '#d6ecff', ground: '#86b060', intensity: 1.55 },
    sun: { color: '#fff1d2', intensity: 2.7, dir: [-0.45, 0.85, 0.35] },
    water: { shallow: '#7be9ff', deep: '#2483e0', sky: '#d3f0ff' },
    flagColor: '#ff3d5a',
    music: { root: 0, scale: 'major', tempo: 92 },
  },
  build(c) {
    const W = 3.2;
    const path = [[0, 4], [0, -3], [0, -7], [1.8, -11], [5, -13.6], [8.6, -14.6]];
    const hill = bump(0, -3.4, 2.5, 0.42);
    const hill2 = bump(1.2, -8.6, 1.5, 0.16);
    const hfn = (x, z) => hill(x, z) + hill2(x, z);
    const s = c.strip(path, W, 'grass', {
      cell: 0.5,
      hfn,
      color: '#66d257',
      tint: (x, z) => 0.95 + 0.05 * Math.sin(x * 0.9) * Math.cos(z * 0.7),
    });
    c.wall(s.left, { color: '#b8783f', top: '#e2a866', h: 0.5 });
    c.wall(s.right, { color: '#b8783f', top: '#e2a866', h: 0.5 });
    c.wall([s.left[0], s.right[0]], { color: '#b8783f', top: '#e2a866', h: 0.5 });
    const e = s.left.length - 1;
    c.wall([s.left[e], s.right[e]], { color: '#b8783f', top: '#e2a866', h: 0.5 });

    // sand trap on the inside of the dogleg
    c.disc(3.85, -11.35, 0.95, 0.004, 'sand', { seg: 20, color: '#f3dd94' });

    c.setTee(0, 3.3, 0);
    c.setCup(7.45, -14.3);
    c.setRoute([[0, 0, 3.3], [0, 0.3, -3.4], [0.2, 0.1, -8], [2.4, 0, -11.6], [5, 0, -13.6], [7.4, 0, -14.3]]);
    c.oobY = -2;

    // ---------------------------------------------------------------- scenery
    P.scenery(c, { y: -0.08, color: '#77cf5a', r: 170, cx: 3, cz: -6 });
    P.hills(c, { cx: 3, cz: -6, colors: ['#5fbf58', '#4aa84f', '#78cf62'], seed: 11 });
    P.clouds(c, { count: 9, y: 28, spread: 80 });
    P.grassField(c, { x0: -22, x1: 26, z0: -34, z1: 16, count: 3800, y: -0.08, region: (x, z) => Math.hypot(x - 3, z + 6) < 30 });
    P.grassField(c, { x0: -3, x1: 12, z0: -19, z1: 8, count: 900, y: -0.08, base: '#3aa34a', tip: '#d5ff83', avoid: 1.3 });

    // trees, bushes, flowers
    const trees = [[-5, 2], [-6.5, -5], [-4.4, -10], [-7, -14], [5, 7], [8, 2], [10, -3], [12, -9], [10.5, -20], [6, -21], [1, -18], [-3, -19], [14, -15], [-9, 6], [14, 5], [-11, -9]];
    trees.forEach(([x, z], i) => P.tree(c, x, z, 0.9 + (i % 4) * 0.18, { crown: i % 3 ? '#3fbf52' : '#52cf5a', crown2: '#35ab4a' }));
    [[-3.6, 6.2], [3.8, 6.4], [-3.4, -4.5], [4.1, -5.5], [6.5, -10.5], [9.8, -11.5], [11, -17], [2, -16.5], [-2.6, -12]].forEach(([x, z], i) => P.bush(c, x, z, 0.9 + (i % 3) * 0.3, i % 2 ? '#2fa64a' : '#3dbb54', { berries: i % 3 === 0 ? '#ff4d6d' : null }));
    [[-4.6, -1], [-3.9, -8], [4.6, -8.3], [7.6, -17.4], [10, -12.7], [3.6, 3], [-4.5, 4.4], [1.9, -16]].forEach(([x, z], i) => P.flowers(c, x, z, 1.3, 26, { seed: i + 3 }));
    [[5.5, -18], [-5.3, -11.2], [4.6, 5.5]].forEach(([x, z], i) => P.rock(c, x, z, 0.9 + i * 0.2, '#9a9fb0'));
    P.mushroom(c, -4.2, -6, 1);
    P.mushroom(c, -4.55, -6.25, 0.7);
    P.mushroom(c, 9.4, -16.4, 0.9);

    // picket fences in the distance
    P.fence(c, [[-5, 8], [-5, -3]], { color: '#fff7e6' });
    P.fence(c, [[6, -18.5], [12, -16.5], [14.5, -12]], { color: '#fff7e6' });

    // pond with a little waterfall, lily pads and a frog
    c.disc(-9.6, -3.2, 3.6, -0.28, 'water', { seg: 26 });
    c.rect(-9.6, -3.2, 12, 9, -0.4, 'stone', { color: '#6b7a5a' });
    c.b.cyl(-9.6, -0.28, -3.2, 3.75, 3.85, 0.3, '#8d94a8', { seg: 26 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.28;
      P.rock(c, -9.6 + Math.cos(a) * 3.85, -3.2 + Math.sin(a) * 3.85, 0.55 + (i % 3) * 0.15, '#9aa0b4', { y: -0.2 });
    }
    // rocky outcrop feeding the waterfall
    const oc = c.b;
    oc.sph(-12.8, -0.1, -7.8, 2.6, '#8f96ad', { sy: 0.95, seg: 9 });
    oc.sph(-11.6, 0.3, -8.6, 1.9, '#a2a9bf', { sy: 1.1, seg: 8 });
    oc.sph(-13.8, 0.2, -6.8, 1.5, '#7f86a0', { sy: 1.2, seg: 8 });
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.1), makeWaterfallMaterial('#b6ecff'));
    wf.position.set(-11.4, 1.36, -6.55);
    wf.rotation.y = 0.55;
    c.add(wf);
    P.drifters(c, { count: 50, box: [-12.4, -10.4, 0, 1.2, -7.6, -5.2], color: '#e8faff', size: 0.16, mode: 'rise', speed: 0.9, twinkle: 0 });
    for (let i = 0; i < 4; i++) {
      const pad = c.make((b) => {
        b.cyl(0, 0, 0, 0.32, 0.32, 0.03, '#3fbf58', { seg: 12 });
        if (i === 1) b.sph(0.1, 0.06, 0, 0.06, '#ff8fb8', { seg: 6 });
      });
      c.place(pad, -9.6 + Math.cos(i * 1.7 + 0.4) * 1.5, -0.24, -3.2 + Math.sin(i * 1.7 + 0.4) * 1.3, i);
    }
    P.frog(c, -8.9, -2.1, { y: -0.2, ry: 2.1, period: 3.1 });
    P.jumpingFish(c, -9.6, -3.4, -0.28, { period: 4.7, phase: 1 });
    P.jumpingFish(c, -9.2, -3.0, -0.28, { period: 6.1, phase: 3, color: '#ff6a9a' });
    // reeds
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + 0.2;
      c.d.cyl(-9.6 + Math.cos(a) * 3.5, -0.1, -3.2 + Math.sin(a) * 3.3, 0.012, 0.025, 0.9 + (i % 3) * 0.2, '#5b9a3c', { seg: 4, sway: 0.7 });
    }

    // life
    P.butterfly(c, 3, -6, 3.2, { y: 1.0 });
    P.butterfly(c, -2, 0, 2.5, { y: 0.8, colors: ['#ffffff', '#ffd23f'] });
    P.butterfly(c, 6, -13, 2.5, { y: 1.1 });
    P.bee(c, -3.8, 0.7, -1, 0.7);
    P.bee(c, 4.2, 0.9, -8, 0.9);
    P.birdFlock(c, { cx: 3, cz: -8, y: 14, radius: 16, count: 5 });
    P.sheep(c, 10, -6, 2.4, { rz: 1.3 });
    P.sheep(c, 13, -12, 2.0, { rz: 1.1 });
    P.sheep(c, -6.5, 12, 3.0, { rz: 1.5 });
    P.chicken(c, -4.3, 5, { ry: 1 });
    P.chicken(c, 4.9, -9.3, { ry: 4 });

    // signs
    c.sign(-2.4, 5.4, 'HOLE 1\nPAR 2', { ry: 0.35, w: 1.2, hh: 0.6 });
    c.sign(9.5, -14.2, 'FLAG!', { ry: -0.8, w: 0.9, hh: 0.4, tex: { font: '900 52px "Trebuchet MS", sans-serif' } });

    // wooden beehive + little cottage in the backdrop
    c.b.box(-12, -0.08, 12, 3.2, 2.4, 2.8, '#f2e3c2');
    c.b.cone(-12, 2.32, 12, 2.7, 1.5, '#d5573f', { seg: 4, ry: Math.PI / 4 });
    c.b.box(-12, -0.08, 13.42, 0.7, 1.2, 0.05, '#7b4a2a');
    c.b.box(-13, 0.9, 13.42, 0.5, 0.5, 0.05, '#7fd0ff');
    c.b.box(-11, 0.9, 13.42, 0.5, 0.5, 0.05, '#7fd0ff');
    c.b.box(-11.1, 2.6, 11.2, 0.4, 1.0, 0.4, '#b5583c');
    P.drifters(c, { count: 16, box: [-11.4, -10.6, 3.6, 7, 10.8, 11.6], color: '#f4f4f8', size: 0.32, mode: 'rise', speed: 0.5, additive: false, twinkle: 0 });
  },
};
