import * as THREE from 'three';

const COLS = 10;
const ROWS = 14;
const DAY_MIN = 1440;
const SAVE_KEY = 'lolylife.save.v1';
const LEGACY_SAVE_KEY = 'cozylife.save.v1';
const REAL_SEC_PER_GAME_MIN = 0.5;
const SLEEP_SPEED = 12;

const ZONES = [
  { name: 'bedroom', x0: 0, y0: 0, x1: 10, y1: 5, color: 0xdac9e6 },
  { name: 'bath', x0: 0, y0: 5, x1: 5, y1: 8, color: 0xbedde9 },
  { name: 'office', x0: 5, y0: 5, x1: 10, y1: 8, color: 0xe8c8b0 },
  { name: 'kitchen', x0: 0, y0: 8, x1: 5, y1: 14, color: 0xecd9a3 },
  { name: 'living', x0: 5, y0: 8, x1: 10, y1: 14, color: 0xcee0c5 },
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
  hunger: 0.14, energy: 0.08, hygiene: 0.07, social: 0.05, fun: 0.06,
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
  };
}

let state = defaultState();
let pendingAppearance = defaultAppearance();

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

let scene, camera, renderer, sun, hemi, ambientNight;
let playerGroup, playerLegL, playerLegR, playerArmL, playerArmR, playerHead, playerHair;
let raycaster, pointer;
let itemMeshes = [];
let windowMeshes = [];
let floorMesh;

const canvasEl = document.getElementById('canvas');

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1428);
  scene.fog = new THREE.Fog(0x1a1428, 18, 32);

  const stage = document.getElementById('stage');
  const w = stage.clientWidth || 360;
  const h = stage.clientHeight || 600;

  const aspect = w / h;
  const d = 9;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 100);
  positionCamera();

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  hemi = new THREE.HemisphereLight(0xfff5d0, 0x404060, 0.55);
  scene.add(hemi);

  sun = new THREE.DirectionalLight(0xffeac0, 0.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 40;
  const sd = 12;
  sun.shadow.camera.left = -sd;
  sun.shadow.camera.right = sd;
  sun.shadow.camera.top = sd;
  sun.shadow.camera.bottom = -sd;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  ambientNight = new THREE.PointLight(0xffd585, 0, 12, 1.6);
  ambientNight.position.set(COLS / 2, 2.4, ROWS / 2);
  scene.add(ambientNight);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  buildWorld();
  buildItems();
  buildPlayer();

  canvasEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

function positionCamera() {
  const cx = COLS / 2;
  const cz = ROWS / 2;
  camera.position.set(cx + 13, 16, cz + 13);
  camera.lookAt(cx, 0.5, cz);
}

function buildWorld() {
  const baseGeom = new THREE.BoxGeometry(COLS + 2, 0.6, ROWS + 2);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.set(COLS / 2, -0.3, ROWS / 2);
  base.receiveShadow = true;
  scene.add(base);

  for (const zone of ZONES) {
    const w = zone.x1 - zone.x0;
    const h = zone.y1 - zone.y0;
    const geom = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshLambertMaterial({ color: zone.color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x0 + w / 2, 0, zone.y0 + h / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8b6f47 });
  const wallTopMat = new THREE.MeshLambertMaterial({ color: 0xa48761 });
  const wallH = 2.2;
  const wallGeom = new THREE.BoxGeometry(1, wallH, 1);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 1) continue;
      const mesh = new THREE.Mesh(wallGeom, wallMat);
      mesh.position.set(x + 0.5, wallH / 2, y + 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  const winPositions = [{ x: 2, y: 0 }, { x: 7, y: 0 }];
  for (const w of winPositions) {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.9, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x5b4a30 })
    );
    frame.position.set(w.x + 0.5, 1.3, w.y + 1.0 - 0.025);
    scene.add(frame);

    const glassMat = new THREE.MeshBasicMaterial({ color: 0x7ec0e8, transparent: true, opacity: 0.85 });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.78), glassMat);
    glass.position.set(w.x + 0.5, 1.3, w.y + 1.0);
    glass.rotation.y = Math.PI;
    glassMat.userData.glow = false;
    scene.add(glass);
    windowMeshes.push(glass);
  }

  drawRug(6, 10, 2, 1, 0xa86060);
  drawRug(2, 3, 2, 1, 0x7a6f9b);
}

