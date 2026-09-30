// Reusable scenery props, ambient life and critters. Everything is built from code (no assets).
import * as THREE from 'three';
import { Batch, gradientMap, col, U } from './render/toon.js';
import { makeGrassMaterial, makeTuftGeometry, makeGlowSpriteMaterial } from './render/shaders.js';
import { rng, TAU, lerp, clamp } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// scenery ground / backdrop
// ---------------------------------------------------------------------------------------------
export function scenery(c, { y = -0.06, color = '#6ccf5a', r = 150, cx = 0, cz = 0, seg = 48 } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
  m.userData.own = true;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, seg), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, y, cz);
  mesh.receiveShadow = true;
  c.root.add(mesh);
  c.sy = y;
  return mesh;
}

/** Ring of big rounded hills / mountains around the play area (pure backdrop). */
export function hills(c, { cx = 0, cz = 0, rMin = 38, rMax = 70, count = 26, colors = ['#4fae55', '#3d9a4c'], hMin = 4, hMax = 14, wMin = 8, wMax = 20, seed = 7, y = -0.5, shape = 'dome', snow = null } = {}) {
  const r = rng(seed);
  const b = new Batch({ outline: true, width: 1.8, shadow: false, receive: false, name: 'hills' });
  b.vary = 0.05;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + r.range(-0.1, 0.1);
    const d = r.range(rMin, rMax);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const w = r.range(wMin, wMax), h = r.range(hMin, hMax);
    const colr = r.pick(colors);
    if (shape === 'peak') {
      b.cone(x, y, z, w * 0.7, h, colr, { seg: 7, ry: r() * 3 });
      if (snow) b.cone(x, y + h * 0.66, z, w * 0.7 * 0.34, h * 0.34, snow, { seg: 7 });
    } else {
      b.sph(x, y, z, w, colr, { sy: h / w, seg: 12 });
    }
  }
  c.root.add(b.build());
}

export function clouds(c, { count = 10, y = 26, spread = 90, seed = 3, color = '#ffffff', shade = '#dbe8ff' } = {}) {
  const r = rng(seed);
  const grp = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const cl = c.make((b) => {
      const n = r.int(3, 5);
      for (let k = 0; k < n; k++) b.sph((k - n / 2) * 2.2 + r.range(-0.4, 0.4), r.range(0, 0.8), r.range(-0.6, 0.6), r.range(1.6, 2.8), k % 2 ? color : shade, { seg: 10, tint: 1.15 });
    }, { outline: true, width: 1.5, shadow: false, receive: false });
    cl.position.set(r.range(-spread, spread), y + r.range(-5, 8), r.range(-spread, spread) - 20);
    cl.scale.setScalar(r.range(1.4, 2.6));
    cl.userData.spd = r.range(0.25, 0.7);
    grp.add(cl);
  }
  c.root.add(grp);
  c.onFrame((t, dt) => {
    for (const cl of grp.children) {
      cl.position.x += cl.userData.spd * dt;
      if (cl.position.x > spread + 20) cl.position.x = -spread - 20;
    }
  });
}

// ---------------------------------------------------------------------------------------------
// plants
// ---------------------------------------------------------------------------------------------
export function tree(c, x, z, s = 1, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  const trunk = o.trunk || '#8a5a34';
  const crown = o.crown || '#3fbf52';
  b.cyl(x, y, z, 0.13 * s, 0.2 * s, 1.5 * s, trunk, { seg: 8 });
  b.sph(x, y + 2.05 * s, z, 1.0 * s, crown, { seg: 10, sway: 0.7 });
  b.sph(x + 0.45 * s, y + 1.75 * s, z + 0.2 * s, 0.7 * s, o.crown2 || crown, { seg: 9, sway: 0.9, tint: 1.08 });
  b.sph(x - 0.4 * s, y + 1.85 * s, z - 0.25 * s, 0.68 * s, o.crown2 || crown, { seg: 9, sway: 0.9, tint: 0.94 });
  b.sph(x + 0.05 * s, y + 2.65 * s, z - 0.05 * s, 0.6 * s, crown, { seg: 9, sway: 1.1, tint: 1.14 });
}

