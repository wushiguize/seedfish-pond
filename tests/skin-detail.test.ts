import { describe, expect, it } from 'vitest';
import { createSkinDetail, heightFieldToNormal, sampleSkinDetail } from '../src/skin-detail';

describe('procedural skin UV continuity', () => {
  it('keeps pigment, roughness and anatomical details continuous around the back seam', () => {
    for (const rows of [18, 24, 28, 30]) for (const seed of [13, 31, 97, 127, 181]) for (let x = 0; x <= 40; x++) {
      const pattern = { rows, columns: 44, gillU: .728, scales: seed !== 181 };
      const first = sampleSkinDetail(x / 40, 0, seed, pattern, createSkinDetail());
      const last = sampleSkinDetail(x / 40, 1, seed, pattern, createSkinDetail());
      for (const key of Object.keys(first) as (keyof typeof first)[]) expect(Math.abs(first[key] - last[key])).toBeLessThan(1e-11);
    }
  });
  it('matches normal derivatives at the duplicated UV rows and keeps normals opaque', () => {
    const width = 11, height = 17, source = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) source[(y * width + x) * 4] = 128 + Math.sin(y / (height - 1) * Math.PI * 2) * 12 + x * 2;
    const target = new Uint8ClampedArray(source.length), original = source.slice();
    heightFieldToNormal(source, target, width, height);
    expect([...target.slice(0, width * 4)]).toEqual([...target.slice((height - 1) * width * 4)]);
    expect(source).toEqual(original);
    for (let at = 0; at < target.length; at += 4) { expect(target[at + 2]).toBeGreaterThan(230); expect(target[at + 3]).toBe(255); }
  });
  it('gives a flat height field a neutral normal without artificial relief', () => {
    const source = new Uint8ClampedArray(5 * 6 * 4).fill(128), target = new Uint8ClampedArray(source.length);
    heightFieldToNormal(source, target, 5, 6);
    for (let at = 0; at < target.length; at += 4) expect([...target.slice(at, at + 4)]).toEqual([128, 128, 255, 255]);
  });
});
