// flashlight.js -- the chest lamp.
//
// Mounted on the chest, not the head: it yaws with you but barely pitches, so
// looking at your feet does not swing the beam down with you. That is what
// makes a body-worn light feel worn rather than held, and it keeps the corners
// of a room dark while you are looking straight ahead.
import * as THREE from '../vendor/three.module.js?v=10';

const CHEST_DROP = 0.42;        // below eye height
const FIXED_PITCH = -0.10;      // a few degrees down, as a clipped lamp sits

export class Flashlight {
  constructor(scene, player, camera, audio) {
    this.scene = scene;
    this.player = player;
    this.camera = camera;
    this.audio = audio;
    this.on = false;
    this.vr = null;

    this.mount = new THREE.Group();
    scene.add(this.mount);

    this.beam = new THREE.SpotLight(0xf2ead6, 0, 16, 0.44, 0.55, 1.3);
    this.beam.position.set(0, 0, 0);
    this.mount.add(this.beam);

    this.target = new THREE.Object3D();
    this.mount.add(this.target);
    this.target.position.set(0, 0, -3);
    this.beam.target = this.target;

    // A soft pool right in front of you, so the beam does not look like it
    // starts a metre away.
    this.spill = new THREE.PointLight(0xe8e0cc, 0, 2.6, 2.0);
    this.mount.add(this.spill);

    // The lamp itself, visible when you glance down.
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.032, 0.11, 10),
      new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.65 }));
    body.rotation.x = Math.PI / 2;
    body.position.set(0.06, 0, -0.04);
    this.mount.add(body);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.030, 0.027, 0.02, 10),
      new THREE.MeshBasicMaterial({ color: 0x15171a }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.06, 0, -0.10);
    this.mount.add(lens);
    this.lens = lens;
    this.body = body;

    this._flicker = 0;
  }

  toggle() {
    this.on = !this.on;
    this.audio?.trapSnap?.(6);        // a small, dry click
    this.onChange?.(this.on);
    return this.on;
  }

  update(dt) {
    const p = this.player;
    const inVR = this.vr && this.vr.active;

    // Chest position: under the head, and yawed with the view.
    let yaw;
    if (inVR) {
      yaw = this.vr.headYaw();
      this.mount.position.set(
        this.camera.getWorldPosition(new THREE.Vector3()).x,
        p.pos.y + (p.height ?? 1.7) - CHEST_DROP - 0.1,
        this.camera.getWorldPosition(new THREE.Vector3()).z);
    } else {
      yaw = p.yaw;
      this.mount.position.set(p.pos.x, p.pos.y + p.eye - CHEST_DROP, p.pos.z);
    }
    this.mount.rotation.set(0, yaw, 0);
    // Pitch the beam only, and only a little: the mount stays level.
    this.target.position.set(0, Math.tan(FIXED_PITCH) * 3, -3);

    // Cheap bulb flicker so it reads as a tired torch rather than a lamp.
    const want = this.on ? 1 : 0;
    this._flicker += dt;
    const wobble = this.on
      ? 0.92 + Math.sin(this._flicker * 23.3) * 0.04 + Math.sin(this._flicker * 7.1) * 0.04
      : 0;
    this.beam.intensity += (want * 3.1 * wobble - this.beam.intensity) * Math.min(1, dt * 14);
    this.spill.intensity += (want * 0.5 - this.spill.intensity) * Math.min(1, dt * 14);
    this.lens.material.color.setHex(this.on ? 0xfff4dc : 0x15171a);
    this.body.visible = this.lens.visible = !inVR ? true : true;
  }
}
