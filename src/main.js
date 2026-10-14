// main.js -- bootstrap and the frame loop.
import * as THREE from '../vendor/three.module.js?v=10';
import { World } from './world.js?v=10';
import { Player } from './player.js?v=10';
import { LightRig } from './lighting.js?v=10';
import { furnish } from './furnish.js?v=10';
import { auditDoorways, auditStairs, auditStairHeadroom } from './props.js?v=10';
import { Granny } from './granny.js?v=10';
import { Audio } from './audio.js?v=10';
import { JumpScare } from './jumpscare.js?v=10';
import { Interactor } from './interact.js?v=10';
import { MainMenu } from './menu.js?v=10';
import { Loot } from './loot.js?v=10';
import { VR } from './vr.js?v=10';
import { Flashlight } from './flashlight.js?v=10';
import { Hiding } from './hiding.js?v=10';
import { PLAYER_SPAWN, LEVELS, ROOM_BY_ID } from './floorplan.js?v=10';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);
scene.fog = new THREE.FogExp2(0x080a0e, 0.011);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 220);

const world = new World(scene).build();
const props = furnish(world);
world.buildIndex();

// Hard check: no piece of furniture may stand in a doorway.
const blockedDoors = auditDoorways(world);
if (blockedDoors.length) console.warn('BLOCKED DOORWAYS', blockedDoors);
const blockedStairs = auditStairs(world);
if (blockedStairs.length) console.warn('BLOCKED STAIRS', blockedStairs);
const lowStairs = auditStairHeadroom(world);
if (lowStairs.length) console.warn('LOW HEADROOM ON STAIRS', lowStairs);
const rig = new LightRig(scene, world);
rig.setBrightness(0.85);
const player = new Player(world, camera);

const spawn = ROOM_BY_ID[PLAYER_SPAWN.room];
player.teleport(spawn.x + PLAYER_SPAWN.x, LEVELS[spawn.lvl] + 0.1,
                spawn.z + PLAYER_SPAWN.z, PLAYER_SPAWN.yaw);

/* ------------------------------------------------------------------ input */

const hud = document.getElementById('hud');
const pauseHint = document.getElementById('pauseHint');
const roomLabel = document.getElementById('roomLabel');
const debugEl = document.getElementById('debug');
const promptEl = document.getElementById('prompt');
hud.hidden = false;
pauseHint.hidden = false;

let locked = false;
let dragging = false;
// Embedded frames refuse pointer lock outright, so don't even try there.
let pointerLockBlocked = window.self !== window.top;

// Pointer lock is the good path, but it is refused inside embedded frames.
// When that happens we fall back to click-and-drag look, which works anywhere.
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  canvas.focus();
  if (!locked && !pointerLockBlocked) {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { pointerLockBlocked = true; dragging = true; hint(); });
    } catch { pointerLockBlocked = true; dragging = true; hint(); }
  }
  if (pointerLockBlocked) dragging = true;
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('blur', () => { dragging = false; player.keys.clear(); });

document.addEventListener('pointerlockerror', () => {
  pointerLockBlocked = true;
  hint();
}, true);

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  hint();
});

document.addEventListener('mousemove', (e) => {
  if (locked || dragging) player.look(e.movementX, e.movementY);
});

function hint() {
  if (locked) { pauseHint.hidden = true; return; }
  pauseHint.hidden = false;
  pauseHint.innerHTML = pointerLockBlocked
    ? 'Hold <b>left mouse</b> and drag to look &nbsp;·&nbsp; <b>WASD</b> move &nbsp;·&nbsp; <b>arrows</b> also turn &nbsp;·&nbsp; <b>F</b> freecam'
    : 'Click to play &nbsp;·&nbsp; <b>Esc</b> to release the mouse';
}
hint();

// Keyboard look, so the game is fully playable with no mouse capture at all.
const LOOK_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (typeof menu !== 'undefined') menu.resize();
});

function respawn() {
  player.teleport(spawn.x + PLAYER_SPAWN.x, LEVELS[spawn.lvl] + 0.1,
                  spawn.z + PLAYER_SPAWN.z, PLAYER_SPAWN.yaw);
  flash('RESPAWNED IN THE STARTING BEDROOM');
}

let flashUntil = 0;
function flash(text) {
  promptEl.textContent = text;
  promptEl.classList.add('on');
  flashUntil = performance.now() + 2200;
}

