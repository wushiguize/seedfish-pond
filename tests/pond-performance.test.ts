import {afterEach,describe,expect,it,vi} from 'vitest';
import {PondPerformancePolicy,validPerformance,loadPerformance,savePerformance,PERFORMANCE_STORAGE_KEY} from '../src/pond-performance';
afterEach(()=>vi.unstubAllGlobals());
describe('desktop performance policy',()=>{
  it('reduces idle frame rate and restores interaction without advancing simulation time',()=>{
    const policy=new PondPerformancePolicy({quality:'fine',adaptive:true},0);
    expect(policy.sample(44999,2)).toEqual({fps:60,quality:'fine',reason:'normal'});
    expect(policy.sample(45000,2)).toEqual({fps:15,quality:'balanced',reason:'idle'});
    policy.interact(45001);expect(policy.sample(45001,2).fps).toBe(60);
  });
  it('requires sustained load, respects host caps and retries selected quality after cooldown',()=>{
    const policy=new PondPerformancePolicy({quality:'fine',adaptive:true},0);
    expect(policy.sample(100,40).reason).toBe('normal');
    let frame=policy.sample(200,0);
    for(let now=300;now<=3200;now+=100)frame=policy.sample(now,35);
    expect(frame).toEqual({fps:30,quality:'balanced',reason:'load'});
    policy.interact(34000);expect(policy.sample(34000,1).quality).toBe('fine');
    policy.setHostFPS(18);expect(policy.sample(34100,1).fps).toBe(18);
    policy.setHostFPS(NaN);expect(policy.sample(34200,1).fps).toBe(18);
  });
  it('manual quality bypasses idle/load throttling and changing settings clears a stale throttle',()=>{
    const policy=new PondPerformancePolicy({quality:'balanced',adaptive:false},0);
    for(let now=100;now<=60000;now+=100)expect(policy.sample(now,90).fps).toBe(30);
    policy.configure({quality:'economy',adaptive:true},60000);
    expect(policy.sample(60000,1)).toEqual({fps:20,quality:'economy',reason:'normal'});
  });
  it('keeps performance settings separate from fish saves and survives malformed/blocked storage',()=>{
    const values=new Map<string,string>([['seedfish-save','existing fish']]);
    vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
    expect(savePerformance({quality:'fine',adaptive:false})).toBe(true);
    expect(loadPerformance()).toEqual({quality:'fine',adaptive:false});
    expect(values.get('seedfish-save')).toBe('existing fish');
    values.set(PERFORMANCE_STORAGE_KEY,'bad-json');expect(loadPerformance()).toEqual({quality:'balanced',adaptive:true});
    expect(validPerformance({quality:'__proto__',adaptive:'yes'})).toEqual({quality:'balanced',adaptive:true});
    vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});
    expect(loadPerformance().quality).toBe('balanced');expect(savePerformance({quality:'economy',adaptive:true})).toBe(false);
  });
});
