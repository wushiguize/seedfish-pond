import { expect, it } from 'vitest';
import { BUTTERFLY_PERCHES, Critters, TURTLE_COLLISION_SHAPE, TURTLE_SURFACE_DEPTH, type TurtleState, type ButterflyState } from '../src/critters';
import { insidePond, WORLD } from '../src/model';
import { getCollisionContact, type CollisionVolume } from '../src/collision';

const seededRandom=(initial=17)=>{let seed=initial;return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};};

it('turtle stays in water and visitors keep finite coordinates during ten minutes of wandering',()=>{
  let seed=17;const visitors=new Critters(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;});
  for(let frame=0;frame<18000;frame++) {
    visitors.update(1/30);
    expect(insidePond(visitors.turtle.x,visitors.turtle.y,.88)).toBe(true);
    expect(visitors.butterflies.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>0&&v.x<WORLD.width&&v.y>0&&v.y<WORLD.height)).toBe(true);
  }
});

it('turtle completes continuous surfacing, quiet breathing, diving and deep-water cruising cycles',()=>{
  const visitors=new Critters(seededRandom()),turtle=visitors.turtle;
  const transitions:TurtleState[]=[turtle.state];
  let lastDepth=turtle.depth,breathingFrames=0,deepFrames=0;
  for(let frame=0;frame<60*210;frame++){
    const previousState=turtle.state;visitors.update(1/60);
    if(turtle.state!==previousState)transitions.push(turtle.state);
    expect(Math.abs(turtle.depth-lastDepth)).toBeLessThan(.002);
    expect(turtle.depth).toBeGreaterThanOrEqual(TURTLE_SURFACE_DEPTH-1e-6);
    expect(turtle.depth).toBeLessThanOrEqual(.68);
    if(turtle.state===previousState&&turtle.state==='ascending')expect(turtle.depth).toBeLessThanOrEqual(lastDepth+1e-8);
    if(turtle.state===previousState&&turtle.state==='diving')expect(turtle.depth).toBeGreaterThanOrEqual(lastDepth-1e-8);
    if(turtle.state==='breathing'){
      breathingFrames++;expect(turtle.depth).toBe(TURTLE_SURFACE_DEPTH);
      if(turtle.stateElapsed>2){expect(turtle.speed).toBeLessThan(.05);expect(turtle.paddleAmount).toBeLessThan(.1);}
    }
    if(turtle.state==='deepCruising'){deepFrames++;expect(turtle.depth).toBeGreaterThanOrEqual(.56-1e-5);}
    lastDepth=turtle.depth;
  }
  expect(transitions.slice(0,6)).toEqual(['cruising','ascending','breathing','diving','deepCruising','ascending']);
  expect(transitions.filter(state=>state==='breathing').length).toBeGreaterThanOrEqual(3);
  expect(breathingFrames).toBeGreaterThan(60*15);expect(deepFrames).toBeGreaterThan(60*40);
});

it('butterflies land on actual fixed shoreline pebbles, rest without hovering, then take off again',()=>{
  const visitors=new Critters(seededRandom());
  const visited=visitors.butterflies.map(()=>new Set<ButterflyState>());
  const landed=visitors.butterflies.map(()=>new Set<number>());
  const last=visitors.butterflies.map(b=>({x:b.x,y:b.y,altitude:b.altitude,state:b.state}));
  for(let frame=0;frame<60*150;frame++){
    visitors.update(1/60);
    for(const [index,b] of visitors.butterflies.entries()){
      visited[index].add(b.state);
      expect(b.altitude).toBeGreaterThanOrEqual(0);expect(b.altitude).toBeLessThanOrEqual(29.000001);
      expect(Math.abs(b.altitude-last[index].altitude)).toBeLessThan(.6);
      // Landing is an eased approach, rather than an arrival snap from flight.
      expect(Math.hypot(b.x-last[index].x,b.y-last[index].y)).toBeLessThan(1.8);
      expect(b.wingFold).toBeGreaterThanOrEqual(.18);expect(b.wingFold).toBeLessThanOrEqual(1);
      if(b.state==='resting'){
        const perch=BUTTERFLY_PERCHES[b.perchIndex];landed[index].add(b.perchIndex);
        expect(b.x).toBe(perch.x);expect(b.y).toBe(perch.y);expect(b.altitude).toBe(0);expect(b.speed).toBe(0);
        expect(b.wingFold).toBeLessThan(.26);
      }
      if(b.state==='takeoff'&&last[index].state==='takeoff'){
        expect(b.x).toBe(last[index].x);expect(b.y).toBe(last[index].y);
        expect(b.altitude).toBeGreaterThanOrEqual(last[index].altitude);
      }
      last[index]={x:b.x,y:b.y,altitude:b.altitude,state:b.state};
    }
  }
  for(let index=0;index<2;index++){
    expect([...visited[index]].sort()).toEqual(['flight','landing','resting','takeoff']);
    expect(landed[index].size).toBeGreaterThanOrEqual(3);
  }
  expect(BUTTERFLY_PERCHES.every(p=>p.x<WORLD.width&&p.x>0&&p.y<WORLD.height&&p.y>0&&!insidePond(p.x,p.y,.92))).toBe(true);
});

it('natural animal cycles are reproducible at 30 and 60 FPS, including state timing and random destinations',()=>{
  const a=new Critters(seededRandom()),b=new Critters(seededRandom());
  for(let frame=0;frame<30*160;frame++)a.update(1/30);
  for(let frame=0;frame<60*160;frame++)b.update(1/60);
  expect(a.turtle).toEqual(b.turtle);expect(a.butterflies).toEqual(b.butterflies);
});

it('zero, invalid and paused ticks retain all animal state; a resumed long tick is capped to prevent leaps',()=>{
  const a=new Critters(seededRandom()),b=new Critters(seededRandom());
  const initial=structuredClone({turtle:a.turtle,butterflies:a.butterflies});
  for(const dt of [0,-1,NaN,Infinity,-Infinity])a.update(dt);
  expect({turtle:a.turtle,butterflies:a.butterflies}).toEqual(initial);
  a.update(30);for(let frame=0;frame<15;frame++)b.update(1/60);
  expect(a.turtle).toEqual(b.turtle);expect(a.butterflies).toEqual(b.butterflies);
});

it('turtle retains full physical leg volume and reciprocal separation while moving through the water column',()=>{
  const visitors=new Critters(seededRandom());
  const fixed:CollisionVolume={id:'fixed-fish',x:visitors.turtle.x,y:visitors.turtle.y,angle:Math.PI/3,depth:.3,halfLength:68,radius:24,halfHeight:16};
  for(let frame=0;frame<60*110;frame++){
    // Exercise every state at contact, not only the first cruising frame.
    fixed.x=visitors.turtle.x+8;fixed.y=visitors.turtle.y-4;fixed.depth=visitors.turtle.depth;
    visitors.update(1/60,[fixed]);
    const volume=visitors.getTurtleCollisionVolume();
    expect({halfLength:volume.halfLength,radius:volume.radius,halfHeight:volume.halfHeight}).toEqual(TURTLE_COLLISION_SHAPE);
    expect(getCollisionContact(volume,fixed)?.penetration??0).toBeLessThan(.02);
    expect(insidePond(volume.x,volume.y,.83)).toBe(true);
  }
});
