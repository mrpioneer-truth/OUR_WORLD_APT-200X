/* Optional, additive gathering/crafting/building rules. Original village mechanics remain free. */
(() => {
'use strict';
const SIZE=1.5,MAX_BLOCKS=768,MAX_STACK=999,REVISION=3;
const RESOURCES={timber:'목재',stone:'돌',silica:'유리 모래',chrome:'크롬 조각',crystal:'빛 결정',fiber:'섬유',seed:'씨앗',berry:'열매'};
const RECIPES={
 plank:{name:'목재 블록',cost:{timber:2},count:4},brick:{name:'석재 블록',cost:{stone:3},count:4},
 glass:{name:'유리 블록',cost:{silica:3,chrome:1},count:4,bench:true},glow:{name:'발광 블록',cost:{crystal:2,chrome:1},count:2,bench:true},
 stair:{name:'목재 계단',cost:{timber:3,stone:1},count:4},workbench:{name:'개인 작업대',cost:{timber:6,stone:4},count:1},
 cropbed:{name:'재배 상자',cost:{timber:3,fiber:2},count:1},
 pickstone:{name:'석재 곡괭이',cost:{timber:3,stone:4},tool:1},pickchrome:{name:'크롬 곡괭이',cost:{timber:2,chrome:5,crystal:2},tool:2,bench:true}
};
const ITEMS=new Set([...Object.keys(RESOURCES),...Object.keys(RECIPES).filter(k=>!RECIPES[k].tool)]);
const NODE_TYPES=['timber','stone','fiber','silica','chrome','crystal'];
const QUESTS=[{id:'gather',name:'첫 채집: 재료 12개 모으기',stat:'gather',goal:12,reward:{timber:6,stone:6}},
 {id:'tool',name:'나만의 도구: 석재 곡괭이 만들기',tool:1,reward:{silica:6,chrome:3}},
 {id:'build',name:'작은 아지트: 블록 8개 놓기',stat:'built',goal:8,reward:{crystal:3,chrome:3}},
 {id:'harvest',name:'먹을 수 있는 정원: 열매 3개 수확하기',stat:'harvest',goal:3,reward:{timber:8,fiber:6,seed:4}},
 {id:'master',name:'빛을 다루는 손: 크롬 곡괭이 만들기',tool:2,reward:{crystal:8,chrome:8}}];
const E=()=>globalThis.VillageEngine,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),tag=p=>Math.floor(E().hash(p)*4294967295).toString(16).padStart(8,'0');
const key=(gx,gz,layer)=>gx+','+gz+','+layer;
function ground(gx,gz){const x=gx*SIZE,z=gz*SIZE;return Math.floor(Math.min(...[-.7,.7].flatMap(dx=>[-.7,.7].map(dz=>E().terrain(x+dx,z+dz))))*4)/4;}
function position(gx,gz,layer){return {x:gx*SIZE,z:gz*SIZE,y:ground(gx,gz)+layer*SIZE};}
function init(w,now=w.clock||Date.now()){
 w.workshop??={revision:1,nodes:{},blocks:{},bags:{},bindings:{},stock:{},serial:0,log:[]};const s=w.workshop;w.rulesRevision=Math.max(w.rulesRevision||0,REVISION);
 s.station??={x:-16,z:18,y:E().terrain(-16,18)};
 if(!s.layoutReady&&Array.isArray(w.obstacles)){
  const sites=[[-22,20],[-26,34],[-18,48],[24,62],[56,76],[-54,92]];
  for(let i=0;i<36;i++){const kind=NODE_TYPES[i%6];let [x,z]=i<6?sites[i]:[Math.round(Math.cos(i*2.399)* (65+E().hash('node'+i)*145)),Math.round(Math.sin(i*2.399)*(65+E().hash('depth'+i)*145))];
   for(let t=0;t<30;t++){const p={x,z};if(allowed(w,x,z)&&dist(p,s.station)>5&&!Object.values(s.nodes).some(n=>dist(n,p)<5)&&!Object.values(w.eggSpots||{}).some(e=>dist(e,p)<7))break;x+=3;z+=2;}
   if(allowed(w,x,z))s.nodes['n'+i]={id:'n'+i,kind,x,z,y:E().terrain(x,z),left:3,cycle:0,readyAt:0};
  }
  // A few richer deposits reward visits to the existing underground meadow.
  for(const [i,x,z,kind]of [[0,92,-150,'crystal'],[1,101,-157,'chrome']])s.nodes['deep'+i]={id:'deep'+i,kind,x,z,y:-12,left:4,cycle:0,readyAt:0,deep:true};
  s.layoutReady=true;
 }
 return s;
}
function allowed(w,x,z){return Math.hypot(x,z)<242&&E().canPlace({...w,workshop:null},x,z,'lamp',E().terrain(x,z));}
function close(p,o,r=6){return !!p&&Number.isFinite(p.y)&&Math.abs(p.y-o.y)<5&&dist(p,o)<=r;}
function nearBench(w,p){const s=w.workshop;return close(p,s.station,8)||Object.values(s.blocks).some(b=>b.kind==='workbench'&&close(p,b,8));}
function fail(error){return {ok:false,error};}
function changed(w,now){w.rev++;w.clock=now;w.workshop.rev=(w.workshop.rev||0)+1;}
function note(w,text,now){const s=w.workshop;s.log.push({text,at:now});s.log=s.log.slice(-24);}
function credit(b,items){for(const [k,n]of Object.entries(items))if(ITEMS.has(k))b.items[k]=Math.min(MAX_STACK,(b.items[k]||0)+n);}
function affordable(b,cost,n=1){return Object.entries(cost).every(([k,v])=>(b.items[k]||0)>=v*n);}
function canCredit(b,items){return Object.entries(items).every(([k,n])=>(b.items[k]||0)+n<=MAX_STACK);}
function connected(blocks){const all=Object.values(blocks),map=new Map(all.map(b=>[b.key,b])),seen=new Set(),queue=all.filter(b=>b.layer===0);for(const b of queue)seen.add(b.key);
 for(let i=0;i<queue.length;i++){const b=queue[i];for(const [dx,dz,dy]of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const k=key(b.gx+dx,b.gz+dz,b.layer+dy);if(!seen.has(k)&&map.has(k)){seen.add(k);queue.push(map.get(k));}}}return seen.size===all.length;
}
function canPut(w,a,p,players={}){
 const s=w.workshop,{gx,gz,layer}=a;if(![gx,gz,layer].every(Number.isInteger)||Math.abs(gx)>160||Math.abs(gz)>160||layer<0||layer>15)return '그 위치에는 쌓을 수 없습니다.';
 if(!RECIPES[a.kind]||RECIPES[a.kind].tool)return '놓을 수 있는 블록을 선택하세요.';
 if(Object.keys(s.blocks).length>=MAX_BLOCKS)return '이 단지의 공방 블록이 가득 찼습니다. 내 블록을 회수해 다시 사용하세요.';
 const pos=position(gx,gz,layer),k=key(gx,gz,layer);if(!close(p,pos,9))return '9m 안쪽의 닿는 곳에 놓아 주세요.';if(s.blocks[k])return '이미 블록이 있습니다.';
 if(!allowed(w,pos.x,pos.z)||dist(pos,s.station)<3.5)return '기존 건물·정원·엘리베이터의 통로를 피해 주세요.';
 if(Object.values(s.nodes).some(n=>!n.deep&&dist(pos,n)<1.7))return '채집 재료에서 두 걸음 떨어져 놓아 주세요.';
 const occupants=[...Object.values(players),...(w.residents||[]).filter(e=>e.alive!==false&&e.body?.alive!==false),...(w.creatures||[]).filter(e=>e.alive!==false&&e.body?.alive!==false)];for(const q of occupants)if(Math.abs(q.x-pos.x)<1.1&&Math.abs(q.z-pos.z)<1.1&&q.y<pos.y+SIZE&&q.y+2.75>pos.y)return '방문자·이웃·동물의 몸이 들어가는 자리는 비워 주세요.';
 if(layer>0&&!connected({...s.blocks,[k]:{key:k,gx,gz,layer}}))return '땅에 닿은 블록과 이어서 쌓아 주세요.';
 return null;
}
function mineAllowed(w,b,profile,players){if(!b)return '없는 블록입니다.';if(b.owner!==profile)return '다른 이웃이 만든 블록은 회수할 수 없습니다.';if(b.crop)return '재배 중인 작물은 수확한 뒤 회수해 주세요.';
 const rest={...w.workshop.blocks};delete rest[b.key];if(!connected(rest))return '위나 옆에 연결된 블록부터 회수해 주세요.';
 if(Object.values(players).some(p=>Math.abs(p.x-b.x)<1.1&&Math.abs(p.z-b.z)<1.1&&p.y>=b.y&&p.y<=b.y+SIZE+.7))return '누군가 올라선 블록은 회수할 수 없습니다.';return null;
}
function command(w,a,by,players,now){if(!String(a.type).startsWith('ws:'))return null;const s=init(w,now),p=players[by];
 if(a.type==='ws:join'){
  if(typeof a.profile!=='string'||! /^[a-f0-9]{32}$/.test(a.profile))return fail('가방을 열지 못했습니다. 새로고침해 주세요.');
  let b=s.bags[a.profile];if(!b){if(Object.keys(s.bags).length>=256)return fail('이 단지에 보관할 수 있는 가방이 가득 찼습니다.');b=s.bags[a.profile]={items:{timber:10,stone:8,fiber:4,seed:4},pick:0,stats:{gather:0,crafted:0,built:0,harvest:0},claimed:[],mining:null};}
  s.bindings[by]=a.profile;const ids=Object.keys(s.bindings);if(ids.length>512)delete s.bindings[ids[0]];changed(w,now);return {ok:true};
 }
 const profile=s.bindings[by],b=s.bags[profile];if(!b)return fail('공방 가방을 연결하는 중입니다. 잠시 후 다시 시도해 주세요.');
 if(a.type==='ws:craft'){const r=Object.hasOwn(RECIPES,a.recipe)?RECIPES[a.recipe]:null,n=a.count??1;if(!r||!Number.isInteger(n)||n<1||n>8)return fail('제작법을 확인해 주세요.');if(r.tool&&(n!==1||b.pick>=r.tool))return fail('이미 같은 등급 이상의 곡괭이가 있습니다.');if(r.tool===2&&b.pick<1)return fail('석재 곡괭이를 먼저 만들어 주세요.');if(r.bench&&!nearBench(w,p))return fail('공용 또는 개인 작업대 8m 안에서 만들 수 있습니다.');if(!affordable(b,r.cost,n))return fail('재료가 부족합니다.');if(!r.tool&&!canCredit(b,{[a.recipe]:r.count*n}))return fail('가방의 해당 묶음이 가득 찼습니다.');for(const [k,v]of Object.entries(r.cost))b.items[k]-=v*n;if(r.tool)b.pick=r.tool;else credit(b,{[a.recipe]:r.count*n});b.stats.crafted+=n;changed(w,now);return {ok:true};}
 if(a.type==='ws:place'){if(!(b.items[a.kind]>0))return fail('해당 블록을 먼저 제작해 주세요.');const error=canPut(w,a,p,players);if(error)return fail(error);const k=key(a.gx,a.gz,a.layer),pos=position(a.gx,a.gz,a.layer);b.items[a.kind]--;s.blocks[k]={key:k,gx:a.gx,gz:a.gz,layer:a.layer,...pos,kind:a.kind,owner:profile,rotation:Number.isInteger(a.rotation)?((a.rotation%4)+4)%4:0,at:now};b.stats.built++;note(w,RECIPES[a.kind].name+'을 쌓았습니다.',now);changed(w,now);return {ok:true,result:{key:k}};}
 if(a.type==='ws:mine'){
  const n=s.nodes[a.id],block=s.blocks[a.id],o=n||block;if(!o||!close(p,o,6))return fail('재료나 내 블록에 6m 안으로 다가가세요.');if(b.mining)return fail('이미 채집 중입니다. 이동하면 취소됩니다.');
  if(n){if(n.left<=0)return fail('이곳의 재료가 다시 모이는 중입니다.');const tier=n.kind==='crystal'?1:n.kind==='chrome'?1:0;if(b.pick<tier)return fail('석재 곡괭이 이상이 필요합니다.');if(!canCredit(b,{[n.kind]:4,...(n.kind==='fiber'?{seed:1}:{})}))return fail('가방의 해당 재료 묶음이 가득 찼습니다.');}
  else{const error=mineAllowed(w,block,profile,players);if(error)return fail(error);if(!canCredit(b,{[block.kind]:1}))return fail('가방의 해당 블록 묶음이 가득 찼습니다.');}
  b.mining={id:a.id,actor:by,kind:n?'node':'block',cycle:n?.cycle||0,at:now,until:now+(n?(b.pick===2?600:b.pick===1?1100:1900):650),origin:{x:p.x,y:p.y,z:p.z}};changed(w,now);return {ok:true};
 }
 if(a.type==='ws:cancel'){b.mining=null;changed(w,now);return {ok:true};}
 if(a.type==='ws:transfer'){const n=a.count??1,item=a.item;if(!ITEMS.has(item)||!Number.isInteger(n)||n<1||n>99||!['deposit','withdraw'].includes(a.direction))return fail('보관할 수량을 확인해 주세요.');if(!nearBench(w,p))return fail('작업대 8m 안에서 보관함을 열 수 있습니다.');const from=a.direction==='deposit'?b.items:s.stock,to=a.direction==='deposit'?s.stock:b.items;if((from[item]||0)<n)return fail('꺼내거나 맡길 수량이 부족합니다.');if((to[item]||0)+n>MAX_STACK)return fail('해당 보관 묶음이 가득 찼습니다.');from[item]-=n;to[item]=(to[item]||0)+n;note(w,(RESOURCES[item]||RECIPES[item]?.name)+'을 함께 보관합니다.',now);changed(w,now);return {ok:true};}
 if(a.type==='ws:plant'||a.type==='ws:water'||a.type==='ws:harvest'){const o=s.blocks[a.id];if(!o||o.kind!=='cropbed'||!close(p,o,6))return fail('재배 상자에 가까이 다가가세요.');
  if(a.type==='ws:plant'){if(o.crop)return fail('이미 작물이 자라고 있습니다.');if(!(b.items.seed>0))return fail('풀섬유를 채집해 씨앗을 구하세요.');b.items.seed--;o.crop={at:now,readyAt:now+120000,watered:false};}
  if(a.type==='ws:water'){if(!o.crop||o.crop.watered)return fail('심은 뒤 한 번 물을 줄 수 있습니다.');o.crop.watered=true;o.crop.readyAt=Math.max(now+15000,o.crop.readyAt-45000);}
  if(a.type==='ws:harvest'){if(!o.crop||now<o.crop.readyAt)return fail('열매가 익기를 기다려 주세요.');if(!canCredit(b,{berry:3,seed:1,fiber:1}))return fail('가방에 열매와 씨앗을 담을 자리가 필요합니다.');credit(b,{berry:3,seed:1,fiber:1});b.stats.harvest+=3;delete o.crop;note(w,'함께 가꾼 열매를 수확했습니다.',now);}
  changed(w,now);return {ok:true};
 }
 if(a.type==='ws:claim'){const q=QUESTS.find(q=>q.id===a.id);if(!q||b.claimed.includes(q.id))return fail('이미 받았거나 없는 의뢰입니다.');if(q.tool?b.pick<q.tool:(b.stats[q.stat]||0)<q.goal)return fail('의뢰를 조금 더 진행해 주세요.');if(!canCredit(b,q.reward))return fail('보상을 담을 가방 자리가 필요합니다.');b.claimed.push(q.id);credit(b,q.reward);changed(w,now);return {ok:true};}
 return fail('없는 공방 행동입니다.');
}
function step(w,players,now){const s=init(w,now);for(const n of Object.values(s.nodes))if(n.left===0&&now>=n.readyAt){n.left=n.deep?4:3;n.cycle++;changed(w,now);}
 for(const [profile,b]of Object.entries(s.bags)){const m=b.mining;if(!m)continue;const p=players[m.actor],o=m.kind==='node'?s.nodes[m.id]:s.blocks[m.id];
  if(!p||s.bindings[m.actor]!==profile||!o||!close(p,o,6)||Math.hypot(p.x-m.origin.x,p.z-m.origin.z)>1.5||Math.abs(p.y-m.origin.y)>2){b.mining=null;changed(w,now);continue;}if(now<m.until)continue;b.mining=null;
  if(m.kind==='node'){if(o.left<=0||o.cycle!==m.cycle){changed(w,now);continue;}const loot={[o.kind]:o.deep?4:3,...(o.kind==='fiber'?{seed:1}:{})};if(canCredit(b,loot)){credit(b,loot);b.stats.gather+=Object.values(loot).reduce((a,v)=>a+v,0);o.left--;if(!o.left)o.readyAt=now+180000;}}
  else if(!mineAllowed(w,o,profile,players)&&canCredit(b,{[o.kind]:1})){credit(b,{[o.kind]:1});delete s.blocks[m.id];}
  changed(w,now);
 }
}
function publicState(w){const s=w.workshop;if(!s)return null;const people={};for(const [id,profile]of Object.entries(s.bindings)){const b=s.bags[profile];if(b)people[id]={tag:tag(profile),items:{...b.items},pick:b.pick,stats:{...b.stats},claimed:[...b.claimed],mining:b.mining?{...b.mining,origin:undefined}:null};}
 return {revision:s.revision,rev:s.rev||0,nodes:s.nodes,blocks:Object.fromEntries(Object.entries(s.blocks).map(([k,b])=>[k,{...b,owner:tag(b.owner)}])),station:s.station,stock:s.stock,people,log:s.log};
}
function overlapsGarden(w,x,z,y){const s=w.workshop;if(!s)return false;if(Math.abs(y-s.station.y)<4&&dist({x,z},s.station)<3)return true;return Object.values(s.blocks).some(b=>Math.abs(x-b.x)<2&&Math.abs(z-b.z)<2&&y<b.y+SIZE+1&&y+4>b.y);}
function blocksMovement(w,x,z){const blocks=w.workshop?.blocks;if(!blocks)return false;const gx=Math.round(x/SIZE),gz=Math.round(z/SIZE),floor=E().terrain(x,z);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let layer=0;layer<3;layer++){const b=blocks[key(gx+dx,gz+dz,layer)];if(b&&Math.abs(x-b.x)<1.2&&Math.abs(z-b.z)<1.2&&b.y<floor+2.8&&b.y+SIZE>floor+.6)return true;}return false;}
globalThis.VillageWorkshop={SIZE,MAX_BLOCKS,RESOURCES,RECIPES,QUESTS,REVISION,init,command,step,publicState,position,ground,key,canPut,connected,nearBench,overlapsGarden,blocksMovement};
})();