/* ------------------------------------------------------- teleport shortcuts */
// Number keys jump between areas so the whole map can be inspected quickly.
const TOURS = [
  ['startingBedroom', 3.0, 3.6], ['foyer', 3.0, 3.5], ['livingRoom', 3.5, 2.5],
  ['kitchen', 3.0, 2.7], ['nursery', 3.0, 2.5], ['jail', 3.0, 2.3],
  ['basement', 4.0, 3.7], ['garage', 4.5, 3.7], ['cellarHall', 6.0, 1.1],
  ['saMiddleFloor', 2.3, 2.3],
];
// One keydown handler for everything. Bound to both window and canvas so the
// game still responds when focus lands on the canvas itself, which is what
// happens inside embedded frames.
function onKeyDown(e) {
  if (state === 'menu') return;
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  player.keys.add(e.code);

  if (e.code === 'KeyF') {
    player.freecam = !player.freecam;
    flash(player.freecam ? 'FREECAM  ·  Space up, Ctrl down, Shift fast' : 'WALKING');
  }
  if (e.code === 'KeyG' && !scare.active) torch.toggle();
  if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !player.freecam) player.crouch = true;
  if (e.code === 'Tab') debugEl.hidden = !debugEl.hidden;
  if (e.code === 'KeyR') respawn();
  if (e.code === 'KeyE' && !scare.active) { interactor.use(interactor.current); refreshHand(); }
  if (e.code === 'KeyV' && !scare.active) { loot.drop(false); refreshHand(); }
  if (e.code === 'KeyT' && !scare.active) { loot.drop(true); refreshHand(); }

  // Guard the digit check: an empty e.key would match index 0 and teleport
  // the player on every keystroke.
  const n = /^[0-9]$/.test(e.key || '') ? '1234567890'.indexOf(e.key) : -1;
  if (n >= 0 && n < TOURS.length) {
    const [id, lx, lz] = TOURS[n];
    const r = ROOM_BY_ID[id];
    player.teleport(r.x + lx, LEVELS[r.lvl] + 0.1, r.z + lz);
    flash(r.label.toUpperCase());
  }
}

function onKeyUp(e) {
  player.keys.delete(e.code);
  if ((e.code === 'KeyC' || e.code === 'ControlLeft') && player.canStand()) player.crouch = false;
}

// Window only -- key events from the focused canvas bubble up through the
// document to here, so binding all three would fire each handler three times
// and cancel out every toggle.
addEventListener('keydown', onKeyDown);
addEventListener('keyup', onKeyUp);
canvas.focus();

/* ------------------------------------------------------------------ audio */

const audio = new Audio();
// Browsers will not start an audio context until the user has interacted.
function unlockAudio() {
  audio.unlock();
  audio.startTheme();
  removeEventListener('pointerdown', unlockAudio);
  removeEventListener('keydown', unlockAudio);
}
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);

const distTo = (x, y, z) =>
  Math.hypot(player.pos.x - x, player.pos.z - z) + Math.abs(player.pos.y - y) * 2;

/* ----------------------------------------------------------------- granny */

let trapped = 0;
player.onTrapped = () => {
  trapped = 2.6;
  audio.trapSnap(0);
  flash('CAUGHT IN A BEAR TRAP');
};

const granny = new Granny(world, props, player, {
  difficulty: 'normal',
  onSound: (kind, at) => {
    const d = at ? distTo(at.x, at.y, at.z) : 0;
    if (kind === 'spot') { flash('SHE SEES YOU'); audio.setChase(true); }
    if (kind === 'door') audio.doorCreak(d);
    if (kind === 'mutter') audio.mutter(d);
    if (kind === 'trap') audio.trapSnap(d);
  },
  onCatch: () => caught(),
});

const scare = new JumpScare(scene, camera, granny, audio, rig, {
  flash: document.getElementById('fade'),
  vignette: document.getElementById('vignette'),
});

let fading = 0, day = 1;
const fadeEl = document.getElementById('fade');
const dayLabel = document.getElementById('dayLabel');
dayLabel.textContent = 'Day ' + day;

function caught() {
  if (fading) return;
  fading = 1;
  audio.setChase(false);
  // Hand the camera to the jumpscare; it returns control when it is finished.
  scare.trigger(() => {
    setTimeout(() => {
      day++;
      dayLabel.textContent = 'Day ' + day;
      player.teleport(spawn.x + PLAYER_SPAWN.x, LEVELS[spawn.lvl] + 0.1,
                      spawn.z + PLAYER_SPAWN.z, PLAYER_SPAWN.yaw);
      granny.state = 'patrol';
      granny.path = [];
      granny.respawnAway();
      scare.reset();
      fading = 0;
      flash('SHE KNOCKED YOU OUT');
    }, 700);
  });
}

// The noise bus. Everything that makes a sound reports it here and Granny is
// the only listener -- which is the whole point of her: bad eyes, sharp ears.
let stepAccum = 0;
function emitNoise(x, y, z, loudness) { granny.hear(x, y, z, loudness); }

