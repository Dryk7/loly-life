const TILE = 32;
const COLS = 10;
const ROWS = 14;
const W = COLS * TILE;
const H = ROWS * TILE;
const DAY_MIN = 1440;
const SAVE_KEY = 'lolylife.save.v1';
const LEGACY_SAVE_KEY = 'cozylife.save.v1';
const REAL_SEC_PER_GAME_MIN = 0.5;
const SLEEP_SPEED = 12;

const PALETTE = {
  wallTop: '#8b6f47',
  wallSide: '#5b4a30',
  wallShadow: '#3a2e1d',
  floorDefault: '#e8d5b7',
  floorBedroom: '#dac9e6',
  floorBath: '#bedde9',
  floorKitchen: '#ecd9a3',
  floorLiving: '#cee0c5',
  floorOffice: '#e8c8b0',
  grout: 'rgba(0,0,0,0.08)',
  shadow: 'rgba(0,0,0,0.18)',
};

const ZONES = [
  { name: 'bedroom', x0: 0, y0: 0, x1: 10, y1: 5, color: PALETTE.floorBedroom },
  { name: 'bath', x0: 0, y0: 5, x1: 5, y1: 8, color: PALETTE.floorBath },
  { name: 'office', x0: 5, y0: 5, x1: 10, y1: 8, color: PALETTE.floorOffice },
  { name: 'kitchen', x0: 0, y0: 8, x1: 5, y1: 14, color: PALETTE.floorKitchen },
  { name: 'living', x0: 5, y0: 8, x1: 10, y1: 14, color: PALETTE.floorLiving },
];

const ITEMS = [
  { id: 'bed', type: 'bed', x: 1, y: 1, w: 2, h: 1, label: 'Lit', action: 'sleep' },
  { id: 'wardrobe', type: 'wardrobe', x: 4, y: 1, w: 1, h: 1, label: 'Armoire', action: null },
  { id: 'plant', type: 'plant', x: 8, y: 1, w: 1, h: 1, label: 'Plante', action: 'plant' },
  { id: 'shower', type: 'shower', x: 1, y: 6, w: 1, h: 1, label: 'Douche', action: 'shower' },
  { id: 'toilet', type: 'toilet', x: 3, y: 6, w: 1, h: 1, label: 'Toilettes', action: 'toilet' },
  { id: 'computer', type: 'computer', x: 8, y: 6, w: 1, h: 1, label: 'Ordinateur', action: 'work' },
  { id: 'fridge', type: 'fridge', x: 1, y: 9, w: 1, h: 1, label: 'Frigo', action: 'snack' },
  { id: 'stove', type: 'stove', x: 2, y: 9, w: 1, h: 1, label: 'Cuisinière', action: 'cook' },
  { id: 'counter', type: 'counter', x: 3, y: 9, w: 1, h: 1, label: 'Comptoir', action: null },
  { id: 'tv', type: 'tv', x: 8, y: 9, w: 1, h: 1, label: 'Télé', action: 'tv' },
  { id: 'sofa', type: 'sofa', x: 6, y: 12, w: 2, h: 1, label: 'Canapé', action: 'relax' },
];

const ACTIONS = {
  sleep:   { label: 'Dormir', durationMin: 480, fast: true, effect: { energy: 120, hygiene: -8, hunger: -10 }, money: 0 },
  shower:  { label: 'Se doucher', durationMin: 30, effect: { hygiene: 70, energy: 4 } },
  toilet:  { label: 'Aux toilettes', durationMin: 10, effect: { hygiene: 4, fun: 1 } },
  work:    { label: 'Travailler', durationMin: 120, effect: { energy: -18, social: -10, fun: -8 }, money: 60 },
  plant:   { label: 'Arroser la plante', durationMin: 5, effect: { fun: 4 } },
  snack:   { label: 'Grignoter', durationMin: 15, effect: { hunger: 25, hygiene: -2 } },
  cook:    { label: 'Cuisiner', durationMin: 45, effect: { hunger: 65, fun: 10, hygiene: -3 }, money: -8 },
  tv:      { label: 'Regarder la télé', durationMin: 30, effect: { fun: 30, energy: 5, social: 5 } },
  relax:   { label: 'Se détendre', durationMin: 20, effect: { fun: 12, energy: 8 } },
  call:    { label: 'Appeler un ami', durationMin: 20, effect: { social: 38, fun: 5 } },
};

const DECAY = {
  hunger: 0.14,
  energy: 0.08,
  hygiene: 0.07,
  social: 0.05,
  fun: 0.06,
};

const NEED_KEYS = ['hunger', 'energy', 'hygiene', 'social', 'fun'];

