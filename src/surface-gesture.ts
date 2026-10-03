/** A click feeds; a deliberate drag stirs. Distances are CSS pixels. */
export class SurfaceGesture {
  private start:{x:number;y:number;pointer:number}|null=null;
  private last:{x:number;y:number}|null=null;
  private dragging=false;
  begin(pointer:number,x:number,y:number):void {this.start={pointer,x,y};this.last={x,y};this.dragging=false;}
  move(pointer:number,x:number,y:number):boolean {
    if(!this.start||!this.last||pointer!==this.start.pointer)return false;
    if(Math.hypot(x-this.start.x,y-this.start.y)<8&&!this.dragging)return false;
    this.dragging=true;
    if(Math.hypot(x-this.last.x,y-this.last.y)<12)return false;
    this.last={x,y};return true;
  }
  end(pointer:number,x:number,y:number):'tap'|'drag'|null {
    if(!this.start||pointer!==this.start.pointer)return null;
    const result=this.dragging||Math.hypot(x-this.start.x,y-this.start.y)>=8?'drag':'tap';this.cancel();return result;
  }
  cancel():void {this.start=this.last=null;this.dragging=false;}
}
