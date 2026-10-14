// world.js -- turns floorplan data into geometry + collision.
//
// Everything solid in the game is an axis-aligned box. Walls, floors, stair
// treads and furniture all register the same way, which makes collision a
// single sweep and lets the player step up onto anything <= STEP_HEIGHT
// without special-casing stairs.
import * as THREE from '../vendor/three.module.js?v=9';
import { mat, tex, tileScale } from './textures.js?v=9';
import {
  LEVELS, ROOMS, ROOM_BY_ID, PORTALS, WINDOWS, STAIRS, DROPS, LADDERS, CREAKS, WALL_H,
} from './floorplan.js?v=9';

export const STEP_HEIGHT = 0.42;
const PANEL = 0.09;           // half-thickness of a room's own wall panel
const SLAB = 0.22;            // floor slab thickness

/* ------------------------------------------------------------ rect helpers */

// Subtract `hole` from axis-aligned `r`, returning up to 4 remaining rects.
function rectSubtract(r, hole) {
  const x0 = r.x, x1 = r.x + r.w, z0 = r.z, z1 = r.z + r.d;
  const hx0 = Math.max(x0, hole.x), hx1 = Math.min(x1, hole.x + hole.w);
  const hz0 = Math.max(z0, hole.z), hz1 = Math.min(z1, hole.z + hole.d);
  if (hx0 >= hx1 || hz0 >= hz1) return [r];            // no overlap
  const out = [];
  if (hz0 > z0) out.push({ x: x0, z: z0, w: x1 - x0, d: hz0 - z0 });
  if (hz1 < z1) out.push({ x: x0, z: hz1, w: x1 - x0, d: z1 - hz1 });
  if (hx0 > x0) out.push({ x: x0, z: hz0, w: hx0 - x0, d: hz1 - hz0 });
  if (hx1 < x1) out.push({ x: hx1, z: hz0, w: x1 - hx1, d: hz1 - hz0 });
  return out.filter(q => q.w > 0.02 && q.d > 0.02);
}

function rectsMinusHoles(rect, holes) {
  let list = [rect];
  for (const h of holes) list = list.flatMap(r => rectSubtract(r, h));
  return list;
}

/* -------------------------------------------------------------- the world */

export class World {
  constructor(scene) {
    this.scene = scene;
    this.solids = [];        // {min,max,tag,ref}
    this.doors = [];
    this.interactables = [];
    this.creaks = [];
    this.drops = [];
    this.rooms = ROOMS;
    this.roomRects = [];     // for locating which room a point is in
    this.lights = [];
    this._matCache = new Map();
    this._geo = new THREE.BoxGeometry(1, 1, 1);
  }

  m(name, repeat, opts) {
    const key = name + '|' + (repeat || []).join('x') + '|' + JSON.stringify(opts || {});
    if (!this._matCache.has(key)) this._matCache.set(key, mat(name, repeat, opts));
    return this._matCache.get(key);
  }

  // Core primitive: a textured box that is also (optionally) a collider.
  box(x, y, z, w, h, d, matName, opts = {}) {
    const k = tileScale(matName);
    const rep = opts.repeat || [Math.max(0.35, w / k), Math.max(0.35, h / k)];
    const mesh = new THREE.Mesh(this._geo, this.m(matName, rep, opts.matOpts));
    mesh.scale.set(w, h, d);
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
    mesh.castShadow = opts.castShadow ?? false;
    mesh.receiveShadow = true;
    if (opts.tint !== undefined) {
      mesh.material = mesh.material.clone();
      mesh.material.color.setHex(opts.tint);
    }
    this.scene.add(mesh);
    if (opts.solid !== false) {
      this.solids.push({
        min: { x, y, z }, max: { x: x + w, y: y + h, z: z + d },
        tag: opts.tag || 'world', ref: opts.ref || null, mesh,
      });
    }
    return mesh;
  }

  addSolid(min, max, tag, ref) {
    const s = { min, max, tag, ref };
    this.solids.push(s);
    return s;
  }

  /* ------------------------------------------------------------- building */

  build() {
    this._collectOpenings();
    this._collectWindows();
    for (const r of ROOMS) this._buildRoom(r);
    for (const p of this._portals) this._buildPortalFurniture(p);
    for (const w of this.windows) this._buildWindow(w);
    for (const s of STAIRS) this._buildStairs(s);
    for (const d of DROPS) this._buildDrop(d);
    for (const l of LADDERS) this._buildLadder(l);
    for (const [room, lx, lz] of CREAKS) {
      const r = ROOM_BY_ID[room];
      this.creaks.push({ x: r.x + lx, z: r.z + lz, y: LEVELS[r.lvl], r: 0.75, room });
    }
    this._buildBalcony();
    this._buildExterior();
    return this;
  }

