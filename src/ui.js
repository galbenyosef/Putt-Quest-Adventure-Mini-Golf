// DOM overlay: HUD, menus, banners and scorecards.
import { store } from './store.js';

const $ = (id) => document.getElementById(id);

export const MAX_STROKES = 10;

export function scoreInfo(strokes, par, capped = false) {
  if (capped) return { name: 'Pick up!', kind: 'bad', cls: 'over', sub: `Maximum of ${MAX_STROKES} strokes reached` };
  if (strokes === 1) return { name: 'Hole in one!', kind: 'ace', cls: 'ace', sub: 'Absolutely unbelievable!' };
  const d = strokes - par;
  if (d <= -3) return { name: 'Albatross!', kind: 'ace', cls: 'ace', sub: 'Three under par – legendary!' };
  if (d === -2) return { name: 'Eagle!', kind: 'eagle', cls: 'eagle', sub: 'Two under par' };
  if (d === -1) return { name: 'Birdie!', kind: 'birdie', cls: 'under', sub: 'One under par' };
  if (d === 0) return { name: 'Par', kind: 'par', cls: 'par', sub: 'Right on target' };
  if (d === 1) return { name: 'Bogey', kind: 'bad', cls: 'over', sub: 'One over par' };
  if (d === 2) return { name: 'Double bogey', kind: 'bad', cls: 'over', sub: 'Two over par' };
  return { name: `+${d}`, kind: 'bad', cls: 'over', sub: `${d} over par` };
}

