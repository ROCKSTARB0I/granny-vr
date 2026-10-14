// floorplan.js -- the house, as data.
//
// Transcribed from the v1.8.8 house map: every room on that map exists here,
// with the same neighbours and the same vertical stacking. Metric proportions
// are mine (the map is schematic) but adjacency is faithful, because that is
// what pathing and the escape routes actually depend on.
//
// Rooms are axis-aligned rects. Two rooms are connected only if their rects
// share a colinear edge of at least 0.3m -- the builder punches the doorway
// out of that shared line -- so the numbers below are chosen to close exactly.
//
// Axes: +X east, +Z south, +Y up. One unit = one metre.

export const LEVELS = {
  sewer:    -9.6,   // Spider Cellar / sewers -- lowest area in the game
  garage:   -6.4,
  basement: -3.4,
  ground:    0,
  upper:     3.4,
  attic:     6.8,
  attic2:    9.4,   // S.A. Top Floor + Meat Room
  special:  10.2,   // Special Room -- highest room in the game
};

export const WALL_H = 2.68;

const R = (id, label, lvl, x, z, w, d, o = {}) => ({
  id, label, lvl, x, z, w, d,
  h: o.h ?? WALL_H,
  wall: o.wall ?? 'wallpaperRust',
  floor: o.floor ?? 'floorPlank',
  ceil: o.ceil ?? 'ceilingPlank',
  outdoor: false, dark: false, lights: null, noCeil: false,
  ...o,
});

