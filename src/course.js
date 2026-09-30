// CourseBuilder: the small DSL every hole is written in. It produces BOTH the render meshes and the
// physics data (ground triangles, walls, kinematic colliders, triggers, cup) from the same calls.
import * as THREE from 'three';
import { TriSet, Mover, Kinematic, makeWall, SURFACES, CUP_R, BALL_R } from './physics.js';
import { Batch, toonMaterial, gradientMap, col, U } from './render/toon.js';
import { makeWaterMaterial, makeLavaMaterial, makeFlagMaterial, makePortalMaterial } from './render/shaders.js';
import { patternTexture, flagTexture, labelTexture } from './render/textures.js';
import { simplify3D, clamp, lerp, smoothstep } from './util.js';

const UV_SCALE = { mow: 0.25, planks: 0.5, tiles: 0.5, dots: 0.4, ice: 0.22, conv: 1, none: 1 };
const _groundMats = new Map();
function groundMaterial(pattern, clone = false) {
  const key = pattern + (clone ? Math.random() : '');
  if (!clone && _groundMats.has(key)) return _groundMats.get(key);
  const map = pattern === 'none' ? null : patternTexture(pattern, clone);
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), map });
  if (!clone) {
    m.userData.shared = true;
    _groundMats.set(key, m);
  } else m.userData.own = true;
  return m;
}

