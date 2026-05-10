import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function rb(w, h, d, r = 0.05, segs = 2) {
  return new RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
}
function lamMat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
  });
}

const COLS = 10;
const ROWS = 18;
const APT_ROWS = 14;
const DAY_MIN = 1440;
const SAVE_KEY = 'lolylife.save.v1';
const LEGACY_SAVE_KEY = 'cozylife.save.v1';
const REAL_SEC_PER_GAME_MIN = 0.5;
const SLEEP_SPEED = 12;

const ZONES = [
  { name: 'bedroom', x0: 0, y0: 0, x1: 10, y1: 5, color: 0xc8a8e0 },
  { name: 'bath', x0: 0, y0: 5, x1: 5, y1: 8, color: 0x9bcae0 },
  { name: 'office', x0: 5, y0: 5, x1: 10, y1: 8, color: 0xe8b58a },
  { name: 'kitchen', x0: 0, y0: 8, x1: 5, y1: 13, color: 0xe8c860 },
  { name: 'living', x0: 5, y0: 8, x1: 10, y1: 13, color: 0x9ec888 },
  { name: 'terrace', x0: 0, y0: 13, x1: 10, y1: 18, color: 0x8c6440, outdoor: true },
];

const INNER_WALLS_INTERIOR = [
  [1,5],[3,5],[4,5],[5,5],[6,5],[8,5],[9,5],
  [1,8],[2,8],[3,8],[5,8],[7,8],[8,8],[9,8],
  [5,6],[5,7],
  [5,9],[5,10],[5,11],[5,12],
];
const INNER_WALLS_EXTERIOR = [
  [1,13],[2,13],[3,13],[4,13],[6,13],[7,13],[8,13],[9,13],
];
const INNER_WALLS = [...INNER_WALLS_INTERIOR, ...INNER_WALLS_EXTERIOR];

const DOOR_TILES = [[2,5],[7,5],[4,8],[6,8]];
const FRONT_DOOR = [5,13];

const ITEMS = [];

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

const BUILD_CATALOG = [
  { id: 'bed', name: 'Lit', icon: '🛏', price: 220, type: 'bed', w: 2, h: 1, action: 'sleep', cat: 'essential' },
  { id: 'shower', name: 'Douche', icon: '🚿', price: 180, type: 'shower', w: 1, h: 1, action: 'shower', cat: 'essential' },
  { id: 'toilet', name: 'WC', icon: '🚽', price: 80, type: 'toilet', w: 1, h: 1, action: 'toilet', cat: 'essential' },
  { id: 'fridge', name: 'Frigo', icon: '🧊', price: 260, type: 'fridge', w: 1, h: 1, action: 'snack', cat: 'essential' },
  { id: 'stove', name: 'Cuisinière', icon: '🍳', price: 320, type: 'stove', w: 1, h: 1, action: 'cook', cat: 'essential' },
  { id: 'computer', name: 'Ordinateur', icon: '💻', price: 400, type: 'computer', w: 1, h: 1, action: 'work', cat: 'essential' },
  { id: 'tv', name: 'Télé', icon: '📺', price: 250, type: 'tv', w: 1, h: 1, action: 'tv', cat: 'essential' },
  { id: 'sofa', name: 'Canapé', icon: '🛋', price: 200, type: 'sofa', w: 2, h: 1, action: 'relax', cat: 'essential' },
  { id: 'wardrobe', name: 'Armoire', icon: '🪞', price: 140, type: 'wardrobe', w: 1, h: 1, action: null, cat: 'essential' },
  { id: 'counter', name: 'Comptoir', icon: '🍽', price: 100, type: 'counter', w: 1, h: 1, action: null, cat: 'essential' },
  { id: 'plant', name: 'Plante XL', icon: '🌿', price: 60, type: 'plant', w: 1, h: 1, action: 'plant', cat: 'essential' },
  { id: 'lamp', name: 'Lampe', icon: '💡', price: 40, type: 'placedLamp', w: 1, h: 1, cat: 'deco' },
  { id: 'plant_s', name: 'Plante S', icon: '🪴', price: 15, type: 'placedPlant', w: 1, h: 1, cat: 'deco' },
  { id: 'painting', name: 'Tableau', icon: '🖼', price: 20, type: 'placedPainting', w: 1, h: 1, cat: 'deco' },
  { id: 'bookshelf', name: 'Étagère', icon: '📚', price: 60, type: 'placedBookshelf', w: 1, h: 1, cat: 'deco' },
  { id: 'stool', name: 'Tabouret', icon: '🪑', price: 10, type: 'placedStool', w: 1, h: 1, cat: 'deco' },
  { id: 'rug', name: 'Tapis', icon: '🟫', price: 25, type: 'placedRug', w: 2, h: 1, cat: 'deco' },
  { id: 'cat_toy', name: 'Panier', icon: '🐈', price: 35, type: 'placedCatBed', w: 1, h: 1, cat: 'deco' },
  { id: 'guitar', name: 'Guitare', icon: '🎸', price: 80, type: 'placedGuitar', w: 1, h: 1, cat: 'deco' },
  { id: 'vase', name: 'Vase', icon: '🌻', price: 18, type: 'placedVase', w: 1, h: 1, cat: 'deco' },
  { id: 'pouf', name: 'Pouf', icon: '🪨', price: 30, type: 'placedPouf', w: 1, h: 1, cat: 'deco' },
  { id: 'candle', name: 'Bougie', icon: '🕯', price: 12, type: 'placedCandle', w: 1, h: 1, cat: 'deco' },
  { id: 'clock', name: 'Horloge', icon: '⏰', price: 22, type: 'placedClock', w: 1, h: 1, cat: 'deco' },
  { id: 'aquarium', name: 'Aquarium', icon: '🐠', price: 90, type: 'placedAquarium', w: 1, h: 1, cat: 'deco' },
  { id: 'easel', name: 'Chevalet', icon: '🎨', price: 45, type: 'placedEasel', w: 1, h: 1, cat: 'deco' },
];

const NON_BLOCKING_TYPES = new Set(['placedPainting', 'placedRug']);

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
  for (const [wx, wy] of INNER_WALLS) g[wy][wx] = 1;
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
    needs: { hunger: 100, energy: 100, hygiene: 100, social: 100, fun: 100 },
    money: 2000,
    timeMin: 8 * 60,
    day: 1,
    player: { x: 3, y: 3, sub: 0, dir: 'down', anim: 0 },
    path: [],
    action: null,
    placed: [],
    buildMode: null,
    tutorial: true,
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
    placed: state.placed,
    tutorial: state.tutorial,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snap)); } catch {}
}

function applyLoaded(s) {
  state = defaultState(s.name);
  state.appearance = { ...defaultAppearance(), ...(s.appearance || {}) };
  state.needs = { ...state.needs, ...s.needs };
  state.money = s.money ?? 200;
  state.timeMin = s.timeMin ?? 8 * 60;
  state.day = s.day ?? 1;
  state.placed = Array.isArray(s.placed) ? s.placed : [];
  state.tutorial = s.tutorial === true ? true : false;
  if (s.player) {
    if (isWalkable(s.player.x, s.player.y)) {
      state.player.x = s.player.x;
      state.player.y = s.player.y;
    }
    state.player.dir = s.player.dir || 'down';
  }
}

