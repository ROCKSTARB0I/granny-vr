// jumpscare.js -- what happens the moment she reaches you.
//
// The whole effect is built around one idea: take the camera away from the
// player and give it to her. Control is seized, her face is moved to fill the
// frame, and for ~1.6 seconds the only things that move are her lunge and the
// shake. Being unable to look away is most of what makes it land.
import * as THREE from '../vendor/three.module.js?v=9';

const DURATION = 1.65;

export class JumpScare {
  constructor(scene, camera, granny, audio, rig, els) {
    this.scene = scene;
    this.camera = camera;
    this.granny = granny;
    this.audio = audio;
    this.rig = rig;
    this.flash = els.flash;       // full-screen red wash
    this.vignette = els.vignette;
    this.active = false;
    this.t = 0;
    this.onDone = null;

    // Her bat, swung in from the side at the moment of impact.
    this._shakeSeed = 0;
  }

  // `from` is where the camera was; we keep its position and only reorient,
  // so the cut does not read as a teleport.
  trigger(onDone) {
    if (this.active) return;
    this.vr = this.vrSource ? this.vrSource() : null;
    this.active = true;
    this.t = 0;
    this.onDone = onDone;
    this._shakeSeed = Math.random() * 1000;

    const cam = this.camera;
    this.camStart = cam.position.clone();
    this.camQuat = cam.quaternion.clone();

    // Park her directly in front of the camera, facing it, at arm's length.
    const g = this.granny;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    forward.y = 0;
    forward.normalize();

    this.startDist = 2.05;
    this.endDist = 0.42;           // close enough that her face fills the frame
    this.forward = forward;
    this.eyeY = cam.position.y;

    g.pos.set(cam.position.x + forward.x * this.startDist, g.pos.y,
              cam.position.z + forward.z * this.startDist);
    // Her model faces local -Z, so rotation.y = yaw points her at
    // (-sin yaw, -cos yaw). To stare back down the camera's forward vector she
    // needs yaw = atan2(forward.x, forward.z) -- no extra half turn.
    g.yaw = Math.atan2(forward.x, forward.z);
    g.state = 'scare';

    // The fade layer normally eases over half a second; during the scare it has
    // to track every frame exactly.
    if (this.flash) this.flash.classList.add('instant');

    // Her head snaps up to meet the camera, mouth wide.
    const u = g.mesh.userData;
    u.hip.rotation.x = -0.12;
    u.head.rotation.x = 0.1;
    this._mouth = u.head.children.find(c => c.geometry?.type === 'SphereGeometry' &&
                                            c.position.y < -0.05);

    // Kill the ordinary room lighting and underlight her instead. Lit from
    // below and from nowhere else, the same geometry reads completely
    // differently -- flat and doll-like becomes a face in the dark.
    const r = this.rig;
    if (r) {
      // Drop the room's own fixtures too, or she reads as a doll standing in a
      // lit bedroom rather than a face coming out of the dark.
      this._savedDim = r.dim;
      r.dim = 0.04;
      this._savedAmbient = r.ambient.intensity;
      this._savedCarry = r.carry.intensity;
      r.ambient.intensity = 0.05;
      r.carry.intensity = 0.0;
      if (!this.keyLight) {
        this.keyLight = new THREE.PointLight(0xffd9c0, 0, 3.4, 2.0);
        this.scene.add(this.keyLight);
      }
      this.keyLight.intensity = 2.3;
    }

    this.audio.setChase(false);
    this.audio.scream();
  }

