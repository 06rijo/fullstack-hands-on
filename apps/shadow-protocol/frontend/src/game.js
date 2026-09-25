import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { api } from './api.js';
import { state } from './state.js';
import { showScreen, showResults } from './ui.js';

// ---------------------------------------------------------------------------
// Weapon definitions (Epic 3: fire, reload, ADS, switch, and Epic 2 loadout)
// ---------------------------------------------------------------------------
const WEAPONS = {
  assault_rifle: { label: 'Assault Rifle', damage: 22, headMult: 2, fireRateMs: 110, mag: 30, reserveMax: 120, spread: 0.022, adsSpread: 0.006, auto: true, reloadMs: 1600, adsFov: 55 },
  smg: { label: 'SMG', damage: 16, headMult: 2, fireRateMs: 80, mag: 35, reserveMax: 140, spread: 0.035, adsSpread: 0.012, auto: true, reloadMs: 1300, adsFov: 60 },
  marksman_rifle: { label: 'Marksman Rifle', damage: 65, headMult: 2.2, fireRateMs: 650, mag: 8, reserveMax: 32, spread: 0.004, adsSpread: 0.0006, auto: false, reloadMs: 2200, adsFov: 25 },
  shotgun: { label: 'Shotgun', damage: 14, headMult: 1.5, pellets: 8, fireRateMs: 750, mag: 6, reserveMax: 24, spread: 0.09, adsSpread: 0.05, auto: false, reloadMs: 2600, adsFov: 58 },
  pistol: { label: 'Pistol', damage: 24, headMult: 2, fireRateMs: 220, mag: 12, reserveMax: 48, spread: 0.02, adsSpread: 0.008, auto: false, reloadMs: 1200, adsFov: 55 },
  machine_pistol: { label: 'Machine Pistol', damage: 14, headMult: 2, fireRateMs: 70, mag: 20, reserveMax: 80, spread: 0.05, adsSpread: 0.02, auto: true, reloadMs: 1100, adsFov: 60 },
};

const ARENA_HALF = 34;
const DEFAULT_FOV = 75;

let renderer, scene, camera, clock;
let running = false;
let started = false;

// player
const player = {
  pos: new THREE.Vector3(0, 1.7, 10),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  height: 1.7, targetHeight: 1.7,
  onGround: true,
  health: 100, maxHealth: 100,
  armor: 0, maxArmor: 100,
  sprinting: false, crouching: false, prone: false,
  lastHitAt: -999,
  slideT: 0,
};

const keys = {};
let mouseDown = false, aiming = false;
let slots = ['primary', 'secondary'];
let currentSlotIdx = 0;
let loadout = {}; // slot -> weaponKey
let ammo = {}; // slot -> {mag, reserve}
let reloading = false, reloadEndAt = 0;
let lastFireAt = 0;

let obstacles = []; // THREE.Box3 for simple collision
let enemies = [];
let wave = 1;
let matchStats = { kills: 0, headshots: 0, deaths: 0, xpEarned: 0 };
let armorPickup = null;
let audioCtx = null;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function initThree() {
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyGraphicsSettings();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1114);
  scene.fog = new THREE.Fog(0x0d1114, 18, 60);

  camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 200);
  clock = new THREE.Clock();

  const hemi = new THREE.HemisphereLight(0x4a5560, 0x0a0c0e, 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0x8fa3ad, 0.9);
  dir.position.set(20, 30, -10);
  dir.castShadow = state.settings.graphics !== 'low';
  scene.add(dir);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x23292c, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2 + 10, ARENA_HALF * 2 + 10), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  buildArena();

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function applyGraphicsSettings() {
  const q = state.settings.graphics;
  const pr = q === 'low' ? 1 : q === 'medium' ? Math.min(1.5, window.devicePixelRatio) : window.devicePixelRatio;
  renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = q !== 'low';
}

function boxObstacle(x, z, w, d, h, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const box = new THREE.Box3().setFromObject(mesh);
  obstacles.push(box);
}

