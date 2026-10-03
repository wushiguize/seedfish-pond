import { describe, expect, it } from 'vitest';
import { getLightingFrame } from '../src/lighting';
import type { LakeSeason } from '../src/lake-environment';
import type { WeatherMode } from '../src/model';
import { getWeatherOptics } from '../src/weather-optics';

const seasons: LakeSeason[] = ['spring', 'summer', 'autumn', 'winter'];
const weatherModes: WeatherMode[] = ['sunny', 'cloudy', 'rain', 'snow'];

describe('weather display optics', () => {
  it('makes every sunny daytime bed visibly brighter and clearer than readable overcast water', () => {
    const light = getLightingFrame('day', 12);
    for (const season of seasons) {
      const sunny = getWeatherOptics('sunny', { [season]: 1 }, light);
      const cloudy = getWeatherOptics('cloudy', { [season]: 1 }, light);
      expect(sunny.brightness - cloudy.brightness).toBeGreaterThan(.08);
      expect(sunny.clarity).toBeGreaterThan(.95);
      expect(sunny.clarity - cloudy.clarity).toBeGreaterThan(.04);
      expect(sunny.directSun).toBeGreaterThan(cloudy.directSun * 4);
      expect(cloudy.reflection).toBeGreaterThan(sunny.reflection * 4);
      expect(cloudy.brightness).toBeGreaterThanOrEqual(.9);
      expect(cloudy.clarity).toBeGreaterThanOrEqual(.85);
    }
  });

  it('has no direct solar light throughout the real clock night or the manual night setting', () => {
    const lights = [getLightingFrame('night', 12), ...[0, 4.99, 20, 23.99, 24].map(hour => getLightingFrame('auto', hour))];
    for (const light of lights) for (const season of seasons) for (const weather of weatherModes) {
      expect(light.phase).toBe('night');
      expect(getWeatherOptics(weather, { [season]: 1 }, light).directSun).toBe(0);
    }
  });

  it('blends seasonal endpoints continuously and safely ignores invalid or missing weights', () => {
    const light = getLightingFrame('day', 12);
    const mixtures: Partial<Record<LakeSeason, number>>[] = [
      {}, { spring: NaN, summer: Infinity, autumn: -1, winter: -Infinity },
      { spring: .25, summer: .75 }, { spring: 2, autumn: .3, winter: NaN },
    ];
    for (const weather of weatherModes) {
      const spring = getWeatherOptics(weather, { spring: 1 }, light);
      const summer = getWeatherOptics(weather, { summer: 1 }, light);
      const mixed = getWeatherOptics(weather, { spring: .25, summer: .75 }, light);
      for (const field of ['brightness', 'clarity'] as const) {
        expect(mixed[field]).toBeCloseTo(spring[field] * .25 + summer[field] * .75, 12);
      }
      for (const mix of mixtures) {
        const result = getWeatherOptics(weather, mix, light);
        for (const value of Object.values(result).flat()) expect(Number.isFinite(value)).toBe(true);
        expect(result.brightness).toBeGreaterThan(0);
        expect(result.clarity).toBeGreaterThanOrEqual(0);
        expect(result.clarity).toBeLessThanOrEqual(1);
      }
      expect(getWeatherOptics(weather, mixtures[1], light)).toEqual(getWeatherOptics(weather, {}, light));
    }
  });

  it('keeps the ecological clock frame unchanged and owns its returned display tint', () => {
    const light = getLightingFrame('dusk', 18), before = structuredClone(light);
    Object.freeze(light.tint); Object.freeze(light);
    for (const weather of weatherModes) {
      const result = getWeatherOptics(weather, { autumn: .6, winter: .4 }, light);
      expect(result.daylight).toBe(light.daylight);
      expect(result.tint).not.toBe(light.tint);
      result.tint[0] = 0;
      expect(light).toEqual(before);
    }
  });
});