let scene, camera, renderer, sun, hemi, ambientNight, sunFill;
let playerGroup, playerLegL, playerLegR, playerArmL, playerArmR, playerHead, playerHair, playerEyeL, playerEyeR;
let raycaster, pointer;
let itemMeshes = [];
let windowMeshes = [];
let lampLights = [];
let particleSystems = [];
let composer, bloomPass, fxaaPass;
let floorMesh;
let blinkTimer = 0;
const flickerMeshes = [];

const canvasEl = document.getElementById('canvas');

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1428);
  const stage0 = document.getElementById('stage');
  if (stage0) stage0.style.background = '#0e0a18';
  scene.fog = null;

  const stage = document.getElementById('stage');
  const w = stage.clientWidth || 360;
  const h = stage.clientHeight || 600;

  const aspect = w / h;
  const d = 11;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 100);
  positionCamera();

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;

  composer = new EffectComposer(renderer);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.4, 0.85);
  composer.addPass(bloomPass);
  fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms['resolution'].value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
  composer.addPass(fxaaPass);
  composer.addPass(new OutputPass());

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  hemi = new THREE.HemisphereLight(0xffeec0, 0xa48564, 0.85);
  scene.add(hemi);

  sun = new THREE.DirectionalLight(0xfff0c8, 1.4);
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
  camera.position.set(cx + 14, 18, cz + 14);
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
    mesh.position.set(zone.x0 + w / 2, 0.01, zone.y0 + h / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8b6f47 });
  const innerWallMat = new THREE.MeshLambertMaterial({ color: 0xb89568 });
  const wallH = 2.2;
  const innerWallH = 1.4;
  const wallGeom = new THREE.BoxGeometry(1, wallH, 1);
  const innerSet = new Set(INNER_WALLS_INTERIOR.map(([x, y]) => `${x},${y}`));
  const exteriorSet = new Set(INNER_WALLS_EXTERIOR.map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 1) continue;
      const key = `${x},${y}`;
      const isInner = innerSet.has(key);
      if (isInner) {
        const isHorizontal = INNER_WALLS.filter(([wx, wy]) => wy === y).some(([wx]) => wx === x - 1 || wx === x + 1);
        const geom = isHorizontal ? new THREE.BoxGeometry(1, innerWallH, 0.18) : new THREE.BoxGeometry(0.18, innerWallH, 1);
        const mesh = new THREE.Mesh(geom, innerWallMat);
        mesh.position.set(x + 0.5, innerWallH / 2, y + 0.5);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        const top = new THREE.Mesh(new THREE.BoxGeometry(isHorizontal ? 1 : 0.22, 0.05, isHorizontal ? 0.22 : 1), new THREE.MeshLambertMaterial({ color: 0x8b6841 }));
        top.position.set(x + 0.5, innerWallH + 0.025, y + 0.5);
        top.receiveShadow = true;
        scene.add(top);
      } else if (exteriorSet.has(key)) {
        const geom = new THREE.BoxGeometry(1, wallH, 0.4);
        const mesh = new THREE.Mesh(geom, wallMat);
        mesh.position.set(x + 0.5, wallH / 2, y + 0.5);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      } else {
        const mesh = new THREE.Mesh(wallGeom, wallMat);
        mesh.position.set(x + 0.5, wallH / 2, y + 0.5);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }
  }

  for (const [dx, dy] of DOOR_TILES) {
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x6b4a30 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.22), frameMat);
    frame.position.set(dx + 0.5, innerWallH + 0.06, dy + 0.5);
    frame.receiveShadow = true;
    scene.add(frame);
    const sideW = 0.08;
    const sideH = innerWallH;
    const side1 = new THREE.Mesh(new THREE.BoxGeometry(sideW, sideH, 0.18), frameMat);
    side1.position.set(dx + 0.5 - 0.46, sideH / 2, dy + 0.5);
    side1.castShadow = true;
    scene.add(side1);
    const side2 = new THREE.Mesh(new THREE.BoxGeometry(sideW, sideH, 0.18), frameMat);
    side2.position.set(dx + 0.5 + 0.46, sideH / 2, dy + 0.5);
    side2.castShadow = true;
    scene.add(side2);
  }

  buildFrontDoor();

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

  buildLamps();
  buildTerrace();
}

function buildFrontDoor() {
  const [dx, dy] = FRONT_DOOR;
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x4a2818 });
  const wallH = 2.2;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.42), frameMat);
  lintel.position.set(dx + 0.5, wallH - 0.18, dy + 0.5);
  lintel.castShadow = true;
  scene.add(lintel);
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x5a3320 });
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH - 0.18, 0.42), sideMat);
  sideL.position.set(dx + 0.5 - 0.45, (wallH - 0.18) / 2, dy + 0.5);
  sideL.castShadow = true;
  scene.add(sideL);
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH - 0.18, 0.42), sideMat);
  sideR.position.set(dx + 0.5 + 0.45, (wallH - 0.18) / 2, dy + 0.5);
  sideR.castShadow = true;
  scene.add(sideR);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x8b3a2e });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, wallH - 0.3, 0.06), doorMat);
  door.position.set(dx + 0.5 - 0.3, (wallH - 0.3) / 2, dy + 0.5 + 0.18);
  door.rotation.y = -Math.PI / 5;
  door.castShadow = true;
  scene.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd4a857 }));
  knob.position.set(dx + 0.5 + 0.05, 1.1, dy + 0.62);
  scene.add(knob);
}

function buildTerrace() {
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8c6440 });
  for (let y = 13; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (x % 2 === 0) continue;
      const plank = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.98), new THREE.MeshLambertMaterial({ color: 0x9c7048 }));
      plank.rotation.x = -Math.PI / 2;
      plank.position.set(x + 0.5, 0.012, y + 0.5);
      plank.receiveShadow = true;
      scene.add(plank);
    }
  }

  const railMat = new THREE.MeshLambertMaterial({ color: 0x6b4a30 });
  for (let x = 0; x < COLS; x += 0.5) {
    if (x < 0.3 || x > COLS - 0.3) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), railMat);
    post.position.set(x + 0.5, 0.25, ROWS - 1 - 0.05);
    post.castShadow = true;
    scene.add(post);
  }
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(COLS - 1, 0.06, 0.06), railMat);
  topRail.position.set(COLS / 2, 0.5, ROWS - 1 - 0.05);
  topRail.castShadow = true;
  scene.add(topRail);

  for (let y = 13; y < ROWS - 1; y++) {
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), railMat);
    postL.position.set(0.55, 0.25, y + 0.5);
    postL.castShadow = true;
    scene.add(postL);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), railMat);
    postR.position.set(COLS - 1 - 0.55, 0.25, y + 0.5);
    postR.castShadow = true;
    scene.add(postR);
  }
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, ROWS - 14), railMat);
  railL.position.set(0.55, 0.5, 13 + (ROWS - 14) / 2);
  railL.castShadow = true;
  scene.add(railL);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, ROWS - 14), railMat);
  railR.position.set(COLS - 1 - 0.55, 0.5, 13 + (ROWS - 14) / 2);
  railR.castShadow = true;
  scene.add(railR);

  const potMat = new THREE.MeshLambertMaterial({ color: 0x9c5e3c });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x4a8c5a });
  for (const [px, pz] of [[1.5, 14.5], [8.5, 14.5], [1.5, 16.5], [8.5, 16.5]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 12), potMat);
    pot.position.set(px, 0.15, pz);
    pot.castShadow = true;
    scene.add(pot);
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), leafMat);
    foliage.position.set(px, 0.5, pz);
    foliage.castShadow = true;
    scene.add(foliage);
  }

  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a30 });
  const benchSeat = new THREE.Mesh(rb(2.0, 0.08, 0.45, 0.02), benchMat);
  benchSeat.position.set(5, 0.4, 15.5);
  benchSeat.castShadow = true;
  benchSeat.receiveShadow = true;
  scene.add(benchSeat);
  const benchBack = new THREE.Mesh(rb(2.0, 0.5, 0.06, 0.02), benchMat);
  benchBack.position.set(5, 0.65, 15.27);
  benchBack.castShadow = true;
  scene.add(benchBack);
  for (const lx of [4.0, 6.0]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.4), benchMat);
    leg.position.set(lx, 0.2, 15.5);
    leg.castShadow = true;
    scene.add(leg);
  }
}

