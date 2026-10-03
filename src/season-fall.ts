import { clampPond, insidePond, WORLD } from './model';
import type { LakeEnvironmentState, SurfaceImpact } from './lake-environment';

export const MAX_SEASON_FALL_PARTICLES = 24;
export const MAX_SEASON_FALL_IMPACTS = 12;
export const SEASON_FALL_SOURCES = [{ x: 300, y: 170 }, { x: 2140, y: 240 }] as const;
const STEP = 1 / 60;
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

export type SeasonFallKind = 'leaf' | 'petal';
export interface SeasonFallParticle {
  id: number;
  kind: SeasonFallKind;
  phase: 'falling' | 'floating';
  /** Ground-plane coordinates. Draw the airborne body at y - height. */
  x: number; y: number; height: number;
  angle: number; flip: number; size: number; alpha: number;
  age: number; lifetime: number; vx: number; vy: number;
  phaseAge: number; fallDuration: number; initialHeight: number;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  wobble: number; spin: number;
}

/** Compatible with the existing water-normal shader; source distinguishes this from a user's touch. */
export interface SeasonFallImpact extends SurfaceImpact { source: SeasonFallKind }

/**
 * A small fixed-step population, independent of rendering, fish, storage and
 * wall clocks. Falling foliage lands in the peripheral water, then responds
 * to wind and the same finite disturbances as the rest of the lake.
 */
export class SeasonFallSimulation {
  readonly particles: SeasonFallParticle[] = [];
  readonly impacts: SeasonFallImpact[] = [];
  private landingQueue: SeasonFallImpact[] = [];
  private accumulator = 0;
  private spawnClock = .15;
  private releaseClock = 8;
  private time = 0;
  private nextId = 1;
  private landings = 0;
  private quality = 1;

  constructor(private random: () => number = Math.random) {}

  setQuality(value: number): void { this.quality = clamp(finite(value, 1), .35, 1); }

