// Hole 3 – Pirate Cove: a risky ramp-jump over the bay, or the long boardwalk past a swinging anchor.
import * as THREE from 'three';
import * as P from '../props.js';
import { rng, TAU } from '../util.js';
import { labelTexture } from '../render/textures.js';

const DECK = 0.4;
const SEA = -0.2;
const PEND = { x: -6.6, y: 3.3, z: -8.0, L: 2.85, amp: 0.85, period: 4.0 };

export default {
  id: 3,
  name: 'Pirate Cove',
  par: 3,
  solverPeriod: PEND.period,
  hint: 'Jump the bay from the ramp with a full-power putt – or take the boardwalk and dodge the swinging anchor.',
  theme: {
    sky: { top: '#2b86e6', mid: '#63c6ff', bottom: '#ffe8bd', sun: [-0.55, 0.55, -0.6], sunColor: '#fff0b8', clouds: 0.7 },
    fog: { color: '#cfeaff', near: 55, far: 210 },
    hemi: { sky: '#d8efff', ground: '#e0c088', intensity: 1.55 },
    sun: { color: '#fff0cc', intensity: 2.7, dir: [0.55, 0.8, 0.4] },
    water: { shallow: '#5ff0ff', deep: '#1a66d0', foam: '#ffffff', sky: '#cfeeff', amp: 0.04, scale: 0.9 },
    flagColor: '#111111',
    music: { root: 2, scale: 'mpent', tempo: 118, wave: 'triangle', arp: 0.7 },
  },
  build(c) {
    const R = rng(33);
    const wood = '#c98d52';
    const wallO = { color: '#7b4a26', top: '#c98d52', h: 0.5, t: 0.2 };
    c.sy = SEA;

    // ---------------------------------------------------------------- the sea
    c.rect(0, -8, 90, 70, SEA, 'water');

    // ---------------------------------------------------------------- start plaza
    c.rect(0, 0.25, 4.8, 8.5, DECK, 'wood', { color: wood });
    c.setTee(0, 1.6, 0);
    c.skirt([[-2.4, 4.5], [-2.4, -3.5], [2.4, -3.5], [2.4, 4.5], [-2.4, 4.5]].map(([x, z]) => [x, z, DECK]), 0.8, '#6b4022');
    c.wall([[-2.4, 4.5], [2.4, 4.5]], wallO);
    c.wall([[2.4, 4.5], [2.4, -3.5]], wallO);
    c.wall([[-2.4, 4.5], [-2.4, -0.9]], wallO);
    c.wall([[-2.4, -2.9], [-2.4, -3.5]], wallO);
    c.wall([[-2.4, -3.5], [-1.0, -3.5]], wallO);
    c.wall([[1.0, -3.5], [2.4, -3.5]], wallO);
    for (const [x, z] of [[-2.2, 4.3], [2.2, 4.3], [-2.2, -3.3], [2.2, -3.3], [0, 4.3]]) c.b.cyl(x, -1.1, z, 0.14, 0.16, 1.5, '#5a3a20', { seg: 6 });
    // planks detail + lanterns
    for (const sx of [-1, 1]) {
      c.b.cyl(sx * 2.4, DECK, 3.6, 0.06, 0.07, 1.0, '#4a2c16', { seg: 6 });
      c.g.sph(sx * 2.4, DECK + 1.05, 3.6, 0.13, '#ffb040', { seg: 8, tint: 2.4 });
      P.halo(c, sx * 2.4, DECK + 1.05, 3.6, 1.1, '#ffb347', 0.9);
    }

    // ---------------------------------------------------------------- jump ramp
    const ramp = c.ramp(0, -3.5, DECK, 0, -6.0, DECK + 0.78, 2.0, 'wood', { color: '#d8a060', cell: 5 });
    c.wall([[-1.0, -3.5], [-1.0, -6.0]], { ...wallO, h: 0.45 });
    c.wall([[1.0, -3.5], [1.0, -6.0]], { ...wallO, h: 0.45 });
    c.skirt([[-1.0, -3.5, DECK], [-1.0, -6.0, DECK + 0.78]], 0.8, '#6b4022');
    c.skirt([[1.0, -3.5, DECK], [1.0, -6.0, DECK + 0.78]], 0.8, '#6b4022');
    for (let i = 0; i < 3; i++) {
      const zz = -4.0 - i * 0.7;
      const yy = DECK + ((zz + 3.5) / -2.5) * 0.78 + 0.012;
      c.g.tris([[0, yy, zz - 0.28], [-0.35, yy, zz + 0.12], [0.35, yy, zz + 0.12]], '#ffcf3a', { tint: 1.6 });
    }
    // skull flag over the ramp
    c.b.cyl(-1.15, DECK + 0.6, -6.1, 0.05, 0.06, 1.6, '#4a2c16', { seg: 6 });
    c.b.cyl(1.15, DECK + 0.6, -6.1, 0.05, 0.06, 1.6, '#4a2c16', { seg: 6 });
    c.sign(0, -6.5, '☠ JUMP! ☠', { y: DECK + 0.6, ry: 0, w: 1.9, hh: 0.5, h: 1.0, tex: { bg: '#111', fg: '#fff', border: '#ff3b3b', font: '900 46px "Trebuchet MS", sans-serif' } });

    // ---------------------------------------------------------------- treasure island
    const IX = 3.4, IZ0 = -10.0, IZ1 = -17.6;
    c.rect(0, (IZ0 + IZ1) / 2, IX * 2, IZ0 - IZ1, DECK, 'wood', { color: '#ead59a', pattern: 'dots' });
    c.skirt([[-IX, IZ0], [-IX, IZ1], [IX, IZ1], [IX, IZ0], [-IX, IZ0]].map(([x, z]) => [x, z, DECK]), 0.9, '#b8a070');
    c.wall([[-IX, IZ1], [IX, IZ1]], wallO);
    c.wall([[IX, IZ1], [IX, IZ0]], wallO);
    c.wall([[-IX, IZ0], [-IX, -13.0]], wallO);
    c.wall([[-IX, -15.6], [-IX, IZ1]], wallO);
    c.hidden([[-IX, IZ0], [IX, IZ0]], -0.8, DECK + 0.02);
    c.setCup(1.5, -15.3);
    // rocky base under the island
    c.b.cyl(0, -1.2, (IZ0 + IZ1) / 2, IX * 1.0, IX * 1.25, 1.6, '#8c7a66', { seg: 10 });

    // ---------------------------------------------------------------- boardwalk
    const bw = c.strip([[-2.4, -1.9], [-5.0, -1.9], [-6.6, -4.4], [-6.6, -10], [-5.4, -13.6], [-3.0, -14.4]], 2.0, 'wood', { y: DECK, cell: 0.6, color: wood });
    c.wall(bw.left, { ...wallO, h: 0.45 });
    c.wall(bw.right, { ...wallO, h: 0.45 });
    c.skirt(bw.left.map((p) => [p[0], p[1], DECK]), 0.7, '#6b4022');
    c.skirt(bw.right.map((p) => [p[0], p[1], DECK]), 0.7, '#6b4022');
    for (let i = 0; i < bw.left.length; i += 4) {
      const p = bw.left[i];
      c.b.cyl(p[0], -1.0, p[1], 0.11, 0.13, 1.35, '#5a3a20', { seg: 6 });
      const q = bw.right[i];
      c.b.cyl(q[0], -1.0, q[1], 0.11, 0.13, 1.35, '#5a3a20', { seg: 6 });
    }
    // gallows + swinging anchor
    const gx0 = PEND.x - 1.55, gx1 = PEND.x + 1.55;
    c.b.cyl(gx0, DECK - 0.3, PEND.z, 0.13, 0.16, 3.6, '#4a2c16', { seg: 7 });
    c.b.cyl(gx1, DECK - 0.3, PEND.z, 0.13, 0.16, 3.6, '#4a2c16', { seg: 7 });
    c.b.box(PEND.x, PEND.y + 0.05, PEND.z, 3.5, 0.24, 0.24, '#5a3a20');
    c.b.boxc(gx0 + 0.45, PEND.y - 0.3, PEND.z, 0.12, 0.9, 0.12, '#4a2c16', { rz: -0.7 });
    c.b.boxc(gx1 - 0.45, PEND.y - 0.3, PEND.z, 0.12, 0.9, 0.12, '#4a2c16', { rz: 0.7 });
    const pend = c.make((pb) => {
      pb.cyl(0, -PEND.L + 0.3, 0, 0.035, 0.035, PEND.L - 0.3, '#8b7f6a', { seg: 5 });
      // anchor
      pb.tor(0, -PEND.L + 0.22, 0, 0.13, 0.035, '#222633', { seg: 12, rx: Math.PI / 2 });
      pb.cyl(0, -PEND.L - 0.28, 0, 0.055, 0.055, 0.55, '#222633', { seg: 6 });
      pb.boxc(0, -PEND.L - 0.02, 0, 0.7, 0.08, 0.08, '#222633');
      pb.tris([[-0.42, -PEND.L - 0.38, 0], [-0.55, -PEND.L - 0.02, 0.05], [-0.25, -PEND.L - 0.32, 0.05]], '#222633');
      pb.sph(-0.4, -PEND.L - 0.34, 0, 0.09, '#222633', { seg: 6 });
      pb.sph(0.4, -PEND.L - 0.34, 0, 0.09, '#222633', { seg: 6 });
      pb.cone(0, -PEND.L - 0.7, 0, 0.14, 0.25, '#222633', { seg: 4, rx: Math.PI });
      pb.sph(0, -PEND.L - 0.14, 0, 0.36, '#3a4055', { seg: 10 });
    });
    pend.position.set(PEND.x, PEND.y, PEND.z);
    c.add(pend);
    const pk = c.kin((t) => {
      const th = PEND.amp * Math.sin((TAU * t) / PEND.period);
      pend.rotation.z = th;
      const bx = PEND.x + Math.sin(th) * (PEND.L + 0.14);
      const by = PEND.y - Math.cos(th) * (PEND.L + 0.14);
      pcap.ax = bx; pcap.ay = by; pcap.az = PEND.z;
      pcap.bx = bx; pcap.by = by + 0.3; pcap.bz = PEND.z;
    });
    const pcap = pk.cap(0.44, { e: 0.6, sound: 'metal' });
    let lastSide = 0;
    c.onFrame((t) => {
      const s = Math.sign(Math.sin((TAU * t) / PEND.period));
      lastSide = s;
    });

    // routes for the "walk to the hole" aim assist + fly-over
    c.setRoute([[0, DECK, 1.6], [0, DECK, -3.5], [0, DECK + 0.78, -6], [0, DECK, -11], [1.5, DECK, -15.3]]);
    c.routes = [c.route, [[0, DECK, 1.6], [-2.4, DECK, -1.9], [-5, DECK, -1.9], [-6.6, DECK, -4.4], [-6.6, DECK, -10], [-5.4, DECK, -13.6], [-2, DECK, -14.6], [1.5, DECK, -15.3]]];
    c.flyKeys = [
      { p: [-3, 4.5, 8], l: [0, 0.5, -3] },
      { p: [3.5, 3.2, 1], l: [0, 0.8, -6] },
      { p: [-3, 3.2, -3], l: [-6.6, 0.8, -8] },
      { p: [-9.5, 3.5, -9], l: [-6.6, 1.0, -9] },
      { p: [-7, 4.5, -16], l: [0, 0.5, -14] },
      { p: [4.5, 3.8, -8], l: [1.5, 0.5, -15.3] },
      { p: [0.5, 2.3, 5.5], l: [0, 0.5, -6] },
    ];
    c.flyDur = 6.5;

    // ---------------------------------------------------------------- scenery: props on the island
    P.palm(c, -2.4, -16.6, 1.15, { y: DECK, dir: 1.2, lean: 0.5 });
    P.palm(c, 2.7, -11.0, 1.0, { y: DECK, dir: -1.0, lean: 0.45 });
    P.palm(c, 2.8, -17.0, 0.9, { y: DECK, dir: -0.4, lean: 0.4 });
    // treasure chest beside the cup (glowing gold)
    const chest = c.make((cb) => {
      cb.box(0, 0, 0, 0.9, 0.42, 0.55, '#8a4f22');
      cb.cyl(0, 0.42, 0, 0.275, 0.275, 0.9, '#a35d28', { seg: 10, rz: Math.PI / 2, ry: 0 });
      cb.box(0, 0.12, 0.27, 0.9, 0.12, 0.03, '#ffcf3a');
      cb.box(0, 0.05, 0.28, 0.12, 0.2, 0.05, '#ffcf3a');
    });
    c.place(chest, 2.6, DECK, -16.5, -0.5);
    c.g.sph(2.75, DECK + 0.5, -16.2, 0.09, '#ffe27a', { seg: 6, tint: 2.4 });
    c.g.sph(2.4, DECK + 0.45, -16.3, 0.07, '#ffe27a', { seg: 6, tint: 2.4 });
    P.halo(c, 2.6, DECK + 0.6, -16.4, 1.6, '#ffd35a', 0.8);
    P.drifters(c, { count: 30, box: [1.9, 3.3, DECK, DECK + 1.6, -17, -15.8], color: '#ffe27a', size: 0.14, mode: 'rise', speed: 0.5 });
    P.barrel(c, -2.6, -11, 1, { y: DECK });
    P.barrel(c, -2.9, -11.6, 0.8, { y: DECK, color: '#8a5a30' });
    P.crate(c, -2.6, 3.3, 1, 0.3, { y: DECK });
    P.crate(c, -2.0, 3.7, 0.7, 0.9, { y: DECK });
    P.barrel(c, 1.8, 3.6, 1, { y: DECK });
    // crabs
    for (let i = 0; i < 3; i++) crab(c, R.range(-2.4, 0.4), R.range(-16.6, -11.2), DECK, 0.8 + R() * 0.5);

    // ---------------------------------------------------------------- big skull rock behind the island
    const sk = c.b;
    sk.sph(0, -0.5, -23, 3.8, '#d8d2c0', { sy: 0.95, sz: 0.9, seg: 12 });
    sk.sph(-1.25, 1.2, -19.8, 1.05, '#161018', { seg: 8, sz: 0.5 });
    sk.sph(1.25, 1.2, -19.8, 1.05, '#161018', { seg: 8, sz: 0.5 });
    sk.cone(0, 0.0, -19.7, 0.34, 0.8, '#161018', { seg: 3, rx: -Math.PI / 2 + 0.2 });
    for (let i = -3; i <= 3; i++) sk.box(i * 0.42, -1.0, -19.6, 0.32, 0.7, 0.3, '#f2eedd');
    sk.sph(-3.2, -0.5, -21, 1.8, '#a89f8a', { seg: 8 });
    sk.sph(3.4, -0.6, -21.5, 1.6, '#a89f8a', { seg: 8 });
    c.g.sph(-1.25, 1.2, -20.1, 0.34, '#ff3b3b', { seg: 8, tint: 2.2 });
    c.g.sph(1.25, 1.2, -20.1, 0.34, '#ff3b3b', { seg: 8, tint: 2.2 });
    P.halo(c, -1.25, 1.2, -20.2, 1.8, '#ff3b3b', 1.0);
    P.halo(c, 1.25, 1.2, -20.2, 1.8, '#ff3b3b', 1.0);

    // ---------------------------------------------------------------- pirate ship
    buildShip(c, -17, -9, 0.6);
    buildShip(c, 21, -24, -0.4, 0.62);

    // little sandy islets with palms
    for (const [x, z, s] of [[12, 3, 1.4], [-14, 10, 1.1], [15, -8, 1.0], [-26, -22, 2.2], [8, -34, 2.0]]) {
      c.b.cyl(x, SEA - 0.3, z, 1.6 * s, 2.1 * s, 0.75, '#ecd79a', { seg: 12 });
      P.palm(c, x - 0.2 * s, z, 1.0 * s, { y: SEA + 0.4, dir: x * 0.1, lean: 0.4 });
      if (s > 1.3) P.palm(c, x + 0.9 * s, z + 0.4, 0.8 * s, { y: SEA + 0.4, dir: 2, lean: 0.4 });
      if (s > 1.3) P.rock(c, x + 1.6 * s, z - 0.3, 0.8, '#8c8a90', { y: SEA });
    }
    // sea rocks + shark fins + octopus + fish
    for (const [x, z, s] of [[-9, 4, 1.2], [8, -12, 1.0], [-10, -20, 1.5], [10, -22, 1.3], [-4, -25, 1.1]]) P.rock(c, x, z, s, '#7d7a8a', { y: SEA - 0.2 });
    shark(c, 4, -6, 3.2, 0.7);
    shark(c, -12, -14, 4.2, -0.5);
    tentacles(c, -4.6, -9.0);
    tentacles(c, 5.2, -14.0);
    P.jumpingFish(c, -3, -7, SEA, { period: 5.2, phase: 1, dist: 2.2 });
    P.jumpingFish(c, 3, -4, SEA, { period: 6.6, phase: 3.5, color: '#4dd0ff' });
    P.jumpingFish(c, -8, -16, SEA, { period: 7.5, phase: 5.5, color: '#ff6a9a' });
    // distant mountains & lighthouse
    P.hills(c, { cx: 0, cz: -14, rMin: 60, rMax: 90, colors: ['#4fae7a', '#3d9a6c', '#6fc48a'], seed: 12, count: 20, y: -1 });
    P.clouds(c, { count: 10, y: 27, spread: 90, seed: 4 });
    lighthouse(c, 38, -40);
    P.birdFlock(c, { cx: -6, cz: -12, y: 9, radius: 12, count: 6, color: '#f2f4ff', speed: 0.28 });
    P.birdFlock(c, { cx: 10, cz: -20, y: 13, radius: 14, count: 4, color: '#f2f4ff', speed: 0.2 });
    // floating barrels & buoys
    for (const [x, z] of [[3.6, -3], [-3.8, -6], [6.2, -8], [-8.6, -2]]) buoy(c, x, z, SEA);
    P.drifters(c, { count: 40, box: [-25, 25, 0.5, 7, -40, 10], color: '#ffffff', size: 0.12, mode: 'float', speed: 0.2, twinkle: 1 });
  },
};

