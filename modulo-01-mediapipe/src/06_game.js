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