function buildLamps() {
  addFloorLamp(8.5, 3.5, 0xfdd585);
  addPendant(6.5, 11.5, 0xffeac0);
  addWallSconce(0.55, 4, 0xfeb778);
  addCeilingLight(2.5, 9.5, 0xfff0c8);
}

function addFloorLamp(x, z, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const baseMat = lamMat(0x2a2a2a);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.06, 12), baseMat);
  base.position.y = 0.03; base.receiveShadow = true; group.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.45, 8), baseMat);
  post.position.y = 0.78; post.castShadow = true; group.add(post);
  const shadeMat = lamMat(0xf5d8a8);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.32, 16, 1, true), shadeMat);
  shade.position.y = 1.5; shadeMat.side = THREE.DoubleSide; shade.castShadow = true; group.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshBasicMaterial({ color }));
  bulb.position.y = 1.45; group.add(bulb);
  const light = new THREE.PointLight(color, 0, 6, 1.4);
  light.position.y = 1.4; light.castShadow = false; group.add(light);
  scene.add(group);
  lampLights.push({ light, bulb, baseColor: color });
}

function addPendant(x, z, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const cordMat = lamMat(0x202020);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), cordMat);
  cord.position.y = 1.9; group.add(cord);
  const shadeMat = lamMat(0xc88a4a);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.22, 16, 1, true), shadeMat);
  shade.position.y = 1.5; shadeMat.side = THREE.DoubleSide; shade.castShadow = true; group.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color }));
  bulb.position.y = 1.5; group.add(bulb);
  const light = new THREE.PointLight(color, 0, 5, 1.4);
  light.position.y = 1.4; light.castShadow = false; group.add(light);
  scene.add(group);
  lampLights.push({ light, bulb, baseColor: color });
}

function addWallSconce(x, z, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const arm = new THREE.Mesh(rb(0.06, 0.08, 0.18, 0.02), lamMat(0x4a3520));
  arm.position.set(0, 1.5, 0.15); arm.castShadow = true; group.add(arm);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color }));
  bulb.position.set(0, 1.5, 0.28); group.add(bulb);
  const light = new THREE.PointLight(color, 0, 4, 1.5);
  light.position.set(0, 1.5, 0.35); light.castShadow = false; group.add(light);
  scene.add(group);
  lampLights.push({ light, bulb, baseColor: color });
}

function addCeilingLight(x, z, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lamMat(0xf5f0e8));
  shade.position.y = 2.1; shade.castShadow = true; group.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color }));
  bulb.position.y = 2.0; group.add(bulb);
  const light = new THREE.PointLight(color, 0, 5, 1.4);
  light.position.y = 1.9; light.castShadow = false; group.add(light);
  scene.add(group);
  lampLights.push({ light, bulb, baseColor: color });
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
  rebuildPlacedItems();
}

function rebuildPlacedItems() {
  for (const m of itemMeshes.filter(o => o.userData?.placed)) {
    scene.remove(m);
    m.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
  }
  itemMeshes = itemMeshes.filter(o => !o.userData?.placed);
  for (const p of state.placed) {
    const def = BUILD_CATALOG.find(c => c.type === p.type);
    const it = { id: p.id, type: p.type, x: p.x, y: p.y, w: p.w, h: p.h, label: p.name, action: def?.action || null, placed: true };
    const group = new THREE.Group();
    group.position.set(it.x + it.w / 2, 0, it.y + it.h / 2);
    if (p.type.startsWith('placed')) buildPlacedMesh(group, it);
    else buildItemMeshes(group, it);
    group.userData.item = it;
    group.userData.placed = true;
    group.traverse(o => { if (o.isMesh) o.userData.parentGroup = group; });
    scene.add(group);
    itemMeshes.push(group);
    if (!NON_BLOCKING_TYPES.has(p.type)) {
      for (let dy = 0; dy < p.h; dy++) {
        for (let dx = 0; dx < p.w; dx++) {
          if (p.y + dy < ROWS && p.x + dx < COLS) grid[p.y + dy][p.x + dx] = 2;
        }
      }
    }
  }
}

