// granny.js -- the model and the AI.
//
// The design rule, straight from how she actually plays: she is nearly blind
// and hears everything. Sight is short-ranged, needs a clear line, and takes a
// beat to resolve into recognition -- standing still in a dark corner two
// metres away usually works. Hearing is the opposite: any noise anywhere in the
// house registers, and she walks straight to the exact spot it came from.
import * as THREE from '../vendor/three.module.js?v=10';
import { LEVELS, ROOM_BY_ID, WAYPOINTS, GRANNY_SPAWN } from './floorplan.js?v=10';
import { moveBody } from './collide.js?v=10';

// The floors she actually lives on. The sewers, the Secret Area and the
// Special Room are places she visits, not places she should be parked -- left
// to pick uniformly she spends most of a round somewhere you will never go,
// and the house feels empty until she is already on top of you.
const HOME_LEVELS = [LEVELS.ground, LEVELS.upper];
const isHome = (n) => HOME_LEVELS.some(y => Math.abs(n.y - y) < 0.3);

/* ------------------------------------------------------------------ model */

// Built from primitives to match her silhouette in the menu art: hunched,
// ankle-length nightgown, grey bun, bloodied bat in the right hand.
//
// The group's origin is at her FEET, so positioning her is just
// mesh.position = ground position. Everything below is measured up from there;
// she stands about 1.62m, stooped.
export function buildModel(world) {
  const root = new THREE.Group();
  const skin = world.m('skin', [1, 1], { roughness: 0.9, bump: false });
  const gown = world.m('gown', [1, 1], { roughness: 0.96, bump: false });
  const hair = new THREE.MeshStandardMaterial({ color: 0x8e8a83, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 1 });
  const white = new THREE.MeshBasicMaterial({ color: 0xe8e4dc });
  const wood = world.m('woodRaw', [1, 2], { bump: false });
  const blood = new THREE.MeshStandardMaterial({ color: 0x571310, roughness: 0.72 });

  const HIP = 0.92;

  // The nightgown falls straight to the floor and hides her legs, which is why
  // she reads as gliding rather than walking.
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.29, HIP, 14), gown);
  skirt.position.y = HIP / 2;
  skirt.castShadow = true;
  root.add(skirt);

  // Everything above the hip leans forward -- the stoop is most of the read.
  const hip = new THREE.Group();
  hip.position.y = HIP;
  hip.rotation.x = 0.15;
  root.add(hip);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.215, 0.42, 12), gown);
  torso.position.y = 0.21;
  torso.castShadow = true;
  hip.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.08, 8), skin);
  neck.position.y = 0.45;
  hip.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.60;
  hip.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), skin);
  skull.scale.set(1, 1.14, 0.96);
  skull.castShadow = true;
  head.add(skull);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.131, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.44), hair);
  cap.position.set(0, 0.004, 0.012);
  cap.scale.set(1, 1.05, 1);
  head.add(cap);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.109, 12, 10), hair);
  bun.position.set(0, 0.035, 0.038);
  bun.scale.set(1.08, 0.9, 1);
  head.add(bun);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), hair);
  knot.position.set(0, 0.045, 0.125);
  head.add(knot);

  // She faces local -Z, so the face sits on the -Z side.
  for (const sx of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.030, 10, 8), dark);
    socket.position.set(sx * 0.047, 0.018, -0.100);
    socket.scale.set(1, 1.1, 0.7);
    head.add(socket);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 8, 6), white);
    pupil.position.set(sx * 0.047, 0.019, -0.120);
    head.add(pupil);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.062, 7), skin);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.020, -0.118);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), dark);
  mouth.position.set(0, -0.068, -0.098);
  mouth.scale.set(0.9, 1.25, 0.5);
  head.add(mouth);

  // Arms hang from the shoulders; the right one carries the bat.
  const arms = {};
  for (const [name, sx] of [['left', -1], ['right', 1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.175, 0.36, 0);
    // Positive Z swings a downward-hanging arm toward +X, so the sign has to
    // follow sx or both arms fold into the gown and disappear.
    pivot.rotation.z = sx * 0.30;
    hip.add(pivot);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.30, 8), gown);
    upper.position.y = -0.15;
    pivot.add(upper);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.034, 0.28, 8), skin);
    fore.position.y = -0.44;
    pivot.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 8), skin);
    hand.position.y = -0.60;
    pivot.add(hand);
    arms[name] = pivot;
  }

  const bat = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.038, 0.54, 9), wood);
  shaft.position.y = -0.27;
  bat.add(shaft);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.035, 0.18, 9), blood);
  tip.position.y = -0.49;
  bat.add(tip);
  bat.position.set(0, -0.60, -0.04);
  bat.rotation.x = 0.62;      // carried angled forward at her side
  arms.right.add(bat);

  root.userData = { hip, head, arms, bat, skirt };
  return root;
}