function buildArena() {
  // perimeter walls
  const wallH = 6, t = 1;
  [[0, -ARENA_HALF, ARENA_HALF * 2, t], [0, ARENA_HALF, ARENA_HALF * 2, t],
   [-ARENA_HALF, 0, t, ARENA_HALF * 2], [ARENA_HALF, 0, t, ARENA_HALF * 2]]
    .forEach(([x, z, w, d]) => boxObstacle(x, z, w, d, wallH, 0x1a2024));

  // scattered cover
  const covers = [
    [8, 4, 4, 2, 2], [-9, -3, 2, 4, 2.2], [4, -10, 3, 3, 1.6],
    [-6, 9, 3, 3, 2], [12, -6, 2, 2, 2.5], [-14, 2, 2, 5, 2],
    [0, 0, 3, 3, 1.4], [-4, -14, 4, 2, 2],
  ];
  covers.forEach(([x, z, w, d, h]) => boxObstacle(x, z, w, d, h, 0x384349));
}

function resolveCollisions(nextPos, radius = 0.4) {
  const box = new THREE.Box3(
    new THREE.Vector3(nextPos.x - radius, 0, nextPos.z - radius),
    new THREE.Vector3(nextPos.x + radius, player.height, nextPos.z + radius)
  );
  for (const ob of obstacles) {
    if (box.intersectsBox(ob)) {
      const overlapX = Math.min(box.max.x - ob.min.x, ob.max.x - box.min.x);
      const overlapZ = Math.min(box.max.z - ob.min.z, ob.max.z - box.min.z);
      if (overlapX < overlapZ) {
        nextPos.x += (nextPos.x < (ob.min.x + ob.max.x) / 2) ? -overlapX : overlapX;
      } else {
        nextPos.z += (nextPos.z < (ob.min.z + ob.max.z) / 2) ? -overlapZ : overlapZ;
      }
    }
  }
  nextPos.x = THREE.MathUtils.clamp(nextPos.x, -ARENA_HALF + 1, ARENA_HALF - 1);
  nextPos.z = THREE.MathUtils.clamp(nextPos.z, -ARENA_HALF + 1, ARENA_HALF - 1);
  return nextPos;
}

// ---------------------------------------------------------------------------
// Audio (procedural — no external asset files needed)
// ---------------------------------------------------------------------------
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq, durMs, type = 'square', gainScale = 1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = state.settings.volume * 0.25 * gainScale;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durMs / 1000);
  osc.stop(audioCtx.currentTime + durMs / 1000);
}
const sfx = {
  shoot: () => beep(180 + Math.random() * 40, 70, 'sawtooth', 1),
  reload: () => beep(320, 140, 'sine', 0.6),
  hit: () => beep(900, 60, 'square', 0.7),
  hurt: () => beep(140, 180, 'sawtooth', 0.9),
  pickup: () => beep(660, 120, 'sine', 0.8),
  waveClear: () => beep(500, 300, 'triangle', 1),
};
function subtitle(text) {
  if (!state.settings.subtitles) return;
  const el = document.getElementById('hud-subtitles');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(subtitle._t);
  subtitle._t = setTimeout(() => (el.style.opacity = 0), 1800);
}

// ---------------------------------------------------------------------------
// Enemies (Epic 6: patrol, detect, attack, boss on final wave)
// ---------------------------------------------------------------------------
function spawnEnemy(x, z, isBoss = false) {
  const scale = isBoss ? 1.6 : 1;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: isBoss ? 0x8a2b2b : 0x5a4a3a, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35 * scale, 1.0 * scale, 4, 8), bodyMat);
  body.position.y = 1.0 * scale;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 12, 12), new THREE.MeshStandardMaterial({ color: 0xd8b48f }));
  head.position.y = 1.75 * scale;
  head.castShadow = true;
  group.add(head);
  group.position.set(x, 0, z);
  group.userData.isEnemyRoot = true;
  body.userData.part = 'body';
  head.userData.part = 'head';
  scene.add(group);

  const waypoints = [];
  for (let i = 0; i < 3; i++) {
    waypoints.push(new THREE.Vector3(
      THREE.MathUtils.clamp(x + (Math.random() - 0.5) * 12, -ARENA_HALF + 2, ARENA_HALF - 2),
      0,
      THREE.MathUtils.clamp(z + (Math.random() - 0.5) * 12, -ARENA_HALF + 2, ARENA_HALF - 2)
    ));
  }

  enemies.push({
    group, body, head,
    isBoss,
    health: isBoss ? 260 : 60,
    maxHealth: isBoss ? 260 : 60,
    state: 'patrol',
    waypoints, wp: 0,
    speed: isBoss ? 1.6 : 2.3,
    detectionRadius: isBoss ? 22 : 16,
    attackRange: isBoss ? 16 : 12,
    lastFireAt: 0,
    fireIntervalMs: isBoss ? 700 : 1300,
  });
}

