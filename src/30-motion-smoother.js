// ─── Motion smoothing for shared characters ──────────────────────────────────────────────
// Residents, creatures and other visitors arrive as snapshots (every 0.1 s for the static host,
// 0.3 s from the Node server, up to ~0.9 s for other static visitors). Chasing each snapshot made
// them lurch. Each character is now drawn a little in the past and interpolated between the
// snapshots it actually received; legs follow the distance really travelled.
// v4.8: when a state says *when* its positions were simulated (sampleAt, on the sender's clock), samples sit on that
// clock instead of on their arrival time, so relay jitter and late frames no longer turn into speed-ups and stalls.
const MotionSmoother=(()=>{
 const tracks=new Map(),MAX_SAMPLES=24,SNAP_DISTANCE=8,IDLE_ANCHOR=1.5,EXTRAPOLATE=.25,STRIDE_RADIANS_PER_M=1.7,FORGET_SECONDS=60;
 const angleTo=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
 const delayOf=tr=>clamp(tr.gap*1.25+.03,.08,1.3);
 // ── Sender clock: the lowest (arrival − simulated) seen recently is the network floor; lateness above it is jitter ──
 const CLOCK_WINDOW=6,CLOCK_JUMP=1,LAG_MIN=.08,LAG_MAX=1.3,SLOW_DOWN=.25,SPEED_UP=.05;
 const sender={at:null,gap:.1,seen:[],want:null,lag:null,renderT:null};
 function observe(at){const t=performance.now()/1000,obs=t-at/1000;
  if(sender.at!==null){const gap=(at-sender.at)/1000;if(gap>0&&gap<2)sender.gap+=(gap-sender.gap)*.25;}
  sender.at=at;sender.seen.push([t,obs]);while(sender.seen.length&&t-sender.seen[0][0]>CLOCK_WINDOW)sender.seen.shift();
  // A host with a different clock took over: every recent arrival is a second "late". Start the window again.
  const recent=sender.seen.slice(-5),floor=Math.min(...sender.seen.map(s=>s[1]));if(recent.length===5&&recent.every(s=>s[1]-floor>CLOCK_JUMP))sender.seen=recent;
  const base=Math.min(...sender.seen.map(s=>s[1])),late=sender.seen.map(s=>s[1]-base).sort((a,b)=>a-b)[Math.floor((sender.seen.length-1)*.9)];
  sender.want=base+clamp(sender.gap+late+.03,LAG_MIN,LAG_MAX);if(sender.lag===null||Math.abs(sender.want-sender.lag)>CLOCK_JUMP)sender.lag=sender.want;}
 // Once per frame: take the newest sampleAt and ease the playback lag toward what the jitter needs (slowing is invisible, rushing is not).
 function frame(dt,at){if(!Number.isFinite(at)){sender.renderT=null;return;}if(at!==sender.at)observe(at);const d=sender.want-sender.lag,step=Math.max(dt,0);
  sender.lag+=clamp(d,-SPEED_UP*step,SLOW_DOWN*step);sender.renderT=performance.now()/1000-sender.lag;}
 function snapped(tr,s){const last=tr.samples.at(-1);if(Math.hypot(s.x-last.x,s.z-last.z)>SNAP_DISTANCE||Math.abs(s.y-last.y)>6){tr.samples=[s];tr.snap=true;return true;}return false;}
 function push(tr,s){const S=tr.samples,last=S.at(-1);if(snapped(tr,s))return;
  const changed=Math.abs(s.x-last.x)+Math.abs(s.y-last.y)+Math.abs(s.z-last.z)>1e-3||(s.h!==null&&last.h!==null&&Math.abs(angleTo(last.h,s.h))>1e-3);
  // A change right after standing still starts from a fresh hold point; a change after a change measures the cadence.
  if(!changed){if(s.t-last.t>IDLE_ANCHOR)S.push({...s,moved:false});}
  else{const gap=s.t-last.t;if(!last.moved){if(s.t-tr.gap>last.t)S.push({...last,t:s.t-tr.gap,moved:false});}else tr.gap+=(clamp(gap,.05,1.2)-tr.gap)*.35;S.push({...s,moved:true});}
  while(S.length>MAX_SAMPLES)S.shift();}
 // Clocked samples are kept as they come, standing still included: their timestamps already say how fast things moved.
 function pushClocked(tr,s){const last=tr.samples.at(-1);if(s.t<=last.t){if(s.t<last.t-.5){tr.samples=[s];tr.snap=true;}return;}if(snapped(tr,s))return;tr.samples.push(s);while(tr.samples.length>MAX_SAMPLES)tr.samples.shift();}
 function sampleAt(S,rt){if(S.length===1||rt<=S[0].t)return S[0];
  if(rt>=S.at(-1).t){const a=S.at(-2),b=S.at(-1),span=Math.max(.05,b.t-a.t),k=Math.min(rt-b.t,EXTRAPOLATE)/span;return {x:b.x+(b.x-a.x)*k,y:b.y+(b.y-a.y)*k,z:b.z+(b.z-a.z)*k,h:b.h};}
  let i=0;while(i<S.length-2&&S[i+1].t<rt)i++;const a=S[i],b=S[i+1],k=(rt-a.t)/Math.max(1e-4,b.t-a.t);
  return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,z:a.z+(b.z-a.z)*k,h:a.h===null||b.h===null?(b.h??a.h):a.h+angleTo(a.h,b.h)*k};}
 // Reads the entity's latest network values, records them when they change, and returns where to draw it now.
 // `simulatedAt` (ms on the sender's clock) is optional; without it samples are timed by their arrival as before.
 function at(key,e,dt,heading=null,simulatedAt){const t=performance.now()/1000,h=Number.isFinite(e.h)?e.h:heading,gen=e.generation??0,clocked=Number.isFinite(simulatedAt)&&sender.renderT!==null;let tr=tracks.get(key);
  const s={t:clocked?simulatedAt/1000:t,x:e.x,y:e.y,z:e.z,h};
  if(!tr||tr.gen!==gen||tr.clocked!==clocked){const keep=tr&&tr.gen===gen?{x:tr.x,y:tr.y,z:tr.z,h:tr.h,phase:tr.phase}:{};tr={samples:[s],gen,clocked,gap:.3,x:e.x,y:e.y,z:e.z,h:h??0,speed:0,phase:0,walking:false,seen:t,snap:false,...keep};tracks.set(key,tr);}
  else if(clocked)pushClocked(tr,s);else push(tr,s);
  tr.seen=t;const p=sampleAt(tr.samples,clocked?sender.renderT:t-delayOf(tr)),hh=p.h;
  // A light final filter hides small corrections when an extrapolated guess meets the next snapshot.
  const f=tr.snap?1:1-Math.exp(-22*Math.max(dt,1e-3)),px=tr.x,pz=tr.z;tr.snap=false;tr.x+=(p.x-tr.x)*f;tr.y+=(p.y-tr.y)*f;tr.z+=(p.z-tr.z)*f;
  const moved=Math.hypot(tr.x-px,tr.z-pz),dtSafe=Math.max(dt,1e-3);tr.speed+=(moved/dtSafe-tr.speed)*Math.min(1,dtSafe*10);tr.phase+=moved*STRIDE_RADIANS_PER_M;tr.walking=tr.speed>.25;
  const want=hh??(moved>.004?Math.atan2(tr.x-px,tr.z-pz):tr.h);tr.h+=angleTo(tr.h,want)*Math.min(1,dtSafe*12);
  return tr;}
 function sweep(){const t=performance.now()/1000;for(const [k,tr]of tracks)if(t-tr.seen>FORGET_SECONDS)tracks.delete(k);}
 setInterval(sweep,20000);
 return {at,frame,forget:key=>tracks.delete(key),inspect:()=>({tracks:tracks.size,lag:sender.lag===null?null:Math.round(sender.lag*1000)+'ms',cadence:Math.round(sender.gap*1000)+'ms',delays:[...tracks.entries()].slice(0,6).map(([k,tr])=>[k,tr.clocked?'clock':Math.round(delayOf(tr)*1000)+'ms',tr.samples.length])})};
})();
