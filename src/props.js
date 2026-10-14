// props.js -- furniture and fixtures.
//
// Two kinds of thing live here:
//   * scenery   -- solid, decorative, and that's it
//   * containers -- drawers, cupboards, safes, the well bucket, the car trunk.
//     These are the spawn points the wiki's item-location presets refer to, so
//     each one carries a `slot` id matching the names used in items.js.
import * as THREE from '../vendor/three.module.js?v=1';
import { LEVELS, ROOM_BY_ID } from './floorplan.js?v=1';

const DEG = Math.PI / 180;

export class Props {
  constructor(world) {
    this.world = world;
    this.containers = new Map();   // slot id -> container record
    this.hidingSpots = [];
    this.fixtures = [];            // named interactive scenery (main door, car…)
    this.cur = null;
  }

  // Place props expressed in room-local coordinates.
  in(roomId, fn) {
    const r = ROOM_BY_ID[roomId];
    if (!r) throw new Error('no room ' + roomId);
    this.cur = { r, y: LEVELS[r.lvl], taken: [] };
    fn(this);
    this.cur = null;
    return this;
  }

  /* ------------------------------------------------------------ placement */
  //
  // Everything in Granny's house stands flush against a wall, with clear floor
  // in the middle. `at()` takes a footprint and finds it a real spot: it tests
  // the piece's actual rectangle against every doorway's swept volume, the
  // stairs, and everything already placed. If the requested wall cannot fit it
  // -- some rooms are too narrow to take a bed beside a door -- it falls back
  // to the other walls rather than shoving the piece into a doorway.
  //
  //   side: 'N' | 'S' | 'E' | 'W'   t: 0..1 along that wall
  //   fw = width along the wall, fd = depth into the room
  at(side, t, fw, fd) {
    const order = [side, ...['N', 'E', 'S', 'W'].filter(x => x !== side)];
    // Pass 1 keeps a walking margin in front of every door; pass 2 gives that
    // up and only refuses to sit in the doorway itself. Small rooms with three
    // doors (the Walk-In Closet) need the second pass to hold anything at all.
    for (const clear of [0.7, 0.16]) {
      const blockers = this._blockRects(clear);
      for (const s of order) {
        const hit = this._scanWall(s, t, fw, fd, blockers);
        if (hit) {
          this.cur.taken.push(hit.rect);
          return { lx: hit.lx, lz: hit.lz, rot: (s === 'E' || s === 'W') ? 1 : 0, side: s };
        }
      }
    }
    // Genuinely nowhere to put it. Skip it rather than blocking a doorway.
    console.warn(`no room for a ${fw.toFixed(2)}x${fd.toFixed(2)} piece in ${this.cur.r.id} -- skipped`);
    return null;
  }

  // Walk along one wall from the requested position outwards, returning the
  // first placement whose footprint is clear.
  _scanWall(side, t, fw, fd, blockers) {
    const r = this.cur.r;
    const GAP = 0.11;
    const vertical = side === 'E' || side === 'W';
    const along = vertical ? r.d : r.w;
    const depthRoom = vertical ? r.w : r.d;
    if (fw > along - 2 * GAP || fd > depthRoom - 2 * GAP) return null;

    const into = side === 'N' ? GAP
               : side === 'S' ? r.d - fd - GAP
               : side === 'W' ? GAP
               : r.w - fd - GAP;

    const lo = GAP, hi = along - fw - GAP;
    const start = Math.max(lo, Math.min(hi, t * along - fw / 2));
    const step = 0.16;
    const steps = Math.ceil((hi - lo) / step) + 1;

    for (let i = 0; i <= steps; i++) {
      for (const dir of (i === 0 ? [0] : [1, -1])) {
        const a = start + dir * i * step;
        if (a < lo - 0.001 || a > hi + 0.001) continue;
        const lx = vertical ? into : a;
        const lz = vertical ? a : into;
        const rect = vertical
          ? { x0: lx, z0: a, x1: lx + fd, z1: a + fw }
          : { x0: a, z0: lz, x1: a + fw, z1: lz + fd };
        if (!blockers.some(b => overlaps(rect, b))) return { lx, lz, rect };
      }
    }
    return null;
  }