function spawnWave(n) {
  const count = 2 + n; // escalating headcount
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 18 + Math.random() * 10;
    spawnEnemy(Math.cos(angle) * r, Math.sin(angle) * r, false);
  }
  if (n % 3 === 0) spawnEnemy(0, -ARENA_HALF + 4, true); // boss every 3rd wave
  updateHudWave();
}

function hasLineOfSight(from, to) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  const ray = new THREE.Raycaster(from, dir, 0.1, dist - 0.5);
  // reuse obstacle boxes as rough occluders via their mesh list would need meshes;
  // approximate using distance-based box tests instead for performance
  for (const ob of obstacles) {
    if (rayIntersectsBox(from, dir, dist, ob)) return false;
  }
  return true;
}
function rayIntersectsBox(origin, dir, maxDist, box) {
  const invDir = new THREE.Vector3(1 / dir.x, 1 / dir.y, 1 / dir.z);
  let t1 = (box.min.x - origin.x) * invDir.x, t2 = (box.max.x - origin.x) * invDir.x;
  let t3 = (box.min.y - origin.y) * invDir.y, t4 = (box.max.y - origin.y) * invDir.y;
  let t5 = (box.min.z - origin.z) * invDir.z, t6 = (box.max.z - origin.z) * invDir.z;
  const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
  const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
  if (tmax < 0 || tmin > tmax) return false;
  return tmin > 0 && tmin < maxDist;
}

function updateEnemies(dt, now) {
  for (const e of enemies) {
    const toPlayer = player.pos.clone().setY(0).sub(e.group.position);
    const dist = toPlayer.length();

    if (e.state === 'patrol') {
      const target = e.waypoints[e.wp];
      const toWp = target.clone().sub(e.group.position);
      if (toWp.length() < 0.5) e.wp = (e.wp + 1) % e.waypoints.length;
      else {
        toWp.normalize();
        e.group.position.addScaledVector(toWp, e.speed * 0.5 * dt);
        e.group.rotation.y = Math.atan2(toWp.x, toWp.z);
      }
      if (dist < e.detectionRadius && hasLineOfSight(e.group.position.clone().setY(1.2), player.pos)) {
        e.state = 'attack';
        subtitle('Enemy spotted you!');
      }
    } else if (e.state === 'attack') {
      if (dist > e.attackRange) {
        const dir = toPlayer.clone().normalize();
        e.group.position.addScaledVector(dir, e.speed * dt);
      }
      e.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      if (dist <= e.detectionRadius * 1.4 && now - e.lastFireAt > e.fireIntervalMs) {
        if (hasLineOfSight(e.group.position.clone().setY(1.2), player.pos)) {
          e.lastFireAt = now;
          const hitChance = THREE.MathUtils.clamp(1.1 - dist / (e.detectionRadius * 1.4), 0.1, 0.85);
          if (Math.random() < hitChance) {
            damagePlayer(e.isBoss ? 14 : 8);
          }
        }
      }
      if (dist > e.detectionRadius * 1.8) e.state = 'patrol';
    }
  }
}

function damageEnemy(enemy, amount, isHead) {
  enemy.health -= amount;
  sfx.hit();
  showHitMarker();
  if (enemy.health <= 0) {
    scene.remove(enemy.group);
    enemies = enemies.filter((e) => e !== enemy);
    matchStats.kills += 1;
    let xp = enemy.isBoss ? 120 : 10;
    if (isHead) { matchStats.headshots += 1; xp += 5; }
    matchStats.xpEarned += xp;
    updateHudScore();
    if (enemies.length === 0) onWaveClear();
  }
}

function onWaveClear() {
  sfx.waveClear();
  subtitle(`Wave ${wave} cleared`);
  matchStats.xpEarned += 50 * wave;
  wave += 1;
  maybeSpawnArmor();
  setTimeout(() => { if (running) spawnWave(wave); }, 2500);
}