const APPEARANCE_PALETTES = {
  gender: [
    { id: 'f', label: 'Femme' },
    { id: 'm', label: 'Homme' },
    { id: 'n', label: 'Autre' },
  ],
  skin: ['#fde0c8', '#fbc8a8', '#e8ad88', '#b88660', '#8a5e40', '#5e3e2c'],
  hair: ['#1a1a1a', '#5c3d1e', '#a87544', '#d8b878', '#c45a3a', '#7d6e90', '#e8a8c8'],
  hairStyle: [
    { id: 'short', label: 'Court' },
    { id: 'long', label: 'Long' },
    { id: 'tuft', label: 'Crête' },
    { id: 'bald', label: 'Rasé' },
  ],
  top: [
    { id: 'tshirt', label: 'T-shirt' },
    { id: 'pull', label: 'Pull' },
    { id: 'tank', label: 'Débard.' },
    { id: 'robe', label: 'Robe' },
  ],
  shirt: ['#5b8aaf', '#a85b5b', '#7da85b', '#a87544', '#5b5b8a', '#c8a5d8', '#3a3a3a', '#e8a857'],
  bottom: [
    { id: 'pants', label: 'Pantalon' },
    { id: 'short', label: 'Short' },
    { id: 'skirt', label: 'Jupe' },
  ],
  pants: ['#3c4a5c', '#5c3d1e', '#3c5c3c', '#5c3c5c', '#1a1a1a', '#a87544'],
};

function defaultAppearance() {
  return {
    gender: 'f',
    skin: '#fbc8a8',
    hair: '#5c3d1e',
    hairStyle: 'short',
    top: 'tshirt',
    shirt: '#5b8aaf',
    bottom: 'pants',
    pants: '#3c4a5c',
  };
}

const grid = buildGrid();

function buildGrid() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (let x = 0; x < COLS; x++) { g[0][x] = 1; g[ROWS - 1][x] = 1; }
  for (let y = 0; y < ROWS; y++) { g[y][0] = 1; g[y][COLS - 1] = 1; }
  for (const it of ITEMS) {
    for (let dy = 0; dy < it.h; dy++) {
      for (let dx = 0; dx < it.w; dx++) {
        g[it.y + dy][it.x + dx] = 2;
      }
    }
  }
  return g;
}

function isWalkable(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return grid[y][x] === 0;
}

function bfs(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const prev = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  visited[sy][sx] = true;
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) {
      const path = [];
      let cx = x, cy = y;
      while (!(cx === sx && cy === sy)) {
        path.unshift([cx, cy]);
        const [px, py] = prev[cy][cx];
        cx = px; cy = py;
      }
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (!isWalkable(nx, ny) || visited[ny][nx]) continue;
      visited[ny][nx] = true;
      prev[ny][nx] = [x, y];
      q.push([nx, ny]);
    }
  }
  return null;
}

function adjacentToItem(it) {
  const tiles = [];
  for (let dy = -1; dy <= it.h; dy++) {
    for (let dx = -1; dx <= it.w; dx++) {
      const onItem = dx >= 0 && dx < it.w && dy >= 0 && dy < it.h;
      const corner = (dx === -1 || dx === it.w) && (dy === -1 || dy === it.h);
      if (onItem || corner) continue;
      const tx = it.x + dx, ty = it.y + dy;
      if (isWalkable(tx, ty)) tiles.push([tx, ty]);
    }
  }
  return tiles;
}

function findApproach(it, fromX, fromY) {
  const candidates = adjacentToItem(it);
  let best = null, bestLen = Infinity;
  for (const [tx, ty] of candidates) {
    const path = bfs(fromX, fromY, tx, ty);
    if (path && path.length < bestLen) {
      bestLen = path.length;
      best = { path, target: [tx, ty] };
    }
  }
  return best;
}

function defaultState(name) {
  return {
    name: name || 'Toi',
    appearance: defaultAppearance(),
    needs: { hunger: 80, energy: 90, hygiene: 80, social: 70, fun: 70 },
    money: 50,
    timeMin: 8 * 60,
    day: 1,
    player: { x: 5, y: 7, sub: 0, dir: 'down', anim: 0 },
    path: [],
    action: null,
    lastTs: 0,
    facing: 'down',
  };
}

let state = defaultState();

function loadGame() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveGame() {
  const snap = {
    name: state.name,
    appearance: state.appearance,
    needs: state.needs,
    money: state.money,
    timeMin: state.timeMin,
    day: state.day,
    player: { x: state.player.x, y: state.player.y, dir: state.player.dir },
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snap)); } catch {}
}

function applyLoaded(s) {
  state = defaultState(s.name);
  state.appearance = { ...defaultAppearance(), ...(s.appearance || {}) };
  state.needs = { ...state.needs, ...s.needs };
  state.money = s.money ?? 50;
  state.timeMin = s.timeMin ?? 8 * 60;
  state.day = s.day ?? 1;
  if (s.player) {
    state.player.x = s.player.x;
    state.player.y = s.player.y;
    state.player.dir = s.player.dir || 'down';
  }
}

const canvas = document.getElementById('canvas');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function tileAtPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
  return [Math.floor(cx / TILE), Math.floor(cy / TILE)];
}

