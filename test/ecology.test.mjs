import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../world-engine.js';import '../world-systems.js';
const E=globalThis.VillageEngine,S=globalThis.VillageSystems,T=1792680000000;
const counts=w=>[w.residents.filter(r=>r.body.alive).length,w.creatures.filter(c=>!c.friendly&&c.body.alive).length];
const ready=w=>{w.ecology.truceUntil=w.ecology.nextHunt=0;for(const e of [...w.residents,...w.creatures])e.safeUntil=e.nextAttack=0;return w;};
test('legacy extinction is repaired in place without deleting the garden, shared memories or touches',()=>{
 const w=E.createWorld('legacy',T);delete w.ecology;delete w.rulesRevision;
 w.objects.keep={id:'keep',kind:'arch',x:160,y:0,z:90};w.touches.gate={n:4};w.anomalies.EE_001={status:'done'};
 for(const e of [...w.residents,...w.creatures.filter(c=>!c.friendly)]){e.body.alive=false;e.body.hp=0;e.state='dead';e.fellAt=T;}
 S.init(w,T+1000);assert.deepEqual(counts(w),[6,3]);
 assert.equal(w.objects.keep.kind,'arch');assert.equal(w.touches.gate.n,4);assert.equal(w.anomalies.EE_001.status,'done');
 for(const e of [...w.residents,...w.creatures.filter(c=>!c.friendly)].filter(e=>e.body.alive)){assert.equal(e.generation,1);assert.equal(e.body.hp,e.body.profile.health);assert.ok(e.safeUntil>T);}
 E.step(w,{},T+240000,.1);assert.deepEqual(counts(w),[10,6]);assert.equal(w.ecology.history.filter(h=>h.cause==='death').length,16);
});
test('repeated catastrophic losses replace lives and never leave either faction extinct at the end of a tick',()=>{
 const w=E.createWorld('catastrophe',T);for(let round=0;round<12;round++){const now=T+round*10000;for(const e of [...w.residents,...w.creatures.filter(c=>!c.friendly)])S.damage(w,e,100000,now);
 E.step(w,{},now+100,.1);const [humans,hostiles]=counts(w);assert.ok(humans>=6);assert.ok(hostiles>=3);assert.ok(w.ecology.history.length<=80);}
 assert.ok(w.residents.some(r=>r.generation>=10));assert.equal(w.residents.length,10);assert.equal(w.creatures.length,10);
});
test('injured individuals retain wounds; a different life later takes over during long-term convalescence',()=>{
 const w=E.createWorld('care',T),r=w.residents[0],oldName=r.name;S.damage(w,r,800,T);const wounded=r.body.hp;E.step(w,{},T+100,.1);
 assert.equal(r.generation,0);assert.ok(r.body.hp<=wounded+1);assert.equal(r.state,'retreat');
 E.step(w,{},T+121000,.1);assert.equal(r.generation,1);assert.equal(r.body.hp,1000);assert.notEqual(r.name,oldName);assert.ok(w.ecology.history.some(h=>h.name===oldName&&h.cause==='recovery'&&h.alive));
});
test('only one five-person hunt can mobilize; healthy civilian reserves keep tending the park',()=>{
 const w=ready(E.createWorld('one-hunt',T));for(const c of w.creatures.filter(c=>!c.friendly))S.incident(w,c,{x:0,y:0,z:90,kind:'planter'},T);
 S.makeSquads(w,T+1);assert.equal(w.squads.length,1);assert.equal(w.residents.filter(r=>r.squad).length,5);assert.equal(w.residents.filter(r=>!r.squad).length,5);
});
test('an encounter ends after 45 seconds, cancels incoming attacks and enforces a four-minute separation',()=>{
 const w=ready(E.createWorld('timeout',T)),c=w.creatures[4];c.x=-50;c.z=-40;c.engagementAt=T;c.state='fight';
 const r=w.residents[0];r.x=-48;r.z=-40;r.y=c.y=0;r.enemy=c.id;r.pending={target:c.id,lifeId:0,energy:5000,at:T+46000,range:30};c.pending={target:r.id,lifeId:0,energy:5000,at:T+46000,range:30};
 const hp=r.body.hp,chp=c.body.hp;E.step(w,{},T+46000,.1);assert.equal(r.body.hp,hp);assert.equal(c.body.hp,chp);assert.equal(r.pending,null);assert.equal(c.pending,null);assert.equal(c.state,'retreat');assert.ok(c.safeUntil>=T+286000);assert.ok(w.ecology.nextHunt>=T+286000);
});
test('a departed life cannot hand its already-wound-up attack to a newly arrived life',()=>{
 const w=ready(E.createWorld('identity',T)),r=w.residents[0],c=w.creatures[4];r.pending={target:c.id,lifeId:0,at:T+10000,energy:8000,range:30};S.damage(w,c,100000,T);c.replacementAt=T+1;S.maintainPopulation(w,T+1);
 assert.equal(c.generation,1);assert.equal(r.pending,null);assert.equal(c.body.hp,c.body.profile.health);
});
test('a replayed saved world follows the exact same population lifecycle and exposes no medical history',()=>{
 const a=ready(E.createWorld('replay',T));S.damage(a,a.residents[0],900,T);const b=JSON.parse(JSON.stringify(a));
 for(let i=1;i<400;i++){E.step(a,{},T+i*500,.5);E.step(b,{},T+i*500,.5);}assert.deepEqual(a,b);
 const view=E.publicState(a,{},T+200000);assert.equal(view.ecology,undefined);assert.equal(view.rulesRevision,2);for(const e of [...view.residents,...view.creatures])for(const key of ['body','profile','hp','stamina','unfitSince','replacementAt'])assert.equal(Object.hasOwn(e,key),false);
});
test('eight independent two-hour worlds retain both populations while still producing combat and construction',()=>{
 const meta=JSON.parse(readFileSync(new URL('../world-meta.json',import.meta.url),'utf8'));let hits=0,arrivals=0,objects=0,maxSquads=0;
 for(let seed=0;seed<8;seed++){const w=E.createWorld('endurance-'+seed,T);Object.assign(w,meta);let prev=0;
 for(let tick=1;tick<=14400;tick++){E.step(w,{},T+tick*500,.5);const [human,hostile]=counts(w);assert.ok(human>=6&&human<=10,seed+':'+tick+':humans '+human);assert.ok(hostile>=3&&hostile<=6,seed+':'+tick+':hostiles '+hostile);maxSquads=Math.max(maxSquads,w.squads.length);if(w.eventSerial>prev){hits+=w.eventSerial-prev;prev=w.eventSerial;}}
 arrivals+=w.ecology.arrivalSerial;objects+=Object.keys(w.objects).length;
 }
 assert.ok(hits>0,'combat must not disappear');assert.ok(arrivals>0,'replacement/care must actually be exercised');assert.ok(objects>0,'civilians must still build');assert.ok(maxSquads<=1);
 console.log(JSON.stringify({worlds:8,hoursEach:2,combatEvents:hits,arrivals,finalObjects:objects,maxSquads}));
});
