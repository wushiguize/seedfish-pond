import type { LightingMode, WeatherReading } from './model';

export interface LightingFrame {
  daylight: number;
  warmth: number;
  night: number;
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  tint: [number, number, number];
  sunColor: number;
}

export interface LakeClock {
  hour: number;
  text: string;
  source: 'city' | 'device';
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();
const wrapHour = (hour: number) => ((hour % 24) + 24) % 24;
const pad = (value: number) => String(value).padStart(2, '0');

function makeClock(hour: number, minute: number, second: number, milliseconds: number, source: LakeClock['source']): LakeClock {
  return {
    hour: wrapHour(hour + minute / 60 + second / 3600 + milliseconds / 3600000),
    text: `${pad(hour % 24)}:${pad(minute)}`,
    source,
  };
}

export function getLakeClock(now: number, reading?: WeatherReading | null): LakeClock {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid lake clock timestamp');

  const zone = typeof reading?.timeZone === 'string' ? reading.timeZone.trim() : '';
  if (zone) {
    if (!formatters.has(zone)) {
      try {
        formatters.set(zone, new Intl.DateTimeFormat('en-GB-u-nu-latn', {
          timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
        }));
      } catch { formatters.set(zone, null); }
    }
    const formatter = formatters.get(zone);
    if (formatter) {
      const parts = formatter.formatToParts(date);
      const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value);
      const hour = part('hour'), minute = part('minute'), second = part('second');
      if ([hour, minute, second].every(Number.isFinite)) {
        return makeClock(hour, minute, second, date.getUTCMilliseconds(), 'city');
      }
    }
  }

  const offset = reading?.utcOffsetSeconds;
  if (typeof offset === 'number' && Number.isInteger(offset) && offset >= -43200 && offset <= 50400) {
    const local = new Date(now + offset * 1000);
    return makeClock(local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds(), 'city');
  }

  return makeClock(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds(), 'device');
}

type LightState = Omit<LightingFrame, 'phase'>;
const NIGHT: LightState = { daylight: .16, warmth: 0, night: 1, tint: [.66, .78, 1], sunColor: 0xa3c0ee };
const DAY: LightState = { daylight: 1, warmth: 0, night: 0, tint: [1, 1, 1], sunColor: 0xfff5df };
const DAWN: LightState = { daylight: .54, warmth: .64, night: .43, tint: [1, .87, .73], sunColor: 0xffcd98 };
const DUSK: LightState = { daylight: .56, warmth: .94, night: .42, tint: [1, .79, .64], sunColor: 0xffb477 };
const MANUAL_HOURS = { dawn: 6.5, day: 12, dusk: 18, night: 0 } as const;

function blend(a: LightState, b: LightState, progress: number, phase: LightingFrame['phase']): LightingFrame {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t);
  const lerp = (start: number, end: number) => start + (end - start) * ease;
  const channel = (shift: number) => Math.round(lerp((a.sunColor >> shift) & 255, (b.sunColor >> shift) & 255));
  return {
    daylight: lerp(a.daylight, b.daylight),
    warmth: lerp(a.warmth, b.warmth),
    night: lerp(a.night, b.night),
    tint: a.tint.map((value, index) => lerp(value, b.tint[index])) as LightingFrame['tint'],
    sunColor: (channel(16) << 16) | (channel(8) << 8) | channel(0),
    phase,
  };
}

export function getLightingFrame(mode: LightingMode, hour: number): LightingFrame {
  const representative = mode !== 'auto' && Object.hasOwn(MANUAL_HOURS, mode)
    ? MANUAL_HOURS[mode as keyof typeof MANUAL_HOURS] : hour;
  const time = wrapHour(Number.isFinite(representative) ? representative : 12);

  // A fixed artistic day cycle, independent of latitude, season, and API isDay.
  // Smoothstep joins have zero slope at each keyframe, including midnight.
  if (time < 5 || time >= 20) return blend(NIGHT, NIGHT, 0, 'night');
  if (time < 6.5) return blend(NIGHT, DAWN, (time - 5) / 1.5, 'dawn');
  if (time < 8) return blend(DAWN, DAY, (time - 6.5) / 1.5, 'dawn');
  if (time < 16) return blend(DAY, DAY, 0, 'day');
  if (time < 18) return blend(DAY, DUSK, (time - 16) / 2, 'dusk');
  return blend(DUSK, NIGHT, (time - 18) / 2, 'dusk');
}
