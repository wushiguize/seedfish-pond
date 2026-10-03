import { describe, expect, it } from 'vitest';
import { LakeFaunaSimulation, FAUNA_LIMITS, type LakeFaunaEnvironment } from '../src/lake-fauna-state';
import { getCollisionContact, isCollisionVolume, type CollisionVolume } from '../src/collision';
import { insidePond, WORLD } from '../src/model';

const seeded=(start=19)=>{let seed=start;return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};};
const summer:LakeFaunaEnvironment={resolvedSeason:'summer',rainIntensity:0,snowIntensity:0,seasonMix:{summer:1,winter:0}};
const winter:LakeFaunaEnvironment={resolvedSeason:'winter',rainIntensity:0,snowIntensity:0,seasonMix:{summer:0,winter:1}};
const day={daylight:1};

describe('small peripheral lake visitors',()=>{
  it('keeps exactly nine bounded underwater volumes and a fixed visitor pool',()=>{
    const sim=new LakeFaunaSimulation(seeded());
    expect(sim.bodies).toHaveLength(14);expect(sim.getAnimals()).toHaveLength(9);
    expect(sim.bodies.filter(b=>b.kind==='shrimp')).toHaveLength(FAUNA_LIMITS.shrimp);
    for(let frame=0;frame<60*240;frame++){
      const impacts=sim.update(1/60,summer,day);
      expect(impacts.length).toBeLessThanOrEqual(FAUNA_LIMITS.impactsPerTick);
      if(frame%60!==0)continue;
      expect(sim.bodies).toHaveLength(14);
      for(const b of sim.bodies){
        expect([b.x,b.y,b.angle,b.speed,b.altitude,b.visibility].every(Number.isFinite)).toBe(true);
        expect(b.x).toBeGreaterThan(0);expect(b.x).toBeLessThan(WORLD.width);
        expect(b.y).toBeGreaterThan(0);expect(b.y).toBeLessThan(WORLD.height);
        expect(b.visibility).toBeGreaterThanOrEqual(0);expect(b.visibility).toBeLessThanOrEqual(1);
        if(b.kind==='shrimp'||b.kind==='snail'){expect(isCollisionVolume(b)).toBe(true);expect(insidePond(b.x,b.y,.94)).toBe(true);expect(insidePond(b.x,b.y,.60)).toBe(false);expect(b.visibility).toBe(1);}
        if(b.kind==='frog')expect(insidePond(b.x,b.y,.94)).toBe(false);
      }
    }
  });
  it('does not advance positions, random choices, wings or timers during paused/invalid ticks',()=>{
    const a=new LakeFaunaSimulation(seeded());for(let i=0;i<120;i++)a.update(1/30,summer,day);
    const snapshot=structuredClone(a.bodies),time=a.time;
    for(const dt of [0,-1,NaN,Infinity,-Infinity])expect(a.update(dt,winter,day)).toEqual([]);
    expect(a.bodies).toEqual(snapshot);expect(a.time).toBe(time);
  });
  it('reproduces all visitor states and surface touches at 30 and 60 FPS',()=>{
    const a=new LakeFaunaSimulation(seeded()),b=new LakeFaunaSimulation(seeded());
    const impactsA=[],impactsB=[];
    for(let frame=0;frame<30*75;frame++)impactsA.push(...a.update(1/30,summer,day));
    for(let frame=0;frame<60*75;frame++)impactsB.push(...b.update(1/60,summer,day));
    expect(a.bodies).toEqual(b.bodies);expect(impactsA).toEqual(impactsB);expect(impactsA.length).toBeGreaterThan(0);
  });
  it('shows summer dragonflies and retreats to shore in winter, rain and dark hours',()=>{
    for(const stopped of [winter,{...summer,rainIntensity:1},{...summer,snowIntensity:1},summer]){
      const sim=new LakeFaunaSimulation(seeded());for(let frame=0;frame<60*30;frame++)sim.update(1/60,summer,day);
      const flies=sim.bodies.filter(b=>b.kind==='dragonfly');expect(flies.every(b=>b.visibility>.99)).toBe(true);
      const light=stopped===summer?{daylight:.16}:day;
      let impacts=0;for(let frame=0;frame<60*12;frame++)impacts+=sim.update(1/60,stopped,light).length;
      expect(impacts).toBe(0);expect(flies.every(b=>b.visibility<.005&&b.altitude<.01&&Math.hypot(b.x-b.homeX,b.y-b.homeY)<.05)).toBe(true);
      expect(sim.getAnimals().every(b=>b.visibility===1)).toBe(true);
    }
  });
  it('moves a disturbed shrimp away and respects fish/turtle occupied volumes',()=>{
    const sim=new LakeFaunaSimulation(seeded()),shrimp=sim.getAnimals()[0],origin={x:shrimp.x,y:shrimp.y};
    expect(sim.disturbWater(shrimp.x-20,shrimp.y)).toBe(1);
    for(let frame=0;frame<60;frame++)sim.update(1/60,summer,day);
    expect(shrimp.x-origin.x).toBeGreaterThan(25);
    const obstacle:CollisionVolume={id:'test-turtle',x:shrimp.x,y:shrimp.y,angle:shrimp.angle+.4,depth:shrimp.depth,halfLength:55,radius:30,halfHeight:14};
    for(let frame=0;frame<120;frame++){
      obstacle.x=shrimp.x+4;obstacle.y=shrimp.y-3;sim.update(1/60,summer,day,[obstacle]);
      expect(getCollisionContact(shrimp,obstacle)?.penetration??0).toBeLessThan(.01);
    }
    for(const [i,a] of sim.getAnimals().entries())for(const b of sim.getAnimals().slice(i+1))expect(getCollisionContact(a,b)?.penetration??0).toBeLessThan(.01);
  });
  it('has a visible low-speed winter reduction without turning solid bottom life transparent',()=>{
    const a=new LakeFaunaSimulation(seeded()),b=new LakeFaunaSimulation(seeded());
    for(let frame=0;frame<60*6;frame++){a.update(1/60,summer,day);b.update(1/60,winter,day);}
    for(let i=0;i<9;i++){expect(b.getAnimals()[i].speed).toBeLessThan(a.getAnimals()[i].speed*.31);expect(b.getAnimals()[i].visibility).toBe(1);}
    expect(b.bodies.filter(v=>v.kind==='frog').every(v=>v.visibility<.005)).toBe(true);
  });
  it('resolves projected overlap only when bodies occupy the same physical depth',()=>{
    const sim=new LakeFaunaSimulation(seeded()),shrimp=sim.getAnimals()[0];
    const obstacle:CollisionVolume={id:'surface-fish',x:shrimp.x,y:shrimp.y,angle:shrimp.angle,depth:.1,halfLength:60,radius:30,halfHeight:12};
    const before={x:shrimp.x,y:shrimp.y};sim.update(1/60,summer,day,[obstacle]);
    expect(Math.hypot(shrimp.x-before.x,shrimp.y-before.y)).toBeLessThan(.01);
    expect(getCollisionContact(shrimp,obstacle)).toBe(null);
  });
});
