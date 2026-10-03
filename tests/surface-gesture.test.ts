import {describe,it,expect} from 'vitest';
import {SurfaceGesture} from '../src/surface-gesture';
describe('surface input intent',()=>{
  it('a click tolerates minor pointer jitter',()=>{const g=new SurfaceGesture();g.begin(1,10,20);expect(g.move(1,13,22)).toBe(false);expect(g.end(1,13,22)).toBe('tap');});
  it('a deliberate drag never becomes a tap on returning to its start',()=>{const g=new SurfaceGesture();g.begin(1,0,0);expect(g.move(1,20,0)).toBe(true);expect(g.move(1,24,0)).toBe(false);expect(g.move(1,0,0)).toBe(true);expect(g.end(1,0,0)).toBe('drag');});
  it('cancelled or unrelated pointers cannot feed',()=>{const g=new SurfaceGesture();g.begin(1,0,0);expect(g.end(2,0,0)).toBe(null);expect(g.move(2,30,0)).toBe(false);g.cancel();expect(g.end(1,0,0)).toBe(null);});
  it('a release far away is a drag even if the browser skipped move events',()=>{const g=new SurfaceGesture();g.begin(1,0,0);expect(g.end(1,20,0)).toBe('drag');});
});
