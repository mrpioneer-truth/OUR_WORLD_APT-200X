// ─── Ambience: the village after dark, and the sound of walking through it ──────────────
// Stars and a moon, apartment windows that light up at night, fireflies over the meadow,
// snow around the winter house, footsteps that follow the ground, crickets and soft UI clicks.
let nightLevel=0; // 0 = full day … 1 = deep night; written by updateAtmosphere from the shared clock
function seededRandom(seedValue){let s=seedValue>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const GLOW_TEX=texCanvas(64,64,g=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.75)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);});
function glowPoints(count,{size,color=0xffffff,additive=true,fog=true,attenuate=true,vertexColors=false}){
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));if(vertexColors)geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(count*3),3));
 const mat=new THREE.PointsMaterial({size,color,map:GLOW_TEX,transparent:true,depthWrite:false,fog,sizeAttenuation:attenuate,vertexColors,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,opacity:0});
 const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;pts.visible=false;pts.raycast=ignoreRaycast;return pts;}
// Decorative particles and sprites never take clicks (a sprite without a camera cannot be ray-tested at all).
function ignoreRaycast(){}
const canPlaySound=()=>audioReady&&!!ctx&&ctx.state==='running'&&!paused;
// Twilight: the sky warms for a while around sunrise and sunset (used by updateAtmosphere).
const TWILIGHT_FOG=new THREE.Color(0xf2a983),TWILIGHT_SKY=new THREE.Color(0xffb489),TWILIGHT_SUN=new THREE.Color(0xff9d5c);
function twilightAmount(night){return Math.max(0,1-Math.abs(night-.42)*2.4);}

