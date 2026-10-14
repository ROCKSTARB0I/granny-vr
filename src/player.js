// player.js -- first-person controller.
//
// Collision is a swept AABB against the world's box list. Anything whose top
// is within STEP_HEIGHT of the player's feet is stepped onto instead of
// blocking, which is what makes stairs, thresholds and kerbs work without
// any special-case code.
import * as THREE from '../vendor/three.module.js?v=10';
import { STEP_HEIGHT, moveBody, clearAt } from './collide.js?v=10';

const RADIUS = 0.28;
export const EYE_STAND = 1.62;
export const EYE_CROUCH = 0.95;
const HEIGHT_STAND = 1.78;
const HEIGHT_CROUCH = 1.05;

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 0, 0);   // feet
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.crouch = false;
    this.grounded = false;
    this.freecam = false;
    this.walkSpeed = 2.6;
    this.crouchSpeed = 1.7;
    this.sprintSpeed = 4.0;
    this.freeSpeed = 8.0;
    this.bob = 0;
    this.stepDist = 0;
    this.noise = 0;          // how loud the player was this frame
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.keys = new Set();
    this.lastRoom = null;
    this._near = [];          // scratch list reused by the collision queries
    this.inventory = new Set();   // filled in by the item system
    // In XR the headset owns the camera and a rig is moved instead, so the
    // desktop camera sync must stand down.
    this.vrMode = false;
    this.vr = null;
  }

  // Solids that could possibly touch the player this frame.
  _candidates(pad = 0.05) {
    const r = RADIUS + pad;
    return this.world.near(this.pos.x - r, this.pos.z - r,
                           this.pos.x + r, this.pos.z + r, this._near);
  }

  get height() { return this.crouch ? HEIGHT_CROUCH : HEIGHT_STAND; }
  get eye() { return this.crouch ? EYE_CROUCH : EYE_STAND; }

  teleport(x, y, z, yaw) {
    this.pos.set(x, y + 0.05, z);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
  }

  look(dx, dy) {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= (this.invertY ? -dy : dy) * this.sensitivity;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  wishDir() {
    // In XR the thumbstick decides, relative to where the head is pointing.
    if (this.vrMode && this.vr) {
      const v = this.vr.wishDir();
      if (v) return v;
    }
    const f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const s = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    if (!f && !s) return null;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward is -Z in three.js camera space
    const v = new THREE.Vector3(-sin * f + cos * s, 0, -cos * f - sin * s);
    return v.normalize();
  }

  update(dt) {
    if (this.freecam) return this._updateFree(dt);
    this._updateWalk(dt);
  }

  _updateFree(dt) {
    const dir = this.wishDir();
    const sp = this.freeSpeed * (this.keys.has('ShiftLeft') ? 3 : 1);
    if (dir) this.pos.addScaledVector(dir, sp * dt);
    if (this.keys.has('Space')) this.pos.y += sp * dt;
    if (this.keys.has('ControlLeft') || this.keys.has('KeyC')) this.pos.y -= sp * dt;
    this._syncCamera(0);
  }

  _updateWalk(dt) {
    const dir = this.wishDir();
    const sprinting = this.keys.has('ShiftLeft') && !this.crouch;
    const speed = this.crouch ? this.crouchSpeed : sprinting ? this.sprintSpeed : this.walkSpeed;

    const target = dir ? dir.clone().multiplyScalar(speed) : new THREE.Vector3();
    // Snappy but not instant -- matches the game's slightly floaty movement.
    const accel = this.grounded ? 14 : 3;
    this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);
    this.vel.y -= 18 * dt;
    if (this.vel.y < -28) this.vel.y = -28;

    const moved = this._move(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);

    // Footstep + head bob bookkeeping, and how much noise we are making.
    const planar = Math.hypot(moved.x, moved.z);
    this.stepDist += planar;
    this.bob += planar * (sprinting ? 9 : 6);
    this.noise = this.grounded
      ? (this.crouch ? planar * 0.25 : sprinting ? planar * 3.2 : planar * 1.4)
      : 0;

    this._syncCamera(planar);
  }

  _syncCamera(planar) {
    // XR drives the camera from the head pose; writing to it here would fight
    // the headset and make the world swim.
    if (this.vrMode) return;
    const bobY = this.freecam ? 0 : Math.sin(this.bob) * 0.028 * (this.crouch ? 0.5 : 1);
    const bobX = this.freecam ? 0 : Math.cos(this.bob * 0.5) * 0.018;
    this.camera.position.set(
      this.pos.x + bobX,
      this.pos.y + (this.freecam ? 0 : this.eye) + bobY,
      this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // The shared collision implementation drives this; see collide.js.
  _move(dx, dy, dz) {
    this.radius = RADIUS;
    return moveBody(this.world, this, dx, dy, dz, this._near);
  }

  canStand() {
    const saved = this.crouch;
    this.crouch = false;
    this.radius = RADIUS;
    const ok = clearAt(this.world, this, this.pos.x, this.pos.y, this.pos.z, null);
    this.crouch = saved;
    return ok;
  }

  has(id) { return this.inventory.has(id); }

  room() { return this.world.roomAt(this.pos.x, this.pos.y + 0.4, this.pos.z); }
}