  // Room-local rectangles furniture must stay out of: doorway approaches,
  // stair runs, and anything already placed in this room.
  _blockRects(CLEAR = 0.7) {
    const r = this.cur.r;
    const out = [...this.cur.taken];
    const ops = this.world.openingsByRoom.get(r.id) || [];
    const y = LEVELS[r.lvl];

    for (const op of ops) {
      // A window with a high sill is not something furniture can block.
      if (op.window && op.bottom - y > 0.85) continue;
      if (op.axis === 'x') {
        out.push({ x0: op.t0 - r.x - 0.12, x1: op.t1 - r.x + 0.12,
                   z0: op.line - r.z - CLEAR, z1: op.line - r.z + CLEAR });
      } else {
        out.push({ x0: op.line - r.x - CLEAR, x1: op.line - r.x + CLEAR,
                   z0: op.t0 - r.z - 0.12, z1: op.t1 - r.z + 0.12 });
      }
    }
    // Keep the whole stair run clear, plus a landing at BOTH ends. The old
    // version padded past the top only, which left the foot of the Foyer
    // staircase free for a wardrobe -- and that wardrobe walled the stairs off.
    for (const st of (this.world.stairsBuilt || [])) {
      const arrivesHere = Math.abs((st._y0 ?? 0) - LEVELS[r.lvl]) < 0.05 ||
                          Math.abs((st._y1 ?? 0) - LEVELS[r.lvl]) < 0.05;
      if (st.in !== r.id && !arrivesHere) continue;
      const run = st.run || 4.6;
      const PAD = 0.95;
      const half = st.width / 2 + 0.35;
      const za = st.dir === 'N' ? st.z - run : st.z;
      const zb = st.dir === 'N' ? st.z : st.z + run;
      out.push({
        x0: st.x - half - r.x, x1: st.x + half - r.x,
        z0: Math.min(za, zb) - PAD - r.z, z1: Math.max(za, zb) + PAD - r.z,
      });
    }
    return out;
  }

  // local -> world
  W(lx, lz) { return [this.cur.r.x + lx, this.cur.r.z + lz]; }
  Y(dy = 0) { return this.cur.y + dy; }

  box(lx, dy, lz, w, h, d, matName, opts = {}) {
    const [x, z] = this.W(lx, lz);
    return this.world.box(x, this.Y(dy), z, w, h, d, matName,
      { castShadow: true, tag: 'prop', ref: this.cur ? this.cur.r.id : null, ...opts });
  }

  /* ------------------------------------------------------------ primitives */
  //
  // Every builder takes a descriptor: { side, t, ... }. The builder knows its
  // own footprint, asks at() for a clear spot on that wall, and orients its
  // doors and drawer fronts to face into the room. Nothing is positioned by
  // hand any more, so nothing ends up floating mid-floor or inside a doorway.

  // Unit vector pointing from the wall into the room.
  _face(side) {
    return side === 'N' ? [0, 1] : side === 'S' ? [0, -1]
         : side === 'W' ? [1, 0] : [-1, 0];
  }

  // Resolve a descriptor to { lx, lz, w, d, fx, fz } where f is the inward
  // normal and w/d are the footprint already swapped for the wall direction.
  _spot(o, fw, fd) {
    const got = this.at(o.side, o.t ?? 0.5, fw, fd);
    if (!got) return null;
    const { lx, lz, side } = got;
    const vertical = side === 'E' || side === 'W';
    const w = vertical ? fd : fw;
    const d = vertical ? fw : fd;
    const [fx, fz] = this._face(side);
    return { lx, lz, w, d, fx, fz, vertical, side };
  }

  bed(o) {
    const p = this._spot(o, 1.3, 2.0);
    if (!p) return this;
    const { lx, lz, w, d } = p;
    this.box(lx, 0, lz, w, 0.30, d, 'woodFurniture');
    this.box(lx + 0.05, 0.30, lz + 0.05, w - 0.10, 0.19, d - 0.10, 'fabricGrey');
    // Headboard against the wall.
    if (p.vertical) this.box(lx + (p.fx > 0 ? 0 : w - 0.09), 0, lz, 0.09, 0.85, d, 'woodFurniture');
    else this.box(lx, 0, lz + (p.fz > 0 ? 0 : d - 0.09), w, 0.85, 0.09, 'woodFurniture');
    // Pillow at the head end.
    if (p.vertical) this.box(lx + (p.fx > 0 ? 0.14 : w - 0.62), 0.49, lz + d / 2 - 0.3, 0.48, 0.1, 0.6, 'gown', { solid: false });
    else this.box(lx + w / 2 - 0.3, 0.49, lz + (p.fz > 0 ? 0.14 : d - 0.62), 0.6, 0.1, 0.48, 'gown', { solid: false });
    this.hidingSpots.push({ kind: 'bed', ...this._pt(lx + w / 2, 0.28, lz + d / 2), label: 'Hide under the bed' });
    return this;
  }

