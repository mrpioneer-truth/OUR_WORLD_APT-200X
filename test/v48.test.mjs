import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync,statSync} from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath} from 'node:url';
import '../world-engine.js';
const E=globalThis.VillageEngine,start=1792600000000;
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>readFileSync(path.join(root,p),'utf8');
// Loads top-level declarations of a client module (everything before `stop`) into a sandbox.
function prelude(file,stop,extra={}){const src=read(file),end=src.indexOf(stop);assert.ok(end>0,'missing '+stop);const ctx={Math,Number,String,Array,JSON,...extra};vm.createContext(ctx);vm.runInContext(src.slice(0,end).replace(/^const /gm,'var ').replace(/^let /gm,'var '),ctx);return ctx;}
function smoother(clock){const ctx={Math,performance:{now:()=>clock.now},setInterval:()=>0,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))};vm.createContext(ctx);vm.runInContext(read('src/30-motion-smoother.js').replace('const MotionSmoother=','var MotionSmoother='),ctx);return ctx.MotionSmoother;}
// Seeded randomness so the network simulations are the same on every run.
function seeded(seed){let s=seed>>>0;return ()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);}
// Per-frame speeds of one smoothed walker → how uneven the motion looks (0 = perfectly even) and how often it stalls.
function evenness(speeds){const mean=speeds.reduce((a,b)=>a+b,0)/speeds.length,sd=Math.sqrt(speeds.reduce((a,b)=>a+(b-mean)**2,0)/speeds.length);return {cv:sd/mean,stalls:speeds.filter(v=>v<mean*.25).length/speeds.length};}

test('solo worlds hand every step to the renderer instead of every tenth frame, so residents stop stalling',()=>{
 const village=read('src/16-village.js');
 assert.doesNotMatch(village,/frame%10===0\)\{receive/,'the old frame-number gate is gone');
 assert.match(village,/E\.step\(localWorld,ps,at,step\);receive\(E\.publicState\(localWorld,ps,at\)\)/,'each solo step is delivered with the time it was simulated');
 // Same walker (3 m/s, stepped every 0.1 s) on a 60 Hz and a 120 Hz screen whose frames wobble by ±8 %, as real ones do,
 // through the old schedule (handed over only on frames divisible by ten) and the new one (every step).
 const run=(hz,solo)=>{const clock={now:0},M=smoother(clock),rnd=seeded(9),walker={x:0,y:0,z:0,h:0};let shown={...walker},sampleAt=null,lastStep=0,prev=null,t=0;const speeds=[];
  for(let frame=0;frame<hz*25;frame++){const dt=1000/hz*(.92+rnd()*.16);t+=dt;clock.now=t;
   if(t-lastStep>100){lastStep=t;walker.z+=.3;if(solo==='new'||frame%10===0){shown={...walker};sampleAt=t;}}
   if(solo==='new')M.frame(dt/1000,sampleAt);const m=M.at('r:w',shown,dt/1000,null,solo==='new'?sampleAt:undefined);if(prev!==null&&t>4000)speeds.push((m.z-prev)/(dt/1000));prev=m.z;}
  return evenness(speeds);};
 for(const hz of [60,120]){const before=run(hz,'old'),after=run(hz,'new');
  assert.ok(before.stalls>.2,hz+' Hz: the old schedule really stalled: '+before.stalls.toFixed(2));
  assert.ok(after.stalls<.01&&after.cv<.08,hz+' Hz: every step delivered → even walking: '+JSON.stringify(after));}
});

