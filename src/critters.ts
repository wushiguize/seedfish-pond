import { clampPond, insidePond, WORLD } from './model';
import { getCollisionContact, type CollisionVolume } from './collision';

export interface Visitor { x:number; y:number; angle:number; speed:number; goalX:number; goalY:number; remaining:number; phase:number }
export type TurtleState = 'cruising' | 'ascending' | 'breathing' | 'diving' | 'deepCruising';
export interface TurtleVisitor extends Visitor {
  depth: number; state: TurtleState; stateElapsed: number; stateDuration: number;
  /** Stroke amplitude, including a quiet surface breathing pause. */
  paddleAmount: number;
  /** Smooth surface-breathing envelope for the renderer, never body opacity. */
  breathAmount: number;
}
export type ButterflyState = 'flight' | 'landing' | 'resting' | 'takeoff';
export interface ButterflyVisitor extends Visitor {
  state: ButterflyState; stateElapsed: number; stateDuration: number; perchIndex: number;
  /** x/y is the ground projection: render at x, y - altitude. */
  altitude: number; wingFold: number; wingMotion: number;
}
// The paddling feet extend beyond the shell and head/tail silhouette. Keep the
// 14px center segment, with a 32px cap enclosing their full animated sweep.
export const TURTLE_COLLISION_SHAPE = { halfLength: 46, radius: 32, halfHeight: 12 };
export const TURTLE_SURFACE_DEPTH = .07;
// Centers of visible dry pebbles in lake-open-water.png. Unlike the old flower
// coordinates, these anchors really lie on the photographed outer shoreline.
export const BUTTERFLY_PERCHES = [
  { x: .085 * WORLD.width, y: .081 * WORLD.height },
  { x: .923 * WORLD.width, y: .048 * WORLD.height },
  { x: .934 * WORLD.width, y: .797 * WORLD.height },
  { x: .073 * WORLD.width, y: .936 * WORLD.height },
  { x: .963 * WORLD.width, y: .311 * WORLD.height },
] as const;
const STEP = 1 / 60;
const turn = (a:number) => Math.atan2(Math.sin(a),Math.cos(a));
const smooth = (p:number) => { p=Math.max(0,Math.min(1,p));return p*p*(3-2*p); };
const approach = (value:number,target:number,dt:number,rate:number) => value+(target-value)*(1-Math.exp(-dt*rate));