  dresser(o) {
    const p = this._spot(o, 1.05, 0.5);
    if (!p) return this;
    const { lx, lz, w, d, fx, fz } = p;
    const n = o.drawers ?? 3;
    this.box(lx, 0, lz, w, 0.95, d, 'woodFurniture');
    const names = o.names || ['left', 'right', 'top', 'middle', 'bottom'];
    for (let i = 0; i < n; i++) {
      const dy = 0.12 + i * (0.78 / n);
      const face = p.vertical
        ? this.box(lx + (fx > 0 ? w - 0.02 : -0.04), dy, lz + 0.07, 0.06, 0.78 / n - 0.06, d - 0.14, 'woodFurniture', { solid: false })
        : this.box(lx + 0.07, dy, lz + (fz > 0 ? d - 0.02 : -0.04), w - 0.14, 0.78 / n - 0.06, 0.06, 'woodFurniture', { solid: false });
      if (o.slot) this._container(`${o.slot}:${names[i] || i}`, face, lx + w / 2, dy + 0.1, lz + d / 2, 'drawer');
    }
    if (o.topSlot) this._container(o.topSlot, null, lx + w / 2, 1.05, lz + d / 2, 'shelf').label = 'Top of the drawers';
    return this;
  }

  roundTable(o) {
    const r = o.r ?? 0.36;
    const p = this._spot(o, r * 2, r * 2);
    if (!p) return this;
    const [x, z] = this.W(p.lx + r, p.lz + r);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 18),
      this.world.m('woodFurniture', [1, 1]));
    top.position.set(x, this.Y(0.72), z);
    top.castShadow = true;
    this.world.scene.add(top);
    this.world.addSolid({ x: x - r, y: this.Y(0), z: z - r },
                        { x: x + r, y: this.Y(0.75), z: z + r }, 'prop');
    this.box(p.lx + r - 0.05, 0, p.lz + r - 0.05, 0.1, 0.7, 0.1, 'woodFurniture', { solid: false });
    this.box(p.lx + r - 0.16, 0, p.lz + r - 0.16, 0.32, 0.04, 0.32, 'woodFurniture', { solid: false });
    if (o.slot) this._container(o.slot, null, p.lx + r, 0.8, p.lz + r, 'shelf').label = 'Table';
    return this;
  }

  // A rectangular table. Pass { centre: true } for dining tables, which stand
  // in the middle of the room rather than against a wall.
  table(o) {
    const fw = o.w ?? 1.2, fd = o.d ?? 0.8, h = o.h ?? 0.74;
    let lx, lz, w = fw, d = fd;
    if (o.centre) { lx = (this.cur.r.w - fw) / 2 + (o.dx || 0); lz = (this.cur.r.d - fd) / 2 + (o.dz || 0); }
    else {
      const p = this._spot(o, fw, fd);
      if (!p) return { lx: 0, lz: 0, w: 0, d: 0, h, skipped: true };
      lx = p.lx; lz = p.lz; w = p.w; d = p.d;
    }
    this.box(lx, h - 0.05, lz, w, 0.05, d, 'woodFurniture');
    for (const [ox, oz] of [[0.05, 0.05], [w - 0.13, 0.05], [0.05, d - 0.13], [w - 0.13, d - 0.13]]) {
      this.box(lx + ox, 0, lz + oz, 0.08, h - 0.05, 0.08, 'woodFurniture', { solid: false });
    }
    if (o.slot) this._container(o.slot, null, lx + w / 2, h + 0.1, lz + d / 2, 'shelf').label = 'Table';
    return { lx, lz, w, d, h };
  }

  chairsAround(t, n = 4) {
    const spots = [[t.lx + t.w / 2 - 0.21, t.lz - 0.5], [t.lx + t.w / 2 - 0.21, t.lz + t.d + 0.08],
                   [t.lx - 0.5, t.lz + t.d / 2 - 0.21], [t.lx + t.w + 0.08, t.lz + t.d / 2 - 0.21]];
    for (let i = 0; i < Math.min(n, 4); i++) this._chair(spots[i][0], spots[i][1]);
    return this;
  }

  _chair(lx, lz) {
    this.box(lx, 0.42, lz, 0.42, 0.05, 0.42, 'woodFurniture');
    for (const [ox, oz] of [[0.02, 0.02], [0.35, 0.02], [0.02, 0.35], [0.35, 0.35]]) {
      this.box(lx + ox, 0, lz + oz, 0.05, 0.42, 0.05, 'woodFurniture', { solid: false });
    }
    this.box(lx, 0.47, lz, 0.42, 0.48, 0.05, 'woodFurniture', { solid: false });
    return this;
  }

  wardrobe(o) {
    const p = this._spot(o, 1.05, 0.58);
    if (!p) return this;
    const { lx, lz, w, d, fx, fz } = p;
    this.box(lx, 0, lz, w, 1.95, d, 'woodFurniture');
    const door = p.vertical
      ? this.box(lx + (fx > 0 ? w - 0.03 : -0.03), 0.06, lz + 0.04, 0.06, 1.82, d - 0.08, 'woodDoor', { solid: false })
      : this.box(lx + 0.04, 0.06, lz + (fz > 0 ? d - 0.03 : -0.03), w - 0.08, 1.82, 0.06, 'woodDoor', { solid: false });
    if (o.slot) this._container(o.slot, door, lx + w / 2, 1.0, lz + d / 2, 'cabinet');
    this.hidingSpots.push({ kind: 'cabinet', ...this._pt(lx + w / 2, 0.05, lz + d / 2), label: 'Hide in the cabinet' });
    return this;
  }

  shelf(o) {
    const fw = o.w ?? 1.2, levels = o.levels ?? 3;
    const p = this._spot(o, fw, 0.32);
    if (!p) return this;
    const { lx, lz, w, d } = p;
    for (let i = 0; i < levels; i++) this.box(lx, 0.32 + i * 0.46, lz, w, 0.045, d, 'woodRaw');
    this.box(lx, 0, lz, 0.055, 0.32 + levels * 0.46, 0.055, 'woodRaw', { solid: false });
    this.box(lx + w - 0.055, 0, lz + d - 0.055, 0.055, 0.32 + levels * 0.46, 0.055, 'woodRaw', { solid: false });
    if (o.slot) this._container(o.slot, null, lx + w / 2, 0.85, lz + d / 2, 'shelf');
    if (o.slot2) this._container(o.slot2, null, lx + w / 2, 0.4, lz + d / 2, 'shelf').label = 'Bottom shelf';
    if (o.slotTop) this._container(o.slotTop, null, lx + w / 2, 0.32 + levels * 0.46, lz + d / 2, 'shelf').label = 'Top shelf';
    return this;
  }

  // High shelf, out of reach -- like the Foyer one holding the Screwdriver.
  highShelf(o) {
    const p = this._spot(o, 1.05, 0.28);
    if (!p) return this;
    const dy = o.dy ?? 2.25;
    this.box(p.lx, dy, p.lz, p.w, 0.05, p.d, 'woodRaw');
    if (o.slot) this._container(o.slot, null, p.lx + p.w / 2, dy + 0.12, p.lz + p.d / 2, 'highShelf');
    return this;
  }

  cupboard(o) {
    const fw = o.w ?? 0.68, h = o.h ?? 0.82, dy = o.dy ?? 0;
    const p = this._spot(o, fw, 0.55);
    if (!p) return this;
    const { lx, lz, w, d, fx, fz } = p;
    this.box(lx, dy, lz, w, h, d, 'woodFurniture');
    const door = p.vertical
      ? this.box(lx + (fx > 0 ? w - 0.03 : -0.03), dy + 0.04, lz + 0.03, 0.05, h - 0.08, d - 0.06, 'woodDoor', { solid: false })
      : this.box(lx + 0.03, dy + 0.04, lz + (fz > 0 ? d - 0.03 : -0.03), w - 0.06, h - 0.08, 0.05, 'woodDoor', { solid: false });
    if (o.slot) this._container(o.slot, door, lx + w / 2, dy + h / 2, lz + d / 2, 'cupboard');
    return this;
  }

  counter(o) {
    const p = this._spot(o, o.w ?? 2.4, 0.6);
    if (!p) return this;
    this.box(p.lx, 0, p.lz, p.w, 0.84, p.d, 'woodFurniture');
    this.box(p.lx - 0.02, 0.84, p.lz - 0.02, p.w + 0.04, 0.05, p.d + 0.04, 'concrete');
    if (o.slot) this._container(o.slot, null, p.lx + p.w / 2, 0.95, p.lz + p.d / 2, 'shelf').label = 'Countertop';
    return this;
  }

  sofa(o) {
    const p = this._spot(o, 1.95, 0.88);
    if (!p) return this;
    const { lx, lz, w, d, fx, fz } = p;
    this.box(lx, 0, lz, w, 0.40, d, 'fabricRed');
    if (p.vertical) this.box(lx + (fx > 0 ? 0 : w - 0.24), 0.40, lz, 0.24, 0.48, d, 'fabricRed');
    else this.box(lx, 0.40, lz + (fz > 0 ? 0 : d - 0.24), w, 0.48, 0.24, 'fabricRed');
    return this;
  }

  tv(o) {
    const p = this._spot(o, 1.05, 0.48);
    if (!p) return this;
    const { lx, lz, w, d } = p;
    this.box(lx, 0, lz, w, 0.48, d, 'woodFurniture');
    this.box(lx + w / 2 - 0.42, 0.48, lz + d / 2 - 0.18, 0.84, 0.6, 0.36, 'metalDark');
    if (o.slot) this._container(o.slot, null, lx + w / 2, 0.55, lz + d / 2, 'tvTable');
    return this;
  }

  showcase(o) {
    const p = this._spot(o, 0.95, 0.42);
    if (!p) return this;
    const { lx, lz, w, d, fx, fz } = p;
    this.box(lx, 0, lz, w, 1.85, d, 'woodFurniture');
    for (let i = 0; i < 3; i++) this.box(lx + 0.05, 0.45 + i * 0.44, lz + 0.04, w - 0.1, 0.035, d - 0.08, 'woodRaw', { solid: false });
    const gx = p.vertical ? lx + (fx > 0 ? w : 0) : lx + w / 2;
    const gz = p.vertical ? lz + d / 2 : lz + (fz > 0 ? d : 0);
    const [x, z] = this.W(gx, gz);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(p.vertical ? d : w, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x1a1e22, transparent: true, opacity: 0.26,
        roughness: 0.06, side: THREE.DoubleSide }));
    glass.position.set(x, this.Y(1.05), z);
    if (p.vertical) glass.rotation.y = Math.PI / 2;
    this.world.scene.add(glass);
    if (o.slot) this._container(o.slot, glass, lx + w / 2, 1.2, lz + d / 2, 'showcase');
    return this;
  }

  workbench(o) {
    const p = this._spot(o, o.w ?? 2.2, 0.68);
    if (!p) return this;
    const { lx, lz, w, d } = p;
    this.box(lx, 0.74, lz, w, 0.07, d, 'woodRaw');
    for (const [ox, oz] of [[0.05, 0.05], [w - 0.15, 0.05], [0.05, d - 0.15], [w - 0.15, d - 0.15]]) {
      this.box(lx + ox, 0, lz + oz, 0.1, 0.74, 0.1, 'woodRaw', { solid: false });
    }
    if (o.slot) this._container(o.slot, null, lx + w / 2, 0.9, lz + d / 2, 'bench');
    return this;
  }

  safe(o) {
    const p = this._spot(o, 0.66, 0.55);
    if (!p) return this;
    const { lx, lz, w, d, fx, fz } = p;
    this.box(lx, 0, lz, w, 0.66, d, 'metalDark');
    const door = p.vertical
      ? this.box(lx + (fx > 0 ? w - 0.02 : -0.04), 0.03, lz + 0.03, 0.06, 0.6, d - 0.06, 'metal', { solid: false })
      : this.box(lx + 0.03, 0.03, lz + (fz > 0 ? d - 0.02 : -0.04), w - 0.06, 0.6, 0.06, 'metal', { solid: false });
    const rec = this._container(o.slot, door, lx + w / 2, 0.33, lz + d / 2, 'safe');
    rec.locked = true; rec.key = o.key || null; rec.label = o.label || 'Safe';
    if (o.needs) rec.needs = o.needs;
    return this;
  }

  crib(o) {
    const p = this._spot(o, 1.15, 0.68);
    if (!p) return this;
    const { lx, lz, w, d } = p;
    this.box(lx, 0.28, lz, w, 0.08, d, 'woodRaw');
    for (const [ox, oz, bw, bd] of [[0, 0, w, 0.05], [0, d - 0.05, w, 0.05], [0, 0, 0.05, d], [w - 0.05, 0, 0.05, d]]) {
      this.box(lx + ox, 0.28, lz + oz, bw, 0.58, bd, 'woodRaw', { solid: false });
    }
    for (const [ox, oz] of [[0.02, 0.02], [w - 0.08, 0.02], [0.02, d - 0.08], [w - 0.08, d - 0.08]]) {
      this.box(lx + ox, 0, lz + oz, 0.06, 0.36, 0.06, 'woodRaw', { solid: false });
    }
    this.box(lx + 0.06, 0.36, lz + 0.06, w - 0.12, 0.07, d - 0.12, 'gown', { solid: false });
    this._container('nursery:crib', null, lx + w / 2, 0.5, lz + d / 2, 'crib').label = 'Crib';
    return this;
  }

  mannequin(lx, lz, rot = 0) {
    const [x, z] = this.W(lx, lz);
    const m = this.world.m('gown', [1, 1]);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.62, 10), m);
    body.position.y = 0.98; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), m);
    head.position.y = 1.38; g.add(head);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.66, 8), m);
    stand.position.y = 0.33; g.add(stand);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 12), m);
    base.position.y = 0.025; g.add(base);
    g.position.set(x, this.Y(0), z);
    g.rotation.y = rot;
    this.world.scene.add(g);
    this.world.addSolid({ x: x - 0.2, y: this.Y(0), z: z - 0.2 },
                        { x: x + 0.2, y: this.Y(1.5), z: z + 0.2 }, 'prop');
    return this;
  }

  bathtub(o) {
    const p = this._spot(o, 1.55, 0.72);
    if (!p) return this;
    this.box(p.lx, 0, p.lz, p.w, 0.56, p.d, 'tile', { tint: 0xcfcbc2 });
    this.box(p.lx + 0.08, 0.13, p.lz + 0.08, p.w - 0.16, 0.46, p.d - 0.16, 'tile', { tint: 0xe4e0d8, solid: false });
    if (o.slot) this._container(o.slot, null, p.lx + p.w / 2, 0.3, p.lz + p.d / 2, 'tub').label = 'Bathtub';
    return this;
  }

  toilet(o) {
    const p = this._spot(o, 0.4, 0.58);
    if (!p) return this;
    const { lx, lz, w, d, fx, fz } = p;
    this.box(lx, 0, lz, w, 0.4, d, 'tile', { tint: 0xdcd8d0 });
    if (p.vertical) this.box(lx + (fx > 0 ? 0 : w - 0.18), 0.4, lz, 0.18, 0.46, d, 'tile', { tint: 0xdcd8d0, solid: false });
    else this.box(lx, 0.4, lz + (fz > 0 ? 0 : d - 0.18), w, 0.46, 0.18, 'tile', { tint: 0xdcd8d0, solid: false });
    if (o.slot) this._container(o.slot, null, lx + w / 2, 0.45, lz + d / 2, 'toilet').label = 'Toilet';
    return this;
  }

  sink(o) {
    const p = this._spot(o, 0.52, 0.4);
    if (!p) return this;
    this.box(p.lx, 0.68, p.lz, p.w, 0.15, p.d, 'tile', { tint: 0xdcd8d0 });
    this.box(p.lx + p.w / 2 - 0.06, 0, p.lz + p.d / 2 - 0.06, 0.12, 0.68, 0.12, 'metal', { solid: false });
    return this;
  }

  stove(o) {
    const p = this._spot(o, 0.76, 0.6);
    if (!p) return this;
    this.box(p.lx, 0, p.lz, p.w, 0.85, p.d, 'metalDark');
    this.box(p.lx + 0.04, 0.85, p.lz + 0.04, p.w - 0.08, 0.03, p.d - 0.08, 'metal');
    return this;
  }

  fridge(o) {
    const p = this._spot(o, 0.68, 0.62);
    if (!p) return this;
    this.box(p.lx, 0, p.lz, p.w, 1.7, p.d, 'metal', { tint: 0xa8a6a0 });
    return this;
  }

  microwave(o) {
    const p = this._spot(o, 0.56, 0.4);
    if (!p) return this;
    const dy = o.dy ?? 0.9;
    this.box(p.lx, dy, p.lz, p.w, 0.32, p.d, 'metalDark');
    if (o.slot) this._container(o.slot, null, p.lx + p.w / 2, dy + 0.16, p.lz + p.d / 2, 'microwave');
    return this;
  }

  barrel(o) {
    const p = this._spot(o, 0.6, 0.6);
    if (!p) return this;
    const [x, z] = this.W(p.lx + 0.3, p.lz + 0.3);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.82, 14),
      this.world.m('metal', [2, 1]));
    b.position.set(x, this.Y(0.41), z);
    b.castShadow = true;
    this.world.scene.add(b);
    this.world.addSolid({ x: x - 0.3, y: this.Y(0), z: z - 0.3 },
                        { x: x + 0.3, y: this.Y(0.82), z: z + 0.3 }, 'prop');
    if (o.slot) this._container(o.slot, null, p.lx + 0.3, 0.95, p.lz + 0.3, 'barrel');
    return this;
  }

  crate(o) {
    const sz = o.size ?? 0.55;
    const p = this._spot(o, sz, sz);
    if (!p) return this;
    this.box(p.lx, 0, p.lz, sz, sz, sz, 'woodRaw');
    if (o.stack) this.box(p.lx + 0.06, sz, p.lz + 0.06, sz - 0.14, sz - 0.14, sz - 0.14, 'woodRaw');
    return this;
  }

  pipes(lx, lz, len = 4, vertical = false) {
    const [x, z] = this.W(lx, lz);
    const m = this.world.m('metal', [len, 1]);
    for (let i = 0; i < 3; i++) {
      const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 10), m);
      if (vertical) pp.position.set(x + i * 0.24, this.Y(len / 2), z);
      else { pp.rotation.z = Math.PI / 2; pp.position.set(x, this.Y(1.9 + i * 0.24), z); }
      this.world.scene.add(pp);
    }
    return this;
  }

  /* ---------------------------------------------------------- big fixtures */

  well(lx, lz) {
    const [x, z] = this.W(lx, lz);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.8, 18, 1, true),
      this.world.m('brick', [3, 1]));
    ring.position.set(x, this.Y(0.4), z);
    ring.material = ring.material.clone();
    ring.material.side = THREE.DoubleSide;
    this.world.scene.add(ring);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.world.addSolid(
        { x: x + Math.cos(a) * 0.85 - 0.15, y: this.Y(0), z: z + Math.sin(a) * 0.85 - 0.15 },
        { x: x + Math.cos(a) * 0.85 + 0.15, y: this.Y(0.8), z: z + Math.sin(a) * 0.85 + 0.15 }, 'prop');
    }
    this.box(lx - 0.98, 0.8, lz - 0.08, 0.12, 1.5, 0.16, 'woodRaw', { solid: false });
    this.box(lx + 0.86, 0.8, lz - 0.08, 0.12, 1.5, 0.16, 'woodRaw', { solid: false });
    this.box(lx - 1.1, 2.3, lz - 0.5, 2.2, 0.14, 1.0, 'woodRaw', { solid: false });
    const rec = this._container('backyard:well', null, lx, 1.0, lz, 'well');
    rec.label = 'Well'; rec.needs = 'winchHandle';
    this.fixtures.push({ id: 'well', kind: 'well', ...this._pt(lx, 1.0, lz), container: rec });
    return this;
  }

  crowCage(lx, lz, slot) {
    this.box(lx - 0.05, 0, lz - 0.05, 0.1, 1.15, 0.1, 'woodRaw', { solid: false });
    this.box(lx - 0.42, 1.15, lz - 0.42, 0.85, 0.85, 0.85, 'metalDark');
    const rec = this._container(slot, null, lx, 1.55, lz, 'cage');
    rec.label = 'Crow cage'; rec.needs = 'birdseed';
    return this;
  }

  car(lx, lz) {
    const body = 'metal';
    this.box(lx, 0.32, lz, 4.3, 0.58, 1.85, body, { tint: 0x4a5560 });
    this.box(lx + 1.0, 0.90, lz + 0.12, 1.95, 0.62, 1.61, body, { tint: 0x3e4852 });
    for (const [ox, oz] of [[0.55, -0.06], [3.3, -0.06], [0.55, 1.72], [3.3, 1.72]]) {
      const [x, z] = this.W(lx + ox, lz + oz);
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14),
        new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.95 }));
      wh.rotation.x = Math.PI / 2;
      wh.position.set(x + 0.22, this.Y(0.32), z + 0.11);
      this.world.scene.add(wh);
    }
    const hood = this.box(lx + 3.25, 0.90, lz + 0.1, 1.05, 0.07, 1.65, body, { tint: 0x55606c });
    const trunk = this.box(lx - 0.02, 0.90, lz + 0.1, 0.85, 0.07, 1.65, body, { tint: 0x55606c });
    const t = this._container('car:trunk', trunk, lx + 0.4, 0.95, lz + 0.92, 'trunk');
    t.locked = true; t.key = 'carKey'; t.label = 'Car trunk';
    this._container('car:glove', null, lx + 1.6, 0.85, lz + 1.35, 'glove').label = 'Glove compartment';
    this._container('car:engine', hood, lx + 3.78, 0.95, lz + 0.92, 'engine').label = 'Engine bay';
    this.hidingSpots.push({ kind: 'car', ...this._pt(lx + 2.0, 0.35, lz + 0.92), label: 'Hide in the car' });
    this.fixtures.push({ id: 'car', kind: 'car', ...this._pt(lx + 1.6, 1.0, lz + 0.92) });
    return this;
  }

  /* ------------------------------------------------------------ internals */

  _pt(lx, dy, lz) {
    const [x, z] = this.W(lx, lz);
    return { x, y: this.Y(dy), z, room: this.cur.r.id };
  }

  _container(slot, mesh, lx, dy, lz, kind) {
    const rec = {
      slot, kind, mesh, open: false, locked: false, key: null,
      item: null, label: LABELS[kind] || 'Container', ...this._pt(lx, dy, lz),
    };
    this.containers.set(slot, rec);
    this.world.interactables.push(rec);
    return rec;
  }
}

