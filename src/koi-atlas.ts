import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { AmbientLight, DirectionalLight, Group, HemisphereLight, OrthographicCamera, Scene, SRGBColorSpace, WebGLRenderer, ACESFilmicToneMapping, type WebGLRenderTarget } from 'three';
import { createFishOutdoorEnvironment } from './fish-outdoor-light';
import type { KoiRig } from './koi-model';
import { createFishRig } from './fish-model';
import type { FishBody, FishKind } from './model';

// The pond retains its 2D water compositor. These textures are live renders of
// volumetric meshes, not pre-rendered frame sheets or deforming fish photographs.
const CELL_WIDTH=384, CELL_HEIGHT=192;
export class KoiAtlas {
  readonly renderer:WebGLRenderer;
  readonly canvas:HTMLCanvasElement;
  textures:Texture[]=[];
  rigs:KoiRig[]=[];
  private source:CanvasSource;
  private scene=new Scene();
  private renderSlot=new Group();
  private camera=new OrthographicCamera(-1.35,1.35,.675,-.675,.1,20);
  private sun=new DirectionalLight(0xfff4da,2.8);
  private ambient=new AmbientLight(0xd4e5df,.65);
  private environment:WebGLRenderTarget;
  private pickCanvas:HTMLCanvasElement|undefined;
  private pickContext:CanvasRenderingContext2D|undefined;