function buildPlacedMesh(group, it) {
  const add = (geom, color, x, y, z, opts = {}) => {
    const mat = lamMat(color, opts);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  switch (it.type) {
    case 'placedLamp': {
      add(new THREE.CylinderGeometry(0.15, 0.18, 0.05, 12), 0x2a2a2a, 0, 0.025, 0);
      add(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), 0x2a2a2a, 0, 0.55, 0);
      add(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 16, 1, true), 0xf5d8a8, 0, 1.15, 0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfdd585 }));
      bulb.position.y = 1.1; group.add(bulb);
      const light = new THREE.PointLight(0xfdd585, 0, 4, 1.5);
      light.position.y = 1.1; group.add(light);
      lampLights.push({ light, bulb, baseColor: 0xfdd585 });
      break;
    }
    case 'placedPlant': {
      add(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 12), 0x8b5a3c, 0, 0.11, 0);
      add(new THREE.SphereGeometry(0.22, 12, 10), 0x4a8c5a, 0, 0.4, 0);
      add(new THREE.SphereGeometry(0.16, 12, 10), 0x6fa57a, -0.08, 0.48, 0.05);
      add(new THREE.SphereGeometry(0.14, 12, 10), 0x3a7a4a, 0.1, 0.44, -0.06);
      break;
    }
    case 'placedPainting': {
      add(rb(0.7, 0.5, 0.04, 0.02), 0x6b4a30, 0, 1.4, -0.46);
      add(rb(0.6, 0.4, 0.02, 0.005), 0x9bc2d8, 0, 1.4, -0.44);
      add(rb(0.45, 0.18, 0.005, 0.005), 0x6f9b58, 0, 1.36, -0.435);
      add(new THREE.SphereGeometry(0.04, 10, 8), 0xfdd585, -0.18, 1.5, -0.435);
      break;
    }
    case 'placedBookshelf': {
      add(rb(0.85, 1.6, 0.4, 0.03), 0x8b6841, 0, 0.8, 0);
      for (let i = 0; i < 4; i++) {
        add(rb(0.8, 0.04, 0.38, 0.005), 0x6b4a30, 0, 0.3 + i * 0.36, 0);
        for (let b = 0; b < 5; b++) {
          const colors = [0xa85b5b, 0x5b8aaf, 0x7da85b, 0xa87544, 0x5b5b8a];
          const h = 0.2 + Math.random() * 0.1;
          const book = new THREE.Mesh(rb(0.1, h, 0.18, 0.01), lamMat(colors[(i + b) % 5]));
          book.position.set(-0.3 + b * 0.15, 0.3 + i * 0.36 + h / 2 + 0.04, 0.05);
          book.castShadow = true; group.add(book);
        }
      }
      add(rb(0.9, 0.04, 0.42, 0.01), 0x6b4a30, 0, 1.6, 0);
      break;
    }
    case 'placedStool': {
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), 0xa07550, 0, 0.45, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), lamMat(0x6b4a30));
        leg.position.set(Math.cos(a) * 0.18, 0.225, Math.sin(a) * 0.18);
        leg.castShadow = true; group.add(leg);
      }
      break;
    }
    case 'placedRug': {
      const w = it.w * 0.92;
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, it.h * 0.7), lamMat(0xb86b6b));
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = 0.013;
      rug.receiveShadow = true; group.add(rug);
      const trim = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.95, it.h * 0.62), lamMat(0xd88a8a));
      trim.rotation.x = -Math.PI / 2;
      trim.position.y = 0.017;
      trim.receiveShadow = true; group.add(trim);
      break;
    }
    case 'placedCatBed': {
      add(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 16), 0xa86b6b, 0, 0.06, 0);
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), 0xf5d8d8, 0, 0.13, 0);
      add(rb(0.18, 0.12, 0.22, 0.04), 0xfba84a, 0, 0.18, 0);
      add(new THREE.SphereGeometry(0.07, 10, 8), 0xfba84a, 0, 0.26, -0.06);
      add(new THREE.SphereGeometry(0.012, 6, 4), 0x1a1a1a, -0.025, 0.27, -0.12);
      add(new THREE.SphereGeometry(0.012, 6, 4), 0x1a1a1a, 0.025, 0.27, -0.12);
      break;
    }
    case 'placedGuitar': {
      add(rb(0.06, 0.06, 0.06, 0.01), 0x4a3520, 0, 0.6, 0);
      add(rb(0.05, 0.85, 0.04, 0.01), 0x6b4a30, 0, 0.7, 0);
      add(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 16), 0xc88a4a, 0, 0.22, 0, { rot: [0, 0, Math.PI / 2] });
      add(new THREE.SphereGeometry(0.05, 10, 8), 0x1a1a1a, 0, 0.22, 0.03);
      break;
    }
    case 'placedVase': {
      add(new THREE.CylinderGeometry(0.1, 0.06, 0.4, 16), 0xc8a070, 0, 0.2, 0);
      add(new THREE.CylinderGeometry(0.12, 0.1, 0.06, 16), 0xa07050, 0, 0.43, 0);
      add(new THREE.SphereGeometry(0.05, 10, 8), 0xfdc848, 0, 0.55, 0, { emissive: 0xfdc848, emissiveIntensity: 0.2 });
      add(new THREE.SphereGeometry(0.06, 10, 8), 0xfdc848, -0.06, 0.6, 0.04, { emissive: 0xfdc848, emissiveIntensity: 0.2 });
      add(new THREE.SphereGeometry(0.05, 10, 8), 0xfdc848, 0.06, 0.58, -0.04, { emissive: 0xfdc848, emissiveIntensity: 0.2 });
      add(new THREE.SphereGeometry(0.04, 10, 8), 0x4a8c5a, -0.08, 0.5, -0.05);
      add(new THREE.SphereGeometry(0.04, 10, 8), 0x4a8c5a, 0.08, 0.5, 0.05);
      break;
    }
    case 'placedPouf': {
      add(new THREE.CylinderGeometry(0.32, 0.34, 0.34, 20), 0xe0a850, 0, 0.17, 0);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), 0xc88840, 0, 0.36, 0);
      const stitch = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 24), lamMat(0xa07020));
      stitch.position.y = 0.36; stitch.rotation.x = Math.PI / 2;
      group.add(stitch);
      break;
    }
    case 'placedCandle': {
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), 0x6b4a30, 0, 0.02, 0);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12), 0xfaf2dc, 0, 0.13, 0);
      add(new THREE.CylinderGeometry(0.012, 0.005, 0.05, 6), 0xfdc848, 0, 0.245, 0, { emissive: 0xff8838, emissiveIntensity: 1.4 });
      const light = new THREE.PointLight(0xff9560, 0.6, 1.6, 2);
      light.position.y = 0.27; group.add(light);
      lampLights.push({ light, bulb: null, baseColor: 0xff9560 });
      break;
    }
    case 'placedClock': {
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24, 1, false), 0xf0e8d8, 0, 1.4, -0.43, { rot: [Math.PI / 2, 0, 0] });
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24, 1, false), 0xf8f0e0, 0, 1.4, -0.4, { rot: [Math.PI / 2, 0, 0] });
      add(rb(0.02, 0.15, 0.005, 0.005), 0x1a1a1a, 0, 1.46, -0.39);
      add(rb(0.02, 0.1, 0.005, 0.005), 0x1a1a1a, 0.05, 1.4, -0.39);
      add(new THREE.SphereGeometry(0.018, 8, 6), 0x1a1a1a, 0, 1.4, -0.385);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), lamMat(0x1a1a1a));
        dot.position.set(Math.cos(a) * 0.16, 1.4 + Math.sin(a) * 0.16, -0.385);
        group.add(dot);
      }
      break;
    }
    case 'placedAquarium': {
      add(rb(0.55, 0.18, 0.32, 0.02), 0x4a3520, 0, 0.09, 0);
      const glassMat = lamMat(0x9bd5e0);
      glassMat.transparent = true; glassMat.opacity = 0.55;
      const tank = new THREE.Mesh(rb(0.55, 0.5, 0.32, 0.03), glassMat);
      tank.position.y = 0.45; tank.castShadow = false;
      group.add(tank);
      add(new THREE.SphereGeometry(0.04, 10, 8), 0xfdc848, -0.12, 0.4, 0, { emissive: 0xfdc848, emissiveIntensity: 0.4 });
      add(new THREE.SphereGeometry(0.035, 10, 8), 0xff7848, 0.1, 0.5, 0.05, { emissive: 0xff7848, emissiveIntensity: 0.4 });
      add(new THREE.SphereGeometry(0.03, 10, 8), 0xfdc848, 0.05, 0.35, -0.04, { emissive: 0xfdc848, emissiveIntensity: 0.4 });
      add(new THREE.PlaneGeometry(0.5, 0.06), 0x6b8b5b, 0, 0.23, 0, { rot: [-Math.PI / 2, 0, 0], cast: false });
      add(rb(0.55, 0.05, 0.32, 0.01), 0x2a2a2a, 0, 0.72, 0);
      const lightBulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8be0ff }));
      lightBulb.position.y = 0.69; group.add(lightBulb);
      const fishLight = new THREE.PointLight(0x6bd0ff, 0.6, 1.8, 2);
      fishLight.position.y = 0.5; group.add(fishLight);
      lampLights.push({ light: fishLight, bulb: lightBulb, baseColor: 0x8be0ff });
      break;
    }
    case 'placedEasel': {
      add(rb(0.04, 1.4, 0.04, 0.01), 0x6b4a30, -0.18, 0.7, 0);
      add(rb(0.04, 1.4, 0.04, 0.01), 0x6b4a30, 0.18, 0.7, 0);
      add(rb(0.04, 1.5, 0.04, 0.01), 0x6b4a30, 0, 0.75, 0.18);
      add(rb(0.5, 0.04, 0.04, 0.01), 0x6b4a30, 0, 0.5, 0);
      add(rb(0.55, 0.45, 0.04, 0.02), 0xf0e8d8, 0, 0.85, 0.02);
      add(rb(0.5, 0.4, 0.02, 0.005), 0xa8d4e0, 0, 0.85, 0.04);
      add(rb(0.4, 0.04, 0.005, 0.005), 0x6f9b58, 0, 0.7, 0.05);
      add(new THREE.SphereGeometry(0.03, 10, 8), 0xfdc848, 0.1, 0.95, 0.05);
      break;
    }
  }
}

