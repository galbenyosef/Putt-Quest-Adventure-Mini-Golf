// Custom ball physics for the mini-golf courses.
//
// The world is made of
//   * ground triangles (rendered AND collided – the mesh is the truth),
//   * static wall capsules (vertical prisms with rounded ends),
//   * kinematic capsules (spinning blades, pistons, dinosaur tail…),
//   * movers (moving platforms whose triangles are carried through space),
//   * triggers (portals, boost pads, pipes/tunnels) and the cup.
// The ball is integrated with small fixed sub-steps so that it can never tunnel through anything.
import { clamp } from './util.js';

export const BALL_R = 0.11;
export const GRAV = 13;
export const CUP_R = 0.27;
export const MAX_SPEED = 16;
export const PUTT_MAX = 11.6; // ball speed at 100% power (units / s)
export const STEP = 1 / 240;

/** Surface table – friction is the rolling deceleration in units / s². */
export const SURFACES = {
  grass: { id: 0, fric: 1.9, pattern: 'mow', color: '#5ecb52' },
  sand: { id: 1, fric: 9.5, pattern: 'dots', color: '#f0d98c' },
  ice: { id: 2, fric: 0.5, pattern: 'ice', color: '#bde9ff' },
  snow: { id: 3, fric: 3.6, pattern: 'dots', color: '#f2f8ff' },
  wood: { id: 4, fric: 1.7, pattern: 'planks', color: '#c98d52' },
  stone: { id: 5, fric: 1.8, pattern: 'tiles', color: '#a4a9c0' },
  metal: { id: 6, fric: 1.5, pattern: 'tiles', color: '#8f9bb3' },
  mud: { id: 7, fric: 5.5, pattern: 'dots', color: '#7a5636' },
  conveyor: { id: 8, fric: 0.6, pattern: 'conv', color: '#3b3f52' },
  water: { id: 9, fric: 1, hazard: 'water', pattern: 'none', color: '#3db6ff' },
  lava: { id: 10, fric: 1, hazard: 'lava', pattern: 'none', color: '#ff5a1a' },
  rock: { id: 11, fric: 2.4, pattern: 'dots', color: '#8a7a8c' },
};
export const SURF_LIST = Object.keys(SURFACES);
const SURF_BY_ID = SURF_LIST.map((k) => SURFACES[k]);

const GRID = 1.0;
const gkey = (ix, iz) => (ix + 512) * 1024 + (iz + 512);

// ---------------------------------------------------------------------------------------------
// Triangle soup with a spatial hash
// ---------------------------------------------------------------------------------------------
export class TriSet {
  constructor() {
    this.t = []; // flat records
    this.n = 0;
    this.grid = null;
    this.dirty = true;
  }

  /** Add a triangle. a,b,c = [x,y,z]. Auto-orients so the normal points up. Returns index. */
  add(a, b, c, surf = 'grass', extra = null) {
    // orient upward
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    if (ny < 0) {
      [b, c] = [c, b];
      nx = -nx; ny = -ny; nz = -nz;
    }
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return -1;
    nx /= len; ny /= len; nz /= len;
    // barycentric denominators in xz
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-9) return -1; // vertical triangle
    const rec = {
      ax: a[0], ay: a[1], az: a[2],
      bx: b[0], by: b[1], bz: b[2],
      cx: c[0], cy: c[1], cz: c[2],
      nx, ny, nz, inv: 1 / den,
      surf: SURFACES[surf].id,
      minX: Math.min(a[0], b[0], c[0]), maxX: Math.max(a[0], b[0], c[0]),
      minZ: Math.min(a[2], b[2], c[2]), maxZ: Math.max(a[2], b[2], c[2]),
      extra,
    };
    this.t.push(rec);
    this.dirty = true;
    return this.t.length - 1;
  }

  build() {
    this.grid = new Map();
    for (let i = 0; i < this.t.length; i++) {
      const r = this.t[i];
      const x0 = Math.floor(r.minX / GRID), x1 = Math.floor(r.maxX / GRID);
      const z0 = Math.floor(r.minZ / GRID), z1 = Math.floor(r.maxZ / GRID);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = gkey(ix, iz);
          let l = this.grid.get(k);
          if (!l) this.grid.set(k, (l = []));
          l.push(r);
        }
      }
    }
    this.dirty = false;
  }

  /** Highest triangle under (x,z) whose surface is at or below yMax. Returns the record (with .y set) or null. */
  query(x, z, yMax) {
    if (this.dirty) this.build();
    const l = this.grid.get(gkey(Math.floor(x / GRID), Math.floor(z / GRID)));
    if (!l) return null;
    let best = null;
    let by = -1e9;
    const EPS = -0.004;
    for (let i = 0; i < l.length; i++) {
      const r = l[i];
      if (x < r.minX - 0.005 || x > r.maxX + 0.005 || z < r.minZ - 0.005 || z > r.maxZ + 0.005) continue;
      const l1 = ((r.bz - r.cz) * (x - r.cx) + (r.cx - r.bx) * (z - r.cz)) * r.inv;
      const l2 = ((r.cz - r.az) * (x - r.cx) + (r.ax - r.cx) * (z - r.cz)) * r.inv;
      const l3 = 1 - l1 - l2;
      if (l1 < EPS || l2 < EPS || l3 < EPS) continue;
      const y = l1 * r.ay + l2 * r.by + l3 * r.cy;
      if (y <= yMax && y > by) {
        by = y;
        best = r;
      }
    }
    if (best) {
      _hit.y = by;
      _hit.tri = best;
      return _hit;
    }
    return null;
  }
}
const _hit = { y: 0, tri: null };