function playerNoise(dt) {
  if (!player.grounded || player.freecam) return;
  stepAccum += player.noise * 12;
  if (stepAccum < 1) return;
  stepAccum = 0;
  const loud = player.crouch ? 0.5 : player.keys.has('ShiftLeft') ? 3.2 : 1.6;
  emitNoise(player.pos.x, player.pos.y, player.pos.z, loud);
  audio.footstep(0, player.crouch);

  // Creaking floorboards are far louder than a footstep.
  for (const c of world.creaks) {
    if (Math.abs(player.pos.y - c.y) > 1.0) continue;
    if (Math.hypot(player.pos.x - c.x, player.pos.z - c.z) > c.r) continue;
    flash('THE FLOOR CREAKS');
    audio.floorCreak(0);
    emitNoise(c.x, c.y, c.z, 6);
    break;
  }
}

// Her own footsteps, so you can hear her coming through the wall.
let grannyStep = 0, lastGrannyPos = { x: 0, z: 0 };
let heartTimer = 0;
function grannyAudio(dt) {
  const d = distTo(granny.pos.x, granny.pos.y, granny.pos.z);
  const moved = Math.hypot(granny.pos.x - lastGrannyPos.x, granny.pos.z - lastGrannyPos.z);
  lastGrannyPos = { x: granny.pos.x, z: granny.pos.z };
  grannyStep += moved;
  if (grannyStep > 0.62) { grannyStep = 0; audio.footstep(d, false); }

  // Heartbeat when she is close, faster the closer she gets.
  if (d < 7 && granny.enabled && !scare.active) {
    heartTimer -= dt;
    if (heartTimer <= 0) {
      audio.heartbeat(Math.min(1, (7 - d) / 5));
      heartTimer = 0.45 + d * 0.11;
    }
  }
  if (granny.state !== 'chase') audio.setChase(false);
}

/* ------------------------------------------------------- interaction */

const interactor = new Interactor(world, player, camera, audio);
interactor.onMessage = (m) => flash(m.toUpperCase());

// Fill the house. Every container the wiki names now actually holds something.
const loot = new Loot(world, props, player, camera, audio);
loot.onMessage = (m) => flash(m.toUpperCase());
loot.onDropNoise = (x, y, z, loud) => emitNoise(x, y, z, loud);
loot.spawn();
interactor.loot = loot;
// Picking the wrong chest in the Chest Room costs you the day.
interactor.onExplode = () => { audio.trapSnap(0); caught(); };

/* ------------------------------------------------------------------- xr */

const vr = new VR({ renderer, scene, camera, player, loot, interactor, audio });
player.vr = vr;
interactor.aimSource = () => (vr.active ? vr.aim() : null);
scare.vrSource = () => vr;

vr.onEnter = () => {
  // Hand the camera and the held item over to the headset.
  vr.rig.add(camera);
  loot.vrAnchor = vr.handAnchor;
  if (loot.carried) { loot.hand.remove(loot.carried.mesh); vr.handAnchor.add(loot.carried.mesh); }
  menu.hide();
  hud.hidden = true;
  pauseHint.hidden = true;
  state = 'playing';
  audio.unlock();
  audio.startTheme();
};
vr.onExit = () => {
  scene.add(camera);
  camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  loot.vrAnchor = null;
  if (loot.carried) { vr.handAnchor.remove(loot.carried.mesh); loot.hand.add(loot.carried.mesh); }
  hud.hidden = false;
  hint();
};
vr.onTrigger = () => { interactor.use(interactor.current); refreshHand(); };
vr.onGrip    = () => { loot.drop(false); refreshHand(); };
vr.onThrow   = () => { loot.drop(true); refreshHand(); };

// Beds, wardrobes and the car can be climbed into.
const hiding = new Hiding(world, props, player, camera, audio);
hiding.onMessage = (m) => flash(m.toUpperCase());
hiding.onFound = () => caught();
interactor.hiding = hiding;
interactor.granny = granny;