  update(dt: number, environment: LakeEnvironmentState): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, .25);
    while (this.accumulator + 1e-10 >= STEP) {
      this.accumulator -= STEP;
      this.step(STEP, environment);
    }
  }

  addDisturbance(x: number, y: number, strength = .5): boolean {
    if (![x, y, strength].every(Number.isFinite) || strength <= 0 || !insidePond(x, y, .94)) return false;
    const power = clamp(strength, .05, 1);
    for (const item of this.particles) {
      if (item.phase !== 'floating') continue;
      const dx = item.x - x, dy = item.y - y, distance = Math.hypot(dx, dy);
      if (distance >= 150) continue;
      const angle = distance > .01 ? Math.atan2(dy, dx) : item.id * 2.39996;
      const impulse = power * (1 - distance / 150) * 21;
      item.vx = clamp(item.vx + Math.cos(angle) * impulse, -25, 25);
      item.vy = clamp(item.vy + Math.sin(angle) * impulse, -25, 25);
      item.spin += power * .12;
    }
    return true;
  }

  drainLandingImpacts(): SeasonFallImpact[] {
    const result = this.landingQueue.map(impact => ({ ...impact }));
    this.landingQueue.length = 0;
    return result;
  }

  getStats() {
    return {
      falling: this.particles.filter(item => item.phase === 'falling').length,
      floating: this.particles.filter(item => item.phase === 'floating').length,
      particles: this.particles.length,
      limit: MAX_SEASON_FALL_PARTICLES,
      impacts: this.impacts.length,
      landings: this.landings,
      simulationTime: this.time,
    };
  }

  private nextRandom(): number { return clamp(finite(this.random(), .5), 0, .999999999); }

  private spawn(kind: SeasonFallKind, state: LakeEnvironmentState): void {
    const side = this.nextRandom() < .56 ? 0 : 1, source = SEASON_FALL_SOURCES[side];
    // Most land just beneath the branches. A few drift down the two side arcs;
    // the central sight line remains open instead of becoming a leaf carpet.
    const lower = this.nextRandom() < .2;
    const angle = side === 0
      ? (lower ? Math.PI - .1 - this.nextRandom() * .3 : Math.PI + .36 + this.nextRandom() * .55)
      : (lower ? .1 + this.nextRandom() * .3 : Math.PI * 2 - .36 - this.nextRandom() * .55);
    const radius = .64 + this.nextRandom() * .22;
    const targetX = WORLD.cx + Math.cos(angle) * WORLD.rx * radius;
    const targetY = WORLD.cy + Math.sin(angle) * WORLD.ry * radius;
    const initialHeight = 85 + this.nextRandom() * 75;
    const sourceX = source.x + (this.nextRandom() - .5) * 150;
    const sourceY = source.y + (this.nextRandom() - .5) * 85 + initialHeight;
    this.particles.push({
      id: this.nextId++, kind, phase: 'falling', x: sourceX, y: sourceY,
      height: initialHeight, angle: this.nextRandom() * Math.PI * 2, flip: 1,
      size: kind === 'leaf' ? 24 + this.nextRandom() * 11 : 10 + this.nextRandom() * 5,
      alpha: 0, age: 0, lifetime: kind === 'leaf' ? 88 + this.nextRandom() * 28 : 55 + this.nextRandom() * 23,
      vx: state.windX * .4, vy: state.windY * .4, phaseAge: 0,
      fallDuration: (kind === 'leaf' ? 5.2 : 4.3) + this.nextRandom() * 2.1,
      initialHeight, sourceX, sourceY, targetX, targetY,
      wobble: this.nextRandom() * Math.PI * 2, spin: (this.nextRandom() - .5) * .5,
    });
  }

  private land(item: SeasonFallParticle): void {
    item.phase = 'floating'; item.phaseAge = 0; item.height = 0; item.flip = 1;
    const impact: SeasonFallImpact = {
      id: this.nextId++, kind: 'touch', source: item.kind, x: item.x, y: item.y,
      strength: item.kind === 'leaf' ? .16 : .09, radius: 2, age: 0,
      lifetime: item.kind === 'leaf' ? 2.2 : 1.5,
    };
    if (this.impacts.length >= MAX_SEASON_FALL_IMPACTS) this.impacts.shift();
    this.impacts.push(impact);
    if (this.landingQueue.length >= MAX_SEASON_FALL_PARTICLES) this.landingQueue.shift();
    this.landingQueue.push({ ...impact }); this.landings++;
  }

  private step(dt: number, state: LakeEnvironmentState): void {
    this.time += dt;
    for (let index = this.impacts.length - 1; index >= 0; index--) {
      const impact = this.impacts[index]; impact.age += dt;
      impact.radius = 2 + impact.age * (impact.source === 'leaf' ? 16 : 12);
      if (impact.age >= impact.lifetime) this.impacts.splice(index, 1);
    }
    const kind = state.resolvedSeason === 'autumn' ? 'leaf' : state.resolvedSeason === 'spring' ? 'petal' : null;
    const weight = kind ? clamp(finite(state.seasonMix[kind === 'leaf' ? 'autumn' : 'spring'])) : 0;
    const goal = Math.round((kind === 'leaf' ? 18 : 10) * this.quality * weight);
    const ownCount = this.particles.filter(item => item.kind === kind).length;
    this.spawnClock -= dt;
    // Keep a quiet trickle after the opening fall. An older leaf disappears
    // gradually before its replacement comes from the canopy, keeping the
    // same small population instead of accumulating an endless layer.
    if (kind && ownCount >= goal && goal > 0 && weight > .5) {
      this.releaseClock -= dt;
      if (this.releaseClock <= 0) {
        const oldest = this.particles.filter(item => item.kind === kind && item.phase === 'floating' && item.age < item.lifetime - 6).sort((a, b) => b.age - a.age)[0];
        if (oldest) oldest.age = oldest.lifetime - 4;
        this.releaseClock = 12 + this.nextRandom() * 6;
      }
    }
    if (kind && weight > .18 && ownCount < goal && this.particles.length < MAX_SEASON_FALL_PARTICLES && this.spawnClock <= 0) {
      this.spawn(kind, state);
      this.spawnClock = (kind === 'leaf' ? .46 : .62) / Math.max(.5, this.quality);
    }
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const item = this.particles[index];
      const seasonWeight = clamp(finite(state.seasonMix[item.kind === 'leaf' ? 'autumn' : 'spring']));
      item.age += dt * (1 + (1 - seasonWeight) * 4);
      item.alpha = seasonWeight * clamp(Math.min(item.age / .45, (item.lifetime - item.age) / 6));
      if (item.age >= item.lifetime || (seasonWeight < .006 && item.age > .7)) { this.particles.splice(index, 1); continue; }
      item.phaseAge += dt;
      if (item.phase === 'falling') {
        const progress = clamp(item.phaseAge * (1 + state.rainIntensity * .12) / item.fallDuration);
        const easing = progress * progress * (3 - 2 * progress);
        const flutter = Math.sin(progress * Math.PI), oscillation = Math.sin(item.phaseAge * 3.8 + item.wobble);
        const windX = finite(state.windX) * item.fallDuration * progress * .52;
        const windY = finite(state.windY) * item.fallDuration * progress * .4;
        item.x = item.sourceX + (item.targetX - item.sourceX) * easing + oscillation * flutter * (item.kind === 'leaf' ? 27 : 18) + windX;
        item.y = item.sourceY + (item.targetY - item.sourceY) * easing + windY;
        item.height = item.initialHeight * (1 - progress) + flutter * 35;
        item.angle += dt * (item.spin * 2 + oscillation * .55);
        item.flip = .2 + .8 * Math.abs(Math.cos(item.phaseAge * (item.kind === 'leaf' ? 2.4 : 3) + item.wobble));
        if (progress >= 1) {
          const point = clampPond(item.x, item.y, .89); item.x = point.x; item.y = point.y;
          this.land(item);
        }
      } else {
        const sway = Math.sin(this.time * .5 + item.wobble), windScale = .48;
        item.vx += (finite(state.windX) * windScale + sway * 1.2 - item.vx) * dt * .45;
        item.vy += (finite(state.windY) * windScale + Math.cos(this.time * .47 + item.id) * .9 - item.vy) * dt * .45;
        const point = clampPond(item.x + item.vx * dt, item.y + item.vy * dt, .89);
        item.x = point.x; item.y = point.y;
        // Gently follow the side eddies. This is compositional restraint, not
        // a barrier for fish or a claim about the real current of a lake.
        const dx = (item.x - WORLD.cx) / WORLD.rx, dy = (item.y - WORLD.cy) / WORLD.ry;
        const radius = Math.hypot(dx, dy);
        if (radius < .5 && radius > .001) {
          item.x += dx / radius * dt * 2; item.y += dy / radius * dt;
        }
        item.angle += dt * (.025 + sway * .035 + item.spin * .08);
        item.flip = .94 + Math.sin(this.time * .8 + item.wobble) * .04;
      }
    }
  }
}
