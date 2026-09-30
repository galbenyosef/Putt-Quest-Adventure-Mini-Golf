// Headless hole solver: proves every hole can be finished by simulating real shots with the game's own physics.
//   node scripts/solve.mjs <hole 1-9> [--beam 4] [--depth 8] [--quick]
// Builds a walkable "distance to cup" field, then runs a beam search over (aim, power, start-time) shots.
import { HOLE_DEFS, buildHole } from '../src/holes/index.js';
import { World, BALL_R, CUP_R, PUTT_MAX, STEP, SURFACES } from '../src/physics.js';

const args = process.argv.slice(2);
const holeNo = parseInt(args[0] || '1', 10);
const flag = (n, d) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? parseFloat(args[i + 1]) : d;
};
const BEAM = flag('beam', 4);
const DEPTH = flag('depth', 8);
const QUICK = args.includes('--quick');
const speedFromPower = (p) => 0.55 + (PUTT_MAX - 0.55) * Math.pow(p, 1.4);

const course = buildHole(holeNo - 1);
const world = new World(course);
const def = HOLE_DEFS[holeNo - 1];
console.log(`Hole ${holeNo}: ${def.name} (par ${def.par}) – tris ${course.tris.t.length}, walls ${course.walls.length}, kin ${course.kins.length}, movers ${course.movers.length}`);

// ------------------------------------------------------------------------------------------------
// Navigation field (Dijkstra from the cup)
// ------------------------------------------------------------------------------------------------
const CELL = 0.2;
const B = course.bounds;
const gx0 = B.minX - 0.5, gz0 = B.minZ - 0.5;
const GW = Math.ceil((B.maxX - B.minX + 1) / CELL), GH = Math.ceil((B.maxZ - B.minZ + 1) / CELL);
const walk = new Uint8Array(GW * GH);
const gy = new Float32Array(GW * GH);
const cellOf = (x, z) => {
  const i = Math.floor((x - gx0) / CELL), j = Math.floor((z - gz0) / CELL);
  return i >= 0 && j >= 0 && i < GW && j < GH ? j * GW + i : -1;
};
const cx = (i) => gx0 + (i + 0.5) * CELL;
const cz = (j) => gz0 + (j + 0.5) * CELL;

