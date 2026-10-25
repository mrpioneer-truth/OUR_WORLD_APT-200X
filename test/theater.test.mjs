import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import '../world-engine.js';
const E=globalThis.VillageEngine,start=1792600000000;
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
// Loads a top-level helper from a client module into a sandbox; `lines` is how many source lines it spans.
function helper(file,marker,lines=1,extra={}){const src=read(file),ctx={Math,Date,URL,Number,String,Array,...extra};vm.createContext(ctx);const a=src.indexOf(marker);assert.ok(a>=0,'missing '+marker);let b=a;for(let i=0;i<lines;i++)b=src.indexOf('\n',b+1);vm.runInContext(src.slice(a,b),ctx);return ctx;}

test('YouTube links in every common shape become a video id and start time',()=>{
 const {parseYouTubeLink:p}=helper('src/31-lodge-theater.js','function parseYouTubeLink',5);
 assert.deepEqual({...p('https://youtu.be/dQw4w9WgXcQ?t=42')},{id:'dQw4w9WgXcQ',start:42});
 assert.deepEqual({...p('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')},{id:'dQw4w9WgXcQ',start:90});
 assert.equal(p('m.youtube.com/shorts/dQw4w9WgXcQ').id,'dQw4w9WgXcQ');assert.equal(p('https://music.youtube.com/watch?v=dQw4w9WgXcQ').id,'dQw4w9WgXcQ');
 assert.equal(p('https://www.youtube.com/live/dQw4w9WgXcQ').id,'dQw4w9WgXcQ');assert.equal(p('dQw4w9WgXcQ').id,'dQw4w9WgXcQ');
 for(const bad of ['','https://vimeo.com/123','https://youtube.com/watch?v=short','javascript:alert(1)','https://evil.example/watch?v=dQw4w9WgXcQ'])assert.equal(p(bad),null,bad);
});

test('the sketchbook counts days from 2025-11-02 and writes the date in Korean',()=>{
 const src=read('src/31-lodge-theater.js'),ctx={Math,Date};vm.createContext(ctx);for(const n of ['const SKETCH_START','function daysSinceStart','function koreanDateLine']){const a=src.indexOf(n);vm.runInContext(src.slice(a,src.indexOf('\n',a)).replace(/^const /,'var '),ctx);}
 assert.equal(ctx.daysSinceStart(new Date(2025,10,2,9)),0,'D-day itself is D+0');assert.equal(ctx.daysSinceStart(new Date(2025,10,3,0,5)),1);
 assert.equal(ctx.daysSinceStart(new Date(2026,9,24,23,59)),356);assert.equal(ctx.daysSinceStart(new Date(2026,2,30,12)),148,'daylight-saving changes do not shift the count');
 assert.equal(ctx.koreanDateLine(new Date(2026,9,24)),'2026년 10월 24일 토요일');
});

test('the wall homography maps the video corners exactly onto the projected screen corners',()=>{
 const {quadTransform}=helper('src/31-lodge-theater.js','function quadTransform',4);const q=[[100,80],[520,120],[500,400],[90,350]],m=quadTransform(640,360,q);
 const apply=(x,y)=>{const w=m[3]*x+m[7]*y+m[15];return [(m[0]*x+m[4]*y+m[12])/w,(m[1]*x+m[5]*y+m[13])/w];};
 [[0,0],[640,0],[640,360],[0,360]].forEach(([x,y],i)=>{const [px,py]=apply(x,y);assert.ok(Math.abs(px-q[i][0])<1e-6&&Math.abs(py-q[i][1])<1e-6,'corner '+i);});
});