function buildItemMeshes(group, it) {
  const w = it.w, h = it.h;
  const add = (geom, color, x, y, z, opts = {}) => {
    const mat = lamMat(color, opts);
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
      add(rb(w * 0.96, 0.32, h * 0.94, 0.04), 0x6b4a30, 0, 0.16, 0);
      add(rb(0.06, 0.7, h * 0.94, 0.02), 0x8b6841, -w * 0.5 + 0.03, 0.5, 0);
      add(rb(0.05, 0.4, h * 0.94, 0.02), 0x8b6841, w * 0.5 - 0.025, 0.35, 0);
      add(rb(w * 0.86, 0.18, h * 0.84, 0.03), 0xf5ecd0, 0, 0.41, 0);
      add(rb(w * 0.86, 0.05, h * 0.5, 0.02), 0x5b7db1, 0, 0.52, h * 0.18);
      add(rb(0.5, 0.13, h * 0.42, 0.04), 0xffffff, -w * 0.28, 0.57, 0);
      add(rb(0.45, 0.04, h * 0.4, 0.02), 0xe8d8c0, -w * 0.28, 0.64, 0);
      add(rb(0.34, 0.1, h * 0.34, 0.03), 0xf5d8d8, w * 0.22, 0.55, 0);
      break;
    }
    case 'wardrobe': {
      add(rb(0.85, 1.8, 0.5, 0.04), 0x8b6841, 0, 0.9, 0);
      add(rb(0.78, 1.6, 0.04, 0.02), 0x6b4a30, 0, 0.9, 0.255);
      add(new THREE.BoxGeometry(0.04, 1.7, 0.06), 0x3a2818, 0, 0.9, 0.27);
      add(rb(0.32, 0.9, 0.03, 0.02), 0xa07b50, -0.18, 1.1, 0.27);
      add(rb(0.32, 0.9, 0.03, 0.02), 0xa07b50, 0.18, 1.1, 0.27);
      add(new THREE.SphereGeometry(0.04, 8, 6), 0xd4a857, -0.06, 0.85, 0.29);
      add(new THREE.SphereGeometry(0.04, 8, 6), 0xd4a857, 0.06, 0.85, 0.29);
      add(rb(0.9, 0.06, 0.55, 0.02), 0x6b4a30, 0, 1.83, 0);
      add(rb(0.95, 0.04, 0.6, 0.01), 0x5a3a20, 0, 1.86, 0);
      break;
    }
    case 'shower': {
      add(rb(0.92, 0.04, 0.92, 0.01), 0xb0b8c0, 0, 0.02, 0);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const tile = add(new THREE.BoxGeometry(0.2, 0.005, 0.2), (i + j) % 2 ? 0xc8d4dc : 0xb0c0cc, -0.3 + i * 0.2, 0.025, -0.3 + j * 0.2, { cast: false });
        }
      }
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.005, 12), 0x4a4a4a, 0, 0.025, 0, { cast: false });
      const tileMat = lamMat(0xa8c5d4, { roughness: 0.3 });
      tileMat.transparent = true; tileMat.opacity = 0.35;
      const wall1 = new THREE.Mesh(rb(0.04, 1.8, 0.92, 0.01), tileMat);
      wall1.position.set(-0.46, 0.9, 0); wall1.receiveShadow = true; group.add(wall1);
      const wall2 = new THREE.Mesh(rb(0.92, 1.8, 0.04, 0.01), tileMat);
      wall2.position.set(0, 0.9, -0.46); wall2.receiveShadow = true; group.add(wall2);
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), 0x9098a0, 0.0, 1.45, -0.4);
      add(new THREE.CylinderGeometry(0.05, 0.08, 0.07, 12, 1, false), 0xc8d8e0, 0.0, 1.65, -0.18, { rot: [Math.PI / 2.5, 0, 0] });
      add(rb(0.32, 0.04, 0.12, 0.01), 0xe8eef2, -0.3, 1.0, -0.4);
      add(rb(0.12, 0.06, 0.06, 0.01), 0xf4d8a0, -0.3, 1.05, -0.4);
      break;
    }
    case 'toilet': {
      add(new THREE.CylinderGeometry(0.22, 0.18, 0.32, 16), 0xfafafa, 0, 0.16, 0.05);
      add(new THREE.TorusGeometry(0.22, 0.04, 8, 16), 0xfafafa, 0, 0.34, 0.05, { rot: [Math.PI / 2, 0, 0] });
      add(rb(0.5, 0.55, 0.16, 0.03), 0xfafafa, 0, 0.55, -0.2);
      add(rb(0.46, 0.04, 0.18, 0.02), 0xeaeaea, 0, 0.85, -0.2);
      add(rb(0.4, 0.04, 0.4, 0.02), 0x8b9aa8, 0, 0.36, 0.05);
      add(rb(0.05, 0.05, 0.05, 0.01), 0xc5d2dc, 0.1, 0.79, -0.18);
      add(rb(0.12, 0.06, 0.04, 0.01), 0xf5f0e8, 0.32, 0.6, -0.32);
      break;
    }
    case 'computer': {
      add(rb(0.95, 0.06, 0.6, 0.02), 0xd8c8a0, 0, 0.85, 0);
      add(new THREE.BoxGeometry(0.04, 0.85, 0.04), 0x6b4a30, -0.42, 0.42, 0.27);
      add(new THREE.BoxGeometry(0.04, 0.85, 0.04), 0x6b4a30, 0.42, 0.42, 0.27);
      add(new THREE.BoxGeometry(0.04, 0.85, 0.04), 0x6b4a30, -0.42, 0.42, -0.27);
      add(new THREE.BoxGeometry(0.04, 0.85, 0.04), 0x6b4a30, 0.42, 0.42, -0.27);
      add(rb(0.55, 0.04, 0.18, 0.01), 0x2c2c2c, 0, 0.91, -0.18);
      add(rb(0.5, 0.36, 0.04, 0.02), 0x1a1a1a, 0, 1.18, -0.2);
      add(rb(0.46, 0.32, 0.02, 0.01), 0x4ac0e8, 0, 1.18, -0.18, { emissive: 0x4ac0e8, emissiveIntensity: 0.55 });
      add(rb(0.36, 0.02, 0.14, 0.005), 0x222, 0, 0.92, 0.05);
      const keyMat = lamMat(0x444);
      for (let kx = 0; kx < 8; kx++) {
        for (let ky = 0; ky < 3; ky++) {
          const k = new THREE.Mesh(rb(0.03, 0.012, 0.03, 0.005), keyMat);
          k.position.set(-0.16 + kx * 0.045, 0.94, 0.005 + ky * 0.045);
          k.castShadow = true; group.add(k);
        }
      }
      add(rb(0.06, 0.025, 0.04, 0.01), 0x1a1a1a, 0.25, 0.92, 0.18);
      add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), 0xf5e6d3, -0.32, 0.93, 0.12);
      add(new THREE.CylinderGeometry(0.05, 0.06, 0.005, 12), 0x6c4d2a, -0.32, 0.99, 0.12, { cast: false });
      add(rb(0.18, 0.02, 0.13, 0.005), 0xf5f0e8, -0.3, 0.92, -0.05);
      break;
    }
    case 'plant': {
      add(new THREE.CylinderGeometry(0.18, 0.14, 0.27, 12), 0x9c5e3c, 0, 0.135, 0);
      add(new THREE.CylinderGeometry(0.19, 0.18, 0.04, 12), 0x7c4a2c, 0, 0.27, 0);
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12), 0x3a2818, 0, 0.275, 0, { cast: false });
      const leafMat = lamMat(0x4a8c5a);
      const leafMat2 = lamMat(0x6fa57a);
      const leafMat3 = lamMat(0x3a7a4a);
      const ls = [
        [0, 0.5, 0, 0.22, leafMat],
        [-0.13, 0.55, 0.05, 0.16, leafMat2],
        [0.12, 0.5, -0.08, 0.18, leafMat3],
        [0.05, 0.65, 0.12, 0.14, leafMat2],
        [-0.08, 0.42, -0.1, 0.13, leafMat3],
        [0.0, 0.78, -0.02, 0.11, leafMat2],
      ];
      for (const [x, y, z, r, m] of ls) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
        leaf.position.set(x, y, z);
        leaf.castShadow = true; leaf.scale.y = 0.8 + Math.random() * 0.5;
        group.add(leaf);
      }
      break;
    }
    case 'fridge': {
      add(rb(0.7, 1.6, 0.55, 0.04), 0xf2f2f2, 0, 0.8, 0);
      add(rb(0.72, 0.04, 0.57, 0.01), 0xc8c8c8, 0, 0.85, 0);
      add(rb(0.65, 0.5, 0.04, 0.02), 0xeaeaea, 0, 0.4, 0.275);
      add(rb(0.65, 1.0, 0.04, 0.02), 0xeaeaea, 0, 1.2, 0.275);
      add(rb(0.05, 0.22, 0.05, 0.01), 0x404040, 0.27, 0.45, 0.3);
      add(rb(0.05, 0.22, 0.05, 0.01), 0x404040, 0.27, 1.15, 0.3);
      add(rb(0.06, 0.06, 0.01, 0.01), 0xff8848, -0.15, 1.45, 0.305);
      add(rb(0.05, 0.05, 0.01, 0.01), 0x4a90c8, 0.0, 1.4, 0.305);
      add(rb(0.05, 0.07, 0.01, 0.01), 0x7eb87a, 0.15, 1.55, 0.305);
      add(rb(0.16, 0.18, 0.04, 0.01), 0xc8d4dc, -0.22, 0.7, 0.275);
      break;
    }
    case 'stove': {
      add(rb(0.85, 0.9, 0.55, 0.04), 0x3d3d3d, 0, 0.45, 0);
      add(rb(0.82, 0.04, 0.52, 0.01), 0x202020, 0, 0.92, 0);
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 16), 0x1a1a1a, -0.2, 0.94, -0.1);
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 16), 0x1a1a1a, 0.2, 0.94, -0.1);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16), 0x1a1a1a, -0.2, 0.94, 0.1);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16), 0x1a1a1a, 0.2, 0.94, 0.1);
      const burner = add(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 8), 0xff6b35, -0.2, 0.96, -0.1, { emissive: 0xff8855, emissiveIntensity: 0.9 });
      flickerMeshes.push({ mesh: burner, base: 0.9, type: 'fire' });
      for (let i = 0; i < 4; i++) {
        const k = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), lamMat(0xc0c0c0));
        k.position.set(-0.3 + i * 0.2, 0.7, 0.275); k.rotation.x = Math.PI / 2; k.castShadow = true; group.add(k);
      }
      add(rb(0.7, 0.42, 0.04, 0.02), 0x202020, 0, 0.27, 0.275);
      add(rb(0.4, 0.18, 0.02, 0.01), 0x4a3520, 0, 0.27, 0.295);
      add(rb(0.36, 0.14, 0.01, 0.01), 0xff8848, 0, 0.27, 0.31, { emissive: 0xff6b35, emissiveIntensity: 0.5 });
      add(rb(0.05, 0.04, 0.04, 0.01), 0xc0c0c0, 0.28, 0.27, 0.3);
      break;
    }
    case 'counter': {
      add(rb(0.85, 0.88, 0.55, 0.03), 0xa07550, 0, 0.44, 0);
      add(rb(0.92, 0.06, 0.62, 0.02), 0xe8d6a8, 0, 0.91, 0);
      add(rb(0.94, 0.02, 0.64, 0.005), 0xfff4d0, 0, 0.945, 0, { roughness: 0.3 });
      add(rb(0.85, 0.04, 0.05, 0.01), 0x6b4a30, 0, 0.7, 0.27);
      add(rb(0.85, 0.04, 0.05, 0.01), 0x6b4a30, 0, 0.4, 0.27);
      add(rb(0.04, 0.34, 0.04, 0.01), 0x6b4a30, -0.4, 0.55, 0.275);
      add(rb(0.04, 0.34, 0.04, 0.01), 0x6b4a30, 0.4, 0.55, 0.275);
      add(rb(0.22, 0.02, 0.18, 0.005), 0xc8a070, -0.18, 0.95, 0.05);
      add(rb(0.04, 0.04, 0.04, 0.005), 0xa86666, 0.05, 0.95, 0.05);
      add(rb(0.18, 0.16, 0.06, 0.01), 0x202020, 0.18, 1.0, 0);
      add(rb(0.02, 0.18, 0.005, 0.005), 0xc0c0c0, 0.13, 1.05, 0.04);
      add(rb(0.02, 0.16, 0.005, 0.005), 0xc0c0c0, 0.18, 1.04, 0.04);
      add(new THREE.SphereGeometry(0.06, 10, 8), 0xd84a3a, -0.32, 0.97, -0.05);
      add(new THREE.SphereGeometry(0.05, 10, 8), 0xd8a050, -0.22, 0.97, -0.08);
      add(new THREE.SphereGeometry(0.055, 10, 8), 0x9bbf3e, -0.27, 0.97, 0.04);
      break;
    }
    case 'tv': {
      add(rb(0.95, 0.5, 0.5, 0.03), 0x4a3520, 0, 0.25, 0);
      add(rb(0.92, 0.04, 0.52, 0.01), 0x6b4a30, 0, 0.52, 0);
      add(rb(0.85, 0.06, 0.45, 0.01), 0x2a2a2a, 0, 0.05, 0);
      add(rb(0.85, 0.55, 0.06, 0.02), 0x1a1a1a, 0, 0.95, -0.21);
      const tvScreen = add(rb(0.78, 0.46, 0.02, 0.005), 0x4ac0e8, 0, 0.95, -0.19, { emissive: 0x4ac0e8, emissiveIntensity: 0.7 });
      flickerMeshes.push({ mesh: tvScreen, base: 0.7, type: 'screen', baseColor: 0x4ac0e8 });
      add(rb(0.5, 0.06, 0.08, 0.01), 0x202020, 0, 0.6, -0.15);
      add(rb(0.04, 0.02, 0.08, 0.005), 0x202020, -0.32, 0.55, 0.05);
      add(rb(0.04, 0.04, 0.04, 0.005), 0xff4444, -0.32, 0.56, 0.07, { emissive: 0xff4444, emissiveIntensity: 0.4 });
      break;
    }
    case 'sofa': {
      add(rb(w * 0.96, 0.4, 0.7, 0.06), 0xa85b5b, 0, 0.22, 0);
      add(rb(w * 0.96, 0.5, 0.2, 0.05), 0xc97a7a, 0, 0.65, -0.27);
      add(rb(0.2, 0.4, 0.7, 0.05), 0x8a4848, -w * 0.42, 0.62, 0);
      add(rb(0.2, 0.4, 0.7, 0.05), 0x8a4848, w * 0.42, 0.62, 0);
      add(rb(0.34, 0.18, 0.34, 0.05), 0xf5d8d8, -w * 0.2, 0.51, 0.1);
      add(rb(0.34, 0.18, 0.34, 0.05), 0xf5d8d8, w * 0.2, 0.51, 0.1);
      add(rb(0.28, 0.14, 0.28, 0.04), 0xe8a857, 0, 0.49, 0.12);
      add(rb(w * 0.6, 0.04, 0.3, 0.02), 0xd8a850, 0.1, 0.45, 0.18);
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
    const dress = new THREE.Mesh(rb(torsoW, 0.55, 0.24, 0.04), shirtMat);
    dress.position.y = 0.88;
    dress.castShadow = true;
    dress.receiveShadow = true;
    playerGroup.add(dress);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.5, 16), shirtMat);
    skirt.position.y = 0.34;
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    playerGroup.add(skirt);
  } else {
    const torso = new THREE.Mesh(rb(torsoW, 0.5, 0.24, 0.05), shirtMat);
    torso.position.y = 0.88;
    torso.castShadow = true;
    torso.receiveShadow = true;
    playerGroup.add(torso);

    if (app.top === 'tank') {
      const sk = new THREE.Mesh(rb(torsoW + 0.005, 0.18, 0.245, 0.04), skinMat);
      sk.position.y = 1.05;
      sk.castShadow = true;
      playerGroup.add(sk);
    }

    if (app.bottom === 'pants') {
      const legGeom = rb(0.14, 0.5, 0.17, 0.04);
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
      const sLegGeom = rb(0.14, 0.22, 0.17, 0.04);
      sLegGeom.translate(0, -0.11, 0);
      playerLegL = new THREE.Mesh(sLegGeom, pantsMat);
      playerLegL.position.set(-0.08, 0.6, 0);
      playerLegL.castShadow = true;
      playerGroup.add(playerLegL);
      const skLegGeom = rb(0.13, 0.3, 0.16, 0.04);
      skLegGeom.translate(0, -0.15, 0);
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
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.32, 16), pantsMat);
      skirt.position.y = 0.46;
      skirt.castShadow = true;
      playerGroup.add(skirt);
      const skLegGeom = rb(0.11, 0.28, 0.11, 0.04);
      skLegGeom.translate(0, -0.14, 0);
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
  const armGeom = rb(0.11, 0.45, 0.11, 0.04);
  armGeom.translate(0, -0.22, 0);
  playerArmL = new THREE.Mesh(armGeom, armMat);
  playerArmL.position.set(-(torsoW / 2 + 0.06), 1.1, 0);
  playerArmL.castShadow = true;
  playerGroup.add(playerArmL);
  playerArmR = new THREE.Mesh(armGeom, armMat);
  playerArmR.position.set(torsoW / 2 + 0.06, 1.1, 0);
  playerArmR.castShadow = true;
  playerGroup.add(playerArmR);

  if (app.top !== 'pull' && app.top !== 'tank') {
    const sleeveL = new THREE.Mesh(rb(0.14, 0.11, 0.14, 0.04), shirtMat);
    sleeveL.position.set(-(torsoW / 2 + 0.06), 1.07, 0);
    sleeveL.castShadow = true;
    playerGroup.add(sleeveL);
    const sleeveR = new THREE.Mesh(rb(0.14, 0.11, 0.14, 0.04), shirtMat);
    sleeveR.position.set(torsoW / 2 + 0.06, 1.07, 0);
    sleeveR.castShadow = true;
    playerGroup.add(sleeveR);
  }

  const handGeom = new THREE.SphereGeometry(0.06, 12, 8);
  const handL = new THREE.Mesh(handGeom, skinMat);
  handL.position.set(0, -0.45, 0);
  playerArmL.add(handL);
  const handR = new THREE.Mesh(handGeom, skinMat);
  handR.position.set(0, -0.45, 0);
  playerArmR.add(handR);

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
      const back = new THREE.Mesh(rb(0.34, 0.34, 0.14, 0.04), hairMat);
      back.position.set(0, 1.2, 0.13);
      back.castShadow = true;
      hairGroup.add(back);
      const strand = new THREE.Mesh(rb(0.32, 0.16, 0.06, 0.02), hairMat);
      strand.position.set(0, 1.05, 0.18);
      strand.castShadow = true;
      hairGroup.add(strand);
    } else if (app.hairStyle === 'tuft') {
      const tuft = new THREE.Mesh(rb(0.13, 0.18, 0.11, 0.03), hairMat);
      tuft.position.set(0, 1.55, -0.04);
      tuft.castShadow = true;
      tuft.rotation.x = -0.3;
      hairGroup.add(tuft);
    }
    playerHair = hairGroup;
    playerGroup.add(hairGroup);
  }

  const earGeom = new THREE.SphereGeometry(0.035, 8, 6);
  const earL = new THREE.Mesh(earGeom, skinMat);
  earL.position.set(-0.18, 1.3, 0);
  earL.castShadow = true;
  playerGroup.add(earL);
  const earR = new THREE.Mesh(earGeom, skinMat);
  earR.position.set(0.18, 1.3, 0);
  earR.castShadow = true;
  playerGroup.add(earR);

  const noseGeom = new THREE.SphereGeometry(0.022, 8, 6);
  const nose = new THREE.Mesh(noseGeom, skinMat);
  nose.position.set(0, 1.3, -0.18);
  nose.scale.set(0.9, 1.1, 1);
  playerGroup.add(nose);

  const eyeGeom = new THREE.SphereGeometry(0.024, 8, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  playerEyeL = new THREE.Mesh(eyeGeom, eyeMat);
  playerEyeL.position.set(-0.06, 1.36, -0.16);
  playerEyeL.scale.set(1, 1, 0.4);
  playerGroup.add(playerEyeL);
  playerEyeR = new THREE.Mesh(eyeGeom, eyeMat);
  playerEyeR.position.set(0.06, 1.36, -0.16);
  playerEyeR.scale.set(1, 1, 0.4);
  playerGroup.add(playerEyeR);

  if (app.gender === 'f') {
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf48a8a, transparent: true, opacity: 0.55 });
    const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), blushMat);
    blushL.position.set(-0.13, 1.31, -0.14); blushL.scale.set(1, 0.5, 0.4);
    playerGroup.add(blushL);
    const blushR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), blushMat);
    blushR.position.set(0.13, 1.31, -0.14); blushR.scale.set(1, 0.5, 0.4);
    playerGroup.add(blushR);
  }

  const mouthMat = new THREE.MeshBasicMaterial({ color: 0xc06868 });
  const mouth = new THREE.Mesh(rb(0.05, 0.012, 0.005, 0.002), mouthMat);
  mouth.position.set(0, 1.27, -0.17);
  playerGroup.add(mouth);

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
  if (state.action && !state.buildMode && !state.demolishMode) return;
  const rect = canvasEl.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (state.demolishMode) {
    const placedMeshes = itemMeshes.filter(m => m.userData?.placed);
    const hits = raycaster.intersectObjects(placedMeshes, true);
    if (hits.length > 0) {
      let g = hits[0].object;
      while (g && !g.userData?.item) g = g.parent;
      if (g && g.userData.item.placed) {
        const id = g.userData.item.id;
        const item = state.placed.find(p => p.id === id);
        if (item) {
          const refund = Math.floor((BUILD_CATALOG.find(c => c.type === item.type)?.price || 0) * 0.5);
          state.money += refund;
          state.placed = state.placed.filter(p => p.id !== id);
          for (let dy = 0; dy < item.h; dy++) {
            for (let dx = 0; dx < item.w; dx++) {
              if (item.y + dy < ROWS && item.x + dx < COLS) grid[item.y + dy][item.x + dx] = 0;
            }
          }
          rebuildPlacedItems();
          toast(`Démoli · +$${refund}`);
          saveGame();
        }
      }
    } else {
      toast('Tap un objet placé.');
    }
    return;
  }

  if (state.buildMode) {
    const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeY, hit);
    if (hit) {
      const tx = Math.floor(hit.x);
      const ty = Math.floor(hit.z);
      tryPlace(tx, ty);
    }
    return;
  }

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

