// CPU particle system (splashes, dust, sparks, confetti, fireworks) rendered as two GL point clouds.
import * as THREE from 'three';
import { U } from './toon.js';
import { rng, TAU } from '../util.js';

class Pool {
  constructor(max, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.flutter = new Float32Array(max);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: U.uPointScale },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aShape;
        uniform float uPx; varying vec3 vC; varying float vA; varying float vS;
        void main(){
          vC = aColor; vA = aAlpha; vS = aShape;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPx / max(0.3, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA; varying float vS;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float a;
          if (vS > 0.5) { a = step(max(abs(p.x), abs(p.y)), 0.42); }
          else { a = smoothstep(0.5, 0.15, length(p)); }
          a *= vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }
  emit(p) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx; this.vel[i * 3 + 1] = p.vy; this.vel[i * 3 + 2] = p.vz;
    this.col[i * 3] = p.r; this.col[i * 3 + 1] = p.g; this.col[i * 3 + 2] = p.b;
    this.size0[i] = p.size;
    this.size[i] = p.size;
    this.alpha[i] = p.alpha ?? 1;
    this.shape[i] = p.shape || 0;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.grav[i] = p.grav ?? 0;
    this.drag[i] = p.drag ?? 0;
    this.grow[i] = p.grow ?? 0;
    this.flutter[i] = p.flutter ?? 0;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.size[i] !== 0) {
          this.size[i] = 0;
          this.alpha[i] = 0;
          any = true;
        }
        continue;
      }
      any = true;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      let s = this.size0[i] * (1 + this.grow[i] * (1 - k));
      if (this.flutter[i] > 0) s *= 0.55 + 0.45 * Math.abs(Math.sin((1 - k) * this.flutter[i]));
      this.size[i] = s;
      this.alpha[i] = Math.min(1, k * 2.2);
    }
    if (any) {
      const g = this.geo;
      g.attributes.position.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      g.attributes.aShape.needsUpdate = true;
    }
  }
}

const _c = new THREE.Color();
const rgb = (c) => {
  _c.set(c);
  return [_c.r, _c.g, _c.b];
};

export class FX {
  constructor(scene) {
    this.normal = new Pool(1600, false);
    this.add = new Pool(2400, true);
    scene.add(this.normal.points);
    scene.add(this.add.points);
    this.r = rng(4242);
    this.timers = [];
  }

  _e(pool, x, y, z, vx, vy, vz, color, size, life, o = {}) {
    const [r, g, b] = Array.isArray(color) ? color : rgb(color);
    pool.emit({ x, y, z, vx, vy, vz, r, g, b, size, life, ...o });
  }

