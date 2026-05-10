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
  { name: 'bedroom', x0: 0, y0: 0, x1: 10, y1: 5, color: 0xc8a8e0, pattern: 'carpet' },
  { name: 'bath', x0: 0, y0: 5, x1: 5, y1: 8, color: 0x9bcae0, pattern: 'tile' },
  { name: 'office', x0: 5, y0: 5, x1: 10, y1: 8, color: 0xe8b58a, pattern: 'wood' },
  { name: 'kitchen', x0: 0, y0: 8, x1: 5, y1: 13, color: 0xe8c860, pattern: 'tile' },
  { name: 'living', x0: 5, y0: 8, x1: 10, y1: 13, color: 0x9ec888, pattern: 'wood' },
  { name: 'terrace', x0: 0, y0: 13, x1: 10, y1: 18, color: 0x8c6440, outdoor: true, pattern: 'wood' },
];

function makeWallTexture(hex, accent) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = `rgba(255,255,255,0.04)`;
  for (let i = 0; i < 96; i += 12) ctx.fillRect(i, 0, 1, 96);
  for (let i = 0; i < 360; i++) {
    const x = Math.random() * 96, y = Math.random() * 96;
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    ctx.fillRect(x, y, 1, 1);
  }
  if (accent) {
    ctx.fillStyle = `rgba(0,0,0,0.18)`;
    ctx.fillRect(0, 78, 96, 1);
    ctx.fillStyle = `rgba(255,255,255,0.08)`;
    ctx.fillRect(0, 80, 96, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a1428');
  grad.addColorStop(0.4, '#3a2a52');
  grad.addColorStop(0.7, '#5a3a4a');
  grad.addColorStop(1, '#a86a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSkyDome() {
  const geom = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x6a92c8) },
      bottomColor: { value: new THREE.Color(0xfdb888) },
      sunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
      sunColor: { value: new THREE.Color(0xfff2c8) },
      sunIntensity: { value: 1.0 },
      horizonOffset: { value: 0.05 },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunIntensity;
      uniform float horizonOffset;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = clamp(dir.y + horizonOffset, 0.0, 1.0);
        float blend = pow(h, 0.55);
        vec3 sky = mix(bottomColor, topColor, blend);
        float sunDot = max(0.0, dot(dir, normalize(sunDir)));
        float disc = smoothstep(0.998, 1.0, sunDot);
        float halo = pow(sunDot, 18.0) * 0.55 + pow(sunDot, 90.0) * 0.45;
        vec3 sun = sunColor * (halo + disc * 1.5) * sunIntensity;
        gl_FragColor = vec4(sky + sun, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.sky = true;
  return mesh;
}

const _skyTopDay = new THREE.Color(0x6a92c8);
const _skyTopNight = new THREE.Color(0x14102a);
const _skyTopDusk = new THREE.Color(0x7a4a8a);
const _skyBotDay = new THREE.Color(0xfdc8a0);
const _skyBotNight = new THREE.Color(0x2a1a3a);
const _skyBotDusk = new THREE.Color(0xf28848);
const _sunColorDay = new THREE.Color(0xfff5d8);
const _sunColorDusk = new THREE.Color(0xff9858);
const _sunVec = new THREE.Vector3();

function updateSkyDome() {
  if (!skyDome) return;
  const t = state.timeMin / 60;
  const u = skyDome.material.uniforms;
  let dayBlend = 0;
  if (t > 5 && t < 21) {
    if (t < 7) dayBlend = (t - 5) / 2;
    else if (t > 19) dayBlend = (21 - t) / 2;
    else dayBlend = 1;
  }
  let duskBlend = 0;
  if ((t >= 5 && t <= 8) || (t >= 17 && t <= 21)) {
    duskBlend = 1 - Math.min(1, Math.abs(t - (t < 12 ? 6.5 : 19)) / 1.5);
    duskBlend = Math.max(0, duskBlend);
  }
  const top = _color1.copy(_skyTopNight).lerp(_skyTopDay, dayBlend).lerp(_skyTopDusk, duskBlend * 0.6);
  const bot = _color2.copy(_skyBotNight).lerp(_skyBotDay, dayBlend).lerp(_skyBotDusk, duskBlend * 0.7);
  u.topColor.value.copy(top);
  u.bottomColor.value.copy(bot);
  u.sunIntensity.value = dayBlend * 0.9 + duskBlend * 0.5;
  u.sunColor.value.copy(_sunColorDay).lerp(_sunColorDusk, duskBlend * 0.7);
  let elev, az;
  if (t < 5.5 || t > 20) { elev = -0.2; az = t < 12 ? 90 : -90; }
  else {
    const prog = (t - 5.5) / 14.5;
    elev = Math.sin(prog * Math.PI) * 0.85 + 0.05;
    az = -90 + prog * 180;
  }
  const azRad = THREE.MathUtils.degToRad(az);
  _sunVec.set(Math.sin(azRad) * Math.cos(elev * Math.PI / 2), Math.sin(elev * Math.PI / 2), Math.cos(azRad) * Math.cos(elev * Math.PI / 2));
  u.sunDir.value.copy(_sunVec.normalize());
}

function makeFloorTexture(hex, pattern) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 96, 96);
  if (pattern === 'tile') {
    ctx.strokeStyle = `rgba(0,0,0,0.18)`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= 96; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 96); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(96, i); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,0.06)`;
    for (let y = 0; y < 96; y += 32) for (let x = 0; x < 96; x += 32) ctx.fillRect(x + 2, y + 2, 4, 4);
  } else if (pattern === 'wood') {
    for (let i = 0; i < 96; i += 24) {
      ctx.fillStyle = `rgba(${Math.max(0, r - 18)},${Math.max(0, g - 18)},${Math.max(0, b - 18)},1)`;
      ctx.fillRect(i, 0, 1, 96);
      ctx.fillStyle = `rgba(0,0,0,0.18)`;
      ctx.fillRect(i + 1, 0, 0.5, 96);
    }
    ctx.fillStyle = `rgba(0,0,0,0.12)`;
    ctx.fillRect(0, 28, 24, 1);
    ctx.fillRect(24, 60, 24, 1);
    ctx.fillRect(48, 16, 24, 1);
    ctx.fillRect(72, 72, 24, 1);
  } else if (pattern === 'carpet') {
    ctx.fillStyle = `rgba(0,0,0,0.08)`;
    for (let y = 4; y < 96; y += 8) for (let x = 4; x < 96; x += 8) ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = `rgba(255,255,255,0.04)`;
    for (let y = 0; y < 96; y += 8) for (let x = 0; x < 96; x += 8) ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
  sleep:   { label: 'Dormir', durationMin: 480, fast: true, effect: { energy: 120, hygiene: -4, hunger: -6 }, money: 0 },
  shower:  { label: 'Se doucher', durationMin: 30, effect: { hygiene: 70, energy: 4 } },
  toilet:  { label: 'Aux toilettes', durationMin: 10, effect: { hygiene: 4, fun: 1 } },
  work:    { label: 'Travailler', durationMin: 120, effect: { energy: -16, social: -10, fun: -8 }, money: 95 },
  plant:   { label: 'Arroser la plante', durationMin: 8, effect: { fun: 8 } },
  snack:   { label: 'Grignoter', durationMin: 15, effect: { hunger: 30, hygiene: -2 } },
  cook:    { label: 'Cuisiner', durationMin: 45, effect: { hunger: 70, fun: 12, hygiene: -3 }, money: -5 },
  tv:      { label: 'Regarder la télé', durationMin: 30, effect: { fun: 30, energy: 5, social: 5 } },
  relax:   { label: 'Se détendre', durationMin: 20, effect: { fun: 12, energy: 8 } },
  call:    { label: 'Appeler un ami', durationMin: 20, effect: { social: 38, fun: 5 } },
  read:    { label: 'Lire un livre', durationMin: 30, effect: { fun: 18, energy: -3 } },
  paint:   { label: 'Peindre', durationMin: 60, effect: { fun: 28, energy: -8 } },
  play_guitar: { label: 'Jouer guitare', durationMin: 25, effect: { fun: 22, social: 6, energy: -5 } },
  yoga:    { label: 'Yoga', durationMin: 25, effect: { energy: 18, fun: 10, hygiene: -2 } },
  workout: { label: 'Faire du sport', durationMin: 30, effect: { energy: -6, fun: 12, hygiene: -8 } },
};

const DECAY = {
  hunger: 0.10, energy: 0.06, hygiene: 0.06, social: 0.04, fun: 0.05,
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
  { id: 'bookshelf', name: 'Étagère', icon: '📚', price: 60, type: 'placedBookshelf', w: 1, h: 1, action: 'read', cat: 'deco' },
  { id: 'stool', name: 'Tabouret', icon: '🪑', price: 10, type: 'placedStool', w: 1, h: 1, cat: 'deco' },
  { id: 'rug', name: 'Tapis', icon: '🟫', price: 25, type: 'placedRug', w: 2, h: 1, action: 'yoga', cat: 'deco' },
  { id: 'cat_toy', name: 'Panier', icon: '🐈', price: 35, type: 'placedCatBed', w: 1, h: 1, cat: 'deco' },
  { id: 'guitar', name: 'Guitare', icon: '🎸', price: 80, type: 'placedGuitar', w: 1, h: 1, action: 'play_guitar', cat: 'deco' },
  { id: 'vase', name: 'Vase', icon: '🌻', price: 18, type: 'placedVase', w: 1, h: 1, cat: 'deco' },
  { id: 'pouf', name: 'Pouf', icon: '🪨', price: 30, type: 'placedPouf', w: 1, h: 1, cat: 'deco' },
  { id: 'candle', name: 'Bougie', icon: '🕯', price: 12, type: 'placedCandle', w: 1, h: 1, cat: 'deco' },
  { id: 'clock', name: 'Horloge', icon: '⏰', price: 22, type: 'placedClock', w: 1, h: 1, cat: 'deco' },
  { id: 'aquarium', name: 'Aquarium', icon: '🐠', price: 90, type: 'placedAquarium', w: 1, h: 1, cat: 'deco' },
  { id: 'easel', name: 'Chevalet', icon: '🎨', price: 45, type: 'placedEasel', w: 1, h: 1, action: 'paint', cat: 'deco' },
  { id: 'pouf2', name: 'Tapis sport', icon: '🧘', price: 20, type: 'placedYogaMat', w: 2, h: 1, action: 'workout', cat: 'deco' },
];

const NON_BLOCKING_TYPES = new Set(['placedPainting', 'placedRug']);

const APPEARANCE_PALETTES = {
  gender: [
    { id: 'f', label: 'Femme' },
    { id: 'm', label: 'Homme' },
    { id: 'n', label: 'Autre' },
  ],
  bodyHeight: [
    { id: 'short', label: 'Petit' },
    { id: 'normal', label: 'Normal' },
    { id: 'tall', label: 'Grand' },
  ],
  bodyShape: [
    { id: 'slim', label: 'Mince' },
    { id: 'normal', label: 'Normal' },
    { id: 'athletic', label: 'Sportif' },
    { id: 'curvy', label: 'Rondelet' },
  ],
  skin: ['#fde0c8', '#fbc8a8', '#e8ad88', '#b88660', '#8a5e40', '#5e3e2c'],
  hair: ['#1a1a1a', '#5c3d1e', '#a87544', '#d8b878', '#c45a3a', '#7d6e90', '#e8a8c8', '#5b8a4a', '#3a4a8a'],
  hairStyle: [
    { id: 'short', label: 'Court' },
    { id: 'long', label: 'Long' },
    { id: 'tuft', label: 'Crête' },
    { id: 'bun', label: 'Chignon' },
    { id: 'curly', label: 'Bouclé' },
    { id: 'bald', label: 'Rasé' },
  ],
  eyeColor: ['#1a1a1a', '#3a4a6a', '#4a8a3a', '#8b4a2a', '#7a4a8a', '#3a8aaa', '#a85a3a', '#a8a8a8'],
  eyebrow: [
    { id: 'thin', label: 'Fins' },
    { id: 'normal', label: 'Naturels' },
    { id: 'thick', label: 'Épais' },
    { id: 'arched', label: 'Arqués' },
  ],
  facialHair: [
    { id: 'none', label: 'Aucune' },
    { id: 'mustache', label: 'Moustache' },
    { id: 'goatee', label: 'Bouc' },
    { id: 'beard', label: 'Barbe' },
  ],
  glasses: [
    { id: 'none', label: 'Aucunes' },
    { id: 'round', label: 'Rondes' },
    { id: 'square', label: 'Carrées' },
    { id: 'sun', label: 'Soleil' },
  ],
  hat: [
    { id: 'none', label: 'Aucun' },
    { id: 'cap', label: 'Casquette' },
    { id: 'beanie', label: 'Bonnet' },
    { id: 'beret', label: 'Béret' },
    { id: 'fedora', label: 'Fedora' },
  ],
  earring: [
    { id: 'none', label: 'Aucune' },
    { id: 'stud', label: 'Clous' },
    { id: 'hoop', label: 'Anneaux' },
  ],
  top: [
    { id: 'tshirt', label: 'T-shirt' },
    { id: 'pull', label: 'Pull' },
    { id: 'tank', label: 'Débard.' },
    { id: 'hoodie', label: 'Hoodie' },
    { id: 'robe', label: 'Robe' },
  ],
  shirt: ['#5b8aaf', '#a85b5b', '#7da85b', '#a87544', '#5b5b8a', '#c8a5d8', '#3a3a3a', '#e8a857', '#fdc848', '#3aa898'],
  bottom: [
    { id: 'pants', label: 'Pantalon' },
    { id: 'short', label: 'Short' },
    { id: 'skirt', label: 'Jupe' },
    { id: 'jeans', label: 'Jean' },
  ],
  pants: ['#3c4a5c', '#5c3d1e', '#3c5c3c', '#5c3c5c', '#1a1a1a', '#a87544', '#6b85a8', '#8a4a6a'],
  shoes: [
    { id: 'sneakers', label: 'Baskets' },
    { id: 'boots', label: 'Bottes' },
    { id: 'sandals', label: 'Sandales' },
    { id: 'formal', label: 'Mocassins' },
  ],
  shoeColor: ['#1a1a1a', '#5c3d1e', '#ffffff', '#a85b5b', '#3c5c8a'],
};

const WEATHERS = [
  { id: 'sunny', label: '☀️ Ensoleillé', moodFun: 5, moodEnergy: 3 },
  { id: 'cloudy', label: '⛅ Nuageux', moodFun: 0, moodEnergy: 0 },
  { id: 'rainy', label: '🌧 Pluvieux', moodFun: -3, moodEnergy: -2 },
  { id: 'snowy', label: '❄️ Neige', moodFun: 4, moodEnergy: -2 },
  { id: 'storm', label: '⛈ Orage', moodFun: -5, moodEnergy: -4 },
];

const ACHIEVEMENTS = [
  { id: 'first_buy', icon: '🛒', label: '1er achat', cond: s => (s.placed?.length || 0) >= 1 },
  { id: 'fully_furnished', icon: '🏡', label: 'Appart meublé', cond: s => (s.placed?.length || 0) >= 10 },
  { id: 'rich', icon: '💰', label: 'Premier $1000', cond: s => s.money >= 1000 },
  { id: 'super_rich', icon: '💎', label: '$5000', cond: s => s.money >= 5000 },
  { id: 'cook_master', icon: '👨‍🍳', label: 'Chef niv.5', cond: s => Math.floor((s.skills?.cooking || 0) / 100) >= 5 },
  { id: 'fit', icon: '💪', label: 'Sportif niv.5', cond: s => Math.floor((s.skills?.fitness || 0) / 100) >= 5 },
  { id: 'social_star', icon: '🌟', label: 'Star sociale', cond: s => Math.floor((s.skills?.charisma || 0) / 100) >= 5 },
  { id: 'big_brain', icon: '🧠', label: 'Cerveau', cond: s => Math.floor((s.skills?.logic || 0) / 100) >= 5 },
  { id: 'artist', icon: '🎨', label: 'Artiste', cond: s => Math.floor((s.skills?.art || 0) / 100) >= 5 },
  { id: 'musician', icon: '🎵', label: 'Musicien', cond: s => Math.floor((s.skills?.music || 0) / 100) >= 5 },
  { id: 'survivor', icon: '🌅', label: 'Jour 7', cond: s => s.day >= 7 },
  { id: 'veteran', icon: '🏆', label: 'Jour 30', cond: s => s.day >= 30 },
  { id: 'ceo', icon: '👔', label: 'CEO', cond: s => careerLevel(s.careerXp) >= 7 },
  { id: 'all_traits', icon: '🎭', label: '2 traits', cond: s => (s.appearance?.traits?.length || 0) >= 2 },
  { id: 'cat_friend', icon: '🐈', label: '50 caresses', cond: s => (s.stats?.pets || 0) >= 50 },
  { id: 'gardener', icon: '🌿', label: 'Vert vert', cond: s => (s.stats?.plantWatered || 0) >= 20 },
];

const TRAITS = [
  { id: 'noctambule', label: '🌙 Noctambule', desc: 'Plus en forme la nuit, plus fatigué le jour' },
  { id: 'gourmand', label: '🍰 Gourmand', desc: 'Manger restaure 50% de Faim en plus' },
  { id: 'casanier', label: '🏠 Casanier', desc: 'Social descend lentement, Fun monte à la maison' },
  { id: 'sportif', label: '💪 Sportif', desc: 'Énergie monte plus vite, fatigue plus lente' },
  { id: 'sociable', label: '💬 Sociable', desc: 'Appels et interactions boostés' },
  { id: 'creatif', label: '🎨 Créatif', desc: 'Activités fun rendent +30% bonheur' },
  { id: 'travailleur', label: '💼 Travailleur', desc: 'Travail à l\'ordi paye +50%' },
  { id: 'minimaliste', label: '🧘 Minimaliste', desc: 'Besoin descend lentement, debute avec moins' },
];

function defaultAppearance() {
  return {
    gender: 'f',
    bodyHeight: 'normal',
    bodyShape: 'normal',
    skin: '#fbc8a8',
    hair: '#5c3d1e',
    hairStyle: 'short',
    eyeColor: '#3a4a6a',
    eyebrow: 'normal',
    facialHair: 'none',
    glasses: 'none',
    hat: 'none',
    earring: 'none',
    top: 'tshirt',
    shirt: '#5b8aaf',
    bottom: 'pants',
    pants: '#3c4a5c',
    shoes: 'sneakers',
    shoeColor: '#1a1a1a',
    traits: ['sociable'],
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

const SKILL_KEYS = ['cooking', 'fitness', 'charisma', 'logic', 'art', 'music'];
const SKILL_LABELS = { cooking: 'Cuisine', fitness: 'Forme', charisma: 'Charisme', logic: 'Logique', art: 'Art', music: 'Musique' };
const SKILL_ICONS = { cooking: '🍳', fitness: '💪', charisma: '💬', logic: '🧠', art: '🎨', music: '🎵' };

const ACTION_SKILL_GAINS = {
  cook: { cooking: 18 },
  snack: { cooking: 5 },
  work: { logic: 14 },
  tv: { charisma: 5 },
  relax: { fitness: 4, art: 2 },
  sleep: { fitness: 3 },
  shower: { fitness: 3 },
  call: { charisma: 12 },
  plant: { art: 8 },
  read: { logic: 14, charisma: 4 },
  paint: { art: 22 },
  play_guitar: { music: 18, charisma: 4 },
  yoga: { fitness: 14 },
  workout: { fitness: 22 },
};

const CAREER_THRESHOLDS = [0, 75, 175, 325, 525, 800, 1200];
const CAREER_TITLES = ['Stagiaire', 'Junior', 'Confirmé', 'Senior', 'Lead', 'Manager', 'Directeur', 'CEO'];

function careerLevel(xp) {
  let lvl = 0;
  for (const t of CAREER_THRESHOLDS) if (xp >= t) lvl++;
  return Math.min(lvl, CAREER_TITLES.length);
}

function defaultState(name) {
  return {
    name: name || 'Toi',
    appearance: defaultAppearance(),
    needs: { hunger: 75, energy: 80, hygiene: 80, social: 70, fun: 70 },
    money: 3000,
    timeMin: 8 * 60,
    day: 1,
    player: { x: 3, y: 3, sub: 0, dir: 'down', anim: 0 },
    path: [],
    action: null,
    placed: [],
    buildMode: null,
    tutorial: true,
    skills: { cooking: 0, fitness: 0, charisma: 0, logic: 0, art: 0, music: 0 },
    careerXp: 0,
    weather: 'sunny',
    weatherDay: 1,
    quests: [],
    questsDay: 0,
    achievements: [],
    bank: 0,
    stats: { pets: 0, plantWatered: 0, callsMade: 0, mealsCooked: 0 },
    friends: [],
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
    skills: state.skills,
    careerXp: state.careerXp,
    weather: state.weather,
    weatherDay: state.weatherDay,
    quests: state.quests,
    questsDay: state.questsDay,
    achievements: state.achievements,
    bank: state.bank,
    stats: state.stats,
    friends: state.friends,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snap)); } catch {}
}

function applyLoaded(s) {
  state = defaultState(s.name);
  state.appearance = { ...defaultAppearance(), ...(s.appearance || {}) };
  state.needs = { ...state.needs, ...s.needs };
  state.money = s.money ?? 2500;
  state.timeMin = s.timeMin ?? 8 * 60;
  state.day = s.day ?? 1;
  state.placed = Array.isArray(s.placed) ? s.placed : [];
  state.tutorial = s.tutorial === true ? true : false;
  state.skills = { ...state.skills, ...(s.skills || {}) };
  state.careerXp = s.careerXp || 0;
  state.weather = s.weather || 'sunny';
  state.weatherDay = s.weatherDay || 1;
  state.quests = Array.isArray(s.quests) ? s.quests : [];
  state.questsDay = s.questsDay || 0;
  state.achievements = Array.isArray(s.achievements) ? s.achievements : [];
  state.bank = s.bank || 0;
  state.stats = { ...state.stats, ...(s.stats || {}) };
  state.friends = Array.isArray(s.friends) ? s.friends : [];
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
const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _vec3 = new THREE.Vector3();
const _color1 = new THREE.Color();
const _color2 = new THREE.Color();
let catGroup = null;
let catState = { x: 7, y: 10, sub: 0, dir: 'down', target: null, idle: 0, anim: 0 };
let audioCtx = null;
let skyDome = null;
let skySun = new THREE.Vector3();
let actionParticles = [];
let cookFlameGroup = null;
let showerStreamGroup = null;
let visitorGroup = null;
let visitorState = { x: 5, y: 14, sub: 0, dir: 'up', target: null, active: false, anim: 0 };

const canvasEl = document.getElementById('canvas');

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1428);
  const stage0 = document.getElementById('stage');
  if (stage0) stage0.style.background = '#0e0a18';

  skyDome = buildSkyDome();
  scene.add(skyDome);
  scene.fog = null;

  const stage = document.getElementById('stage');
  const w = stage.clientWidth || 360;
  const h = stage.clientHeight || 600;

  const aspect = w / h;
  const d = 8.5;
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
  buildCat();

  canvasEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

function positionCamera() {
  const cx = COLS / 2;
  const cz = 8.5;
  camera.position.set(cx + 12, 16, cz + 12);
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
    const tex = makeFloorTexture(zone.color, zone.pattern || 'carpet');
    tex.repeat.set(w, h);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x0 + w / 2, 0.01, zone.y0 + h / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const wallTex = makeWallTexture(0xb89878, true);
  wallTex.repeat.set(1, 1.5);
  const innerWallTex = makeWallTexture(0xd8b890, false);
  innerWallTex.repeat.set(1, 1);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const innerWallMat = new THREE.MeshLambertMaterial({ map: innerWallTex });
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
  buildSunBeams();
  buildDustParticles();
}

let sunBeams = [];
function buildSunBeams() {
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff0c8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const wp of [{ x: 2, z: 0 }, { x: 7, z: 0 }]) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.5), beamMat.clone());
    beam.position.set(wp.x + 0.5, 1.2, wp.z + 2.5);
    beam.rotation.x = -Math.PI / 2.2;
    beam.rotation.z = 0.05;
    scene.add(beam);
    sunBeams.push(beam);

    const beam2 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.5), beamMat.clone());
    beam2.position.set(wp.x + 0.5, 1.2, wp.z + 2.5);
    beam2.rotation.x = -Math.PI / 2.2;
    beam2.rotation.z = -0.05;
    beam2.rotation.y = Math.PI / 8;
    scene.add(beam2);
    sunBeams.push(beam2);
  }
}

let dustParticles = null;
function buildDustParticles() {
  const count = 140;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const drift = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * COLS;
    pos[i * 3 + 1] = 0.5 + Math.random() * 1.8;
    pos[i * 3 + 2] = Math.random() * APT_ROWS;
    drift[i * 3] = (Math.random() - 0.5) * 0.05;
    drift[i * 3 + 1] = (Math.random() - 0.3) * 0.04;
    drift[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff5d0,
    size: 0.06,
    transparent: true,
    opacity: 0.45,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  dustParticles = new THREE.Points(geom, mat);
  dustParticles.userData.drift = drift;
  scene.add(dustParticles);
}

function tickIdleAnim(dt) {
  if (!playerGroup) return;
  const t = performance.now() / 1000;
  const a = state.action;
  if (a && a.key !== 'sleep') {
    animateActionPose(t, a.key);
    return;
  }
  if (a && a.key === 'sleep') return;
  if (state.path && state.path.length) return;
  const breath = 1 + Math.sin(t * 1.4) * 0.015;
  if (playerHead) playerHead.scale.set(1, breath, 1);
  if (playerEyeL && playerEyeR) {
    const blinkPhase = (t % 4) / 4;
    const blink = blinkPhase < 0.04 ? 0.1 : 1;
    playerEyeL.scale.y = blink;
    playerEyeR.scale.y = blink;
  }
}

function animateActionPose(t, key) {
  const armL = playerArmL, armR = playerArmR;
  const legL = playerLegL, legR = playerLegR;
  if (key === 'cook') {
    if (armL) armL.rotation.x = -0.6 + Math.sin(t * 4) * 0.15;
    if (armR) armR.rotation.x = -0.6 + Math.sin(t * 4 + 1) * 0.15;
    if (playerGroup) playerGroup.rotation.z = Math.sin(t * 3) * 0.02;
  } else if (key === 'work' || key === 'read') {
    if (armL) armL.rotation.x = -0.95 + Math.sin(t * 2.2) * 0.08;
    if (armR) armR.rotation.x = -0.95 + Math.sin(t * 2.2 + 0.5) * 0.08;
    if (playerHead) playerHead.rotation.x = 0.25 + Math.sin(t * 1.5) * 0.04;
  } else if (key === 'paint') {
    if (armR) armR.rotation.x = -1.3 + Math.sin(t * 5) * 0.35;
    if (armL) armL.rotation.x = -0.5;
  } else if (key === 'yoga') {
    if (armL) armL.rotation.x = 1.5 + Math.sin(t * 1.5) * 0.05;
    if (armR) armR.rotation.x = 1.5 + Math.sin(t * 1.5 + 0.3) * 0.05;
    if (playerGroup) playerGroup.position.y = 0.05 + Math.sin(t * 1.8) * 0.04;
  } else if (key === 'workout') {
    const phase = Math.sin(t * 5);
    if (armL) armL.rotation.x = phase * 1.4;
    if (armR) armR.rotation.x = -phase * 1.4;
    if (legL) legL.rotation.x = -phase * 0.4;
    if (legR) legR.rotation.x = phase * 0.4;
    if (playerGroup) playerGroup.position.y = Math.abs(phase) * 0.12;
  } else if (key === 'shower') {
    if (armL) armL.rotation.x = 0.6 + Math.sin(t * 2.5) * 0.1;
    if (armR) armR.rotation.x = 0.6 + Math.sin(t * 2.5 + 1) * 0.1;
    if (playerGroup) playerGroup.rotation.z = Math.sin(t * 2) * 0.04;
  } else if (key === 'play_guitar') {
    if (armL) armL.rotation.x = -0.8;
    if (armR) armR.rotation.x = -0.5 + Math.sin(t * 7) * 0.4;
    if (playerHead) playerHead.rotation.z = Math.sin(t * 2) * 0.08;
  } else if (key === 'tv' || key === 'relax') {
    if (playerGroup) playerGroup.rotation.z = Math.sin(t * 0.7) * 0.025;
    if (playerHead) playerHead.rotation.x = -0.05 + Math.sin(t * 0.5) * 0.02;
  } else if (key === 'call') {
    if (armR) armR.rotation.x = 1.4;
    if (playerHead) playerHead.rotation.z = 0.15 + Math.sin(t * 1.2) * 0.04;
  } else if (key === 'snack') {
    const reach = Math.sin(t * 2);
    if (armR) armR.rotation.x = -0.4 + reach * 0.4;
  } else if (key === 'plant') {
    if (armR) armR.rotation.x = -1.0 + Math.sin(t * 2.5) * 0.1;
    if (playerHead) playerHead.rotation.x = 0.15;
  } else if (key === 'toilet') {
    if (playerGroup) playerGroup.position.y = -0.15;
  }
}

function resetPlayerPose() {
  if (playerArmL) playerArmL.rotation.set(0, 0, 0);
  if (playerArmR) playerArmR.rotation.set(0, 0, 0);
  if (playerLegL) playerLegL.rotation.set(0, 0, 0);
  if (playerLegR) playerLegR.rotation.set(0, 0, 0);
  if (playerHead) playerHead.rotation.set(0, 0, 0);
  if (playerGroup) {
    playerGroup.position.y = 0;
    playerGroup.rotation.z = 0;
  }
}

function tickActionParticles(dt) {
  const a = state.action;
  const t = performance.now() / 1000;
  updateCookFlame(t);
  updateShowerStream(t);
  if (a) {
    if (a.key === 'cook' && a.item) spawnFlameParticle(a.item, t);
    else if (a.key === 'shower' && a.item) spawnWaterParticle(a.item, t);
    else if (a.key === 'tv' && a.item) updateTVChannel(a.item, t);
  }
  for (let i = actionParticles.length - 1; i >= 0; i--) {
    const p = actionParticles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      actionParticles.splice(i, 1);
      continue;
    }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    if (p.gravity) p.vy -= p.gravity * dt;
    if (p.kind === 'drop' && p.mesh.position.y <= 0.05 && !p.splashed) {
      p.splashed = true;
      spawnSplash(p.mesh.position.x, p.mesh.position.z);
      p.life = p.maxLife;
      continue;
    }
    const k = p.life / p.maxLife;
    p.mesh.material.opacity = (1 - k) * (p.startOpacity || 0.8);
    if (p.scaleEnd != null) p.mesh.scale.setScalar(1 + k * (p.scaleEnd - 1));
  }
}

function spawnSplash(x, z) {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
    const splashMat = new THREE.MeshBasicMaterial({ color: 0xa8e8ff, transparent: true, opacity: 0.8, depthWrite: false });
    const splash = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), splashMat);
    splash.position.set(x, 0.05, z);
    scene.add(splash);
    actionParticles.push({
      mesh: splash, life: 0, maxLife: 0.35,
      vx: Math.cos(a) * 0.4,
      vy: 0.6 + Math.random() * 0.2,
      vz: Math.sin(a) * 0.4,
      gravity: 2.0,
      startOpacity: 0.8,
    });
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xa8e8ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.04, 12), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.012, z);
  scene.add(ring);
  actionParticles.push({
    mesh: ring, life: 0, maxLife: 0.4,
    vx: 0, vy: 0, vz: 0,
    startOpacity: 0.5, scaleEnd: 4.5,
  });
}

function buildCookFlameMesh() {
  const grp = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.22, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4828, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  outer.position.y = 0.11;
  grp.add(outer);
  const mid = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.18, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8828, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mid.position.y = 0.09;
  grp.add(mid);
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff080, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  inner.position.y = 0.06;
  grp.add(inner);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xff8838, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  halo.position.y = 0.05;
  grp.add(halo);
  grp.userData = { outer, mid, inner, halo };
  grp.visible = false;
  return grp;
}

function updateCookFlame(t) {
  const a = state.action;
  if (!cookFlameGroup) {
    cookFlameGroup = buildCookFlameMesh();
    scene.add(cookFlameGroup);
  }
  if (a && a.key === 'cook' && a.item) {
    cookFlameGroup.visible = true;
    cookFlameGroup.position.set(a.item.x + a.item.w / 2 - 0.2, 0.96, a.item.y + a.item.h / 2 - 0.1);
    const u = cookFlameGroup.userData;
    const flick1 = 1 + Math.sin(t * 12) * 0.15 + Math.sin(t * 27) * 0.08;
    const flick2 = 1 + Math.sin(t * 9 + 1) * 0.12 + Math.sin(t * 31 + 1) * 0.06;
    u.inner.scale.set(flick1, flick1 * 1.1, flick1);
    u.mid.scale.set(flick2 * 0.95, flick2 * 1.15, flick2 * 0.95);
    u.outer.scale.set(flick1 * 1.05, flick1 * 1.25, flick1 * 1.05);
    u.halo.scale.setScalar(0.9 + Math.sin(t * 8) * 0.1);
    u.halo.material.opacity = 0.16 + Math.sin(t * 11) * 0.04;
  } else {
    cookFlameGroup.visible = false;
  }
}

function buildShowerStream() {
  const grp = new THREE.Group();
  const streamMat = new THREE.MeshBasicMaterial({ color: 0xa8e0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.7, 10, 1, true), streamMat);
  stream.position.y = 1.25;
  grp.add(stream);
  const streamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.7, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xe0f6ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  streamCore.position.y = 1.25;
  grp.add(streamCore);
  grp.userData = { stream, streamCore };
  grp.visible = false;
  return grp;
}

function updateShowerStream(t) {
  const a = state.action;
  if (!showerStreamGroup) {
    showerStreamGroup = buildShowerStream();
    scene.add(showerStreamGroup);
  }
  if (a && a.key === 'shower' && a.item) {
    showerStreamGroup.visible = true;
    showerStreamGroup.position.set(a.item.x + a.item.w / 2, 0, a.item.y + a.item.h / 2 - 0.1);
    const u = showerStreamGroup.userData;
    u.stream.material.opacity = 0.3 + Math.sin(t * 14) * 0.06;
    u.streamCore.material.opacity = 0.55 + Math.sin(t * 18) * 0.08;
  } else {
    showerStreamGroup.visible = false;
  }
}

let lastFlameSpawn = 0;
function spawnFlameParticle(item, t) {
  if (t - lastFlameSpawn < 0.06) return;
  lastFlameSpawn = t;
  const cx = item.x + item.w / 2 - 0.2;
  const cz = item.y + item.h / 2 - 0.1;
  if (Math.random() < 0.7) {
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xfdc848, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), emberMat);
    ember.position.set(cx + (Math.random() - 0.5) * 0.08, 1.05, cz + (Math.random() - 0.5) * 0.08);
    scene.add(ember);
    actionParticles.push({
      mesh: ember, life: 0, maxLife: 0.7 + Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.15,
      vy: 0.5 + Math.random() * 0.4,
      vz: (Math.random() - 0.5) * 0.15,
      startOpacity: 1, scaleEnd: 0.2,
    });
  }
  if (Math.random() < 0.25) {
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x9a9a9a, transparent: true, opacity: 0.32, depthWrite: false,
    });
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), smokeMat);
    smoke.position.set(cx + (Math.random() - 0.5) * 0.08, 1.25, cz + (Math.random() - 0.5) * 0.08);
    scene.add(smoke);
    actionParticles.push({
      mesh: smoke, life: 0, maxLife: 1.8,
      vx: (Math.random() - 0.5) * 0.04,
      vy: 0.25 + Math.random() * 0.1,
      vz: (Math.random() - 0.5) * 0.04,
      startOpacity: 0.32, scaleEnd: 3.0,
    });
  }
}

let lastWaterSpawn = 0;
function spawnWaterParticle(item, t) {
  if (t - lastWaterSpawn < 0.04) return;
  lastWaterSpawn = t;
  const cx = item.x + item.w / 2;
  const cz = item.y + item.h / 2;
  const waterMat = new THREE.MeshBasicMaterial({
    color: 0x9be0ff, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), waterMat);
  drop.position.set(cx + (Math.random() - 0.5) * 0.3, 1.65, cz - 0.18 + (Math.random() - 0.5) * 0.2);
  drop.scale.y = 2.5;
  scene.add(drop);
  actionParticles.push({
    mesh: drop, life: 0, maxLife: 1.5,
    vx: 0, vy: -0.4, vz: 0, gravity: 2.0,
    startOpacity: 0.85, kind: 'drop',
  });
}

let tvChannelTime = 0;
let tvChannel = 0;
const TV_CHANNELS = [
  { color: 0x4ac0e8, emissive: 0x4ac0e8, name: 'doc' },
  { color: 0xe88a4a, emissive: 0xe88a4a, name: 'cuisine' },
  { color: 0x7da85b, emissive: 0x7da85b, name: 'sport' },
  { color: 0xc88adc, emissive: 0xc88adc, name: 'films' },
  { color: 0xe85b5b, emissive: 0xe85b5b, name: 'news' },
];
function updateTVChannel(item, t) {
  if (t - tvChannelTime > 4) {
    tvChannelTime = t;
    tvChannel = (tvChannel + 1) % TV_CHANNELS.length;
    const ch = TV_CHANNELS[tvChannel];
    for (const f of flickerMeshes) {
      if (f.type === 'screen') {
        f.baseColor = ch.color;
        f.mesh.material.color.setHex(ch.color);
        f.mesh.material.emissive.setHex(ch.emissive);
      }
    }
  }
}

function tickVisitor(dt) {
  if (!visitorState.active || !visitorGroup) return;
  visitorState.idle = (visitorState.idle || 0) + dt;
  if (!visitorState.target || visitorState.target.length === 0) {
    if (visitorState.idle > 6) {
      visitorState.active = false;
      scene.remove(visitorGroup);
      visitorGroup = null;
      return;
    }
    if (visitorState.idle > 3) {
      let attempts = 6;
      while (attempts-- > 0) {
        const tx = Math.floor(Math.random() * COLS);
        const ty = Math.floor(Math.random() * APT_ROWS);
        if (!isWalkable(tx, ty)) continue;
        const path = bfs(visitorState.x, visitorState.y, tx, ty);
        if (path && path.length) { visitorState.target = path; visitorState.idle = 0; break; }
      }
    }
    return;
  }
  const speed = 3;
  visitorState.sub += dt * speed;
  const [nx, ny] = visitorState.target[0];
  const dx = nx - visitorState.x, dy = ny - visitorState.y;
  visitorGroup.position.x = visitorState.x + 0.5 + dx * visitorState.sub;
  visitorGroup.position.z = visitorState.y + 0.5 + dy * visitorState.sub;
  if (Math.abs(dx) > Math.abs(dy)) visitorState.dir = dx > 0 ? 'right' : 'left';
  else visitorState.dir = dy > 0 ? 'down' : 'up';
  const angles = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
  visitorGroup.rotation.y = angles[visitorState.dir] || 0;
  if (visitorState.sub >= 1) {
    visitorState.sub = 0;
    visitorState.x = nx; visitorState.y = ny;
    visitorState.target.shift();
  }
}

function spawnVisitor() {
  if (visitorState.active) return;
  visitorState.x = 5; visitorState.y = 14;
  visitorState.active = true; visitorState.idle = 0; visitorState.target = null;
  visitorGroup = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xb88660 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: 0xa85b5b });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3c4a5c });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
  visitorGroup.add(Object.assign(new THREE.Mesh(rb(0.4, 0.5, 0.22, 0.05), shirtMat), { castShadow: true, position: { x: 0, y: 0.85, z: 0 } }));
  const torso = new THREE.Mesh(rb(0.4, 0.5, 0.22, 0.05), shirtMat);
  torso.position.y = 0.85; torso.castShadow = true;
  visitorGroup.add(torso);
  const legL = new THREE.Mesh(rb(0.13, 0.5, 0.16, 0.04), pantsMat);
  legL.position.set(-0.08, 0.35, 0); visitorGroup.add(legL);
  const legR = new THREE.Mesh(rb(0.13, 0.5, 0.16, 0.04), pantsMat);
  legR.position.set(0.08, 0.35, 0); visitorGroup.add(legR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), skinMat);
  head.position.y = 1.32; head.castShadow = true;
  visitorGroup.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.32;
  visitorGroup.add(hair);
  visitorGroup.position.set(visitorState.x + 0.5, 0, visitorState.y + 0.5);
  visitorGroup.userData.visitor = true;
  scene.add(visitorGroup);
  toast('🚪 Un ami passe te voir !', 3000);
  playSfx('success');
}

function chatVisitor() {
  if (!visitorState.active) return;
  state.needs.social = Math.min(100, state.needs.social + 25);
  state.needs.fun = Math.min(100, state.needs.fun + 12);
  spawnEmote('💬');
  toast('Belle discussion !', 1800);
  playSfx('pet');
}

let lastEventDay = 0;
let lastBillDay = 0;
let lastWeatherDay = 0;
let lastQuestsDay = 0;
let rainParticles = null;
let snowParticles = null;

const FRIEND_NAMES = ['Léo', 'Mia', 'Ali', 'Zoé', 'Yann', 'Léa', 'Tom', 'Inès', 'Max', 'Eva'];
const QUEST_TEMPLATES = [
  { id: 'cook', label: '🍳 Cuisiner 2 fois', target: 2, key: 'mealsCooked', reward: 60 },
  { id: 'work', label: '💼 Aller au travail', target: 1, key: 'workSessions', reward: 80 },
  { id: 'pets', label: '🐈 Caresser le chat 3x', target: 3, key: 'pets', reward: 40 },
  { id: 'plant', label: '🌱 Arroser plante 2x', target: 2, key: 'plantWatered', reward: 30 },
  { id: 'social', label: '💬 Faire 2 appels', target: 2, key: 'callsMade', reward: 50 },
  { id: 'tv', label: '📺 Regarder la télé', target: 1, key: 'tvWatched', reward: 25 },
  { id: 'shower', label: '🚿 Se laver 2x', target: 2, key: 'showers', reward: 30 },
  { id: 'workout', label: '💪 Faire du sport', target: 1, key: 'workouts', reward: 50 },
  { id: 'spend', label: '💸 Dépenser $200', target: 200, key: 'spent', reward: 80 },
];

function rollWeather() {
  const r = Math.random();
  if (r < 0.45) return 'sunny';
  if (r < 0.7) return 'cloudy';
  if (r < 0.85) return 'rainy';
  if (r < 0.95) return 'snowy';
  return 'storm';
}

function applyWeatherDailyMood() {
  const w = WEATHERS.find(w => w.id === state.weather);
  if (!w) return;
  state.needs.fun = Math.max(0, Math.min(100, state.needs.fun + w.moodFun));
  state.needs.energy = Math.max(0, Math.min(100, state.needs.energy + w.moodEnergy));
}

function ensureWeatherParticles() {
  if (state.weather === 'rainy' || state.weather === 'storm') {
    if (snowParticles) snowParticles.visible = false;
    if (!rainParticles) {
      const count = 600;
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 30 + COLS / 2;
        pos[i * 3 + 1] = Math.random() * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 30 + APT_ROWS / 2;
      }
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xa0c8e8, size: 0.12, transparent: true, opacity: 0.7,
        depthWrite: false, sizeAttenuation: true,
      });
      rainParticles = new THREE.Points(geom, mat);
      scene.add(rainParticles);
    }
    rainParticles.visible = true;
  } else if (state.weather === 'snowy') {
    if (rainParticles) rainParticles.visible = false;
    if (!snowParticles) {
      const count = 350;
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const drift = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 30 + COLS / 2;
        pos[i * 3 + 1] = Math.random() * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 30 + APT_ROWS / 2;
        drift[i * 3] = (Math.random() - 0.5) * 0.3;
        drift[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      }
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.18, transparent: true, opacity: 0.85,
        depthWrite: false, sizeAttenuation: true,
      });
      snowParticles = new THREE.Points(geom, mat);
      snowParticles.userData.drift = drift;
      scene.add(snowParticles);
    }
    snowParticles.visible = true;
  } else {
    if (rainParticles) rainParticles.visible = false;
    if (snowParticles) snowParticles.visible = false;
  }
}

function tickWeatherParticles(dt) {
  if (rainParticles && rainParticles.visible) {
    const pos = rainParticles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] -= 12 * dt;
      if (pos[i + 1] < 0) {
        pos[i] = (Math.random() - 0.5) * 30 + COLS / 2;
        pos[i + 1] = 18;
        pos[i + 2] = (Math.random() - 0.5) * 30 + APT_ROWS / 2;
      }
    }
    rainParticles.geometry.attributes.position.needsUpdate = true;
  }
  if (snowParticles && snowParticles.visible) {
    const pos = snowParticles.geometry.attributes.position.array;
    const drift = snowParticles.userData.drift;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += drift[i] * dt;
      pos[i + 1] -= 1.5 * dt;
      pos[i + 2] += drift[i + 2] * dt;
      if (pos[i + 1] < 0) {
        pos[i] = (Math.random() - 0.5) * 30 + COLS / 2;
        pos[i + 1] = 18;
        pos[i + 2] = (Math.random() - 0.5) * 30 + APT_ROWS / 2;
      }
    }
    snowParticles.geometry.attributes.position.needsUpdate = true;
  }
}

function generateQuests() {
  const pool = [...QUEST_TEMPLATES];
  pool.sort(() => Math.random() - 0.5);
  state.quests = pool.slice(0, 3).map(q => ({ ...q, progress: 0, done: false, claimed: false }));
}

function bumpQuestStat(key, amount = 1) {
  state.stats[key] = (state.stats[key] || 0) + amount;
  for (const q of state.quests) {
    if (q.done) continue;
    if (q.key === key) {
      q.progress = Math.min(q.target, q.progress + amount);
      if (q.progress >= q.target) {
        q.done = true;
        toast(`✅ Quête : ${q.label}`, 2500);
        playSfx('levelup');
      }
    }
  }
  updateQuestsBadge();
}

function updateQuestsBadge() {
  const remaining = state.quests.filter(q => !q.done).length;
  const fab = document.getElementById('quests-fab');
  const count = document.getElementById('quests-count');
  if (count) count.textContent = remaining || '✓';
  if (fab) fab.style.display = state.quests.length ? 'flex' : 'none';
}

function checkAchievements() {
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements.includes(ach.id)) continue;
    if (ach.cond(state)) {
      state.achievements.push(ach.id);
      toast(`🏆 ${ach.icon} ${ach.label}`, 3500);
      playSfx('levelup');
    }
  }
}

function openPhone() {
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = '📱 Téléphone';
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="phone-app">
      <h3>💰 Banque</h3>
      <div class="app-row"><span>Compte courant</span><strong style="color:var(--accent)">$${Math.floor(state.money)}</strong></div>
      <div class="app-row"><span>Épargne (+2%/jour)</span><strong style="color:var(--good)">$${Math.floor(state.bank)}</strong></div>
      <div class="app-row" style="gap:8px;justify-content:flex-end">
        <button data-bank="50">+ Dépose $50</button>
        <button data-bank="-50">Retire $50</button>
      </div>
    </div>
    <div class="phone-app">
      <h3>🍕 Livraison</h3>
      <div class="app-row"><span>🍔 Burger ($15)</span><button data-deliver="burger" data-price="15">Cmd</button></div>
      <div class="app-row"><span>🍕 Pizza ($25)</span><button data-deliver="pizza" data-price="25">Cmd</button></div>
      <div class="app-row"><span>🍣 Sushi ($40)</span><button data-deliver="sushi" data-price="40">Cmd</button></div>
    </div>
    <div class="phone-app">
      <h3>💬 Amis</h3>
      ${(state.friends.length ? state.friends : (state.friends = pickFriends()))
        .map(f => `<div class="app-row"><span>${f.emoji} ${f.name}</span><button data-chat="${f.name}">Discuter</button></div>`).join('')}
    </div>
    <div class="phone-app">
      <h3>🏆 Trophées (${state.achievements.length}/${ACHIEVEMENTS.length})</h3>
      <div class="achievements-grid">
        ${ACHIEVEMENTS.map(ach => `<div class="achievement ${state.achievements.includes(ach.id) ? 'unlocked' : ''}" title="${ach.label}">${ach.icon}</div>`).join('')}
      </div>
    </div>
  `;
  body.querySelectorAll('[data-bank]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = parseInt(btn.dataset.bank, 10);
      if (v > 0) {
        if (state.money < v) { toast("Pas assez d'argent."); return; }
        state.money -= v; state.bank += v;
      } else if (v < 0) {
        if (state.bank < -v) { toast('Épargne vide.'); return; }
        state.bank += v; state.money -= v;
      }
      saveGame(); openPhone(); playSfx('money');
    });
  });
  body.querySelectorAll('[data-deliver]').forEach(btn => {
    btn.addEventListener('click', () => {
      const price = parseInt(btn.dataset.price, 10);
      if (state.money < price) { toast("Pas assez d'argent."); return; }
      state.money -= price;
      state.needs.hunger = Math.min(100, state.needs.hunger + (price * 1.8));
      state.needs.fun = Math.min(100, state.needs.fun + 6);
      bumpQuestStat('spent', price);
      toast(`✅ ${btn.dataset.deliver} livré !`, 2200);
      spawnEmote('🍽');
      playSfx('success');
      m.hidden = true;
    });
  });
  body.querySelectorAll('[data-chat]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.needs.social = Math.min(100, state.needs.social + 18);
      state.needs.fun = Math.min(100, state.needs.fun + 8);
      bumpQuestStat('callsMade');
      toast(`💬 Belle discussion avec ${btn.dataset.chat}`, 2200);
      playSfx('pet');
      m.hidden = true;
    });
  });
  m.hidden = false;
}