function tryPlace(tx, ty) {
  const def = state.buildMode;
  if (!def) return;
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const cx = tx + dx, cy = ty + dy;
      if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) { toast('Hors zone.'); return; }
      if (grid[cy][cx] !== 0) {
        if (!NON_BLOCKING_TYPES.has(def.type)) { toast('Case occupée.'); return; }
        if (grid[cy][cx] === 1) { toast('Pas sur un mur.'); return; }
      }
    }
  }
  if (state.money < def.price) { toast("Pas assez d'argent."); return; }
  state.money -= def.price;
  const placed = { id: def.id + '_' + Date.now(), type: def.type, name: def.name, x: tx, y: ty, w: def.w, h: def.h };
  state.placed.push(placed);
  rebuildPlacedItems();
  toast(`${def.name} posé`);
  saveGame();
}

function onResize() {
  if (!gameEl || gameEl.hidden) return;
  const stage = document.getElementById('stage');
  const w = stage.clientWidth, h = stage.clientHeight;
  const aspect = w / h;
  const d = 11;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  if (fxaaPass) fxaaPass.material.uniforms['resolution'].value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
}

let saveAccum = 0;
let lastTs = 0;

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  tick(dt);
  updateHUD();
  if (composer) composer.render();
  else renderer.render(scene, camera);
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
  updateFlickers();

  saveAccum += dt;
  if (saveAccum > 8) { saveAccum = 0; saveGame(); }
}

