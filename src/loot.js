// loot.js -- putting the items in the house, and carrying them.
//
// Rules taken from the game: you carry one thing at a time, in your hand,
// where you can see it. Items hidden in drawers and safes are not visible
// until you have opened the thing they are in. Dropping makes a noise, and
// noise is the only sense Granny really has.
import * as THREE from '../vendor/three.module.js?v=10';
import { ITEMS, STATIC, PRESETS } from './items.js?v=10';

const ROUND_KEY = 'granny.preset';

export class Loot {
  constructor(world, props, player, camera, audio) {
    this.world = world;
    this.props = props;
    this.player = player;
    this.camera = camera;
    this.audio = audio;
    this.entities = [];
    this.carried = null;
    this.onMessage = () => {};

    // Items in hand are drawn on a rig parented to the camera, so they stay
    // in view however you turn.
    this.hand = new THREE.Group();
    // Kept modest: a wide offset falls outside the frame on a tall window,
    // which is exactly how the held item went missing the first time.
    this.hand.position.set(0.17, -0.14, -0.58);
    this.camera.add(this.hand);
    if (!this.camera.parent) world.scene.add(this.camera);
  }

  // The game steps to the next preset each round rather than randomising, so
  // a second playthrough is laid out differently but still deterministic.
  nextPreset() {
    let n = 0;
    try { n = parseInt(localStorage.getItem(ROUND_KEY) || '0', 10) || 0; } catch { n = 0; }
    try { localStorage.setItem(ROUND_KEY, String((n + 1) % PRESETS.length)); } catch {}
    return n % PRESETS.length;
  }

  spawn(presetIndex) {
    this.presetIndex = presetIndex ?? this.nextPreset();
    const layout = { ...STATIC, ...PRESETS[this.presetIndex] };

    for (const [itemId, slot] of Object.entries(layout)) {
      if (!ITEMS[itemId]) { console.warn('unknown item', itemId); continue; }
      this._place(itemId, slot);
    }
    this._linkNested();
    return this;
  }

  _place(itemId, slot) {
    const def = ITEMS[itemId];
    const mesh = def.build();
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

    const ent = {
      kind: 'item', id: itemId, label: def.label, mesh,
      slot, container: null, visible: false, carried: false,
      x: 0, y: 0, z: 0, spin: Math.random() * Math.PI * 2,
    };

    // "melon" and "chest:puzzle" are not containers in the world -- they are
    // inside another item, or behind the chest puzzle. Linked up afterwards.
    if (slot === 'melon' || slot === 'chest:puzzle') {
      ent.nestedIn = slot;
      this.entities.push(ent);
      return ent;
    }

    const c = this.props.containers.get(slot);
    if (!c) {
      console.warn(`item ${itemId} wants slot "${slot}" which does not exist`);
      this.entities.push(ent);
      return ent;
    }

    c.item = c.item || [];
    c.item.push(ent);
    ent.container = c;
    // Sit it just above the surface, nudged so two things in one drawer do not
    // occupy the same point.
    const k = c.item.length - 1;
    ent.x = c.x + (k % 2 ? 0.1 : -0.06);
    ent.y = c.y + 0.06;
    ent.z = c.z + (k > 1 ? 0.09 : 0);
    mesh.position.set(ent.x, ent.y, ent.z);
    mesh.visible = false;
    this.world.scene.add(mesh);
    this.entities.push(ent);
    return ent;
  }

  // Items stashed inside the melon or the chest puzzle come out when those do.
  _linkNested() {
    const melon = this.entities.find(e => e.id === 'melon');
    for (const e of this.entities) {
      if (e.nestedIn === 'melon' && melon) {
        e.host = melon;
        melon.holds = melon.holds || [];
        melon.holds.push(e);
      }
      if (e.nestedIn === 'chest:puzzle') {
        // Whichever chest is the safe one this round.
        const chests = [1, 2, 3, 4].map(n => this.props.containers.get(`chest:${n}`)).filter(Boolean);
        const safe = chests[this.presetIndex % (chests.length || 1)];
        if (safe) {
          safe.item = safe.item || [];
          safe.item.push(e);
          e.container = safe;
          e.x = safe.x; e.y = safe.y + 0.08; e.z = safe.z;
          e.mesh.position.set(e.x, e.y, e.z);
          e.mesh.visible = false;
          this.world.scene.add(e.mesh);
        }
        for (const c of chests) c.safeChest = safe === c;
      }
    }
  }

  // Called when a container is opened: everything inside becomes visible, and
  // from then on it is an ordinary thing lying there to be picked up.
  reveal(container) {
    const items = container.item;
    if (!Array.isArray(items) || !items.length) return [];
    const shown = [];
    for (const e of items) {
      if (e.visible || e.carried) continue;
      e.visible = true;
      e.mesh.visible = true;
      this.world.interactables.push(e);
      shown.push(e);
    }
    return shown;
  }

