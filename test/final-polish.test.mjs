import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const slice=(text,from,to)=>{const a=text.indexOf(from),b=text.indexOf(to,a);assert.ok(a>=0&&b>a,'source marker missing: '+from);return text.slice(a,b);};
class Vec{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this;}}

function cameraContext(solids){const ctx={THREE:{Vector3:Vec},solids,Vec};vm.createContext(ctx);vm.runInContext(slice(read('src/07-player.js'),'const CAM_SEE_THROUGH','function updateCamera(dt){'),ctx);return ctx;}
const box=(tag,minX,maxX,minY,maxY,minZ,maxZ)=>({tag,minX,maxX,minY,maxY,minZ,maxZ,on:true});

test('third-person camera stops in front of a building wall instead of entering it',()=>{
 const ctx=cameraContext([box('tower',-5,5,0,60,-20,-10)]);
 const reach=vm.runInContext('cameraReach(new Vec(0,3.3,0),new Vec(0,5,-20))',ctx);
 assert.ok(reach>.45&&reach<.5,'wall face at z=-10 (minus margin) is about halfway: '+reach);
 const pulled=vm.runInContext('camPivot.set(0,3.3,0);const v=new Vec(0,5,-20);pullCamera(v,cameraReach(camPivot,v));v',ctx);
 assert.ok(pulled.z>-10,'camera ends on the player side of the wall: '+pulled.z);
});

test('camera ignores glass, small props and the box the player stands inside',()=>{
 const ctx=cameraContext([box('gh',-5,5,0,10,-20,-10),box('community',-5,5,0,1,-20,-10),box('towerwall',-3,3,0,8,-3,3)]);
 assert.equal(vm.runInContext('cameraReach(new Vec(0,3.3,0),new Vec(0,5,-20))',ctx),1);
 ctx.solids.push({...box('tower',-5,5,0,60,-20,-10),on:false});
 assert.equal(vm.runInContext('cameraReach(new Vec(0,3.3,0),new Vec(0,5,-20))',ctx),1,'switched-off solids never block');
});

test('camera keeps a minimum distance even when the wall touches the player',()=>{
 const ctx=cameraContext([box('tower',-5,5,0,60,-1,-.5)]);
 const v=vm.runInContext('camPivot.set(0,3.3,0);const w=new Vec(0,3.3,-10);pullCamera(w,cameraReach(camPivot,w));w',ctx);
 assert.ok(Math.abs(v.z)>=10*.14-1e-9,'never collapses into the head: '+v.z);
});

function coreContext(win){const core=read('src/00-core.js');const ctx={quality:'clear',paused:false,started:true,document:{hidden:false},devicePixelRatio:win.dpr,innerWidth:win.w,innerHeight:win.h,resizes:0,resize(){ctx.resizes++;}};vm.createContext(ctx);
 vm.runInContext(slice(core,'const QUALITY_PROFILE','function resize(){'),ctx);vm.runInContext(slice(core,'const FPS_LOW','\n// ─── Box-world physics'),ctx);return ctx;}

test('sharp mode is no longer capped at 1200 pixels wide on large screens',()=>{
 const hd=coreContext({w:1920,h:1080,dpr:1});assert.equal(vm.runInContext("pixelRatioFor('clear')",hd),1,'old cap rendered 1920px screens at 0.625');
 const retina=coreContext({w:1440,h:900,dpr:2});const r=vm.runInContext("pixelRatioFor('clear')",retina);assert.ok(r>1.5&&r<=2,'retina laptop renders near native: '+r);
 assert.equal(vm.runInContext("pixelRatioFor('retro')",hd),.35,'retro keeps its console resolution');
});

test('adaptive resolution trades pixels for frame rate and earns them back when calm',()=>{
 const ctx=coreContext({w:1440,h:900,dpr:2});const frames=(fps,seconds)=>{for(let i=0;i<fps*seconds;i++)vm.runInContext('adaptResolution('+1/fps+')',ctx);};
 frames(30,3);assert.ok(vm.runInContext('resScale',ctx)<1,'slow frames lower the scale');
 frames(30,30);assert.ok(vm.runInContext('resScale',ctx)>=vm.runInContext('RES_SCALE_MIN',ctx),'never below the floor');
 frames(120,40);assert.equal(vm.runInContext('resScale',ctx),1,'recovers fully when frames are fast again');
 const before=vm.runInContext('resScale',ctx);vm.runInContext('adaptResolution(2)',ctx);frames(30,.5);assert.equal(vm.runInContext('resScale',ctx),before,'a single hitch is ignored');
});

test('built page parses, includes every module and matches the service worker cache',()=>{
 const html=read('index.html'),sw=read('sw.js'),build=read('build.mjs');
 const start=html.indexOf("<script>\n'use strict';");assert.ok(start>0);const script=html.slice(start+9,html.indexOf('</script>',start));
 assert.doesNotThrow(()=>new vm.Script(script));
 for(const name of JSON.parse(build.match(/const files=(\[[^\]]+\])/)[1].replace(/'/g,'"')))assert.ok(html.includes('// ── '+name+'.js ──'),'module bundled: '+name);
 const pageVersions=new Set([...html.matchAll(/world-[a-z]+\.js\?v=(\d+)/g)].map(m=>m[1]));assert.equal(pageVersions.size,1);
 const assets=JSON.parse(sw.match(/const ASSETS=(\[[^\]]+\])/)[1].replace(/'/g,'"'));
 for(const a of assets.filter(a=>a.includes('?v=')))assert.ok(a.endsWith('?v='+[...pageVersions][0]),'service worker caches the same build: '+a);
 for(const a of assets.filter(a=>a!=='./'))assert.ok(existsSync(new URL('../'+a.slice(2).split('?')[0],import.meta.url)),'cached file exists: '+a);
 assert.ok(html.includes('.location .world-clock'),'HUD status lines flow in one column');
});
