import { describe, expect, it } from 'vitest';
import { LakeEnvironment, type LakeEnvironmentState, type Season } from '../src/lake-environment';
import { insidePond, WORLD } from '../src/model';
import { MAX_SEASON_FALL_IMPACTS, MAX_SEASON_FALL_PARTICLES, SEASON_FALL_SOURCES, SeasonFallSimulation } from '../src/season-fall';

const random = (initial = 418) => { let seed = initial; return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; };
const environment = (season: Season, weather: 'sunny' | 'rain' = 'sunny') => new LakeEnvironment(random(), { season, weather }).state;
const advance = (fall: SeasonFallSimulation, seconds: number, state: LakeEnvironmentState, fps = 60) => {
  for (let frame = 0; frame < seconds * fps; frame++) fall.update(1 / fps, state);
};
const snapshot = (fall: SeasonFallSimulation) => structuredClone({ particles: fall.particles, impacts: fall.impacts, stats: fall.getStats() });

describe('seasonal branches, falling foliage and real landing positions', () => {
  it('starts beneath peripheral branches, then emits one water impact at each actual landing', () => {
    const fall = new SeasonFallSimulation(random()), state = environment('autumn');
    advance(fall, 1, state);
    expect(fall.particles.length).toBeGreaterThan(0);
    expect(fall.particles.every(item => item.phase === 'falling' && item.height > 0)).toBe(true);
    for (const item of fall.particles) {
      expect(SEASON_FALL_SOURCES.some(source => Math.abs(item.sourceX - source.x) <= 75 && Math.abs(item.sourceY - item.initialHeight - source.y) <= 42.5)).toBe(true);
    }
    advance(fall, 18, state);
    const landings = fall.drainLandingImpacts();
    expect(landings).toHaveLength(18);
    expect(new Set(landings.map(item => item.id)).size).toBe(landings.length);
    expect(landings.every(item => item.source === 'leaf' && insidePond(item.x, item.y, .9))).toBe(true);
    expect(fall.drainLandingImpacts()).toEqual([]);
    expect(fall.particles.filter(item => item.phase === 'floating')).toHaveLength(18);
  });

  it('keeps spring light, with ten fine petals and no autumn leaves', () => {
    const fall = new SeasonFallSimulation(random());
    advance(fall, 18, environment('spring'));
    expect(fall.particles).toHaveLength(10);
    expect(fall.particles.every(item => item.kind === 'petal' && item.size < 15)).toBe(true);
    expect(fall.getStats().landings).toBe(10);
  });

  it('leaves the central water open while landing beneath the side canopies', () => {
    const fall = new SeasonFallSimulation(random());
    advance(fall, 19, environment('autumn'));
    for (const landing of fall.drainLandingImpacts()) {
      const radius = Math.hypot((landing.x - WORLD.cx) / WORLD.rx, (landing.y - WORLD.cy) / WORLD.ry);
      expect(radius).toBeGreaterThan(.58);
      expect(radius).toBeLessThanOrEqual(.9);
    }
  });

  it('retires the previous season smoothly and adds no summer or winter foliage', () => {
    const lake = new LakeEnvironment(random(), { season: 'autumn' }), fall = new SeasonFallSimulation(random());
    advance(fall, 12, lake.state);
    expect(fall.particles.length).toBeGreaterThan(0);
    lake.setConditions({ season: 'winter' });
    const before = fall.particles[0].alpha;
    for (let frame = 0; frame < 60; frame++) { lake.update(1 / 60); fall.update(1 / 60, lake.state); }
    expect(fall.particles[0].alpha).toBeLessThan(before);
    for (let frame = 0; frame < 12 * 60; frame++) { lake.update(1 / 60); fall.update(1 / 60, lake.state); }
    expect(fall.particles).toEqual([]); expect(fall.impacts).toEqual([]);
    for (const season of ['summer', 'winter'] as const) {
      const idle = new SeasonFallSimulation(random()); advance(idle, 120, environment(season));
      expect(idle.getStats().particles).toBe(0); expect(idle.getStats().landings).toBe(0);
    }
  });

  it('freezes falling height, floating drift and all ripple ages when dt is zero', () => {
    const fall = new SeasonFallSimulation(random()), state = environment('autumn');
    advance(fall, 7, state);
    expect(fall.getStats().falling).toBeGreaterThan(0); expect(fall.getStats().floating).toBeGreaterThan(0);
    const before = snapshot(fall);
    for (let frame = 0; frame < 300; frame++) fall.update(0, state);
    fall.update(-1, state); fall.update(Number.NaN, state); fall.update(Number.POSITIVE_INFINITY, state);
    expect(snapshot(fall)).toEqual(before);
  });

  it('responds to a local water disturbance after landing, without pushing airborne foliage', () => {
    const fall = new SeasonFallSimulation(random()); advance(fall, 7, environment('autumn'));
    const floating = fall.particles.find(item => item.phase === 'floating')!;
    const flying = fall.particles.find(item => item.phase === 'falling')!;
    const airborneVelocity = [flying.vx, flying.vy], vx = floating.vx;
    expect(fall.addDisturbance(floating.x - 15, floating.y, .8)).toBe(true);
    expect(floating.vx).toBeGreaterThan(vx + 10);
    expect([flying.vx, flying.vy]).toEqual(airborneVelocity);
    expect(fall.addDisturbance(0, 0)).toBe(false);
    expect(fall.addDisturbance(Number.NaN, floating.y)).toBe(false);
  });

  it('uses the same fixed-step motion at 20, 30 and 60 FPS', () => {
    const state = environment('autumn', 'rain');
    const versions = [20, 30, 60].map(fps => { const fall = new SeasonFallSimulation(random()); advance(fall, 35, state, fps); return snapshot(fall); });
    expect(versions[0]).toEqual(versions[1]); expect(versions[1]).toEqual(versions[2]);
  });

  it('keeps both render population and pending callbacks bounded during repeated seasons and heavy wind', () => {
    const lake = new LakeEnvironment(random(), { season: 'autumn', weather: 'rain' });
    const fall = new SeasonFallSimulation(random());
    for (let second = 0; second < 600; second++) {
      if (second % 25 === 0) lake.setConditions({ season: second % 50 === 0 ? 'spring' : 'autumn', reading: { mode: 'rain', temperature: 10, wind: 80, windDirection: 130, time: '2026-10-03T12:00', fetchedAt: 0, isDay: true } });
      for (let frame = 0; frame < 30; frame++) { lake.update(1 / 30); fall.update(1 / 30, lake.state); }
      expect(fall.particles.length).toBeLessThanOrEqual(MAX_SEASON_FALL_PARTICLES);
      expect(fall.impacts.length).toBeLessThanOrEqual(MAX_SEASON_FALL_IMPACTS);
      expect(fall.particles.every(item => [item.x, item.y, item.height, item.angle, item.alpha, item.flip, item.vx, item.vy].every(Number.isFinite))).toBe(true);
      expect(fall.particles.filter(item => item.phase === 'floating').every(item => insidePond(item.x, item.y, .9))).toBe(true);
    }
    expect(fall.drainLandingImpacts().length).toBeLessThanOrEqual(MAX_SEASON_FALL_PARTICLES);
    expect(fall.getStats().landings).toBeGreaterThan(100);
  });

  it('reduces density with the economy profile while retaining visible seasonal response', () => {
    const fall = new SeasonFallSimulation(random()); fall.setQuality(.35);
    advance(fall, 12, environment('autumn'));
    expect(fall.particles).toHaveLength(6); expect(fall.getStats().landings).toBe(6);
  });

  it('continues occasional canopy falls after the first batch without accumulating more leaves', () => {
    const fall = new SeasonFallSimulation(random()), state = environment('autumn');
    advance(fall, 18, state); const firstLandings = fall.getStats().landings;
    advance(fall, 45, state);
    expect(fall.getStats().landings).toBeGreaterThan(firstLandings);
    expect(fall.particles.length).toBeLessThanOrEqual(18);
    expect(fall.particles.filter(item => item.kind === 'leaf').length).toBeGreaterThanOrEqual(16);
  });
});
