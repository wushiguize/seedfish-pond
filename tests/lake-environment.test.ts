import { describe, expect, it } from 'vitest';
import { getLakeMonth, getLakeSeason, LakeEnvironment, MAX_AUTUMN_LEAVES, MAX_SPRING_PETALS, MAX_SURFACE_FLOATERS, MAX_SURFACE_IMPACTS, type Season } from '../src/lake-environment';
import { makeSeasonIceFragments } from '../src/season-surface';
import { insidePond, WORLD, type WeatherReading } from '../src/model';

const random = (initial = 37) => { let seed = initial; return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; };
const reading = (patch: Partial<WeatherReading> = {}): WeatherReading => ({ mode: 'sunny', temperature: 12, wind: 12, time: '2026-10-03T12:00', fetchedAt: 0, isDay: true, ...patch });
const advance = (environment: LakeEnvironment, seconds: number, fps = 60, density = 1) => { for (let frame = 0; frame < seconds * fps; frame++) environment.update(1 / fps, density); };
const snapshot = (environment: LakeEnvironment) => structuredClone({ state: environment.state, impacts: environment.impacts, floaters: environment.floaters });

describe('visual seasons and real weather inputs', () => {
  it('initializes a saved winter scene directly without a spring or autumn first-frame flash', () => {
    const environment = new LakeEnvironment(random(), { season: 'winter', weather: 'sunny', latitude: 30, reading: null });
    expect(environment.state.resolvedSeason).toBe('winter');
    expect(environment.state.seasonMix).toEqual({ spring: 0, summer: 0, autumn: 0, winter: 1 });
    expect(environment.state.waterColor).toEqual([.22, .4, .48]);
    const initialState = structuredClone(environment.state);
    environment.setConditions({ season: 'winter', weather: 'sunny', latitude: 30, reading: null });
    environment.update(1 / 60);
    expect(environment.state).toEqual(initialState);
    expect(environment.floaters).toHaveLength(0);
  });

  it('uses all twelve northern months and reverses the visual calendar in the south', () => {
    const seasons = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
    for (let month = 1; month <= 12; month++) {
      const date = new Date(Date.UTC(2026, month - 1, 15, 12));
      expect(getLakeSeason(date, reading({ utcOffsetSeconds: 0 }))).toBe(seasons[month - 1]);
      expect(getLakeSeason(date, reading({ utcOffsetSeconds: 0 }), -30)).toBe(seasons[(month - 1 + 6) % 12]);
    }
  });

  it('uses city timezone at month boundaries, then offset, then device month', () => {
    const date = new Date('2026-03-01T00:30:00Z');
    expect(getLakeMonth(date, reading({ timeZone: 'America/Los_Angeles', utcOffsetSeconds: 28800 }))).toBe(2);
    expect(getLakeSeason(date, reading({ timeZone: 'Asia/Shanghai' }))).toBe('spring');
    expect(getLakeSeason(date, reading({ timeZone: 'bad-zone', utcOffsetSeconds: -3600 }))).toBe('winter');
    expect(getLakeMonth(date)).toBe(date.getMonth() + 1);
    expect(() => getLakeMonth(new Date(NaN))).toThrow(RangeError);
  });

  it('refreshes cached automatic season when city or month changes without resetting existing impacts', () => {
    const environment = new LakeEnvironment(random());
    const date = new Date('2026-03-01T00:30:00Z');
    environment.setConditions({ weather: 'rain', season: 'auto', date, reading: reading({ timeZone: 'Asia/Shanghai' }) });
    expect(environment.state.resolvedSeason).toBe('spring');
    advance(environment, 5);
    const existingId = environment.impacts.at(-1)?.id;
    environment.setConditions({ reading: reading({ timeZone: 'America/Los_Angeles' }) });
    expect(environment.state.resolvedSeason).toBe('winter');
    expect(environment.impacts.at(-1)?.id).toBe(existingId);
    environment.setConditions({ date: new Date('2026-06-15T12:00:00Z') });
    expect(environment.state.resolvedSeason).toBe('summer');
  });

  it('uses the selected city calendar during manual weather without reviving its old wind or precipitation', () => {
    const environment = new LakeEnvironment(random()), manual = new LakeEnvironment(random());
    const city = reading({ timeZone: 'America/Los_Angeles', utcOffsetSeconds: 28800, wind: 90, windDirection: 90, precipitation: 20, temperature: -15 });
    environment.setConditions({ weather: 'rain', season: 'auto', date: new Date('2026-03-01T00:30:00Z'), calendarReading: city, reading: null });
    manual.setConditions({ weather: 'rain', season: 'winter', reading: null });
    expect(environment.state.resolvedSeason).toBe('winter');
    advance(environment, 30); advance(manual, 30);
    expect(environment.state).toEqual(manual.state);
    expect(environment.impacts).toEqual(manual.impacts);
    expect(environment.state.windX).toBeGreaterThan(0);
    expect(environment.state.rainIntensity).toBeLessThan(.8);
    environment.setConditions({ calendarReading: reading({ timeZone: 'Asia/Shanghai' }), reading: reading({ timeZone: 'America/Los_Angeles', precipitation: 30 }) });
    expect(environment.state.resolvedSeason).toBe('spring');
    advance(environment, 30);
    expect(environment.state.rainIntensity).toBeGreaterThan(.99);
  });

  it('changes cold tint, clarity, wind and ice smoothly while leaving the water open', () => {
    const environment = new LakeEnvironment(random()), before = snapshot(environment).state;
    environment.setConditions({ season: 'winter', weather: 'snow', reading: reading({ temperature: -10, wind: 40, snowfall: .8 }) });
    expect(environment.state.tint).toEqual(before.tint);
    environment.update(1 / 60);
    expect(Math.abs(environment.state.tint[0] - before.tint[0])).toBeLessThan(.004);
    expect(environment.state.iceFraction).toBeGreaterThan(0);
    expect(environment.state.iceFraction).toBeLessThan(.002);
    advance(environment, 30);
    expect(environment.state.iceFraction).toBeGreaterThan(.119);
    expect(environment.state.iceFraction).toBeLessThanOrEqual(.12);
    expect(environment.state.waveStrength).toBeGreaterThan(before.waveStrength);
    expect(environment.state.tint[2]).toBeGreaterThan(environment.state.tint[0]);
    environment.setConditions({ reading: reading({ temperature: 15 }) });
    advance(environment, 30);
    expect(environment.state.iceFraction).toBeLessThan(.00001);
  });

  it('converts meteorological FROM bearings and honors artistic travel-direction overrides', () => {
    const environment = new LakeEnvironment(random());
    environment.setConditions({ reading: reading({ wind: 40, windDirection: 0 }) });
    advance(environment, 30);
    expect(environment.state.windY).toBeGreaterThan(6);
    expect(Math.abs(environment.state.windX)).toBeLessThan(.001);
    environment.setConditions({ reading: reading({ wind: 40, windDirection: 90 }) });
    advance(environment, 30);
    expect(environment.state.windX).toBeLessThan(-9);
    expect(Math.abs(environment.state.windY)).toBeLessThan(.001);
    environment.setConditions({ windDirection: 0 });
    advance(environment, 30);
    expect(environment.state.windX).toBeGreaterThan(9);
  });

  it('maps returned precipitation intervals artistically, with override priority and low evening summer glow', () => {
    const a = new LakeEnvironment(random()), b = new LakeEnvironment(random());
    a.setConditions({ weather: 'rain', reading: reading({ precipitation: 3 }) });
    b.setConditions({ weather: 'rain', reading: reading({ precipitation: 3 }), precipitation: 0 });
    advance(a, 30); advance(b, 30);
    expect(a.state.rainIntensity).toBeGreaterThan(b.state.rainIntensity);
    b.setConditions({ season: 'summer', weather: 'sunny', daylight: .25 });
    advance(b, 30);
    expect(b.state.summerGlow).toBeGreaterThan(.5);
    expect(b.state.summerGlow).toBeLessThanOrEqual(.6);
    b.setConditions({ weather: 'rain' });
    advance(b, 30);
    expect(b.state.summerGlow).toBeLessThan(.0001);
  });

  it('gives every season a clearly different water palette and finishes a manual change within eight seconds', () => {
    const records = new Map<Season, ReturnType<typeof snapshot>['state']>();
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const environment = new LakeEnvironment(random());
      environment.setConditions({ season, weather: 'sunny', daylight: 1 });
      advance(environment, 8);
      const state = snapshot(environment).state; records.set(season, state);
      expect(state.seasonMix[season]).toBeGreaterThan(.985);
      expect(Object.values(state.seasonMix).reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 10);
    }
    const colors = [...records.values()].map(state => state.waterColor);
    for (let a = 0; a < colors.length; a++) for (let b = a + 1; b < colors.length; b++) {
      expect(Math.hypot(...colors[a].map((channel, index) => channel - colors[b][index]))).toBeGreaterThan(.19);
    }
    expect(records.get('spring')!.bedGreen).toBeGreaterThan(.98);
    expect(records.get('summer')!.causticStrength).toBeGreaterThan(1.7);
    expect(records.get('winter')!.causticStrength).toBeLessThan(.14);
  });

  it('shows petals and distributed autumn leaves within eight seconds while keeping floater coverage bounded', () => {
    const spring = new LakeEnvironment(random()), autumn = new LakeEnvironment(random());
    spring.setConditions({ season: 'spring' }); autumn.setConditions({ season: 'autumn' });
    advance(spring, 8); advance(autumn, 8);
    expect(spring.floaters.filter(item => item.kind === 'petal').length).toBeGreaterThanOrEqual(7);
    const leaves = autumn.floaters.filter(item => item.kind === 'leaf');
    expect(leaves.length).toBeGreaterThanOrEqual(14);
    expect(leaves.length).toBeLessThanOrEqual(MAX_AUTUMN_LEAVES);
    expect(spring.floaters.length).toBeLessThanOrEqual(MAX_SPRING_PETALS);
    // Tiny material footprints remain far below 1% of lake area.
    expect(leaves.reduce((area, leaf) => area + leaf.size ** 2 * 3.1, 0) / (Math.PI * WORLD.rx * WORLD.ry)).toBeLessThan(.01);
    expect(new Set(leaves.map(leaf => `${leaf.x < WORLD.cx ? 0 : 1}${leaf.y < WORLD.cy ? 0 : 1}`)).size).toBe(4);
  });

  it('keeps winter shore fragments entirely outside the central swimming water with deterministic bounded geometry', () => {
    const fragments = makeSeasonIceFragments();
    expect(fragments).toHaveLength(28); expect(fragments).toEqual(makeSeasonIceFragments());
    for (const fragment of fragments) for (let index = 0; index < fragment.points.length; index += 2) {
      const radius = Math.hypot((fragment.points[index] - WORLD.cx) / WORLD.rx, (fragment.points[index + 1] - WORLD.cy) / WORLD.ry);
      expect(radius).toBeGreaterThan(.885); expect(radius).toBeLessThan(.945);
    }
  });
});

