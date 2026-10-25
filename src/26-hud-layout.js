// ─── Final HUD layout: status lines flow under the location card instead of sitting at fixed offsets ──
// Earlier versions placed each new line at its own pixel position, so lines collided as the HUD grew.
const HudLayout=(()=>{
 const card=document.querySelector('#hud .location');
 if(card)for(const el of [$('anomalyIndicator'),document.querySelector('.village-line'),$('worldClock')])if(el)card.append(el);
 // Context prompts ("touch", "enter", "call") come from different modules with their own fixed offsets.
 // On small screens they landed on top of the toggle row and each other, so each visible prompt is lifted
 // just above whatever it would cover. Prompts only ever move up, never sideways.
 const PROMPTS=['#interact','#workshopNearby','.explore-action','.chrome-pickup','.elevator-call','.lodge-open','.building-entry'];
 const CONTROLS=['#gardenToggle','.resident-toggle','#workshopToggle','#dash','#roll','#jump','.joystick-wrap'];
 const GAP=8,MAX_LIFTS=6;
 const shown=el=>{if(!el||el.hidden)return false;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden')return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 const hits=(a,b)=>a.left<b.right+GAP&&b.left<a.right+GAP&&a.top<b.bottom+GAP&&b.top<a.bottom+GAP;
 let placed=[];
 function lift(el,blockers){for(let i=0;i<MAX_LIFTS;i++){const r=el.getBoundingClientRect(),b=blockers.find(o=>hits(r,o));if(!b)return r;el.style.bottom=Math.round(innerHeight-b.top+GAP)+'px';}return el.getBoundingClientRect();}
 function tick(){const prompts=PROMPTS.flatMap(q=>[...document.querySelectorAll(q)]);for(const el of prompts)el.style.bottom='';
  const blockers=CONTROLS.flatMap(q=>[...document.querySelectorAll(q)]).filter(shown).map(e=>e.getBoundingClientRect());placed=[];
  for(const el of prompts){if(!shown(el))continue;const r=lift(el,blockers);blockers.push(r);placed.push(r);}}
 function overlaps(){for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){const a=placed[i],b=placed[j];if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)return true;}return false;}
 return {tick,inspect:()=>{const boxes=[...(card?.children||[])].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect()),map=document.querySelector('#hud .minimap')?.getBoundingClientRect(),inner=[...(card?.querySelectorAll('*')||[])].filter(e=>e.offsetParent&&e.textContent.trim()).map(e=>e.getBoundingClientRect());
  return {lines:boxes.length,overlaps:boxes.some((b,i)=>i>0&&b.top<boxes[i-1].bottom-.5),clearOfMap:!map||inner.every(b=>b.right<=map.left||b.top>=map.bottom||b.bottom<=map.top),prompts:placed.length,promptOverlaps:overlaps()};}};
})();