test('relay jitter no longer turns into speed-ups and stalls: samples sit on the simulation clock',()=>{
 const run=clocked=>{const clock={now:0},M=smoother(clock),rnd=seeded(4),packets=[];
  for(let t=0;t<30000;t+=300)packets.push({at:1792600000000+t,z:t/1000*3,arrive:t+80+rnd()*250});packets.sort((a,b)=>a.arrive-b.arrive);
  let i=0,latest=null,prev=null;const speeds=[];
  for(let frame=0;frame<1700;frame++){clock.now=frame*1000/60;while(i<packets.length&&packets[i].arrive<=clock.now){const p=packets[i++];if(!latest||p.at>latest.at)latest=p;}if(!latest)continue;
   if(clocked)M.frame(1/60,latest.at);const m=M.at('r:w',{x:0,y:0,z:latest.z,h:0},1/60,null,clocked?latest.at:undefined);if(prev!==null&&frame>420)speeds.push((m.z-prev)*60);prev=m.z;}
  return evenness(speeds);};
 const byArrival=run(false),byClock=run(true);
 assert.ok(byClock.cv<.12,'clocked motion is even: '+byClock.cv.toFixed(3));
 assert.ok(byClock.cv<byArrival.cv/2,'and clearly smoother than timing by arrival: '+byClock.cv.toFixed(3)+' vs '+byArrival.cv.toFixed(3));
 assert.equal(byClock.stalls,0,'no frames where the walker stops');
});

test('a late snapshot from the second relay cannot drag residents back behind a newer motion packet',()=>{
 const base=Date.now(),states=[],bc={};
 const engine={RULES_REVISION:6,createWorld:()=>({version:4,residents:[{id:'r0',x:0,y:0,z:0}],creatures:[],clock:0}),publicState:(w,_p,now)=>({version:4,clock:now,residents:w.residents.map(r=>({...r}))})};
 const ctx={Math,JSON,Date,Map,Set,Promise,Number,String,Array,Object,ROOM:'main',RELAYS:[],NET:{id:'BBBB'},hashStr:()=>.5,console,
  globalThis:{VillageEngine:engine,VillageSystems:{init(){}}},window:{APT_CONFIG:{relays:[]}},location:{origin:'http://x',pathname:'/'},document:{hidden:false},performance:{now:()=>0},
  localStorage:{getItem:()=>null,setItem(){}},setInterval:()=>0,clearInterval(){},setTimeout:()=>0,MqttLink:class{},BroadcastChannel:class{constructor(){Object.assign(bc,{channel:this});}postMessage(){}}};
 vm.createContext(ctx);vm.runInContext(read('src/19-static-transport.js'),ctx);
 ctx.createStaticVillageTransport({meta:{},onState:s=>states.push(s),onStatus(){},isStarted:()=>false,getPresence:()=>null});
 const send=m=>bc.channel.onmessage({data:m}),snapshot=(dt,x)=>send({type:'snapshot',rulesRevision:6,owner:'AAAA',at:base+dt,world:{version:4,residents:[{id:'r0',x,y:0,z:0}],creatures:[]}}),motion=(dt,x)=>send({type:'motion',owner:'AAAA',at:base+dt,r:[['r0',x,0,0,null,1,'walk',0]],c:[]});
 send({type:'presence',id:'AAAA',at:base,eligible:true,rulesRevision:6,player:null});
 snapshot(100,-1);motion(1300,1);snapshot(1000,0);
 assert.equal(states.at(-1).residents[0].x,1,'the newer motion position survives the late snapshot');assert.equal(states.at(-1).sampleAt,base+1300);
 snapshot(1000,0);motion(1300,9);assert.equal(states.at(-1).residents[0].x,1,'duplicates from the other relay are ignored');
 motion(1600,2);assert.equal(states.at(-1).residents[0].x,2);snapshot(1900,3);assert.equal(states.at(-1).residents[0].x,3);assert.equal(states.at(-1).sampleAt,base+1900);
});