function itemAtTile(x, y) {
  for (const it of ITEMS) {
    if (x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h) return it;
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.action) return;
  const [tx, ty] = tileAtPointer(e);
  const it = itemAtTile(tx, ty);
  if (it) {
    const approach = findApproach(it, state.player.x, state.player.y);
    if (approach) {
      state.path = approach.path;
      state.pendingItem = it;
    } else {
      toast("J'peux pas y aller.");
    }
    return;
  }
  if (isWalkable(tx, ty)) {
    const path = bfs(state.player.x, state.player.y, tx, ty);
    if (path && path.length) {
      state.path = path;
      state.pendingItem = null;
    }
  }
});

document.querySelectorAll('.action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.action) return;
    const quick = btn.dataset.quick;
    if (quick === 'call') startAction('call', null);
    if (quick === 'sleep') {
      const bed = ITEMS.find(i => i.id === 'bed');
      const approach = findApproach(bed, state.player.x, state.player.y);
      if (approach) {
        state.path = approach.path;
        state.pendingItem = bed;
      }
    }
  });
});

document.getElementById('cancel-action').addEventListener('click', () => {
  if (state.action) {
    state.action = null;
    document.getElementById('action-panel').hidden = true;
  }
});

document.getElementById('menu-btn').addEventListener('click', openMenu);
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal').hidden = true;
});

