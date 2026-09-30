// Camera director: first-person aim view, chase-cam while the ball rolls, course fly-over, cup orbit, overview.
import * as THREE from 'three';
import { clamp, lerp, damp, easeInOutCubic, dampAngle, smoothstep } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 5, 5);
    this.look = new THREE.Vector3();
    this.mode = 'menu';
    this.blend = 1;
    this.aim = 0; // heading (0 = -z)
    this.elev = 0.22; // 0 low .. 1 high (mouse Y)
    this.fdir = new THREE.Vector3(0, 0, -1);
    this.t = 0;
    this.fov = 62;
    this.fly = null;
    this.shake = 0;
    this.overview = 0; // 0..1 blend
    this.course = null;
    this.cupOrbit = 0;
  }

  setCourse(course) {
    this.course = course;
    const pts = (course.route || []).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.routeCurve = pts.length > 1 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : null;
    this.routeLen = this.routeCurve ? this.routeCurve.getLength() : 10;
    if (course.flyKeys && course.flyKeys.length > 1) {
      this.keyP = new THREE.CatmullRomCurve3(course.flyKeys.map((k) => new THREE.Vector3(...k.p)), false, 'centripetal');
      this.keyL = new THREE.CatmullRomCurve3(course.flyKeys.map((k) => new THREE.Vector3(...k.l)), false, 'centripetal');
    } else {
      this.keyP = this.keyL = null;
    }
  }

  snapToAim(ball) {
    this.computeAim(ball, _a, _b);
    this.pos.copy(_a);
    this.look.copy(_b);
    this.apply();
  }

  /** camera position + look-at for the first-person aim view */
  computeAim(ball, outPos, outLook) {
    const e = this.elev;
    const fx = Math.sin(this.aim), fz = -Math.cos(this.aim);
    const back = 1.75 + e * 0.5;
    const up = 0.62 + e * 1.55;
    outPos.set(ball.x - fx * back, ball.y + up, ball.z - fz * back);
    const ahead = 5.5 - e * 4.0;
    outLook.set(ball.x + fx * ahead, ball.y - 0.05 - e * 0.5, ball.z + fz * ahead);
  }

  startFly() {
    this.mode = 'fly';
    this.t = 0;
    const len = this.routeLen;
    this.flyDur = this.keyP ? this.course.flyDur || 7 : clamp(len / 5.0, 4.5, 8);
  }
  flyProgress() {
    return this.mode === 'fly' ? clamp(this.t / this.flyDur, 0, 1) : 1;
  }
  flyDone() {
    return this.mode === 'fly' && this.t >= this.flyDur;
  }

  setMode(m, keepPos = true) {
    if (this.mode === m) return;
    this.mode = m;
    this.t = 0;
    if (m === 'aim') this.blend = 0;
    if (m === 'follow') this.blend = 0;
  }

  addShake(a) {
    this.shake = Math.max(this.shake, a);
  }

  update(dt, ball, opts = {}) {
    this.t += dt;
    const cam = this.cam;
    const wantFov = 62;
    let posL = 8;
    let lookL = 10;
    switch (this.mode) {
      case 'aim': {
        this.blend = Math.min(1, this.blend + dt / 1.1);
        this.computeAim(ball, _a, _b);
        // overview blend (hold space)
        if (this.overview > 0.001) {
          this.overviewTarget(ball, _c, _d, this.overview);
          const ov = easeInOutCubic(this.overview);
          _a.lerp(_c, ov);
          _b.lerp(_d, ov);
        }
        this.target = _a;
        const b = smoothstep(0, 1, this.blend);
        posL = lerp(2.6, 26, b * b) + (this.overview > 0.01 ? -10 : 0);
        lookL = lerp(3.4, 40, b * b);
        this.pos.x = damp(this.pos.x, _a.x, posL, dt);
        this.pos.y = damp(this.pos.y, _a.y, posL, dt);
        this.pos.z = damp(this.pos.z, _a.z, posL, dt);
        this.look.x = damp(this.look.x, _b.x, lookL, dt);
        this.look.y = damp(this.look.y, _b.y, lookL, dt);
        this.look.z = damp(this.look.z, _b.z, lookL, dt);
        break;
      }
      case 'follow': {
        this.blend = Math.min(1, this.blend + dt / 0.8);
        const hs = Math.hypot(ball.vx, ball.vz);
        if (hs > 1.2) {
          _c.set(ball.vx, 0, ball.vz).normalize();
          const k = 1 - Math.exp(-2.6 * dt);
          this.fdir.lerp(_c, k).normalize();
        }
        const dist = 3.1 + Math.min(1.2, hs * 0.08);
        _a.set(ball.x - this.fdir.x * dist, ball.y + 1.6 + Math.min(0.8, hs * 0.05), ball.z - this.fdir.z * dist);
        _b.set(ball.x + this.fdir.x * 1.5, ball.y - 0.1, ball.z + this.fdir.z * 1.5);
        this.pos.x = damp(this.pos.x, _a.x, 3.2, dt);
        this.pos.y = damp(this.pos.y, _a.y, 3.2, dt);
        this.pos.z = damp(this.pos.z, _a.z, 3.2, dt);
        this.look.x = damp(this.look.x, _b.x, 6, dt);
        this.look.y = damp(this.look.y, _b.y, 6, dt);
        this.look.z = damp(this.look.z, _b.z, 6, dt);
        break;
      }
      case 'fly': {
        this.flyPose(_a, _b);
        this.pos.x = damp(this.pos.x, _a.x, 6, dt);
        this.pos.y = damp(this.pos.y, _a.y, 6, dt);
        this.pos.z = damp(this.pos.z, _a.z, 6, dt);
        this.look.x = damp(this.look.x, _b.x, 8, dt);
        this.look.y = damp(this.look.y, _b.y, 8, dt);
        this.look.z = damp(this.look.z, _b.z, 8, dt);
        break;
      }
      case 'cup': {
        const cup = this.course.cup;
        this.cupOrbit += dt * 0.55;
        const r = 3.4;
        _a.set(cup.x + Math.cos(this.cupOrbit) * r, cup.y + 1.5 + Math.min(1, this.t * 0.5), cup.z + Math.sin(this.cupOrbit) * r);
        _b.set(cup.x, cup.y + 0.55, cup.z);
        this.pos.x = damp(this.pos.x, _a.x, 2.4, dt);
        this.pos.y = damp(this.pos.y, _a.y, 2.4, dt);
        this.pos.z = damp(this.pos.z, _a.z, 2.4, dt);
        this.look.x = damp(this.look.x, _b.x, 5, dt);
        this.look.y = damp(this.look.y, _b.y, 5, dt);
        this.look.z = damp(this.look.z, _b.z, 5, dt);
        break;
      }
      case 'menu': {
        const b = this.course.bounds;
        const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        const rad = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.55 + 7;
        const a = this.t * 0.07 + 0.5;
        _a.set(cx + Math.cos(a) * rad, (b.minY + b.maxY) / 2 + 7.5, cz + Math.sin(a) * rad);
        _b.set(cx, (b.minY + b.maxY) / 2, cz);
        this.pos.copy(_a);
        this.look.copy(_b);
        break;
      }
      default:
        break;
    }
    // FOV kick with speed
    let fovT = wantFov;
    if (this.mode === 'follow') fovT += Math.min(10, Math.hypot(ball.vx, ball.vz) * 0.7);
    if (this.mode === 'aim' && this.overview > 0.1) fovT += 4 * this.overview;
    this.fov = damp(this.fov, fovT, 4, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    this.apply(dt);
  }

  apply(dt = 0.016) {
    const cam = this.cam;
    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.25;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.25;
      cam.position.z += (Math.random() - 0.5) * this.shake * 0.25;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    cam.lookAt(this.look);
  }

  overviewTarget(ball, outPos, outLook, k) {
    const b = this.course.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const ext = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const h = ext * 0.62 + 5;
    const aspect = this.cam.aspect;
    outPos.set(cx, (b.minY + b.maxY) / 2 + h, cz + h * 0.42);
    outLook.set(cx, (b.minY + b.maxY) / 2, cz);
    // keep the look target blended for the aim camera use
    return outPos;
  }

  flyPose(outPos, outLook) {
    const u = easeInOutCubic(clamp(this.t / this.flyDur, 0, 1));
    if (this.keyP) {
      this.keyP.getPoint(u, outPos);
      this.keyL.getPoint(u, outLook);
      return;
    }
    const s = u;
    const curve = this.routeCurve;
    if (!curve) {
      outPos.set(0, 6, 6);
      outLook.set(0, 0, 0);
      return;
    }
    const p = curve.getPoint(s);
    const tan = curve.getTangent(s);
    const side = _c.crossVectors(tan, UP).normalize();
    // camera hovers above / behind the moving focus point and slowly swings around it
    const swing = Math.sin(s * Math.PI) * 2.6;
    outPos.copy(p).addScaledVector(tan, -4.6).addScaledVector(UP, 3.4 + Math.sin(s * Math.PI) * 1.4).addScaledVector(side, swing);
    const ahead = curve.getPoint(Math.min(1, s + 0.1));
    outLook.copy(ahead).addScaledVector(UP, 0.3);
  }
}