test('32 real LPs: 19 Christmas + 13 jazz guitar songs follow one shared clock and change records by themselves',()=>{
 const lp=prelude('src/25-lodge.js','const Lodge=');const T=start;
 assert.equal(lp.LP_SONGS.length,32);assert.equal(lp.LP_SONGS.filter(s=>s.genre==='carol').length,19);assert.equal(lp.LP_SONGS.filter(s=>s.genre==='jazz').length,13);
 for(const s of lp.LP_SONGS)assert.ok(s.dur>60&&s.dur<480&&s.at>=1,'song length looks like a song: '+s.title);
 for(const file of [0,1]){const songs=lp.LP_SONGS.filter(s=>s.file===file);songs.slice(1).forEach((s,i)=>assert.ok(Math.abs(s.at-(songs[i].at+songs[i].dur+1))<.01,'songs are packed back to back with 1 s gaps'));}
 const l={record:19,playing:true,offset:0,startedAt:T};
 let p=lp.lpPosition(l,T+1000);assert.equal(p.index,19);assert.ok(p.song<0,'needle is still dropping');
 p=lp.lpPosition(l,T+(lp.LP_LEAD+10)*1000);assert.equal(p.index,19);assert.ok(Math.abs(p.song-10)<1e-6);
 p=lp.lpPosition(l,T+(lp.lpCycle(19)+.5)*1000);assert.equal(p.index,20,'the next record goes on when the song ends');
 p=lp.lpPosition({record:31,playing:true,offset:0,startedAt:T},T+(lp.lpCycle(31)+.5)*1000);assert.equal(p.index,0,'after the last LP the first comes back');
 const day=lp.lpPosition({record:3,playing:true,offset:0,startedAt:T},T+864e5);assert.ok(day.index>=0&&day.index<32&&day.t>=0,'a day later every visitor still lands on the same song');
 assert.deepEqual({...lp.lpPosition({record:5,playing:false,offset:42000,startedAt:T},T+9e9),start:0},{...lp.lpPosition({record:5,playing:false,offset:42000,startedAt:T},T),start:0},'paused records keep their place');
 const lodge=read('src/25-lodge.js');assert.match(lodge,/lpSound\('lift'/);assert.match(lodge,/lpSound\('needle'/);assert.match(lodge,/if\(!lpBroken&&l\)\{playRecords\(l\);return;\}/,'the synthesized LP stays as the fallback');
});

test('the hearth screen is shared through the speaker record, and a newer change always wins',()=>{
 const th=prelude('src/31-lodge-theater.js','// Perspective transform');
 assert.equal(th.readSharedScreen(null,0),null);assert.equal(th.readSharedScreen({yv:'<script>',yp:true},0).id,null);assert.equal(th.readSharedScreen({yv:'<script>',yp:true},0).playing,false);
 const s=th.readSharedScreen({yv:'aqz-KE-bpKQ',ys:30,ya:1000,yp:true,yb:'0226'},0);assert.deepEqual({...s},{id:'aqz-KE-bpKQ',pos:30,at:1000,playing:true,by:'0226'});
 assert.equal(th.sharedPosition(s,13000),42);assert.equal(th.sharedPosition({...s,playing:false},99999),30);
 const w=E.createWorld('theater',start),players={A:{x:-4,y:1,z:153},B:{x:-5,y:1,z:153}},rec=(who,t,st)=>({n:1,st:{...st,_t:t},pr:[['p'+t,who,start,-4,1,154,0,0,-1,'영사']]});
 assert.equal(E.apply(w,{type:'touch',id:'lodge-speaker',rec:rec('A',start+10,{yv:'aqz-KE-bpKQ',ys:30,ya:start,yp:true,yb:'A'})},'A',players,start).ok,true);
 assert.equal(E.apply(w,{type:'touch',id:'lodge-speaker',rec:rec('B',start+20,{yv:'aqz-KE-bpKQ',ys:40,ya:start+10,yp:false,yb:'B'})},'B',players,start).ok,true);
 assert.equal(w.touches['lodge-speaker'].st.yp,false,'B paused it for everyone');assert.equal(w.touches['lodge-speaker'].st.yb,'B');
 assert.match(read('src/13-net.js'),/_t:Math\.max\(Date\.now\(\),\(Number\(prev\.st\?\._t\)\|\|0\)\+1\)/,'a visitor whose clock runs behind still overrides what they saw');
});

test('snow falls over the map until the white button turns it off; then the real weather decides',()=>{
 const wx=prelude('src/32-weather.js','const Weather=');
 assert.equal(wx.weatherKind(0),'clear');assert.equal(wx.weatherKind(61),'rain');assert.equal(wx.weatherKind(95),'rain');assert.equal(wx.weatherKind(73),'snow');assert.equal(wx.weatherKind(45),'fog');
 assert.equal(wx.precipitationFor(true,null).kind,'snow','on by default even before the weather loads');
 assert.equal(wx.precipitationFor(true,{kind:'rain',code:61}).kind,'snow','the button wins over the real weather');
 assert.equal(wx.precipitationFor(false,{kind:'clear',code:0}).kind,'none');assert.equal(wx.precipitationFor(false,{kind:'rain',code:63}).kind,'rain');assert.equal(wx.precipitationFor(false,{kind:'snow',code:73}).kind,'snow');
 const src=read('src/32-weather.js');assert.match(src,/uRoomMin/,'flakes are discarded inside the winter house');assert.match(src,/return null;\}\}\);/,'the button is local and sends nothing to the shared world');
 assert.match(read('src/27-ambience.js'),/!Weather\.covers\(\)/,'the original snow around the house returns when map snow is off');
});

