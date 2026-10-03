import { describe, expect, it } from 'vitest';
import { getCollisionContact, type CollisionVolume } from '../src/collision';
import { createSave, getFishCollisionVolume, insidePond, PondSimulation, WORLD, type FishBody, type FishRecord } from '../src/model';
import { Critters } from '../src/critters';

function seededRandom() { let seed = 97; return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const capsule = (overrides: Partial<CollisionVolume> = {}): CollisionVolume => ({ id: 'a', x: 0, y: 0, angle: 0, depth: .5, halfLength: 80, radius: 20, halfHeight: 15, ...overrides });
function worstPenetration(fish: FishBody[], obstacles: CollisionVolume[] = []): number {
  const volumes = fish.map(getFishCollisionVolume);
  let worst = 0;
  for (let i = 0; i < volumes.length; i++) {
    for (let j = i + 1; j < volumes.length; j++) worst = Math.max(worst, getCollisionContact(volumes[i], volumes[j])?.penetration ?? 0);
    for (const obstacle of obstacles) worst = Math.max(worst, getCollisionContact(volumes[i], obstacle)?.penetration ?? 0);
  }
  return worst;
}
function pile(fish: FishBody[], angles: (index: number) => number) {
  for (const [index, body] of fish.entries()) {
    body.x = WORLD.cx; body.y = WORLD.cy; body.angle = angles(index);
    body.depth = body.baseDepth = .5; body.depthPhase = 0;
    body.speed = 0; body.goalX = WORLD.cx + 400; body.goalY = WORLD.cy; body.goalAge = 20;
  }
}

describe('oriented water volumes', () => {
  it('detects head and tail contacts far beyond a center-radius check', () => {
    const a = capsule(), b = capsule({ id: 'b', x: 155, angle: Math.PI });
    const contact = getCollisionContact(a, b);
    expect(contact?.penetration).toBeCloseTo(5);
    expect(contact?.nx).toBeCloseTo(-1);
    expect(getCollisionContact(a, { ...b, x: 161 })).toBeNull();
  });
  it('uncrosses full center segments and resolves exact coincidence deterministically', () => {
    for (const angle of [0, Math.PI, Math.PI / 2, Math.PI / 4, -.4]) {
      const a = capsule(), b = capsule({ id: 'b', angle });
      const contact = getCollisionContact(a, b)!;
      expect(Number.isFinite(contact.nx + contact.ny + contact.penetration)).toBe(true);
      const moved = { ...a, x: a.x + contact.nx * (contact.penetration + .001), y: a.y + contact.ny * (contact.penetration + .001) };
      expect(getCollisionContact(moved, b)).toBeNull();
      const reversed = getCollisionContact(b, a)!;
      expect(reversed.nx).toBeCloseTo(-contact.nx);
      expect(reversed.ny).toBeCloseTo(-contact.ny);
    }
  });
  it('lets overlapping silhouettes pass at different depths and respects vertical thickness', () => {
    const a = capsule(), b = capsule({ id: 'b', depth: .7 });
    expect(getCollisionContact(a, b)).toBeNull();
    expect(getCollisionContact(a, { ...b, depth: .64 })).not.toBeNull();
    expect(getCollisionContact(a, { ...b, depth: .65 })).toBeNull();
  });
});

describe('animal volume integration', () => {
  it('separates severely piled fish with head/tail and perpendicular intersections in one substep', () => {
    const simulation = new PondSimulation(createSave().fish, seededRandom());
    pile(simulation.fish, index => [0, Math.PI, Math.PI / 2, Math.PI / 4, -.3][index % 5]);
    simulation.update(1 / 60);
    expect(worstPenetration(simulation.fish)).toBeLessThan(.02);
    expect(simulation.fish.every(f => Number.isFinite(f.x + f.y + f.angle + f.depth))).toBe(true);
  });
  it('separates sixteen parallel large fish initially at the same point',()=>{
    for(const [x,y,angle] of [[WORLD.cx,WORLD.cy,0],[WORLD.cx,WORLD.cy,Math.PI/2],[WORLD.cx+WORLD.rx*.8,WORLD.cy,0],[WORLD.cx,WORLD.cy+WORLD.ry*.78,Math.PI/2]]) {
      const records:FishRecord[]=Array.from({length:16},(_,i)=>({id:`parallel-${i}`,name:`鱼儿${i}`,kind:'showa',eaten:0,personality:'calm'}));
      const simulation=new PondSimulation(records,seededRandom());
      pile(simulation.fish,()=>angle);
      for(const fish of simulation.fish){fish.x=x;fish.y=y;fish.phase=0;}
      simulation.update(1/60);
      expect(worstPenetration(simulation.fish)).toBeLessThan(.03);
    }
  });
  it('keeps sixteen fish solid while pursuing the same food and counts each pellet once', () => {
    const records: FishRecord[] = Array.from({ length: 16 }, (_, i) => ({ id: `crowded-${i}`, name: `鱼儿${i}`, kind: 'kohaku', eaten: 0 }));
    const simulation = new PondSimulation(records, seededRandom());
    pile(simulation.fish, index => index * Math.PI / 8);
    simulation.addFood(WORLD.cx, WORLD.cy, 12);
    const remainingPellets=simulation.food.map(p=>({...p}));
    simulation.onEat=record=>{
      const fish=simulation.fish.find(f=>f.record.id===record.id)!;
      const x=fish.x+Math.cos(fish.angle)*fish.mouthOffset,y=fish.y+Math.sin(fish.angle)*fish.mouthOffset;
      const hit=remainingPellets.findIndex(p=>Math.hypot(p.x-x,p.y-y)<19);
      expect(hit).toBeGreaterThanOrEqual(0);remainingPellets.splice(hit,1);
    };
    let worst = 0;
    for (let frame = 0; frame < 1200; frame++) {
      simulation.update(1 / 30);
      worst = Math.max(worst, worstPenetration(simulation.fish));
      expect(simulation.fish.every(f => insidePond(f.x, f.y, .87))).toBe(true);
    }
    expect(worst).toBeLessThan(.04);
    expect(records.reduce((sum, fish) => sum + fish.eaten, 0)).toBe(12);
    expect(simulation.food).toHaveLength(0);
    expect(remainingPellets).toHaveLength(0);
  });
  it('does not force separated-depth fish apart in XY', () => {
    const records: FishRecord[] = ['a', 'b'].map(id => ({ id, name: id, kind: 'medaka', eaten: 0, personality: 'calm' }));
    const simulation = new PondSimulation(records, seededRandom());
    pile(simulation.fish, () => 0);
    for (const [index, body] of simulation.fish.entries()) {
      body.depth = body.baseDepth = index ? .8 : .2;
      body.phase = body.depthPhase = 0; body.cruise = 0;
    }
    simulation.update(.25);
    expect(simulation.fish[0].x).toBeCloseTo(simulation.fish[1].x, 8);
    expect(simulation.fish[0].y).toBeCloseTo(simulation.fish[1].y, 8);
    expect(worstPenetration(simulation.fish)).toBe(0);
  });
  it('separates fish from the turtle and applies reciprocal turtle avoidance', () => {
    const simulation = new PondSimulation(createSave().fish, seededRandom()), critters = new Critters(seededRandom());
    pile(simulation.fish, index => index * .7);
    critters.turtle.x = WORLD.cx; critters.turtle.y = WORLD.cy; critters.turtle.depth = .5;
    const turtle = critters.getTurtleCollisionVolume();
    simulation.setObstacles([turtle]); simulation.update(1 / 60);
    expect(worstPenetration(simulation.fish, [turtle])).toBeLessThan(.02);
    // Use the actual surface turtle depth for the reciprocal update.
    for (const fish of simulation.fish) fish.depth = fish.baseDepth = .25;
    critters.turtle.x = simulation.fish[0].x; critters.turtle.y = simulation.fish[0].y;
    critters.update(1 / 60, simulation.fish.map(getFishCollisionVolume));
    expect(simulation.fish.every(f => (getCollisionContact(critters.getTurtleCollisionVolume(), getFishCollisionVolume(f))?.penetration ?? 0) < .02)).toBe(true);
  });
  it('preserves depth identity on rename/reorder and preserves 30/60 FPS collision outcomes', () => {
    const a = new PondSimulation(createSave().fish, seededRandom()), b = new PondSimulation(createSave().fish, seededRandom());
    pile(a.fish, index => index * .9); pile(b.fish, index => index * .9);
    a.addFood(WORLD.cx + 120, WORLD.cy, 6); b.addFood(WORLD.cx + 120, WORLD.cy, 6);
    for (let frame = 0; frame < 120; frame++) a.update(1 / 30);
    for (let frame = 0; frame < 240; frame++) b.update(1 / 60);
    for (let index = 0; index < a.fish.length; index++) {
      expect(a.fish[index].x).toBeCloseTo(b.fish[index].x, 6);
      expect(a.fish[index].y).toBeCloseTo(b.fish[index].y, 6);
      expect(a.fish[index].depth).toBeCloseTo(b.fish[index].depth, 8);
      expect(a.fish[index].record.eaten).toBe(b.fish[index].record.eaten);
    }
    const before = a.fish.map(f => ({ id: f.record.id, depth: f.depth, baseDepth: f.baseDepth }));
    a.reconcileFish([...a.fish].reverse().map(f => ({ ...f.record, name: '改名' })));
    expect(a.fish.map(f => ({ id: f.record.id, depth: f.depth, baseDepth: f.baseDepth })).reverse()).toEqual(before);
  });
  it('applies a changed personality to the existing fish without replacing its body or record',()=>{
    const original:FishRecord={id:'changed-personality',name:'小橘',kind:'goldfish',eaten:27,personality:'calm'};
    const changed=new PondSimulation([original],seededRandom()),control=new PondSimulation([{...original}],seededRandom());
    const body=changed.fish[0],depth=body.baseDepth;
    original.personality='bold';
    for(let frame=0;frame<180;frame++){changed.update(1/60);control.update(1/60);}
    expect(changed.fish[0]).toBe(body);expect(body.record).toBe(original);
    expect(body.speed).toBeGreaterThan(control.fish[0].speed*1.35);
    expect(body.baseDepth).toBe(depth);expect(original.name).toBe('小橘');expect(original.eaten).toBe(27);
  });
});