export function pine(c, x, z, s = 1, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  b.cyl(x, y, z, 0.11 * s, 0.17 * s, 0.9 * s, o.trunk || '#6b4426', { seg: 7 });
  const col1 = o.crown || '#2f9a5e';
  for (let i = 0; i < 4; i++) {
    const r = (1.15 - i * 0.24) * s;
    b.cone(x, y + (0.7 + i * 0.62) * s, z, r, 1.0 * s, col1, { seg: 9, sway: 0.5 + i * 0.25, tint: 1 + i * 0.05 });
    if (o.snow) b.cone(x, y + (0.7 + i * 0.62) * s + 0.32 * s, z, r * 0.72, 0.7 * s, o.snow, { seg: 9, sway: 0.5 + i * 0.25 });
  }
}

export function palm(c, x, z, s = 1, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  const lean = o.lean ?? 0.35;
  const dir = o.dir ?? 0;
  const segs = 6;
  let px = x, py = y, pz = z;
  for (let i = 0; i < segs; i++) {
    const h = 0.55 * s;
    const t = i / segs;
    const dx = Math.sin(dir) * lean * t * 0.6 * s, dz = -Math.cos(dir) * lean * t * 0.6 * s;
    b.cyl(px, py, pz, (0.1 - i * 0.008) * s, (0.13 - i * 0.008) * s, h, o.trunk || '#a8703c', { seg: 7, tint: i % 2 ? 0.9 : 1 });
    px += dx; pz += dz; py += h * 0.96;
  }
  const leaf = o.leaf || '#3fc45a';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const lx = px + Math.cos(a) * 0.55 * s, lz = pz + Math.sin(a) * 0.55 * s;
    b.boxc(lx, py + 0.06 * s, lz, 1.2 * s, 0.05 * s, 0.34 * s, leaf, { ry: -a, rz: -0.35, sway: 1.2, tint: 0.92 + (i % 2) * 0.16 });
  }
  b.sph(px, py, pz, 0.14 * s, '#7a4a20', { seg: 8 });
  b.sph(px + 0.13 * s, py - 0.1 * s, pz, 0.1 * s, '#6a3d18', { seg: 6 });
}

export function bush(c, x, z, s = 1, color = '#36ad4c', o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  b.sph(x, y + 0.28 * s, z, 0.5 * s, color, { seg: 9, sy: 0.75, sway: 0.5 });
  b.sph(x + 0.35 * s, y + 0.22 * s, z + 0.12 * s, 0.36 * s, color, { seg: 8, sy: 0.75, sway: 0.6, tint: 1.1 });
  if (o.berries) {
    for (let i = 0; i < 5; i++) b.sph(x + Math.cos(i * 1.7) * 0.4 * s, y + 0.3 * s + Math.sin(i * 2.3) * 0.15 * s, z + Math.sin(i * 1.7) * 0.4 * s, 0.05 * s, o.berries, { seg: 5 });
  }
}

export function rock(c, x, z, s = 1, color = '#8f93a8', o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  const r = rng(Math.floor(x * 31 + z * 17 + 5));
  b.sph(x, y + 0.25 * s, z, 0.5 * s, color, { seg: 7, sy: r.range(0.55, 0.85), sx: r.range(0.9, 1.3), ry: r() * 3 });
  if (s > 0.7) b.sph(x + 0.4 * s, y + 0.15 * s, z + 0.2 * s, 0.3 * s, color, { seg: 6, sy: 0.7, tint: 1.1 });
}

