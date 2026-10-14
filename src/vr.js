// vr.js -- WebXR support for the Quest 3.
//
// The desktop game moves the camera directly. In XR the headset owns the
// camera, so the player becomes a rig: a group sitting at their feet that we
// move and snap-turn, with the camera parented inside it and driven by the
// head pose. Everything else -- collision, Granny, the item system -- is
// untouched and shared.
//
// Comfort choices, because this is a horror game and people flinch:
//   * snap turn by default (smooth turning is the main nausea trigger)
//   * a tunnel vignette while moving
//   * the jumpscare never rotates your head; she comes to you instead
import * as THREE from '../vendor/three.module.js?v=12';

const SNAP_ANGLE = Math.PI / 6;       // 30 degrees
const DEADZONE = 0.35;

export class VR {
  constructor({ renderer, scene, camera, player, loot, interactor, audio }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.loot = loot;
    this.interactor = interactor;
    this.audio = audio;

    this.active = false;
    this.supported = false;
    this.snapTurn = true;
    this.comfortVignette = true;
    this._snapArmed = true;
    this._triggerWas = [false, false];
    this._gripWas = [false, false];
    this._aWas = [false, false];

    // The rig: moved by locomotion, rotated by snap turn. The camera lives
    // inside it so the head pose composes on top.
    this.rig = new THREE.Group();
    this.rig.name = 'xrRig';
    scene.add(this.rig);

    this.controllers = [];
    this.grips = [];
    this._tmpV = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._fwd = new THREE.Vector3();

    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');

    this._buildControllers();
    this._buildWrist();
    this._buildVignette();
    this._probe();
  }

  async _probe() {
    if (!navigator.xr) return;
    try {
      this.supported = await navigator.xr.isSessionSupported('immersive-vr');
    } catch { this.supported = false; }
    this.onSupport?.(this.supported);
  }

  /* ----------------------------------------------------------- the session */

