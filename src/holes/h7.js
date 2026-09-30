// Hole 7 – Gear Works: spinning gear-bars, a cross-flow conveyor over a toxic goo pit, crushing pistons, and a delivery belt to the cup.
import * as THREE from 'three';
import * as P from '../props.js';
import { rng, TAU, smoothstep, lerp } from '../util.js';

const HALF = 1.8;
const PISTONS = [{ z: -17.5, side: -1, phase: 0.0 }, { z: -20.6, side: 1, phase: 0.33 }, { z: -23.7, side: -1, phase: 0.66 }];
const PIST_T = 4.2;
const PIST_LEN = 2.45;
const SPIN = [{ z: -1.4, w: 1.25, L: 1.36 }, { z: -4.6, w: -1.0, L: 1.36 }];

function pistonExt(t, phase) {
  const u = (t / PIST_T + phase) % 1;
  if (u < 0.12) return smoothstep(0, 0.12, u);
  if (u < 0.58) return 1;
  if (u < 0.72) return 1 - smoothstep(0.58, 0.72, u);
  return 0;
}

export default {
  id: 7,
  name: 'Gear Works',
  par: 4,
  solverPeriod: PIST_T,
  hint: 'Time the spinning gear-bars, beat the cross-belt, and squeeze past the pistons. The last belt delivers you to the cup!',
  wallSound: 'metal',
  theme: {
    sky: { top: '#2a2040', mid: '#a04a3a', bottom: '#ffb46a', sun: [-0.4, 0.25, -0.8], sunColor: '#ffb070', clouds: 0.8, cloudCol: '#8a6a6a', cloudShade: '#4a3a4a' },
    fog: { color: '#d08a62', near: 35, far: 140 },
    hemi: { sky: '#ffd0a0', ground: '#6a6a88', intensity: 1.6 },
    sun: { color: '#ffc890', intensity: 2.5, dir: [-0.5, 0.65, 0.5] },
    water: { shallow: '#a8ff4d', deep: '#2a9a2a', foam: '#eaff9a', sky: '#d8ff9a', amp: 0.03, scale: 0.8 },
    flagColor: '#ffd23f',
    music: { root: 0, scale: 'minor', tempo: 112, wave: 'square', arp: 0.35 },
  },
  build(c) {
    const R = rng(77);
    c.sy = -0.1;
    const CAUTION = { color: '#f4c21e', top: '#26262e', h: 0.55, t: 0.24 };
    const METAL = '#8f9bb5';

    // ------------------------------------------------------------------ floor
    c.rect(0, 6.2, 3.6, 4, 0, 'metal', { color: '#6f7a94' }); // tee plate  z 8.2 .. 4.2
    c.rect(0, -2.425, 3.6, 13.25, 0, 'metal', { color: METAL }); // z 4.2 .. -9.05
    c.rect(0, -19.075, 3.6, 12.05, 0, 'metal', { color: METAL }); // z -13.05 .. -25.1
    c.rect(0, -25.75, 3.6, 1.3, 0, 'metal', { color: '#7f8ba6' }); // z -25.1 .. -26.4
    c.rect(0, -31.8, 3.6, 1.6, 0, 'metal', { color: '#6f7a94' }); // z -31.0 .. -32.6
    // chunky base under the track
    c.b.box(0, -0.6, -0.4, 3.9, 0.6, 17.3, '#4a5068');
    c.b.box(0, -0.6, -19.0, 3.9, 0.6, 13.2, '#4a5068');
    c.b.box(0, -0.6, -11.05, 3.9, 0.6, 4.4, '#3a3f52');
    const belt1 = c.conveyor(0, -11.05, 4.0, 3.6, 0, Math.PI / 2, 3.4, { color: '#ff9a3c' });
    const belt2 = c.conveyor(0, -28.7, 3.6, 4.6, 0, 0, 2.2, { color: '#3cd0ff' });
    c.setTee(0, 6.6, 0);
    c.setCup(0, -30.9);

    // slime pit beside the cross-belt
    c.rect(4.6, -11.05, 5.6, 4.6, -0.9, 'water');
    for (const [x, z, w, d] of [[4.6, -13.4, 5.8, 0.3], [4.6, -8.7, 5.8, 0.3], [7.5, -11.05, 0.3, 4.6]]) c.b.box(x, -1.3, z, w, 1.4, d, '#4a4a58');
    P.drifters(c, { count: 30, box: [2, 6.4, -0.9, 0.9, -13, -9], color: '#c8ff5a', size: 0.22, mode: 'rise', speed: 0.6, twinkle: 0 });

    // ------------------------------------------------------------------ walls
    c.wall([[-HALF, 8.2], [-HALF, -32.6]], CAUTION);
    c.wall([[HALF, 8.2], [HALF, -9.05]], CAUTION);
    c.wall([[HALF, -13.05], [HALF, -32.6]], CAUTION);
    c.wall([[-HALF, 8.2], [HALF, 8.2]], CAUTION);
    c.wall([[-HALF, -32.6], [HALF, -32.6]], CAUTION);
    // hazard stripes on the tee plate + boost pad + warning marks
    for (let i = 0; i < 8; i++) c.g.box(-HALF + 0.11 + 0.45 * i, 0.003, 4.4, 0.22, 0.01, 0.16, i % 2 ? '#ffb020' : '#222', { tint: 1.1 });
    c.boost(0, -7.2, 0, 8.4, { color: '#4dffb0' });

    // ------------------------------------------------------------------ spinners (real colliders)
    SPIN.forEach((sp, i) => {
      const g = c.make((b) => {
        b.cyl(0, 0, 0, 0.3, 0.36, 0.5, '#3a3f52', { seg: 10 });
        b.cyl(0, 0.5, 0, 0.14, 0.14, 0.14, '#ffd23f', { seg: 8 });
        for (let k = 0; k < 2; k++) {
          const ry = (k * Math.PI) / 2;
          b.boxc(0, 0.28, 0, sp.L * 2, 0.26, 0.24, k ? '#ff7a2a' : '#f4c21e', { ry });
          for (const sgn of [-1, 1]) {
            const ex = Math.cos(ry) * sp.L * sgn, ez = -Math.sin(ry) * sp.L * sgn;
            b.sph(ex, 0.28, ez, 0.2, '#3a3f52', { seg: 8 });
            b.cyl(ex, 0.4, ez, 0.06, 0.06, 0.26, '#ffd23f', { seg: 6 });
          }
        }
      });
      c.place(g, 0, 0, sp.z);
      sp.group = g;
      sp.caps = [];
    });
    const sk = c.kin((t) => {
      SPIN.forEach((sp) => {
        const a = sp.w * t;
        sp.group.rotation.y = a;
        for (let k = 0; k < 2; k++) {
          const ang = a + (k * Math.PI) / 2;
          const dx = Math.cos(ang) * sp.L, dz = -Math.sin(ang) * sp.L;
          const cp = sp.caps[k];
          cp.ax = -dx; cp.az = sp.z - dz; cp.ay = cp.by = 0.28;
          cp.bx = dx; cp.bz = sp.z + dz;
        }
      });
    });
    SPIN.forEach((sp) => {
      for (let k = 0; k < 2; k++) sp.caps.push(sk.cap(0.17, { e: 0.6, sound: 'metal' }));
    });

    // ------------------------------------------------------------------ pistons
    const pist = PISTONS.map((p) => {
      const rod = c.make((b) => {
        b.cylc(0, 0.42, 0, 0.42, 0.42, 1, '#c9d2e6', { seg: 12, rz: Math.PI / 2 });
        b.cylc(0, 0.42, 0, 0.3, 0.3, 1.02, '#6a7590', { seg: 10, rz: Math.PI / 2 });
      });
      c.add(rod);
      // housing outside the wall
      const hx = p.side * (HALF + 0.9);
      c.b.box(hx, 0, p.z, 1.6, 1.4, 1.5, '#4a5068');
      c.b.box(hx, 1.4, p.z, 1.7, 0.16, 1.6, '#ffd23f');
      c.g.sph(hx, 1.7, p.z, 0.16, '#ff4a3a', { seg: 8, tint: 2 });
      return { ...p, rod };
    });
    const pk = c.kin((t) => {
      pist.forEach((p, i) => {
        const e = pistonExt(t, p.phase) * PIST_LEN;
        const x0 = p.side * (HALF + 0.05);
        const tip = x0 - p.side * e;
        p.rod.position.set((x0 + p.side * 0.45 + tip) / 2 + 0.0, 0, p.z);
        p.rod.scale.set(Math.max(0.01, Math.abs(x0 + p.side * 0.45 - tip)), 1, 1);
        const cp = pcaps[i];
        cp.ax = x0 + p.side * 0.4; cp.bx = tip; cp.ay = cp.by = 0.42; cp.az = cp.bz = p.z;
      });
    });
    const pcaps = pist.map(() => pk.cap(0.42, { e: 0.55, sound: 'metal' }));
    // piston sound
    let lastPh = PISTONS.map(() => 0);
    c.onFrame((t, dt, ctx) => {
      PISTONS.forEach((p, i) => {
        const e = pistonExt(t, p.phase);
        if (e > 0.98 && lastPh[i] < 0.98 && ctx && ctx.sound && ctx.camera && Math.abs(ctx.camera.position.z - p.z) < 14) ctx.sound.piston();
        lastPh[i] = e;
      });
    });

    // ------------------------------------------------------------------ route / fly-over
    c.setRoute([[0, 0, 6.6], [0, 0, 2], [0, 0, -7], [0, 0, -13.5], [0, 0, -25], [0, 0, -30.9]]);
    c.flyKeys = [
      { p: [-7, 6, 12], l: [0, 0.5, 0] },
      { p: [6, 5, -1], l: [0, 0.3, -8] },
      { p: [-6, 5.5, -10], l: [2, 0, -12] },
      { p: [7, 4.5, -18], l: [0, 0.6, -21] },
      { p: [-4, 4, -26], l: [0, 0.3, -31] },
      { p: [0, 2.6, 11], l: [0, 0.8, -3] },
    ];
    c.flyDur = 7;

    // ------------------------------------------------------------------ factory scenery
    P.scenery(c, { y: -0.6, color: '#5b5a72', r: 120, cx: 0, cz: -12 });
    // floor of the factory hall: big plates
    for (let i = -4; i <= 4; i++) for (let j = -5; j <= 3; j++) c.d.box(i * 8, -0.59, j * 8 - 12, 7.6, 0.02, 7.6, (i + j) % 2 ? '#65647e' : '#5a5972');
    // back-drop industrial skyline
    const sky = c.make((b) => {
      b.vary = 0.08;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU + 0.2;
        const rr = 36 + R() * 26;
        const h = 8 + R() * 22;
        const x = Math.cos(a) * rr * 1.25, z = -12 + Math.sin(a) * rr;
        b.box(x, -0.6, z, 3 + R() * 6, h, 3 + R() * 6, i % 3 ? '#5a4a66' : '#6a4a58', { ry: R() * 3 });
        if (i % 4 === 0) {
          b.cyl(x + 3, -0.6, z, 1.1, 1.5, h + 8, '#7a5a64', { seg: 10 });
          b.cyl(x + 3, h + 7.5, z, 1.25, 1.25, 0.6, '#c9403a', { seg: 10 });
        }
      }
    }, { width: 1.6, shadow: false });
    c.add(sky);
    P.drifters(c, { count: 140, box: [-30, 30, 8, 34, -60, -20], color: '#6a5560', size: 3.2, mode: 'rise', speed: 0.7, additive: false, twinkle: 0 });
    P.clouds(c, { count: 8, y: 30, spread: 90, seed: 9, color: '#a88a8a', shade: '#6a5060' });
    // big rotating decor gears on both sides
    const gears = [];
    const mkGear = (x, y, z, r, teeth, dir, col, axis) => {
      const g = c.make((b) => {
        b.cyl(0, -0.15, 0, r, r, 0.3, col, { seg: 22, rx: Math.PI / 2 });
        b.cyl(0, -0.2, 0, r * 0.35, r * 0.35, 0.44, '#3a3f52', { seg: 12, rx: Math.PI / 2 });
        for (let i = 0; i < teeth; i++) {
          const a = (i / teeth) * TAU;
          b.boxc(Math.cos(a) * (r + 0.13), Math.sin(a) * (r + 0.13), 0, 0.28, 0.36, 0.3, col, { rz: a });
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          b.sph(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 0.16, r * 0.14, '#1c1233', { seg: 8, sz: 0.2 });
        }
      });
      g.position.set(x, y, z);
      if (axis === 'x') g.rotation.y = Math.PI / 2;
      c.add(g);
      gears.push({ g, dir, axis, base: g.rotation.y });
    };
    mkGear(-4.6, 2.6, -2, 2.0, 12, 1, '#c9d2e6', 'x');
    mkGear(-4.2, 2.6, -5.3, 1.3, 8, -1, '#f4c21e', 'x');
    mkGear(-4.9, 3.4, -13, 2.6, 14, -1, '#ff9a3c', 'x');
    mkGear(5.0, 2.8, -6, 2.4, 14, 1, '#f4c21e', 'x');
    mkGear(4.8, 4.6, -21, 2.0, 10, -1, '#c9d2e6', 'x');
    mkGear(-5.2, 3.0, -25, 2.2, 12, 1, '#6ad0ff', 'x');
    mkGear(0, 6.6, -16, 3.2, 16, 1, '#c9d2e6', 'z');
    c.onFrame((t) => {
      gears.forEach((o) => {
        if (o.axis === 'x') o.g.rotation.x = 0;
        // rotate around local z of the (possibly y-rotated) gear
        o.g.rotation.z = t * 0.5 * o.dir;
      });
    });
    // steam vents + robots + crane
    for (const [x, z] of [[-3.4, -9], [3.4, -15.5], [-3.4, -27], [3.4, 1.5]]) {
      c.b.cyl(x, -0.6, z, 0.28, 0.36, 0.9, '#5a5f78', { seg: 8 });
      P.drifters(c, { count: 24, box: [x - 0.3, x + 0.3, 0.3, 4.2, z - 0.3, z + 0.3], color: '#ffffff', size: 0.9, mode: 'rise', speed: 0.9, additive: false, twinkle: 0 });
    }
    for (let i = 0; i < 4; i++) robot(c, i % 2 ? 3.7 : -3.7, i < 2 ? 4.5 - i * 5 : -30 + (i - 2) * 6, i % 2 ? -1.2 : 1.2);
    crane(c, 0, 9.4, -16, 16);
    // overhead beacons
    [[-1.8, -10], [1.8, -14.5], [-1.8, -18], [1.8, -22]].forEach(([x, z], i) => {
      c.b.cyl(x * 1.4, 0, z, 0.06, 0.08, 1.2, '#3a3f52', { seg: 6 });
      c.g.sph(x * 1.4, 1.3, z, 0.15, '#ff3a2a', { seg: 8, tint: 2.5 });
      P.halo(c, x * 1.4, 1.3, z, 1.2, '#ff5a3a', 0.8);
    });
    // pipes along the back
    c.b.cyl(-6.6, 0.6, -20, 0.35, 0.35, 34, '#7a8098', { seg: 10, rx: Math.PI / 2 });
    c.b.cyl(6.6, 1.2, -14, 0.5, 0.5, 40, '#8a7a5a', { seg: 10, rx: Math.PI / 2 });
    P.drifters(c, { count: 40, box: [-2, 2, 0.2, 1.4, -32, 8], color: '#ffd27a', size: 0.09, mode: 'float', speed: 0.6, twinkle: 1 });
    c.sign(-2.2, 7.6, 'HOLE 7\nPAR 4', { ry: 0.35, w: 1.2, hh: 0.6 });
    c.sign(2.4, -8.4, 'SLIME PIT!', { ry: -0.6, w: 1.3, hh: 0.5, tex: { bg: '#123a12', fg: '#c8ff5a', border: '#5aff5a', font: '900 44px "Trebuchet MS", sans-serif' } });
  },
};