// Post-build check: nothing solid may sit in the swept volume of a doorway.
// Furniture placement is rule-driven, but fixtures built with raw boxes are
// not, so this is the backstop that proves the house is actually walkable.
// Nothing solid may stand in a staircase or on its landings.
export function auditStairs(world) {
  const bad = [];
  for (const st of (world.stairsBuilt || [])) {
    const run = st.run || 4.6;
    const PAD = 0.5;
    const half = st.width / 2 + 0.2;
    const za = st.dir === 'N' ? st.z - run : st.z;
    const zb = st.dir === 'N' ? st.z : st.z + run;
    const zone = {
      x0: st.x - half, x1: st.x + half,
      z0: Math.min(za, zb) - PAD, z1: Math.max(za, zb) + PAD,
    };
    // Only props that actually share the staircase's vertical span count --
    // without this, anything sitting above or below it on another floor shows
    // up as a false positive.
    const yLo = Math.min(st._y0 ?? -1e9, st._y1 ?? 1e9);
    const yHi = Math.max(st._y0 ?? -1e9, st._y1 ?? 1e9);
    for (const s of world.solids) {
      if (s.tag !== 'prop') continue;
      if (s.max.x - s.min.x <= 0) continue;
      if (s.max.y - s.min.y < 0.3) continue;          // rugs and lips are fine
      if (s.max.y < yLo - 0.2 || s.min.y > yHi + 2.0) continue;
      if (s.min.x < zone.x1 && s.max.x > zone.x0 &&
          s.min.z < zone.z1 && s.max.z > zone.z0) {
        bad.push({ stair: st.id, room: s.ref,
                   at: [+s.min.x.toFixed(2), +s.min.y.toFixed(2), +s.min.z.toFixed(2)] });
      }
    }
  }
  return bad;
}

