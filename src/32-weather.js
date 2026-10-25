// ─── Weather: snow over the whole map (late October), the real weather in Seoul, and a white button in the winter house ──
// Snow is on by default. The white button by the winter-house door turns it off and on again (remembered on this device);
// while it is off the sky follows the current weather in Seoul from Open-Meteo: rain when it rains, snow when it snows.
// Flakes move entirely on the GPU in a box that follows the camera, and never fall indoors or through the house roof.
function weatherKind(code){if([71,73,75,77,85,86].includes(code))return 'snow';if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code))return 'rain';if(code===45||code===48)return 'fog';if(code===3)return 'overcast';if(code===1||code===2)return 'clouds';return 'clear';}
const WEATHER_WORDS={snow:'눈',rain:'비',fog:'안개',overcast:'흐림',clouds:'구름 조금',clear:'맑음'};
// What falls from the sky: forced snow while the button is on, otherwise whatever the real weather brings.
function precipitationFor(snowOn,real){if(snowOn)return {kind:'snow',amount:real?.kind==='snow'?1.25:1};if(real?.kind==='snow')return {kind:'snow',amount:[75,86].includes(real.code)?1.2:.75};
 if(real?.kind==='rain')return {kind:'rain',amount:[65,67,82,95,96,99].includes(real.code)?1.2:[51,53,56].includes(real.code)?.45:.8};return {kind:'none',amount:0};}
