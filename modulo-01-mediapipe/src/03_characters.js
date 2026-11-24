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
