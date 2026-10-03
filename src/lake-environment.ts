import { clampPond, insidePond, WORLD, type WeatherMode, type WeatherReading } from './model';

export type LakeSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type LakeSeasonMode = 'auto' | LakeSeason;
export const LAKE_SEASON_LABELS: Record<LakeSeasonMode, string> = { auto: '跟随月份', spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
export type Season = LakeSeason;
export type SeasonMode = LakeSeasonMode;
export const SEASON_LABELS = LAKE_SEASON_LABELS;
export const MAX_SURFACE_IMPACTS = 56;
export const MAX_SURFACE_FLOATERS = 24;
export const MAX_AUTUMN_LEAVES = 18;
export const MAX_SPRING_PETALS = 9;

export interface LakeEnvironmentConditions {
  weather: WeatherMode;
  season: LakeSeasonMode;
  date?: Date;
  reading?: WeatherReading | null;
  /** City clock metadata survives manual weather, without reusing its climate. */
  calendarReading?: WeatherReading | null;
  /** North is the default. Automatic southern seasons are shifted six months. */
  latitude?: number;
  /** Artistic direction in radians when the weather API has no wind bearing. */
  windDirection?: number;
  /** Optional interval precipitation in mm; density is an artistic mapping. */
  precipitation?: number;
  /** Existing lighting's daylight, 0..1. This does not calculate sun positions. */
  daylight?: number;
}

export interface SurfaceImpact {
  id: number;
  kind: 'rain' | 'snow' | 'touch';
  x: number;
  y: number;
  strength: number;
  age: number;
  lifetime: number;
  /** Expanding radius in world pixels, for a ripple normal or fine highlight. */
  radius: number;
}

export interface SurfaceFloater {
  id: number;
  kind: 'leaf' | 'petal';
  x: number;
  y: number;
  angle: number;
  size: number;
  age: number;
  lifetime: number;
  vx: number;
  vy: number;
}

export interface LakeEnvironmentState {
  resolvedSeason: LakeSeason;
  /** Seasonal lighting multiplier; waterColor separately gives material color. */
  tint: [number, number, number];
  waterColor: [number, number, number];
  seasonMix: Record<LakeSeason, number>;
  causticStrength: number;
  bedGreen: number;
  clarity: number;
  waveStrength: number;
  /** World pixels/s, rather than pretending an artistic direction is API data. */
  windX: number;
  windY: number;
  windStrength: number;
  /** A limited peripheral sliver only; never a snow blanket or fish opacity. */
  iceFraction: number;
  visitorActivity: number;
  summerGlow: number;
  autumnAmount: number;
  rainIntensity: number;
  snowIntensity: number;
}

const STEP = 1 / 60;
const seasons: LakeSeason[] = ['winter', 'spring', 'summer', 'autumn'];
const clamp = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const validNumber = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const approach = (value: number, target: number, dt: number) => value + (target - value) * (1 - Math.exp(-dt / 1.8));
const monthFormatters = new Map<string, Intl.DateTimeFormat | null>();

export function getLakeMonth(date: Date, reading?: WeatherReading | null): number {
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid season date');
  const zone = typeof reading?.timeZone === 'string' ? reading.timeZone.trim() : '';
  if (zone) {
    if (!monthFormatters.has(zone)) {
      try { monthFormatters.set(zone, new Intl.DateTimeFormat('en-GB-u-nu-latn', { timeZone: zone, month: 'numeric' })); }
      catch { monthFormatters.set(zone, null); }
    }
    const formatter = monthFormatters.get(zone);
    if (formatter) {
      const month = Number(formatter.format(date));
      if (month >= 1 && month <= 12) return month;
    }
  }
  const offset = reading?.utcOffsetSeconds;
  if (Number.isInteger(offset) && offset! >= -43200 && offset! <= 50400) {
    return new Date(date.getTime() + offset! * 1000).getUTCMonth() + 1;
  }
  return date.getMonth() + 1;
}

/** A visual four-season calendar, not local climate or astronomical seasons. */
export function getLakeSeason(date: Date, reading?: WeatherReading | null, latitude = 30): LakeSeason {
  const month = (getLakeMonth(date, reading) - 1 + (latitude < 0 ? 6 : 0)) % 12 + 1;
  return seasons[Math.floor((month % 12) / 3)];
}

export const SEASON_WATER_PALETTES: Record<LakeSeason, { tint: LakeEnvironmentState['tint']; waterColor: LakeEnvironmentState['waterColor']; clarity: number; visitors: number; causticStrength: number; bedGreen: number }> = {
  spring: { tint: [.95, 1.06, 1.04], waterColor: [.31, .63, .54], clarity: .97, visitors: .9, causticStrength: .7, bedGreen: 1 },
  summer: { tint: [.85, 1.02, .93], waterColor: [.06, .32, .28], clarity: .78, visitors: 1, causticStrength: 1.8, bedGreen: .35 },
  autumn: { tint: [1.1, .96, .76], waterColor: [.37, .42, .23], clarity: .8, visitors: .7, causticStrength: .4, bedGreen: .04 },
  winter: { tint: [.82, .93, 1.12], waterColor: [.22, .4, .48], clarity: .93, visitors: .3, causticStrength: .12, bedGreen: 0 },
};

function targets(conditions: LakeEnvironmentConditions, cachedSeason?: LakeSeason): LakeEnvironmentState {
  const resolvedSeason = conditions.season === 'auto'
    ? cachedSeason ?? getLakeSeason(conditions.date ?? new Date(), conditions.calendarReading ?? conditions.reading, conditions.latitude)
    : conditions.season;
  const daylight = clamp(validNumber(conditions.daylight, 1));
  // Provider bearings describe where wind comes FROM: 0deg north -> south,
  // 90deg east -> west. Screen Y grows down; an explicit artistic override
  // instead describes the travel direction in screen-space radians.
  const kmh = clamp(validNumber(conditions.reading?.wind, 5), 0, 100);
  const windStrength = clamp(kmh / 45);
  const windBearing = validNumber(conditions.reading?.windDirection, NaN);
  const windDirection = validNumber(conditions.windDirection, Number.isFinite(windBearing) ? (windBearing + 90) * Math.PI / 180 : -.38);
  const windSpeed = 1.5 + windStrength * 10;
  const rainIntensity = conditions.weather === 'rain' ? clamp(.5 + validNumber(conditions.precipitation, validNumber(conditions.reading?.precipitation, 1.5)) / 6, .25, 1) : 0;
  const snowIntensity = conditions.weather === 'snow' ? clamp(.35 + validNumber(conditions.reading?.snowfall, .15) * 2, .25, 1) : 0;
  const cloud = conditions.weather === 'cloudy' ? .06 : 0;
  const winter = resolvedSeason === 'winter';
  const temperature = validNumber(conditions.reading?.temperature, winter ? 1 : 15);
  const palette = SEASON_WATER_PALETTES[resolvedSeason];
  return {
    resolvedSeason,
    tint: [...palette.tint],
    waterColor: [...palette.waterColor],
    seasonMix: { spring: resolvedSeason === 'spring' ? 1 : 0, summer: resolvedSeason === 'summer' ? 1 : 0, autumn: resolvedSeason === 'autumn' ? 1 : 0, winter: resolvedSeason === 'winter' ? 1 : 0 },
    causticStrength: palette.causticStrength,
    bedGreen: palette.bedGreen,
    clarity: clamp(palette.clarity - rainIntensity * .1 - snowIntensity * .03 - cloud, .6, 1),
    waveStrength: ({ spring: .48, summer: .78, autumn: .57, winter: .32 }[resolvedSeason]) + windStrength * .7 + rainIntensity * .32 + snowIntensity * .08,
    windX: Math.cos(windDirection) * windSpeed,
    windY: Math.sin(windDirection) * windSpeed * .72,
    windStrength,
    iceFraction: winter ? clamp((5 - temperature) / 7) * .12 : 0,
    visitorActivity: palette.visitors * (1 - rainIntensity * .7) * (1 - snowIntensity * .6),
    summerGlow: resolvedSeason === 'summer' && conditions.weather === 'sunny' ? clamp((.7 - daylight) / .5) * .6 : 0,
    autumnAmount: resolvedSeason === 'autumn' ? 1 : 0,
    rainIntensity,
    snowIntensity,
  };
}

/**
 * Pure, bounded water-surface simulation. It never owns fish, weather fetching,
 * storage, rendering or wall clocks. A fixed timestep makes seeded 20/30/60 FPS
 * runs identical; the caller only updates a changing date when it needs to.
 */
export class LakeEnvironment {
  readonly state: LakeEnvironmentState;
  readonly impacts: SurfaceImpact[] = [];
  readonly floaters: SurfaceFloater[] = [];
  private target: LakeEnvironmentState;
  private conditions: LakeEnvironmentConditions = { weather: 'sunny', season: 'spring' };
  private accumulator = 0;
  private rainAccumulator = 0;
  private snowAccumulator = 0;
  private leafAccumulator = 0;
  private petalAccumulator = 0;
  private clock = 0;
  private nextId = 1;
  private monthKey = '';
  private automaticSeason: LakeSeason = 'spring';
  private conditionKey = '';

  constructor(private random: () => number = Math.random, initialConditions: Partial<LakeEnvironmentConditions> = {}) {
    this.conditions = { ...this.conditions, ...initialConditions };
    this.target = targets(this.conditions);
    this.state = { ...this.target, tint: [...this.target.tint], waterColor: [...this.target.waterColor], seasonMix: { ...this.target.seasonMix } };
  }

  setConditions(conditions: Partial<LakeEnvironmentConditions>): void {
    this.conditions = { ...this.conditions, ...conditions };
    const c = this.conditions, reading = c.reading, calendarReading = c.calendarReading ?? reading;
    if (c.season === 'auto') {
      const date = c.date ?? new Date();
      // City-local month boundaries occur on minute boundaries. Cache the
      // minute and zone so rendering can send the current date every frame.
      const monthKey = `${Math.floor(date.getTime() / 60000)}|${calendarReading?.timeZone ?? ''}|${calendarReading?.utcOffsetSeconds ?? ''}|${validNumber(c.latitude, 30) < 0}`;
      if (monthKey !== this.monthKey) {
        this.automaticSeason = getLakeSeason(date, calendarReading, c.latitude);
        this.monthKey = monthKey;
      }
    }
    const conditionKey = [c.weather, c.season, this.automaticSeason, c.windDirection, c.precipitation, Math.round(validNumber(c.daylight, 1) * 500), reading?.wind, reading?.windDirection, reading?.precipitation, reading?.snowfall, reading?.temperature].join('|');
    if (conditionKey === this.conditionKey) return;
    this.conditionKey = conditionKey;
    this.target = targets(c, this.automaticSeason);
    this.state.resolvedSeason = this.target.resolvedSeason;
  }

  update(dt: number, density = 1): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, .25);
    const amount = clamp(validNumber(density, 1));
    while (this.accumulator + 1e-10 >= STEP) {
      this.accumulator -= STEP;
      this.step(STEP, amount);
    }
  }

  /** A light drag makes a finite disturbance and pushes nearby floating leaves. */
  addDisturbance(x: number, y: number, strength = .5): boolean {
    if (![x, y, strength].every(Number.isFinite) || strength <= 0 || !insidePond(x, y, .94)) return false;
    const power = clamp(strength, .05, 1);
    this.pushImpact({ id: this.nextId++, kind: 'touch', x, y, strength: power, age: 0, lifetime: 2.4, radius: 2 });
    for (const leaf of this.floaters) {
      const dx = leaf.x - x, dy = leaf.y - y, distance = Math.hypot(dx, dy);
      if (distance >= 150) continue;
      const angle = distance > .1 ? Math.atan2(dy, dx) : this.nextRandom() * Math.PI * 2;
      const force = power * (1 - distance / 150) * 18;
      leaf.vx = clamp(leaf.vx + Math.cos(angle) * force, -24, 24);
      leaf.vy = clamp(leaf.vy + Math.sin(angle) * force, -24, 24);
    }
    return true;
  }

  private nextRandom(): number { return clamp(validNumber(this.random(), .5), 0, .999999999); }

  private waterPoint(margin = .86): { x: number; y: number } {
    const angle = this.nextRandom() * Math.PI * 2, radius = Math.sqrt(this.nextRandom()) * margin;
    return { x: WORLD.cx + Math.cos(angle) * WORLD.rx * radius, y: WORLD.cy + Math.sin(angle) * WORLD.ry * radius };
  }

  private pushImpact(impact: SurfaceImpact): void {
    if (this.impacts.length >= MAX_SURFACE_IMPACTS) {
      // A rain shower cannot immediately erase the user's fresh drag ripple.
      const nonTouch = this.impacts.findIndex(item => item.kind !== 'touch');
      this.impacts.splice(nonTouch < 0 ? 0 : nonTouch, 1);
    }
    this.impacts.push(impact);
  }

  private emitImpact(kind: 'rain' | 'snow'): void {
    const point = this.waterPoint(.91), snow = kind === 'snow';
    this.pushImpact({
      id: this.nextId++, kind, ...point, strength: snow ? .1 + this.nextRandom() * .13 : .25 + this.nextRandom() * .45,
      age: 0, lifetime: snow ? 2.8 : 1.5 + this.nextRandom() * .6, radius: 2,
    });
    // Close impacts create tiny, bounded drift impulses; no fish save changes.
    if (!snow) for (const leaf of this.floaters) {
      const dx = leaf.x - point.x, dy = leaf.y - point.y, distance = Math.hypot(dx, dy);
      if (distance > .1 && distance < 50) {
        const force = (1 - distance / 50) * .7;
        leaf.vx = clamp(leaf.vx + dx / distance * force, -24, 24);
        leaf.vy = clamp(leaf.vy + dy / distance * force, -24, 24);
      }
    }
  }

  private step(dt: number, density: number): void {
    this.clock += dt;
    const state = this.state;
    for (let index = 0; index < 3; index++) {
      state.tint[index] = approach(state.tint[index], this.target.tint[index], dt);
      state.waterColor[index] = approach(state.waterColor[index], this.target.waterColor[index], dt);
    }
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) state.seasonMix[season] = approach(state.seasonMix[season], this.target.seasonMix[season], dt);
    for (const field of ['clarity', 'waveStrength', 'windX', 'windY', 'windStrength', 'iceFraction', 'visitorActivity', 'summerGlow', 'autumnAmount', 'rainIntensity', 'snowIntensity', 'causticStrength', 'bedGreen'] as const) {
      state[field] = approach(state[field], this.target[field], dt);
    }
    for (let index = this.impacts.length - 1; index >= 0; index--) {
      const impact = this.impacts[index];
      impact.age += dt;
      impact.radius = 2 + impact.age * (impact.kind === 'touch' ? 37 : impact.kind === 'rain' ? 21 : 5);
      if (impact.age >= impact.lifetime) this.impacts.splice(index, 1);
    }
    this.rainAccumulator += state.rainIntensity * 26 * density * dt;
    this.snowAccumulator += state.snowIntensity * 7 * density * dt;
    while (this.rainAccumulator >= 1) { this.rainAccumulator--; this.emitImpact('rain'); }
    while (this.snowAccumulator >= 1) { this.snowAccumulator--; this.emitImpact('snow'); }

    const leafCount = this.floaters.filter(item => item.kind === 'leaf').length;
    const petalCount = this.floaters.length - leafCount;
    // Populate a selected season within seconds, then replace drifting leaves
    // slowly. Counts remain low and distributed across the full open water.
    const leafGoal = Math.round(MAX_AUTUMN_LEAVES * state.seasonMix.autumn * density);
    const petalGoal = Math.round(MAX_SPRING_PETALS * state.seasonMix.spring * density);
    this.leafAccumulator += state.autumnAmount * density * dt * (leafCount < leafGoal ? 4 : .05);
    this.petalAccumulator += state.seasonMix.spring * density * dt * (petalCount < petalGoal ? 3 : .035);
    while (this.leafAccumulator >= 1) {
      this.leafAccumulator--;
      if (this.floaters.length >= MAX_SURFACE_FLOATERS || this.floaters.filter(item => item.kind === 'leaf').length >= MAX_AUTUMN_LEAVES) continue;
      const point = this.waterPoint();
      this.floaters.push({ id: this.nextId++, kind: 'leaf', ...point, angle: this.nextRandom() * Math.PI * 2, size: 10 + this.nextRandom() * 7, age: 0, lifetime: 75 + this.nextRandom() * 30, vx: state.windX, vy: state.windY });
    }
    while (this.petalAccumulator >= 1) {
      this.petalAccumulator--;
      if (this.floaters.length >= MAX_SURFACE_FLOATERS || this.floaters.filter(item => item.kind === 'petal').length >= MAX_SPRING_PETALS) continue;
      const point = this.waterPoint();
      this.floaters.push({ id: this.nextId++, kind: 'petal', ...point, angle: this.nextRandom() * Math.PI * 2, size: 5 + this.nextRandom() * 4, age: 0, lifetime: 45 + this.nextRandom() * 25, vx: state.windX, vy: state.windY });
    }
    for (let index = this.floaters.length - 1; index >= 0; index--) {
      const leaf = this.floaters[index];
      // Existing leaves quietly fade away during a seasonal switch.
      const seasonWeight = state.seasonMix[leaf.kind === 'leaf' ? 'autumn' : 'spring'];
      leaf.age += dt * (1 + (1 - seasonWeight) * 8);
      if (leaf.age >= leaf.lifetime) { this.floaters.splice(index, 1); continue; }
      const sway = Math.sin(this.clock * .45 + leaf.id * 2.1);
      leaf.vx += (state.windX + sway * 1.1 - leaf.vx) * dt * .5;
      leaf.vy += (state.windY + Math.cos(this.clock * .4 + leaf.id) * .8 - leaf.vy) * dt * .5;
      const next = clampPond(leaf.x + leaf.vx * dt, leaf.y + leaf.vy * dt, .9);
      leaf.x = next.x; leaf.y = next.y;
      leaf.angle += dt * (.03 + sway * .035);
    }
  }
}