function pickFriends() {
  const emojis = ['🧑', '👩', '👨', '🧑‍🦰', '👱', '🧔', '👵', '🧓'];
  const arr = [...FRIEND_NAMES].sort(() => Math.random() - 0.5).slice(0, 4);
  return arr.map(name => ({ name, emoji: emojis[Math.floor(Math.random() * emojis.length)] }));
}

function openQuests() {
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = '📋 Quêtes du jour';
  const body = document.getElementById('modal-body');
  if (!state.quests.length) generateQuests();
  body.innerHTML = state.quests.map(q => `
    <div class="quest-item ${q.done ? 'done' : ''}">
      <span>${q.label}</span>
      <span class="quest-reward">${q.progress}/${q.target} · +$${q.reward}</span>
    </div>
  `).join('') + (state.quests.every(q => q.done && !q.claimed) ? `
    <button id="claim-quests" style="width:100%;padding:12px;border-radius:12px;background:var(--grad-accent);color:var(--bg-deep);font-weight:700;font-size:14px;margin-top:12px;box-shadow:0 4px 14px rgba(244,184,96,0.3)">Récupérer ${state.quests.reduce((s, q) => s + q.reward, 0)}$</button>
  ` : '');
  const claim = document.getElementById('claim-quests');
  if (claim) claim.addEventListener('click', () => {
    const total = state.quests.reduce((s, q) => s + q.reward, 0);
    state.money += total;
    state.quests.forEach(q => q.claimed = true);
    state.quests = [];
    toast(`💰 +$${total} récompense quêtes !`, 3000);
    playSfx('money');
    m.hidden = true;
    updateQuestsBadge();
    saveGame();
  });
  m.hidden = false;
}

