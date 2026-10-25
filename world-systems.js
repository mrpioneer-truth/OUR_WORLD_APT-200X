/* Internal simulation. Biological values are never part of the player-facing projection. */
(() => {
'use strict';
const HUMAN=Object.freeze({health:1000,stamina:300,grip:45,punch:120,kick:280,lift:700,armor:20,speed:250,reaction:220,regen:3});
const HOSTILE=Object.freeze({health:3500,stamina:450,grip:210,punch:480,kick:850,lift:2200,armor:85,speed:420,reaction:140,regen:12});
const FACTORS=[1.15,.95,.33,.72,1.5,1.35],RADIUS=180,EDGE=296,HOUR=3600000;
// Population floors are faction rules, never invulnerable individual health floors.
const ECOLOGY=Object.freeze({revision:2,residentFloor:6,hostileFloor:3,engagement:45000,peace:240000,arrival:60000,medical:120000});
const NEW_NAMES=['새봄','은결','라온','하늬','도담','수아','지안','늘봄','솔빛','아람','다솜','온유','한결','이솔','푸름','서우','노을','초아','산들','아린'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=s=>globalThis.VillageEngine.hash(s),terrain=(x,z)=>globalThis.VillageEngine.terrain(x,z);
function rng(w){w.rng=(Math.imul(w.rng||90210621,1664525)+1013904223)>>>0;return w.rng/4294967296;}
function body(profile,factor=1){const p={};for(const [k,v]of Object.entries(profile))p[k]=k==='reaction'?v/factor:v*factor;return {profile:p,hp:p.health,stamina:p.stamina,alive:true,lastHurt:0,lastCombat:0,traumaUntil:0,bleeding:0,heldBy:null,heldUntil:0};}
function init(w,now=w.clock||Date.now()){w.rng??=Math.floor(hash(w.room)*4294967295);w.incidents??=[];w.squads??=[];w.combatEvents??=[];w.scars??=[];
 w.chromeSources??=[{id:'mirror-ring',name:'광장의 크롬 환',x:-23,z:-13,type:'ring'},{id:'fountain-prong',name:'분수의 크롬 가지',x:130,z:-20,type:'fork'},{id:'sky-prism',name:'하늘 입구의 크롬 조각',x:90,z:-170,type:'prism'},{id:'garden-ring',name:'정원 경계의 크롬 환',x:-46,z:-36,type:'ring'},{id:'gate-prong',name:'출입구의 크롬 가지',x:72,z:-79,type:'fork'}].map(s=>({...s,takenBy:null,readyAt:0,scar:0}));
 for(const source of w.chromeSources)source.holders??=source.takenBy?[source.takenBy]:[];
 for(const [i,r]of w.residents.entries()){r.body??=body(HUMAN);r.state??='idle';r.home??={x:r.x,z:r.z};r.escort??=null;r.requestAt??={};r.weapon??=null;if(r.weapon?.acquired===false){const source=w.chromeSources.find(s=>s.id===r.weapon.source);if(source&&blocked(w,source.x,source.z)){releaseChrome(w,r,now);r.weapon=null;r.target=null;r.plan=null;r.route=[];r.state='idle';}}r.nextAttack??=0;r.route??=[];r.leg??=0;r.generation??=0;}
 let i=0;for(const c of w.creatures){if(!c.friendly){c.factor??=FACTORS[i];i++;c.body??=body(HOSTILE,c.factor);c.state??='roam';c.nextAttack??=0;c.nextDamage??=w.created+60000+Number(c.id.slice(1))*13000;c.route??=[];c.generation??=0;}else c.state??='roam';}
 if(w.ecology?.revision!==ECOLOGY.revision){w.ecology={revision:ECOLOGY.revision,truceUntil:now+90000,nextHunt:now+90000,arrivalSerial:0,history:[]};w.rulesRevision=ECOLOGY.revision;w.squads=[];for(const e of [...w.residents,...w.creatures.filter(c=>!c.friendly)]){e.enemy=null;e.pending=null;e.squad=null;e.route=[];e.routeAt=0;e.safeUntil=now+90000;e.nextAttack=now+90000;if(e.body.alive){e.state=e.id.startsWith('r')?'idle':'roam';e.target=null;}if(e.weapon){releaseChrome(w,e,now);e.weapon=null;}}for(const c of w.creatures.filter(c=>!c.friendly)){c.engagementAt=0;c.nextDamage=now+240000+hash(c.id)*180000;}for(const i of w.incidents)if(i.status!=='closed')i.status='closed';maintainPopulation(w,now);}
 return w;
}
function releaseChrome(w,r,now){const source=w.chromeSources.find(s=>s.id===r.weapon?.source);if(source){source.holders=(source.holders||[]).filter(id=>id!==r.id);source.takenBy=source.holders[0]||null;if(!source.takenBy)source.readyAt=now+12000;}}
function power(b){if(!b?.alive)return 0;return (b.stamina<=0?.5:1)*(b.hp<300?.5:b.traumaUntil>0?.8:1);}
function weaponDamage(seconds,type='ring'){return (180+Math.min(6,Math.max(0,seconds))*170)*({ring:1,fork:1.08,prism:1.24}[type]||1);}
function armor(b,zone){return zone==='face'?Math.min(4,b.profile.armor):zone==='abdomen'?b.profile.armor*.75:zone==='thigh'?b.profile.armor*2:b.profile.armor;}
function damage(w,target,energy,now,zone='torso',by=null){const b=target.body;if(!b?.alive)return 0;const amount=Math.max(0,energy-armor(b,zone));b.hp=Math.max(0,b.hp-amount);b.lastHurt=b.lastCombat=now;
 if(b.hp<=b.profile.health*.3){b.traumaUntil=Math.max(b.traumaUntil,now+21*24*HOUR);b.bleeding=Math.max(b.bleeding,.001);}
 if(b.hp<=0){b.alive=false;target.state='dead';target.target=null;target.route=[];target.escort=null;target.pending=null;target.fellAt=now;if(target.weapon){globalThis.VillageAdventure?.dropResident(w,target,now);releaseChrome(w,target,now);target.weapon.dropped=true;}note(w,target.id,target.name+'이 더는 일어나지 못합니다.',now);}
 else if(target.id.startsWith('r')&&b.hp<300)target.state='injured';
 w.combatEvents.push({id:'hit-'+(w.eventSerial=(w.eventSerial||0)+1),at:now,x:target.x,y:target.y+1.2,z:target.z,kind:amount>600?'impact':'hit',by,target:target.id});w.combatEvents=w.combatEvents.slice(-50);w.rev++;return amount;
}
function recover(entity,dt,now){const b=entity.body;if(!b?.alive)return;b.bleeding=Math.max(0,b.bleeding-dt*(entity.id.startsWith('c')?.005:.00005));if(b.bleeding>0)b.hp=Math.max(0,b.hp-b.bleeding*dt);if(b.hp<=0){b.alive=false;entity.state='dead';entity.fellAt=now;return;}
 if(b.traumaUntil&&b.traumaUntil<=now)b.traumaUntil=0;
 const resting=now-b.lastCombat>12000&&(!entity.target||entity.state==='sleep');if(now-b.lastHurt>30000){const cap=b.traumaUntil>now?b.profile.health-1:b.profile.health;b.hp=Math.min(cap,b.hp+(entity.state==='sleep'&&entity.id.startsWith('r')?15:b.profile.regen)*dt/3600);}
 b.stamina=Math.min(b.profile.stamina,b.stamina+dt*(resting?7:now-b.lastCombat>6000?3:0));
}
function note(w,by,text,now){w.log.push({by,text,at:now});w.log=w.log.slice(-160);}
function sanctuary(e){return e.id.startsWith('r')&&protectedGround(e);}
function fit(e){const b=e.body;return b?.alive&&b.hp>=b.profile.health*(e.id.startsWith('r')?.6:.45)&&b.stamina>b.profile.stamina*.2;}
function available(w,e,now){return fit(e)&&now>=(e.safeUntil||0)&&now>=(w.ecology?.truceUntil||0)&&!sanctuary(e)&&!e.space&&!(e.sleepPlace&&e.state==='sleep');}
function retreat(w,e,now){if(!e.body?.alive)return;const human=e.id.startsWith('r');e.enemy=null;e.pending=null;e.squad=null;e.plan=null;e.route=[];e.routeAt=0;e.body.heldBy=null;e.body.heldUntil=0;e.safeUntil=Math.max(e.safeUntil||0,now+ECOLOGY.peace);e.state='retreat';e.retreatTo=human?{x:(Number(e.id.slice(1))%5-2)*4,z:30+Math.floor(Number(e.id.slice(1))/5)*5}:outerHome(e);e.target=null;if(e.weapon){if(e.body.hp<e.body.profile.health*.6)globalThis.VillageAdventure?.dropResident(w,e,now);releaseChrome(w,e,now);if(e.body.hp<e.body.profile.health*.6)e.weapon=null;else {e.weapon.acquired=true;e.weapon.charging=false;e.weapon.charge=0;}}if(!human)e.nextDamage=Math.max(e.nextDamage||0,now+ECOLOGY.peace);}
function outerHome(c){const d=Math.hypot(c.homeX,c.homeZ)||1;return {x:c.homeX/d*224,z:c.homeZ/d*224};}
function endEncounter(w,c,now){c.engagementAt=0;retreat(w,c,now);for(const r of w.residents)if(r.enemy===c.id||w.squads.some(s=>s.target===c.id&&s.id===r.squad))retreat(w,r,now);w.squads=w.squads.filter(s=>s.target!==c.id);for(const i of w.incidents)if(i.target===c.id)i.status='closed';w.ecology.nextHunt=Math.max(w.ecology.nextHunt,now+ECOLOGY.peace);note(w,c.id,'서로 거리를 벌렸습니다. 정원에 잠시 고요가 돌아옵니다.',now);w.rev++;}
function arrive(w,e,now,cause){const human=e.id.startsWith('r'),previous={id:e.id,lifeId:e.id+':'+(e.generation||0),name:e.name,at:now,cause,alive:!!e.body.alive};w.ecology.history.push(previous);w.ecology.history=w.ecology.history.slice(-80);w.ecology.arrivalSerial++;if(!human)endEncounter(w,e,now);for(const squad of w.squads)squad.members=squad.members.filter(id=>id!==e.id);if(e.weapon)releaseChrome(w,e,now);e.generation=(e.generation||0)+1;
 if(human){e.name=NEW_NAMES[(w.ecology.arrivalSerial-1)%NEW_NAMES.length];e.body=body(HUMAN);e.x=(Number(e.id.slice(1))%5-2)*4;e.z=30+Math.floor(Number(e.id.slice(1))/5)*5;e.home={x:e.x,z:e.z};e.inbox=null;e.requestAt={};e.escort=null;e.weapon=null;e.next=now+5000;e.say=cause==='recovery'?'이웃이 쉬는 동안 제가 정원을 돌볼게요.':'새로 이사 왔어요. 함께 정원을 가꿔요.';e.until=now+18000;note(w,e.id,e.name+'이 새 이웃으로 단지에 들어왔습니다.',now);}
 else{e.baseName??=e.name;e.name=e.baseName+' · 낯선 개체';e.body=body(HOSTILE,e.factor);const p=outerHome(e);e.x=p.x;e.z=p.z;e.nextDamage=now+300000+hash(e.id)*180000;e.engagementAt=0;note(w,e.id,'단지 바깥에서 '+e.baseName+'의 다른 개체가 모습을 드러냈습니다.',now);}
 e.alert=null;e.alarmAt=0;e.threat=null;e.fearUntil=0;e.backpedaling=false;e.y=terrain(e.x,e.z);e.alive=true;e.state=human?'idle':'roam';e.safeUntil=now+90000;e.enemy=null;e.pending=null;e.target=null;e.plan=null;e.squad=null;e.route=[];e.routeGoal=null;e.routeAt=0;e.retreatTo=null;e.fellAt=null;e.replacementAt=null;e.unfitSince=null;e.space=null;e.nextAttack=now+90000;e.restUntil=0;e.moving=false;w.rev++;
}
function maintainPopulation(w,now){if(!w.ecology)return;for(const [list,floor]of [[w.residents,ECOLOGY.residentFloor],[w.creatures.filter(c=>!c.friendly),ECOLOGY.hostileFloor]]){let living=list.filter(e=>e.body.alive).length;for(const e of list){if(!e.body.alive){e.replacementAt??=now+ECOLOGY.arrival+Number(e.id.slice(1))*9000;if(living<floor||now>=e.replacementAt){arrive(w,e,now,'death');living++;}continue;}
  if(e.body.hp<e.body.profile.health*(e.id.startsWith('r')?.6:.45)){e.unfitSince??=now;if(now-e.unfitSince>=ECOLOGY.medical)arrive(w,e,now,'recovery');}else e.unfitSince=null;
 }}
 // Cancel old-world references, including already-wound-up attacks against a departed life.
 for(const e of [...w.residents,...w.creatures.filter(c=>!c.friendly)])if(e.pending?.lifeId!==undefined){const target=[...w.residents,...w.creatures].find(x=>x.id===e.pending.target);if(!target||target.generation!==e.pending.lifeId)e.pending=null;}
}
function safeSite(w,x,z){return Math.hypot(x,z)<RADIUS&&!(x>50&&x<92&&z< -75&&z> -196)&&!blocked(w,x,z);}
function blocked(w,x,z){if(globalThis.VillageAdventure?.reserved(x,z))return true;if(globalThis.VillageWorkshop?.blocksMovement(w,x,z))return true;if(w.obstacles?.some(b=>x>b[0]-.9&&x<b[1]+.9&&z>b[2]-.9&&z<b[3]+.9))return true;return x>70&&x<89&&z< -75&&z> -118;}
// Cached coarse routes are calculated only on a new destination; no per-frame full-map search.
function path(w,start,goal){const avoid=!!start.body&&start.id?.startsWith('c')&&!start.friendly,obstruct=(x,z)=>blocked(w,x,z)||(avoid&&protectedGround({x,z}));const G=6,key=(x,z)=>x+','+z,round=v=>Math.round(v/G),sx=round(start.x),sz=round(start.z),gx=round(goal.x),gz=round(goal.z);if(!obstruct(goal.x,goal.z)&&distance(start,goal)<8)return [{x:goal.x,z:goal.z}];
 const open=[{x:sx,z:sz,g:0,f:0}],best=new Map([[key(sx,sz),0]]),parents=new Map();let end=null,visits=0;while(open.length&&visits++<1800){let bi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[bi].f)bi=i;const n=open.splice(bi,1)[0];if(Math.hypot(n.x-gx,n.z-gz)<=1.4){end=n;break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const x=n.x+dx,z=n.z+dz;if(Math.hypot(x*G,z*G)>EDGE||obstruct(x*G,z*G)||obstruct((x+n.x)*G/2,(z+n.z)*G/2))continue;const k=key(x,z),g=n.g+Math.hypot(dx,dz);if(g>=(best.get(k)??Infinity))continue;best.set(k,g);parents.set(k,n);open.push({x,z,g,f:g+Math.hypot(x-gx,z-gz)});}}
 if(!end)return [];const route=[];for(let n=end;n&&(n.x!==sx||n.z!==sz);n=parents.get(key(n.x,n.z)))route.push({x:n.x*G,z:n.z*G});route.reverse();if(!obstruct(goal.x,goal.z))route.push({x:goal.x,z:goal.z});return route;
}
function walk(w,e,goal,speed,dt,now){if(!goal)return false;if(!e.routeAt||!e.routeGoal||distance(e.routeGoal,goal)>5||!e.route?.length&&distance(e,goal)>3&&now>=(e.routeRetryAt||e.routeAt+10000)){e.route=path(w,e,goal);e.routeAt=now;e.routeRetryAt=now+10000;e.routeGoal={...goal};}
 let wp=e.route?.[0]||goal,d=distance(e,wp);if(d<.9&&e.route.length){e.route.shift();wp=e.route[0]||goal;d=distance(e,wp);}if(d>.5){const step=Math.min(d,speed*dt),nx=e.x+(wp.x-e.x)/d*step,nz=e.z+(wp.z-e.z)/d*step;const allowed=e.id.startsWith('r')&&!e.escort&&e.state!=='return'?RADIUS:EDGE;if(Math.hypot(nx,nz)<=allowed&&!blocked(w,nx,nz)&&(!e.body||!e.id.startsWith('c')||e.friendly||!protectedGround({x:nx,z:nz})||protectedGround(e)&&(globalThis.VillageAdventure?.inRefuge(e)?Math.hypot(nx,nz-145)>Math.hypot(e.x,e.z-145):Math.hypot(nx,nz-32)>Math.hypot(e.x,e.z-32)))){e.h=Math.atan2(nx-e.x,nz-e.z);e.x=nx;e.z=nz;e.leg=(e.leg||0)+step*1.8;e.moving=true;}else if(e.route.length&&now>=e.routeRetryAt){e.route=[];e.routeRetryAt=now+3000;}}e.y=terrain(e.x,e.z);return distance(e,goal)<1.5;
}
function reply(r,round){const text=r.inbox?.text||'';if(/가로등|조명|빛|불/.test(text))return '그쪽 길에는 제가 불을 밝혀 둘게요.';if(/화단|꽃|정원|물/.test(text))return '알겠어요. 새 화단도 같이 돌봐요.';return ['돌아오는 길을 살피고 올게요.','좋아요. 다음 모퉁이에서 다시 만나요.','말씀 기억할게요. 천천히 다녀오세요.','저도 이 길이 좋아요. 함께 가꿔요.'][round%4];}
function rollSite(w,r,now){for(let n=0;n<30;n++){const radius=RADIUS*Math.sqrt(rng(w))*.97,a=rng(w)*Math.PI*2,x=Math.round(Math.cos(a)*radius/2)*2,z=Math.round(Math.sin(a)*radius/2)*2;if(safeSite(w,x,z))return {x,z};}return {x:r.x,z:r.z};}
function command(w,a,by,players,now){if(a.type==='escort'||a.type==='releaseEscort'){const r=w.residents.find(r=>r.id===a.id),p=players[by];if(!r?.body.alive||!p||distance(r,p)>9||Math.abs(r.y-p.y)>4)return {ok:false,error:'주민에게 가까이 다가가세요.'};if(a.type==='releaseEscort'){if(r.escort?.by!==by)return {ok:false,error:'함께 걷고 있지 않습니다.'};r.escort=null;r.state='return';r.target={...r.home};r.routeAt=0;note(w,r.id,'잘 다녀왔네요. 저는 단지로 돌아갈게요.',now);w.rev++;return {ok:true};}
 if(r.escort){return {ok:false,error:'지금은 다른 약속을 지키는 중입니다.'};}if(now-(r.requestAt[by]||0)<60000)return {ok:false,error:'주민에게 생각할 시간을 주세요.'};r.requestAt[by]=now;
 const accepted=rng(w)<.45;if(accepted){r.escort={by,at:now,lastSeen:now};r.state='escort';r.squad=null;r.target=null;r.route=[];r.say='앞장서세요. 끝까지 함께 다녀올게요.';}else{r.say='지금은 이곳을 지켜야 해요. 다음에 함께 걸어요.';}r.until=now+10000;note(w,r.id,r.say,now);w.rev++;return {ok:true,result:{accepted}};}
 return null;}
// Perception is independent of attack permission: peace/recovery never makes neighbors oblivious.
const ENCOUNTER=Object.freeze({notice:26,danger:18,pursuit:34,warning:1200,memory:4500,standoff:7});
function awake(e){return !!e&&!e.space&&!e.c&&(e.body?e.body.alive:true)&&!(e.state==='sleep'&&e.sleepPlace);}
function clearSight(w,a,b){const d=distance(a,b),n=Math.max(1,Math.ceil(d/1.5));for(let i=1;i<n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(w.obstacles?.some(o=>x>o[0]&&x<o[1]&&z>o[2]&&z<o[3])||globalThis.VillageWorkshop?.blocksMovement(w,x,z))return false;}return true;}
function perceives(w,a,b,radius=ENCOUNTER.notice){return awake(a)&&awake(b)&&Math.abs(a.y-b.y)<4&&distance(a,b)<=radius&&clearSight(w,a,b);}
function protectedGround(e){return Math.hypot(e.x,e.z-32)<22||!!globalThis.VillageAdventure?.inRefuge(e);}
function weaponReady(r){return !!r.weapon&&!r.weapon.dropped&&r.weapon.acquired!==false;}
function escapePoint(w,r,c){const radius=r.escort?EDGE:RADIUS,dx=r.x-c.x,dz=r.z-c.z,d=Math.hypot(dx,dz)||1,home={x:(Number(r.id.slice(1))%5-2)*3,z:30+Math.floor(Number(r.id.slice(1))/5)*3};
 // Head for the shelter if the threat is not directly between the resident and its entrance.
 const toHome={x:home.x-r.x,z:home.z-r.z},homeLength=Math.hypot(toHome.x,toHome.z)||1,awayDot=(toHome.x*dx+toHome.z*dz)/(homeLength*d);
 if(awayDot>-.25&&!blocked(w,home.x,home.z))return home;
 for(const turn of [0,.65,-.65,1.15,-1.15]){const a=Math.atan2(dx,dz)+turn;let x=r.x+Math.sin(a)*18,z=r.z+Math.cos(a)*18;const len=Math.hypot(x,z);if(len>radius-2){x=x/len*(radius-2);z=z/len*(radius-2);}if(!blocked(w,x,z)&&distance({x,z},c)>distance(r,c)+3)return {x,z};}
 return home;
}
function fear(w,r,c,now){const key=c.id+':'+(c.generation||0);if(r.threat?.life!==key){r.threat={id:c.id,life:key,x:c.x,y:c.y,z:c.z,last:now};r.route=[];r.routeAt=0;r.say='위험해요. 안쪽 쉼터로 피하세요!';r.until=now+5000;r.fearNoticeAt=now;event(w,'alert',r.x,r.y+2.8,r.z,now,c.id,r.id);w.rev++;}else Object.assign(r.threat,{x:c.x,y:c.y,z:c.z,last:now});r.fearUntil=now+ENCOUNTER.memory;}
function fleeResident(w,r,c,now,dt){r.enemy=null;r.pending=null;r.plan=null;r.target=null;if(r.squad){const squad=w.squads.find(s=>s.id===r.squad);if(squad)squad.members=squad.members.filter(id=>id!==r.id);r.squad=null;}if(r.weapon&&!weaponReady(r)){releaseChrome(w,r,now);r.weapon=null;}
 if(protectedGround(r)){r.state='watch';r.h=Math.atan2(c.x-r.x,c.z-r.z);if(distance(r,c)<12)walk(w,r,{x:0,z:34},3.8*power(r.body),dt,now);return;}
 r.state='flee';const goal=escapePoint(w,r,c);walk(w,r,goal,Math.min(7,r.body.profile.speed/36)*power(r.body),dt,now);r.body.stamina=Math.max(0,r.body.stamina-9*dt);r.body.lastCombat=now;
}
function raiseAlarm(w,c,r,now){if(now-(c.alarmAt||0)<90000||w.incidents.some(i=>i.target===c.id&&i.status!=='closed'))return;c.alarmAt=now;w.incidents.push({id:'i'+(w.incidentSerial=(w.incidentSerial||0)+1),at:now,target:c.id,x:r.x,z:r.z,status:'open',kind:'threat'});w.incidents=w.incidents.slice(-24);note(w,r.id,'크리처가 주민을 추격합니다. 무장한 지원조가 필요합니다.',now);w.rev++;}
function localEncounter(w,c,living,hostile,players,now,dt){
 const visitors=Object.entries(players).map(([id,p])=>({...p,id:'visitor:'+id,visitor:id}));
 const seen=[...living,...visitors].filter(t=>perceives(w,c,t,ENCOUNTER.notice));
 const previous=[...living,...visitors].find(t=>t.id===c.alert?.target&&(!t.body||t.generation===(c.alert.generation||0))&&perceives(w,c,t,ENCOUNTER.pursuit));
 const squad=w.squads.find(s=>s.target===c.id&&s.phase==='hunt');
 const eligible=seen.filter(t=>!protectedGround(t)),visible=previous&&!protectedGround(previous)?previous:eligible.sort((a,b)=>distance(c,a)-distance(c,b))[0]||seen.sort((a,b)=>distance(c,a)-distance(c,b))[0];
 if(!visible){if(c.alert&&now-c.alert.last<ENCOUNTER.memory){c.state='watch';c.h=Math.atan2(c.alert.x-c.x,c.alert.z-c.z);c.pending=null;return true;}c.alert=null;return false;}
 const t=visible,d=distance(c,t);if(c.alert?.target!==t.id||c.alert?.generation!==(t.generation||0)){c.alert={target:t.id,generation:t.generation||0,since:now,last:now,x:t.x,z:t.z};c.pending=null;c.route=[];c.routeAt=0;event(w,'alert',c.x,c.y+2,c.z,now,c.id,t.id);w.rev++;}else Object.assign(c.alert,{last:now,x:t.x,z:t.z});
 c.enemy=t.id;c.h=Math.atan2(t.x-c.x,t.z-c.z);const warned=now-c.alert.since>=ENCOUNTER.warning;
 if(!warned){c.state='notice';c.pending=null;return true;}
 const attackerAvailable=available(w,c,now),victimAvailable=t.visitor?!protectedGround(t):available(w,t,now),otherFight=hostile.some(x=>x!==c&&x.engagementAt),population=w.residents.filter(r=>r.body.alive).length>ECOLOGY.residentFloor&&hostile.length>ECOLOGY.hostileFloor;
 const mayAttack=attackerAvailable&&victimAvailable&&!otherFight&&(population||c.engagementAt||squad);
 if(globalThis.VillageAdventure?.inRefuge(c)){c.state='watch';c.pending=null;walk(w,c,outerHome(c),4*power(c.body),dt,now);return true;}
 if(protectedGround(c)){const dx=c.x,dz=c.z-32,n=Math.hypot(dx,dz)||1;c.state='watch';c.pending=null;walk(w,c,{x:(dx||1)/n*25,z:32+dz/n*25},3.4*power(c.body),dt,now);return true;}
 if(protectedGround(t)){c.state='watch';c.pending=null;if(d>12){const vx=c.x-t.x,vz=c.z-t.z,n=Math.hypot(vx,vz)||1;walk(w,c,{x:t.x+vx/n*12,z:t.z+vz/n*12},2.2*power(c.body),dt,now);}return true;}
 if(!mayAttack){c.state='stalk';c.pending=null;if(d<5){const n=d||1;walk(w,c,{x:c.x+(c.x-t.x)/n*4,z:c.z+(c.z-t.z)/n*4},2.6*power(c.body),dt,now);}else if(d>ENCOUNTER.standoff)walk(w,c,t,2.2*power(c.body),dt,now);return true;}
 const chase=now-c.alert.since>=3200||d<8;c.state=chase?'chase':'stalk';
 if(d>2.5)walk(w,c,t,(chase?Math.min(11.7,c.body.profile.speed/36):3.7)*power(c.body),dt,now);c.h=Math.atan2(t.x-c.x,t.z-c.z);
 if(chase||d<10){c.body.stamina=Math.max(0,c.body.stamina-10*dt);c.body.lastCombat=now;}
 if(d<10){c.engagementAt||=now;c.state='fight';if(!c.pending&&now>=c.nextAttack){const rush=d>4;c.nextAttack=now+(rush?3600:2300);event(w,'warning',t.x,t.y+.1,t.z,now,c.id,t.id);
  if(t.visitor){w.shriek={at:now,id:c.id,text:c.name+'이 달려듭니다. 거리를 벌리세요!'};event(w,'lunge',t.x,t.y+1,t.z,now,{x:c.x,y:c.y+1,z:c.z},{x:t.x,y:t.y+1,z:t.z});w.rev++;}
  else {raiseAlarm(w,c,t,now);c.pending={target:t.id,lifeId:t.generation||0,energy:rush?c.body.profile.kick:c.body.profile.punch,at:now+(rush?1050:650),range:rush?11:3.8,windup:rush?1050:650,grab:!rush&&rng(w)<.15};}}}
 return true;
}

function flanked(target,attackers){const nearby=attackers.filter(a=>a.body?.alive&&distance(a,target)<30);if(nearby.length<3)return false;const buckets=new Set(nearby.map(a=>Math.floor((Math.atan2(a.x-target.x,a.z-target.z)+Math.PI)/(Math.PI/2))%4));return nearby.length>=5&&buckets.size>=3;}
function hitChance(target,attackers,windup=800){return flanked(target,attackers)?.92:target.body.profile.reaction<windup?(attackers.length<=2?.18:.5):.82;}
function arm(w,r,now){if(r.weapon&&!r.weapon.dropped)return;const squad=w.squads.find(s=>s.id===r.squad),preferred=squad&&w.chromeSources.find(s=>s.id===squad.source);const choices=preferred?[preferred]:w.chromeSources.filter(s=>(s.holders?.length||0)<5&&s.readyAt<=now);const free=choices.filter(s=>!blocked(w,s.x,s.z)&&r.body.profile.lift*power(r.body)>=({ring:180,fork:320,prism:680}[s.type]||180)).sort((a,b)=>distance(a,r)-distance(b,r))[0];if(!free)return;free.holders??=[];if(!free.holders.includes(r.id))free.holders.push(r.id);free.takenBy=free.holders[0];r.weapon={source:free.id,type:free.type,charge:0,charging:false,acquired:false};r.state='arm';r.plan=null;r.target={x:free.x,z:free.z};r.routeAt=0;}

function event(w,kind,x,y,z,now,from,to){w.combatEvents.push({id:'fx-'+(w.eventSerial=(w.eventSerial||0)+1),kind,x,y,z,at:now,from,to});w.combatEvents=w.combatEvents.slice(-50);}
function incident(w,c,o,now){w.incidents.push({id:'i'+(w.incidentSerial=(w.incidentSerial||0)+1),at:now,target:c.id,x:o.x,z:o.z,status:'open'});w.incidents=w.incidents.slice(-24);w.scars.push({x:o.x,y:o.y,z:o.z,at:now,kind:o.kind||'chrome'});w.scars=w.scars.slice(-48);note(w,c.id,c.name+'이 정원을 망가뜨렸습니다.',now);w.rev++;}
function makeSquads(w,now){if(now<w.ecology.nextHunt||now<w.ecology.truceUntil||w.squads.length||w.residents.filter(r=>r.body.alive).length<=ECOLOGY.residentFloor||w.creatures.filter(c=>!c.friendly&&c.body.alive).length<=ECOLOGY.hostileFloor)return;for(const i of w.incidents.filter(i=>i.status==='open')){const c=w.creatures.find(c=>c.id===i.target&&available(w,c,now));if(!c){i.status='closed';continue;}const members=w.residents.filter(r=>fit(r)&&now>=(r.safeUntil||0)&&!r.escort&&!r.squad&&(!r.threat||weaponReady(r))).sort((a,b)=>distance(a,i)-distance(b,i)).slice(0,5);if(members.length<5)continue;const source=w.chromeSources.filter(s=>s.readyAt<=now&&Math.hypot(s.x,s.z)<=RADIUS&&!blocked(w,s.x,s.z)).sort((a,b)=>members.reduce((n,r)=>n+distance(a,r),0)-members.reduce((n,r)=>n+distance(b,r),0))[0]||w.chromeSources[0];const squad={id:'s'+i.id,target:c.id,members:members.map(r=>r.id),at:now,phase:'gather',source:source.id,rally:{x:source.x,z:source.z}};w.squads.push(squad);i.status='pursuing';for(const r of members){r.squad=squad.id;r.state='hunt';r.plan=null;r.target=null;r.route=[];r.say=i.kind==='threat'?'이웃을 도우러 함께 가요.':'정원을 지키러 함께 가요.';r.until=now+10000;arm(w,r,now);}note(w,members[0].id,i.kind==='threat'?'위협받는 이웃을 돕기 위해 무장 지원조가 모였습니다.':'정원을 훼손한 크리처를 막으러 사냥조가 모였습니다.',now);w.rev++;break;}}
function resolve(w,a,actors,opponents,now){const pending=a.pending;if(!pending||pending.at>now)return;delete a.pending;const target=opponents.find(o=>o.id===pending.target&&o.body?.alive);if(!target||pending.lifeId!==undefined&&pending.lifeId!==(target.generation||0)||!available(w,a,now)||!available(w,target,now)||distance(a,target)>pending.range||Math.abs(a.y-target.y)>5||!clearSight(w,a,target))return;
 const allies=actors.filter(o=>o.body?.alive&&distance(o,target)<30),laser=a.id.startsWith('r')&&pending.weapon,chance=laser?.66:hitChance(target,allies,pending.windup);a.body.lastCombat=now;
 const hit=rng(w)<chance;if(laser){const from={x:a.x,y:a.y+1.8,z:a.z},to={x:target.x+(hit?0:3.5),y:target.y+1.2+(hit?0:1),z:target.z+(hit?0:2)};event(w,'arc',to.x,to.y,to.z,now,from,to);w.combatEvents.at(-1).hit=hit;w.combatEvents.at(-1).charge=Math.min(1,(pending.chargeSeconds||0)/6);}
 if(!hit){event(w,'evade',target.x,target.y+1,target.z,now,a.id,target.id);return;}
 const human=a.id.startsWith('r');const energy=pending.energy*power(a.body);damage(w,target,energy,now,pending.zone||'torso',a.id);if(!laser)event(w,'strike',target.x,target.y+1.2,target.z,now,{x:a.x,y:a.y+1.8,z:a.z},{x:target.x,y:target.y+1.2,z:target.z});
 if(!human&&target.body.alive&&pending.grab){target.body.heldBy=a.id;target.body.heldUntil=now+2600;event(w,'grasp',target.x,target.y+1,target.z,now,a.id,target.id);}
}
function combatResident(w,r,c,allies,now,dt,{defensive=false}={}){const b=r.body;if(!b.alive)return;const d=distance(r,c);r.enemy=c.id;b.lastCombat=now;
 if(b.heldBy){const holder=w.creatures.find(c=>c.id===b.heldBy&&c.body?.alive),helpers=allies.filter(o=>o.id!==r.id&&o.body?.alive&&distance(o,r)<6),grip=helpers.reduce((n,o)=>n+o.body.profile.grip*power(o.body),0),push=helpers.reduce((n,o)=>n+o.body.profile.lift*power(o.body),0);if(!holder||grip>=holder.body.profile.grip*.85||push>=holder.body.profile.lift*.95||now>b.heldUntil){b.heldBy=null;r.state='guard';}else{r.state='held';return;}}
 if(r.state==='arm'&&r.target){if(walk(w,r,r.target,3.6*power(b),dt,now)){r.state='hunt';r.target=null;r.weapon.acquired=true;}else return;}
 if(!r.weapon)arm(w,r,now);if(r.state==='arm')return;
 const index=Math.max(0,allies.indexOf(r)),angle=index/Math.max(1,allies.length)*Math.PI*2,range=r.weapon?10:2.2;
 const target={x:c.x+Math.cos(angle)*range,z:c.z+Math.sin(angle)*range};
 r.backpedaling=false;if(defensive&&d<8){r.state='guard';walk(w,r,escapePoint(w,r,c),4.3*power(b),dt,now);r.backpedaling=true;b.stamina=Math.max(0,b.stamina-4*dt);}else if(!defensive&&(d>range+2||distance(r,target)>3.5&&d>4)){r.state='approach';walk(w,r,target,Math.min(7,b.profile.speed/36)*power(b),dt,now);b.stamina=Math.max(0,b.stamina-9*dt);return;}
 r.h=Math.atan2(c.x-r.x,c.z-r.z);r.target=null;if(!r.backpedaling)r.moving=false;
 if(r.pending)return;if(now<r.nextAttack){r.state='guard';return;}
 if(r.weapon){r.state='charge';r.weapon.charging=true;r.weapon.charge=Math.min(6,r.weapon.charge+dt);b.stamina=Math.max(0,b.stamina-4*dt);const seconds=1.2+(hash(r.id)*1.2);if(r.weapon.charge>=seconds||d<2.3){r.pending={target:c.id,lifeId:c.generation||0,energy:weaponDamage(r.weapon.charge,r.weapon.type),weapon:true,chargeSeconds:r.weapon.charge,at:now+Math.max(120,b.profile.reaction),range:30,windup:1100};r.weapon.charging=false;r.weapon.charge=0;r.nextAttack=now+1600;b.stamina=Math.max(0,b.stamina-16);r.state='strike';}}
 else{const kick=d>1.4;r.pending={target:c.id,lifeId:c.generation||0,energy:kick?b.profile.kick:b.profile.punch,at:now+Math.max(120,b.profile.reaction),range:3.2,windup:600};r.nextAttack=now+1100;b.stamina=Math.max(0,b.stamina-(kick?14:9));r.state='strike';}}
function step(w,players,now,dt,{rules,place,log,scheduleResident}){init(w,now);dt=Math.min(dt,.5);
 for(const e of [...w.residents,...w.creatures.filter(c=>!c.friendly)]){recover(e,dt,now);if(!e.body?.alive&&e.weapon&&!e.weapon.dropped){globalThis.VillageAdventure?.dropResident(w,e,now);releaseChrome(w,e,now);e.weapon.dropped=true;}e.moving=false;}maintainPopulation(w,now);const living=w.residents.filter(r=>r.body.alive),hostile=w.creatures.filter(c=>!c.friendly&&c.body.alive);
 for(const squad of [...w.squads])if(squad.phase==='hunt'&&squad.members.filter(id=>living.some(r=>r.id===id&&r.squad===squad.id&&fit(r))).length<3){const c=hostile.find(c=>c.id===squad.target);if(c)endEncounter(w,c,now);}
 for(const c of hostile)if(c.engagementAt&&(!fit(c)||now-c.engagementAt>=ECOLOGY.engagement||living.length<=ECOLOGY.residentFloor||hostile.length<=ECOLOGY.hostileFloor))endEncounter(w,c,now);
 for(const c of w.creatures){if(c.friendly){const follower=players[c.follow],goal=follower&&Math.abs(follower.y-c.y)<4?{x:follower.x+2,z:follower.z+2}:{x:c.homeX+Math.sin(now/13000+hash(c.id)*20)*8,z:c.homeZ+Math.cos(now/15000+hash(c.id)*30)*8};walk(w,c,goal,2.1,dt,now);c.state='roam';continue;}if(!c.body.alive){c.state='dead';continue;}
  if(c.state==='sleep'&&c.sleepPlace){c.pending=null;c.moving=false;continue;}if(c.state==='retreat'){if(walk(w,c,c.retreatTo,5*power(c.body),dt,now))c.state='rest';continue;}// Recovering creatures still notice their surroundings.
  const b=c.body;if(localEncounter(w,c,living,hostile,players,now,dt))continue;
  if(c.engagementAt){endEncounter(w,c,now);continue;}
  c.state='roam';c.enemy=null;let goal={x:c.homeX+Math.sin(now/24000+hash(c.id)*20)*28,z:c.homeZ+Math.cos(now/29000+hash(c.id)*30)*28};
   if(available(w,c,now)&&now>c.nextDamage&&now>=w.ecology.nextHunt&&living.length>ECOLOGY.residentFloor&&hostile.length>ECOLOGY.hostileFloor){const targets=Object.values(w.objects).filter(o=>Math.abs(o.y-terrain(o.x,o.z))<2).sort((a,b)=>distance(a,c)-distance(b,c));const o=targets[0];if(o&&distance(o,c)<70){goal=o;if(distance(o,c)<3){o.integrity=(o.integrity??850)-(b.profile.punch*power(b));if(o.integrity<=0){delete w.objects[o.id];incident(w,c,o,now);c.nextDamage=now+300000+hash(c.id)*180000;}else{c.nextDamage=now+2000;event(w,'strike',o.x,o.y+1,o.z,now,c.id,o.id);}}}else c.nextDamage=now+20000;}
   walk(w,c,goal,2.2*power(b),dt,now);
  // Hostility toward the playable dummy remains uncanny rather than adding a visible health meter.
  for(const p of Object.values(players))if(Math.abs(p.y-c.y)<3&&distance(p,c)<1.8&&now-(c.lastAttack||0)>18000){c.lastAttack=now;w.shriek={at:now,id:c.id,text:c.name+'이 다가왔습니다.'};w.rev++;}
 }
 makeSquads(w,now);
 for(const r of w.residents){if(!r.body.alive){r.state='dead';continue;}const b=r.body;
  if(r.state==='retreat'){if(walk(w,r,r.retreatTo,5*power(b),dt,now)){r.state='sleep';r.restUntil=r.safeUntil;}continue;}if(!fit(r)){if(!r.unfitSince)r.unfitSince=now;retreat(w,r,now);continue;}
  if(Number(r.id.slice(1))%3===0&&!r.escort&&r.state!=='return'&&Math.hypot(r.x,r.z)<=RADIUS&&!r.weapon&&now>=r.safeUntil){arm(w,r,now);r.onPatrol=true;}
  r.backpedaling=false;const escortPlayer=r.escort&&players[r.escort.by],insideEscort=escortPlayer&&(escortPlayer.space||escortPlayer.c);
  const perceived=!insideEscort&&!r.space?hostile.filter(c=>perceives(w,r,c)).sort((a,b)=>distance(r,a)-distance(r,b))[0]:null;
  if(perceived){fear(w,r,perceived,now);const close=distance(r,perceived)<=ENCOUNTER.danger||perceived.alert?.target===r.id;
   if(close||weaponReady(r)){if(weaponReady(r)&&available(w,r,now)&&available(w,perceived,now)){const allies=living.filter(a=>a.squad&&a.squad===r.squad||a.enemy===perceived.id);if(!allies.includes(r))allies.push(r);if(distance(r,perceived)<24)perceived.engagementAt||=now;combatResident(w,r,perceived,allies,now,dt,{defensive:true});}else fleeResident(w,r,perceived,now,dt);continue;}
   if(!r.squad){r.state='watch';r.pending=null;r.plan=null;r.target=null;r.h=Math.atan2(perceived.x-r.x,perceived.z-r.z);continue;}
  }else if(!insideEscort&&r.threat&&now<(r.fearUntil||0)&&!r.squad){fleeResident(w,r,r.threat,now,dt);continue;}else if(r.threat){r.threat=null;r.fearUntil=0;r.state=r.escort?'escort':'idle';r.enemy=null;r.route=[];r.routeAt=0;r.next=Math.min(r.next,now+1000);}
  const sq=w.squads.find(s=>s.id===r.squad);if(sq?.phase==='gather'){arm(w,r,now);if(distance(r,sq.rally)>3){r.state='arm';walk(w,r,sq.rally,Math.min(7,b.profile.speed/36)*power(b),dt,now);}else {r.target=null;r.state='charge';if(r.weapon){r.weapon.acquired=true;r.weapon.charging=true;r.weapon.charge=Math.min(6,r.weapon.charge+dt);}}const ready=sq.members.map(id=>w.residents.find(x=>x.id===id)).filter(x=>x?.body.alive&&x.squad===sq.id&&fit(x));if(now-sq.at>150000||ready.length<3){const c=w.creatures.find(c=>c.id===sq.target);if(c)endEncounter(w,c,now);continue;}if(ready.length>=3&&ready.every(x=>distance(x,sq.rally)<5&&(x.weapon?.charge||0)>4)){sq.phase='hunt';for(const x of ready){x.state='hunt';x.target=null;x.routeAt=0;}note(w,r.id,'충전을 마친 사냥조가 함께 출발합니다.',now);w.rev++;}continue;}const enemy=hostile.find(c=>available(w,c,now)&&c.id===(sq?.target||r.enemy));const danger=hostile.filter(c=>available(w,c,now)&&Math.abs(c.y-r.y)<4&&distance(c,r)<9&&c.state==='fight').sort((a,b)=>distance(a,r)-distance(b,r))[0];
  if(r.escort){const p=players[r.escort.by];if(p)r.escort.lastSeen=now;if(!p&&now-r.escort.lastSeen>60000){r.escort=null;r.state='return';r.target={...r.home};r.routeAt=0;}}
  if((enemy||danger)&&available(w,r,now)){const c=enemy||danger;const allies=living.filter(a=>a.squad===r.squad&&r.squad||a.enemy===c.id||distance(a,c)<15);if(!allies.includes(r))allies.push(r);if(allies.filter(fit).length<3&&!r.weapon){retreat(w,r,now);continue;}if(distance(r,c)<24)c.engagementAt||=now;if(r.escort&&players[r.escort.by]&&distance(r,players[r.escort.by])>35){r.enemy=null;r.pending=null;}else{combatResident(w,r,c,allies,now,dt);continue;}}
  if(r.state==='sleep'&&r.restUntil>now){r.target=null;continue;}
  r.enemy=null;r.squad=null;
  if(r.weapon?.acquired===false){r.state='arm';if(walk(w,r,r.target||w.chromeSources.find(s=>s.id===r.weapon.source),5*power(b),dt,now)){r.weapon.acquired=true;r.target=null;r.state='guard';r.nextAttack=Math.min(r.nextAttack,now);}continue;}
  if(weaponReady(r)){r.weapon.charging=false;r.weapon.charge=Math.min(2.5,r.weapon.charge+dt*.65);}
  if(r.escort){const p=players[r.escort.by];if(!p)continue;const previous=r.escort.lastPos,previousSpace=r.escort.space||null;if(previous&&(previousSpace||p.space)&&previousSpace!==(p.space||null)&&distance(r,previous)<18&&distance(previous,p)>20){r.x=p.x+1;r.z=p.z+1;r.y=p.y;r.route=[];r.routeAt=0;}r.escort.lastPos={x:p.x,y:p.y,z:p.z};r.escort.space=p.space||null;r.state='escort';r.space=p.space||null;
   // Accompany elevator rides and doorway transitions instead of getting left on another floor.
   if(p.c&&distance(r,p)<7||p.space&&distance(r,p)<18){r.x=p.x+1;r.z=p.z+1;r.y=p.y;r.target=null;r.route=[];}else {const behind=p.h||0,goal={x:clamp(p.x-Math.sin(behind)*2.5,-EDGE,EDGE),z:clamp(p.z-Math.cos(behind)*2.5,-EDGE,EDGE)};if(distance(r,p)>4)walk(w,r,goal,Math.min(7,b.profile.speed/36)*power(b),dt,now);else r.target=null;}continue;}
  r.space=null;
  if(b.stamina<b.profile.stamina*.25&&!r.escort){r.state='sleep';r.restUntil=now+40000;r.target=null;continue;}
  if(b.hp<300){r.state='injured';r.target=null;continue;}
  const visitor=Object.values(players).find(p=>Math.abs(p.y-r.y)<4&&distance(p,r)<4.5);if(visitor&&now-(r.socialAt||0)>30000){r.socialAt=now;r.socialUntil=now+8000;}if(visitor&&now<(r.socialUntil||0)){r.state='idle';r.h=Math.atan2(visitor.x-r.x,visitor.z-r.z);continue;}
  if(r.target){r.state=r.state==='return'?'return':'walk';if(walk(w,r,r.target,2.8*power(b),dt,now)){const plan=r.plan;if(plan?.action==='build')place(w,{...plan,y:terrain(plan.x,plan.z)},r.id,now);if(plan?.action==='water'){const o=Object.values(w.objects).filter(o=>o.kind==='planter').sort((a,b)=>distance(a,r)-distance(b,r))[0];if(o){o.water=Math.min(8,o.water+1);w.rev++;}}r.plan=null;r.target=null;r.route=[];r.state='idle';}continue;}
  if(Math.hypot(r.x,r.z)>RADIUS){r.state='return';r.target={x:r.x/Math.hypot(r.x,r.z)*160,z:r.z/Math.hypot(r.x,r.z)*160};r.routeAt=0;continue;}
  if(now>=r.next){const round=Math.floor((now-w.created)/30000),kind=globalThis.VillageEngine.TYPES[(round+Number(r.id.slice(1)))%6],goal=rollSite(w,r,now);if(rules){scheduleResident(w,r,{action:Object.keys(w.objects).length>120?'water':round%4===3?'talk':'build',kind,x:goal.x,z:goal.z,to:w.residents[(Number(r.id.slice(1))+1)%10]?.name,say:r.inbox?reply(r,round):['바깥 산책로를 살피고 올게요.','손상된 정원을 함께 돌봐요.','멀리에도 쉬어 갈 곳을 만들어요.','돌아오는 길을 기억해 둘게요.'][round%4]},now);}else{r.target=goal;r.routeAt=0;r.next=now+35000;r.state='walk';}}
 }
 for(const r of living)resolve(w,r,living,hostile,now);for(const c of hostile)resolve(w,c,hostile,living,now);
 for(const squad of [...w.squads])if(squad.phase==='hunt'&&squad.members.filter(id=>living.some(r=>r.id===id&&r.squad===squad.id&&fit(r))).length<3){const c=hostile.find(c=>c.id===squad.target);if(c)endEncounter(w,c,now);}
 for(const c of hostile)if(c.engagementAt&&!c.body.alive)endEncounter(w,c,now);maintainPopulation(w,now);
 w.squads=w.squads.filter(s=>{if(w.creatures.find(c=>c.id===s.target)?.body.alive&&s.members.some(id=>living.some(r=>r.id===id&&r.body.alive)))return true;for(const r of w.residents.filter(r=>r.squad===s.id)){r.squad=null;r.enemy=null;r.target={...r.home};r.state='return';r.routeAt=0;}w.ecology.nextHunt=Math.max(w.ecology.nextHunt,now+ECOLOGY.peace);for(const i of w.incidents.filter(i=>i.target===s.target))i.status='closed';note(w,s.members[0],'사냥조가 정원으로 돌아옵니다.',now);w.rev++;return false;});
}
function projectEntity(e){const {body,factor,requestAt,route,routeGoal,routeAt,pending,unfitSince,replacementAt,...view}=e;return {...view,alive:body?.alive??true,posture:body&&!body.alive?'fallen':body&&body.hp<300?'hurt':body?.traumaUntil>0?'limp':e.state,held:!!body?.heldBy};}
globalThis.VillageSystems={HUMAN,HOSTILE,FACTORS,RADIUS,ECOLOGY,maintainPopulation,retreat,endEncounter,available,init,body,rng,power,weaponDamage,damage,recover,command,step,projectEntity,hitChance,flanked,path,incident,makeSquads,resolve,ENCOUNTER,perceives,clearSight,localEncounter,escapePoint,weaponReady};
})();
