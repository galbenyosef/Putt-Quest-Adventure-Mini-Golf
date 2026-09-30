// Toon (cel) shading toolbox: shared material, inverted-hull outlines and a geometry batcher that
// merges hundreds of primitives (boxes, cylinders, spheres…) into a single draw call per hole.
import * as THREE from 'three';

/** Uniforms shared by every custom shader in the game (time drives wind, water, lava…). */
export const U = {
  uTime: { value: 0 },
  uPointScale: { value: 600 },
};

export const OUTLINE_COLOR = new THREE.Color('#1c1233');

let _gradient = null;
export function gradientMap() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([120, 190, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _gradient = tex;
  return tex;
}

const SWAY_GLSL = /* glsl */ `
  float swayAmt = aSway;
  if (swayAmt > 0.0) {
    float ph = uTime * 1.7 + position.x * 0.9 + position.z * 0.7;
    transformed.x += sin(ph) * swayAmt * 0.11;
    transformed.z += cos(ph * 0.83 + 1.3) * swayAmt * 0.08;
    transformed.y -= (sin(ph) * sin(ph)) * swayAmt * 0.012;
  }
`;

let _toon = null;
/** The one lit material used by every batched prop (vertex colours + optional wind sway). */
export function toonMaterial() {
  if (_toon) return _toon;
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSway;\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_GLSL);
  };
  m.customProgramCacheKey = () => 'toon-sway';
  m.userData.shared = true;
  _toon = m;
  return m;
}

let _glow = null;
export function glowMaterial() {
  if (_glow) return _glow;
  _glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  _glow.userData.shared = true;
  return _glow;
}

const outlineCache = new Map();
export function outlineMaterial(width = 1) {
  const key = width.toFixed(2);
  if (outlineCache.has(key)) return outlineCache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: U.uTime, uWidth: { value: 0.03 * width }, uColor: { value: OUTLINE_COLOR } },
    ]),
    vertexShader: /* glsl */ `
      attribute vec3 aONormal;
      attribute float aSway;
      uniform float uWidth;
      uniform float uTime;
      #include <fog_pars_vertex>
      void main() {
        vec3 transformed = position;
        ${SWAY_GLSL}
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 n = normalize(normalMatrix * aONormal);
        float d = -mvPosition.z;
        float w = uWidth * clamp(0.45 + 0.16 * d, 0.5, 3.2);
        mvPosition.xyz += n * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <fog_fragment>
      }`,
    side: THREE.BackSide,
    fog: true,
  });
  mat.userData.shared = true;
  outlineCache.set(key, mat);
  return mat;
}

// ---------------------------------------------------------------------------------------------
// Geometry templates (unit primitives with pre-computed smooth "outline normals")
// ---------------------------------------------------------------------------------------------
const _tplCache = new Map();

function makeTemplate(geo) {
  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal.array;
  const count = pos.length / 3;
  let idx;
  if (geo.index) idx = geo.index.array;
  else {
    idx = new Uint32Array(count);
    for (let i = 0; i < count; i++) idx[i] = i;
  }
  // Accumulate the normals of coincident vertices so hard edges get a smooth extrusion direction.
  const acc = new Map();
  const keyOf = (i) =>
    Math.round(pos[i * 3] * 2000) + '_' + Math.round(pos[i * 3 + 1] * 2000) + '_' + Math.round(pos[i * 3 + 2] * 2000);
  for (let i = 0; i < count; i++) {
    const k = keyOf(i);
    let a = acc.get(k);
    if (!a) {
      a = [0, 0, 0];
      acc.set(k, a);
    }
    a[0] += nor[i * 3];
    a[1] += nor[i * 3 + 1];
    a[2] += nor[i * 3 + 2];
  }
  const onor = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = acc.get(keyOf(i));
    let l = Math.hypot(a[0], a[1], a[2]);
    if (l < 1e-5) {
      onor[i * 3] = nor[i * 3];
      onor[i * 3 + 1] = nor[i * 3 + 1];
      onor[i * 3 + 2] = nor[i * 3 + 2];
    } else {
      onor[i * 3] = a[0] / l;
      onor[i * 3 + 1] = a[1] / l;
      onor[i * 3 + 2] = a[2] / l;
    }
  }
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), onor, idx: Uint32Array.from(idx), count };
}

