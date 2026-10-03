import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WORLD } from './model';
import { type LakeEnvironmentState, type SurfaceFloater } from './lake-environment';
import { MAX_SEASON_FALL_PARTICLES, SeasonFallSimulation, type SeasonFallImpact } from './season-fall';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const seeded = (initial: number) => { let seed = initial; return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; };
const position = (angle: number, radius: number) => ({ x: WORLD.cx + Math.cos(angle) * WORLD.rx * radius, y: WORLD.cy + Math.sin(angle) * WORLD.ry * radius });

export interface SeasonIceFragment { points: number[]; alpha: number; shade: number }

/** Sparse small fragments just inside the baked shore ice, with open center. */
export function makeSeasonIceFragments(): SeasonIceFragment[] {
  const random = seeded(9381), fragments: SeasonIceFragment[] = [];
  for (let index = 0; index < 28; index++) {
    const angle = index / 28 * Math.PI * 2 + (random() - .5) * .043;
    const outer = .925 + random() * .009;
    const inner = .889 + random() * .017;
    const span = .009 + random() * .013;
    const corners = [position(angle - span, outer), position(angle + span * .37, outer + .009), position(angle + span, outer - .004), position(angle + span * .7, inner + .018), position(angle + span * .07, inner), position(angle - span * .77, inner + .012)];
    fragments.push({ points: corners.flatMap(point => [point.x, point.y]), alpha: .11 + random() * .15, shade: index % 3 === 0 ? 0xcce0e6 : 0xadc9d0 });
  }
  return fragments;
}

/** Five-lobed maple silhouette, serrated edges and fine palmate veins. */
export function makeSeasonFloaterCanvas(kind: 'leaf' | 'petal', variant: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 144;
  const context = canvas.getContext('2d')!;
  const random = seeded(1007 + variant * 333 + (kind === 'petal' ? 9 : 0));
  const shape = new Path2D();
  if (kind === 'leaf') {
    const outline = [[72, 119], [47, 104], [26, 111], [33, 90], [8, 76], [24, 68], [10, 52], [41, 56], [36, 23], [57, 40], [72, 7], [85, 40], [108, 24], [101, 56], [134, 52], [118, 68], [137, 77], [109, 91], [115, 111], [96, 104]];
    shape.moveTo(outline[0][0], outline[0][1]);
    for (let index = 1; index <= outline.length; index++) {
      const from = outline[index - 1], to = outline[index % outline.length];
      const dx = to[0] - from[0], dy = to[1] - from[1], distance = Math.hypot(dx, dy);
      const teeth = Math.max(2, Math.round(distance / 4));
      for (let tooth = 1; tooth <= teeth; tooth++) {
        const t = tooth / teeth, ridge = tooth === teeth ? 0 : (tooth % 2 ? 1.35 : -.6);
        shape.lineTo(from[0] + dx * t - dy / distance * ridge, from[1] + dy * t + dx / distance * ridge);
      }
    }
  } else {
    shape.moveTo(70, 124); shape.bezierCurveTo(40, 106, 24, 64, 36, 35);
    shape.bezierCurveTo(45, 16, 60, 19, 70, 30); shape.bezierCurveTo(81, 18, 101, 20, 108, 40);
    shape.bezierCurveTo(121, 72, 95, 106, 70, 124);
  }
  shape.closePath();
  const gradient = context.createLinearGradient(24, 14, 114, 124);
  if (kind === 'leaf') {
    const hues = [['#7b3928', '#df873c', '#bd542b', '#803526'], ['#7d2826', '#ca5540', '#a83b31', '#692c25'], ['#81572c', '#e6ad4b', '#ce752c', '#7d3e21'], ['#813d29', '#d47934', '#bc4f2a', '#783123']][variant % 4];
    hues.forEach((color, index) => gradient.addColorStop(index / 3, color));
  } else { gradient.addColorStop(0, '#f3c5d0'); gradient.addColorStop(.35, '#ffe8eb'); gradient.addColorStop(.62, '#f8d2d9'); gradient.addColorStop(1, '#d58da6'); }
  context.fillStyle = gradient; context.fill(shape);
  context.save(); context.clip(shape);
  for (let index = 0; index < 520; index++) {
    const x = 9 + random() * 129, y = 8 + random() * 121;
    context.fillStyle = index % 2 ? 'rgba(55,34,16,.09)' : 'rgba(255,235,190,.1)';
    context.fillRect(x, y, .6 + random() * 2, .6 + random() * 1.1);
  }
  context.lineCap = 'round';
  context.strokeStyle = kind === 'leaf' ? 'rgba(75,38,23,.5)' : 'rgba(185,103,137,.15)'; context.lineWidth = kind === 'leaf' ? 1.2 : .65;
  if (kind === 'leaf') {
    for (const tip of [[72, 8], [37, 24], [11, 54], [108, 25], [134, 54], [27, 108], [114, 108]]) {
      context.beginPath(); context.moveTo(72, 120); context.quadraticCurveTo(72, 87, tip[0], tip[1]); context.stroke();
      for (let index = 2; index <= 5; index++) {
        const t = index / 7, x = 72 + (tip[0] - 72) * t, y = 109 + (tip[1] - 109) * t;
        context.lineWidth = .5;
        for (const side of [-1, 1]) {
          context.beginPath(); context.moveTo(x, y); context.lineTo(x + (tip[0] - 72) * .14 + side * 6, y + (tip[1] - 109) * .14 - side * 2); context.stroke();
        }
      }
      context.lineWidth = 1.2;
    }
  } else {
    for (const offset of [-24, -12, 0, 12, 24]) {
      context.beginPath(); context.moveTo(70, 124); context.quadraticCurveTo(70 + offset * .4, 85, 70 + offset, 32 + Math.abs(offset) * .4); context.stroke();
    }
  }
  const wet = context.createLinearGradient(0, 15, 0, 126); wet.addColorStop(0, 'rgba(255,249,211,0)'); wet.addColorStop(.36, 'rgba(255,248,223,.13)'); wet.addColorStop(.53, 'rgba(255,249,233,.02)'); wet.addColorStop(1, 'rgba(29,33,20,.12)');
  context.fillStyle = wet; context.fillRect(0, 0, 144, 144); context.restore();
  if (kind === 'leaf') { context.strokeStyle = '#81503a'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(72, 117); context.quadraticCurveTo(72, 127, 67, 138); context.stroke(); }
  return canvas;
}