const hazardIds = new Set([SURFACES.water.id, SURFACES.lava.id]);
for (let j = 0; j < GH; j++) {
  for (let i = 0; i < GW; i++) {
    const x = cx(i), z = cz(j);
    let h = course.tris.query(x, z, 1e3);
    let y = h ? h.y : null;
    let hz = h ? hazardIds.has(h.tri.surf) : false;
    // movers at their rest pose count as ground
    for (const m of course.movers) {
      const dx = x - m.x, dz = z - m.z;
      const c = Math.cos(m.rot), s = Math.sin(m.rot);
      const mh = m.tris.query(dx * c - dz * s, dx * s + dz * c, 1e3);
      if (mh && (y == null || mh.y + m.y > y)) {
        y = mh.y + m.y;
        hz = false;
      }
    }
    if (y == null || hz) continue;
    // wall blocking
    let blocked = false;
    for (const w of course.walls) {
      if (x < w.minX - BALL_R || x > w.maxX + BALL_R || z < w.minZ - BALL_R || z > w.maxZ + BALL_R) continue;
      if (y + BALL_R < w.y0 || y - BALL_R > w.y1) continue;
      const dx = w.bx - w.ax, dz = w.bz - w.az;
      let t = w.l2 > 0 ? ((x - w.ax) * dx + (z - w.az) * dz) / w.l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (w.ax + dx * t), z - (w.az + dz * t));
      if (d < w.r + BALL_R * 0.9) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    walk[j * GW + i] = 1;
    gy[j * GW + i] = y;
  }
}
for (const r of course.navRects || []) {
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = cx(i), z = cz(j);
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { walk[j * GW + i] = 1; gy[j * GW + i] = r.y; }
  }
}
const dist = new Float64Array(GW * GH).fill(Infinity);
const heap = [];
const push = (d, n) => {
  heap.push([d, n]);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p][0] <= heap[i][0]) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
};
const pop = () => {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
};
// teleports: [fromCell, toCell] (directed: entering `from` arrives at `to`)
const tele = new Map(); // toCell -> [fromCells]
const addTele = (from, to) => {
  if (from < 0 || to < 0) return;
  if (!tele.has(to)) tele.set(to, []);
  tele.get(to).push(from);
};
const snap = (x, z) => {
  let c = cellOf(x, z);
  if (c >= 0 && walk[c]) return c;
  for (let r = 1; r < 6; r++) {
    for (let a = 0; a < 16; a++) {
      const c2 = cellOf(x + Math.cos((a / 16) * 6.28) * r * CELL, z + Math.sin((a / 16) * 6.28) * r * CELL);
      if (c2 >= 0 && walk[c2]) return c2;
    }
  }
  return -1;
};
for (const t of course.triggers) {
  if (t.kind === 'portal') addTele(snap(t.x, t.z), snap(t.target.x + Math.sin(t.target.exit) * 0.5, t.target.z - Math.cos(t.target.exit) * 0.5));
  if (t.kind === 'pipe') {
    const p = t.pipe;
    const other = course.triggers.find((q) => q.kind === 'pipe' && q.pipe === p && q.end !== t.end);
    if (other) addTele(snap(t.x, t.z), snap(other.x + other.dx * 0.45, other.z + other.dz * 0.45));
  }
}
for (const t of course.navTele || []) addTele(snap(t.from[0], t.from[1]), snap(t.to[0], t.to[1]));
const cupCell = snap(course.cup.x, course.cup.z);
dist[cupCell] = 0;
push(0, cupCell);
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
while (heap.length) {
  const [d, n] = pop();
  if (d > dist[n]) continue;
  const i = n % GW, j = (n / GW) | 0;
  for (const [di, dj, w] of NB) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
    const nn = nj * GW + ni;
    if (!walk[nn]) continue;
    if (Math.abs(gy[nn] - gy[n]) > 0.45) continue;
    const nd = d + w * CELL;
    if (nd < dist[nn]) {
      dist[nn] = nd;
      push(nd, nn);
    }
  }
  const fr = tele.get(n);
  if (fr) for (const f of fr) if (d + 1 < dist[f]) { dist[f] = d + 1; push(d + 1, f); }
}
const nav = (x, z) => {
  const c = cellOf(x, z);
  if (c < 0) return 1e3;
  if (dist[c] < Infinity) return dist[c];
  // not walkable (e.g. hugging a wall): look around
  let best = 1e3;
  for (let a = 0; a < 8; a++) {
    const c2 = cellOf(x + Math.cos((a / 8) * 6.28) * CELL * 1.5, z + Math.sin((a / 8) * 6.28) * CELL * 1.5);
    if (c2 >= 0 && dist[c2] < best) best = dist[c2] + CELL * 1.5;
  }
  return best;
};
let nWalk = 0, nDist = 0;
for (let i = 0; i < walk.length; i++) { if (walk[i]) nWalk++; if (dist[i] < Infinity) nDist++; }
console.log(`nav grid ${GW}x${GH}: walkable ${nWalk}, reachable ${nDist}, cupCell ${cupCell}`);
if (args.includes('--why')) {
  for (let n = 0; n < walk.length; n++) {
    if (!walk[n] || dist[n] < Infinity) continue;
    const i = n % GW, j = (n / GW) | 0;
    for (const [di, dj] of NB) {
      const nn = (j + dj) * GW + (i + di);
      if (nn >= 0 && nn < walk.length && dist[nn] < Infinity) {
        console.log('frontier', cx(i).toFixed(2), cz(j).toFixed(2), 'gy', gy[n], 'neighbor gy', gy[nn], 'nb walk', walk[nn], 'nb dist', dist[nn], 'diff', Math.abs(gy[nn] - gy[n]));
        break;
      }
    }
  }
}
if (args.includes('--map')) {
  for (let j = 0; j < GH; j += 3) {
    let line = '';
    for (let i = 0; i < GW; i += 2) {
      const n = j * GW + i;
      line += dist[n] < Infinity ? '#' : walk[n] ? '+' : '.';
    }
    console.log(line);
  }
}
const teeNav = nav(course.tee.x, course.tee.z);
console.log(`nav distance tee→cup: ${teeNav.toFixed(1)} units`);
if (!isFinite(teeNav) || teeNav > 900) console.log('WARNING: the cup is not reachable from the tee in the walkable field (portals/pipes/movers may be needed)');

