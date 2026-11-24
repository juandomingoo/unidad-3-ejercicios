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
