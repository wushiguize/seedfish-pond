import { describe, expect, it } from 'vitest';
import { getLakeClock, getLightingFrame } from '../src/lighting';
import type { LightingMode, WeatherReading } from '../src/model';

const reading = (extra: Partial<WeatherReading> = {}): WeatherReading => ({
  mode: 'sunny', temperature: 24, wind: 3, time: '2026-10-01T00:00', fetchedAt: 0, isDay: true, ...extra,
});

describe('lake clock', () => {
  it('uses an IANA city zone ahead of a conflicting fixed offset and retains seconds', () => {
    const now = Date.UTC(2026, 9, 1, 17, 12, 30, 500);
    const clock = getLakeClock(now, reading({ timeZone: 'Asia/Shanghai', utcOffsetSeconds: 0 }));
    expect(clock.text).toBe('01:12'); expect(clock.source).toBe('city');
    expect(clock.hour).toBeCloseTo(1 + 12 / 60 + 30.5 / 3600, 10);
    expect(getLakeClock(now, reading({ timeZone: 'Asia/Shanghai' }))).toEqual(clock);
  });

  it('follows daylight-saving changes in IANA zones', () => {
    expect(getLakeClock(Date.UTC(2026, 0, 15, 12), reading({ timeZone: 'America/New_York' })).text).toBe('07:00');
    expect(getLakeClock(Date.UTC(2026, 6, 15, 12), reading({ timeZone: 'America/New_York' })).text).toBe('08:00');
  });

  it('uses valid positive, negative and quarter-hour UTC offsets when the zone is absent or invalid', () => {
    const now = Date.UTC(2026, 9, 1, 22, 20, 15);
    const kathmandu = getLakeClock(now, reading({ utcOffsetSeconds: 20700 }));
    expect(kathmandu.text).toBe('04:05'); expect(kathmandu.source).toBe('city');
    expect(kathmandu.hour).toBeCloseTo(4 + 5 / 60 + 15 / 3600, 10);
    expect(getLakeClock(now, reading({ utcOffsetSeconds: -14400 })).text).toBe('18:20');
    expect(getLakeClock(now, reading({ timeZone: 'Invalid/Zone', utcOffsetSeconds: 28800 })).text).toBe('06:20');
  });

  it('falls back to device time for missing or invalid zone metadata', () => {
    const now = Date.UTC(2026, 9, 1, 0, 7, 59, 250), local = new Date(now);
    const expected = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
    for (const weather of [null, undefined, reading(), reading({ timeZone: 'Invalid/Zone' }), reading({ utcOffsetSeconds: 50401 }), reading({ utcOffsetSeconds: NaN }), reading({ utcOffsetSeconds: 1.5 })]) {
      const clock = getLakeClock(now, weather);
      expect(clock.source).toBe('device'); expect(clock.text).toBe(expected);
      expect(clock.hour).toBeCloseTo(local.getHours() + local.getMinutes() / 60 + 59.25 / 3600, 10);
    }
  });
});

describe('artistic lake lighting', () => {
  it('classifies the fixed dawn, day, dusk and night periods', () => {
    expect(getLightingFrame('auto', 4.999).phase).toBe('night');
    expect(getLightingFrame('auto', 5).phase).toBe('dawn');
    expect(getLightingFrame('auto', 8).phase).toBe('day');
    expect(getLightingFrame('auto', 16).phase).toBe('dusk');
    expect(getLightingFrame('auto', 20).phase).toBe('night');
    expect(getLightingFrame('auto', 12).daylight).toBe(1);
    expect(getLightingFrame('auto', 0).daylight).toBe(.16);
  });

  it('keeps numeric light channels continuous at every segment join and midnight', () => {
    for (const boundary of [0, 5, 6.5, 8, 16, 18, 20, 24]) {
      const before = getLightingFrame('auto', boundary - .00001), after = getLightingFrame('auto', boundary + .00001);
      for (const channel of ['daylight', 'warmth', 'night'] as const) expect(before[channel]).toBeCloseTo(after[channel], 7);
      for (let i = 0; i < 3; i++) expect(before.tint[i]).toBeCloseTo(after.tint[i], 7);
      for (const shift of [0, 8, 16]) expect(Math.abs(((before.sunColor >> shift) & 255) - ((after.sunColor >> shift) & 255))).toBeLessThanOrEqual(1);
    }
  });

  it('wraps negative and oversized hours into the same continuous daily cycle', () => {
    expect(getLightingFrame('auto', -6)).toEqual(getLightingFrame('auto', 18));
    expect(getLightingFrame('auto', -17.5)).toEqual(getLightingFrame('auto', 6.5));
    expect(getLightingFrame('auto', 54)).toEqual(getLightingFrame('auto', 6));
    expect(getLightingFrame('auto', NaN)).toEqual(getLightingFrame('auto', 12));
  });

  it('uses a fixed representative time for each manual lighting mode', () => {
    for (const mode of ['dawn', 'day', 'dusk', 'night'] as const) {
      const fixed = getLightingFrame(mode, 0);
      expect(fixed.phase).toBe(mode);
      for (const hour of [-50, 6, 12, 20, 80, NaN]) expect(getLightingFrame(mode, hour)).toEqual(fixed);
    }
    expect(getLightingFrame('dusk', 12).warmth).toBeGreaterThan(getLightingFrame('dawn', 12).warmth);
    expect(getLightingFrame('night', 12).tint[2]).toBeGreaterThan(getLightingFrame('night', 12).tint[0]);
  });

  it('returns finite bounded channels across the full day and every mode', () => {
    for (const mode of ['auto', 'dawn', 'day', 'dusk', 'night'] as LightingMode[]) {
      for (let minute = -1440; minute <= 2880; minute += 11) {
        const frame = getLightingFrame(mode, minute / 60);
        for (const value of [frame.daylight, frame.warmth, frame.night, ...frame.tint]) {
          expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
        }
        expect(Number.isInteger(frame.sunColor)).toBe(true); expect(frame.sunColor).toBeGreaterThanOrEqual(0); expect(frame.sunColor).toBeLessThanOrEqual(0xffffff);
      }
    }
  });
});