export const ROOMS = [
  /* ---------------------------------------------------------- GROUND FLOOR */
  // The Foyer is a two-storey hall with the staircase and the Main Door --
  // the game's signature space, so it gets the full 6.4m volume.
  R('foyer', 'Foyer', 'ground', -1, -0.5, 6, 7, {
    h: 6.4, wall: 'plaster', floor: 'floorPlankDark', noCeil: false,
    ceil: 'plasterCeiling', lights: [[3, 3.5, 0.5], [3, 1.0, 0.3]],
  }),
  R('diningRoom', 'Dining Room', 'ground', -7, -5.5, 6, 5, {
    wall: 'wallpaperOchre', lights: [[3, 2.5, 0.45]],
  }),
  R('livingRoom', 'Living Room', 'ground', -1, -5.5, 7, 5, {
    wall: 'wallpaperGreen', lights: [[3.5, 2.5, 0.45]],
  }),
  R('kitchen', 'Kitchen', 'ground', -7, -0.5, 6, 5.5, {
    wall: 'plaster', floor: 'tile', lights: [[3, 2.75, 0.45]],
  }),
  R('stairCloset', 'Stair Closet', 'ground', 5, -0.5, 2.4, 2.6, {
    wall: 'plasterDim', dark: true, lights: [[1.2, 1.3, 0.12]],
  }),
  R('study', 'Study', 'ground', 5, 2.1, 4.4, 4.4, {
    wall: 'wallpaperBlue', lights: [[2.2, 2.2, 0.42]],
  }),
  R('backyard', 'Backyard', 'ground', -7, -14, 19, 8.5, {
    outdoor: true, noCeil: true, floor: 'grass', wall: 'brick', h: 4.5,
    lights: [[7, 4.6, 0.20], [15, 3.0, 0.18]],
  }),
  R('shed', 'Shed', 'ground', -10, -11.5, 3, 3.5, {
    wall: 'woodRaw', floor: 'dirt', dark: true, lights: [[1.5, 1.75, 0.14]],
  }),
  R('playhouse', 'Playhouse', 'ground', 5, -17, 3, 3, {
    wall: 'woodRaw', floor: 'woodRaw', h: 2.2, dark: true, lights: [[1.5, 1.5, 0.14]],
  }),

  /* ----------------------------------------------------------- UPPER FLOOR */
  // The landing is built inside the Foyer void; these hallway rects sit
  // around it and open onto it.
  R('hallwayN', 'Upper Hallway', 'upper', -1, -2.9, 6, 2.4, {
    wall: 'plaster', floor: 'floorPlankDark', lights: [[3, 1.2, 0.35]],
  }),
  R('hallwayW', 'Upper Hallway', 'upper', -5, -0.5, 4, 4, {
    wall: 'plaster', floor: 'floorPlankDark', lights: [[2, 2, 0.35]],
  }),
  R('hallwayE', 'Upper Hallway', 'upper', 5, 1.3, 2, 4.4, {
    wall: 'plaster', floor: 'floorPlankDark', lights: [[1, 2.2, 0.32]],
  }),
  R('startingBedroom', 'Starting Bedroom', 'upper', -7, -5.5, 6, 5, {
    wall: 'wallpaperRust', lights: [[3, 2.5, 0.42]],
  }),
  R('bedroom1', 'Bedroom 1', 'upper', -1, -5.5, 6, 2.6, {
    wall: 'wallpaperRust', lights: [[3, 1.3, 0.42]],
  }),
  R('walkInCloset', 'Walk-In Closet', 'upper', 5, -5.5, 2.4, 2.4, {
    wall: 'wallpaperOchre', dark: true, lights: [[1.2, 1.2, 0.12]],
  }),
  R('bookshelfRoom', 'Bookshelf Room', 'upper', 7.4, -5.5, 4, 2.4, {
    wall: 'wallpaperBlue', lights: [[2, 1.2, 0.3]],
  }),
  R('bedroom2', 'Bedroom 2', 'upper', 5, -3.1, 4.4, 4.4, {
    wall: 'wallpaperGreen', lights: [[2.2, 2.2, 0.42]],
  }),
  R('bathroom', 'Bathroom', 'upper', -7, -0.5, 2, 4, {
    wall: 'tile', floor: 'tile', lights: [[1, 2, 0.42]],
  }),
  R('nursery', 'Nursery', 'upper', -7, 3.5, 6, 5, {
    wall: 'wallpaperBlue', lights: [[3, 2.5, 0.38]],
  }),
  R('mannequinRoom', 'Mannequin Room', 'upper', -13, 3.5, 6, 7, {
    wall: 'plasterDim', dark: true, lights: [[3, 3.5, 0.16]],
  }),
  R('secretEntrance', 'Secret Area Entrance', 'upper', 7, 1.3, 4, 3, {
    wall: 'plasterDim', dark: true, lights: [[2, 1.5, 0.18]],
  }),
  R('hiddenCloset', 'Hidden Closet', 'upper', 7, 4.3, 2, 2, {
    wall: 'woodRaw', dark: true, lights: [[1, 1, 0.12]],
  }),
  R('saPassage', 'Secret Passage', 'upper', 11, 2.3, 2, 1.6, {
    wall: 'woodRaw', floor: 'floorPlankDark', h: 2.1, dark: true,
  }),
  R('saBottomFloor', 'S.A. Bottom Floor', 'upper', 13, -3.3, 4.6, 8.6, {
    wall: 'woodRaw', floor: 'floorPlankDark', dark: true, lights: [[2.3, 6.0, 0.16]],
  }),

  /* --------------------------------------------- ATTIC / SECRET AREA / JAIL */
  R('ventTunnel', 'Vent Tunnel', 'attic', -7, -0.5, 4, 1.9, {
    wall: 'metalDark', floor: 'metalDark', ceil: 'metalDark', h: 1.3, dark: true,
  }),
  R('atticVent', 'Attic Vent', 'attic', -7, 1.4, 2, 2.1, {
    wall: 'metalDark', floor: 'metalDark', ceil: 'metalDark', h: 1.4, dark: true,
  }),
  R('jail', 'Jail', 'attic', -7, 3.5, 6, 4.6, {
    wall: 'plasterDim', floor: 'concreteDark', lights: [[3, 2.3, 0.22]],
  }),
  R('saMiddleFloor', 'S.A. Middle Floor', 'attic', 13, -3.3, 4.6, 4.6, {
    wall: 'woodRaw', floor: 'floorPlankDark', lights: [[2.3, 2.3, 0.22]],
  }),
  R('oldHouseKitchen', 'Abandoned Kitchen', 'attic', 13, -8.3, 4.6, 5, {
    wall: 'plasterDim', floor: 'floorPlankDark', lights: [[2.3, 2.5, 0.22]],
  }),
  R('oldHouseDining', 'Abandoned Dining Room', 'attic', 17.6, -8.3, 4.2, 5, {
    wall: 'plasterDim', floor: 'floorPlankDark', lights: [[2.1, 2.5, 0.2]],
  }),
  R('oldHouseCloset', 'Abandoned Closet', 'attic', 17.6, -3.3, 3, 3, {
    wall: 'woodRaw', dark: true, lights: [[1.5, 1.5, 0.12]],
  }),
  R('saTopFloor', 'S.A. Top Floor', 'attic2', 13, -3.3, 4.6, 4.6, {
    wall: 'woodRaw', floor: 'floorPlankDark', lights: [[2.3, 2.3, 0.22]],
  }),
  R('meatRoom', 'Meat Room', 'attic2', 17.6, -3.3, 4.2, 4.2, {
    wall: 'plasterDim', floor: 'concreteDark', lights: [[2.1, 2.1, 0.2]],
  }),
  R('specialRoom', 'Special Room', 'special', -13, 3.5, 6, 7, {
    wall: 'plaster', lights: [[3, 3.5, 0.5]],
  }),

  /* --------------------------------------------------------------- BASEMENT */
  R('basement', 'Basement', 'basement', -1, -0.5, 8, 7.5, {
    wall: 'brick', floor: 'concreteDark', ceil: 'concreteDark',
    lights: [[2, 2.0, 0.34], [6, 5.5, 0.34]],
  }),
  R('dirtRoom', 'Dirt Room', 'basement', -5, 1, 4, 3.4, {
    wall: 'dirt', floor: 'dirt', ceil: 'dirt', dark: true, lights: [[2, 1.7, 0.14]],
  }),
  R('shedTunnel', 'Shed Tunnel', 'basement', -8, 2, 3, 1.3, {
    wall: 'dirt', floor: 'dirt', ceil: 'dirt', h: 1.3, dark: true,
  }),
  R('secretTunnel', 'Secret Tunnel', 'basement', 7, 2, 4, 1.3, {
    wall: 'dirt', floor: 'dirt', ceil: 'dirt', h: 1.4, dark: true,
  }),

  /* ----------------------------------------------------------------- GARAGE */
  R('garage', 'Garage', 'garage', -1, -0.5, 9, 7.5, {
    wall: 'concrete', floor: 'concrete', ceil: 'concreteDark',
    lights: [[2.2, 2.0, 0.38], [6.6, 5.6, 0.38]],
  }),
  R('sauna', 'Sauna', 'garage', 8, 1, 3, 3, {
    wall: 'woodRaw', floor: 'woodRaw', ceil: 'woodRaw', dark: true,
    lights: [[1.5, 1.5, 0.2]],
  }),
  R('spiderTunnel', 'Spider Cellar Tunnel', 'garage', 5, -3.9, 2.2, 3.4, {
    wall: 'concreteDark', floor: 'concreteDark', ceil: 'concreteDark',
    h: 2.2, dark: true,
  }),

  /* -------------------------------------- SPIDER CELLAR / SEWER (added 1.8) */
  R('spiderEntrance', 'Spider Cellar Entrance', 'sewer', 5, -3.9, 3, 3.4, {
    wall: 'brick', floor: 'dirt', ceil: 'concreteDark', dark: true,
    lights: [[1.5, 1.7, 0.14]],
  }),
  R('cellarHall', 'Spider Cellar', 'sewer', -4, -0.5, 12, 2.2, {
    wall: 'brick', floor: 'dirt', ceil: 'concreteDark', dark: true,
    lights: [[3, 1.1, 0.15], [9, 1.1, 0.15]],
  }),
  R('cupboardRow', 'Spider Cellar', 'sewer', -4, -5.5, 6, 5, {
    wall: 'brick', floor: 'dirt', ceil: 'concreteDark', dark: true,
    lights: [[3, 2.5, 0.15]],
  }),
  R('pipeRoom', 'Pipe Room', 'sewer', -10, -1.5, 6, 7, {
    wall: 'concreteDark', floor: 'concreteDark', ceil: 'concreteDark',
    lights: [[3, 3.5, 0.26]],
  }),
  R('elevator', 'Elevator', 'sewer', -12, 0.5, 2, 2, {
    wall: 'metalDark', floor: 'metalDark', ceil: 'metalDark', h: 2.4,
    lights: [[1, 1, 0.3]],
  }),
  R('chestRoom', 'Chest Room', 'sewer', -16, 0.5, 4, 3.4, {
    wall: 'concreteDark', floor: 'concreteDark', ceil: 'concreteDark',
    lights: [[2, 1.7, 0.26]],
  }),
  R('sewerDrain', 'Sewer Drain', 'sewer', -4, -8.7, 4, 3.2, {
    wall: 'concreteDark', floor: 'concreteDark', ceil: 'concreteDark', dark: true,
    lights: [[2, 1.6, 0.14]],
  }),
  R('sewer', 'Sewer', 'sewer', 0, -8.7, 5, 3.2, {
    wall: 'brick', floor: 'concreteDark', ceil: 'concreteDark',
    lights: [[2.5, 1.6, 0.22]],
  }),
  R('sewerCell', 'Sewer Cell', 'sewer', 0, -11.7, 4, 3, {
    wall: 'brick', floor: 'concreteDark', ceil: 'concreteDark', dark: true,
    lights: [[2, 1.5, 0.16]],
  }),
  R('wheelCrankTunnel', 'Wheel Crank Tunnel', 'sewer', 5, -8.7, 3, 2, {
    wall: 'concreteDark', floor: 'concreteDark', ceil: 'concreteDark',
    h: 2, dark: true,
  }),
];

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map(r => [r.id, r]));