// ------------------------------------------------------------------------------------------------
function buoy(c, x, z, sea) {
  const b = c.make((bb) => {
    bb.cyl(0, -0.1, 0, 0.16, 0.26, 0.5, '#ff4d4d', { seg: 8 });
    bb.cyl(0, 0.2, 0, 0.16, 0.16, 0.12, '#ffffff', { seg: 8 });
    bb.cone(0, 0.3, 0, 0.16, 0.25, '#ff4d4d', { seg: 8 });
    bb.sph(0, 0.6, 0, 0.05, '#ffe27a', { seg: 5 });
  });
  c.add(b);
  const ph = Math.random() * 6;
  c.onFrame((t) => {
    b.position.set(x + Math.sin(t * 0.3 + ph) * 0.3, sea + 0.04 + Math.sin(t * 1.7 + ph) * 0.06, z + Math.cos(t * 0.27 + ph) * 0.3);
    b.rotation.z = Math.sin(t * 1.3 + ph) * 0.12;
    b.rotation.x = Math.cos(t * 1.1 + ph) * 0.1;
  });
}

function crab(c, x, z, y, range) {
  const g = c.make((b) => {
    b.sph(0, 0.1, 0, 0.16, '#ff6a3d', { seg: 8, sz: 0.8, sy: 0.6 });
    b.sph(-0.18, 0.15, 0.1, 0.09, '#ff6a3d', { seg: 6 });
    b.sph(0.18, 0.15, 0.1, 0.09, '#ff6a3d', { seg: 6 });
    b.sph(-0.06, 0.2, 0.12, 0.04, '#fff', { seg: 5 });
    b.sph(0.06, 0.2, 0.12, 0.04, '#fff', { seg: 5 });
    b.sph(-0.06, 0.21, 0.15, 0.02, '#000', { seg: 4 });
    b.sph(0.06, 0.21, 0.15, 0.02, '#000', { seg: 4 });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.cyl(sx * 0.15, 0.02, -0.06 + i * 0.07, 0.008, 0.008, 0.12, '#ff6a3d', { seg: 3, rz: sx * 1.0 });
  }, { width: 0.6 });
  c.add(g);
  const ph = Math.random() * 20;
  c.onFrame((t) => {
    const u = Math.sin(t * 0.5 + ph);
    g.position.set(x + u * range, y, z);
    g.rotation.y = Math.PI / 2 * (Math.cos(t * 0.5 + ph) > 0 ? 1 : -1);
    g.position.y = y + Math.abs(Math.sin(t * 9 + ph)) * 0.015;
  });
}