  static async create(kinds:FishKind[]):Promise<KoiAtlas> {
    const rigs:KoiRig[]=[];
    try {
      for(const kind of kinds) {
        // Give the loading screen and input events a turn between skin builds.
        await new Promise<void>(resolve=>setTimeout(resolve,0));
        rigs.push(createFishRig(kind));
      }
      return new KoiAtlas(kinds,rigs);
    } catch(error){rigs.forEach(rig=>rig.dispose());throw error;}
  }
  static async catalogThumbnails(kinds:FishKind[],onThumbnail?:(kind:FishKind,png:string)=>void):Promise<Map<FishKind,string>> {
    const thumbnails=new Map<FishKind,string>();
    if(!kinds.length)return thumbnails;
    // Library pages share one small render target. A full species library does
    // not need to keep every skin and mesh resident on the GPU at once.
    const atlas=await KoiAtlas.create([]);
    try {
      atlas.renderCatalog();
      for(const kind of new Set(kinds)) {
        await atlas.setKinds([kind]);
        const png=atlas.thumbnail(0);thumbnails.set(kind,png);onThumbnail?.(kind,png);
      }
      return thumbnails;
    } finally {atlas.dispose();}
  }
  private constructor(kinds:FishKind[],rigs:KoiRig[]) {
    this.canvas=document.createElement('canvas');
    this.renderer=new WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(1);this.renderer.setSize(CELL_WIDTH*Math.max(1,Math.min(4,kinds.length)),CELL_HEIGHT*Math.max(1,Math.ceil(kinds.length/4)),false);
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.03;
    this.renderer.autoClear=false;this.renderer.setClearColor(0x000000,0);
    this.environment=createFishOutdoorEnvironment(this.renderer);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.42;
    this.camera.position.set(0,0,6);this.camera.up.set(0,1,0);this.camera.lookAt(0,0,0);
    this.scene.add(this.sun,this.ambient,new HemisphereLight(0xe0e9e7,0x6a786b,.55),this.renderSlot);
    this.rigs=rigs;
    this.source=new CanvasSource({resource:this.canvas,width:this.canvas.width,height:this.canvas.height,resolution:1,alphaMode:'premultiply-alpha-on-upload',scaleMode:'linear',autoGenerateMipmaps:false});
    this.textures=kinds.map((_,i)=>new Texture({source:this.source,frame:new Rectangle((i%4)*CELL_WIDTH,Math.floor(i/4)*CELL_HEIGHT,CELL_WIDTH,CELL_HEIGHT)}));
    this.render();
  }
  async setKinds(kinds:FishKind[]):Promise<void> {
    const next:KoiRig[]=[];
    try {for(const kind of kinds){await new Promise<void>(resolve=>setTimeout(resolve,0));next.push(createFishRig(kind));}}
    catch(error){next.forEach(rig=>rig.dispose());throw error;}
    this.textures.forEach(texture=>texture.destroy());
    this.rigs.forEach(rig=>{this.renderSlot.remove(rig.group);rig.dispose();});
    this.rigs=next;
    const width=CELL_WIDTH*Math.max(1,Math.min(4,kinds.length)),height=CELL_HEIGHT*Math.max(1,Math.ceil(kinds.length/4));
    this.renderer.setSize(width,height,false);this.source.resize(width,height);
    this.textures=kinds.map((_,i)=>new Texture({source:this.source,frame:new Rectangle((i%4)*CELL_WIDTH,Math.floor(i/4)*CELL_HEIGHT,CELL_WIDTH,CELL_HEIGHT)}));
    this.render();
  }
  render(bodies?:FishBody[],daylight=1,warmth=0):void {
    this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.canvas.width,this.canvas.height);this.renderer.clear();
    this.renderer.setScissorTest(true);
    this.sun.intensity=.65+daylight*1.05;this.ambient.intensity=.42+daylight*.18;
    this.sun.color.setRGB(1,.985-warmth*.10,.940-warmth*.17);
    this.scene.environmentIntensity=.27+daylight*.17;
    for(let i=0;i<this.rigs.length;i++) {
      const body=bodies?.[i],rig=this.rigs[i];
      rig.group.visible=true;
      // Three updates world matrices even for invisible objects. Keeping only
      // this cell's rig attached avoids traversing the whole school per fish.
      this.renderSlot.add(rig.group);
      rig.animate(body?.tailPhase??.3,body?.speed??27,body?.turnVelocity??0);
      rig.group.rotation.x=(body?Math.sin(body.phase+(body.tailPhase*.15))*.055:0)+Math.max(-1.6,Math.min(1.6,body?.turnVelocity??0))*.04;
      rig.group.rotation.y=body?Math.sin(body.tailPhase*.23+body.phase)*.035:0;
      // Move the local light opposite to the heading, so highlights keep the
      // same garden sun direction when Pixi rotates the resulting projection.
      const angle=body?.angle??0,cos=Math.cos(angle),sin=Math.sin(angle);
      this.sun.position.set(-3*cos-4*sin,3*sin-4*cos,7);
      this.scene.environmentRotation.z=-angle;
      const x=(i%4)*CELL_WIDTH,y=this.canvas.height-(Math.floor(i/4)+1)*CELL_HEIGHT;
      this.renderer.setViewport(x,y,CELL_WIDTH,CELL_HEIGHT);this.renderer.setScissor(x,y,CELL_WIDTH,CELL_HEIGHT);
      try {this.renderer.render(this.scene,this.camera);}
      finally {this.renderSlot.remove(rig.group);}
    }
    this.renderer.setScissorTest(false);this.source.update();
  }
  thumbnail(index:number):string {
    const canvas=document.createElement('canvas');canvas.width=CELL_WIDTH;canvas.height=CELL_HEIGHT;
    canvas.getContext('2d')!.drawImage(this.canvas,(index%4)*CELL_WIDTH,Math.floor(index/4)*CELL_HEIGHT,CELL_WIDTH,CELL_HEIGHT,0,0,CELL_WIDTH,CELL_HEIGHT);
    return canvas.toDataURL('image/png');
  }
  hitTest(index:number,localX:number,localY:number):boolean {
    const x=Math.floor(localX+CELL_WIDTH/2),y=Math.floor(localY+CELL_HEIGHT/2);
    if(x<0||y<0||x>=CELL_WIDTH||y>=CELL_HEIGHT)return false;
    if(!this.pickCanvas){this.pickCanvas=document.createElement('canvas');this.pickCanvas.width=CELL_WIDTH;this.pickCanvas.height=CELL_HEIGHT;this.pickContext=this.pickCanvas.getContext('2d',{willReadFrequently:true})!;}
    const context=this.pickContext!;context.clearRect(0,0,CELL_WIDTH,CELL_HEIGHT);
    context.drawImage(this.canvas,(index%4)*CELL_WIDTH,Math.floor(index/4)*CELL_HEIGHT,CELL_WIDTH,CELL_HEIGHT,0,0,CELL_WIDTH,CELL_HEIGHT);
    // Physics includes a fin sweep margin. Selection follows visible pixels so
    // that the clear water inside that safety margin remains usable for food.
    return context.getImageData(x,y,1,1).data[3]>=96;
  }
  renderCatalog():void {
    // Species markings are often on the flanks. Show the real mesh at an angle
    // in the selector, while the pond itself keeps its overhead projection.
    this.camera.position.set(0,-4,5);this.camera.up.set(0,0,1);this.camera.lookAt(0,0,0);this.render();
  }
  getMemoryStats(){return {...this.renderer.info.memory,rigs:this.rigs.length};}
  dispose():void {this.textures.forEach(texture=>texture.destroy());this.source.destroy();this.rigs.forEach(rig=>rig.dispose());this.environment.dispose();this.renderer.dispose();this.renderer.forceContextLoss();}
}