function updateFlickers() {
  const t = performance.now() / 1000;
  for (const f of flickerMeshes) {
    if (!f.mesh || !f.mesh.material) continue;
    if (f.type === 'fire') {
      const noise = Math.sin(t * 11) * 0.25 + Math.sin(t * 23.7) * 0.15 + Math.sin(t * 5.3) * 0.1;
      f.mesh.material.emissiveIntensity = f.base + noise;
    } else if (f.type === 'screen') {
      const flick = (Math.sin(t * 7) > 0.5) ? 1 : 0.7;
      f.mesh.material.emissiveIntensity = f.base * flick + 0.1;
      const hue = 0.55 + Math.sin(t * 0.8) * 0.1;
      f.mesh.material.color.setHSL(hue, 0.5, 0.55);
      f.mesh.material.emissive.setHSL(hue, 0.5, 0.45);
    }
  }
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

  sun.intensity = 0.15 + dayFactor * 1.35;
  hemi.intensity = 0.45 + dayFactor * 0.7;
  ambientNight.intensity = (1 - dayFactor) * 1.5;

  let sky = 0x1a1428;
  if (dayFactor > 0.7) sky = 0x6a92c0;
  else if (dayFactor > 0.3) sky = 0xc88670;
  else if (dayFactor > 0.05) sky = 0x342852;
  scene.background.setHex(sky);
  if (scene.fog) scene.fog.color.setHex(sky);

  for (const win of windowMeshes) {
    if (dayFactor > 0.5) win.material.color.setHex(0x7ec0e8);
    else if (dayFactor > 0.2) win.material.color.setHex(0xe89868);
    else win.material.color.setHex(0xfdd585);
  }

  const lampOn = 1 - dayFactor;
  for (const lp of lampLights) {
    lp.light.intensity = lampOn * 1.6;
    if (lp.bulb && lp.bulb.material) {
      const c = new THREE.Color(lp.baseColor);
      const dim = new THREE.Color(0x3a3530);
      lp.bulb.material.color.copy(dim).lerp(c, lampOn);
    }
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
function toast(msg, duration = 1800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, duration);
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
    const quick = btn.dataset.quick;
    if (quick === 'build') { openBuildCatalog(); return; }
    if (state.action) return;
    if (quick === 'call') startAction('call', null);
    if (quick === 'sleep') {
      const bedData = state.placed.find(p => p.type === 'bed');
      if (!bedData) { toast('Achète un lit dans Construire.'); return; }
      const bed = itemMeshes.find(m => m.userData?.item?.id === bedData.id)?.userData.item;
      if (!bed) return;
      const approach = findApproach(bed, state.player.x, state.player.y);
      if (approach) {
        state.path = approach.path;
        state.pendingItem = bed;
      }
    }
  });
});