// ---------------------------------------------------------------------------------------------
// Movers (moving platforms)
// ---------------------------------------------------------------------------------------------
export class Mover {
  constructor() {
    this.tris = new TriSet(); // local space
    this.x = 0; this.y = 0; this.z = 0; this.rot = 0;
    this.px = 0; this.py = 0; this.pz = 0; this.prot = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.group = null; // visual group (set by the course builder)
    this.built = false;
  }
  setPose(x, y, z, rot = 0) {
    this.x = x; this.y = y; this.z = z; this.rot = rot;
    if (this.group) {
      this.group.position.set(x, y, z);
      this.group.rotation.y = rot;
    }
  }
  /** Local → world point (rotation about Y then translation). */
  toWorld(lx, ly, lz, out = [0, 0, 0]) {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    out[0] = this.x + lx * c + lz * s;
    out[1] = this.y + ly;
    out[2] = this.z - lx * s + lz * c;
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// The physics world
// ---------------------------------------------------------------------------------------------
export class World {
  /** @param {object} course – object produced by CourseBuilder.finish() */
  constructor(course) {
    this.course = course;
    this.tris = course.tris;
    this.walls = course.walls;
    this.kins = course.kins;
    this.movers = course.movers;
    this.triggers = course.triggers;
    this.pipes = course.pipes;
    this.t = 0;
    this.events = [];
    this.ball = {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      mode: 'free', grounded: false, mover: null, surf: 0,
      rest: 0, holeT: 0, lastGround: null,
      pipe: null, portalCd: 0, spin: 0,
      nx: 0, ny: 1, nz: 0,
      hazardSteps: 0,
    };
    this.cup = course.cup;
    this.shotTime = 0;
    for (const k of this.kins) k.step(0, STEP, true);
  }

  place(x, z, yHint = null) {
    const b = this.ball;
    const yq = yHint == null ? 1e3 : yHint + 0.3;
    const h = this._queryAll(x, yq + BALL_R - 0.2, z);
    b.x = x;
    b.z = z;
    b.y = (h ? h.y : this.course.tee.y) + BALL_R + 0.001;
    b.vx = b.vy = b.vz = 0;
    b.mode = 'free';
    b.grounded = false;
    b.mover = null;
    b.rest = 0;
    b.pipe = null;
    b.holeT = 0;
    b.portalCd = 0.3;
    b.hazardSteps = 0;
    this.shotTime = 0;
    // settle onto the ground
    for (let i = 0; i < 12; i++) this._ground(STEP);
    b.vx = b.vy = b.vz = 0;
  }

  putt(aim, speed) {
    const b = this.ball;
    if (b.mode !== 'free') return;
    b.vx = Math.sin(aim) * speed;
    b.vz = -Math.cos(aim) * speed;
    b.vy = 0;
    b.rest = 0;
    b.grounded = false;
    this.shotTime = 0;
  }

  get speed() {
    const b = this.ball;
    return Math.hypot(b.vx, b.vy, b.vz);
  }

  stepFrame(dt) {
    let acc = Math.min(dt, 0.05);
    while (acc > 1e-6) {
      const h = Math.min(acc, STEP);
      this.step(h);
      acc -= h;
    }
  }

  step(dt) {
    this.t += dt;
    for (let i = 0; i < this.kins.length; i++) this.kins[i].step(this.t, dt, false);
    const b = this.ball;
    if (b.portalCd > 0) b.portalCd -= dt;
    if (b.mode === 'pipe') return this._stepPipe(dt);
    if (b.mode === 'cup') return this._stepCup(dt);
    if (b.mode === 'dead') return;

    this.shotTime += dt;

    // Ride moving platforms
    if (b.mover) this._carry(b, b.mover);

    // Integrate
    b.vy -= GRAV * dt;
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    if (sp > MAX_SPEED) {
      const k = MAX_SPEED / sp;
      b.vx *= k; b.vy *= k; b.vz *= k;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    for (let it = 0; it < 3; it++) {
      this._walls();
      this._kinematics();
      this._ground(dt);
    }
    if (b.grounded) this._friction(dt);
    this._triggers(dt);
    if (b.mode !== 'free') return;
    this._cup(dt);
    if (b.mode !== 'free') return;
    this._hazards();

    // Rest detection
    const hs = Math.hypot(b.vx, b.vz);
    let relSpeed = hs;
    if (b.mover) relSpeed = Math.hypot(b.vx, b.vz);
    if (b.grounded && relSpeed < 0.05 && Math.abs(b.vy) < 0.3) b.rest += dt;
    else b.rest = 0;
  }

  // -- moving platforms ---------------------------------------------------------------------
  _carry(b, m) {
    const dr = m.rot - m.prot;
    let dx = b.x - m.px;
    let dz = b.z - m.pz;
    if (dr !== 0) {
      const c = Math.cos(dr), s = Math.sin(dr);
      const rx = dx * c + dz * s;
      const rz = -dx * s + dz * c;
      dx = rx; dz = rz;
      const vx = b.vx * c + b.vz * s;
      const vz = -b.vx * s + b.vz * c;
      b.vx = vx; b.vz = vz;
    }
    b.x = m.x + dx;
    b.z = m.z + dz;
    b.y += m.y - m.py;
  }

  // -- walls ---------------------------------------------------------------------------------
  _walls() {
    const b = this.ball;
    const W = this.walls;
    const R = BALL_R;
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      if (b.x < w.minX - R || b.x > w.maxX + R || b.z < w.minZ - R || b.z > w.maxZ + R) continue;
      if (b.y - R > w.y1 || b.y + R < w.y0) continue;
      // closest point on segment
      const dx = w.bx - w.ax;
      const dz = w.bz - w.az;
      let t = w.l2 > 0 ? ((b.x - w.ax) * dx + (b.z - w.az) * dz) / w.l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = w.ax + dx * t;
      const cz = w.az + dz * t;
      let ex = b.x - cx;
      let ez = b.z - cz;
      const md = R + w.r;
      const d2 = ex * ex + ez * ez;
      if (d2 >= md * md) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-6) {
        // centre exactly on the segment: push along the segment normal, away from the last velocity
        const l = Math.sqrt(w.l2) || 1;
        ex = -dz / l;
        ez = dx / l;
        if (ex * b.vx + ez * b.vz > 0) { ex = -ex; ez = -ez; }
        d = 1e-6;
      } else {
        ex /= d; ez /= d;
      }
      // If the wall top is lower than the ball centre, let the ball roll over/onto instead of bouncing
      b.x += ex * (md - d);
      b.z += ez * (md - d);
      const vn = b.vx * ex + b.vz * ez;
      if (vn < 0) {
        const e = w.e;
        b.vx -= (1 + e) * vn * ex;
        b.vz -= (1 + e) * vn * ez;
        // scrape friction on the tangential part
        b.vx *= 0.985; b.vz *= 0.985;
        if (w.kick) {
          const out = Math.hypot(b.vx, b.vz);
          if (out < w.kick) {
            const k = w.kick / (out || 1);
            b.vx = out > 1e-3 ? b.vx * k : ex * w.kick;
            b.vz = out > 1e-3 ? b.vz * k : ez * w.kick;
          }
          this.events.push({ type: 'bumper', ref: w.ref, x: cx, z: cz, nx: ex, nz: ez, speed: -vn });
        } else if (-vn > 0.7) {
          this.events.push({ type: 'wall', speed: -vn, x: b.x - ex * R, y: b.y, z: b.z - ez * R });
        }
      }
    }
  }

  // -- kinematic capsules ---------------------------------------------------------------------
  _kinematics() {
    const b = this.ball;
    const R = BALL_R;
    const K = this.kins;
    for (let i = 0; i < K.length; i++) {
      const caps = K[i].caps;
      for (let j = 0; j < caps.length; j++) {
        const c = caps[j];
        if (c.off) continue;
        const abx = c.bx - c.ax, aby = c.by - c.ay, abz = c.bz - c.az;
        const l2 = abx * abx + aby * aby + abz * abz;
        const px = b.x - c.ax, py = b.y - c.ay, pz = b.z - c.az;
        let s = l2 > 0 ? (px * abx + py * aby + pz * abz) / l2 : 0;
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        const qx = c.ax + abx * s, qy = c.ay + aby * s, qz = c.az + abz * s;
        let nx = b.x - qx, ny = b.y - qy, nz = b.z - qz;
        const md = R + c.r;
        const d2 = nx * nx + ny * ny + nz * nz;
        if (d2 >= md * md) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) { nx = 0; ny = 1; nz = 0; d = 1e-6; } else { nx /= d; ny /= d; nz /= d; }
        b.x += nx * (md - d);
        b.y += ny * (md - d);
        b.z += nz * (md - d);
        const wvx = c.vax + (c.vbx - c.vax) * s;
        const wvy = c.vay + (c.vby - c.vay) * s;
        const wvz = c.vaz + (c.vbz - c.vaz) * s;
        const rvx = b.vx - wvx, rvy = b.vy - wvy, rvz = b.vz - wvz;
        const vn = rvx * nx + rvy * ny + rvz * nz;
        if (vn < 0) {
          const e = c.e;
          b.vx -= (1 + e) * vn * nx;
          b.vy -= (1 + e) * vn * ny;
          b.vz -= (1 + e) * vn * nz;
          if (c.kick) {
            const out = Math.hypot(b.vx, b.vz);
            if (out < c.kick) { const k = c.kick / (out || 1); b.vx = out > 1e-3 ? b.vx * k : nx * c.kick; b.vz = out > 1e-3 ? b.vz * k : nz * c.kick; }
            this.events.push({ type: 'bumper', ref: c.ref, x: qx, z: qz, nx, nz, speed: -vn });
          } else if (-vn > 0.9) {
            this.events.push({ type: c.sound || 'wall', speed: -vn, x: qx, y: qy, z: qz });
          }
        }
      }
    }
  }