function drawRug(x, y, w, h, color) {
  const geom = new THREE.PlaneGeometry(w * 0.85, h * 0.65);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x + w / 2, 0.005, y + h / 2);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildItems() {
  for (const it of ITEMS) {
    const group = new THREE.Group();
    group.position.set(it.x + it.w / 2, 0, it.y + it.h / 2);
    buildItemMeshes(group, it);
    group.userData.item = it;
    group.traverse(o => { if (o.isMesh) o.userData.parentGroup = group; });
    scene.add(group);
    itemMeshes.push(group);
  }
}

function buildItemMeshes(group, it) {
  const w = it.w, h = it.h;
  const add = (geom, color, x, y, z, opts = {}) => {
    const mat = new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.emissiveIntensity || 0 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  switch (it.type) {
    case 'bed': {
      add(new THREE.BoxGeometry(w * 0.95, 0.3, h * 0.92), 0x6b4a30, 0, 0.15, 0);
      add(new THREE.BoxGeometry(w * 0.85, 0.18, h * 0.82), 0x5b7db1, 0, 0.39, 0);
      add(new THREE.BoxGeometry(0.5, 0.12, h * 0.4), 0xf5e6d3, -w * 0.28, 0.55, 0);
      add(new THREE.BoxGeometry(0.05, 0.7, h * 0.92), 0x8b6841, -w * 0.5 + 0.025, 0.35, 0);
      break;
    }
    case 'wardrobe': {
      add(new THREE.BoxGeometry(0.85, 1.8, 0.5), 0x8b6841, 0, 0.9, 0);
      add(new THREE.BoxGeometry(0.04, 1.7, 0.04), 0x3a2818, 0, 0.85, 0.27);
      add(new THREE.BoxGeometry(0.06, 0.06, 0.06), 0xd4a857, -0.18, 0.85, 0.27);
      add(new THREE.BoxGeometry(0.06, 0.06, 0.06), 0xd4a857, 0.18, 0.85, 0.27);
      break;
    }
    case 'shower': {
      add(new THREE.BoxGeometry(0.9, 0.05, 0.9), 0xc0c0c0, 0, 0.025, 0);
      add(new THREE.BoxGeometry(0.85, 1.6, 0.85), 0xa8c5d4, 0, 0.85, 0, { cast: false });
      const showerMat = group.children[group.children.length - 1].material;
      showerMat.transparent = true;
      showerMat.opacity = 0.45;
      add(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), 0x7ec6e0, 0, 1.7, -0.2);
      break;
    }
    case 'toilet': {
      add(new THREE.BoxGeometry(0.55, 0.5, 0.55), 0xf0f0f0, 0, 0.25, 0);
      add(new THREE.BoxGeometry(0.5, 0.55, 0.18), 0xf0f0f0, 0, 0.55, -0.2);
      add(new THREE.BoxGeometry(0.4, 0.06, 0.4), 0xa8c5d4, 0, 0.53, 0.05);
      break;
    }
    case 'computer': {
      add(new THREE.BoxGeometry(0.85, 0.5, 0.5), 0x6b4a30, 0, 0.25, 0);
      add(new THREE.BoxGeometry(0.55, 0.4, 0.06), 0x2c3e50, 0, 0.7, -0.18);
      add(new THREE.BoxGeometry(0.45, 0.3, 0.04), 0x1a8fb8, 0, 0.7, -0.16, { emissive: 0x1a8fb8, emissiveIntensity: 0.3 });
      add(new THREE.BoxGeometry(0.35, 0.04, 0.18), 0x1a1a1a, 0, 0.52, 0.1);
      break;
    }
    case 'plant': {
      add(new THREE.CylinderGeometry(0.18, 0.14, 0.25, 8), 0x8b5a3c, 0, 0.125, 0);
      add(new THREE.SphereGeometry(0.25, 10, 8), 0x4a8c5a, 0, 0.45, 0);
      add(new THREE.SphereGeometry(0.18, 10, 8), 0x5fa572, -0.1, 0.55, 0.05);
      add(new THREE.SphereGeometry(0.18, 10, 8), 0x3a7a4a, 0.12, 0.5, -0.08);
      break;
    }
    case 'fridge': {
      add(new THREE.BoxGeometry(0.7, 1.5, 0.55), 0xe8e8e8, 0, 0.75, 0);
      add(new THREE.BoxGeometry(0.72, 0.04, 0.57), 0xb8b8b8, 0, 0.75, 0);
      add(new THREE.BoxGeometry(0.04, 0.18, 0.04), 0x888, 0.27, 0.4, 0.27);
      add(new THREE.BoxGeometry(0.04, 0.18, 0.04), 0x888, 0.27, 1.1, 0.27);
      break;
    }
    case 'stove': {
      add(new THREE.BoxGeometry(0.85, 0.85, 0.55), 0x3d3d3d, 0, 0.425, 0);
      add(new THREE.BoxGeometry(0.8, 0.04, 0.5), 0x5a5a5a, 0, 0.85, 0);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), 0x1a1a1a, -0.18, 0.87, -0.08);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), 0x1a1a1a, 0.18, 0.87, -0.08);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 8), 0xff6b35, -0.18, 0.88, -0.08, { emissive: 0xff6b35, emissiveIntensity: 0.5 });
      break;
    }
    case 'counter': {
      add(new THREE.BoxGeometry(0.85, 0.85, 0.55), 0x6b4a30, 0, 0.425, 0);
      add(new THREE.BoxGeometry(0.9, 0.06, 0.6), 0xd8c8a0, 0, 0.88, 0);
      break;
    }
    case 'tv': {
      add(new THREE.BoxGeometry(0.7, 0.45, 0.06), 0x1a1a1a, 0, 0.95, -0.2);
      add(new THREE.BoxGeometry(0.6, 0.36, 0.04), 0x3a7a9a, 0, 0.95, -0.18, { emissive: 0x5b9fc8, emissiveIntensity: 0.3 });
      add(new THREE.BoxGeometry(0.85, 0.6, 0.5), 0x6b4a30, 0, 0.3, 0);
      break;
    }
    case 'sofa': {
      add(new THREE.BoxGeometry(w * 0.95, 0.35, 0.65), 0xa85b5b, 0, 0.2, 0);
      add(new THREE.BoxGeometry(w * 0.95, 0.45, 0.18), 0xc97a7a, 0, 0.6, -0.27);
      add(new THREE.BoxGeometry(0.18, 0.3, 0.65), 0x8a4848, -w * 0.4, 0.55, 0);
      add(new THREE.BoxGeometry(0.18, 0.3, 0.65), 0x8a4848, w * 0.4, 0.55, 0);
      add(new THREE.BoxGeometry(0.32, 0.18, 0.32), 0xf5d8d8, -w * 0.18, 0.5, 0.1);
      add(new THREE.BoxGeometry(0.32, 0.18, 0.32), 0xf5d8d8, w * 0.18, 0.5, 0.1);
      break;
    }
  }
}