/* ---------------------------------------------------------------- portals */
// kind: open | door | locked | crawl | window | barred | plank | hidden |
//       metalHatch | wheelGate | elevator
const P = (a, b, o = {}) => ({
  a, b, at: o.at ?? 0.5, w: o.w ?? 1.4, h: o.h ?? 2.25,
  bottom: o.bottom ?? 0, kind: o.kind ?? 'door', key: o.key ?? null, ...o,
});

export const PORTALS = [
  /* ground */
  P('foyer', 'kitchen',        { at: 0.11, kind: 'door' }),
  P('foyer', 'livingRoom',     { at: 0.45, kind: 'open', w: 1.6 }),
  P('foyer', 'stairCloset',    { at: 0.50, kind: 'door' }),
  P('foyer', 'study',          { at: 0.45, kind: 'door' }),
  P('diningRoom', 'kitchen',   { at: 0.60, kind: 'open', w: 1.4 }),
  P('diningRoom', 'livingRoom',{ at: 0.55, kind: 'open', w: 1.5 }),
  P('livingRoom', 'stairCloset', { at: 0.50, kind: 'door' }),
  P('stairCloset', 'study',    { at: 0.50, kind: 'door' }),
  // The dining-room window is the usual route into the Backyard.
  P('diningRoom', 'backyard',  { at: 0.55, kind: 'window', w: 1.3, h: 1.25, bottom: 0.95 }),
  P('livingRoom', 'backyard',  { at: 0.30, kind: 'door' }),
  P('backyard', 'shed',        { at: 0.50, kind: 'door' }),
  P('backyard', 'playhouse',   { at: 0.50, kind: 'locked', key: 'playhouseKey', h: 1.8 }),

  /* upper */
  P('hallwayN', 'bedroom1',      { at: 0.50, kind: 'door' }),
  P('hallwayW', 'startingBedroom', { at: 0.50, kind: 'door' }),
  P('hallwayW', 'bathroom',      { at: 0.35, kind: 'door' }),
  P('hallwayW', 'nursery',       { at: 0.50, kind: 'door' }),
  P('hallwayE', 'bedroom2',      { at: 0.50, kind: 'door' }),
  P('hallwayE', 'secretEntrance',{ at: 0.35, kind: 'door' }),
  P('bedroom1', 'startingBedroom', { at: 0.50, kind: 'door' }),
  P('bedroom1', 'walkInCloset',  { at: 0.50, kind: 'door' }),
  P('bedroom2', 'walkInCloset',  { at: 0.50, kind: 'open', w: 1.3 }),
  P('bedroom2', 'bookshelfRoom', { at: 0.50, kind: 'hidden' }),
  P('walkInCloset', 'bookshelfRoom', { at: 0.50, kind: 'door' }),
  P('nursery', 'mannequinRoom',  { at: 0.30, kind: 'plank', w: 1.1 }),
  P('secretEntrance', 'hiddenCloset', { at: 0.50, kind: 'hidden' }),
  P('secretEntrance', 'saPassage',{ at: 0.50, kind: 'crawl', w: 1.0, h: 1.4 }),
  P('saPassage', 'saBottomFloor',{ at: 0.50, kind: 'crawl', w: 1.0, h: 1.4 }),
  // Two-storey Foyer: the upper rooms open onto its balcony.
  P('foyer', 'hallwayN',         { at: 0.50, kind: 'open', w: 2.4 }),
  P('foyer', 'hallwayW',         { at: 0.55, kind: 'open', w: 1.6 }),
  P('foyer', 'hallwayE',         { at: 0.50, kind: 'open', w: 1.6 }),

  /* attic */
  P('ventTunnel', 'atticVent',   { at: 0.50, kind: 'crawl', w: 1.15, h: 1.1 }),
  P('atticVent', 'jail',         { at: 0.50, kind: 'crawl', w: 1.15, h: 1.1 }),
  P('saMiddleFloor', 'oldHouseKitchen', { at: 0.50, kind: 'open', w: 1.3 }),
  P('saMiddleFloor', 'oldHouseCloset',  { at: 0.50, kind: 'plank', w: 1.0 }),
  P('oldHouseKitchen', 'oldHouseDining',{ at: 0.50, kind: 'open', w: 1.4 }),
  P('oldHouseDining', 'oldHouseCloset', { at: 0.50, kind: 'door' }),
  P('saTopFloor', 'meatRoom',    { at: 0.50, kind: 'door' }),

  /* basement */
  P('basement', 'dirtRoom',      { at: 0.40, kind: 'door' }),
  P('dirtRoom', 'shedTunnel',    { at: 0.50, kind: 'crawl', w: 1.15, h: 1.1 }),
  P('basement', 'secretTunnel',  { at: 0.50, kind: 'crawl', w: 1.15, h: 1.2 }),

  /* garage */
  P('garage', 'sauna',           { at: 0.50, kind: 'door' }),
  P('garage', 'spiderTunnel',    { at: 0.50, kind: 'metalHatch', w: 1.0, h: 1.3 }),

  /* spider cellar / sewer */
  P('spiderEntrance', 'cellarHall', { at: 0.50, kind: 'open', w: 1.4 }),
  P('cellarHall', 'cupboardRow', { at: 0.50, kind: 'open', w: 1.5 }),
  P('cellarHall', 'pipeRoom',    { at: 0.50, kind: 'open', w: 1.4 }),
  P('pipeRoom', 'elevator',      { at: 0.50, kind: 'open', w: 1.4 }),
  P('elevator', 'chestRoom',     { at: 0.50, kind: 'elevator', w: 1.4 }),
  P('cupboardRow', 'sewerDrain', { at: 0.50, kind: 'barred', w: 1.4 }),
  P('sewerDrain', 'sewer',       { at: 0.50, kind: 'open', w: 1.3 }),
  P('sewer', 'sewerCell',        { at: 0.50, kind: 'door' }),
  P('sewer', 'wheelCrankTunnel', { at: 0.50, kind: 'wheelGate', w: 1.1, h: 1.9 }),
];