export function flowers(c, cx, cz, radius, n, { colors = ['#ff6fa5', '#ffd23f', '#ffffff', '#8f7bff'], y = c.sy ?? 0, seed = 1, batch = null, stem = '#3a9b46' } = {}) {
  const r = rng(seed);
  const b = batch || c.d;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * radius;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const h = r.range(0.22, 0.42);
    b.cyl(x, y, z, 0.012, 0.014, h, stem, { seg: 4, sway: 0.5 });
    const cc = r.pick(colors);
    b.sph(x, y + h, z, 0.075, cc, { seg: 6, sy: 0.7, sway: 0.7 });
    b.sph(x, y + h + 0.03, z, 0.035, '#ffb020', { seg: 5, sway: 0.7 });
  }
}

export function mushroom(c, x, z, s = 1, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  b.cyl(x, y, z, 0.07 * s, 0.09 * s, 0.32 * s, '#f5ecd6', { seg: 7 });
  b.sph(x, y + 0.34 * s, z, 0.24 * s, o.cap || '#ff4d4d', { seg: 9, sy: 0.6 });
  b.sph(x + 0.08 * s, y + 0.5 * s, z + 0.05 * s, 0.045 * s, '#fff', { seg: 5 });
  b.sph(x - 0.1 * s, y + 0.45 * s, z - 0.06 * s, 0.035 * s, '#fff', { seg: 5 });
}

export function fence(c, pts, { h = 0.55, color = '#f4f0e6', y = null, spacing = 0.7, rail = null } = {}) {
  const b = c.b;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], q = pts[i + 1];
    const L = Math.hypot(q[0] - a[0], q[1] - a[1]);
    const n = Math.max(1, Math.round(L / spacing));
    const yaw = Math.atan2(q[0] - a[0], q[1] - a[1]);
    const ya = y ?? c.sy ?? 0;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const x = lerp(a[0], q[0], u), z = lerp(a[1], q[1], u);
      b.box(x, ya, z, 0.11, h, 0.11, color, { ry: yaw });
      b.cone(x, ya + h, z, 0.085, 0.1, color, { seg: 4, ry: yaw });
    }
    b.boxc((a[0] + q[0]) / 2, ya + h * 0.72, (a[1] + q[1]) / 2, 0.05, 0.07, L, rail || color, { ry: yaw });
    b.boxc((a[0] + q[0]) / 2, ya + h * 0.36, (a[1] + q[1]) / 2, 0.05, 0.07, L, rail || color, { ry: yaw });
  }
}

export function hay(c, x, z, ry = 0, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  b.cylc(x, y + 0.34, z, 0.36, 0.36, 0.55, '#f0c94a', { seg: 14, rz: Math.PI / 2, ry });
  b.cylc(x, y + 0.34, z, 0.365, 0.365, 0.03, '#d9a92f', { seg: 14, rz: Math.PI / 2, ry, tint: 0.9 });
}

export function barrel(c, x, z, s = 1, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  b.cyl(x, y, z, 0.28 * s, 0.24 * s, 0.7 * s, o.color || '#a56a37', { seg: 12 });
  b.tor(x, y + 0.14 * s, z, 0.26 * s, 0.025 * s, '#4a4a55', { seg: 14 });
  b.tor(x, y + 0.56 * s, z, 0.26 * s, 0.025 * s, '#4a4a55', { seg: 14 });
}

export function crate(c, x, z, s = 1, ry = 0, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const b = o.batch || c.b;
  b.box(x, y, z, 0.6 * s, 0.6 * s, 0.6 * s, o.color || '#b98040', { ry });
  b.box(x, y + 0.02 * s, z, 0.64 * s, 0.08 * s, 0.64 * s, '#7a4f24', { ry });
  b.box(x, y + 0.5 * s, z, 0.64 * s, 0.08 * s, 0.64 * s, '#7a4f24', { ry });
}

