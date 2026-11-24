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