// ---------------------------------------------------------------------------
// Armor pickup (Epic 5: armor)
// ---------------------------------------------------------------------------
function maybeSpawnArmor() {
  if (armorPickup || Math.random() > 0.7) return;
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.4),
    new THREE.MeshStandardMaterial({ color: 0x4aa6e6, emissive: 0x123a55 })
  );
  mesh.position.set((Math.random() - 0.5) * ARENA_HALF, 0.6, (Math.random() - 0.5) * ARENA_HALF);
  scene.add(mesh);
  armorPickup = mesh;
}
function updateArmorPickup(dt) {
  if (!armorPickup) return;
  armorPickup.rotation.y += dt * 2;
  if (player.pos.distanceTo(armorPickup.position) < 1.2) {
    player.armor = player.maxArmor;
    sfx.pickup();
    subtitle('Armor restored');
    scene.remove(armorPickup);
    armorPickup = null;
    updateHudBars();
  }
}

// ---------------------------------------------------------------------------
// Player damage / regen (Epic 5)
// ---------------------------------------------------------------------------
function damagePlayer(amount) {
  player.lastHitAt = performance.now();
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, amount * 0.6);
    player.armor -= absorbed;
    amount -= absorbed;
  }
  player.health = Math.max(0, player.health - amount);
  sfx.hurt();
  flashDamage();
  updateHudBars();
  if (player.health <= 0) endMatch(false);
}
function flashDamage() {
  const el = document.getElementById('hud-damage-flash');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 250);
}
function showHitMarker() {
  const el = document.getElementById('hud-hit-marker');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 120);
}
function regenPlayer(dt, now) {
  if (now - player.lastHitAt > 5000 && player.health < player.maxHealth) {
    player.health = Math.min(player.maxHealth, player.health + 8 * dt);
    updateHudBars();
  }
}

// ---------------------------------------------------------------------------
// Weapons: fire / reload / switch / ADS (Epic 3)
// ---------------------------------------------------------------------------
function currentWeaponKey() { return loadout[slots[currentSlotIdx]]; }
function currentWeapon() { return WEAPONS[currentWeaponKey()]; }
function currentAmmo() { return ammo[slots[currentSlotIdx]]; }

function tryFire(now) {
  if (reloading) return;
  const w = currentWeapon();
  const a = currentAmmo();
  if (now - lastFireAt < w.fireRateMs) return;
  if (a.mag <= 0) { subtitle('Out of ammo — reload!'); return; }
  lastFireAt = now;
  a.mag -= 1;
  ensureAudio();
  sfx.shoot();
  updateHudAmmo();

  const shots = w.pellets || 1;
  for (let i = 0; i < shots; i++) {
    fireRay(aiming ? w.adsSpread : w.spread);
  }
}

function fireRay(spread) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += (Math.random() - 0.5) * spread;
  dir.y += (Math.random() - 0.5) * spread;
  dir.normalize();
  const raycaster = new THREE.Raycaster(camera.position, dir, 0.1, 100);
  const targets = [];
  enemies.forEach((e) => targets.push(e.body, e.head));
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length > 0) {
    const hit = hits[0];
    const enemy = enemies.find((e) => e.body === hit.object || e.head === hit.object);
    if (enemy) {
      const isHead = hit.object.userData.part === 'head';
      const w = currentWeapon();
      const dmg = w.damage * (isHead ? w.headMult : 1);
      damageEnemy(enemy, dmg, isHead);
    }
  }
}

function startReload(now) {
  const w = currentWeapon();
  const a = currentAmmo();
  if (reloading || a.mag >= w.mag || a.reserve <= 0) return;
  reloading = true;
  reloadEndAt = now + w.reloadMs;
  sfx.reload();
  subtitle('Reloading');
}
function finishReload() {
  const w = currentWeapon();
  const a = currentAmmo();
  const needed = w.mag - a.mag;
  const take = Math.min(needed, a.reserve);
  a.mag += take;
  a.reserve -= take;
  reloading = false;
  updateHudAmmo();
}