  // -- ground ----------------------------------------------------------------------------------
  _queryAll(x, y, z) {
    // static triangles first
    const yMax = y - BALL_R + 0.2;
    let best = this.tris.query(x, z, yMax);
    let bestY = best ? best.y : -1e9;
    let tri = best ? best.tri : null;
    let mover = null;
    let ny = tri ? tri.ny : 1, nx = tri ? tri.nx : 0, nz = tri ? tri.nz : 0;
    for (let i = 0; i < this.movers.length; i++) {
      const m = this.movers[i];
      const dx = x - m.x, dz = z - m.z;
      const c = Math.cos(m.rot), s = Math.sin(m.rot);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const h = m.tris.query(lx, lz, yMax - m.y);
      if (h && h.y + m.y > bestY) {
        bestY = h.y + m.y;
        tri = h.tri;
        mover = m;
        // rotate normal into world space
        nx = h.tri.nx * c + h.tri.nz * s;
        nz = -h.tri.nx * s + h.tri.nz * c;
        ny = h.tri.ny;
      }
    }
    if (!tri) return null;
    _g.y = bestY; _g.tri = tri; _g.mover = mover; _g.nx = nx; _g.ny = ny; _g.nz = nz;
    return _g;
  }

  _ground(dt) {
    const b = this.ball;
    const g = this._queryAll(b.x, b.y, b.z);
    b.grounded = false;
    b.lastGround = null;
    if (!g) {
      b.mover = null;
      return;
    }
    // signed distance of the ball surface to the plane
    const nx = g.nx, ny = g.ny, nz = g.nz;
    const sd = (b.y - g.y) * ny - BALL_R; // (x,z is on the plane by construction) vertical offset projected on normal
    b.lastGround = g;
    if (sd < 0.02) {
      const surf = SURF_BY_ID[g.tri.surf];
      if (sd < 0) {
        // push out along the normal (mostly vertical)
        b.x += nx * -sd;
        b.y += ny * -sd;
        b.z += nz * -sd;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn < 0) {
          let e = 0;
          if (-vn > 1.6 && !surf.hazard) {
            e = 0.34;
            this.events.push({ type: 'land', speed: -vn, x: b.x, y: b.y - BALL_R, z: b.z });
          }
          b.vx -= (1 + e) * vn * nx;
          b.vy -= (1 + e) * vn * ny;
          b.vz -= (1 + e) * vn * nz;
        }
      }
      b.grounded = true;
      b.surf = g.tri.surf;
      b.nx = nx; b.ny = ny; b.nz = nz;
      b.mover = g.mover;
    } else {
      b.mover = null;
    }
  }

  _friction(dt) {
    const b = this.ball;
    const g = b.lastGround;
    if (!g) return;
    const surf = SURF_BY_ID[g.tri.surf];
    if (surf.hazard) return;
    const nx = b.nx, ny = b.ny, nz = b.nz;
    let vn = b.vx * nx + b.vy * ny + b.vz * nz;
    let tx = b.vx - vn * nx;
    let ty = b.vy - vn * ny;
    let tz = b.vz - vn * nz;
    // conveyor: drag toward belt velocity
    const ex = g.tri.extra;
    let cvx = 0, cvz = 0;
    let dec = surf.fric;
    if (ex && ex.conv) {
      cvx = ex.conv[0]; cvz = ex.conv[1];
      dec = 5.5;
    }
    const rx = tx - cvx, rz = tz - cvz, ry = ty;
    const sp = Math.hypot(rx, ry, rz);
    if (sp < 1e-6) return;
    // speed-proportional drag adds a natural feel
    const d = (dec + (ex && ex.conv ? 0 : 0.11 * sp)) * dt;
    if (ex && ex.conv) {
      const k = Math.min(1, d / sp);
      tx -= rx * k; ty -= ry * k; tz -= rz * k;
    } else if (sp <= d) {
      tx = 0; ty = 0; tz = 0;
    } else {
      const k = d / sp;
      tx -= rx * k; ty -= ry * k; tz -= rz * k;
    }
    b.vx = tx + vn * nx;
    b.vy = ty + vn * ny;
    b.vz = tz + vn * nz;
  }

  // -- hazards ---------------------------------------------------------------------------------
  _hazards() {
    const b = this.ball;
    const g = b.lastGround;
    if (g && b.grounded) {
      const surf = SURF_BY_ID[g.tri.surf];
      if (surf.hazard) {
        this._die(surf.hazard);
        return;
      }
    }
    const c = this.course;
    if (b.y < c.oobY || b.x < c.bounds.minX - 6 || b.x > c.bounds.maxX + 6 || b.z < c.bounds.minZ - 6 || b.z > c.bounds.maxZ + 6) {
      this._die('oob');
    }
  }

  _die(kind) {
    const b = this.ball;
    if (b.mode === 'dead') return;
    b.mode = 'dead';
    this.events.push({ type: 'hazard', kind, x: b.x, y: b.y - BALL_R, z: b.z });
  }

  // -- cup ---------------------------------------------------------------------------------------
  _cup(dt) {
    const b = this.ball;
    const cup = this.cup;
    if (!cup) return;
    const dx = cup.x - b.x, dz = cup.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d > CUP_R * 1.6) return;
    if (b.y - BALL_R > cup.y + 0.2) return; // flying over
    const sp = Math.hypot(b.vx, b.vz);
    // gentle gravity well close to the rim so slow putts "fall in"
    if (d < CUP_R * 1.35 && sp < 3.2 && b.grounded) {
      const pull = 5.5 * (1 - d / (CUP_R * 1.35));
      b.vx += (dx / (d || 1)) * pull * dt;
      b.vz += (dz / (d || 1)) * pull * dt;
    }
    const vcap = 5.2 - 3.0 * (d / CUP_R);
    if (d < CUP_R * 0.92 && sp < vcap) {
      b.mode = 'cup';
      b.holeT = 0;
      b.sx = b.x; b.sz = b.z; b.sy = b.y;
      this.events.push({ type: 'cup', speed: sp });
    }
  }

  _stepCup(dt) {
    const b = this.ball;
    const cup = this.cup;
    b.holeT += dt;
    const t = Math.min(1, b.holeT / 0.28);
    b.x = b.sx + (cup.x - b.sx) * t;
    b.z = b.sz + (cup.z - b.sz) * t;
    b.y = b.sy + (cup.y + BALL_R - 0.42 - b.sy) * (t * t);
    b.vx = b.vy = b.vz = 0;
  }

  // -- triggers ----------------------------------------------------------------------------------
  _triggers(dt) {
    const b = this.ball;
    const T = this.triggers;
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      const dx = b.x - t.x, dz = b.z - t.z;
      const dy = b.y - t.y;
      if (t.kind === 'portal') {
        if (b.portalCd > 0) continue;
        if (dx * dx + dz * dz < t.r * t.r && Math.abs(dy) < 0.6) {
          const o = t.target;
          const sp = Math.max(Math.hypot(b.vx, b.vz), 2.4);
          b.x = o.x + Math.sin(o.exit) * 0.45;
          b.z = o.z - Math.cos(o.exit) * 0.45;
          b.y = o.ty + BALL_R + 0.02;
          b.vx = Math.sin(o.exit) * sp;
          b.vz = -Math.cos(o.exit) * sp;
          b.vy = 0;
          b.portalCd = 0.6;
          b.mover = null;
          this.events.push({ type: 'portal', from: t, to: o });
        }
      } else if (t.kind === 'boost') {
        if (t.cd > 0) t.cd -= dt;
        if (dx * dx + dz * dz < t.r * t.r && Math.abs(dy) < 0.5 && b.grounded) {
          const along = b.vx * t.dx + b.vz * t.dz;
          if (along < t.power) {
            const add = Math.min(t.power - along, 46 * dt);
            b.vx += t.dx * add;
            b.vz += t.dz * add;
          }
          if (t.cd <= 0) {
            this.events.push({ type: 'boost', ref: t });
            t.cd = 0.6;
          }
        }
      } else if (t.kind === 'pipe') {
        // entering a tube / loop
        if (dx * dx + dz * dz < t.r * t.r && Math.abs(dy) < 0.55) {
          const sp = Math.hypot(b.vx, b.vz);
          if (sp > 0.45 && b.vx * t.dx + b.vz * t.dz > 0.1 * sp) {
            this._enterPipe(t);
            return;
          }
        }
      }
    }
  }

  _enterPipe(t) {
    const b = this.ball;
    const p = t.pipe;
    b.mode = 'pipe';
    b.pipe = { pipe: p, s: t.end === 0 ? 0 : p.length, dir: t.end === 0 ? 1 : -1, v: Math.hypot(b.vx, b.vz) * 1.0 };
    b.mover = null;
    this.events.push({ type: 'pipeIn', pipe: p });
    this._pipePos();
  }

  _pipePos() {
    const b = this.ball;
    const st = b.pipe;
    const p = st.pipe;
    // locate arclength s in the sample table
    const f = clamp(st.s / p.length, 0, 1) * (p.n - 1);
    const i = Math.min(p.n - 2, Math.floor(f));
    const u = f - i;
    const P = p.pts;
    b.x = P[i * 3] + (P[i * 3 + 3] - P[i * 3]) * u;
    b.y = P[i * 3 + 1] + (P[i * 3 + 4] - P[i * 3 + 1]) * u;
    b.z = P[i * 3 + 2] + (P[i * 3 + 5] - P[i * 3 + 2]) * u;
    let tx = P[i * 3 + 3] - P[i * 3];
    let ty = P[i * 3 + 4] - P[i * 3 + 1];
    let tz = P[i * 3 + 5] - P[i * 3 + 2];
    const l = Math.hypot(tx, ty, tz) || 1;
    st.tx = (tx / l) * st.dir;
    st.ty = (ty / l) * st.dir;
    st.tz = (tz / l) * st.dir;
  }

  _stepPipe(dt) {
    const b = this.ball;
    const st = b.pipe;
    const p = st.pipe;
    // energy: slow down going uphill, speed up going downhill
    st.v += (-GRAV * st.ty - 0.55) * dt;
    if (st.v <= 0.05) {
      // not enough speed: roll back out the way we came
      st.dir = -st.dir;
      st.v = 0.3;
    }
    st.s += st.dir * st.v * dt;
    if (st.s <= 0 || st.s >= p.length) {
      // exit
      const atEnd = st.s >= p.length;
      st.s = atEnd ? p.length : 0;
      this._pipePos();
      b.mode = 'free';
      const sp = st.v;
      b.vx = st.tx * sp;
      b.vy = st.ty * sp;
      b.vz = st.tz * sp;
      b.x += st.tx * 0.32;
      b.z += st.tz * 0.32;
      b.portalCd = 0.5;
      b.pipe = null;
      b.grounded = false;
      // nudge out so we do not immediately re-enter the trigger
      this.events.push({ type: 'pipeOut', pipe: p });
      return;
    }
    this._pipePos();
    b.vx = st.tx * st.v;
    b.vy = st.ty * st.v;
    b.vz = st.tz * st.v;
  }
}
const _g = { y: 0, tri: null, mover: null, nx: 0, ny: 1, nz: 0 };

