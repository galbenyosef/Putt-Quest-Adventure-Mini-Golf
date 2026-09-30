// Small math / helper toolbox shared by the whole game (no DOM access here so it also runs in Node).

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Shortest signed difference between two angles. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const dampAngle = (a, b, lambda, dt) => a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));

/** Deterministic PRNG so every hole is decorated the same way each time. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

/** Distance from point p to segment ab in 2D. */
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

/** Ramer–Douglas–Peucker simplification for 3D polylines given as [x,y,z] arrays. */
export function simplify3D(pts, tol) {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const a = pts[s];
    const b = pts[e];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const abl = abx * abx + aby * aby + abz * abz || 1e-9;
    for (let i = s + 1; i < e; i++) {
      const p = pts[i];
      const apx = p[0] - a[0];
      const apy = p[1] - a[1];
      const apz = p[2] - a[2];
      let t = (apx * abx + apy * aby + apz * abz) / abl;
      t = clamp(t, 0, 1);
      const dx = apx - abx * t;
      const dy = apy - aby * t;
      const dz = apz - abz * t;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx >= 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export const hasDOM = typeof document !== 'undefined';

/** Returns a canvas + 2d context, or null when running headless (Node solver). */
export function makeCanvas(w, h) {
  if (!hasDOM) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { canvas: c, ctx: c.getContext('2d') };
}

/** Smooth circular bump (C1 continuous) for hills: bump(cx,cz,r,h)(x,z). */
export const bump = (cx, cz, r, h, sx = 1, sz = 1) => (x, z) => {
  const d = Math.hypot((x - cx) / sx, (z - cz) / sz) / r;
  if (d >= 1) return 0;
  const c = Math.cos((d * Math.PI) / 2);
  return h * c * c;
};
/** Sum of height functions. */
export const sumFn = (...fns) => (x, z) => {
  let s = 0;
  for (const f of fns) s += f(x, z);
  return s;
};