  // Resolve every portal into a world-space opening on a shared wall line,
  // plus a note of which two rooms it joins.
  _collectOpenings() {
    this._portals = [];
    this.openingsByRoom = new Map();
    for (const r of ROOMS) this.openingsByRoom.set(r.id, []);

    for (const p of PORTALS) {
      const A = ROOM_BY_ID[p.a], B = ROOM_BY_ID[p.b];
      if (!A || !B) { console.warn('portal refers to missing room', p); continue; }
      const seg = sharedEdge(A, B);
      if (!seg) { console.warn('rooms do not touch:', p.a, p.b); continue; }
      const span = seg.t1 - seg.t0;
      const w = Math.min(p.w, span - 0.2);
      const centre = seg.t0 + span * p.at;
      const t0 = Math.max(seg.t0 + 0.06, Math.min(seg.t1 - 0.06 - w, centre - w / 2));
      const yBase = Math.max(LEVELS[A.lvl], LEVELS[B.lvl]);
      const op = {
        axis: seg.axis, line: seg.line, t0, t1: t0 + w,
        bottom: yBase + p.bottom, top: yBase + p.bottom + p.h,
        portal: p, rooms: [A.id, B.id],
      };
      this.openingsByRoom.get(A.id).push(op);
      this.openingsByRoom.get(B.id).push(op);
      this._portals.push({ ...p, op, A, B, yBase });
    }
  }

  // Exterior windows: same opening record as a portal, but owned by one room.
  _collectWindows() {
    this.windows = [];
    for (const wdef of WINDOWS) {
      const r = ROOM_BY_ID[wdef.room];
      if (!r) { console.warn('window on missing room', wdef.room); continue; }
      const y = LEVELS[r.lvl];
      const horizontal = wdef.side === 'N' || wdef.side === 'S';
      const line = wdef.side === 'N' ? r.z : wdef.side === 'S' ? r.z + r.d
                 : wdef.side === 'W' ? r.x : r.x + r.w;
      const t0e = horizontal ? r.x : r.z;
      const t1e = horizontal ? r.x + r.w : r.z + r.d;
      const span = t1e - t0e;
      const w = Math.min(wdef.w, span - 0.4);
      const t0 = t0e + (span - w) * wdef.at;
      const op = {
        axis: horizontal ? 'x' : 'z', line, t0, t1: t0 + w,
        bottom: y + wdef.bottom, top: y + wdef.bottom + wdef.h,
        window: true, rooms: [r.id],
      };
      this.openingsByRoom.get(r.id).push(op);
      this.windows.push({ op, room: r });
    }
  }

  _buildRoom(r) {
    const y = LEVELS[r.lvl];
    const holes = this._floorHolesFor(r);

    // Floor slab, split around any stairwell holes.
    if (!r.noFloor) {
      for (const q of rectsMinusHoles({ x: r.x, z: r.z, w: r.w, d: r.d }, holes)) {
        this.box(q.x, y - SLAB, q.z, q.w, SLAB, q.d, r.floor,
          { repeat: [q.w / tileScale(r.floor), q.d / tileScale(r.floor)], tag: 'floor', ref: r.id });
      }
    }
    // Ceiling.
    if (!r.noCeil) {
      for (const q of rectsMinusHoles({ x: r.x, z: r.z, w: r.w, d: r.d }, this._ceilHolesFor(r))) {
        this.box(q.x, y + r.h, q.z, q.w, 0.14, q.d, r.ceil,
          { repeat: [q.w / tileScale(r.ceil), q.d / tileScale(r.ceil)], tag: 'ceil', ref: r.id });
      }
    }

    // Four wall panels, each inset into the room and split around openings.
    const ops = this.openingsByRoom.get(r.id) || [];
    const edges = [
      { axis: 'x', line: r.z,        t0: r.x, t1: r.x + r.w, inward: +1 }, // north
      { axis: 'x', line: r.z + r.d,  t0: r.x, t1: r.x + r.w, inward: -1 }, // south
      { axis: 'z', line: r.x,        t0: r.z, t1: r.z + r.d, inward: +1 }, // west
      { axis: 'z', line: r.x + r.w,  t0: r.z, t1: r.z + r.d, inward: -1 }, // east
    ];
    for (const e of edges) {
      const on = ops.filter(o => o.axis === e.axis && Math.abs(o.line - e.line) < 0.01);
      this._buildWallRun(r, e, on, y);
    }

    if (!r.outdoor && r.floor !== 'dirt' && r.floor !== 'grass') this._skirting(r, y);

    this.roomRects.push({ id: r.id, x: r.x, z: r.z, w: r.w, d: r.d, y, h: r.h, room: r });
    if (r.lights) {
      for (const [lx, lz, inten] of r.lights) {
        this.lights.push({ x: r.x + lx, y: y + r.h - 0.45, z: r.z + lz, intensity: inten, room: r.id });
      }
    }
  }

