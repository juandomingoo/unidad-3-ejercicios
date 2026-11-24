import * as THREE from "three";
import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/vision_bundle.mjs";

/* =====================================================================
   CONFIGURACIÓN
   ===================================================================== */
const MP_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

const CFG = {
  walkSpeed: 6.5,
  sprintMult: 1.6,
  backMult: 0.55,
  turnSpeed: 2.6,       // rad/s con la mano en el borde
  jumpSpeed: 7.5,
  gravity: 22,
  deadZone: 0.13,       // zona central del joystick de mano
  worldRadius: 180,
  crystalCount: 8,
  safeRadius: 9,        // santuario: los enemigos no entran
  gestureFrames: 3,
  camDist: 7.5,
  camHeight: 3.6,
  maxEnemies: 22,
  waveEvery: 30,
  energyMax: 100,
};

/* =====================================================================
   DATOS: razas, clases, apariencia (fantasía original)
   ===================================================================== */
const RACES = {
  humano: {
    nombre: "Humano", icono: "🛡️",
    desc: "Versátiles y tenaces, defienden las tierras del oeste.",
    bonusTxt: "+25% regeneración de energía",
    bonus: { energyRegen: 1.25 },
    scale: [1, 1, 1], ears: "normal",
    skins: ["#f1c9a0", "#e0ac69", "#c68642", "#8d5524", "#ffdbc0"],
  },
  enano: {
    nombre: "Enano", icono: "⚒️",
    desc: "Robustos hijos de la montaña, forjadores incansables.",
    bonusTxt: "+30 de vida máxima",
    bonus: { hp: 30 },
    scale: [1.28, 0.76, 1.22], ears: "normal", longBeard: true,
    skins: ["#f0c5a0", "#d9a27a", "#b97a56", "#8a5a3c", "#c9b8a8"],
  },
  elfo: {
    nombre: "Elfo", icono: "🌙",
    desc: "Ágiles centinelas de los bosques antiguos.",
    bonusTxt: "+12% velocidad de movimiento",
    bonus: { speed: 1.12 },
    scale: [0.9, 1.12, 0.9], ears: "long", glowEyes: "#e9dcff",
    skins: ["#f5dccb", "#c9b3e6", "#9f8fd6", "#e8cfa0", "#b7d0ea"],
  },
  orco: {
    nombre: "Orco", icono: "🪓",
    desc: "Guerreros de las estepas rojas, forjados en batalla.",
    bonusTxt: "+15% daño",
    bonus: { dmg: 1.15 },
    scale: [1.3, 1.08, 1.25], ears: "normal", tusks: true,
    skins: ["#6b8e23", "#4f7a28", "#7d9a3a", "#8a6f4e", "#5c6b3a"],
  },
  nomuerto: {
    nombre: "No-muerto", icono: "💀",
    desc: "Regresaron de la tumba con voluntad propia.",
    bonusTxt: "Regenera 2 de vida por segundo",
    bonus: { regen: 2 },
    scale: [0.86, 1.0, 0.86], ears: "normal", glowEyes: "#7df9ff", gaunt: true,
    skins: ["#a3b5a0", "#8fa3a8", "#b8b0a0", "#9aa59a", "#c2bfd0"],
  },
};

const CLASSES = {
  guerrero: {
    nombre: "Guerrero", icono: "⚔️", color: "#c79c6e",
    desc: "Maestro del combate cuerpo a cuerpo. Resiste en primera línea.",
    hp: 165, recurso: "Ira", recursoColor: "#d33",
    weapon: "espada", shield: true, pauldrons: "spiked", trim: "#a7b0ba",
    attack: { tipo: "melee", nombre: "Tajo", icon: "🗡️", dmg: 22, range: 3.0, cd: 0.6 },
    special: { id: "torbellino", nombre: "Torbellino", icon: "🌀", cost: 40, cd: 4, desc: "Gira y golpea a todos a tu alrededor" },
  },
  mago: {
    nombre: "Mago", icono: "🔮", color: "#69ccf0",
    desc: "Domina las artes arcanas y ataca a distancia.",
    hp: 100, recurso: "Maná", recursoColor: "#3b82f6",
    weapon: "baculo", robe: true, pauldrons: "round", trim: "#d9b54a",
    attack: { tipo: "ranged", nombre: "Proyectil arcano", icon: "✨", dmg: 20, speed: 24, cd: 0.7, color: 0xb18cff },
    special: { id: "nova", nombre: "Nova de escarcha", icon: "❄️", cost: 40, cd: 5, desc: "Daña y ralentiza a los enemigos cercanos" },
  },
  cazador: {
    nombre: "Cazador", icono: "🏹", color: "#abd473",
    desc: "Rastreador experto con el arco. Rápido y letal.",
    hp: 120, recurso: "Concentración", recursoColor: "#e8a33d",
    weapon: "arco", pauldrons: "none", trim: "#7a5230",
    attack: { tipo: "ranged", nombre: "Disparo", icon: "➶", dmg: 15, speed: 34, cd: 0.45, color: 0xffe08a, arrow: true },
    special: { id: "multidisparo", nombre: "Descarga múltiple", icon: "🎯", cost: 35, cd: 3.5, desc: "Dispara un abanico de 7 flechas" },
  },
  paladin: {
    nombre: "Paladín", icono: "☀️", color: "#f58cba",
    desc: "Guerrero sagrado que golpea y sana con la luz.",
    hp: 150, recurso: "Maná", recursoColor: "#3b82f6",
    weapon: "maza", shield: true, pauldrons: "round", trim: "#e6c068",
    attack: { tipo: "melee", nombre: "Golpe sagrado", icon: "🔨", dmg: 19, range: 2.8, cd: 0.65 },
    special: { id: "luz", nombre: "Luz sagrada", icon: "🌟", cost: 45, cd: 6, desc: "Te cura y quema a los enemigos cercanos" },
  },
};

const HAIR_STYLES = [["calvo", "Calvo"], ["corto", "Corto"], ["largo", "Largo"], ["cresta", "Cresta"], ["coleta", "Coleta"]];
const HAIR_COLORS = ["#2b1b10", "#5a3a1e", "#a0522d", "#d9b36c", "#ece6d6", "#1c1c1c", "#b03a2e", "#4b6fd6"];
const ARMOR_COLORS = [["#8b1e1e", "Carmesí"], ["#1f3f8f", "Azul real"], ["#2f5d34", "Bosque"], ["#5b2d82", "Arcano"], ["#2e2e33", "Acero negro"], ["#9a7b2c", "Dorado"]];

const NOMBRES_A = ["Thal", "Bran", "Kor", "Ael", "Gro", "Mor", "Syl", "Dun", "Vor", "Ely", "Rag", "Fen", "Ori", "Zul", "Lia"];
const NOMBRES_B = ["dar", "wen", "gash", "thas", "mir", "rin", "vash", "dor", "nia", "grim", "lor", "kan", "wyn", "zar"];
const randomName = () => {
  const a = NOMBRES_A[Math.floor(Math.random() * NOMBRES_A.length)];
  const b = NOMBRES_B[Math.floor(Math.random() * NOMBRES_B.length)];
  return a + b;
};

/* =====================================================================
   UTILIDADES
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const rand = rng(42);
const rnd = (a, b) => a + Math.random() * (b - a);

let toastTimer, bigToastTimer;
function toast(msg, ms = 2200) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}
function bigToast(msg, ms = 2200) {
  const el = $("bigToast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(bigToastTimer);
  bigToastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

/* =====================================================================
   RENDERIZADOR, ESCENAS Y CÁMARAS
   ===================================================================== */
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe8ff, 35, 230);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);

const creatorScene = new THREE.Scene();
const creatorCam = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);

window.addEventListener("resize", () => {
  for (const c of [camera, creatorCam]) { c.aspect = window.innerWidth / window.innerHeight; c.updateProjectionMatrix(); }
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameCreatorCamera();
});

let mode = "creator"; // creator | game | paused | end
/* =====================================================================
   MUNDO: terreno, cielo, bosque, santuario, cristales
   ===================================================================== */
function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const flat = smoothstep(16, 45, d);
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.04) * 4 +
    Math.sin(x * 0.011 + z * 0.017) * 9 +
    Math.cos(z * 0.07 + x * 0.02) * 1.5;
  const mountains = d > 150 ? Math.pow(d - 150, 1.35) * 0.4 : 0;
  return hills * flat + mountains;
}

