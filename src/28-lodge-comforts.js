// ─── Winter house comforts: sofas you can sink into, a hearth to stoke, tree lights, gifts and cocoa ──
// Everything here is local to each visitor (no shared world rules change); touching still leaves the usual handprint.
const LodgeComforts=(()=>{
 const P=Lodge.parts,y=P.y,root=P.root,rnd=seededRandom(1225);
 // Fabrics drawn once: green velvet, worn leather, plaid wool and a cable-knit throw.
 function weave(base,fleck,line,count){return texCanvas(128,128,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);for(let i=0;i<count;i++){g.fillStyle=rnd()>.5?fleck:'rgba(0,0,0,.07)';g.fillRect(rnd()*w,rnd()*h,1,1+rnd()*2);}if(line){g.strokeStyle=line;for(let x=4;x<w;x+=10){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}}});}
 const plaidTex=texCanvas(128,128,(g,w,h)=>{g.fillStyle='#8f2f2c';g.fillRect(0,0,w,h);g.globalAlpha=.5;g.fillStyle='#233f33';for(let i=0;i<4;i++){g.fillRect(i*32+6,0,12,h);g.fillRect(0,i*32+6,w,12);}g.globalAlpha=.85;g.fillStyle='#e8d7a8';for(let i=0;i<4;i++){g.fillRect(i*32+24,0,2,h);g.fillRect(0,i*32+24,w,2);}g.globalAlpha=1;});
 const knitTex=texCanvas(128,128,(g,w,h)=>{g.fillStyle='#efe6d2';g.fillRect(0,0,w,h);g.strokeStyle='rgba(150,128,96,.45)';g.lineWidth=2;for(let x=0;x<w;x+=16)for(let yy=0;yy<h;yy+=12){g.beginPath();g.moveTo(x,yy);g.lineTo(x+8,yy+8);g.lineTo(x+16,yy);g.stroke();}});
 const velvet=phong(0xffffff,{map:weave('#2e5a48','rgba(170,230,200,.09)','rgba(0,0,0,.08)',1800),shininess:22,specular:0x3a5a4a});
 const leather=phong(0xffffff,{map:weave('#8a4f2b','rgba(255,220,180,.07)',null,900),shininess:70,specular:0x664433});
 const wool=phong(0xffffff,{map:plaidTex,shininess:6,specular:0x111111}),throwMat=phong(0xffffff,{map:knitTex,shininess:4,specular:0x111111});
 const pillowCream=phong(0xf1e7cf,{shininess:10}),berry=phong(0xa33a36,{shininess:40}),cocoaMat=phong(0x5a3423,{shininess:60}),cookieMat=phong(0xc98b4f,{shininess:8}),plateMat=phong(0xf3f0e6,{shininess:90});
 const legGeo=new THREE.CylinderGeometry(.05,.04,.14,8);

 // ── Upholstered seating: frame, seat and back cushions, rolled arms, pillows and an optional throw ──
 const SEAT_TOP=.62,SIT_DROP=.46; // same convention as the meadow benches: hips sit .46 below the cushion top
 function upholstered({x,z,yaw,seats,seatW,mat,pillows=[],throwSide=0,hitbox}){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw;root.add(g);const arm=.28,W=seats*seatW+arm*2,D=1.05;
  for(const sx of [-1,1])for(const sz of [-1,1])mesh(legGeo,P.trim,sx*(W/2-.15),.07,sz*(D/2-.13),g);
  box(0,.28,0,W,.28,D,mat,g);box(0,.82,-D/2+.13,W,.82,.26,mat,g);
  for(let i=0;i<seats;i++){const cx=(i-(seats-1)/2)*seatW;box(cx,.52,.07,seatW-.04,.2,D-.32,mat,g);box(cx,.92,-D/2+.33,seatW-.07,.52,.18,mat,g).rotation.x=-.17;}
  for(const s of [-1,1]){const ax=s*(W/2-arm/2);box(ax,.6,0,arm,.42,D,mat,g);mesh(new THREE.CylinderGeometry(.16,.16,D,14),mat,ax,.82,0,g).rotation.x=Math.PI/2;}
  pillows.forEach((pm,i)=>{const s=i%2?1:-1,p=mesh(unitSphere,pm,s*(W/2-arm-.3),.86,-D/2+.42,g);p.scale.set(.3,.27,.1);p.rotation.set(-.25,s*.25,s*.35);});
  if(throwSide){const ax=throwSide*(W/2-arm/2);box(ax,1,.05,arm+.12,.03,D*.7,throwMat,g);box(ax+throwSide*(arm/2+.07),.72,.05,.03,.56,D*.7,throwMat,g);}
  g.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const hb=hitbox||{x:center.x,z:center.z,w:size.x*.94,d:size.z*.94};solidAt(hb.x,y+.35,hb.z,hb.w,.7,hb.d,'lodge');
  const seatsAt=Array.from({length:seats},(_,i)=>{const v=g.localToWorld(new THREE.Vector3((i-(seats-1)/2)*seatW,0,.12));return {x:v.x,y:y+SEAT_TOP-SIT_DROP,z:v.z,yaw};});
  return {g,seats:seatsAt,center};}
 const hearthSofa=upholstered({x:-7,z:147.6,yaw:0,seats:3,seatW:1.07,mat:velvet,pillows:[wool,pillowCream],throwSide:-1});
 const loveseat=upholstered({x:10.37,z:147.6,yaw:-Math.PI/2,seats:2,seatW:1,mat:leather,pillows:[wool,velvet]});
 const armchairYaw=Math.atan2(-3.8,2.4),armchair=upholstered({x:-3.2,z:150.2,yaw:armchairYaw,seats:1,seatW:.9,mat:wool,pillows:[pillowCream],throwSide:1,hitbox:{x:-3.2,z:150.2,w:.8,d:.8}});

 // Stand up on the floor in front of the seat (hips were above the cushion), stepping further if furniture is in the way.
 function seatFor(piece){const p=player.position;return piece.seats.reduce((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?b:a);}
 function sitIn(piece,message){const seat=seatFor(piece);sitOn({...seat,onStand:()=>{const p=player.position;p.y=y;for(let k=0;k<6&&blocked(p.x,p.z,p.y);k++){p.x+=Math.sin(seat.yaw)*.2;p.z+=Math.cos(seat.yaw)*.2;}}});cushionSound();toast(message);return {k:'앉음'};}
 const seatThing=(id,name,piece,verb,message)=>defineThing({id,name,root:piece.g,printParent:root,anchor:()=>new THREE.Vector3(piece.center.x,y+.8,piece.center.z),reach:3.2,verb,touch:()=>sitIn(piece,message)});
 seatThing('lodge-sofa','벽난로 앞 벨벳 소파',hearthSofa,'소파에 앉기','벽난로 앞 소파에 깊숙이 앉았습니다. 장작 타는 소리가 들립니다.');
 seatThing('lodge-loveseat','가죽 2인 소파',loveseat,'소파에 앉기','가죽 소파에 앉았습니다. 트리 불빛이 잘 보입니다.');
 seatThing('lodge-armchair','체크무늬 안락의자',armchair,'의자에 앉기','안락의자에 앉아 불을 바라봅니다.');

 // ── Coffee table with cocoa and cookies between the sofa and the hearth ──
 const TABLE_Z=149.75,table=new THREE.Group();table.position.set(-7,y,TABLE_Z);root.add(table);box(0,.42,0,1.7,.07,.78,P.wood,table);for(const sx of [-1,1])for(const sz of [-1,1])box(sx*.74,.2,sz*.32,.08,.38,.08,P.trim,table);
 solidAt(-7,y+.35,TABLE_Z,1.7,.7,.78,'lodge');
 mesh(new THREE.CylinderGeometry(.2,.17,.025,20),plateMat,-.45,.47,.05,table);for(let i=0;i<3;i++)mesh(new THREE.CylinderGeometry(.065,.065,.025,12),cookieMat,-.45+Math.cos(i*2.1)*.08,.495+i*.012,.05+Math.sin(i*2.1)*.08,table).rotation.z=.12*i;
 const mug=new THREE.Group();mug.position.set(-6.6,y+.46,TABLE_Z-.05);root.add(mug);mesh(new THREE.CylinderGeometry(.09,.08,.2,14),berry,0,.1,0,mug);mesh(new THREE.TorusGeometry(.055,.016,6,12),berry,.1,.1,0,mug).rotation.y=Math.PI/2;
 mesh(new THREE.CircleGeometry(.078,14),cocoaMat,0,.185,0,mug).rotation.x=-Math.PI/2;for(let i=0;i<3;i++)box(Math.cos(i*2)*.03,.195,Math.sin(i*2)*.03,.035,.025,.035,pillowCream,mug);
 const steam=[0,1,2].map(i=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW_TEX,color:0xffffff,transparent:true,opacity:0,depthWrite:false}));s.scale.setScalar(.16);s.raycast=ignoreRaycast;mug.add(s);return {s,ph:i/3};});
 let sip=0;
 defineThing({id:'lodge-cocoa',name:'코코아 머그',root:mug,printParent:root,anchor:()=>new THREE.Vector3(-6.6,y+.6,TABLE_Z),reach:2.2,verb:'코코아 마시기',touch(){sip=1;sipSound();toast('따뜻한 코코아를 한 모금 마셨습니다. 마시멜로가 녹고 있습니다.');return {k:'한 모금'};}});

 // ── Hearth: stoke the fire for taller flames, a brighter glow and a burst of sparks ──
 const STOKE_SECONDS=5,SPARK_COUNT=80,FIRE={x:-7,y:y+1,z:152.6};let stoke=0;
 const sparks=glowPoints(SPARK_COUNT,{size:.08,vertexColors:true});sparks.name='hearth-sparks';sparks.material.opacity=1;root.add(sparks);
 const spark=Array.from({length:SPARK_COUNT},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));let sparkCursor=0,sparkDebt=0;
 function emitSpark(power=1){const s=spark[sparkCursor++%SPARK_COUNT];s.life=1+rnd()*.9;s.x=FIRE.x+(rnd()-.5)*1.6;s.y=FIRE.y+rnd()*.4;s.z=FIRE.z+(rnd()-.5)*.4;s.vx=(rnd()-.5)*.5;s.vy=(1.1+rnd()*1.5)*power;s.vz=-rnd()*.35;}
 const hearthPick=proxy(-7,y+1.6,152.4,4.4,2.6,1.2,root);
 defineThing({id:'lodge-hearth',name:'벽난로',root:hearthPick,printParent:root,anchor:()=>new THREE.Vector3(-7,y+1.4,151.6),reach:3.2,verb:'불 지피기',touch(){stoke=1;for(let i=0;i<28;i++)emitSpark(1.5);stokeSound();toast('장작을 하나 더 넣었습니다. 불꽃이 높이 오릅니다.');return {k:'불 지핌'};}});
 // Chimney smoke so the house looks lived-in from the path.
 const smoke=[0,1,2,3,4,5].map(i=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW_TEX,color:0xd9d6d0,transparent:true,opacity:0,depthWrite:false}));s.raycast=ignoreRaycast;root.add(s);return {s,ph:i/6};});

 // ── Tree lights: a small panel picks the colour palette, the arrangement and the effect ──
 const BULB_R=.065,TREE={x:0,z:145,base:y+1,height:4.3,bottom:2.5,top:.15},TREE_KEY='apt200x-tree';
 const PALETTES=[{name:'따뜻한 노랑',colors:[0xffd08a]},{name:'빨강·초록',colors:[0xff4b4b,0x3ee07a]},{name:'겨울 파랑',colors:[0x8fd0ff,0xf4fbff]},{name:'분홍·금색',colors:[0xff8fc8,0xffd36b]},{name:'오색',colors:[0xff5a5a,0xffd36b,0x5ce68a,0x6fb6ff,0xc68bff]}];
 const LAYOUTS=['나선','층층 고리','별빛 흩뿌림','세로 줄'],EFFECTS=['켜짐','반짝임','흐르는 불빛','숨쉬기'],RING_T=[.06,.22,.38,.54,.7,.86],RING_COUNT=[14,12,10,9,6,5],STRANDS=8;
 const bulbMats=new Map([[0xffd08a,P.warm]]);const bulbMat=hex=>{if(!bulbMats.has(hex)){const c=new THREE.Color(hex);bulbMats.set(hex,phong(c.clone().lerp(new THREE.Color(0xffffff),.35),{emissive:c,emissiveIntensity:.9}));}return bulbMats.get(hex);};
 const treeLook={palette:0,layout:0,effect:0};try{const saved=JSON.parse(localStorage.getItem(TREE_KEY)||'{}');for(const [k,list] of [['palette',PALETTES],['layout',LAYOUTS],['effect',EFFECTS]])if(Number.isInteger(saved[k])&&saved[k]>=0&&saved[k]<list.length)treeLook[k]=saved[k];}catch{}
 const coneRadius=t=>TREE.bottom*(1-t)+TREE.top;
 // Where bulb i sits for an arrangement, plus which colour group it belongs to.
 function layoutPoint(kind,i,n){let t,a,group=i;
  if(kind===0){t=i/(n-1);a=t*Math.PI*10;}
  else if(kind===1){let ring=0,j=i;while(ring<RING_T.length-1&&j>=RING_COUNT[ring]){j-=RING_COUNT[ring];ring++;}t=RING_T[ring];a=j/RING_COUNT[ring]*TAU+ring*.4;group=ring;}
  else if(kind===2){t=clamp(1-Math.sqrt(hashStr('bulb-height-'+i)),.03,.95);a=hashStr('bulb-angle-'+i)*TAU;}
  else{const strand=i%STRANDS,row=Math.floor(i/STRANDS);t=.04+row/(n/STRANDS-1)*.88;a=strand/STRANDS*TAU+row*.05;group=strand;}
  const r=coneRadius(t);return {pos:new THREE.Vector3(TREE.x+Math.cos(a)*r,TREE.base+t*TREE.height,TREE.z+Math.sin(a)*r),group};}
 let bulbTargets=[];
 function applyTreeLook(save=true){const colors=PALETTES[treeLook.palette].colors,n=P.bulbs.length;bulbTargets=P.bulbs.map((b,i)=>{const pt=layoutPoint(treeLook.layout,i,n);b.material=bulbMat(colors[pt.group%colors.length]);return pt.pos;});if(save)try{localStorage.setItem(TREE_KEY,JSON.stringify(treeLook));}catch{}renderTreePanel();}
 function animateBulbs(dt){const t=worldTime,e=treeLook.effect,k=1-Math.exp(-4*dt);P.bulbs.forEach((b,i)=>{if(bulbTargets[i])b.position.lerp(bulbTargets[i],k);const s=e===1?.35+.65*Math.max(0,Math.sin(t*3+i*1.7))**2:e===2?((((i-t*10)%8)+8)%8<2.5?1.3:.45):e===3?.55+.45*(.5+.5*Math.sin(t*1.6)):1;b.scale.setScalar(BULB_R*s);});}
 const treePanel=document.createElement('section');treePanel.className='lodge-panel tree-panel';treePanel.hidden=true;treePanel.setAttribute('aria-label','트리 꾸미기');
 treePanel.innerHTML='<header><div><small>WINTER HOUSE / TREE LIGHTS</small><h2>트리 꾸미기</h2></div><button class="lp-close" aria-label="닫기">×</button></header><div class="tree-row" data-key="palette"><b>전구 색</b></div><div class="tree-row" data-key="layout"><b>배열</b></div><div class="tree-row" data-key="effect"><b>효과</b></div><small>내 화면의 트리에만 적용되고 이 기기에 기억됩니다.</small>';document.body.append(treePanel);
 for(const [key,list] of [['palette',PALETTES.map(p=>p.name)],['layout',LAYOUTS],['effect',EFFECTS]]){const row=treePanel.querySelector(`[data-key="${key}"]`),chips=document.createElement('div');chips.className='tree-chips';list.forEach((label,i)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{treeLook[key]=i;applyTreeLook();sparkleSound();};chips.append(b);});row.append(chips);}
 function renderTreePanel(){for(const row of treePanel.querySelectorAll('.tree-row'))[...row.querySelectorAll('button')].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===treeLook[row.dataset.key])));}
 treePanel.querySelector('.lp-close').onclick=()=>{treePanel.hidden=true;};
 addEventListener('keydown',e=>{if(e.code==='Escape'&&!treePanel.hidden){treePanel.hidden=true;e.preventDefault();e.stopImmediatePropagation();}},true);
 applyTreeLook(false);
 const treePick=proxy(0,y+2.8,145,3.4,5.6,3.4,root);
 defineThing({id:'lodge-tree',name:'크리스마스 트리',root:treePick,printParent:root,anchor:()=>new THREE.Vector3(0,y+1.6,145),reach:3.6,verb:'트리 꾸미기',touch(){resetInputs();treePanel.hidden=false;renderTreePanel();sparkleSound();return {k:'불빛'};}});

 // ── Gifts: lift a lid, a little confetti, and a keepsake note; they quietly re-wrap themselves ──
 const GIFT_RESET=45,CONFETTI_COUNT=120;
 const KEEPSAKES=['털실 장갑 한 켤레. 「추운 날 생각나서」라는 쪽지가 들어 있습니다.','작은 스노볼. 흔들면 푸른마을 위로 눈이 내립니다.','포장만 있고 속은 비어 있습니다. 그래도 리본은 정성스럽게 묶여 있습니다.','2000년대 MP3 플레이어. 재생 목록 이름은 「겨울 산책」입니다.','손으로 쓴 카드: 「내년에도 이 집에서 만나요.」','귤 세 개와 은박 초콜릿 하나.','아직 아무도 입주하지 않은 집의 열쇠 모형.','반짝이는 별 모양 오너먼트. 트리 꼭대기 별과 꼭 닮았습니다.'];
 let keepsakeIndex=Math.floor(rnd()*KEEPSAKES.length);
 const giftPick=new THREE.Group();root.add(giftPick);for(const gf of P.gifts)proxy(gf.x,y+gf.h/2,gf.z,gf.w+.1,gf.h+.25,gf.w+.1,giftPick);
 const nearestGift=(pt=player.position)=>P.gifts.reduce((a,b)=>Math.hypot(b.x-pt.x,b.z-pt.z)<Math.hypot(a.x-pt.x,a.z-pt.z)?b:a);
 const confetti=glowPoints(CONFETTI_COUNT,{size:.09,vertexColors:true,additive:false});confetti.name='gift-confetti';confetti.material.opacity=1;confetti.material.map=null;root.add(confetti);
 const bits=Array.from({length:CONFETTI_COUNT},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,r:1,g:1,b:1}));let bitCursor=0;const PAPER=[[1,.36,.36],[1,.83,.35],[.45,.86,.55],[.5,.72,1],[1,1,1]];
 function burst(gf){for(let i=0;i<40;i++){const b=bits[bitCursor++%CONFETTI_COUNT],a=rnd()*TAU,c=PAPER[i%PAPER.length];Object.assign(b,{life:1.8+rnd(),x:gf.x,y:y+gf.h+.2,z:gf.z,vx:Math.cos(a)*(.6+rnd()*1.2),vy:2.2+rnd()*1.6,vz:Math.sin(a)*(.6+rnd()*1.2),r:c[0],g:c[1],b:c[2]});}}
 defineThing({id:'lodge-gifts',name:'선물 상자',root:giftPick,printParent:root,anchor:()=>{const gf=nearestGift();return new THREE.Vector3(gf.x,y+.6,gf.z);},reach:2.2,verb:'선물 열어 보기',
  touch(hit){const gf=nearestGift(hit?.point||player.position);if(gf.until>worldTime){toast('이미 열어 본 선물입니다. 잠시 뒤 다시 포장됩니다.');return null;}gf.until=worldTime+GIFT_RESET;burst(gf);giftSound();toast(KEEPSAKES[keepsakeIndex++%KEEPSAKES.length]);return {k:'선물'};}});

 // ── Sounds: a crackling fire bed near the hearth, and small one-shots for each comfort ──
 let fireBed=null,crackleAt=0;
 function ensureFireBed(){if(fireBed||!canPlaySound())return;const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let prev=0;for(let i=0;i<len;i++){prev=(prev+(Math.random()*2-1)*.08)/1.08;d[i]=prev*3;}
  const src=ctx.createBufferSource(),lp=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=buf;src.loop=true;lp.type='lowpass';lp.frequency.value=520;gain.gain.value=0;src.connect(lp);lp.connect(gain);gain.connect(bus.sfx);src.start();fireBed=gain;}
 function fireSounds(nearHearth){ensureFireBed();if(!fireBed)return;const t=ctx.currentTime;fireBed.gain.setTargetAtTime(nearHearth*(.07+stoke*.08),t,.3);if(nearHearth<=0||t<crackleAt)return;
  crackleAt=t+.05+Math.random()*(.38-stoke*.25);noiseBurst(t,.012+Math.random()*.03,{type:'highpass',f:1800+Math.random()*3200,gain:(.018+Math.random()*.05)*nearHearth*(1+stoke*1.5)});if(Math.random()<.18)tone(t,650+Math.random()*900,.02,{type:'triangle',gain:.018*nearHearth});}
 function cushionSound(){if(!canPlaySound())return;const t=ctx.currentTime;noiseBurst(t,.28,{type:'lowpass',f:480,gain:.2});tone(t,92,.22,{gain:.06,f2:58});}
 function stokeSound(){if(!canPlaySound())return;const t=ctx.currentTime;noiseBurst(t,.9,{type:'lowpass',f:300,f2:1400,gain:.18});tone(t,70,.5,{gain:.08,f2:45});for(let i=0;i<12;i++)noiseBurst(t+.08+Math.random()*.9,.02,{type:'highpass',f:2500+Math.random()*2500,gain:.06});}
 function sparkleSound(){if(!canPlaySound())return;const t=ctx.currentTime;[1318.5,1568,1760,2093,2637].forEach((f,i)=>tone(t+i*.06,f,.55,{gain:.045}));}
 function giftSound(){if(!canPlaySound())return;const t=ctx.currentTime;noiseBurst(t,.35,{type:'bandpass',f:3400,q:.6,gain:.12});noiseBurst(t+.12,.25,{type:'bandpass',f:2600,q:.7,gain:.08});tone(t+.3,784,.3,{gain:.07});tone(t+.4,1047,.45,{gain:.07});tone(t+.5,1319,.6,{gain:.06});}
 function sipSound(){if(!canPlaySound())return;const t=ctx.currentTime;noiseBurst(t+.2,.42,{type:'bandpass',f:900,q:2.2,gain:.07});tone(t+.7,210,.12,{gain:.05,f2:150});tone(t+1.1,520,.4,{gain:.025});}

 function tick(dt){if(paused)return;dt=Math.min(dt,.05);const p=player.position,nearHouse=Math.hypot(p.x,p.z-145)<60;
  // Fire: Lodge.tick has already set this frame's flame scales and glow; stoking multiplies them.
  stoke=Math.max(0,stoke-dt/STOKE_SECONDS);const heat=1+stoke*.9;P.flames.forEach(f=>{f.scale.y*=heat;f.scale.x=f.scale.z=1+stoke*.35;});P.fireLight.intensity+=stoke*1.8+Math.sin(worldTime*23)*.06*(1+stoke);
  sparks.visible=nearHouse;if(nearHouse){sparkDebt+=dt*(2.5+stoke*14);while(sparkDebt>1){emitSpark();sparkDebt--;}const pos=sparks.geometry.attributes.position,col=sparks.geometry.attributes.color;
   spark.forEach((s,i)=>{if(s.life>0){s.life-=dt;s.x+=s.vx*dt+Math.sin(worldTime*7+i)*.003;s.y+=s.vy*dt;s.z+=s.vz*dt;s.vy*=.985;}const k=Math.max(0,Math.min(1,s.life));pos.setXYZ(i,s.x,s.life>0?s.y:-999,s.z);col.setXYZ(i,k,k*.55,k*.18);});pos.needsUpdate=col.needsUpdate=true;}
  smoke.forEach((m,i)=>{const t=(worldTime*.12+m.ph)%1;m.s.position.set(-7+Math.sin(t*4+i)*.5,y+10.4+t*7,152+t*1.5);m.s.scale.setScalar(1+t*3);m.s.material.opacity=nearHouse?(1-t)*.28*Math.min(1,t*6):0;});
  // Cocoa: a sip lifts and tips the mug; steam always curls up.
  sip=Math.max(0,sip-dt/1.6);const lift=Math.sin(Math.min(1,sip)*Math.PI);mug.position.y=y+.46+lift*.32;mug.rotation.z=lift*.5;
  steam.forEach((m,i)=>{const t=(worldTime*.35+m.ph)%1;m.s.position.set(Math.sin(t*6+i)*.03,.25+t*.45,0);m.s.scale.setScalar(.1+t*.22);m.s.material.opacity=(1-t)*Math.min(1,t*5)*(.32+lift*.4);});
  animateBulbs(dt);if(!treePanel.hidden&&Math.hypot(p.x-TREE.x,p.z-TREE.z)>9)treePanel.hidden=true;
  for(const gf of P.gifts){const target=gf.until>worldTime?1:0;gf.open+=(target-gf.open)*Math.min(1,dt*5);gf.lid.position.set(gf.x+gf.open*.28,y+gf.h+gf.open*.5,gf.z);gf.lid.rotation.z=-gf.open*.7;}
  const cpos=confetti.geometry.attributes.position,ccol=confetti.geometry.attributes.color;let anyBits=false;
  bits.forEach((b,i)=>{if(b.life>0){anyBits=true;b.life-=dt;b.vy-=5.5*dt;b.vx*=.98;b.vz*=.98;b.x+=b.vx*dt;b.y=Math.max(y+.03,b.y+b.vy*dt);b.z+=b.vz*dt;}cpos.setXYZ(i,b.x,b.life>0?b.y:-999,b.z);ccol.setXYZ(i,b.r,b.g,b.b);});confetti.visible=anyBits;if(anyBits)cpos.needsUpdate=ccol.needsUpdate=true;
  const inside=currentRoom(p)?.id==='winter-house';fireSounds(inside?clamp(1-Math.hypot(p.x-FIRE.x,p.z-FIRE.z)/16,0,1):0);}
 return {tick,inspect:()=>({seats:[hearthSofa,loveseat,armchair].map(s=>s.seats.length),sitting:!!motion.sitting,stoke:Math.round(stoke*100)/100,tree:{palette:PALETTES[treeLook.palette].name,layout:LAYOUTS[treeLook.layout],effect:EFFECTS[treeLook.effect]},treePanel:!treePanel.hidden,openGifts:P.gifts.filter(g=>g.until>worldTime).length,sip:Math.round(sip*100)/100,fireBed:!!fireBed}),
  setTree:(look)=>{Object.assign(treeLook,look);applyTreeLook(false);return treeLook;},seatPositions:()=>[hearthSofa,loveseat,armchair].flatMap(s=>s.seats)};
})();