function checkRandomEvents() {
  const t = state.timeMin / 60;
  if (state.day > lastBillDay && state.day % 3 === 0 && t >= 9 && t < 9.5) {
    lastBillDay = state.day;
    const itemValue = state.placed.reduce((s, p) => s + (BUILD_CATALOG.find(c => c.type === p.type)?.price || 0), 0);
    const bill = Math.max(20, Math.floor(itemValue * 0.04) + 30);
    state.money = Math.max(0, state.money - bill);
    toast(`📬 Factures : -$${bill}`, 3500);
    playSfx('money');
  }
  if (state.day > lastEventDay && t >= 12 && t < 12.5) {
    lastEventDay = state.day;
    const r = Math.random();
    if (r < 0.4 && !visitorState.active) spawnVisitor();
    else if (r < 0.6) {
      const found = 15 + Math.floor(Math.random() * 40);
      state.money += found;
      toast(`💸 Billet trouvé : +$${found}`, 3000);
      playSfx('money');
    } else if (r < 0.75) {
      state.needs.fun = Math.min(100, state.needs.fun + 20);
      toast('☀️ Belle journée — +Fun', 3000);
      spawnEmote('☀️');
    } else if (r < 0.85) {
      state.needs.energy = Math.min(100, state.needs.energy + 15);
      toast('☕ Café offert — +Énergie', 3000);
      spawnEmote('☕');
    }
  }
}

