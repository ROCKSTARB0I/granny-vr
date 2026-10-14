// items.js -- the things in the house, and where they are.
//
// Two halves:
//   * ITEMS    -- what each of the 66 items is and what it looks like. Every
//                 model is primitives, like everything else here.
//   * PRESETS  -- the wiki's five Item Locations tables, transcribed. The game
//                 starts on preset 1 and advances one each round, so the house
//                 is never laid out the same way twice running.
//
// Slot ids are the container names furnish.js registered, which were in turn
// named after the wiki's own wording ("kitchen:cupboard5", "jail:ventilator"),
// so the tables below read almost exactly like the source.
import * as THREE from '../vendor/three.module.js?v=12';
import { mat } from './textures.js?v=12';

/* ------------------------------------------------------------ definitions */

const KEY_COLOURS = {
  masterKey: 0xd9c27a, padlockKey: 0xb8b2a4, safeKey: 0xc9a85a,
  weaponKey: 0x9fb0c0, playhouseKey: 0xc08a4a, specialKey: 0xcfd4dc,
  carKey: 0x8f949c, spiderKey: 0x6f8f5a, rustyPadlockKey: 0x8a5a38,
};

// Small helpers so each definition stays one line of intent.
const M = {
  metal: (c = 0x9aa0a8, rough = 0.35) =>
    new THREE.MeshStandardMaterial({ color: c, metalness: 0.75, roughness: rough }),
  dull: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
};

function keyMesh(colour) {
  const g = new THREE.Group();
  const m = M.metal(colour, 0.3);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 7), m);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 12), m);
  bow.position.x = -0.085;
  g.add(bow);
  for (const [ox, h] of [[0.045, 0.022], [0.062, 0.030]]) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.012, h, 0.009), m);
    tooth.position.set(ox, -h / 2 - 0.004, 0);
    g.add(tooth);
  }
  return g;
}

function cogMesh(colour) {
  const g = new THREE.Group();
  const m = M.metal(colour, 0.5);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.022, 14), m);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), m);
    t.position.set(Math.cos(a) * 0.078, Math.sin(a) * 0.078, 0);
    t.rotation.z = a;
    g.add(t);
  }
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.026, 10), M.dull(0x15171a));
  hole.rotation.x = Math.PI / 2;
  g.add(hole);
  return g;
}

function toolMesh(headColour, handleColour, headShape) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.20, 8),
    M.dull(handleColour));
  handle.position.y = -0.09;
  g.add(handle);
  g.add(headShape(M.metal(headColour, 0.4)));
  return g;
}