  async enter() {
    if (!navigator.xr) throw new Error('This browser has no WebXR.');
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });
    await this.renderer.xr.setSession(session);
    this.session = session;
    this.active = true;
    session.addEventListener('end', () => {
      this.active = false;
      this.session = null;
      this.player.vrMode = false;
      this.onExit?.();
    });
    this.player.vrMode = true;
    this.onEnter?.();
    return session;
  }

  exit() { this.session?.end(); }

  /* -------------------------------------------------------- controllers */

  _buildControllers() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.7 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x3a4049, roughness: 0.5 });

    for (let i = 0; i < 2; i++) {
      const c = this.renderer.xr.getController(i);
      this.rig.add(c);
      this.controllers.push(c);

      // A short aiming ray. Long laser pointers feel like a menu, not a hand.
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: 0xc8c2b6, transparent: true, opacity: 0.45,
      }));
      line.scale.z = 1.4;
      line.name = 'ray';
      c.add(line);

      const grip = this.renderer.xr.getControllerGrip(i);
      this.rig.add(grip);
      this.grips.push(grip);

      // A simple controller body -- no model loader is vendored, and a
      // recognisable blob is enough to anchor your hands in the space.
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.07, 4, 8), bodyMat);
      body.rotation.x = -0.5;
      grip.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 6, 16), ringMat);
      ring.position.set(0, -0.012, -0.03);
      ring.rotation.x = 1.1;
      grip.add(ring);
    }

    // Items are held in the right hand.
    this.handAnchor = new THREE.Group();
    this.handAnchor.position.set(0, -0.015, -0.07);
    this.grips[1].add(this.handAnchor);
  }

  // A small panel strapped to the left wrist: the HUD has to live in the world
  // because DOM overlays simply do not exist inside a headset.
  _buildWrist() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    this.wristCanvas = c;
    this.wristTex = new THREE.CanvasTexture(c);
    this.wristTex.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.08),
      new THREE.MeshBasicMaterial({ map: this.wristTex, transparent: true, opacity: 0.92 }));
    panel.position.set(0.012, 0.035, -0.055);
    panel.rotation.set(-0.95, 0.25, 0.1);
    this.grips[0].add(panel);
    this.wristPanel = panel;
    this._wristState = '';
  }

  drawWrist({ day, room, held, prompt }) {
    const key = [day, room, held, prompt].join('|');
    if (key === this._wristState) return;
    this._wristState = key;
    const x = this.wristCanvas.getContext('2d');
    x.clearRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(8,9,12,0.82)';
    x.fillRect(0, 0, 512, 256);
    x.strokeStyle = 'rgba(150,142,128,0.5)';
    x.lineWidth = 3;
    x.strokeRect(6, 6, 500, 244);

    x.fillStyle = '#b9b2a6';
    x.font = '600 34px "Courier New", monospace';
    x.fillText(`DAY ${day}`, 26, 56);
    x.font = '26px "Courier New", monospace';
    x.fillStyle = '#8d867b';
    x.fillText((room || '').toUpperCase().slice(0, 22), 26, 100);

    x.fillStyle = '#d8d2c6';
    x.font = '28px "Courier New", monospace';
    x.fillText(held ? held.toUpperCase().slice(0, 20) : '— EMPTY HANDED —', 26, 160);

    if (prompt) {
      x.fillStyle = '#cfc9bd';
      x.font = '24px "Courier New", monospace';
      wrapText(x, prompt.toUpperCase(), 26, 204, 460, 28);
    }
    this.wristTex.needsUpdate = true;
  }

  // Tunnel vignette while moving, drawn on a sphere around the head.
  _buildVignette() {
    const geo = new THREE.SphereGeometry(0.32, 20, 14);
    const mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: { amount: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform float amount;
        void main(){
          vec3 d = normalize(vP);
          float edge = 1.0 - abs(d.z);
          float a = smoothstep(0.55 - amount*0.5, 1.0, edge) * amount;
          gl_FragColor = vec4(0.0, 0.0, 0.0, a);
        }`,
    });
    this.vignette = new THREE.Mesh(geo, mat);
    this.vignette.renderOrder = 999;
    this.vignette.frustumCulled = false;
    this.camera.add(this.vignette);
    this.vignette.visible = false;
  }

  /* ------------------------------------------------------------- per frame */

  // Keep the rig under the player's feet, and let the head pose ride on top.
  syncRig() {
    const p = this.player;
    this.rig.position.set(p.pos.x, p.pos.y, p.pos.z);
    this.rig.rotation.y = p.yaw;
  }

  // Where the player is actually looking, in world space -- used so movement
  // follows the head rather than the rig.
  headYaw() {
    this.camera.getWorldQuaternion(this._tmpQ);
    this._fwd.set(0, 0, -1).applyQuaternion(this._tmpQ);
    return Math.atan2(-this._fwd.x, -this._fwd.z);
  }

  update(dt) {
    if (!this.active) { if (this.vignette) this.vignette.visible = false; return; }
    const session = this.renderer.xr.getSession();
    if (!session) return;

    let moveX = 0, moveZ = 0, turn = 0;
    let i = -1;
    for (const src of session.inputSources) {
      i++;
      const gp = src.gamepad;
      if (!gp) continue;
      const hand = src.handedness;
      const ax = gp.axes;
      // Quest reports the stick on axes 2/3; fall back to 0/1.
      const sx = Math.abs(ax[2] ?? 0) > 0.001 || Math.abs(ax[3] ?? 0) > 0.001
        ? [ax[2], ax[3]] : [ax[0] ?? 0, ax[1] ?? 0];

      if (hand === 'left') {
        if (Math.abs(sx[0]) > DEADZONE) moveX = sx[0];
        if (Math.abs(sx[1]) > DEADZONE) moveZ = sx[1];
      } else if (hand === 'right') {
        turn = Math.abs(sx[0]) > DEADZONE ? sx[0] : 0;
      }

      const idx = hand === 'right' ? 1 : 0;
      const trigger = !!gp.buttons[0]?.pressed;
      const grip = !!gp.buttons[1]?.pressed;
      const aBtn = !!gp.buttons[4]?.pressed;
      const stickClick = !!gp.buttons[3]?.pressed;

      if (hand === 'right') {
        if (trigger && !this._triggerWas[idx]) this.onTrigger?.();
        if (grip && !this._gripWas[idx]) this.onGrip?.();
        if (aBtn && !this._aWas[idx]) this.onThrow?.();
      } else {
        if (trigger && !this._triggerWas[idx]) this.onLeftTrigger?.();
        // Clicking the left stick toggles the chest lamp.
        if (stickClick && !this._stickWas) this.onLeftStickClick?.();
        this._stickWas = stickClick;
      }
      this._triggerWas[idx] = trigger;
      this._gripWas[idx] = grip;
      this._aWas[idx] = aBtn;
    }

    // Snap turn, re-armed only once the stick returns to centre.
    if (this.snapTurn) {
      if (turn === 0) this._snapArmed = true;
      else if (this._snapArmed) {
        this.player.yaw -= Math.sign(turn) * SNAP_ANGLE;
        this._snapArmed = false;
      }
    } else {
      this.player.yaw -= turn * dt * 2.2;
    }

    // Locomotion relative to where the head is pointing.
    this.moveInput = { x: moveX, z: moveZ };
    const speed = Math.hypot(moveX, moveZ);
    if (this.vignette) {
      const want = this.comfortVignette ? Math.min(1, speed * 0.9) : 0;
      const u = this.vignette.material.uniforms.amount;
      u.value += (want - u.value) * Math.min(1, dt * 6);
      this.vignette.visible = u.value > 0.01;
    }
  }

  // Called by the player controller to get a desired direction in XR.
  wishDir() {
    if (!this.active || !this.moveInput) return null;
    const { x, z } = this.moveInput;
    if (!x && !z) return null;
    const yaw = this.headYaw();
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    // forward is -Z
    const f = -z, s = x;
    const v = new THREE.Vector3(-sin * f + cos * s, 0, -cos * f - sin * s);
    return v.normalize();
  }

  // The right controller's pose, for aiming interactions.
  aim() {
    const c = this.controllers[1];
    if (!c) return null;
    const origin = c.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion()));
    return { origin, dir };
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy); line = w; yy += lineHeight;
      if (yy > 244) return;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
