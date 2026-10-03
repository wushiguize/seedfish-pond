import type { FishKind } from './model';
import { skinNoise } from './skin-detail';
export function koiCanvas(kind: FishKind,part:'all'|'body'='all'): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const c = canvas.getContext('2d')!;c.scale(2,2);
  const gold = kind === 'yamabuki';
  const finColor = gold ? 'rgba(221,185,95,.6)' : 'rgba(218,230,216,.58)';
  c.lineWidth = 1.4; c.strokeStyle = 'rgba(42,62,50,.3)'; c.fillStyle = finColor;
  // Translucent tail and paired pectoral fins.
  c.beginPath(); c.moveTo(73,59); c.bezierCurveTo(47,46,26,28,13,29); c.quadraticCurveTo(24,57,31,64); c.quadraticCurveTo(19,83,13,100); c.bezierCurveTo(41,98,56,76,73,72); c.closePath(); c.fill(); c.stroke();
  if(part==='all')for (const side of [-1,1]) {
    c.beginPath(); c.moveTo(174,64 + side * 16); c.bezierCurveTo(167,64 + side * 41,145,64 + side * 48,135,64 + side * 43); c.quadraticCurveTo(152,64 + side * 24,149,64 + side * 16); c.closePath(); c.fill(); c.stroke();
    for (let i=0;i<4;i++) { c.beginPath(); c.moveTo(166-i*4,64+side*18); c.lineTo(146-i*3,64+side*(39-i*2)); c.stroke(); }
  }
  const body = new Path2D(); body.moveTo(229,64); body.bezierCurveTo(229,47,211,38,185,37); body.bezierCurveTo(133,32,94,44,62,61); body.lineTo(62,68); body.bezierCurveTo(105,88,146,98,188,90); body.bezierCurveTo(211,87,229,80,229,64); body.closePath();
  const base = c.createLinearGradient(0,32,0,97);
  if (gold) { base.addColorStop(0,'#76662f');base.addColorStop(.2,'#c7ab54');base.addColorStop(.43,'#f4dc8e');base.addColorStop(.65,'#ccaf52');base.addColorStop(1,'#5f6535'); }
  else { base.addColorStop(0,'#526d5b');base.addColorStop(.2,'#a4b79d');base.addColorStop(.43,'#e1e4ca');base.addColorStop(.65,'#bdcbb0');base.addColorStop(1,'#506d59'); }
  c.fillStyle=base; c.fill(body); c.save(); c.clip(body);
  const patch = (x:number,y:number,rx:number,ry:number,color:string,rotation=0) => {
    c.save();c.translate(x,y);c.rotate(rotation);c.fillStyle=color;c.shadowColor=color;c.shadowBlur=1;
    c.beginPath();for(let i=0;i<=28;i++){const a=i/28*Math.PI*2,r=1+.12*Math.sin(a*3+x)+.055*Math.sin(a*7+y);const px=Math.cos(a)*rx*r,py=Math.sin(a)*ry*r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fill();c.restore();
  };
  if(kind==='kohaku') { patch(189,49,25,24,'#aa4227',-.2); patch(130,70,29,23,'#b94e2c',.4); patch(86,55,17,12,'#a13b26'); }
  if(kind==='showa') { patch(169,48,25,25,'#20382d',.25); patch(94,65,26,22,'#163329'); patch(209,64,17,19,'#ae4529'); patch(139,73,22,18,'#b04b2b'); patch(127,38,15,17,'#1a3027'); }
  if(kind==='tancho') patch(203,64,17,20,'#b3442b');
  // Subtle small scale arcs follow the body rather than a flat texture grid.
  c.lineWidth=.7; c.strokeStyle=gold?'rgba(102,77,26,.18)':'rgba(65,82,68,.15)';
  for(let x=76;x<201;x+=7) for(let y=38;y<94;y+=6.5) { const xx=x+(Math.round(y/6.5)%2)*3.5;c.beginPath();c.ellipse(xx,y,4.4,3.4,0,-.85,.85);c.stroke();c.strokeStyle='rgba(247,242,210,.25)';c.beginPath();c.ellipse(xx+.5,y-.5,4,3.1,0,-.8,.25);c.stroke();c.strokeStyle=gold?'rgba(78,70,27,.22)':'rgba(39,64,44,.2)'; }
  const highlight=c.createLinearGradient(0,39,0,90); highlight.addColorStop(0,'rgba(9,42,28,.12)');highlight.addColorStop(.4,'rgba(255,252,221,.3)'); highlight.addColorStop(.64,'rgba(255,255,240,0)'); highlight.addColorStop(1,'rgba(0,32,25,.25)'); c.fillStyle=highlight;c.fillRect(60,30,175,65); c.restore();
  c.strokeStyle='rgba(68,78,61,.35)'; c.beginPath(); c.moveTo(191,41); c.quadraticCurveTo(184,64,193,88);c.stroke();
  c.strokeStyle='rgba(238,238,210,.32)';c.beginPath();c.moveTo(99,65);c.quadraticCurveTo(145,56,176,63);c.stroke();
  for(const y of [48,80]) { c.fillStyle='#253e30';c.beginPath();c.ellipse(216,y,2.1,1.5,0,0,Math.PI*2);c.fill();c.fillStyle='#cecfb1';c.beginPath();c.arc(217,y-.6,.5,0,Math.PI*2);c.fill(); }
  c.strokeStyle='rgba(60,67,44,.5)';c.beginPath();c.moveTo(227,59);c.quadraticCurveTo(231,64,226,69);c.stroke();
  c.strokeStyle='rgba(183,194,153,.55)';c.lineWidth=.6;for(const side of [-1,1]){c.beginPath();c.moveTo(224,64+side*6);c.quadraticCurveTo(234,64+side*6,236,64+side*11);c.stroke();}
  return canvas;
}
export function turtleCanvas(): HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=128; const c=canvas.getContext('2d')!;
  const head=new Path2D();head.ellipse(129,64,18,13,0,0,Math.PI*2);
  const skin=c.createLinearGradient(113,54,140,76);skin.addColorStop(0,'#657954');skin.addColorStop(.45,'#899366');skin.addColorStop(1,'#4d6849');
  c.fillStyle=skin;c.strokeStyle='#354d37';c.lineWidth=2;c.fill(head);c.stroke(head);
  c.save();c.clip(head);
  for(let y=53;y<78;y+=3.1)for(let x=113;x<148;x+=3.2){const n=skinNoise(x*.37,y*.4,19);c.strokeStyle=`rgba(38,60,34,${.12+n*.13})`;c.lineWidth=.5;c.beginPath();c.ellipse(x+n*.8,y+n*.9,1.5+n*.4,1.0+n*.3,.2,0,Math.PI*2);c.stroke();}
  c.strokeStyle='#b1b080';c.lineWidth=.9;for(const side of [-1,1]){c.beginPath();c.moveTo(116,64+side*6);c.bezierCurveTo(125,64+side*4,132,64+side*8,143,64+side*7);c.stroke();}c.restore();
  c.fillStyle='#65784d';
  c.beginPath();c.moveTo(34,58);c.lineTo(18,64);c.lineTo(34,70);c.fill();
  const shell=new Path2D();shell.ellipse(80,64,48,39,0,0,Math.PI*2);
  const gradient=c.createRadialGradient(68,48,4,80,64,55);gradient.addColorStop(0,'#979869');gradient.addColorStop(.45,'#727b50');gradient.addColorStop(.85,'#435c3e');gradient.addColorStop(1,'#2b4332');
  c.fillStyle=gradient;c.fill(shell);c.stroke(shell);c.save();c.clip(shell);
  // Irregular vertebral and costal scutes retain the same oval shell outline.
  const scutes:number[][][]=[
    [[34,64],[43,51],[49,56],[49,73],[43,78]],
    [[49,56],[60,44],[69,53],[69,74],[59,84],[49,73]],
    [[69,53],[80,41],[91,53],[91,74],[80,86],[69,74]],
    [[91,53],[102,44],[113,56],[113,73],[102,84],[91,74]],
    [[113,56],[119,51],[126,64],[119,78],[113,73]],
  ];
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const x=43+i*21,inner=side<0?[55,53,53,56][i]:[73,75,75,73][i],outer=64+side*(i===0||i===3?24:32);
    scutes.push([[x,inner],[x+10,inner+side*3],[x+21,inner],[x+22,outer],[x+8,outer+side*3],[x-2,outer+side*1]]);
  }
  const polygon=(vertices:number[][],cx:number,cy:number,scale:number)=>{c.beginPath();vertices.forEach(([x,y],i)=>{const px=cx+(x-cx)*scale,py=cy+(y-cy)*scale;i?c.lineTo(px,py):c.moveTo(px,py);});c.closePath();};
  scutes.forEach((vertices,index)=>{
    const cx=vertices.reduce((sum,p)=>sum+p[0],0)/vertices.length,cy=vertices.reduce((sum,p)=>sum+p[1],0)/vertices.length;
    polygon(vertices,cx,cy,1);c.fillStyle=`rgba(${index%3===0?'93,88,47':'54,74,43'},.13)`;c.fill();c.lineWidth=.9;c.strokeStyle='rgba(31,48,30,.55)';c.stroke();
    for(let ring=1;ring<6;ring++){polygon(vertices,cx,cy,.24+ring*.13);c.lineWidth=.55;c.strokeStyle=`rgba(185,178,118,${.09+(ring%2)*.055})`;c.stroke();}
    c.fillStyle='rgba(206,194,129,.10)';c.beginPath();c.ellipse(cx-1,cy-1,2.7,2.1,.3,0,Math.PI*2);c.fill();
  });
  for(let y=27;y<102;y+=2.3)for(let x=34;x<127;x+=2.6){const n=skinNoise(x*.65,y*.65,47);c.fillStyle=n>.5?'rgba(197,188,122,.12)':'rgba(18,41,24,.10)';c.fillRect(x+n*.8,y+n*.7,.8,.65);}
  c.strokeStyle='rgba(164,165,103,.6)';c.lineWidth=.9;c.beginPath();c.ellipse(80,64,43,34,0,0,Math.PI*2);c.stroke();
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2;c.strokeStyle='rgba(28,47,29,.45)';c.lineWidth=.7;c.beginPath();c.moveTo(80+Math.cos(a)*43,64+Math.sin(a)*34);c.lineTo(80+Math.cos(a)*48,64+Math.sin(a)*39);c.stroke();}c.restore();
  c.fillStyle='#223d2d';for(const y of [57,71]) {c.beginPath();c.arc(138,y,2,0,Math.PI*2);c.fill();c.fillStyle='#bfbe8a';c.beginPath();c.arc(138.5,y-.5,.45,0,Math.PI*2);c.fill();c.fillStyle='#223d2d';} return canvas;
}
export function butterflyCanvas(part:'all'|'left'|'right'|'body'='all'): HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;const c=canvas.getContext('2d')!;c.scale(2,2);
  if(part!=='body')for(const side of [-1,1]) {
    if((part==='left'&&side===1)||(part==='right'&&side===-1))continue;
    c.save();c.translate(40,40);c.scale(side,1);
    const wing=new Path2D();wing.moveTo(0,0);wing.bezierCurveTo(10,-35,37,-30,33,-8);wing.quadraticCurveTo(31,0,15,4);wing.bezierCurveTo(35,11,26,33,10,24);wing.quadraticCurveTo(2,17,0,0);
    const g=c.createRadialGradient(11,-8,2,18,0,34);g.addColorStop(0,'#ddc48a');g.addColorStop(.55,'#bd8e4b');g.addColorStop(.85,'#92713f');g.addColorStop(1,'#514f3a');
    c.fillStyle=g;c.fill(wing);c.strokeStyle='#765740';c.lineWidth=.7;c.stroke(wing);c.save();c.clip(wing);
    // Internal border and pigment cells stay inside the original wing shape.
    c.strokeStyle='#58523c';c.lineWidth=6;c.stroke(wing);
    const tips=[[10,-23],[18,-26],[26,-23],[32,-16],[29,-6],[21,2],[25,9],[26,16],[21,23],[12,24]];
    for(let i=0;i<tips.length-1;i++){
      const [x,y]=tips[i],[nx,ny]=tips[i+1];c.fillStyle=i%3===0?'rgba(224,184,102,.25)':'rgba(89,73,39,.15)';c.beginPath();c.moveTo(2,0);c.quadraticCurveTo(x*.48,y*.58,x,y);c.lineTo(nx,ny);c.quadraticCurveTo(nx*.52,ny*.45,2,0);c.fill();
    }
    c.strokeStyle='rgba(60,61,37,.65)';c.lineWidth=.38;
    tips.forEach(([x,y],i)=>{c.beginPath();c.moveTo(2,0);c.bezierCurveTo(8,y*.16,x*.61,y*.61,x,y);c.stroke();if(i%2===0){c.lineWidth=.22;c.beginPath();c.moveTo(x*.63,y*.61);c.quadraticCurveTo(x*.86,y*.47,x+3,y+3);c.stroke();c.lineWidth=.38;}});
    c.strokeStyle='rgba(63,56,33,.45)';c.lineWidth=.32;c.beginPath();c.moveTo(9,-11);c.bezierCurveTo(17,-14,24,-10,27,-5);c.moveTo(10,10);c.quadraticCurveTo(17,12,23,13);c.stroke();
    for(let y=-29;y<28;y+=1.15)for(let x=2;x<35;x+=1.2){const n=skinNoise(x*1.7,y*1.6,67);c.fillStyle=n>.52?'rgba(239,214,149,.15)':'rgba(66,53,32,.13)';c.beginPath();c.arc(x+n*.5,y+n*.5,.12+n*.12,0,Math.PI*2);c.fill();}
    c.fillStyle='#e1cc90';for(const [x,y] of [[26,-21],[30,-14],[27,-5],[26,12],[21,22]]){c.beginPath();c.ellipse(x,y,1.1,1.7,-.28,0,Math.PI*2);c.fill();}
    c.restore();c.restore();
  }
  if(part==='all'||part==='body'){
    const body=c.createLinearGradient(39,0,41,0);body.addColorStop(0,'#343f31');body.addColorStop(.5,'#77775a');body.addColorStop(1,'#343c2e');
    c.strokeStyle=body;c.lineWidth=2;c.beginPath();c.moveTo(40,24);c.lineTo(40,54);c.stroke();
    c.strokeStyle='#354030';c.lineWidth=.28;for(let y=29;y<53;y+=2.2){c.beginPath();c.moveTo(39.2,y);c.lineTo(40.8,y+.1);c.stroke();}
    c.strokeStyle='#374033';c.lineWidth=.7;c.beginPath();c.moveTo(40,26);c.quadraticCurveTo(33,19,34,17);c.moveTo(40,26);c.quadraticCurveTo(47,19,46,17);c.stroke();
  }return canvas;
}