function tickDust(dt) {
  if (!dustParticles) return;
  const pos = dustParticles.geometry.attributes.position.array;
  const drift = dustParticles.userData.drift;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] += drift[i] * dt;
    pos[i + 1] += drift[i + 1] * dt;
    pos[i + 2] += drift[i + 2] * dt;
    if (pos[i + 1] > 2.4) pos[i + 1] = 0.4;
    if (pos[i + 1] < 0.3) pos[i + 1] = 2.3;
    if (pos[i] < 0.5) pos[i] = COLS - 0.5;
    if (pos[i] > COLS - 0.5) pos[i] = 0.5;
    if (pos[i + 2] < 0.5) pos[i + 2] = APT_ROWS - 0.5;
    if (pos[i + 2] > APT_ROWS - 0.5) pos[i + 2] = 0.5;
  }
  dustParticles.geometry.attributes.position.needsUpdate = true;
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
  const placedGroups = itemMeshes.filter(o => o.userData?.placed);
  const placedLightSet = new Set();
  for (const m of placedGroups) {
    m.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(mat => mat.dispose());
          else o.material.dispose();
        }
      }
      if (o.isLight) placedLightSet.add(o);
    });
    scene.remove(m);
  }
  itemMeshes = itemMeshes.filter(o => !o.userData?.placed);
  lampLights = lampLights.filter(lp => !placedLightSet.has(lp.light));
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
    case 'placedYogaMat': {
      const w = it.w * 0.85;
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(w, it.h * 0.55), lamMat(0x9b6fc8));
      mat.rotation.x = -Math.PI / 2;
      mat.position.y = 0.014;
      mat.receiveShadow = true; group.add(mat);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, it.h * 0.05), lamMat(0xd8a8e8));
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.y = 0.018;
      group.add(stripe);
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