function openBuildCatalog() {
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = '🔨 Catalogue';
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">Argent: <strong style="color:var(--accent)">$${Math.floor(state.money)}</strong></div>
    <button id="demolish-btn" style="width:100%;padding:10px;border-radius:10px;background:var(--bad);color:#fff;font-weight:600;font-size:13px;margin-bottom:14px">🔥 Démolir (refund 50%)</button>
    <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.6px;margin:6px 0 8px;font-weight:700">Essentiels</div>
    <div class="catalog cat-essential"></div>
    <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.6px;margin:14px 0 8px;font-weight:700">Décoration</div>
    <div class="catalog cat-deco"></div>
  `;
  const essentialList = body.querySelector('.cat-essential');
  const decoList = body.querySelector('.cat-deco');
  for (const it of BUILD_CATALOG) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'catalog-item';
    if (state.money < it.price) btn.classList.add('unaffordable');
    btn.innerHTML = `<span class="ci-icon">${it.icon}</span><span class="ci-name">${it.name}</span><span class="ci-price">$${it.price}</span>`;
    btn.addEventListener('click', () => {
      if (state.money < it.price) { toast("Pas assez d'argent."); return; }
      state.buildMode = it;
      state.demolishMode = false;
      m.hidden = true;
      const bar = document.getElementById('build-bar');
      bar.hidden = false;
      document.getElementById('build-name').textContent = `${it.icon} ${it.name} · $${it.price}`;
    });
    (it.cat === 'essential' ? essentialList : decoList).appendChild(btn);
  }
  document.getElementById('demolish-btn').addEventListener('click', () => {
    state.buildMode = null;
    state.demolishMode = true;
    m.hidden = true;
    const bar = document.getElementById('build-bar');
    bar.hidden = false;
    document.getElementById('build-name').textContent = '🔥 Tap un objet à démolir';
  });
  m.hidden = false;
}

document.getElementById('build-cancel').addEventListener('click', () => {
  state.buildMode = null;
  state.demolishMode = false;
  document.getElementById('build-bar').hidden = true;
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
  if (state.tutorial) {
    setTimeout(() => toast(`👋 Bienvenue ${state.name} ! Ton appart est vide — tape 🔨 Construire pour acheter ton mobilier.`, 6000), 600);
    setTimeout(() => toast(`💡 Achète au minimum un Lit, un Frigo, des WC et une Douche.`, 5000), 7500);
    setTimeout(() => { state.tutorial = false; saveGame(); }, 13000);
  }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
window.addEventListener('beforeunload', saveGame);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
