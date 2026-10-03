export type PondQuality='economy'|'balanced'|'fine';
export interface PondPerformanceSettings { quality:PondQuality; adaptive:boolean }
export const PERFORMANCE_STORAGE_KEY='seedfish.performance.v1';
export const DEFAULT_PERFORMANCE:PondPerformanceSettings={quality:'balanced',adaptive:true};
export const QUALITY_PROFILES={
  economy:{name:'节能',fps:20,modelFPS:10,resolution:.85,waterResolution:.55,particles:.45},
  balanced:{name:'均衡',fps:30,modelFPS:20,resolution:1,waterResolution:.8,particles:.7},
  fine:{name:'精细',fps:60,modelFPS:30,resolution:1.5,waterResolution:1,particles:1},
} as const;
export function validPerformance(value:unknown):PondPerformanceSettings {
  const data=value as Partial<PondPerformanceSettings>|null;
  return {quality:data&&Object.hasOwn(QUALITY_PROFILES,data.quality??'')?data.quality as PondQuality:'balanced',adaptive:typeof data?.adaptive==='boolean'?data.adaptive:true};
}
export function loadPerformance():PondPerformanceSettings {
  try{return validPerformance(JSON.parse(localStorage.getItem(PERFORMANCE_STORAGE_KEY)??'null'));}catch{return {...DEFAULT_PERFORMANCE};}
}
export function savePerformance(settings:PondPerformanceSettings):boolean {
  try{localStorage.setItem(PERFORMANCE_STORAGE_KEY,JSON.stringify(settings));return true;}catch{return false;}
}
export type PerformanceReason='normal'|'idle'|'load';
export interface PerformanceFrame {fps:number;quality:PondQuality;reason:PerformanceReason}
/** Monotonic wall time drives the policy; render/physics time never jumps. */
export class PondPerformancePolicy {
  private lastInteraction:number;
  private lastSample:number;
  private slowTime=0;
  private recoverAt=0;
  private hostFPS:number|null=null;
  constructor(private settings:PondPerformanceSettings,now=0){this.lastInteraction=this.lastSample=now;}
  configure(settings:PondPerformanceSettings,now:number):void {this.settings={...settings};this.slowTime=this.recoverAt=0;this.interact(now);}
  setHostFPS(value:number):void {if(Number.isFinite(value))this.hostFPS=Math.max(15,Math.min(60,value));}
  interact(now:number):void {this.lastInteraction=now;}
  sample(now:number,cpuMs:number):PerformanceFrame {
    const profile=QUALITY_PROFILES[this.settings.quality],baseFPS=Math.min(profile.fps,this.hostFPS??60);
    const elapsed=Math.max(0,Math.min(250,now-this.lastSample));this.lastSample=now;
    if(!this.settings.adaptive)return {fps:baseFPS,quality:this.settings.quality,reason:'normal'};
    // Require sustained slow work, so opening a panel/one shader compile does
    // not make the quality oscillate. Retry the selected quality after 30s.
    if(Number.isFinite(cpuMs)&&cpuMs>1000/baseFPS*.65)this.slowTime+=elapsed;
    else this.slowTime=Math.max(0,this.slowTime-elapsed*2);
    if(this.slowTime>=2500){this.recoverAt=now+30000;this.slowTime=0;}
    if(now-this.lastInteraction>=45000)return {fps:Math.min(baseFPS,15),quality:this.settings.quality==='fine'?'balanced':this.settings.quality,reason:'idle'};
    if(now<this.recoverAt)return {fps:Math.min(baseFPS,this.settings.quality==='fine'?30:20),quality:this.settings.quality==='fine'?'balanced':'economy',reason:'load'};
    return {fps:baseFPS,quality:this.settings.quality,reason:'normal'};
  }
}
