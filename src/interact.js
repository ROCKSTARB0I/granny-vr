// interact.js -- looking at things and using them.
//
// Picks whatever interactable the player is aimed at and within reach of, shows
// a prompt for it, and acts on it when E is pressed. Ladders and trapdoors are
// the ones that matter right now: without this the house's vertical shortcuts
// existed as geometry but could not actually be used.
import * as THREE from '../vendor/three.module.js?v=10';

const REACH = 2.6;
const AIM = 0.62;          // how closely you must be looking at it

export class Interactor {
  constructor(world, player, camera, audio) {
    this.world = world;
    this.player = player;
    this.camera = camera;
    this.audio = audio;
    this.current = null;
    this.climbing = null;   // active ladder climb
    this._fwd = new THREE.Vector3();
    this.onMessage = () => {};
  }

  // The best interactable in front of the player, or null.
  // In XR you point with the controller rather than your face, so the origin
  // and direction can be supplied from outside.
  pick(aim) {
    const p = this.player;
    if (p.freecam) return null;
    // Hidden: the only interaction left is getting out again.
    if (this.hiding?.hidden) return this.hiding.current;
    const eye = aim ? { x: aim.origin.x, y: aim.origin.y, z: aim.origin.z }
                    : { x: p.pos.x, y: p.pos.y + p.eye, z: p.pos.z };
    if (aim) this._fwd.set(aim.dir.x, 0, aim.dir.z).normalize();
    else this._fwd.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));

    let best = null, bestScore = -Infinity;
    for (const it of this.world.interactables) {
      if (it.x === undefined) continue;
      const dx = it.x - eye.x, dy = it.y - eye.y, dz = it.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > REACH) continue;
      if (Math.abs(dy) > 2.0) continue;
      const horiz = Math.hypot(dx, dz);
      // Something directly below you -- a floor hatch you are stood on -- has
      // no meaningful horizontal direction, so there is nothing to aim at.
      const overhead = horiz < 0.6;
      const aim = overhead ? 1 : (dx / horiz) * this._fwd.x + (dz / horiz) * this._fwd.z;
      // Aim matters at range, not up close.
      const needed = (overhead || dist < 1.2) ? -0.4 : AIM;
      if (aim < needed) continue;
      // Ladders and hatches outrank scenery, so standing at a ladder offers
      // the climb rather than a shelf on the wall behind it.
      const bonus = (it.kind === 'hidingSpot') ? 1.0
                  : (it.kind === 'ladder' || it.kind === 'trapdoor') ? 1.2
                  : it.kind === 'item' ? 1.6          // a pickup always wins
                  : 0;
      const score = aim * 2 - dist * 0.4 + bonus;
      if (score > bestScore) { bestScore = score; best = it; }
    }

    // Doors are interactable too, but they are not in the same list.
    for (const d of this.world.doors) {
      if (!d.openable) continue;
      const c = d.centre;
      const dx = c.x - eye.x, dy = c.y - eye.y, dz = c.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > REACH || Math.abs(dy) > 2.0) continue;
      const horiz = Math.hypot(dx, dz) || 0.0001;
      const aim = (dx / horiz) * this._fwd.x + (dz / horiz) * this._fwd.z;
      if (aim < AIM) continue;
      const score = aim * 2 - dist * 0.4 - 0.3;   // doors lose ties
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  label(it) {
    if (!it) return '';
    if (it.kind === 'hidingSpot') return this.hiding ? this.hiding.label(it) : it.label;
    if (it.kind === 'item') {
      return this.loot && !this.loot.canCarry()
        ? `Hands full — holding the ${this.loot.carried.label}`
        : `Take the ${it.label}`;
    }
    if (it.kind === 'ladder') return 'Climb';
    if (it.kind === 'trapdoor') {
      if (it.key && !this.player.has?.(it.key)) return `Locked — needs the ${pretty(it.key)}`;
      return `Open the ${it.label || 'hatch'}`;
    }
    if (it.openAmount !== undefined) return it.openAmount > 0.5 ? 'Close' : 'Open';
    if (it.locked) {
      if (it.key) return `Locked — needs the ${pretty(it.key)}`;
      if (it.needs) return `Locked — needs ${Array.isArray(it.needs) ? it.needs.map(pretty).join(' and ') : pretty(it.needs)}`;
      return 'Locked';
    }
    return `Search the ${(it.label || 'container').toLowerCase()}`;
  }

  use(it) {
    if (!it) return;
    const p = this.player;

    if (it.kind === 'item') { this.loot?.take(it); return; }

    if (it.kind === 'hidingSpot') {
      if (this.hiding?.hidden) this.hiding.leave();
      else this.hiding?.enter(it, this.granny);
      return;
    }

    if (it.kind === 'ladder') { this.startClimb(it); return; }

    if (it.kind === 'trapdoor') {
      if (it.key && !(p.has && p.has(it.key))) {
        this.onMessage(`It is locked. You need the ${pretty(it.key)}.`);
        return;
      }
      const [roomId, lx, lz] = it.dest;
      const r = this.world.rooms.find(q => q.id === roomId);
      if (!r) return;
      const y = this.world.roomRects.find(q => q.id === roomId)?.y ?? 0;
      p.teleport(r.x + lx, y + 0.2, r.z + lz);
      this.audio?.doorCreak(0);
      this.onMessage(`You drop into the ${r.label}.`);
      return;
    }

    if (it.openAmount !== undefined) {            // a door
      it.target = it.target > 0.5 ? 0 : 1;
      this.audio?.doorCreak(0);
      return;
    }

    if (it.locked) {
      this.onMessage(this.label(it));
      return;
    }

    // Three of the four chests in the Chest Room are rigged.
    if (it.kind === 'chest' && it.safeChest === false) {
      it.open = true;
      this.onMessage('The chest was rigged.');
      this.onExplode?.(it);
      return;
    }

    // Opening a container reveals whatever is inside; the item is then an
    // ordinary thing lying there, which you pick up separately.
    const first = !it.open;
    it.open = true;
    const found = this.loot ? this.loot.reveal(it) : [];
    if (found.length) {
      this.onMessage(found.length === 1
        ? `You found the ${found[0].label}.`
        : `You found the ${found.map(f => f.label).join(' and the ')}.`);
    } else if (first) {
      this.onMessage(`The ${(it.label || 'container').toLowerCase()} is empty.`);
    }
  }

  // Ladders move you smoothly rather than snapping, so you can see where you
  // came out -- a hard cut between floors is disorienting in a house this
  // vertical.
  startClimb(ladder) {
    const p = this.player;
    const dest = ladder.dest;
    this.climbing = {
      fromY: p.pos.y,
      toY: dest.y + 0.15,
      x0: p.pos.x, z0: p.pos.z,
      x1: dest.x, z1: dest.z,
      t: 0,
      dur: Math.max(0.6, Math.abs(dest.y - p.pos.y) / 2.4),
    };
    this.onMessage(dest.y > p.pos.y ? 'Climbing up…' : 'Climbing down…');
  }

  update(dt) {
    if (this.climbing) {
      const c = this.climbing;
      c.t += dt;
      const k = Math.min(1, c.t / c.dur);
      const e = k * k * (3 - 2 * k);
      const p = this.player;
      p.pos.set(c.x0 + (c.x1 - c.x0) * e, c.fromY + (c.toY - c.fromY) * e,
                c.z0 + (c.z1 - c.z0) * e);
      p.vel.set(0, 0, 0);
      // One rung-scrape per step of the climb.
      if (Math.floor(c.t * 3) !== Math.floor((c.t - dt) * 3)) this.audio?.footstep(0, true);
      if (k >= 1) this.climbing = null;
      return true;      // the climb owns the player this frame
    }
    this.current = this.pick(this.aimSource ? this.aimSource() : null);
    return false;
  }
}

function pretty(id) {
  if (!id) return '';
  return String(id).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim().toLowerCase();
}
