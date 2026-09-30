import { Course } from '../course.js';
import h1 from './h1.js';
import h2 from './h2.js';
import h3 from './h3.js';
import h4 from './h4.js';
import h5 from './h5.js';
import h6 from './h6.js';
import h7 from './h7.js';
import h8 from './h8.js';
import h9 from './h9.js';

export const HOLE_DEFS = [h1, h2, h3, h4, h5, h6, h7, h8, h9];

export function buildHole(index) {
  const def = HOLE_DEFS[index];
  const c = new Course(def);
  def.build(c);
  c.finish();
  return c;
}