function openMenu() {
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Statut';
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="row"><span>Joueur</span><strong>${state.name}</strong></div>
    <div class="row"><span>Jour</span><strong>${state.day}</strong></div>
    <div class="row"><span>Heure</span><strong>${formatTime(state.timeMin)}</strong></div>
    <div class="row"><span>Argent</span><strong style="color:var(--accent)">$${Math.floor(state.money)}</strong></div>
    <div class="row"><span>Faim</span><strong>${Math.floor(state.needs.hunger)}%</strong></div>
    <div class="row"><span>Énergie</span><strong>${Math.floor(state.needs.energy)}%</strong></div>
    <div class="row"><span>Hygiène</span><strong>${Math.floor(state.needs.hygiene)}%</strong></div>
    <div class="row"><span>Social</span><strong>${Math.floor(state.needs.social)}%</strong></div>
    <div class="row"><span>Fun</span><strong>${Math.floor(state.needs.fun)}%</strong></div>
  `;
  m.hidden = false;
}

function startAction(key, item) {
  const def = ACTIONS[key];
  if (!def) return;
  if (def.money && state.money + def.money < 0) {
    toast('Pas assez d\'argent.');
    return;
  }
  state.action = {
    key, item, def,
    elapsedMin: 0,
    totalMin: def.durationMin,
    fast: !!def.fast,
  };
  state.player.dir = item ? facingFor(state.player, item) : state.player.dir;
  const panel = document.getElementById('action-panel');
  panel.hidden = false;
  panel.querySelector('.action-label').textContent = def.label + '…';
  panel.querySelector('.action-fill').style.width = '0%';
}

function facingFor(p, it) {
  const cx = it.x + it.w / 2 - 0.5;
  const cy = it.y + it.h / 2 - 0.5;
  const dx = cx - p.x, dy = cy - p.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function finishAction() {
  const a = state.action;
  if (!a) return;
  for (const [k, v] of Object.entries(a.def.effect)) {
    if (k in state.needs) {
      state.needs[k] = Math.max(0, Math.min(100, state.needs[k] + v));
    }
  }
  if (a.def.money) state.money = Math.max(0, state.money + a.def.money);
  toast(a.def.label + ' ✓');
  spawnEmote(emoteFor(a.key));
  state.action = null;
  document.getElementById('action-panel').hidden = true;
  saveGame();
}

function emoteFor(key) {
  return ({
    sleep: '💤', shower: '💧', toilet: '✨', work: '💼', plant: '🌱',
    snack: '🍎', cook: '🍳', tv: '📺', relax: '☁️', call: '💬',
  })[key] || '✨';
}

function spawnEmote(symbol) {
  const el = document.getElementById('emote');
  const rect = canvas.getBoundingClientRect();
  const stage = document.getElementById('stage').getBoundingClientRect();
  const px = rect.left - stage.left + (state.player.x + 0.5) * TILE * (rect.width / W);
  const py = rect.top - stage.top + (state.player.y + 0.2) * TILE * (rect.height / H);
  el.textContent = symbol;
  el.style.left = px + 'px';
  el.style.top = py + 'px';
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  setTimeout(() => { el.hidden = true; }, 1200);
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
}

function formatTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function updateHUD() {
  for (const need of NEED_KEYS) {
    const el = document.querySelector(`.need[data-need="${need}"]`);
    const v = state.needs[need];
    el.querySelector('.fill').style.width = v + '%';
    el.classList.toggle('critical', v < 20);
  }
  document.getElementById('chip-money').textContent = '$' + Math.floor(state.money);
  document.getElementById('chip-time').textContent = `Jour ${state.day} · ${formatTime(state.timeMin)}`;
}

let lastTs = 0;
let saveAccum = 0;

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  tick(dt);
  render();
  requestAnimationFrame(loop);
}

function tick(dt) {
  for (const k of NEED_KEYS) {
    state.needs[k] = Math.max(0, state.needs[k] - DECAY[k] * dt);
  }
  if (state.needs.hunger < 5) state.needs.fun = Math.max(0, state.needs.fun - 0.05 * dt * 60);
  if (state.needs.energy < 5) state.needs.fun = Math.max(0, state.needs.fun - 0.05 * dt * 60);

  let timeStep = dt / REAL_SEC_PER_GAME_MIN;
  if (state.action?.fast) timeStep *= SLEEP_SPEED;
  state.timeMin += timeStep;
  while (state.timeMin >= DAY_MIN) {
    state.timeMin -= DAY_MIN;
    state.day++;
  }

  if (state.path && state.path.length && !state.action) {
    const speed = 5;
    state.player.sub += dt * speed;
    state.player.anim += dt * 8;
    if (state.player.sub >= 1) {
      state.player.sub = 0;
      const [nx, ny] = state.path.shift();
      const dx = nx - state.player.x, dy = ny - state.player.y;
      if (Math.abs(dx) > Math.abs(dy)) state.player.dir = dx > 0 ? 'right' : 'left';
      else state.player.dir = dy > 0 ? 'down' : 'up';
      state.player.x = nx;
      state.player.y = ny;
      if (state.path.length === 0 && state.pendingItem) {
        const it = state.pendingItem;
        state.pendingItem = null;
        if (it.action) startAction(it.action, it);
      }
    }
  } else if (!state.action) {
    state.player.anim *= 0.9;
  }

  if (state.action) {
    const a = state.action;
    a.elapsedMin += timeStep;
    const pct = Math.min(1, a.elapsedMin / a.totalMin);
    document.querySelector('.action-fill').style.width = (pct * 100) + '%';
    if (a.key === 'sleep' && state.needs.energy >= 100) {
      finishAction();
    } else if (a.elapsedMin >= a.totalMin) {
      finishAction();
    }
  }

  saveAccum += dt;
  if (saveAccum > 8) { saveAccum = 0; saveGame(); }
  updateHUD();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawFloor();
  drawWalls();
  drawItemsAndPlayer();
  drawDayNight();
  drawPathHint();
}

function drawFloor() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === 1) continue;
      const zone = ZONES.find(z => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1);
      ctx.fillStyle = zone ? zone.color : PALETTE.floorDefault;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.fillStyle = PALETTE.grout;
      ctx.fillRect(x * TILE, y * TILE, TILE, 1);
      ctx.fillRect(x * TILE, y * TILE, 1, TILE);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(1 * TILE, 5 * TILE, (COLS - 2) * TILE, 1);
  ctx.fillRect(1 * TILE, 8 * TILE, (COLS - 2) * TILE, 1);
  ctx.fillRect(5 * TILE, 5 * TILE, 1, (ROWS - 6) * TILE);

  drawRug(6, 10, 2, 1, '#a86060');
  drawRug(2, 3, 2, 1, '#7a6f9b');
}

function drawRug(x, y, w, h, color) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = color;
  ctx.fillRect(px + 4, py + 6, w * TILE - 8, h * TILE - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(px + 6, py + 8, w * TILE - 12, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(px + 6, py + h * TILE - 9, w * TILE - 12, 1);
}

function drawWalls() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 1) continue;
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = PALETTE.wallSide;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(px, py, TILE, TILE - 6);
      ctx.fillStyle = PALETTE.wallShadow;
      ctx.fillRect(px, py + TILE - 6, TILE, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(px, py, TILE, 2);
    }
  }
  drawWindow(2, 0);
  drawWindow(7, 0);
}

function drawWindow(x, y) {
  const px = x * TILE, py = y * TILE;
  const skyColor = skyTint();
  ctx.fillStyle = skyColor;
  ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 14);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(px + 4, py + 4, TILE - 8, 2);
  ctx.fillStyle = PALETTE.wallShadow;
  ctx.fillRect(px + 4, py + (TILE - 14) / 2 + 3, TILE - 8, 1);
  ctx.fillRect(px + (TILE - 8) / 2 + 3, py + 4, 1, TILE - 14);
}

function skyTint() {
  const t = state.timeMin;
  if (t < 5 * 60 || t > 21 * 60) return '#1c2640';
  if (t < 7 * 60) return '#e89868';
  if (t < 18 * 60) return '#7ec0e8';
  if (t < 20 * 60) return '#e8946b';
  return '#3a3656';
}

function drawItemsAndPlayer() {
  const renderList = [];
  for (const it of ITEMS) renderList.push({ kind: 'item', it, sortY: it.y + it.h });
  const py = state.player.y + lerpSub();
  renderList.push({ kind: 'player', sortY: py + 1 });
  renderList.sort((a, b) => a.sortY - b.sortY);
  for (const r of renderList) {
    if (r.kind === 'item') drawItem(r.it);
    else drawPlayer();
  }
}

function lerpSub() {
  if (!state.path || !state.path.length) return 0;
  const [nx, ny] = state.path[0];
  const dx = nx - state.player.x, dy = ny - state.player.y;
  return state.player.sub * (Math.abs(dy) > 0 ? Math.sign(dy) : 0);
}

function lerpSubX() {
  if (!state.path || !state.path.length) return 0;
  const [nx, ny] = state.path[0];
  const dx = nx - state.player.x;
  return state.player.sub * (Math.abs(dx) > 0 ? Math.sign(dx) : 0);
}

function drawItem(it) {
  const px = it.x * TILE, py = it.y * TILE;
  const w = it.w * TILE, h = it.h * TILE;
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(px + w / 2, py + h - 2, w * 0.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  switch (it.type) {
    case 'bed': drawBed(px, py, w, h); break;
    case 'wardrobe': drawWardrobe(px, py, w, h); break;
    case 'shower': drawShower(px, py, w, h); break;
    case 'toilet': drawToilet(px, py, w, h); break;
    case 'computer': drawComputer(px, py, w, h); break;
    case 'plant': drawPlant(px, py, w, h); break;
    case 'fridge': drawFridge(px, py, w, h); break;
    case 'stove': drawStove(px, py, w, h); break;
    case 'counter': drawCounter(px, py, w, h); break;
    case 'tv': drawTV(px, py, w, h); break;
    case 'sofa': drawSofa(px, py, w, h); break;
  }
}

function drawBed(x, y, w, h) {
  ctx.fillStyle = '#7a5a8a';
  ctx.fillRect(x + 2, y + 6, w - 4, h - 8);
  ctx.fillStyle = '#5b7db1';
  ctx.fillRect(x + 4, y + 8, w - 8, h - 12);
  ctx.fillStyle = '#f5e6d3';
  ctx.fillRect(x + 4, y + 4, 12, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x + 4, y + 4, 12, 1);
  ctx.fillStyle = '#6a4a76';
  ctx.fillRect(x + 2, y + 4, 2, 6);
  ctx.fillRect(x + w - 4, y + 4, 2, 6);
}

function drawWardrobe(x, y, w, h) {
  ctx.fillStyle = '#6b4a30';
  ctx.fillRect(x + 4, y + 2, w - 8, h - 6);
  ctx.fillStyle = '#8b6841';
  ctx.fillRect(x + 6, y + 4, w - 12, h - 10);
  ctx.fillStyle = '#3a2818';
  ctx.fillRect(x + w / 2, y + 4, 1, h - 10);
  ctx.fillStyle = '#d4a857';
  ctx.fillRect(x + w / 2 - 3, y + h / 2, 2, 2);
  ctx.fillRect(x + w / 2 + 1, y + h / 2, 2, 2);
}

function drawShower(x, y, w, h) {
  ctx.fillStyle = '#a8c5d4';
  ctx.fillRect(x + 3, y + 2, w - 6, h - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x + 3, y + 2, w - 6, 2);
  ctx.fillStyle = '#7ec6e0';
  ctx.fillRect(x + w / 2 - 3, y + 4, 6, 2);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(126,198,224,${0.5 - i * 0.1})`;
    ctx.fillRect(x + w / 2 - 4 + i * 2, y + 8 + i * 4, 1, 3);
    ctx.fillRect(x + w / 2 + 2 - i * 2, y + 10 + i * 4, 1, 3);
  }
  ctx.fillStyle = '#6c757d';
  ctx.fillRect(x + 3, y + h - 6, w - 6, 2);
}