function buildPlayer() {
  if (playerGroup) {
    scene.remove(playerGroup);
    playerGroup.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  playerGroup = new THREE.Group();
  const app = state.appearance;

  const skin = new THREE.Color(app.skin);
  const hairC = new THREE.Color(app.hair);
  const shirtC = new THREE.Color(app.shirt);
  const pantsC = new THREE.Color(app.pants);

  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const hairMat = new THREE.MeshLambertMaterial({ color: hairC });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirtC });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pantsC });

  const isWoman = app.gender === 'f';
  const torsoW = isWoman ? 0.36 : 0.42;

  if (app.top === 'robe') {
    const dress = new THREE.Mesh(new THREE.BoxGeometry(torsoW, 0.55, 0.22), shirtMat);
    dress.position.y = 0.85;
    dress.castShadow = true;
    dress.receiveShadow = true;
    playerGroup.add(dress);
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.4, 0.45, 8),
      shirtMat
    );
    skirt.position.y = 0.32;
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    playerGroup.add(skirt);
  } else {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, 0.5, 0.22), shirtMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    torso.receiveShadow = true;
    playerGroup.add(torso);

    if (app.top === 'tank') {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.005, 0.18, 0.225), skinMat);
      sk.position.y = 1.02;
      sk.castShadow = true;
      playerGroup.add(sk);
    }

    if (app.bottom === 'pants') {
      const legGeom = new THREE.BoxGeometry(0.13, 0.5, 0.16);
      legGeom.translate(0, -0.25, 0);
      playerLegL = new THREE.Mesh(legGeom, pantsMat);
      playerLegL.position.set(-0.08, 0.6, 0);
      playerLegL.castShadow = true;
      playerGroup.add(playerLegL);
      playerLegR = new THREE.Mesh(legGeom, pantsMat);
      playerLegR.position.set(0.08, 0.6, 0);
      playerLegR.castShadow = true;
      playerGroup.add(playerLegR);
    } else if (app.bottom === 'short') {
      const sLegGeom = new THREE.BoxGeometry(0.13, 0.22, 0.16);
      sLegGeom.translate(0, -0.11, 0);
      playerLegL = new THREE.Mesh(sLegGeom, pantsMat);
      playerLegL.position.set(-0.08, 0.6, 0);
      playerLegL.castShadow = true;
      playerGroup.add(playerLegL);
      const skLegGeom = new THREE.BoxGeometry(0.13, 0.28, 0.16);
      skLegGeom.translate(0, -0.14, 0);
      const skinLegL = new THREE.Mesh(skLegGeom, skinMat);
      skinLegL.position.set(-0.08, 0.38, 0);
      skinLegL.castShadow = true;
      playerLegL.userData.skinPart = skinLegL;
      playerGroup.add(skinLegL);
      playerLegR = new THREE.Mesh(sLegGeom, pantsMat);
      playerLegR.position.set(0.08, 0.6, 0);
      playerLegR.castShadow = true;
      playerGroup.add(playerLegR);
      const skinLegR = new THREE.Mesh(skLegGeom, skinMat);
      skinLegR.position.set(0.08, 0.38, 0);
      skinLegR.castShadow = true;
      playerLegR.userData.skinPart = skinLegR;
      playerGroup.add(skinLegR);
    } else if (app.bottom === 'skirt') {
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.32, 0.3, 8),
        pantsMat
      );
      skirt.position.y = 0.45;
      skirt.castShadow = true;
      playerGroup.add(skirt);
      const skLegGeom = new THREE.BoxGeometry(0.1, 0.25, 0.1);
      skLegGeom.translate(0, -0.125, 0);
      playerLegL = new THREE.Mesh(skLegGeom, skinMat);
      playerLegL.position.set(-0.08, 0.3, 0);
      playerLegL.castShadow = true;
      playerGroup.add(playerLegL);
      playerLegR = new THREE.Mesh(skLegGeom, skinMat);
      playerLegR.position.set(0.08, 0.3, 0);
      playerLegR.castShadow = true;
      playerGroup.add(playerLegR);
    }
  }

  const armMat = (app.top === 'pull') ? shirtMat : skinMat;
  const armGeom = new THREE.BoxGeometry(0.1, 0.45, 0.1);
  armGeom.translate(0, -0.22, 0);
  playerArmL = new THREE.Mesh(armGeom, armMat);
  playerArmL.position.set(-(torsoW / 2 + 0.05), 1.08, 0);
  playerArmL.castShadow = true;
  playerGroup.add(playerArmL);
  playerArmR = new THREE.Mesh(armGeom, armMat);
  playerArmR.position.set(torsoW / 2 + 0.05, 1.08, 0);
  playerArmR.castShadow = true;
  playerGroup.add(playerArmR);

  if (app.top !== 'pull' && app.top !== 'tank') {
    const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.13), shirtMat);
    sleeveL.position.set(-(torsoW / 2 + 0.05), 1.05, 0);
    sleeveL.castShadow = true;
    playerGroup.add(sleeveL);
    const sleeveR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.13), shirtMat);
    sleeveR.position.set(torsoW / 2 + 0.05, 1.05, 0);
    sleeveR.castShadow = true;
    playerGroup.add(sleeveR);
  }

  playerHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), skinMat);
  playerHead.position.y = 1.32;
  playerHead.castShadow = true;
  playerGroup.add(playerHead);

  if (app.hairStyle !== 'bald') {
    const hairGroup = new THREE.Group();
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    cap.position.y = 1.32;
    cap.castShadow = true;
    hairGroup.add(cap);
    if (app.hairStyle === 'long') {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.12), hairMat);
      back.position.set(0, 1.18, 0.12);
      back.castShadow = true;
      hairGroup.add(back);
    } else if (app.hairStyle === 'tuft') {
      const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.1), hairMat);
      tuft.position.y = 1.55;
      tuft.castShadow = true;
      hairGroup.add(tuft);
    }
    playerHair = hairGroup;
    playerGroup.add(hairGroup);
  }

  const eyeGeom = new THREE.BoxGeometry(0.025, 0.025, 0.01);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.06, 1.34, -0.16);
  playerGroup.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
  eyeR.position.set(0.06, 1.34, -0.16);
  playerGroup.add(eyeR);

  playerGroup.position.set(state.player.x + 0.5, 0, state.player.y + 0.5);
  playerGroup.rotation.y = Math.PI;
  scene.add(playerGroup);
}