export function crystal(c, x, z, s = 1, color = '#7ad0ff', o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const gl = c.g;
  const n = o.n ?? 4;
  const r = rng(Math.floor(x * 13 + z * 7 + 3));
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = i === 0 ? 0 : r.range(0.12, 0.3) * s;
    const h = r.range(0.5, 1.2) * s * (i === 0 ? 1.3 : 1);
    const tilt = i === 0 ? 0 : r.range(0.15, 0.4);
    const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
    c.b.cyl(cx, y, cz, 0.001, 0.13 * s, h, color, { seg: 6, rx: Math.cos(a) * tilt, rz: Math.sin(a) * tilt, tint: 0.85 + r() * 0.3 });
    gl.cyl(cx, y + 0.02, cz, 0.001, 0.09 * s, h * 0.9, color, { seg: 6, rx: Math.cos(a) * tilt, rz: Math.sin(a) * tilt, tint: 0.7 });
  }
}

export function torch(c, x, y, z, o = {}) {
  const b = o.batch || c.b;
  const h = o.h ?? 1.1;
  b.cyl(x, y, z, 0.04, 0.06, h, '#5a3a20', { seg: 7 });
  b.cyl(x, y + h, z, 0.11, 0.06, 0.12, '#3a3a44', { seg: 8 });
  const flame = c.make((f) => {
    f.cone(0, 0, 0, 0.11, 0.34, '#ff8c1a', { seg: 7, tint: 1.6 });
    f.cone(0, 0, 0, 0.065, 0.24, '#ffd84a', { seg: 7, tint: 2.2 });
  }, { glow: true, outline: false });
  flame.position.set(x, y + h + 0.1, z);
  c.root.add(flame);
  const ph = Math.random() * 10;
  if (o.light) c.pointLight({ x, y: y + h + 0.6, z, color: o.lightColor || '#ffa040', intensity: o.intensity ?? 9, dist: o.dist ?? 9, flicker: 0.22 });
  c.onFrame((t) => {
    const f = 1 + 0.18 * Math.sin(t * 17 + ph) + 0.1 * Math.sin(t * 31 + ph * 2);
    flame.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
  });
  return flame;
}

