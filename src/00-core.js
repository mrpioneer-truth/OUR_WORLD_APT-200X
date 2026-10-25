const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
let seed = 20040621;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
// A second stream for everything added after the first prototype, so the original meadow keeps its exact layout.
let seed2 = 20260621;
function rand2(){seed2=(Math.imul(seed2,1103515245)+12345)>>>0;return seed2/4294967296;}
function terrainY(x,z){return Math.sin(x*.023)*1.25+Math.cos(z*.024)*.95+Math.sin(x*.013+z*.014)*1.1;}
function texCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function phong(color,options={}){return new THREE.MeshPhongMaterial({color,shininess:100,specular:0xffffff,...options});}
let scene,camera,renderer;
try{scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.15,1000);// alpha:true lets the winter-house screen punch a transparent hole so the YouTube player behind the canvas shows through.
 renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'default',alpha:true});}
catch(e){$('failure').style.display='block';return;}
camera.rotation.order='YXZ';camera.up.set(0,1,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x8dc6e1);renderer.toneMapping=THREE.NoToneMapping;
scene.fog=new THREE.Fog(0xc4e1d3,110,370);
const sun=new THREE.DirectionalLight(0xfff6e2,1.5);sun.position.set(-60,100,50);
const ambientLight=new THREE.AmbientLight(0xd8f0ff,.8);scene.add(sun,ambientLight);
// Sky light from above and a soft meadow bounce from below; it follows the ambient light so every zone keeps its mood.
const hemiLight=new THREE.HemisphereLight(0xd8f0ff,0x7f9a72,0),GROUND_BOUNCE=new THREE.Color(0x93a888),AMBIENT_SHARE=.62,HEMI_SHARE=.5;scene.add(hemiLight);
const white=phong(0xf0f1e7),cream=phong(0xdfe7d7),silver=phong(0xb9ccd1),dark=phong(0x3c747d),mint=phong(0x82a998);
const unitBox=new THREE.BoxGeometry(1,1,1),unitSphere=new THREE.SphereGeometry(1,20,12);
const buildings=[],eggs=[],journal=[];
let started=false,paused=false,worldTime=0,elapsed=0,spawnElapsed=0,nextSpawn=52,found=0,restored=0,eggSerial=0,toastTimer;
// Settings v2: the sharp picture is the new default. Older saves never chose it explicitly, so they move once.
const SETTINGS_VERSION=2;
let quality='clear',volume=.6,sensitivity=.5,muted=false,voices='full';
try{const s=JSON.parse(localStorage.getItem('apt200x-settings')||'{}');quality=s.v>=SETTINGS_VERSION&&['retro','soft','clear'].includes(s.quality)?s.quality:'clear';volume=typeof s.volume==='number'?clamp(s.volume,0,1):.6;sensitivity=typeof s.sensitivity==='number'?clamp(s.sensitivity,.1,1):.5;voices=['full','soft','off'].includes(s.voices)?s.voices:'full';const j=JSON.parse(localStorage.getItem('apt200x-journal')||'[]');if(Array.isArray(j))journal.push(...j.slice(-80).filter(x=>x&&typeof x.title==='string'&&typeof x.time==='string'));}catch(e){}
function saveSettings(){try{localStorage.setItem('apt200x-settings',JSON.stringify({v:SETTINGS_VERSION,quality,volume,sensitivity,voices}));}catch(e){}}
const safeBounds={top:0,bottom:0,left:0,right:0};
// View mode shared by the camera, input and resize code: third person (default) or the visitor's own eyes.
const view={firstPerson:false};
// Each look has a sharpness target and a pixel budget, so big screens stay sharp instead of being capped at 1200px wide.
const QUALITY_PROFILE={retro:{ratio:()=>.35,budget:.5e6},soft:{ratio:()=>Math.min(devicePixelRatio||1,1)*.75,budget:1.4e6},clear:{ratio:()=>Math.min(devicePixelRatio||1,2),budget:4.2e6}};
const RES_SCALE_MIN=.55;let resScale=1;
function pixelRatioFor(q){const p=QUALITY_PROFILE[q]||QUALITY_PROFILE.clear,fit=Math.sqrt(p.budget/Math.max(1,innerWidth*innerHeight));return Math.max(.25,Math.min(p.ratio(),fit)*(q==='retro'?1:resScale));}
function resize(){const styles=getComputedStyle(document.documentElement);for(const edge of Object.keys(safeBounds))safeBounds[edge]=parseFloat(styles.getPropertyValue('--safe-'+edge))||0;document.documentElement.dataset.quality=quality;renderer.setPixelRatio(pixelRatioFor(quality));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=view.firstPerson?(innerWidth<600?80:74):innerWidth<600?65:(started?60:53);camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
// Adaptive resolution: when frames slow down, trade a few pixels for smooth walking; earn them back once it is calm.
const FPS_LOW=48,FPS_HIGH=57,HITCH_SECONDS=.25;const frameRate={time:0,frames:0,slow:0,fast:0,calm:0};
function adaptResolution(raw){const f=frameRate;if(quality==='retro'||document.hidden||paused||raw>HITCH_SECONDS){f.time=f.frames=0;return;}
  f.time+=raw;f.frames++;if(f.time<1)return;const fps=f.frames/f.time;f.time=f.frames=0;f.calm=Math.max(0,f.calm-1);
  if(fps<FPS_LOW){f.slow++;f.fast=0;}else if(fps>FPS_HIGH){f.fast++;f.slow=0;}else f.slow=f.fast=0;
  if(f.slow>=2&&resScale>RES_SCALE_MIN){resScale=Math.max(RES_SCALE_MIN,resScale*.85);f.slow=0;f.calm=8;resize();}
  else if(f.fast>=5&&f.calm===0&&resScale<1){resScale=Math.min(1,resScale*1.1);f.fast=0;resize();}}

// ─── Box-world physics ───────────────────────────────────────────────────────
// Everything walkable or blocking is an axis-aligned box. Its top is a floor, its sides are walls,
// its bottom is a ceiling. Moving boxes (elevator car, rising stairs) set `dy` each frame to carry riders.
const STEP_UP=.62,PLAYER_R=.35,PLAYER_H=2.72,WORLD_RADIUS=300;
const solids=[],ramps=[],holes=[],voids=[];
function addSolid(minX,maxX,minY,maxY,minZ,maxZ,tag=''){const s={minX,maxX,minY,maxY,minZ,maxZ,tag,on:true,dy:0};solids.push(s);return s;}
function solidAt(cx,cy,cz,w,h,d,tag){return addSolid(cx-w/2,cx+w/2,cy-h/2,cy+h/2,cz-d/2,cz+d/2,tag);}
function removeSolid(s){const i=solids.indexOf(s);if(i>=0)solids.splice(i,1);}
function inRect(r,x,z){return x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ;}
function inHole(x,z){return holes.some(h=>inRect(h,x,z));}
function inVoid(x,z){return voids.some(v=>Math.hypot(x-v.x,z-v.z)<v.r);}
let support=null; // the box the player last stood on
function surfaceHeight(x,z,footY=Infinity){
  let y=-Infinity;support=null;const reach=footY+STEP_UP;
  if(!inHole(x,z)&&!inVoid(x,z)){const t=terrainY(x,z);if(t<=reach)y=t;}
  for(const r of ramps)if(inRect(r,x,z)){const ry=r.y0+(r.y1-r.y0)*clamp((z-r.z0)/(r.z1-r.z0),0,1);if(ry<=reach&&ry>y)y=ry;}
  for(const s of solids)if(s.on&&s.maxY<=reach&&s.maxY>y&&inRect(s,x,z)){y=s.maxY;support=s;}
  return y;
}
function blocked(x,z,footY){
  const lo=footY+STEP_UP,hi=footY+PLAYER_H;
  for(const s of solids)if(s.on&&s.maxY>lo&&s.minY<hi&&x>s.minX-PLAYER_R&&x<s.maxX+PLAYER_R&&z>s.minZ-PLAYER_R&&z<s.maxZ+PLAYER_R)return true;
  return false;
}
function ceilingAbove(x,z,headY){let c=Infinity;for(const s of solids)if(s.on&&s.minY>=headY-.35&&s.minY<c&&inRect(s,x,z))c=s.minY;return c;}
// Terrain cells are 1400/150 m; openings are cut on whole cells so the meadow edge stays crisp.
const CELL=1400/150,gridLine=k=>-700+k*CELL;