function buildCat() {
  catGroup = new THREE.Group();
  const furMat = new THREE.MeshLambertMaterial({ color: 0xc8a070 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0x8a6040 });
  const noseMat = new THREE.MeshLambertMaterial({ color: 0xe89a8a });

  const body = new THREE.Mesh(rb(0.34, 0.2, 0.5, 0.07), furMat);
  body.position.y = 0.18; body.castShadow = true; body.receiveShadow = true;
  catGroup.add(body);

  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(rb(0.36, 0.04, 0.06, 0.02), stripeMat);
    stripe.position.set(0, 0.27, -0.1 + i * 0.1);
    catGroup.add(stripe);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), furMat);
  head.position.set(0, 0.3, -0.24); head.castShadow = true;
  catGroup.add(head);

  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 6), furMat);
  earL.position.set(-0.07, 0.42, -0.24); catGroup.add(earL);
  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 6), furMat);
  earR.position.set(0.07, 0.42, -0.24); catGroup.add(earR);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4aa848 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
  eyeL.position.set(-0.05, 0.32, -0.36); catGroup.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
  eyeR.position.set(0.05, 0.32, -0.36); catGroup.add(eyeR);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), noseMat);
  nose.position.set(0, 0.28, -0.38); catGroup.add(nose);

  const legGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.18, 8);
  for (const [px, pz] of [[-0.09, -0.18], [0.09, -0.18], [-0.09, 0.18], [0.09, 0.18]]) {
    const leg = new THREE.Mesh(legGeom, furMat);
    leg.position.set(px, 0.09, pz);
    leg.castShadow = true;
    catGroup.add(leg);
  }

  const tailGeom = new THREE.CylinderGeometry(0.018, 0.028, 0.45, 8);
  tailGeom.translate(0, 0.225, 0);
  const tail = new THREE.Mesh(tailGeom, furMat);
  tail.position.set(0, 0.18, 0.28); tail.rotation.x = -Math.PI / 5;
  tail.castShadow = true;
  catGroup.add(tail);
  catGroup.userData.tail = tail;

  catGroup.position.set(catState.x + 0.5, 0, catState.y + 0.5);
  catGroup.userData.cat = true;
  catGroup.scale.setScalar(1.1);
  scene.add(catGroup);
}

