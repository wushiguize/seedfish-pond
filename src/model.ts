import { FISH_CATALOG, getFishDefinition, isFishKind, MAX_FISH, MAX_OWNED_FISH, POND_FISH_SCALE } from './fish-catalog';
import { getCollisionContact, isCollisionVolume, type CollisionVolume } from './collision';
import { FISH_PERSONALITIES, getFishPersonality, isFishPersonality, type FishPersonality } from './fish-personality';
import { advanceBehavior, behaviorSnapshot, createFishBehavior, getFishSwimProfile, type FishBehaviorEnvironment, type FishBehaviorRuntime, type FishBehaviorSnapshot } from './fish-behavior';

export const WORLD = { width: 2400, height: 1350, cx: 1200, cy: 690, rx: 1040, ry: 540 };
// Match the world-space nose position to the live 3D projection (384px / 2.7
// model units, nose x=.916). The hit test must follow the visible mouth.
export const FISH_SCALES=FISH_CATALOG.filter(fish=>fish.family==='koi').map(fish=>fish.size);
export type WeatherMode = 'sunny' | 'cloudy' | 'rain' | 'snow';
export type FishKind = 'kohaku' | 'showa' | 'yamabuki' | 'platinum' | 'tancho' | 'goldfish' | 'ryukin' | 'medaka' | 'zebrafish' | 'neon' | 'catfish'
  | 'guppy' | 'endler' | 'molly' | 'platy' | 'swordtail' | 'betta' | 'paradise' | 'pearlgourami' | 'dwarfgourami' | 'honeygourami'
  | 'angelfish' | 'discus' | 'oscar' | 'ram' | 'kribensis' | 'bolivianram' | 'convict' | 'jewel' | 'severum' | 'electricyellow'
  | 'tigerbarb' | 'cherrybarb' | 'rosybarb' | 'harlequin' | 'whitemountain' | 'cardinal' | 'rummynose' | 'ember' | 'blackneon' | 'glowlight' | 'lemontetra' | 'congotetra' | 'silverhatchet'
  | 'corydoras' | 'bristlenose' | 'clownloach' | 'kuhliloach' | 'dojo' | 'pictus' | 'otocinclus' | 'arowana' | 'stingray' | 'boesemani' | 'rainbowshark' | 'balashark';
export interface FishRecord { id: string; name: string; kind: FishKind; eaten: number; personality?: FishPersonality }
export type LightingMode = 'auto' | 'dawn' | 'day' | 'dusk' | 'night';
export interface City { name: string; region: string; latitude: number; longitude: number }
export interface WeatherReading { mode: WeatherMode; temperature: number; wind: number; time: string; fetchedAt: number; isDay: boolean; utcOffsetSeconds?: number; timeZone?: string; windDirection?:number; precipitation?:number; snowfall?:number }
export interface SaveData {
  version: 2; fish: FishRecord[]; reserve: FishRecord[]; weatherMode: WeatherMode; weatherAuto: boolean;
  city: City | null; reading: WeatherReading | null; lightingMode: LightingMode;
}
export const WEATHER_LABELS: Record<WeatherMode, string> = { sunny: '晴', cloudy: '阴', rain: '雨', snow: '雪' };
// Version-one saves contain these five exact identities. Keep their migration
// basis separate from the first-visit school as defaults evolve.
export const LEGACY_DEFAULT_FISH: readonly FishRecord[] = [
  { id: 'koi-1', name: '朱砂', kind: 'kohaku', eaten: 0 },
  { id: 'koi-2', name: '点墨', kind: 'showa', eaten: 0 },
  { id: 'koi-3', name: '山吹', kind: 'yamabuki', eaten: 0 },
  { id: 'koi-4', name: '月白', kind: 'platinum', eaten: 0 },
  { id: 'koi-5', name: '丹顶', kind: 'tancho', eaten: 0 },
];
export const DEFAULT_FISH: FishRecord[] = [
  { id: 'koi-1', name: '朱砂', kind: 'kohaku', eaten: 0 },
  { id: 'koi-2', name: '点墨', kind: 'showa', eaten: 0 },
  { id: 'koi-3', name: '山吹', kind: 'yamabuki', eaten: 0 },
  { id: 'koi-4', name: '霞光', kind: 'kohaku', eaten: 0 },
  { id: 'koi-5', name: '墨影', kind: 'showa', eaten: 0 },
  { id: 'school-goldfish-1', name: '小金', kind: 'goldfish', eaten: 0 },
  { id: 'school-goldfish-2', name: '橘子', kind: 'goldfish', eaten: 0 },
  { id: 'school-goldfish-3', name: '金豆', kind: 'goldfish', eaten: 0 },
  { id: 'school-ryukin-1', name: '圆圆', kind: 'ryukin', eaten: 0 },
  { id: 'school-ryukin-2', name: '团子', kind: 'ryukin', eaten: 0 },
  { id: 'school-medaka-1', name: '小青', kind: 'medaka', eaten: 0 },
  { id: 'school-medaka-2', name: '清露', kind: 'medaka', eaten: 0 },
  { id: 'school-medaka-3', name: '浮光', kind: 'medaka', eaten: 0 },
  { id: 'school-medaka-4', name: '浅浅', kind: 'medaka', eaten: 0 },
  { id: 'school-whitemountain-1', name: '白云', kind: 'whitemountain', eaten: 0 },
  { id: 'school-whitemountain-2', name: '银线', kind: 'whitemountain', eaten: 0 },
  { id: 'school-whitemountain-3', name: '星点', kind: 'whitemountain', eaten: 0 },
  { id: 'school-zebrafish-1', name: '小斑', kind: 'zebrafish', eaten: 0 },
  { id: 'school-zebrafish-2', name: '条纹', kind: 'zebrafish', eaten: 0 },
  { id: 'school-zebrafish-3', name: '追风', kind: 'zebrafish', eaten: 0 },
];
export const createSave = (): SaveData => ({ version: 2, fish: DEFAULT_FISH.map(f => ({ ...f })), reserve: [], weatherMode: 'sunny', weatherAuto: false, city: null, reading: null, lightingMode: 'auto' });