export class Course {
  /**
   * @param {object} def { id, name, par, theme }
   */
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.par = def.par;
    this.theme = def.theme;
    this.root = new THREE.Group();
    this.tris = new TriSet();
    this.walls = [];
    this.kins = [];
    this.movers = [];
    this.triggers = [];
    this.pipes = [];
    this.cup = null;
    this.tee = { x: 0, z: 0, y: 0, aim: 0 };
    this.bounds = { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, minY: 1e9, maxY: -1e9 };
    this.oobY = null;
    this.route = null; // [[x,y,z]…] flyover path (tee → cup)
    this.updaters = [];
    this.bumpers = [];
    this.groups = new Map();
    this.b = new Batch({ name: 'props' }); // lit + outlined
    this.g = new Batch({ name: 'glow', glow: true, outline: false }); // unlit emissive
    this.d = new Batch({ name: 'deco', outline: false, shadow: false }); // lit, no outline (tiny stuff)
    this.animated = []; // separately animated meshes / lights
    this.lightDefs = []; // point lights (max 4 are used by the stage)
    this.skyOverride = null;
    this._waterMat = null;
    this._lavaMat = null;
    this.tags = {}; // free-form data for the game (e.g. dino ref, camera hints)
    this.hintText = def.hint || '';
    this.finished = false;
  }

  // -------------------------------------------------------------------------------------------
  // scene helpers
  // -------------------------------------------------------------------------------------------
  add(obj) {
    this.root.add(obj);
    return obj;
  }
  /** Dynamic point light definition; the Stage maps up to 4 of these onto real lights. */
  pointLight({ x, y, z, color = '#ffa040', intensity = 8, dist = 9, flicker = 0 }) {
    const d = { x, y, z, color, intensity, dist, flicker, cur: intensity, ph: Math.random() * 20 };
    this.lightDefs.push(d);
    return d;
  }
  /** Register a per-frame cosmetic updater fn(t, dt, ctx). */
  onFrame(fn) {
    this.updaters.push(fn);
  }
  /** Build a small toon object from a callback filling a Batch (returns a Group ready to animate). */
  make(fn, opts) {
    const b = new Batch(opts);
    fn(b);
    const g = b.build();
    return g;
  }
  /** Place a Group (from make()) in the world. */
  place(group, x, y, z, ry = 0) {
    group.position.set(x, y, z);
    group.rotation.y = ry;
    this.root.add(group);
    return group;
  }
  kin(update, movers = []) {
    const k = new Kinematic(update);
    k.movers = movers;
    this.kins.push(k);
    return k;
  }
  mover() {
    const m = new Mover();
    m.group = new THREE.Group();
    this.root.add(m.group);
    this.movers.push(m);
    m.id = this.movers.length;
    return m;
  }

  // -------------------------------------------------------------------------------------------
  // ground
  // -------------------------------------------------------------------------------------------
  groundY(x, z, fallback = 0) {
    let h = this.tris.query(x, z, 1e3);
    if (h) return h.y;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      h = this.tris.query(x + Math.cos(a) * 0.25, z + Math.sin(a) * 0.25, 1e3);
      if (h) return h.y;
    }
    return fallback;
  }

  _groupFor(surf, o) {
    const s = SURFACES[surf];
    let kind = 'std';
    if (s.hazard === 'water') kind = 'water';
    else if (s.hazard === 'lava') kind = 'lava';
    const pattern = o.pattern || s.pattern;
    const key = `${kind}|${pattern}|${o.group || ''}|${o.mover ? o.mover.id : 0}`;
    let g = this.groups.get(key);
    if (!g) {
      g = { key, kind, pattern, mover: o.mover || null, cloneTex: !!o.group, pos: [], col: [], uv: [], tri: [], uvFn: o.uvFn || null };
      this.groups.set(key, g);
    }
    return g;
  }

  /** Add one ground triangle (physics + visual). a,b,c = [x,y,z] */
  tri(a, b, c, surf = 'grass', o = {}) {
    const set = o.mover ? o.mover.tris : this.tris;
    // keep the winding facing up so the mesh and the collision triangle agree
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny < 0) [b, c] = [c, b];
    const idx = set.add(a, b, c, surf, o.extra || null);
    if (idx < 0) return;
    const g = this._groupFor(surf, o);
    const s = SURFACES[surf];
    const base = col(o.color || s.color);
    const scale = UV_SCALE[g.pattern] ?? 1;
    for (const p of [a, b, c]) {
      g.pos.push(p[0], p[1], p[2]);
      const k = o.tint ? o.tint(p[0], p[2]) : 1;
      g.col.push(base.r * k, base.g * k, base.b * k);
      if (g.uvFn) {
        const uv = g.uvFn(p[0], p[2]);
        g.uv.push(uv[0], uv[1]);
      } else g.uv.push(p[0] * scale, p[2] * scale);
    }
    if (!o.mover) {
      this._grow(a[0], a[1], a[2]);
      this._grow(b[0], b[1], b[2]);
      this._grow(c[0], c[1], c[2]);
    }
  }
  _grow(x, y, z) {
    const b = this.bounds;
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (z < b.minZ) b.minZ = z;
    if (z > b.maxZ) b.maxZ = z;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
  }

  quad(p0, p1, p2, p3, surf = 'grass', o = {}) {
    this.tri(p0, p1, p2, surf, o);
    this.tri(p0, p2, p3, surf, o);
  }

  /** Axis-aligned (or rotated by o.rot about Y) rectangle, optionally subdivided for hfn hills. */
  rect(cx, cz, w, d, y, surf = 'grass', o = {}) {
    const rot = o.rot || 0;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const nx = Math.max(1, o.nx || (o.hfn ? Math.ceil(w / (o.cell || 0.5)) : 1));
    const nz = Math.max(1, o.nz || (o.hfn ? Math.ceil(d / (o.cell || 0.5)) : 1));
    const P = (i, j) => {
      const lx = (i / nx - 0.5) * w;
      const lz = (j / nz - 0.5) * d;
      const x = cx + lx * cs + lz * sn;
      const z = cz - lx * sn + lz * cs;
      const yy = y + (o.hfn ? o.hfn(x, z) : 0) + (o.plane ? o.plane(lx, lz) : 0);
      return [x, yy, z];
    };
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), dd = P(i, j + 1);
        this.tri(a, b, c, surf, o);
        this.tri(a, c, dd, surf, o);
      }
    }
  }

  /** Circular disc (y can be constant; hfn adds height). */
  disc(cx, cz, r, y, surf = 'grass', o = {}) {
    const seg = o.seg || Math.max(16, Math.round(r * 10));
    const rings = o.rings || (o.hfn ? Math.max(2, Math.ceil(r / (o.cell || 0.5))) : 1);
    const P = (ri, i) => {
      const rr = (ri / rings) * r;
      const a = (i / seg) * Math.PI * 2;
      const x = cx + Math.cos(a) * rr;
      const z = cz + Math.sin(a) * rr;
      return [x, y + (o.hfn ? o.hfn(x, z) : 0), z];
    };
    for (let ri = 0; ri < rings; ri++) {
      for (let i = 0; i < seg; i++) {
        const a = P(ri, i), b = P(ri, i + 1), c = P(ri + 1, i + 1), d = P(ri + 1, i);
        if (ri === 0) this.tri(P(0, 0), c, d, surf, o);
        else {
          this.tri(a, b, c, surf, o);
          this.tri(a, c, d, surf, o);
        }
      }
    }
  }

  /** Flat ring (annulus). */
  ring(cx, cz, r0, r1, y, surf = 'grass', o = {}) {
    const seg = o.seg || Math.max(20, Math.round(r1 * 10));
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (r, a) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      this.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), surf, o);
    }
  }

  /** Arbitrary polygon (may be concave) at constant y. pts = [[x,z],…] */
  poly(pts, y, surf = 'grass', o = {}) {
    const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const f of faces) {
      const A = pts[f[0]], B = pts[f[1]], C = pts[f[2]];
      this.tri([A[0], y, A[1]], [B[0], y, B[1]], [C[0], y, C[1]], surf, o);
    }
  }

  /** Height-field patch on a regular grid; o.mask(x,z) can carve organic shapes. */
  terrain(x0, z0, x1, z1, cell, hfn, surf = 'grass', o = {}) {
    const nx = Math.max(1, Math.ceil((x1 - x0) / cell));
    const nz = Math.max(1, Math.ceil((z1 - z0) / cell));
    const P = (i, j) => {
      const x = x0 + (i / nx) * (x1 - x0), z = z0 + (j / nz) * (z1 - z0);
      return [x, hfn(x, z), z];
    };
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = x0 + ((i + 0.5) / nx) * (x1 - x0), cz = z0 + ((j + 0.5) / nz) * (z1 - z0);
        if (o.mask && !o.mask(cx, cz)) continue;
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        this.tri(a, b, c, surf, o);
        this.tri(a, c, d, surf, o);
      }
    }
  }

  /**
   * Curved / straight ribbon of ground. pts = [[x,z] | [x,z,y]…]
   * o: {y, prof:[[dist,y]…], profSmooth, hfn, widths:[…], cell, smooth, across}
   * returns { left, right, center, len } with [x,y,z] points (walls hug those).
   */
  strip(pts, width, surf = 'grass', o = {}) {
    const cell = o.cell ?? 0.6;
    const has3 = pts.some((p) => p.length > 2);
    const smooth = o.smooth ?? (!has3 && pts.length > 2);
    // 1. sample centre line
    let S = [];
    if (smooth) {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
      const len = curve.getLength();
      const n = Math.max(2, Math.ceil(len / cell));
      const sp = curve.getSpacedPoints(n);
      // map spaced points back to per-input-point widths by proximity along the path
      S = sp.map((p) => [p.x, p.z, 0]);
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(L / cell));
        for (let k = 0; k < n; k++) {
          const u = k / n;
          S.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), has3 ? lerp(a[2] ?? o.y ?? 0, b[2] ?? o.y ?? 0, u) : 0]);
        }
      }
      const l = pts[pts.length - 1];
      S.push([l[0], l[1], has3 ? l[2] ?? o.y ?? 0 : 0]);
    }
    // arclength
    const dist = [0];
    for (let i = 1; i < S.length; i++) dist.push(dist[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
    const total = dist[dist.length - 1];
    const widthAt = (d) => {
      if (!o.widths) return width;
      const f = clamp(d / total, 0, 1) * (o.widths.length - 1);
      const i = Math.min(o.widths.length - 2, Math.floor(f));
      return lerp(o.widths[i], o.widths[i + 1], f - i);
    };
    const profY = (d) => {
      if (!o.prof) return 0;
      const pr = o.prof;
      if (d <= pr[0][0]) return pr[0][1];
      for (let i = 0; i < pr.length - 1; i++) {
        if (d <= pr[i + 1][0]) {
          let u = (d - pr[i][0]) / (pr[i + 1][0] - pr[i][0] || 1);
          if (o.profSmooth) u = u * u * (3 - 2 * u);
          return lerp(pr[i][1], pr[i + 1][1], u);
        }
      }
      return pr[pr.length - 1][1];
    };
    // 2. offset left / right
    const nAcross = o.across ?? (o.hfn || o.subAcross ? Math.max(1, Math.round(width / cell)) : 1);
    const rows = [];
    for (let i = 0; i < S.length; i++) {
      const p = S[i];
      const p0 = S[Math.max(0, i - 1)];
      const p1 = S[Math.min(S.length - 1, i + 1)];
      let tx = p1[0] - p0[0], tz = p1[1] - p0[1];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      // miter for sharp corners of non-smooth polylines
      let miter = 1;
      if (!smooth && i > 0 && i < S.length - 1) {
        const ax = p[0] - p0[0], az = p[1] - p0[1];
        const bx = p1[0] - p[0], bz = p1[1] - p[1];
        const al = Math.hypot(ax, az) || 1, bl = Math.hypot(bx, bz) || 1;
        const cs = (ax * bx + az * bz) / (al * bl);
        miter = clamp(1 / Math.max(0.55, Math.sqrt((1 + cs) / 2)), 1, 1.8);
      }
      const nx = -tz, nz = tx; // left normal (in x,z with z pointing 'down' the screen it does not matter)
      const w = widthAt(dist[i]) / 2 * miter;
      const baseY = (o.y ?? 0) + p[2] + profY(dist[i]);
      const row = [];
      for (let j = 0; j <= nAcross; j++) {
        const s = j / nAcross - 0.5;
        const x = p[0] + nx * w * 2 * s;
        const z = p[1] + nz * w * 2 * s;
        row.push([x, baseY + (o.hfn ? o.hfn(x, z) : 0), z]);
      }
      rows.push(row);
    }
    // 3. triangles
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < nAcross; j++) {
        const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j + 1], d = rows[i + 1][j];
        this.tri(a, b, c, surf, o);
        this.tri(a, c, d, surf, o);
      }
    }
    const xzy = (p) => [p[0], p[2], p[1]];
    return {
      left: rows.map((r) => xzy(r[0])),
      right: rows.map((r) => xzy(r[r.length - 1])),
      center: rows.map((r) => xzy(r[Math.floor(r.length / 2)])),
      len: total,
    };
  }

  /** Sloped ramp between two points (centre line), width across. */
  ramp(x0, z0, y0, x1, z1, y1, width, surf = 'grass', o = {}) {
    return this.strip([[x0, z0, y0], [x1, z1, y1]], width, surf, { smooth: false, cell: 5, ...o });
  }

  /** Belt with moving surface. dir = heading angle (0 = -z). Returns handle for texture scrolling. */
  conveyor(cx, cz, w, len, y, dir, speed, o = {}) {
    const sx = Math.sin(dir), sz = -Math.cos(dir);
    const rx = Math.cos(dir), rz = Math.sin(dir); // right vector
    const uvFn = (x, z) => [((x - cx) * sx + (z - cz) * sz) / 1.0, ((x - cx) * rx + (z - cz) * rz) / 1.0];
    const group = 'conv' + this.groups.size + '_' + Math.round(cx * 10) + '_' + Math.round(cz * 10);
    this.rect(cx, cz, w, len, y, 'conveyor', { rot: -dir, color: o.color || '#ff9a3c', group, uvFn, extra: { conv: [sx * speed, sz * speed] }, mover: o.mover });
    const handle = { group, speed, dir };
    this.conveyors = this.conveyors || [];
    this.conveyors.push(handle);
    return handle;
  }

  // -------------------------------------------------------------------------------------------
  // walls & obstacles
  // -------------------------------------------------------------------------------------------
  /** pts = [[x,z] | [x,z,y]]. Builds collider + boxes. */
  wall(pts, o = {}) {
    const h = o.h ?? 0.5;
    const t = o.t ?? 0.22;
    const color = o.color || '#c98d52';
    let P = pts.map((p) => [p[0], p.length > 2 && p[2] != null ? p[2] : this.groundY(p[0], p[1], o.y ?? 0), p[1]]);
    if (o.simplify !== false && P.length > 2) P = simplify3D(P, o.tol ?? 0.03);
    if (o.closed) P.push(P[0]);
    const topCol = o.top || null;
    const r = t / 2 + 0.015;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const L = Math.hypot(dx, dy, dz);
      if (L < 1e-4) continue;
      const y0 = o.y0 ?? Math.min(a[1], b[1]) - 0.6;
      const y1 = o.y1 ?? Math.max(a[1], b[1]) + h;
      this.walls.push(makeWall(a[0], a[2], b[0], b[2], r, y0, y1, { e: o.e ?? 0.72 }));
      if (o.hidden) continue;
      const yaw = Math.atan2(dx, dz);
      const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
      const batch = o.batch || this.b;
      batch.boxc(mx, my + h / 2, mz, t, h, L + t * 0.98, color, { ry: yaw, rx: pitch });
      if (topCol) batch.boxc(mx, my + h + 0.012, mz, t * 1.16, 0.05, L + t * 1.05, topCol, { ry: yaw, rx: pitch });
    }
    // round the joints where the direction changes
    if (!o.hidden && o.joints !== false) {
      for (let i = 1; i < P.length - 1; i++) {
        const a = P[i - 1], b = P[i], c = P[i + 1];
        const a1 = Math.atan2(b[0] - a[0], b[2] - a[2]), a2 = Math.atan2(c[0] - b[0], c[2] - b[2]);
        let d = Math.abs(a2 - a1);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d > 0.1) (o.batch || this.b).cyl(b[0], b[1], b[2], t / 2, t / 2, h, color, { seg: 8 });
      }
    }
  }

  /** Static cylindrical post / pillar. */
  post(x, z, r, o = {}) {
    const y = o.y ?? this.groundY(x, z, 0);
    const h = o.h ?? 0.6;
    this.walls.push(makeWall(x, z, x, z, r, y - 0.6, y + h, { e: o.e ?? 0.72, kick: o.kick || 0 }));
    if (!o.hidden) {
      (o.batch || this.b).cyl(x, y, z, r * (o.taper ?? 1), r, h, o.color || '#9a9fb5', { seg: o.seg || 14 });
      if (o.capColor) (o.batch || this.b).cyl(x, y + h, z, r * 0.9, r * 0.9, 0.05, o.capColor, { seg: o.seg || 14 });
    }
  }

  /** Oriented rectangular block obstacle (4 collider walls + one box). */
  block(cx, cz, w, d, rot, h, color, o = {}) {
    const y = o.y ?? this.groundY(cx, cz, 0);
    const c = Math.cos(rot), s = Math.sin(rot);
    const pt = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const hw = w / 2, hd = d / 2;
    const cs = [pt(-hw, -hd), pt(hw, -hd), pt(hw, hd), pt(-hw, hd)];
    const rr = 0.03;
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      this.walls.push(makeWall(a[0], a[1], b[0], b[1], rr, y - 0.6, y + h, { e: o.e ?? 0.72 }));
    }
    if (!o.hidden) {
      (o.batch || this.b).box(cx, y, cz, w, h, d, color, { ry: rot });
      if (o.top) (o.batch || this.b).box(cx, y + h, cz, w * 1.04, 0.05, d * 1.04, o.top, { ry: rot });
    }
  }

  /** Invisible wall (e.g. edge of a raised island). */
  hidden(pts, y0, y1) {
    for (let i = 0; i < pts.length - 1; i++) {
      this.walls.push(makeWall(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.06, y0, y1, { e: 0.5 }));
    }
  }

  /** Visible vertical skirt under an edge polyline (for raised decks / islands). pts=[x,z,y] */
  skirt(pts3, depth, color, o = {}) {
    const pts = pts3.map((p) => [p[0], p[2] ?? this.groundY(p[0], p[1], 0), p[1]]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const L = Math.hypot(dx, dz);
      if (L < 1e-4) continue;
      const my = Math.min(a[1], b[1]);
      const top = Math.max(a[1], b[1]);
      const hh = depth + (top - my);
      (o.batch || this.b).boxc((a[0] + b[0]) / 2, my - depth / 2 + (top - my) / 2, (a[2] + b[2]) / 2, o.t ?? 0.08, hh, L + 0.02, color, { ry: Math.atan2(dx, dz) });
    }
  }

  /** Bumper: kicks the ball away; squashes on hit. */
  bumper(x, z, r, o = {}) {
    const y = o.y ?? this.groundY(x, z, 0);
    const h = o.h ?? 0.55;
    const ref = { x, z, y, pulse: 0, group: null };
    this.walls.push(makeWall(x, z, x, z, r, y - 0.6, y + h, { e: 1.0, kick: o.kick ?? 4.6, ref }));
    const grp = this.make((b) => {
      b.cyl(0, 0, 0, r * 0.92, r, h * 0.7, o.color || '#ff5c8a', { seg: 20 });
      b.cyl(0, h * 0.7, 0, r * 0.7, r * 0.92, h * 0.3, o.top || '#ffd23f', { seg: 20 });
    });
    const glow = this.make((b) => {
      b.tor(0, h * 0.99, 0, r * 0.8, 0.035, o.glow || '#fff3a0', { seg: 24 });
    }, { glow: true, outline: false });
    grp.add(glow);
    this.place(grp, x, y, z);
    ref.group = grp;
    this.bumpers.push(ref);
    return ref;
  }

  // -------------------------------------------------------------------------------------------
  // triggers
  // -------------------------------------------------------------------------------------------
  /** Two linked portals. exit = heading (0 = -z) the ball leaves the OTHER portal with. */
  portalPair(a, b, o = {}) {
    const mk = (p) => {
      const y = p.y ?? this.groundY(p.x, p.z, 0);
      return { kind: 'portal', x: p.x, z: p.z, y: y + BALL_R, r: 0.36, exit: p.exit || 0, ty: y };
    };
    const A = mk(a), B = mk(b);
    A.target = B;
    B.target = A;
    this.triggers.push(A, B);
    const colA = o.colorA || '#8a5cff', colB = o.colorB || '#3ff0ff';
    [A, B].forEach((p, i) => {
      const grp = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), makePortalMaterial(i ? colB : colA, i ? colA : colB));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.02;
      grp.add(disc);
      const ringMesh = this.make((bb) => {
        bb.tor(0, 0.04, 0, 0.52, 0.06, i ? colB : colA, { seg: 28, tint: 1.6 });
        bb.tor(0, 0.9, 0, 0.5, 0.05, i ? colB : colA, { seg: 28, tint: 1.5, rx: Math.PI / 2 });
      }, { glow: true, outline: false });
      // little standing arch
      grp.add(ringMesh);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.5, 1.8, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: i ? colB : colA, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
      );
      beam.position.y = 0.9;
      grp.add(beam);
      grp.position.set(p.x, p.ty, p.z);
      this.root.add(grp);
      this.onFrame((t) => {
        beam.material.opacity = 0.13 + 0.05 * Math.sin(t * 3 + i);
        ringMesh.rotation.y = t * 0.8 * (i ? -1 : 1);
      });
    });
    return [A, B];
  }

  /** Speed-boost pad in direction `dir` (heading, 0 = -z). */
  boost(x, z, dir, power = 8, o = {}) {
    const y = this.groundY(x, z, 0);
    const t = { kind: 'boost', x, z, y: y + BALL_R, r: o.r ?? 0.5, dx: Math.sin(dir), dz: -Math.cos(dir), power, cd: 0 };
    this.triggers.push(t);
    const grp = this.make((b) => {
      b.box(0, 0.005, 0, 0.95, 0.03, 1.15, o.base || '#2b2f45', { ry: 0 });
    });
    const arrows = this.make((b) => {
      for (let i = 0; i < 2; i++) {
        const zz = 0.3 - i * 0.42;
        b.tris([[0, 0.05, zz - 0.25], [-0.28, 0.05, zz + 0.05], [0.28, 0.05, zz + 0.05]], o.color || '#3cff9a', { tint: 1.8 });
      }
    }, { glow: true, outline: false });
    grp.add(arrows);
    this.place(grp, x, y, z, -dir);
    t.arrows = arrows;
    this.onFrame((tm) => {
      arrows.position.y = 0.01 + (0.5 + 0.5 * Math.sin(tm * 8)) * 0.012;
    });
    return t;
  }

  /**
   * Guided tunnel / loop. pts = [[x,y,z]…] (y = ball-centre height). The ball enters at either end when
   * rolling in with enough speed and is carried along the path.
   */
  pipe(pts, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
    const length = curve.getLength();
    const n = Math.max(20, Math.ceil(length * 12));
    const sp = curve.getSpacedPoints(n);
    const arr = new Float32Array(sp.length * 3);
    sp.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    const pipe = { pts: arr, n: sp.length, length, curve };
    this.pipes.push(pipe);
    const t0 = curve.getTangent(0), t1 = curve.getTangent(1);
    const norm2 = (v, s = 1) => { const l = Math.hypot(v.x, v.z) || 1; return [v.x / l * s, v.z / l * s]; };
    const d0 = norm2(t0), d1 = norm2(t1, -1);
    const r = o.r ?? 0.36;
    this.triggers.push({ kind: 'pipe', pipe, end: 0, x: sp[0].x, y: sp[0].y, z: sp[0].z, r, dx: d0[0], dz: d0[1] });
    this.triggers.push({ kind: 'pipe', pipe, end: 1, x: sp[n].x, y: sp[n].y, z: sp[n].z, r, dx: d1[0], dz: d1[1] });
    // visual
    const rad = o.radius ?? 0.3;
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.ceil(length * 6), rad, 12, false),
      new THREE.MeshToonMaterial({
        color: o.color || '#9fe8ff',
        transparent: !o.opaque,
        opacity: o.opaque ? 1 : 0.34,
        gradientMap: gradientMap(),
        side: THREE.DoubleSide,
        depthWrite: !!o.opaque,
      })
    );
    tube.material.userData.own = true;
    tube.castShadow = !!o.opaque;
    tube.position.y = 0; // path points are ball centres → tube follows them
    this.root.add(tube);
    // ribs
    const ribs = this.make((b) => {
      const cnt = Math.max(2, Math.floor(length / (o.ribGap ?? 0.9)));
      for (let i = 0; i <= cnt; i++) {
        const u = i / cnt;
        const p = curve.getPoint(u);
        const tg = curve.getTangent(u);
        const yaw = Math.atan2(tg.x, tg.z);
        const pitch = -Math.asin(clamp(tg.y, -1, 1));
        b.tor(p.x, p.y, p.z, rad * 1.02, 0.045, o.rib || '#ff8a3d', { seg: 14, ry: yaw, rx: pitch + Math.PI / 2 });
      }
    });
    this.root.add(ribs);
    return pipe;
  }

  // -------------------------------------------------------------------------------------------
  // tee / cup / misc
  // -------------------------------------------------------------------------------------------
  setTee(x, z, aim = 0, o = {}) {
    this.tee.x = x; this.tee.z = z; this.tee.aim = aim;
    this.tee.y = this.groundY(x, z, 0);
    this.tee.pad = o.pad !== false;
    this.tee.color = o.color || '#ffd23f';
  }
  setCup(x, z) {
    const y = this.groundY(x, z, 0);
    this.cup = { x, z, y };
  }
  setRoute(pts) {
    this.route = pts;
  }

  /** Text sign on a post. */
  sign(x, z, text, o = {}) {
    const y = o.y ?? this.groundY(x, z, 0);
    const tex = labelTexture(text, o.tex || {});
    const grp = new THREE.Group();
    const post = this.make((b) => {
      b.cyl(0, 0, 0, 0.05, 0.06, (o.h ?? 0.9), '#6b4426', { seg: 8 });
      b.box(0, (o.h ?? 0.9) - 0.05, 0, (o.w ?? 0.9) + 0.1, (o.hh ?? 0.5) + 0.1, 0.06, '#4a2c16');
    });
    grp.add(post);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(o.w ?? 0.9, o.hh ?? 0.5), new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : 0x442211, toneMapped: false }));
    board.position.set(0, (o.h ?? 0.9) - 0.05 + (o.hh ?? 0.5) / 2 - (o.hh ?? 0.5) / 2, 0.035);
    board.position.y = (o.h ?? 0.9) - 0.05 + 0.0;
    grp.add(board);
    const back = board.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.035;
    grp.add(back);
    grp.position.set(x, y, z);
    grp.rotation.y = o.ry || 0;
    this.root.add(grp);
    return grp;
  }

  // -------------------------------------------------------------------------------------------
  // finishing
  // -------------------------------------------------------------------------------------------
  _smoothNormals(g) {
    // welds coincident vertices and averages normals of faces within ~35° so hills look smooth
    const n = g.pos.length / 9;
    const fn = new Float32Array(n * 3);
    const map = new Map();
    const key = (i) => Math.round(g.pos[i * 3] * 400) + '_' + Math.round(g.pos[i * 3 + 1] * 400) + '_' + Math.round(g.pos[i * 3 + 2] * 400);
    for (let f = 0; f < n; f++) {
      const p = g.pos;
      const i0 = f * 9;
      const ux = p[i0 + 3] - p[i0], uy = p[i0 + 4] - p[i0 + 1], uz = p[i0 + 5] - p[i0 + 2];
      const vx = p[i0 + 6] - p[i0], vy = p[i0 + 7] - p[i0 + 1], vz = p[i0 + 8] - p[i0 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      fn[f * 3] = nx / l; fn[f * 3 + 1] = ny / l; fn[f * 3 + 2] = nz / l;
      for (let k = 0; k < 3; k++) {
        const kk = key(f * 3 + k);
        let arr = map.get(kk);
        if (!arr) map.set(kk, (arr = []));
        arr.push(f);
      }
    }
    const nor = new Float32Array(n * 9);
    for (let f = 0; f < n; f++) {
      for (let k = 0; k < 3; k++) {
        const arr = map.get(key(f * 3 + k));
        let sx = 0, sy = 0, sz = 0;
        for (const q of arr) {
          const d = fn[q * 3] * fn[f * 3] + fn[q * 3 + 1] * fn[f * 3 + 1] + fn[q * 3 + 2] * fn[f * 3 + 2];
          if (d > 0.82) { sx += fn[q * 3]; sy += fn[q * 3 + 1]; sz += fn[q * 3 + 2]; }
        }
        const l = Math.hypot(sx, sy, sz) || 1;
        nor[f * 9 + k * 3] = sx / l; nor[f * 9 + k * 3 + 1] = sy / l; nor[f * 9 + k * 3 + 2] = sz / l;
      }
    }
    return nor;
  }

  _buildGround() {
    const theme = this.theme || {};
    for (const g of this.groups.values()) {
      if (g.pos.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      let mat;
      let receive = true;
      let cast = true;
      if (g.kind === 'water') {
        if (!this._waterMat) this._waterMat = makeWaterMaterial(theme.water || {});
        mat = this._waterMat;
        receive = false; cast = false;
      } else if (g.kind === 'lava') {
        if (!this._lavaMat) this._lavaMat = makeLavaMaterial(theme.lava || {});
        mat = this._lavaMat;
        receive = false; cast = false;
      } else {
        geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(this._smoothNormals(g), 3));
        mat = groundMaterial(g.pattern, g.cloneTex);
        if (g.cloneTex) this._convMats = (this._convMats || []).concat([{ mat, group: g.key }]);
      }
      if (g.kind !== 'std') geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = receive;
      mesh.castShadow = cast;
      mesh.userData.groundKey = g.key;
      (g.mover ? g.mover.group : this.root).add(mesh);
    }
  }

  _buildCupAndTee() {
    const cup = this.cup;
    if (cup) {
      cup.y = this.groundY(cup.x, cup.z, cup.y);
      const g = this.make((b) => {
        b.cyl(0, 0, 0, CUP_R * 1.02, CUP_R * 1.02, 0.014, '#07070c', { seg: 24 });
        b.tor(0, 0.012, 0, CUP_R + 0.03, 0.04, '#f2f2f8', { seg: 28 });
        b.cyl(0, 0, 0, 0.022, 0.022, 1.7, '#f4f4f6', { seg: 8 });
        b.sph(0, 1.72, 0, 0.05, '#ffd23f');
      }, { outline: true, width: 0.7 });
      this.place(g, cup.x, cup.y, cup.z);
      const tex = flagTexture(this.id);
      const flagGeo = new THREE.PlaneGeometry(0.62, 0.42, 12, 1);
      flagGeo.translate(0.31 + 0.02, 0, 0);
      const flag = new THREE.Mesh(flagGeo, makeFlagMaterial(tex, this.theme?.flagColor || '#ff3d5a'));
      flag.position.set(cup.x, cup.y + 1.48, cup.z);
      flag.frustumCulled = false;
      this.root.add(flag);
      this.cupFlag = flag;
      // a soft pulsing halo so the cup reads from afar
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(CUP_R + 0.09, CUP_R + 0.2, 32),
        new THREE.MeshBasicMaterial({ color: '#fff6b0', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(cup.x, cup.y + 0.02, cup.z);
      this.root.add(halo);
      this.onFrame((t) => {
        halo.material.opacity = 0.32 + 0.22 * Math.sin(t * 3.2);
        const s = 1 + 0.06 * Math.sin(t * 3.2);
        halo.scale.set(s, s, s);
      });
    }
    const tee = this.tee;
    tee.y = this.groundY(tee.x, tee.z, tee.y);
    if (tee.pad) {
      const g = this.make((b) => {
        b.cyl(0, 0, 0, 0.42, 0.44, 0.03, tee.color, { seg: 24 });
        b.sph(-0.55, 0.13, 0, 0.09, '#ff5a5a');
        b.sph(0.55, 0.13, 0, 0.09, '#5a8bff');
        b.cyl(-0.55, 0, 0, 0.012, 0.012, 0.13, '#ddd', { seg: 6 });
        b.cyl(0.55, 0, 0, 0.012, 0.012, 0.13, '#ddd', { seg: 6 });
      }, { width: 0.6 });
      this.place(g, tee.x, tee.y, tee.z);
    }
  }

  finish() {
    if (this.finished) return this;
    this._buildGround();
    this._buildCupAndTee();
    for (const bt of [this.b, this.g, this.d]) {
      if (!bt.empty) this.root.add(bt.build());
    }
    // bounds fallback
    if (this.bounds.minX > this.bounds.maxX) this.bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: 0, maxY: 1 };
    if (this.oobY == null) this.oobY = this.bounds.minY - 3.5;
    if (!this.route) {
      this.route = [
        [this.tee.x, this.tee.y, this.tee.z],
        [this.cup.x, this.cup.y, this.cup.z],
      ];
    }
    this.tris.build();
    for (const m of this.movers) m.tris.build();
    // conveyor scroll updater
    if (this.conveyors && this._convMats) {
      const list = this.conveyors.map((c) => ({ ...c, mat: this._convMats.find((m) => m.group.includes(c.group))?.mat }));
      this.onFrame((t, dt) => {
        for (const c of list) {
          if (c.mat && c.mat.map) c.mat.map.offset.x -= (c.speed * dt) / 1.0;
        }
      });
    }
    // bumper pulse
    this.onFrame((t, dt) => {
      for (const b of this.bumpers) {
        if (b.pulse > 0.001) {
          b.pulse = Math.max(0, b.pulse - dt * 4.5);
          const k = 1 + Math.sin(b.pulse * Math.PI) * 0.22;
          b.group.scale.set(k, 1 / Math.sqrt(k), k);
        } else b.group.scale.set(1, 1, 1);
      }
    });
    this.finished = true;
    return this;
  }

  update(t, dt, ctx) {
    for (let i = 0; i < this.updaters.length; i++) this.updaters[i](t, dt, ctx);
    for (const d of this.lightDefs) {
      d.cur = d.intensity * (1 + d.flicker * (0.5 * Math.sin(t * 13 + d.ph) + 0.3 * Math.sin(t * 27 + d.ph * 2) + 0.2 * Math.sin(t * 5 + d.ph)));
    }
  }

  dispose() {
    const seen = new Set();
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (!m || m.userData.shared || seen.has(m)) continue;
        seen.add(m);
        if (m.map && m.userData.own) m.map.dispose();
        m.dispose();
      }
    });
  }
}