// ------------------------------------------------------------------------------------------------
// Shot simulation
// ------------------------------------------------------------------------------------------------
function resetTime(t0) {
  world.t = t0;
  for (const k of world.kins) k.step(t0, STEP, true);
  for (const t of world.triggers) if (t.cd != null) t.cd = 0;
}
function simulate(start, aim, power, t0, maxT = 22) {
  const b = world.ball;
  world.events.length = 0;
  if (start.onMover) {
    // ball rests on a moving platform: let it ride until the shot time
    resetTime(start.t);
    world.place(start.x, start.z, start.y);
    let guard = 0;
    while (world.t < t0 && guard++ < 240 * 40) {
      world.step(STEP);
      world.events.length = 0;
      if (b.mode !== 'free') return { x: b.x, z: b.z, y: b.y, holed: false, hazard: 'ride', t: world.t, onMover: false, timeout: false };
    }
  } else {
    resetTime(t0);
    world.place(start.x, start.z, start.y);
  }
  world.putt(aim, speedFromPower(power));
  let holed = false, hazard = null;
  const maxSteps = Math.floor(maxT / STEP);
  let n = 0;
  for (; n < maxSteps; n++) {
    world.step(STEP);
    if (world.events.length) {
      for (const e of world.events) {
        if (e.type === 'cup') holed = true;
        if (e.type === 'hazard') hazard = e.kind;
      }
      world.events.length = 0;
      if (holed || hazard) break;
    }
    if (b.mode === 'free' && b.rest > 0.4 && world.shotTime > 0.35) break;
  }
  // a resting ball must be properly supported (not teetering on an edge over a hazard / drop)
  let unsafe = false;
  if (!holed && !hazard) {
    for (let a = 0; a < 8 && !unsafe; a++) {
      const g = world._queryAll(b.x + Math.cos((a / 8) * 6.283) * 0.24, b.y, b.z + Math.sin((a / 8) * 6.283) * 0.24);
      if (!g || hazardIds.has(g.tri.surf)) unsafe = true;
    }
  }
  return { x: b.x, z: b.z, y: b.y, holed, hazard, t: world.t, onMover: !!b.mover, timeout: n >= maxSteps, unsafe };
}

// ------------------------------------------------------------------------------------------------
// Beam search
// ------------------------------------------------------------------------------------------------
const period = (() => {
  // dynamic obstacles are periodic with different periods – sample a handful of start times
  return def.solverPeriod || 6;
})();
const PHASES = course.kins.length ? (QUICK ? [0, period * 0.5] : [0, period * 0.2, period * 0.4, period * 0.6, period * 0.8]) : [0];
const start0 = { x: course.tee.x, z: course.tee.z, y: course.tee.y + BALL_R, t: 0, strokes: 0, path: [] };
let beam = [start0];
const toCup = (s) => Math.atan2(course.cup.x - s.x, -(course.cup.z - s.z));
const t0wall = Date.now();
let sims = 0;