function updatePlayerFacing(dir) {
  const angles = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
  const target = angles[dir] ?? 0;
  let cur = playerGroup.rotation.y;
  let delta = target - cur;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  playerGroup.rotation.y = cur + delta * 0.25;
}

function onPointerDown(e) {
  if (state.action) return;
  const rect = canvasEl.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(itemMeshes, true);
  if (hits.length > 0) {
    let g = hits[0].object;
    while (g && !g.userData?.item) g = g.parent;
    if (g) {
      const it = g.userData.item;
      const approach = findApproach(it, state.player.x, state.player.y);
      if (approach) {
        state.path = approach.path;
        state.pendingItem = it;
      } else {
        toast("J'peux pas y aller.");
      }
      return;
    }
  }

  const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeY, hit);
  if (hit) {
    const tx = Math.floor(hit.x);
    const ty = Math.floor(hit.z);
    if (isWalkable(tx, ty)) {
      const path = bfs(state.player.x, state.player.y, tx, ty);
      if (path && path.length) {
        state.path = path;
        state.pendingItem = null;
      }
    }
  }
}

function onResize() {
  if (!gameEl || gameEl.hidden) return;
  const stage = document.getElementById('stage');
  const w = stage.clientWidth, h = stage.clientHeight;
  const aspect = w / h;
  const d = 9;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

let saveAccum = 0;
let lastTs = 0;

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  tick(dt);
  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function tick(dt) {
  for (const k of NEED_KEYS) {
    state.needs[k] = Math.max(0, state.needs[k] - DECAY[k] * dt);
  }
  if (state.needs.hunger < 5) state.needs.fun = Math.max(0, state.needs.fun - 0.05 * dt * 60);

  let timeStep = dt / REAL_SEC_PER_GAME_MIN;
  if (state.action?.fast) timeStep *= SLEEP_SPEED;
  state.timeMin += timeStep;
  while (state.timeMin >= DAY_MIN) {
    state.timeMin -= DAY_MIN;
    state.day++;
  }

  if (state.path && state.path.length && !state.action) {
    const speed = 4;
    state.player.sub += dt * speed;
    state.player.anim += dt * 9;
    const [nx, ny] = state.path[0];
    const dx = nx - state.player.x, dy = ny - state.player.y;
    if (Math.abs(dx) > Math.abs(dy)) state.player.dir = dx > 0 ? 'right' : 'left';
    else state.player.dir = dy > 0 ? 'down' : 'up';

    const interpX = state.player.x + dx * state.player.sub;
    const interpZ = state.player.y + dy * state.player.sub;
    if (playerGroup) playerGroup.position.set(interpX + 0.5, 0, interpZ + 0.5);

    const swing = Math.sin(state.player.anim) * 0.55;
    if (playerLegL) playerLegL.rotation.x = swing;
    if (playerLegR) playerLegR.rotation.x = -swing;
    if (playerLegL?.userData?.skinPart) playerLegL.userData.skinPart.position.y = 0.38 - Math.abs(swing) * 0.05;
    if (playerLegR?.userData?.skinPart) playerLegR.userData.skinPart.position.y = 0.38 - Math.abs(swing) * 0.05;
    if (playerArmL) playerArmL.rotation.x = -swing;
    if (playerArmR) playerArmR.rotation.x = swing;

    updatePlayerFacing(state.player.dir);

    if (state.player.sub >= 1) {
      state.player.sub = 0;
      const [nx2, ny2] = state.path.shift();
      state.player.x = nx2;
      state.player.y = ny2;
      if (state.path.length === 0 && state.pendingItem) {
        const it = state.pendingItem;
        state.pendingItem = null;
        if (it.action) startAction(it.action, it);
      }
    }
  } else if (!state.action) {
    if (playerLegL) playerLegL.rotation.x *= 0.85;
    if (playerLegR) playerLegR.rotation.x *= 0.85;
    if (playerArmL) playerArmL.rotation.x *= 0.85;
    if (playerArmR) playerArmR.rotation.x *= 0.85;
  } else if (state.action) {
    if (state.action.key === 'sleep') {
      if (playerGroup) {
        playerGroup.rotation.z = -Math.PI / 2;
        playerGroup.position.y = 0.5;
      }
    }
  }

  if (state.action) {
    const a = state.action;
    a.elapsedMin += timeStep;
    const pct = Math.min(1, a.elapsedMin / a.totalMin);
    document.querySelector('.action-fill').style.width = (pct * 100) + '%';
    if (a.key === 'sleep' && state.needs.energy >= 100) finishAction();
    else if (a.elapsedMin >= a.totalMin) finishAction();
  }

  updateDayNight();

  saveAccum += dt;
  if (saveAccum > 8) { saveAccum = 0; saveGame(); }
}

function updateDayNight() {
  const t = state.timeMin / 60;
  const dayPhase = ((t - 6) / 12) * Math.PI;
  const cx = COLS / 2, cz = ROWS / 2;
  const radius = 14;
  sun.position.set(
    cx + Math.cos(dayPhase) * radius,
    Math.max(2, Math.sin(dayPhase) * radius),
    cz - 4
  );
  sun.target.position.set(cx, 0, cz);

  let dayFactor = 0;
  if (t > 5 && t < 21) {
    if (t < 7) dayFactor = (t - 5) / 2;
    else if (t > 19) dayFactor = (21 - t) / 2;
    else dayFactor = 1;
  }

  sun.intensity = 0.15 + dayFactor * 0.85;
  hemi.intensity = 0.25 + dayFactor * 0.5;
  ambientNight.intensity = (1 - dayFactor) * 1.2;

  let sky = 0x1a1428;
  if (dayFactor > 0.7) sky = 0x6a8caa;
  else if (dayFactor > 0.3) sky = 0x9a7568;
  else if (dayFactor > 0.05) sky = 0x3a2d52;
  scene.background.setHex(sky);
  scene.fog.color.setHex(sky);

  for (const win of windowMeshes) {
    if (dayFactor > 0.5) win.material.color.setHex(0x7ec0e8);
    else if (dayFactor > 0.2) win.material.color.setHex(0xe89868);
    else win.material.color.setHex(0xfdd585);
  }
}

function startAction(key, item) {
  const def = ACTIONS[key];
  if (!def) return;
  if (def.money && state.money + def.money < 0) {
    toast("Pas assez d'argent.");
    return;
  }
  state.action = { key, item, def, elapsedMin: 0, totalMin: def.durationMin, fast: !!def.fast };
  if (item) state.player.dir = facingFor(state.player, item);
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
    if (k in state.needs) state.needs[k] = Math.max(0, Math.min(100, state.needs[k] + v));
  }
  if (a.def.money) state.money = Math.max(0, state.money + a.def.money);
  toast(a.def.label + ' ✓');
  spawnEmote(emoteFor(a.key));
  state.action = null;
  document.getElementById('action-panel').hidden = true;
  if (playerGroup) {
    playerGroup.rotation.z = 0;
    playerGroup.position.y = 0;
  }
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
  if (!playerGroup) return;
  const v = new THREE.Vector3();
  v.setFromMatrixPosition(playerGroup.matrixWorld);
  v.y += 1.6;
  v.project(camera);
  const stage = document.getElementById('stage');
  const r = stage.getBoundingClientRect();
  const sx = (v.x * 0.5 + 0.5) * r.width;
  const sy = (-v.y * 0.5 + 0.5) * r.height;
  el.textContent = symbol;
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
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
    if (playerGroup) {
      playerGroup.rotation.z = 0;
      playerGroup.position.y = 0;
    }
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

function drawCharacter2D(c, app, dir, moving, anim) {
  const skin = app.skin || '#fbc8a8';
  const hair = app.hair || '#5c3d1e';
  const shirt = app.shirt || '#5b8aaf';
  const pants = app.pants || '#3c4a5c';
  const style = app.hairStyle || 'short';
  const gender = app.gender || 'f';
  const top = app.top || 'tshirt';
  const bottom = app.bottom || 'pants';
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath(); c.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2); c.fill();
  const by = -14;
  const torsoW = gender === 'f' ? 10 : 12;
  const torsoX = -torsoW / 2;
  const armX = gender === 'f' ? -6 : -7;
  const armX2 = gender === 'f' ? 4 : 5;
  if (top !== 'robe') {
    if (bottom === 'pants') {
      c.fillStyle = pants; c.fillRect(-5, by + 8, 4, 8); c.fillRect(1, by + 8, 4, 8);
    } else if (bottom === 'short') {
      c.fillStyle = pants; c.fillRect(-5, by + 8, 4, 4); c.fillRect(1, by + 8, 4, 4);
      c.fillStyle = skin; c.fillRect(-5, by + 12, 4, 4); c.fillRect(1, by + 12, 4, 4);
    } else if (bottom === 'skirt') {
      c.fillStyle = pants;
      c.fillRect(-5, by + 8, 10, 2); c.fillRect(-6, by + 10, 12, 2); c.fillRect(-7, by + 12, 14, 2);
      c.fillStyle = skin; c.fillRect(-4, by + 14, 3, 2); c.fillRect(1, by + 14, 3, 2);
    }
  }
  if (top === 'robe') {
    c.fillStyle = shirt;
    c.fillRect(torsoX, by + 2, torsoW, 8);
    c.fillRect(-6, by + 10, 12, 4); c.fillRect(-7, by + 14, 14, 2);
  } else if (top === 'tank') {
    c.fillStyle = skin; c.fillRect(torsoX, by + 2, torsoW, 2);
    c.fillStyle = shirt; c.fillRect(torsoX + 1, by + 4, torsoW - 2, 6);
  } else {
    c.fillStyle = shirt; c.fillRect(torsoX, by + 2, torsoW, 8);
  }
  if (top === 'pull') {
    c.fillStyle = shirt; c.fillRect(armX, by + 4, 2, 4); c.fillRect(armX2, by + 4, 2, 4);
  } else if (top === 'tank') {
    c.fillStyle = skin; c.fillRect(armX, by + 3, 2, 5); c.fillRect(armX2, by + 3, 2, 5);
  } else {
    c.fillStyle = shirt; c.fillRect(armX, by + 4, 2, 1); c.fillRect(armX2, by + 4, 2, 1);
    c.fillStyle = skin; c.fillRect(armX, by + 5, 2, 3); c.fillRect(armX2, by + 5, 2, 3);
  }
  c.fillStyle = skin; c.fillRect(-5, by - 8, 10, 10);
  if (style !== 'bald') {
    c.fillStyle = hair;
    c.fillRect(-6, by - 9, 12, 5);
    c.fillRect(-6, by - 4, 2, 4); c.fillRect(4, by - 4, 2, 4);
    if (style === 'long') {
      c.fillRect(-6, by, 2, 5); c.fillRect(4, by, 2, 5); c.fillRect(-5, by + 2, 10, 4);
    } else if (style === 'tuft') {
      c.fillRect(-2, by - 12, 4, 3); c.fillRect(-1, by - 14, 2, 2);
    }
  }
  c.fillStyle = '#1a1a1a';
  c.fillRect(-3, by - 4, 1, 1); c.fillRect(2, by - 4, 1, 1);
  c.fillStyle = '#d88a8a'; c.fillRect(-1, by - 1, 2, 1);
}

const bootEl = document.getElementById('boot');
const gameEl = document.getElementById('game');
const nameInput = document.getElementById('name-input');
const startBtn = document.getElementById('start-btn');
const continueBtn = document.getElementById('continue-btn');

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
        el.type = 'button'; el.className = 'swatch';
        el.dataset.value = opt.id; el.textContent = opt.label;
        el.addEventListener('click', () => selectAppearance(key, opt.id));
        container.appendChild(el);
      }
    } else {
      for (const c of options) {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'swatch';
        el.dataset.value = c; el.style.background = c;
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
  cx.fillStyle = grad; cx.fillRect(0, 0, c.width, c.height);
  cx.fillStyle = 'rgba(255,236,217,0.12)';
  cx.fillRect(0, c.height - 16, c.width, 16);
  cx.save();
  cx.translate(c.width / 2, c.height - 14);
  cx.scale(3, 3);
  drawCharacter2D(cx, pendingAppearance, 'down', false, 0);
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
  init3D();
  updateHUD();
  requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
window.addEventListener('beforeunload', saveGame);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