  // Emit the solid pieces of one wall edge: full-height spans between
  // openings, plus lintels above and sills below each opening.
  _buildWallRun(r, e, ops, y) {
    const sorted = ops.slice().sort((a, b) => a.t0 - b.t0);
    const k = tileScale(r.wall);
    const rep = (len, h) => [Math.max(0.35, len / k), Math.max(0.35, h / k)];
    const place = (t0, t1, yy, hh) => {
      const len = t1 - t0;
      if (len < 0.03 || hh < 0.03) return;
      if (e.axis === 'x') {
        const z = e.inward > 0 ? e.line : e.line - PANEL;
        this.box(t0, yy, z, len, hh, PANEL, r.wall, { repeat: rep(len, hh), tag: 'wall', ref: r.id });
      } else {
        const x = e.inward > 0 ? e.line : e.line - PANEL;
        this.box(x, yy, t0, PANEL, hh, len, r.wall, { repeat: rep(len, hh), tag: 'wall', ref: r.id });
      }
    };

    // Walking the openings in order and emitting a sill/lintel for each is
    // wrong when two of them overlap along the wall: the Study door and the
    // Foyer balcony opening share a line, and the balcony's sill was filling in
    // the bottom half of the doorway. So instead: cut the run at every opening
    // boundary, and for each slice work out the union of the vertical holes
    // covering it. Solid goes in the gaps between those merged holes.
    const cuts = new Set([e.t0, e.t1]);
    for (const o of sorted) {
      if (o.t0 > e.t0 && o.t0 < e.t1) cuts.add(o.t0);
      if (o.t1 > e.t0 && o.t1 < e.t1) cuts.add(o.t1);
    }
    const edges = [...cuts].sort((a, b) => a - b);

    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i], b = edges[i + 1];
      if (b - a < 0.02) continue;
      const mid = (a + b) / 2;

      // Vertical holes over this slice, merged.
      const holes = sorted
        .filter(o => o.t0 <= mid && o.t1 >= mid)
        .map(o => [Math.max(y, o.bottom), Math.min(y + r.h, o.top)])
        .filter(([lo, hi]) => hi - lo > 0.02)
        .sort((p, q) => p[0] - q[0]);

      const merged = [];
      for (const h of holes) {
        const last = merged[merged.length - 1];
        if (last && h[0] <= last[1] + 0.02) last[1] = Math.max(last[1], h[1]);
        else merged.push([h[0], h[1]]);
      }

