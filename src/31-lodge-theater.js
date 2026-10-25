// ─── Winter house wall pieces: a hand-written D+ sketchbook and a hearth speaker that projects YouTube ──
// YouTube cannot be drawn into WebGL, so the real player <iframe> sits *behind* the game canvas. Each frame
// it is bent into the screen's perspective with a CSS matrix3d (a four-corner homography), and the 3D screen
// writes a transparent hole into the canvas: the video shows through, and anyone in front still hides it.
// v4.8: what the screen shows is shared (the speaker's shared record), and a faintly scratched glass sits over the picture.
const SKETCH_START=new Date(2025,10,2); // D-day: 2025-11-02 (local time). D+0 is that day itself.
function daysSinceStart(now=new Date()){const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((today-SKETCH_START)/864e5);}
function koreanDateLine(now=new Date()){return now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일 '+'일월화수목금토'[now.getDay()]+'요일';}
function parseYouTubeLink(raw){const text=String(raw||'').trim(),ID=/^[A-Za-z0-9_-]{11}$/;if(ID.test(text))return {id:text,start:0};let u;try{u=new URL(/^https?:\/\//i.test(text)?text:'https://'+text);}catch{return null;}
 const host=u.hostname.replace(/^(www|m|music)\./,'');let id=null;
 if(host==='youtu.be')id=u.pathname.split('/')[1];else if(host==='youtube.com'||host==='youtube-nocookie.com'){if(u.pathname==='/watch')id=u.searchParams.get('v');else id=u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1]||null;}
 if(!id||!ID.test(id))return null;const t=u.searchParams.get('t')||u.searchParams.get('start')||'',hms=t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
 return {id,start:/^\d+$/.test(t)?+t:hms?(+hms[1]||0)*3600+(+hms[2]||0)*60+(+hms[3]||0):0};}
// The speaker's shared record → what the screen shows: {id, pos (s) at `at` (ms), playing, by}. Null if never projected.
function readSharedScreen(st,now){if(!st||typeof st.yv!=='string')return null;const id=/^[A-Za-z0-9_-]{11}$/.test(st.yv)?st.yv:null;
 return {id,pos:Number.isFinite(st.ys)?Math.max(0,st.ys):0,at:Number.isFinite(st.ya)?st.ya:now,playing:!!id&&st.yp===true,by:typeof st.yb==='string'?st.yb.slice(0,8):''};}
// Where the shared video should be now, in seconds.
function sharedPosition(s,now){return Math.max(0,s.pos+(s.playing?Math.max(0,now-s.at)/1000:0));}
// A faintly scratched pane of glass as a transparent PNG: hairline scratches, a few curved ones and specks of dust.
function scratchedGlass(w,h,seed=7){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');let s=seed;const r=()=>(s=(s*16807)%2147483647)/2147483647;g.lineCap='round';
 for(let i=0;i<70;i++){const x=r()*w,y=r()*h,len=12+r()**2*180,a=r()*Math.PI,light=r()<.8;g.strokeStyle=light?`rgba(255,255,255,${.04+r()*.12})`:`rgba(0,0,0,${.05+r()*.08})`;g.lineWidth=.4+r()*.8;g.beginPath();g.moveTo(x,y);
  const ex=x+Math.cos(a)*len,ey=y+Math.sin(a)*len;if(r()<.3)g.quadraticCurveTo((x+ex)/2+(r()-.5)*30,(y+ey)/2+(r()-.5)*30,ex,ey);else g.lineTo(ex,ey);g.stroke();}
 for(let i=0;i<220;i++){g.fillStyle=`rgba(255,255,255,${r()*.12})`;g.fillRect(r()*w,r()*h,r()<.9?1:2,1);}
 return c.toDataURL('image/png');}
// Perspective transform mapping the w×h rectangle onto four screen points (CSS matrix3d, column-major).
function quadTransform(w,h,q){const adj=m=>[m[4]*m[8]-m[5]*m[7],m[2]*m[7]-m[1]*m[8],m[1]*m[5]-m[2]*m[4],m[5]*m[6]-m[3]*m[8],m[0]*m[8]-m[2]*m[6],m[2]*m[3]-m[0]*m[5],m[3]*m[7]-m[4]*m[6],m[1]*m[6]-m[0]*m[7],m[0]*m[4]-m[1]*m[3]];
 const mul=(a,b)=>{const c=Array(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)c[3*i+j]+=a[3*i+k]*b[3*k+j];return c;},mv=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
 const basis=p=>{const m=[p[0][0],p[1][0],p[2][0],p[0][1],p[1][1],p[2][1],1,1,1],v=mv(adj(m),[p[3][0],p[3][1],1]);return mul(m,[v[0],0,0,0,v[1],0,0,0,v[2]]);};
 const t=mul(basis(q),adj(basis([[0,0],[w,0],[w,h],[0,h]])));if(!t[8])return null;const n=t.map(v=>v/t[8]);return [n[0],n[3],0,n[6],n[1],n[4],0,n[7],0,0,1,0,n[2],n[5],0,n[8]];}

const LodgeTheater=(()=>{
 const P=Lodge.parts,y=P.y,root=P.root;

 // ── Sketchbook above the right speaker: big D+ count, today's date underneath, both in pencil handwriting ──
 const SK={x:-3.75,y:y+2.75,z:154.67,w:.62,h:.82},skCanvas=document.createElement('canvas');skCanvas.width=512;skCanvas.height=680;
 const skTex=new THREE.CanvasTexture(skCanvas);skTex.colorSpace=THREE.SRGBColorSpace;skTex.anisotropy=4;
 const HAND='"Gaegu","Nanum Pen Script","Apple SD Gothic Neo","Malgun Gothic",sans-serif';let skKey='',handReady=false;
 function scribble(g,text,cx,cy,size,weight,ink){g.font=`${weight} ${size}px ${HAND}`;const chars=[...text],widths=chars.map(c=>g.measureText(c).width),total=widths.reduce((a,b)=>a+b,0);let x=cx-total/2;
  chars.forEach((c,i)=>{const jitter=Math.sin(i*12.9898+size)*.5,wob=Math.cos(i*7.233+size*.1);g.save();g.translate(x+widths[i]/2,cy+wob*size*.025);g.rotate(jitter*.07);g.fillStyle=ink;g.globalAlpha=.9;g.fillText(c,0,0);g.globalAlpha=.25;g.fillText(c,1.2,.8);g.restore();x+=widths[i];});}
 function drawSketch(){const now=new Date(),days=daysSinceStart(now),key=days+'|'+koreanDateLine(now)+'|'+handReady;if(key===skKey)return;skKey=key;const g=skCanvas.getContext('2d'),W=skCanvas.width,H=skCanvas.height;
  g.fillStyle='#f7f1e3';g.fillRect(0,0,W,H);for(let i=0;i<2600;i++){g.fillStyle=`rgba(120,100,70,${Math.random()*.05})`;g.fillRect(Math.random()*W,Math.random()*H,1,1);}
  const vignette=g.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.75);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(120,90,50,.16)');g.fillStyle=vignette;g.fillRect(0,0,W,H);
  g.strokeStyle='#3a3530';g.lineWidth=5;for(let i=0;i<13;i++){const x=40+i*36;g.beginPath();g.ellipse(x,26,9,20,0,Math.PI*.15,Math.PI*1.85);g.stroke();}
  g.textAlign='center';g.textBaseline='middle';scribble(g,'D+'+days,W/2,H*.43,days>999?150:178,700,'#2c2a2e');
  g.strokeStyle='rgba(44,42,46,.55)';g.lineWidth=3;g.beginPath();g.moveTo(W*.2,H*.6);g.bezierCurveTo(W*.4,H*.585,W*.6,H*.62,W*.8,H*.598);g.stroke();
  scribble(g,koreanDateLine(now),W/2,H*.7,46,400,'#3b3530');
  g.save();g.translate(W*.8,H*.86);g.rotate(-.2);g.strokeStyle='#c4555e';g.lineWidth=4;g.beginPath();g.moveTo(0,10);g.bezierCurveTo(-26,-12,-12,-30,0,-14);g.bezierCurveTo(12,-30,26,-12,0,10);g.stroke();g.restore();
  skTex.needsUpdate=true;}
 const sketch=new THREE.Group();sketch.position.set(SK.x,SK.y,SK.z);sketch.rotation.set(0,Math.PI,.035);root.add(sketch);
 mesh(new THREE.PlaneGeometry(SK.w,SK.h),phong(0xffffff,{map:skTex,shininess:4,specular:0x111111}),0,0,0,sketch);
 box(0,-SK.h/2+.01,.012,SK.w*.98,.02,.012,phong(0x8a6a4a),sketch);
 sphere(SK.x,SK.y+SK.h/2+.2,SK.z+.02,.025,P.gold,root);
 for(const s of [-1,1])box(s*.14,SK.h/2+.1,0,.008,.26,.008,phong(0x9b8466),sketch).rotation.z=-s*.6;
 drawSketch();
 // Load the exact glyphs we draw (Korean subsets load on demand and canvas will not wait for them).
 (async()=>{try{await document.fonts?.load('700 120px Gaegu','D+0123456789');await document.fonts?.load('400 40px Gaegu','0123456789년월일'+'일월화수목금토'+'요');handReady=[...document.fonts].some(f=>f.family.replace(/"/g,'')==='Gaegu'&&f.status==='loaded');}catch{}skKey='';drawSketch();})();
 setInterval(drawSketch,60000);
 const sketchView=document.createElement('div');sketchView.className='sketch-view';sketchView.hidden=true;sketchView.setAttribute('role','dialog');sketchView.setAttribute('aria-label','스케치북');sketchView.innerHTML='<img alt=""><button aria-label="닫기">×</button>';document.body.append(sketchView);
 sketchView.onclick=()=>{sketchView.hidden=true;};
 defineThing({id:'lodge-sketchbook',name:'스케치북',root:sketch,printParent:root,anchor:()=>new THREE.Vector3(SK.x,SK.y,SK.z-.3),reach:3,verb:'스케치북 보기',touch(){drawSketch();const img=sketchView.querySelector('img');img.src=skCanvas.toDataURL('image/png');img.alt='D+'+daysSinceStart()+' · '+koreanDateLine();sketchView.hidden=false;resetInputs();return {k:'봄'};}});

 // ── Hearth speakers, the pull-down screen above the mantel and a little projector on the coffee table ──
 const SCREEN={x:-7,y:y+4.9,z:154.64,w:3.55,h:2},STAGE_W=640,STAGE_H=360,THEATER_KEY='apt200x-theater';
 const grille=phong(0x2c2621,{shininess:6}),coneMat=phong(0x15120f,{shininess:60}),led=new THREE.MeshBasicMaterial({color:0x553322});
 const speakerRoot=new THREE.Group();root.add(speakerRoot);const cones=[];
 for(const x of [-10.35,-3.75]){const g=new THREE.Group();g.position.set(x,y,154.05);speakerRoot.add(g);box(0,.62,0,.62,1.24,.5,P.trim,g);box(0,.68,-.255,.52,1.08,.02,grille,g);
  for(const [cy,r] of [[.45,.17],[.85,.12],[1.12,.05]]){const c=mesh(new THREE.CircleGeometry(r,24),coneMat,0,cy,-.268,g);c.rotation.y=Math.PI;cones.push(c);}mesh(new THREE.CircleGeometry(.015,8),led,.2,1.18,-.27,g).rotation.y=Math.PI;solidAt(x,y+.62,154.05,.62,1.24,.5,'lodge');}
 box(SCREEN.x,SCREEN.y+SCREEN.h/2+.09,SCREEN.z+.02,SCREEN.w+.3,.12,.12,P.trim,root);
 const fabric=mesh(new THREE.PlaneGeometry(SCREEN.w,SCREEN.h),phong(0xf3efe4,{shininess:4,specular:0x111111}),SCREEN.x,SCREEN.y,SCREEN.z,root);fabric.rotation.y=Math.PI;
 const hole=mesh(new THREE.PlaneGeometry(SCREEN.w,SCREEN.h),new THREE.MeshBasicMaterial({color:0x000000,opacity:0,blending:THREE.NoBlending,fog:false}),SCREEN.x,SCREEN.y,SCREEN.z-.01,root);hole.rotation.y=Math.PI;hole.name='theater-hole';hole.visible=false;hole.raycast=ignoreRaycast;
 const projector=new THREE.Group();projector.position.set(-7.05,y+.46,149.95);root.add(projector);box(0,.09,0,.34,.18,.28,phong(0xd9d2c4,{shininess:40}),projector);mesh(new THREE.CylinderGeometry(.055,.06,.08,16),coneMat,0,.1,.17,projector).rotation.x=Math.PI/2;
 const LENS=new THREE.Vector3(-7.05,y+.56,150.17),beamGeo=new THREE.BufferGeometry(),corners=[[1,1],[-1,1],[-1,-1],[1,-1]].map(([sx,sy])=>new THREE.Vector3(SCREEN.x+sx*SCREEN.w/2,SCREEN.y+sy*SCREEN.h/2,SCREEN.z-.02));
 beamGeo.setAttribute('position',new THREE.Float32BufferAttribute([LENS,...corners].flatMap(v=>[v.x,v.y,v.z]),3));beamGeo.setIndex([0,1,2,0,2,3,0,3,4,0,4,1]);
 const beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:0xcfe0ff,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));beam.visible=false;beam.raycast=ignoreRaycast;root.add(beam);

 // ── The YouTube player behind the canvas, shared by everyone in the winter house ──
 // The speaker's shared record says what is on: st.yv video id, st.ys position (s) at st.ya (shared clock, ms), st.yp
 // playing, st.yb who changed it. Visitors load that video when they come near and keep within a few seconds of it.
 const stage=document.createElement('div');stage.className='lodge-stage';stage.setAttribute('aria-hidden','true');stage.innerHTML='<div id="lodgeVideo"></div><div class="tv-glass"></div>';document.body.prepend(stage);
 stage.querySelector('.tv-glass').style.setProperty('--scratches','url('+scratchedGlass(STAGE_W,STAGE_H)+')');
 const SHARE_STALE_MS=8*3600e3,SYNC_MS=500,DRIFT_SECONDS=2.5,SEEK_COOLDOWN_MS=4000,AUTOPLAY_WAIT_MS=3000,QUIET_MS=1500,LOAD_RADIUS=45;
 const play={id:null,loaded:null,state:-1,error:null,volume:70,applied:-1,big:false,ready:false,shown:false,lastLink:'',muteForAutoplay:false,asked:0,askAt:0,seekAt:0,quietUntil:0};let shared=null,ytPlayer=null,apiPromise=null,volumeAt=0,syncAt=0;
 try{const saved=JSON.parse(localStorage.getItem(THEATER_KEY)||'{}');if(Number.isFinite(saved.volume))play.volume=clamp(saved.volume,0,100);if(typeof saved.link==='string')play.lastLink=saved.link.slice(0,300);}catch{}
 function remember(){try{localStorage.setItem(THEATER_KEY,JSON.stringify({volume:play.volume,link:play.lastLink}));}catch{}}
 function loadApi(){if(window.YT?.Player)return Promise.resolve(window.YT);if(apiPromise)return apiPromise;
  apiPromise=new Promise((resolve,reject)=>{const before=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{before?.();resolve(window.YT);};const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.async=true;s.onerror=()=>reject(new Error('load'));document.head.append(s);setTimeout(()=>reject(new Error('timeout')),15000);}).catch(e=>{apiPromise=null;throw e;});return apiPromise;}
 const ERRORS={2:'링크의 영상 번호가 올바르지 않습니다.',5:'이 브라우저에서 재생할 수 없는 영상입니다.',100:'영상을 찾을 수 없습니다(삭제되었거나 비공개).',101:'영상 소유자가 다른 사이트에서의 재생을 막아 두었습니다.',150:'영상 소유자가 다른 사이트에서의 재생을 막아 두었습니다.',153:'유튜브가 이 주소에서의 재생을 막았습니다. 웹 주소(GitHub Pages나 시작.command)로 열어 주세요.'};
 // ── Shared state: every button changes the record for everyone; each visitor's player then follows it ──
 const wanted=()=>shared?.id&&!(shared.playing&&Village.clock()-shared.at>SHARE_STALE_MS)?shared:null;
 const sharedTarget=()=>shared?sharedPosition(shared,Village.clock()):0;
 function share(next){World.touch('lodge-speaker',{k:next.id?'영사':'끔',st:{yv:next.id||'',ys:Math.round(Math.max(0,next.pos||0)*100)/100,ya:Village.clock(),yp:!!next.playing,yb:NET.id},silent:true});}
 function receiveShared(rec,source){const next=readSharedScreen(rec?.st,Village.clock());if(!next)return;const fresh=next.id&&next.id!==shared?.id;shared=next;syncAt=0;
  if(fresh&&next.by&&next.by!==NET.id&&source!=='initial'&&started)toast('방문자 #'+next.by+'가 나무집 벽난로 스크린에 영상을 틀었습니다. 나무집에 오면 함께 볼 수 있습니다.');renderPanel();}
 function project(link){const parsed=parseYouTubeLink(link);if(!parsed){setStatus('유튜브 링크를 알아볼 수 없습니다. youtu.be/… 또는 youtube.com/watch?v=… 형식으로 붙여 넣어 주세요.');return false;}
  if(location.protocol==='file:'){setStatus(ERRORS[153]);return false;}
  play.lastLink=String(link).trim().slice(0,300);play.error=null;remember();setStatus('영사기를 켜는 중… 나무집의 모두에게 같은 장면이 비칩니다.');projectorSound();share({id:parsed.id,pos:parsed.start,playing:true});return true;}
 function stop(){share({id:'',pos:0,playing:false});play.big=false;setStatus('영사기를 껐습니다. 모두의 스크린이 꺼집니다.');renderPanel();}
 function togglePause(){const want=wanted();if(want)share({id:want.id,pos:sharedTarget(),playing:!want.playing});}
 function nudge(seconds){const want=wanted();if(want)share({id:want.id,pos:Math.max(0,sharedTarget()+seconds),playing:want.playing});}
 const quiet=()=>{play.quietUntil=Date.now()+QUIET_MS;};
 // In the big view the visitor can use YouTube's own pause/play; that becomes the shared state too (not our own calls).
 function nativeControl(s){if(!play.big||Date.now()<play.quietUntil||!play.ready||shared?.id!==play.id)return;let cur=0;try{cur=ytPlayer.getCurrentTime()||0;}catch{}
  if(s===2&&shared.playing)share({id:shared.id,pos:cur,playing:false});else if(s===1&&!shared.playing)share({id:shared.id,pos:cur,playing:true});}
 async function createPlayer(id,start){play.loaded=id;quiet();
  try{const YT=await loadApi();if(ytPlayer)return;ytPlayer=new YT.Player('lodgeVideo',{host:'https://www.youtube-nocookie.com',width:STAGE_W,height:STAGE_H,videoId:id,playerVars:{autoplay:1,start:Math.floor(start),playsinline:1,rel:0,controls:1,origin:location.origin},
   events:{onReady:()=>{play.ready=true;play.applied=-1;syncAt=0;},onStateChange:e=>{play.state=e.data;if(e.data===1)play.asked=0;nativeControl(e.data);renderPanel();},onError:e=>{play.error=e.data;setStatus(ERRORS[e.data]||'영상을 재생하지 못했습니다. ('+e.data+')');}}});
  }catch{play.loaded=null;setStatus('유튜브에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');}}
 // Twice a second: load what is shared, follow its position, pause while far away, fall back to muted play if sound is blocked.
 function sync(){const want=wanted(),p=player.position,near=started&&(currentRoom(p)?.id==='winter-house'||Math.hypot(p.x,p.z-145)<LOAD_RADIUS);
  if(!want){if(play.id){try{ytPlayer?.stopVideo();}catch{}play.id=null;play.state=-1;play.big=false;play.muteForAutoplay=false;renderPanel();}return;}
  if(play.id!==want.id){play.id=want.id;play.error=null;play.asked=0;}
  if(!near||location.protocol==='file:'){if(play.ready&&play.state===1){quiet();try{ytPlayer.pauseVideo();}catch{}}return;}
  const target=sharedTarget();if(!ytPlayer){if(play.loaded!==want.id)createPlayer(want.id,target);return;}if(!play.ready)return;
  if(play.loaded!==want.id){play.loaded=want.id;play.state=-1;quiet();try{ytPlayer.loadVideoById({videoId:want.id,startSeconds:target});}catch{}return;}
  if(play.error)return;let cur=0,length=0;try{cur=ytPlayer.getCurrentTime()||0;length=ytPlayer.getDuration()||0;}catch{}const now=Date.now();
  if(!want.playing){if(play.state===1||play.state===3){quiet();try{ytPlayer.pauseVideo();}catch{}}if(Math.abs(cur-target)>1&&now>play.seekAt){play.seekAt=now+SEEK_COOLDOWN_MS;quiet();try{ytPlayer.seekTo(target,true);}catch{}}return;}
  if(length&&target>length-.5){if(play.state===1){quiet();try{ytPlayer.pauseVideo();}catch{}}return;}
  if(play.state!==1&&play.state!==3){if(now<play.askAt)return;play.askAt=now+AUTOPLAY_WAIT_MS;
   // Asked once and still silent: this browser only lets videos start muted until the visitor taps "소리 켜기".
   if(play.asked>=2&&!play.muteForAutoplay){play.muteForAutoplay=true;play.applied=-1;toast('이 브라우저가 소리 자동 재생을 막아 음소거로 함께 보는 중입니다. 스피커 창의 「소리 켜기」를 눌러 주세요.');}
   play.asked++;quiet();try{if(play.muteForAutoplay)ytPlayer.mute();if(Math.abs(cur-target)>DRIFT_SECONDS)ytPlayer.seekTo(target,true);ytPlayer.playVideo();}catch{}renderPanel();return;}
  if(play.state===1&&Math.abs(cur-target)>DRIFT_SECONDS&&now>play.seekAt){play.seekAt=now+SEEK_COOLDOWN_MS;quiet();try{ytPlayer.seekTo(target,true);}catch{}}}
 function unmute(){play.muteForAutoplay=false;play.applied=-1;try{ytPlayer?.unMute();ytPlayer?.playVideo();}catch{}renderPanel();}
 const playing=()=>!!play.id&&!play.error&&[1,3].includes(play.state);

 // ── Panel ──
 const panel=document.createElement('section');panel.className='lodge-panel theater-panel';panel.hidden=true;panel.setAttribute('aria-label','벽난로 스피커');
 panel.innerHTML='<header><div><small>WINTER HOUSE / HEARTH SPEAKER</small><h2>벽난로 스피커 · 벽 영사</h2></div><button class="lp-close" aria-label="닫기">×</button></header><p>유튜브 링크를 붙여 넣으면 벽난로 위 스크린에 영상이 비치고, 소리는 스피커에서 나옵니다. 나무집에 온 모든 방문자가 같은 장면을 함께 봅니다.</p><form class="theater-form"><input type="url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…" aria-label="유튜브 링크"><button type="submit">영사하기</button></form><div class="theater-status" aria-live="polite"></div><div class="theater-controls"><button data-act="toggle">일시정지</button><button data-act="back">−10초</button><button data-act="ahead">+10초</button><button data-act="big">크게 보기</button><button data-act="stop">끄기</button><button data-act="unmute" class="theater-unmute" hidden>🔈 소리 켜기</button><label>소리 <input type="range" min="0" max="100" aria-label="스피커 소리"></label></div><small>재생·일시정지·10초 이동·끄기는 모두에게 함께 적용됩니다(소리 크기와 크게 보기는 내 화면만) · 나무집 밖으로 나가면 소리가 작아집니다 · 일부 영상은 소유자가 다른 사이트 재생을 막아 두었습니다.</small>';document.body.append(panel);
 const input=panel.querySelector('input[type=url]'),status=panel.querySelector('.theater-status'),slider=panel.querySelector('input[type=range]');input.value=play.lastLink;slider.value=play.volume;
 // Typing a link must not walk the visitor around or trigger shortcuts.
 for(const t of ['keydown','keyup'])input.addEventListener(t,e=>{e.stopPropagation();if(e.key==='Escape'){panel.hidden=true;input.blur();}});
 panel.querySelector('form').onsubmit=e=>{e.preventDefault();project(input.value);};panel.querySelector('.lp-close').onclick=()=>{panel.hidden=true;};
 slider.oninput=()=>{play.volume=+slider.value;play.applied=-1;remember();};
 panel.querySelector('.theater-controls').onclick=e=>{const act=e.target.closest('button')?.dataset.act;if(act==='toggle')togglePause();if(act==='stop')stop();if(act==='back')nudge(-10);if(act==='ahead')nudge(10);if(act==='unmute')unmute();if(act==='big'&&play.id){play.big=!play.big;quiet();renderPanel();}};
 function setStatus(text){status.textContent=text;}
 function renderPanel(){const want=wanted(),on=!!want;panel.querySelector('[data-act="toggle"]').textContent=want&&!want.playing?'재생':'일시정지';panel.querySelector('[data-act="big"]').textContent=play.big?'벽으로 돌려 놓기':'크게 보기';for(const b of panel.querySelectorAll('.theater-controls button'))b.disabled=!on;panel.querySelector('[data-act="unmute"]').hidden=!play.muteForAutoplay;
  if(on&&!play.error){const who=want.by&&want.by!==NET.id?' · 방문자 #'+want.by+'가 튼 영상':'';setStatus((!want.playing?'Ⅱ 모두 함께 잠시 멈춤':play.state===1?'▶ 모두 함께 상영 중':play.state===0?'상영이 끝났습니다':play.state===3?'불러오는 중…':'재생을 기다리는 중 · 시작되지 않으면 재생이나 크게 보기를 눌러 주세요')+who+(play.muteForAutoplay?' · 🔇 소리 켜기를 눌러 주세요':''));}stage.classList.toggle('big',play.big&&on&&!!play.id);}
 addEventListener('keydown',e=>{if(e.code==='Escape'&&(!panel.hidden||!sketchView.hidden||play.big)){panel.hidden=true;sketchView.hidden=true;if(play.big){play.big=false;renderPanel();}e.preventDefault();e.stopImmediatePropagation();}},true);
 defineThing({id:'lodge-speaker',name:'벽난로 스피커',root:speakerRoot,printParent:root,apply:(rec,source)=>receiveShared(rec,source),anchor:()=>{const p=player.position;return new THREE.Vector3(Math.abs(p.x+10.35)<Math.abs(p.x+3.75)?-10.35:-3.75,y+.9,153.7);},reach:2.8,verb:'스피커 · 유튜브 영사',touch(){resetInputs();panel.hidden=false;renderPanel();setTimeout(()=>input.focus(),50);return {k:'스피커'};}});

 // ── Per frame: place the iframe on the wall, punch the hole, set the volume by distance ──
 const _c=new THREE.Vector3(),_v=new THREE.Vector3(),WALL_CORNERS=[[1,1],[-1,1],[-1,-1],[1,-1]];
 function placeStage(){if(!play.id||play.error||play.big||!started||!root.visible)return false;const cam=camera.position;if(cam.z>SCREEN.z-.05||Math.abs(cam.x)>12.5||cam.z<133||cam.y<y-1||cam.y>y+9)return false;camera.updateMatrixWorld();
  const q=[];for(const [sx,sy] of WALL_CORNERS){_c.set(SCREEN.x+sx*SCREEN.w/2,SCREEN.y+sy*SCREEN.h/2,SCREEN.z);_v.copy(_c).applyMatrix4(camera.matrixWorldInverse);if(_v.z>-camera.near*2)return false;_c.project(camera);q.push([(_c.x+1)/2*innerWidth,(1-_c.y)/2*innerHeight]);}
  const m=quadTransform(STAGE_W,STAGE_H,q);if(!m||m.some(v=>!Number.isFinite(v)))return false;stage.style.transform='matrix3d('+m.map(v=>+v.toFixed(8)).join(',')+')';return true;}
 function proximity(){const p=player.position;if(currentRoom(p)?.id==='winter-house')return 1;const d=Math.hypot(p.x,p.z-145);return d<30?clamp(1-(d-12)/18,0,1)*.4:0;}
 function tick(){if(performance.now()>syncAt){syncAt=performance.now()+SYNC_MS;sync();if(!panel.hidden)renderPanel();}const shown=placeStage();if(shown!==play.shown){play.shown=shown;stage.classList.toggle('on',shown);}hole.visible=shown;beam.visible=playing()&&root.visible;
  const pulse=playing()?.05*Math.max(0,Math.sin(worldTime*13))+.03*Math.max(0,Math.sin(worldTime*21+1)):0;cones.forEach((c,i)=>c.scale.setScalar(1+pulse*(i%3===0?1:.5)));led.color.setHex(playing()?0xff7a3a:0x553322);fabric.material.emissive.setHex(shown?0x0e0e12:0x000000);
  if(!panel.hidden&&currentRoom(player.position)?.id!=='winter-house')panel.hidden=true;
  if(ytPlayer&&play.ready&&performance.now()>volumeAt){volumeAt=performance.now()+200;const level=Math.round(play.volume*(muted?0:volume)*(paused||document.hidden?0:proximity()));if(level!==play.applied){play.applied=level;try{ytPlayer.setVolume(level);if(level===0||play.muteForAutoplay)ytPlayer.mute();else ytPlayer.unMute();}catch{}}}}
 function projectorSound(){if(!canPlaySound())return;const t=ctx.currentTime;tone(t,180,.08,{type:'square',gain:.04});noiseBurst(t+.05,.5,{type:'bandpass',f:900,q:.6,gain:.05});tone(t+.2,62,.6,{gain:.05,f2:58});}
 return {tick,project,stop,togglePause,isAudible:()=>playing()&&proximity()>0,duckLevel:()=>playing()&&proximity()>.2?.15:1,
  inspect:()=>({sketch:{days:daysSinceStart(),date:koreanDateLine(),handwriting:handReady},video:{id:play.id,state:play.state,error:play.error,shown:play.shown,big:play.big,volume:play.applied,mutedForAutoplay:play.muteForAutoplay},shared:shared&&{...shared,target:Math.round(sharedTarget()*10)/10,active:!!wanted()},panel:!panel.hidden,hole:hole.visible})};
})();
