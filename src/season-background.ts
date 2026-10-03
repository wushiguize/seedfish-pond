import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { WORLD } from './model';
import type { Season } from './lake-environment';

const SEASONS: readonly Season[] = ['spring','summer','autumn','winter'];

/** The exact same photographic shoreline, with real seasonal bed/stone detail. */
export class SeasonalBackgroundLayer extends Container {
  private layers = new Map<Season,Sprite>();
  private pending = new Set<Season>();
  private failed = new Set<Season>();
  private weights = new Map<Season,number>();
  private closed = false;

  static async create(season:Season):Promise<SeasonalBackgroundLayer> {
    const layer=new SeasonalBackgroundLayer();
    await layer.load(season);
    if(!layer.layers.size)throw new Error('Seasonal lake background failed to load');
    layer.update(Object.fromEntries(SEASONS.map(s=>[s,s===season?1:0])) as Record<Season,number>);
    return layer;
  }
  get sourceTexture():Texture {return this.layers.values().next().value!.texture;}

  private async load(season:Season):Promise<void> {
    if(this.layers.has(season)||this.pending.has(season)||this.failed.has(season)||this.closed)return;
    this.pending.add(season);
    try {
      const texture=await Assets.load<Texture>(new URL(`./assets/lake-season-${season}-v6.png`,document.baseURI).href);
      if(this.closed)return;
      const sprite=new Sprite(texture);sprite.width=WORLD.width;sprite.height=WORLD.height;
      sprite.label=season;sprite.alpha=0;this.layers.set(season,sprite);this.addChild(sprite);
      this.children.sort((a,b)=>SEASONS.indexOf(a.label as Season)-SEASONS.indexOf(b.label as Season));
      this.applyWeights();
    } catch(error) {
      this.failed.add(season);console.warn(`Seasonal background unavailable: ${season}`,error);
    } finally {this.pending.delete(season);}
  }
  update(mix:Record<Season,number>):void {
    for(const season of SEASONS){const weight=Math.max(0,mix[season]??0);this.weights.set(season,weight);if(weight>.005)void this.load(season);}
    this.applyWeights();
  }
  private applyWeights():void {
    // Source-over alpha must account for the cumulative lower layers. This
    // creates a weighted crossfade without making the lake see-through/darker.
    let cumulative=0;
    for(const season of SEASONS){const layer=this.layers.get(season);if(!layer)continue;const weight=this.weights.get(season)??0;cumulative+=weight;layer.alpha=cumulative>0?weight/cumulative:0;layer.visible=layer.alpha>.0001;}
    if(cumulative===0&&this.layers.size){const fallback=this.layers.values().next().value!;fallback.alpha=1;fallback.visible=true;}
  }
  override destroy():void {this.closed=true;super.destroy({children:true});}
}