const Weather=(()=>{
 const SNOW_KEY='apt200x-snow',FLAKES=6000,BOX=new THREE.Vector3(70,32,70),FADE_SECONDS=2.5;
 const WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=weather_code,temperature_2m&timezone=Asia%2FSeoul',WEATHER_REFRESH_MS=30*60*1000,WEATHER_TIMEOUT_MS=8000;
 let snowOn=true;try{const saved=JSON.parse(localStorage.getItem(SNOW_KEY)||'null');if(saved?.v===1&&typeof saved.on==='boolean')snowOn=saved.on;}catch{}
 const real={kind:null,code:null,temp:null,at:0,error:null};

 // ── Particles: seeds in [0,1)³, wrapped around the camera in the vertex shader ──
 const rnd=seededRandom(1031),seeds=new Float32Array(FLAKES*3),meta=new Float32Array(FLAKES*3);
 for(let i=0;i<FLAKES;i++){seeds.set([rnd(),rnd(),rnd()],i*3);meta.set([.7+rnd()*.6,rnd(),.6+rnd()*.8],i*3);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(seeds,3));geo.setAttribute('aMeta',new THREE.BufferAttribute(meta,3));
 const L=globalThis.VillageAdventure.LODGE,floor=Lodge.parts.y;
 const uniforms={uTime:{value:0},uCenter:{value:new THREE.Vector3()},uBox:{value:BOX},uScale:{value:600},uRain:{value:0},uAmount:{value:0},uLight:{value:1},
  uRoomMin:{value:new THREE.Vector3(L.x-L.halfW-.9,floor-1,L.z-L.halfD-.9)},uRoomMax:{value:new THREE.Vector3(L.x+L.halfW+.9,floor+10.6,L.z+L.halfD+.9)}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
  vertexShader:`attribute vec3 aMeta;uniform float uTime,uScale,uRain,uAmount;uniform vec3 uCenter,uBox,uRoomMin,uRoomMax;varying float vAlpha;
   void main(){float sway=1.0-uRain,fall=mix(1.15,15.0,uRain)*aMeta.x,ph=aMeta.y*6.2832;
    vec3 drift=vec3(sin(uTime*.6+ph)*.8*sway+uTime*mix(.35,1.6,uRain),-uTime*fall,cos(uTime*.45+ph)*.55*sway);
    vec3 origin=uCenter-uBox*vec3(.5,.3,.5),p=origin+mod(position*uBox+drift-origin,uBox);
    float inside=step(uRoomMin.x,p.x)*step(p.x,uRoomMax.x)*step(uRoomMin.y,p.y)*step(p.y,uRoomMax.y)*step(uRoomMin.z,p.z)*step(p.z,uRoomMax.z);
    float shown=step(aMeta.y,uAmount*.8)*(1.0-inside);
    vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;float dist=max(-mv.z,.3);
    gl_PointSize=shown*clamp(mix(.09,.16,uRain)*aMeta.z*uScale/dist,1.0,mix(22.0,40.0,uRain));
    vAlpha=shown*(1.0-smoothstep(uBox.x*.32,uBox.x*.5,length(p.xz-uCenter.xz)))*smoothstep(.2,1.5,dist);}`,
  fragmentShader:`uniform float uRain,uLight;varying float vAlpha;
   void main(){vec2 c=gl_PointCoord-.5;float flake=smoothstep(.5,.12,length(c)),streak=smoothstep(.09,.0,abs(c.x))*smoothstep(.5,.2,abs(c.y));
    float a=mix(flake*.85,streak*.42,uRain)*vAlpha;if(a<.01)discard;gl_FragColor=vec4(mix(vec3(.96,.98,1.0),vec3(.72,.8,.9),uRain)*uLight,a);}`});
 const points=new THREE.Points(geo,material);points.name='weather';points.frustumCulled=false;points.raycast=ignoreRaycast;points.renderOrder=2;scene.add(points);

 // ── The white button: a round push button on a small plate beside the door, inside the house ──
 const P=Lodge.parts,button=new THREE.Group();button.position.set(3.35,floor+1.45,135.29);P.root.add(button);
 const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=96;const labelTex=new THREE.CanvasTexture(labelCanvas);labelTex.colorSpace=THREE.SRGBColorSpace;
 box(0,0,0,.42,.62,.04,P.trim,button);const plate=mesh(new THREE.PlaneGeometry(.38,.14),phong(0xffffff,{map:labelTex,shininess:10}),0,.19,.022,button);plate.name='snow-label';
 const knob=mesh(new THREE.CylinderGeometry(.1,.11,.07,28),phong(0xf7f7f2,{shininess:120,emissive:0x8fb8d8,emissiveIntensity:0}),0,-.06,.05,button);knob.rotation.x=Math.PI/2;knob.name='snow-button';
 let press=0;
 function drawLabel(){const g=labelCanvas.getContext('2d');g.fillStyle='#f4efe4';g.fillRect(0,0,256,96);g.fillStyle='#3a2a20';g.textAlign='center';g.font='bold 34px sans-serif';g.fillText('❄ 눈 '+(snowOn?'ON':'OFF'),128,42);
  g.font='20px sans-serif';g.fillStyle='#6b5a4a';g.fillText(real.kind?'서울 '+WEATHER_WORDS[real.kind]+(Number.isFinite(real.temp)?' · '+Math.round(real.temp)+'°C':''):'실제 날씨 확인 중',128,78);labelTex.needsUpdate=true;}
 function describeReal(){return real.kind?'서울의 지금 날씨('+WEATHER_WORDS[real.kind]+(Number.isFinite(real.temp)?' · '+Math.round(real.temp)+'°C':'')+')':'실제 날씨(아직 불러오는 중)';}
 function setSnow(on){snowOn=on;try{localStorage.setItem(SNOW_KEY,JSON.stringify({v:1,on}));}catch{}drawLabel();thing.verb=on?'눈 그치게 하기':'눈 다시 내리기';}
 const thing=defineThing({id:'weather-snow',name:'하얀 눈 버튼',root:button,printParent:button,anchor:()=>new THREE.Vector3(3.35,floor+1.45,135.6),reach:2.8,verb:'눈 그치게 하기',
  touch(){setSnow(!snowOn);press=1;clickSound();toast(snowOn?'맵 전체에 다시 눈이 내립니다. (실내에는 내리지 않습니다)':'눈을 껐습니다. 이제 '+describeReal()+'를 따릅니다. 하얀 버튼을 다시 누르면 눈이 내립니다.');return null;}});
 setSnow(snowOn);
 function clickSound(){if(!canPlaySound())return;const t=ctx.currentTime;tone(t,1400,.04,{type:'square',gain:.025});noiseBurst(t,.05,{type:'highpass',f:2500,gain:.05});tone(t+.06,900,.05,{type:'triangle',gain:.02});}

 // ── Real weather in Seoul, refreshed every half hour (failures keep the last reading and are retried later) ──
 async function refreshWeather(){try{const r=await fetch(WEATHER_URL,{signal:AbortSignal.timeout(WEATHER_TIMEOUT_MS)});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json(),code=Number(data?.current?.weather_code);
   if(!Number.isFinite(code))throw new Error('no weather code');real.code=code;real.kind=weatherKind(code);real.temp=Number(data.current.temperature_2m);real.at=Date.now();real.error=null;}
  catch(e){real.error=e?.message||String(e);console.warn('[APT200X] weather',real.error);}drawLabel();}
 refreshWeather();setInterval(refreshWeather,WEATHER_REFRESH_MS);

 // ── Per frame: follow the camera, fade between snow / rain / nothing, hide underground and in other rooms ──
 let shownAmount=0,shownRain=0;
 function tick(dt){press=Math.max(0,press-dt*4);knob.position.z=.05-press*.03;knob.material.emissiveIntensity=snowOn?.35:0;if(paused)return;
  const cam=camera.position,room=currentRoom(cam),open=started&&cam.y>-3&&(!room||room.id==='winter-house')&&!(inCar(player.position)&&car.y<-1.5),want=precipitationFor(snowOn,real);
  const k=Math.min(1,dt/FADE_SECONDS*3);shownAmount+=((open?want.amount:0)-shownAmount)*k;if(want.kind!=='none')shownRain+=((want.kind==='rain'?1:0)-shownRain)*k;
  points.visible=shownAmount>.01;if(!points.visible)return;uniforms.uTime.value=worldTime;uniforms.uCenter.value.copy(cam);uniforms.uAmount.value=Math.min(1.25,shownAmount);uniforms.uRain.value=shownRain;
  uniforms.uScale.value=renderer.domElement.height/(2*Math.tan(camera.fov*Math.PI/360));uniforms.uLight.value=1-nightLevel*.45;}
 return {tick,covers:()=>shownAmount>.5&&shownRain<.5,setSnow,refresh:refreshWeather,inspect:()=>({snowOn,real:{...real},falling:precipitationFor(snowOn,real),shown:Math.round(shownAmount*100)/100,rain:Math.round(shownRain*100)/100,visible:points.visible})};
})();
