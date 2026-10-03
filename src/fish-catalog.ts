import type { FishKind, FishRecord } from './model';
import {getAnatomicalMouthX} from './fish-anatomy';

export const MAX_FISH=24;
export const MAX_OWNED_FISH=64;
// Keep the existing species proportions, with more open water around each fish.
export const POND_FISH_SCALE=.8;
export type FishFamily='koi'|'goldfish'|'small'|'bottom'|'livebearer'|'labyrinth'|'cichlid'|'large';
export type FishMorphology='carp'|'singleTail'|'doubleTail'|'ricefish'|'danio'|'tetra'|'walkingCatfish'|'fanTail'|'swordTail'|'betta'|'gourami'|'angel'|'discus'|'cichlid'|'barb'|'rasbora'|'hatchet'|'armoredCatfish'|'pleco'|'loach'|'eelLoach'|'pictus'|'arowana'|'ray'|'rainbow'|'shark';
export interface FishVolume {length:number;width:number;height:number;offset:number;clearance:number}
export interface FishDefinition {
  kind:FishKind;
  name:string;
  family:FishFamily;
  tag:string;
  description:string;
  size:number;
  speed:number;
  mouthOffset:number;
  scientificName:string;
  morphology:FishMorphology;
  sourceUrl:string;
  volume:FishVolume;
}
export const FISH_FAMILIES:Record<FishFamily,string>={koi:'锦鲤',goldfish:'金鱼',small:'小型鱼',bottom:'底栖鱼',livebearer:'胎生鱼',labyrinth:'斗鱼与丝足',cichlid:'慈鲷',large:'大型与特色鱼'};
const volumes:Record<FishMorphology,FishVolume>={
  carp:{length:1.14,width:.39,height:.39,offset:-.18,clearance:9},
  singleTail:{length:1.14,width:.35,height:.42,offset:-.18,clearance:4},
  doubleTail:{length:1.15,width:.49,height:.71,offset:-.20,clearance:13},
  ricefish:{length:1.09,width:.21,height:.20,offset:-.14,clearance:4},
  danio:{length:1.13,width:.32,height:.34,offset:-.17,clearance:4},
  tetra:{length:1.15,width:.36,height:.42,offset:-.18,clearance:5},
  walkingCatfish:{length:1.14,width:.52,height:.28,offset:-.18,clearance:8},
  fanTail:{length:1.18,width:.35,height:.51,offset:-.20,clearance:5},
  swordTail:{length:1.25,width:.37,height:.57,offset:-.24,clearance:5},
  betta:{length:1.19,width:.41,height:.62,offset:-.20,clearance:6},
  gourami:{length:1.14,width:.43,height:.69,offset:-.18,clearance:5},
  angel:{length:1.13,width:.40,height:.78,offset:-.17,clearance:6},
  discus:{length:1.08,width:.38,height:.67,offset:-.14,clearance:6},
  cichlid:{length:1.16,width:.46,height:.58,offset:-.18,clearance:6},
  barb:{length:1.17,width:.43,height:.52,offset:-.19,clearance:5},
  rasbora:{length:1.15,width:.36,height:.42,offset:-.18,clearance:5},
  hatchet:{length:1.15,width:.52,height:.60,offset:-.18,clearance:5},
  armoredCatfish:{length:1.13,width:.49,height:.43,offset:-.16,clearance:6},
  pleco:{length:1.18,width:.58,height:.43,offset:-.20,clearance:5},
  loach:{length:1.17,width:.36,height:.38,offset:-.19,clearance:5},
  eelLoach:{length:1.16,width:.32,height:.25,offset:-.20,clearance:6},
  pictus:{length:1.15,width:.63,height:.43,offset:-.18,clearance:5},
  arowana:{length:1.19,width:.37,height:.38,offset:-.22,clearance:5},
  ray:{length:1.20,width:.65,height:.20,offset:-.21,clearance:7},
  rainbow:{length:1.17,width:.41,height:.56,offset:-.19,clearance:5},
  shark:{length:1.18,width:.43,height:.52,offset:-.20,clearance:5},
};
const oldMorphologies:Partial<Record<FishKind,FishMorphology>>={goldfish:'singleTail',ryukin:'doubleTail',medaka:'ricefish',zebrafish:'danio',neon:'tetra',catfish:'walkingCatfish'};
const oldSpecies:Partial<Record<FishKind,string>>={goldfish:'Carassius auratus',ryukin:'Carassius auratus',medaka:'Oryzias latipes',zebrafish:'Danio rerio',neon:'Paracheirodon innesi',catfish:'Clarias batrachus'};
const entry=(kind:FishKind,name:string,family:FishFamily,tag:string,description:string,size:number,speed:number,scientificName=oldSpecies[kind]??'Cyprinus carpio',morphology:FishMorphology=oldMorphologies[kind]??'carp'):FishDefinition=>({kind,name,family,tag,description,size:size*POND_FISH_SCALE,speed,mouthOffset:size*POND_FISH_SCALE*(384/2.7)*getAnatomicalMouthX(kind),scientificName,morphology,sourceUrl:`https://www.fishbase.se/summary/${scientificName.replaceAll(' ','-')}.html`,volume:{...volumes[morphology],...(kind==='neon'?{width:.25,height:.40}:{} )}});