  // Smashing the melon drops whatever was inside it.
  spill(hostEntity) {
    if (!hostEntity.holds) return [];
    const out = [];
    for (const e of hostEntity.holds) {
      if (e.visible || e.carried) continue;
      e.visible = true;
      e.x = hostEntity.x; e.y = hostEntity.y; e.z = hostEntity.z;
      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.visible = true;
      this.world.scene.add(e.mesh);
      this.world.interactables.push(e);
      out.push(e);
    }
    hostEntity.holds = [];
    return out;
  }

  canCarry() { return !this.carried; }

  take(ent) {
    if (this.carried) {
      this.onMessage(`Your hands are full — you are holding the ${this.carried.label}.`);
      return false;
    }
    ent.carried = true;
    ent.visible = false;
    const i = this.world.interactables.indexOf(ent);
    if (i >= 0) this.world.interactables.splice(i, 1);
    this.world.scene.remove(ent.mesh);
    // Re-parent to the hand rig. Items are wildly different sizes -- a key
    // next to a shotgun -- so each is scaled to a common size in hand and
    // centred on its own bounds, otherwise half of them fill the screen and
    // the rest are invisible.
    ent.mesh.scale.setScalar(1);
    ent.mesh.position.set(0, 0, 0);
    ent.mesh.rotation.set(0, 0, 0);
    ent.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ent.mesh);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const k = Math.min(1, 0.19 / longest);
    ent.mesh.scale.setScalar(k);
    ent.mesh.position.set(-centre.x * k, -centre.y * k, -centre.z * k);
    ent.mesh.rotation.set(0.25, 0.7, 0.12);
    ent.mesh.visible = true;
    // In XR the item belongs to the controller, not to a screen-space rig.
    (this.vrAnchor || this.hand).add(ent.mesh);
    this.carried = ent;
    this.player.inventory.add(ent.id);
    this.audio?.footstep(0, true);
    this.onMessage(`Picked up the ${ent.label}.`);
    return true;
  }

  // Put it down in front of you. The thud is what she hears.
  drop(throwIt = false) {
    const ent = this.carried;
    if (!ent) return null;
    const p = this.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const reach = throwIt ? 2.6 : 0.75;

    (this.vrAnchor || this.hand).remove(ent.mesh);
    ent.mesh.scale.setScalar(1);
    ent.mesh.position.set(0, 0, 0);
    ent.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    ent.x = p.pos.x + fx * reach;
    ent.y = p.pos.y + 0.06;
    ent.z = p.pos.z + fz * reach;
    ent.mesh.position.set(ent.x, ent.y, ent.z);
    ent.mesh.visible = true;
    this.world.scene.add(ent.mesh);
    this.world.interactables.push(ent);
    ent.carried = false;
    ent.visible = true;
    ent.container = null;
    this.carried = null;
    p.inventory.delete(ent.id);

    this.audio?.floorCreak(0);
    this.onDropNoise?.(ent.x, ent.y, ent.z, throwIt ? 7 : 4);

    // Throwing the melon bursts it, which is how you get at what is inside.
    if (throwIt && ent.holds && ent.holds.length) {
      const spilled = this.spill(ent);
      ent.mesh.scale.set(1.15, 0.45, 1.15);       // split open
      this.audio?.trapSnap(0);
      this.onMessage(`The ${ent.label} bursts open — ${spilled.map(x => x.label).join(', ')}.`);
      return ent;
    }

    this.onMessage(throwIt ? `Threw the ${ent.label}.` : `Dropped the ${ent.label}.`);
    return ent;
  }

  update(dt) {
    // Loose items turn gently so they catch the light and read as pickups.
    for (const e of this.entities) {
      if (!e.visible || e.carried) continue;
      e.spin += dt * 0.6;
      e.mesh.rotation.y = e.spin;
      e.mesh.position.y = e.y + Math.sin(e.spin * 1.6) * 0.012;
    }
    if (this.carried && !this.vrAnchor) {
      // A little sway, so the held item is not welded to the screen. In XR
      // your actual hand supplies the motion.
      const t = performance.now() / 1000;
      this.hand.rotation.x = Math.sin(t * 1.1) * 0.03;
      this.hand.rotation.z = Math.sin(t * 0.8) * 0.025;
    }
  }

  // Debug / verification aid.
  census() {
    const placed = this.entities.filter(e => e.container || e.host || e.nestedIn);
    return {
      preset: this.presetIndex + 1,
      total: this.entities.length,
      placed: placed.length,
      orphans: this.entities.filter(e => !e.container && !e.nestedIn).map(e => e.id),
      visible: this.entities.filter(e => e.visible).length,
    };
  }
}