export class Critters {
  turtle:TurtleVisitor={x:WORLD.cx+WORLD.rx*.455,y:WORLD.cy+WORLD.ry*.392,angle:-2.3,speed:0,goalX:WORLD.cx+WORLD.rx*.076,goalY:WORLD.cy+WORLD.ry*.572,remaining:8,phase:0,depth:.25,state:'cruising',stateElapsed:0,stateDuration:20,paddleAmount:1,breathAmount:0};
  butterflies:ButterflyVisitor[]=BUTTERFLY_PERCHES.slice(0,2).map(({x,y},i)=>({x,y,angle:i,speed:0,goalX:x,goalY:y,remaining:3+i*2,phase:i*2.3,state:'resting',stateElapsed:0,stateDuration:3+i*2,perchIndex:i,altitude:0,wingFold:.24,wingMotion:0}));
  private time=0;
  private accumulator=0;
  private turtleStartDepth=.25;
  private turtleTargetDepth=.25;
  private butterflyStarts=this.butterflies.map(b=>({x:b.x,y:b.y,altitude:0}));
  constructor(private random:()=>number=Math.random) {}
  getTurtleCollisionVolume(): CollisionVolume {
    return { id: 'pond-turtle', x: this.turtle.x, y: this.turtle.y, angle: this.turtle.angle, depth: this.turtle.depth, ...TURTLE_COLLISION_SHAPE };
  }
  update(dt:number, fishVolumes: readonly CollisionVolume[] = []):void {
    // Paused/invalid ticks do not move animals or consume random state. Capping
    // long resumed ticks avoids a catch-up leap; ordinary 30/60 FPS ticks share
    // the exact same integrator and state transitions.
    if(!Number.isFinite(dt)||dt<=0)return;
    this.accumulator+=Math.min(dt,.25);
    while(this.accumulator+1e-10>=STEP){this.accumulator-=STEP;this.step(STEP,fishVolumes);}
  }
  private enterTurtleState(state:TurtleState):void {
    const turtle=this.turtle;turtle.state=state;turtle.stateElapsed=0;
    this.turtleStartDepth=turtle.depth;
    if(state==='ascending'){turtle.stateDuration=8+this.random()*2;this.turtleTargetDepth=TURTLE_SURFACE_DEPTH;}
    else if(state==='breathing'){turtle.stateDuration=5+this.random()*3;this.turtleTargetDepth=TURTLE_SURFACE_DEPTH;}
    else if(state==='diving'){turtle.stateDuration=9+this.random()*3;this.turtleTargetDepth=.56+this.random()*.12;}
    else if(state==='deepCruising'){turtle.stateDuration=26+this.random()*14;this.turtleTargetDepth=turtle.depth;}
    else{turtle.stateDuration=20+this.random()*10;this.turtleTargetDepth=turtle.depth;}
  }
  private step(dt:number,fishVolumes:readonly CollisionVolume[]):void {
    this.time+=dt;const turtle=this.turtle;turtle.remaining-=dt;turtle.stateElapsed+=dt;
    if(turtle.stateElapsed>=turtle.stateDuration){
      const next:TurtleState=turtle.state==='cruising'||turtle.state==='deepCruising'?'ascending':turtle.state==='ascending'?'breathing':turtle.state==='breathing'?'diving':'deepCruising';
      this.enterTurtleState(next);
    }
    const progress=turtle.stateElapsed/turtle.stateDuration;
    if(turtle.state==='ascending'||turtle.state==='diving')turtle.depth=this.turtleStartDepth+(this.turtleTargetDepth-this.turtleStartDepth)*smooth(progress);
    else if(turtle.state==='breathing')turtle.depth=TURTLE_SURFACE_DEPTH;
    turtle.breathAmount=turtle.state==='breathing'?smooth(Math.min(turtle.stateElapsed,turtle.stateDuration-turtle.stateElapsed)/.8):0;
    turtle.paddleAmount=approach(turtle.paddleAmount,turtle.state==='breathing'?.08:turtle.state==='ascending'?.75:1,dt,2.6);
    if(turtle.state!=='breathing'&&(turtle.remaining<=0||Math.hypot(turtle.goalX-turtle.x,turtle.goalY-turtle.y)<24)) {
      const angle=this.random()*Math.PI*2,r=.6+this.random()*.18;
      const target=clampPond(WORLD.cx+Math.cos(angle)*WORLD.rx*r,WORLD.cy+Math.sin(angle)*WORLD.ry*r,.8);
      turtle.goalX=target.x;turtle.goalY=target.y;turtle.remaining=14+this.random()*12;
    }
    // Short strokes and glides continue through the depth transitions, then
    // settle to a near-stationary breath at the surface.
    turtle.phase+=dt*(turtle.state==='breathing'?.55:2.35);
    const stroke=Math.max(0,Math.sin(turtle.phase));
    const rest=.55+.45*Math.sin(this.time*.16);
    const speed=turtle.state==='breathing'?0:(5+stroke*18)*rest*(turtle.state==='ascending'?.6:turtle.state==='diving'?.78:1);
    turtle.speed=approach(turtle.speed,speed,dt,turtle.state==='breathing'?3.5:2);
    let dx=turtle.goalX-turtle.x,dy=turtle.goalY-turtle.y;
    const anticipated=this.getTurtleCollisionVolume();
    anticipated.x+=Math.cos(turtle.angle)*turtle.speed*.6;anticipated.y+=Math.sin(turtle.angle)*turtle.speed*.6;
    anticipated.halfLength+=10;anticipated.radius+=10;
    for(const fish of fishVolumes) {
      const contact=getCollisionContact(anticipated,fish);
      if(contact){dx+=contact.nx*(contact.penetration+15)*3;dy+=contact.ny*(contact.penetration+15)*3;}
    }
    const heading=Math.atan2(dy,dx);
    turtle.angle+=Math.max(-.4*dt,Math.min(.4*dt,turn(heading-turtle.angle)));
    turtle.x+=Math.cos(turtle.angle)*turtle.speed*dt;turtle.y+=Math.sin(turtle.angle)*turtle.speed*dt;
    // Keep reciprocal physical correction active while surfacing and diving:
    // changing depth must not let the turtle enter a fish's occupied volume.
    for(let pass=0;pass<24;pass++) {
      let penetration=0;
      for(const fish of fishVolumes) {
        const contact=getCollisionContact(this.getTurtleCollisionVolume(),fish);
        if(!contact)continue;
        penetration=Math.max(penetration,contact.penetration);
        turtle.x+=contact.nx*(contact.penetration+.002);turtle.y+=contact.ny*(contact.penetration+.002);
      }
      const constrained=clampPond(turtle.x,turtle.y,.82);turtle.x=constrained.x;turtle.y=constrained.y;
      if(penetration<.004)break;
    }
    const volume=this.getTurtleCollisionVolume();
    if(fishVolumes.some(fish=>(getCollisionContact(volume,fish)?.penetration??0)>.01)) {
      let resolved=false;
      for(let radius=8;radius<=256&&!resolved;radius+=8)for(let sample=0;sample<24;sample++) {
        const angle=heading+sample*Math.PI/12;
        const candidate={...volume,x:volume.x+Math.cos(angle)*radius,y:volume.y+Math.sin(angle)*radius};
        if(!insidePond(candidate.x,candidate.y,.82)||fishVolumes.some(fish=>getCollisionContact(candidate,fish)))continue;
        turtle.x=candidate.x;turtle.y=candidate.y;resolved=true;break;
      }
    }
    for(const [i,butterfly] of this.butterflies.entries())this.stepButterfly(butterfly,i,dt);
  }
  private enterButterflyState(b:ButterflyVisitor,index:number,state:ButterflyState):void {
    b.state=state;b.stateElapsed=0;this.butterflyStarts[index]={x:b.x,y:b.y,altitude:b.altitude};
    if(state==='resting'){b.stateDuration=7+this.random()*9;b.speed=0;b.x=b.goalX;b.y=b.goalY;b.altitude=0;}
    else if(state==='takeoff'){
      b.stateDuration=1.2;
      // Always choose a different stone, without rejection loops or per-frame
      // randomness. The destination is fixed until the next landing.
      b.perchIndex=(b.perchIndex+1+Math.floor(this.random()*(BUTTERFLY_PERCHES.length-1)))%BUTTERFLY_PERCHES.length;
      const perch=BUTTERFLY_PERCHES[b.perchIndex];b.goalX=perch.x;b.goalY=perch.y;
    }else if(state==='landing'){b.stateDuration=1.8;b.speed=0;}
    else b.stateDuration=Math.hypot(b.goalX-b.x,b.goalY-b.y)/95+8;
    b.remaining=b.stateDuration;
  }
  private stepButterfly(b:ButterflyVisitor,index:number,dt:number):void {
    b.stateElapsed+=dt;b.remaining=Math.max(0,b.stateDuration-b.stateElapsed);
    if(b.state!=='flight'&&b.stateElapsed>=b.stateDuration){
      this.enterButterflyState(b,index,b.state==='resting'?'takeoff':b.state==='takeoff'?'flight':'resting');
    }
    const start=this.butterflyStarts[index],progress=b.stateElapsed/b.stateDuration;
    if(b.state==='resting'){
      b.x=b.goalX;b.y=b.goalY;b.altitude=0;b.speed=0;b.phase+=dt*.7;
      b.wingFold=.24+Math.sin(b.phase)*.015;b.wingMotion=Math.sin(b.phase)*.012;
      return;
    }
    const heading=Math.atan2(b.goalY-b.y,b.goalX-b.x);
    b.angle+=turn(heading-b.angle)*(1-Math.exp(-dt*5));
    if(b.state==='landing'){
      const eased=smooth(progress);b.x=start.x+(b.goalX-start.x)*eased;b.y=start.y+(b.goalY-start.y)*eased;b.altitude=start.altitude*(1-eased);
      b.phase+=dt*(18+index*2)*(1-eased);
      b.wingFold=(.18+.82*Math.abs(Math.sin(b.phase)))*(1-eased)+.24*eased;b.wingMotion=Math.sin(b.phase)*.1*(1-eased);
    }else if(b.state==='takeoff'){
      const eased=smooth(progress);b.x=start.x;b.y=start.y;b.altitude=24*eased;
      b.phase+=dt*(18+index*2)*eased;b.wingFold=.24*(1-eased)+(.18+.82*Math.abs(Math.sin(b.phase)))*eased;b.wingMotion=Math.sin(b.phase)*.1*eased;
    }else{
      const distance=Math.hypot(b.goalX-b.x,b.goalY-b.y);
      b.speed=approach(b.speed,Math.min(105,Math.max(42,distance*.7)),dt,2.5);
      const travel=Math.min(distance,b.speed*dt);b.x+=Math.cos(b.angle)*travel;b.y+=Math.sin(b.angle)*travel;
      // Start flight at exactly the takeoff altitude before adding a small
      // breathing-like rise/fall; the state boundary never jumps vertically.
      b.altitude=24+Math.sin(b.stateElapsed*1.6)*5;b.phase+=dt*(18+index*2);b.wingFold=.18+.82*Math.abs(Math.sin(b.phase));b.wingMotion=Math.sin(b.phase)*.1;
      if(distance<=48)this.enterButterflyState(b,index,'landing');
    }
  }
}
