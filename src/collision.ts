/** Depth is normalized across the water column; XY stays in pond world pixels. */
export const DEPTH_WORLD_SCALE = 200;

/** An oriented capsule with an elliptical vertical cross-section. */
export interface CollisionVolume {
  id: string;
  x: number;
  y: number;
  angle: number;
  depth: number;
  /** Overall half length, including the rounded ends. */
  halfLength: number;
  radius: number;
  halfHeight: number;
}

export interface CollisionContact {
  /** Unit XY direction that moves A away from B. */
  nx: number;
  ny: number;
  penetration: number;
}

const EPSILON = 1e-9;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function identitySign(a: string, b: string): number {
  // The tie direction is independent of frame count and random state. Reversing
  // the pair reverses its normal, including perfectly coincident capsules.
  return a < b ? 1 : -1;
}

/**
 * Collision in the shared water column. Once the vertical thicknesses no
 * longer meet, overlapping XY silhouettes can pass above/below each other.
 */
export function getCollisionContact(a: CollisionVolume, b: CollisionVolume): CollisionContact | null {
  const height = a.halfHeight + b.halfHeight;
  if (height <= 0) return null;
  const vertical = Math.abs(a.depth - b.depth) * DEPTH_WORLD_SCALE / height;
  if (vertical >= 1) return null;
  const required = (a.radius + b.radius) * Math.sqrt(1 - vertical * vertical);
  const al = Math.max(0, a.halfLength - a.radius), bl = Math.max(0, b.halfLength - b.radius);
  // A cheap conservative broad phase avoids segment work for distant animals.
  const cx = a.x - b.x, cy = a.y - b.y;
  if (cx * cx + cy * cy >= (al + bl + required) ** 2) return null;
  const ac = Math.cos(a.angle), as = Math.sin(a.angle), bc = Math.cos(b.angle), bs = Math.sin(b.angle);
  const ax = a.x - ac * al, ay = a.y - as * al;
  const bx = b.x - bc * bl, by = b.y - bs * bl;
  const ux = ac * al * 2, uy = as * al * 2, vx = bc * bl * 2, vy = bs * bl * 2;
  const wx = ax - bx, wy = ay - by;
  const aa = ux * ux + uy * uy, bb = ux * vx + uy * vy, cc = vx * vx + vy * vy;
  const dd = ux * wx + uy * wy, ee = vx * wx + vy * wy;
  let s = 0, t = 0;
  if (aa <= EPSILON && cc <= EPSILON) {
    // Both capsules are spheres in XY.
  } else if (aa <= EPSILON) {
    t = clamp01(ee / cc);
  } else if (cc <= EPSILON) {
    s = clamp01(-dd / aa);
  } else {
    const denominator = aa * cc - bb * bb;
    s = denominator > EPSILON ? clamp01((bb * ee - cc * dd) / denominator) : 0;
    t = (bb * s + ee) / cc;
    if (t < 0) { t = 0; s = clamp01(-dd / aa); }
    else if (t > 1) { t = 1; s = clamp01((bb - dd) / aa); }
  }
  const dx = wx + ux * s - vx * t, dy = wy + uy * s - vy * t;
  const distance = Math.hypot(dx, dy);
  if (distance >= required) return null;
  if (distance > 1e-7) return { nx: dx / distance, ny: dy / distance, penetration: required - distance };

  // When two center segments cross, a disk-radius nudge can leave their heads
  // and tails intersecting. Move along a separating axis for the full segments.
  let contact: CollisionContact | null = null;
  for (const axis of [[-as, ac], [-bs, bc]]) {
    const canonical = Math.abs(axis[0]) > 1e-7 ? Math.sign(axis[0]) : Math.sign(axis[1]);
    const nx = axis[0] * canonical, ny = axis[1] * canonical;
    const offset = cx * nx + cy * ny;
    const support = al * Math.abs(ac * nx + as * ny) + bl * Math.abs(bc * nx + bs * ny) + required;
    const penetration = support - Math.abs(offset);
    const sign = Math.abs(offset) > 1e-7 ? Math.sign(offset) : identitySign(a.id, b.id);
    if (!contact || penetration < contact.penetration - 1e-7 || (Math.abs(penetration - contact.penetration) <= 1e-7 && nx > Math.abs(contact.nx) + 1e-7)) contact = { nx: nx * sign, ny: ny * sign, penetration };
  }
  return contact;
}

export function isCollisionVolume(value: CollisionVolume): boolean {
  return typeof value.id === 'string' && [value.x, value.y, value.angle, value.depth, value.halfLength, value.radius, value.halfHeight].every(Number.isFinite)
    && value.depth >= 0 && value.depth <= 1 && value.halfLength >= 0 && value.radius > 0 && value.halfHeight > 0;
}
