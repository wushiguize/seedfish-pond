import { Filter, GlProgram, Texture } from 'pixi.js';

const vertex=`
precision highp float;
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 position=aPosition*uOutputFrame.zw+uOutputFrame.xy;
  position.x=position.x*2.0/uOutputTexture.x-1.0;
  position.y=position.y*2.0*uOutputTexture.z/uOutputTexture.y-uOutputTexture.z;
  gl_Position=vec4(position,0.0,1.0);
  vTextureCoord=aPosition*uOutputFrame.zw*uInputSize.zw;
}`;

const fragment=`
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uInputClamp;
uniform float uTime;
uniform float uEnergy;
uniform float uSun;
uniform vec3 uTint;
uniform float uBrightness;
uniform float uDaylight;
uniform vec4 uWeatherOptics;
uniform vec2 uWind;
uniform float uClarity;
uniform float uIce;
uniform vec3 uWaterColor;
uniform float uCausticStrength;
uniform float uBedGreen;
uniform int uImpactCount;
uniform vec4 uImpacts[24];
void main() {
  vec2 uv=vTextureCoord*uInputSize.xy/uOutputFrame.zw;
  vec2 world=uv;
  float radius=length((world-vec2(0.5,0.5111))/vec2(0.4333,0.4));
  float water=1.0-smoothstep(0.93,1.10,radius);
  float shallow=smoothstep(0.50,0.97,radius);
  vec2 p=world*vec2(58.0,38.0)-uWind*uTime*0.12;
  float t=uTime;
  // Two travelling wave families deform water and submerged animals together.
  vec2 flow=vec2(
    sin(p.y*1.32+t*0.95)+0.55*sin(p.x*1.4+p.y*0.7-t*0.71),
    cos(p.x*1.12-t*0.82)+0.5*sin(p.y*1.5+p.x*0.8+t*0.64)
  );
  vec2 offset=flow*uInputSize.zw*1.55*uEnergy*water*uWeatherOptics.w;
  float impactLight=0.0;
  // World-space rain/touch impulses bend the same image as the wind waves.
  // Ring centers are shared with the visible falling drops and floating leaves.
  for(int i=0;i<24;i++) {
    if(i>=uImpactCount)break;
    vec4 impulse=uImpacts[i];
    vec2 delta=(world-impulse.xy)*vec2(2400.0,1350.0);
    float distance=length(delta*vec2(1.0,1.28205)),radius=impulse.z;
    float band=(distance-radius)/8.0;
    float ring=sin((distance-radius)*0.42)*exp(-band*band)*impulse.w;
    offset+=delta/max(distance,1.0)*ring*uInputSize.zw*2.8*water;
    impactLight+=ring*0.022*water;
  }
  vec4 color=texture(uTexture,clamp(vTextureCoord+offset,uInputClamp.xy,uInputClamp.zw));
  float veins=abs(sin(p.x*1.42+sin(p.y*1.16+t*0.48))+sin(p.y*1.31+cos(p.x*0.95-t*0.37)));
  float caustic=pow(max(0.0,1.0-veins),9.0);
  float glint=pow(max(0.0,sin(p.x*0.75-p.y*1.1+t*0.52)*cos(p.y*1.3+t*0.23)),16.0);
  float cloud=0.5+0.5*sin(world.x*7.0+t*0.12+sin(world.y*6.0-t*0.08));
  color.rgb*=1.0-water*cloud*(0.008+(1.0-uSun)*0.012);
  color.rgb+=vec3(0.78,0.85,0.78)*(caustic*(0.032+shallow*0.085)*uCausticStrength+glint*0.038)*uSun*water*color.a;
  // Broad, slow reflections establish a surface above the lake bed and fish.
  float sky=pow(0.5+0.5*sin(world.x*8.0-world.y*5.0+t*0.06+sin(world.y*7.0)),5.0);
  vec3 skyColor=mix(vec3(0.15,0.24,0.32),vec3(0.71,0.78,0.81),uDaylight);
  color.rgb=mix(color.rgb,skyColor*color.a,(0.28+sky*0.72)*uWeatherOptics.z*water);
  color.rgb=mix(color.rgb,vec3(0.32,0.48,0.48)*color.a,(1.0-uClarity)*0.20*water);
  // The four photographic beds carry the seasons. Only the optical water
  // response is blended here, so stones/white fish aren't painted a new color.
  color.rgb=mix(color.rgb,uWaterColor*color.a,water*0.018);
  color.rgb+=vec3(-0.003,0.005,-0.002)*uBedGreen*shallow*water*color.a;
  color.rgb+=vec3(0.60,0.76,0.76)*impactLight*color.a;
  // Only narrow, broken shallows freeze. The central lake stays open.
  float edge=smoothstep(0.87,0.97,radius)*(1.0-smoothstep(1.0,1.08,radius));
  float frost=smoothstep(0.2,0.8,sin(world.x*35.0+sin(world.y*28.0))*cos(world.y*31.0));
  color.rgb=mix(color.rgb,vec3(0.62,0.76,0.77)*color.a,edge*frost*uIce*3.5);
  color.rgb*=uTint;
  float luminance=dot(color.rgb,vec3(0.2126,0.7152,0.0722));
  color.rgb=mix(vec3(luminance),color.rgb,uWeatherOptics.y);
  color.rgb=(color.rgb-vec3(0.28)*color.a)*uWeatherOptics.x+vec3(0.28)*color.a;
  color.rgb*=uBrightness;
  // Roll off bright stones/white fish instead of clipping away their texture.
  color.rgb/=1.0+max(color.rgb-vec3(0.78),vec3(0.0))*0.28;
  finalColor=color;
}`;