/* ---------------------------------------------------------------- windows */
// side: N | S | E | W of that room's rect. Every bedroom in the reference
// screenshots has one, and they are the only reason the upper floor reads as
// being above ground.
const WIN = (room, side, o = {}) => ({
  room, side, at: o.at ?? 0.5, w: o.w ?? 1.15, h: o.h ?? 1.15,
  bottom: o.bottom ?? 1.0,
});

export const WINDOWS = [
  WIN('startingBedroom', 'W', { at: 0.5 }),
  WIN('startingBedroom', 'N', { at: 0.35 }),
  WIN('bedroom1', 'N', { at: 0.5 }),
  WIN('bedroom2', 'E', { at: 0.5 }),
  WIN('bookshelfRoom', 'E', { at: 0.5 }),
  WIN('nursery', 'W', { at: 0.5 }),
  WIN('bathroom', 'W', { at: 0.6, w: 0.7, h: 0.8, bottom: 1.4 }),
  WIN('diningRoom', 'W', { at: 0.5 }),
  WIN('livingRoom', 'E', { at: 0.4 }),
  WIN('kitchen', 'W', { at: 0.4 }),
  WIN('kitchen', 'S', { at: 0.5 }),
  WIN('study', 'E', { at: 0.5 }),
  WIN('study', 'S', { at: 0.5 }),
  WIN('mannequinRoom', 'W', { at: 0.35 }),
  WIN('specialRoom', 'W', { at: 0.5 }),
];