export function insidePond(x: number, y: number, margin = 1): boolean {
  return ((x - WORLD.cx) / (WORLD.rx * margin)) ** 2 + ((y - WORLD.cy) / (WORLD.ry * margin)) ** 2 < 1;
}
export function clampPond(x: number, y: number, margin = .94): { x: number; y: number } {
  const dx = (x - WORLD.cx) / (WORLD.rx * margin), dy = (y - WORLD.cy) / (WORLD.ry * margin);
  const radius = Math.hypot(dx, dy);
  if (radius <= 1) return { x, y };
  return { x: WORLD.cx + dx / radius * WORLD.rx * margin, y: WORLD.cy + dy / radius * WORLD.ry * margin };
}

export function validateSave(value: unknown): SaveData {
  if (!value || typeof value !== 'object') throw new Error('存档格式不正确');
  const v = value as Record<string, unknown>;
  if ((v.version !== 1 && v.version !== 2) || !Array.isArray(v.fish)) throw new Error('存档格式不正确');
  const lightingMode = v.lightingMode === undefined ? 'auto' : v.lightingMode;
  if (!['auto', 'dawn', 'day', 'dusk', 'night'].includes(lightingMode as string)) throw new Error('光照设置不正确');
  let fish: FishRecord[], reserve: FishRecord[] = [];
  if (v.version === 1) {
    if (v.fish.length !== LEGACY_DEFAULT_FISH.length) throw new Error('存档格式不正确');
    const legacyFish = v.fish.map(validateFishRecord);
    fish = LEGACY_DEFAULT_FISH.map(base => {
      const found = legacyFish.find(f => f.id === base.id);
      if (!found || found.kind !== base.kind) throw new Error('锦鲤数据不正确');
      return found;
    });
  } else {
    if (!Array.isArray(v.reserve) || v.fish.length > MAX_FISH || v.reserve.length > MAX_OWNED_FISH || v.fish.length + v.reserve.length > MAX_OWNED_FISH) throw new Error('鱼的数量超出存档限制');
    fish = v.fish.map(validateFishRecord);
    reserve = v.reserve.map(validateFishRecord);
  }
  const ownedFish = [...fish, ...reserve];
  if (new Set(ownedFish.map(f => f.id)).size !== ownedFish.length || typeof v.weatherMode !== 'string' || !Object.hasOwn(WEATHER_LABELS, v.weatherMode)) throw new Error('存档数据不正确');
  let city: City | null = null;
  if (v.city) {
    const c = v.city as City;
    if (typeof c.name !== 'string' || c.name.length > 100 || typeof c.region !== 'string' || c.region.length > 150 || !Number.isFinite(c.latitude) || Math.abs(c.latitude) > 90 || !Number.isFinite(c.longitude) || Math.abs(c.longitude) > 180) throw new Error('城市数据不正确');
    city = { name: c.name, region: c.region, latitude: c.latitude, longitude: c.longitude };
  }
  let reading: WeatherReading | null = null;
  const r = v.reading as WeatherReading | undefined;
  if (r && Object.hasOwn(WEATHER_LABELS, r.mode) && Number.isFinite(r.temperature) && Number.isFinite(r.wind) && typeof r.time === 'string' && r.time.length < 50 && Number.isFinite(r.fetchedAt) && typeof r.isDay === 'boolean') {
    reading = { mode: r.mode, temperature: r.temperature, wind: r.wind, time: r.time, fetchedAt: r.fetchedAt, isDay: r.isDay };
    for (const key of ['windDirection','precipitation','snowfall'] as const) {
      const value = r[key];
      if (value !== undefined) {
        if (!Number.isFinite(value) || value < 0 || value > (key === 'windDirection' ? 360 : 1000)) throw new Error('天气细节数据不正确');
        reading[key] = value;
      }
    }
    if (r.utcOffsetSeconds !== undefined) {
      if (!Number.isInteger(r.utcOffsetSeconds) || r.utcOffsetSeconds < -43200 || r.utcOffsetSeconds > 50400) throw new Error('城市时区数据不正确');
      reading.utcOffsetSeconds = r.utcOffsetSeconds;
    }
    if (r.timeZone !== undefined) {
      if (typeof r.timeZone !== 'string' || !r.timeZone.trim() || r.timeZone.length > 100) throw new Error('城市时区数据不正确');
      reading.timeZone = r.timeZone;
    }
  }
  return { version: 2, fish, reserve, weatherMode: v.weatherMode as WeatherMode, weatherAuto: Boolean(v.weatherAuto && city), city, reading, lightingMode: lightingMode as LightingMode };
}