describe('bounded physical water-surface responses', () => {
  it('keeps rain impacts and wind-driven leaves in water through ten simulated minutes', () => {
    const environment = new LakeEnvironment(random());
    environment.setConditions({ weather: 'rain', season: 'autumn', reading: reading({ wind: 80, precipitation: 30 }) });
    let maximumImpacts = 0, maximumLeaves = 0;
    for (let frame = 0; frame < 30 * 600; frame++) {
      environment.update(1 / 30);
      if (frame % 30) continue;
      maximumImpacts = Math.max(maximumImpacts, environment.impacts.length);
      maximumLeaves = Math.max(maximumLeaves, environment.floaters.filter(item => item.kind === 'leaf').length);
      expect(environment.impacts.length).toBeLessThanOrEqual(MAX_SURFACE_IMPACTS);
      expect(environment.floaters.length).toBeLessThanOrEqual(MAX_SURFACE_FLOATERS);
      expect(environment.impacts.every(impact => insidePond(impact.x, impact.y, .94) && impact.age < impact.lifetime && impact.radius > 0)).toBe(true);
      expect(environment.floaters.every(leaf => insidePond(leaf.x, leaf.y, .91) && [leaf.vx, leaf.vy, leaf.angle].every(Number.isFinite))).toBe(true);
    }
    expect(maximumImpacts).toBeGreaterThan(30);
    expect(maximumLeaves).toBeGreaterThanOrEqual(5);
    expect(maximumLeaves).toBeLessThanOrEqual(MAX_AUTUMN_LEAVES);
  });

  it('snow impacts melt into faint small rings and disappear after a fair-weather transition', () => {
    const environment = new LakeEnvironment(random());
    environment.setConditions({ weather: 'snow', season: 'winter' });
    advance(environment, 20);
    expect(environment.impacts.length).toBeGreaterThan(2);
    expect(environment.impacts.every(impact => impact.kind === 'snow' && impact.strength <= .23 && impact.radius < 17)).toBe(true);
    expect(environment.floaters).toHaveLength(0);
    environment.setConditions({ weather: 'sunny' });
    advance(environment, 30);
    expect(environment.impacts).toHaveLength(0);
  });

  it('a fingertip disturbance pushes a nearby floating leaf and leaves the distant water untouched', () => {
    const environment = new LakeEnvironment(random());
    environment.setConditions({ season: 'autumn', weather: 'sunny', reading: reading({ wind: 0 }) });
    advance(environment, 25);
    const leaf = environment.floaters[0], velocity = leaf.vx;
    expect(environment.addDisturbance(leaf.x - 10, leaf.y, 1)).toBe(true);
    expect(leaf.vx).toBeGreaterThan(velocity + 10);
    const touch = environment.impacts.at(-1)!;
    expect(touch.kind).toBe('touch');
    environment.update(1 / 60);
    expect(touch.age).toBeGreaterThan(0);
    expect(touch.radius).toBeGreaterThan(2);
    expect(environment.addDisturbance(-100, WORLD.cy)).toBe(false);
    expect(environment.addDisturbance(WORLD.cx, WORLD.cy, NaN)).toBe(false);
    expect(environment.addDisturbance(WORLD.cx, WORLD.cy, 0)).toBe(false);
  });

  it('caps dense user disturbances and preserves a fresh touch ripple during rain emission', () => {
    const environment = new LakeEnvironment(random());
    environment.setConditions({ weather: 'rain', precipitation: 30 });
    advance(environment, 30);
    for (let index = 0; index < 200; index++) environment.addDisturbance(WORLD.cx, WORLD.cy, .5);
    expect(environment.impacts).toHaveLength(MAX_SURFACE_IMPACTS);
    const fresh = environment.impacts.at(-1)!;
    environment.update(.1);
    expect(environment.impacts).toHaveLength(MAX_SURFACE_IMPACTS);
    expect(environment.impacts.includes(fresh)).toBe(true);
    expect(environment.impacts.filter(impact => impact.kind === 'rain').length).toBeGreaterThan(0);
  });

  it('quality density suppresses background emission while keeping deliberate touch feedback', () => {
    const a = new LakeEnvironment(random()), b = new LakeEnvironment(random()), zero = new LakeEnvironment(random());
    for (const environment of [a, b, zero]) environment.setConditions({ weather: 'rain', season: 'autumn', precipitation: 30 });
    advance(a, 30, 60, 1); advance(b, 30, 60, .25); advance(zero, 30, 60, 0);
    expect(a.impacts.length).toBeGreaterThan(b.impacts.length);
    expect(zero.impacts).toHaveLength(0); expect(zero.floaters).toHaveLength(0);
    expect(zero.addDisturbance(WORLD.cx, WORLD.cy)).toBe(true);
    zero.update(1 / 60, 0);
    expect(zero.impacts[0].age).toBeGreaterThan(0);
  });

  it('retains seeded state exactly at 20, 30 and 60 FPS, including per-frame condition refreshes', () => {
    const environments = [20, 30, 60].map(() => new LakeEnvironment(random()));
    for (const [index, fps] of [20, 30, 60].entries()) {
      const environment = environments[index];
      const conditions = { weather: 'rain' as const, season: 'auto' as const, date: new Date('2026-10-03T12:00:00Z'), reading: reading({ timeZone: 'Asia/Shanghai' }) };
      environment.setConditions(conditions);
      for (let frame = 0; frame < 90 * fps; frame++) {
        if (index === 2) environment.setConditions({ ...conditions, date: new Date(conditions.date.getTime() + frame * 1000 / fps) });
        environment.update(1 / fps);
      }
    }
    expect(snapshot(environments[0])).toEqual(snapshot(environments[1]));
    expect(snapshot(environments[1])).toEqual(snapshot(environments[2]));
  });

  it('does not advance or consume random state while paused, and caps a long resumed tick', () => {
    let randomCalls = 0;
    const baseRandom = random(), environment = new LakeEnvironment(() => { randomCalls++; return baseRandom(); });
    environment.setConditions({ season: 'autumn', weather: 'rain' });
    advance(environment, 20);
    const before = snapshot(environment), calls = randomCalls;
    for (const dt of [0, -1, NaN, Infinity, -Infinity]) environment.update(dt);
    expect(snapshot(environment)).toEqual(before); expect(randomCalls).toBe(calls);
    const a = new LakeEnvironment(random()), b = new LakeEnvironment(random());
    a.setConditions({ weather: 'rain' }); b.setConditions({ weather: 'rain' });
    a.update(30); for (let frame = 0; frame < 15; frame++) b.update(1 / 60);
    expect(snapshot(a)).toEqual(snapshot(b));
  });
});