function robot(c, x, z, ry) {
  const g = c.make((b) => {
    b.box(0, 0, 0, 0.9, 0.5, 0.9, '#5a6078');
    b.box(0, 0.5, 0, 0.7, 0.8, 0.6, '#c9d2e6');
    b.box(0, 1.3, 0, 0.6, 0.45, 0.5, '#f4c21e');
    b.sph(-0.13, 1.5, 0.27, 0.07, '#3cffe0', { seg: 6 });
    b.sph(0.13, 1.5, 0.27, 0.07, '#3cffe0', { seg: 6 });
    b.cyl(0, 1.75, 0, 0.02, 0.02, 0.35, '#888', { seg: 4 });
    b.sph(0, 2.15, 0, 0.07, '#ff3a3a', { seg: 5 });
  });
  const arm = c.make((b) => {
    b.cyl(0, -0.55, 0, 0.09, 0.09, 0.6, '#8a93ac', { seg: 6 });
    b.sph(0, -0.62, 0, 0.14, '#ffd23f', { seg: 6 });
  });
  arm.position.set(0.5, 1.0, 0);
  g.add(arm);
  const arm2 = arm.clone();
  arm2.position.set(-0.5, 1.0, 0);
  g.add(arm2);
  c.place(g, x, -0.05, z, ry * 1.3);
  const ph = Math.random() * 6;
  c.onFrame((t) => {
    arm.rotation.z = Math.sin(t * 2.4 + ph) * 0.9 - 0.4;
    arm2.rotation.z = -Math.sin(t * 2.4 + ph + 2) * 0.5 + 0.4;
    g.position.y = -0.05 + Math.abs(Math.sin(t * 2.4 + ph)) * 0.03;
  });
}

function crane(c, x, y, z, span) {
  c.b.box(x, y, z - span / 2 - 0.3, 0.5, 0.35, span + 0.6, '#f4c21e');
  c.b.box(x - 6, -0.6, z - span / 2, 0.5, y + 0.6, 0.5, '#4a5068');
  c.b.box(x + 6, -0.6, z - span / 2, 0.5, y + 0.6, 0.5, '#4a5068');
  c.b.box(x, y, z + 0.1, 12.5, 0.4, 0.5, '#f4c21e');
  const carriage = c.make((b) => {
    b.box(0, -0.3, 0, 0.9, 0.4, 0.9, '#3a3f52');
    b.cyl(0, -2.3, 0, 0.02, 0.02, 2.0, '#222', { seg: 4 });
    b.box(0, -3.1, 0, 1.0, 0.8, 1.0, '#b8803c');
    b.box(0, -3.1, 0, 1.06, 0.1, 1.06, '#7a5228');
  });
  carriage.position.set(x, y, z);
  c.add(carriage);
  c.onFrame((t) => {
    carriage.position.x = x + Math.sin(t * 0.35) * 5.2;
    carriage.children[2] && (carriage.children[2].rotation.z = Math.sin(t * 0.9) * 0.05);
  });
}
