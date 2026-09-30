// Hole 6 – Crystal Caverns: a rock tunnel or a rail-less bridge, then a portal puzzle to reach the sealed treasure vault.
import * as THREE from 'three';
import * as P from '../props.js';
import { rng, TAU } from '../util.js';
import { makeWaterfallMaterial } from '../render/shaders.js';

export default {
  id: 6,
  name: 'Crystal Caverns',
  par: 4,
  solverPeriod: 6,
  hint: 'Take the tunnel (safe, curvy) or the rail-less bridge. In the vault chamber, the BLUE portal leads to the treasure – the red one sends you back!',
  wallSound: 'wall',
  theme: {
    sky: { top: '#1a0e44', mid: '#3a2288', bottom: '#8a5ad8', sun: [0.2, 0.9, -0.3], sunColor: '#8080ff', clouds: 0, stars: 0.0 },
    fog: { color: '#4a34a0', near: 40, far: 170 },
    hemi: { sky: '#a8b8ff', ground: '#7a4ab0', intensity: 1.95 },
    sun: { color: '#c8d0ff', intensity: 2.2, dir: [0.3, 0.9, 0.5] },
    water: { shallow: '#4dfff0', deep: '#0a6a9a', foam: '#c8fffa', sky: '#5a6aff', amp: 0.02 },
    flagColor: '#7dff9a',
    bloom: 1.0,
    bloomThreshold: 0.85,
    vignette: 0.42,
    music: { root: 4, scale: 'minor', tempo: 74, wave: 'sine', arp: 0.85 },
  },
  build(c) {
    const R = rng(66);
    c.sy = -0.05;
    const rockWall = { color: '#4f4a88', top: '#8f88cc', h: 0.55, t: 0.26 };
    const FLOOR = '#7b7ab6';

    // ------------------------------------------------------------ chamber A (tee) + corridor + junction room
    c.rect(0, 4, 6, 6, 0, 'stone', { color: FLOOR });
    const corr = c.strip([[0, 1.05], [0, -8.2]], 2.6, 'stone', { color: FLOOR, cell: 1.5, across: 1 });
    c.rect(0, -10.25, 9, 4.5, 0, 'stone', { color: FLOOR });
    c.setTee(0, 5.2, 0);
    c.wall([[-3, 1], [-1.3, 1]], rockWall);
    c.wall([[1.3, 1], [3, 1]], rockWall);
    c.wall([[-3, 1], [-3, 7], [3, 7], [3, 1]], rockWall);
    c.wall([[-1.3, 1], [-1.3, -8]], rockWall);
    c.wall([[1.3, 1], [1.3, -8]], rockWall);
    c.wall([[-4.5, -8], [-1.3, -8]], rockWall);
    c.wall([[1.3, -8], [4.5, -8]], rockWall);
    c.wall([[-4.5, -8], [-4.5, -12.5]], rockWall);
    c.wall([[4.5, -8], [4.5, -12.5]], rockWall);
    // south side of the junction room with two gaps: tunnel (x -4.1..-3.1) and bridge (x 2.85..4.35)
    c.wall([[-4.5, -12.5], [-4.1, -12.5]], rockWall);
    c.wall([[-3.1, -12.5], [2.85, -12.5]], rockWall);
    c.wall([[4.35, -12.5], [4.5, -12.5]], rockWall);
    // stalagmite slalom in the corridor
    c.post(0.55, -1.6, 0.34, { h: 1.0, color: '#4a4478', taper: 0.3, seg: 7 });
    c.post(-0.55, -4.8, 0.34, { h: 1.0, color: '#4a4478', taper: 0.3, seg: 7 });
    c.post(-1.7, -10.2, 0.4, { h: 1.1, color: '#4a4478', taper: 0.3, seg: 7 });
    c.post(1.5, -10.6, 0.4, { h: 1.1, color: '#4a4478', taper: 0.3, seg: 7 });

    // ------------------------------------------------------------ the tunnel (guided pipe through the rock)
    const tunnelPts = [
      [-3.6, 0.11, -12.9], [-3.6, 0.11, -14.4], [-3.6, -0.55, -16.0], [-2.6, -1.0, -17.4], [-3.6, -0.6, -18.9], [-3.8, 0.0, -20.6], [-3.6, 0.11, -22.9],
    ];
    c.pipe(tunnelPts, { opaque: true, color: '#453f70', rib: '#8b7fe0', radius: 0.33, r: 0.4, ribGap: 0.9 });
    // stone arches at the entrance / exit
    for (const z of [-12.6, -22.6]) {
      c.b.box(-4.1, 0, z, 0.32, 0.9, 0.5, '#5a5290');
      c.b.box(-3.1, 0, z, 0.32, 0.9, 0.5, '#5a5290');
      c.b.box(-3.6, 0.85, z, 1.45, 0.26, 0.55, '#6a62a8');
      c.g.box(-3.6, 0.55, z + (z < -20 ? 0.2 : -0.2), 0.75, 0.05, 0.05, '#7dffef', { tint: 2 });
    }
    // rock mass above the tunnel
    c.b.sph(-3.6, -1.5, -17.6, 3.8, '#3a3564', { sy: 0.7, seg: 10 });
    c.b.sph(-1.2, -1.5, -16, 2.4, '#443e74', { sy: 0.6, seg: 9 });

    // ------------------------------------------------------------ the bridge over the glowing lake
    c.rect(3.6, -17.5, 1.5, 10.2, 0, 'wood', { color: '#a27444' });
    c.rect(3.6, -17.5 - 0, 10.5, 12, -0.9, 'water');
    for (let z = -13; z > -22.4; z -= 1.55) {
      c.b.box(2.7, -0.7, z, 0.18, 0.72, 0.18, '#4a3018', { tint: 1 });
      c.b.box(4.5, -0.7, z, 0.18, 0.72, 0.18, '#4a3018');
    }
    for (let z = -12.9; z > -22.3; z -= 0.75) c.b.box(3.6, -0.06, z, 1.62, 0.06, 0.06, '#7a5228', { tint: 0.95 });
    // glowing rail lamps
    for (const z of [-13.4, -17.5, -21.6]) {
      c.b.cyl(2.75, 0, z, 0.03, 0.03, 0.55, '#2a2040', { seg: 5 });
      c.g.sph(2.75, 0.58, z, 0.08, '#7dffef', { seg: 6, tint: 2.2 });
    }

    // ------------------------------------------------------------ chamber C (vault chamber)
    c.rect(0, -26.5, 10, 8, 0, 'stone', { color: FLOOR });
    c.wall([[-5, -22.5], [-4.1, -22.5]], rockWall);
    c.wall([[-3.1, -22.5], [2.85, -22.5]], rockWall);
    c.wall([[4.35, -22.5], [5, -22.5]], rockWall);
    c.wall([[-5, -22.5], [-5, -30.5], [5, -30.5], [5, -22.5]], rockWall);
    // vault (sealed treasure room)
    const VW = { color: '#6a4aa8', top: '#b898ff', h: 0.7, t: 0.28 };
    c.wall([[-1.7, -26.6], [1.7, -26.6], [1.7, -29.7], [-1.7, -29.7], [-1.7, -26.6]], VW);
    c.setCup(0.35, -28.5);
    // portals: blue = vault, red = decoy back to the start
    c.portalPair({ x: 3.2, z: -25.0, exit: 0 }, { x: -0.95, z: -27.4, exit: 0.75 }, { colorA: '#4d8bff', colorB: '#4dffef' });
    c.portalPair({ x: -3.2, z: -25.0, exit: 0 }, { x: -1.9, z: 3.3, exit: 0 }, { colorA: '#ff4d6d', colorB: '#ffb04d' });
    // treasure in the vault
    const gem = c.make((gb) => {
      gb.cyl(0, 0.0, 0, 0.001, 0.32, 0.55, '#7dffef', { seg: 6 });
      gb.cyl(0, 0.55, 0, 0.32, 0.001, 0.55, '#a8fff6', { seg: 6 });
    }, { glow: true, outline: false });
    gem.position.set(-1.05, 1.05, -29.0);
    c.add(gem);
    P.halo(c, -1.05, 1.3, -29.0, 2.4, '#7dffef', 1.1);
    c.onFrame((t) => {
      gem.rotation.y = t * 1.2;
      gem.position.y = 1.05 + Math.sin(t * 1.6) * 0.1;
    });
    for (let i = 0; i < 14; i++) c.g.cyl(-1.2 + R() * 1.2, 0, -29.4 + R() * 0.6, 0.11, 0.11, 0.03, '#ffd23f', { seg: 8, tint: 1.9 });
    c.sign(3.2, -23.6, '☆ VAULT', { ry: 0.3, w: 1.3, hh: 0.5, h: 0.8, tex: { bg: '#16307a', fg: '#7dffef', border: '#4d8bff', font: '900 46px "Trebuchet MS", sans-serif' } });
    c.sign(-3.2, -23.6, '✖ EXIT', { ry: -0.3, w: 1.3, hh: 0.5, h: 0.8, tex: { bg: '#5a1030', fg: '#ffb0a0', border: '#ff4d6d', font: '900 46px "Trebuchet MS", sans-serif' } });

    c.setRoute([[0, 0, 5.2], [0, 0, 1], [0, 0, -8], [-3.6, 0, -11.6], [-3.6, 0, -13.3], [-3.6, 0, -23.5], [1.5, 0, -25.2], [3.2, 0, -25], [0.35, 0, -28.5]]);
    c.routes = [c.route, [[0, 0, 5.2], [0, 0, -8], [3.6, 0, -11.8], [3.6, 0, -23.5], [3.2, 0, -25], [0.35, 0, -28.5]]];
    c.flyKeys = [
      { p: [0, 4, 10], l: [0, 1, -2] },
      { p: [-3, 3.2, 0], l: [0, 1, -10] },
      { p: [0, 5, -6], l: [-1, 0.5, -16] },
      { p: [8, 4, -16], l: [0, 0, -19] },
      { p: [6, 5, -30], l: [0, 0.6, -25] },
      { p: [-2, 4, -33], l: [0.3, 0.5, -28] },
      { p: [0, 2.6, 8.5], l: [0, 0.8, -6] },
    ];
    c.flyDur = 7;

    // ------------------------------------------------------------ cave decoration
    P.scenery(c, { y: -0.22, color: '#3a2f70', r: 90, cx: 0, cz: -14 });
    // dark rock ring
    const rockRing = c.make((b) => {
      b.vary = 0.08;
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * TAU;
        const k = 1 + R() * 0.28;
        const px = Math.cos(a) * 17 * k, pz = -11 + Math.sin(a) * 31 * k;
        const h = 6 + R() * 9;
        const cols = ['#6a60b8', '#5a52a4', '#7a6cc8', '#4e4894'];
        b.cone(px, -0.3, pz, 2.4 + R() * 3, h, cols[i % 4], { seg: 6, ry: R() * 3 });
        if (i % 3 === 0) c.g.cone(px * 0.94, 0.5, -11 + (pz + 11) * 0.94, 0.5, 2.6 + R() * 2, ['#7dffef', '#b48aff', '#ff7ad9'][(i / 3) % 3 | 0], { seg: 5, tint: 1.5 });
      }
    }, { width: 1.5, shadow: false });
    c.add(rockRing);
    // stalactites
    const stal = c.make((b) => {
      for (let i = 0; i < 60; i++) {
        const x = R.range(-14, 14), z = R.range(-38, 12);
        const h = 1.5 + R() * 3.0;
        b.cone(x, 10.5 - h, z, 0.25 + R() * 0.5, h, i % 2 ? '#6a62b0' : '#5a52a0', { seg: 6, rx: Math.PI });
      }
    }, { shadow: false });
    c.add(stal);
    // crystals (glowing)
    const cryCols = ['#7dffef', '#b48aff', '#ff7ad9', '#7abaff', '#8aff9a'];
    [[-3.6, 6.3], [3.5, 6.2], [-2.4, -2.6], [2.4, -6.2], [-4.9, -9], [4.9, -9.6], [-4.7, -26], [4.7, -28], [-3, -29.8], [0, -30.2], [3.2, -30], [-7, -1], [7, 3], [-8.5, -14], [8, -14], [7.5, -26], [-7.5, -25], [-6.5, 7], [6.5, -19]].forEach(([x, z], i) => {
      P.crystal(c, x, z, 0.9 + (i % 4) * 0.35, cryCols[i % cryCols.length], { y: -0.05, n: 4 + (i % 3) });
      if (i % 2 === 0) P.halo(c, x, 0.8, z, 2.2, cryCols[i % cryCols.length], 0.55);
    });
    // glowing mushrooms
    [[-2.4, 3.4], [2.5, -4.2], [-4.4, -11.5], [4.6, -11.5], [-4.6, -27.8], [4.6, -24], [0, -22.9]].forEach(([x, z], i) => {
      c.b.cyl(x, 0, z, 0.06, 0.08, 0.35, '#e8e0ff', { seg: 6 });
      c.g.sph(x, 0.4, z, 0.28, cryCols[(i + 2) % 5], { seg: 8, sy: 0.6, tint: 1.6 });
    });
    // torches with real lights
    P.torch(c, -2.7, 0, 6.6, { light: true, intensity: 11, dist: 13 });
    P.torch(c, 2.7, 0, 6.6, { light: true, intensity: 11, dist: 13 });
    P.torch(c, -4.6, 0, -23.4, { light: true, intensity: 9, dist: 12, lightColor: '#ff7a5a' });
    P.torch(c, 4.7, 0, -23.4, { light: true, intensity: 9, dist: 12, lightColor: '#ff7a5a' });
    // wooden mine supports + cart
    for (const z of [0.5, -7.5]) {
      c.b.box(-1.6, 0, z, 0.18, 1.6, 0.18, '#7a5228');
      c.b.box(1.6, 0, z, 0.18, 1.6, 0.18, '#7a5228');
      c.b.box(0, 1.5, z, 3.5, 0.18, 0.2, '#8a6034');
    }
    const cart = c.make((b) => {
      b.box(0, 0.15, 0, 0.9, 0.5, 0.6, '#8a4a2a');
      b.box(0, 0.55, 0.32, 0.95, 0.12, 0.06, '#5a3018');
      b.box(0, 0.55, -0.32, 0.95, 0.12, 0.06, '#5a3018');
      for (const sx of [-0.3, 0.3]) for (const sz of [-1, 1]) b.cyl(sx, 0.08, sz * 0.32, 0.12, 0.12, 0.06, '#222', { seg: 8, rx: Math.PI / 2 });
      b.sph(-0.15, 0.7, 0, 0.22, '#7dffef', { seg: 7, sy: 0.7, tint: 1.3 });
      b.sph(0.18, 0.66, 0.05, 0.2, '#ff7ad9', { seg: 7, sy: 0.7, tint: 1.3 });
    });
    c.place(cart, -6.2, -0.05, -8.4, 0.5);
    // cave waterfall into the lake
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 10), makeWaterfallMaterial('#7dffef'));
    wf.position.set(6.6, 4.1, -16.5);
    wf.rotation.y = -Math.PI / 2;
    c.add(wf);
    c.b.sph(7.4, 5, -16.5, 2.4, '#3a3564', { seg: 8 });
    P.drifters(c, { count: 40, box: [5.6, 7.0, -0.8, 0.8, -17.4, -15.6], color: '#d8fffa', size: 0.2, mode: 'rise', speed: 0.9, twinkle: 0 });
    // bats
    for (let i = 0; i < 6; i++) bat(c, R.range(-6, 6), 4 + R() * 3, R.range(-30, 4), 3 + R() * 3, 0.5 + R() * 0.4);
    // drips + fireflies
    P.drifters(c, { count: 90, box: [-6, 6, 0, 8, -32, 8], color: '#9fe8ff', size: 0.08, mode: 'fall', speed: 1.6, twinkle: 0 });
    P.drifters(c, { count: 90, box: [-9, 9, 0.3, 4, -32, 8], color: '#a8ffb8', size: 0.14, mode: 'float', speed: 0.5, twinkle: 1 });
    P.drifters(c, { count: 60, box: [1.5, 6, 0, 3, -22, -12], color: '#7dffef', size: 0.14, mode: 'rise', speed: 0.5, twinkle: 1 });
    c.sign(-2.2, 6.8, 'HOLE 6\nPAR 4', { ry: 0.3, w: 1.2, hh: 0.6 });
    c.sign(-2.2, -9, '← TUNNEL', { ry: 0.5, w: 1.3, hh: 0.45, tex: { bg: '#2a2056', fg: '#c8b8ff', border: '#8b7fe0', font: '900 40px "Trebuchet MS", sans-serif' } });
    c.sign(2.2, -9, 'BRIDGE →', { ry: -0.5, w: 1.3, hh: 0.45, tex: { bg: '#5a3a18', fg: '#ffe0a0', border: '#c88a3a', font: '900 40px "Trebuchet MS", sans-serif' } });
  },
};

