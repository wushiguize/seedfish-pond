import { describe, expect, it, vi } from 'vitest';
import {
  FISH_PERSONALITIES, getFishPersonality, isFishPersonality,
  type FishPersonality,
} from '../src/fish-personality';
import type { FishKind } from '../src/model';

describe('virtual fish personalities', () => {
  it('reproduces the same default after cloning, reordering and metadata changes', () => {
    const originals = Array.from({ length: 90 }, (_, index) => ({
      id: `fish-${index}-小鱼`, kind: (index % 2 ? 'medaka' : 'kohaku') as FishKind,
      name: `鱼儿 ${index}`, eaten: index,
    }));
    const defaults = new Map(originals.map(fish => [fish.id, getFishPersonality(fish)]));
    const restored = JSON.parse(JSON.stringify(originals)) as typeof originals;
    for (const fish of restored.reverse()) {
      fish.name = '换了名字'; fish.eaten += 100;
      expect(getFishPersonality(fish)).toBe(defaults.get(fish.id));
    }
    // A deterministic default still gives different virtual fish variety.
    expect(new Set(defaults.values())).toEqual(new Set(['calm', 'curious', 'bold']));
  });

  it('does not read random state when assigning a default', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('random personality'); });
    try {
      const fish = { id: 'fish-stable-1', kind: 'neon' as const };
      expect(getFishPersonality(fish)).toBe(getFishPersonality({ ...fish }));
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });

  it('prioritizes each valid saved/user-selected personality', () => {
    const fish = { id: 'fish-selected', kind: 'catfish' as const };
    for (const personality of ['calm', 'curious', 'bold'] as const) {
      expect(getFishPersonality({ ...fish, personality })).toBe(personality);
      expect(getFishPersonality(JSON.parse(JSON.stringify({ ...fish, personality })))).toBe(personality);
    }
  });

  it('rejects malformed personality values and inherited object property names', () => {
    for (const value of [null, undefined, false, true, 0, 1, {}, [], 'Calm', ' calm', 'bold ', 'unknown', 'toString', '__proto__', 'constructor']) {
      expect(isFishPersonality(value)).toBe(false);
    }
    for (const value of ['calm', 'curious', 'bold']) expect(isFishPersonality(value)).toBe(true);
    const fish = { id: 'fish-invalid-explicit', kind: 'goldfish' as const };
    expect(getFishPersonality({ ...fish, personality: 'unknown' as FishPersonality })).toBe(getFishPersonality(fish));
  });

  it('keeps behavior coefficients finite and within simulation safety limits', () => {
    for (const style of Object.values(FISH_PERSONALITIES)) {
      expect(style.name.trim()).not.toBe(''); expect(style.description.trim()).not.toBe('');
      for (const key of ['cruiseMultiplier', 'feedingMultiplier', 'separationMultiplier', 'patrolMultiplier', 'turnMultiplier'] as const) {
        expect(Number.isFinite(style[key])).toBe(true);
        expect(style[key]).toBeGreaterThanOrEqual(.65);
        expect(style[key]).toBeLessThanOrEqual(1.35);
      }
      expect(style.feedingMultiplier).toBeLessThanOrEqual(1.15);
    }
    expect(FISH_PERSONALITIES.calm.cruiseMultiplier).toBeLessThan(FISH_PERSONALITIES.curious.cruiseMultiplier);
    expect(FISH_PERSONALITIES.calm.separationMultiplier).toBeGreaterThan(FISH_PERSONALITIES.bold.separationMultiplier);
    expect(FISH_PERSONALITIES.curious.patrolMultiplier).toBeGreaterThan(FISH_PERSONALITIES.bold.patrolMultiplier);
    expect(FISH_PERSONALITIES.curious.turnMultiplier).toBeGreaterThan(FISH_PERSONALITIES.calm.turnMultiplier);
    expect(FISH_PERSONALITIES.bold.feedingMultiplier).toBeGreaterThan(FISH_PERSONALITIES.curious.feedingMultiplier);
  });
});
