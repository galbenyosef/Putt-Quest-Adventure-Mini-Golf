// How often does a blind full-circle sweep of first shots hole out? (difficulty sanity check)
//   node scripts/acerate.mjs <hole>
import { buildHole } from '../src/holes/index.js';
import { World, STEP, PUTT_MAX } from '../src/physics.js';
const h = parseInt(process.argv[2] || '1', 10);
const course = buildHole(h - 1);
const world = new World(course);
const sp = (p) => 0.55 + (PUTT_MAX - 0.55) * Math.pow(p, 1.4);
const phases = course.kins.length ? [0.3, 1.7, 3.1, 4.9, 6.7, 8.3] : [0.3];
let total = 0, holed = 0, water = 0;
const by = {};
for (const t0 of phases) {
  for (let deg = 0; deg < 360; deg += 2) {
    for (let p = 0.3; p <= 1.0001; p += 0.05) {
      world.t = t0;
      for (const k of world.kins) k.step(t0, STEP, true);
      world.events.length = 0;
      world.place(course.tee.x, course.tee.z);
      world.putt((deg * Math.PI) / 180, sp(p));
      let done = false, hz = false;
      for (let i = 0; i < 240 * 14 && !done; i++) {
        world.step(STEP);
        for (const e of world.events) { if (e.type === 'cup') { holed++; done = true; by[deg] = (by[deg] || 0) + 1; } if (e.type === 'hazard') { hz = true; done = true; } }
        world.events.length = 0;
        const b = world.ball;
        if (b.mode === 'free' && b.rest > 0.4 && world.shotTime > 0.35) done = true;
      }
      if (hz) water++;
      total++;
    }
  }
}
const degs = Object.keys(by).length;
console.log(`hole ${h}: ${holed}/${total} first-shot holes-in-one (${((holed / total) * 100).toFixed(2)}%), hazards ${((water / total) * 100).toFixed(0)}%, distinct angles ${degs}`);
