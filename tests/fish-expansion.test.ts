import { describe, expect, it } from 'vitest';
import { FISH_CATALOG, FISH_FAMILIES, getFishDefinition, isFishKind, MAX_FISH, MAX_OWNED_FISH, POND_FISH_SCALE } from '../src/fish-catalog';
import { createSave, validateSave, type FishRecord } from '../src/model';

describe('expanded collection compatibility',()=>{
  it('offers at least fifty real species references without duplicate selector identities',()=>{
    expect(FISH_CATALOG.length).toBeGreaterThanOrEqual(50);
    expect(new Set(FISH_CATALOG.map(fish=>fish.scientificName)).size).toBeGreaterThanOrEqual(50);
    expect(new Set(FISH_CATALOG.map(fish=>fish.kind)).size).toBe(FISH_CATALOG.length);
    for(const fish of FISH_CATALOG){
      expect(isFishKind(fish.kind)).toBe(true);
      expect(FISH_FAMILIES[fish.family]).toBeTruthy();
      expect(fish.scientificName).toMatch(/^[A-Z][a-z]+ [a-z]+$/);
      expect(fish.sourceUrl).toMatch(/^https:\/\/www\.fishbase\.se\//);
      expect(fish.size).toBeGreaterThan(0);
      expect(fish.mouthOffset).toBeGreaterThan(0);
      expect(fish.volume.length).toBeGreaterThan(fish.volume.width);
      expect(fish.volume.height).toBeGreaterThan(0);
    }
    expect(new Set(FISH_CATALOG.map(fish=>fish.morphology)).size).toBeGreaterThanOrEqual(20);
  });
  it('retains every original selector id, relative size and saved counter',()=>{
    const original=[['kohaku',.47],['showa',.54],['yamabuki',.5],['platinum',.45],['tancho',.52],['goldfish',.37],['ryukin',.34],['medaka',.18],['zebrafish',.22],['neon',.2],['catfish',.49]] as const;
    for(const [kind,size] of original)expect(getFishDefinition(kind).size).toBeCloseTo(size*POND_FISH_SCALE,12);
    const old=createSave();old.fish[0].name='原来起的名字';old.fish[0].eaten=416;
    expect(validateSave(old)).toEqual(old);
    expect(MAX_FISH).toBe(24);expect(MAX_OWNED_FISH).toBe(64);
  });
  it('round trips all added species in one bounded active and reserve collection',()=>{
    const records:FishRecord[]=FISH_CATALOG.map((fish,index)=>({id:`collection-${fish.kind}`,name:`鱼 ${index+1}`,kind:fish.kind,eaten:index*7}));
    const save={...createSave(),fish:records.slice(0,MAX_FISH),reserve:records.slice(MAX_FISH)};
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
    expect(isFishKind('unknown-imported-fish')).toBe(false);
  });
});
