// menu.js -- the title screen.
//
// Rebuilt from the game's own menu art: you are stood in a dark hallway, she
// is waiting in the lit doorway at the far end with the bat, and there is a
// bear trap on the boards between you. It is a real 3D scene rather than a
// picture, so she breathes and the camera drifts.
//
// The GRANNY wordmark is drawn to a canvas and then eroded with noise, the
// same way the rest of the game's art is made -- no font files, no images.
import * as THREE from '../vendor/three.module.js?v=12';
import { mat } from './textures.js?v=12';
import { buildModel } from './granny.js?v=12';

/* ------------------------------------------------------------- the wordmark */

// A heavy condensed serif, then bitten away at the edges so it reads as
// weathered and printed rather than typed.
function makeTitle(text, w = 1100, h = 260) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');

  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  // Wide letter spacing, as on the original.
  const font = `700 ${Math.round(h * 0.78)}px "Times New Roman", Georgia, serif`;
  x.font = font;
  const spacing = w / (text.length + 0.6);
  for (let i = 0; i < text.length; i++) {
    x.save();
    x.translate(spacing * (i + 0.8), h / 2);
    x.scale(0.82, 1.18);              // condensed and tall
    x.fillText(text[i], 0, 0);
    x.restore();
  }

  // Erode: punch holes and nibble edges with coarse then fine noise.
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const field = new Float32Array(w * h);
  // cheap blotchy field
  for (let i = 0; i < 260; i++) {
    const cx = rnd() * w, cy = rnd() * h, r = 2 + rnd() * 13;
    const r2 = r * r;
    for (let yy = Math.max(0, cy - r) | 0; yy < Math.min(h, cy + r); yy++) {
      for (let xx = Math.max(0, cx - r) | 0; xx < Math.min(w, cx + r); xx++) {
        const dx = xx - cx, dy = yy - cy;
        const q = dx * dx + dy * dy;
        if (q < r2) field[yy * w + xx] += 1 - q / r2;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    if (!a) continue;
    const f = field[i];
    // Holes where the blotches are strongest, plus fine speckle everywhere.
    let keep = 1;
    if (f > 1.6) keep = 0;
    else if (f > 1.05) keep = 0.45;
    if (rnd() < 0.045) keep *= 0.35;
    d[i * 4 + 3] = a * keep;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------------------------------------- the diorama */

export class MainMenu {
  constructor(world, renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.05);
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 60);
    this.t = 0;
    this.visible = false;
    this._build(world);
    this._buildDom();
  }

  _box(x, y, z, w, h, d, name, repeat, tint) {
    const m = mat(name, repeat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tint ? m.clone() : m);
    if (tint) mesh.material.color.setHex(tint);
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
    this.scene.add(mesh);
    return mesh;
  }

  _build(world) {
    // A corridor running away from the camera down -Z.
    const L = 11;
    this._box(-1.7, 0, -L, 0.2, 2.7, L, 'plaster', [L / 2.6, 1.1]);        // left wall
    this._box(1.5, 0, -L, 0.2, 2.7, L, 'plaster', [L / 2.6, 1.1]);         // right wall
    this._box(-1.7, -0.2, -L, 3.4, 0.2, L + 1, 'floorPlankDark', [2, L / 1.9]);
    this._box(-1.7, 2.7, -L, 3.4, 0.16, L, 'ceilingPlank', [2, L / 2.1]);

    // The doorway she stands in, at the end.
    const dz = -7.4;
    this._box(-1.7, 0, dz, 1.05, 2.7, 0.3, 'plaster', [0.6, 1.1]);
    this._box(0.65, 0, dz, 0.85, 2.7, 0.3, 'plaster', [0.5, 1.1]);
    this._box(-0.65, 2.15, dz, 1.3, 0.55, 0.3, 'plaster', [0.7, 0.4]);
    // frame
    this._box(-0.72, 0, dz - 0.04, 0.09, 2.2, 0.38, 'woodTrim', [0.3, 1.4]);
    this._box(0.63, 0, dz - 0.04, 0.09, 2.2, 0.38, 'woodTrim', [0.3, 1.4]);
    this._box(-0.72, 2.2, dz - 0.04, 1.44, 0.1, 0.38, 'woodTrim', [0.8, 0.2]);

    // The room beyond, so the doorway reads as lit from behind her.
    this._box(-2.6, 0, dz - 3.2, 5.2, 2.8, 0.2, 'plaster', [2, 1.2]);
    this._box(-2.6, -0.2, dz - 3.2, 5.2, 0.2, 3.2, 'floorPlankDark', [2.4, 1.6]);

    // Stairs on the right, as in the original.
    for (let i = 0; i < 9; i++) {
      this._box(1.5, i * 0.2, -3.4 - i * 0.28, 1.6, 0.2, 0.3, 'woodTrim', [1, 0.3]);
    }

    // Granny, waiting in the doorway.
    this.granny = buildModel(world);
    this.granny.position.set(-0.05, 0, dz - 0.75);
    this.granny.rotation.y = Math.PI;      // facing back down the hall at you
    this.scene.add(this.granny);

    // The bear trap on the boards between you and her.
    const trap = new THREE.Group();
    const steel = mat('metalDark', [1, 1]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.024, 6, 16), steel);
    ring.rotation.x = Math.PI / 2;
    trap.add(ring);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.11, 5), steel);
      tooth.position.set(Math.cos(a) * 0.21, 0.055, Math.sin(a) * 0.21);
      trap.add(tooth);
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10),
      new THREE.MeshStandardMaterial({ color: 0x5c1a14, roughness: 0.8 }));
    plate.position.y = 0.02;
    trap.add(plate);
    trap.position.set(-0.12, 0.01, -3.5);
    this.scene.add(trap);

    // Lighting: one bulb behind her so she is a silhouette with a lit face,
    // and a very dim fill near the camera.
    // Behind her, so the doorway glows and she has a rim.
    const back = new THREE.PointLight(0xffd0a0, 1.7, 8, 1.5);
    back.position.set(-0.1, 2.2, dz - 2.1);
    this.scene.add(back);
    // In front of her, low and close, so the gown and face read.
    const face = new THREE.PointLight(0xf2e2cc, 2.4, 5.6, 1.4);
    face.position.set(-0.05, 1.5, dz + 1.5);
    this.scene.add(face);
    // A dim wash down the hall itself.
    const hall = new THREE.PointLight(0x9fb4cc, 0.55, 9, 1.7);
    hall.position.set(0.4, 2.3, -2.6);
    this.scene.add(hall);
    this.scene.add(new THREE.AmbientLight(0x343a44, 0.75));

    this.camera.position.set(0, 1.5, -0.5);
    this.camera.lookAt(-0.05, 1.35, dz);
  }

  _buildDom() {
    const root = document.getElementById('screen');
    root.innerHTML = '';
    root.classList.add('on');

    const title = document.createElement('img');
    title.id = 'menuTitle';
    title.src = makeTitle('GRANNY').toDataURL();
    root.appendChild(title);

    const nav = document.createElement('nav');
    nav.id = 'menuNav';
    this.buttons = {};
    for (const [key, label] of [['play', 'Play'], ['vr', 'Play in VR'],
                                ['controls', 'VR Controls'], ['quit', 'Quit']]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.key = key;
      nav.appendChild(b);
      this.buttons[key] = b;
    }
    root.appendChild(nav);

    // The VR control sheet. Lives behind its own button so the title screen
    // stays as sparse as the original.
    const sheet = document.createElement('div');
    sheet.id = 'vrSheet';
    sheet.hidden = true;
    sheet.innerHTML = `
      <h2>Quest Controls</h2>
      <dl>
        <dt>Left stick</dt><dd>Walk — relative to where you are looking</dd>
        <dt>Left stick click</dt><dd>Flashlight on / off</dd>
        <dt>Right stick</dt><dd>Snap turn, 30&deg; a click</dd>
        <dt>Right trigger</dt><dd>Open a drawer · take what you are pointing at · hide</dd>
        <dt>Right grip</dt><dd>Drop what you are holding</dd>
        <dt>A</dt><dd>Throw it instead — louder, and it bursts the melon</dd>
        <dt>Menu button</dt><dd>Leave VR and return to the desktop view</dd>
      </dl>
      <p class="note">Your left wrist shows the day, the room, what you are
      carrying and the current prompt. You can only carry one thing at a time.</p>
      <p class="note">Snap turn and the movement vignette are on by default —
      they are there to keep you comfortable.</p>
      <button id="vrSheetClose">Back</button>`;
    root.appendChild(sheet);
    this.sheet = sheet;

    const hint = document.createElement('p');
    hint.id = 'menuHint';
    hint.textContent = 'WASD move · mouse look · E take / open · V drop · T throw · G flashlight · Shift run · C crouch';
    root.appendChild(hint);

    this.root = root;
    this._wireSheet();
  }

  onPlay(fn) { this.buttons.play.addEventListener('click', fn); }

  // The control sheet toggles in place; nothing else on the menu moves.
  _wireSheet() {
    const show = (on) => {
      this.sheet.hidden = !on;
      document.getElementById('menuNav').style.visibility = on ? 'hidden' : '';
      document.getElementById('menuTitle').style.opacity = on ? '0.25' : '';
    };
    this.buttons.controls.addEventListener('click', () => show(true));
    this.sheet.querySelector('#vrSheetClose').addEventListener('click', () => show(false));
  }
  onVR(fn) { this.buttons.vr.addEventListener('click', fn); }

  // The VR entry only appears when a headset is actually there.
  setVRAvailable(ok, why) {
    const b = this.buttons.vr;
    b.hidden = !ok && !why;
    b.disabled = !ok;
    b.classList.toggle('disabled', !ok);
    if (!ok && why) b.title = why;
  }
  onQuit(fn) { this.buttons.quit.addEventListener('click', fn); }

  show() { this.visible = true; this.root.classList.add('on'); }
  hide() { this.visible = false; this.root.classList.remove('on'); }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    // She sways, very slightly -- enough that she is clearly not a photograph.
    const u = this.granny.userData;
    u.hip.rotation.z = Math.sin(this.t * 0.8) * 0.018;
    u.hip.rotation.x = 0.15 + Math.sin(this.t * 0.55) * 0.012;
    u.head.rotation.y = Math.sin(this.t * 0.33) * 0.07;
    // and the camera breathes
    this.camera.position.x = Math.sin(this.t * 0.21) * 0.045;
    this.camera.position.y = 1.5 + Math.sin(this.t * 0.37) * 0.018;
    this.camera.lookAt(-0.05 + Math.sin(this.t * 0.21) * 0.02, 1.35, -7.4);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
