// textures.js -- procedural material library.
//
// Every texture here is generated at runtime on a 2D canvas. Nothing is
// extracted from the shipping game; the palettes and wear patterns were
// matched by eye against reference screenshots of v1.8:
//   * wallpaper  -- rust/oxblood base, white plaster showing through in
//                   torn blotches, vertical damp streaks
//   * plaster    -- cold grey with warm brown water stains and hairline cracks
//   * floor      -- very desaturated planks, heavy lengthwise grain, dark seams
//   * wood trim  -- mid brown, strong dark grain, slightly warmer than floors
import * as THREE from '../vendor/three.module.js?v=12';

/* ------------------------------------------------------------------ noise */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise: the lattice wraps at `period` so textures repeat
// seamlessly across a wall run.
function makeLattice(period, rng) {
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return g;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function sampleLattice(g, period, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const x0 = ((xi % period) + period) % period, x1 = (x0 + 1) % period;
  const y0 = ((yi % period) + period) % period, y1 = (y0 + 1) % period;
  const a = g[y0 * period + x0], b = g[y0 * period + x1];
  const c = g[y1 * period + x0], d = g[y1 * period + x1];
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

// Fractal brownian motion over several tileable octaves.
function fbm(lattices, period, u, v, octaves, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, freq = period;
  for (let o = 0; o < octaves; o++) {
    sum += amp * sampleLattice(lattices[o], freq, u * freq, v * freq);
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}

function noiseStack(basePeriod, octaves, rng) {
  const out = [];
  let p = basePeriod;
  for (let o = 0; o < octaves; o++) { out.push(makeLattice(p, rng)); p *= 2; }
  return out;
}

/* ------------------------------------------------------------- canvas util */

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function mixHex(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Walks every pixel and lets the caller return an [r,g,b] for it.
function paint(size, fn) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const rgb = fn(x / size, y / size, x, y);
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const CACHE = new Map();

function toTexture(key, c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.name = key;
  return t;
}

// Derives a greyscale height map from a colour canvas so surfaces catch light
// at grazing angles the way the game's baked bump maps do.
function bumpFrom(src, strength = 1) {
  const size = src.width;
  const sctx = src.getContext('2d');
  const sd = sctx.getImageData(0, 0, size, size).data;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const l = (sd[i * 4] * 0.3 + sd[i * 4 + 1] * 0.59 + sd[i * 4 + 2] * 0.11);
    const v = Math.max(0, Math.min(255, 128 + (l - 128) * strength));
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* -------------------------------------------------------------- generators */

const SIZE = 256;

// Peeling wallpaper. `base` is the paper colour, plaster shows through where
// the fbm mask crosses a threshold -- that gives the torn-edge look rather
// than soft blobs.
function wallpaper(seed, base, accent) {
  const rng = mulberry32(seed);
  const tear = noiseStack(30, 3, rng);   // high frequency -> small flakes
  const patch = noiseStack(5, 4, rng);   // where the paper is worst affected
  const damp = noiseStack(2, 3, rng);
  const fine = noiseStack(28, 3, rng);
  const plaster = [206, 200, 189];
  return paint(SIZE, (u, v) => {
    // v is compressed, which stretches every feature vertically
    const t = fbm(tear, 30, u, v * 0.55, 3);
    const pt = fbm(patch, 5, u, v, 4);
    const dm = fbm(damp, 2, u, v, 3);
    const fg = fbm(fine, 28, u, v, 3);

    let col = mixHex(base, accent, dm * 0.6);
    // vertical damp staining, heavier low down
    col = mixHex(col, [46, 34, 28], Math.pow(v, 2.5) * dm * 0.4);

    // The paper lifts where both the coarse patch mask and the fine tear mask
    // agree -- that gives clustered flakes rather than uniform speckle.
    const bias = (pt - 0.5) * 0.30;
    const edge = (t - (0.60 - bias)) * 13;
    if (edge > 0) {
      const k = Math.min(1, edge);
      col = mixHex(col, plaster, k * 0.86);
      if (k < 0.34) col = mixHex(col, [70, 54, 46], (0.34 - k) * 1.0); // torn edge shadow
    }
    const n = (fg - 0.5) * 22;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

// Stained plaster wall (foyer, hallway, basement).
function plasterWall(seed, base, stain, crackAmt) {
  const rng = mulberry32(seed);
  const blot = noiseStack(3, 5, rng);
  const grain = noiseStack(24, 3, rng);
  const crack = noiseStack(6, 4, rng);
  return paint(SIZE, (u, v) => {
    const b = fbm(blot, 3, u, v, 5);
    const g = fbm(grain, 24, u, v, 3);
    let col = mixHex(base, stain, Math.pow(b, 1.4) * 1.35);
    // grime creeping up from the skirting and down from the ceiling
    col = mixHex(col, [52, 46, 40], Math.pow(v, 6) * 0.5 + Math.pow(1 - v, 8) * 0.4);
    if (crackAmt > 0) {
      // Only the deepest part of the ridge becomes a crack, and only where
      // the blotch mask says the surface is already damaged -- that keeps them
      // sparse and directional instead of a uniform web.
      const c = Math.abs(fbm(crack, 6, u, v, 4) - 0.5);
      const w = 0.006 * crackAmt;
      if (c < w && b > 0.46) col = mixHex(col, [46, 42, 38], (1 - c / w) * 0.85);
    }
    const n = (g - 0.5) * 30;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

// Plank flooring. Planks run along U; each gets its own tone offset so the
// floor reads as boards rather than a single noisy sheet.
function planks(seed, base, dark, count, opts = {}) {
  const rng = mulberry32(seed);
  const grain = noiseStack(2, 5, rng);
  const fine = noiseStack(32, 3, rng);
  const wear = noiseStack(4, 4, rng);
  const tone = [];
  for (let i = 0; i < count; i++) tone.push(rng());
  const seam = opts.seam ?? 0.018;
  return paint(SIZE, (u, v) => {
    const row = Math.floor(v * count);
    const inRow = v * count - row;
    const shift = tone[row] * 0.5; // stagger the grain per board
    // stretch the noise along the board direction to make lengthwise grain
    const g = fbm(grain, 2, (u + shift) * 0.35, v * 5.5, 5);
    const f = fbm(fine, 32, u * 0.5, v * 3, 3);
    const w = fbm(wear, 4, u, v, 4);

    let col = mixHex(base, dark, g * 0.85);
    col = mixHex(col, dark, tone[row] * 0.3);
    col = mixHex(col, [230, 226, 218], Math.max(0, w - 0.62) * (opts.scuff ?? 0.55));
    // dark gap between boards
    if (inRow < seam || inRow > 1 - seam) col = mixHex(col, [18, 15, 13], 0.75);
    const n = (f - 0.5) * 22;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

// Solid timber for doors, furniture and trim -- tighter, warmer grain.
function timber(seed, base, dark) {
  const rng = mulberry32(seed);
  const grain = noiseStack(2, 5, rng);
  const fine = noiseStack(24, 3, rng);
  return paint(SIZE, (u, v) => {
    // ring-like grain: warp v by low frequency noise, then band it
    const warp = fbm(grain, 2, u * 0.6, v * 0.6, 4);
    const rings = Math.abs(Math.sin((v * 5 + warp * 1.1) * Math.PI));
    const f = fbm(fine, 24, u * 0.4, v * 3.2, 3);
    // soft, wide rings plus a fine streak that runs with the board
    let col = mixHex(base, dark, Math.pow(rings, 1.9) * 0.5);
    col = mixHex(col, dark, Math.max(0, f - 0.58) * 1.1);
    const n = (f - 0.5) * 12;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

function concrete(seed, base) {
  const rng = mulberry32(seed);
  const blot = noiseStack(4, 5, rng);
  const spec = noiseStack(64, 2, rng);
  return paint(SIZE, (u, v) => {
    const b = fbm(blot, 4, u, v, 5);
    const s = fbm(spec, 64, u, v, 2);
    let col = mixHex(base, [58, 55, 52], Math.pow(b, 2) * 0.8);
    col = mixHex(col, [90, 78, 62], Math.max(0, b - 0.7) * 0.9);
    const n = (s - 0.5) * 34;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

function rustedMetal(seed, base) {
  const rng = mulberry32(seed);
  const rust = noiseStack(5, 5, rng);
  const fine = noiseStack(48, 3, rng);
  return paint(SIZE, (u, v) => {
    const r = fbm(rust, 5, u, v, 5);
    const f = fbm(fine, 48, u, v, 3);
    let col = mixHex(base, [112, 62, 34], Math.max(0, r - 0.45) * 1.7);
    col = mixHex(col, [30, 28, 27], Math.max(0, 0.4 - r) * 1.2);
    const n = (f - 0.5) * 24;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

function brick(seed) {
  const rng = mulberry32(seed);
  const fine = noiseStack(32, 3, rng);
  const blot = noiseStack(6, 4, rng);
  const tone = [];
  for (let i = 0; i < 256; i++) tone.push(rng());
  const rows = 8, cols = 4;
  return paint(SIZE, (u, v) => {
    const row = Math.floor(v * rows);
    const off = (row % 2) * 0.5;
    const cu = (u * cols + off) % 1;
    const cv = v * rows - row;
    const mortar = 0.06;
    const f = fbm(fine, 32, u, v, 3), b = fbm(blot, 6, u, v, 4);
    if (cu < mortar || cu > 1 - mortar || cv < mortar * 2 || cv > 1 - mortar * 2) {
      const m = mixHex([124, 120, 112], [78, 74, 68], b);
      const n = (f - 0.5) * 22;
      return [m[0] + n, m[1] + n, m[2] + n];
    }
    const idx = (row * cols + Math.floor(u * cols + off)) % 256;
    let col = mixHex([104, 62, 48], [70, 44, 36], tone[idx]);
    col = mixHex(col, [58, 52, 48], Math.pow(b, 2) * 0.6);
    const n = (f - 0.5) * 20;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

function dirtGround(seed) {
  const rng = mulberry32(seed);
  const lumps = noiseStack(4, 5, rng);
  const fine = noiseStack(48, 3, rng);
  return paint(SIZE, (u, v) => {
    const l = fbm(lumps, 4, u, v, 5);
    const f = fbm(fine, 48, u, v, 3);
    let col = mixHex([62, 52, 40], [34, 28, 22], l);
    col = mixHex(col, [78, 70, 52], Math.max(0, l - 0.72) * 1.4);
    const n = (f - 0.5) * 30;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

function grassGround(seed) {
  const rng = mulberry32(seed);
  const patch = noiseStack(4, 5, rng);
  const blade = noiseStack(64, 3, rng);
  return paint(SIZE, (u, v) => {
    const p = fbm(patch, 4, u, v, 5);
    const b = fbm(blade, 64, u, v, 3);
    let col = mixHex([44, 52, 32], [26, 30, 20], p);
    col = mixHex(col, [58, 50, 32], Math.max(0, p - 0.68) * 1.3);
    const n = (b - 0.5) * 34;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

function tiles(seed) {
  const rng = mulberry32(seed);
  const fine = noiseStack(32, 3, rng);
  const grime = noiseStack(5, 4, rng);
  const n8 = []; for (let i = 0; i < 64; i++) n8.push(rng());
  const cells = 6;
  return paint(SIZE, (u, v) => {
    const cx = Math.floor(u * cells), cy = Math.floor(v * cells);
    const fu = u * cells - cx, fv = v * cells - cy;
    const f = fbm(fine, 32, u, v, 3), g = fbm(grime, 5, u, v, 4);
    const gap = 0.05;
    if (fu < gap || fu > 1 - gap || fv < gap || fv > 1 - gap) {
      const m = mixHex([96, 92, 84], [56, 52, 46], g);
      return [m[0], m[1], m[2]];
    }
    let col = mixHex([176, 172, 162], [140, 136, 128], n8[(cy * cells + cx) % 64]);
    col = mixHex(col, [92, 84, 70], Math.pow(g, 2) * 0.7);
    const nn = (f - 0.5) * 16;
    return [col[0] + nn, col[1] + nn, col[2] + nn];
  });
}

function fabric(seed, base) {
  const rng = mulberry32(seed);
  const weave = noiseStack(48, 3, rng);
  const stain = noiseStack(4, 4, rng);
  return paint(SIZE, (u, v) => {
    const w = fbm(weave, 48, u, v, 3);
    const s = fbm(stain, 4, u, v, 4);
    let col = mixHex(base, [50, 44, 40], Math.pow(s, 2) * 0.65);
    const thread = (Math.sin(u * SIZE * 0.7) + Math.sin(v * SIZE * 0.7)) * 4;
    const n = (w - 0.5) * 18 + thread;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

// Granny's skin: pallid grey-green, blotchy, with darker creases.
function skin(seed) {
  const rng = mulberry32(seed);
  const blot = noiseStack(6, 4, rng);
  const fine = noiseStack(40, 3, rng);
  return paint(128, (u, v) => {
    const b = fbm(blot, 6, u, v, 4);
    const f = fbm(fine, 40, u, v, 3);
    let col = mixHex([138, 131, 121], [104, 98, 91], b);
    col = mixHex(col, [92, 80, 76], Math.max(0, b - 0.66) * 1.3);
    const n = (f - 0.5) * 16;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

// Her nightgown: off-white linen, grubby at the hem.
function nightgown(seed) {
  const rng = mulberry32(seed);
  const w = noiseStack(32, 3, rng);
  const s = noiseStack(4, 4, rng);
  return paint(128, (u, v) => {
    const wv = fbm(w, 32, u, v, 3), sv = fbm(s, 4, u, v, 4);
    let col = mixHex([190, 187, 178], [148, 144, 135], sv * 0.85);
    col = mixHex(col, [96, 91, 83], Math.pow(v, 3) * 0.62); // dirty hem
    const n = (wv - 0.5) * 14;
    return [col[0] + n, col[1] + n, col[2] + n];
  });
}

/* --------------------------------------------------------------- registry */

const RECIPES = {
  wallpaperRust:  () => wallpaper(11, [104, 74, 62], [78, 52, 44]),
  wallpaperGreen: () => wallpaper(22, [74, 82, 62], [52, 58, 44]),
  wallpaperBlue:  () => wallpaper(33, [70, 78, 88], [48, 54, 62]),
  wallpaperOchre: () => wallpaper(44, [122, 100, 62], [88, 70, 44]),
  plaster:        () => plasterWall(55, [138, 134, 126], [104, 88, 62], 1),
  plasterDim:     () => plasterWall(66, [104, 100, 94], [78, 66, 48], 1.4),
  plasterCeiling: () => plasterWall(77, [92, 90, 86], [66, 60, 52], 0.6),
  floorPlank:     () => planks(88, [112, 110, 105], [50, 49, 47], 6, { scuff: 0.7 }),
  floorPlankDark: () => planks(99, [96, 94, 90], [42, 41, 39], 6, { scuff: 0.6 }),
  ceilingPlank:   () => planks(101, [84, 84, 82], [34, 34, 33], 7, { scuff: 0.25 }),
  woodDoor:       () => timber(112, [110, 82, 56], [52, 37, 25]),
  woodTrim:       () => timber(123, [96, 70, 48], [46, 32, 22]),
  woodFurniture:  () => timber(134, [92, 68, 46], [42, 30, 21]),
  woodRaw:        () => timber(145, [134, 106, 74], [76, 56, 36]),
  concrete:       () => concrete(156, [126, 122, 116]),
  concreteDark:   () => concrete(167, [88, 86, 82]),
  metal:          () => rustedMetal(178, [104, 104, 108]),
  metalDark:      () => rustedMetal(189, [72, 72, 76]),
  brick:          () => brick(190),
  dirt:           () => dirtGround(201),
  grass:          () => grassGround(212),
  tile:           () => tiles(223),
  fabricRed:      () => fabric(234, [104, 58, 52]),
  fabricGrey:     () => fabric(245, [96, 92, 88]),
  skin:           () => skin(256),
  gown:           () => nightgown(267),
};

// How many metres of surface one tile of each texture should cover. Wallpaper
// patterns are small and repeat quickly; plaster and concrete are near-uniform
// and can stretch much further before the tiling reads as a grid.
export const TILE_METRES = {
  wallpaperRust: 2.3, wallpaperGreen: 2.3, wallpaperBlue: 2.3, wallpaperOchre: 2.3,
  plaster: 2.9, plasterDim: 2.9, plasterCeiling: 3.2,
  floorPlank: 1.9, floorPlankDark: 1.9, ceilingPlank: 2.1,
  woodDoor: 1.25, woodTrim: 1.1, woodFurniture: 1.1, woodRaw: 1.3,
  concrete: 2.6, concreteDark: 2.6, metal: 1.5, metalDark: 1.5,
  brick: 1.7, dirt: 2.4, grass: 3.2, tile: 1.5,
  fabricRed: 1.2, fabricGrey: 1.2, skin: 1, gown: 1,
};

export const tileScale = (name) => TILE_METRES[name] ?? 1.6;

export function tex(name, repeat) {
  const key = name + '|' + (repeat ? repeat.join('x') : '1');
  if (CACHE.has(key)) return CACHE.get(key);
  const recipe = RECIPES[name];
  if (!recipe) throw new Error('unknown texture: ' + name);
  const srcKey = 'canvas:' + name;
  let c = CACHE.get(srcKey);
  if (!c) { c = recipe(); CACHE.set(srcKey, c); }
  const t = toTexture(name, c, repeat);
  CACHE.set(key, t);
  return t;
}

export function bump(name, repeat, strength = 1) {
  const key = 'bump|' + name + '|' + (repeat ? repeat.join('x') : '1');
  if (CACHE.has(key)) return CACHE.get(key);
  const srcKey = 'canvas:' + name;
  let c = CACHE.get(srcKey);
  if (!c) { c = RECIPES[name](); CACHE.set(srcKey, c); }
  const t = bumpFrom(c, strength);
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  CACHE.set(key, t);
  return t;
}

// Convenience: a lit-surface material with matching bump.
export function mat(name, repeat, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: tex(name, repeat),
    roughness: opts.roughness ?? 0.94,
    metalness: opts.metalness ?? 0.0,
    side: opts.side ?? THREE.FrontSide,
  });
  if (opts.bump !== false) {
    m.bumpMap = bump(name, repeat, opts.bumpStrength ?? 1);
    m.bumpScale = opts.bumpScale ?? 0.35;
  }
  if (opts.color) m.color.setHex(opts.color);
  if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 1; }
  return m;
}

export const rawCanvas = (name) => {
  const srcKey = 'canvas:' + name;
  if (!CACHE.has(srcKey)) CACHE.set(srcKey, RECIPES[name]());
  return CACHE.get(srcKey);
};