function shark(c, cx, cz, r, dir) {
  const g = c.make((b) => {
    b.cone(0, -0.05, 0, 0.26, 0.85, '#6f7f95', { seg: 4, rz: 0.0, sz: 0.4 });
    b.tris([[0, 0, 0.1], [0, 0.6, -0.15], [0, 0, -0.3]], '#4f5f75');
  });
  const wake = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  wake.rotation.x = -Math.PI / 2;
  c.add(g);
  c.add(wake);
  const ph = Math.random() * 10;
  c.onFrame((t) => {
    const a = t * 0.45 * dir + ph;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    g.position.set(x, -0.2, z);
    g.rotation.y = -a + (dir > 0 ? Math.PI : 0);
    g.rotation.z = Math.sin(t * 3) * 0.05;
    wake.position.set(x, -0.17, z);
    wake.scale.setScalar(1 + 0.15 * Math.sin(t * 4));
  });
}

function tentacles(c, x, z) {
  for (let k = 0; k < 3; k++) {
    const segs = [];
    const root = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const s = c.make((b) => b.sph(0, 0, 0, 0.26 - i * 0.035, i % 2 ? '#c94d9a' : '#b03d8a', { seg: 8 }));
      s.userData.i = i;
      root.add(s);
      segs.push(s);
    }
    root.position.set(x + k * 0.7 - 0.7, -0.5, z + (k % 2) * 0.6);
    c.add(root);
    const ph = k * 2.1;
    c.onFrame((t) => {
      const rise = 0.75 + 0.35 * Math.sin(t * 0.7 + ph);
      for (let i = 0; i < segs.length; i++) {
        const u = i / (segs.length - 1);
        const bend = Math.sin(t * 1.6 + ph + i * 0.7) * 0.25 * u;
        segs[i].position.set(bend * (i + 1) * 0.5, i * 0.28 * rise + u * 0.3, Math.cos(t * 1.2 + ph + i * 0.6) * 0.1 * u);
      }
    });
  }
}