function tickCat(dt) {
  if (!catGroup) return;
  catState.idle += dt;
  if (catGroup.userData.tail) catGroup.userData.tail.rotation.z = Math.sin(performance.now() / 600) * 0.3;
  if (catState.idle > 4 && (!catState.target || catState.target.length === 0)) {
    for (let attempts = 0; attempts < 8; attempts++) {
      const tx = Math.floor(Math.random() * COLS);
      const ty = Math.floor(Math.random() * APT_ROWS);
      if (!isWalkable(tx, ty)) continue;
      if (tx === catState.x && ty === catState.y) continue;
      const path = bfs(catState.x, catState.y, tx, ty);
      if (path && path.length) { catState.target = path; catState.idle = 0; break; }
    }
  }
  if (catState.target && catState.target.length) {
    const speed = 2.5;
    catState.sub += dt * speed;
    catState.anim += dt * 9;
    const [nx, ny] = catState.target[0];
    const dx = nx - catState.x, dy = ny - catState.y;
    catGroup.position.x = catState.x + 0.5 + dx * catState.sub;
    catGroup.position.z = catState.y + 0.5 + dy * catState.sub;
    if (Math.abs(dx) > Math.abs(dy)) catState.dir = dx > 0 ? 'right' : 'left';
    else catState.dir = dy > 0 ? 'down' : 'up';
    const angles = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
    catGroup.rotation.y = angles[catState.dir] || 0;
    if (catState.sub >= 1) {
      catState.sub = 0;
      const [nx2, ny2] = catState.target.shift();
      catState.x = nx2; catState.y = ny2;
      if (catState.target.length === 0) catState.target = null;
    }
  }
}

function petCat() {
  state.needs.fun = Math.min(100, state.needs.fun + 5);
  state.needs.social = Math.min(100, state.needs.social + 3);
  spawnEmote('💖');
  toast('Tu caresses le chat', 1500);
  playSfx('pet');
  bumpQuestStat('pets');
}

function ensureAudio() {
  if (audioCtx) return audioCtx;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  return audioCtx;
}

