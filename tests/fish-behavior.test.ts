import { describe, expect, it } from 'vitest';
import { FISH_CATALOG } from '../src/fish-catalog';
import { getFishSwimProfile } from '../src/fish-behavior';
import { getCollisionContact } from '../src/collision';
import { getFishCollisionVolume, insidePond, PondSimulation, validateSave, createSave, WORLD, type FishKind, type FishRecord } from '../src/model';
import type { FishPersonality } from '../src/fish-personality';

function seededRandom(seed=71){let state=seed;return()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};}
function single(kind:FishKind='showa',personality:FishPersonality='calm'){
  const simulation=new PondSimulation([{id:'visible-style',name:'原来的名字',kind,eaten:27,personality}],seededRandom());
  const body=simulation.fish[0];body.x=WORLD.cx;body.y=WORLD.cy;body.angle=0;body.speed=0;body.goalX=WORLD.cx+450;body.goalY=WORLD.cy;body.goalAge=20;body.phase=0;
  return simulation;
}
function run(simulation:PondSimulation,seconds:number){for(let step=0;step<Math.round(seconds*60);step++)simulation.update(1/60);}
function travel(simulation:PondSimulation,seconds:number){let distance=0;for(let i=0;i<seconds*60;i++){const body=simulation.fish[0],x=body.x,y=body.y;simulation.update(1/60);distance+=Math.hypot(body.x-x,body.y-y);}return distance;}

describe('visible species and individual behavior',()=>{
  it('gives every catalog choice a finite motion profile without replacing its real collision volume',()=>{
    for(const definition of FISH_CATALOG){
      const profile=getFishSwimProfile(definition.kind);
      expect(profile.habit.length).toBeGreaterThan(3);
      for(const field of ['cruise','turn','cadence','patrolRadius','depth','depthSpread','feedingSpeed'] as const)expect(Number.isFinite(profile[field])).toBe(true);
      const simulation=single(definition.kind,'curious');simulation.update(.25);
      const body=simulation.fish[0],volume=getFishCollisionVolume(body);
      expect([body.x,body.y,body.angle,body.tailPhase,volume.halfLength,volume.radius,volume.halfHeight].every(Number.isFinite)).toBe(true);
      expect(volume.radius).toBeGreaterThan(0);expect(body.record.kind).toBe(definition.kind);
    }
  });
  it('makes calm visibly stop while bold repeatedly accelerates instead of only changing a fixed speed multiplier',()=>{
    const calm=single('showa','calm'),bold=single('showa','bold'),curious=single('showa','curious');
    let calmSlowSeconds=0,calmMax=0,boldMax=0,boldFastSeconds=0;
    const boldActivities=new Set(),curiousActivities=new Set();
    for(let frame=0;frame<1800;frame++){
      calm.update(1/60);bold.update(1/60);curious.update(1/60);
      if(calm.fish[0].speed<3)calmSlowSeconds+=1/60;
      if(bold.fish[0].speed>50)boldFastSeconds+=1/60;
      calmMax=Math.max(calmMax,calm.fish[0].speed);boldMax=Math.max(boldMax,bold.fish[0].speed);
      boldActivities.add(bold.getBehaviorSnapshot('visible-style')!.activity);curiousActivities.add(curious.getBehaviorSnapshot('visible-style')!.activity);
    }
    expect(calmSlowSeconds).toBeGreaterThan(6);expect(boldFastSeconds).toBeGreaterThan(2);
    expect(boldMax).toBeGreaterThan(calmMax*3);expect(boldActivities.has('burst')).toBe(true);expect(boldActivities.has('patrol')).toBe(true);expect(curiousActivities.has('explore')).toBe(true);
  });
  it('responds to the same water gesture with an actual retreat, delayed look and fast approach',()=>{
    const calm=single('showa','calm'),curious=single('showa','curious'),bold=single('showa','bold'),point={x:WORLD.cx+120,y:WORLD.cy};
    for(const simulation of [calm,curious,bold])simulation.interactWater(point.x,point.y,1);
    for(const simulation of [calm,curious,bold])simulation.update(.25);
    expect(calm.getBehaviorSnapshot('visible-style')!.activity).toBe('retreat');expect(bold.getBehaviorSnapshot('visible-style')!.activity).toBe('approach');
    expect(curious.getBehaviorSnapshot('visible-style')!.activity).not.toBe('approach');
    for(const simulation of [calm,curious,bold])run(simulation,3.5);
    const distance=(simulation:PondSimulation)=>Math.hypot(simulation.fish[0].x-point.x,simulation.fish[0].y-point.y);
    expect(distance(calm)).toBeGreaterThan(130);expect(distance(bold)).toBeLessThan(65);expect(distance(curious)).toBeLessThan(110);
    expect(distance(bold)).toBeLessThan(distance(curious));
  });
  it('gives calm and curious time to observe newly added food while bold starts first',()=>{
    const calm=single('showa','calm'),curious=single('showa','curious'),bold=single('showa','bold');
    for(const simulation of [calm,curious,bold]){simulation.addFood(WORLD.cx+230,WORLD.cy,1);simulation.update(.25);}
    expect(calm.fish[0].feeding).toBe(false);expect(curious.fish[0].feeding).toBe(false);expect(bold.fish[0].feeding).toBe(true);
    run(curious,.5);run(calm,.5);expect(curious.fish[0].feeding).toBe(true);expect(calm.fish[0].feeding).toBe(false);
    run(calm,1);expect(calm.fish[0].feeding).toBe(true);
    for(const simulation of [calm,curious,bold])run(simulation,12);
    expect([calm,curious,bold].map(simulation=>simulation.fish[0].record.eaten)).toEqual([28,28,28]);
  });
  it('keeps bottom fish deep, long-fin fish local and rays slower in fin cadence than small darting fish',()=>{
    const bottom=single('corydoras','calm'),surface=single('arowana','calm'),betta=new PondSimulation([{id:'local-betta',name:'斗鱼',kind:'betta',eaten:0,personality:'curious'}],seededRandom()),ray=single('stingray','calm'),small=single('zebrafish','calm');
    run(bottom,10);run(surface,10);run(ray,10);run(small,10);
    expect(bottom.fish[0].depth).toBeGreaterThan(.75);expect(surface.fish[0].depth).toBeLessThan(.35);
    expect(ray.fish[0].tailPhase).toBeLessThan(small.fish[0].tailPhase*.6);
    const start={x:betta.fish[0].x,y:betta.fish[0].y};let farthest=0;
    for(let step=0;step<90*60;step++){betta.update(1/60);farthest=Math.max(farthest,Math.hypot(betta.fish[0].x-start.x,betta.fish[0].y-start.y));}
    expect(betta.getBehaviorSnapshot('local-betta')!.habit).toContain('小范围');expect(farthest).toBeLessThan(270);
  });
  it('groups same-kind small fish without violating their solid collision envelopes',()=>{
    const records:FishRecord[]=Array.from({length:6},(_,i)=>({id:`shoal-${i}`,name:`小鱼${i}`,kind:'neon',eaten:0,personality:'curious'}));
    const simulation=new PondSimulation(records,seededRandom());
    for(const [i,body] of simulation.fish.entries()){body.x=WORLD.cx+(i-2.5)*100;body.y=WORLD.cy;body.angle=0;body.speed=0;body.goalX=WORLD.cx+700;body.goalY=WORLD.cy;body.goalAge=99;body.depth=body.baseDepth=.4;}
    const spread=()=>{const average=simulation.fish.reduce((sum,body)=>sum+body.x,0)/6;return simulation.fish.reduce((sum,body)=>sum+Math.abs(body.x-average),0)/6;};
    const before=spread();let worst=0;
    for(let step=0;step<40*60;step++){
      simulation.update(1/60);const volumes=simulation.fish.map(getFishCollisionVolume);
      for(let i=0;i<volumes.length;i++)for(let j=i+1;j<volumes.length;j++)worst=Math.max(worst,getCollisionContact(volumes[i],volumes[j])?.penetration??0);
    }
    expect(spread()).toBeLessThan(before*.8);expect(worst).toBeLessThan(.03);
    expect(simulation.fish.some(body=>simulation.getBehaviorSnapshot(body.record.id)!.activity==='shoal')).toBe(true);
  });
});