export function relText(d) {
  if (d === 0) return 'E';
  return d > 0 ? `+${d}` : `${d}`;
}

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), holeNo: $('hud-holeno'), name: $('hud-name'), par: $('hud-par'), strokes: $('hud-strokes'), strokesChip: $('hud-strokes-chip'), total: $('hud-total'),
      tip: $('tip'), power: $('power'), powerFill: $('power-fill'), powerLabel: $('power-label'), hint: $('hint'), banner: $('banner'), toast: $('toast'), fly: $('fly'),
      menu: $('menu'), select: $('select'), help: $('help'), scorecard: $('scorecard'), scorePanel: $('scorecard-panel'), pause: $('pause'), loading: $('loading'),
      grid: $('holes-grid'), best: $('menu-best'), btnMute: $('btn-mute'), mMute: $('m-mute'), crosshair: $('crosshair'), pauseSub: $('pause-sub'), sens: $('sens'),
    };
    this._bannerTimer = null;
    this._toastTimer = null;
    this._tipTimer = null;
  }
  $(id) {
    return $(id);
  }

  hideAllScreens() {
    for (const k of ['menu', 'select', 'help', 'scorecard', 'pause']) this.el[k].classList.add('hidden');
  }
  show(name) {
    this.el[name].classList.remove('hidden');
  }
  hide(name) {
    this.el[name].classList.add('hidden');
  }
  showHud(v) {
    this.el.hud.classList.toggle('hidden', !v);
  }
  hideLoading() {
    this.el.loading.classList.add('fade');
  }
  showLoading() {
    this.el.loading.classList.remove('fade');
  }

  setHole(i, total, name, par) {
    this.el.holeNo.textContent = `HOLE ${i + 1} / ${total}`;
    this.el.name.textContent = name;
    this.el.par.textContent = par;
  }
  setStrokes(n, bump = false) {
    this.el.strokes.textContent = n;
    if (bump) {
      this.el.strokesChip.classList.remove('bump');
      void this.el.strokesChip.offsetWidth;
      this.el.strokesChip.classList.add('bump');
    }
  }
  setTotal(rel, has) {
    this.el.total.textContent = has ? relText(rel) : '–';
  }
  setPower(p, visible) {
    this.el.power.classList.toggle('hidden', !visible);
    this.el.powerFill.style.width = `${Math.round(p * 100)}%`;
    this.el.powerLabel.textContent = visible ? `POWER ${Math.round(p * 100)}%` : 'POWER';
  }
  showHint(v) {
    this.el.hint.style.opacity = v ? '1' : '0';
  }
  setHint(html) {
    this.el.hint.innerHTML = html;
  }
  tip(text, ms = 6500) {
    clearTimeout(this._tipTimer);
    if (!text) {
      this.el.tip.classList.add('gone');
      return;
    }
    this.el.tip.textContent = '💡 ' + text;
    this.el.tip.classList.remove('gone');
    this._tipTimer = setTimeout(() => this.el.tip.classList.add('gone'), ms);
  }
  banner(big, sub, ms = 2600) {
    const b = this.el.banner;
    clearTimeout(this._bannerTimer);
    b.classList.remove('out');
    b.innerHTML = `<div class="big">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    this._bannerTimer = setTimeout(() => {
      b.classList.add('out');
      this._bannerTimer = setTimeout(() => (b.innerHTML = ''), 520);
    }, ms);
  }
  clearBanner() {
    clearTimeout(this._bannerTimer);
    this.el.banner.innerHTML = '';
  }
  toast(msg, bad = false, ms = 2000) {
    const t = this.el.toast;
    clearTimeout(this._toastTimer);
    t.textContent = msg;
    t.classList.toggle('bad', bad);
    t.classList.add('show');
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  fly(show, def, idx, total) {
    const f = this.el.fly;
    if (!show) {
      f.classList.add('hidden');
      return;
    }
    f.classList.remove('hidden');
    f.innerHTML = `<div class="name"><small>HOLE ${idx + 1} · PAR ${def.par}</small><b>${def.name}</b><i>${def.hint || ''}</i></div><div class="skip">Click or press Space to skip</div>`;
  }
  setMuteIcon(muted) {
    this.el.btnMute.textContent = muted ? '🔇' : '🔊';
    this.el.mMute.textContent = muted ? '🔇 Sound: Off' : '🔊 Sound: On';
  }

  menuBest() {
    const b = store.bestRound;
    this.el.best.textContent = b != null ? `🏆 Best round: ${b} strokes` : 'Play all 9 holes to set a best score!';
  }

  buildSelect(holes, onPick, current = -1) {
    const g = this.el.grid;
    g.innerHTML = '';
    holes.forEach((h, i) => {
      const best = store.bestHole(i);
      const btn = document.createElement('button');
      btn.className = 'hole-tile';
      if (i === current) btn.style.background = '#fff3c8';
      btn.innerHTML = `<b>${i + 1}</b><em>${h.name}</em><span>Par ${h.par} · Best ${best ?? '–'}</span>`;
      btn.onclick = () => onPick(i);
      g.appendChild(btn);
    });
  }

  scoreCell(strokes, par) {
    if (strokes == null) return '<span class="score par">·</span>';
    const info = scoreInfo(strokes, par);
    let cls = info.cls;
    if (strokes === 1) cls = 'ace';
    return `<span class="score ${cls}">${strokes}</span>`;
  }

  table(holes, scores, current = -1) {
    let par = 0;
    let tot = 0;
    let playedPar = 0;
    let head = '<tr><th>HOLE</th>';
    let rowPar = '<tr><td class="lbl">PAR</td>';
    let rowScore = '<tr class="cur"><td class="lbl">SCORE</td>';
    holes.forEach((h, i) => {
      head += `<th${i === current ? ' style="background:#ff5c8a"' : ''}>${i + 1}</th>`;
      rowPar += `<td>${h.par}</td>`;
      rowScore += `<td>${this.scoreCell(scores[i], h.par)}</td>`;
      par += h.par;
      if (scores[i] != null) {
        tot += scores[i];
        playedPar += h.par;
      }
    });
    head += '<th>TOT</th></tr>';
    rowPar += `<td class="total">${par}</td></tr>`;
    rowScore += `<td class="total">${tot || '–'}</td></tr>`;
    return { html: `<table class="sc">${head}${rowPar}${rowScore}</table>`, total: tot, par, playedPar };
  }
}