export function koiFinCanvas(kind:FishKind):HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;const c=canvas.getContext('2d')!;c.scale(2,2);
  const g=c.createLinearGradient(42,6,16,36);g.addColorStop(0,kind==='yamabuki'?'rgba(213,180,87,.8)':'rgba(176,195,173,.8)');g.addColorStop(1,kind==='yamabuki'?'rgba(192,166,87,.13)':'rgba(173,195,176,.13)');
  c.fillStyle=g;c.beginPath();c.moveTo(44,4);c.bezierCurveTo(29,7,15,17,8,34);c.quadraticCurveTo(20,40,31,29);c.quadraticCurveTo(43,20,44,4);c.fill();c.lineWidth=.5;c.strokeStyle='rgba(83,111,95,.25)';for(let i=0;i<7;i++){c.beginPath();c.moveTo(43,6);c.quadraticCurveTo(31-i*1.7,19,12+i*2.4,34-i*.8);c.stroke();}return canvas;
}
export function turtleLegCanvas():HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=56;const c=canvas.getContext('2d')!;const g=c.createLinearGradient(5,10,64,36);g.addColorStop(0,'#627848');g.addColorStop(.55,'#929c5e');g.addColorStop(1,'#576c3c');
  const leg=new Path2D();leg.moveTo(7,12);leg.bezierCurveTo(28,7,52,23,68,43);leg.quadraticCurveTo(40,52,7,29);leg.closePath();
  c.fillStyle=g;c.fill(leg);c.save();c.clip(leg);
  for(let y=10;y<51;y+=3.1)for(let x=9;x<70;x+=3.4){const n=skinNoise(x*.45,y*.5,29);c.strokeStyle=`rgba(34,61,34,${.17+n*.14})`;c.lineWidth=.5;c.beginPath();c.ellipse(x+n*.8,y+n*.6,1.5+n*.5,1.2+n*.3,.4,0,Math.PI*2);c.stroke();}
  c.strokeStyle='rgba(34,61,34,.30)';c.lineWidth=.7;for(let i=0;i<5;i++){c.beginPath();c.moveTo(20+i*5,20);c.quadraticCurveTo(37+i*3,30,47+i*4,43);c.stroke();}c.restore();return canvas;
}
export function mistCanvas():HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const c=canvas.getContext('2d')!;c.scale(1,.3);const g=c.createRadialGradient(256,260,5,256,260,245);g.addColorStop(0,'rgba(223,235,224,.4)');g.addColorStop(.5,'rgba(218,231,225,.16)');g.addColorStop(1,'rgba(213,228,222,0)');c.fillStyle=g;c.fillRect(0,0,512,540);return canvas;
}
export function snowBankCanvas(background:CanvasImageSource):HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;const c=canvas.getContext('2d')!;
  c.drawImage(background,0,0,1600,900);const pixels=c.getImageData(0,0,1600,900);
  for(let y=0;y<900;y++)for(let x=0;x<1600;x++){
    const n=(y*1600+x)*4,r=pixels.data[n],g=pixels.data[n+1],b=pixels.data[n+2];
    const distance=Math.hypot((x-800)/760,(y-460)/415),shore=Math.min(1,Math.max(0,(distance-.93)/.14));
    const neutral=Math.min(1,Math.max(0,(r/(g+1)-.69)*4)),exposure=Math.min(1,Math.max(0,((r+g+b)/765-.16)*2));
    const grain=.8+.2*Math.sin(x*.21+Math.sin(y*.06))*Math.sin(y*.17);
    pixels.data[n]=232;pixels.data[n+1]=239;pixels.data[n+2]=232;pixels.data[n+3]=Math.round(shore*neutral*(.25+exposure*.75)*grain*205);
  }
  c.putImageData(pixels,0,0);return canvas;
}
