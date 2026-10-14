// hiding.js -- getting under the bed, into the wardrobe, into the car.
//
// props.js has been registering hiding spots since the furniture was built;
// nothing ever used them. This makes them real.
//
// The rule that matters, taken from the game: hiding works, but it is not a
// reset button. If she watched you climb in, she comes straight to the spot
// and hauls you out. If she merely wanders past while searching, she might
// check it. Hiding is a gamble whose odds depend on whether you broke her line
// of sight first.
import * as THREE from '../vendor/three.module.js?v=10';

const LABELS = {
  bed: 'Hide under the bed',
  cabinet: 'Hide in the wardrobe',
  car: 'Hide in the car',
};

export class Hiding {
  constructor(world, props, player, camera, audio) {
    this.world = world;
    this.props = props;
    this.player = player;
    this.camera = camera;
    this.audio = audio;
    this.current = null;      // the spot being occupied
    this.seenEntering = false;
    this.checkTimer = 0;
    this.onMessage = () => {};
    this.onFound = () => {};

    // Make every registered spot something you can actually point at.
    this.spots = props.hidingSpots.map((s, i) => {
      const rec = {
        ...s, kind: 'hidingSpot', spotKind: s.kind, id: 'hide' + i,
        label: LABELS[s.kind] || 'Hide',
        // Where the camera sits while you are in there.
        // Eye height above the room floor while you are in there.
        eye: s.kind === 'bed' ? 0.34 : s.kind === 'car' ? 0.95 : 1.12,
      };
      world.interactables.push(rec);
      return rec;
    });

    // Each spot gets a small purpose-built interior, placed in the world and
    // turned so its opening faces the room. The furniture itself is solid
    // boxes with no inside, so there is nothing to see from within one -- this
    // gives you the underside of the bed, or the slats of a wardrobe door, and
    // a gap to watch the room through.
    this.interiors = new Map();
    for (const spot of this.spots) {
      const rr = world.roomRects.find(r =>
        spot.x >= r.x && spot.x <= r.x + r.w &&
        spot.z >= r.z && spot.z <= r.z + r.d && Math.abs(r.y - spot.y) < 1.6);
      // Face the middle of the room: that is where she will come from.
      let ox = rr ? (rr.x + rr.w / 2) - spot.x : 0;
      let oz = rr ? (rr.z + rr.d / 2) - spot.z : 1;
      const n = Math.hypot(ox, oz) || 1;
      spot.outYaw = Math.atan2(ox / n, oz / n) + Math.PI;   // camera yaw facing out
      // The interiors are modelled with y=0 at the floor, so they hang off
      // the room's floor height, not the spot's own offset.
      spot.floorY = rr ? rr.y : spot.y;
      const g = this._buildInterior(spot.spotKind);
      g.position.set(spot.x, spot.floorY, spot.z);
      g.rotation.y = spot.outYaw + Math.PI;   // opening toward the room
      g.visible = false;
      world.scene.add(g);
      this.interiors.set(spot, g);
    }
  }