interface FloaterView { body: Sprite; shadow: Sprite }

/**
 * Put above the water/fish composition, below animal labels. Shore frost and
 * material color belong to the v5 backgrounds; this layer only supplies small
 * detached ice highlights and a finite pool of moving textured floaters.
 * Existing drawSurface() must stop drawing its old flat leaf polygons.
 */
export class SeasonSurfaceLayer extends Container {
  private ice = new Graphics();
  private pools: FloaterView[] = [];
  private leafTextures = Array.from({ length: 4 }, (_, index) => Texture.from(makeSeasonFloaterCanvas('leaf', index)));
  private petalTextures = Array.from({ length: 2 }, (_, index) => Texture.from(makeSeasonFloaterCanvas('petal', index)));
  private fall = new SeasonFallSimulation();
  private quality = 1;
  private time = 0;
  private visibleFloaters = 0;
  private iceCount = 28;

  constructor() {
    super(); this.label = 'season-surface'; this.eventMode = 'none';
    for (const fragment of makeSeasonIceFragments()) {
      this.ice.poly(fragment.points).fill({ color: fragment.shade, alpha: fragment.alpha }).stroke({ color: 0xedf5f3, alpha: .24, width: 1.15 });
      const p = fragment.points;
      this.ice.moveTo(p[0], p[1]).lineTo(p[6], p[7]).stroke({ color: 0xf3f8f6, alpha: .2, width: .7 });
    }
    this.addChild(this.ice);
    for (let index = 0; index < MAX_SEASON_FALL_PARTICLES; index++) {
      const shadow = new Sprite(this.leafTextures[0]), body = new Sprite(this.leafTextures[0]);
      shadow.anchor.set(.5); body.anchor.set(.5); shadow.tint = 0x182d28;
      shadow.visible = body.visible = false; this.addChild(shadow, body); this.pools.push({ body, shadow });
    }
  }

  setQuality(density: number): void { this.quality = clamp(Number.isFinite(density) ? density : 1, .35, 1); this.fall.setQuality(this.quality); }

  addDisturbance(x: number, y: number, strength = .5): boolean { return this.fall.addDisturbance(x, y, strength); }
  getImpacts(): readonly SeasonFallImpact[] { return this.fall.impacts; }
  drainLandingImpacts(): SeasonFallImpact[] { return this.fall.drainLandingImpacts(); }

  update(dt: number, state: LakeEnvironmentState, _floaters: readonly SurfaceFloater[], daylight = 1): void {
    if (Number.isFinite(dt) && dt > 0) this.time += Math.min(dt, .25);
    this.fall.update(dt, state);
    const light = clamp(daylight, .16, 1);
    const cold = state.seasonMix.winter * clamp(state.iceFraction / .065);
    this.ice.alpha = cold * (.25 + light * .75);
    this.ice.visible = this.ice.alpha > .005;
    this.ice.position.set(Math.sin(this.time * .11) * 1.4, Math.sin(this.time * .12) * 1.1);
    this.visibleFloaters = 0;
    for (let index = 0; index < this.pools.length; index++) {
      const view = this.pools[index], item = this.fall.particles[index];
      if (!item) { view.body.visible = view.shadow.visible = false; continue; }
      const opacity = item.alpha;
      view.body.visible = view.shadow.visible = opacity > .01;
      if (!view.body.visible) continue;
      this.visibleFloaters++;
      const textures = item.kind === 'leaf' ? this.leafTextures : this.petalTextures, texture = textures[item.id % textures.length];
      view.body.texture = view.shadow.texture = texture;
      const width = item.size, height = width * (item.kind === 'leaf' ? 1 : 1.08);
      view.body.width = width; view.body.height = height * item.flip;
      view.shadow.width = width * (1 + item.height * .0008); view.shadow.height = height * .73;
      view.body.position.set(item.x, item.y - item.height); view.shadow.position.set(item.x + 1.8 + item.height * .08, item.y + 2.3 + item.height * .025);
      view.body.rotation = view.shadow.rotation = item.angle;
      view.body.alpha = opacity * (.62 + light * .38); view.shadow.alpha = opacity * (item.phase === 'falling' ? .07 : .18);
      view.shadow.visible = opacity > .01 && ((item.x - WORLD.cx) / WORLD.rx) ** 2 + ((item.y - WORLD.cy) / WORLD.ry) ** 2 < .89 ** 2;
      const value = Math.round(255 * (.65 + light * .35)); view.body.tint = value * 0x010101;
    }
  }

  getStats() {
    const fall = this.fall.getStats();
    return { visibleFloaters: this.visibleFloaters, floaterPool: this.pools.length, iceFragments: this.iceCount, textures: 6, simulationTime: this.time, iceAlpha: this.ice.alpha, falling: fall.falling, floating: fall.floating, landings: fall.landings, fallImpacts: fall.impacts };
  }

  override destroy(): void {
    super.destroy({ children: true });
    for (const texture of [...this.leafTextures, ...this.petalTextures]) texture.destroy(true);
  }
}