describe('environmental behavior and save compatibility',()=>{
  it('slows winter motion and eases deeper without freezing fish or altering records',()=>{
    const spring=single('showa','curious'),winter=single('showa','curious');
    const initialDepth=winter.fish[0].depth;winter.setEnvironment({season:'winter'});
    const springDistance=travel(spring,20),winterDistance=travel(winter,20);
    expect(winterDistance).toBeLessThan(springDistance*.6);expect(winterDistance).toBeGreaterThan(25);expect(winter.fish[0].depth).toBeGreaterThan(initialDepth+.1);
    expect(winter.fish[0].record.eaten).toBe(27);
  });
  it('lets day fish rest at night while bottom nocturnal styles still patrol',()=>{
    const day=single('zebrafish','curious'),night=single('zebrafish','curious');night.setEnvironment({daylight:0});
    expect(travel(night,10)).toBeLessThan(travel(day,10)*.15);expect(night.getBehaviorSnapshot('visible-style')!.label).toBe('停驻休息');
    const bottomDay=single('catfish','curious'),bottomNight=single('catfish','curious');bottomNight.setEnvironment({daylight:0});
    expect(travel(bottomNight,10)).toBeGreaterThan(travel(bottomDay,10)*1.3);
  });
  it('makes surface fish briefly avoid new rain, then return instead of restarting the shelter timer each frame',()=>{
    const simulation=single('zebrafish','curious'),initial=simulation.fish[0].depth;
    for(let frame=0;frame<6*60;frame++){simulation.setEnvironment({weather:'rain',rainIntensity:.8});simulation.update(1/60);}
    expect(simulation.fish[0].depth).toBeGreaterThan(initial+.12);expect(simulation.getBehaviorSnapshot('visible-style')!.activity).toBe('shelter');
    for(let frame=0;frame<14*60;frame++){simulation.setEnvironment({weather:'rain',rainIntensity:.8});simulation.update(1/60);}
    expect(simulation.getBehaviorSnapshot('visible-style')!.activity).not.toBe('shelter');expect(simulation.fish[0].depth).toBeLessThan(initial+.05);
  });
  it('preserves records and the same default style across rename/reorder; behavior timers are not saved',()=>{
    const save=createSave();save.fish.push({id:'original-sixth',name:'原来的灯鱼',kind:'neon',eaten:17},{id:'original-seventh',name:'原来的龟旁鱼',kind:'catfish',eaten:32},{id:'original-eighth',name:'原来的银龙',kind:'arowana',eaten:40},{id:'original-ninth',name:'原来的七彩',kind:'discus',eaten:33});save.fish[0].eaten=300;
    const before=JSON.stringify(save),simulation=new PondSimulation(save.fish,seededRandom());run(simulation,20);
    expect(JSON.stringify(save)).toBe(before);expect(save.fish.reduce((sum,fish)=>sum+fish.eaten,0)).toBe(422);
    const snapshot=simulation.getBehaviorSnapshot(save.fish[0].id),body=simulation.fish[0];
    simulation.reconcileFish([...save.fish].reverse().map(record=>({...record,name:'改名'})));
    expect(simulation.fish.find(fish=>fish.record.id===body.record.id)).toBe(body);expect(simulation.getBehaviorSnapshot(body.record.id)).toEqual(snapshot);
    expect(validateSave(JSON.parse(before))).toEqual(save);expect(simulation.getBehaviorSnapshot('missing')).toBeNull();
  });
  it('keeps identical 30/60 FPS outcomes with rain and a water interaction; invalid input cannot corrupt motion',()=>{
    const a=single('neon','curious'),b=single('neon','curious');
    for(const simulation of [a,b]){simulation.setEnvironment({season:'winter',weather:'rain',rainIntensity:.6,daylight:.9});simulation.interactWater(WORLD.cx+120,WORLD.cy);}
    for(let step=0;step<600;step++)a.update(1/30);for(let step=0;step<1200;step++)b.update(1/60);
    expect(a.fish[0].x).toBeCloseTo(b.fish[0].x,7);expect(a.fish[0].y).toBeCloseTo(b.fish[0].y,7);expect(a.fish[0].depth).toBeCloseTo(b.fish[0].depth,7);expect(a.getBehaviorSnapshot('visible-style')).toEqual(b.getBehaviorSnapshot('visible-style'));
    const before={x:a.fish[0].x,y:a.fish[0].y,time:a.time};a.update(NaN);a.update(Infinity);a.update(-1);a.interactWater(NaN,Infinity);a.setEnvironment({rainIntensity:NaN,daylight:Infinity});
    expect({x:a.fish[0].x,y:a.fish[0].y,time:a.time}).toEqual(before);
  });
  it('adopts a species changed by an imported record while retaining its identity and feeding history',()=>{
    const simulation=single('showa','calm'),body=simulation.fish[0];
    simulation.reconcileFish([{...body.record,kind:'catfish'}]);run(simulation,12);
    expect(simulation.fish[0]).toBe(body);expect(body.record.name).toBe('原来的名字');expect(body.record.eaten).toBe(27);
    expect(body.depth).toBeGreaterThan(.75);expect(simulation.getBehaviorSnapshot(body.record.id)!.habit).toContain('贴底');
  });
  it('keeps sixteen mixed fish collision-safe during rain, winter, feeding and repeated gestures',()=>{
    const kinds:FishKind[]=['showa','goldfish','betta','arowana','stingray','corydoras','dojo','kuhliloach','neon','neon','neon','angelfish','guppy','oscar','bristlenose','zebrafish'];
    const records=kinds.map((kind,i)=>({id:`mixed-behavior-${i}`,name:`鱼${i}`,kind,eaten:0,personality:(['calm','curious','bold'] as const)[i%3]}));
    const simulation=new PondSimulation(records,seededRandom());let worst=0,supplied=0;
    for(let step=0;step<90*60;step++){
      if(step===25*60)simulation.setEnvironment({weather:'rain',rainIntensity:.9});if(step===55*60)simulation.setEnvironment({season:'winter',daylight:.1});
      if(step%360===0)simulation.interactWater(WORLD.cx+Math.sin(step)*250,WORLD.cy,.8);
      if(step%600===0){simulation.addFood(WORLD.cx,WORLD.cy,6);supplied+=6;}
      simulation.update(1/60);
      if(step%10===0){const volumes=simulation.fish.map(getFishCollisionVolume);for(let i=0;i<volumes.length;i++)for(let j=i+1;j<volumes.length;j++)worst=Math.max(worst,getCollisionContact(volumes[i],volumes[j])?.penetration??0);expect(simulation.fish.every(fish=>insidePond(fish.x,fish.y,.87)&&Number.isFinite(fish.speed))).toBe(true);}
    }
    expect(worst).toBeLessThan(.03);expect(records.reduce((sum,record)=>sum+record.eaten,0)).toBeGreaterThan(0);expect(records.reduce((sum,record)=>sum+record.eaten,0)+simulation.food.length).toBeLessThanOrEqual(supplied);
  },20000);
});