function validateFishRecord(value: unknown): FishRecord {
  if (!value || typeof value !== 'object') throw new Error('鱼的数据不正确');
  const fish = value as FishRecord;
  if (typeof fish.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(fish.id) || !isFishKind(fish.kind) || typeof fish.name !== 'string' || !fish.name.trim() || [...fish.name.trim()].length > 12 || !Number.isSafeInteger(fish.eaten) || fish.eaten < 0) throw new Error('鱼的数据不正确');
  if (fish.personality !== undefined && !isFishPersonality(fish.personality)) throw new Error('鱼的性格设置不正确');
  return { id: fish.id, name: fish.name.trim(), kind: fish.kind, eaten: fish.eaten, ...(fish.personality !== undefined ? { personality: fish.personality } : {}) };
}

export interface Pellet { id: number; x: number; y: number; age: number }
export interface FishBody {
  record: FishRecord; x: number; y: number; angle: number; speed: number; phase: number;
  goalX: number; goalY: number; goalAge: number; turnVelocity: number; tailPhase: number;
  cruise: number; feeding: boolean; lastEatenAt: number; mouthOffset: number;
  depth: number; baseDepth: number; depthPhase: number; bodyDepthRadius: number;
  collisionHalfLength: number; collisionRadius: number; collisionCenterOffset: number;
}