// This is a virtual ornamental collection. Category metadata does not claim
// that species share the same real-world temperature or husbandry needs.
export const FISH_CATALOG:FishDefinition[]=[
  entry('kohaku','红白锦鲤','koi','红白相间','修长饱满的鱼身，白底上的朱红色斑。',.47,27),
  entry('showa','昭和锦鲤','koi','三色锦鲤','黑、红、白三色交错，花纹沿着鱼背展开。',.54,30),
  entry('yamabuki','山吹黄金','koi','金色鳞光','通体暖金色，转身时有细密的鳞片光泽。',.5,33),
  entry('platinum','白金锦鲤','koi','银白鳞光','银白鱼身，柔和的珍珠色反光。',.45,29),
  entry('tancho','丹顶锦鲤','koi','一点朱红','素白身体与头顶的一抹红色。',.52,35),
  entry('goldfish','草金鱼','goldfish','橙红单尾','明亮的橙红色，圆钝头部与展开的单尾。',.37,26),
  entry('ryukin','琉金金鱼','goldfish','圆身双尾','短圆而高的鱼身，独立展开的双尾。',.34,20),
  entry('medaka','青鳉','small','轻盈透明','纤细的小鱼，清透的鱼鳍与灵活的游动。',.18,34),
  entry('zebrafish','斑马鱼','small','蓝银条纹','蓝黑色条纹沿着银白鱼身延伸。',.22,42),
  entry('neon','红绿灯鱼','small','蓝红光带','蓝色亮带和红色下腹，为水中添一点颜色。',.2,32),
  entry('catfish','胡子鲶','bottom','长身触须','扁宽的头部、长背鳍与嘴边的多对触须。',.49,23),
  entry('guppy','孔雀鱼','livebearer','扇尾雄鱼','纤细前身与宽大的彩色扇尾，采用雄鱼观赏品系造型。',.22,31,'Poecilia reticulata','fanTail'),
  entry('endler','安德拉斯孔雀鱼','livebearer','小巧斑色','身形更小、更细，蓝绿斑色与短扇尾。',.18,34,'Poecilia wingei','fanTail'),
  entry('molly','黑玛丽','livebearer','黑色高背','深色而丰满的身体，宽尾与展开的背鳍。',.29,28,'Poecilia sphenops','fanTail'),
  entry('platy','月光鱼','livebearer','短身圆尾','短而丰满的橘红鱼身，尾柄较厚、尾缘圆钝。',.25,26,'Xiphophorus maculatus','fanTail'),
  entry('swordtail','剑尾鱼','livebearer','雄鱼剑尾','修长的橙色鱼身，尾鳍下叶延伸成剑。',.31,35,'Xiphophorus hellerii','swordTail'),
  entry('betta','暹罗斗鱼','labyrinth','长鳍雄鱼','蓝红鱼身、大扇尾与柔软的长背鳍、臀鳍。',.27,19,'Betta splendens','betta'),
  entry('paradise','中国斗鱼','labyrinth','蓝红条纹','红蓝横列的体侧花纹，尖长的鳍端与分叉尾。',.31,25,'Macropodus opercularis','betta'),
  entry('pearlgourami','珍珠马甲','labyrinth','珠点丝足','细密珠点、体侧暗线与细长的触须状腹鳍。',.34,23,'Trichopodus leerii','gourami'),
  entry('dwarfgourami','丽丽鱼','labyrinth','红蓝竖纹','扁高的身体、红蓝交错条纹和细长腹鳍。',.28,23,'Trichogaster lalius','gourami'),
  entry('honeygourami','蜜蜂丽丽','labyrinth','蜜黄色','较小的金蜜色身体，尾缘圆钝，腹鳍纤长。',.23,24,'Trichogaster chuna','gourami'),
  entry('angelfish','神仙鱼','cichlid','高鳍丝腹','银色侧扁的身体，高背鳍、高臀鳍与长丝状腹鳍。',.34,21,'Pterophyllum scalare','angel'),
  entry('discus','七彩神仙','cichlid','圆盘鱼身','近圆盘形的侧扁鱼身，连续的背鳍和臀鳍环绕外缘。',.34,19,'Symphysodon aequifasciatus','discus'),
  entry('oscar','地图鱼','cichlid','厚身斑驳','厚实的头部、宽圆尾鳍与橙黑斑纹。',.44,24,'Astronotus ocellatus','cichlid'),
  entry('ram','荷兰凤凰','cichlid','蓝点黑眼带','高而短的身体，金黄色底色、蓝色细点与黑色眼带。',.26,24,'Mikrogeophagus ramirezi','cichlid'),
  entry('kribensis','非洲凤凰','cichlid','紫腹暗线','修长的体型、暗色侧线与偏紫色的腹部。',.28,27,'Pelvicachromis pulcher','cichlid'),
  entry('bolivianram','玻利维亚凤凰','cichlid','银沙红鳍','沙银色鱼身、黑色体斑与红色鳍缘。',.30,24,'Mikrogeophagus altispinosus','cichlid'),
  entry('convict','斑马慈鲷','cichlid','黑白竖带','灰银色丰满鱼身，明显的黑色竖向条带。',.32,25,'Amatitlania nigrofasciata','cichlid'),
  entry('jewel','宝石鱼','cichlid','红身蓝点','红色鱼身上散布蓝色珠点，背鳍较长。',.31,26,'Hemichromis bimaculatus','cichlid'),
  entry('severum','菠萝鱼','cichlid','高身细纹','黄绿色的高体型、圆尾与柔和暗色竖纹。',.38,22,'Heros efasciatus','cichlid'),
  entry('electricyellow','非洲王子','cichlid','黄身黑鳍缘','明亮的黄色身体，背鳍与腹鳍呈深色边缘。',.32,27,'Labidochromis caeruleus','cichlid'),
  entry('tigerbarb','虎皮鱼','small','四条黑带','高背金色鱼身，四条黑色竖带与橙红鳍。',.26,35,'Puntigrus tetrazona','barb'),
  entry('cherrybarb','樱桃鲃','small','红身暗线','纤细红色鱼身，暗线沿体侧延伸到尾柄。',.23,32,'Puntius titteya','barb'),
  entry('rosybarb','玫瑰鲃','small','玫瑰金鳞','更丰满的玫瑰金色鱼身，尾柄处有暗斑。',.29,34,'Pethia conchonius','barb'),
  entry('harlequin','三角灯鱼','small','楔形黑斑','铜粉色的高身小鱼，后半身有三角形黑斑。',.22,32,'Trigonostigma heteromorpha','rasbora'),
  entry('whitemountain','白云金丝','small','金线红尾','瘦长的银棕鱼身，淡金侧线、红尾与白色鳍端。',.22,34,'Tanichthys albonubes','danio'),
  entry('cardinal','宝莲灯','small','通长蓝红带','蓝色体侧线和延伸至头部下方的红色腹带。',.21,31,'Paracheirodon axelrodi','tetra'),
  entry('rummynose','红鼻剪刀','small','红头银身','红色头部、银色身体和黑白相间的尾鳍。',.23,33,'Petitella bleheri','tetra'),
  entry('ember','火焰灯鱼','small','透明橙红','小巧的橘红鱼身与轻薄鳍膜。',.18,30,'Hyphessobrycon amandae','tetra'),
  entry('blackneon','黑莲灯','small','白金黑线','银白亮线与深黑侧线相邻，背部偏橄榄色。',.22,32,'Hyphessobrycon herbertaxelrodi','tetra'),
  entry('glowlight','红灯管','small','橙红光线','浅银色体表上，橙红细线从眼部延伸至尾柄。',.21,31,'Hemigrammus erythrozonus','tetra'),
  entry('lemontetra','柠檬灯鱼','small','黄身红眼','淡柠檬色的高体型，黑色鳍缘和红色眼圈。',.23,31,'Hyphessobrycon pulchripinnis','tetra'),
  entry('congotetra','刚果美人','small','彩鳞长尾','虹彩体色、更高的鱼身与雄鱼延长的中央尾叶。',.29,30,'Phenacogrammus interruptus','rainbow'),
  entry('silverhatchet','银斧鱼','small','深腹长胸鳍','银色刀片形腹部，向外展开的长胸鳍。',.25,29,'Gasteropelecus sternicla','hatchet'),
  entry('corydoras','花椒鼠鱼','bottom','装甲短须','圆钝的头部、斑驳体色、骨板和嘴边短须。',.26,23,'Hoplisoma paleatum','armoredCatfish'),
  entry('bristlenose','胡子异型','bottom','吸盘口鼻','扁宽头部、吸盘状口部与短小的鼻须。',.34,20,'Ancistrus cirrhosus','pleco'),
  entry('clownloach','小丑鳅','bottom','橙黑三带','橙黄色较高的鱼身，三条黑带与短口须。',.34,28,'Chromobotia macracanthus','loach'),
  entry('kuhliloach','库利鳅','bottom','鳗状环纹','细长的鳗状身形，棕黑色环带与小型后置鳍。',.28,26,'Pangio kuhlii','eelLoach'),
  entry('dojo','泥鳅','bottom','细长斑点','细长而柔软的褐色身体，小圆尾与短口须。',.33,24,'Misgurnus anguillicaudatus','eelLoach'),
  entry('pictus','豹纹鲶','bottom','银斑长须','银灰色身体、明显暗斑与向两侧展开的长须。',.36,25,'Pimelodus pictus','pictus'),
  entry('otocinclus','小精灵','bottom','暗线吸盘','小型贴底身形，体侧暗线与下置吸盘状口部。',.21,24,'Otocinclus vittatus','pleco'),
  entry('arowana','银龙鱼','large','长身双须','银色修长的鱼身、大鳞片和沿后背、后腹延伸的长鳍。',.55,25,'Osteoglossum bicirrhosum','arowana'),
  entry('stingray','珍珠魟','large','扁盘长尾','淡水魟的扁平圆盘、背侧眼睛、珠点花纹与细长尾。',.40,19,'Potamotrygon motoro','ray'),
  entry('boesemani','波氏彩虹鱼','large','蓝橙双色','高体型的前蓝后橙鱼身，分开的两段背鳍。',.34,32,'Melanotaenia boesemani','rainbow'),
  entry('rainbowshark','彩虹鲨','large','灰身红鳍','深灰纺锤形身体、醒目的红色鳍与尾柄。',.37,30,'Epalzeorhynchos frenatum','shark'),
  entry('balashark','银鲨','large','银身黑鳍缘','修长而高背的银色鱼身，深叉尾和黑色鳍缘。',.44,34,'Balantiocheilos melanopterus','shark'),
];
const definitions=new Map(FISH_CATALOG.map(fish=>[fish.kind,fish]));
export function isFishKind(value:unknown):value is FishKind {return typeof value==='string'&&definitions.has(value as FishKind);}
export function getFishDefinition(kind:FishKind):FishDefinition {
  const definition=definitions.get(kind);if(!definition)throw new Error('鱼种不存在');return definition;
}
export function createFishRecord(kind:FishKind,owned:FishRecord[]):FishRecord {
  const definition=getFishDefinition(kind);
  let index=1,name=definition.name;
  while(owned.some(fish=>fish.name===name))name=`${definition.name} ${index++}`;
  return {id:`fish-${crypto.randomUUID()}`,kind,name,eaten:0};
}