/* ----------------------------------------------------------------- stairs */
export const STAIRS = [
  { id: 'foyerStairs',    in: 'foyer',        from: 'ground',   to: 'upper',
    x: 2.0,  z: 5.15, dir: 'N', width: 1.5, run: 4.4, rail: true },
  { id: 'basementStairs', in: 'foyer',        from: 'ground',   to: 'basement',
    x: -0.25, z: 5.3, dir: 'N', width: 1.2, run: 4.2, door: true },
  { id: 'garageStairs',   in: 'basement',     from: 'basement', to: 'garage',
    x: 5.6,  z: 5.9, dir: 'N', width: 1.3, run: 4.2 },
  { id: 'nurseryStairs',  in: 'nursery',      from: 'upper',    to: 'attic',
    x: -6.0, z: 7.4, dir: 'N', width: 1.2, run: 3.6 },
  { id: 'specialStairs',  in: 'mannequinRoom',from: 'upper',    to: 'special',
    x: -12.0,z: 9.4, dir: 'N', width: 1.2, run: 5.4, locked: 'specialKey' },
  { id: 'saStairsA',      in: 'saBottomFloor',from: 'upper',    to: 'attic',
    x: 14.2, z: 1.0, dir: 'N', width: 1.2, run: 3.8 },
  { id: 'saStairsB',      in: 'saMiddleFloor',from: 'attic',    to: 'attic2',
    x: 16.4, z: 0.3, dir: 'N', width: 1.2, run: 3.2 },
];

