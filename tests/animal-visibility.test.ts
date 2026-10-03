import { describe, expect, it } from 'vitest';
import { animalZIndex, hitAnimalAt, pickVisibleAnimal } from '../src/animal-visibility';
import type { CollisionVolume } from '../src/collision';

const volume=(overrides:Partial<CollisionVolume>={}):CollisionVolume=>({id:'owned-fish',x:120,y:80,angle:0,depth:.5,halfLength:60,radius:12,halfHeight:8,...overrides});
const worldPoint=(body:CollisionVolume,x:number,y:number)=>({x:body.x+x*Math.cos(body.angle)-y*Math.sin(body.angle),y:body.y+x*Math.sin(body.angle)+y*Math.cos(body.angle)});

describe('animal body projection',()=>{
  it('uses overall head and tail length instead of extending by another radius',()=>{
    const body=volume();
    expect(hitAnimalAt(body.x+60,body.y,body)).toBe(true);expect(hitAnimalAt(body.x-60,body.y,body)).toBe(true);
    expect(hitAnimalAt(body.x+60.001,body.y,body)).toBe(false);expect(hitAnimalAt(body.x-60.001,body.y,body)).toBe(false);
    expect(hitAnimalAt(body.x,body.y+12,body)).toBe(true);expect(hitAnimalAt(body.x,body.y-12,body)).toBe(true);
    expect(hitAnimalAt(body.x,body.y+12.001,body)).toBe(false);
  });
  it('rejects empty corners around the rounded ends rather than using a bounding rectangle',()=>{
    const body=volume();
    expect(hitAnimalAt(body.x+59,body.y+11,body)).toBe(false);expect(hitAnimalAt(body.x-59,body.y-11,body)).toBe(false);
    expect(hitAnimalAt(body.x+48,body.y+12,body)).toBe(true);
    expect(hitAnimalAt(body.x+54,body.y+8,body)).toBe(true);
  });
  it('rotates the complete capsule and includes exact boundaries after rotation',()=>{
    for(const angle of [Math.PI/2,Math.PI/4,-Math.PI*.63,Math.PI*3,.3,.55,1.23]){
      const body=volume({angle,x:1937,y:1043});
      for(const [x,y] of [[60,0],[-60,0],[0,12],[48,12],[54,8]]){const p=worldPoint(body,x,y);expect(hitAnimalAt(p.x,p.y,body)).toBe(true);}
      for(const [x,y] of [[60.01,0],[-60.01,0],[0,12.01],[59,11]]){const p=worldPoint(body,x,y);expect(hitAnimalAt(p.x,p.y,body)).toBe(false);}
    }
  });
  it('uses a zero-thickness projection even for animals at a different physical depth',()=>{
    const flat=volume({depth:.95,halfHeight:0}),round=volume({halfLength:12,radius:12});
    expect(hitAnimalAt(flat.x,flat.y,flat)).toBe(true);expect(hitAnimalAt(round.x+12,round.y,round)).toBe(true);
    expect(hitAnimalAt(round.x+9,round.y+9,round)).toBe(false);
    expect(hitAnimalAt(Number.NaN,flat.y,flat)).toBe(false);expect(hitAnimalAt(flat.x,flat.y,volume({angle:Infinity}))).toBe(false);
  });
});

describe('opaque animal visibility',()=>{
  it('selects the shallower overlapping body independently of input order',()=>{
    const deep=volume({id:'deep-fish',depth:.8}),shallow=volume({id:'shallow-fish',depth:.2});
    expect(pickVisibleAnimal(120,80,[deep,shallow])).toBe('shallow-fish');expect(pickVisibleAnimal(120,80,[shallow,deep])).toBe('shallow-fish');
    expect(pickVisibleAnimal(500,500,[shallow,deep])).toBeNull();expect(pickVisibleAnimal(120,80,[])).toBeNull();
  });
  it('returns the upper turtle or ambient fish ID and does not select through it',()=>{
    const owned=volume({depth:.7}),turtle=volume({id:'lake-turtle',depth:.25,halfLength:35,radius:24}),ambient=volume({id:'lake-minnow-0-1',depth:.1,halfLength:10,radius:3});
    expect(pickVisibleAnimal(120,80,[owned,turtle])).toBe('lake-turtle');
    expect(pickVisibleAnimal(120,80,[owned,turtle,ambient])).toBe('lake-minnow-0-1');
    // Outside the smaller upper body, the deeper body is still selectable.
    expect(pickVisibleAnimal(175,80,[owned,turtle,ambient])).toBe('owned-fish');
  });
  it('breaks equal-depth ties by stable lexical ID without mutating the input',()=>{
    const z=volume({id:'z-fish'}),a=volume({id:'a-fish'}),input=Object.freeze([z,a]);
    expect(pickVisibleAnimal(120,80,input)).toBe('a-fish');expect(pickVisibleAnimal(120,80,[a,z])).toBe('a-fish');expect(input[0]).toBe(z);
    expect(pickVisibleAnimal(120,80,[volume({id:'invalid',depth:NaN}),z])).toBe('z-fish');
  });
  it('keeps inclusive opaque-body edges and Pixi depth ordering consistent',()=>{
    const upper=volume({id:'upper',depth:.2}),lower=volume({id:'lower',depth:.8});
    expect(pickVisibleAnimal(180,80,[lower,upper])).toBe('upper');expect(pickVisibleAnimal(180.01,80,[lower,upper])).toBeNull();
    expect(animalZIndex(upper.depth)).toBe(-200);expect(animalZIndex(lower.depth)).toBe(-800);expect(animalZIndex(upper.depth)).toBeGreaterThan(animalZIndex(lower.depth));
  });
});
