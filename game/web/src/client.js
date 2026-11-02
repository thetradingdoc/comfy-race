import './style.css';
import { RaceWorld } from './world.js';
import './comfy.js';

const $=id=>document.getElementById(id);
const cities={nairobi:{name:'Nairobi',mission:'Midnight delivery',brief:'Collect the relay parcel. Carry it through the city. Deliver first.'},tokyo:{name:'Tokyo',mission:'Neon relay',brief:'The relay is live. Chase the checkpoints and finish ahead of your crew.'},'new-york':{name:'New York',mission:'Midnight dispatch',brief:'Take the dispatch across the city circuit. Only the finish settles it.'}};
const colors=['#ff6838','#73e3dd','#d8ed7b','#9c91ff','#f6f3eb'];
const query=new URLSearchParams(location.search);
const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const session={get(k){try{return sessionStorage.getItem(k);}catch{return null;}},set(k,v){try{sessionStorage.setItem(k,v);}catch{}},remove(k){try{sessionStorage.removeItem(k);}catch{}}};
const state={socket:null,playerId:null,room:null,players:[],city:'nairobi',color:storage.get('comfy-color')||colors[0],phone:query.get('controller')==='1',entryMode:'create',screen:'home',sequence:0,keys:new Set(),touch:new Set(),connected:false,joining:false,serverStatus:{},lastFrame:0,resumeCode:null};
let hero=null;
try { hero=new RaceWorld($('race-canvas'));hero.setColor(state.color); } catch(e){ console.warn('Illustrative landing renderer unavailable:',e.message); }

class NativeStage {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.frames=new Map();this.pending=new Set();this.players=[];this.quality='auto';this.active=false;window.addEventListener('resize',()=>this.resize());this.resize();this.draw();}
  resize(){const w=innerWidth,h=innerHeight;const target=this.quality==='4k'?3840/w:this.quality==='1080p'?1920/w:Math.min(devicePixelRatio||1,1.5);const ratio=Math.min(target,Math.sqrt(8_294_400/(w*h)),3);this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);}
  async frame(message){
    const rawId=message.playerId??message.id;if(rawId==null||!message.data||state.phone)return;const id=String(rawId);if(this.pending.has(id))return;
    this.pending.add(id);
    try{let blob;if(message.data instanceof Blob)blob=message.data;else{const text=message.data.includes(',')?message.data.split(',')[1]:message.data;const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));blob=new Blob([bytes],{type:message.mime||'image/jpeg'});}const bitmap=await createImageBitmap(blob);const prior=this.frames.get(id);prior?.bitmap.close();this.frames.set(id,{bitmap,received:performance.now(),width:message.width||bitmap.width,height:message.height||bitmap.height});state.lastFrame=performance.now();}
    catch(e){console.warn('Native camera decode failed:',e.message);}finally{this.pending.delete(id);}
  }
  draw(){requestAnimationFrame(()=>this.draw());if(!this.active||document.hidden)return;const c=this.ctx,w=this.canvas.width,h=this.canvas.height,players=this.players; c.fillStyle='#060910';c.fillRect(0,0,w,h);
    const count=Math.max(1,players.length),cols=count===1?1:2,rows=Math.ceil(count/cols),cw=w/cols,ch=h/rows;
    for(let i=0;i<count;i++){const p=players[i],x=(i%cols)*cw,y=Math.floor(i/cols)*ch,f=p&&this.frames.get(String(p.id));c.save();c.beginPath();c.rect(x,y,cw,ch);c.clip();
      if(f){const scale=Math.min(cw/f.bitmap.width,ch/f.bitmap.height),dw=f.bitmap.width*scale,dh=f.bitmap.height*scale;c.drawImage(f.bitmap,x+(cw-dw)/2,y+(ch-dh)/2,dw,dh);if(performance.now()-f.received>1800){c.fillStyle='#090d18b8';c.fillRect(x,y,cw,ch);this.caption(c,'NATIVE CAMERA STALLED',x+cw/2,y+ch/2,Math.max(12,w/110));}}
      else{this.caption(c,'CONNECTING TO NATIVE CAMERA',x+cw/2,y+ch/2,Math.max(11,w/120));this.caption(c,p?.name||'Waiting for the Matrix engine',x+cw/2,y+ch/2+30,Math.max(9,w/145),'#687b94');}
      c.restore();c.strokeStyle='#a1b1cb26';c.lineWidth=Math.max(1,w/1400);c.strokeRect(x,y,cw,ch);
    }
  }
  caption(c,text,x,y,size,color='#d5deec'){c.fillStyle=color;c.font=`600 ${size}px Arial`;c.textAlign='center';c.fillText(text,x,y);}
  getFrameHealth(){const now=performance.now();const views=this.players.map(p=>{const frame=this.frames.get(String(p.id));return {playerId:p.id,ageMs:frame?Math.max(0,now-frame.received):null};});return {ready:views.length>0&&views.every(v=>v.ageMs!==null&&v.ageMs<1800),views,source:'native-matrix'};}
  setQuality(value){this.quality=value;this.resize();return {width:this.canvas.width,height:this.canvas.height};}
}
const nativeStage=new NativeStage($('native-stage'));
window.comfyRaceGame={canvas:nativeStage.canvas,heroCanvas:$('race-canvas'),getRoom:()=>state.room,getPlayers:()=>state.players,getFrameHealth:()=>nativeStage.getFrameHealth(),setQuality:value=>nativeStage.setQuality(value),source:'native-matrix',setAiStatus(message){$('race-source-label').textContent=message;}};
window.dispatchEvent(new CustomEvent('race-renderer-ready',{detail:window.comfyRaceGame}));