      let yy = y;
      for (const [lo, hi] of merged) {
        if (lo > yy + 0.02) place(a, b, yy, lo - yy);
        yy = Math.max(yy, hi);
      }
      if (yy < y + r.h - 0.02) place(a, b, yy, y + r.h - yy);
    }
  }

  _skirting(r, y) {
    const t = 0.05, hgt = 0.16, o = 0.09;   // sits just proud of the wall panel
    const mk = (x, z, w, d) =>
      this.box(x, y, z, w, hgt, d, 'woodTrim', { solid: false, repeat: [Math.max(w, d) / 0.9, 0.2] });
    mk(r.x + o, r.z + o, r.w - 2 * o, t);
    mk(r.x + o, r.z + r.d - o - t, r.w - 2 * o, t);
    mk(r.x + o, r.z + o, t, r.d - 2 * o);
    mk(r.x + r.w - o - t, r.z + o, t, r.d - 2 * o);
  }

  // The XZ footprint a stair run needs clear through a slab.
  _stairSpan(st) {
    const dir = st.dir === 'N' ? -1 : 1;
    const len = st.run || 4.6;
    const z0 = dir < 0 ? st.z - len : st.z;
    return { x: st.x - st.width / 2 - 0.12, z: z0 - 0.12,
             w: st.width + 0.24, d: len + 0.24,
             lo: Math.min(LEVELS[st.from], LEVELS[st.to]),
             hi: Math.max(LEVELS[st.from], LEVELS[st.to]) };
  }

  _floorHolesFor(r) {
    const holes = [];
    const y = LEVELS[r.lvl];
    for (const st of STAIRS) {
      if (st.flat) continue;
      const h = this._stairSpan(st);
      // The floor of the upper room has to open for the run to pass through.
      if (Math.abs(y - h.hi) < 0.05 && rectsOverlap(r, h)) holes.push(h);
    }
    return holes;
  }

  _ceilHolesFor(r) {
    const holes = [];
    const y = LEVELS[r.lvl];
    for (const st of STAIRS) {
      if (st.flat) continue;
      const h = this._stairSpan(st);
      // ...and the ceiling of the lower room, which was never being punched.
      if (Math.abs(y - h.lo) < 0.05 && rectsOverlap(r, h)) holes.push(h);
    }
    return holes;
  }

  /* ------------------------------------------------ doors, hatches, windows */

  _buildPortalFurniture(p) {
    const { op } = p;
    const w = op.t1 - op.t0, h = op.top - op.bottom;
    const kind = p.kind;

    // Frame trim around every opening except bare crawl holes.
    if (kind !== 'crawl' && kind !== 'open') this._frame(op);

    if (kind === 'open' || kind === 'crawl') return;

    if (kind === 'barred') {
      // Non-passable iron bars: you can see and throw through, not walk.
      const n = Math.max(3, Math.round(w / 0.22));
      for (let i = 0; i < n; i++) {
        const t = op.t0 + (i + 0.5) * (w / n);
        if (op.axis === 'x') this.box(t - 0.025, op.bottom, op.line - 0.03, 0.05, h, 0.06, 'metalDark', { tag: 'bars' });
        else this.box(op.line - 0.03, op.bottom, t - 0.025, 0.06, h, 0.05, 'metalDark', { tag: 'bars' });
      }
      return;
    }

    if (kind === 'window') {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          color: 0x121a22, roughness: 0.05, metalness: 0.1,
          transparent: true, opacity: 0.55, side: THREE.DoubleSide,
        }));
      const c = openingCentre(op);
      glass.position.set(c.x, c.y, c.z);
      if (op.axis === 'z') glass.rotation.y = Math.PI / 2;
      this.scene.add(glass);
      // muntins
      if (op.axis === 'x') {
        this.box(op.t0, op.bottom + h / 2 - 0.025, op.line - 0.04, w, 0.05, 0.08, 'woodTrim', { solid: false });
        this.box(op.t0 + w / 2 - 0.025, op.bottom, op.line - 0.04, 0.05, h, 0.08, 'woodTrim', { solid: false });
      } else {
        this.box(op.line - 0.04, op.bottom + h / 2 - 0.025, op.t0, 0.08, 0.05, w, 'woodTrim', { solid: false });
        this.box(op.line - 0.04, op.bottom, op.t0 + w / 2 - 0.025, 0.08, h, 0.05, 'woodTrim', { solid: false });
      }
      const door = this._makeDoorRecord(p, op, w, h, {
        kind: 'window', material: 'woodTrim', openable: true, climb: true,
      });
      return door;
    }

    const matName = kind === 'metalHatch' ? 'metalDark'
      : kind === 'plank' ? 'woodRaw'
      : kind === 'hidden' ? p.A.wall
      : kind === 'wheelGate' ? 'metalDark'
      : kind === 'elevator' ? 'metalDark'
      : 'woodDoor';
    return this._makeDoorRecord(p, op, w, h, { kind, material: matName });
  }

  // A window: dark glass, a painted frame and muntins. Solid -- you cannot
  // climb through these; the Dining Room's portal window is the one exception
  // and it is built as a portal, not here.
  _buildWindow(w) {
    const { op } = w;
    const ww = op.t1 - op.t0, hh = op.top - op.bottom;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh),
      new THREE.MeshStandardMaterial({
        color: 0x0e151d, roughness: 0.08, metalness: 0.2,
        transparent: true, opacity: 0.82, side: THREE.DoubleSide,
      }));
    const c = openingCentre(op);
    glass.position.set(c.x, c.y, c.z);
    if (op.axis === 'z') glass.rotation.y = Math.PI / 2;
    this.scene.add(glass);

    // Pale painted frame, like the reference -- it is the brightest thing in
    // most of these rooms and reads as the window before anything else does.
    const f = 0.09, tint = 0xb9b2a4;
    const mk = (x, y, z, dx, dy, dz) =>
      this.box(x, y, z, dx, dy, dz, 'woodTrim', { solid: false, tint });
    if (op.axis === 'x') {
      const z = op.line - 0.06;
      mk(op.t0 - f, op.bottom - f, z, ww + 2 * f, f, 0.13);
      mk(op.t0 - f, op.top, z, ww + 2 * f, f, 0.13);
      mk(op.t0 - f, op.bottom, z, f, hh, 0.13);
      mk(op.t1, op.bottom, z, f, hh, 0.13);
      mk(op.t0 + ww / 2 - 0.025, op.bottom, z, 0.05, hh, 0.1);
      for (let i = 1; i < 3; i++) mk(op.t0, op.bottom + hh * i / 3 - 0.025, z, ww, 0.05, 0.1);
    } else {
      const x = op.line - 0.06;
      mk(x, op.bottom - f, op.t0 - f, 0.13, f, ww + 2 * f);
      mk(x, op.top, op.t0 - f, 0.13, f, ww + 2 * f);
      mk(x, op.bottom, op.t0 - f, 0.13, hh, f);
      mk(x, op.bottom, op.t1, 0.13, hh, f);
      mk(x, op.bottom, op.t0 + ww / 2 - 0.025, 0.1, hh, 0.05);
      for (let i = 1; i < 3; i++) mk(x, op.bottom + hh * i / 3 - 0.025, op.t0, 0.1, 0.05, ww);
    }
    // Glass is solid: block the opening.
    if (op.axis === 'x') {
      this.addSolid({ x: op.t0, y: op.bottom, z: op.line - 0.1 },
                    { x: op.t1, y: op.top, z: op.line + 0.02 }, 'window');
    } else {
      this.addSolid({ x: op.line - 0.1, y: op.bottom, z: op.t0 },
                    { x: op.line + 0.02, y: op.top, z: op.t1 }, 'window');
    }
  }

  _frame(op) {
    const w = op.t1 - op.t0, h = op.top - op.bottom, t = 0.1;
    if (op.axis === 'x') {
      this.box(op.t0 - t, op.bottom, op.line - 0.11, t, h + t, 0.31, 'woodTrim', { solid: false });
      this.box(op.t1, op.bottom, op.line - 0.11, t, h + t, 0.31, 'woodTrim', { solid: false });
      this.box(op.t0 - t, op.top, op.line - 0.11, w + 2 * t, t, 0.31, 'woodTrim', { solid: false });
    } else {
      this.box(op.line - 0.11, op.bottom, op.t0 - t, 0.31, h + t, t, 'woodTrim', { solid: false });
      this.box(op.line - 0.11, op.bottom, op.t1, 0.31, h + t, t, 'woodTrim', { solid: false });
      this.box(op.line - 0.11, op.top, op.t0 - t, 0.31, t, w + 2 * t, 'woodTrim', { solid: false });
    }
  }

  // A door leaf on a pivot. The collider is regenerated as it swings.
  _makeDoorRecord(p, op, w, h, cfg) {
    const pivot = new THREE.Group();
    const c = openingCentre(op);
    const hingeSign = 1;
    if (op.axis === 'x') pivot.position.set(op.t0, op.bottom, op.line - 0.03);
    else pivot.position.set(op.line - 0.03, op.bottom, op.t0);

    const leaf = new THREE.Mesh(this._geo, this.m(cfg.material, [w / 1.2, h / 2.2]));
    leaf.scale.set(op.axis === 'x' ? w : 0.06, h, op.axis === 'x' ? 0.06 : w);
    leaf.position.set(op.axis === 'x' ? w / 2 : 0.03, h / 2, op.axis === 'x' ? 0.03 : w / 2);
    leaf.castShadow = true; leaf.receiveShadow = true;
    pivot.add(leaf);

    // recessed panels, so doors read like the game's rather than flat slabs
    if (cfg.kind === 'door' || cfg.kind === 'locked') {
      const pm = this.m(cfg.material, [1, 1]);
      for (const [py, ph] of [[0.16, 0.38], [0.58, 0.30]]) {
        const pan = new THREE.Mesh(this._geo, pm);
        const pw = w * 0.62;
        pan.scale.set(op.axis === 'x' ? pw : 0.075, h * ph, op.axis === 'x' ? 0.075 : pw);
        pan.position.set(op.axis === 'x' ? w / 2 : 0.03, h * (py + ph / 2), op.axis === 'x' ? 0.03 : w / 2);
        pivot.add(pan);
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.5, metalness: 0.6 }));
      knob.position.set(op.axis === 'x' ? w * 0.86 : 0.09, h * 0.48, op.axis === 'x' ? 0.09 : w * 0.86);
      pivot.add(knob);
    }
    this.scene.add(pivot);

    const rec = {
      id: p.a + '>' + p.b, pivot, op, w, h, kind: cfg.kind,
      rooms: [p.a, p.b], key: p.key || null,
      openAmount: 0, target: 0, locked: !!p.key,
      openable: cfg.openable ?? (cfg.kind !== 'wheelGate' && cfg.kind !== 'elevator' && cfg.kind !== 'plank'),
      climb: cfg.climb ?? false,
      blocked: cfg.kind === 'plank' || cfg.kind === 'wheelGate',
      solid: null, centre: c, hingeSign,
    };
    rec.solid = this.addSolid({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 'door', rec);
    this._syncDoorSolid(rec);
    this.doors.push(rec);
    this.interactables.push(rec);
    return rec;
  }

  _syncDoorSolid(d) {
    const a = d.openAmount * Math.PI * 0.52;
    d.pivot.rotation.y = d.op.axis === 'x' ? -a : a;
    const s = d.solid;
    if (d.openAmount > 0.55) {                 // wide enough to walk through
      s.min = { x: 0, y: 0, z: 0 }; s.max = { x: 0, y: 0, z: 0 };
      return;
    }
    const pad = 0.05;
    if (d.op.axis === 'x') {
      s.min = { x: d.op.t0 - pad, y: d.op.bottom, z: d.op.line - 0.14 };
      s.max = { x: d.op.t1 + pad, y: d.op.top, z: d.op.line + 0.05 };
    } else {
      s.min = { x: d.op.line - 0.14, y: d.op.bottom, z: d.op.t0 - pad };
      s.max = { x: d.op.line + 0.05, y: d.op.top, z: d.op.t1 + pad };
    }
  }

  updateDoors(dt) {
    for (const d of this.doors) {
      if (d.openAmount !== d.target) {
        const sp = dt * 3.4;
        d.openAmount += Math.sign(d.target - d.openAmount) * Math.min(sp, Math.abs(d.target - d.openAmount));
        this._syncDoorSolid(d);
      }
    }
  }

  /* --------------------------------------------------------------- stairs */

  _buildStairs(s) {
    if (s.flat) return;
    const room = ROOM_BY_ID[s.in];
    const y0 = LEVELS[s.from], y1 = LEVELS[s.to];
    const rise = y1 - y0;
    const dir = s.dir === 'N' ? -1 : 1;      // N runs toward -Z
    const steps = Math.max(4, Math.ceil(Math.abs(rise) / 0.30));
    const stepRise = rise / steps;
    const run = (s.run || 4.6) / steps;
    const wood = rise > 0 ? 'woodTrim' : 'concreteDark';
    for (let i = 0; i < steps; i++) {
      const yTop = y0 + stepRise * (i + 1);
      const z = s.z + dir * run * i - (dir < 0 ? run : 0);
      const yBottom = Math.min(y0, y1) - 0.2;
      this.box(s.x - s.width / 2, yBottom, z, s.width, yTop - yBottom, run, wood,
        { repeat: [s.width / 1.2, 1], tag: 'stair', ref: s.id });
    }
    if (s.rail) {
      const len = Math.abs(run * steps);
      const railY = y0 + rise * 0.5 + 0.95;
      const g = new THREE.Mesh(this._geo, this.m('woodTrim', [len / 1.2, 1]));
      g.scale.set(0.07, 0.07, len);
      g.position.set(s.x - s.width / 2 - 0.04, railY, s.z + dir * len / 2);
      g.rotation.x = Math.atan2(rise, len) * (dir < 0 ? 1 : -1);
      this.scene.add(g);
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        const pz = s.z + dir * len * t;
        const py = y0 + rise * t;
        this.box(s.x - s.width / 2 - 0.07, py, pz - 0.03, 0.06, 0.95, 0.06, 'woodTrim', { solid: false });
      }
    }
    s._y0 = Math.min(y0, y1);
    s._y1 = Math.max(y0, y1);
    this.stairsBuilt = this.stairsBuilt || [];
    this.stairsBuilt.push(s);
  }

  // A trapdoor in the floor. Rather than requiring the two rooms to be
  // stacked -- the map's drops criss-cross the house -- it moves the player to
  // an explicit destination, which is how they read in game anyway.
  _buildDrop(d) {
    const [fr, fx, fz] = d.from;
    const from = ROOM_BY_ID[fr];
    const y = LEVELS[from.lvl];
    const x = from.x + fx, z = from.z + fz;
    const lid = this.box(x - 0.55, y - 0.03, z - 0.55, 1.1, 0.07, 1.1,
      d.key ? 'metalDark' : 'woodRaw', { solid: false, repeat: [1, 1] });
    for (const [ox, oz, ow, od] of [[-0.62, -0.62, 1.24, 0.07], [-0.62, 0.55, 1.24, 0.07],
                                    [-0.62, -0.62, 0.07, 1.24], [0.55, -0.62, 0.07, 1.24]]) {
      this.box(x + ox, y - 0.03, z + oz, ow, 0.09, od, 'metalDark', { solid: false });
    }
    const rec = {
      id: d.id, kind: 'trapdoor', mesh: lid, key: d.key, label: d.label,
      x, y, z, dest: d.to, open: false, room: fr,
    };
    this.drops.push(rec);
    this.interactables.push(rec);
  }

  // Two-way ladder between two arbitrary points on different levels.
  _buildLadder(l) {
    const ends = [];
    for (const [roomId, lx, lz] of [l.a, l.b]) {
      const r = ROOM_BY_ID[roomId];
      const x = r.x + lx, y = LEVELS[r.lvl], z = r.z + lz;
      for (let i = 0; i < 9; i++) {
        this.box(x - 0.24, y + 0.18 + i * 0.28, z - 0.05, 0.48, 0.05, 0.06, 'woodRaw', { solid: false });
      }
      this.box(x - 0.28, y, z - 0.06, 0.06, 2.6, 0.08, 'woodRaw', { solid: false });
      this.box(x + 0.22, y, z - 0.06, 0.06, 2.6, 0.08, 'woodRaw', { solid: false });
      ends.push({ room: roomId, x, y, z });
    }
    for (let i = 0; i < 2; i++) {
      const rec = {
        id: l.id + (i ? ':b' : ':a'), kind: 'ladder', label: 'Ladder',
        // Aim point at chest height on the rungs, not down at the floor, or
        // looking straight at the ladder does not actually target it.
        x: ends[i].x, y: ends[i].y + 1.05, z: ends[i].z, dest: ends[1 - i],
      };
      this.interactables.push(rec);
      this.drops.push(rec);
    }
  }

  // The Foyer's upper landing. It lives inside the two-storey volume rather
  // than being a room of its own, so the hallways can open straight onto it.
  _buildBalcony() {
    const y = LEVELS.upper;
    const strips = [
      { x: -1,  z: -0.5, w: 6,   d: 1.4 },   // north, where the stairs arrive
      { x: -1,  z: 0.9,  w: 2.0, d: 2.6 },   // west
      { x: 3.6, z: 0.9,  w: 1.4, d: 4.8 },   // east
    ];
    for (const s of strips) {
      this.box(s.x, y - 0.2, s.z, s.w, 0.2, s.d, 'floorPlankDark',
        { repeat: [s.w / 1.9, s.d / 1.9], tag: 'floor', ref: 'foyer' });
    }

    // Where the staircase breaks through, so no railing is built across it.
    const up = STAIRS.find(st => st.id === 'foyerStairs');
    const gap = up ? { a: up.x - up.width / 2 - 0.2, b: up.x + up.width / 2 + 0.2 } : null;

    // A railing run along X, split around the stair opening.
    const railX = (x0, x1, z) => {
      const pieces = (gap && x1 > gap.a && x0 < gap.b)
        ? [[x0, Math.min(x1, gap.a)], [Math.max(x0, gap.b), x1]]
        : [[x0, x1]];
      for (const [a, b] of pieces) {
        if (b - a < 0.2) continue;
        this.box(a, y + 0.92, z - 0.04, b - a, 0.08, 0.08, 'woodTrim', { solid: false });
        const n = Math.max(2, Math.round((b - a) / 0.42));
        for (let i = 0; i <= n; i++) {
          this.box(a + (b - a) * (i / n) - 0.03, y, z - 0.04, 0.06, 0.92, 0.06, 'woodTrim', { solid: false });
        }
        this.addSolid({ x: a, y, z: z - 0.08 }, { x: b, y: y + 1.0, z: z + 0.04 }, 'rail');
      }
    };
    // A railing run along Z.
    const railZ = (z0, z1, x) => {
      this.box(x - 0.04, y + 0.92, z0, 0.08, 0.08, z1 - z0, 'woodTrim', { solid: false });
      const n = Math.max(2, Math.round((z1 - z0) / 0.42));
      for (let i = 0; i <= n; i++) {
        this.box(x - 0.04, y, z0 + (z1 - z0) * (i / n) - 0.03, 0.06, 0.92, 0.06, 'woodTrim', { solid: false });
      }
      this.addSolid({ x: x - 0.08, y, z: z0 }, { x: x + 0.04, y: y + 1.0, z: z1 }, 'rail');
    };

    railX(-1, 5, 0.9);        // inner edge of the north walkway
    railZ(0.9, 3.5, 1.0);     // inner edge of the west walkway
    railX(-1, 1.0, 3.5);      // its south end
    railZ(0.9, 5.7, 3.6);     // inner edge of the east walkway
    railX(3.6, 5, 5.7);       // its south end
  }

  // Ground plane + treeline so the backyard and the view out of windows are
  // not staring into the void.
  _buildExterior() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.m('dirt', [40, 40]));
    g.rotation.x = -Math.PI / 2;
    g.position.set(4, -0.26, -4);
    g.receiveShadow = true;
    this.scene.add(g);

    const trunkMat = this.m('woodTrim', [1, 4]);
    const foliage = new THREE.MeshStandardMaterial({ color: 0x10160f, roughness: 1 });
    const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2, r = 26 + rng() * 62;
      const x = 4 + Math.cos(a) * r, z = -4 + Math.sin(a) * r;
      const hgt = 6 + rng() * 7;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, hgt, 6), trunkMat);
      t.position.set(x, hgt / 2 - 0.2, z);
      this.scene.add(t);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 + rng(), 4 + rng() * 3, 7), foliage);
      c.position.set(x, hgt + 1.2, z);
      this.scene.add(c);
    }
  }

  /* ------------------------------------------------------------- queries */

  // Uniform grid over XZ. Collision and line-of-sight both scanned all ~1000
  // solids every call, which booted fine and was far too slow to actually run.
  // Each cell lists only the solids overlapping it.
  buildIndex(cell = 2.0) {
    this.cell = cell;
    this.grid = new Map();
    this._stamp = 0;
    for (const s of this.solids) this._indexSolid(s);
    return this;
  }

  _indexSolid(s) {
    const c = this.cell;
    const x0 = Math.floor(s.min.x / c), x1 = Math.floor(s.max.x / c);
    const z0 = Math.floor(s.min.z / c), z1 = Math.floor(s.max.z / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = x + ',' + z;
        let list = this.grid.get(k);
        if (!list) { list = []; this.grid.set(k, list); }
        list.push(s);
      }
    }
  }

  // Solids overlapping an XZ box, de-duplicated across cells. `out` is reused
  // by callers so this allocates nothing in the hot path.
  near(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    if (!this.grid) { for (const s of this.solids) out.push(s); return out; }
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    const stamp = ++this._stamp;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const list = this.grid.get(x + ',' + z);
        if (!list) continue;
        for (const s of list) {
          if (s._seen === stamp) continue;
          s._seen = stamp;
          out.push(s);
        }
      }
    }
    return out;
  }

  roomAt(x, y, z) {
    let best = null, bestDy = Infinity;
    for (const r of this.roomRects) {
      if (x < r.x || x > r.x + r.w || z < r.z || z > r.z + r.d) continue;
      const dy = y - r.y;
      if (dy < -0.6 || dy > r.h + 0.6) continue;
      if (Math.abs(dy) < bestDy) { bestDy = Math.abs(dy); best = r; }
    }
    return best;
  }
}

