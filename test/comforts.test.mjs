import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import '../world-engine.js';
const E=globalThis.VillageEngine,start=1792600000000;
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const LODGE_THINGS=['lodge-sofa','lodge-loveseat','lodge-armchair','lodge-hearth','lodge-tree','lodge-gifts','lodge-cocoa'];
const rec=who=>({n:1,pr:[['p1',who,start,0,1,145,0,1,0,'앉음']]});

test('winter house furniture leaves shared handprints like the meadow benches',()=>{
 const w=E.createWorld('comforts',start),players={A:{x:-7,y:1,z:147}};
 for(const id of LODGE_THINGS)assert.equal(E.apply(w,{type:'touch',id,rec:rec('A')},'A',players,start).ok,true,id+' is accepted');
 assert.equal(E.apply(w,{type:'touch',id:'lodge-bathtub',rec:rec('A')},'A',players,start).ok,false,'unknown things are still rejected');
});

test('every lodge thing the client defines is allowed by the shared engine',()=>{
 const client=read('src/28-lodge-comforts.js'),ids=new Set([...client.matchAll(/(?:id:|seatThing\()'(lodge-[a-z]+)'/g)].map(m=>m[1]));
 assert.deepEqual([...ids].sort(),[...LODGE_THINGS].sort());
});

test('twilight warms the sky only around sunrise and sunset',()=>{
 const ctx={Math};vm.createContext(ctx);const src=read('src/27-ambience.js'),a=src.indexOf('function twilightAmount');vm.runInContext(src.slice(a,src.indexOf('\n',a)),ctx);
 assert.equal(ctx.twilightAmount(0),0,'full day stays clear');assert.equal(ctx.twilightAmount(1),0,'deep night stays dark');assert.ok(ctx.twilightAmount(.42)>.99,'peak at dusk');
});

test('seeded randomness keeps stars and window lights identical for every visitor',()=>{
 const ctx={Math};vm.createContext(ctx);const src=read('src/27-ambience.js'),a=src.indexOf('function seededRandom');vm.runInContext(src.slice(a,src.indexOf('\n',a)),ctx);
 const one=ctx.seededRandom(20261024),two=ctx.seededRandom(20261024),seq=f=>Array.from({length:6},f);
 assert.deepEqual(seq(one),seq(two));assert.ok(seq(ctx.seededRandom(7)).every(v=>v>=0&&v<1));
});

test('decorative sprites and particles never break the touch ray test',()=>{
 const ambience=read('src/27-ambience.js'),comforts=read('src/28-lodge-comforts.js');
 assert.match(ambience,/pts\.raycast=ignoreRaycast/,'all glow particles ignore rays');
 for(const src of [ambience,comforts])for(const m of src.matchAll(/new THREE\.Sprite\(/g)){const tail=src.slice(m.index,m.index+260);assert.match(tail,/raycast=ignoreRaycast/,'sprite ignores rays: '+tail.slice(0,60));}
});