  splash(x, y, z, color = '#bfefff') {
    const r = this.r;
    for (let i = 0; i < 46; i++) {
      const a = r() * TAU, s = r.range(0.6, 2.4);
      this._e(this.normal, x, y, z, Math.cos(a) * s, r.range(2.5, 6.5), Math.sin(a) * s, color, r.range(0.09, 0.2), r.range(0.6, 1.1), { grav: 14, drag: 0.4 });
    }
    for (let i = 0; i < 22; i++) {
      const a = r() * TAU, s = r.range(0.4, 1.2);
      this._e(this.add, x, y + 0.05, z, Math.cos(a) * s, r.range(3, 7), Math.sin(a) * s, '#ffffff', r.range(0.06, 0.12), r.range(0.5, 0.9), { grav: 15 });
    }
    // ripple ring
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      this._e(this.normal, x, y + 0.02, z, Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2, '#ffffff', 0.12, 0.7, { drag: 3.2, alpha: 0.8 });
    }
  }
  lavaSplash(x, y, z) {
    const r = this.r;
    for (let i = 0; i < 40; i++) {
      const a = r() * TAU, s = r.range(0.6, 2.6);
      this._e(this.add, x, y, z, Math.cos(a) * s, r.range(3, 7.5), Math.sin(a) * s, r() < 0.5 ? '#ff9a2a' : '#ffd84a', r.range(0.1, 0.24), r.range(0.7, 1.3), { grav: 12, drag: 0.3 });
    }
    for (let i = 0; i < 14; i++) {
      this._e(this.normal, x + r.range(-0.2, 0.2), y + 0.1, z + r.range(-0.2, 0.2), r.range(-0.4, 0.4), r.range(0.8, 1.8), r.range(-0.4, 0.4), '#3a2a2a', 0.5, 1.4, { grow: 2.4, alpha: 0.5, drag: 0.6 });
    }
  }
  dust(x, y, z, n = 8, color = '#e8dcc0') {
    const r = this.r;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, s = r.range(0.1, 0.7);
      this._e(this.normal, x, y + 0.03, z, Math.cos(a) * s, r.range(0.1, 0.6), Math.sin(a) * s, color, r.range(0.18, 0.34), r.range(0.4, 0.8), { grow: 2, alpha: 0.6, drag: 2 });
    }
  }
  sparks(x, y, z, color = '#ffe27a', n = 16, speed = 3) {
    const r = this.r;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, e = r.range(-0.2, 1) , s = r.range(0.5, 1) * speed;
      this._e(this.add, x, y, z, Math.cos(a) * s, e * s, Math.sin(a) * s, color, r.range(0.05, 0.11), r.range(0.3, 0.6), { grav: 6, drag: 1 });
    }
  }
  trail(x, y, z, color = '#ffffff') {
    this._e(this.add, x, y, z, 0, 0.1, 0, color, 0.09, 0.28, { alpha: 0.6 });
  }
  poof(x, y, z, color = '#ffffff') {
    const r = this.r;
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU, s = r.range(0.3, 1.3);
      this._e(this.add, x, y, z, Math.cos(a) * s, r.range(0.2, 1.4), Math.sin(a) * s, color, r.range(0.08, 0.16), r.range(0.4, 0.8), { drag: 2 });
    }
  }
  confetti(x, y, z, n = 120, power = 1) {
    const r = this.r;
    const cols = ['#ff4d6d', '#ffd23f', '#3ee6b0', '#4da3ff', '#c77dff', '#ff9a3c', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, s = r.range(0.5, 4.2) * power;
      this._e(this.normal, x, y, z, Math.cos(a) * s, r.range(4, 9.5) * power, Math.sin(a) * s, r.pick(cols), r.range(0.1, 0.19), r.range(2.2, 3.6), { grav: 4.4, drag: 1.3, shape: 1, flutter: r.range(10, 22) });
    }
  }
  ring(x, y, z, color = '#fff3a0', n = 48, speed = 3.4) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this._e(this.add, x, y, z, Math.cos(a) * speed, 0.2, Math.sin(a) * speed, color, 0.12, 0.9, { drag: 2.2 });
    }
  }
  firework(x, y, z, color = null) {
    const r = this.r;
    const cols = ['#ff5c8a', '#ffd23f', '#5cf0ff', '#9d7bff', '#7dff9a', '#ff8a3d'];
    const c = color || r.pick(cols);
    const c2 = r.pick(cols);
    // rocket
    for (let i = 0; i < 14; i++) this.timers.push({ t: i * 0.03, fn: () => this._e(this.add, x, y + i * 0.5, z, 0, 0, 0, '#fff2c4', 0.12, 0.4) });
    this.timers.push({
      t: 0.5,
      fn: () => {
        const cy = y + 7.5;
        for (let i = 0; i < 90; i++) {
          const a = r() * TAU, e = Math.acos(r.range(-1, 1)), s = r.range(2.4, 5.4);
          this._e(this.add, x, cy, z, Math.sin(e) * Math.cos(a) * s, Math.cos(e) * s, Math.sin(e) * Math.sin(a) * s, i % 3 ? c : c2, r.range(0.09, 0.17), r.range(1.0, 1.7), { grav: 3.2, drag: 1.4 });
        }
      },
    });
  }
  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        t.fn();
        this.timers.splice(i, 1);
      }
    }
    this.normal.update(dt);
    this.add.update(dt);
  }
  clear() {
    this.normal.life.fill(0);
    this.add.life.fill(0);
    this.timers.length = 0;
  }
}