test('the whole folder uploads to GitHub in one go: under 100 files, every file under 25 MB, about 20 MB in total',()=>{
 const files=[];const walk=d=>{for(const name of readdirSync(d)){if(name==='.DS_Store'||name==='node_modules'||name==='data'||name==='.git')continue;const p=path.join(d,name);if(statSync(p).isDirectory())walk(p);else files.push({p,size:statSync(p).size});}};walk(root);
 const total=files.reduce((a,f)=>a+f.size,0),biggest=files.reduce((a,f)=>f.size>a.size?f:a);
 assert.ok(files.length<90,'file count with room to spare: '+files.length);assert.ok(biggest.size<10*1024*1024,'largest file '+path.basename(biggest.p)+' '+(biggest.size/1048576).toFixed(1)+' MB');assert.ok(total<22*1024*1024,'total '+(total/1048576).toFixed(1)+' MB');
 for(const asset of ['bgm-brighter.m4a','lp-carol.m4a','lp-jazz.m4a','lp-needle.m4a','lp-lift.m4a'])assert.ok(files.some(f=>f.p.endsWith(path.join('assets',asset))),'asset shipped: '+asset);
 assert.ok(!files.some(f=>/brighter-\d\d\.m4a$/.test(f.p)),'the thirteen 7 MB music chunks are gone');
 assert.match(read('src/16-village.js'),/MUSIC_SRC='\.\/assets\/bgm-brighter\.m4a'/);
});

test('120 Hz screens draw every other refresh (about 60 fps); 60 Hz and 90 Hz screens draw every refresh',()=>{
 const src=read('src/15-loop.js'),a=src.indexOf('const TARGET_FRAME_MS'),b=src.indexOf('function loop(');
 for(const [hz,expected] of [[60,60],[90,90],[120,60],[144,72],[240,60]]){const ctx={Math,performance:{now:()=>0}};vm.createContext(ctx);vm.runInContext('var last=0;'+src.slice(a,b).replace(/^const /gm,'var ').replace(/^let /gm,'var '),ctx);
  let drawn=0;for(let i=1;i<=hz*4;i++){const now=i*1000/hz;if(!ctx.frameSkip(now)){ctx.last=now;if(i>hz)drawn++;}}
  assert.ok(Math.abs(drawn/3-expected)<=2,hz+' Hz → '+(drawn/3).toFixed(1)+' fps, expected about '+expected);}
});