/* ------------------------------------------------------- navigation graph */

// Nodes are the wiki map's patrol waypoints, PLUS a node in every doorway and
// at the foot and head of every staircase. Those extra nodes are the whole
// point: without them a straight line between two room waypoints cuts through
// the wall between them, which is what made her look like she was gliding
// through the house instead of walking around it.
function buildGraph(world) {
  const nodes = [];
  const add = (n) => { n.i = nodes.length; n.links = []; nodes.push(n); return n; };

  for (const [room, lx, lz] of WAYPOINTS) {
    const r = ROOM_BY_ID[room];
    if (!r) continue;
    add({ kind: 'room', rooms: [room], x: r.x + lx, y: LEVELS[r.lvl], z: r.z + lz });
  }

  // One node in the middle of every doorway she can actually use.
  const PASSABLE = new Set(['door', 'open', 'locked', 'crawl', 'metalHatch', 'hidden']);
  for (const p of world._portals) {
    if (!PASSABLE.has(p.kind)) continue;
    const op = p.op;
    const t = (op.t0 + op.t1) / 2;
    const x = op.axis === 'x' ? t : op.line;
    const z = op.axis === 'x' ? op.line : t;
    add({ kind: 'door', rooms: [p.a, p.b], x, y: op.bottom, z, crawl: p.kind === 'crawl' });
  }

  // Foot and head of each run, so she is routed onto the stairs rather than
  // straight at the floor above.
  for (const st of (world.stairsBuilt || [])) {
    const run = st.run || 4.6;
    const dir = st.dir === 'N' ? -1 : 1;
    const nearZ = st.z + 0.62 * (dir < 0 ? 1 : -1);
    const farZ = st.z + dir * run - 0.62 * (dir < 0 ? 1 : -1);
    const roomAt = (x, y, z) => {
      const r = world.roomRects.find(q => x >= q.x && x <= q.x + q.w &&
                                          z >= q.z && z <= q.z + q.d &&
                                          Math.abs(q.y - y) < 0.4);
      return r ? r.id : null;
    };
    const yNear = LEVELS[st.from], yFar = LEVELS[st.to];
    const a = add({ kind: 'stair', rooms: [roomAt(st.x, yNear, nearZ) || st.in].filter(Boolean),
                    x: st.x, y: yNear, z: nearZ });
    const b = add({ kind: 'stair', rooms: [roomAt(st.x, yFar, farZ)].filter(Boolean),
                    x: st.x, y: yFar, z: farZ });
    a.pair = b.i; b.pair = a.i;
  }

  // Ladders: she climbs these rather than walking them.
  for (const d of world.drops) {
    if (d.kind !== 'ladder') continue;
    const here = world.roomRects.find(q => d.x >= q.x && d.x <= q.x + q.w &&
                                           d.z >= q.z && d.z <= q.z + q.d &&
                                           Math.abs(q.y - (d.y - 1.05)) < 0.5);
    const n = add({ kind: 'ladder', rooms: here ? [here.id] : [], id: d.id,
                    x: d.x, y: d.y - 1.05, z: d.z, dest: d.dest });
    n.ladderId = d.id.replace(/:[ab]$/, '');
  }

  // Link anything that shares a room: within a room everything is mutually
  // visible, and doorway nodes are what bridge one room to the next.
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b) continue;
      if (!a.rooms.some(r => b.rooms.includes(r))) continue;
      if (Math.abs(a.y - b.y) > 1.2) continue;          // same storey only
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      a.links.push({ to: b.i, cost: d });
    }
  }
  // Landings are not rooms. The top of the Foyer staircase arrives on the
  // balcony, which belongs to no room rect, so a node there linked to nothing
  // and she could reach the top step and go no further. Link anything
  // roomless -- and every stair end -- to whatever is close by on its storey.
  for (const a of nodes) {
    if (a.kind !== 'stair' && a.rooms.length) continue;
    for (const b of nodes) {
      if (a === b) continue;
      if (Math.abs(a.y - b.y) > 1.2) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 4.5) continue;
      if (a.links.some(l => l.to === b.i)) continue;
      a.links.push({ to: b.i, cost: d });
      if (!b.links.some(l => l.to === a.i)) b.links.push({ to: a.i, cost: d });
    }
  }

  // The runs themselves, and the two ends of each ladder.
  for (const n of nodes) {
    if (n.kind === 'stair' && n.pair !== undefined) {
      n.links.push({ to: n.pair, cost: Math.abs(nodes[n.pair].y - n.y) * 1.6 + 2 });
    }
    if (n.kind === 'ladder') {
      const other = nodes.find(m => m !== n && m.kind === 'ladder' && m.ladderId === n.ladderId);
      if (other) n.links.push({ to: other.i, cost: Math.abs(other.y - n.y) * 2.2 + 3, climb: true });
    }
  }
  return nodes;
}