function switchSlot(idx) {
  if (idx === currentSlotIdx || reloading) return;
  currentSlotIdx = idx;
  aiming = false;
  camera.fov = DEFAULT_FOV;
  camera.updateProjectionMatrix();
  updateHudAmmo();
}

// ---------------------------------------------------------------------------
// Movement (Epic 4: walk/run, jump/climb-over-cover, crouch, slide, prone)
// ---------------------------------------------------------------------------
function updateMovement(dt) {
  const speedBase = 4.5;
  const stanceMult = player.prone ? 0.35 : player.crouching ? 0.55 : 1;
  const sprintMult = player.sprinting && !player.crouching && !player.prone ? 1.6 : 1;

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.sin(player.yaw + Math.PI / 2), 0, Math.cos(player.yaw + Math.PI / 2));
  const move = new THREE.Vector3();
  if (keys['KeyW']) move.add(forward);
  if (keys['KeyS']) move.sub(forward);
  if (keys['KeyD']) move.add(right);
  if (keys['KeyA']) move.sub(right);
  if (move.lengthSq() > 0) move.normalize();

  let speed = speedBase * stanceMult * sprintMult;
  if (player.slideT > 0) { speed = speedBase * 2.2; player.slideT -= dt; }

  const next = player.pos.clone().addScaledVector(move, speed * dt);

  // vertical (jump/gravity) — also serves as simple "climb" over low cover via jump
  player.vel.y -= 18 * dt;
  next.y = player.pos.y + player.vel.y * dt;
  if (next.y <= 0) { next.y = 0; player.vel.y = 0; player.onGround = true; }

  resolveCollisions(next);
  player.pos.copy(next);

  player.targetHeight = player.prone ? 0.7 : player.crouching ? 1.15 : 1.7;
  player.height += (player.targetHeight - player.height) * Math.min(1, dt * 8);

  camera.position.set(player.pos.x, player.height + player.pos.y, player.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function updateHudBars() {
  document.getElementById('hud-health-fill').style.width = `${(player.health / player.maxHealth) * 100}%`;
  document.getElementById('hud-armor-fill').style.width = `${(player.armor / player.maxArmor) * 100}%`;
}
function updateHudAmmo() {
  const w = currentWeapon();
  const a = currentAmmo();
  document.getElementById('hud-ammo-current').textContent = reloading ? '...' : a.mag;
  document.getElementById('hud-ammo-reserve').textContent = a.reserve;
  document.getElementById('hud-weapon-name').textContent = w.label.toUpperCase();
}
function updateHudScore() {
  document.getElementById('hud-score').textContent = matchStats.xpEarned;
  document.getElementById('hud-enemies').textContent = enemies.length;
}
function updateHudWave() {
  document.getElementById('hud-wave').textContent = wave;
  document.getElementById('hud-enemies').textContent = enemies.length;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function onMouseMove(e) {
  if (document.pointerLockElement !== renderer.domElement) return;
  const sens = 0.0022 * state.settings.sensitivity;
  player.yaw -= e.movementX * sens;
  player.pitch -= e.movementY * sens;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
}

function onKeyDown(e) {
  keys[e.code] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.sprinting = true;
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    if (player.sprinting && !player.crouching && !player.prone && keys['KeyW']) {
      player.slideT = 0.45; // slide (Epic 4, story 19)
    } else {
      player.crouching = !player.crouching;
      if (player.crouching) player.prone = false;
    }
  }
  if (e.code === 'KeyZ') { player.prone = !player.prone; player.crouching = false; }
  if (e.code === 'Space' && player.onGround) { player.vel.y = 6.2; player.onGround = false; }
  if (e.code === 'KeyR') startReload(performance.now());
  if (e.code === 'Digit1') switchSlot(0);
  if (e.code === 'Digit2') switchSlot(1);
  if (e.code === 'Escape') togglePause();
}
function onKeyUp(e) {
  keys[e.code] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.sprinting = false;
}
function onMouseDown(e) {
  ensureAudio();
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) { aiming = true; camera.fov = currentWeapon().adsFov; camera.updateProjectionMatrix(); }
}
function onMouseUp(e) {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) { aiming = false; camera.fov = DEFAULT_FOV; camera.updateProjectionMatrix(); }
}

