// An additive refuge at the beginning of the promenade.
// The 32 LPs are real recordings: 19 vintage Christmas songs and 13 autumn-evening jazz guitar pieces, packed (mono,
// 12 kbps HE-AAC) into two files; [at, dur] are seconds inside each file. Every visitor derives the same song and
// position from the shared lodge clock. When a song ends the arm lifts, the next record goes on and the needle drops.
// If the recordings cannot be played, the original synthesized LP music takes over.
const LP_FILES=['./assets/lp-carol.m4a','./assets/lp-jazz.m4a'],LP_SFX={needle:'./assets/lp-needle.m4a',lift:'./assets/lp-lift.m4a'};
const LP_CAROL=[[1,114.52],[116.52,174.25],[291.77,187.82],[480.59,139.42],[621.01,276.61],[898.62,90.03],[989.65,189.76],[1180.41,118.28],[1299.69,150.84],[1451.53,139.85],[1592.38,134.89],[1728.27,235.32],[1964.59,188.42],[2154.01,171.56],[2326.57,167.38],[2494.95,184.83],[2680.78,191.98],[2873.76,324.18],[3198.94,173.92]];
const LP_JAZZ=[[1,225.08],[227.08,213.24],[441.32,190.69],[633.01,221.93],[855.94,246.75],[1103.69,149],[1253.69,324.76],[1579.45,188.62],[1769.07,237.44],[2007.51,457.51],[2466.02,206.12],[2673.14,223.83],[2897.97,375.47]];
const LP_SONGS=[...LP_CAROL.map(([at,dur],i)=>({file:0,at,dur,genre:'carol',title:'Vintage Christmas · '+String(i+1).padStart(2,'0')})),...LP_JAZZ.map(([at,dur],i)=>({file:1,at,dur,genre:'jazz',title:'Autumn Evening Guitar · '+String(i+1).padStart(2,'0')}))];
// Each record's turn: lead-in (arm lifts at 0 s, needle lands at 0.6 s, music at 2.6 s), the song, then the run-out groove.
const LP_LEAD=2.6,LP_TAIL=1.2,LP_LIFT_AT=0,LP_NEEDLE_AT=.6;
const lpCycle=i=>LP_LEAD+LP_SONGS[i].dur+LP_TAIL,LP_ROUND=LP_SONGS.reduce((sum,_,i)=>sum+lpCycle(i),0);
// Which record is on and how far into its turn, from the shared {record, playing, offset, startedAt} and a clock in ms.
function lpPosition(l,now){let t=Math.max(0,(l.offset+(l.playing?now-l.startedAt:0))/1000)%LP_ROUND,index=Number.isInteger(l.record)&&LP_SONGS[l.record]?l.record:0;
 while(t>=lpCycle(index)){t-=lpCycle(index);index=(index+1)%LP_SONGS.length;}return {index,t,song:t-LP_LEAD,start:now-t*1000};}