const ITEMS = {
  /* ------------------------------------------------------ keys and codes */
  masterKey:   { label: 'Master Key',   build: () => keyMesh(KEY_COLOURS.masterKey) },
  padlockKey:  { label: 'Padlock Key',  build: () => keyMesh(KEY_COLOURS.padlockKey) },
  safeKey:     { label: 'Safe Key',     build: () => keyMesh(KEY_COLOURS.safeKey) },
  weaponKey:   { label: 'Weapon Key',   build: () => keyMesh(KEY_COLOURS.weaponKey) },
  playhouseKey:{ label: 'Playhouse Key',build: () => keyMesh(KEY_COLOURS.playhouseKey) },
  specialKey:  { label: 'Special Key',  build: () => keyMesh(KEY_COLOURS.specialKey) },
  carKey:      { label: 'Car Key',      build: () => keyMesh(KEY_COLOURS.carKey) },
  spiderKey:   { label: 'Spider Key',   build: () => keyMesh(KEY_COLOURS.spiderKey) },
  rustyPadlockKey: { label: 'Rusty Padlock Key', build: () => keyMesh(KEY_COLOURS.rustyPadlockKey) },
  padlockCode: { label: 'Padlock Code', build: () => {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.004), M.dull(0xd8d2c2));
    g.add(paper);
    for (let i = 0; i < 3; i++) {
      const ln = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.005), M.dull(0x2a2622));
      ln.position.set(0, 0.03 - i * 0.03, 0.002);
      g.add(ln);
    }
    return g;
  } },

  /* ---------------------------------------------------------------- tools */
  hammer: { label: 'Hammer', build: () => toolMesh(0x8c9098, 0x6b4a2c, (m) => {
    const h = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.038, 0.038), m);
    head.position.y = 0.02;
    h.add(head);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.03), m);
    claw.position.set(-0.062, 0.02, 0);
    claw.rotation.z = 0.5;
    h.add(claw);
    return h;
  }) },
  screwdriver: { label: 'Screwdriver', build: () => {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.085, 9), M.dull(0xa8302a));
    handle.position.y = -0.055;
    g.add(handle);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), M.metal(0xbfc4cc, 0.25));
    shaft.position.y = 0.045;
    g.add(shaft);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.02, 0.004), M.metal(0xbfc4cc, 0.25));
    tip.position.y = 0.112;
    g.add(tip);
    return g;
  } },
  cuttingPliers: { label: 'Cutting Pliers', build: () => pliers(0xc23b2e) },
  chainCutter:   { label: 'Chain Cutter',   build: () => pliers(0x2e5ea8, 1.45) },
  wrench: { label: 'Wrench', build: () => {
    const g = new THREE.Group();
    const m = M.metal(0xa8adb5, 0.4);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.21, 0.012), m);
    g.add(bar);
    for (const sy of [1, -1]) {
      const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 5, 10, Math.PI * 1.45), m);
      jaw.position.y = sy * 0.112;
      jaw.rotation.z = sy > 0 ? 0.4 : Math.PI + 0.4;
      g.add(jaw);
    }
    return g;
  } },
  winchHandle: { label: 'Winch Handle', build: () => {
    const g = new THREE.Group();
    const m = M.metal(0x8a8f96, 0.5);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 7), m);
    a.rotation.z = Math.PI / 2; a.position.y = 0.06; g.add(a);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 7), m);
    b.position.x = 0.065; g.add(b);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.07, 8), M.dull(0x4a3524));
    grip.position.set(0.065, -0.085, 0); g.add(grip);
    return g;
  } },
  wheelCrank: { label: 'Wheel Crank', build: () => {
    const g = new THREE.Group();
    const m = M.metal(0x7e848c, 0.55);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16), m);
    g.add(ring);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.009), m);
      sp.rotation.z = (i / 3) * Math.PI;
      g.add(sp);
    }
    return g;
  } },
  woodenStick: { label: 'Wooden Stick', build: () => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.42, 7), M.dull(0x7a5a38));
    g.add(s);
    return g;
  } },
  plank: { label: 'Plank', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.022), M.dull(0x8a6a44)));
    return g;
  } },

  /* ------------------------------------------------------------- machine */
  redCogwheel:    { label: 'Red Cogwheel',    build: () => cogMesh(0xa33a2c) },
  orangeCogwheel: { label: 'Orange Cogwheel', build: () => cogMesh(0xc77a28) },
  battery: { label: 'Battery', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.095, 10), M.dull(0x2b2f38)));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.012, 8), M.metal(0xc9b26a, 0.3));
    cap.position.y = 0.053; g.add(cap);
    return g;
  } },
  carBattery: { label: 'Car Battery', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.16, 0.12), M.dull(0x23262b)));
    for (const sx of [-0.06, 0.06]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.03, 8), M.metal(0xb0a080, 0.4));
      t.position.set(sx, 0.09, 0); g.add(t);
    }
    return g;
  } },
  enginePart: { label: 'Engine Part', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.13), M.metal(0x6e747c, 0.6)));
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), M.metal(0x8a9098, 0.5));
    pipe.rotation.z = Math.PI / 2; pipe.position.y = 0.06; g.add(pipe);
    return g;
  } },
  sparkPlug: { label: 'Spark Plug', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.055, 8), M.dull(0xd8cdb8)));
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.022, 6), M.metal(0x9aa0a8, 0.4));
    hex.position.y = -0.035; g.add(hex);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 7), M.metal(0x9aa0a8, 0.4));
    tip.position.y = -0.06; g.add(tip);
    return g;
  } },
  gasolineCan: { label: 'Gasoline Can', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.23, 0.10), M.dull(0xa8352a)));
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.09, 8), M.dull(0x8e2c23));
    spout.position.set(0.055, 0.14, 0); spout.rotation.z = -0.4; g.add(spout);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 5, 10, Math.PI), M.dull(0x8e2c23));
    handle.position.y = 0.125; g.add(handle);
    return g;
  } },
  remoteControl: { label: 'Remote Control', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.15, 0.022), M.dull(0x22252a)));
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.006), M.dull(0xa33a2c));
      b.position.set(i % 2 ? 0.013 : -0.013, 0.04 - Math.floor(i / 2) * 0.025, 0.013);
      g.add(b);
    }
    return g;
  } },

  /* -------------------------------------------------------------- shotgun */
  barrel:    { label: 'Shotgun Barrel', build: () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.46, 9), M.metal(0x4e535a, 0.45));
    b.rotation.z = Math.PI / 2; g.add(b);
    return g;
  } },
  trigger:   { label: 'Shotgun Trigger', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.018), M.metal(0x5a5f66, 0.5)));
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 5, 10, Math.PI), M.metal(0x5a5f66, 0.5));
    guard.position.y = -0.03; guard.rotation.z = Math.PI; g.add(guard);
    return g;
  } },
  buttstock: { label: 'Shotgun Buttstock', build: () => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.085, 0.045), M.dull(0x6b4a2c));
    s.rotation.z = 0.12; g.add(s);
    return g;
  } },
  shotgun: { label: 'Shotgun', build: () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.44, 9), M.metal(0x4e535a, 0.45));
    b.rotation.z = Math.PI / 2; b.position.x = 0.12; g.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.042), M.dull(0x6b4a2c));
    s.position.x = -0.19; s.rotation.z = 0.1; g.add(s);
    return g;
  } },
  shotgunAmmo: { label: 'Shotgun Ammo', build: () => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.062, 9), M.dull(0xa03028));
    g.add(c);
    const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.018, 9), M.metal(0xc9a85a, 0.35));
    brass.position.y = -0.023; g.add(brass);
    return g;
  } },

  /* -------------------------------------------------------------- weapons */
  crossbow: { label: 'Crossbow', build: () => {
    const g = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.035), M.dull(0x5a4330));
    g.add(stock);
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.30, 0.016), M.dull(0x3a3f45));
    bow.position.x = 0.13; g.add(bow);
    return g;
  } },
  tranquilizerDarts: { label: 'Tranquilizer Darts', build: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 6), M.dull(0x3e6b4a));
      d.rotation.z = Math.PI / 2; d.position.y = i * 0.015; g.add(d);
    }
    return g;
  } },
  pepperSpray: { label: 'Pepper Spray', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.10, 10), M.dull(0xb03a2a)));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 8), M.dull(0x2a2d32));
    cap.position.y = 0.06; g.add(cap);
    return g;
  } },
  freezeTrap: { label: 'Freeze Trap', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.05, 12), M.metal(0x6a8ca8, 0.5)));
    return g;
  } },

  /* -------------------------------------------------------- puzzle extras */
  melon: { label: 'Melon', build: () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 11), M.dull(0x3f6b2e));
    m.scale.set(1, 0.88, 1); g.add(m);
    return g;
  } },
  meat: { label: 'Meat', build: () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), M.dull(0x7e2f2a));
    m.scale.set(1.3, 0.6, 0.9); g.add(m);
    return g;
  } },
  birdseed: { label: 'Birdseed', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.13, 10), M.dull(0xa8905a)));
    return g;
  } },
  book: { label: 'Book', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.042), M.dull(0x5a2f2a)));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.198, 0.032), M.dull(0xcfc6ae));
    pages.position.x = 0.008; g.add(pages);
    return g;
  } },
  teddy: { label: 'Teddy', build: () => {
    const g = new THREE.Group();
    const m = M.dull(0x8a6a44);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), m);
    body.scale.set(1, 1.2, 0.9); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), m);
    head.position.y = 0.082; g.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.016, 7, 6), m);
      ear.position.set(sx * 0.03, 0.112, 0); g.add(ear);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.021, 7, 6), m);
      arm.position.set(sx * 0.062, 0.015, 0); g.add(arm);
    }
    return g;
  } },
  note: { label: 'Note', build: () => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.003), M.dull(0xcfc6ae));
    p.rotation.z = 0.06; g.add(p);
    return g;
  } },
  greyVase: { label: 'Grey Vase', build: () => vase(0x8e9298) },
  blueVase: { label: 'Blue Vase', build: () => vase(0x47607e) },
  deadRat:  { label: 'Dead Rat',  build: () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 9, 7), M.dull(0x4a4038));
    b.scale.set(1.5, 0.8, 0.8); g.add(b);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.11, 5), M.dull(0x6a5a50));
    tail.rotation.z = Math.PI / 2; tail.position.x = -0.11; g.add(tail);
    return g;
  } },
  flashlight: { label: 'Flashlight', build: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.17, 9), M.dull(0x2d3138)));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.026, 0.03, 10), M.metal(0xd8d2c0, 0.2));
    lens.position.y = 0.095; g.add(lens);
    return g;
  } },
};