{
  const size = 460, seg = 230;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const low = new THREE.Color(0x3d7a35), high = new THREE.Color(0x8fb35a), rock = new THREE.Color(0x8a8278), path = new THREE.Color(0x9c8a64), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    c.copy(low).lerp(high, clamp((y + 8) / 20, 0, 1));
    if (y > 22) c.lerp(rock, clamp((y - 22) / 15, 0, 1));
    const d = Math.hypot(x, z);
    if (d < 13) c.lerp(path, 0.75 * (1 - smoothstep(9, 13, d))); // plaza del santuario
    const n = 0.92 + rand() * 0.16;
    colors.set([c.r * n, c.g * n, c.b * n], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// ---------- Cielo ----------
const skyUniforms = { topColor: { value: new THREE.Color(0x3b82d6) }, bottomColor: { value: new THREE.Color(0xcfe8ff) } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPos;
      void main(){ float h = clamp(vPos.y * 1.6 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.8)), 1.0); }`,
  })
);
scene.add(sky);

const stars = (() => {
  const n = 1500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(rand() * 0.95);
    p.set([Math.sin(ph) * Math.cos(th) * 800, Math.cos(ph) * 800, Math.sin(ph) * Math.sin(th) * 800], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(s);
  return s;
})();

const hemi = new THREE.HemisphereLight(0xdbeafe, 0x3d5a2a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 250 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff7d1, fog: false }));
scene.add(moonGlow);

// ---------- Bosque y rocas ----------
const trees = []; // para colisiones {x, z, r}
{
  const count = 380;
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6); trunkGeo.translate(0, 1.2, 0);
  const crownGeo = new THREE.ConeGeometry(1.8, 4.8, 7); crownGeo.translate(0, 4.6, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2f, flatShading: true }), count);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let placed = 0;
  while (placed < count) {
    const x = (rand() - 0.5) * 360, z = (rand() - 0.5) * 360, d = Math.hypot(x, z);
    if (d < 24 || d > 175) continue;
    const k = 0.7 + rand() * 0.9;
    p.set(x, terrainHeight(x, z) - 0.2, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    s.set(k, k * (0.85 + rand() * 0.4), k);
    m.compose(p, q, s);
    trunks.setMatrixAt(placed, m);
    crowns.setMatrixAt(placed, m);
    col.setHSL(0.27 + rand() * 0.08, 0.45 + rand() * 0.2, 0.22 + rand() * 0.12);
    crowns.setColorAt(placed, col);
    trees.push({ x, z, r: 0.45 * k + 0.35 });
    placed++;
  }
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns);

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8b8680, flatShading: true }), 120);
  for (let i = 0; i < 120; i++) {
    const a = rand() * Math.PI * 2, r = 20 + rand() * 150;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, k = 0.4 + rand() * 1.6;
    p.set(x, terrainHeight(x, z), z);
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    s.set(k, k * 0.7, k);
    m.compose(p, q, s);
    rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);
}

// ---------- Santuario ----------
const shrine = new THREE.Group();
{
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8b2a7, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.8, 10), stone);
  base.position.y = 0.4; base.castShadow = base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 10), stone);
  top.position.y = 1.05; top.castShadow = true;
  shrine.add(base, top);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), stone);
    pil.position.set(Math.cos(a) * 7.2, 2.25, Math.sin(a) * 7.2);
    pil.castShadow = true;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1 }));
    cap.position.set(pil.position.x, 4.85, pil.position.z);
    shrine.add(pil, cap);
  }
}
const ringMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.2 });
const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 12, 64), ringMat);
ring.position.y = 3.2;
shrine.add(ring);
const shrineLight = new THREE.PointLight(0x67e8f9, 15, 30, 1.5);
shrineLight.position.y = 3.5;
shrine.add(shrineLight);
// Círculo de la zona segura
const safeRing = new THREE.Mesh(
  new THREE.RingGeometry(CFG.safeRadius - 0.25, CFG.safeRadius, 72),
  new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
);
safeRing.rotation.x = -Math.PI / 2;
safeRing.position.y = 0.06;
shrine.add(safeRing);
scene.add(shrine);

// ---------- Cristales ----------
const crystals = [];
{
  const palette = [0xf472b6, 0xa78bfa, 0x60a5fa, 0x34d399, 0xfacc15, 0xfb923c, 0xf87171, 0x22d3ee];
  const geo = new THREE.OctahedronGeometry(0.75, 0);
  geo.scale(1, 1.6, 1);
  for (let i = 0; i < CFG.crystalCount; i++) {
    const a = (i / CFG.crystalCount) * Math.PI * 2 + rand() * 0.5;
    const r = 30 + (i % 4) * 14 + rand() * 8; // distancias crecientes
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const color = palette[i % palette.length];
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.2, flatShading: true }));
    mesh.castShadow = true;
    const beam = new THREE.Mesh( // haz de luz para verlos desde lejos
      new THREE.CylinderGeometry(0.15, 0.6, 30, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beam.position.y = 15;
    mesh.add(beam);
    mesh.userData = { home: new THREE.Vector3(x, terrainHeight(x, z) + 1.6, z), phase: rand() * 10, state: "free", orbit: 0, beam, color };
    scene.add(mesh);
    crystals.push(mesh);
  }
}
function resetCrystals() {
  crystals.forEach((c) => {
    c.position.copy(c.userData.home);
    c.userData.state = "free";
    c.userData.beam.visible = true;
    c.scale.setScalar(1);
  });
  ringMat.emissive.set(0x22d3ee);
}
resetCrystals();

// ---------- Luciérnagas ----------
const fireflies = (() => {
  const n = 450, p = new Float32Array(n * 3), seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = 8 + rand() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r;
    p.set([x, terrainHeight(x, z) + 0.5 + rand() * 4, z], i * 3);
    seeds[i] = rand() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const cx = c.getContext("2d"), grd = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.3, "rgba(255,255,255,.8)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = grd; cx.fillRect(0, 0, 64, 64);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color: 0xfff3a0, size: 0.5, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.userData = { base: p.slice(), seeds };
  scene.add(pts);
  return pts;
})();

// ---------- Día / noche ----------
const DAY = { top: new THREE.Color(0x3b82d6), bottom: new THREE.Color(0xcfe8ff), sun: 2.4, hemi: 1.0, exp: 1.0 };
const NIGHT = { top: new THREE.Color(0x030614), bottom: new THREE.Color(0x141c36), sun: 0.15, hemi: 0.22, exp: 1.15 };
const nightTint = new THREE.Color(0x7083c4);
let night = 0, nightTarget = 0;
function applyTime(t) {
  skyUniforms.topColor.value.copy(DAY.top).lerp(NIGHT.top, t);
  skyUniforms.bottomColor.value.copy(DAY.bottom).lerp(NIGHT.bottom, t);
  scene.fog.color.copy(skyUniforms.bottomColor.value);
  sun.intensity = lerp(DAY.sun, NIGHT.sun, t);
  sun.color.setHSL(lerp(0.1, 0.62, t), lerp(0.6, 0.4, t), lerp(0.9, 0.8, t));
  hemi.intensity = lerp(DAY.hemi, NIGHT.hemi, t);
  hemi.color.set(0xdbeafe).lerp(nightTint, t);
  renderer.toneMappingExposure = lerp(DAY.exp, NIGHT.exp, t);
  stars.material.opacity = t;
  fireflies.material.opacity = lerp(0.15, 1, t);
  shrineLight.intensity = lerp(12, 40, t);
}
function toggleNight() {
  nightTarget = nightTarget > 0.5 ? 0 : 1;
  toast(nightTarget ? "🌙 Cae la noche: los enemigos son más fieros" : "☀️ Amanece");
}

function updateWorldVisuals(t, dt, center) {
  ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.2;
  ring.rotation.z += dt * 0.8;
  safeRing.material.opacity = 0.35 + Math.sin(t * 2) * 0.15;

  const pos = fireflies.geometry.attributes.position, base = fireflies.userData.base, seeds = fireflies.userData.seeds;
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    pos.array[i * 3] = base[i * 3] + Math.sin(t * 0.5 + s) * 1.2;
    pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.9 + s * 2) * 0.6;
    pos.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.4 + s) * 1.2;
  }
  pos.needsUpdate = true;

  night = lerp(night, nightTarget, 1 - Math.exp(-1.5 * dt));
  applyTime(night);

  sun.position.set(center.x + 50, 80, center.z + 25);
  sun.target.position.set(center.x, 0, center.z);
  moonGlow.position.set(center.x - 400, 380, center.z - 500);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
}
/* =====================================================================
   PERSONAJES: constructor de humanoides low-poly y animación
   ===================================================================== */
function buildHumanoid(o) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.set(...(o.scale || [1, 1, 1]));
  root.add(body);
  const mats = [];
  const M = (c, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75, ...extra }); mats.push(m); return m; };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; return mesh;
  };

  const skin = M(o.skin);
  const armor = M(o.armor, { metalness: 0.35, roughness: 0.5 });
  const trim = M(o.trim || "#c9a43a", { metalness: 0.75, roughness: 0.35 });
  const leather = M("#4a3b2c");
  const dark = M("#2a1d14");

  // --- Piernas
  const mkLeg = (x) => {
    const g = new THREE.Group(); g.position.set(x, 0.95, 0);
    g.add(box(0.24, 0.56, 0.26, o.robe ? armor : leather, 0, -0.28, 0));
    g.add(box(0.27, 0.42, 0.32, dark, 0, -0.73, 0.03));
    body.add(g); return g;
  };
  const legL = mkLeg(-0.15), legR = mkLeg(0.15);

  // --- Torso
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
  const chest = box(0.62, 0.72, 0.36, armor, 0, 0.4, 0);
  if (o.gaunt) chest.scale.set(0.9, 1, 0.85);
  torso.add(chest);
  torso.add(box(0.66, 0.1, 0.4, leather, 0, 0.06, 0));
  torso.add(box(0.14, 0.12, 0.05, trim, 0, 0.06, 0.21));
  torso.add(box(0.2, 0.2, 0.04, trim, 0, 0.5, 0.19));
  if (o.robe) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.5, 0.8, 8), armor);
    skirt.position.y = -0.35; skirt.castShadow = true; torso.add(skirt);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.52, 0.06, 8), trim);
    hem.position.y = -0.74; torso.add(hem);
  }

  // --- Hombreras (estilo fantasía exagerado)
  if (o.pauldrons && o.pauldrons !== "none") {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), armor);
      p.scale.set(1.25, 0.95, 1.15); p.position.set(s * 0.43, 0.7, 0); p.castShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 5, 12), trim);
      rim.rotation.x = Math.PI / 2; rim.scale.set(1.25, 1.15, 1); rim.position.set(s * 0.43, 0.7, 0);
      torso.add(p, rim);
      if (o.pauldrons === "spiked") {
        for (const dz of [-0.1, 0.1]) {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 5), trim);
          sp.position.set(s * 0.48, 0.98, dz); sp.rotation.z = -s * 0.35; sp.castShadow = true;
          torso.add(sp);
        }
      }
    }
  }

  // --- Brazos
  const mkArm = (s) => {
    const g = new THREE.Group(); g.position.set(s * 0.42, 0.66, 0);
    g.add(box(0.18, 0.62, 0.2, o.robe ? armor : skin, 0, -0.3, 0));
    g.add(box(0.2, 0.18, 0.22, o.robe ? trim : leather, 0, -0.52, 0)); // brazal
    g.add(box(0.16, 0.16, 0.16, skin, 0, -0.68, 0));
    const grip = new THREE.Group(); grip.position.set(0, -0.68, 0); g.add(grip);
    torso.add(g); return { g, grip };
  };
  const L = mkArm(-1), R = mkArm(1);

  // --- Cabeza
  const head = new THREE.Group(); head.position.y = 0.76; torso.add(head);
  head.add(box(0.2, 0.12, 0.2, skin, 0, 0.04, 0));
  const skull = box(0.42, 0.44, 0.4, skin, 0, 0.3, 0);
  if (o.gaunt) skull.scale.set(0.9, 1.02, 0.95);
  head.add(skull);
  head.add(box(0.07, 0.1, 0.07, skin, 0, 0.27, 0.22));
  const eyeMat = o.glowEyes ? M(o.glowEyes, { emissive: o.glowEyes, emissiveIntensity: 2.2 }) : M("#151515");
  for (const s of [-1, 1]) head.add(box(0.09, 0.05, 0.03, eyeMat, s * 0.1, 0.35, 0.205));
  // cejas
  const hairMat = M(o.hairColor || "#3b2414");
  for (const s of [-1, 1]) head.add(box(0.12, 0.03, 0.03, hairMat, s * 0.1, 0.4, 0.21));

  if (o.ears === "long" || o.ears === "big") {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(o.ears === "big" ? 0.1 : 0.06, o.ears === "big" ? 0.38 : 0.45, 4), skin);
      ear.position.set(s * 0.3, 0.36, -0.02);
      ear.rotation.z = -s * (o.ears === "big" ? 1.45 : 1.1);
      ear.rotation.x = -0.25;
      ear.castShadow = true; head.add(ear);
    }
  } else {
    for (const s of [-1, 1]) head.add(box(0.06, 0.12, 0.1, skin, s * 0.23, 0.3, 0));
  }
  if (o.tusks) {
    const tm = M("#f3ecd8");
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), tm);
      t.position.set(s * 0.11, 0.18, 0.21); head.add(t);
    }
  }
  // Pelo
  switch (o.hair) {
    case "corto":
      head.add(box(0.46, 0.13, 0.44, hairMat, 0, 0.56, -0.01), box(0.46, 0.26, 0.08, hairMat, 0, 0.42, -0.2));
      break;
    case "largo":
      head.add(box(0.46, 0.13, 0.44, hairMat, 0, 0.56, -0.01), box(0.46, 0.7, 0.1, hairMat, 0, 0.22, -0.22));
      for (const s of [-1, 1]) head.add(box(0.06, 0.45, 0.3, hairMat, s * 0.24, 0.3, -0.06));
      break;
    case "cresta":
      head.add(box(0.1, 0.26, 0.48, hairMat, 0, 0.62, -0.02));
      break;
    case "coleta": {
      head.add(box(0.46, 0.13, 0.44, hairMat, 0, 0.56, -0.01));
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.6, 6), hairMat);
      tail.position.set(0, 0.3, -0.32); tail.rotation.x = 0.45; tail.castShadow = true; head.add(tail);
      break;
    }
  }
  if (o.beard) {
    if (o.longBeard) head.add(box(0.42, 0.5, 0.12, hairMat, 0, 0.02, 0.2));
    else head.add(box(0.38, 0.2, 0.1, hairMat, 0, 0.14, 0.2));
    head.add(box(0.3, 0.05, 0.06, hairMat, 0, 0.23, 0.23));
  }
  if (o.hood) {
    head.add(box(0.5, 0.52, 0.48, armor, 0, 0.33, -0.03));
    head.add(box(0.36, 0.3, 0.05, M("#0b0b0b"), 0, 0.3, 0.2)); // sombra del rostro
    const ey = M(o.glowEyes || "#ff3b30", { emissive: o.glowEyes || "#ff3b30", emissiveIntensity: 2.5 });
    for (const s of [-1, 1]) head.add(box(0.07, 0.04, 0.02, ey, s * 0.08, 0.33, 0.23));
  }

  // --- Capa
  let cape = null;
  if (o.cape) {
    cape = new THREE.Group(); cape.position.set(0, 0.72, -0.2); torso.add(cape);
    const cm = M(o.cape, { side: THREE.DoubleSide });
    cape.add(box(0.64, 1.25, 0.03, cm, 0, -0.62, 0));
  }

  // --- Armas
  let orb = null;
  const metal = M("#d8dde3", { metalness: 0.9, roughness: 0.2 });
  switch (o.weapon) {
    case "espada": {
      const w = new THREE.Group(); w.rotation.x = Math.PI / 2; R.grip.add(w);
      w.add(box(0.08, 1.0, 0.03, metal, 0, 0.62, 0), box(0.32, 0.07, 0.09, trim, 0, 0.1, 0), box(0.05, 0.2, 0.05, dark, 0, -0.02, 0), box(0.08, 0.08, 0.08, trim, 0, -0.14, 0));
      break;
    }
    case "maza": {
      const w = new THREE.Group(); w.rotation.x = Math.PI / 2; R.grip.add(w);
      w.add(box(0.06, 0.7, 0.06, dark, 0, 0.25, 0));
      const h = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17), trim); h.position.y = 0.66; h.castShadow = true; w.add(h);
      break;
    }
    case "daga": {
      const w = new THREE.Group(); w.rotation.x = Math.PI / 2; R.grip.add(w);
      w.add(box(0.06, 0.4, 0.02, metal, 0, 0.26, 0), box(0.16, 0.04, 0.05, dark, 0, 0.05, 0));
      break;
    }
    case "baculo":
    case "baculoChaman": {
      const w = new THREE.Group(); R.grip.add(w);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.8, 6), dark);
      shaft.position.y = 0.25; shaft.castShadow = true; w.add(shaft);
      const oc = o.weapon === "baculo" ? "#b18cff" : "#ff5a1f";
      orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), M(oc, { emissive: oc, emissiveIntensity: 2 }));
      orb.position.y = 1.25; w.add(orb);
      for (let i = 0; i < 3; i++) {
        const prong = box(0.03, 0.22, 0.03, trim, Math.cos(i * 2.1) * 0.1, 1.15, Math.sin(i * 2.1) * 0.1);
        prong.rotation.z = Math.cos(i * 2.1) * 0.4; w.add(prong);
      }
      break;
    }
    case "arco": {
      const w = new THREE.Group(); L.grip.add(w);
      const wood = M("#6b4423");
      const up = box(0.05, 0.6, 0.05, wood, 0, 0.3, 0.1); up.rotation.x = -0.35;
      const dn = box(0.05, 0.6, 0.05, wood, 0, -0.3, 0.1); dn.rotation.x = 0.35;
      w.add(up, dn, box(0.07, 0.18, 0.07, leather, 0, 0, 0), box(0.012, 1.12, 0.012, M("#e8e2cf"), 0, 0, -0.02));
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.6, 6), leather);
      quiver.position.set(0.15, 0.45, -0.24); quiver.rotation.z = -0.4; quiver.castShadow = true; torso.add(quiver);
      break;
    }
  }
  if (o.shield) {
    const sh = new THREE.Group(); sh.position.set(-0.13, -0.38, 0.06); L.g.add(sh);
    sh.add(box(0.07, 0.62, 0.5, armor, 0, 0, 0), box(0.08, 0.66, 0.06, trim, 0, 0, 0.24), box(0.08, 0.66, 0.06, trim, 0, 0, -0.24),
      box(0.08, 0.06, 0.52, trim, 0, 0.3, 0), box(0.08, 0.06, 0.52, trim, 0, -0.3, 0), box(0.09, 0.18, 0.18, trim, -0.02, 0, 0));
  }

  const height = 2.05 * (o.scale ? o.scale[1] : 1);
  return { root, body, legL, legR, armL: L.g, armR: R.g, torso, head, cape, orb, mats, height, phase: 0 };
}

function buildGolem() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mats = [];
  const M = (c, e = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, ...e }); mats.push(m); return m; };
  const stone = M("#4b4458"), core = M("#c026d3", { emissive: "#c026d3", emissiveIntensity: 2.2 });
  const rock = (r, x, y, z, parent, m = stone) => { const d = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), m); d.position.set(x, y, z); d.castShadow = true; parent.add(d); return d; };
  const mkLeg = (x) => { const g = new THREE.Group(); g.position.set(x, 1.0, 0); rock(0.38, 0, -0.35, 0, g); rock(0.34, 0, -0.8, 0.05, g); body.add(g); return g; };
  const legL = mkLeg(-0.45), legR = mkLeg(0.45);
  const torso = new THREE.Group(); torso.position.y = 1.0; body.add(torso);
  const ch = rock(0.85, 0, 0.75, 0, torso); ch.scale.set(1.2, 1, 0.9);
  rock(0.22, 0, 0.8, 0.62, torso, core);
  const head = new THREE.Group(); head.position.y = 1.55; torso.add(head);
  rock(0.38, 0, 0.1, 0.12, head);
  const eye = M("#f0abfc", { emissive: "#f0abfc", emissiveIntensity: 3 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), eye); e.position.set(s * 0.13, 0.15, 0.45); head.add(e); }
  const mkArm = (s) => { const g = new THREE.Group(); g.position.set(s * 1.05, 1.15, 0); rock(0.42, 0, -0.1, 0, g); rock(0.36, 0, -0.65, 0, g); rock(0.45, 0, -1.15, 0.05, g); torso.add(g); return g; };
  const armL = mkArm(-1), armR = mkArm(1);
  return { root, body, legL, legR, armL, armR, torso, head, cape: null, orb: null, mats, height: 3.4, phase: 0 };
}

// Animación procedimental: caminar, saltar, atacar, lanzar
function animateHumanoid(ch, a, t, dt) {
  const mv = clamp(Math.abs(a.move), 0, 1);
  ch.phase += dt * (4 + 7 * mv) * (mv > 0.05 ? 1 : 0);
  const sw = Math.sin(ch.phase) * 0.75 * mv;
  ch.legL.rotation.x = sw;
  ch.legR.rotation.x = -sw;
  let aL = -sw * 0.6, aR = sw * 0.6;
  if (a.air) { ch.legL.rotation.x = -0.6; ch.legR.rotation.x = 0.35; aL = aR = -0.5; }

  if (a.attack >= 0) {
    const p = a.attack;
    if (a.ranged) {
      aR = -1.45; if (a.bow) aL = -1.5;
    } else {
      aR = p < 0.35 ? lerp(0, -2.6, p / 0.35) : lerp(-2.6, 0.5, (p - 0.35) / 0.65);
    }
  }
  if (a.cast >= 0) { aR = -2.6; aL = -2.6; }
  ch.armL.rotation.x = lerp(ch.armL.rotation.x, aL, 0.35);
  ch.armR.rotation.x = a.attack >= 0 && !a.ranged ? aR : lerp(ch.armR.rotation.x, aR, 0.35);
  ch.armR.rotation.z = a.attack >= 0 && !a.ranged ? -0.25 : 0;
  ch.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
  ch.torso.position.y = 0.95 + (mv > 0.05 && !a.air ? Math.abs(Math.cos(ch.phase)) * 0.05 : 0);
  if (ch.cape) ch.cape.rotation.x = 0.12 + mv * 0.55 + Math.sin(t * 3 + ch.phase) * 0.06 + (a.air ? 0.4 : 0);
  if (ch.orb) ch.orb.rotation.y += dt * 3;
}

function flashChar(ch, amount) {
  for (const m of ch.mats) {
    if (!m.userData.baseEmissive) m.userData.baseEmissive = { c: m.emissive.clone(), i: m.emissiveIntensity };
    if (amount > 0) { m.emissive.setRGB(1, 0.15, 0.1); m.emissiveIntensity = amount; }
    else { m.emissive.copy(m.userData.baseEmissive.c); m.emissiveIntensity = m.userData.baseEmissive.i; }
  }
}
function tintChar(ch, color, amount) {
  for (const m of ch.mats) {
    if (!m.userData.baseEmissive) m.userData.baseEmissive = { c: m.emissive.clone(), i: m.emissiveIntensity };
    m.emissive.set(color); m.emissiveIntensity = amount;
  }
}
function disposeChar(ch) {
  ch.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  ch.mats.forEach((m) => m.dispose());
}

/* =====================================================================
   ENEMIGOS
   ===================================================================== */
const ENEMY_TYPES = {
  trasgo: {
    nombre: "Trasgo saqueador", hp: 45, speed: 5.0, dmg: 8, range: 1.8, cd: 1.0, xp: 12, radius: 0.6,
    build: () => buildHumanoid({ skin: "#8f9a3c", armor: "#5a3d2b", trim: "#6b6b6b", hair: "cresta", hairColor: "#1c1c1c", ears: "big",
      glowEyes: "#ff3b30", weapon: "daga", scale: [0.85, 0.72, 0.85] }),
  },
  chaman: {
    nombre: "Chamán de la ceniza", hp: 55, speed: 4.0, dmg: 11, range: 15, cd: 2.4, xp: 20, ranged: true, radius: 0.6,
    build: () => buildHumanoid({ skin: "#7c8a36", armor: "#4b1f5c", trim: "#b45309", hair: "calvo", ears: "big", hood: true,
      glowEyes: "#ff7a1f", weapon: "baculoChaman", robe: true, scale: [0.9, 0.82, 0.9] }),
  },
  golem: {
    nombre: "Gólem de sombra", hp: 170, speed: 2.8, dmg: 22, range: 2.6, cd: 1.8, xp: 40, radius: 1.3,
    build: () => buildGolem(),
  },
};
/* =====================================================================
   CREACIÓN DE PERSONAJE
   ===================================================================== */
const custom = {
  name: randomName(), race: "humano", cls: "guerrero",
  skin: 0, hair: 1, hairColor: 1, beard: false, armor: 0, cape: true,
};

function charOptions(c) {
  const race = RACES[c.race], cls = CLASSES[c.cls];
  const armor = ARMOR_COLORS[c.armor][0];
  const capeColor = new THREE.Color(armor).multiplyScalar(0.7).getStyle();
  return {
    skin: race.skins[c.skin % race.skins.length],
    armor, trim: cls.trim,
    hair: HAIR_STYLES[c.hair][0], hairColor: HAIR_COLORS[c.hairColor],
    beard: c.beard, longBeard: race.longBeard,
    ears: race.ears, tusks: race.tusks, glowEyes: race.glowEyes, gaunt: race.gaunt,
    pauldrons: cls.pauldrons, robe: cls.robe, weapon: cls.weapon, shield: cls.shield,
    cape: c.cape ? capeColor : null,
    scale: race.scale,
  };
}

// --- Escenario 3D de la creación
{
  creatorScene.background = new THREE.Color(0x0b0806);
  creatorScene.fog = new THREE.Fog(0x0b0806, 8, 22);
  creatorScene.add(new THREE.HemisphereLight(0x9aa7c7, 0x2a1c10, 0.55));
  const key = new THREE.SpotLight(0xffe2b0, 60, 20, 0.5, 0.6, 1.5);
  key.position.set(2, 7, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  creatorScene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6a8cff, 1.4);
  rim.position.set(-3, 3, -4);
  creatorScene.add(rim);

  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5148, flatShading: true, roughness: 0.9 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.4, 12), stone);
  plat.position.y = -0.2; plat.receiveShadow = true; creatorScene.add(plat);
  const runes = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.03, 6, 48), new THREE.MeshStandardMaterial({ color: 0xe6c068, emissive: 0xe6c068, emissiveIntensity: 1.5 }));
  runes.rotation.x = Math.PI / 2; runes.position.y = 0.01; creatorScene.add(runes);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.4; floor.receiveShadow = true; creatorScene.add(floor);

  // Antorchas con llama parpadeante
  creatorScene.userData.flames = [];
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x3b2a1a, flatShading: true }));
    post.position.set(s * 2.6, 0.7, -1.2); creatorScene.add(post);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.12, 0.2, 8), stone);
    bowl.position.set(s * 2.6, 1.85, -1.2); creatorScene.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffa630 }));
    flame.position.set(s * 2.6, 2.2, -1.2); creatorScene.add(flame);
    const light = new THREE.PointLight(0xff9a3c, 8, 9, 1.5);
    light.position.set(s * 2.6, 2.4, -1.2); creatorScene.add(light);
    creatorScene.userData.flames.push({ flame, light, seed: Math.random() * 10 });
  }
}

let previewChar = null;
let previewYaw = 0.35;
function rebuildPreview() {
  if (previewChar) { creatorScene.remove(previewChar.root); disposeChar(previewChar); }
  previewChar = buildHumanoid(charOptions(custom));
  creatorScene.add(previewChar.root);
}
const SMALL_LAYOUT = window.matchMedia("(max-width: 1100px), (max-height: 800px)");
function frameCreatorCamera() {
  const W = window.innerWidth, H = window.innerHeight;
  const narrow = W / H < 1.2;
  creatorCam.position.set(0, 1.6, narrow ? 11 : 8.6);
  creatorCam.lookAt(0, 0.75, 0); // personaje un poco más arriba para que no lo tapen los paneles inferiores
  // Con la columna lateral, desplazamos la vista para que el personaje quede a la derecha
  if (SMALL_LAYOUT.matches && W > 700) creatorCam.setViewOffset(W, H, -Math.min(200, W * 0.2), 0, W, H);
  else creatorCam.clearViewOffset();
}
frameCreatorCamera();

let dragCreator = null;
canvas.addEventListener("pointerdown", (e) => { if (mode === "creator") dragCreator = e.clientX; });
window.addEventListener("pointermove", (e) => {
  if (mode === "creator" && dragCreator !== null) { previewYaw += (e.clientX - dragCreator) * 0.01; dragCreator = e.clientX; }
});
window.addEventListener("pointerup", () => (dragCreator = null));

function updateCreator(t, dt) {
  if (!previewChar) return;
  if (dragCreator === null) previewYaw += dt * 0.25;
  previewChar.root.rotation.y = previewYaw;
  animateHumanoid(previewChar, { move: 0, attack: -1, cast: -1 }, t, dt);
  for (const f of creatorScene.userData.flames) {
    const k = 0.85 + Math.sin(t * 13 + f.seed) * 0.08 + Math.sin(t * 7.3 + f.seed * 2) * 0.07;
    f.flame.scale.set(1, k, 1);
    f.light.intensity = 8 * k;
  }
}

// --- Interfaz de la creación
function renderChoiceLists() {
  const rl = $("raceList"), cl = $("classList");
  rl.innerHTML = Object.entries(RACES).map(([id, r]) =>
    `<button class="choice ${custom.race === id ? "sel" : ""}" data-race="${id}"><span class="ic">${r.icono}</span><b>${r.nombre}</b></button>`).join("");
  cl.innerHTML = Object.entries(CLASSES).map(([id, c]) =>
    `<button class="choice ${custom.cls === id ? "sel" : ""}" data-cls="${id}"><span class="ic">${c.icono}</span><b style="color:${c.color}">${c.nombre}</b></button>`).join("");
  const r = RACES[custom.race], c = CLASSES[custom.cls];
  $("raceInfo").innerHTML = `<p>${r.desc}</p><p class="bonus">★ ${r.bonusTxt}</p>`;
  $("classInfo").innerHTML = `<p>${c.desc}</p>
    <div class="stat"><span>Vida</span><b>${c.hp + (r.bonus.hp || 0)}</b></div>
    <div class="stat"><span>Recurso</span><b style="color:${c.recursoColor}">${c.recurso}</b></div>
    <div class="stat"><span>Ataque</span><b>${c.attack.icon} ${c.attack.nombre}</b></div>
    <div class="stat"><span>Habilidad</span><b>${c.special.icon} ${c.special.nombre}</b></div>
    <p class="muted" style="margin-top:6px">${c.special.desc}</p>`;
}

const CUSTOM_ROWS = [
  { key: "skin", label: "Tono de piel", count: () => RACES[custom.race].skins.length, show: (v) => `<span class="swatch" style="background:${RACES[custom.race].skins[v]}"></span>${v + 1}` },
  { key: "hair", label: "Peinado", count: () => HAIR_STYLES.length, show: (v) => HAIR_STYLES[v][1] },
  { key: "hairColor", label: "Color de pelo", count: () => HAIR_COLORS.length, show: (v) => `<span class="swatch" style="background:${HAIR_COLORS[v]}"></span>${v + 1}` },
  { key: "beard", label: "Barba", count: () => 2, show: (v) => (v ? "Sí" : "No"), bool: true },
  { key: "armor", label: "Armadura", count: () => ARMOR_COLORS.length, show: (v) => `<span class="swatch" style="background:${ARMOR_COLORS[v][0]}"></span>${ARMOR_COLORS[v][1]}` },
  { key: "cape", label: "Capa", count: () => 2, show: (v) => (v ? "Sí" : "No"), bool: true },
];
function renderCustomRows() {
  $("customRows").innerHTML = CUSTOM_ROWS.map((r) => {
    const v = r.bool ? (custom[r.key] ? 1 : 0) : custom[r.key];
    return `<div class="crow"><span>${r.label}</span><button class="arrow" data-k="${r.key}" data-d="-1">◀</button><span class="val">${r.show(v)}</span><button class="arrow" data-k="${r.key}" data-d="1">▶</button></div>`;
  }).join("");
}
function refreshCreator() { renderChoiceLists(); renderCustomRows(); rebuildPreview(); }

$("raceList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-race]"); if (!b) return;
  custom.race = b.dataset.race;
  custom.skin = 0;
  custom.beard = custom.race === "enano";
  refreshCreator();
});
$("classList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cls]"); if (!b) return;
  custom.cls = b.dataset.cls; refreshCreator();
});
$("customRows").addEventListener("click", (e) => {
  const b = e.target.closest(".arrow"); if (!b) return;
  const row = CUSTOM_ROWS.find((r) => r.key === b.dataset.k);
  const n = row.count(), d = +b.dataset.d;
  if (row.bool) custom[row.key] = !custom[row.key];
  else custom[row.key] = (custom[row.key] + d + n) % n;
  renderCustomRows(); rebuildPreview();
});
$("charName").value = custom.name;
$("charName").addEventListener("input", (e) => (custom.name = e.target.value.trim()));
$("btnRandomName").addEventListener("click", () => { custom.name = randomName(); $("charName").value = custom.name; });
$("btnRandomAll").addEventListener("click", () => {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  custom.race = pick(Object.keys(RACES)); custom.cls = pick(Object.keys(CLASSES));
  custom.skin = Math.floor(Math.random() * 5); custom.hair = Math.floor(Math.random() * HAIR_STYLES.length);
  custom.hairColor = Math.floor(Math.random() * HAIR_COLORS.length); custom.armor = Math.floor(Math.random() * ARMOR_COLORS.length);
  custom.beard = Math.random() < 0.5 || custom.race === "enano"; custom.cape = Math.random() < 0.7;
  custom.name = randomName(); $("charName").value = custom.name;
  refreshCreator();
});
refreshCreator();
/* =====================================================================
   ENTRADA: mano (MediaPipe), teclado y ratón
   La POSICIÓN de la mano mueve al personaje (joystick).
   La FORMA de la mano decide la acción. Así puedes moverte y atacar a la vez.
   ===================================================================== */
const GESTOS = {
  None: { emoji: "🖐️", accion: "Mano" },
  Open_Palm: { emoji: "✋", accion: "Moverse" },
  Closed_Fist: { emoji: "✊", accion: "Atacar" },
  Victory: { emoji: "✌️", accion: "Habilidad" },
  Pointing_Up: { emoji: "☝️", accion: "Correr" },
  Thumb_Up: { emoji: "👍", accion: "Saltar" },
  Thumb_Down: { emoji: "👎", accion: "Poción" },
  ILoveYou: { emoji: "🤟", accion: "Día / noche" },
};

const hand = {
  recognizer: null, ready: false, running: false, lastTime: -1,
  present: false, raw: "None", stable: "None", count: 0, lostAt: 0,
  x: 0.5, y: 0.5, cx: 0.5, cy: 0.5, // posición suavizada y centro calibrado
  edges: [],
};
const handCtx = $("handCanvas").getContext("2d");
const drawer = new DrawingUtils(handCtx);

async function loadHandModel() {
  const vision = await FilesetResolver.forVisionTasks(MP_WASM);
  const make = (delegate) => GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MP_MODEL, delegate },
    runningMode: "VIDEO", numHands: 1,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
  });
  try { hand.recognizer = await make("GPU"); }
  catch (e) { console.warn("GPU no disponible, uso CPU", e); hand.recognizer = await make("CPU"); }
  hand.ready = true;
}

async function startCamera() {
  if (hand.running) return;
  const video = $("webcam");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
  video.srcObject = stream;
  await video.play();
  $("handCanvas").width = video.videoWidth;
  $("handCanvas").height = video.videoHeight;
  $("preview").classList.remove("hidden");
  hand.running = true;
}

function updateHand(now) {
  const video = $("webcam");
  if (!hand.running || video.readyState < 2 || video.currentTime === hand.lastTime) return;
  hand.lastTime = video.currentTime;
  const res = hand.recognizer.recognizeForVideo(video, now);
  const cv = $("handCanvas");
  handCtx.clearRect(0, 0, cv.width, cv.height);

  if (!res.landmarks.length) {
    if (hand.present && !hand.lostAt) hand.lostAt = now;
    if (hand.present && now - hand.lostAt > 300) { hand.present = false; hand.stable = hand.raw = "None"; hand.count = 0; }
    $("previewLabel").textContent = "Muestra tu mano";
    return;
  }
  hand.lostAt = 0;
  hand.present = true;
  const lm = res.landmarks[0];
  drawer.drawConnectors(lm, GestureRecognizer.HAND_CONNECTIONS, { color: "#e6c068", lineWidth: 3 });
  drawer.drawLandmarks(lm, { color: "#fff", fillColor: "#8a6a24", radius: 3, lineWidth: 1 });

  // Centro de la palma; el video no está espejado, así que invertimos x para que coincida con la pantalla
  const ids = [0, 5, 9, 13, 17];
  let px = 0, py = 0;
  ids.forEach((i) => { px += lm[i].x; py += lm[i].y; });
  px /= ids.length; py /= ids.length;
  hand.x = lerp(hand.x, 1 - px, 0.5);
  hand.y = lerp(hand.y, py, 0.5);

  const g = res.gestures[0]?.[0];
  const name = g && g.score > 0.55 ? g.categoryName : "None";
  if (name === hand.raw) hand.count++; else { hand.raw = name; hand.count = 1; }
  if (hand.count >= CFG.gestureFrames && hand.stable !== name) {
    hand.stable = name;
    hand.edges.push(name); // inicio de gesto (para acciones de un solo disparo)
  }
  const info = GESTOS[hand.stable] ?? GESTOS.None;
  $("previewLabel").textContent = `${info.emoji} ${info.accion}`;
}

// Joystick: distancia de la mano al centro calibrado, con zona muerta
const JOY_RANGE = 0.3; // ±30% del encuadre de la cámara = recorrido completo
const JOY_DEAD = 0.3;  // 30% del recorrido sin efecto (coincide con el círculo punteado)
function handAxis(v, c) {
  const d = (v - c) / JOY_RANGE;
  const a = Math.abs(d);
  if (a < JOY_DEAD) return 0;
  return Math.sign(d) * clamp((a - JOY_DEAD) / (1 - JOY_DEAD), 0, 1);
}
$("btnRecenter").addEventListener("click", () => {
  if (hand.present) { hand.cx = hand.x; hand.cy = hand.y; toast("⊕ Centro del joystick recalibrado"); }
  else toast("Muestra tu mano para recalibrar");
});

// --- Teclado
const keys = new Set();
const keyEdges = [];
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (!keys.has(e.code)) keyEdges.push(e.code);
  keys.add(e.code);
  if (e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

// --- Ratón: clic izquierdo ataca, clic derecho + arrastrar gira
const mouse = { left: false, right: false, dx: 0 };
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  if (mode !== "game") return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) { mouse.right = true; canvas.setPointerCapture(e.pointerId); }
});
window.addEventListener("pointerup", (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
window.addEventListener("pointermove", (e) => { if (mouse.right && mode === "game") mouse.dx += e.movementX; });

// Estado de control unificado para cada frame
const ctrl = { turn: 0, fwd: 0, sprint: false, attack: false, special: false, jump: false, potion: false, night: false, pause: false, source: "teclado" };
const uiEdges = []; // clics en la barra de acción

function gatherInput() {
  ctrl.turn = ctrl.fwd = 0;
  ctrl.sprint = ctrl.attack = ctrl.special = ctrl.jump = ctrl.potion = ctrl.night = ctrl.pause = false;

  if (hand.present) {
    ctrl.source = "mano";
    ctrl.turn = handAxis(hand.x, hand.cx);
    ctrl.fwd = -handAxis(hand.y, hand.cy); // mano arriba = avanzar
    const g = hand.stable;
    if (g === "Closed_Fist") ctrl.attack = true;
    if (g === "Pointing_Up") ctrl.sprint = true;
  } else {
    ctrl.source = hand.running ? "sin mano" : "teclado";
  }
  for (const g of hand.edges) {
    if (g === "Victory") ctrl.special = true;
    if (g === "Thumb_Up") ctrl.jump = true;
    if (g === "Thumb_Down") ctrl.potion = true;
    if (g === "ILoveYou") ctrl.night = true;
  }
  hand.edges.length = 0;

  // Teclado (se suma)
  if (keys.has("KeyW") || keys.has("ArrowUp")) ctrl.fwd = 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) ctrl.fwd = -1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) ctrl.turn = -1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) ctrl.turn = 1;
  if (keys.has("ShiftLeft") || keys.has("ShiftRight")) ctrl.sprint = true;
  if (keys.has("KeyJ") || mouse.left) ctrl.attack = true;
  for (const k of keyEdges) {
    if (k === "KeyK" || k === "Digit2") ctrl.special = true;
    if (k === "Space") ctrl.jump = true;
    if (k === "KeyR" || k === "Digit4") ctrl.potion = true;
    if (k === "KeyN") ctrl.night = true;
    if (k === "Escape" || k === "KeyP") ctrl.pause = true;
  }
  keyEdges.length = 0;
  for (const a of uiEdges) ctrl[a] = true;
  uiEdges.length = 0;
}
/* =====================================================================
   ESTADO DEL JUEGO
   ===================================================================== */
const P = {
  ch: null, pos: new THREE.Vector3(0, 0, 13), yaw: Math.PI, vel: new THREE.Vector3(), velY: 0, onGround: true,
  hp: 100, maxHp: 100, baseHp: 100, energy: 100, level: 1, xp: 0, potions: 3, carrying: null,
  attackCd: 0, specialCd: 0, potionCd: 0, attackAnim: -1, castAnim: -1, spin: 0, flash: 0, flashOn: false,
  dead: false, deathT: 0, lastHit: -99, stats: {}, cls: null, race: null,
};
const G = { time: 0, kills: 0, collected: 0, waveTimer: CFG.waveEvery, enemies: [], projectiles: [], effects: [], texts: [], timers: [], msgT: 0, won: false };
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const xpNeeded = (l) => 40 + 30 * l;

function schedule(t, fn) { G.timers.push({ t, fn }); }
function throttledToast(msg) { if (G.time - G.msgT > 1.2) { G.msgT = G.time; toast(msg, 1300); } }

/* =====================================================================
   INICIO / LIMPIEZA
   ===================================================================== */
function cleanupGame() {
  if (P.ch) { scene.remove(P.ch.root); disposeChar(P.ch); P.ch = null; }
  for (const e of G.enemies) { scene.remove(e.ch.root); disposeChar(e.ch); e.bar.remove(); }
  for (const p of G.projectiles) { scene.remove(p.mesh); p.mesh.geometry.dispose(); }
  for (const f of G.effects) { scene.remove(f.mesh); f.mesh.geometry.dispose(); }
  for (const x of G.texts) x.el.remove();
  G.enemies = []; G.projectiles = []; G.effects = []; G.texts = []; G.timers = [];
}

function startGame() {
  cleanupGame();
  const race = RACES[custom.race], cls = CLASSES[custom.cls];
  P.race = race; P.cls = cls;
  P.ch = buildHumanoid(charOptions(custom));
  scene.add(P.ch.root);
  P.stats = { speed: race.bonus.speed || 1, dmg: race.bonus.dmg || 1, energyRegen: race.bonus.energyRegen || 1, regen: race.bonus.regen || 0 };
  P.baseHp = cls.hp + (race.bonus.hp || 0);
  Object.assign(P, {
    maxHp: P.baseHp, hp: P.baseHp, energy: CFG.energyMax, level: 1, xp: 0, potions: 3, carrying: null,
    attackCd: 0, specialCd: 0, potionCd: 0, attackAnim: -1, castAnim: -1, spin: 0, flash: 0, flashOn: false,
    dead: false, deathT: 0, lastHit: -99, yaw: Math.PI, velY: 0, onGround: true,
  });
  P.pos.set(0, 0, 13); P.vel.set(0, 0, 0);
  Object.assign(G, { time: 0, kills: 0, collected: 0, waveTimer: CFG.waveEvery, msgT: 0, won: false });
  resetCrystals();
  nightTarget = 0;

  // Guardianes alrededor de cada cristal (más fuertes cuanto más lejos)
  crystals.forEach((c, i) => {
    const h = c.userData.home, tier = i % 4;
    const types = ["trasgo", "trasgo"];
    if (tier >= 1) types.push(tier >= 2 ? "chaman" : "trasgo");
    if (tier === 3) types.push("golem");
    types.forEach((type, k) => {
      const a = (k / types.length) * Math.PI * 2 + i;
      spawnEnemy(type, h.x + Math.cos(a) * 4.5, h.z + Math.sin(a) * 4.5, false);
    });
  });

  setupHUD();
  mode = "game";
  $("creator").classList.add("hidden");
  $("hud").classList.remove("hidden");
  $("endScreen").classList.add("hidden");
  $("pause").classList.add("hidden");
  updateCamera(1, true);
  bigToast("Recupera los 8 cristales", 2600);

  if ($("useCam").checked && hand.ready) {
    startCamera()
      .then(() => toast("✋ Mueve la mano para caminar · ✊ atacar · ✌️ habilidad · Esc ayuda", 5000))
      .catch((err) => toast("No se pudo usar la cámara: " + err.message, 4500));
  } else {
    toast("WASD moverse · J/clic atacar · K habilidad · Esc ayuda", 5000);
  }
}

function spawnEnemy(type, x, z, hunter) {
  const def = ENEMY_TYPES[type];
  const ch = def.build();
  ch.root.position.set(x, terrainHeight(x, z), z);
  ch.root.rotation.order = "YXZ"; // para que caiga hacia atrás al morir
  scene.add(ch.root);
  const mult = 1 + G.collected * 0.08;
  const bar = document.createElement("div");
  bar.className = "ebar";
  bar.innerHTML = `${def.nombre}<i><b></b></i>`;
  bar.style.display = "none";
  $("bars").appendChild(bar);
  const e = {
    type, def, ch, pos: ch.root.position, yaw: rnd(0, 6.28), hp: def.hp * mult, maxHp: def.hp * mult, dmgMult: mult,
    home: new THREE.Vector2(x, z), wander: new THREE.Vector2(x, z), wanderT: rnd(1, 4), attackCd: rnd(0.6, 1.6),
    pendingHit: -1, pendingCast: -1, anim: -1, slowUntil: 0, flash: 0, vis: "", dead: false, deathT: 0,
    aggro: hunter, hunter, bar, barFill: bar.querySelector("b"), move: 0,
  };
  G.enemies.push(e);
  return e;
}

/* =====================================================================
   COLISIONES
   ===================================================================== */
const PILLARS = Array.from({ length: 6 }, (_, i) => ({ x: Math.cos((i / 6) * Math.PI * 2) * 7.2, z: Math.sin((i / 6) * Math.PI * 2) * 7.2 }));
function pushOut(p, cx, cz, cr) {
  const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
  if (d < cr && d > 1e-4) { p.x = cx + (dx / d) * cr; p.z = cz + (dz / d) * cr; }
}
function collide(p, r) {
  const d = Math.hypot(p.x, p.z);
  if (d > CFG.worldRadius) { p.x *= CFG.worldRadius / d; p.z *= CFG.worldRadius / d; }
  pushOut(p, 0, 0, 3.7 + r);
  for (const c of PILLARS) pushOut(p, c.x, c.z, 0.5 + r);
  for (const t of trees) if (Math.abs(p.x - t.x) < 3 && Math.abs(p.z - t.z) < 3) pushOut(p, t.x, t.z, t.r + r);
}

/* =====================================================================
   COMBATE DEL JUGADOR
   ===================================================================== */
const fwdOf = (yaw, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
function aliveEnemies() { return G.enemies.filter((e) => !e.dead); }
function enemiesWithin(pos, r) { return aliveEnemies().filter((e) => Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < r + e.def.radius); }
function nearestEnemy(maxD, halfAngle) {
  const f = fwdOf(P.yaw);
  let best = null, bd = Infinity;
  for (const e of aliveEnemies()) {
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > maxD) continue;
    const ang = Math.acos(clamp((dx * f.x + dz * f.z) / (d || 1), -1, 1));
    if (ang > halfAngle && d > 2.5) continue;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function faceTo(pos) { P.yaw = Math.atan2(pos.x - P.pos.x, pos.z - P.pos.z); }
function rollDmg(base) {
  const v = base * P.stats.dmg * (1 + 0.1 * (P.level - 1)) * rnd(0.85, 1.15);
  const crit = Math.random() < 0.12;
  return { v: crit ? v * 2 : v, crit };
}

function doAttack() {
  const a = P.cls.attack;
  P.attackCd = a.cd;
  P.attackAnim = 0;
  if (a.tipo === "melee") {
    const tgt = nearestEnemy(a.range + 2.5, Math.PI * 0.75);
    if (tgt) faceTo(tgt.pos);
    schedule(0.14, () => {
      if (P.dead) return;
      const f = fwdOf(P.yaw);
      addSlash();
      for (const e of aliveEnemies()) {
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d < a.range + e.def.radius && (dx * f.x + dz * f.z) / (d || 1) > -0.1) {
          damageEnemy(e, rollDmg(a.dmg));
          const k = 0.5 / (d || 1); e.pos.x += dx * k; e.pos.z += dz * k; // empujón
        }
      }
    });
  } else {
    const tgt = nearestEnemy(34, 0.65);
    if (tgt) faceTo(tgt.pos);
    shootFromPlayer(tgt, 0, a.dmg);
  }
}

function shootFromPlayer(tgt, angleOffset, baseDmg) {
  const a = P.cls.attack;
  const h = P.ch.height;
  const from = tmpV.set(P.pos.x, P.pos.y + h * 0.65, P.pos.z).addScaledVector(fwdOf(P.yaw), 0.8);
  let dir;
  if (tgt && !angleOffset) {
    dir = new THREE.Vector3(tgt.pos.x, tgt.pos.y + tgt.ch.height * 0.5, tgt.pos.z).sub(from).normalize();
  } else {
    dir = fwdOf(P.yaw + angleOffset, new THREE.Vector3());
  }
  const mesh = a.arrow
    ? new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.8), new THREE.MeshBasicMaterial({ color: a.color }))
    : new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: a.color }));
  mesh.position.copy(from);
  mesh.lookAt(tmpV2.copy(from).add(dir));
  scene.add(mesh);
  G.projectiles.push({ mesh, vel: dir.multiplyScalar(a.speed), owner: "player", dmg: baseDmg, life: 1.6, radius: 0.5, spin: !a.arrow });
}

function doSpecial() {
  const s = P.cls.special;
  if (P.specialCd > 0) return throttledToast(`${s.icon} ${s.nombre} se está recargando`);
  if (P.energy < s.cost) return throttledToast(`No tienes suficiente ${P.cls.recurso.toLowerCase()}`);
  P.energy -= s.cost;
  P.specialCd = s.cd;
  const base = P.cls.attack.dmg;
  switch (s.id) {
    case "torbellino":
      P.spin = 0.6; P.attackAnim = 0;
      addRing(P.pos, 4.8, 0xffd27a, 0.5);
      enemiesWithin(P.pos, 4.8).forEach((e) => damageEnemy(e, rollDmg(base * 1.8)));
      break;
    case "nova":
      P.castAnim = 0;
      addRing(P.pos, 7.5, 0x9fdcff, 0.7);
      enemiesWithin(P.pos, 7.5).forEach((e) => { damageEnemy(e, rollDmg(base * 1.1)); e.slowUntil = G.time + 3.5; });
      break;
    case "multidisparo":
      P.attackAnim = 0;
      for (let i = -3; i <= 3; i++) shootFromPlayer(null, i * 0.11, base);
      break;
    case "luz":
      P.castAnim = 0;
      healPlayer(P.maxHp * 0.35);
      addPillar(P.pos, 0xffe58a);
      enemiesWithin(P.pos, 5.5).forEach((e) => damageEnemy(e, rollDmg(base * 1.4)));
      break;
  }
}

function usePotion() {
  if (P.potions <= 0) return throttledToast("🧪 No te quedan pociones");
  if (P.hp >= P.maxHp) return throttledToast("Ya tienes la vida al máximo");
  if (P.potionCd > 0) return;
  P.potions--; P.potionCd = 1;
  healPlayer(P.maxHp * 0.45);
  addRing(P.pos, 2.5, 0x5fe27a, 0.6);
}

function healPlayer(v) {
  const real = Math.min(v, P.maxHp - P.hp);
  P.hp += real;
  if (real >= 1) spawnText(tmpV.set(P.pos.x, P.pos.y + P.ch.height + 0.3, P.pos.z), `+${Math.round(real)}`, "heal");
}

function damageEnemy(e, roll) {
  if (e.dead) return;
  e.hp -= roll.v;
  e.flash = 0.12;
  e.aggro = true;
  spawnText(tmpV.set(e.pos.x, e.pos.y + e.ch.height + 0.2, e.pos.z), roll.crit ? `${Math.round(roll.v)}!` : `${Math.round(roll.v)}`, roll.crit ? "crit" : "dmg");
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true; e.deathT = 0; e.bar.style.display = "none";
  G.kills++;
  gainXP(e.def.xp);
  if (Math.random() < 0.18 && P.potions < 5) {
    P.potions++;
    spawnText(tmpV.set(e.pos.x, e.pos.y + 1.5, e.pos.z), "+1 🧪", "heal");
  }
}

function gainXP(x) {
  P.xp += x;
  spawnText(tmpV.set(P.pos.x + 0.6, P.pos.y + P.ch.height, P.pos.z), `+${x} XP`, "xp");
  while (P.xp >= xpNeeded(P.level)) {
    P.xp -= xpNeeded(P.level);
    P.level++;
    P.maxHp = Math.round(P.baseHp * (1 + 0.12 * (P.level - 1)));
    P.hp = P.maxHp; P.energy = CFG.energyMax;
    bigToast(`¡Nivel ${P.level}!`);
    addPillar(P.pos, 0xe6c068);
  }
}

function damagePlayer(v) {
  if (P.dead || G.won) return;
  v = Math.round(v * (night > 0.5 ? 1.25 : 1));
  P.hp -= v;
  P.lastHit = G.time;
  P.flash = 0.15;
  const vg = $("vignette"); vg.style.opacity = 1; setTimeout(() => (vg.style.opacity = 0), 180);
  spawnText(tmpV.set(P.pos.x, P.pos.y + P.ch.height + 0.2, P.pos.z), `-${v}`, "hurt");
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; P.deathT = 0;
    if (P.carrying) { P.carrying.userData.state = "free"; P.carrying.position.copy(P.carrying.userData.home); P.carrying.userData.beam.visible = true; P.carrying = null; }
    schedule(2.2, () => endGame(false));
  }
}

/* =====================================================================
   EFECTOS VISUALES
   ===================================================================== */
function addEffect(mesh, dur, update) { scene.add(mesh); G.effects.push({ mesh, t: 0, dur, update }); }
function addRing(pos, radius, color, dur) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos.x, pos.y + 0.2, pos.z);
  addEffect(m, dur, (f, k) => { f.mesh.scale.setScalar(lerp(0.3, radius, Math.sqrt(k))); f.mesh.material.opacity = 0.9 * (1 - k); });
}
function addPillar(pos, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 9, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(pos.x, pos.y + 4.5, pos.z);
  addEffect(m, 0.9, (f, k) => { f.mesh.material.opacity = 0.6 * (1 - k); f.mesh.scale.set(1 - k * 0.5, 1, 1 - k * 0.5); f.mesh.position.set(P.pos.x, P.pos.y + 4.5, P.pos.z); });
}
function addSlash() {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.06, 4, 24, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(P.pos.x, P.pos.y + 1.1, P.pos.z);
  m.rotation.set(-Math.PI / 2, 0, P.yaw - Math.PI * 0.95); // arco centrado delante del jugador
  addEffect(m, 0.2, (f, k) => { f.mesh.material.opacity = 0.9 * (1 - k); f.mesh.scale.setScalar(1 + k * 0.3); });
}

function spawnText(pos, text, cls) {
  const el = document.createElement("div");
  el.className = "ct " + cls;
  el.textContent = text;
  $("ctext").appendChild(el);
  G.texts.push({ el, pos: pos.clone(), t: 0, dx: rnd(-0.5, 0.5) });
}

/* =====================================================================
   ACTUALIZACIÓN DEL JUGADOR
   ===================================================================== */
function updatePlayer(t, dt) {
  const ch = P.ch;
  if (P.dead) {
    P.deathT += dt;
    ch.root.rotation.z = lerp(ch.root.rotation.z, Math.PI / 2, 0.08);
    ch.root.position.y = P.pos.y + 0.3;
    return;
  }
  P.attackCd -= dt; P.specialCd -= dt; P.potionCd -= dt;
  if (ctrl.night) toggleNight();

  // Giro y movimiento
  P.yaw -= ctrl.turn * CFG.turnSpeed * dt;
  if (mouse.dx) { P.yaw -= mouse.dx * 0.006; mouse.dx = 0; }
  let fwd = ctrl.fwd;
  if (ctrl.sprint && ctrl.source === "mano" && fwd <= 0) fwd = 1; // ☝️ sola = correr hacia delante
  let spd = CFG.walkSpeed * P.stats.speed * (ctrl.sprint && fwd > 0 ? CFG.sprintMult : 1) * (P.carrying ? 0.92 : 1);
  if (fwd < 0) spd *= CFG.backMult;
  fwdOf(P.yaw, tmpV).multiplyScalar(fwd * spd);
  P.vel.lerp(tmpV, 1 - Math.exp(-10 * dt));
  P.pos.x += P.vel.x * dt;
  P.pos.z += P.vel.z * dt;
  collide(P.pos, 0.45);

  // Salto y gravedad
  const gy = terrainHeight(P.pos.x, P.pos.z);
  if (P.onGround) {
    if (ctrl.jump) { P.velY = CFG.jumpSpeed; P.onGround = false; }
    else P.pos.y = gy;
  }
  if (!P.onGround) {
    P.velY -= CFG.gravity * dt;
    P.pos.y += P.velY * dt;
    if (P.pos.y <= gy) { P.pos.y = gy; P.velY = 0; P.onGround = true; }
  }

  // Acciones
  if (ctrl.attack && P.attackCd <= 0) doAttack();
  if (ctrl.special) doSpecial();
  if (ctrl.potion) usePotion();

  // Regeneración
  const inSafe = Math.hypot(P.pos.x, P.pos.z) < CFG.safeRadius;
  let regen = P.stats.regen;
  if (G.time - P.lastHit > 5) regen += 3;
  if (inSafe) regen += 15;
  P.hp = Math.min(P.maxHp, P.hp + regen * dt);
  P.energy = Math.min(CFG.energyMax, P.energy + 9 * P.stats.energyRegen * dt);

  // Animación
  if (P.attackAnim >= 0) { P.attackAnim += dt / (P.cls.attack.tipo === "ranged" ? 0.35 : 0.4); if (P.attackAnim > 1) P.attackAnim = -1; }
  if (P.castAnim >= 0) { P.castAnim += dt / 0.6; if (P.castAnim > 1) P.castAnim = -1; }
  P.spin -= dt;
  ch.root.position.copy(P.pos);
  ch.root.rotation.y = P.yaw + (P.spin > 0 ? ((0.6 - P.spin) / 0.6) * Math.PI * 4 : 0);
  const moveAmt = (P.vel.length() / CFG.walkSpeed) * Math.sign(fwd || 1);
  animateHumanoid(ch, { move: moveAmt, air: !P.onGround, attack: P.attackAnim, ranged: P.cls.attack.tipo === "ranged", bow: P.cls.weapon === "arco", cast: P.castAnim }, t, dt);
  P.flash -= dt;
  const want = P.flash > 0;
  if (want !== P.flashOn) { flashChar(ch, want ? 0.9 : 0); P.flashOn = want; }
}

/* =====================================================================
   CRISTALES: recoger y entregar
   ===================================================================== */
function updateCrystals(t, dt) {
  for (const c of crystals) {
    const u = c.userData;
    if (u.state === "free") {
      c.position.y = u.home.y + Math.sin(t * 1.6 + u.phase) * 0.3;
      c.rotation.y += dt * 0.6;
      if (!P.carrying && !P.dead && Math.hypot(c.position.x - P.pos.x, c.position.z - P.pos.z) < 2.2 && Math.abs(c.position.y - P.pos.y) < 3.5) {
        P.carrying = c; u.state = "carried"; u.beam.visible = false;
        toast("💎 ¡Cristal recogido! Llévalo al santuario (mira el minimapa)", 3000);
      }
    } else if (u.state === "carried") {
      tmpV.set(P.pos.x, P.pos.y + P.ch.height + 0.9 + Math.sin(t * 3) * 0.1, P.pos.z);
      c.position.lerp(tmpV, 0.3);
      c.rotation.y += dt * 2.5;
      c.scale.setScalar(0.7);
      if (Math.hypot(P.pos.x, P.pos.z) < 7.5) deliver(c);
    } else if (u.state === "delivered") {
      const a = u.orbit + t * 0.6;
      c.position.lerp(tmpV.set(Math.cos(a) * 3.6, 4.4 + Math.sin(t * 2 + u.orbit) * 0.3, Math.sin(a) * 3.6), 0.08);
      c.rotation.y += dt * 1.5;
    }
  }
}
function deliver(c) {
  c.userData.state = "delivered";
  c.userData.orbit = G.collected * ((Math.PI * 2) / CFG.crystalCount);
  c.scale.setScalar(1);
  P.carrying = null;
  G.collected++;
  healPlayer(P.maxHp * 0.3);
  gainXP(30);
  addPillar(new THREE.Vector3(0, 0, 0), 0x67e8f9);
  if (G.collected >= CFG.crystalCount) {
    G.won = true;
    ringMat.emissive.set(0xf0abfc);
    bigToast("¡El santuario despierta!", 3000);
    schedule(3, () => endGame(true));
  } else {
    bigToast(`Cristal ${G.collected} / ${CFG.crystalCount}`, 1800);
    G.waveTimer = Math.min(G.waveTimer, 6); // los enemigos responden
  }
}

/* =====================================================================
   ENEMIGOS: IA
   ===================================================================== */
function updateEnemies(t, dt) {
  const playerSafe = Math.hypot(P.pos.x, P.pos.z) < CFG.safeRadius;
  const aggroR = 16 + (night > 0.5 ? 7 : 0);
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i], def = e.def, ch = e.ch;
    if (e.dead) {
      e.deathT += dt;
      ch.root.rotation.x = -Math.min(1, e.deathT * 2.5) * Math.PI / 2 * 0.95;
      if (e.deathT > 1.2) ch.root.position.y -= dt * 1.2;
      if (e.deathT > 2.4) { scene.remove(ch.root); disposeChar(ch); e.bar.remove(); G.enemies.splice(i, 1); }
      continue;
    }
    e.attackCd -= dt;
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);

    if (P.dead) e.aggro = false;
    else if (playerSafe && !e.hunter) e.aggro = false;
    else if (d < aggroR) e.aggro = true;
    else if (!e.hunter && d > aggroR * 2.2) e.aggro = false;

    const slow = G.time < e.slowUntil ? 0.45 : 1;
    let mvx = 0, mvz = 0, speed = def.speed * slow;

    if (e.aggro && !P.dead) {
      // Si el jugador está en el santuario, esperan en el borde
      let tx = P.pos.x, tz = P.pos.z;
      const tr = Math.hypot(tx, tz);
      if (tr < CFG.safeRadius + 1.5) { const k = (CFG.safeRadius + 1.5) / Math.max(tr, 0.01); tx *= k; tz *= k; }
      const tdx = tx - e.pos.x, tdz = tz - e.pos.z, td = Math.hypot(tdx, tdz);
      e.yaw = angleLerp(e.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
      if (def.ranged) {
        if (d < 6) { mvx = -dx / d; mvz = -dz / d; }
        else if (td > def.range * 0.75) { mvx = tdx / td; mvz = tdz / td; }
        if (d < def.range && e.attackCd <= 0 && !playerSafe) { e.attackCd = def.cd; e.anim = 0; e.pendingCast = 0.35; }
      } else {
        if (td > def.range * 0.8) { mvx = tdx / td; mvz = tdz / td; }
        if (d < def.range + 0.3 && e.attackCd <= 0) { e.attackCd = def.cd; e.anim = 0; e.pendingHit = 0.28; }
      }
    } else {
      // Patrulla alrededor de su posición
      e.wanderT -= dt;
      const wdx = e.wander.x - e.pos.x, wdz = e.wander.y - e.pos.z, wd = Math.hypot(wdx, wdz);
      if (e.wanderT <= 0 || wd < 0.5) {
        e.wanderT = rnd(2, 5);
        const a = rnd(0, 6.28), r = rnd(0, 7);
        e.wander.set(e.home.x + Math.cos(a) * r, e.home.y + Math.sin(a) * r);
      } else if (wd > 0.5) {
        mvx = wdx / wd; mvz = wdz / wd; speed *= 0.35;
        e.yaw = angleLerp(e.yaw, Math.atan2(wdx, wdz), 1 - Math.exp(-4 * dt));
      }
    }

    e.pos.x += mvx * speed * dt;
    e.pos.z += mvz * speed * dt;
    e.move = Math.hypot(mvx, mvz) * speed / def.speed;

    // Separación entre enemigos y con el jugador
    for (const o of G.enemies) {
      if (o === e || o.dead) continue;
      pushOutPair(e, o);
    }
    pushOut(e.pos, P.pos.x, P.pos.z, def.radius + 0.4);
    collide(e.pos, def.radius * 0.6);
    pushOut(e.pos, 0, 0, CFG.safeRadius + 0.3); // barrera del santuario
    e.pos.y = terrainHeight(e.pos.x, e.pos.z);
    ch.root.rotation.y = e.yaw;

    // Golpe cuerpo a cuerpo con pequeña anticipación
    if (e.pendingHit >= 0) {
      e.pendingHit -= dt;
      if (e.pendingHit < 0 && !P.dead && Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < def.range + 0.9 && Math.abs(P.pos.y - e.pos.y) < 2) damagePlayer(def.dmg * e.dmgMult);
    }
    if (e.pendingCast >= 0) {
      e.pendingCast -= dt;
      if (e.pendingCast < 0 && !P.dead) enemyShoot(e);
    }
    if (e.anim >= 0) { e.anim += dt / 0.5; if (e.anim > 1) e.anim = -1; }
    animateHumanoid(ch, { move: e.move, attack: e.anim, ranged: def.ranged, cast: -1 }, t, dt);

    // Color: golpe (rojo) o ralentizado (azul)
    e.flash -= dt;
    const vis = e.flash > 0 ? "hit" : G.time < e.slowUntil ? "slow" : "";
    if (vis !== e.vis) {
      if (vis === "hit") flashChar(ch, 1);
      else if (vis === "slow") tintChar(ch, "#3b82f6", 0.6);
      else flashChar(ch, 0);
      e.vis = vis;
    }
  }
}
function pushOutPair(a, b) {
  const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, d = Math.hypot(dx, dz), r = (a.def.radius + b.def.radius) * 0.9;
  if (d < r && d > 1e-4) { const k = ((r - d) / d) * 0.5; a.pos.x += dx * k; a.pos.z += dz * k; }
}
function enemyShoot(e) {
  const from = new THREE.Vector3(e.pos.x, e.pos.y + e.ch.height * 0.8, e.pos.z);
  const to = new THREE.Vector3(P.pos.x, P.pos.y + 1.1, P.pos.z);
  const dir = to.sub(from).normalize();
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xff6a1f }));
  mesh.position.copy(from);
  scene.add(mesh);
  G.projectiles.push({ mesh, vel: dir.multiplyScalar(15), owner: "enemy", dmg: e.def.dmg * e.dmgMult, life: 2.2, radius: 0.7, spin: true });
}

function spawnWave() {
  const alive = aliveEnemies().length;
  if (alive >= CFG.maxEnemies) return;
  const count = Math.min(CFG.maxEnemies - alive, 2 + Math.floor(G.collected / 2) + (night > 0.5 ? 1 : 0));
  for (let i = 0; i < count; i++) {
    let x, z, tries = 0;
    do {
      const a = rnd(0, 6.28), r = rnd(36, 48);
      x = P.pos.x + Math.cos(a) * r; z = P.pos.z + Math.sin(a) * r; tries++;
    } while ((Math.hypot(x, z) < CFG.safeRadius + 6 || Math.hypot(x, z) > 170) && tries < 20);
    const r = Math.random();
    const type = r < 0.1 + G.collected * 0.04 ? "golem" : r < 0.4 ? "chaman" : "trasgo";
    spawnEnemy(type, x, z, true);
  }
  toast("⚔️ ¡Una partida enemiga viene a por ti!", 2500);
}

/* =====================================================================
   PROYECTILES Y EFECTOS
   ===================================================================== */
function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.spin) { p.mesh.rotation.x += dt * 8; p.mesh.rotation.y += dt * 6; }
    const pos = p.mesh.position;
    let hit = false;
    if (p.owner === "player") {
      for (const e of aliveEnemies()) {
        if (Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < e.def.radius + p.radius && pos.y > e.pos.y - 0.3 && pos.y < e.pos.y + e.ch.height + 0.3) {
          damageEnemy(e, rollDmg(p.dmg)); hit = true; break;
        }
      }
    } else {
      if (Math.hypot(pos.x, pos.z) < CFG.safeRadius) { hit = true; addRing(pos, 1.2, 0x67e8f9, 0.3); } // la barrera lo bloquea
      else if (!P.dead && Math.hypot(P.pos.x - pos.x, P.pos.z - pos.z) < p.radius && pos.y > P.pos.y - 0.3 && pos.y < P.pos.y + P.ch.height + 0.3) {
        damagePlayer(p.dmg); hit = true;
      }
    }
    if (hit || p.life <= 0 || pos.y < terrainHeight(pos.x, pos.z)) {
      scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose();
      G.projectiles.splice(i, 1);
    }
  }
}
function updateEffects(dt) {
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const f = G.effects[i];
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    f.update(f, k);
    if (k >= 1) { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); G.effects.splice(i, 1); }
  }
}

function updateGame(t, dt) {
  G.time += dt;
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const tm = G.timers[i];
    tm.t -= dt;
    if (tm.t <= 0) { G.timers.splice(i, 1); tm.fn(); }
  }
  updatePlayer(t, dt);
  updateCrystals(t, dt);
  updateEnemies(t, dt);
  updateProjectiles(dt);
  updateEffects(dt);
  if (!G.won && !P.dead) {
    G.waveTimer -= dt * (night > 0.5 ? 1.4 : 1);
    if (G.waveTimer <= 0) { spawnWave(); G.waveTimer = Math.max(14, CFG.waveEvery - G.collected * 2); }
  }
}

/* =====================================================================
   CÁMARA EN TERCERA PERSONA
   ===================================================================== */
const camLook = new THREE.Vector3();
const camWant = new THREE.Vector3();
function updateCamera(dt, snap = false) {
  if (!P.ch) return;
  const f = fwdOf(P.yaw, tmpV2);
  camWant.set(P.pos.x - f.x * CFG.camDist, P.pos.y + CFG.camHeight, P.pos.z - f.z * CFG.camDist);
  // Evitar que una colina entre la cámara y el personaje tape la vista:
  // muestreamos el terreno a lo largo de la línea y elevamos la cámara si hace falta
  const head = P.pos.y + P.ch.height * 0.8;
  for (const k of [0.3, 0.55, 0.8, 1]) {
    const x = lerp(P.pos.x, camWant.x, k), z = lerp(P.pos.z, camWant.z, k);
    const need = (terrainHeight(x, z) + 0.9 - head * (1 - k)) / k;
    if (camWant.y < need) camWant.y = need;
  }
  if (Math.hypot(camWant.x, camWant.z) < 4.4) camWant.y = Math.max(camWant.y, 2.6); // no meterse en el pedestal
  camera.position.lerp(camWant, snap ? 1 : 1 - Math.exp(-6 * dt));
  const lookT = tmpV.set(P.pos.x + f.x * 2.5, P.pos.y + P.ch.height * 0.75, P.pos.z + f.z * 2.5);
  if (snap) camLook.copy(lookT); else camLook.lerp(lookT, 1 - Math.exp(-10 * dt));
  camera.lookAt(camLook);
}

/* =====================================================================
   FIN, PAUSA Y NAVEGACIÓN
   ===================================================================== */
function fmtTime(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, "0")}`; }
function endGame(victory) {
  if (mode !== "game") return;
  mode = "end";
  $("endTitle").textContent = victory ? "¡Victoria!" : "Has caído";
  $("endTitle").style.color = victory ? "var(--gold)" : "#ff6b5b";
  $("endText").textContent = victory
    ? `${custom.name || "Héroe"} devolvió los ${CFG.crystalCount} cristales y el santuario vuelve a brillar.`
    : `${custom.name || "Héroe"} cayó en combate. Los cristales siguen esperando.`;
  $("endStats").innerHTML = `<div><b>${fmtTime(G.time)}</b>Tiempo</div><div><b>${G.collected}/${CFG.crystalCount}</b>Cristales</div><div><b>${G.kills}</b>Enemigos</div><div><b>${P.level}</b>Nivel</div>`;
  $("endScreen").classList.remove("hidden");
}
function pauseGame() { mode = "paused"; $("pause").classList.remove("hidden"); }
function resumeGame() { mode = "game"; $("pause").classList.add("hidden"); }
function toCreator() {
  cleanupGame();
  mode = "creator";
  $("pause").classList.add("hidden");
  $("endScreen").classList.add("hidden");
  $("hud").classList.add("hidden");
  $("creator").classList.remove("hidden");
}
$("btnResume").addEventListener("click", resumeGame);
$("btnToCreator").addEventListener("click", toCreator);
$("btnRetry").addEventListener("click", startGame);
$("btnNewChar").addEventListener("click", toCreator);
$("btnEnter").addEventListener("click", () => {
  if (!custom.name) { custom.name = randomName(); $("charName").value = custom.name; }
  startGame();
});
/* =====================================================================
   HUD
   ===================================================================== */