function drawToilet(x, y, w, h) {
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(x + 8, y + 4, w - 16, 4);
  ctx.fillStyle = '#cfcfcf';
  ctx.fillRect(x + 8, y + h - 10, w - 16, 4);
  ctx.fillStyle = '#a8c5d4';
  ctx.fillRect(x + 10, y + 10, w - 20, 4);
}

function drawComputer(x, y, w, h) {
  ctx.fillStyle = '#5b4a30';
  ctx.fillRect(x + 2, y + h - 8, w - 4, 4);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(x + 6, y + 4, w - 12, h - 14);
  ctx.fillStyle = '#1a8fb8';
  ctx.fillRect(x + 8, y + 6, w - 16, h - 18);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x + 8, y + 6, 4, 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + w / 2 - 6, y + h - 12, 12, 4);
}

function drawPlant(x, y, w, h) {
  ctx.fillStyle = '#8b5a3c';
  ctx.fillRect(x + w / 2 - 6, y + h - 10, 12, 8);
  ctx.fillStyle = '#a06b48';
  ctx.fillRect(x + w / 2 - 6, y + h - 10, 12, 2);
  ctx.fillStyle = '#3a7a4a';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h - 12, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a8c5a';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - 3, y + h - 16, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 3, y + h - 14, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFridge(x, y, w, h) {
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(x + 3, y + 2, w - 6, h - 4);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(x + 5, y + 4, w - 10, h - 8);
  ctx.fillStyle = '#b8b8b8';
  ctx.fillRect(x + 5, y + h / 2, w - 10, 1);
  ctx.fillStyle = '#888';
  ctx.fillRect(x + w - 8, y + 8, 2, 6);
  ctx.fillRect(x + w - 8, y + h / 2 + 4, 2, 6);
}