test('the speaker and the sketchbook leave shared handprints too',()=>{
 const w=E.createWorld('theater',start),players={A:{x:-4,y:1,z:153}},rec={n:1,pr:[['p1','A',start,-4,1,154,0,0,-1,'스피커']]};
 for(const id of ['lodge-speaker','lodge-sketchbook'])assert.equal(E.apply(w,{type:'touch',id,rec},'A',players,start).ok,true,id);
 const ids=[...read('src/31-lodge-theater.js').matchAll(/defineThing\(\{id:'(lodge-[a-z]+)'/g)].map(m=>m[1]).sort();assert.deepEqual(ids,['lodge-sketchbook','lodge-speaker']);
});

test('laser colour follows the charge: white, purple from 90 %, black at full',()=>{
 class Color{constructor(r=1,g=1,b=1){this.r=r;this.g=g;this.b=b;}copy(c){this.r=c.r;this.g=c.g;this.b=c.b;return this;}lerp(c,k){this.r+=(c.r-this.r)*k;this.g+=(c.g-this.g)*k;this.b+=(c.b-this.b)*k;return this;}clone(){return new Color(this.r,this.g,this.b);}}
 const hex=h=>new Color(((h>>16)&255)/255,((h>>8)&255)/255,(h&255)/255),src=read('src/18-combat-view.js');
 const ctx={THREE:{Color:function(h){return h===undefined?new Color():hex(h);},NormalBlending:1,AdditiveBlending:2},clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),Math};vm.createContext(ctx);
 const a=src.indexOf('const LASER_WHITE');vm.runInContext(src.slice(a,src.indexOf('const CombatView')).replace(/const /g,'var '),ctx);
 const near=(c,h)=>{const t=hex(h);return Math.abs(c.r-t.r)+Math.abs(c.g-t.g)+Math.abs(c.b-t.b)<.02;};
 assert.ok(near(ctx.laserColor(0),0xffffff),'empty charge is white');assert.ok(near(ctx.laserColor(.9),0x9b3cff),'90 % is purple');assert.ok(near(ctx.laserColor(.95),0x9b3cff),'still purple before full');assert.ok(near(ctx.laserColor(1),0x000000),'full charge is black');
 const mid=ctx.laserColor(.45);assert.ok(mid.g<1&&mid.g>hex(0x9b3cff).g,'halfway is between white and purple');
 assert.ok(ctx.laserWidth(1)>ctx.laserWidth(.5)&&ctx.laserWidth(.5)>ctx.laserWidth(0),'beam thickens with charge');
 assert.equal(ctx.laserLayers(1)[0][3],1,'black core uses normal blending so it stays visible');
});

test('charge travels with every laser event from residents and visitors',()=>{
 assert.match(read('world-systems.js'),/w\.combatEvents\.at\(-1\)\.charge=Math\.min\(1,\(pending\.chargeSeconds\|\|0\)\/6\)/);
 assert.match(read('world-adventure.js'),/beam\(w,from,to,now,hit,by,seconds\/6\)/);
});

test('motion smoothing glides between sparse snapshots instead of jumping',()=>{
 let now=0;const src=read('src/30-motion-smoother.js'),ctx={Math,performance:{now:()=>now},setInterval:()=>0,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))};vm.createContext(ctx);vm.runInContext(src.replace('const MotionSmoother=','var MotionSmoother='),ctx);
 const M=ctx.MotionSmoother,e={x:0,y:0,z:0,h:0,generation:1};let last=null,maxStep=0,walking=false;
 // Snapshots every 0.9 s (the slowest static-relay case), each 2.7 m further: 3 m/s walking.
 for(let frame=0;frame<=720;frame++){now=frame*1000/60;if(frame%54===0)e.z=frame/54*2.7;const m=M.at('r:test',e,1/60);if(last!==null&&frame>360){maxStep=Math.max(maxStep,m.z-last);walking||=m.walking;}last=m.z;}
 assert.ok(maxStep<.12,'per-frame movement stays near 3 m/s ÷ 60 instead of 2.7 m jumps: '+maxStep.toFixed(3));
 assert.ok(walking,'legs keep walking while the glide continues');
});

test('the camera can look up at the sky in both views',()=>{
 const src=read('src/07-player.js'),a=src.indexOf('const TP_PITCH_UP'),ctx={};vm.createContext(ctx);vm.runInContext(src.slice(a,src.indexOf('\n',a)).replace(/^const /,'var '),ctx);
 assert.ok(ctx.TP_PITCH_UP<=-1,'third person tilts well above the horizon');assert.ok(ctx.FP_PITCH_UP<=-1.4,'first person looks almost straight up');
 assert.match(read('src/14-ui.js'),/pitch=clamp\(pitch\+dy\*\.005\*sensitivity,\.\.\.pitchRange\(\)\)/,'drag look uses the new range');
});
