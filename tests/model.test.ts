import { describe, expect, it } from 'vitest';
import { createSave, validateSave, LEGACY_DEFAULT_FISH, PondSimulation, insidePond, getFishCollisionVolume, WORLD, type FishKind, type FishRecord } from '../src/model';
import { MAX_FISH, MAX_OWNED_FISH } from '../src/fish-catalog';
import { getCollisionContact } from '../src/collision';
import { mapWeather } from '../src/weather';
function seededRandom() { let n=42; return ()=>{ n=(n*1664525+1013904223)>>>0; return n/4294967296; }; }
describe('pool simulation',()=>{
  it('each pellet is consumed at most once, with no phantom food',()=>{
    const save=createSave(),simulation=new PondSimulation(save.fish,seededRandom());
    expect(simulation.addFood(WORLD.cx,WORLD.cy,12)).toBe(true);
    for(let frame=0;frame<1200;frame++)simulation.update(1/30);
    const eaten=save.fish.reduce((sum,f)=>sum+f.eaten,0);
    expect(eaten).toBe(12);expect(simulation.food).toHaveLength(0);
    for(let frame=0;frame<900;frame++)simulation.update(1/30);
    expect(save.fish.reduce((sum,f)=>sum+f.eaten,0)).toBe(12);
  });
  it('fish stay in water over ten minutes, including food at the pond edge',()=>{
    const simulation=new PondSimulation(createSave().fish,seededRandom());
    for(let frame=0;frame<18000;frame++){
      if(frame%600===0)simulation.addFood(WORLD.cx+WORLD.rx*.92,WORLD.cy);
      simulation.update(1/30);
      expect(simulation.fish.every(f=>insidePond(f.x,f.y,.87))).toBe(true);
    }
  },30000);
  it('rejects feeding on shore and caps unconsumed food',()=>{
    const simulation=new PondSimulation(createSave().fish,seededRandom());
    expect(simulation.addFood(0,0)).toBe(false);
    for(let i=0;i<100;i++)simulation.addFood(WORLD.cx,WORLD.cy);
    expect(simulation.food.length).toBe(90);
  });
  it('turning and feeding do not depend on rendering at 30 or 60 FPS',()=>{
    const a=new PondSimulation(createSave().fish,seededRandom()),b=new PondSimulation(createSave().fish,seededRandom());
    a.addFood(WORLD.cx,WORLD.cy);b.addFood(WORLD.cx,WORLD.cy);
    for(let i=0;i<600;i++)a.update(1/30);
    for(let i=0;i<1200;i++)b.update(1/60);
    for(let i=0;i<a.fish.length;i++){expect(a.fish[i].x).toBeCloseTo(b.fish[i].x,5);expect(a.fish[i].record.eaten).toBe(b.fish[i].record.eaten);}
  });
  it('adding, moving out and reordering fish preserve the existing fish motion',()=>{
    const save=createSave(),simulation=new PondSimulation(save.fish,seededRandom());
    simulation.update(.25);
    const retained=simulation.fish[0];
    const before={x:retained.x,y:retained.y,speed:retained.speed,tailPhase:retained.tailPhase,angle:retained.angle,goalAge:retained.goalAge};
    const renamed={...save.fish[0],name:'小橘',eaten:31};
    const newcomer:FishRecord={id:'fish-goldfish-1',name:'小金',kind:'goldfish',eaten:0};
    simulation.reconcileFish([newcomer,...save.fish.slice(2),renamed]);
    expect(simulation.fish.find(f=>f.record.id===retained.record.id)).toBe(retained);
    expect(retained.record).toBe(renamed);
    expect({x:retained.x,y:retained.y,speed:retained.speed,tailPhase:retained.tailPhase,angle:retained.angle,goalAge:retained.goalAge}).toEqual(before);
    expect(simulation.fish.some(f=>f.record.id===save.fish[1].id)).toBe(false);
    expect(simulation.fish.find(f=>f.record.id===newcomer.id)?.mouthOffset).toBeGreaterThan(0);
  });
  it('an empty pond accepts food and can later receive a new fish without invalid coordinates',()=>{
    const simulation=new PondSimulation([],seededRandom());
    simulation.addFood(WORLD.cx,WORLD.cy);
    for(let frame=0;frame<1260;frame++)simulation.update(1/30);
    expect(simulation.fish).toEqual([]);expect(simulation.food).toEqual([]);expect(Number.isFinite(simulation.time)).toBe(true);
    simulation.reconcileFish([{id:'fish-medaka-1',name:'小青',kind:'medaka',eaten:0}]);
    simulation.update(.25);
    expect(simulation.fish.every(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)&&Number.isFinite(f.mouthOffset))).toBe(true);
  });
  it('sixteen mixed fish stay bounded and account for consumed food over ten minutes',()=>{
    const kinds:FishKind[]=['kohaku','showa','yamabuki','platinum','tancho','goldfish','ryukin','medaka','zebrafish','neon','catfish'];
    const records:FishRecord[]=Array.from({length:16},(_,i)=>({id:`fish-mixed-${i}`,name:`鱼儿${i}`,kind:kinds[i%kinds.length],eaten:0}));
    const simulation=new PondSimulation(records,seededRandom());
    let supplied=0;
    for(let frame=0;frame<18000;frame++){
      if(frame%600===0){supplied+=6;simulation.addFood(frame%1200===0?WORLD.cx:WORLD.cx+WORLD.rx*.92,WORLD.cy);}
      simulation.update(1/30);
      if(frame%30===0) {
        expect(simulation.fish.every(f=>insidePond(f.x,f.y,.87)&&Number.isFinite(f.angle)&&Number.isFinite(f.mouthOffset))).toBe(true);
        const volumes=simulation.fish.map(getFishCollisionVolume);
        for(let i=0;i<volumes.length;i++)for(let j=i+1;j<volumes.length;j++)expect(getCollisionContact(volumes[i],volumes[j])?.penetration??0).toBeLessThan(.03);
      }
    }
    const eaten=records.reduce((sum,f)=>sum+f.eaten,0);
    expect(eaten).toBeGreaterThan(0);expect(eaten+simulation.food.length).toBeLessThanOrEqual(supplied);
  },20000);
});
describe('save boundary',()=>{
  it('starts new ponds with twenty independent fish across eight selector kinds',()=>{
    const first=createSave(),second=createSave();
    expect(first.fish).toHaveLength(20);
    expect(new Set(first.fish.map(fish=>fish.kind)).size).toBe(8);
    expect(new Set(first.fish.map(fish=>fish.id)).size).toBe(first.fish.length);
    expect(first.fish.every(fish=>fish.eaten===0)).toBe(true);
    expect(first.fish.length).toBeLessThan(MAX_FISH);
    expect(validateSave(first)).toEqual(first);
    first.fish[0].name='另起的名字';first.fish[0].eaten=8;
    expect(second.fish[0].name).toBe('朱砂');expect(second.fish[0].eaten).toBe(0);
  });
  it('round trips custom names, counts and weather settings',()=>{
    const save=createSave();save.fish[0].name='小橘';save.fish[0].eaten=27;save.weatherMode='snow';
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });
  it('rejects malformed saves before replacing the current pond',()=>{
    const save=createSave();save.fish[0].eaten=-1;expect(()=>validateSave(save)).toThrow();
    const duplicate=createSave();duplicate.fish[1].id=duplicate.fish[0].id;expect(()=>validateSave(duplicate)).toThrow();
    const badName=createSave();badName.fish[0].name='';expect(()=>validateSave(badName)).toThrow();
    expect(()=>validateSave(null)).toThrow();
  });
  it('migrates version one without losing fish names, counts or city weather',()=>{
    const current={...createSave(),fish:LEGACY_DEFAULT_FISH.map(fish=>({...fish}))};current.fish[0].name='原来的小鱼';current.fish[0].eaten=271;
    current.weatherMode='rain';current.weatherAuto=true;
    current.city={name:'上海',region:'上海',latitude:31.23,longitude:121.47};
    current.reading={mode:'rain',temperature:23,wind:11,time:'2026-10-01T12:00',fetchedAt:123456,isDay:true};
    const {reserve:_reserve,...legacy}=current;
    expect(validateSave({...legacy,version:1,fish:[...legacy.fish].reverse()})).toEqual(current);
    const badLegacy={...legacy,version:1,fish:legacy.fish.map(f=>({...f}))};
    badLegacy.fish[0].kind='goldfish';expect(()=>validateSave(badLegacy)).toThrow();
    expect(()=>validateSave({...legacy,version:1,fish:legacy.fish.slice(1)})).toThrow();
  });
  it('round trips a dynamic fish collection and a reserve while allowing an empty pond',()=>{
    const save=createSave();
    save.fish=[{id:'fish-goldfish-1',name:'小金',kind:'goldfish',eaten:12},{id:'fish-neon-2',name:'小蓝',kind:'neon',eaten:2}];
    save.reserve=[{id:'fish-catfish-3',name:'胡子',kind:'catfish',eaten:37}];
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
    save.reserve.push(...save.fish);save.fish=[];
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });
  it('rejects unknown species, unsafe ids, duplicates across collections and collection limits',()=>{
    const unknown=createSave();(unknown.fish[0] as unknown as {kind:string}).kind='shark';expect(()=>validateSave(unknown)).toThrow();
    for(const id of ['../fish','fish id','a'.repeat(81),'']){const unsafe=createSave();unsafe.fish[0].id=id;expect(()=>validateSave(unsafe)).toThrow();}
    const duplicate=createSave();duplicate.reserve=[{...duplicate.fish[0]}];expect(()=>validateSave(duplicate)).toThrow();
    const overActive=createSave();overActive.fish=Array.from({length:MAX_FISH+1},(_,i)=>({...overActive.fish[0],id:`fish-${i}`}));expect(()=>validateSave(overActive)).toThrow();
    const overOwned=createSave();overOwned.reserve=Array.from({length:60},(_,i)=>({...overOwned.fish[0],id:`reserve-${i}`}));expect(()=>validateSave(overOwned)).toThrow();
    const maximum=createSave();maximum.fish=Array.from({length:MAX_FISH},(_,i)=>({...maximum.fish[0],id:`fish-${i}`}));maximum.reserve=Array.from({length:MAX_OWNED_FISH-MAX_FISH},(_,i)=>({...maximum.fish[0],id:`reserve-${i}`}));expect(validateSave(maximum)).toEqual(maximum);
  });
  it('keeps older fish records unchanged while saving explicit personality and lighting choices',()=>{
    const current=createSave();
    const {lightingMode:_lightingMode,...old}=current;
    expect(validateSave(old)).toEqual(current);
    expect(validateSave(old).fish).toEqual(old.fish);
    expect(validateSave(old).fish.every(f=>!Object.hasOwn(f,'personality'))).toBe(true);
    current.lightingMode='dusk';current.fish[0].personality='bold';
    current.reserve=[{id:'reserve-personality',name:'慢慢',kind:'medaka',eaten:29,personality:'calm'}];
    expect(validateSave(JSON.parse(JSON.stringify(current)))).toEqual(current);
    for(const lightingMode of ['invalid','',null,42])expect(()=>validateSave({...current,lightingMode})).toThrow();
    for(const personality of ['invalid','',null,42])expect(()=>validateSave({...current,fish:[{...current.fish[0],personality}]})).toThrow();
  });
  it('preserves valid city time zones without adding keys to old weather readings',()=>{
    const save=createSave();save.reading={mode:'sunny',temperature:21,wind:2,time:'2026-10-02T14:00',fetchedAt:42,isDay:true};
    expect(validateSave(save).reading).toEqual(save.reading);
    save.reading.utcOffsetSeconds=28800;save.reading.timeZone='Asia/Shanghai';
    expect(validateSave(save).reading).toEqual(save.reading);
    for(const offset of [-43201,50401,1.1,'28800',null])expect(()=>validateSave({...save,reading:{...save.reading,utcOffsetSeconds:offset}})).toThrow();
    for(const timeZone of ['', '   ', 'a'.repeat(101),42,null])expect(()=>validateSave({...save,reading:{...save.reading,timeZone}})).toThrow();
    for(const utcOffsetSeconds of [-43200,50400])expect(validateSave({...save,reading:{...save.reading,utcOffsetSeconds}}).reading?.utcOffsetSeconds).toBe(utcOffsetSeconds);
  });
});
describe('weather mapping',()=>{
  it('maps weather codes and precipitation without requiring a temperature guess',()=>{
    expect(mapWeather(0,0,0)).toBe('sunny');expect(mapWeather(3,0,0)).toBe('cloudy');
    expect(mapWeather(61,0,0)).toBe('rain');expect(mapWeather(95,0,0)).toBe('rain');
    expect(mapWeather(75,0,0)).toBe('snow');expect(mapWeather(3,0,.1)).toBe('snow');
  });
});