function drawStove(x, y, w, h) {
  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(x + 3, y + 4, w - 6, h - 6);
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(x + 5, y + 6, w - 10, 4);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 7, y + 12, 6, 6);
  ctx.fillRect(x + w - 13, y + 12, 6, 6);
  ctx.fillStyle = '#ff6b35';
  ctx.fillRect(x + 8, y + 13, 4, 4);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(x + 5, y + h - 6, w - 10, 2);
}

function drawCounter(x, y, w, h) {
  ctx.fillStyle = '#6b4a30';
  ctx.fillRect(x + 2, y + 6, w - 4, h - 8);
  ctx.fillStyle = '#d8c8a0';
  ctx.fillRect(x + 2, y + 4, w - 4, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 4, y + 5, w - 8, 1);
}

function drawTV(x, y, w, h) {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 3, y + 6, w - 6, h - 14);
  const flicker = Math.sin(performance.now() / 80) > 0.5;
  ctx.fillStyle = flicker ? '#5b9fc8' : '#3a7a9a';
  ctx.fillRect(x + 5, y + 8, w - 10, h - 18);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 5, y + 8, w - 10, 1);
  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(x + w / 2 - 4, y + h - 8, 8, 4);
}

function drawSofa(x, y, w, h) {
  ctx.fillStyle = '#a85b5b';
  ctx.fillRect(x + 2, y + 4, w - 4, h - 6);
  ctx.fillStyle = '#c97a7a';
  ctx.fillRect(x + 2, y + 2, w - 4, 6);
  ctx.fillStyle = '#8a4848';
  ctx.fillRect(x + 2, y + 4, 4, h - 8);
  ctx.fillRect(x + w - 6, y + 4, 4, h - 8);
  ctx.fillStyle = '#c97a7a';
  ctx.fillRect(x + 6, y + 4, w - 12, 4);
  ctx.fillStyle = '#f5d8d8';
  ctx.fillRect(x + 8, y + 6, 4, 3);
  ctx.fillRect(x + w - 12, y + 6, 4, 3);
}

function getPlayerPixelPos() {
  let px = state.player.x * TILE;
  let py = state.player.y * TILE;
  if (state.path && state.path.length) {
    const [nx, ny] = state.path[0];
    const dx = nx - state.player.x, dy = ny - state.player.y;
    px += dx * TILE * state.player.sub;
    py += dy * TILE * state.player.sub;
  }
  return [px, py];
}