// ---------------------------------------------------------------------------------------------
// instanced swaying grass + GPU drifting particles
// ---------------------------------------------------------------------------------------------
export function grassField(c, { x0, x1, z0, z1, count = 2200, y = c.sy ?? 0, base = '#2f8f3a', tip = '#b9f26a', height = 0.5, avoid = 0.7, colors = ['#ffffff', '#f2ffd8', '#d8ffe0'], seed = 5, region = null, wind = 1 } = {}) {
  const r = rng(seed);
  const geo = makeTuftGeometry(5, height);
  const mat = makeGrassMaterial({ base, tip, wind });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const colr = new THREE.Color();
  let n = 0;
  let tries = 0;
  while (n < count && tries < count * 8) {
    tries++;
    const x = r.range(x0, x1), z = r.range(z0, z1);
    if (region && !region(x, z)) continue;
    if (avoid > 0) {
      let hit = c.tris.query(x, z, 1e3);
      if (!hit) for (let k = 0; k < 6 && !hit; k++) hit = c.tris.query(x + Math.cos(k * 1.05) * avoid, z + Math.sin(k * 1.05) * avoid, 1e3);
      if (hit) continue;
    }
    e.set(0, r() * TAU, 0);
    q.setFromEuler(e);
    const sc = r.range(0.7, 1.5);
    p.set(x, y, z);
    s.set(sc, sc * r.range(0.8, 1.3), sc);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    colr.set(r.pick(colors)).multiplyScalar(r.range(0.82, 1.1));
    mesh.setColorAt(n, colr);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  c.root.add(mesh);
  return mesh;
}

/** GPU-animated floating dots: fireflies, snow, embers, dust, magic sparkles, stars. */
export function drifters(c, { count = 200, box = [-10, 10, 0, 6, -20, 5], color = '#fff2a0', size = 0.12, mode = 'float', speed = 1, additive = true, twinkle = 1 } = {}) {
  const r = rng(99 + count);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) seeds[i] = r();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uPx: U.uPointScale,
      uSize: { value: size },
      uSpeed: { value: speed },
      uColor: { value: new THREE.Color(color) },
      uMin: { value: new THREE.Vector3(box[0], box[2], box[4]) },
      uSize3: { value: new THREE.Vector3(box[1] - box[0], box[3] - box[2], box[5] - box[4]) },
      uMode: { value: { float: 0, fall: 1, rise: 2 }[mode] ?? 0 },
      uTwinkle: { value: twinkle },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed; uniform float uTime, uSize, uSpeed, uPx, uTwinkle; uniform vec3 uMin, uSize3; uniform int uMode;
      varying float vA;
      void main(){
        vec3 p = uMin + aSeed * uSize3;
        float t = uTime * uSpeed;
        if (uMode == 1) {
          p.y = uMin.y + mod(p.y - uMin.y - t * (0.5 + aSeed.x), uSize3.y);
          p.x += sin(t * 0.7 + aSeed.z * 30.0) * 0.5; p.z += cos(t * 0.6 + aSeed.x * 30.0) * 0.4;
        } else if (uMode == 2) {
          p.y = uMin.y + mod(p.y - uMin.y + t * (0.4 + aSeed.x * 0.8), uSize3.y);
          p.x += sin(t * 1.3 + aSeed.z * 30.0) * 0.25; p.z += cos(t * 1.1 + aSeed.x * 30.0) * 0.25;
        } else {
          p += vec3(sin(t * 0.5 + aSeed.y * 30.0), sin(t * 0.7 + aSeed.x * 30.0) * 0.5, cos(t * 0.4 + aSeed.z * 30.0)) * 0.8;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float fade = 1.0;
        if (uMode == 1 || uMode == 2) { float k = (p.y - uMin.y) / uSize3.y; fade = smoothstep(0.0, 0.1, k) * smoothstep(1.0, 0.85, k); }
        vA = fade * mix(1.0, 0.35 + 0.65 * sin(uTime * (1.5 + aSeed.z * 3.0) + aSeed.x * 40.0) * 0.5 + 0.325, uTwinkle);
        gl_PointSize = uSize * uPx / max(0.5, -mv.z) * (0.55 + aSeed.y * 0.9);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor * (1.0 + a), a); }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  c.root.add(pts);
  return pts;
}

// ---------------------------------------------------------------------------------------------
// critters
// ---------------------------------------------------------------------------------------------
export function butterfly(c, cx, cz, radius, o = {}) {
  const colors = o.colors || ['#ff8fc4', '#ffd23f', '#8fd0ff'];
  const cc = colors[Math.floor(Math.random() * colors.length)];
  const g = c.make((b) => {
    b.cyl(0, 0, -0.06, 0.012, 0.014, 0.12, '#3a2a30', { seg: 5, rx: Math.PI / 2 });
  }, { outline: false });
  const wings = [];
  for (const sgn of [-1, 1]) {
    const w = c.make((b) => {
      b.boxc(sgn * 0.07, 0, 0, 0.14, 0.01, 0.13, cc, { tint: 1.1 });
      b.boxc(sgn * 0.05, 0, 0.09, 0.09, 0.01, 0.07, cc, { tint: 0.9 });
    }, { outline: false, shadow: false });
    g.add(w);
    wings.push({ w, sgn });
  }
  const y0 = o.y ?? 0.9;
  const ph = Math.random() * 100;
  const spd = o.speed ?? 0.5;
  c.root.add(g);
  c.onFrame((t) => {
    const a = t * spd + ph;
    const x = cx + Math.cos(a) * radius + Math.sin(a * 2.3) * radius * 0.3;
    const z = cz + Math.sin(a * 1.3) * radius * 0.8;
    const y = y0 + Math.sin(a * 2.1) * 0.3;
    const dx = -Math.sin(a) * radius - 0, dz = Math.cos(a * 1.3) * radius * 0.8 * 1.3;
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(dx, dz);
    const f = Math.sin(t * 22 + ph) * 0.9;
    wings[0].w.rotation.z = -f - 0.2;
    wings[1].w.rotation.z = f + 0.2;
  });
  return g;
}

