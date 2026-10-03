import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSave, LEGACY_DEFAULT_FISH } from '../src/model';
import { LEGACY_BACKUP_KEY, loadSave, persist, STORAGE_KEY } from '../src/storage';

function storageFixture(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  return values;
}

afterEach(() => vi.unstubAllGlobals());

describe('fish library storage migration', () => {
  it('retains the original version one backup once and writes new collections to the same save key', () => {
    const { reserve: _reserve, ...data } = createSave();
    const legacy = { ...data, version: 1, fish: LEGACY_DEFAULT_FISH.map(fish=>({...fish})) };
    legacy.fish[0].name = '原来的朱砂';
    legacy.fish[0].eaten = 129;
    const original = JSON.stringify(legacy);
    const values = storageFixture({ [STORAGE_KEY]: original });
    const loaded = loadSave();
    expect(loaded.warning).toBeUndefined();
    expect(loaded.data.version).toBe(2);
    expect(loaded.data.fish[0]).toEqual(legacy.fish[0]);
    expect(loaded.data.fish).toHaveLength(5);
    expect(loaded.data.fish.map(fish=>fish.kind)).toEqual(['kohaku','showa','yamabuki','platinum','tancho']);
    expect(values.get(LEGACY_BACKUP_KEY)).toBe(original);
    expect(values.get(STORAGE_KEY)).toBe(original);
    loaded.data.reserve.push(loaded.data.fish.pop()!);
    expect(persist(loaded.data)).toBe(true);
    expect(loadSave().data).toEqual(loaded.data);
    expect(values.get(LEGACY_BACKUP_KEY)).toBe(original);
    legacy.fish[0].eaten = 145;
    values.set(STORAGE_KEY, JSON.stringify(legacy));
    loadSave();
    expect(values.get(LEGACY_BACKUP_KEY)).toBe(original);
  });
  it('creates twenty fish only when no saved pond exists',()=>{
    const values=storageFixture();
    const loaded=loadSave();
    expect(loaded.warning).toBeUndefined();
    expect(loaded.data.fish).toHaveLength(20);
    expect(new Set(loaded.data.fish.map(fish=>fish.kind)).size).toBe(8);
    expect(values.size).toBe(0);
  });
  it('keeps an existing nine-fish collection and every counter without topping it up',()=>{
    const saved={...createSave(),fish:[...LEGACY_DEFAULT_FISH.map(fish=>({...fish})),
      {id:'custom-medaka',name:'用户的青鳉',kind:'medaka' as const,eaten:9,personality:'curious' as const},
      {id:'custom-goldfish',name:'用户的小金',kind:'goldfish' as const,eaten:17},
      {id:'custom-ryukin',name:'用户的圆圆',kind:'ryukin' as const,eaten:3},
      {id:'custom-catfish',name:'用户的胡子',kind:'catfish' as const,eaten:5},
    ]};
    saved.fish[0].name='原来的朱砂';saved.fish[0].eaten=400;
    saved.reserve=[{id:'reserve-zebra',name:'暂养的小斑',kind:'zebrafish',eaten:23,personality:'calm'}];
    const original=JSON.stringify(saved),values=storageFixture({[STORAGE_KEY]:original});
    const loaded=loadSave();
    expect(loaded.warning).toBeUndefined();
    expect(loaded.data).toEqual(saved);
    expect(loaded.data.fish).toHaveLength(9);
    expect(loaded.data.fish.reduce((sum,fish)=>sum+fish.eaten,0)).toBe(434);
    expect(values.get(STORAGE_KEY)).toBe(original);
    expect(values.size).toBe(1);
  });
  it('backs up malformed source data and reports a warning before using defaults', () => {
    const broken = '{this-is-not-json';
    const values = storageFixture({ [STORAGE_KEY]: broken });
    const loaded = loadSave();
    expect(loaded.data).toEqual(createSave());
    expect(loaded.warning).toContain('原存档无法读取');
    expect([...values.entries()].some(([key, value]) => key.startsWith(`${STORAGE_KEY}.unreadable.`) && value === broken)).toBe(true);
    expect(values.get(STORAGE_KEY)).toBe(broken);
  });
});