/** Kinematic collider group (spinning blades, pistons…). `update(t)` must fill the caps' endpoints. */
export class Kinematic {
  constructor(update) {
    this.update = update;
    this.caps = [];
    this.movers = [];
  }
  /** Add a capsule slot. Returns the capsule so callers can write ax..bz each update. */
  cap(r, opts = {}) {
    const c = {
      r, e: opts.e ?? 0.62, kick: opts.kick || 0, sound: opts.sound, ref: opts.ref, off: false,
      ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0,
      pax: 0, pay: 0, paz: 0, pbx: 0, pby: 0, pbz: 0,
      vax: 0, vay: 0, vaz: 0, vbx: 0, vby: 0, vbz: 0,
    };
    this.caps.push(c);
    return c;
  }
  step(t, dt, init) {
    for (const c of this.caps) {
      c.pax = c.ax; c.pay = c.ay; c.paz = c.az; c.pbx = c.bx; c.pby = c.by; c.pbz = c.bz;
    }
    for (const m of this.movers) {
      m.px = m.x; m.py = m.y; m.pz = m.z; m.prot = m.rot;
    }
    this.update(t, dt);
    if (init) for (const m of this.movers) { m.px = m.x; m.py = m.y; m.pz = m.z; m.prot = m.rot; }
    if (init) {
      for (const c of this.caps) { c.pax = c.ax; c.pay = c.ay; c.paz = c.az; c.pbx = c.bx; c.pby = c.by; c.pbz = c.bz; }
    }
    const inv = 1 / dt;
    for (const c of this.caps) {
      c.vax = (c.ax - c.pax) * inv; c.vay = (c.ay - c.pay) * inv; c.vaz = (c.az - c.paz) * inv;
      c.vbx = (c.bx - c.pbx) * inv; c.vby = (c.by - c.pby) * inv; c.vbz = (c.bz - c.pbz) * inv;
    }
  }
}

/** Build a static wall record (capsule in XZ extruded between y0 and y1). */
export function makeWall(ax, az, bx, bz, r, y0, y1, opts = {}) {
  const dx = bx - ax, dz = bz - az;
  return {
    ax, az, bx, bz, r, y0, y1,
    e: opts.e ?? 0.72,
    kick: opts.kick || 0,
    ref: opts.ref || null,
    l2: dx * dx + dz * dz,
    minX: Math.min(ax, bx) - r, maxX: Math.max(ax, bx) + r,
    minZ: Math.min(az, bz) - r, maxZ: Math.max(az, bz) + r,
  };
}
