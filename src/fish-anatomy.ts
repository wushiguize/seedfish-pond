import type { FishKind } from './model';
import {EXTRA_FISH_ANATOMIES} from './fish-anatomy-extra';

export type AnatomicalSection=[number,number,number,number,number];
export type TailForm='fork'|'round'|'fan'|'veil'|'double'|'sword'|'lyre'|'whip'|'truncate';
export interface FishAnatomy {
  profile:AnatomicalSection[];
  eye:{x:number;radius:number;lift:number};
  gillX:number;mouthX:number;mouthZ:number;
  mouthWidth:number;mouthHeight:number;
  tail:{form:TailForm;length:number;height:number;notch:number};
  dorsal:[number,number][];anal:[number,number][];
  adipose?:{x:number;height:number;length:number};
  pectoral:{x:number;length:number;reach:number};pelvic:{x:number;length:number;reach:number;filament?:number};
  barbels:number;barbelLength:number;
  crossSection:number;scaleColumns:number;scaleRows:number;scales:boolean;
  base:string;accent:string;fin:string;pattern:string;seed:number;bend:number;
  notes:string;referenceUrl:string;
}
const stations=[-.78,-.65,-.46,-.23,.01,.24,.43,.58,.70,.80,.88,.924];
const profile=(w:number[],top:number[],bottom:number[],center:number[]=[],xs=stations):AnatomicalSection[]=>xs.map((x,i)=>[x,w[i],top[i],bottom[i],center[i]??0]);
const make=(kind:FishKind,p:AnatomicalSection[],overrides:Partial<FishAnatomy>):FishAnatomy=>({profile:p,eye:{x:.735,radius:.018,lift:.20},gillX:.48,mouthX:.916,mouthZ:-.018,mouthWidth:.025,mouthHeight:.013,
  tail:{form:'fork',length:.43,height:.18,notch:.24},dorsal:[[.34,0],[.23,.10],[.03,.14],[-.24,.12],[-.54,.035],[-.63,0]],anal:[[-.25,0],[-.32,.065],[-.49,.09],[-.60,0]],
  pectoral:{x:.40,length:.23,reach:.21},pelvic:{x:-.20,length:.15,reach:.13},barbels:0,barbelLength:0,crossSection:1,scaleColumns:42,scaleRows:24,scales:true,
  base:'#abb2a2',accent:'#697e73',fin:'#aab5a2',pattern:'solid',seed:[...kind].reduce((n,c)=>(n*31+c.charCodeAt(0))%100007,13),bend:1,
  notes:'Independently specified caudal peduncle, shoulder, operculum, forehead and blunt snout stations.',referenceUrl:'https://www.fishbase.se/summary/Cyprinus-carpio.html',...overrides});

