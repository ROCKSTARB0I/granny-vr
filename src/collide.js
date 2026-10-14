// collide.js -- the one collision implementation, shared by the player and
// Granny.
//
// Granny used to be moved by interpolating her position straight at the next
// waypoint, which is why she drifted through walls and floors. She now walks
// with exactly the same swept-box rules the player does, so anything that is
// solid for you is solid for her.
//
// A "body" is anything with { pos, vel, radius, height, grounded }.

export const STEP_HEIGHT = 0.42;

function overlaps(body, s) {
  const { pos, radius: r, height: h } = body;
  return pos.x + r > s.min.x && pos.x - r < s.max.x &&
         pos.z + r > s.min.z && pos.z - r < s.max.z &&
         pos.y + h > s.min.y + 0.02 && pos.y < s.max.y - 0.02;
}

function candidates(world, body, pad, out) {
  const r = body.radius + pad;
  return world.near(body.pos.x - r, body.pos.z - r, body.pos.x + r, body.pos.z + r, out);
}

// Is there room for this body standing with its feet at y? Anything whose top
// is within a step of those feet is something you walk up onto, not a wall --
// without that a staircase is unclimbable, because the test for "can I stand
// on this step" always finds the next step in the way.
export function clearAt(world, body, x, y, z, ignore) {
  const r = body.radius;
  const list = world.near(x - r, z - r, x + r, z + r, []);
  for (const s of list) {
    if (s === ignore) continue;
    if (s.max.y <= y + STEP_HEIGHT + 0.01) continue;
    if (x + r > s.min.x && x - r < s.max.x &&
        z + r > s.min.z && z - r < s.max.z &&
        y + body.height > s.min.y + 0.02 && y + 0.05 < s.max.y - 0.02) return false;
  }
  return true;
}

function axis(world, body, which, amount, scratch) {
  if (amount === 0) return;
  body.pos[which] += amount;
  for (const s of candidates(world, body, Math.abs(amount), scratch)) {
    if (s.max.x - s.min.x <= 0 && s.max.z - s.min.z <= 0) continue;
    if (!overlaps(body, s)) continue;
    const top = s.max.y;
    // Low enough to walk up? Step onto it instead of being blocked.
    if (top - body.pos.y <= STEP_HEIGHT && top - body.pos.y > -0.02) {
      if (clearAt(world, body, body.pos.x, top, body.pos.z, s)) { body.pos.y = top; continue; }
    }
    const pen = amount > 0
      ? (body.pos[which] + body.radius) - s.min[which]
      : s.max[which] - (body.pos[which] - body.radius);
    body.pos[which] -= Math.sign(amount) * (pen + 0.001);
    body.vel[which] = 0;
  }
}

function axisY(world, body, amount, scratch) {
  const prevY = body.pos.y;
  body.pos.y += amount;
  for (const s of candidates(world, body, 0, scratch)) {
    if (!overlaps(body, s)) continue;
    if (amount <= 0) {
      // Only land on something you were genuinely above. Otherwise a wall you
      // are merely clipping counts as a floor and lifts you onto it.
      if (prevY < s.max.y - 0.02) continue;
      body.pos.y = s.max.y;
      body.vel.y = 0;
    } else {
      if (prevY + body.height > s.min.y + 0.02) continue;
      body.pos.y = s.min.y - body.height - 0.001;
      body.vel.y = 0;
    }
  }

  // Separate ground probe. Resolving a landing leaves the feet exactly on the
  // surface, which no longer counts as an overlap -- without this the grounded
  // flag flickers every other frame and movement feels like sinking.
  body.grounded = false;
  const r = body.radius;
  for (const s of candidates(world, body, 0, scratch)) {
    if (body.pos.x + r <= s.min.x || body.pos.x - r >= s.max.x) continue;
    if (body.pos.z + r <= s.min.z || body.pos.z - r >= s.max.z) continue;
    const gap = body.pos.y - s.max.y;
    if (gap >= -0.02 && gap <= 0.08) {
      body.grounded = true;
      if (body.vel.y <= 0) { body.pos.y = s.max.y; body.vel.y = 0; }
      break;
    }
  }
  if (body.pos.y < -40) { body.pos.y = -40; body.grounded = true; body.vel.y = 0; }
}

// Axis-separated sweep, so sliding along a wall feels right.
export function moveBody(world, body, dx, dy, dz, scratch) {
  const before = { x: body.pos.x, y: body.pos.y, z: body.pos.z };
  axis(world, body, 'x', dx, scratch);
  axis(world, body, 'z', dz, scratch);
  axisY(world, body, dy, scratch);
  return {
    x: body.pos.x - before.x,
    y: body.pos.y - before.y,
    z: body.pos.z - before.z,
  };
}
