// Hole 9 – Cosmic Pinball: bumper arena, a boosted jump or a portal shortcut, a sweeping laser-bar, and a space elevator to the crater cup.
import * as THREE from 'three';
import * as P from '../props.js';
import { rng, TAU, smoothstep, lerp } from '../util.js';

const LIFT_T = 12;
const LIFT_Z = -33.3;
const TOP_Y = 3.0;
export function liftY(t) {
  const u = (t % LIFT_T) / LIFT_T;
  if (u < 0.22) return 0;
  if (u < 0.45) return TOP_Y * smoothstep(0.22, 0.45, u);
  if (u < 0.72) return TOP_Y;
  if (u < 0.95) return TOP_Y * (1 - smoothstep(0.72, 0.95, u));
  return 0;
}
const SPIN = { x: 0, z: -28.6, L: 1.75, w: 1.05 };

export default {
  id: 9,
  name: 'Cosmic Pinball',
  par: 5,
  solverPeriod: LIFT_T,
  hint: 'Bounce through the bumpers, hop the gap or dive into the portal, then ride the space elevator to the crater cup!',
  wallSound: 'metal',
  theme: {
    sky: { top: '#03040f', mid: '#140a3a', bottom: '#4a1a7a', sun: [0.3, 0.4, -0.85], sunColor: '#a8f0ff', clouds: 0.5, stars: 1.0, aurora: 0.0, cloudCol: '#ff8ae0', cloudShade: '#5a4aff' },
    fog: { color: '#1a1040', near: 60, far: 260 },
    hemi: { sky: '#9fb0ff', ground: '#ff7ad9', intensity: 1.95 },
    sun: { color: '#d8f2ff', intensity: 2.5, dir: [0.4, 0.8, 0.5] },
    water: { shallow: '#4dfff0', deep: '#3a2aff' },
    flagColor: '#4dfff0',
    bloom: 0.9,
    bloomThreshold: 0.95,
    vignette: 0.4,
    music: { root: 5, scale: 'whole', tempo: 126, wave: 'square', arp: 0.3 },
  },
  build(c) {
    const R = rng(99);
    c.sy = -40;
    const NEON = { color: '#28405e', top: '#4dfff0', h: 0.5, t: 0.22 };
    const FLOOR = '#7e8cb4';

    // ------------------------------------------------------------------ tee pad + launch lane
    c.disc(0, 8.2, 3.0, 0, 'metal', { color: '#5f6a94', seg: 24 });
    const lane = c.strip([[0, 5.6], [0, -0.2]], 2.0, 'metal', { color: FLOOR, cell: 3, across: 1 });
    c.setTee(0, 8.4, 0);
    // pad wall ring (open toward the lane)
    ring(c, 0, 8.2, 3.0, 0, [[-0.5, 0.5]], NEON, Math.PI / 2 + 0, true);
    c.wall(lane.left, NEON);
    c.wall(lane.right, NEON);
    c.boost(0, 3.4, 0, 8.5, { color: '#4dfff0' });

    // ------------------------------------------------------------------ pinball arena
    const AC = { x: 0, z: -6 }, AR = 6;
    c.disc(AC.x, AC.z, AR, 0, 'metal', { color: FLOOR, seg: 40 });
    // neon rings on the floor
    c.g.tor(0, 0.01, AC.z, 4.2, 0.03, '#ff7ad9', { seg: 40, tint: 1.6 });
    c.g.tor(0, 0.01, AC.z, 2.0, 0.03, '#4dfff0', { seg: 32, tint: 1.6 });
    arcWall(c, AC, AR, [[104, 203], [227, 313], [337, 436]], NEON);
    const bumpers = [[0, -3.3], [-2.5, -5.0], [2.5, -5.0], [-1.3, -8.0], [1.3, -8.0], [0, -10.4]];
    bumpers.forEach(([x, z], i) => c.bumper(x, z, 0.5, { color: i % 2 ? '#ff5cae' : '#5c8bff', top: '#ffe27a', kick: 3.7, h: 0.55 }));

    // ------------------------------------------------------------------ left lane: boosted jump
    const ll = c.strip([[-4.9, -9.6], [-5.2, -13], [-5.2, -19]], 2.0, 'metal', { color: FLOOR, cell: 0.8 });
    c.wall(ll.left, NEON);
    c.wall(ll.right, NEON);
    c.boost(-5.2, -18.4, 0, 10.2, { color: '#ffd23f' });
    const lr = c.ramp(-5.2, -19.0, 0, -5.2, -21.4, 0.78, 2.0, 'metal', { color: '#b0bcdc', cell: 5 });
    c.wall([[-6.2, -19], [-6.2, -21.4, 0.78]], { ...NEON, h: 0.45 });
    c.wall([[-4.2, -19], [-4.2, -21.4, 0.78]], { ...NEON, h: 0.45 });
    c.sign(-6.9, -19.6, 'JUMP →', { ry: 0.9, w: 1.2, hh: 0.45, h: 0.7, tex: { bg: '#3a2a00', fg: '#ffd23f', border: '#ffd23f', font: '900 44px "Trebuchet MS", sans-serif' } });

    // ------------------------------------------------------------------ right lane: portal shortcut
    const rl = c.strip([[4.9, -9.6], [5.2, -13], [5.2, -21.0]], 2.0, 'metal', { color: FLOOR, cell: 0.8 });
    c.wall(rl.left, NEON);
    c.wall(rl.right, NEON);
    c.wall([[4.2, -21.6], [6.2, -21.6]], NEON);

    // ------------------------------------------------------------------ hub platform
    const HZ0 = -25.4, HZ1 = -32.0;
    c.rect(0, (HZ0 + HZ1) / 2, 9, HZ0 - HZ1, 0, 'metal', { color: FLOOR });
    c.wall([[-4.5, HZ0], [-4.5, HZ1]], NEON);
    c.wall([[4.5, HZ0], [4.5, HZ1]], NEON);
    c.wall([[-4.5, HZ1], [-1.3, HZ1]], NEON);
    c.wall([[1.3, HZ1], [4.5, HZ1]], NEON);
    c.hidden([[-4.5, HZ0], [4.5, HZ0]], -1.5, 0.02);
    // laser sweeper
    const sweep = c.make((b) => {
      b.cyl(0, 0, 0, 0.32, 0.4, 0.5, '#28304a', { seg: 10 });
      b.boxc(0, 0.28, 0, SPIN.L * 2, 0.1, 0.12, '#ff3a7a', { tint: 1.0 });
      b.sph(SPIN.L, 0.28, 0, 0.18, '#ff3a7a', { seg: 8 });
      b.sph(-SPIN.L, 0.28, 0, 0.18, '#ff3a7a', { seg: 8 });
    });
    const swGlow = c.make((b) => {
      b.boxc(0, 0.28, 0, SPIN.L * 2, 0.06, 0.06, '#ffb0d0', { tint: 2.4 });
    }, { glow: true, outline: false });
    sweep.add(swGlow);
    c.place(sweep, SPIN.x, 0, SPIN.z);
    const sk = c.kin((t) => {
      const a = SPIN.w * t;
      sweep.rotation.y = a;
      sc.ax = SPIN.x - Math.cos(a) * SPIN.L; sc.az = SPIN.z + Math.sin(a) * SPIN.L; sc.ay = sc.by = 0.28;
      sc.bx = SPIN.x + Math.cos(a) * SPIN.L; sc.bz = SPIN.z - Math.sin(a) * SPIN.L;
    });
    const sc = sk.cap(0.16, { e: 0.7, sound: 'metal' });
    // portals: right lane end -> hub
    c.portalPair({ x: 5.2, z: -20.4, exit: 0 }, { x: 3.6, z: -26.7, exit: -0.62 }, { colorA: '#ff7ad9', colorB: '#4dfff0' });

    // ------------------------------------------------------------------ space elevator
    const lift = c.mover();
    c.rect(0, 0, 2.4, 2.6, 0, 'metal', { mover: lift, color: '#c9d2f0' });
    const lv = c.make((b) => {
      b.box(0, -0.6, 0, 2.5, 0.6, 2.7, '#3a4468');
      for (const sx of [-1, 1]) {
        b.box(sx * 1.22, 0, 0, 0.16, 0.42, 2.7, '#4dfff0', { tint: 0.9 });
        b.cyl(sx * 1.22, 0.4, -1.3, 0.1, 0.1, 0.5, '#28304a', { seg: 6 });
        b.cyl(sx * 1.22, 0.4, 1.3, 0.1, 0.1, 0.5, '#28304a', { seg: 6 });
      }
    });
    lift.group.add(lv);
    const lglow = c.make((b) => {
      b.tor(0, 0.012, 0, 0.7, 0.03, '#4dfff0', { seg: 24, tint: 2.2 });
    }, { glow: true, outline: false });
    lift.group.add(lglow);
    const lk = c.kin((t) => {
      lift.setPose(0, liftY(t), LIFT_Z, 0);
      const w = [0, 0, 0], w2 = [0, 0, 0];
      for (let i = 0; i < 2; i++) {
        const sx = i ? 1 : -1;
        lift.toWorld(sx * 1.22, 0.32, -1.25, w);
        lift.toWorld(sx * 1.22, 0.32, 1.25, w2);
        const cp = lrail[i];
        cp.ax = w[0]; cp.ay = w[1]; cp.az = w[2]; cp.bx = w2[0]; cp.by = w2[1]; cp.bz = w2[2];
      }
    }, [lift]);
    const lrail = [lk.cap(0.14, { e: 0.5 }), lk.cap(0.14, { e: 0.5 })];
    c.hidden([[-1.3, -34.62], [1.3, -34.62]], -2, TOP_Y - 0.03);
    c.navRects = [{ x0: -1.2, x1: 1.2, z0: -34.6, z1: -32.0, y: 0 }];
    c.navTele = [{ from: [0, LIFT_Z], to: [0, -35.6] }];
    // shaft pillars
    for (const sx of [-1, 1]) {
      c.b.cyl(sx * 1.6, -6, -32.3, 0.16, 0.2, 9, '#4a5478', { seg: 6 });
      c.b.cyl(sx * 1.6, -6, -34.3, 0.16, 0.2, 9, '#4a5478', { seg: 6 });
      c.g.box(sx * 1.6, 1.6 + 0.0, -33.3, 0.06, 5.0, 0.06, '#4dfff0', { tint: 1.7 });
    }

    // ------------------------------------------------------------------ crater cup platform
    c.rect(0, -35.4, 2.6, 1.9, TOP_Y, 'metal', { color: '#c9d2f0' });
    const dish = (x, z) => {
      const r = Math.hypot(x, z + 39.6);
      if (r >= 3.5) return 0;
      const cc = Math.cos((r / 3.5) * Math.PI * 0.5);
      return -0.4 * cc * cc;
    };
    c.disc(0, -39.6, 3.5, TOP_Y, 'metal', { color: '#a0acd4', hfn: dish, cell: 0.35, rings: 10, seg: 32 });
    c.setCup(0, -39.6);
    // ring wall with an opening toward the elevator
    arcWall(c, { x: 0, z: -39.6 }, 3.62, [[112, 428]], { ...NEON, h: 0.45 }, TOP_Y);
    c.wall([[-1.3, -35.05], [-1.3, -36.3]], { ...NEON, h: 0.45, y: TOP_Y });
    c.wall([[1.3, -35.05], [1.3, -36.3]], { ...NEON, h: 0.45, y: TOP_Y });
    c.skirt([[-1.3, -34.5], [-1.3, -36.3]].map(([x, z]) => [x, z, TOP_Y]), 1.2, '#28304a');
    c.g.tor(0, TOP_Y - 0.35, -39.6, 0.62, 0.03, '#ffd23f', { seg: 22, tint: 1.9 });

    c.setRoute([[0, 0, 8.4], [0, 0, 1], [0, 0, -5], [4.9, 0, -9.6], [5.2, 0, -15], [5.2, 0, -20.4], [3.6, 0, -27], [0, 0, -31], [0, 0, -33.3], [0, TOP_Y, -36], [0, TOP_Y - 0.4, -39.6]]);
    c.routes = [c.route, [[0, 0, 8.4], [0, 0, 1], [0, 0, -5], [-4.9, 0, -9.6], [-5.2, 0, -15], [-5.2, 0, -19], [-5.2, 0.8, -21.4], [-3, 0, -27], [0, 0, -31], [0, 0, -33.3], [0, TOP_Y, -36], [0, TOP_Y - 0.4, -39.6]]];
    c.flyKeys = [
      { p: [-8, 8, 16], l: [0, 0, 2] },
      { p: [9, 8, 2], l: [0, 0, -6] },
      { p: [-10, 6, -10], l: [-4, 0, -18] },
      { p: [9, 7, -18], l: [2, 0, -27] },
      { p: [-8, 8, -30], l: [0, 1, -34] },
      { p: [8, 9, -46], l: [0, 2.5, -38] },
      { p: [0, 3.2, 12.5], l: [0, 0.8, 0] },
    ];
    c.flyDur = 7.5;

    // ------------------------------------------------------------------ space scenery
    // floor glow grids
    const grid = c.make((b) => {
      for (let i = -1; i <= 1; i++) b.box(i * 4.5, -0.04, 6, 0.05, 0.01, 6, '#4dfff0', { tint: 1.4 });
    }, { glow: true, outline: false });
    c.add(grid);
    // underside of the station: dark hulls
    c.b.cyl(0, -3.2, 8.2, 3.2, 2.2, 3.1, '#3a4468', { seg: 20 });
    c.b.cyl(0, -3.6, -6, 6.4, 4.4, 3.5, '#3a4468', { seg: 32 });
    c.b.cyl(0, -3.3, -28.7, 4.9, 3.6, 3.2, '#3a4468', { seg: 12, ry: 0.2 });
    c.b.cyl(0, TOP_Y - 3.2, -39.6, 3.7, 2.6, 3.1, '#3a4468', { seg: 24 });
    // planets
    planet(c, -60, 30, -100, 26, '#ff9a5a', '#ffd9a0', true);
    planet(c, 70, 50, -140, 40, '#4a7aff', '#a8e0ff', false);
    planet(c, -30, -20, -60, 6, '#c8a0ff', '#ffffff', false);
    planet(c, 40, 8, -18, 3.2, '#7dffb0', '#eaffea', true);
    // asteroid field
    for (let i = 0; i < 26; i++) asteroid(c, R.range(-45, 45), R.range(-8, 22), R.range(-70, 10), R.range(0.5, 2.2), R() * 5);
    // satellite dish + antenna on the hub
    c.b.cyl(-4.9, 0, -30.5, 0.1, 0.14, 1.6, '#c9d2f0', { seg: 6 });
    c.b.sph(-4.9, 1.7, -30.5, 0.9, '#e8eeff', { seg: 12, sy: 0.35, sz: 0.9, rx: 0.5 });
    c.g.sph(-4.9, 1.9, -30.9, 0.1, '#ff5a7a', { seg: 6, tint: 2.4 });
    // aliens + UFO
    for (let i = 0; i < 5; i++) alien(c, [-4.3, 4.3, -3.6, 3.6, 0][i], 0, [-27, -26.5, -31, -30.5, 10.5][i], i);
    ufo(c, 9, 10, -12);
    ufo(c, -12, 14, -30);
    // twinkle dust
    P.drifters(c, { count: 300, box: [-35, 35, -12, 30, -70, 20], color: '#bfe6ff', size: 0.16, mode: 'float', speed: 0.15, twinkle: 1 });
    P.drifters(c, { count: 90, box: [-9, 9, 0.2, 6, -44, 12], color: '#ff9aef', size: 0.12, mode: 'rise', speed: 0.5, twinkle: 1 });
    // shooting star
    const comet = c.make((b) => {
      b.sph(0, 0, 0, 0.3, '#ffffff', { seg: 6, tint: 2.5 });
      b.cyl(0, 0, 0, 0.001, 0.25, 6, '#8ad0ff', { seg: 6, rx: Math.PI / 2, tint: 2 });
    }, { glow: true, outline: false });
    c.add(comet);
    c.onFrame((t) => {
      const u = (t % 9) / 9;
      comet.position.set(-50 + u * 110, 26 - u * 12, -60 - u * 20);
      comet.rotation.y = 0.6;
      comet.visible = u < 0.4;
    });
    c.sign(-2.2, 10.6, 'HOLE 9\nPAR 5', { ry: 0.4, w: 1.2, hh: 0.6, tex: { bg: '#0d1436', fg: '#4dfff0', border: '#4dfff0' } });
    c.sign(6.6, -18.6, 'PORTAL →', { ry: -0.9, w: 1.3, hh: 0.45, h: 0.7, tex: { bg: '#3a0a3a', fg: '#ff9aef', border: '#ff7ad9', font: '900 42px "Trebuchet MS", sans-serif' } });
  },
};

