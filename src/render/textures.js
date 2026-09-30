// Procedural canvas textures (no image files anywhere in the project).
import * as THREE from 'three';
import { makeCanvas, rng } from '../util.js';

const cache = new Map();

function finish(canvas, repeat = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const painters = {
  mow(ctx, S) {
    const r = rng(3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) {
      if (i % 2) {
        ctx.fillStyle = 'rgba(0,40,0,0.10)';
        ctx.fillRect(i * (S / 8), 0, S / 8, S);
      }
    }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(0,50,0,0.05)' : 'rgba(255,255,255,0.10)';
      ctx.fillRect(r() * S, r() * S, 2, 4);
    }
  },
  planks(ctx, S) {
    const r = rng(5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    const ph = S / 4;
    for (let i = 0; i < 4; i++) {
      const shade = 0.05 * r();
      ctx.fillStyle = `rgba(0,0,0,${shade})`;
      ctx.fillRect(0, i * ph, S, ph);
      ctx.fillStyle = 'rgba(40,15,0,0.35)';
      ctx.fillRect(0, i * ph, S, 4);
      const jx = ((i * 97) % S) | 0;
      ctx.fillRect(jx, i * ph, 4, ph);
      ctx.strokeStyle = 'rgba(70,30,0,0.13)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const y = i * ph + 8 + r() * (ph - 16);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(S * 0.3, y + 5 * (r() - 0.5), S * 0.6, y + 5 * (r() - 0.5), S, y);
        ctx.stroke();
      }
    }
  },
  tiles(ctx, S) {
    const r = rng(7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    const n = 4;
    const ts = S / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = `rgba(0,0,0,${r() * 0.07})`;
        ctx.fillRect(i * ts, j * ts, ts, ts);
      }
    }
    ctx.fillStyle = 'rgba(20,20,40,0.28)';
    for (let i = 0; i <= n; i++) {
      ctx.fillRect(i * ts - 2, 0, 4, S);
      ctx.fillRect(0, i * ts - 2, S, 4);
    }
  },
  dots(ctx, S) {
    const r = rng(11);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 1100; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(r() * S, r() * S, 1 + r() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  ice(ctx, S) {
    const r = rng(13);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(70,130,190,0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      let x = r() * S;
      let y = r() * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 80;
        y += (r() - 0.5) * 80;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      const x = r() * S;
      const y = r() * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40, y - 40);
      ctx.stroke();
    }
  },
  conv(ctx, S) {
    ctx.fillStyle = '#7d7d7d';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = S * 0.09;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const cy of [S * 0.25, S * 0.75]) {
      ctx.beginPath();
      ctx.moveTo(S * 0.2, cy - S * 0.2);
      ctx.lineTo(S * 0.75, cy);
      ctx.lineTo(S * 0.2, cy + S * 0.2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, S, 6);
    ctx.fillRect(0, S - 6, S, 6);
  },
};

export function patternTexture(name, clone = false) {
  if (!painters[name]) return null;
  const key = name;
  if (!cache.has(key)) {
    const c = makeCanvas(256, 256);
    if (!c) {
      cache.set(key, null);
    } else {
      painters[name](c.ctx, 256);
      cache.set(key, finish(c.canvas));
    }
  }
  const t = cache.get(key);
  if (clone && t) {
    const t2 = t.clone();
    t2.needsUpdate = true;
    return t2;
  }
  return t;
}

/** Sign / label texture with big rounded text. */
export function labelTexture(text, { w = 256, h = 128, bg = '#2b1b12', fg = '#ffe9a8', border = '#e8b04a', font = '900 64px "Trebuchet MS", "Segoe UI", sans-serif' } = {}) {
  const c = makeCanvas(w, h);
  if (!c) return null;
  const { ctx } = c;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 62));
  return finish(c.canvas, false);
}

export function flagTexture(n) {
  const c = makeCanvas(128, 96);
  if (!c) return null;
  const { ctx } = c;
  ctx.clearRect(0, 0, 128, 96);
  ctx.fillStyle = '#fff';
  ctx.font = '900 70px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 8;
  ctx.strokeText(String(n), 64, 52);
  ctx.fillText(String(n), 64, 52);
  const t = new THREE.CanvasTexture(c.canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft radial glow sprite texture. */
export function glowTexture() {
  if (cache.has('glow')) return cache.get('glow');
  const c = makeCanvas(64, 64);
  if (!c) {
    cache.set('glow', null);
    return null;
  }
  const g = c.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.ctx.fillStyle = g;
  c.ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c.canvas);
  cache.set('glow', t);
  return t;
}