function nearestNode(nodes, x, y, z) {
  let best = null, bd = Infinity;
  for (const n of nodes) {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2 + ((n.y - y) * 3) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// Plain A* over the waypoint graph.
function findPath(nodes, from, to) {
  if (!from || !to) return [];
  const open = [from.i];
  const gScore = new Map([[from.i, 0]]);
  const came = new Map();
  const h = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y) * 2.2;
  const f = new Map([[from.i, h(from, to)]]);
  const seen = new Set();

  while (open.length) {
    open.sort((a, b) => (f.get(a) ?? 1e9) - (f.get(b) ?? 1e9));
    const cur = open.shift();
    if (cur === to.i) {
      const out = [nodes[cur]];
      let c = cur;
      while (came.has(c)) { c = came.get(c); out.unshift(nodes[c]); }
      return out;
    }
    seen.add(cur);
    for (const l of nodes[cur].links) {
      if (seen.has(l.to)) continue;
      const tentative = (gScore.get(cur) ?? 1e9) + l.cost;
      if (tentative < (gScore.get(l.to) ?? 1e9)) {
        came.set(l.to, cur);
        gScore.set(l.to, tentative);
        f.set(l.to, tentative + h(nodes[l.to], to));
        if (!open.includes(l.to)) open.push(l.to);
      }
    }
  }
  return [];
}

/* --------------------------------------------------------------- the AI */

// How close she has to be to swing, and how long she must stay that close.
export const GRAB_REACH = 0.85;
export const GRAB_WINDUP = 0.3;

export const DIFFICULTY = {
  practice: { speed: 0.0,  hearing: 0.0,  sight: 0.0,  recognise: 99, label: 'Practice' },
  easy:     { speed: 1.55, hearing: 14.0, sight: 4.6,  recognise: 1.10, label: 'Easy' },
  normal:   { speed: 1.95, hearing: 22.0, sight: 5.8,  recognise: 0.80, label: 'Normal' },
  hard:     { speed: 2.35, hearing: 34.0, sight: 6.8,  recognise: 0.55, label: 'Hard' },
  extreme:  { speed: 2.85, hearing: 999,  sight: 8.0,  recognise: 0.32, label: 'Extreme' },
};

export class Granny {
  constructor(world, props, player, opts = {}) {
    this.world = world;
    this.props = props;
    this.player = player;
    this.diff = DIFFICULTY[opts.difficulty || 'normal'];
    this.mesh = buildModel(world);
    world.scene.add(this.mesh);
    this.nodes = buildGraph(world);

    const sp = ROOM_BY_ID[GRANNY_SPAWN.room];
    this.pos = new THREE.Vector3(sp.x + GRANNY_SPAWN.x, LEVELS[sp.lvl], sp.z + GRANNY_SPAWN.z);
    this.yaw = 0;
    this.state = 'patrol';       // patrol | investigate | search | chase | stunned
    this.path = [];
    this.target = null;
    this.stateTime = 0;
    this.seenFor = 0;            // how long the player has been in view
    this.lostFor = 0;
    this.walkPhase = 0;
    this.bearTraps = [];
    this.pendingTrap = false;
    this.stunTimer = 0;
    this.lastNoise = null;
    this.grabWindup = 0;
    // She is a physical body now, with the same collision the player uses.
    this.radius = 0.33;
    this.height = 1.66;
    this.vel = new THREE.Vector3();
    this.grounded = false;
    this.stuckFor = 0;
    this.climb = null;
    this._colList = [];
    this.pauseLeft = 0;
    this._arrived = false;
    this.enabled = this.diff.speed > 0;
    this.onSound = opts.onSound || (() => {});
    this.onCatch = opts.onCatch || (() => {});
    this.mesh.visible = this.enabled;
    this._tmp = new THREE.Vector3();
    this._losList = [];
    this.repathIn = 0;
  }

  setDifficulty(key) {
    this.diff = DIFFICULTY[key] || DIFFICULTY.normal;
    this.enabled = this.diff.speed > 0;
    this.mesh.visible = this.enabled;
  }

  // Anything in the world that makes a noise calls this. Loudness is roughly
  // "metres at which it is still audible" -- her hearing radius is huge, so on
  // Normal and up almost everything reaches her.
  hear(x, y, z, loudness) {
    if (!this.enabled || this.state === 'chase' || this.state === 'stunned') return;
    const d = Math.hypot(this.pos.x - x, this.pos.z - z) + Math.abs(this.pos.y - y) * 2;
    if (d > Math.min(this.diff.hearing, loudness * 9)) return;
    this.lastNoise = { x, y, z };
    this._goTo(x, y, z);
    this.state = 'investigate';
    this.stateTime = 0;
  }

  _goTo(x, y, z) {
    const from = nearestNode(this.nodes, this.pos.x, this.pos.y, this.pos.z);
    const to = nearestNode(this.nodes, x, y, z);
    this.path = findPath(this.nodes, from, to).slice(1);
    this.path.push({ x, y, z, final: true });
    this.repathIn = 1.2;
  }

  // Bad eyesight: short cone, needs a clear line, and needs time to resolve.
  // Crouching, distance and darkness all buy the player more of that time.
  _canSee(dt) {
    const p = this.player;
    this.hasVisual = false;
    // Inside a wardrobe or under a bed you are simply not visible. Being found
    // there is handled by hiding.js, which is a different thing entirely.
    if (p.hidden) { this.seenFor = 0; return false; }
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dy = p.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dz);
    if (Math.abs(dy) > 1.8 || dist > this.diff.sight) return false;

    // ~100 degree cone.
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const toP = new THREE.Vector3(dx, 0, dz).normalize();
    if (forward.dot(toP) < 0.34) return false;

    if (!this._lineOfSight(p.pos.x, p.pos.y + p.eye * 0.6, p.pos.z)) return false;

    // The player is in view. Recognition still has to build before she acts --
    // that gap is what makes her feel half-blind rather than merely slow.
    this.hasVisual = true;
    let rate = dt / this.diff.recognise;
    rate *= 1.5 - 0.9 * (dist / this.diff.sight);
    if (p.crouch) rate *= 0.45;
    if (p.vel.lengthSq() < 0.05) rate *= 0.6;      // standing still helps
    this.seenFor += rate;
    return this.seenFor >= 1;
  }

  // Coarse ray march. Only the solids bucketed near the whole segment are
  // considered -- scanning the full list per sample was costing more than the
  // rest of the frame put together.
  _lineOfSight(tx, ty, tz) {
    const ox = this.pos.x, oy = this.pos.y + 1.42, oz = this.pos.z;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.05) return true;
    const list = this.world.near(Math.min(ox, tx) - 0.2, Math.min(oz, tz) - 0.2,
                                 Math.max(ox, tx) + 0.2, Math.max(oz, tz) + 0.2, this._losList);
    const steps = Math.ceil(len / 0.3);
    for (const s of list) {
      if (s.tag === 'floor' || s.tag === 'ceil' || s.tag === 'rail') continue;
      if (s.max.x - s.min.x <= 0) continue;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
        if (x > s.min.x && x < s.max.x && y > s.min.y && y < s.max.y &&
            z > s.min.z && z < s.max.z) return false;
      }
    }
    return true;
  }

  stun(seconds = 12) {
    this.state = 'stunned';
    this.stunTimer = seconds;
    this.path = [];
    this.seenFor = 0;
  }

  // After a knockout she reappears well away from the player, and never on the
  // same floor -- v1.8 changed this specifically.
  // After a knockout she comes back downstairs, well away from you but still
  // somewhere you will plausibly run into her. Picking the single furthest node
  // in the house dumped her in the sewers every time.
  respawnAway() {
    const p = this.player;
    const ground = this.nodes.filter(n => n.kind === 'room' && Math.abs(n.y - LEVELS.ground) < 0.3);
    const pool = ground.length ? ground : this.nodes.filter(n => n.kind === 'room');
    // Furthest few, then one at random, so she is not predictable.
    const ranked = pool
      .map(n => ({ n, d: Math.hypot(n.x - p.pos.x, n.z - p.pos.z) + Math.abs(n.y - p.pos.y) * 3 }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 4);
    const pick = ranked[(Math.random() * ranked.length) | 0];
    if (pick) this.pos.set(pick.n.x, pick.n.y, pick.n.z);
    this.state = 'patrol';
    this.path = [];
    this.pauseLeft = 0;
    this._arrived = false;
    this.seenFor = 0;
    this.grabWindup = 0;
  }

  update(dt) {
    if (!this.enabled) return;
    // The jumpscare drives her model directly; the AI must keep its hands off
    // or _animate would fight it for the transform every frame.
    if (this.state === 'scare') return;
    this.stateTime += dt;

    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) { this.state = 'patrol'; this.path = []; }
      this._animate(dt, 0);
      return;
    }

    // Sight check runs in every state except while already chasing.
    if (this.state !== 'chase') {
      if (this._canSee(dt)) {
        this.state = 'chase';
        this.stateTime = 0;
        this.onSound('spot', this.pos);
      } else if (!this.hasVisual) {
        // Only forget when the player is genuinely out of sight. Draining while
        // she is mid-recognition would fight the build-up and stall it forever.
        this.seenFor = Math.max(0, this.seenFor - dt * 0.55);
      }
    }

    switch (this.state) {
      case 'patrol':      this._patrol(dt); break;
      case 'investigate': this._investigate(dt); break;
      case 'search':      this._search(dt); break;
      case 'chase':       this._chase(dt); break;
    }

    const moved = this._follow(dt, this.state === 'chase' ? this.diff.speed * 1.18 : this.diff.speed);
    this._animate(dt, moved);
    this._checkTraps();
  }

  // She wanders the area she is in rather than crossing the whole house every
  // time. Picking a uniformly random waypoint made her vanish into the sewers
  // for minutes at a stretch; biasing towards nearby ones keeps her audible
  // and roaming, which is what makes the house feel occupied.
  _patrol(dt) {
    if (this.path.length) { this._arrived = false; return; }

    // She has just finished a leg: stand still and look around for a moment
    // before choosing the next one.
    if (!this._arrived) {
      this._arrived = true;
      this.pauseLeft = 0.8 + Math.random() * 2.2;
    }
    this.pauseLeft -= dt;
    if (this.pauseLeft > 0) {
      this.yaw += dt * 0.9;
      return;
    }

    if (this.pendingTrap) { this._layTrap(); this.pendingTrap = false; }

    // Mostly she drifts to somewhere nearby; now and then she crosses the
    // house. Either way she stays on the two main floors unless something drew
    // her off them, so you keep running into her.
    const home = this.nodes.filter(n => n.kind === 'room' && isHome(n));
    const pool = home.length ? home : this.nodes.filter(n => n.kind === 'room');
    const longTrip = Math.random() < 0.3;
    let pick;
    if (longTrip) {
      // A long trip usually means changing floor. Picking uniformly left her
      // on whichever storey she started on for most of a round, because the
      // ground floor has more waypoints than the upper one.
      const elsewhere = pool.filter(n => Math.abs(n.y - this.pos.y) > 1.5);
      const from = (elsewhere.length && Math.random() < 0.7) ? elsewhere : pool;
      pick = from[(Math.random() * from.length) | 0];
    } else {
      const sorted = pool
        .map(n => ({ n, d: Math.hypot(n.x - this.pos.x, n.z - this.pos.z) + Math.abs(n.y - this.pos.y) * 4 }))
        .sort((a, b) => a.d - b.d)
        .slice(1, 9);                           // skip the one she is stood on
      if (!sorted.length) return;
      pick = sorted[(Math.random() * sorted.length) | 0].n;
    }
    this._goTo(pick.x, pick.y, pick.z);
    this.pauseLeft = 0.8 + Math.random() * 2.2;
  }

  _investigate(dt) {
    if (this.path.length) return;
    this.state = 'search';
    this.stateTime = 0;
  }

  // Stands at the noise and looks around before giving up.
  _search(dt) {
    this.yaw += dt * 1.5;
    if (this.stateTime > 3.2) {
      this.onSound('mutter', this.pos);
      this.pendingTrap = true;
      this.state = 'patrol';
      this.path = [];
    }
  }

  _chase(dt) {
    const p = this.player;
    const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const visible = Math.abs(p.pos.y - this.pos.y) < 1.8 && dist < this.diff.sight * 1.5 &&
                    this._lineOfSight(p.pos.x, p.pos.y + 1.0, p.pos.z);
    if (visible) {
      this.lostFor = 0;
      this.repathIn -= dt;
      if (this.repathIn <= 0) this._goTo(p.pos.x, p.pos.y, p.pos.z);
    } else {
      this.lostFor += dt;
      if (this.lostFor > 3.5) {
        this.state = 'search';
        this.stateTime = 0;
        this.seenFor = 0;
        return;
      }
    }
    // She can only actually grab you at arm's length, on the same floor, and
    // facing you. Swinging at your back from across the room is the thing that
    // makes a chase feel cheap, so the reach is deliberately short and she has
    // to commit to it: GRAB_WINDUP gives you a sliver of time to break away.
    const sameFloor = Math.abs(p.pos.y - this.pos.y) < 1.2;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const facing = dist > 0.001 && ((p.pos.x - this.pos.x) * fx + (p.pos.z - this.pos.z) * fz) / dist > 0.25;

    if (dist < GRAB_REACH && sameFloor && facing) {
      this.grabWindup += dt;
      if (this.grabWindup >= GRAB_WINDUP) {
        this.grabWindup = 0;
        this.onCatch();
        this.seenFor = 0;
      }
    } else {
      this.grabWindup = Math.max(0, this.grabWindup - dt * 1.6);
    }
  }

  _layTrap() {
    const t = { x: this.pos.x, y: this.pos.y, z: this.pos.z, armed: true };
    const jaws = new THREE.Group();
    const m = this.world.m('metalDark', [1, 1], { bump: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.022, 6, 14), m);
    ring.rotation.x = Math.PI / 2;
    jaws.add(ring);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.10, 5), m);
      tooth.position.set(Math.cos(a) * 0.19, 0.05, Math.sin(a) * 0.19);
      jaws.add(tooth);
    }
    jaws.position.set(t.x, t.y + 0.03, t.z);
    this.world.scene.add(jaws);
    t.mesh = jaws;
    this.bearTraps.push(t);
    if (this.bearTraps.length > 4) {
      const old = this.bearTraps.shift();
      this.world.scene.remove(old.mesh);
    }
  }

  _checkTraps() {
    const p = this.player;
    for (const t of this.bearTraps) {
      if (!t.armed) continue;
      if (Math.abs(p.pos.y - t.y) > 1.0) continue;
      if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) > 0.34) continue;
      t.armed = false;
      t.mesh.scale.set(1, 0.35, 1);
      this.onSound('trap', t);
      if (this.player.onTrapped) this.player.onTrapped();
    }
  }

  // Walk the current path. She is swept against the world exactly like the
  // player, so walls stop her, stairs carry her, and she has to open a door
  // before she can come through it.
  _follow(dt, speed) {
    // Mid-climb on a ladder: that owns her until it finishes.
    if (this.climb) {
      const c = this.climb;
      c.t += dt;
      const k = Math.min(1, c.t / c.dur);
      const e = k * k * (3 - 2 * k);
      this.pos.set(c.x0 + (c.x1 - c.x0) * e, c.y0 + (c.y1 - c.y0) * e,
                   c.z0 + (c.z1 - c.z0) * e);
      this.vel.set(0, 0, 0);
      if (k >= 1) { this.climb = null; this.path.shift(); }
      return speed * dt * 0.35;
    }

    if (!this.path.length) {
      // Still subject to gravity when idle, so she cannot hover.
      this.vel.y -= 18 * dt;
      moveBody(this.world, this, 0, this.vel.y * dt, 0, this._colList);
      return 0;
    }

    const n = this.path[0];

    // A ladder link: start the climb instead of trying to walk up it.
    if (n.kind === 'ladder' && n.dest &&
        Math.hypot(n.x - this.pos.x, n.z - this.pos.z) < 0.9 &&
        Math.abs(n.y - this.pos.y) < 0.6 && this.path[1] &&
        this.path[1].kind === 'ladder' && this.path[1].ladderId === n.ladderId) {
      const d = this.path[1];
      this.climb = { t: 0, dur: Math.max(0.8, Math.abs(d.y - this.pos.y) / 2.2),
                     x0: this.pos.x, y0: this.pos.y, z0: this.pos.z,
                     x1: d.x, y1: d.y + 0.05, z1: d.z };
      this.path.shift();           // consume this end; the climb lands on the other
      return 0;
    }

    const dx = n.x - this.pos.x, dz = n.z - this.pos.z;
    const flat = Math.hypot(dx, dz);
    if (flat < 0.55 && Math.abs(n.y - this.pos.y) < 1.4) {
      this.path.shift();
      this.stuckFor = 0;
      return 0;
    }

    this._openDoorsAhead();

    const nx = dx / (flat || 1), nz = dz / (flat || 1);
    this.vel.x = nx * speed;
    this.vel.z = nz * speed;
    this.vel.y -= 18 * dt;
    if (this.vel.y < -28) this.vel.y = -28;

    // Don't walk off a ledge. She is a physical body now, so without this she
    // strolls into the open stairwell in the Foyer floor and spends the rest
    // of the round trying to find her way back up from the garage.
    let mx = this.vel.x * dt, mz = this.vel.z * dt;
    if (this.grounded && this._isDrop(this.pos.x + mx * 3, this.pos.z + mz * 3)) {
      mx = 0; mz = 0;
      this.stuckFor += dt * 2;        // treat it as blocked so she reroutes
    }

    const moved = moveBody(this.world, this, mx, this.vel.y * dt, mz, this._colList);
    const planar = Math.hypot(moved.x, moved.z);

    // Walls, furniture or a shut door can wedge her. Rather than grinding in
    // place, give up on this route and find another.
    if (planar < speed * dt * 0.3) {
      this.stuckFor += dt;
      if (this.stuckFor > 1.1) {
        this.stuckFor = 0;
        this.path = [];
        this.pauseLeft = 0;
        this._arrived = true;
      }
    } else {
      this.stuckFor = 0;
      // Face the way she is actually moving, not the way she wanted to.
      this.yaw = Math.atan2(-moved.x, -moved.z);
    }
    return planar;
  }

  // Is there a floor to step onto just ahead, or is that a drop? Treads count
  // as floor -- stairs fall within one step -- but an open stairwell does not.
  _isDrop(x, z) {
    const r = this.radius * 0.8;
    const list = this.world.near(x - r, z - r, x + r, z + r, []);
    for (const s of list) {
      if (s.max.x - s.min.x <= 0) continue;
      if (x + r <= s.min.x || x - r >= s.max.x) continue;
      if (z + r <= s.min.z || z - r >= s.max.z) continue;
      const drop = this.pos.y - s.max.y;
      if (drop >= -0.45 && drop <= 0.7) return false;    // something to stand on
    }
    return true;
  }

  // She opens doors as she reaches them -- which is also the sound that tells
  // you where she is.
  _openDoorsAhead() {
    for (const door of this.world.doors) {
      if (!door.openable || door.target > 0.5) continue;
      const c = door.centre;
      if (Math.abs(c.y - this.pos.y) > 2.2) continue;
      if (Math.hypot(c.x - this.pos.x, c.z - this.pos.z) > 1.5) continue;
      door.target = 1;
      this.onSound('door', c);
    }
  }

  _animate(dt, moved) {
    const u = this.mesh.userData;
    this.walkPhase += moved * 3.6;
    const swing = Math.sin(this.walkPhase) * 0.5;
    u.arms.left.rotation.x = swing * 0.75;
    u.arms.right.rotation.x = -swing * 0.30 - 0.20;
    u.hip.rotation.x = 0.15 + Math.abs(Math.sin(this.walkPhase)) * 0.03;
    u.hip.rotation.z = Math.sin(this.walkPhase) * 0.03;
    // A slight up-down shuffle sells the walk without visible legs.
    u.skirt.position.y = 0.46 + Math.abs(Math.sin(this.walkPhase)) * 0.015;

    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    // Knocked out: she topples sideways and lies on the floor.
    this.mesh.rotation.z = this.state === 'stunned' ? 1.45 : 0;
  }
}