export class WaterSurface extends Filter {
  constructor() {
    super({glProgram:GlProgram.from({vertex,fragment,name:'seedfish-water'}),clipToViewport:false,resolution:1,
      resources:{animation:{uTime:{value:0,type:'f32'},uEnergy:{value:1,type:'f32'},uSun:{value:1,type:'f32'},uTint:{value:new Float32Array([1,1,1]),type:'vec3<f32>'},uBrightness:{value:1,type:'f32'},uDaylight:{value:1,type:'f32'},uWeatherOptics:{value:new Float32Array([1,1,.018,1]),type:'vec4<f32>'},uWind:{value:new Float32Array([0,0]),type:'vec2<f32>'},uClarity:{value:1,type:'f32'},uIce:{value:0,type:'f32'},uWaterColor:{value:new Float32Array([.2,.45,.4]),type:'vec3<f32>'},uCausticStrength:{value:1,type:'f32'},uBedGreen:{value:0,type:'f32'},uImpactCount:{value:0,type:'i32'},uImpacts:{value:new Float32Array(24*4),type:'vec4<f32>',size:24}}}});
  }
  setEnvironment(windX:number,windY:number,clarity:number,ice:number,impacts:readonly {x:number;y:number;radius:number;age:number;lifetime:number;strength:number}[],limit=16):void {
    const u=this.resources.animation.uniforms;u.uWind[0]=windX;u.uWind[1]=windY;u.uClarity=clarity;u.uIce=ice;
    const count=Math.min(24,limit,impacts.length);u.uImpactCount=count;
    const ranked=[...impacts].sort((a,b)=>Number('kind' in b&&b.kind==='touch')-Number('kind' in a&&a.kind==='touch')||a.age-b.age);
    for(let i=0;i<count;i++){const impact=ranked[i],index=i*4;u.uImpacts[index]=impact.x/2400;u.uImpacts[index+1]=impact.y/1350;u.uImpacts[index+2]=impact.radius;u.uImpacts[index+3]=Math.max(0,1-impact.age/impact.lifetime)*impact.strength;}
  }
  setSeasonOptics(color:readonly number[],caustics:number,bedGreen:number):void {
    const u=this.resources.animation.uniforms;
    for(let i=0;i<3;i++)u.uWaterColor[i]=color[i];u.uCausticStrength=caustics;u.uBedGreen=bedGreen;
  }
  setWeatherOptics(daylight:number,contrast:number,saturation:number,reflection:number,refraction:number):void {
    const u=this.resources.animation.uniforms;u.uDaylight=daylight;
    u.uWeatherOptics[0]=contrast;u.uWeatherOptics[1]=saturation;u.uWeatherOptics[2]=reflection;u.uWeatherOptics[3]=refraction;
  }
  update(time:number,energy:number,sun:number,tint:readonly number[]=[1,1,1],brightness=1):void {
    const uniforms=this.resources.animation.uniforms;
    uniforms.uTime=time;uniforms.uEnergy=energy;uniforms.uSun=sun;
    uniforms.uTint[0]=tint[0];uniforms.uTint[1]=tint[1];uniforms.uTint[2]=tint[2];uniforms.uBrightness=brightness;
  }
  override apply(...args:Parameters<Filter['apply']>):void {
    super.apply(...args);
    // Release the pooled input after drawing, before a viewport resize recycles it.
    this.groups[0].setResource(Texture.EMPTY.source,1);
    this.groups[0].setResource(Texture.EMPTY.source.style,2);
  }
}