function bat(c, cx, cy, cz, r, spd) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, 0.16, '#241a38', { seg: 7, sz: 1.3 });
    b.cone(-0.06, 0.16, 0.05, 0.04, 0.14, '#241a38', { seg: 3 });
    b.cone(0.06, 0.16, 0.05, 0.04, 0.14, '#241a38', { seg: 3 });
    b.sph(-0.05, 0.03, 0.15, 0.03, '#ff5a5a', { seg: 4 });
    b.sph(0.05, 0.03, 0.15, 0.03, '#ff5a5a', { seg: 4 });
  }, { shadow: false });
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = c.make((b) => {
      b.tris([[0, 0, 0.1], [sx * 0.7, 0.1, 0.25], [sx * 0.55, 0, -0.25]], '#372a54');
      b.tris([[sx * 0.55, 0, -0.25], [sx * 0.7, 0.1, 0.25], [0, 0, 0.1]], '#2a1f42');
      b.tris([[0, 0, 0.1], [sx * 0.55, 0, -0.25], [0, 0, -0.2]], '#372a54');
    }, { shadow: false, outline: false });
    g.add(w);
    wings.push({ w, sx });
  }
  g.scale.setScalar(1.8);
  c.add(g);
  const ph = Math.random() * 30;
  c.onFrame((t) => {
    const a = t * spd + ph;
    g.position.set(cx + Math.cos(a) * r + Math.sin(a * 3) * 0.6, cy + Math.sin(a * 2.3) * 0.7, cz + Math.sin(a) * r * 0.8);
    g.rotation.y = -a + Math.PI;
    g.rotation.z = Math.sin(a * 2) * 0.2;
    const f = Math.sin(t * 16 + ph) * 0.9;
    wings[0].w.rotation.z = f;
    wings[1].w.rotation.z = -f;
  });
}
