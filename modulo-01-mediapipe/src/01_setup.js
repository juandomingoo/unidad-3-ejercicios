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