// Explicit specimen landmark sections: x, half-width, back, belly, center Z.
// The body outline is not generated from a universal sine/spindle equation.
// These are manual anatomical interpretations, not scan measurements.
export const FISH_ANATOMIES:Partial<Record<FishKind,FishAnatomy>>={
  ...EXTRA_FISH_ANATOMIES,
  kohaku:make('kohaku',profile([.029,.041,.066,.111,.153,.180,.185,.172,.139,.103,.064,.025],[.040,.057,.085,.125,.158,.181,.173,.148,.113,.079,.046,.023],[.028,.039,.060,.090,.119,.133,.132,.118,.099,.070,.046,.021],[-.008,-.004,.005,.011,.017,.015,.002,-.011,-.024,-.027,-.025,-.022]),{base:'#d2d0bc',accent:'#a74328',pattern:'kohaku',barbels:2,barbelLength:.072,mouthZ:-.043,notes:'Carp: thick shoulder, rounded forehead, two barbel pairs and long low dorsal; separate red dorsal saddles.'}),
  showa:make('showa',profile([.031,.047,.076,.125,.166,.195,.198,.181,.148,.110,.072,.028],[.040,.062,.094,.135,.171,.190,.181,.153,.115,.080,.049,.025],[.030,.042,.066,.098,.129,.144,.142,.128,.104,.075,.048,.024],[-.010,-.002,.007,.011,.014,.012,.002,-.010,-.023,-.027,-.026,-.024]),{base:'#ccc9b4',accent:'#b04b2b',pattern:'showa',barbels:2,barbelLength:.080,mouthZ:-.046,tail:{form:'fork',length:.43,height:.195,notch:.24},notes:'Broad-headed carp, deep caudal peduncle; red saddles and irregular sumi extending onto flanks.'}),
  yamabuki:make('yamabuki',profile([.026,.038,.061,.105,.140,.163,.174,.161,.134,.099,.062,.024],[.036,.052,.080,.116,.147,.167,.164,.139,.106,.074,.045,.022],[.027,.038,.058,.084,.108,.122,.124,.111,.095,.068,.043,.022],[-.008,-.003,.006,.010,.013,.010,.001,-.013,-.024,-.026,-.024,-.023]),{base:'#bc9c55',accent:'#cfb979',pattern:'gold',barbels:2,barbelLength:.071,mouthZ:-.043,notes:'Lean metallic carp with restrained gold, visible scale pockets and unmarked creamy fins.'}),
  platinum:make('platinum',profile([.028,.040,.065,.111,.149,.170,.177,.165,.138,.105,.065,.025],[.037,.054,.084,.121,.151,.172,.167,.143,.112,.079,.048,.023],[.028,.037,.059,.087,.112,.125,.130,.119,.099,.070,.045,.022],[-.006,-.001,.005,.009,.012,.011,.001,-.010,-.023,-.025,-.024,-.021]),{base:'#bbc3bb',accent:'#d1d6cb',pattern:'silver',barbels:2,barbelLength:.070,mouthZ:-.040,notes:'Silver carp with cream underside, darker embedded scale edges, blunt small mouth and neutral fins.'}),
  tancho:make('tancho',profile([.030,.042,.070,.116,.154,.178,.184,.173,.142,.106,.068,.026],[.039,.055,.086,.127,.161,.180,.173,.149,.116,.082,.050,.024],[.029,.040,.063,.092,.121,.134,.135,.122,.102,.073,.047,.023],[-.008,-.002,.006,.011,.015,.012,.001,-.012,-.024,-.027,-.025,-.022]),{base:'#cacdbf',accent:'#aa4029',pattern:'tancho',barbels:2,barbelLength:.075,mouthZ:-.043,notes:'White carp with a restrained red cranial patch placed on the forehead, unmarked body and fins.'}),
  betta:make('betta',profile([.028,.039,.061,.078,.091,.102,.099,.087,.071,.056,.036,.017],[.047,.066,.099,.133,.145,.152,.141,.123,.092,.064,.039,.019],[.033,.049,.073,.100,.111,.118,.110,.094,.072,.053,.032,.017],[0,0,.002,.004,.006,.005,.001,0,-.006,-.006,-.005,-.004],[-.50,-.40,-.25,-.07,.13,.32,.49,.63,.75,.83,.89,.924]),{base:'#4e737d',accent:'#864b47',fin:'#80645f',pattern:'betta',eye:{x:.775,radius:.015,lift:.22},gillX:.57,mouthZ:.008,tail:{form:'veil',length:.67,height:.36,notch:.62},dorsal:[[.13,0],[.07,.12],[-.06,.20],[-.22,.26],[-.43,.18],[-.49,0]],anal:[[.35,0],[.24,.18],[.03,.25],[-.22,.31],[-.46,.22],[-.50,0]],pelvic:{x:.33,length:.18,reach:.08,filament:.19},scaleColumns:28,scaleRows:20,bend:.62,referenceUrl:'https://www.fishbase.se/summary/Betta-splendens.html',notes:'Long-fin ornamental male: small head/eye, upturned mouth, long anal skirt, separate folded dorsal and veil caudal rays.'}),
  angelfish:make('angelfish',profile([.025,.039,.054,.063,.068,.071,.070,.065,.054,.039,.024,.013],[.076,.145,.247,.325,.345,.325,.280,.224,.164,.108,.055,.019],[.057,.139,.228,.309,.325,.296,.246,.193,.140,.092,.045,.017],[0,0,.005,.010,.012,.014,.006,0,-.010,-.012,-.005,0],[-.36,-.29,-.14,.05,.22,.39,.52,.64,.75,.83,.89,.924]),{base:'#b7beb1',accent:'#4b5750',fin:'#a6b0a1',pattern:'angel',eye:{x:.765,radius:.015,lift:.14},gillX:.61,mouthWidth:.015,mouthHeight:.010,tail:{form:'fan',length:.48,height:.20,notch:.40},dorsal:[[.48,0],[.37,.14],[.19,.29],[-.05,.40],[-.27,.25],[-.35,0]],anal:[[.43,0],[.31,.15],[.12,.28],[-.12,.36],[-.32,.24],[-.36,0]],pelvic:{x:.42,length:.23,reach:.065,filament:.42},pectoral:{x:.57,length:.19,reach:.15},scaleColumns:30,scaleRows:24,bend:.42,referenceUrl:'https://www.fishbase.se/summary/4717',notes:'Laterally compressed deep body; pointed sail dorsal/anal, long ventral filaments, small forward muzzle and four irregular vertical bars.'}),
  catfish:make('catfish',profile([.023,.035,.060,.098,.143,.194,.236,.251,.236,.203,.136,.088],[.043,.059,.080,.105,.120,.126,.109,.079,.058,.041,.024,.013],[.027,.037,.052,.076,.090,.088,.070,.056,.046,.035,.024,.013],[-.002,0,.003,.003,.004,.004,.003,0,0,0,0,0],[-.92,-.80,-.60,-.34,-.05,.25,.48,.63,.75,.84,.90,.924]),{base:'#636e5d',accent:'#8a9281',fin:'#727d65',pattern:'catfish',eye:{x:.724,radius:.009,lift:.70},gillX:.41,mouthZ:-.025,mouthWidth:.088,mouthHeight:.014,tail:{form:'round',length:.30,height:.13,notch:.27},dorsal:[[.33,0],[.22,.050],[-.10,.070],[-.43,.065],[-.77,.040],[-.89,0]],anal:[[.04,0],[-.14,.042],[-.40,.055],[-.70,.052],[-.86,.025],[-.90,0]],pectoral:{x:.49,length:.22,reach:.21},pelvic:{x:-.16,length:.16,reach:.13},barbels:4,barbelLength:.38,crossSection:.64,scales:false,scaleColumns:0,scaleRows:0,bend:1.17,referenceUrl:'https://www.fws.gov/sites/default/files/documents/Ecological-Risk-Screening-Summary-Walking-Catfish.pdf',notes:'Clarias: flattened broad skull, tiny dorsolateral eyes, wide ventral mouth, four unequal barbel pairs and near-continuous low dorsal/anal fins.'}),
  stingray:make('stingray',profile([.014,.180,.375,.510,.552,.532,.442,.325,.221,.135,.060,.016],[.007,.017,.027,.039,.049,.061,.055,.040,.028,.018,.009,.005],[.005,.012,.019,.025,.027,.023,.019,.016,.013,.010,.006,.004],[0,0,0,0,0,0,0,0,0,0,0,0],[-.16,-.11,-.01,.13,.30,.46,.61,.73,.81,.87,.91,.924]),{base:'#675f49',accent:'#c7b078',fin:'#766b52',pattern:'rayOcelli',eye:{x:.56,radius:.025,lift:1},gillX:.39,mouthX:.40,mouthZ:-.027,mouthWidth:.042,mouthHeight:.021,tail:{form:'whip',length:1.12,height:.025,notch:1.12},dorsal:[],anal:[],pectoral:{x:0,length:0,reach:0},pelvic:{x:-.11,length:.11,reach:.14},barbels:0,crossSection:.85,scales:false,scaleColumns:0,scaleRows:0,bend:.30,referenceUrl:'https://www.nationalzoo.si.edu/animals/freshwater-stingray',notes:'Potamotrygon: domed cranium above integrated undulating pectoral disc, recessed spiracles behind dorsal eyes, true warm circular ocelli, underside mouth and tapered whip tail.'}),
};
export const hasFishAnatomy=(kind:FishKind):boolean=>Object.hasOwn(FISH_ANATOMIES,kind);
/** The small projecting terminal lip is shared with the feeding/hit-test data. */
export const getAnatomicalMouthX=(kind:FishKind):number=>{
  const a=FISH_ANATOMIES[kind];if(!a)throw new Error(`Missing mouth anatomy: ${kind}`);
  return a.mouthX+(['stingray','bristlenose','otocinclus'].includes(kind)?0:.010);
};