function drawCharacter(c, app, dir, moving, anim) {
  const skin = app.skin || '#fbc8a8';
  const hair = app.hair || '#5c3d1e';
  const shirt = app.shirt || '#5b8aaf';
  const pants = app.pants || '#3c4a5c';
  const style = app.hairStyle || 'short';
  const gender = app.gender || 'f';
  const top = app.top || 'tshirt';
  const bottom = app.bottom || 'pants';

  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath();
  c.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2);
  c.fill();

  const bob = moving ? Math.abs(Math.sin(anim * 1.2)) * 1.2 : 0;
  const by = -14 - bob;

  const torsoW = gender === 'f' ? 10 : 12;
  const torsoX = -torsoW / 2;
  const armX = gender === 'f' ? -6 : -7;
  const armX2 = gender === 'f' ? 4 : 5;

  if (top !== 'robe') {
    if (bottom === 'pants') {
      c.fillStyle = pants;
      c.fillRect(-5, by + 8, 4, 8);
      c.fillRect(1, by + 8, 4, 8);
      if (moving) {
        const legPhase = Math.sin(anim * 1.5);
        c.fillStyle = shadeColor(pants, 0.65);
        if (legPhase > 0) c.fillRect(-5, by + 14, 4, 2);
        else c.fillRect(1, by + 14, 4, 2);
      }
    } else if (bottom === 'short') {
      c.fillStyle = pants;
      c.fillRect(-5, by + 8, 4, 4);
      c.fillRect(1, by + 8, 4, 4);
      c.fillStyle = skin;
      c.fillRect(-5, by + 12, 4, 4);
      c.fillRect(1, by + 12, 4, 4);
      if (moving) {
        const legPhase = Math.sin(anim * 1.5);
        c.fillStyle = shadeColor(skin, 0.85);
        if (legPhase > 0) c.fillRect(-5, by + 14, 4, 2);
        else c.fillRect(1, by + 14, 4, 2);
      }
    } else if (bottom === 'skirt') {
      c.fillStyle = pants;
      c.fillRect(-5, by + 8, 10, 2);
      c.fillRect(-6, by + 10, 12, 2);
      c.fillRect(-7, by + 12, 14, 2);
      c.fillStyle = shadeColor(pants, 0.85);
      c.fillRect(-7, by + 13, 14, 1);
      c.fillStyle = skin;
      c.fillRect(-4, by + 14, 3, 2);
      c.fillRect(1, by + 14, 3, 2);
    }
  }

  if (top === 'robe') {
    c.fillStyle = shirt;
    c.fillRect(torsoX, by + 2, torsoW, 8);
    c.fillRect(-6, by + 10, 12, 4);
    c.fillRect(-7, by + 14, 14, 2);
    c.fillStyle = shadeColor(shirt, 0.85);
    c.fillRect(-7, by + 15, 14, 1);
    c.fillStyle = skin;
    c.fillRect(-3, by + 16, 2, 0);
  } else if (top === 'tank') {
    c.fillStyle = skin;
    c.fillRect(torsoX, by + 2, torsoW, 2);
    c.fillStyle = shirt;
    c.fillRect(torsoX + 1, by + 2, torsoW - 2, 8);
    c.fillRect(torsoX + 1, by + 4, torsoW - 2, 6);
  } else {
    c.fillStyle = shirt;
    c.fillRect(torsoX, by + 2, torsoW, 8);
  }
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(torsoX, by + 9, torsoW, 1);

  if (top === 'pull') {
    c.fillStyle = shirt;
    c.fillRect(armX, by + 4, 2, 4);
    c.fillRect(armX2, by + 4, 2, 4);
    c.fillStyle = shadeColor(shirt, 0.8);
    c.fillRect(armX, by + 7, 2, 1);
    c.fillRect(armX2, by + 7, 2, 1);
  } else if (top === 'tank') {
    c.fillStyle = skin;
    c.fillRect(armX, by + 3, 2, 5);
    c.fillRect(armX2, by + 3, 2, 5);
  } else {
    c.fillStyle = shirt;
    c.fillRect(armX, by + 4, 2, 1);
    c.fillRect(armX2, by + 4, 2, 1);
    c.fillStyle = skin;
    c.fillRect(armX, by + 5, 2, 3);
    c.fillRect(armX2, by + 5, 2, 3);
  }

  c.fillStyle = skin;
  c.fillRect(-5, by - 8, 10, 10);

  if (style !== 'bald') {
    c.fillStyle = hair;
    c.fillRect(-6, by - 9, 12, 5);
    c.fillRect(-6, by - 4, 2, 4);
    c.fillRect(4, by - 4, 2, 4);
    if (style === 'long') {
      c.fillRect(-6, by, 2, 5);
      c.fillRect(4, by, 2, 5);
      c.fillRect(-5, by + 2, 10, 4);
    } else if (style === 'tuft') {
      c.fillRect(-2, by - 12, 4, 3);
      c.fillRect(-1, by - 14, 2, 2);
    }
  }

  if (dir === 'down') {
    c.fillStyle = '#1a1a1a';
    c.fillRect(-3, by - 4, 1, 1);
    c.fillRect(2, by - 4, 1, 1);
    if (gender === 'f') {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(-3, by - 3, 1, 1);
      c.fillRect(2, by - 3, 1, 1);
    }
    c.fillStyle = '#d88a8a';
    c.fillRect(-1, by - 1, 2, 1);
    if (gender === 'f') {
      c.fillStyle = 'rgba(216,138,138,0.45)';
      c.fillRect(-4, by - 2, 1, 1);
      c.fillRect(3, by - 2, 1, 1);
    }
  } else if (dir === 'up') {
    if (style !== 'bald') {
      c.fillStyle = hair;
      c.fillRect(-5, by - 8, 10, 8);
    }
  } else if (dir === 'left') {
    c.fillStyle = '#1a1a1a';
    c.fillRect(-3, by - 4, 1, 1);
    if (style !== 'bald') {
      c.fillStyle = hair;
      c.fillRect(1, by - 8, 4, 6);
    }
  } else if (dir === 'right') {
    c.fillStyle = '#1a1a1a';
    c.fillRect(2, by - 4, 1, 1);
    if (style !== 'bald') {
      c.fillStyle = hair;
      c.fillRect(-5, by - 8, 4, 6);
    }
  }
}