const Lodge=(()=>{
 const A=globalThis.VillageAdventure,{LODGE:L,RECORDS}=A,y=terrainY(L.x,L.z)+.65,root=new THREE.Group();root.name='winter-lodge';scene.add(root);SURFACE.push(root);
 const timberTex=texCanvas(256,256,(g,w,h)=>{g.fillStyle='#895331';g.fillRect(0,0,w,h);for(let i=0;i<16;i++){const yy=i*16;g.fillStyle=i%2?'#9a623b':'#87512f';g.fillRect(0,yy,w,15);for(let j=0;j<22;j++){g.strokeStyle='rgba(45,23,12,.17)';g.beginPath();g.moveTo(0,yy+2+j%12);g.bezierCurveTo(80,yy+j%10,180,yy+8,w,yy+3+j%10);g.stroke();}}});timberTex.wrapS=timberTex.wrapT=THREE.RepeatWrapping;timberTex.repeat.set(2,1);
 const wood=phong(0xffffff,{map:timberTex,shininess:12}),trim=phong(0x422b20,{shininess:20}),snow=phong(0xede9da,{shininess:22}),gold=phong(0xe9ba55,{emissive:0x62420b,shininess:140}),pine=phong(0x234e38,{shininess:18}),red=phong(0x9b3430,{shininess:30}),warm=phong(0xffd08a,{emissive:0xffa647,emissiveIntensity:.8});
 const wallMeshes=[],roof=new THREE.Group();root.add(roof);
 function solid(x,yy,z,w,h,d,mat=wood,tag='lodge'){const m=box(x,yy,z,w,h,d,mat,root);solidAt(x,yy,z,w,h,d,tag);return m;}
 solid(0,y-.22,145,24,.44,20);for(let i=0;i<4;i++)solid(0,y-.15-i*.18,134-i*.65,4,.3,1.4,wood);
 // Open north-facing doorway, split walls and actual window glass.
 for(const side of [-1,1]){wallMeshes.push(solid(side*7,y+2.8,135,10,5.6,.5));wallMeshes.push(solid(side*12,y+1.05,145,.5,2.1,20));wallMeshes.push(solid(side*12,y+4.8,145,.5,1.6,20));for(const z of [136,144,154])wallMeshes.push(solid(side*12,y+3,z,.5,2,1));box(side*12,y+3,140,.12,2,7,clearGlass,root);box(side*12,y+3,149,.12,2,8,clearGlass,root);}
 wallMeshes.push(solid(0,y+5.1,135,4,1,.5));solid(0,y+2.8,155,24,5.6,.55);
 for(const side of [-1,1]){const r=box(side*6.4,y+7.2,145,13.8,.45,22,snow,roof);r.rotation.z=-side*.25;box(side*11.6,y+5.8,145,.3,.4,21,trim,roof);}
 // Gable ends: the pitched roof used to leave two open triangles above the walls, so the sky showed indoors.
 const GABLE_RISE=3.15,gableGeo=new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-12,0),new THREE.Vector2(12,0),new THREE.Vector2(0,GABLE_RISE)]),{depth:.5,bevelEnabled:false}),gableUv=gableGeo.attributes.uv;
 for(let i=0;i<gableUv.count;i++)gableUv.setXY(i,gableUv.getX(i)/24,gableUv.getY(i)/5.6);
 for(const z of [134.75,154.75]){const g=new THREE.Mesh(gableGeo,wood);g.name='lodge-gable';g.position.set(0,y+5.6,z);root.add(g);}
 // The chimney starts inside the roof slab, so it no longer hangs into the room in front of the hearth screen.
 solid(-7,y+8.53,152,1.8,2.94,1.8,trim,'lodge-chimney');box(-7,y+10.1,152,2.2,.3,2.2,snow,root);
 // Central tree, winding gold light string, ornaments, gifts and a woven circular rug.
 const rug=mesh(new THREE.CircleGeometry(4.1,40),red,0,y+.025,145,root);rug.rotation.x=-Math.PI/2;
 mesh(new THREE.CylinderGeometry(.3,.4,1,10),wood,0,y+.5,145,root);for(let i=0;i<4;i++)mesh(new THREE.ConeGeometry(2.4-i*.48,2.2,20),pine,0,y+1.6+i*.95,145,root);solidAt(0,y+2.6,145,3.6,5.2,3.6,'lodge-tree');
 const bulbs=[];for(let i=0;i<56;i++){const t=i/55,rr=2.5*(1-t)+.15,a=t*Math.PI*10,m=sphere(Math.cos(a)*rr,y+1+t*4.3,145+Math.sin(a)*rr,.065,warm,root);bulbs.push(m);if(i%4===0)sphere(Math.cos(a+.6)*rr,y+.9+t*4.2,145+Math.sin(a+.6)*rr,.16,i%8?gold:red,root);}
 const star=mesh(new THREE.OctahedronGeometry(.37),gold,0,y+5.65,145,root);star.scale.y=1.5;
 // Each gift keeps its lid in its own group so it can be lifted open.
 const gifts=[];for(let i=0;i<12;i++){const a=i*2.399,r=2.5+(i%3)*.25,x=Math.cos(a)*r,z=145+Math.sin(a)*r,w=.6+i%3*.16,h=.45+i%4*.16,paper=i%2?red:pine;box(x,y+h/2,z,w,h,w,paper,root);box(x,y+h/2+.03,z,.1,h+.1,w+.08,gold,root);
  const lid=new THREE.Group();lid.position.set(x,y+h,z);root.add(lid);box(0,.02,0,w+.04,.08,w+.04,paper,lid);box(0,.08,0,w+.08,.05,.1,gold,lid);for(const s of [-1,1]){const bow=mesh(new THREE.TorusGeometry(.09,.03,6,12),gold,s*.08,.15,0,lid);bow.rotation.y=Math.PI/2;bow.rotation.x=s*.5;}gifts.push({x,z,w,h,lid,open:0,until:0});}
 // Hearth on the back wall. Fire is inaccessible, light is warm.
 solid(-7,y+.4,153,5,.8,3,trim);solid(-9.2,y+2,153, .7,3.3,2.8,wood);solid(-4.8,y+2,153,.7,3.3,2.8,wood);solid(-7,y+3.6,153,5.5,.4,3,trim);box(-7,y+2,154,3.6,2.6,.15,phong(0x181310),root);
 for(let i=0;i<3;i++){const log=mesh(new THREE.CylinderGeometry(.2,.2,2.8,8),trim,-7,y+.95,152.7+i*.35,root);log.rotation.z=Math.PI/2;}
 const flames=[];for(let i=0;i<7;i++){const f=mesh(new THREE.ConeGeometry(.3,1.6,7),phong(i%2?0xffb335:0xff6c24,{emissive:i%2?0xffa32c:0xff5317,emissiveIntensity:1}),-8+i*.33,y+1.5,152.6,root);flames.push(f);}
 const fireLight=new THREE.PointLight(0xffaa58,1.4,20,1.6);fireLight.position.set(-7,y+2.5,151);root.add(fireLight);const roomLight=new THREE.PointLight(0xffdaa3,.9,29,1);roomLight.position.set(1,y+5,145);root.add(roomLight);
 // Seating is furnished by LodgeComforts: real sofas that face the hearth and can be sat on.
 // Thirty-two individual sleeves on eight cubby shelves; the playing vinyl really rotates.
 for(let row=0;row<4;row++){box(8,y+.5+row*1.08,153.9,6,.13,1.4,wood,root);for(let col=0;col<8;col++){const id=row*8+col,mat=phong(new THREE.Color().setHSL(id*.119%1,.35,.32),{shininess:20});box(5.5+col*.68,y+1+row*1.08,153.5,.55,.8,.10,mat,root);const disk=mesh(new THREE.CircleGeometry(.19,16),phong(0x191a19),5.5+col*.68,y+1+row*1.08,153.435,root);disk.rotation.y=Math.PI;}}
 solid(7,y+.65,141,3.4,1.3,2,wood);box(7,y+1.36,141,2.7,.13,1.65,trim,root);const disc=mesh(new THREE.CylinderGeometry(.65,.65,.035,40),phong(0x151718,{shininess:130}),6.7,y+1.46,141,root);mesh(new THREE.CylinderGeometry(.18,.18,.04,24),gold,6.7,y+1.48,141,root);const arm=box(7.8,y+1.54,141.1,.08,.07,.85,silver,root);arm.rotation.y=.5;for(const x of [5,9]){box(x,y+.65,141, .65,1.3,.7,trim,root);const sp=mesh(new THREE.CircleGeometry(.22,18),phong(0x161717),x,y+.6,140.64,root);sp.rotation.y=Math.PI;}
 function sign(x,yy,z,w,h,line,sub){const tx=texCanvas(512,128,g=>{g.fillStyle='#30291f';g.fillRect(0,0,512,128);g.textAlign='center';g.fillStyle='#ffe3a9';g.font='bold 34px sans-serif';g.fillText(line,256,55);g.font='19px sans-serif';g.fillText(sub,256,96);});mesh(new THREE.PlaneGeometry(w,h),phong(0xffffff,{map:tx,side:THREE.DoubleSide}),x,yy,z,root).rotation.y=Math.PI;}
 sign(0,y+4.3,134.7,6,1.5,'WINTER HOUSE','SAFE REFUGE · LP / CAROL & JAZZ');sign(7,y+2.1,140.2,3.2,.8,'32 WINTER RECORDS','E / TOUCH · PLAY A RECORD');
 for(let i=0;i<38;i++)sphere(-11.5+i*23/37,y+5.7,134.6,.08,warm,root);
 ROOMS.push({id:'winter-house',minX:-11.6,maxX:11.6,minZ:135.2,maxZ:154.5,floor:y,ceil:y+7.3,interior:true,group:root});LOCATION_NAMES['room:winter-house']=['SAFE REFUGE','크리스마스 나무집'];
 sign(3,terrainY(3,75)+2,75,4,1.1,'WINTER HOUSE ↓','SAFE REFUGE / 70m');
 // The path joins the original promenade without moving any original structure.
 for(let i=0;i<49;i++)box(0,terrainY(0,85+i)+.06,85+i,3,.1,.8,pathMaterial,root);
 const btn=document.createElement('button');btn.className='lodge-open';btn.hidden=true;document.body.append(btn);
 const panel=document.createElement('section');panel.className='lodge-records';panel.hidden=true;panel.setAttribute('aria-label','Winter records');panel.innerHTML='<header><div><small>WINTER HOUSE / 32 LPs</small><h2>벽난로 옆의 음악</h2></div><button class="lp-close" aria-label="Close records">×</button></header><p>캐롤과 재즈 · 이 단지의 모두가 같은 판을 듣습니다.</p><div class="lp-status" aria-live="polite"></div><button class="lp-toggle"></button><div class="lp-grid"></div><small>빈티지 크리스마스 19곡 · 가을 저녁 재즈 기타 13곡 · 한 곡이 끝나면 다음 LP로 바뀝니다</small>';document.body.append(panel);
 const minutes=s=>Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0');
 const grid=panel.querySelector('.lp-grid');for(const r of RECORDS){const song=LP_SONGS[r.id]||{genre:r.genre,title:r.title,dur:0},b=document.createElement('button');b.className='lp-sleeve';b.style.setProperty('--sleeve',`hsl(${r.id*43%360} 32% 30%)`);b.innerHTML='<span class="lp-icon">◉</span><small>'+song.genre.toUpperCase()+' / '+String(r.id+1).padStart(2,'0')+(song.dur?' · '+minutes(song.dur):'')+'</small><strong>'+song.title+'</strong>';b.onclick=()=>Village.action({type:'ad:record',record:r.id});grid.append(b);}
 panel.querySelector('.lp-close').onclick=()=>{panel.hidden=true;};panel.querySelector('.lp-toggle').onclick=()=>Village.action({type:'ad:record',playing:!Village.getState()?.adventure?.lodge.playing});
 function near(){return started&&!paused&&Math.abs(player.position.y-y)<2&&Math.hypot(player.position.x-7,player.position.z-141)<4;}
 function open(){if(!near())return false;resetInputs();panel.hidden=!panel.hidden;unlockAudio();return true;}btn.onclick=open;
 addEventListener('keydown',e=>{if(e.code==='Escape'&&!panel.hidden){panel.hidden=true;e.preventDefault();e.stopImmediatePropagation();}},true);
 // ── Real records: one audio element follows the shared position; the arm-lift and needle-drop sounds mark each change ──
 const LP_LEVEL=.6,LP_CRACKLE=.5,LP_DRIFT=1,LP_QUIET_PAUSE=900;let lp=null,lpBroken=false;
 function lpChain(){if(lp)return lp;const el=new Audio();el.preload='auto';el.preservesPitch=false;const bus=ctx.createGain(),music=ctx.createGain();bus.gain.value=0;music.gain.value=0;bus.connect(listener.getInput());music.connect(bus);
  // An old record: mono, no deep bass, rolled-off highs (opened from the folder, the element plays without the filters).
  if(location.protocol!=='file:'){const source=ctx.createMediaElementSource(el),hp=ctx.createBiquadFilter(),lo=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=110;lo.type='lowpass';lo.frequency.value=5600;source.connect(hp);hp.connect(lo);lo.connect(music);}
  // Faint surface noise while the needle is in the groove: a little hiss with sparse clicks.
  const len=ctx.sampleRate*3,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++){d[i]=(Math.random()*2-1)*.012;if(Math.random()<.0004)d[i]+=(Math.random()<.5?-1:1)*(.25+Math.random()*.5);}
  const hiss=ctx.createBufferSource(),band=ctx.createBiquadFilter(),crackle=ctx.createGain();hiss.buffer=buf;hiss.loop=true;band.type='bandpass';band.frequency.value=2400;band.Q.value=.5;crackle.gain.value=0;hiss.connect(band);band.connect(crackle);crackle.connect(bus);hiss.start();
  el.addEventListener('error',()=>{if(!el.getAttribute('src')||lpBroken)return;lpBroken=true;bus.gain.value=0;toast('LP 음원을 불러오지 못해 합성 LP 음악으로 이어 갑니다. assets 폴더를 함께 두어 주세요.');});
  lp={el,bus,music,crackle,file:-1,cycle:'',checkAt:0,quietAt:0,sfx:{}};loadLpSounds();return lp;}
 async function loadLpSounds(){for(const [kind,url] of Object.entries(LP_SFX)){try{const r=await fetch(url);if(!r.ok)throw new Error('status '+r.status);lp.sfx[kind]=await ctx.decodeAudioData(await r.arrayBuffer());}catch(e){lp.sfx[kind]=null;console.warn('[APT200X] LP sound',kind,e.message);}}}
 // delay < 0 starts the sound part-way through (when a visitor walks in during a record change).
 function lpSound(kind,delay,level){const skip=Math.max(0,-delay),buf=lp.sfx[kind];
  if(buf){if(skip>=buf.duration)return;const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buf;g.gain.value=level;s.connect(g);g.connect(lp.bus);s.start(ctx.currentTime+Math.max(0,delay),skip);s.onended=()=>{s.disconnect();g.disconnect();};return;}
  const a=new Audio(LP_SFX[kind]);a.volume=muted?0:clamp(volume*level,0,1);setTimeout(()=>{try{a.currentTime=skip;}catch{}a.play().catch(()=>{});},Math.max(0,delay)*1000);}
 function playRecords(l){const chain=lpChain(),now=ctx.currentTime,el=chain.el;
  if(!audible){chain.bus.gain.setTargetAtTime(0,now,.25);chain.cycle='';if(!chain.quietAt)chain.quietAt=performance.now();if(!el.paused&&performance.now()-chain.quietAt>LP_QUIET_PAUSE)el.pause();return;}
  chain.quietAt=0;chain.bus.gain.setTargetAtTime(LP_LEVEL,now,.2);const p=lpPosition(l,Village.clock()),song=LP_SONGS[p.index],key=p.index+':'+Math.round(p.start/100);
  if(key!==chain.cycle){chain.cycle=key;if(p.t<LP_LEAD){lpSound('lift',LP_LIFT_AT-p.t,.55);lpSound('needle',LP_NEEDLE_AT-p.t,.75);}}
  chain.crackle.gain.setTargetAtTime(p.t>LP_NEEDLE_AT?LP_CRACKLE:0,now,.3);
  if(location.protocol==='file:')el.volume=muted?0:clamp(volume*LP_LEVEL,0,1);
  if(p.song<0||p.song>=song.dur-.05){chain.music.gain.setTargetAtTime(0,now,.05);if(!el.paused)el.pause();return;}
  const target=song.at+p.song;if(chain.file!==song.file){chain.file=song.file;el.src=LP_FILES[song.file];el.currentTime=target;}
  if(el.paused){if(Math.abs(el.currentTime-target)>.3)el.currentTime=target;el.play().catch(()=>{});}
  else if(performance.now()>chain.checkAt){chain.checkAt=performance.now()+500;if(!el.seeking&&Math.abs(el.currentTime-target)>LP_DRIFT)el.currentTime=target;}
  chain.music.gain.setTargetAtTime(1,now,.08);}
 // ── Fallback: the original synthesized LP music, scheduled on the shared clock with only a short lookahead ──
 let gain=null,lastIndex=-1,identity='',scheduled=0,audible=false;
 function sound(){const l=Village.getState()?.adventure?.lodge;audible=!!l?.playing&&started&&!paused&&!document.hidden&&!LodgeTheater.isAudible()&&A.inRefuge({...player.position,space:currentRoom()?.id==='winter-house'?null:'outside'})&&Math.abs(player.position.x)<12&&player.position.z>135&&player.position.z<155;
 if(!ctx||!audioReady)return;if(!lpBroken&&l){playRecords(l);return;}if(lp)lp.el.pause();
 if(!gain){gain=ctx.createGain();gain.gain.value=0;gain.connect(listener.getInput());}gain.gain.setTargetAtTime(audible?.34:0,ctx.currentTime,.2);if(!audible)return;
 const r=RECORDS[l.record],beat=60/r.bpm,elapsed=(l.offset+(Village.clock()-l.startedAt))/1000,key=l.record+':'+l.startedAt;if(identity!==key){identity=key;lastIndex=-1;}const step=Math.floor(elapsed/(beat/2));if(lastIndex<step-2)lastIndex=step-1;const next=Math.floor((elapsed+.18)/(beat/2));for(let i=lastIndex+1;i<=next;i++){const at=ctx.currentTime+Math.max(.012,i*beat/2-elapsed);playStep(r,i,at,beat);scheduled++;}lastIndex=next;
 }
 function playStep(r,i,at,beat){const bar=Math.floor(i/8)%8,pos=i%8,rootNote=48+r.key+([0,5,2,7,0,9,2,7][bar]),jazz=r.genre==='jazz',freq=n=>440*2**((n-69)/12),voice=(n,t,d,v=.07,type='sine')=>note(freq(n),t,d,v,type,gain);if(pos===0||pos===4){voice(rootNote-12,at,beat*1.2,.13);const chord=jazz?[0,4,7,11]:[0,4,7];for(const n of chord){voice(rootNote+n,at+.018*(n%3),beat*1.5,.035);voice(rootNote+n+12,at+.01,beat*1.15,.012,'triangle');}}
 if(pos%2===0||jazz&&pos===5){const motifs=[[4,4,5,7,7,5,4,2],[0,2,4,0,4,5,7,4],[7,9,7,5,4,2,0,2],[4,7,9,7,5,4,2,0]],n=motifs[Math.floor(r.id/4)%4][(Math.floor(i/2)+Math.floor(r.id/8)*2)%8];voice(60+r.key+n+(bar%4===3?-2:0),at+(jazz&&pos%2?beat*.14:0),beat*(jazz?.7:1.3),.09,'triangle');if(!jazz)voice(72+r.key+n,at,beat*.75,.018);}
 if(jazz&&pos%2){voice(85,at,.035,.008);voice(rootNote+7,at+beat*.12,beat*.38,.027);}if(!jazz&&pos===0)for(const n of [84+r.key,91+r.key])voice(n,at,beat*2,.012);
 }
 let statusKey='';function tick(dt){const inside=currentRoom(player.position)?.id==='winter-house';const cameraInside=camera.position.x>-11.8&&camera.position.x<11.8&&camera.position.z>135&&camera.position.z<155;roof.visible=!inside||cameraInside&&camera.position.y<y+5.5;for(const m of wallMeshes)m.visible=!(inside&&((Math.abs(camera.position.x)>11.8&&Math.abs(m.position.x)>11&&Math.sign(m.position.x)===Math.sign(camera.position.x))||(camera.position.z<135&&m.position.z===135)));const l=Village.getState()?.adventure?.lodge;btn.hidden=!near()||!panel.hidden;btn.textContent=I18n.lang()==='en'?'Browse 32 records · E':'LP 32장 고르기 · E';if(!near())panel.hidden=true;if(l){const on=lpPosition(l,Village.clock()).index,k=on+':'+l.playing+':'+I18n.lang();if(k!==statusKey){statusKey=k;panel.querySelector('.lp-status').textContent=(l.playing?'▶ ':'Ⅱ ')+(LP_SONGS[on]?.title||RECORDS[l.record].title);panel.querySelector('.lp-toggle').textContent=l.playing?(I18n.lang()==='en'?'Pause record':'재생 멈추기'):(I18n.lang()==='en'?'Play record':'다시 재생');[...grid.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===on)));}if(l.playing)disc.rotation.y=-Village.clock()*.00349;}
 flames.forEach((f,i)=>{f.scale.y=.7+.3*Math.sin(worldTime*7+i*1.9);});fireLight.intensity=1.3+Math.sin(worldTime*8)*.09;star.rotation.y=worldTime*.2;sound();}
 return {parts:{root,y,flames,bulbs,fireLight,star,gifts,wood,trim,red,gold,pine,warm},tick,handleInteract:open,handleTap:(x,z)=>{if(!near())return false;pointer.set(x/innerWidth*2-1,-z/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);if(raycaster.intersectObject(disc).length)return open();return false;},duck:()=>audible?.08:LodgeTheater.duckLevel(),inspect:()=>({inside:currentRoom()?.id==='winter-house',floor:y,near:near(),panel:!panel.hidden,record:Village.getState()?.adventure?.lodge,records:RECORDS.length,audible,scheduled,audio:ctx?.state,
  lp:(()=>{const l=Village.getState()?.adventure?.lodge,p=l?lpPosition(l,Village.clock()):null;return {broken:lpBroken,on:p?.index,title:p?LP_SONGS[p.index].title:null,songTime:p?Math.round(p.song*10)/10:null,element:lp?{src:lp.el.getAttribute('src'),time:Math.round(lp.el.currentTime*10)/10,paused:lp.el.paused}:null,sounds:lp?Object.keys(lp.sfx).filter(k=>lp.sfx[k]):[]};})()})};
})();
// A call button on every physical landing, including the formerly missing seventh one.
const ElevatorCalls=(()=>{const b=document.createElement('button');b.className='elevator-call';b.hidden=true;document.body.append(b);let landing=null;
 function call(){if(!landing)return false;Village.action({type:'elevatorCall',floor:landing.floor});sfx('tick');return true;}b.onclick=call;
 function tick(){landing=started&&!paused&&!inCar(player.position)?nearLanding(player.position):null;b.hidden=!landing;if(!landing)return;const e=Village.getState()?.elevator,waiting=e?.queue.includes(landing.floor)||e?.trip?.to===landing.floor,arrived=e&&!e.trip&&e.cur===landing.floor;const en=I18n.lang()==='en';b.textContent=arrived?(en?'Elevator here · Open / E':'엘리베이터 도착 · 문 열기 / E'):waiting?(en?'Call registered · Elevator coming':'호출 접수 · 엘리베이터 이동 중'):(en?'Call elevator to this floor · E':'이 층으로 엘리베이터 호출 · E');}
 return {tick,handleInteract:call,inspect:()=>({floor:landing?.floor,visible:!b.hidden})};})();
