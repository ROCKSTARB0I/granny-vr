// lighting.js -- a small pool of real lights follows the camera.
//
// The house has ~45 fixtures. Rather than paying for all of them, a fixed
// pool of PointLights is re-pointed each frame at the nearest fixtures, which
// keeps the shader's light count constant and cheap.
import * as THREE from '../vendor/three.module.js?v=1';

const POOL = 7;

export class LightRig {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(0xffdcb2, 0, 14.0, 1.05);
      l.visible = false;
      scene.add(l);
      this.pool.push(l);
    }
    // Bulb sprites so you can see where a fixture is.
    const bulbGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
    for (const f of world.lights) {
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(f.x, f.y, f.z);
      scene.add(b);
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.34, 4),
        new THREE.MeshBasicMaterial({ color: 0x1a1714 }));
      cord.position.set(f.x, f.y + 0.19, f.z);
      scene.add(cord);
      f.bulb = b;
    }
    this.ambient = new THREE.AmbientLight(0x3c4048, 0.62);
    scene.add(this.ambient);
    this.moon = new THREE.DirectionalLight(0x9fb0c8, 0.10);
    this.moon.position.set(-24, 30, -18);
    scene.add(this.moon);
    // A very dim light on the player so pitch-black rooms are navigable --
    // stands in for the eyes adjusting.
    this.carry = new THREE.PointLight(0xc4d2e2, 0.46, 6.4, 2.0);
    scene.add(this.carry);
    this.brightness = 1;
    // Separate from brightness: a hard multiplier used to black the house out
    // for the jumpscare. brightness has a floor so rooms never go pitch dark in
    // normal play, which is exactly what the scare needs to bypass.
    this.dim = 1;
  }

  setBrightness(v) {
    this.brightness = v;
    this.ambient.intensity = 0.34 + 0.52 * v;
    this.carry.intensity = 0.10 + 0.24 * v;
  }

  update(camPos) {
    const cand = this.world.lights;
    // Cheap partial selection: score by distance, keep the best POOL.
    const best = [];
    for (const f of cand) {
      const d2 = (f.x - camPos.x) ** 2 + (f.y - camPos.y) ** 2 + (f.z - camPos.z) ** 2;
      if (d2 > 400) continue;
      if (best.length < POOL) { best.push({ f, d2 }); best.sort((a, b) => a.d2 - b.d2); }
      else if (d2 < best[POOL - 1].d2) { best[POOL - 1] = { f, d2 }; best.sort((a, b) => a.d2 - b.d2); }
    }
    for (let i = 0; i < POOL; i++) {
      const l = this.pool[i];
      if (i < best.length) {
        const f = best[i].f;
        l.visible = true;
        l.position.set(f.x, f.y, f.z);
        l.intensity = f.intensity * 3.4 * (0.7 + 0.7 * this.brightness) * this.dim * (f.off ? 0 : 1);
        l.distance = 14.0;
      } else l.visible = false;
    }
    this.carry.position.set(camPos.x, camPos.y, camPos.z);
  }
}