/* ----------------------------------- trapdoors (one-way) and ladders (two-way) */
// Trapdoors move the player to an explicit destination rather than requiring
// the two rooms to be stacked -- the wiki map's drops criss-cross the house.
export const DROPS = [
  { id: 'livingTrapdoor', from: ['livingRoom', 4.0, 3.0], to: ['spiderEntrance', 1.5, 2.4],
    key: 'spiderKey', label: 'Spider Cellar' },
  { id: 'playhouseDrop',  from: ['playhouse', 1.5, 1.5],  to: ['spiderEntrance', 1.5, 1.0],
    key: null, label: 'Sewer Entrance' },
  { id: 'ventDrop',       from: ['ventTunnel', 2.0, 1.0], to: ['bathroom', 1.0, 2.0],
    key: null, label: 'Bathroom' },
  { id: 'oldHouseDrop',   from: ['oldHouseDining', 0.85, 1.0], to: ['sewer', 2.5, 1.6],
    key: null, label: 'Sewer' },
];

export const LADDERS = [
  { id: 'secretLadder', a: ['secretTunnel', 3.4, 0.65], b: ['saBottomFloor', 0.8, 7.6] },
  { id: 'spiderLadder', a: ['spiderTunnel', 1.1, 1.7],  b: ['spiderEntrance', 1.5, 1.7] },
];