let paused = false;
function togglePause() {
  if (!started) return;
  paused = !paused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !paused);
  if (paused) document.exitPointerLock();
}

// ---------------------------------------------------------------------------
// Match lifecycle
// ---------------------------------------------------------------------------
export async function startMatch() {
  showScreen('screen-game');
  if (!renderer) initThree();
  applyGraphicsSettings();

  // reset state
  enemies.forEach((e) => scene.remove(e.group));
  enemies = [];
  if (armorPickup) { scene.remove(armorPickup); armorPickup = null; }
  player.pos.set(0, 0, 10);
  player.yaw = Math.PI; player.pitch = 0;
  player.health = player.maxHealth; player.armor = 0;
  player.crouching = false; player.prone = false;
  wave = 1;
  matchStats = { kills: 0, headshots: 0, deaths: 0, xpEarned: 0 };

  loadout = { primary: state.profile.primary_weapon, secondary: state.profile.secondary_weapon };
  ammo = {
    primary: { mag: WEAPONS[loadout.primary].mag, reserve: WEAPONS[loadout.primary].reserveMax },
    secondary: { mag: WEAPONS[loadout.secondary].mag, reserve: WEAPONS[loadout.secondary].reserveMax },
  };
  currentSlotIdx = 0;
  reloading = false;
  camera.fov = DEFAULT_FOV;
  camera.updateProjectionMatrix();

  updateHudBars();
  updateHudAmmo();
  updateHudWave();
  spawnWave(wave);

  document.getElementById('click-to-play').classList.remove('hidden');
  document.getElementById('pause-overlay').classList.add('hidden');
  paused = false;
  started = true;
  running = true;

  if (!gameLoopStarted) { gameLoopStarted = true; requestAnimationFrame(loop); }
}

async function endMatch(playerWon) {
  running = false;
  started = false;
  document.exitPointerLock();
  matchStats.deaths = playerWon ? 0 : 1;
  try {
    const res = await api.submitMatch({
      kills: matchStats.kills,
      deaths: matchStats.deaths,
      headshots: matchStats.headshots,
      wave_reached: wave,
      xp_earned: matchStats.xpEarned,
    });
    state.lastMatch = matchStats;
    showResults({
      kills: matchStats.kills,
      headshots: matchStats.headshots,
      deaths: matchStats.deaths,
      wave,
      xpEarned: matchStats.xpEarned,
      leveledUp: res.leveled_up,
      newLevel: res.profile.level,
    });
  } catch (err) {
    showResults({ kills: matchStats.kills, headshots: matchStats.headshots, deaths: matchStats.deaths, wave, xpEarned: matchStats.xpEarned, leveledUp: false });
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let gameLoopStarted = false;
function loop() {
  requestAnimationFrame(loop);
  if (!started) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  if (!paused) {
    if (mouseDown) {
      const w = currentWeapon();
      if (w.auto) tryFire(now);
    }
    if (reloading && now >= reloadEndAt) finishReload();
    updateMovement(dt);
    updateEnemies(dt, now);
    updateArmorPickup(dt);
    regenPlayer(dt, now);
  }

  renderer.render(scene, camera);
}

// single-shot (semi-auto) fire on click for non-auto weapons
function onClickFireOnce() {
  if (paused || !started) return;
  const w = currentWeapon();
  if (!w.auto) tryFire(performance.now());
}

// ---------------------------------------------------------------------------
// Wire up DOM / pointer lock
// ---------------------------------------------------------------------------
export function initGameInput() {
  const canvas = document.getElementById('game-canvas');
  const clickOverlay = document.getElementById('click-to-play');

  clickOverlay.addEventListener('click', () => {
    canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      clickOverlay.classList.add('hidden');
    } else if (started && !paused) {
      clickOverlay.classList.remove('hidden');
    }
  });

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', (e) => { onMouseDown(e); onClickFireOnce(); });
  document.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.getElementById('resume-btn').addEventListener('click', () => {
    paused = false;
    document.getElementById('pause-overlay').classList.add('hidden');
    canvas.requestPointerLock();
  });
  document.getElementById('quit-btn').addEventListener('click', () => {
    started = false;
    running = false;
    document.exitPointerLock();
    showScreen('screen-menu');
  });
}