// ------------------------------------------------------------------------------------------------
/** wall along circular arcs (angles in degrees, φ from +x, z = cz + r sin φ) */
function arcWall(c, C, r, arcs, opts, y = 0) {
  for (const [a0, a1] of arcs) {
    const pts = [];
    const n = Math.max(3, Math.ceil((a1 - a0) / 6));
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      pts.push([C.x + Math.cos(a) * r, C.z + Math.sin(a) * r, y]);
    }
    c.wall(pts, { ...opts, simplify: false });
  }
}
function ring(c, cx, cz, r, y, gaps, opts, mid, open) {
  // ring wall around the tee pad with the opening (towards -z) left free
  const a0 = -60, a1 = 240; // degrees: leaves the arc around 270°… mirrored to +z side
  const pts = [];
  for (let a = 0; a <= 360; a += 10) {
    const rad = (a * Math.PI) / 180;
    const x = cx + Math.cos(rad) * r, z = cz + Math.sin(rad) * r;
    // the lane leaves at z < cz - r*0.8 (towards -z): skip a gap near φ = 270°
    if (a > 250 && a < 290) {
      if (pts.length > 1) c.wall(pts.splice(0), { ...opts, simplify: false });
      pts.length = 0;
      continue;
    }
    pts.push([x, z, y]);
  }
  if (pts.length > 1) c.wall(pts, { ...opts, simplify: false });
}
function planet(c, x, y, z, r, col, ringCol, hasRing) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, r, col, { seg: 22 });
    b.sph(0, r * 0.35, 0, r * 1.002, ringCol, { seg: 22, sy: 0.14, tint: 1.0 });
    b.sph(0, -r * 0.3, 0, r * 1.003, ringCol, { seg: 22, sy: 0.1, tint: 0.85 });
    if (hasRing) b.tor(0, 0, 0, r * 1.6, r * 0.06, ringCol, { seg: 40, rz: 0.35, tint: 1.1 });
  }, { width: 2.5, shadow: false, receive: false });
  g.position.set(x, y, z);
  c.add(g);
  c.onFrame((t) => (g.rotation.y = t * 0.03));
}
function asteroid(c, x, y, z, s, ph) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, s, '#7a7590', { seg: 6, sx: 1.2, sy: 0.9 });
    b.sph(s * 0.5, s * 0.2, 0, s * 0.5, '#918ba8', { seg: 5 });
  }, { shadow: false, receive: false });
  g.position.set(x, y, z);
  c.add(g);
  c.onFrame((t) => {
    g.rotation.x = t * 0.2 + ph;
    g.rotation.y = t * 0.15 + ph;
    g.position.y = y + Math.sin(t * 0.3 + ph) * 0.6;
  });
}
function alien(c, x, y, z, i) {
  const col = ['#7dffb0', '#ff9aef', '#ffe27a', '#8ad0ff', '#c8a0ff'][i % 5];
  const g = c.make((b) => {
    b.sph(0, 0.4, 0, 0.36, col, { seg: 10, sy: 1.1 });
    b.sph(-0.12, 0.55, 0.3, 0.1, '#ffffff', { seg: 6 });
    b.sph(0.12, 0.55, 0.3, 0.1, '#ffffff', { seg: 6 });
    b.sph(-0.12, 0.55, 0.38, 0.05, '#1c1233', { seg: 5 });
    b.sph(0.12, 0.55, 0.38, 0.05, '#1c1233', { seg: 5 });
    b.cyl(-0.12, 0.7, 0, 0.015, 0.015, 0.3, col, { seg: 4 });
    b.cyl(0.12, 0.7, 0, 0.015, 0.015, 0.3, col, { seg: 4 });
    b.sph(-0.12, 1.02, 0, 0.06, '#ff3a7a', { seg: 5 });
    b.sph(0.12, 1.02, 0, 0.06, '#ff3a7a', { seg: 5 });
  });
  c.add(g);
  const ph = i * 1.7;
  c.onFrame((t) => {
    const hop = Math.abs(Math.sin(t * 2.2 + ph));
    g.position.set(x, y + hop * 0.35, z);
    g.scale.set(1 + (1 - hop) * 0.08, 1 - (1 - hop) * 0.08, 1 + (1 - hop) * 0.08);
    g.rotation.y = Math.sin(t * 0.7 + ph) * 1.2;
  });
}
function ufo(c, x, y, z) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, 1.6, '#aeb8d8', { seg: 16, sy: 0.28 });
    b.sph(0, 0.35, 0, 0.8, '#8fe6ff', { seg: 12, sy: 0.9 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      b.sph(Math.cos(a) * 1.35, -0.05, Math.sin(a) * 1.35, 0.1, '#ffd23f', { seg: 5 });
    }
  });
  const gl = c.make((b) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      b.sph(Math.cos(a) * 1.35, -0.05, Math.sin(a) * 1.35, 0.12, '#ffe27a', { seg: 5, tint: 2.4 });
    }
  }, { glow: true, outline: false });
  g.add(gl);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, y + 2, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#9fffd0', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = -(y + 2) / 2;
  g.add(beam);
  c.add(g);
  const ph = Math.random() * 10;
  c.onFrame((t) => {
    g.position.set(x + Math.sin(t * 0.4 + ph) * 2.5, y + Math.sin(t * 0.9 + ph) * 0.5, z + Math.cos(t * 0.3 + ph) * 2.0);
    g.rotation.y = t * 0.6;
    g.rotation.z = Math.sin(t * 0.7 + ph) * 0.06;
    beam.material.opacity = 0.12 + 0.05 * Math.sin(t * 3 + ph);
  });
}