export function birdFlock(c, { cx = 0, cz = -10, y = 12, radius = 14, count = 4, color = '#2a2a3a', speed = 0.25, flap = 6 } = {}) {
  for (let i = 0; i < count; i++) {
    const g = c.make((b) => {
      b.sph(0, 0, 0, 0.16, color, { seg: 7, sz: 1.5 });
      b.sph(0, 0.02, -0.2, 0.09, color, { seg: 6 });
      b.cone(0, 0, -0.27, 0.035, 0.1, '#ffb030', { seg: 4, rx: -Math.PI / 2 });
    }, { outline: false, shadow: false });
    const wl = c.make((b) => b.boxc(0.3, 0, 0, 0.6, 0.02, 0.2, color), { outline: false, shadow: false });
    const wr = c.make((b) => b.boxc(-0.3, 0, 0, 0.6, 0.02, 0.2, color), { outline: false, shadow: false });
    g.add(wl, wr);
    g.scale.setScalar(1.6);
    c.root.add(g);
    const ph = (i / count) * TAU + Math.random();
    const rr = radius * (0.8 + Math.random() * 0.4);
    c.onFrame((t) => {
      const a = t * speed + ph;
      g.position.set(cx + Math.cos(a) * rr, y + Math.sin(a * 2 + i) * 0.8, cz + Math.sin(a) * rr);
      g.rotation.y = -a;
      g.rotation.z = Math.sin(a * 3) * 0.15;
      const f = Math.sin(t * flap + ph * 3) * 0.7;
      wl.rotation.z = f;
      wr.rotation.z = -f;
    });
  }
}

/** Little walking animal made of spheres: sheep, cow-ish, generic. */
export function sheep(c, cx, cz, radius, o = {}) {
  const fleece = o.fleece || '#fff8ee';
  const skin = o.skin || '#3a3038';
  const g = c.make((b) => {
    b.sph(0, 0.42, 0, 0.32, fleece, { seg: 9, sz: 1.3 });
    b.sph(0.14, 0.55, 0.05, 0.22, fleece, { seg: 8, tint: 1.05 });
    b.sph(-0.16, 0.5, -0.1, 0.22, fleece, { seg: 8, tint: 0.97 });
  });
  const head = c.make((b) => {
    b.sph(0, 0, 0, 0.14, skin, { seg: 8, sz: 1.2 });
    b.sph(-0.06, 0.06, 0.1, 0.035, '#fff', { seg: 5 });
    b.sph(0.06, 0.06, 0.1, 0.035, '#fff', { seg: 5 });
    b.sph(-0.06, 0.06, 0.125, 0.018, '#000', { seg: 4 });
    b.sph(0.06, 0.06, 0.125, 0.018, '#000', { seg: 4 });
  });
  head.position.set(0, 0.55, 0.42);
  g.add(head);
  const legs = [];
  for (const [lx, lz] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]]) {
    const l = c.make((b) => b.cyl(0, -0.2, 0, 0.035, 0.04, 0.2, skin, { seg: 5 }), { outline: false });
    l.position.set(lx, 0.22, lz);
    g.add(l);
    legs.push(l);
  }
  const y = o.y ?? c.sy ?? 0;
  g.scale.setScalar(o.scale || 1);
  c.root.add(g);
  const ph = Math.random() * 50;
  const spd = (o.speed ?? 0.12) * (Math.random() < 0.5 ? -1 : 1);
  const rz = o.rz ?? radius * 0.6;
  c.onFrame((t) => {
    const a = t * spd + ph;
    const x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * rz;
    const dx = -Math.sin(a) * radius * Math.sign(spd), dz = Math.cos(a) * rz * Math.sign(spd);
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(dx, dz);
    const w = t * 5 + ph;
    legs.forEach((l, i) => (l.rotation.x = Math.sin(w + (i % 2 ? 0 : Math.PI) + (i > 1 ? 1.6 : 0)) * 0.5));
    head.rotation.x = 0.3 * Math.max(0, Math.sin(t * 0.7 + ph)) + Math.sin(w) * 0.05;
    g.position.y = y + Math.abs(Math.sin(w)) * 0.03;
  });
  return g;
}