let toastTimer;
function toast(text,duration=4500){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,duration);}
function showScreen(name){
  if(state.screen===name)return;state.screen=name;
  for(const id of ['home','lobby','race','controller','results'])$(id).hidden=id!==name;
  document.body.className=`in-${name}`;
  const racing=name==='race';nativeStage.active=racing;$('native-stage').hidden=!racing;$('race-canvas').hidden=racing||name==='controller';
  if(hero)hero.setMode('home');
  if(name==='controller')document.documentElement.style.overscrollBehavior='none';else document.documentElement.style.overscrollBehavior='';
  window.scrollTo(0,0);
}
function phase(){return state.room?.phase||'lobby';}
function isRacing(){return ['starting','paused','countdown','racing','race','running','active','error'].includes(phase());}
function canDrive(){return ['racing','race','running','active'].includes(phase());}
function isFinished(){return ['finished','complete','results'].includes(phase());}
function me(){return state.players.find(p=>p.id===state.playerId);}
function isHost(){return !!(me()?.isHost||state.room?.hostId===state.playerId);}
function send(message){if(state.socket?.readyState===WebSocket.OPEN){state.socket.send(JSON.stringify(message));return true;}return false;}
let connectPromise=null;
async function connect(){
  if(state.socket?.readyState===WebSocket.OPEN)return state.socket;if(connectPromise)return connectPromise;
  connectPromise=new Promise((resolve,reject)=>{
    const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);state.socket=socket;
    const timeout=setTimeout(()=>{socket.close();reject(Error('The game server did not respond. Check that it is running.'));},10000);
    socket.addEventListener('open',()=>{clearTimeout(timeout);state.connected=true;send({type:'subscribe',video:!state.phone,role:state.phone?'controller':'display'});resolve(socket);});
    socket.addEventListener('message',onMessage);
    socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Cannot connect to the game server.'));});
    socket.addEventListener('close',()=>{clearTimeout(timeout);state.connected=false;connectPromise=null;releaseAll();$('controller-connection').textContent='● DISCONNECTED';$('controller-connection').style.color='#ff987e';$('race-connection').textContent='DISCONNECTED — INPUT RELEASED';if(state.room){toast('Connection lost. Reconnecting to your driver…');setTimeout(reconnect,1500);}});
  }).finally(()=>{connectPromise=null;});return connectPromise;
}
async function reconnect(){if(!state.room||state.connected)return;const code=state.room.code;state.resumeCode=code;const token=session.get(`comfy-token-${code}`);try{await connect();if(token)send({type:'join',code,token,name:storage.get('comfy-name')||'Driver',color:state.color});else send({type:'watch',code});}catch{if(state.room)setTimeout(reconnect,2500);}}
function onMessage(event){
  if(typeof event.data!=='string')return;
  let msg;try{msg=JSON.parse(event.data);}catch{return;}
  if(msg.type==='frame'){nativeStage.frame(msg);return;}
  if(msg.type==='welcome'){state.playerId=msg.playerId;state.resumeCode=null;if(msg.token&&msg.code){session.set(`comfy-token-${msg.code}`,msg.token);session.set('comfy-active-room',JSON.stringify({code:msg.code,phone:state.phone}));}$('entry-dialog').close();state.joining=false;$('entry-submit').disabled=false;return;}
  if(msg.type==='error'){if(state.resumeCode&&['ROOM_NOT_FOUND','INVALID_TOKEN'].includes(msg.code)){const code=state.resumeCode;state.resumeCode=null;session.remove(`comfy-token-${code}`);session.remove('comfy-active-room');state.room=null;state.players=[];state.playerId=null;state.socket?.close();state.socket=null;showScreen('home');openEntry('join',code);$('entry-error').textContent=msg.message||'Your saved race is no longer available.';return;}if(msg.code==='ROOM_CLOSED'){const message=msg.message||'The host ended this room.';leave(false);toast(message);return;}state.joining=false;$('entry-submit').disabled=false;const text=msg.message||msg.error||'The server could not complete that action.';$('entry-error').textContent=text;toast(text);return;}
  if(msg.type==='room'||msg.type==='state'){
    const room=msg.room||msg;if(!room.code)return;const prev=state.room?.phase;state.room=room;state.players=msg.players||room.players||state.players;state.city=room.city||state.city;nativeStage.players=state.players;renderState();
    if(prev!==room.phase){releaseAll();if(room.phase==='countdown'&&state.phone)try{navigator.vibrate?.([80,80,80]);}catch{}}
  }
}
function cityData(){return cities[state.city]||cities.nairobi;}
function maxDrivers(){const configured=Number(state.room?.maxPlayers??state.room?.maxDrivers??state.serverStatus.maxDrivers??state.serverStatus.maxPlayers??state.serverStatus.multiplayer?.maxPlayers??2);return Number.isInteger(configured)?Math.max(2,Math.min(5,configured)):2;}
let lastQr='';
function renderState(){
  if(!state.room)return;const city=cityData(),own=me(),host=isHost();
  if(isFinished())showScreen('results');else if(isRacing())showScreen(state.phone?'controller':'race');else showScreen('lobby');
  $('room-code').textContent=state.room.code;$('player-count').textContent=`${state.players.length} / ${maxDrivers()}`;$('capacity-label').textContent=`${maxDrivers()} DRIVER SLOTS`;
  $('roster').replaceChildren(...state.players.map((p,i)=>{const row=document.createElement('div');row.className='driver-row';const number=document.createElement('span');number.className='driver-number';number.textContent=String(i+1).padStart(2,'0');const swatch=document.createElement('span');swatch.className='car-swatch';swatch.style.background=validColor(p.color);const info=document.createElement('div');info.className='driver-info';const name=document.createElement('strong');name.textContent=`${p.name}${p.id===state.playerId?' (YOU)':''}`;const role=document.createElement('small');role.textContent=p.isHost||p.id===state.room.hostId?'HOST / KEYBOARD OR PHONE':'DRIVER';info.append(name,role);const status=document.createElement('span');status.className=`driver-state ${!p.connected?'offline':p.ready?'ready':''}`;status.textContent=!p.connected?'OFFLINE':p.ready?'● READY':'NOT READY';row.append(number,swatch,info,status);return row;}));
  $('ready-button').hidden=!own;$('ready-button').textContent=own?.ready?'READY ✓ — TAP TO UNREADY':"I'M READY ✓";$('start-button').hidden=!host;
  const connected=state.players.filter(p=>p.connected!==false);const ready=connected.filter(p=>p.ready);$('start-button').disabled=connected.length<2||state.players.some(p=>!p.connected||!p.ready);
  $('lobby-notice').textContent=connected.length<2?'Invite one more human driver to unlock the starting lights.':ready.length<connected.length?`${connected.length-ready.length} driver${connected.length-ready.length===1?' is':'s are'} still getting ready.`:host?'The grid is ready. Start when your crew can see the screen.':'The grid is ready. Waiting for the host to start.';
  $('lobby-subtitle').textContent=state.phone?'Your phone is the controller. The shared screen is your road.':'Your keyboard drives your car. Friends can join on their phones.';
  $('mission-city').textContent=`${city.name.toUpperCase()} / INSPIRED STORY`;$('mission-name').textContent=state.room.mission?.title||state.room.mission?.name||city.mission;$('mission-brief').textContent=state.room.mission?.briefing||city.brief;
  $('race-city').textContent=`${city.name.toUpperCase()} / CITY CHAPTER`;$('race-mission').textContent=city.mission.toUpperCase();
  $('race-time').textContent=formatTime(state.room.elapsedSeconds??state.room.elapsed??0);
  $('live-objective').textContent=own?.objective||own?.missionText||state.room.objective||'Follow the native route. Pass every checkpoint.';
  const countdown=phase()==='countdown',paused=phase()==='paused',starting=phase()==='starting',failed=phase()==='error';$('countdown').hidden=!(countdown||paused||starting||failed);$('countdown-number').textContent=paused?'PAUSED':failed?'STOPPED':starting?'…':Math.max(1,Math.ceil(state.room.countdownRemaining??state.room.countdown??3));$('countdown-label').textContent=paused?'WAITING FOR YOUR CREW':failed?'NATIVE ENGINE NEEDS ATTENTION':starting?'STARTING THE NATIVE ENGINE':'LIGHTS OUT IN';$('pause-reason').hidden=!(paused||failed);$('pause-reason').textContent=state.room.pauseReason||state.room.error||'';$('resume-button').hidden=!(paused&&host);$('resume-button').disabled=connected.length<2||state.players.some(p=>!p.connected||!p.ready);$('pause-ready-button').hidden=!(paused&&own);$('pause-ready-button').textContent=own?.ready?'READY ✓ — TAP TO UNREADY':'READY TO RESUME ✓';$('phone-resume-ready').hidden=!(paused&&own);$('phone-resume-ready').textContent=own?.ready?'READY ✓ — TAP TO UNREADY':'READY TO RESUME ✓';
  renderViewportHud();
  $('controller-name').textContent=own?.name?.toUpperCase()||'YOUR DRIVER';$('controller-connection').textContent=state.connected?'● CONNECTED':'● DISCONNECTED';$('controller-connection').style.color=state.connected?'#a6f3b9':'#ff987e';
  const laps=state.room.laps||state.room.lapCount||1;$('controller-position').replaceChildren(document.createTextNode(String(own?.position??own?.rank??'—')),small(` / ${state.players.length}`));$('controller-lap').replaceChildren(document.createTextNode(String(own?.lap??1)),small(` / ${laps}`));$('controller-speed').textContent=Math.round(speedKmh(own));$('phone-objective').textContent=own?.objective||own?.missionText||'Stay sharp. Chase the lead.';
  $('phone-race-status').textContent=paused?'Race paused. Check the shared screen.':failed?'Native engine stopped. Check the host.':countdown?`Starting in ${$('countdown-number').textContent}…`:own?.finished?'Finished. Waiting for the other drivers.':`Room ${state.room.code} · ${city.name} chapter`;
  $('race-connection').replaceChildren();const dot=document.createElement('i');dot.className='status-dot';if(failed)dot.style.background='#ff806e';$('race-connection').append(dot,document.createTextNode(failed?' NATIVE ENGINE UNAVAILABLE':paused?' NATIVE RACE PAUSED':' NATIVE RACE AUTHORITY CONNECTED'));
  if(isFinished())renderResults();
  const invite=inviteUrl();if(invite!==lastQr){lastQr=invite;renderQr(invite);}
}
function small(text){const s=document.createElement('small');s.textContent=text;return s;}
function speedKmh(p){return p?.speedKmh??Math.abs(p?.speed||0)*3.6;}
function validColor(value){return /^#[0-9a-f]{6}$/i.test(value)?value:'#ff6838';}
function formatTime(seconds){if(!Number.isFinite(Number(seconds)))return '—';const t=Math.max(0,Number(seconds));return `${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;}
let hudKey='';
function renderViewportHud(){
  const count=state.players.length,cols=count===1?1:2,rows=Math.ceil(count/cols),key=state.players.map(p=>p.id).join(',');
  if(key!==hudKey){hudKey=key;$('viewport-labels').replaceChildren(...state.players.map(p=>{const el=document.createElement('div');el.className='viewport-hud';el.dataset.player=p.id;el.innerHTML='<div><div class="viewport-name"><i></i><span></span></div><div class="viewport-stats"><span class="hud-position"></span><span class="hud-lap"></span></div><small class="checkpoint"></small></div><div class="viewport-speed"><span></span><small>KM/H</small></div>';return el;}));}
  state.players.forEach((p,i)=>{const el=$('viewport-labels').children[i];el.style.width=`${100/cols}%`;el.style.left=`${i%cols*100/cols}%`;el.style.bottom=rows===1?'120px':`calc(${(rows-1-Math.floor(i/cols))*100/rows}% + ${Math.floor(i/cols)===rows-1?110:18}px)`;el.querySelector('.viewport-name span').textContent=p.name;el.querySelector('i').style.background=validColor(p.color);el.querySelector('.hud-position').textContent=`POS ${p.position??p.rank??'—'} / ${count}`;el.querySelector('.hud-lap').textContent=`LAP ${p.lap??1} / ${state.room.laps||state.room.lapCount||1}`;el.querySelector('.checkpoint').textContent=p.finished?'FINISHED':p.objective||p.missionText||'FOLLOW CHECKPOINTS';el.querySelector('.viewport-speed span').textContent=Math.round(speedKmh(p));});
}
function renderResults(){
  const results=state.room.results||[];$('results-city').textContent=cityData().name.toUpperCase();$('results-title').innerHTML=results.some(r=>r.finished!==false&&!r.dnf)?'RACE<br><em>COMPLETE.</em>':'HEAT<br><em>FINISHED.</em>';
  $('results-summary').textContent=results.length?'Engine-verified finishing order. Your crew. Your result.':'Waiting for the native engine to publish classification.';
  $('results-list').replaceChildren(...results.map((r,i)=>{const p=state.players.find(p=>p.id===(r.playerId||r.id))||r;const row=document.createElement('div');row.className='result-row';const rank=document.createElement('strong');rank.className='result-rank';rank.textContent=r.rank??r.position??i+1;const swatch=document.createElement('span');swatch.className='car-swatch';swatch.style.background=validColor(p.color);const name=document.createElement('span');name.className='result-name';name.textContent=r.name||p.name||'Driver';const time=document.createElement('span');time.className='result-time';time.textContent=r.dnf||r.finished===false?'DNF':formatTime(r.finishTime??r.time??r.elapsedSeconds);time.append(small(r.dnf||r.finished===false?'DID NOT FINISH':'SERVER VERIFIED'));row.append(rank,swatch,name,time);return row;}));
  $('rematch-button').hidden=!isHost();
}
function inviteUrl(){const origin=state.serverStatus.inviteBaseUrl||state.serverStatus.lanUrl||state.serverStatus.networkUrls?.[0]||location.origin;const u=new URL(origin);u.searchParams.set('room',state.room.code);u.searchParams.set('controller','1');return u.href;}
async function renderQr(url){
  $('invite-url').textContent=url;$('invite-url').href=url;
  const local=/localhost|127\.0\.0\.1/.test(new URL(url).hostname);$('network-note').textContent=local?'Open this page using your laptop’s LAN address before inviting phones. Localhost only works on this computer.':'Keep your phone on the same Wi-Fi as the host. No video is sent to phone controllers.';
  try{const qrcode=await import('qrcode');await (qrcode.default||qrcode).toCanvas($('qr-code'),url,{width:248,margin:1,color:{dark:'#11151b',light:'#ffffff'},errorCorrectionLevel:'M'});}catch{const img=document.createElement('img');img.src=`/api/qr?text=${encodeURIComponent(url)}`;img.alt='Scan to join this race';img.width=124;img.height=124;$('qr-wrap').replaceChildren(img);}
}
function openEntry(mode,code=''){
  state.entryMode=mode;const join=mode==='join';$('entry-title').innerHTML=join?'FIND YOUR<br><em>CREW.</em>':'MAKE IT<br><em>YOUR RACE.</em>';$('entry-kicker').textContent=join?'THE GRID IS WAITING':'TAKE YOUR PLACE';$('join-code-wrap').hidden=!join;$('join-code').required=join;$('join-code').value=code;$('driver-name').value=storage.get('comfy-name')||'';$('entry-submit').replaceChildren(document.createTextNode(join?'JOIN RACE ':'CREATE ROOM '));const arrow=document.createElement('span');arrow.textContent='↗';$('entry-submit').append(arrow);$('phone-mode').checked=state.phone||matchMedia('(pointer:coarse)').matches;$('entry-error').textContent='';$('entry-submit').disabled=false;$('entry-dialog').showModal();setTimeout(()=>($('driver-name').value&&join&&!code?$('join-code'):$('driver-name')).focus(),80);
}
$('entry-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.joining)return;const name=$('driver-name').value.trim();if(!name){$('entry-error').textContent='Give your driver a name.';return;}state.joining=true;$('entry-submit').disabled=true;$('entry-error').textContent='Connecting to the race…';state.phone=$('phone-mode').checked;storage.set('comfy-name',name);storage.set('comfy-color',state.color);
  try{await connect();send({type:'subscribe',video:!state.phone,role:state.phone?'controller':'display'});if(state.entryMode==='join')send({type:'join',code:$('join-code').value.trim().toUpperCase(),name,color:state.color});else send({type:'create',name,color:state.color,city:state.city});}catch(err){state.joining=false;$('entry-submit').disabled=false;$('entry-error').textContent=err.message;}
});
for(const color of colors){const b=document.createElement('button');b.type='button';b.className=`color-choice ${color===state.color?'active':''}`;b.style.background=color;b.setAttribute('aria-label',`Choose ${color}`);b.addEventListener('click',()=>{state.color=color;hero?.setColor(color);storage.set('comfy-color',color);for(const el of $('color-choices').children)el.classList.toggle('active',el===b);});$('color-choices').append(b);}
document.querySelectorAll('.chapter').forEach(b=>b.addEventListener('click',()=>{state.city=b.dataset.city;hero?.setCity(state.city);document.querySelectorAll('.chapter').forEach(c=>c.classList.toggle('active',c===b));}));
$('create-open').addEventListener('click',()=>openEntry('create'));$('join-open').addEventListener('click',()=>openEntry('join'));$('how-button').addEventListener('click',()=>$('info-dialog').showModal());$('system-button').addEventListener('click',()=>$('info-dialog').showModal());$('brand-home').addEventListener('click',()=>{if(state.room)toast('Leave your current room to return home.');else showScreen('home');});document.querySelector('[data-nav=home]').addEventListener('click',()=>{if(!state.room)showScreen('home');});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('ready-button').addEventListener('click',()=>send({type:'ready',ready:!me()?.ready}));$('start-button').addEventListener('click',()=>send({type:'start'}));$('rematch-button').addEventListener('click',()=>send({type:'reset'}));
$('resume-button').addEventListener('click',()=>send({type:'start'}));for(const id of ['pause-ready-button','phone-resume-ready'])$(id).addEventListener('click',()=>send({type:'ready',ready:!me()?.ready}));$('phone-recover').addEventListener('click',()=>send({type:'recover'}));
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(inviteUrl());toast('Invite link copied. Send it to your crew.');}catch{toast(`Room ${state.room.code} · ${inviteUrl()}`,8000);}});
function leave(notifyServer=true){releaseAll();const code=state.room?.code;if(notifyServer!==false)send({type:'leave'});state.room=null;state.players=[];state.playerId=null;nativeStage.players=[];if(code)session.remove(`comfy-token-${code}`);session.remove('comfy-active-room');state.resumeCode=null;state.socket?.close();state.socket=null;history.replaceState({},'',location.pathname);showScreen('home');}
for(const id of ['leave-lobby','race-leave','phone-leave','results-leave'])$(id).addEventListener('click',leave);
$('quality-select').addEventListener('change',()=>{const size=nativeStage.setQuality($('quality-select').value);toast(`Display canvas: ${size.width} × ${size.height}. Native camera detail is unchanged.`);});
$('ai-button').addEventListener('click',()=>{const event=new CustomEvent('comfy-race-ai-setup',{cancelable:true,detail:window.comfyRaceGame});if(window.dispatchEvent(event))toast('ComfyUI is not connected yet. Native Matrix gameplay is live; generated visuals require a tested workflow and GPU.');});

function input(){if(document.hidden||!document.hasFocus())return {type:'input',seq:++state.sequence,steer:0,throttle:0,brake:1};const k=state.keys,t=state.touch;return {type:'input',seq:++state.sequence,steer:(k.has('ArrowRight')||k.has('KeyD')||t.has('right')?1:0)-(k.has('ArrowLeft')||k.has('KeyA')||t.has('left')?1:0),throttle:k.has('ArrowUp')||k.has('KeyW')||t.has('gas')?1:0,brake:k.has('ArrowDown')||k.has('KeyS')||k.has('Space')||t.has('brake')?1:0};}
function releaseAll(){state.keys.clear();state.touch.clear();document.querySelectorAll('.touch-button').forEach(b=>b.classList.remove('pressed'));if(state.playerId)send({type:'input',seq:++state.sequence,steer:0,throttle:0,brake:1});}
const drivingCodes=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space']);
window.addEventListener('keydown',e=>{if(!canDrive()||!state.playerId||document.querySelector('dialog[open]')||/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='KeyR'&&!e.repeat)send({type:'recover'});if(drivingCodes.has(e.code)){e.preventDefault();state.keys.add(e.code);}});
window.addEventListener('keyup',e=>{if(drivingCodes.has(e.code)){state.keys.delete(e.code);if(isRacing())e.preventDefault();}});window.addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
for(const [id,key] of [['steer-left','left'],['steer-right','right'],['throttle','gas'],['brake','brake']]){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);state.touch.add(key);b.classList.add('pressed');});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{e.preventDefault();state.touch.delete(key);b.classList.remove('pressed');});b.addEventListener('contextmenu',e=>e.preventDefault());}
setInterval(()=>{if(state.playerId&&state.connected&&canDrive())send(input());},50);
setInterval(()=>{if(state.room&&state.connected)send({type:'ping'});},5000);
async function boot(){
  try{const response=await fetch('/api/status');state.serverStatus=await response.json();$('render-status').textContent=state.serverStatus.nativeReady?'NATIVE MATRIX READY':'NATIVE MATRIX ENGINE';$('capacity-label').textContent=`${maxDrivers()} DRIVER SLOTS`;}catch{$('render-status').textContent='LOCAL GAME SERVER';}
  let savedRoom=null;try{savedRoom=JSON.parse(session.get('comfy-active-room')||'null');}catch{session.remove('comfy-active-room');}
  const code=(query.get('room')||query.get('join')||savedRoom?.code||'').trim().toUpperCase();
  const token=code?session.get(`comfy-token-${code}`):null;
  if(code&&token&&!query.get('watch')){
    state.phone=query.has('controller')?query.get('controller')==='1':Boolean(savedRoom?.phone);state.resumeCode=code;
    try{await connect();send({type:'join',code,token,name:storage.get('comfy-name')||'Driver',color:state.color});}
    catch(error){state.resumeCode=null;openEntry('join',code);$('entry-error').textContent=error.message;}
  }else if(code&&!query.get('watch'))openEntry('join',code);
  if(query.get('watch')){try{state.phone=false;await connect();send({type:'watch',code:query.get('watch').toUpperCase()});}catch(e){toast(e.message);}}
}
boot();