  // Looking out of a letterbox beats looking at nothing.
  _buildInterior(kind) {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 1 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.95 });
    const box = (w, h, d, x, y, z, m) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      g.add(b);
      return b;
    };

    if (kind === 'bed') {
      // Slats and the underside of the mattress overhead, floor below, and the
      // bed frame closing the sides -- a slot at floor level to watch through.
      box(2.0, 0.07, 2.2, 0, 0.52, 0, wood);            // underside
      for (let i = 0; i < 5; i++) box(1.9, 0.03, 0.09, 0, 0.47, -0.9 + i * 0.45, wood);
      box(0.09, 0.56, 2.2, -0.95, 0.26, 0, wood);        // left rail
      box(0.09, 0.56, 2.2, 0.95, 0.26, 0, wood);         // right rail
      box(2.0, 0.56, 0.09, 0, 0.26, -1.05, wood);        // far end
      // the near end stays open: that is your view out
    } else if (kind === 'cabinet') {
      box(1.0, 1.9, 0.06, 0, 0.95, -0.28, dark);         // back
      box(0.06, 1.9, 0.6, -0.47, 0.95, 0, dark);         // sides
      box(0.06, 1.9, 0.6, 0.47, 0.95, 0, dark);
      box(1.0, 0.06, 0.6, 0, 1.88, 0, dark);             // top
      // The door, with louvre gaps you can see the room through.
      for (let i = 0; i < 7; i++) {
        const y = 0.22 + i * 0.24;
        if (i === 4) continue;                           // one slat out, at eye level
        box(0.94, 0.21, 0.04, 0, y, 0.33, wood);
      }
      box(0.04, 1.9, 0.08, -0.45, 0.95, 0.33, wood);     // door stiles
      box(0.04, 1.9, 0.08, 0.45, 0.95, 0.33, wood);
    } else {                                              // the car
      box(1.8, 0.06, 1.5, 0, 1.15, 0, dark);             // roof
      box(0.07, 0.75, 1.5, -0.86, 0.78, 0, dark);        // doors
      box(0.07, 0.75, 1.5, 0.86, 0.78, 0, dark);
      box(1.8, 0.5, 0.07, 0, 0.62, -0.72, dark);         // dash
      box(1.8, 0.07, 0.07, 0, 1.12, 0.74, dark);         // rear header
    }
    return g;
  }

  get hidden() { return !!this.current; }

  label(spot) {
    if (this.current) return 'Come out';
    return spot.label;
  }

  enter(spot, granny) {
    if (this.current) return this.leave();
    const p = this.player;
    this.current = spot;
    p.hidden = true;
    p.vel.set(0, 0, 0);

    // Did she watch you do it? Line of sight at the moment of entry is the
    // whole gamble.
    this.seenEntering = !!(granny && granny.enabled &&
      (granny.state === 'chase' ||
       (Math.hypot(granny.pos.x - spot.x, granny.pos.z - spot.z) < granny.diff.sight * 1.2 &&
        Math.abs(granny.pos.y - spot.y) < 1.8 &&
        granny._lineOfSight(spot.x, spot.y + 1.0, spot.z))));

    this.checkTimer = this.seenEntering ? 0.9 : 6 + Math.random() * 6;
    this.audio?.doorCreak(0);

    // Face out of the opening, and remember the centre so the look can be
    // clamped -- you are in a box and should not be able to spin round in it.
    p.yaw = spot.outYaw;
    p.pitch = spot.spotKind === 'bed' ? 0.06 : 0;
    this.lookCentre = spot.outYaw;
    const it = this.interiors.get(spot);
    if (it) it.visible = true;
    this.applyCamera();
    this.onMessage(this.seenEntering ? 'She saw you.' : 'Hidden.');
    return true;
  }

  // The only thing hiding actually moves is the point of view. The player's
  // body stays where it was -- which is also what Granny's distance checks
  // should be measuring against.
  applyCamera() {
    const spot = this.current;
    if (!spot) return;
    const p = this.player;
    if (p.vrMode) return;        // in a headset the neck owns the camera
    this.camera.position.set(spot.x, spot.floorY + spot.eye, spot.z);
    this.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
  }

  leave() {
    if (!this.current) return false;
    const p = this.player;
    p.hidden = false;
    const it = this.interiors.get(this.current);
    if (it) it.visible = false;
    this.current = null;
    this.seenEntering = false;
    this.lookCentre = null;
    if (!p.vrMode) p._syncCamera(0);     // hand the view back to the body
    this.audio?.doorCreak(0);
    this.onMessage('You climb out.');
    return true;
  }

  update(dt, granny) {
    if (!this.current) return;

    const p = this.player;
    p.vel.set(0, 0, 0);

    // You can turn your head, but not your whole body: clamp to the opening.
    if (this.lookCentre !== null && this.lookCentre !== undefined) {
      let d = p.yaw - this.lookCentre;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const lim = this.current.spotKind === 'bed' ? 0.75 : 0.95;
      if (d > lim) p.yaw = this.lookCentre + lim;
      if (d < -lim) p.yaw = this.lookCentre - lim;
      p.pitch = Math.max(-0.55, Math.min(0.5, p.pitch));
    }
    this.applyCamera();

    if (!granny || !granny.enabled) return;

    const near = Math.hypot(granny.pos.x - this.current.x, granny.pos.z - this.current.z) < 1.6 &&
                 Math.abs(granny.pos.y - this.current.y) < 1.6;

    // She only ever checks a spot she is standing at. Having seen you get in
    // sends her straight there; otherwise it is a slow coin-flip.
    if (this.seenEntering) {
      if (!granny.path.length || granny.state !== 'chase') {
        granny.state = 'chase';
        granny._goTo(this.current.x, this.current.y, this.current.z);
      }
      if (near) {
        this.checkTimer -= dt;
        if (this.checkTimer <= 0) { this._found(granny); return; }
      }
    } else if (near) {
      this.checkTimer -= dt;
      if (this.checkTimer <= 0) { this._found(granny); return; }
    }
  }

  _found(granny) {
    const spot = this.current;
    this.onMessage(spot.spotKind === 'bed'
      ? 'She drops to the floor and reaches under.'
      : 'She hauls the door open.');
    this.leave();
    this.onFound(granny);
  }
}