export function chicken(c, x, z, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const g = c.make((b) => {
    b.sph(0, 0.24, 0, 0.2, o.color || '#ffffff', { seg: 8, sz: 1.2 });
    b.cone(0, 0.24, -0.22, 0.09, 0.22, o.color || '#ffffff', { seg: 5, rx: -Math.PI / 2.6 });
    b.cyl(-0.06, 0, 0, 0.012, 0.012, 0.14, '#ffb030', { seg: 4 });
    b.cyl(0.06, 0, 0, 0.012, 0.012, 0.14, '#ffb030', { seg: 4 });
  });
  const head = c.make((b) => {
    b.sph(0, 0, 0, 0.085, o.color || '#ffffff', { seg: 7 });
    b.cone(0, -0.005, 0.07, 0.03, 0.09, '#ffb030', { seg: 4, rx: Math.PI / 2 });
    b.sph(0, 0.09, 0.0, 0.035, '#ff3b3b', { seg: 5, sy: 1.2 });
    b.sph(-0.055, 0.02, 0.04, 0.014, '#000', { seg: 4 });
    b.sph(0.055, 0.02, 0.04, 0.014, '#000', { seg: 4 });
  }, { width: 0.6 });
  head.position.set(0, 0.42, 0.18);
  g.add(head);
  c.place(g, x, y, z, o.ry ?? Math.random() * TAU);
  const ph = Math.random() * 50;
  c.onFrame((t) => {
    const k = Math.max(0, Math.sin(t * 2.6 + ph));
    head.rotation.x = k * k * 1.15;
    head.position.y = 0.42 - k * k * 0.18;
    head.position.z = 0.18 + k * k * 0.06;
  });
  return g;
}

export function frog(c, x, z, o = {}) {
  const y = o.y ?? c.sy ?? 0;
  const g = c.make((b) => {
    b.sph(0, 0.12, 0, 0.16, o.color || '#54d65a', { seg: 9, sy: 0.75, sz: 1.2 });
    b.sph(-0.08, 0.24, 0.1, 0.055, '#fff', { seg: 6 });
    b.sph(0.08, 0.24, 0.1, 0.055, '#fff', { seg: 6 });
    b.sph(-0.08, 0.25, 0.14, 0.028, '#000', { seg: 4 });
    b.sph(0.08, 0.25, 0.14, 0.028, '#000', { seg: 4 });
    b.sph(0, 0.06, 0.15, 0.06, '#f7a0a0', { seg: 5, sy: 0.4 });
  }, { width: 0.6 });
  c.place(g, x, y, z, o.ry ?? 0);
  const ph = Math.random() * 6;
  const per = o.period ?? 3.2;
  const home = { x, z };
  c.onFrame((t) => {
    const k = ((t + ph) % per) / per;
    let hop = 0;
    if (k < 0.18) hop = Math.sin((k / 0.18) * Math.PI);
    g.position.y = y + hop * (o.hop ?? 0.35);
    g.scale.set(1 + (hop > 0 ? 0 : 0), 1 + hop * 0.2, 1 - hop * 0.1);
    if (o.hopX) {
      const u = k < 0.18 ? k / 0.18 : 1;
      const n = Math.floor((t + ph) / per);
      const dir = n % 2 ? 1 : -1;
      g.position.x = home.x + dir * o.hopX * (u - 0.5) * (1) ;
    }
  });
  return g;
}

