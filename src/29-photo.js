// ─── Camera tools: first-person view (V) and photo mode (P) ──────────────────────────────
// First person puts the camera at eye height so the visitor can look straight up at the sky.
const ViewModeButton=(()=>{const b=document.createElement('button');b.className='tool';b.id='viewMode';b.setAttribute('aria-label','1인칭 시점');b.title='1인칭 시점 (V)';b.setAttribute('aria-pressed','false');
 b.innerHTML='<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';document.querySelector('.toolbar')?.prepend(b);
 const toggle=()=>{if(!started)return;setFirstPerson(!view.firstPerson);toast(view.firstPerson?'1인칭 시점 · 드래그로 하늘까지 올려다볼 수 있습니다. V로 돌아갑니다.':'3인칭 시점');};b.onclick=toggle;
 addEventListener('keydown',e=>{if(e.code==='KeyV'&&!e.repeat&&started&&!paused&&!e.target.closest?.('input,select,textarea')){toggle();e.preventDefault();}});return {toggle};})();
// ─── Photo mode: hide the interface, pick a look, keep the moment as a PNG ──────────────
// The camera still follows the visitor, so the view can be framed by dragging or walking.
const PhotoMode=(()=>{
 const FILTERS=[{name:'원본',css:'none'},{name:'필름',css:'sepia(.22) saturate(1.18) contrast(1.06) brightness(1.03)'},{name:'에어로',css:'saturate(1.35) hue-rotate(-8deg) brightness(1.06)'},{name:'노을',css:'sepia(.35) saturate(1.4) hue-rotate(-18deg) contrast(1.04)'},{name:'흑백',css:'grayscale(1) contrast(1.12)'}];
 let on=false,filter=0,shots=0;
 const btn=document.createElement('button');btn.className='tool';btn.id='photo';btn.setAttribute('aria-label','사진 모드');btn.title='사진 모드 (P)';btn.setAttribute('aria-pressed','false');
 btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>';document.querySelector('.toolbar')?.prepend(btn);
 const bar=document.createElement('div');bar.className='photo-bar';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','사진 모드');
 bar.innerHTML='<small>PHOTO MODE · 드래그로 구도 잡기</small><div class="photo-filters"></div><button class="photo-shoot">사진 저장</button><button class="photo-exit">닫기 · P</button>';document.body.append(bar);
 const filterRow=bar.querySelector('.photo-filters');FILTERS.forEach((f,i)=>{const b=document.createElement('button');b.textContent=f.name;b.onclick=()=>setFilter(i);filterRow.append(b);});
 function setFilter(i){filter=i;const css=FILTERS[i].css;$('world').style.filter=on&&css!=='none'?css:'';[...filterRow.children].forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));}
 function toggle(force){const next=force??!on;if(next&&(!started||paused))return;on=next;document.body.classList.toggle('photo-mode',on);bar.hidden=!on;btn.setAttribute('aria-pressed',String(on));setFilter(filter);resetInputs();}
 const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());};
 // Copy the frame in the same task as the render (the WebGL buffer is cleared afterwards), then save it.
 function shoot(){renderer.render(scene,camera);const src=renderer.domElement,out=document.createElement('canvas');out.width=src.width;out.height=src.height;const g=out.getContext('2d');const css=FILTERS[filter].css;if(css!=='none'&&'filter' in g)g.filter=css;g.drawImage(src,0,0);
  out.toBlob(blob=>{if(!blob){toast('이 브라우저에서는 사진을 저장할 수 없습니다.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='APT200X-'+stamp()+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);shots++;toast('사진을 저장했습니다.');},'image/png');
  const flash=$('flash');flash.className='';void flash.offsetWidth;flash.className='on white';
  if(canPlaySound()){const t=ctx.currentTime;noiseBurst(t,.06,{type:'highpass',f:3000,gain:.22});tone(t+.05,1400,.03,{type:'square',gain:.05});noiseBurst(t+.09,.05,{type:'bandpass',f:1800,gain:.12});}}
 btn.onclick=()=>toggle();bar.querySelector('.photo-exit').onclick=()=>toggle(false);bar.querySelector('.photo-shoot').onclick=shoot;
 addEventListener('keydown',e=>{if(e.target.closest?.('input,select,textarea'))return;if(e.code==='KeyP'&&!e.repeat&&started){toggle();e.preventDefault();}
  else if(on&&e.code==='Escape'){toggle(false);e.preventDefault();e.stopImmediatePropagation();}},true);
 return {toggle,shoot,inspect:()=>({on,filter:FILTERS[filter].name,shots,canvasFilter:$('world').style.filter||'none'})};
})();
