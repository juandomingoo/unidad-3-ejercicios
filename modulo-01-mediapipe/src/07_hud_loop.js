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