export function bee(c, cx, cy, cz, radius = 0.8) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, 0.07, '#ffd23f', { seg: 7, sz: 1.4 });
    b.sph(0, 0, -0.06, 0.05, '#2a2a2a', { seg: 6, sz: 0.8 });
    b.boxc(0.05, 0.06, 0, 0.09, 0.008, 0.05, '#dff6ff', { rz: 0.4 });
    b.boxc(-0.05, 0.06, 0, 0.09, 0.008, 0.05, '#dff6ff', { rz: -0.4 });
  }, { outline: false, shadow: false });
  c.root.add(g);
  const ph = Math.random() * 30;
  c.onFrame((t) => {
    const a = t * 1.6 + ph;
    g.position.set(cx + Math.cos(a) * radius + Math.sin(a * 3) * 0.1, cy + Math.sin(a * 2.2) * 0.2, cz + Math.sin(a * 0.8) * radius * 1.2);
    g.rotation.y = -a;
    g.rotation.z = Math.sin(t * 40) * 0.1;
  });
}

/** Fish that periodically leaps out of the water. */
export function jumpingFish(c, x, z, waterY, o = {}) {
  const g = c.make((b) => {
    b.sph(0, 0, 0, 0.16, o.color || '#ff9a3c', { seg: 8, sz: 1.7 });
    b.cone(0, 0, -0.32, 0.12, 0.2, o.color || '#ff9a3c', { seg: 4, rx: Math.PI / 2, sx: 0.4 });
    b.sph(0.07, 0.04, 0.2, 0.03, '#fff', { seg: 5 });
    b.sph(0.08, 0.04, 0.22, 0.015, '#000', { seg: 4 });
    b.box(0, 0.1, -0.02, 0.02, 0.1, 0.16, '#ff6a3c');
  }, { width: 0.6 });
  g.visible = false;
  c.root.add(g);
  const per = o.period ?? 5;
  const ph = o.phase ?? Math.random() * per;
  const dist = o.dist ?? 1.6;
  const ang = o.ang ?? Math.random() * TAU;
  c.onFrame((t) => {
    const k = ((t + ph) % per) / per;
    if (k > 0.14) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const u = k / 0.14;
    const a = ang + Math.floor((t + ph) / per) * 2.1;
    const h = Math.sin(u * Math.PI) * (o.h ?? 0.9);
    g.position.set(x + Math.cos(a) * dist * (u - 0.5), waterY + h - 0.05, z + Math.sin(a) * dist * (u - 0.5));
    const vy = Math.cos(u * Math.PI);
    g.rotation.set(-vy * 0.9, -a + Math.PI / 2, 0, 'YXZ');
  });
  return g;
}

export function cloudPuffAt(c, x, y, z, s = 1) {
  const cl = c.make((b) => {
    b.sph(0, 0, 0, 1.4 * s, '#ffffff', { seg: 10, tint: 1.1 });
    b.sph(1.3 * s, -0.2 * s, 0, 1.0 * s, '#eef5ff', { seg: 9 });
    b.sph(-1.2 * s, -0.1 * s, 0.2, 1.1 * s, '#e6f0ff', { seg: 9 });
  }, { outline: true, width: 1.3, shadow: false, receive: false });
  cl.position.set(x, y, z);
  c.root.add(cl);
  return cl;
}

/** A soft glowing billboard halo (for lamps, crystals, portals). */
export function halo(c, x, y, z, size = 1.2, color = '#ffd27a', intensity = 1.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), makeGlowSpriteMaterial(color, intensity));
  m.position.set(x, y, z);
  m.userData.billboard = true;
  c.root.add(m);
  c.onFrame((t, dt, ctx) => {
    if (ctx && ctx.camera) m.quaternion.copy(ctx.camera.quaternion);
  });
  return m;
}
