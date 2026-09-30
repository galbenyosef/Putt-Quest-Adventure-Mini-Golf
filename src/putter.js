// The player's putter (pulls back while charging, swings on release) and the dotted aim guide.
import * as THREE from 'three';
import { Batch } from './render/toon.js';
import { BALL_R } from './physics.js';
import { clamp, easeOutCubic } from './util.js';

export const SWING_TIME = 0.17;
export const CONTACT_AT = 0.72; // fraction of the swing at which the head meets the ball

export class Putter {
  constructor() {
    this.root = new THREE.Group();
    const b = new Batch({ width: 0.9, shadow: true });
    b.vary = 0;
    // head (local -z is the hitting direction)
    b.box(0, -0.035, 0, 0.36, 0.075, 0.1, '#e9edf7');
    b.box(0, -0.035, -0.055, 0.34, 0.06, 0.012, '#7c86a3'); // face
    b.box(0, 0.04, 0.0, 0.34, 0.012, 0.09, '#ff5a6e'); // top stripe
    b.box(-0.1, 0.0, 0.0, 0.05, 0.02, 0.04, '#1c1233');
    b.box(0.1, 0.0, 0.0, 0.05, 0.02, 0.04, '#1c1233');
    const head = b.build();
    this.root.add(head);
    const sb = new Batch({ width: 0.7 });
    sb.vary = 0;
    sb.cyl(0, 0.04, 0, 0.016, 0.02, 1.25, '#c9d0e6', { seg: 8 });
    sb.cyl(0, 0.85, 0, 0.026, 0.026, 0.42, '#2a2140', { seg: 8 });
    sb.sph(0, 1.28, 0, 0.032, '#ff5a6e', { seg: 8 });
    this.shaft = sb.build();
    this.shaftPivot = new THREE.Group();
    this.shaftPivot.add(this.shaft);
    this.shaftPivot.rotation.set(0.22, 0, -0.5);
    this.root.add(this.shaftPivot);
    this.pull = 0; // 0..1
    this.state = 'idle';
    this.t = 0;
    this.appear = 1;
    this.onContact = null;
    this._contacted = false;
    this.aim = 0;
    this.pos = new THREE.Vector3();
    this.visibleWanted = true;
  }

  swing(power, onContact) {
    this.state = 'swing';
    this.t = 0;
    this.startPull = this.pull;
    this.power = power;
    this.onContact = onContact;
    this._contacted = false;
  }

  cancel() {
    this.state = 'idle';
    this.pull = 0;
  }

  setVisible(v) {
    this.visibleWanted = v;
  }

  update(dt, ball, aim, pullTarget, time) {
    this.aim = aim;
    let back = 0; // distance behind the ball (units)
    let lift = 0;
    if (this.state === 'swing') {
      this.t += dt;
      const u = clamp(this.t / SWING_TIME, 0, 1);
      // accelerating swing – slow start, fast through the ball
      const e = u * u * (1.6 - 0.6 * u);
      const from = this.startPull * 1.15 + 0.0;
      const to = -0.42;
      back = from + (to - from) * e;
      lift = Math.max(0, from) * 0.06 * (1 - u);
      if (!this._contacted && u >= CONTACT_AT) {
        this._contacted = true;
        if (this.onContact) this.onContact();
      }
      if (u >= 1) {
        this.state = 'follow';
        this.t = 0;
      }
    } else if (this.state === 'follow') {
      this.t += dt;
      back = -0.42 - Math.min(0.2, this.t * 0.6);
      if (this.t > 0.55) this.visibleWanted = false;
    } else {
      // idle / charging: smooth pull toward the target
      this.pull += (pullTarget - this.pull) * (1 - Math.exp(-28 * dt));
      back = this.pull * 1.15;
      lift = this.pull * 0.05;
      if (this.state === 'idle') back += Math.sin(time * 2.2) * 0.008;
    }
    // appear / disappear
    const want = this.visibleWanted ? 1 : 0;
    this.appear += (want - this.appear) * (1 - Math.exp(-12 * dt));
    const sc = clamp(this.appear, 0.001, 1);
    this.root.visible = this.appear > 0.02;
    this.root.scale.setScalar(sc);
    const gap = BALL_R + 0.065;
    const fx = Math.sin(aim), fz = -Math.cos(aim);
    this.root.position.set(ball.x - fx * (gap + back), ball.y - BALL_R + 0.08 + lift, ball.z - fz * (gap + back));
    this.root.rotation.y = -aim;
  }

  reset() {
    this.state = 'idle';
    this.pull = 0;
    this.visibleWanted = true;
    this.appear = 0;
    this._contacted = false;
  }
}

// ---------------------------------------------------------------------------------------------
export class AimGuide {
  constructor(count = 26) {
    this.count = count;
    const g = new THREE.CircleGeometry(1, 10);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(g, m, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    // arrow head
    const ah = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, transparent: true, opacity: 0.95, toneMapped: false }));
    ah.rotation.x = -Math.PI / 2;
    this.head = new THREE.Group();
    this.head.add(ah);
    this.headMesh = ah;
    this.root = new THREE.Group();
    this.root.add(this.mesh);
    this.root.add(this.head);
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
    this.visible = true;
  }

  /** ground(x,z,y) → height. */
  update(ball, aim, power, ground, time, charging) {
    if (!this.visible) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const len = charging ? 1.2 + power * 7.5 : 2.6;
    const step = 0.3;
    const n = Math.min(this.count, Math.max(2, Math.floor(len / step)));
    const fx = Math.sin(aim), fz = -Math.cos(aim);
    const col = this._c;
    const pcol = new THREE.Color().setHSL(0.36 - power * 0.36, 0.95, 0.55);
    let lastY = ball.y - BALL_R;
    let ex = ball.x, ez = ball.z;
    for (let i = 0; i < this.count; i++) {
      if (i >= n) {
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
        continue;
      }
      const d = 0.55 + i * step;
      const x = ball.x + fx * d, z = ball.z + fz * d;
      const gy = ground(x, z, ball.y);
      const y = (gy == null ? lastY : gy) + 0.03;
      lastY = y;
      ex = x; ez = z;
      const pulse = 0.5 + 0.5 * Math.sin(time * 6 - i * 0.6);
      const s = (0.045 + 0.02 * pulse) * (1 - (i / this.count) * 0.4);
      this._m.makeScale(s, 1, s);
      this._m.setPosition(x, y, z);
      this.mesh.setMatrixAt(i, this._m);
      if (charging) col.copy(pcol).lerp(new THREE.Color(1, 1, 1), 0.25 - 0.2 * pulse);
      else col.setRGB(1, 1, 1).multiplyScalar(1 - i / (this.count * 1.15));
      this.mesh.setColorAt(i, col);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.head.position.set(ex + fx * 0.25, lastY + 0.04, ez + fz * 0.25);
    this.head.rotation.y = -aim;
    this.headMesh.material.color.copy(charging ? pcol : new THREE.Color(1, 1, 1));
    this.head.visible = true;
  }
}