// The same 384px / 2.7 model-unit projection used by the live fish atlas. The
// capsule encloses the body, moving fins and tail; small species stay small.
const MODEL_WORLD_SCALE = 384 / 2.7;
function fishDimensions(kind: FishKind): Pick<FishBody, 'collisionHalfLength' | 'collisionRadius' | 'bodyDepthRadius' | 'collisionCenterOffset'> {
  const definition=getFishDefinition(kind),shape=definition.volume;
  const scale=definition.size*MODEL_WORLD_SCALE,clearance=shape.clearance*POND_FISH_SCALE;
  return {collisionHalfLength:shape.length*scale+clearance,collisionRadius:shape.width*scale+clearance,bodyDepthRadius:shape.height*scale+clearance,collisionCenterOffset:shape.offset*scale};
}
export function getFishCollisionVolume(fish: FishBody): CollisionVolume {
  return { id: fish.record.id, x: fish.x + Math.cos(fish.angle) * fish.collisionCenterOffset, y: fish.y + Math.sin(fish.angle) * fish.collisionCenterOffset, angle: fish.angle, depth: fish.depth, halfLength: fish.collisionHalfLength, radius: fish.collisionRadius, halfHeight: fish.bodyDepthRadius };
}
function identityHash(record: FishRecord): number {
  let hash = 0x811c9dc5;
  for (const char of `${record.id}:${record.kind}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash / 0x100000000;
}
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const CAPSULE_DIRECTIONS = Array.from({ length: 8 }, (_, index) => ({ x: Math.cos(index * Math.PI / 4), y: Math.sin(index * Math.PI / 4) }));
export class PondSimulation {
  fish: FishBody[];
  food: Pellet[] = [];
  time = 0;
  private foodId = 0;
  private obstacles: CollisionVolume[] = [];
  private behaviors=new Map<string,FishBehaviorRuntime>();
  private environment:FishBehaviorEnvironment={season:'spring',weather:'sunny',rainIntensity:0,daylight:1};
  private rainShelterUntil=0;
  onEat?: (fish: FishRecord) => void;
  constructor(records: FishRecord[], private random: () => number = Math.random) {
    this.fish = [];
    this.reconcileFish(records);
  }
  reconcileFish(records: FishRecord[]): void {
    const existing = new Map(this.fish.map(fish => [fish.record.id, fish]));
    // Occupied locations include retained fish even if the new record order changes.
    const retained = records.flatMap(record => existing.has(record.id) ? [existing.get(record.id)!] : []);
    const occupied = [...retained];
    this.fish = records.map((record, i) => {
      const definition = getFishDefinition(record.kind);
      const body = existing.get(record.id);
      if (body) {
        const changedKind=body.record.kind!==record.kind;
        body.record = record;
        const profile=getFishSwimProfile(record.kind);
        body.cruise = definition.speed * FISH_PERSONALITIES[getFishPersonality(record)].cruiseMultiplier*profile.cruise;
        body.mouthOffset = definition.mouthOffset;
        Object.assign(body, fishDimensions(record.kind));
        if(changedKind){body.baseDepth=profile.depth+identityHash(record)*profile.depthSpread;body.goalAge=Math.min(body.goalAge,1);this.behaviors.set(record.id,createFishBehavior(record,identityHash(record),body.x,body.y));}
        return body;
      }
      const created = this.createFishBody(record, i, records.length, occupied);
      occupied.push(created);
      return created;
    });
    const ids=new Set(records.map(record=>record.id));
    for(const id of this.behaviors.keys())if(!ids.has(id))this.behaviors.delete(id);
    for(const body of this.fish)if(!this.behaviors.has(body.record.id))this.behaviors.set(body.record.id,createFishBehavior(body.record,identityHash(body.record),body.x,body.y));
  }
  private createFishBody(record: FishRecord, index: number, count: number, occupied: FishBody[]): FishBody {
    const definition = getFishDefinition(record.kind);
    const spawnRadiusX = WORLD.rx * .53, spawnRadiusY = WORLD.ry * .42;
    let a = index / Math.max(1, count) * Math.PI * 2;
    if (occupied.length) {
      let greatestDistance = -1;
      const startingAngle = a;
      for (let candidate = 0; candidate < 24; candidate++) {
        const angle = startingAngle + candidate / 24 * Math.PI * 2;
        const x = WORLD.cx + Math.cos(angle) * spawnRadiusX, y = WORLD.cy + Math.sin(angle) * spawnRadiusY;
        const distance = Math.min(...occupied.map(fish => ((fish.x - x) / WORLD.rx) ** 2 + ((fish.y - y) / WORLD.ry) ** 2));
        if (distance > greatestDistance) { greatestDistance = distance; a = angle; }
      }
    }
    const phase = index * 1.8, hash = identityHash(record);
    const profile=getFishSwimProfile(record.kind),baseDepth=profile.depth+hash*profile.depthSpread;
    const cruise = definition.speed * FISH_PERSONALITIES[getFishPersonality(record)].cruiseMultiplier*profile.cruise;
    return { record, x: WORLD.cx + Math.cos(a) * spawnRadiusX, y: WORLD.cy + Math.sin(a) * spawnRadiusY, angle: a + Math.PI / 2, speed: cruise * .85, phase, goalX: WORLD.cx + Math.cos(a + .9) * WORLD.rx * .61, goalY: WORLD.cy + Math.sin(a + .9) * WORLD.ry * .57, goalAge: 4 + index % 5, turnVelocity: 0, tailPhase: phase, cruise, feeding: false, lastEatenAt: -10, mouthOffset: definition.mouthOffset, depth: baseDepth, baseDepth, depthPhase: hash * Math.PI * 2, ...fishDimensions(record.kind) };
  }
  setObstacles(obstacles: CollisionVolume[]): void {
    this.obstacles = obstacles.filter(isCollisionVolume).map(obstacle => ({ ...obstacle }));
  }
  setEnvironment(value:Partial<FishBehaviorEnvironment>):void {
    const previous=this.environment,next={...previous};
    if(value.season&&['spring','summer','autumn','winter'].includes(value.season))next.season=value.season;
    if(value.weather&&Object.hasOwn(WEATHER_LABELS,value.weather))next.weather=value.weather;
    if(Number.isFinite(value.rainIntensity))next.rainIntensity=Math.max(0,Math.min(1,value.rainIntensity!));
    else if(value.weather==='rain'&&previous.weather!=='rain')next.rainIntensity=1;
    if(Number.isFinite(value.daylight))next.daylight=Math.max(0,Math.min(1,value.daylight!));
    if(next.weather!=='rain')next.rainIntensity=0;
    if(next.weather==='rain'&&next.rainIntensity>.28&&(previous.weather!=='rain'||previous.rainIntensity<=.28))this.rainShelterUntil=this.time+9;
    this.environment=next;
  }
  interactWater(x:number,y:number,strength=1):void {
    if(![x,y,strength].every(Number.isFinite)||strength<=0||!insidePond(x,y,.97))return;
    strength=Math.min(1,strength);
    for(const body of this.fish){
      const reach=(330+strength*110)*(body.baseDepth>.7?.75:1);
      if(Math.hypot(body.x-x,body.y-y)>reach)continue;
      const runtime=this.behaviors.get(body.record.id)!;
      runtime.water={x,y,strength,startedAt:runtime.water&&runtime.water.expiresAt>this.time?runtime.water.startedAt:this.time,expiresAt:this.time+7};
    }
  }
  getBehaviorSnapshot(id:string):FishBehaviorSnapshot|null {
    const body=this.fish.find(fish=>fish.record.id===id),runtime=this.behaviors.get(id);
    return body&&runtime?behaviorSnapshot(body.record,runtime,getFishSwimProfile(body.record.kind)):null;
  }
  addFood(x: number, y: number, amount = 6): boolean {
    if (!insidePond(x, y, .96) || this.food.length >= 90) return false;
    const count=Math.min(Math.max(0,Math.floor(amount)),90-this.food.length);
    for (let i = 0; i < count; i++) {
      const p = clampPond(x + (this.random() - .5) * 45, y + (this.random() - .5) * 45);
      this.food.push({ id: this.foodId++, ...p, age: 0 });
    }
    return true;
  }
  update(elapsed: number): void {
    if(!Number.isFinite(elapsed)||elapsed<=0)return;
    // Substeps keep turning and mouth hit tests reliable on a slow machine.
    let remaining = Math.max(0, Math.min(elapsed, .25));
    while (remaining > 0) { const dt = Math.min(remaining, 1 / 60); this.step(dt); remaining -= dt; }
  }
  private step(dt: number): void {
    this.time += dt;
    for (const pellet of this.food) pellet.age += dt;
    this.food = this.food.filter(p => p.age < 40);
    // Read a common pre-move snapshot, so one fish's steering does not depend on
    // whether a neighbour happened to be integrated earlier in this substep.
    const predicted = this.fish.map(fish => {
      const volume = getFishCollisionVolume(fish), lookAhead = .4;
      return { ...volume, x: volume.x + Math.cos(fish.angle) * fish.speed * lookAhead, y: volume.y + Math.sin(fish.angle) * fish.speed * lookAhead, halfLength: volume.halfLength + 9, radius: volume.radius + 9 };
    });
    const avoidanceVolumes = [...predicted, ...this.obstacles];
    const neighbours=this.fish.map(fish=>({id:fish.record.id,kind:fish.record.kind,x:fish.x,y:fish.y,angle:fish.angle,depth:fish.depth}));
    for (const [index, fish] of this.fish.entries()) {
      const style=getFishPersonality(fish.record),personality=FISH_PERSONALITIES[style],profile=getFishSwimProfile(fish.record.kind),runtime=this.behaviors.get(fish.record.id)!;
      fish.cruise = getFishDefinition(fish.record.kind).speed * personality.cruiseMultiplier*profile.cruise;
      let activity=advanceBehavior(runtime,style,dt),context='';
      const winter=this.environment.season==='winter',night=this.environment.daylight<.2;
      const daytimePause=profile.nocturnal&&!night&&activity==='patrol'&&runtime.remaining<3;
      if(daytimePause||(night&&!profile.nocturnal)){activity='rest';context=night?'夜间安静休息':'白天贴底停驻';}
      const winterFactor=winter?.44:1,dayFactor=night?(profile.nocturnal?1.18:.48):(profile.nocturnal?.78:1);
      if(winter)context='冬季减缓游动';
      fish.goalAge -= dt;
      let target: Pellet | undefined;
      let nearest = Infinity;
      for (const p of this.food) { const d = (p.x - fish.x) ** 2 + (p.y - fish.y) ** 2; if (d < nearest) { nearest = d; target = p; } }
      if(target){
        runtime.foodSince??=this.time;
        const delay=style==='calm'?1.65:style==='curious'?.48:0,betweenBites=style==='calm'?.65:style==='curious'?.25:.07;
        if(this.time-runtime.foodSince<delay-1e-9||this.time-fish.lastEatenAt<betweenBites){target=undefined;activity='watchFood';context='先观察一下饲料';}
        else{activity='feeding';context=style==='bold'?'先游过来取食':'发现了饲料';}
      }else runtime.foodSince=null;
      let responseX:number|undefined,responseY:number|undefined;
      if(runtime.water&&runtime.water.expiresAt<=this.time)runtime.water=null;
      if(runtime.water&&!target){
        const water=runtime.water,elapsed=this.time-water.startedAt;
        if(style==='calm'&&elapsed<3.8){
          let vx=fish.x-water.x,vy=fish.y-water.y;const distance=Math.hypot(vx,vy);
          if(distance<1){vx=-Math.cos(fish.angle);vy=-Math.sin(fish.angle);}else{vx/=distance;vy/=distance;}
          const retreat=clampPond(fish.x+vx*160,fish.y+vy*160,.78);responseX=retreat.x;responseY=retreat.y;activity='retreat';context='给波纹让开一点';
        }else if(style==='calm'){activity='rest';context='稍停看看波纹';}
        else if(style==='bold'||elapsed>.45){
          const waterPoint=clampPond(water.x,water.y,.79);responseX=waterPoint.x;responseY=waterPoint.y;activity='approach';context=style==='bold'?'马上过去看看':'绕近一点查看波纹';
        }
      }
      const rainAvoiding=this.time<this.rainShelterUntil&&this.environment.weather==='rain'&&fish.baseDepth<.56&&!target&&!runtime.water;
      if(rainAvoiding){activity='shelter';context='暂时避开水面雨波';}
      if (!target&&responseX===undefined&&(fish.goalAge <= 0 || Math.hypot(fish.goalX-fish.x,fish.goalY-fish.y)<45)) {
        const angle=this.random()*Math.PI*2;
        let point:{x:number;y:number};
        if(getFishDefinition(fish.record.kind).morphology==='carp'&&activity==='patrol'){
          const radius=.40+this.random()*.29;point={x:WORLD.cx+Math.cos(angle)*WORLD.rx*radius,y:WORLD.cy+Math.sin(angle)*WORLD.ry*radius};
        }else{
          const radius=profile.patrolRadius*(activity==='explore'?1.35:.85)*personality.patrolMultiplier*(.55+this.random()*.45);
          point={x:runtime.homeX+Math.cos(angle)*radius,y:runtime.homeY+Math.sin(angle)*radius*.72};
        }
        point=clampPond(point.x,point.y,.78);fish.goalX=point.x;fish.goalY=point.y;
        fish.goalAge=activity==='explore'?3.5+this.random()*2.5:7+this.random()*6;
      }
      const tx = target?.x ?? responseX ?? fish.goalX, ty = target?.y ?? responseY ?? fish.goalY;
      let dx = tx - fish.x, dy = ty - fish.y;
      if(profile.schooling&&!target&&responseX===undefined&&(activity==='patrol'||activity==='explore')){
        const peers=neighbours.filter(other=>other.id!==fish.record.id&&other.kind===fish.record.kind&&Math.abs(other.depth-fish.depth)<.22&&Math.hypot(other.x-fish.x,other.y-fish.y)<650);
        if(peers.length){
          const cohesion=style==='curious'?.92:style==='calm'?.72:.60;
          let centerX=0,centerY=0,alignX=0,alignY=0;
          for(const other of peers){centerX+=other.x;centerY+=other.y;alignX+=Math.cos(other.angle);alignY+=Math.sin(other.angle);}
          dx=dx*.30+(centerX/peers.length-fish.x)*cohesion+alignX/peers.length*100;
          dy=dy*.30+(centerY/peers.length-fish.y)*cohesion+alignY/peers.length*100;
          activity='shoal';context='和同种伙伴一起游';
        }
      }
      let desiredDepth=fish.baseDepth+Math.sin(this.time*.18+fish.depthPhase)*.018;
      if(winter)desiredDepth+=Math.min(.14,(.94-fish.baseDepth)*.6);
      if(rainAvoiding)desiredDepth+=.22*this.environment.rainIntensity;
      if(target&&!profile.nocturnal&&getFishDefinition(fish.record.kind).morphology!=='ray')desiredDepth-=.15;
      fish.depth+=(Math.max(.06,Math.min(.94,desiredDepth))-fish.depth)*Math.min(1,dt*(target?.65:.45));
      fish.depth=Math.max(.04,Math.min(.96,fish.depth));
      runtime.activity=activity;runtime.context=context;
      fish.feeding=Boolean(target);
      const own = predicted[index];
      for (const [otherIndex, other] of avoidanceVolumes.entries()) {
        if (otherIndex === index) continue;
        const contact = getCollisionContact(own, other);
        if (contact) {
          const weight = (target ? 1.5 : 2.4) * personality.separationMultiplier;
          dx += contact.nx * (contact.penetration + 12) * weight;
          dy += contact.ny * (contact.penetration + 12) * weight;
        }
      }
      const desiredAngle = Math.atan2(dy, dx)+(target?0:Math.sin(this.time*.43+fish.phase)*(activity==='rest'?.035:.12));
      const turn = wrapAngle(desiredAngle - fish.angle), turnRate = (target ? 2.8 : activity==='retreat'?3.6:activity==='approach'?3.0:activity==='rest'?.27:activity==='explore'?1.7:1.15) * personality.turnMultiplier*profile.turn;
      const steering=Math.max(-turnRate,Math.min(turnRate,turn*(target?4:1.8)));
      fish.turnVelocity+=(steering-fish.turnVelocity)*Math.min(1,dt*(target?6:2.8));
      fish.angle+=fish.turnVelocity*dt;
      const distance = Math.hypot(tx - fish.x, ty - fish.y);
      const glide=.84+.14*Math.sin(this.time*.5+fish.phase);
      const activityFactor=activity==='burst'?2.4:activity==='explore'?1.15:activity==='approach'?(style==='bold'?2.1:1.25):activity==='retreat'?1.16:activity==='watchFood'?.24:activity==='shelter'?.65:style==='calm'?.67:style==='bold'?1.13:1;
      const movementSpeed=fish.cruise*activityFactor*glide*winterFactor*dayFactor;
      const desiredSpeed=target?Math.min(112*personality.feedingMultiplier*profile.feedingSpeed*(style==='calm'?.76:style==='curious'?.91:1),Math.max(12,distance*1.1))*Math.max(.60,winterFactor*dayFactor):activity==='rest'?.8:activity==='approach'?Math.min(movementSpeed,Math.max(3,distance*.7)):movementSpeed;
      fish.speed+=(desiredSpeed-fish.speed)*Math.min(1,dt*(activity==='burst'||activity==='approach'?3.6:2.4));
      fish.tailPhase+=dt*(2.1+fish.speed*.047)*profile.cadence*(activity==='rest'?.18:1);
      fish.x += Math.cos(fish.angle) * fish.speed * dt;
      fish.y += Math.sin(fish.angle) * fish.speed * dt;
      if (!insidePond(fish.x, fish.y, .86)) {
        const constrained = clampPond(fish.x, fish.y, .855); fish.x = constrained.x; fish.y = constrained.y;
        fish.goalX = WORLD.cx; fish.goalY = WORLD.cy; fish.goalAge = 2;
        // The nearest-food goal cannot pull a fish out of the water.
        const inward = Math.atan2(WORLD.cy - fish.y, WORLD.cx - fish.x);
        fish.angle += wrapAngle(inward - fish.angle) * Math.min(1, dt * 4);
      }
      this.constrainFish(fish);
    }
    this.resolveCollisions();
    // Test the final, visible mouth after all volume and shoreline corrections.
    // Removing a pellet here means the following fish can never eat it again.
    for (const fish of this.fish) {
      for (let i = this.food.length - 1; i >= 0; i--) {
        const p = this.food[i];
        const mouthX = fish.x + Math.cos(fish.angle) * fish.mouthOffset, mouthY = fish.y + Math.sin(fish.angle) * fish.mouthOffset;
        if (Math.hypot(p.x - mouthX, p.y - mouthY) < 19) {
          this.food.splice(i, 1); fish.record.eaten=Math.min(Number.MAX_SAFE_INTEGER,fish.record.eaten+1);fish.lastEatenAt=this.time; this.onEat?.(fish.record);
        }
      }
    }
  }
  private constrainFish(fish: FishBody): void {
    const center = clampPond(fish.x, fish.y, .855);
    fish.x = center.x; fish.y = center.y;
    const initialVolume = getFishCollisionVolume(fish), segment = Math.max(0, initialVolume.halfLength - initialVolume.radius);
    const segmentX = Math.cos(fish.angle) * segment, segmentY = Math.sin(fish.angle) * segment;
    const capMargin = initialVolume.radius / (WORLD.ry * .94);
    const capA = Math.hypot((initialVolume.x + segmentX - WORLD.cx) / (WORLD.rx * .94), (initialVolume.y + segmentY - WORLD.cy) / (WORLD.ry * .94));
    const capB = Math.hypot((initialVolume.x - segmentX - WORLD.cx) / (WORLD.rx * .94), (initialVolume.y - segmentY - WORLD.cy) / (WORLD.ry * .94));
    if (Math.max(capA, capB) + capMargin < 1) return;
    // Constrain the volume, rather than just the root, near the curved shore.
    // Samples include each capsule cap's extremities in pond XY directions.
    for (let pass = 0; pass < 2; pass++) {
      const volume = getFishCollisionVolume(fish);
      for (const side of [-1, 1]) for (const direction of CAPSULE_DIRECTIONS) {
        const x = volume.x + segmentX * side + direction.x * volume.radius;
        const y = volume.y + segmentY * side + direction.y * volume.radius;
        const constrained = clampPond(x, y, .94);
        fish.x += constrained.x - x; fish.y += constrained.y - y;
      }
    }
  }
  private resolveCollisions(): void {
    // Stable ordering also makes a perfectly piled-up import deterministic.
    const ordered = [...this.fish].sort((a, b) => a.record.id.localeCompare(b.record.id));
    const volumes = ordered.map(getFishCollisionVolume);
    const moved = ordered.map(() => false);
    let converged = false;
    // A perfectly parallel pile forms a long contact chain. It needs more
    // convergence passes than a normal moving school, which exits early.
    for (let pass = 0; pass < 512; pass++) {
      let penetration = 0;
      moved.fill(false);
      for (let i = 0; i < ordered.length; i++) {
        const fish = ordered[i];
        for (let j = i + 1; j < ordered.length; j++) {
          const contact = getCollisionContact(volumes[i], volumes[j]);
          if (!contact) continue;
          penetration = Math.max(penetration, contact.penetration);
          const distance = contact.penetration * .53 + .004;
          fish.x += contact.nx * distance; fish.y += contact.ny * distance;
          ordered[j].x -= contact.nx * distance; ordered[j].y -= contact.ny * distance;
          moved[i] = moved[j] = true;
          if (pass === 0) {
            this.slowApproachingFish(fish, contact.nx, contact.ny);
            this.slowApproachingFish(ordered[j], -contact.nx, -contact.ny);
          }
          volumes[i] = getFishCollisionVolume(fish); volumes[j] = getFishCollisionVolume(ordered[j]);
        }
        for (const obstacle of this.obstacles) {
          const contact = getCollisionContact(volumes[i], obstacle);
          if (!contact) continue;
          penetration = Math.max(penetration, contact.penetration);
          fish.x += contact.nx * (contact.penetration + .002); fish.y += contact.ny * (contact.penetration + .002);
          moved[i] = true;
          if (pass === 0) this.slowApproachingFish(fish, contact.nx, contact.ny);
          volumes[i] = getFishCollisionVolume(fish);
        }
      }
      let boundaryShift = 0;
      for (let index = 0; index < ordered.length; index++) {
        if (!moved[index]) continue;
        const fish = ordered[index], x = fish.x, y = fish.y;
        this.constrainFish(fish);
        boundaryShift = Math.max(boundaryShift, Math.hypot(fish.x - x, fish.y - y));
        volumes[index] = getFishCollisionVolume(fish);
      }
      if (penetration < .008 && boundaryShift < .004) { converged = true; break; }
    }
    if (!converged) this.recoverCrowdedVolumes(ordered);
  }
  private recoverCrowdedVolumes(ordered: FishBody[]): void {
    const overlaps = (fish: FishBody, tolerance: number) => {
      const volume = getFishCollisionVolume(fish);
      return ordered.some(other => other !== fish && (getCollisionContact(volume, getFishCollisionVolume(other))?.penetration ?? 0) > tolerance)
        || this.obstacles.some(obstacle => (getCollisionContact(volume, obstacle)?.penetration ?? 0) > tolerance);
    };
    for (const fish of ordered) {
      if (!overlaps(fish, .015)) continue;
      // An invalid initial pile of large parallel bodies can settle into a
      // straight chain longer than the water allows. Its nearest clear XY pose
      // is preferable to changing depth or leaving visible interpenetration.
      // Ordinary contacts converge above and never enter this recovery path.
      const startX = fish.x, startY = fish.y, angleOffset = identityHash(fish.record) * Math.PI * 2;
      let found = false;
      for (let radius = 8; radius < WORLD.rx * 2 && !found; radius += 8) {
        for (let sample = 0; sample < 32; sample++) {
          const angle = angleOffset + sample * Math.PI / 16;
          const x = startX + Math.cos(angle) * radius, y = startY + Math.sin(angle) * radius;
          if (!insidePond(x, y, .855)) continue;
          fish.x = x; fish.y = y; this.constrainFish(fish);
          if (!overlaps(fish, 0)) { found = true; break; }
        }
      }
      if (!found) { fish.x = startX; fish.y = startY; }
    }
  }
  private slowApproachingFish(fish: FishBody, nx: number, ny: number): void {
    const approach = Math.cos(fish.angle) * nx + Math.sin(fish.angle) * ny;
    if (approach < 0) fish.speed *= 1 + approach * .85;
  }
}