// Is there room to stand on every step? A staircase running under a balcony
// or a low ceiling is geometrically fine and completely unusable.
export function auditStairHeadroom(world, need = 1.85) {
  const bad = [];
  for (const st of (world.stairsBuilt || [])) {
    const run = st.run || 4.6;
    const dir = st.dir === 'N' ? -1 : 1;
    const y0 = st._y0 ?? 0, y1 = st._y1 ?? 0;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const z = st.z + dir * run * f;
      const yFoot = (dir < 0 ? y0 + (y1 - y0) * f : y1 - (y1 - y0) * f);
      const list = world.near(st.x - st.width / 2, z - 0.2, st.x + st.width / 2, z + 0.2, []);
      for (const s of list) {
        if (s.tag === 'stair' || s.tag === 'floor' || s.max.x - s.min.x <= 0) continue;
        if (s.min.x > st.x + st.width / 2 || s.max.x < st.x - st.width / 2) continue;
        if (s.min.z > z + 0.2 || s.max.z < z - 0.2) continue;
        // Anything whose underside sits between the tread and head height.
        if (s.min.y > yFoot + 0.25 && s.min.y < yFoot + need) {
          bad.push({ stair: st.id, atZ: +z.toFixed(2), headroom: +(s.min.y - yFoot).toFixed(2),
                     tag: s.tag, ref: s.ref });
          i = steps + 1;
          break;
        }
      }
    }
  }
  return bad;
}