/* ---------------------------------------------------------------- helpers */

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
}

function stairHole(s) {
  const dir = s.dir === 'N' ? -1 : 1;
  const len = s.run || 4.6;
  const z0 = dir < 0 ? s.z - len : s.z;
  return { x: s.x - s.width / 2 - 0.1, z: z0 - 0.1, w: s.width + 0.2, d: len + 0.2 };
}

// Find the colinear overlapping edge shared by two room rects, if any.
function sharedEdge(A, B) {
  const eps = 0.02;
  const ax0 = A.x, ax1 = A.x + A.w, az0 = A.z, az1 = A.z + A.d;
  const bx0 = B.x, bx1 = B.x + B.w, bz0 = B.z, bz1 = B.z + B.d;
  // vertical shared line (walls running along Z)
  for (const [line, ok] of [[ax1, Math.abs(ax1 - bx0) < eps], [ax0, Math.abs(ax0 - bx1) < eps]]) {
    if (!ok) continue;
    const t0 = Math.max(az0, bz0), t1 = Math.min(az1, bz1);
    if (t1 - t0 > 0.3) return { axis: 'z', line, t0, t1 };
  }
  // horizontal shared line (walls running along X)
  for (const [line, ok] of [[az1, Math.abs(az1 - bz0) < eps], [az0, Math.abs(az0 - bz1) < eps]]) {
    if (!ok) continue;
    const t0 = Math.max(ax0, bx0), t1 = Math.min(ax1, bx1);
    if (t1 - t0 > 0.3) return { axis: 'x', line, t0, t1 };
  }
  return null;
}

function openingCentre(op) {
  const t = (op.t0 + op.t1) / 2, y = (op.bottom + op.top) / 2;
  return op.axis === 'x' ? { x: t, y, z: op.line } : { x: op.line, y, z: t };
}

export { sharedEdge, openingCentre };