function tpl(key, make) {
  let t = _tplCache.get(key);
  if (!t) {
    const g = make();
    t = makeTemplate(g);
    g.dispose();
    _tplCache.set(key, t);
  }
  return t;
}

const colorCache = new Map();
export function col(c) {
  if (c && c.isColor) return c;
  if (Array.isArray(c)) return new THREE.Color(c[0], c[1], c[2]);
  let v = colorCache.get(c);
  if (!v) {
    v = new THREE.Color(c);
    colorCache.set(c, v);
  }
  return v;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _nm = new THREE.Matrix3();

let _seed = 12345;
const rnd = () => {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
};

/** Collects primitives, then builds one lit mesh (+ outline hull) out of them. */
export class Batch {
  constructor({ outline = true, glow = false, width = 1, shadow = true, receive = true, name = 'batch' } = {}) {
    this.o = { outline, glow, width, shadow, receive, name };
    this.pos = [];
    this.nor = [];
    this.onor = [];
    this.col = [];
    this.sway = [];
    this.idx = [];
    this.n = 0;
    this.vary = 0.06; // per-primitive brightness variation
  }

  get empty() {
    return this.n === 0;
  }

  add(t, m, color, sway = 0, tint = 1) {
    const c = col(color);
    let k = tint;
    if (this.vary > 0 && !this.o.glow) k *= 1 + (rnd() - 0.5) * this.vary * 2;
    const r = c.r * k;
    const g = c.g * k;
    const b = c.b * k;
    _nm.getNormalMatrix(m);
    const e = m.elements;
    const ne = _nm.elements;
    const base = this.n;
    for (let i = 0; i < t.count; i++) {
      const x = t.pos[i * 3];
      const y = t.pos[i * 3 + 1];
      const z = t.pos[i * 3 + 2];
      this.pos.push(
        e[0] * x + e[4] * y + e[8] * z + e[12],
        e[1] * x + e[5] * y + e[9] * z + e[13],
        e[2] * x + e[6] * y + e[10] * z + e[14]
      );
      let nx = t.nor[i * 3];
      let ny = t.nor[i * 3 + 1];
      let nz = t.nor[i * 3 + 2];
      let tx = ne[0] * nx + ne[3] * ny + ne[6] * nz;
      let ty = ne[1] * nx + ne[4] * ny + ne[7] * nz;
      let tz = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      let l = Math.hypot(tx, ty, tz) || 1;
      this.nor.push(tx / l, ty / l, tz / l);
      nx = t.onor[i * 3];
      ny = t.onor[i * 3 + 1];
      nz = t.onor[i * 3 + 2];
      tx = ne[0] * nx + ne[3] * ny + ne[6] * nz;
      ty = ne[1] * nx + ne[4] * ny + ne[7] * nz;
      tz = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      l = Math.hypot(tx, ty, tz) || 1;
      this.onor.push(tx / l, ty / l, tz / l);
      this.col.push(r, g, b);
      this.sway.push(sway);
    }
    for (let i = 0; i < t.idx.length; i++) this.idx.push(base + t.idx[i]);
    this.n += t.count;
  }

  _compose(x, y, z, sx, sy, sz, o) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    return _m.compose(_p, _q, _s);
  }

  /** Box with its BASE centre at (x,y,z). */
  box(x, y, z, w, h, d, color, o = {}) {
    return this.boxc(x, y + h / 2, z, w, h, d, color, o);
  }
  /** Box centred on (x,y,z). */
  boxc(x, y, z, w, h, d, color, o = {}) {
    const t = tpl('box', () => new THREE.BoxGeometry(1, 1, 1));
    this.add(t, this._compose(x, y, z, w, h, d, o), color, o.sway || 0, o.tint || 1);
  }
  /** Cylinder / frustum with its base at y. rt = top radius, rb = bottom radius. */
  cyl(x, y, z, rt, rb, h, color, o = {}) {
    return this.cylc(x, y + h / 2, z, rt, rb, h, color, o);
  }
  cylc(x, y, z, rt, rb, h, color, o = {}) {
    const seg = o.seg || 12;
    const ratio = Math.round((rt / Math.max(rb, 1e-4)) * 100) / 100;
    const t = tpl(`cyl:${seg}:${ratio}`, () => new THREE.CylinderGeometry(ratio, 1, 1, seg, 1));
    this.add(t, this._compose(x, y, z, rb, h, rb, o), color, o.sway || 0, o.tint || 1);
  }
  cone(x, y, z, r, h, color, o = {}) {
    return this.cyl(x, y, z, 0.001, r, h, color, o);
  }
  sph(x, y, z, r, color, o = {}) {
    const ws = o.seg || 14;
    const t = tpl(`sph:${ws}`, () => new THREE.SphereGeometry(1, ws, Math.max(6, Math.round(ws * 0.6))));
    this.add(t, this._compose(x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), o), color, o.sway || 0, o.tint || 1);
  }
  /** Torus lying in the XZ plane by default (axis = Y). */
  tor(x, y, z, R, r, color, o = {}) {
    const seg = o.seg || 20;
    const ratio = Math.round((r / R) * 100) / 100;
    const t = tpl(`tor:${seg}:${ratio}`, () => {
      const g = new THREE.TorusGeometry(1, ratio, 8, seg);
      g.rotateX(Math.PI / 2);
      return g;
    });
    this.add(t, this._compose(x, y, z, R, R, R, o), color, o.sway || 0, o.tint || 1);
  }
  /** Arbitrary geometry (tubes, lathes, extrusions). */
  geo(geometry, x, y, z, color, o = {}) {
    const g = geometry.index || !geometry.attributes.normal ? geometry : geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    const t = makeTemplate(g);
    this.add(t, this._compose(x, y, z, o.sx || 1, o.sy || 1, o.sz || 1, o), color, o.sway || 0, o.tint || 1);
    geometry.dispose();
  }
  /** Wedge/ramp-like prism from an arbitrary set of triangles [[x,y,z]*3,...] */
  tris(list, color, o = {}) {
    if (typeof list[0][0] === 'number') list = [list]; // a single triangle
    const pos = [];
    const idx = [];
    for (const tri of list) {
      const b = pos.length / 3;
      for (const p of tri) pos.push(p[0], p[1], p[2]);
      idx.push(b, b + 1, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.geo(g, 0, 0, 0, color, o);
  }

  build() {
    const group = new THREE.Group();
    group.name = this.o.name;
    if (this.n === 0) return group;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aONormal', new THREE.Float32BufferAttribute(this.onor, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(this.idx), 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.o.glow ? glowMaterial() : toonMaterial());
    mesh.castShadow = this.o.shadow && !this.o.glow;
    mesh.receiveShadow = this.o.receive && !this.o.glow;
    group.add(mesh);
    if (this.o.outline) {
      const om = new THREE.Mesh(g, outlineMaterial(this.o.width));
      om.castShadow = false;
      om.receiveShadow = false;
      group.add(om);
    }
    // free the JS arrays
    this.pos = this.nor = this.onor = this.col = this.sway = this.idx = [];
    return group;
  }
}

/** Convenience: build a small self-contained toon object from a callback that fills a Batch. */
export function compose(fn, opts) {
  const b = new Batch(opts);
  fn(b);
  return b.build();
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.userData && o.material.userData.own) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}