export function auditDoorways(world, clearance = 0.62) {
  const bad = [];
  const zones = [];

  for (const [roomId, ops] of world.openingsByRoom) {
    for (const op of ops) {
      if (op.window) continue;                  // sills are meant to be blocked
      const h = op.top - op.bottom;
      if (h < 1.0) continue;                    // crawl holes have their own rules
      const zone = op.axis === 'x'
        ? { min: { x: op.t0 - 0.1, y: op.bottom, z: op.line - clearance },
            max: { x: op.t1 + 0.1, y: op.bottom + Math.min(h, 2.0), z: op.line + clearance } }
        : { min: { x: op.line - clearance, y: op.bottom, z: op.t0 - 0.1 },
            max: { x: op.line + clearance, y: op.bottom + Math.min(h, 2.0), z: op.t1 + 0.1 } };
      zone.rooms = op.rooms;
      zones.push(zone);
    }
  }

  for (const s of world.solids) {
    if (s.tag !== 'prop') continue;
    if (s.max.x - s.min.x <= 0) continue;
    for (const z of zones) {
      if (s.min.x < z.max.x && s.max.x > z.min.x &&
          s.min.z < z.max.z && s.max.z > z.min.z &&
          s.min.y < z.max.y && s.max.y > z.min.y + 0.05) {
        bad.push({ room: s.ref, doorway: z.rooms.join('<->'),
                   at: [+s.min.x.toFixed(2), +s.min.y.toFixed(2), +s.min.z.toFixed(2)] });
        break;
      }
    }
  }
  return bad;
}

function overlaps(a, b) {
  return a.x0 < b.x1 - 0.001 && a.x1 > b.x0 + 0.001 &&
         a.z0 < b.z1 - 0.001 && a.z1 > b.z0 + 0.001;
}

const LABELS = {
  drawer: 'Drawer', cabinet: 'Cabinet', shelf: 'Shelf', highShelf: 'High shelf',
  cupboard: 'Cupboard', showcase: 'Showcase', bench: 'Workbench', safe: 'Safe',
  crib: 'Crib', tub: 'Bathtub', toilet: 'Toilet', microwave: 'Microwave',
  barrel: 'Barrel', tvTable: 'TV table', trunk: 'Trunk', glove: 'Glove compartment',
  engine: 'Engine', well: 'Well', cage: 'Crow cage',
};