let SLOTS = [];
function setupHUD() {
  const c = P.cls, r = P.race;
  $("ufIcon").textContent = r.icono;
  $("ufName").textContent = custom.name || "Héroe";
  $("ufClass").textContent = `${r.nombre} ${c.nombre.toLowerCase()}`;
  $("ufClass").style.color = c.color;
  $("enFill").style.background = `linear-gradient(180deg, ${c.recursoColor}, ${new THREE.Color(c.recursoColor).multiplyScalar(0.55).getStyle()})`;
  SLOTS = [
    { id: "attack", icon: c.attack.icon, ges: "✊", key: "J", name: c.attack.nombre, cd: () => P.attackCd / c.attack.cd, gesture: "Closed_Fist" },
    { id: "special", icon: c.special.icon, ges: "✌️", key: "K", name: c.special.nombre, cd: () => P.specialCd / c.special.cd, gesture: "Victory", cost: c.special.cost },
    { id: "sprint", icon: "💨", ges: "☝️", key: "Shift", name: "Correr", gesture: "Pointing_Up" },
    { id: "jump", icon: "⤒", ges: "👍", key: "Espacio", name: "Saltar", gesture: "Thumb_Up" },
    { id: "potion", icon: "🧪", ges: "👎", key: "R", name: "Poción", cd: () => P.potionCd, gesture: "Thumb_Down", count: () => P.potions },
    { id: "night", icon: "🌗", ges: "🤟", key: "N", name: "Día/Noche", gesture: "ILoveYou" },
  ];
  $("actionBar").innerHTML = SLOTS.map((s) =>
    `<div class="slot" data-id="${s.id}" title="${s.name}"><span class="slot-name">${s.name}</span>${s.icon}<span class="ges">${s.ges}</span><span class="key">${s.key}</span><span class="cnt"></span><span class="cd"></span></div>`).join("");
  SLOTS.forEach((s) => { s.el = $("actionBar").querySelector(`[data-id="${s.id}"]`); s.cdEl = s.el.querySelector(".cd"); s.cntEl = s.el.querySelector(".cnt"); });
}
$("actionBar").addEventListener("pointerdown", (e) => {
  const s = e.target.closest(".slot"); if (!s || mode !== "game") return;
  e.stopPropagation();
  if (s.dataset.id !== "sprint") uiEdges.push(s.dataset.id);
});

