/** Stable, wrap-safe skin detail. These fields describe pigment and surface
 * texture only; they never move a vertex or change an animal's silhouette. */
const clamp = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const smooth = (lo: number, hi: number, value: number) => {
  const t = clamp((value - lo) / (hi - lo)); return t * t * (3 - 2 * t);
};
function hash(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function skinNoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const a = tx * tx * (3 - 2 * tx), b = ty * ty * (3 - 2 * ty);
  return (hash(ix, iy, seed) * (1 - a) + hash(ix + 1, iy, seed) * a) * (1 - b)
    + (hash(ix, iy + 1, seed) * (1 - a) + hash(ix + 1, iy + 1, seed) * a) * b;
}
export interface SkinDetail { pigment: number; fine: number; rim: number; scale: number; gill: number; lateral: number; rough: number }
export interface SkinPattern { rows: number; columns: number; gillU: number; scales: boolean }
export const createSkinDetail = (): SkinDetail => ({ pigment: 0, fine: 0, rim: 0, scale: 0, gill: 0, lateral: 0, rough: 0 });
/** Reuse `out` while baking a canvas to avoid allocating one object per texel. */
export function sampleSkinDetail(u: number, v: number, seed: number, pattern: SkinPattern, out: SkinDetail): SkinDetail {
  const a = v * Math.PI * 2, sine = Math.sin(a), z = Math.cos(a), flank = Math.abs(sine);
  // A circular embedding keeps both sides of the dorsal UV seam identical.
  const broad = skinNoise(u * 7.4 + seed, sine * 2.7 + z * 1.3, seed);
  const mid = skinNoise(u * 22.7 + seed * .41, sine * 8.1 + z * 4.2, seed + 11);
  const fine = skinNoise(u * 173.3, sine * 55.7 + z * 32.2, seed + 23) - .5;
  out.pigment = (broad - .5) * .72 + (mid - .5) * .28;
  out.fine = fine;
  const warped = v * pattern.rows + (mid - .5) * .16;
  const row = Math.floor(warped), localV = warped - row;
  const rowId = ((row % pattern.rows) + pattern.rows) % pattern.rows;
  const across = u * pattern.columns + Math.sin(u * 5.8) * 1.05 + (rowId % 2) * .5;
  const cell = Math.floor(across), localU = across - cell;
  const variation = hash(cell, rowId, seed + 5);
  const distance = Math.hypot((localU - .5 - (variation - .5) * .06) / (.50 + variation * .06), (localV - .13) / (.93 + variation * .13));
  out.rim = Math.exp(-(((distance - .90) / .068) ** 2));
  out.scale = pattern.scales ? smooth(.055, .16, u) * (1 - smooth(.72, .83, u)) : 0;
  // Fine features are shallow color/normal relief, never black drawn outlines.
  const gillU = pattern.gillU + (1 - z) * .006 + (mid - .5) * .006;
  out.gill = Math.exp(-(((u - gillU) / .0065) ** 2)) * flank ** 3;
  const lineZ = .025 + Math.sin(u * 3.8) * .074;
  out.lateral = Math.exp(-(((z - lineZ) / .030) ** 2)) * flank ** 4
    * smooth(.08, .17, u) * (1 - smooth(pattern.gillU - .04, pattern.gillU + .01, u));
  out.rough = (broad - .5) * 20 + (mid - .5) * 9 + fine * 2;
  return out;
}

/** glTF carries a normal map, not a bump map. The last circumferential row is
 * UV 1, a duplicate of UV 0; use only unique rows for continuous derivatives. */
export function heightFieldToNormal(source: Uint8ClampedArray, target: Uint8ClampedArray, width: number, height: number, strength = 4.5): void {
  const rowCount = height - 1;
  const atHeight = (x: number, y: number) => source[(((y % rowCount + rowCount) % rowCount) * width + clamp(x, 0, width - 1)) * 4] / 255;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = -(atHeight(x + 1, y) - atHeight(x - 1, y)) * strength;
    const ny = (atHeight(x, y + 1) - atHeight(x, y - 1)) * strength;
    const length = Math.hypot(nx, ny, 1), at = (y * width + x) * 4;
    target[at] = (nx / length * .5 + .5) * 255;
    target[at + 1] = (ny / length * .5 + .5) * 255;
    target[at + 2] = (1 / length * .5 + .5) * 255;
    target[at + 3] = 255;
  }
}
