import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { FishKind } from './model';
import type { FishAnatomy } from './fish-anatomy';
import { heightFieldToNormal, skinNoise } from './skin-detail';

type RGB = [number, number, number];
type SkinCanvases = [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
export interface AnatomicalSkin { color: CanvasTexture; normal: CanvasTexture; roughness: CanvasTexture }
const WIDTH = 512, HEIGHT = 256, CACHE_LIMIT = 16;
const canvasCache = new Map<string, SkinCanvases>();
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (lo: number, hi: number, n: number) => { const t = clamp((n - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
const rgb = (hex: string): RGB => { const n = Number.parseInt(hex.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (out: RGB, color: RGB, amount: number) => { const f = clamp(amount); for (let i = 0; i < 3; i++) out[i] += (color[i] - out[i]) * f; };
const oval = (u: number, side: number, x: number, y: number, rx: number, ry: number, feather = .11) => 1 - smooth(1 - feather, 1 + feather, Math.hypot((u - x) / rx, (side - y) / ry));
const band = (u: number, x: number, halfWidth: number, softness = .012) => 1 - smooth(halfWidth, halfWidth + softness, Math.abs(u - x));
const stripe = (z: number, center: number, width: number, softness = .014) => 1 - smooth(width, width + softness, Math.abs(z - center));
const INK: RGB = [35, 42, 36], RED: RGB = [164, 61, 39], WARM_RED: RGB = [175, 78, 46];
const SILVER: RGB = [184, 191, 179], PEARL: RGB = [204, 208, 190], BLUE: RGB = [51, 107, 126];
const OLIVE: RGB = [91, 113, 88];
const pigmentSpots: [number, number, number, number][] = [[.17, .20, .14, .84], [.39, -.21, .15, .83], [.62, .19, .14, .91], [.85, -.08, .10, .66]];
const raySpots: [number, number, number, number][] = [];
// Non-aligned dorsal ocelli, measured in body XY rather than stretched UV cells.
let raySeed = 41917;
const rayRandom = () => { raySeed = (Math.imul(raySeed, 1664525) + 1013904223) >>> 0; return raySeed / 4294967296; };
for (let attempt = 0; attempt < 400 && raySpots.length < 37; attempt++) {
  const x = -.12 + rayRandom() * 1.0, y = -.48 + rayRandom() * .96, radius = .026 + rayRandom() * .016, warmth = rayRandom();
  if (((x - .34) / .50) ** 2 + (y / .49) ** 2 > .91) continue;
  if (raySpots.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < (radius + r) * 1.46 + .014)) continue;
  raySpots.push([x, y, radius, warmth]);
}

/** Species pigment is applied to a shaded skin base, never as opaque painted
 * rectangles. Each pattern uses the actual flank, dorsal and head landmarks. */
function pigment(kind: FishKind, anatomy: FishAnatomy, u: number, sine: number, z: number, n: number, m: number, out: RGB, accent: RGB): void {
  const flank = Math.abs(sine), back = smooth(-.16, .70, z), head = smooth(.72, .94, u);
  const warped = u + (n - .5) * .014 + Math.sin(sine * 5.6 + u * 11) * .003;
  const sideLine = stripe(z, .02 + Math.sin(u * 4.3) * .055, .046, .040) * flank ** 2;
  let mask = 0;
  switch (kind) {
    case 'kohaku': case 'showa': {
      for (const [x, y, rx, ry] of pigmentSpots) mask = Math.max(mask, oval(warped, sine + (m - .5) * .15, x, y, rx, ry, .075));
      mask *= smooth(-.42, .05, z);
      mix(out, accent, mask * .97);
      if (kind === 'showa') {
        let black = oval(warped, sine + (n - .5) * .28, .29, -.46, .088, .93, .08);
        black = Math.max(black, oval(warped, sine, .54, .35, .055, 1.08, .08), oval(warped, sine + (m - .5) * .25, .78, -.57, .070, .55, .1));
        mix(out, [31, 37, 31], black * smooth(-.67, .08, z) * .95);
      }
      break;
    }
    case 'tancho': {
      // The mark follows the forehead between the eyes, not a dorsal mid-body stripe.
      mask = oval(u + (n - .5) * .004, sine, .887, 0, .051, .52, .055) * smooth(.36, .85, z);
      mix(out, accent, mask * .96); break;
    }
    case 'yamabuki': mix(out, [205, 172, 99], (.10 + back * .15 + (m - .5) * .04)); break;
    case 'platinum': mix(out, [193, 204, 192], back * .13); break;
    case 'betta': {
      mix(out, BLUE, smooth(.3, .75, z) * .34);
      const crimson = oval(u, sine, .55, -.66, .27, .66, .3) + oval(u, sine, .23, .78, .17, .56, .3);
      mix(out, [126, 61, 55], crimson * .48 + (1 - smooth(-.6, -.2, z)) * .15);
      mix(out, [114, 153, 151], flank ** 3 * (m * .12)); break;
    }
    case 'angelfish': {
      for (const x of [.20, .45, .66, .86]) mask = Math.max(mask, band(warped + z * .018, x, x === .86 ? .021 : .033, .009));
      mix(out, [47, 56, 49], mask * .87 * smooth(-.94, -.60, z)); break;
    }
    case 'catfish': {
      // Smooth scaleless mucus-covered skin: low contrast clouding, no plate grid.
      mix(out, [78, 87, 72], smooth(.58, .85, n) * .30 * back);
      mix(out, [137, 145, 121], (1 - smooth(-.62, .13, z)) * .38);
      mix(out, [93, 96, 79], smooth(.66, .85, m) * .1); break;
    }
    case 'stingray': {
      const x = anatomy.profile[0][0] + u * (anatomy.profile.at(-1)![0] - anatomy.profile[0][0]);
      // The factory maps the ray's broad disc with planar UVs: v=.5+y/1.14.
      // Here `sine` carries physical Y instead of the teleost ring coordinate.
      const y = sine;
      let nearest = 100, radius = .032, warmth = .5;
      for (const [cx, cy, r, tone] of raySpots) { const d = Math.hypot(x - cx, y - cy); if (d < nearest) { nearest = d; radius = r; warmth = tone; } }
      const ring = (1 - smooth(radius + .004, radius + .008, nearest)) * back;
      const center = (1 - smooth(radius - .004, radius + .001, nearest)) * back;
      mix(out, [46, 44, 32], ring * .72); mix(out, [185, 156, 97], center * (.79 + warmth * .18));
      mix(out, [213, 185, 124], center * .10 * n); break;
    }
    case 'goldfish': mix(out, WARM_RED, .30 * back + .14 * flank); mix(out, [193, 158, 90], (1 - back) * .10); break;
    case 'ryukin': {
      const red = Math.max(oval(warped, sine, .83, -.06, .15, .82, .1), oval(warped, sine + (m - .5) * .15, .34, .37, .15, .95, .12));
      mix(out, [174, 81, 48], red * smooth(-.45, .05, z) * .94); break;
    }
    case 'medaka': mix(out, OLIVE, back * .18); mix(out, [181, 184, 148], sideLine * .19); break;
    case 'zebrafish': {
      for (const center of [-.70, -.36, 0, .35, .67]) mask = Math.max(mask, stripe(z, center + Math.sin(u * 4.2) * .030, .054, .025));
      mix(out, [48, 66, 78], mask * flank ** .7 * (1 - head * .75) * .86); break;
    }
    case 'neon': case 'cardinal': {
      mix(out, [28, 115, 134], stripe(z, .16, .12, .055) * flank ** .8 * smooth(.11, .2, u) * (1 - smooth(.87, .97, u)) * .93);
      mix(out, RED, stripe(z, -.39, .26, .06) * flank * (kind === 'neon' ? 1 - smooth(.45, .61, u) : 1) * .86); break;
    }
    case 'guppy': case 'endler': {
      const orange = oval(u, sine, .59, -.30, .12, .98, .22), green = oval(u, sine, .36, .18, .15, 1.05, .20);
      mix(out, [51, 100, 107], green * .65); mix(out, [187, 122, 52], orange * .82);
      mix(out, INK, oval(u, sine, .51, -.76, .060, .44, .12) * .82); break;
    }
    case 'molly': mix(out, [32, 39, 32], .51 * back + .18 * flank); break;
    case 'platy': case 'swordtail': mix(out, [182, 100, 51], .15 * flank); mix(out, [191, 151, 79], (1 - back) * .15); break;
    case 'paradise': case 'dwarfgourami': {
      const alternating = smooth(.14, .36, Math.sin(warped * Math.PI * (kind === 'paradise' ? 18 : 22)));
      mix(out, [165, 76, 51], alternating * flank ** .55 * .72);
      mix(out, [60, 114, 126], (1 - alternating) * flank ** .7 * .62); break;
    }
    case 'pearlgourami': {
      mix(out, PEARL, pearlDots(u, sine, 46, 16) * flank * .85);
      mix(out, INK, sideLine * .87); mix(out, [182, 117, 67], (1 - back) * .16); break;
    }
    case 'honeygourami': mix(out, [196, 152, 69], back * .17); mix(out, [70, 82, 66], head * (1 - smooth(-.1, .4, z)) * .68); break;
    case 'discus': {
      for (const x of [.16, .30, .44, .59, .72, .85]) mask = Math.max(mask, band(warped + sine * .006, x, .024, .020));
      mix(out, [69, 76, 58], mask * .35);
      const ribbon = Math.sin(u * 116 + sine * 35 + Math.sin(u * 17) * 4.2) * .5 + .5;
      mix(out, [81, 130, 121], smooth(.63, .90, ribbon) * flank * (1 - head * .55) * .53); break;
    }
    case 'oscar': {
      mix(out, [172, 94, 45], smooth(.54, .69, n + (m - .5) * .31) * flank ** .5 * .90);
      mix(out, [170, 119, 48], oval(u, sine, .12, .68, .060, .38, .05) * .81); break;
    }
    case 'ram': case 'bolivianram': {
      mix(out, INK, band(warped + z * .022, .85, .025, .014) * .91);
      mix(out, INK, oval(u, sine, .51, .68, .073, .50, .18) * .86);
      if (kind === 'ram') mix(out, [62, 127, 143], pearlDots(u, sine, 38, 16) * flank * .67);
      mix(out, [182, 106, 65], (1 - smooth(-.4, .1, z)) * .20); break;
    }
    case 'kribensis': mix(out, INK, sideLine * .85); mix(out, [154, 82, 107], (1 - smooth(-.63, -.06, z)) * .63); break;
    case 'convict': case 'severum': {
      for (let i = 0; i < 7; i++) mask = Math.max(mask, band(warped + z * .006, .17 + i * .11, kind === 'convict' ? .027 : .014, .015));
      mix(out, INK, mask * (kind === 'convict' ? .79 : .25)); break;
    }
    case 'jewel': mix(out, [181, 70, 53], flank * .19); mix(out, [80, 144, 147], pearlDots(u, sine, 33, 14) * flank * .88); mix(out, INK, oval(u, sine, .53, .55, .055, .31, .13) * .8); break;
    case 'electricyellow': mix(out, [191, 169, 68], back * .12); break;
    case 'tigerbarb': case 'clownloach': {
      const bars = kind === 'clownloach' ? [.24, .56, .85] : [.16, .43, .65, .86];
      for (const x of bars) mask = Math.max(mask, band(warped + z * .013, x, kind === 'clownloach' ? .043 : .032, .012));
      mix(out, [38, 45, 32], mask * .91); break;
    }
    case 'cherrybarb': mix(out, [149, 54, 40], flank * .28); mix(out, [50, 42, 34], sideLine * .83); break;
    case 'rosybarb': mix(out, [172, 114, 87], flank * .30); mix(out, INK, oval(u, sine, .14, .65, .044, .36, .18) * .88); break;
    case 'harlequin': {
      const t = clamp((u - .08) / .43), triangleWidth = .03 + t * .60;
      mix(out, [36, 42, 36], stripe(z, -.025, triangleWidth, .021) * flank * smooth(.08, .15, u) * (1 - smooth(.46, .54, u)) * .94); break;
    }
    case 'whitemountain': mix(out, [192, 176, 114], sideLine * .79); mix(out, [167, 71, 47], (1 - smooth(.09, .24, u)) * .36); break;
    case 'rummynose': mix(out, [163, 60, 43], head * .92); break;
    case 'ember': mix(out, [171, 98, 47], flank * .17); break;
    case 'blackneon': mix(out, [30, 39, 33], stripe(z, -.02, .11, .037) * flank * .88); mix(out, [188, 193, 149], stripe(z, .26, .066, .030) * flank * .79); break;
    case 'glowlight': mix(out, [186, 105, 65], stripe(z, .02, .075, .035) * flank * .89); break;
    case 'lemontetra': mix(out, [190, 181, 92], flank * .19); break;
    case 'congotetra': {
      mix(out, [162, 117, 65], stripe(z, .20, .20, .16) * .54);
      mix(out, [94, 133, 131], stripe(z, -.36, .23, .15) * flank * .44); break;
    }
    case 'silverhatchet': mix(out, SILVER, flank * .14); mix(out, [73, 89, 82], stripe(z, .22, .09, .09) * .31); break;
    case 'corydoras': {
      mix(out, [50, 62, 45], smooth(.59, .75, n * .7 + m * .3) * back * .8);
      mix(out, [72, 77, 59], smooth(.68, .82, m) * flank * .5); break;
    }
    case 'bristlenose': mix(out, [151, 149, 100], pearlDots(u, sine, 32, 14) * .63); break;
    case 'kuhliloach': {
      const wave = Math.sin(warped * Math.PI * 22 + sine * .26), rings = smooth(.05, .19, wave);
      mix(out, [47, 40, 25], rings * .91); break;
    }
    case 'dojo': mix(out, [62, 65, 44], smooth(.62, .81, m) * .38 * back); mix(out, [136, 134, 95], (1 - back) * .12); break;
    case 'pictus': {
      const spots = pearlDots(u, sine, 19, 8, .19, .29);
      mix(out, [41, 50, 46], spots * .85 * smooth(-.45, .15, z)); break;
    }
    case 'otocinclus': mix(out, [44, 57, 37], sideLine * .86); mix(out, [53, 66, 40], smooth(.64, .84, n) * back * .38); break;
    case 'arowana': mix(out, [179, 190, 170], back * .17); mix(out, [148, 157, 127], (1 - back) * .08); break;
    case 'boesemani': mix(out, [62, 106, 124], smooth(.45, .62, u) * .92); mix(out, [187, 126, 59], (1 - smooth(.43, .59, u)) * .93); break;
    case 'rainbowshark': mix(out, [44, 58, 52], back * .17); break;
    case 'balashark': mix(out, SILVER, flank * .15); break;
  }
}

function pearlDots(u: number, sine: number, columns: number, rows: number, inner = .085, outer = .20): number {
  const cell = Math.floor(u * columns), across = (sine + 1) * rows + cell % 2 * .5, row = Math.floor(across);
  let hash = Math.imul(cell + 13, 374761393) ^ Math.imul(row + 31, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
  const jitterX = (hash % 997 / 997 - .5) * .39, jitterY = ((hash >>> 11) % 991 / 991 - .5) * .35;
  const radius = .77 + ((hash >>> 21) / 2047) * .31;
  const x = (u * columns % 1) - .5 + jitterX, y = (across % 1) - .5 + jitterY;
  return (1 - smooth(inner * radius, outer * radius, Math.hypot(x, y))) * (.68 + (hash % 421 / 421) * .32);
}

function bakeCanvases(kind: FishKind, anatomy: FishAnatomy): SkinCanvases {
  const signature = `${kind}:${anatomy.base}:${anatomy.accent}:${anatomy.pattern}:${anatomy.seed}:${anatomy.scaleColumns}:${anatomy.scaleRows}:${anatomy.scales}:${anatomy.gillX}:${anatomy.profile.map(p => `${p[0]},${p[1]}`).join(';')}`;
  const cached = canvasCache.get(signature);
  if (cached) { canvasCache.delete(signature); canvasCache.set(signature, cached); return cached; }
  const canvases = Array.from({ length: 3 }, () => { const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT; return canvas; }) as SkinCanvases;
  const contexts = canvases.map(canvas => canvas.getContext('2d')!);
  const images = contexts.map(context => context.createImageData(WIDTH, HEIGHT));
  const heightImage = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const base = rgb(anatomy.base), accent = rgb(anatomy.accent), out: RGB = [0, 0, 0];
  const seed = anatomy.seed, first = anatomy.profile[0][0], last = anatomy.profile.at(-1)![0];
  const gillU = (anatomy.gillX - first) / (last - first);
  const columns = Math.max(22, anatomy.scaleColumns * 1.36), rows = Math.max(18, Math.round(anatomy.scaleRows * 1.35));
  for (let y = 0; y < HEIGHT - 1; y++) {
    const v = y / (HEIGHT - 1), angle = v * Math.PI * 2;
    const sine = kind === 'stingray' ? (v - .5) * 1.14 : Math.sin(angle), z = kind === 'stingray' ? 1 : Math.cos(angle), flank = Math.abs(sine);
    for (let x = 0; x < WIDTH; x++) {
      const u = x / (WIDTH - 1), at = (y * WIDTH + x) * 4;
      const broad = skinNoise(u * 8.3 + seed * .003, sine * 2.8 + z * 1.8, seed);
      const mid = skinNoise(u * 29.1 + seed * .01, sine * 9.7 + z * 6.3, seed + 47);
      const fine = skinNoise(u * 238.7, sine * 87.1 + z * 41.7, seed + 31) - .5;
      const back = smooth(-.45, .85, z), belly = 1 - smooth(-.8, -.17, z);
      for (let channel = 0; channel < 3; channel++) out[channel] = base[channel] * (1 - back * .055) + belly * [13, 14, 6][channel];
      pigment(kind, anatomy, u, sine, z, broad, mid, out, accent);
      // Countershading remains visible inside red/black pigment regions too.
      // This is biological dorsal/ventral color variation, not a baked lamp.
      if (kind !== 'stingray') for (let channel = 0; channel < 3; channel++) out[channel] *= 1 - smooth(.15, .92, z) * .086 + belly * .026;
      const head = smooth(gillU - .045, gillU + .13, u);
      const scaleStrength = anatomy.scales ? smooth(.035, .115, u) * (1 - head * .73) : 0;
      // Small overlapping ctenoid/cycloid relief. Scale edges are shallow and
      // inherit local pigment instead of black comic-book outlines.
      const rowCoord = v * rows + (mid - .5) * .13, rowId = Math.floor(rowCoord);
      const localV = rowCoord - rowId, localU = (u * columns + (rowId % 2 + 2) % 2 * .5 + Math.sin(u * 7.1) * .41) % 1;
      const scaleDistance = Math.hypot((localU - .5) / .53, (localV - .16) / 1.01);
      const rim = Math.exp(-(((scaleDistance - .88) / .053) ** 2));
      const scaleHighlight = Math.exp(-(((scaleDistance - .77) / .060) ** 2));
      const cellVariation = (((Math.floor(u * columns) * 71 + rowId * 13 + seed) % 97 + 97) % 97 / 97 - .5) * scaleStrength;
      const armor = kind === 'corydoras' || kind === 'bristlenose' || kind === 'otocinclus';
      const plateRow = Math.floor(v * 8), plateV = v * 8 - plateRow, plateU = (u * 20 + plateRow % 2 * .5) % 1;
      const plateDistance = Math.hypot((plateU - .5) / .56, (plateV - .12) / 1.02);
      const plate = armor ? Math.exp(-(((plateDistance - .88) / .065) ** 2)) * flank ** 2 * (1 - head * .85) : 0;
      const gill = kind === 'stingray' ? 0 : Math.exp(-(((u - gillU - (1 - z) * .007 - (mid - .5) * .0025) / .0041) ** 2)) * flank ** 3;
      const lateral = kind === 'stingray' ? 0 : Math.exp(-(((z - (.012 + Math.sin(u * 4.1) * .056)) / .033) ** 2)) * flank ** 4 * smooth(.07, .16, u) * (1 - smooth(gillU - .065, gillU, u));
      const organic = (broad - .5) * 12.1 + (mid - .5) * 6.2 + fine * 2.2;
      const reliefColor = (-rim * 12.8 + scaleHighlight * 5.8) * scaleStrength + cellVariation * 3.5 - gill * 10 - lateral * 2.2 - plate * 5;
      for (let channel = 0; channel < 3; channel++) images[0].data[at + channel] = clamp(out[channel] + organic + reliefColor, 15, 223);
      images[0].data[at + 3] = 255;
      const relief = 128 + (-rim * 8.2 + scaleHighlight * 3.1) * scaleStrength - gill * 7.5 - lateral * .9 - plate * 6.2 + fine * (anatomy.scales ? 1.45 : .60);
      heightImage[at] = heightImage[at + 1] = heightImage[at + 2] = relief; heightImage[at + 3] = 255;
      const roughness = (anatomy.scales ? 160 : kind === 'stingray' ? 174 : 143) + (broad - .5) * 11 + (mid - .5) * 6 + rim * scaleStrength * 7 + gill * 8 + plate * 6 - head * 4;
      images[2].data[at] = images[2].data[at + 1] = images[2].data[at + 2] = clamp(roughness, 120, 184); images[2].data[at + 3] = 255;
    }
  }
  // The UV-1 row is an exact duplicate, not a second noise evaluation.
  const finalRow = (HEIGHT - 1) * WIDTH * 4;
  for (const data of [images[0].data, images[2].data, heightImage]) data.set(data.subarray(0, WIDTH * 4), finalRow);
  heightFieldToNormal(heightImage, images[1].data, WIDTH, HEIGHT, 4.8);
  canvases.forEach((_, i) => contexts[i].putImageData(images[i], 0, 0));
  canvasCache.set(signature, canvases);
  if (canvasCache.size > CACHE_LIMIT) canvasCache.delete(canvasCache.keys().next().value!);
  return canvases;
}

/** Only immutable raster sources are shared. Each rig owns distinct GPU texture
 * objects and can dispose them without invalidating another fish's materials. */
export function createAnatomicalSkin(kind: FishKind, anatomy: FishAnatomy): AnatomicalSkin {
  const canvases = bakeCanvases(kind, anatomy);
  const textures = canvases.map(canvas => { const texture = new CanvasTexture(canvas); texture.wrapT = RepeatWrapping; texture.anisotropy = 4; return texture; });
  textures[0].colorSpace = SRGBColorSpace;
  return { color: textures[0], normal: textures[1], roughness: textures[2] };
}

export function getAnatomicalSkinCacheStats(): { entries: number; limit: number; rasterBytes: number; width: number; height: number } {
  return { entries: canvasCache.size, limit: CACHE_LIMIT, rasterBytes: canvasCache.size * WIDTH * HEIGHT * 4 * 3, width: WIDTH, height: HEIGHT };
}