function playSfx(type) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  if (type === 'tap') {
    o.type = 'sine'; o.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.start(t); o.stop(t + 0.13);
  } else if (type === 'success') {
    o.type = 'triangle'; o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(990, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.start(t); o.stop(t + 0.31);
  } else if (type === 'pet') {
    o.type = 'sine'; o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.start(t); o.stop(t + 0.31);
  } else if (type === 'levelup') {
    o.type = 'square'; o.frequency.setValueAtTime(523, t);
    o.frequency.setValueAtTime(659, t + 0.08);
    o.frequency.setValueAtTime(784, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.start(t); o.stop(t + 0.41);
  } else if (type === 'money') {
    const o2 = ctx.createOscillator();
    o2.connect(g);
    o.type = 'sine'; o.frequency.value = 1320;
    o2.type = 'sine'; o2.frequency.value = 1760;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.start(t); o.stop(t + 0.21);
    o2.start(t + 0.05); o2.stop(t + 0.25);
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
    } else if (app.hairStyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), hairMat);
      bun.position.set(0, 1.5, 0.12);
      bun.castShadow = true;
      hairGroup.add(bun);
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 16), hairMat);
      wrap.position.set(0, 1.5, 0.12);
      wrap.rotation.y = Math.PI / 2;
      hairGroup.add(wrap);
    } else if (app.hairStyle === 'curly') {
      for (const [px, py, pz, r] of [[0, 1.45, -0.04, 0.07], [-0.1, 1.45, 0, 0.06], [0.1, 1.45, 0, 0.06], [-0.06, 1.5, -0.08, 0.055], [0.06, 1.5, -0.08, 0.055], [0, 1.52, 0.06, 0.06]]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), hairMat);
        curl.position.set(px, py, pz);
        curl.castShadow = true;
        hairGroup.add(curl);
      }
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

  const eyeGeom = new THREE.SphereGeometry(0.028, 10, 8);
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeIrisMat = new THREE.MeshBasicMaterial({ color: app.eyeColor || 0x3a4a6a });
  const eyeWhiteL = new THREE.Mesh(eyeGeom, eyeWhiteMat);
  eyeWhiteL.position.set(-0.06, 1.36, -0.16); eyeWhiteL.scale.set(1, 1, 0.3);
  playerGroup.add(eyeWhiteL);
  const eyeWhiteR = new THREE.Mesh(eyeGeom, eyeWhiteMat);
  eyeWhiteR.position.set(0.06, 1.36, -0.16); eyeWhiteR.scale.set(1, 1, 0.3);
  playerGroup.add(eyeWhiteR);
  playerEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeIrisMat);
  playerEyeL.position.set(-0.06, 1.36, -0.175); playerEyeL.scale.set(1, 1, 0.3);
  playerGroup.add(playerEyeL);
  playerEyeR = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeIrisMat);
  playerEyeR.position.set(0.06, 1.36, -0.175); playerEyeR.scale.set(1, 1, 0.3);
  playerGroup.add(playerEyeR);

  const browMat = new THREE.MeshLambertMaterial({ color: app.hair || 0x5c3d1e });
  const browStyle = app.eyebrow || 'normal';
  const browW = browStyle === 'thick' ? 0.07 : browStyle === 'thin' ? 0.04 : 0.05;
  const browH = browStyle === 'thick' ? 0.018 : 0.012;
  const browL = new THREE.Mesh(rb(browW, browH, 0.01, 0.003), browMat);
  browL.position.set(-0.06, 1.42, -0.18);
  if (browStyle === 'arched') browL.rotation.z = -0.25;
  playerGroup.add(browL);
  const browR = new THREE.Mesh(rb(browW, browH, 0.01, 0.003), browMat);
  browR.position.set(0.06, 1.42, -0.18);
  if (browStyle === 'arched') browR.rotation.z = 0.25;
  playerGroup.add(browR);

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

  if (app.facialHair && app.facialHair !== 'none') {
    const fhMat = new THREE.MeshLambertMaterial({ color: app.hair || 0x5c3d1e });
    if (app.facialHair === 'mustache') {
      const m = new THREE.Mesh(rb(0.1, 0.025, 0.02, 0.005), fhMat);
      m.position.set(0, 1.3, -0.17); playerGroup.add(m);
    } else if (app.facialHair === 'goatee') {
      const m = new THREE.Mesh(rb(0.06, 0.05, 0.02, 0.01), fhMat);
      m.position.set(0, 1.22, -0.17); playerGroup.add(m);
    } else if (app.facialHair === 'beard') {
      const m1 = new THREE.Mesh(rb(0.18, 0.1, 0.03, 0.02), fhMat);
      m1.position.set(0, 1.23, -0.16); playerGroup.add(m1);
      const m2 = new THREE.Mesh(rb(0.1, 0.025, 0.02, 0.005), fhMat);
      m2.position.set(0, 1.3, -0.17); playerGroup.add(m2);
    }
  }

  if (app.glasses && app.glasses !== 'none') {
    const frameMat = new THREE.MeshLambertMaterial({ color: app.glasses === 'sun' ? 0x1a1a1a : 0x3a3a3a });
    const lensMat = new THREE.MeshBasicMaterial({ color: app.glasses === 'sun' ? 0x1a1a1a : 0x6ab0d8, transparent: true, opacity: app.glasses === 'sun' ? 0.85 : 0.5 });
    const isRound = app.glasses === 'round';
    if (isRound) {
      const lensL = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), frameMat);
      lensL.position.set(-0.06, 1.36, -0.19); playerGroup.add(lensL);
      const lensR = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), frameMat);
      lensR.position.set(0.06, 1.36, -0.19); playerGroup.add(lensR);
      const innerL = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), lensMat);
      innerL.position.set(-0.06, 1.36, -0.188); playerGroup.add(innerL);
      const innerR = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), lensMat);
      innerR.position.set(0.06, 1.36, -0.188); playerGroup.add(innerR);
    } else {
      const lensL = new THREE.Mesh(rb(0.09, 0.06, 0.005, 0.01), frameMat);
      lensL.position.set(-0.06, 1.36, -0.19); playerGroup.add(lensL);
      const lensR = new THREE.Mesh(rb(0.09, 0.06, 0.005, 0.01), frameMat);
      lensR.position.set(0.06, 1.36, -0.19); playerGroup.add(lensR);
      const innerL = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), lensMat);
      innerL.position.set(-0.06, 1.36, -0.188); playerGroup.add(innerL);
      const innerR = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), lensMat);
      innerR.position.set(0.06, 1.36, -0.188); playerGroup.add(innerR);
    }
    const bridge = new THREE.Mesh(rb(0.04, 0.008, 0.005, 0.002), frameMat);
    bridge.position.set(0, 1.36, -0.19); playerGroup.add(bridge);
  }

  if (app.hat && app.hat !== 'none') {
    const hatMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    if (app.hat === 'cap') {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hatMat);
      crown.position.y = 1.5; playerGroup.add(crown);
      const visor = new THREE.Mesh(rb(0.34, 0.04, 0.18, 0.02), hatMat);
      visor.position.set(0, 1.42, -0.18); playerGroup.add(visor);
    } else if (app.hat === 'beanie') {
      const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x6b4a8a }));
      beanie.position.y = 1.45; playerGroup.add(beanie);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), new THREE.MeshLambertMaterial({ color: 0x5a3a78 }));
      cuff.position.y = 1.36; playerGroup.add(cuff);
    } else if (app.hat === 'beret') {
      const beret = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.35), new THREE.MeshLambertMaterial({ color: 0xa85b5b }));
      beret.position.y = 1.45; beret.scale.y = 0.6; playerGroup.add(beret);
      const stem = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshLambertMaterial({ color: 0xa85b5b }));
      stem.position.set(0.08, 1.55, -0.05); playerGroup.add(stem);
    } else if (app.hat === 'fedora') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.18, 16), new THREE.MeshLambertMaterial({ color: 0x4a3520 }));
      crown.position.y = 1.55; playerGroup.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), new THREE.MeshLambertMaterial({ color: 0x4a3520 }));
      brim.position.y = 1.46; playerGroup.add(brim);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.181, 0.201, 0.04, 16), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      band.position.y = 1.48; playerGroup.add(band);
    }
  }

  if (app.earring && app.earring !== 'none') {
    const earringMat = new THREE.MeshLambertMaterial({ color: 0xd4a857, metalness: 0.5 });
    if (app.earring === 'stud') {
      const stL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), earringMat);
      stL.position.set(-0.2, 1.27, 0); playerGroup.add(stL);
      const stR = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), earringMat);
      stR.position.set(0.2, 1.27, 0); playerGroup.add(stR);
    } else {
      const hpL = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12), earringMat);
      hpL.position.set(-0.2, 1.24, 0); hpL.rotation.y = Math.PI / 2; playerGroup.add(hpL);
      const hpR = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12), earringMat);
      hpR.position.set(0.2, 1.24, 0); hpR.rotation.y = Math.PI / 2; playerGroup.add(hpR);
    }
  }

  const shoeMat = new THREE.MeshLambertMaterial({ color: app.shoeColor || 0x1a1a1a });
  const sStyle = app.shoes || 'sneakers';
  const shoeY = sStyle === 'sandals' ? 0.05 : 0.06;
  const shoeH = sStyle === 'sandals' ? 0.04 : sStyle === 'boots' ? 0.18 : 0.08;
  const shoeL = new THREE.Mesh(rb(0.14, shoeH, 0.2, 0.03), shoeMat);
  shoeL.position.set(-0.08, shoeY + shoeH / 2, 0.02); shoeL.castShadow = true;
  playerGroup.add(shoeL);
  const shoeR = new THREE.Mesh(rb(0.14, shoeH, 0.2, 0.03), shoeMat);
  shoeR.position.set(0.08, shoeY + shoeH / 2, 0.02); shoeR.castShadow = true;
  playerGroup.add(shoeR);

  const heightScale = app.bodyHeight === 'tall' ? 1.1 : app.bodyHeight === 'short' ? 0.88 : 1.0;
  const widthScale = app.bodyShape === 'athletic' ? 1.15 : app.bodyShape === 'curvy' ? 1.2 : app.bodyShape === 'slim' ? 0.88 : 1.0;
  playerGroup.scale.set(widthScale, heightScale, widthScale);

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

  if (catGroup) {
    const catHits = raycaster.intersectObject(catGroup, true);
    if (catHits.length > 0) { petCat(); return; }
  }
  if (visitorGroup) {
    const visHits = raycaster.intersectObject(visitorGroup, true);
    if (visHits.length > 0) { chatVisitor(); return; }
  }

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
    raycaster.ray.intersectPlane(_floorPlane, _vec3);
    const hit = _vec3;
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
  const isNonBlocking = NON_BLOCKING_TYPES.has(def.type);
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const cx = tx + dx, cy = ty + dy;
      if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) { toast('Hors zone.'); return; }
      if (!isNonBlocking && cx === state.player.x && cy === state.player.y) { toast('Tu es dessus, déplace-toi.'); return; }
      if (DOOR_TILES.some(([d0, d1]) => d0 === cx && d1 === cy) || (FRONT_DOOR[0] === cx && FRONT_DOOR[1] === cy)) {
        if (!isNonBlocking) { toast('Pas dans une porte.'); return; }
      }
      if (grid[cy][cx] !== 0) {
        if (!isNonBlocking) { toast('Case occupée.'); return; }
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
  const d = 8.5;
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

function hasTrait(id) {
  return Array.isArray(state.appearance?.traits) && state.appearance.traits.includes(id);
}

function tick(dt) {
  const isNight = state.timeMin / 60 >= 21 || state.timeMin / 60 < 7;
  for (const k of NEED_KEYS) {
    let rate = DECAY[k];
    if (hasTrait('minimaliste')) rate *= 0.7;
    if (hasTrait('sportif') && k === 'energy') rate *= 0.7;
    if (hasTrait('casanier') && (k === 'social' || k === 'fun')) rate *= 0.5;
    if (hasTrait('noctambule') && k === 'energy') rate *= isNight ? 0.4 : 1.4;
    state.needs[k] = Math.max(0, state.needs[k] - rate * dt);
  }
  if (state.needs.hunger < 5) state.needs.fun = Math.max(0, state.needs.fun - 0.05 * dt * 60);

  let timeStep = dt / REAL_SEC_PER_GAME_MIN;
  if (state.action?.fast) timeStep *= SLEEP_SPEED;
  state.timeMin += timeStep;
  while (state.timeMin >= DAY_MIN) {
    state.timeMin -= DAY_MIN;
    state.day++;
    state.weather = rollWeather();
    applyWeatherDailyMood();
    state.bank = Math.floor(state.bank * 1.02);
    generateQuests();
    updateQuestsBadge();
    showWeatherBadge();
    toast(`📅 Jour ${state.day} · ${WEATHERS.find(w => w.id === state.weather).label}`, 3500);
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
  updateSky();
  updateFlickers();
  tickCat(dt);
  tickDust(dt);
  tickIdleAnim(dt);
  tickActionParticles(dt);
  tickVisitor(dt);
  checkRandomEvents();
  ensureWeatherParticles();
  tickWeatherParticles(dt);
  checkAchievements();

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

function updateSky() { updateSkyDome(); }

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
  const tnow = performance.now() / 1000;
  for (let i = 0; i < lampLights.length; i++) {
    const lp = lampLights[i];
    const seed = i * 13.7;
    const flick = 1 + Math.sin(tnow * 5.7 + seed) * 0.08
                    + Math.sin(tnow * 11.3 + seed * 1.7) * 0.04
                    + Math.sin(tnow * 23.1 + seed * 2.3) * 0.025;
    lp.light.intensity = lampOn * 1.6 * flick;
    if (lp.bulb && lp.bulb.material) {
      _color1.set(lp.baseColor);
      _color2.setHex(0x3a3530);
      lp.bulb.material.color.copy(_color2).lerp(_color1, lampOn).multiplyScalar(0.85 + flick * 0.15);
    }
  }

  for (const b of sunBeams) {
    b.material.opacity = dayFactor * 0.22;
  }
  if (dustParticles) {
    dustParticles.material.opacity = 0.15 + dayFactor * 0.35;
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
    if (k in state.needs) {
      let mod = v;
      if (k === 'hunger' && v > 0 && hasTrait('gourmand')) mod = Math.round(v * 1.5);
      if (k === 'social' && v > 0 && hasTrait('sociable')) mod = Math.round(v * 1.5);
      if (k === 'fun' && v > 0 && hasTrait('creatif')) mod = Math.round(v * 1.3);
      if (k === 'energy' && v > 0 && hasTrait('sportif')) mod = Math.round(v * 1.3);
      state.needs[k] = Math.max(0, Math.min(100, state.needs[k] + mod));
    }
  }
  if (a.def.money) {
    let amount = a.def.money;
    if (amount > 0 && hasTrait('travailleur') && a.key === 'work') amount = Math.round(amount * 1.5);
    if (a.key === 'work') amount = Math.round(amount * (1 + 0.15 * careerLevel(state.careerXp)));
    state.money = Math.max(0, state.money + amount);
  }
  const gains = ACTION_SKILL_GAINS[a.key];
  if (gains) {
    for (const [sk, val] of Object.entries(gains)) {
      const before = Math.floor((state.skills[sk] || 0) / 100);
      state.skills[sk] = Math.min(1000, (state.skills[sk] || 0) + val);
      const after = Math.floor(state.skills[sk] / 100);
      if (after > before) { toast(`📈 ${SKILL_ICONS[sk]} ${SKILL_LABELS[sk]} niv. ${after} !`, 2500); playSfx('levelup'); }
    }
  }
  if (a.key === 'work') {
    const lvlBefore = careerLevel(state.careerXp);
    state.careerXp += 25;
    const lvlAfter = careerLevel(state.careerXp);
    if (lvlAfter > lvlBefore) { toast(`🎉 Promotion ! ${CAREER_TITLES[lvlAfter - 1]}`, 3500); playSfx('levelup'); }
    bumpQuestStat('workSessions');
  }
  if (a.key === 'cook') bumpQuestStat('mealsCooked');
  if (a.key === 'plant') bumpQuestStat('plantWatered');
  if (a.key === 'call') bumpQuestStat('callsMade');
  if (a.key === 'tv') bumpQuestStat('tvWatched');
  if (a.key === 'shower') bumpQuestStat('showers');
  if (a.key === 'workout') bumpQuestStat('workouts');
  toast(a.def.label + ' ✓');
  spawnEmote(emoteFor(a.key));
  playSfx(a.def.money > 0 ? 'money' : 'success');
  state.action = null;
  document.getElementById('action-panel').hidden = true;
  resetPlayerPose();
  saveGame();
}

function emoteFor(key) {
  return ({
    sleep: '💤', shower: '💧', toilet: '✨', work: '💼', plant: '🌱',
    snack: '🍎', cook: '🍳', tv: '📺', relax: '☁️', call: '💬',
    read: '📖', paint: '🎨', play_guitar: '🎸', yoga: '🧘', workout: '💪',
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
  const sleepBtn = document.querySelector('[data-quick="sleep"]');
  if (sleepBtn) {
    const hasBed = state.placed?.some(p => p.type === 'bed');
    sleepBtn.setAttribute('aria-disabled', hasBed ? 'false' : 'true');
  }
}

document.querySelectorAll('.action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const quick = btn.dataset.quick;
    if (quick === 'build') { openBuildCatalog(); return; }
    if (quick === 'phone') { openPhone(); return; }
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
    resetPlayerPose();
  }
});

document.getElementById('menu-btn').addEventListener('click', openMenu);
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal').hidden = true;
});
document.getElementById('modal-x').addEventListener('click', () => {
  document.getElementById('modal').hidden = true;
});