function shadeColor(hex, factor) {
  const v = parseInt(hex.slice(1), 16);
  let r = Math.floor(((v >> 16) & 0xff) * factor);
  let g = Math.floor(((v >> 8) & 0xff) * factor);
  let b = Math.floor((v & 0xff) * factor);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function drawPlayer() {
  const [px, py] = getPlayerPixelPos();
  const cx = px + TILE / 2;
  const baseY = py + TILE - 4;
  const moving = state.path && state.path.length > 0 && !state.action;
  const sleeping = state.action?.key === 'sleep';

  if (sleeping) {
    drawSleepingZ(px, py);
    return;
  }

  ctx.save();
  ctx.translate(cx, baseY);
  drawCharacter(ctx, state.appearance, state.player.dir, moving, state.player.anim);
  ctx.restore();
}

function drawSleepingZ(px, py) {
  const t = performance.now() / 600;
  const app = state.appearance;
  ctx.fillStyle = app.shirt || '#5b7db1';
  ctx.fillRect(px + 4, py + 18, TILE - 8, 8);
  ctx.fillStyle = app.skin || '#fbc8a8';
  ctx.fillRect(px + 8, py + 14, 8, 6);
  if (app.hairStyle !== 'bald') {
    ctx.fillStyle = app.hair || '#5c3d1e';
    ctx.fillRect(px + 8, py + 14, 8, 3);
  }
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = `rgba(245,236,217,${0.5 + 0.5 * Math.sin(t)})`;
  ctx.fillText('z', px + TILE - 8, py + 12 + Math.sin(t) * 2);
  ctx.fillText('Z', px + TILE - 4, py + 6 + Math.cos(t) * 2);
}

function drawDayNight() {
  const t = state.timeMin;
  let alpha = 0, color = '0,0,40';
  if (t < 5 * 60) { alpha = 0.55; color = '20,20,60'; }
  else if (t < 7 * 60) { alpha = 0.55 - ((t - 5 * 60) / 120) * 0.4; color = '60,40,80'; }
  else if (t < 17 * 60) { alpha = 0.0; }
  else if (t < 20 * 60) { alpha = ((t - 17 * 60) / 180) * 0.4; color = '80,40,60'; }
  else if (t < 22 * 60) { alpha = 0.4 + ((t - 20 * 60) / 120) * 0.2; color = '30,20,60'; }
  else { alpha = 0.6; color = '20,20,60'; }
  if (alpha > 0) {
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPathHint() {
  if (!state.path || !state.path.length || state.action) return;
  ctx.fillStyle = 'rgba(244,184,96,0.35)';
  for (const [x, y] of state.path) {
    ctx.beginPath();
    ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

const bootEl = document.getElementById('boot');
const gameEl = document.getElementById('game');
const nameInput = document.getElementById('name-input');
const startBtn = document.getElementById('start-btn');
const continueBtn = document.getElementById('continue-btn');

let pendingAppearance = defaultAppearance();

const saved = loadGame();
if (saved && saved.name) {
  continueBtn.hidden = false;
  nameInput.value = saved.name;
  if (saved.appearance) pendingAppearance = { ...defaultAppearance(), ...saved.appearance };
}

buildPickers();
drawPreview();

function buildPickers() {
  for (const [key, options] of Object.entries(APPEARANCE_PALETTES)) {
    const container = document.querySelector(`.swatches[data-picker="${key}"]`);
    if (!container) continue;
    container.innerHTML = '';
    if (typeof options[0] === 'object') {
      for (const opt of options) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'swatch';
        el.dataset.value = opt.id;
        el.textContent = opt.label;
        el.addEventListener('click', () => selectAppearance(key, opt.id));
        container.appendChild(el);
      }
    } else {
      for (const c of options) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'swatch';
        el.dataset.value = c;
        el.style.background = c;
        el.addEventListener('click', () => selectAppearance(key, c));
        container.appendChild(el);
      }
    }
  }
  refreshPickers();
}

function selectAppearance(key, value) {
  pendingAppearance[key] = value;
  refreshPickers();
  drawPreview();
}

function refreshPickers() {
  for (const key of Object.keys(APPEARANCE_PALETTES)) {
    const container = document.querySelector(`.swatches[data-picker="${key}"]`);
    if (!container) continue;
    container.querySelectorAll('.swatch').forEach(el => {
      el.classList.toggle('selected', el.dataset.value === pendingAppearance[key]);
    });
  }
}

function drawPreview() {
  const c = document.getElementById('preview-canvas');
  if (!c) return;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  cx.clearRect(0, 0, c.width, c.height);
  const grad = cx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#5b4a78');
  grad.addColorStop(1, '#3a2d52');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, c.width, c.height);
  cx.fillStyle = 'rgba(255,236,217,0.12)';
  cx.fillRect(0, c.height - 16, c.width, 16);
  cx.fillStyle = 'rgba(0,0,0,0.25)';
  cx.fillRect(0, c.height - 16, c.width, 1);
  cx.save();
  cx.translate(c.width / 2, c.height - 14);
  cx.scale(3, 3);
  drawCharacter(cx, pendingAppearance, 'down', false, 0);
  cx.restore();
}

startBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Toi';
  state = defaultState(name);
  state.appearance = { ...pendingAppearance };
  saveGame();
  startGame();
});
continueBtn.addEventListener('click', () => {
  if (saved) applyLoaded(saved);
  startGame();
});

function startGame() {
  bootEl.hidden = true;
  gameEl.hidden = false;
  resizeCanvas();
  updateHUD();
  requestAnimationFrame(loop);
}

function resizeCanvas() {
  const stage = document.getElementById('stage');
  const r = stage.getBoundingClientRect();
  const ratio = W / H;
  let cw = r.width - 16, ch = r.height - 16;
  if (cw / ch > ratio) cw = ch * ratio; else ch = cw / ratio;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}

window.addEventListener('resize', () => { if (!gameEl.hidden) resizeCanvas(); });
window.addEventListener('orientationchange', () => { if (!gameEl.hidden) resizeCanvas(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveGame();
});
window.addEventListener('beforeunload', saveGame);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
