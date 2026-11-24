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