function openMenu() {
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Statut';
  const body = document.getElementById('modal-body');
  const traits = (state.appearance?.traits || []).map(id => TRAITS.find(t => t.id === id)?.label).filter(Boolean).join(' ') || 'Aucun';
  const lvl = careerLevel(state.careerXp);
  const careerTitle = CAREER_TITLES[Math.max(0, lvl - 1)] || CAREER_TITLES[0];
  const nextThr = CAREER_THRESHOLDS[lvl] ?? CAREER_THRESHOLDS[CAREER_THRESHOLDS.length - 1];
  const careerProg = nextThr ? Math.floor((state.careerXp / nextThr) * 100) : 100;
  const skillsHtml = SKILL_KEYS.map(s => {
    const lv = Math.floor((state.skills[s] || 0) / 100);
    const pct = ((state.skills[s] || 0) % 100);
    return `<div class="row"><span>${SKILL_ICONS[s]} ${SKILL_LABELS[s]}</span><strong>Niv.${lv} <span style="color:var(--ink-soft);font-size:11px;font-weight:400">(${pct}/100)</span></strong></div>`;
  }).join('');
  body.innerHTML = `
    <div class="row"><span>Joueur</span><strong>${state.name}</strong></div>
    <div class="row"><span>Jour</span><strong>${state.day}</strong></div>
    <div class="row"><span>Heure</span><strong>${formatTime(state.timeMin)}</strong></div>
    <div class="row"><span>Argent</span><strong style="color:var(--accent)">$${Math.floor(state.money)}</strong></div>
    <div class="row"><span>Carrière</span><strong>${careerTitle} <span style="color:var(--ink-soft);font-size:11px;font-weight:400">(${state.careerXp} XP / ${nextThr})</span></strong></div>
    <div class="row"><span>Traits</span><strong style="font-size:12px">${traits}</strong></div>
    <div style="margin:14px 0 6px;font-size:11px;color:var(--accent);font-weight:700;letter-spacing:0.6px;text-transform:uppercase">Besoins</div>
    <div class="row"><span>🍽 Faim</span><strong>${Math.floor(state.needs.hunger)}%</strong></div>
    <div class="row"><span>⚡ Énergie</span><strong>${Math.floor(state.needs.energy)}%</strong></div>
    <div class="row"><span>🚿 Hygiène</span><strong>${Math.floor(state.needs.hygiene)}%</strong></div>
    <div class="row"><span>💬 Social</span><strong>${Math.floor(state.needs.social)}%</strong></div>
    <div class="row"><span>🎉 Fun</span><strong>${Math.floor(state.needs.fun)}%</strong></div>
    <div style="margin:14px 0 6px;font-size:11px;color:var(--accent);font-weight:700;letter-spacing:0.6px;text-transform:uppercase">Compétences</div>
    ${skillsHtml}
  `;
  m.hidden = false;
}

function drawCharacter2D(c, app, dir, moving, anim) {
  const skin = app.skin || '#fbc8a8';
  const hair = app.hair || '#5c3d1e';
  const shirt = app.shirt || '#5b8aaf';
  const pants = app.pants || '#3c4a5c';
  const eyeColor = app.eyeColor || '#1a1a1a';
  const style = app.hairStyle || 'short';
  const gender = app.gender || 'f';
  const top = app.top || 'tshirt';
  const bottom = app.bottom || 'pants';
  const browStyle = app.eyebrow || 'normal';
  const fh = app.facialHair || 'none';
  const glasses = app.glasses || 'none';
  const hat = app.hat || 'none';
  const earring = app.earring || 'none';
  const heightScale = app.bodyHeight === 'tall' ? 1.1 : app.bodyHeight === 'short' ? 0.88 : 1.0;
  const widthScale = app.bodyShape === 'athletic' ? 1.15 : app.bodyShape === 'curvy' ? 1.2 : app.bodyShape === 'slim' ? 0.88 : 1.0;
  c.save();
  c.scale(widthScale, heightScale);
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
  c.fillStyle = '#ffffff';
  c.fillRect(-3, by - 4, 2, 2); c.fillRect(2, by - 4, 2, 2);
  c.fillStyle = eyeColor;
  c.fillRect(-3, by - 4, 1, 1); c.fillRect(2, by - 4, 1, 1);
  if (browStyle !== 'none') {
    c.fillStyle = hair;
    const browW = browStyle === 'thick' ? 4 : browStyle === 'thin' ? 2 : 3;
    c.fillRect(-3, by - 6, browW, 1);
    c.fillRect(2, by - 6, browW, 1);
  }
  if (fh === 'mustache' || fh === 'beard') {
    c.fillStyle = hair;
    c.fillRect(-2, by - 1, 4, 1);
  }
  if (fh === 'goatee' || fh === 'beard') {
    c.fillStyle = hair;
    c.fillRect(-1, by + 1, 2, 1);
  }
  if (fh === 'beard') {
    c.fillStyle = hair;
    c.fillRect(-3, by, 6, 1);
  }
  c.fillStyle = '#d88a8a'; c.fillRect(-1, by - 1, 2, 1);
  if (glasses !== 'none') {
    c.fillStyle = glasses === 'sun' ? '#1a1a1a' : '#3a3a3a';
    c.fillRect(-4, by - 5, 3, 3);
    c.fillRect(1, by - 5, 3, 3);
    c.fillRect(-2, by - 4, 3, 1);
    if (glasses !== 'sun') {
      c.fillStyle = 'rgba(106,176,216,0.5)';
      c.fillRect(-3, by - 4, 1, 1);
      c.fillRect(2, by - 4, 1, 1);
    }
  }
  if (earring !== 'none') {
    c.fillStyle = '#d4a857';
    c.fillRect(-6, by - 1, 1, 1);
    c.fillRect(5, by - 1, 1, 1);
  }
  if (hat === 'cap') {
    c.fillStyle = '#2a2a2a';
    c.fillRect(-6, by - 11, 12, 4);
    c.fillRect(-7, by - 7, 8, 1);
  } else if (hat === 'beanie') {
    c.fillStyle = '#6b4a8a';
    c.fillRect(-6, by - 12, 12, 5);
    c.fillStyle = '#5a3a78';
    c.fillRect(-6, by - 7, 12, 1);
  } else if (hat === 'beret') {
    c.fillStyle = '#a85b5b';
    c.fillRect(-7, by - 11, 14, 4);
    c.fillRect(4, by - 13, 2, 2);
  } else if (hat === 'fedora') {
    c.fillStyle = '#4a3520';
    c.fillRect(-5, by - 13, 10, 5);
    c.fillRect(-8, by - 8, 16, 2);
    c.fillStyle = '#1a1a1a';
    c.fillRect(-5, by - 9, 10, 1);
  }
  c.restore();
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
buildTraitsPicker();
drawPreview();

function buildTraitsPicker() {
  const container = document.getElementById('traits-picker');
  if (!container) return;
  container.innerHTML = '';
  for (const tr of TRAITS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trait-btn';
    btn.dataset.id = tr.id;
    btn.innerHTML = `<span class="trait-label">${tr.label}</span><span class="trait-desc">${tr.desc}</span>`;
    btn.addEventListener('click', () => toggleTrait(tr.id));
    container.appendChild(btn);
  }
  refreshTraits();
}

function toggleTrait(id) {
  pendingAppearance.traits = pendingAppearance.traits || [];
  const idx = pendingAppearance.traits.indexOf(id);
  if (idx >= 0) pendingAppearance.traits.splice(idx, 1);
  else if (pendingAppearance.traits.length < 2) pendingAppearance.traits.push(id);
  else { return; }
  refreshTraits();
}

function refreshTraits() {
  document.querySelectorAll('.trait-btn').forEach(b => {
    const sel = (pendingAppearance.traits || []).includes(b.dataset.id);
    b.classList.toggle('selected', sel);
    const full = (pendingAppearance.traits || []).length >= 2;
    b.classList.toggle('disabled', !sel && full);
  });
}

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
const randomBtn = document.getElementById('random-btn');
if (randomBtn) randomBtn.addEventListener('click', () => {
  const pickRand = arr => arr[Math.floor(Math.random() * arr.length)];
  for (const [key, options] of Object.entries(APPEARANCE_PALETTES)) {
    if (typeof options[0] === 'object') pendingAppearance[key] = pickRand(options).id;
    else pendingAppearance[key] = pickRand(options);
  }
  pendingAppearance.traits = [];
  const traitIds = TRAITS.map(t => t.id).sort(() => Math.random() - 0.5).slice(0, 2);
  pendingAppearance.traits = traitIds;
  refreshPickers();
  refreshTraits();
  drawPreview();
});

function startGame() {
  bootEl.hidden = true;
  gameEl.hidden = false;
  init3D();
  updateHUD();
  if (!state.quests || state.quests.length === 0) generateQuests();
  if (!state.weather) state.weather = rollWeather();
  updateQuestsBadge();
  document.getElementById('quests-fab')?.addEventListener('click', openQuests);
  showWeatherBadge();
  requestAnimationFrame(loop);
  if (state.tutorial) {
    setTimeout(() => toast(`👋 Bienvenue ${state.name} ! Ton appart est vide — tape 🔨 Construire pour acheter ton mobilier.`, 6000), 600);
    setTimeout(() => toast(`💡 Achète au minimum un Lit, un Frigo, des WC et une Douche.`, 5000), 7500);
    setTimeout(() => toast(`📱 Tape Tél. pour ouvrir ton smartphone (banque, livraison, amis)`, 5000), 13000);
    setTimeout(() => { state.tutorial = false; saveGame(); }, 19000);
  }
}

function showWeatherBadge() {
  let el = document.querySelector('.weather-badge');
  if (!el) {
    el = document.createElement('div');
    el.className = 'weather-badge';
    document.body.appendChild(el);
  }
  const w = WEATHERS.find(w => w.id === state.weather);
  el.textContent = w ? w.label : '';
}

document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
window.addEventListener('beforeunload', saveGame);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