function pliers(handleColour, scale = 1) {
  const g = new THREE.Group();
  const steel = M.metal(0x8f949c, 0.4);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018 * scale, 0.19 * scale, 0.012), steel);
    arm.position.x = sx * 0.016 * scale;
    arm.rotation.z = sx * 0.1;
    g.add(arm);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.024 * scale, 0.09 * scale, 0.018),
      M.dull(handleColour));
    grip.position.set(sx * 0.026 * scale, -0.085 * scale, 0);
    g.add(grip);
  }
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 8), steel);
  pin.rotation.x = Math.PI / 2; pin.position.y = 0.03 * scale;
  g.add(pin);
  return g;
}

function vase(colour) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.062, 0.18, 12), M.dull(colour));
  g.add(body);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.025, 12), M.dull(colour));
  lip.position.y = 0.1; g.add(lip);
  return g;
}

export { ITEMS };

/* ----------------------------------------------------- where things spawn */

// Always in the same place, whatever the preset.
export const STATIC = {
  greyVase: 'startingBedroom:table',
  blueVase: 'jail:shelf',
  screwdriver: 'foyer:highShelf',
  pepperSpray: 'stairCloset:shelf',
  freezeTrap: 'sewerCell:table',
  note: 'dirtRoom:table',
  teddy: 'hiddenCloset:hiddenShelf',
  flashlight: 'startingBedroom:chest:top',
  crossbow: 'study:cogwheelSafe',
  tranquilizerDarts: 'study:cogwheelSafe',
  shotgunAmmo: 'garage:table',
};