// Chest lamp. Always equipped -- it is not the Flashlight pickup.
const torch = new Flashlight(scene, player, camera, audio);
torch.vr = vr;
torch.onChange = (on) => flash(on ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF');
vr.onLeftStickClick = () => torch.toggle();

const handEl = document.getElementById('hand');
function refreshHand() {
  handEl.textContent = loot.carried ? loot.carried.label.toUpperCase() : '';
}
refreshHand();

/* -------------------------------------------------------------- the menu */

const menu = new MainMenu(world, renderer);
let state = 'menu';
hud.hidden = true;
pauseHint.hidden = true;

menu.onPlay(() => {
  audio.unlock();
  audio.startTheme();
  menu.hide();
  hud.hidden = false;
  state = 'playing';
  hint();
  canvas.focus();
});
// The VR entry is wired here rather than with the rest of the XR setup
// because it needs the menu, which is built further down.
menu.setVRAvailable(false, 'Checking for a headset…');
vr.onSupport = (ok) => menu.setVRAvailable(ok,
  ok ? '' : 'No headset found — open this page in the Quest browser over HTTPS.');
if (vr.supported) menu.setVRAvailable(true);
menu.onVR(async () => {
  try { await vr.enter(); }
  catch (err) { menu.setVRAvailable(false, String(err.message || err)); }
});

menu.onQuit(() => {
  menu.hide();
  document.body.innerHTML =
    '<p style="position:fixed;inset:0;display:grid;place-items:center;' +
    'font:14px monospace;letter-spacing:.2em;color:#6f6a63">SHE IS STILL WAITING.</p>';
});

/* ------------------------------------------------------------------- loop */

let last = performance.now();
function frame(now) {
  now = now ?? performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // Debug hook: lets a test step the simulation by hand without the frame loop
  // racing it. Does nothing in normal play.
  if (window.__paused) { renderer.render(scene, camera); return; }

  if (state === 'menu' && !vr.active) {
    menu.update(dt);
    menu.render();
    return;
  }

  // While the jumpscare is running it owns the camera completely -- the player
  // cannot move or look away. That helplessness is the whole effect.
  if (scare.active) {
    scare.update(dt);
    if (vr.active) vr.syncRig();
    rig.update(camera.position);
    renderer.render(scene, camera);
    return;
  }

  let lx = 0, ly = 0;
  for (const code in LOOK_KEYS) {
    if (player.keys.has(code)) { lx += LOOK_KEYS[code][0]; ly += LOOK_KEYS[code][1]; }
  }
  if (lx || ly) player.look(lx * 900 * dt, ly * 700 * dt);

  if (trapped > 0) {
    trapped -= dt;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) player.keys.delete(k);
  }
  // A ladder climb drives the player itself, so ordinary movement is skipped.
  const climbing = interactor.update(dt);
  if (!climbing && !hiding.hidden) {
    player.update(dt);
    playerNoise(dt);
  }
  granny.update(dt);
  grannyAudio(dt);
  loot.update(dt);
  hiding.update(dt, granny);
  torch.update(dt);
  vr.update(dt);
  if (vr.active) vr.syncRig();
  world.updateDoors(dt);
  rig.update(camera.position);

  const r = player.room();
  roomLabel.textContent = r ? r.room.label : '';
  refreshHand();

  // Interaction prompt, unless a message is already being flashed.
  if (!flashUntil) {
    const it = interactor.current;
    const text = it ? interactor.label(it) : '';
    if (text) { promptEl.textContent = text; promptEl.classList.add('on'); }
    else promptEl.classList.remove('on');
  }

  if (!debugEl.hidden) {
    debugEl.textContent =
      `x ${player.pos.x.toFixed(2)}  y ${player.pos.y.toFixed(2)}  z ${player.pos.z.toFixed(2)}\n` +
      `room ${r ? r.id : '-'}\n` +
      `${player.freecam ? 'FREECAM' : player.crouch ? 'CROUCH' : 'WALK'}  grounded ${player.grounded}\n` +
      `granny ${granny.state} seen ${granny.seenFor.toFixed(2)} traps ${granny.bearTraps.length}\n` +
      `keys [${[...player.keys].join(' ')}]\n` +
      `solids ${world.solids.length}  doors ${world.doors.length}`;
  }
  if (flashUntil && now > flashUntil) { promptEl.classList.remove('on'); flashUntil = 0; }

  if (vr.active) {
    const rm = player.room();
    vr.drawWrist({
      day, room: rm ? rm.room.label : '',
      held: loot.carried ? loot.carried.label : '',
      prompt: interactor.current ? interactor.label(interactor.current) : '',
    });
  }

  renderer.render(scene, camera);
}

// setAnimationLoop, not requestAnimationFrame: rAF does not fire inside an
// immersive session, so the game would freeze the moment the headset took over.
renderer.setAnimationLoop(frame);

// Doors start ajar rather than shut: the interaction system that lets the
// player open them is not built yet, and Granny opens them herself.
for (const d of world.doors) if (d.kind === 'door') d.target = 1;

window.__game = { scene, camera, world, props, player, granny, rig, renderer, THREE, menu,
                  blockedDoors, blockedStairs, lowStairs, audio, loot, vr, torch, hiding, scare, caught, interactor };