const proj = new THREE.Vector3();
function toScreen(p) {
  proj.copy(p).project(camera);
  return { x: (proj.x + 1) / 2 * window.innerWidth, y: (1 - proj.y) / 2 * window.innerHeight, ok: proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 };
}

function updateHUD(t, dt) {
  if (!P.ch) return;
  // Marco de unidad
  $("hpFill").style.width = `${(P.hp / P.maxHp) * 100}%`;
  $("hpText").textContent = `${Math.ceil(P.hp)} / ${P.maxHp}`;
  $("enFill").style.width = `${(P.energy / CFG.energyMax) * 100}%`;
  $("enText").textContent = `${P.cls.recurso} ${Math.floor(P.energy)}`;
  $("xpFill").style.width = `${(P.xp / xpNeeded(P.level)) * 100}%`;
  $("ufLevel").textContent = P.level;

  // Barra de acción
  for (const s of SLOTS) {
    const cd = s.cd ? clamp(s.cd(), 0, 1) : 0;
    s.cdEl.style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.7) ${cd * 360}deg, transparent 0)` : "none";
    s.el.classList.toggle("active", hand.present && hand.stable === s.gesture);
    if (s.cost) s.el.classList.toggle("nores", P.energy < s.cost);
    if (s.count) { s.cntEl.textContent = s.count(); s.el.classList.toggle("nores", s.count() <= 0); }
  }

  // Seguimiento de misión
  $("trCrystals").textContent = `${G.collected} / ${CFG.crystalCount}`;
  $("trKills").textContent = G.kills;
  $("trTime").textContent = `⏱ ${fmtTime(G.time)}${night > 0.5 ? " · 🌙 Noche" : ""}`;
  $("trCarry").textContent = P.carrying ? "➜ Lleva el cristal al santuario" : "➜ Busca un cristal (rombos en el mapa)";

  // Joystick
  const joy = $("joy");
  joy.classList.toggle("off", !hand.present);
  if (hand.present) {
    const jx = clamp((hand.x - hand.cx) / JOY_RANGE, -1, 1), jy = clamp((hand.y - hand.cy) / JOY_RANGE, -1, 1);
    $("joyDot").style.left = `${50 + jx * 45}%`;
    $("joyDot").style.top = `${50 + jy * 45}%`;
  } else {
    $("joyDot").style.left = `${50 + ctrl.turn * 45}%`;
    $("joyDot").style.top = `${50 - ctrl.fwd * 45}%`;
  }

  // Barras de enemigos
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
    let show = d < 34 && (e.aggro || e.hp < e.maxHp || d < 18);
    if (show) {
      const s = toScreen(tmpV.set(e.pos.x, e.pos.y + e.ch.height + 0.45, e.pos.z));
      show = s.ok;
      if (show) {
        e.bar.style.left = `${s.x}px`; e.bar.style.top = `${s.y}px`;
        e.barFill.style.width = `${Math.max(0, e.hp / e.maxHp) * 100}%`;
        e.bar.classList.toggle("slow", G.time < e.slowUntil);
      }
    }
    e.bar.style.display = show ? "block" : "none";
  }

  // Textos de combate flotantes
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const x = G.texts[i];
    x.t += dt;
    const s = toScreen(tmpV.copy(x.pos).add(tmpV2.set(x.dx * x.t, x.t * 1.6, 0)));
    x.el.style.left = `${s.x}px`; x.el.style.top = `${s.y}px`;
    x.el.style.opacity = s.ok ? 1 - Math.max(0, (x.t - 0.6) / 0.5) : 0;
    if (x.t > 1.1) { x.el.remove(); G.texts.splice(i, 1); }
  }

  drawMinimap(t);
}

// --- Minimapa que gira con el personaje
const mmCtx = $("minimap").getContext("2d");
function drawMinimap(t) {
  const S = 180, R = 90, scale = R / 70; // 70 m de radio
  const ctx = mmCtx;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createRadialGradient(R, R, 10, R, R, R);
  g.addColorStop(0, night > 0.5 ? "#1d3324" : "#3f6b34"); g.addColorStop(1, night > 0.5 ? "#0d1a12" : "#253f1f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);

  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw);
  const map = (x, z) => { const dx = x - P.pos.x, dz = z - P.pos.z; return [R + (dx * rx + dz * rz) * scale, R - (dx * fx + dz * fz) * scale]; };
  const inMap = ([x, y]) => Math.hypot(x - R, y - R) < R - 8;

  // Santuario
  const [sx, sy] = map(0, 0);
  ctx.strokeStyle = "rgba(103,232,249,.8)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy, CFG.safeRadius * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#67e8f9"; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();

  // Cristales
  let target = null, td = Infinity;
  for (const c of crystals) {
    if (c.userData.state !== "free") continue;
    const p = map(c.position.x, c.position.z);
    const d = Math.hypot(c.position.x - P.pos.x, c.position.z - P.pos.z);
    if (d < td) { td = d; target = p; }
    if (!inMap(p)) continue;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#" + new THREE.Color(c.userData.color).getHexString();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
  }
  if (P.carrying) target = [sx, sy];

  // Enemigos
  for (const e of G.enemies) {
    if (e.dead) continue;
    const p = map(e.pos.x, e.pos.z);
    if (!inMap(p)) continue;
    ctx.fillStyle = e.aggro ? "#ff3b30" : "#c2410c";
    ctx.beginPath(); ctx.arc(p[0], p[1], e.type === "golem" ? 4 : 2.6, 0, Math.PI * 2); ctx.fill();
  }

  // Flecha hacia el objetivo si está fuera del mapa
  if (target && !inMap(target)) {
    const a = Math.atan2(target[1] - R, target[0] - R);
    const ex = R + Math.cos(a) * (R - 12), ey = R + Math.sin(a) * (R - 12);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = P.carrying ? "#67e8f9" : "#f0abfc";
    ctx.globalAlpha = 0.6 + Math.sin(t * 6) * 0.4;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Jugador
  ctx.fillStyle = "#e6c068"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(R, R - 8); ctx.lineTo(R - 6, R + 6); ctx.lineTo(R, R + 3); ctx.lineTo(R + 6, R + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* =====================================================================
   BUCLE PRINCIPAL
   ===================================================================== */
const timer = new THREE.Timer();
timer.connect(document);

function loop(ts) {
  timer.update(ts);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  if (hand.running) updateHand(performance.now());

  if (mode === "creator") {
    hand.edges.length = 0; keyEdges.length = 0;
    updateCreator(t, dt);
    renderer.render(creatorScene, creatorCam);
  } else {
    gatherInput();
    if (mode === "game") { if (ctrl.pause) pauseGame(); else updateGame(t, dt); }
    else if (mode === "paused" && ctrl.pause) resumeGame();
    updateWorldVisuals(t, dt, P.pos);
    updateCamera(dt);
    updateHUD(t, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}
applyTime(0);
requestAnimationFrame(loop);

// Carga del modelo de manos en segundo plano
const camOk = !!navigator.mediaDevices?.getUserMedia;
loadHandModel()
  .then(() => {
    if (camOk) {
      $("useCam").disabled = false;
      $("useCam").checked = true;
      $("mpStatus").textContent = "✔ Modelo de gestos listo";
    } else {
      $("useCam").disabled = true;
      $("mpStatus").textContent = "La cámara solo funciona en localhost o https";
    }
  })
  .catch((err) => {
    console.error(err);
    $("useCam").disabled = true;
    $("mpStatus").textContent = "No se pudo cargar MediaPipe: puedes jugar con teclado";
  });
$("useCam").disabled = true;