  update(dt) {
    if (!this.active) return false;
    this.t += dt;
    const p = Math.min(1, this.t / DURATION);
    const cam = this.camera;
    const g = this.granny;

    // Lunge: fast in, then she hangs in your face for the rest of it.
    const lungeT = Math.min(1, this.t / 0.22);
    const eased = 1 - Math.pow(1 - lungeT, 3);
    const dist = this.startDist + (this.endDist - this.startDist) * eased;

    g.pos.x = this.camStart.x + this.forward.x * dist;
    g.pos.z = this.camStart.z + this.forward.z * dist;
    // She rises to eye level as she comes -- a hunched old woman should not be
    // able to do this, which is the point.
    const lift = this.eyeY - 1.52 + 0.08 * Math.sin(this.t * 34) * (1 - p);
    g.mesh.position.set(g.pos.x, lift, g.pos.z);
    g.mesh.rotation.set(0, g.yaw, 0);

    // Mouth gapes wider through the lunge.
    if (this._mouth) {
      const open = 1 + 1.9 * eased;
      this._mouth.scale.set(0.9 * (1 + 0.5 * eased), 1.25 * open, 0.5);
    }

    // In a headset the camera belongs to the player's neck. Wrenching it
    // around is both nauseating and a cheap trick, so in XR she simply arrives
    // in your face and the world goes dark -- no forced rotation, no shake.
    if (this.vr && this.vr.active) {
      if (this.flash) {
        const hit = Math.max(0, 1 - this.t / 0.14);
        this.flash.style.opacity = String(Math.min(1, 0.4 + p * 0.6));
      }
      if (p >= 1) {
        this.active = false;
        const done = this.onDone; this.onDone = null;
        if (done) done();
      }
      return true;
    }

    // Camera shake: violent at the hit, decaying fast.
    const shake = Math.pow(1 - p, 2.2) * 0.085;
    const s = this._shakeSeed;
    cam.position.set(
      this.camStart.x + Math.sin(this.t * 97 + s) * shake,
      this.camStart.y + Math.sin(this.t * 131 + s * 2) * shake,
      this.camStart.z + Math.cos(this.t * 113 + s * 3) * shake);
    // Keep her centred, plus a lurch as the bat connects.
    const look = new THREE.Vector3(g.pos.x, lift + 1.46, g.pos.z);
    cam.lookAt(look);
    cam.rotateZ(Math.sin(this.t * 22 + s) * 0.07 * Math.pow(1 - p, 2));

    // Keep the key light just under her chin as she closes in.
    if (this.keyLight) {
      this.keyLight.position.set(g.pos.x - this.forward.x * 0.42, lift + 1.05,
                                 g.pos.z - this.forward.z * 0.42);
      this.keyLight.intensity = 2.3 * (1 - p * 0.55);
    }

    // Red wash: a hard hit, then bleeding away to black.
    if (this.flash) {
      const hit = Math.max(0, 1 - this.t / 0.14);
      const bleed = 0.55 * Math.min(1, this.t / 0.5);
      this.flash.style.background =
        `radial-gradient(ellipse at center, rgba(120,8,4,${(0.25 + hit * 0.5).toFixed(3)}) 0%, rgba(0,0,0,${bleed.toFixed(3)}) 70%)`;
      this.flash.style.opacity = String(Math.min(1, 0.55 + p * 0.45));
    }

    if (p >= 1) {
      this.active = false;
      if (this.flash) this.flash.style.background = '#000';
      const done = this.onDone;
      this.onDone = null;
      if (done) done();
      return true;
    }
    return true;
  }

  // Put everything back the way the game expects it.
  reset() {
    this.active = false;
    if (this.flash) {
      this.flash.classList.remove('instant');
      this.flash.style.background = '#000';
      this.flash.style.opacity = '0';
    }
    const u = this.granny.mesh.userData;
    u.hip.rotation.x = 0.15;
    u.head.rotation.x = 0;
    if (this._mouth) this._mouth.scale.set(0.9, 1.25, 0.5);
    if (this.rig && this._savedAmbient !== undefined) {
      this.rig.dim = this._savedDim ?? 1;
      this.rig.ambient.intensity = this._savedAmbient;
      this.rig.carry.intensity = this._savedCarry;
    }
    if (this.keyLight) this.keyLight.intensity = 0;
  }
}