const Ambience=(()=>{
 const rnd=seededRandom(20261024);
 // ── Night sky on the inside of the sky dome (radius 700, it follows the camera) ──
 const STAR_RADIUS=660,STARS_PER_LAYER=560;
 const starLayers=[1.6,2.5].map((size,layer)=>{const p=glowPoints(STARS_PER_LAYER,{size,fog:false,attenuate:false,vertexColors:true});p.name='night-stars';const pos=p.geometry.attributes.position,col=p.geometry.attributes.color;
  for(let i=0;i<pos.count;i++){const up=.03+rnd()*.97,ring=Math.sqrt(1-up*up),a=rnd()*TAU,tint=rnd(),light=(.45+rnd()*.55)*(layer?1:.8);pos.setXYZ(i,Math.cos(a)*ring*STAR_RADIUS,up*STAR_RADIUS,Math.sin(a)*ring*STAR_RADIUS);
   if(tint<.15)col.setXYZ(i,light,light*.86,light*.7);else if(tint<.35)col.setXYZ(i,light*.75,light*.86,light);else col.setXYZ(i,light,light,light);}
  sky.add(p);return p;});
 const moonTex=texCanvas(256,256,g=>{const gr=g.createRadialGradient(128,128,18,128,128,128);gr.addColorStop(0,'rgba(255,248,226,.5)');gr.addColorStop(.32,'rgba(214,228,255,.16)');gr.addColorStop(1,'rgba(200,220,255,0)');g.fillStyle=gr;g.fillRect(0,0,256,256);
  g.fillStyle='#fbf5e2';g.beginPath();g.arc(128,128,30,0,TAU);g.fill();g.fillStyle='rgba(160,160,150,.32)';for(const [x,yy,r] of [[118,120,7],[138,133,5],[126,143,4],[140,115,4],[113,136,3]]){g.beginPath();g.arc(x,yy,r,0,TAU);g.fill();}});
 const moon=new THREE.Sprite(new THREE.SpriteMaterial({map:moonTex,transparent:true,opacity:0,fog:false,depthWrite:false}));moon.name='night-moon';moon.raycast=ignoreRaycast;moon.scale.setScalar(190);moon.position.set(-.45,.6,-.66).normalize().multiplyScalar(640);moon.visible=false;sky.add(moon);

 // ── Lit windows: the shared tower glass gets an emissive map that only glows after dark ──
 const litTex=texCanvas(128,256,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);const shades=['#ffd27a','#ffe7b0','#fff3d6','#b9dcff'];for(let r=0;r<16;r++)for(let c=0;c<6;c++)if(rnd()<.36){g.globalAlpha=.55+rnd()*.45;g.fillStyle=shades[Math.floor(rnd()*shades.length)];g.fillRect(c*w/6+3,r*h/16+2,w/6-6,h/16-4);}g.globalAlpha=1;});
 glass.emissiveMap=litTex;glass.emissive.setRGB(0,0,0);glass.needsUpdate=true;

 // ── Fireflies drift around the visitor on night meadows ──
 const FLY_COUNT=110,FLY_RANGE=34;const flies=glowPoints(FLY_COUNT,{size:.45,vertexColors:true});flies.name='fireflies';flies.material.opacity=1;scene.add(flies);
 const fly=Array.from({length:FLY_COUNT},()=>({x:(rnd()-.5)*2*FLY_RANGE,z:(rnd()-.5)*2*FLY_RANGE,h:.5+rnd()*2.2,ph:rnd()*TAU,sp:.4+rnd()*.7}));
 function updateFlies(on){flies.visible=on;if(!on)return;const p=player.position,pos=flies.geometry.attributes.position,col=flies.geometry.attributes.color,R=FLY_RANGE;
  fly.forEach((f,i)=>{if(f.x-p.x>R)f.x-=2*R;else if(f.x-p.x<-R)f.x+=2*R;if(f.z-p.z>R)f.z-=2*R;else if(f.z-p.z<-R)f.z+=2*R;const t=worldTime*f.sp+f.ph,x=f.x+Math.sin(t*.9)*1.6,z=f.z+Math.cos(t*.7)*1.6;
   pos.setXYZ(i,x,terrainY(x,z)+f.h+Math.sin(t*1.7)*.35,z);const blink=Math.max(0,Math.sin(t*2.3))**3*nightLevel;col.setXYZ(i,.85*blink,blink,.45*blink);});pos.needsUpdate=col.needsUpdate=true;}

 // ── Snow falls around the winter house, never through its roof ──
 const SNOW_COUNT=650,SNOW_W=56,SNOW_D=50,SNOW_H=20,{LODGE}=globalThis.VillageAdventure,lodgeFloor=Lodge.parts.y;
 const snow=glowPoints(SNOW_COUNT,{size:.17,additive:false});snow.name='lodge-snow';snow.material.opacity=.9;scene.add(snow);
 const flakes=Array.from({length:SNOW_COUNT},()=>({x:LODGE.x+(rnd()-.5)*SNOW_W,z:LODGE.z+(rnd()-.5)*SNOW_D,y:rnd()*SNOW_H,v:.7+rnd()*.9,ph:rnd()*TAU}));
 const underRoof=(x,z,yy)=>Math.abs(x-LODGE.x)<12.8&&z>133.6&&z<156.4&&yy<lodgeFloor+5.6+(12.6-Math.abs(x-LODGE.x))*.27;
 function updateSnow(dt,on){snow.visible=on;if(!on)return;const pos=snow.geometry.attributes.position;
  flakes.forEach((f,i)=>{f.y-=f.v*dt;const x=f.x+Math.sin(worldTime*.6+f.ph)*.7,z=f.z+Math.cos(worldTime*.45+f.ph)*.5,ground=terrainY(x,z);if(f.y<0||underRoof(x,z,ground+f.y))f.y=SNOW_H*(.85+rnd()*.15);pos.setXYZ(i,x,ground+f.y,z);});pos.needsUpdate=true;}

 // ── Footsteps follow the ground under the visitor ──
 const PATH_SAMPLES=[];for(const [c,w] of [[curve,4.3],[sideCurve,2.2]])for(let i=0;i<=160;i++){const q=c.getPoint(i/160);PATH_SAMPLES.push([q.x,q.z,(w/2+.25)**2]);}
 const onPath=(x,z)=>(Math.abs(x)<1.7&&z>84&&z<134.5)||PATH_SAMPLES.some(([px,pz,r2])=>(x-px)**2+(z-pz)**2<r2);
 const METAL_TAGS=new Set(['car','cardoor','rail','shaft','bridge']),WOOD_TAGS=new Set(['lodge','community','bench','workshop','shelf']);
 function groundKind(){const p=player.position,room=currentRoom(p);if(room?.id==='winter-house')return 'wood';if(inCar(p))return 'metal';if(room)return room.interior?'tile':'stone';
  surfaceHeight(p.x,p.z,p.y+.1);if(support)return METAL_TAGS.has(support.tag)?'metal':WOOD_TAGS.has(support.tag)?'wood':'stone';return onPath(p.x,p.z)?'stone':'grass';}
 const STEP_SOUNDS={
  grass:(t,k)=>{noiseBurst(t,.11,{type:'bandpass',f:2200+Math.random()*900,q:.7,gain:.045*k});noiseBurst(t,.06,{type:'lowpass',f:320,gain:.05*k});},
  stone:(t,k)=>{noiseBurst(t,.045,{type:'bandpass',f:3000+Math.random()*500,q:1.3,gain:.07*k});tone(t,150,.06,{gain:.045*k,f2:95});},
  tile:(t,k)=>{noiseBurst(t,.04,{type:'bandpass',f:4200,q:1.6,gain:.06*k});tone(t,210,.05,{gain:.035*k,f2:140});},
  wood:(t,k)=>{tone(t,185+Math.random()*30,.1,{gain:.08*k,f2:118});noiseBurst(t,.05,{type:'lowpass',f:1100,gain:.06*k});},
  metal:(t,k)=>{tone(t,820,.14,{type:'triangle',gain:.03*k});tone(t,1240,.1,{gain:.018*k});noiseBurst(t,.04,{type:'highpass',f:2500,gain:.035*k});}};
 let stepIndex=0,wasGrounded=true,airTime=0,stepsPlayed=0;
 function footsteps(dt){if(!started||motion.sitting||shatter){wasGrounded=grounded;return;}if(!grounded){airTime+=dt;wasGrounded=false;return;}
  const landed=!wasGrounded&&airTime>.25,step=Math.floor(walkPhase/Math.PI),moving=motion.speed>.05&&!motion.gliding&&rolling<=0;wasGrounded=true;airTime=0;
  if((landed||moving&&step!==stepIndex)&&canPlaySound()){STEP_SOUNDS[groundKind()](ctx.currentTime,landed?1.6:motion.dashing?1.25:1);stepsPlayed++;}
  stepIndex=step;}

 // ── Night voices: crickets in pairs of chirps and a far-off owl ──
 let cricketAt=0,owlAt=0;
 function panned(pan){const node=ctx.createStereoPanner();node.pan.value=pan;node.connect(ambient);setTimeout(()=>node.disconnect(),2500);return node;}
 function nightSounds(outdoors){if(!canPlaySound()||!outdoors||nightLevel<.35)return;const t=ctx.currentTime;
  if(t>cricketAt){cricketAt=t+.18+Math.random()*.8;const f=3900+Math.random()*900,g=.011*nightLevel,dest=panned(Math.random()*1.6-.8);for(let k=0;k<3;k++)tone(t+.02+k*.048,f,.03,{gain:g,dest});}
  if(t>owlAt){const first=owlAt===0;owlAt=t+28+Math.random()*30;if(first)return;const dest=panned(Math.random()*1.2-.6);tone(t+.05,392,.42,{gain:.022,f2:372,dest});tone(t+.62,392,.75,{gain:.02,f2:360,dest});}}

 // ── A soft click for interface buttons (not for the movement buttons) ──
 document.addEventListener('pointerdown',e=>{const b=e.target.closest?.('button');if(!b||b.closest('.actions')||b.classList.contains('action')||b.id==='dash'||!canPlaySound())return;const t=ctx.currentTime;tone(t,1900,.025,{type:'triangle',gain:.03});tone(t+.012,2600,.02,{gain:.016});},true);

 function tick(dt){if(paused)return;const p=player.position,cam=camera.position,camOutside=!currentRoom(cam)&&cam.y>-3,outdoors=started&&!currentRoom(p)&&p.y>-3&&!inCar(p);
  const starAlpha=clamp((nightLevel-.25)/.55,0,1);starLayers.forEach((l,i)=>{l.visible=starAlpha>0;l.material.opacity=starAlpha*(.78+.22*Math.sin(worldTime*(1.1+i*.8)+i*2));});moon.visible=starAlpha>0;moon.material.opacity=starAlpha;
  glass.emissive.setScalar(clamp((nightLevel-.15)/.6,0,1)*.9);
  updateFlies(outdoors&&nightLevel>.3);updateSnow(Math.min(dt,.05),camOutside&&Math.hypot(cam.x-LODGE.x,cam.z-LODGE.z)<95&&!Weather.covers());footsteps(dt);nightSounds(outdoors);}
 return {tick,inspect:()=>({night:Math.round(nightLevel*100)/100,stars:starLayers[0].visible,starOpacity:Math.round(starLayers[0].material.opacity*100)/100,moon:moon.visible,windowGlow:Math.round(glass.emissive.r*100)/100,fireflies:flies.visible,snow:snow.visible,ground:started?groundKind():null,stepsPlayed})};
})();