// The five main presets, transcribed from the wiki's Item Locations table.
// The game starts on #1 and steps to the next each round.
export const PRESETS = [
  { // preset 1
    masterKey: 'car:trunk',                 hammer: 'backyard:well',
    cuttingPliers: 'bedroom2:left',         padlockKey: 'cellar:screwdriverSafe',
    padlockCode: 'kitchen:cupboard5',       battery: 'saTopFloor:left',
    safeKey: 'jail:ventilator',             weaponKey: 'study:cogwheelSafe',
    melon: 'cellar:cupboard4',              winchHandle: 'chest:puzzle',
    playhouseKey: 'melon',                  orangeCogwheel: 'cellar:drain',
    redCogwheel: 'nursery:right',           carKey: 'basement:safe',
    specialKey: 'kitchen:locker',           meat: 'cellar:shelf',
    buttstock: 'hiddenCloset:underShelves', trigger: 'kitchen:cupboard2',
    barrel: 'garage:leftRack',              book: 'diningRoom:showcase',
    carBattery: 'bedroom1:chest:left',      enginePart: 'livingRoom:tvTable',
    gasolineCan: 'basement:workbench',      sparkPlug: 'saTopFloor:right',
    wrench: 'specialRoom:lockerTop',        remoteControl: 'backyard:crowCage',
    birdseed: 'oldHouseCloset:barrel',      rustyPadlockKey: 'saBottomFloor:screwdriverSafe',
    chainCutter: 'stairCloset:corner',      woodenStick: 'sewerCell:skeleton',
    wheelCrank: 'hiddenCloset:fakeWall',
  },
  { // preset 2
    masterKey: 'melon',                     hammer: 'cellar:floor',
    cuttingPliers: 'chest:puzzle',          padlockKey: 'study:cogwheelSafe',
    padlockCode: 'sewer:stairWall',         battery: 'kitchen:cupboard6',
    safeKey: 'saMiddleFloor:screwdriverSafe', weaponKey: 'car:trunk',
    melon: 'kitchen:lockerTop',             winchHandle: 'hiddenCloset:bottomLeft',
    playhouseKey: 'cellar:cupboard3',       orangeCogwheel: 'cellar:screwdriverSafe',
    redCogwheel: 'jail:ventilator',         carKey: 'bathroom:toilet',
    specialKey: 'dirtRoom:table',           meat: 'sewerCell:table',
    buttstock: 'shed:bottomShelf',          trigger: 'nursery:chestTop',
    barrel: 'cellar:hallway',               book: 'study:showcase',
    carBattery: 'basement:workbench',       enginePart: 'backyard:well',
    gasolineCan: 'jail:wheelchair',         sparkPlug: 'study:left',
    wrench: 'bedroom2:chestTop',            remoteControl: 'meatRoom:table',
    birdseed: 'specialRoom:locker',         rustyPadlockKey: 'backyard:crowCage',
    chainCutter: 'basement:safe',           woodenStick: 'oldHouseCloset:barrel',
    wheelCrank: 'sauna:lowerBench',
  },
  { // preset 3
    masterKey: 'study:cogwheelSafe',        hammer: 'car:trunk',
    cuttingPliers: 'backyard:crowCage',     padlockKey: 'melon',
    padlockCode: 'stairCloset:wall',        battery: 'oldHouseKitchen:fireplace',
    safeKey: 'jail:ventilator',             weaponKey: 'cellar:drain',
    melon: 'backyard:well',                 winchHandle: 'cellar:floor',
    playhouseKey: 'saMiddleFloor:screwdriverSafe', orangeCogwheel: 'oldHouseKitchen:table',
    redCogwheel: 'bedroom1:chest:left',     carKey: 'saTopFloor:right',
    specialKey: 'chest:puzzle',             meat: 'nursery:chestTop',
    buttstock: 'cellar:cupboard1',          trigger: 'cellar:shelf',
    barrel: 'diningRoom:showcase',          book: 'startingBedroom:chest:left',
    carBattery: 'sewerCell:corner',         enginePart: 'oldHouseCloset:barrel',
    gasolineCan: 'foyer:highShelf',         sparkPlug: 'cellar:screwdriverSafe',
    wrench: 'kitchen:microwave',            remoteControl: 'dirtRoom:table',
    birdseed: 'shed:workbench',             rustyPadlockKey: 'basement:safe',
    chainCutter: 'specialRoom:locker',      woodenStick: 'stairCloset:shelf',
    wheelCrank: 'hiddenCloset:topLeft',
  },
  { // preset 4
    masterKey: 'cellar:screwdriverSafe',    hammer: 'sewerCell:table',
    cuttingPliers: 'basement:safe',         padlockKey: 'saBottomFloor:screwdriverSafe',
    padlockCode: 'meatRoom:wall',           battery: 'hiddenCloset:topLeft',
    safeKey: 'chest:puzzle',                weaponKey: 'car:glove',
    melon: 'car:trunk',                     winchHandle: 'specialRoom:locker',
    playhouseKey: 'study:left',             orangeCogwheel: 'backyard:crowCage',
    redCogwheel: 'backyard:well',           carKey: 'nursery:right',
    specialKey: 'cellar:cupboard3',         meat: 'oldHouseCloset:barrel',
    buttstock: 'kitchen:countertop',        trigger: 'meatRoom:table',
    barrel: 'bedroom1:chestTop',            book: 'saTopFloor:chestMiddle',
    carBattery: 'cellar:hallway',           enginePart: 'bedroom2:chestTop',
    gasolineCan: 'shed:bottomShelf',        sparkPlug: 'melon',
    wrench: 'jail:ventilator',              remoteControl: 'oldHouseKitchen:rightCupboard',
    birdseed: 'kitchen:lockerMiddle',       rustyPadlockKey: 'study:cogwheelSafe',
    chainCutter: 'garage:table',            woodenStick: 'jail:floor',
    wheelCrank: 'kitchen:microwave',
  },
  { // preset 5
    masterKey: 'backyard:crowCage',         hammer: 'backyard:well',
    cuttingPliers: 'nursery:left',          padlockKey: 'melon',
    padlockCode: 'study:right',             battery: 'stairCloset:shelf',
    safeKey: 'cellar:screwdriverSafe',      weaponKey: 'bedroom2:right',
    melon: 'chest:puzzle',                  winchHandle: 'study:showcase',
    playhouseKey: 'cellar:cupboard2',       orangeCogwheel: 'cellar:cupboard4',
    redCogwheel: 'sewerCell:table',         carKey: 'saBottomFloor:screwdriverSafe',
    specialKey: 'oldHouseCloset:barrel',    meat: 'cellar:cupboard1',
    buttstock: 'oldHouseKitchen:table',     trigger: 'car:glove',
    barrel: 'hiddenCloset:fakeWall',        book: 'diningRoom:shelf',
    carBattery: 'stairCloset:corner',       enginePart: 'cellar:shelf',
    gasolineCan: 'oldHouseKitchen:rightCupboard', sparkPlug: 'study:cogwheelSafe',
    wrench: 'cellar:drain',                 remoteControl: 'bookshelfRoom:corner',
    birdseed: 'car:trunk',                  rustyPadlockKey: 'specialRoom:locker',
    chainCutter: 'kitchen:locker',          woodenStick: 'basement:safe',
    wheelCrank: 'jail:ventilator',
  },
];

export const ITEM_COUNT = Object.keys(ITEMS).length;