function lighthouse(c, x, z) {
  const b = c.b;
  b.cyl(x, -1, z, 2.2, 3.2, 1.4, '#8a8a95', { seg: 9 });
  b.cyl(x, 0.4, z, 1.0, 1.5, 6, '#fff5e4', { seg: 10 });
  for (let i = 0; i < 3; i++) b.cyl(x, 1.2 + i * 1.8, z, 1.35 - i * 0.16, 1.4 - i * 0.16, 0.7, '#e64545', { seg: 10 });
  b.cyl(x, 6.4, z, 1.35, 1.35, 0.2, '#333', { seg: 10 });
  b.cone(x, 7.8, z, 1.3, 1.1, '#e64545', { seg: 10 });
  c.g.cyl(x, 6.6, z, 0.7, 0.7, 1.2, '#ffe9a0', { seg: 10, tint: 2 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 2.2, 22, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -11, 0);
  beam.position.set(x, 7.2, z);
  c.add(beam);
  c.onFrame((t) => {
    beam.rotation.y = t * 0.8;
    beam.rotation.z = Math.PI / 2 - 0.1;
    beam.rotation.order = 'YZX';
  });
}

function buildShip(c, x, z, ry, scale = 1) {
  const ship = c.make((b) => {
    // hull
    b.box(-2.4, 0.0, -0.9, 4.8, 1.6, 1.8, '#7b4a26');
    b.tris([[2.4, 0, -0.9], [4.4, 1.6, 0], [2.4, 1.6, -0.9]], '#7b4a26');
    b.tris([[2.4, 0, 0.9], [2.4, 1.6, 0.9], [4.4, 1.6, 0]], '#7b4a26');
    b.tris([[2.4, 0, -0.9], [2.4, 0, 0.9], [4.4, 1.6, 0]], '#5a3418');
    b.tris([[2.4, 1.6, -0.9], [4.4, 1.6, 0], [2.4, 1.6, 0.9]], '#9a6234');
    b.box(-2.4, 1.6, -0.9, 4.8, 0.12, 1.8, '#9a6234');
    b.box(-2.4, 1.6, -0.95, 4.8, 0.5, 0.1, '#5a3418');
    b.box(-2.4, 1.6, 0.85, 4.8, 0.5, 0.1, '#5a3418');
    b.box(-3.2, 0.4, -0.8, 0.9, 1.9, 1.6, '#6a3e1e');
    b.box(-3.3, 2.3, -0.9, 1.1, 0.12, 1.8, '#9a6234');
    for (let i = 0; i < 4; i++) {
      b.box(-1.8 + i * 1.1, 0.7, 0.9, 0.3, 0.3, 0.05, '#222');
      b.box(-1.8 + i * 1.1, 0.7, -0.95, 0.3, 0.3, 0.05, '#222');
      b.cyl(-1.65 + i * 1.1, 0.75, 1.0, 0.09, 0.09, 0.5, '#333a48', { seg: 6, rx: Math.PI / 2 });
    }
    // masts
    b.cyl(0.2, 1.7, 0, 0.13, 0.16, 5.8, '#4a2c16', { seg: 6 });
    b.cyl(-1.9, 2.3, 0, 0.11, 0.13, 4.2, '#4a2c16', { seg: 6 });
    b.boxc(0.2, 6.3, 0, 0.1, 0.1, 3.2, '#4a2c16');
    b.boxc(0.2, 4.4, 0, 0.1, 0.1, 3.9, '#4a2c16');
    b.boxc(-1.9, 5.3, 0, 0.1, 0.1, 2.8, '#4a2c16');
    b.cyl(0.2, 7.5, 0, 0.36, 0.5, 0.35, '#4a2c16', { seg: 8 });
  });
  const sails = c.make((sb) => {
    sb.boxc(0.2, 5.4, 0, 0.06, 1.8, 3.0, '#f7f0dc');
    sb.boxc(0.2, 3.2, 0, 0.06, 2.4, 3.6, '#f7f0dc');
    sb.boxc(-1.9, 4.2, 0, 0.06, 1.8, 2.6, '#f7f0dc');
    sb.tris([[0.3, 3.2, -1.7], [0.3, 4.4, -0.7], [0.3, 2.2, 0.2]], '#111', { tint: 0.7 });
  }, { width: 0.7 });
  ship.add(sails);
  // pirate flag
  const tex = labelTexture('☠', { w: 128, h: 96, bg: '#0b0b10', fg: '#ffffff', border: '#0b0b10', font: '900 68px "Segoe UI Symbol", "Trebuchet MS", sans-serif' });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9, 8, 1), new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : 0x111111, side: THREE.DoubleSide }));
  flag.position.set(0.9, 7.55, 0);
  flag.rotation.y = Math.PI / 2;
  ship.add(flag);
  ship.scale.setScalar(scale);
  ship.position.set(x, -0.15, z);
  ship.rotation.y = ry;
  c.add(ship);
  const ph = Math.random() * 5;
  c.onFrame((t) => {
    ship.rotation.z = Math.sin(t * 0.7 + ph) * 0.04;
    ship.rotation.x = Math.sin(t * 0.5 + ph) * 0.025;
    ship.position.y = -0.15 + Math.sin(t * 0.9 + ph) * 0.09;
    sails.rotation.y = Math.sin(t * 0.6) * 0.015;
    flag.rotation.y = Math.PI / 2 + Math.sin(t * 3 + ph) * 0.25;
  });
}