function candidates(s) {
  const out = [];
  const yawStep = QUICK ? 12 : 8;
  for (let deg = 0; deg < 360; deg += yawStep) {
    for (const p of [0.18, 0.3, 0.42, 0.55, 0.7, 0.85, 1.0]) out.push([(deg * Math.PI) / 180, p]);
  }
  // aimed at the cup
  const dc = Math.hypot(course.cup.x - s.x, course.cup.z - s.z);
  const base = toCup(s);
  if (dc < 9) {
    for (let dd = -14; dd <= 14; dd += 1) {
      for (let p = 0.12; p <= 0.7; p += 0.04) out.push([base + (dd * Math.PI) / 180, p]);
    }
  }
  return out;
}

const DEBUG = args.includes('--debug');
function expand(s) {
  const results = [];
  const stat = { hazard: 0, timeout: 0, unsafe: 0, ok: 0 };
  const cands = candidates(s);
  for (const ph of PHASES) {
    const t0 = s.t + ph + 0.3;
    for (const [aim, p] of cands) {
      sims++;
      const r = simulate(s, aim, p, t0);
      if (r.hazard) stat.hazard++; else if (r.timeout) stat.timeout++; else if (r.unsafe) stat.unsafe++; else stat.ok++;
      if (r.hazard || r.timeout || r.unsafe) continue;
      const st = { x: r.x, z: r.z, y: r.y, t: r.t, onMover: r.onMover, strokes: s.strokes + 1, path: [...s.path, { aim, power: p, t0 }], holed: r.holed };
      st.score = r.holed ? -1 : nav(r.x, r.z);
      results.push(st);
      if (r.holed) return { done: st, results };
    }
  }
  if (DEBUG) console.log('   expand', JSON.stringify({ x: +s.x.toFixed(2), z: +s.z.toFixed(2), t: +s.t.toFixed(2), onMover: !!s.onMover }), JSON.stringify(stat));
  return { results };
}

let solution = null;
for (let depth = 0; depth < DEPTH && !solution; depth++) {
  const next = [];
  for (const s of beam) {
    const { done, results } = expand(s);
    if (done) {
      solution = done;
      break;
    }
    next.push(...results);
  }
  if (solution) break;
  next.sort((a, b) => a.score - b.score);
  const keep = [];
  for (const c of next) {
    if (keep.length >= BEAM) break;
    if (keep.every((k) => Math.hypot(k.x - c.x, k.z - c.z) > 0.8 || Math.abs(k.t - c.t) > 99)) keep.push(c);
  }
  beam = keep;
  console.log(`  stroke ${depth + 1}: best nav ${beam[0]?.score?.toFixed(2)} at (${beam[0]?.x.toFixed(1)}, ${beam[0]?.z.toFixed(1)}) – sims ${sims}, ${((Date.now() - t0wall) / 1000).toFixed(0)}s`);
  if (!beam.length) break;
}

if (solution) {
  console.log(`SOLVED in ${solution.strokes} strokes (par ${def.par}) – ${sims} sims, ${((Date.now() - t0wall) / 1000).toFixed(0)}s`);
  // re-verify the chain from scratch
  let cur = { x: start0.x, z: start0.z, y: start0.y, t: 0 };
  let ok = true;
  solution.path.forEach((sh, i) => {
    const r = simulate(cur, sh.aim, sh.power, sh.t0);
    console.log(`   shot ${i + 1}: aim ${((sh.aim * 180) / Math.PI).toFixed(1)}°  power ${(sh.power * 100).toFixed(0)}%  start-time ${sh.t0.toFixed(2)} → ${r.holed ? 'HOLED' : `(${r.x.toFixed(2)}, ${r.z.toFixed(2)})`}`);
    if (i === solution.path.length - 1 && !r.holed) ok = false;
    cur = { x: r.x, z: r.z, y: r.y, t: r.t, onMover: r.onMover };
  });
  console.log(ok ? 'VERIFIED' : 'RE-VERIFY FAILED');
  console.log('SOLUTION_JSON ' + JSON.stringify(solution.path));
  process.exit(ok ? 0 : 2);
} else {
  console.log('NOT SOLVED within depth ' + DEPTH);
  process.exit(1);
}
