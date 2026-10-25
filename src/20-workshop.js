// An optional layer over the original village: small resource deposits, a workshop, and player-made blocks.
const Workshop=(()=>{
 const W=globalThis.VillageWorkshop,S=W.SIZE,group=new THREE.Group(),nodeViews=new Map(),blockViews=new Map();scene.add(group);
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 let profile='';try{profile=localStorage.getItem('apt200x-workshop-profile')||'';}catch{}
 if(!/^[a-f0-9]{32}$/.test(profile)){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);profile=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('apt200x-workshop-profile',profile);}catch{}}
 let open=false,compact=false,tab='craft',slot='plank',aim=null,state=null,me=null,lastRev=-1,lastId='',lastPaint=0,joinAt=0,busy=false,rotation=0,layerOffset=0,lastMining=null,stationMade=false;
 const resourceNames={...W.RESOURCES,...Object.fromEntries(Object.entries(W.RECIPES).map(([k,r])=>[k,r.name]))},slots=['plank','brick','glass','glow','stair','workbench','cropbed','mine','farm'];
 const slotNames={plank:'목재',brick:'석재',glass:'유리',glow:'발광',stair:'계단',workbench:'작업대',cropbed:'재배함',mine:'채집',farm:'재배'};
 const mats={plank:phong(0xc8af87),brick:phong(0xa3b5b5),glass:phong(0xc9eddf,{transparent:true,opacity:.48,depthWrite:false,shininess:160}),glow:phong(0xd4f0c6,{emissive:0x60865d,shininess:150}),stair:phong(0xd5c5a0),workbench:phong(0xbbccbb),cropbed:phong(0xbba78c)};
 const twig=phong(0x9c896c),leaf=phong(0x8bad83),rock=phong(0xa3b5b5),ore=phong(0xbcdad8,{shininess:180}),crystal=phong(0xd9f4e4,{emissive:0x386253}),soil=phong(0x7b7962),berryMat=phong(0xe5b6a0);
 const cubeGeo=new THREE.BoxGeometry(S,S,S);
 const pickaxe=new THREE.Group();const handle=box(0,-.45,0,.07,.9,.07,twig,pickaxe);box(0,-.9,0,.65,.12,.12,ore,pickaxe);rig.limbs[1].elbow.add(pickaxe);pickaxe.position.y=-.45;pickaxe.visible=false;
 const batches=new Map(),batchKeys=new Map();for(const kind of ['plank','brick','glass','glow']){mats[kind].map=texCanvas(64,64,g=>{g.fillStyle='#ffffff';g.fillRect(0,0,64,64);g.strokeStyle=kind==='glass'?'#d0e4db':'#b6c3b1';g.lineWidth=2;g.strokeRect(1,1,62,62);if(kind==='plank')for(const y of [21,42]){g.beginPath();g.moveTo(2,y);g.lineTo(62,y);g.stroke();}});mats[kind].needsUpdate=true;const batch=new THREE.InstancedMesh(cubeGeo,mats[kind],W.MAX_BLOCKS);batch.count=0;batch.frustumCulled=false;batch.userData.wsBatch=kind;group.add(batch);batches.set(kind,batch);batchKeys.set(kind,[]);}
 const marker=new THREE.Mesh(cubeGeo,new THREE.MeshBasicMaterial({color:0xc4f9d2,wireframe:true,transparent:true,opacity:.65,depthWrite:false}));scene.add(marker);marker.visible=false;
 const nodeGeo=new THREE.OctahedronGeometry(.65),stemGeo=new THREE.CylinderGeometry(.14,.19,1.5,7),crystalGeo=new THREE.OctahedronGeometry(.7);
 const btn=make('button','workshop-toggle','◇ 공방');btn.id='workshopToggle';btn.setAttribute('aria-label','공방 열기 C');btn.hidden=true;document.body.append(btn);
 const panel=make('section','workshop-panel');panel.id='workshopPanel';panel.setAttribute('aria-label','채집과 제작 공방');
 const head=make('div','workshop-head');head.append(make('span','','PUREUN / 작은 공방'));const closeBtn=make('button','','×');closeBtn.setAttribute('aria-label','공방 닫기');const compactBtn=make('button','','쌓기');compactBtn.setAttribute('aria-label','제작과 쌓기 화면 전환');compactBtn.onclick=()=>setCompact(!compact);head.append(compactBtn,closeBtn);panel.append(head);
 const summary=make('p','workshop-summary');panel.append(summary);
 const tabs=make('div','workshop-tabs');for(const [id,label]of [['craft','가방·제작'],['quests','작은 의뢰'],['stock','공동 보관함']]){const b=make('button','',label);b.dataset.tab=id;b.onclick=()=>{tab=id;paint();};tabs.append(b);}panel.append(tabs);
 const contents=make('div','workshop-contents');panel.append(contents);
 const hotbar=make('div','workshop-hotbar');const slotButtons=new Map();for(const [i,k]of slots.entries()){const b=make('button','',''+(i+1)+' '+slotNames[k]);b.dataset.slot=k;b.onclick=()=>{slot=k;layerOffset=0;aim=null;setCompact(true);paint();};hotbar.append(b);slotButtons.set(k,b);}panel.append(hotbar);
 const controls=make('div','workshop-actions'),down=make('button','','층 −'),up=make('button','','층 +'),rotate=make('button','','↻'),act=make('button','','채집 / 놓기');
 down.setAttribute('aria-label','블록 층 낮추기');up.setAttribute('aria-label','블록 층 높이기');rotate.setAttribute('aria-label','계단 회전 Q');act.id='workshopAct';
 const changeLayer=d=>{layerOffset=clamp(layerOffset+d,-15,15);if(aim?.type==='place')aim.layer=clamp(aim.layer+d,0,15);};down.onclick=()=>changeLayer(-1);up.onclick=()=>changeLayer(1);rotate.onclick=()=>rotation=(rotation+1)%4;act.onclick=()=>perform();controls.append(down,up,rotate,act);panel.append(controls);
 const hint=make('p','workshop-hint','가까운 재료에서 E · 공방 C · 행동 F · 화면을 터치해 위치 선택');panel.append(hint);document.body.append(panel);
 const floating=make('button','workshop-nearby');floating.id='workshopNearby';floating.hidden=true;document.body.append(floating);floating.onclick=()=>{if(!gatherNearby()&&nearBench())toggle();};
 const progress=make('div','workshop-progress');progress.setAttribute('role','status');const progressText=make('span'),progressFill=make('i');progress.append(progressText,progressFill);progress.hidden=true;document.body.append(progress);
 function setCompact(value){compact=value;panel.classList.toggle('compact',value);compactBtn.textContent=value?'제작':'쌓기';}
 function close(){open=false;panel.classList.remove('on');btn.classList.remove('selected');marker.visible=false;aim=null;}
 function toggle(){if(!started||paused)return;if(open){close();return;}Village.closeBuild();open=true;panel.classList.add('on');btn.classList.add('selected');setCompact(false);tab='craft';paint();}
 btn.onclick=toggle;closeBtn.onclick=close;
 function send(a){if(busy)return Promise.resolve({ok:false});busy=true;return Village.action(a).then(r=>{if(r.ok&&a.type!=='ws:join'){sfx(a.type==='ws:mine'?'thud':'grow');}return r;}).finally(()=>{busy=false;});}
 function row(label){const r=make('div','workshop-row');r.append(make('span','',label));return r;}
 function paint(){if(!state)return;const scroll=contents.scrollTop;me=state.people?.[NET.id];summary.textContent=me?'목재·돌 모으기 → 제작 → 내 공간 쌓기 · '+['맨손','석재 곡괭이','크롬 곡괭이'][me.pick]:'가방을 연결하는 중…';
 for(const b of tabs.children)b.classList.toggle('selected',b.dataset.tab===tab);for(const [k,b]of slotButtons){b.classList.toggle('selected',slot===k);b.textContent=(slots.indexOf(k)+1)+' '+slotNames[k]+(W.RECIPES[k]?' '+(me?.items[k]||0):'');}
 contents.replaceChildren();if(!me)return;
 if(tab==='craft'){
  const inventory=make('div','workshop-inventory');for(const [k,n]of Object.entries(me.items))if(n>0)inventory.append(make('span','',resourceNames[k]+' '+n));contents.append(inventory);
  for(const [k,r]of Object.entries(W.RECIPES)){const line=row(r.name+(r.count?' ×'+r.count:''));const small=make('small','',Object.entries(r.cost).map(([k,n])=>resourceNames[k]+' '+n).join(' · ')+(r.bench?' / 작업대':''));line.firstChild.append(small);const b=make('button','',r.tool&&me.pick>=r.tool?'완료':'제작');b.disabled=!!(r.tool&&me.pick>=r.tool)||!Object.entries(r.cost).every(([k,n])=>(me.items[k]||0)>=n);b.onclick=()=>send({type:'ws:craft',recipe:k});line.append(b);contents.append(line);}
 }else if(tab==='quests')for(const q of W.QUESTS){const done=q.tool?me.pick>=q.tool:(me.stats[q.stat]||0)>=q.goal;const line=row(q.name);line.firstChild.append(make('small','',q.tool?(done?'도구 완성':'공방에서 도구를 만들어 보세요'):(me.stats[q.stat]||0)+' / '+q.goal));const b=make('button','',me.claimed.includes(q.id)?'받음':'보상 받기');b.disabled=!done||me.claimed.includes(q.id);b.onclick=()=>send({type:'ws:claim',id:q.id});line.append(b);contents.append(line);}
 else{contents.append(make('p','',nearBench()?'이곳의 재료는 이웃들과 함께 보관합니다.':'공용 작업대나 직접 만든 작업대 8m 안에서 사용할 수 있습니다.'));
 for(const k of Object.keys(W.RESOURCES)){const line=row(resourceNames[k]+' · 공용 '+(state.stock[k]||0));const deposit=make('button','','+1 맡김'),withdraw=make('button','','−1 꺼냄');deposit.disabled=!(me.items[k]>0)||!nearBench();withdraw.disabled=!(state.stock[k]>0)||!nearBench();deposit.onclick=()=>send({type:'ws:transfer',direction:'deposit',item:k,count:1});withdraw.onclick=()=>send({type:'ws:transfer',direction:'withdraw',item:k,count:1});line.append(deposit,withdraw);contents.append(line);}
 }
 contents.scrollTop=scroll;
 }
 function nearBench(){return !!state&&(Math.abs(player.position.y-state.station.y)<5&&Math.hypot(player.position.x-state.station.x,player.position.z-state.station.z)<8||Object.values(state.blocks).some(b=>b.kind==='workbench'&&Math.abs(player.position.y-b.y)<5&&Math.hypot(player.position.x-b.x,player.position.z-b.z)<8));}
 function nodeModel(n){const g=new THREE.Group();g.position.set(n.x,n.y,n.z);const add=(geo,mat,x,y,z,scale=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.setScalar(scale);g.add(m);return m;};
  if(n.kind==='timber'){for(let i=0;i<3;i++){const m=add(stemGeo,twig,(i-1)*.35,.3+i*.08,0);m.rotation.z=Math.PI/2;m.rotation.y=.2;}}
  else if(n.kind==='fiber'){for(let i=0;i<5;i++){const m=add(stemGeo,leaf,Math.sin(i*2.4)*.3,.55,Math.cos(i*2.4)*.3,.6);m.rotation.z=Math.sin(i)*.2;}}
  else for(let i=0;i<3;i++){const m=add(n.kind==='crystal'?crystalGeo:nodeGeo,n.kind==='crystal'?crystal:n.kind==='chrome'?ore:n.kind==='silica'?mats.glass:rock,Math.sin(i*2.4)*.35,.45+i*.13,Math.cos(i*2.4)*.35,.7);if(n.kind==='crystal')m.scale.y*=1.7;m.rotation.y=i;}
  g.traverse(m=>m.userData.wsNode=n.id);group.add(g);return {root:g};
 }
 function blockModel(b){const g=new THREE.Group();g.position.set(b.x,b.y,b.z);g.rotation.y=b.rotation*Math.PI/2;const solidsFor=[];const part=(x,y,z,w,h,d,mat)=>box(x,y,z,w,h,d,mat,g);
  if(['plank','brick','glass','glow'].includes(b.kind)){solidsFor.push(solidAt(b.x,b.y+S/2,b.z,S,S,S,'workshop'));}
  else if(b.kind==='stair'){for(let i=0;i<3;i++){part(0,(i+1)*.25,-.5+i*.5,1.5,(i+1)*.5,.5,mats.stair);const angle=b.rotation*Math.PI/2,dx=Math.sin(angle)*(-.5+i*.5),dz=Math.cos(angle)*(-.5+i*.5);solidsFor.push(solidAt(b.x+dx,b.y+(i+1)*.25,b.z+dz,b.rotation%2?.5:1.5,(i+1)*.5,b.rotation%2?1.5:.5,'workshop'));}}
  else if(b.kind==='workbench'){part(0,.87,0,1.5,.16,1.5,mats.workbench);for(const x of [-.55,.55])for(const z of [-.55,.55])part(x,.4,z,.15,.8,.15,ore);part(0,.98,0,1,.06,.8,twig);solidsFor.push(solidAt(b.x,b.y+.5,b.z,1.5,1,1.5,'workshop'));}
  else{part(0,.25,0,1.5,.5,1.5,mats.cropbed);part(0,.52,0,1.25,.06,1.25,soil);solidsFor.push(solidAt(b.x,b.y+.25,b.z,1.5,.5,1.5,'workshop'));}
  g.traverse(o=>o.userData.wsBlock=b.key);group.add(g);return {root:g,solids:solidsFor,crop:null,cropAt:null};
 }
 function cropView(b,v){const crop=b.crop;if(!crop){if(v.crop)v.root.remove(v.crop);v.crop=null;return;}if(!v.crop){v.crop=new THREE.Group();for(let i=0;i<4;i++){const x=Math.sin(i*2.4)*.4,z=Math.cos(i*2.4)*.4;const stem=new THREE.Mesh(stemGeo,leaf);stem.position.set(x,.75,z);stem.scale.set(.3,.45,.3);v.crop.add(stem);const fruit=new THREE.Mesh(nodeGeo,berryMat);fruit.position.set(x,1.05,z);fruit.scale.setScalar(.18);v.crop.add(fruit);}v.root.add(v.crop);}
 const t=clamp((Village.clock()-crop.at)/(crop.readyAt-crop.at),.12,1);v.crop.scale.y=t;}
 function sync(){const ids=new Set(Object.keys(state.blocks));for(const [id,v]of blockViews)if(!ids.has(id)){group.remove(v.root);for(const s of v.solids)removeSolid(s);blockViews.delete(id);}
 for(const n of Object.values(state.nodes)){let v=nodeViews.get(n.id);if(!v){v=nodeModel(n);nodeViews.set(n.id,v);}v.root.scale.setScalar(n.left>0?1:.32);}
 for(const b of Object.values(state.blocks)){let v=blockViews.get(b.key);if(!v){v=blockModel(b);blockViews.set(b.key,v);}cropView(b,v);}
 for(const [kind,batch]of batches){const blocks=Object.values(state.blocks).filter(b=>b.kind===kind);batchKeys.set(kind,blocks.map(b=>b.key));batch.count=blocks.length;for(const [i,b]of blocks.entries())batch.setMatrixAt(i,new THREE.Matrix4().makeTranslation(b.x,b.y+S/2,b.z));batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere?.();}
 if(!stationMade){const station=blockModel({...state.station,key:'community-station',kind:'workbench',rotation:0});stationMade=true;station.root.userData.communityStation=true;}
 }
 function nearestNode(){if(!state)return null;return Object.values(state.nodes).filter(n=>n.left>0&&Math.abs(n.y-player.position.y)<5&&Math.hypot(n.x-player.position.x,n.z-player.position.z)<6).sort((a,b)=>Math.hypot(a.x-player.position.x,a.z-player.position.z)-Math.hypot(b.x-player.position.x,b.z-player.position.z))[0];}
 function gatherNearby(){const n=nearestNode();if(n){slot='mine';aim={type:'node',id:n.id};send({type:'ws:mine',id:n.id});return true;}return false;}
 function screenPoint(x,y){if(!state)return null;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),camera);const hits=ray.intersectObjects([...nodeViews.values(),...blockViews.values()].map(v=>v.root).concat([...batches.values()]),true);
 for(const hit of hits){if(hit.distance>23)continue;const id=hit.object.userData.wsNode,k=hit.object.userData.wsBlock||(hit.object.userData.wsBatch?batchKeys.get(hit.object.userData.wsBatch)?.[hit.instanceId]:null);if(id&&slot==='mine')return {type:'node',id};if(k){const b=state.blocks[k];if(!b)continue;if(slot==='mine'||slot==='farm')return {type:'block',id:k};if(!hit.face)continue;const normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));let gx=b.gx,gz=b.gz,layer=b.layer;if(Math.abs(normal.y)>.5)layer+=normal.y>0?1:-1;else if(Math.abs(normal.x)>.5)gx+=normal.x>0?1:-1;else gz+=normal.z>0?1:-1;return {type:'place',gx,gz,layer:clamp(layer+layerOffset,0,15)};}}
 let plane=new THREE.Plane(new THREE.Vector3(0,1,0),-player.position.y),p=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!p)return null;plane.constant=-terrainY(p.x,p.z);p=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!p||p.distanceTo(player.position)>15)return null;return {type:'place',gx:Math.round(p.x/S),gz:Math.round(p.z/S),layer:clamp(layerOffset,0,15)};
 }
 function perform(){if(!started||paused||!open||busy)return;if(slot==='mine'){if(aim?.id)send({type:'ws:mine',id:aim.id});else if(!gatherNearby())toast('가까운 재료나 내 블록을 터치해 선택하세요.');return;}
 if(slot==='farm'){const b=state?.blocks[aim?.id];if(!b||b.kind!=='cropbed'){toast('재배 상자를 터치해 선택하세요.');return;}send({type:!b.crop?'ws:plant':Village.clock()>=b.crop.readyAt?'ws:harvest':!b.crop.watered?'ws:water':'ws:harvest',id:b.key});return;}
 if(!aim||aim.type!=='place'){aim=screenPoint(innerWidth*.5,innerHeight*.53);if(!aim||aim.type!=='place'){toast('화면에서 블록을 놓을 곳을 선택하세요.');return;}}
 send({type:'ws:place',kind:slot,gx:aim.gx,gz:aim.gz,layer:aim.layer,rotation});
 }
 function handleTap(x,y){if(!open)return false;aim=screenPoint(x,y);return true;}
 function handleInteract(){if(open){perform();return true;}return gatherNearby();}
 addEventListener('keydown',e=>{if(!started||paused||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.repeat)return;if(e.code==='KeyC'){e.preventDefault();toggle();return;}if(!open)return;if(e.code==='KeyF'){e.preventDefault();perform();}if(e.code==='KeyQ')rotation=(rotation+1)%4;if(/^Digit[1-9]$/.test(e.code)){slot=slots[Number(e.code.slice(-1))-1];aim=null;layerOffset=0;setCompact(true);paint();}});
 function tick(dt){state=Village.getState()?.workshop||null;btn.hidden=!started;panel.classList.toggle('suspended',paused||!started);group.visible=started;marker.visible=false;if(!state)return;me=state.people?.[NET.id];
 const now=Village.clock();const selectedBed=state.blocks[aim?.id];let actionLabel=slot==='mine'?'채집 / 회수':slot==='farm'?'재배함 선택':'블록 놓기';let waiting=false;if(slot==='farm'&&selectedBed?.kind==='cropbed'){const c=selectedBed.crop;waiting=!!(c&&c.watered&&now<c.readyAt);actionLabel=!c?'씨앗 심기':now>=c.readyAt?'수확하기':!c.watered?'물 주기':'익는 중 '+Math.ceil((c.readyAt-now)/1000)+'초';}if(act.textContent!==actionLabel)act.textContent=actionLabel;act.disabled=busy||waiting||!!me?.mining;if(started&&!me&&now>joinAt){joinAt=now+7000;Village.action({type:'ws:join',profile},{silent:true});}
 if(lastRev!==state.rev||lastId!==NET.id){lastRev=state.rev;lastId=NET.id;sync();if(open)paint();}
 if(open&&lastPaint!==nearBench()){lastPaint=nearBench();paint();}
 for(const batch of batches.values())batch.visible=started&&player.position.y>-5&&player.position.y<70;
 for(const [id,v]of nodeViews){const n=state.nodes[id];v.root.visible=started&&Math.abs(player.position.y-n.y)<25&&player.position.distanceTo(v.root.position)<85;}
 for(const [id,v]of blockViews){const b=state.blocks[id];v.root.visible=started&&!!b&&Math.abs(player.position.y-b.y)<50;if(b?.crop)cropView(b,v);}
 const node=nearestNode();floating.hidden=!started||paused||open||(!node&&!nearBench())||!!me?.mining;if(!node)floating.textContent='작업대 · 공방 열기';if(node)floating.textContent=(resourceNames[node.kind]||'재료')+' 채집 · E';
 const mining=me?.mining;pickaxe.visible=!!(started&&!paused&&mining&&me.pick>0);if(started&&!paused&&mining){rig.limbs[1].shoulder.rotation.x=-.9+Math.sin(now*.018)*.32;rig.limbs[1].elbow.rotation.x=-.4;}progress.hidden=!started||!mining;if(mining){const t=clamp((now-mining.at)/(mining.until-mining.at),0,1);progressFill.style.width=(t*100)+'%';progressText.textContent=(mining.kind==='node'?'재료를 모으는 중':'블록을 회수하는 중')+' · 움직이면 취소';}if(lastMining&&!mining&&started)sfx('grow');lastMining=mining;
 if(open&&!paused){if(!aim&&slot!=='mine'&&slot!=='farm')aim=screenPoint(innerWidth*.5,innerHeight*.53);if(aim?.type==='place'&&W.RECIPES[slot]){const p=W.position(aim.gx,aim.gz,aim.layer);marker.position.set(p.x,p.y+S/2,p.z);marker.rotation.y=rotation*Math.PI/2;marker.visible=true;const error=W.canPut({workshop:{...state,blocks:state.blocks},objects:Village.getState().objects,obstacles:Village.getState().obstacles,residents:Village.getState().residents,creatures:Village.getState().creatures}, {...aim,kind:slot},player.position,{self:{x:player.position.x,y:player.position.y,z:player.position.z}});marker.material.color.set(error||!(me?.items[slot]>0)?0xf1b2a3:0xc4f9d2);hint.textContent='층 '+aim.layer+' · 터치 선택 / F 놓기 · Q 회전';}
 else if(!aim)hint.textContent=slot==='mine'?'재료나 내 블록을 터치해 선택 · 가까이서 F':slot==='farm'?'재배 상자를 터치해 선택 · F로 심고 돌보기':'초원을 터치해 위치 선택';else if(aim?.id)hint.textContent=slot==='farm'?'씨앗 심기 → 물 주기 → 익으면 수확 · F':'가까이 다가가 F로 채집 / 회수';}
 }
 function moveHorizontal(p,dx,dz){if(!state||!Object.values(state.blocks).some(b=>Math.hypot(b.x-p.x,b.z-p.z)<4))return false;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.14));for(let i=0;i<steps;i++){const oldX=p.x,oldZ=p.z;const x=p.x+dx/steps,z=p.z+dz/steps;if(Math.hypot(x,z)>=WORLD_RADIUS&&!currentRoom()?.interior)break;if(!blocked(x,p.z,p.y))p.x=x;if(!blocked(p.x,z,p.y))p.z=z;if(grounded){const floor=surfaceHeight(p.x,p.z,p.y);if(floor>p.y&&floor-p.y<=STEP_UP+.001){if(floor+PLAYER_H<=ceilingAbove(p.x,p.z,p.y+PLAYER_H)+.01)p.y=floor;else{p.x=oldX;p.z=oldZ;}}}}return true;}
 function targetScreen(id){const o=state?.blocks[id]||state?.nodes[id];if(!o)return null;const p=new THREE.Vector3(o.x,o.y+(o.kind==='cropbed'?.25:.75),o.z).project(camera);return {x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight,visible:p.z<1};}
 return {targetScreen,moveHorizontal,tick,close,toggle,handleTap,handleInteract,inspect:()=>({open,slot,aim,bag:me,station:state?.station,nodes:Object.values(state?.nodes||{}),blocks:Object.values(state?.blocks||{})}),select:k=>{if(slots.includes(k)){slot=k;aim=null;paint();return true;}return false;},aimAt:(gx,gz,layer=0)=>{aim={type:'place',gx,gz,layer};return aim;},get isOpen(){return open;}};
})();