/* -------------------------------------------------- creaking floorboards */
export const CREAKS = [
  ['startingBedroom', 1.4, 1.2], ['bedroom1', 3.6, 1.3], ['bedroom2', 2.6, 1.4],
  ['bathroom', 1.0, 2.6], ['nursery', 2.8, 2.6], ['mannequinRoom', 3.4, 3.0],
  ['hallwayN', 2.4, 1.2], ['hallwayW', 1.6, 1.0], ['hallwayE', 1.0, 3.4],
  ['foyer', 3.4, 3.0], ['diningRoom', 3.4, 2.6], ['livingRoom', 2.0, 2.0],
  ['study', 2.0, 1.4], ['kitchen', 2.0, 4.4], ['specialRoom', 3.0, 2.4],
  ['saTopFloor', 2.2, 1.8], ['saMiddleFloor', 2.2, 1.8], ['jail', 2.4, 2.2],
  ['basement', 4.0, 3.0], ['garage', 4.0, 3.0], ['cellarHall', 3.0, 1.0],
  ['oldHouseKitchen', 2.3, 2.5], ['saBottomFloor', 2.3, 4.0],
];

/* -------------------------------------------------- Granny's patrol graph */
export const WAYPOINTS = [
  ['foyer', 3.0, 3.5], ['foyer', 1.5, 6.0], ['kitchen', 3.0, 2.7],
  ['diningRoom', 3.0, 2.5], ['livingRoom', 3.5, 2.5], ['study', 2.2, 2.2],
  ['backyard', 6.0, 4.0], ['backyard', 14.0, 4.0], ['shed', 1.5, 1.7],
  ['hallwayN', 3.0, 1.2], ['hallwayE', 1.0, 2.2], ['hallwayW', 2.0, 2.0],
  ['startingBedroom', 3.0, 2.5], ['bedroom1', 3.0, 1.3], ['bedroom2', 2.2, 2.2],
  ['bathroom', 1.0, 2.0], ['nursery', 3.0, 2.5], ['mannequinRoom', 3.0, 3.5],
  ['bookshelfRoom', 2.0, 1.2], ['secretEntrance', 2.0, 1.5],
  ['saBottomFloor', 2.3, 4.0], ['saMiddleFloor', 2.3, 2.3], ['saTopFloor', 2.3, 2.3],
  ['oldHouseKitchen', 2.3, 2.5], ['oldHouseDining', 2.1, 2.5], ['meatRoom', 2.1, 2.1],
  ['jail', 3.0, 2.3], ['basement', 4.0, 3.7], ['dirtRoom', 2.0, 1.7],
  ['garage', 4.5, 3.7], ['specialRoom', 3.0, 3.5], ['cellarHall', 6.0, 1.1],
];

export const PLAYER_SPAWN = { room: 'startingBedroom', x: 3.0, z: 2.6, yaw: 0 };
export const GRANNY_SPAWN = { room: 'foyer', x: 3.0, z: 3.5 };

export function toWorld(roomId, lx, lz) {
  const r = ROOM_BY_ID[roomId];
  if (!r) throw new Error('no room ' + roomId);
  return { x: r.x + lx, y: LEVELS[r.lvl], z: r.z + lz };
}
