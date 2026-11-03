import './style.css';
import { RaceWorld } from './world.js';
import './comfy.js';

const $=id=>document.getElementById(id);
const cities={nairobi:{name:'Nairobi',mission:'Midnight delivery',brief:'Collect the relay parcel. Carry it through the city. Deliver first.'},tokyo:{name:'Tokyo',mission:'Neon relay',brief:'The relay is live. Chase the checkpoints and finish ahead of your crew.'},'new-york':{name:'New York',mission:'Midnight dispatch',brief:'Take the dispatch across the city circuit. Only the finish settles it.'}};
const colors=['#ff6838','#73e3dd','#d8ed7b','#9c91ff','#f6f3eb'];
const query=new URLSearchParams(location.search);
const projectorRequested=query.get('view')==='projector'||Boolean(query.get('watch'));
const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const session={get(k){try{return sessionStorage.getItem(k);}catch{return null;}},set(k,v){try{sessionStorage.setItem(k,v);}catch{}},remove(k){try{sessionStorage.removeItem(k);}catch{}}};
const state={socket:null,playerId:null,room:null,players:[],city:'nairobi',color:storage.get('comfy-color')||colors[0],phone:!projectorRequested&&query.get('controller')==='1',projector:projectorRequested,entryMode:'create',screen:'home',sequence:0,keys:new Set(),touch:new Set(),connected:false,joining:false,serverStatus:{},lastFrame:0,resumeCode:null};
let hero=null;
try { hero=new RaceWorld($('race-canvas'));hero.setColor(state.color); } catch(e){ console.warn('Illustrative landing renderer unavailable:',e.message); }

class NativeStage {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.frames=new Map();this.pending=new Set();this.players=[];this.quality='auto';this.active=false;this.generation=0;window.addEventListener('resize',()=>this.resize());this.resize();this.draw();}
  resize(){const w=innerWidth,h=innerHeight;const target=this.quality==='4k'?3840/w:this.quality==='1080p'?1920/w:Math.min(devicePixelRatio||1,1.5);const ratio=Math.min(target,Math.sqrt(8_294_400/(w*h)),3);this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);}
  async frame(message){
    const rawId=message.playerId??message.id;if(rawId==null||!message.data||state.phone)return;const id=String(rawId);if(this.pending.has(id))return;
    this.pending.add(id);const generation=this.generation;
    try{let blob;if(message.data instanceof Blob)blob=message.data;else{const text=message.data.includes(',')?message.data.split(',')[1]:message.data;const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));blob=new Blob([bytes],{type:message.mime||'image/jpeg'});}const bitmap=await createImageBitmap(blob);if(generation!==this.generation){bitmap.close();return;}const prior=this.frames.get(id);prior?.bitmap.close();this.frames.set(id,{bitmap,received:performance.now(),width:message.width||bitmap.width,height:message.height||bitmap.height});state.lastFrame=performance.now();}
    catch(e){console.warn('Native camera decode failed:',e.message);}finally{if(generation===this.generation)this.pending.delete(id);}
  }
  clear(){this.generation++;for(const frame of this.frames.values())frame.bitmap.close();this.frames.clear();this.pending.clear();state.lastFrame=0;}
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
  document.body.className=`in-${name}${state.projector?' is-projector':''}`;
  if(state.screen===name)return;state.screen=name;
  for(const id of ['home','lobby','race','controller','results'])$(id).hidden=id!==name;
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
function isHost(){return !state.projector&&state.playerId!=null&&!!(me()?.isHost||state.room?.hostId===state.playerId);}
function send(message){if(state.projector&&['input','ready','start','reset','recover','create','join','leave'].includes(message.type))return false;if(state.socket?.readyState===WebSocket.OPEN){state.socket.send(JSON.stringify(message));return true;}return false;}
let connectPromise=null;
async function connect(){
  if(state.socket?.readyState===WebSocket.OPEN)return state.socket;if(connectPromise)return connectPromise;
  connectPromise=new Promise((resolve,reject)=>{
    const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);state.socket=socket;
    const timeout=setTimeout(()=>{socket.close();reject(Error('The game server did not respond. Check that it is running.'));},10000);
    socket.addEventListener('open',()=>{clearTimeout(timeout);state.connected=true;send({type:'subscribe',video:!state.phone,role:state.projector?'projector':state.phone?'controller':'display'});resolve(socket);});
    socket.addEventListener('message',onMessage);
    socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Cannot connect to the game server.'));});
    socket.addEventListener('close',()=>{clearTimeout(timeout);if(state.socket!==socket)return;state.connected=false;connectPromise=null;releaseAll();$('controller-connection').textContent='● DISCONNECTED';$('controller-connection').style.color='#ff987e';$('race-connection').textContent=state.projector?'PROJECTOR DISCONNECTED':'DISCONNECTED — INPUT RELEASED';if(state.room){toast(state.projector?'Screen connection lost. Reconnecting to the room…':'Connection lost. Reconnecting to your driver…');setTimeout(reconnect,1500);}});
  }).finally(()=>{connectPromise=null;});return connectPromise;
}
async function reconnect(){if(!state.room||state.connected)return;const code=state.room.code;state.resumeCode=code;const token=session.get(`comfy-token-${code}`);try{await connect();if(state.projector)send({type:'watch',code});else if(token)send({type:'join',code,token,name:storage.get('comfy-name')||'Driver',color:state.color});else{state.projector=true;state.phone=false;send({type:'subscribe',video:true,role:'projector'});send({type:'watch',code});}}catch{if(state.room)setTimeout(reconnect,2500);}}
function onMessage(event){
  if(event.currentTarget&&event.currentTarget!==state.socket)return;
  if(typeof event.data!=='string')return;
  let msg;try{msg=JSON.parse(event.data);}catch{return;}
  if(msg.type==='frame'){nativeStage.frame(msg);return;}
  if(msg.type==='welcome'){state.projector=msg.spectator===true;state.playerId=state.projector?null:msg.playerId??null;if(state.projector)state.phone=false;state.resumeCode=null;if(msg.token&&msg.code)session.set(`comfy-token-${msg.code}`,msg.token);if(msg.code)session.set('comfy-active-room',JSON.stringify({code:msg.code,phone:state.phone,role:state.projector?'projector':'driver'}));$('entry-dialog').close();$('projector-dialog').close();state.joining=false;$('entry-submit').disabled=false;$('projector-submit').disabled=false;return;}
  if(msg.type==='error'){pendingExperienceId=null;$('experience-file').disabled=false;if(state.projector&&['ROOM_NOT_FOUND','INVALID_TOKEN','NATIVE_UNAVAILABLE'].includes(msg.code)){const code=state.resumeCode||query.get('room')||query.get('watch')||'';leave(false);openProjectorEntry(code);$('projector-error').textContent=msg.message||'That room is not available.';return;}if(state.resumeCode&&['ROOM_NOT_FOUND','INVALID_TOKEN'].includes(msg.code)){const code=state.resumeCode;state.resumeCode=null;session.remove(`comfy-token-${code}`);session.remove('comfy-active-room');state.room=null;state.players=[];state.playerId=null;state.socket?.close();state.socket=null;showScreen('home');openEntry('join',code);$('entry-error').textContent=msg.message||'Your saved race is no longer available.';return;}if(msg.code==='ROOM_CLOSED'){const message=msg.message||'The host ended this room.';leave(false);toast(message);return;}state.joining=false;$('entry-submit').disabled=false;$('projector-submit').disabled=false;const text=msg.message||msg.error||'The server could not complete that action.';$('entry-error').textContent=text;$('projector-error').textContent=text;$('experience-status').textContent=text;toast(text);return;}
  if(msg.type==='room'||msg.type==='state'){
    const room=msg.room||msg;if(!room.code)return;const priorRoom=state.room,prev=state.room?.phase;if(state.room?.code!==room.code)nativeStage.clear();state.room=room;state.players=msg.players||room.players||state.players;state.city=room.city||state.city;nativeStage.players=state.players;renderState();updateRaceRadio(priorRoom,room);
    if(prev!==room.phase){releaseAll();if(room.phase==='countdown'&&state.phone)try{navigator.vibrate?.([80,80,80]);}catch{}}
  }
}
function cityData(){return cities[state.city]||cities.nairobi;}
function maxDrivers(){const configured=Number(state.room?.maxPlayers??state.room?.maxDrivers??state.serverStatus.maxDrivers??state.serverStatus.maxPlayers??state.serverStatus.multiplayer?.maxPlayers??2);return Number.isInteger(configured)?Math.max(2,Math.min(5,configured)):2;}
let lastQr='',pendingExperienceId=null;
function renderState(){
  if(!state.room)return;const city=cityData(),own=me(),host=isHost();
  if(isFinished())showScreen('results');else if(isRacing())showScreen(state.phone?'controller':'race');else showScreen('lobby');
  $('room-code').textContent=state.room.code;$('player-count').textContent=`${state.players.length} / ${maxDrivers()}`;$('capacity-label').textContent=`${maxDrivers()} DRIVER SLOTS`;
  $('roster').replaceChildren(...state.players.map((p,i)=>{const row=document.createElement('div');row.className='driver-row';const number=document.createElement('span');number.className='driver-number';number.textContent=String(i+1).padStart(2,'0');const swatch=document.createElement('span');swatch.className='car-swatch';swatch.style.background=validColor(p.color);const info=document.createElement('div');info.className='driver-info';const name=document.createElement('strong');name.textContent=`${p.name}${p.id===state.playerId?' (YOU)':''}`;const role=document.createElement('small');role.textContent=p.isHost||p.id===state.room.hostId?'HOST / KEYBOARD OR PHONE':'DRIVER';info.append(name,role);const status=document.createElement('span');status.className=`driver-state ${!p.connected?'offline':p.ready?'ready':''}`;status.textContent=!p.connected?'OFFLINE':p.ready?'● READY':'NOT READY';row.append(number,swatch,info,status);return row;}));
  $('ready-button').hidden=!own;$('ready-button').textContent=own?.ready?'READY ✓ — TAP TO UNREADY':"I'M READY ✓";$('start-button').hidden=!host;
  const connected=state.players.filter(p=>p.connected!==false);const ready=connected.filter(p=>p.ready);$('start-button').disabled=!!pendingExperienceId||connected.length<2||state.players.some(p=>!p.connected||!p.ready);
  $('lobby-notice').textContent=connected.length<2?'Invite one more human driver to unlock the starting lights.':ready.length<connected.length?`${connected.length-ready.length} driver${connected.length-ready.length===1?' is':'s are'} still getting ready.`:host?'The grid is ready. Start when your crew can see the screen.':'The grid is ready. Waiting for the host to start.';
  $('lobby-subtitle').textContent=state.projector?'Shared screen only. Both phones keep their own driver slot.':state.phone?'Your phone is the controller. Open the projector link on the laptop.':'Your keyboard drives your car. Friends can join on their phones.';
  const experience=state.room.experience,missionTitle=experience?.title||state.room.mission?.title||state.room.mission?.name||city.mission;
  $('mission-city').textContent=`${city.name.toUpperCase()} / INSPIRED STORY`;$('mission-name').textContent=missionTitle;$('mission-brief').textContent=experience?.briefing||state.room.mission?.briefing||city.brief;$('experience-source').textContent=experience?'IMPORTED MANIFEST':'AUTHORED STARTER';
  $('experience-import').hidden=!(host&&phase()==='lobby');$('experience-file').disabled=!!pendingExperienceId||!!experience;$('experience-pilot').disabled=!!pendingExperienceId||!!experience;$('experience-pilot').textContent=pendingExperienceId==='loading-saved-pilot'?'LOADING SAVED PILOT…':'LOAD REVIEWED NAIROBI PILOT ↗';$('experience-reset').hidden=!experience;$('experience-download').hidden=!experience;
  if(experience&&pendingExperienceId===experience.id){pendingExperienceId=null;toast(`Experience loaded: ${experience.title}. Native route and rules remain authoritative.`);}
  if(experience&&!pendingExperienceId)$('experience-status').textContent=`Active: ${experience.title} · native route ${experience.routeId} · ${experience.vehiclePresetId}.`;
  else if(!pendingExperienceId)$('experience-status').textContent='Load the generated experience manifest JSON. The server checks its native route and supported vehicle/rules presets.';
  $('experience-warning').textContent=experience?.warnings?.length?experience.warnings.join(' '):'Imports a playable experience manifest, not the ComfyUI node graph. A motorsport presentation does not install an F1 car.';
  document.body.classList.toggle('motorsport-presentation',experience?.presentation?.style==='motorsport');
  $('race-city').textContent=`${city.name.toUpperCase()} / INSPIRED CHAPTER`;$('race-mission').textContent=missionTitle.toUpperCase();
  $('race-time').textContent=formatTime(state.room.elapsedSeconds??state.room.elapsed??0);
  $('live-objective').textContent=own?.objective||own?.missionText||state.room.objective||'Follow the native route. Pass every checkpoint.';
  const countdown=phase()==='countdown',paused=phase()==='paused',starting=phase()==='starting',failed=phase()==='error';$('countdown').hidden=!(countdown||paused||starting||failed);$('countdown-number').textContent=paused?'PAUSED':failed?'STOPPED':starting?'…':Math.max(1,Math.ceil(state.room.countdownRemaining??state.room.countdown??3));$('countdown-label').textContent=paused?'WAITING FOR YOUR CREW':failed?'NATIVE ENGINE NEEDS ATTENTION':starting?'STARTING THE NATIVE ENGINE':'LIGHTS OUT IN';$('pause-reason').hidden=!(paused||failed);$('pause-reason').textContent=state.room.pauseReason||state.room.error||'';$('resume-button').hidden=!(paused&&host);$('resume-button').disabled=connected.length<2||state.players.some(p=>!p.connected||!p.ready);$('pause-ready-button').hidden=!(paused&&own);$('pause-ready-button').textContent=own?.ready?'READY ✓ — TAP TO UNREADY':'READY TO RESUME ✓';$('phone-resume-ready').hidden=!(paused&&own);$('phone-resume-ready').textContent=own?.ready?'READY ✓ — TAP TO UNREADY':'READY TO RESUME ✓';
  $('phone-resume-start').hidden=!(paused&&host);$('phone-resume-start').disabled=connected.length<2||state.players.some(p=>!p.connected||!p.ready);
  renderViewportHud();
  renderTimingTower();
  $('controller-name').textContent=own?.name?.toUpperCase()||'YOUR DRIVER';$('controller-connection').textContent=state.connected?'● CONNECTED':'● DISCONNECTED';$('controller-connection').style.color=state.connected?'#a6f3b9':'#ff987e';
  const gates=gateProgress(own);$('controller-position').replaceChildren(document.createTextNode(String(own?.rank??'—')),small(` / ${state.players.length}`));$('controller-lap').replaceChildren(document.createTextNode(String(gates.completed)),small(` / ${gates.total||'—'}`));$('controller-speed').textContent=Math.round(speedKmh(own));$('phone-objective').textContent=own?.objective||own?.missionText||'Stay sharp. Chase the lead.';
  $('phone-race-status').textContent=paused?'Race paused. Both phones confirm ready; the phone host resumes.':failed?'Native engine stopped. Check the host.':countdown?`Starting in ${$('countdown-number').textContent}…`:own?.finished?'Finished. Waiting for the other drivers.':`Room ${state.room.code} · ${city.name} chapter`;
  $('race-connection').replaceChildren();const dot=document.createElement('i');dot.className='status-dot';if(failed)dot.style.background='#ff806e';$('race-connection').append(dot,document.createTextNode(failed?' NATIVE ENGINE UNAVAILABLE':paused?' NATIVE RACE PAUSED':' NATIVE RACE AUTHORITY CONNECTED'));
  if(isFinished())renderResults();
  $('race-control-tip').textContent=state.projector?'PROJECTOR / SPECTATOR':'WASD / ARROWS TO DRIVE';$('race-control-detail').textContent=state.projector?'BOTH PHONES DRIVE · THIS SCREEN USES NO CAR SLOT':'SPACE TO BRAKE · R TO RECOVER (+5S)';$('race-leave').textContent=state.projector?'LEAVE SCREEN ↗':'LEAVE RACE ↗';
  const projector=projectorUrl();$('projector-url').href=projector;$('projector-url').textContent=projector;$('open-projector-link').href=projector;
  const invite=inviteUrl();if(invite!==lastQr){lastQr=invite;renderQr(invite);}
}
function small(text){const s=document.createElement('small');s.textContent=text;return s;}
function speedKmh(p){return p?.speedKmh??Math.abs(p?.speed||0)*3.6;}
function validColor(value){return /^#[0-9a-f]{6}$/i.test(value)?value:'#ff6838';}
function formatTime(seconds){if(!Number.isFinite(Number(seconds)))return '—';const t=Math.max(0,Number(seconds));return `${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;}
function gateProgress(player){const raw=Number(player?.checkpointCount??state.room?.checkpointCount??0);const total=Number.isFinite(raw)?Math.max(0,Math.floor(raw)):0;const n=Number(player?.checkpoint??player?.progress??0);return {total,completed:player?.finished?total:Math.max(0,Math.min(total,Number.isFinite(n)?Math.floor(n):0))};}
let radioTimer;
function clearRadio(){clearTimeout(radioTimer);$('race-radio').hidden=true;$('race-radio-text').textContent='';$('phone-radio-text').hidden=true;$('phone-radio-text').textContent='';}
function radioCue(text){if(typeof text!=='string'||!text.trim())return;clearTimeout(radioTimer);$('race-radio-text').textContent=text;$('race-radio').hidden=false;$('phone-radio-text').textContent=`RADIO / TEXT: ${text}`;$('phone-radio-text').hidden=false;radioTimer=setTimeout(clearRadio,6500);}
function updateRaceRadio(previous,current){
  if(!previous||previous.code!==current.code||previous.raceId!==current.raceId){clearRadio();return;}
  const radio=current.experience?.radio;if(!radio){clearRadio();return;}
  const racers=state.playerId!=null?current.players.filter(p=>p.id===state.playerId):current.players;
  for(const racer of racers){const prior=previous.players?.find(p=>p.id===racer.id);if(prior&&!prior.finished&&racer.finished&&typeof radio.finish==='string'&&radio.finish.trim()){radioCue(`${racer.name}: ${radio.finish}`);return;}}
  for(const racer of racers){const prior=previous.players?.find(p=>p.id===racer.id);if(prior&&!racer.finished&&Number(racer.checkpoint)>Number(prior.checkpoint)&&typeof radio.checkpoint==='string'&&radio.checkpoint.trim()){radioCue(`${racer.name}: ${radio.checkpoint}`);return;}}
  if(current.phase==='racing'&&previous.phase!=='racing')radioCue(previous.phase==='paused'?'Race resumed. Follow the native route.':radio.start);
}
const timingRows=new Map();let timingOrder='';
function renderTimingTower(){
  const order=[...state.players].sort((a,b)=>(Number(a.rank)||99)-(Number(b.rank)||99));
  $('tower-title').textContent=isFinished()?'FINAL CLASSIFICATION':'PROGRESS ORDER';
  $('broadcast-route').textContent=state.room.routeId||'CITY COURSE';
  $('timing-note').textContent=isFinished()?'Native finish totals include penalties':'Checkpoint progress · not live time gaps';
  const ids=new Set(order.map(p=>String(p.id)));for(const [id,row] of timingRows)if(!ids.has(id)){row.remove();timingRows.delete(id);}
  for(let i=0;i<order.length;i++){
    const p=order[i],id=String(p.id);let row=timingRows.get(id);
    if(!row){row=document.createElement('li');row.className='timing-row';row.innerHTML='<span class="timing-rank"></span><span class="timing-accent"></span><div class="timing-driver"><b></b><small></small></div><div class="timing-progress"><b></b><small></small></div>';timingRows.set(id,row);}
    row.style.transform=`translateY(${i*58}px)`;row.style.setProperty('--driver-accent',validColor(p.color));row.classList.toggle('timing-offline',p.connected===false);row.setAttribute('aria-posinset',String(i+1));row.setAttribute('aria-setsize',String(order.length));
    row.querySelector('.timing-rank').textContent=String(i+1);row.querySelector('.timing-driver b').textContent=p.name||'Driver';
    const gate=gateProgress(p),penalty=Number(p.penalty)||0;row.querySelector('.timing-driver small').textContent=p.connected===false?'OFFLINE':p.dnf?'DID NOT FINISH':p.finished?'FINISHED':`${Math.round(speedKmh(p))} KM/H`;
    row.querySelector('.timing-progress b').textContent=p.connected===false?'OFF':p.dnf?'DNF':p.finished?formatTime(p.finishTime):`${gate.completed}/${gate.total||'—'}`;
    row.querySelector('.timing-progress small').textContent=penalty>0?`+${penalty.toFixed(1)}S PEN`:(p.finished?'NATIVE TOTAL':'GATES');
  }
  const key=order.map(p=>p.id).join(',');if(key!==timingOrder){timingOrder=key;for(const p of order)$('timing-rows').append(timingRows.get(String(p.id)));}
  $('timing-rows').style.height=`${order.length*58}px`;
}
let hudKey='';
function renderViewportHud(){
  const count=state.players.length,cols=count===1?1:2,rows=Math.ceil(count/cols),key=state.players.map(p=>p.id).join(',');
  if(key!==hudKey){hudKey=key;$('viewport-labels').replaceChildren(...state.players.map(p=>{const el=document.createElement('div');el.className='viewport-hud';el.dataset.player=p.id;el.innerHTML='<div><div class="viewport-name"><i></i><span></span></div><div class="viewport-stats"><span class="hud-position"></span><span class="hud-lap"></span></div><small class="checkpoint"></small></div><div class="viewport-speed"><span></span><small>KM/H</small></div>';return el;}));}
  state.players.forEach((p,i)=>{const el=$('viewport-labels').children[i];el.style.width=`${100/cols}%`;el.style.left=`${i%cols*100/cols}%`;el.style.bottom=rows===1?'120px':`calc(${(rows-1-Math.floor(i/cols))*100/rows}% + ${Math.floor(i/cols)===rows-1?110:18}px)`;el.querySelector('.viewport-name span').textContent=p.name;el.querySelector('i').style.background=validColor(p.color);el.querySelector('.hud-position').textContent=`ORDER ${p.rank??'—'} / ${count}`;const gate=gateProgress(p);el.querySelector('.hud-lap').textContent=`GATES ${gate.completed} / ${gate.total||'—'}`;el.querySelector('.checkpoint').textContent=p.finished?'FINISHED':p.objective||p.missionText||'FOLLOW CHECKPOINTS';el.querySelector('.viewport-speed span').textContent=Math.round(speedKmh(p));});
}
function renderResults(){
  const results=state.room.results||[];$('results-city').textContent=cityData().name.toUpperCase();$('results-title').innerHTML=results.some(r=>r.finished!==false&&!r.dnf)?'RACE<br><em>COMPLETE.</em>':'HEAT<br><em>FINISHED.</em>';
  $('results-summary').textContent=results.length?'Engine-verified finishing order. Your crew. Your result.':'Waiting for the native engine to publish classification.';
  $('results-list').replaceChildren(...results.map((r,i)=>{const p=state.players.find(p=>p.id===(r.playerId||r.id))||r;const row=document.createElement('div');row.className='result-row';const rank=document.createElement('strong');rank.className='result-rank';rank.textContent=r.rank??r.position??i+1;const swatch=document.createElement('span');swatch.className='car-swatch';swatch.style.background=validColor(p.color);const name=document.createElement('span');name.className='result-name';name.textContent=r.name||p.name||'Driver';const time=document.createElement('span');time.className='result-time';time.textContent=r.dnf||r.finished===false?'DNF':formatTime(r.finishTime??r.time??r.elapsedSeconds);time.append(small(r.dnf||r.finished===false?'DID NOT FINISH':'SERVER VERIFIED'));row.append(rank,swatch,name,time);return row;}));
  $('rematch-button').hidden=!isHost();
}
function inviteUrl(){const origin=state.serverStatus.inviteBaseUrl||state.serverStatus.lanUrl||state.serverStatus.networkUrls?.[0]||location.origin;const u=new URL(origin);u.searchParams.set('room',state.room.code);u.searchParams.set('controller','1');return u.href;}
function projectorUrl(){const u=new URL(inviteUrl());u.searchParams.delete('controller');u.searchParams.set('view','projector');return u.href;}
async function renderQr(url){
  $('invite-url').textContent=url;$('invite-url').href=url;
  const local=/localhost|127\.0\.0\.1/.test(new URL(url).hostname);$('network-note').textContent=local?'Open this page using your laptop’s LAN address before inviting phones. Localhost only works on this computer.':'Keep your phone on the same Wi-Fi as the host. No video is sent to phone controllers.';
  try{const qrcode=await import('qrcode');await (qrcode.default||qrcode).toCanvas($('qr-code'),url,{width:248,margin:1,color:{dark:'#11151b',light:'#ffffff'},errorCorrectionLevel:'M'});}catch{const img=document.createElement('img');img.src=`/api/qr?text=${encodeURIComponent(url)}`;img.alt='Scan to join this race';img.width=124;img.height=124;$('qr-wrap').replaceChildren(img);}
}
function openEntry(mode,code=''){
  state.entryMode=mode;const join=mode==='join';$('entry-title').innerHTML=join?'FIND YOUR<br><em>CREW.</em>':'MAKE IT<br><em>YOUR RACE.</em>';$('entry-kicker').textContent=join?'THE GRID IS WAITING':'TAKE YOUR PLACE';$('join-code-wrap').hidden=!join;$('join-code').required=join;$('join-code').value=code;$('driver-name').value=storage.get('comfy-name')||'';$('entry-submit').replaceChildren(document.createTextNode(join?'JOIN RACE ':'CREATE ROOM '));const arrow=document.createElement('span');arrow.textContent='↗';$('entry-submit').append(arrow);$('phone-mode').checked=state.phone||matchMedia('(pointer:coarse)').matches;$('entry-error').textContent='';$('entry-submit').disabled=false;$('entry-dialog').showModal();setTimeout(()=>($('driver-name').value&&join&&!code?$('join-code'):$('driver-name')).focus(),80);
}
function openProjectorEntry(code=''){
  if(state.room){toast('Leave the current room before opening another shared screen.');return;}
  $('projector-code').value=code;$('projector-error').textContent='';$('projector-submit').disabled=false;$('projector-dialog').showModal();setTimeout(()=>$('projector-code').focus(),60);
}
async function watchRoom(code){
  state.projector=true;state.phone=false;state.playerId=null;state.resumeCode=code;state.joining=true;
  const url=new URL(location.href);url.search='';url.searchParams.set('room',code);url.searchParams.set('view','projector');history.replaceState({},'',url);
  await connect();send({type:'subscribe',video:true,role:'projector'});send({type:'watch',code});
}
$('projector-open').addEventListener('click',()=>openProjectorEntry());
$('projector-form').addEventListener('submit',async event=>{
  event.preventDefault();if(state.joining)return;const code=$('projector-code').value.trim().toUpperCase();if(!code)return;
  $('projector-submit').disabled=true;$('projector-error').textContent='Connecting the shared screen…';
  try{await watchRoom(code);}catch(error){state.joining=false;$('projector-submit').disabled=false;$('projector-error').textContent=error.message;}
});
function sendExperienceManifest(manifest,roomCode){
  if(!isHost()||phase()!=='lobby'||state.room?.code!==roomCode||state.room.experience)throw new Error('The room changed. Reset the lobby before loading another experience.');
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||manifest.nodes||manifest.links)throw new Error('Load the experience manifest, not a ComfyUI editor/workflow graph.');
  if(new TextEncoder().encode(JSON.stringify({type:'apply_experience',manifest})).length>8192)throw new Error('Import the small experience output JSON (under 8 KB), not the ComfyUI workflow graph.');
  pendingExperienceId=typeof manifest.id==='string'?manifest.id:'awaiting-validation';
  if(!send({type:'apply_experience',manifest}))throw new Error('Reconnect to the native room before importing an experience.');
  $('experience-status').textContent='Validating the native route and supported presets…';
}
function experienceError(error){pendingExperienceId=null;$('experience-file').disabled=!!state.room?.experience;$('experience-pilot').disabled=!!state.room?.experience;$('experience-status').textContent=error.message;toast(error.message);}
$('experience-pilot').addEventListener('click',async()=>{
  if(!isHost()||phase()!=='lobby'||pendingExperienceId||state.room.experience)return;
  const roomCode=state.room.code;pendingExperienceId='loading-saved-pilot';renderState();$('experience-status').textContent='Loading the saved, reviewed Nairobi pilot. No generation is being requested.';
  try{const response=await fetch('/api/experience/examples/nairobi-pilot',{signal:AbortSignal.timeout(10000)});const payload=await response.json();if(!response.ok)throw new Error(payload.message||payload.error||'Saved pilot is not available on this server.');sendExperienceManifest(payload.manifest||payload,roomCode);}
  catch(error){experienceError(error);}
});
$('experience-file').addEventListener('change',async event=>{
  if(!isHost()||phase()!=='lobby')return;
  const file=event.target.files?.[0];if(!file)return;
  const roomCode=state.room.code;pendingExperienceId='reading-file';renderState();$('experience-status').textContent='Reading experience manifest…';
  try{
    if(file.size>65536)throw new Error('Choose a manifest JSON file smaller than 64 KB.');
    const manifest=JSON.parse(await file.text());
    sendExperienceManifest(manifest,roomCode);
  }catch(error){experienceError(error);}
  finally{event.target.value='';}
});
$('experience-reset').addEventListener('click',()=>{if(isHost()&&phase()==='lobby'){pendingExperienceId=null;send({type:'reset'});}});
$('experience-download').addEventListener('click',()=>{
  const experience=state.room?.experience;if(!experience)return;const manifest={};
  for(const key of ['schemaVersion','id','title','cityTheme','routeId','vehiclePresetId','rulesPresetId','presentation','briefing','radio','requestedStyle'])if(experience[key]!==undefined)manifest[key]=experience[key];
  const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`comfy-experience-${String(experience.id).replace(/[^a-z0-9_-]/gi,'').slice(0,60)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('entry-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.joining)return;const name=$('driver-name').value.trim();if(!name){$('entry-error').textContent='Give your driver a name.';return;}state.projector=false;state.joining=true;$('entry-submit').disabled=true;$('entry-error').textContent='Connecting to the race…';state.phone=$('phone-mode').checked;storage.set('comfy-name',name);storage.set('comfy-color',state.color);
  try{await connect();send({type:'subscribe',video:!state.phone,role:state.phone?'controller':'display'});if(state.entryMode==='join')send({type:'join',code:$('join-code').value.trim().toUpperCase(),name,color:state.color});else send({type:'create',name,color:state.color,city:state.city});}catch(err){state.joining=false;$('entry-submit').disabled=false;$('entry-error').textContent=err.message;}
});
for(const color of colors){const b=document.createElement('button');b.type='button';b.className=`color-choice ${color===state.color?'active':''}`;b.style.background=color;b.setAttribute('aria-label',`Choose ${color}`);b.addEventListener('click',()=>{state.color=color;hero?.setColor(color);storage.set('comfy-color',color);for(const el of $('color-choices').children)el.classList.toggle('active',el===b);});$('color-choices').append(b);}
document.querySelectorAll('.chapter').forEach(b=>b.addEventListener('click',()=>{state.city=b.dataset.city;hero?.setCity(state.city);document.querySelectorAll('.chapter').forEach(c=>c.classList.toggle('active',c===b));}));
$('create-open').addEventListener('click',()=>openEntry('create'));$('join-open').addEventListener('click',()=>openEntry('join'));$('how-button').addEventListener('click',()=>$('info-dialog').showModal());$('system-button').addEventListener('click',()=>$('info-dialog').showModal());$('brand-home').addEventListener('click',()=>{if(state.room)toast('Leave your current room to return home.');else showScreen('home');});document.querySelector('[data-nav=home]').addEventListener('click',()=>{if(!state.room)showScreen('home');});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('ready-button').addEventListener('click',()=>send({type:'ready',ready:!me()?.ready}));$('start-button').addEventListener('click',()=>send({type:'start'}));$('rematch-button').addEventListener('click',()=>send({type:'reset'}));
$('resume-button').addEventListener('click',()=>send({type:'start'}));for(const id of ['pause-ready-button','phone-resume-ready'])$(id).addEventListener('click',()=>send({type:'ready',ready:!me()?.ready}));$('phone-recover').addEventListener('click',()=>send({type:'recover'}));
$('phone-resume-start').addEventListener('click',()=>send({type:'start'}));
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(inviteUrl());toast('Invite link copied. Send it to your crew.');}catch{toast(`Room ${state.room.code} · ${inviteUrl()}`,8000);}});
$('copy-projector-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(projectorUrl());toast('Shared-screen link copied. Open it on the laptop.');}catch{toast(projectorUrl(),10000);}});
function leave(notifyServer=true){releaseAll();const code=state.room?.code;if(notifyServer!==false&&state.playerId!=null)send({type:'leave'});state.room=null;state.players=[];state.playerId=null;state.projector=false;state.connected=false;state.joining=false;nativeStage.players=[];nativeStage.clear();clearRadio();pendingExperienceId=null;timingRows.clear();timingOrder='';$('timing-rows').replaceChildren();lastQr='';if(code)session.remove(`comfy-token-${code}`);session.remove('comfy-active-room');state.resumeCode=null;state.socket?.close();state.socket=null;history.replaceState({},'',location.pathname);showScreen('home');}
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
  const code=(query.get('room')||query.get('join')||query.get('watch')||savedRoom?.code||'').trim().toUpperCase();
  const projector=projectorRequested||(!query.has('room')&&!query.has('join')&&!query.has('controller')&&savedRoom?.role==='projector');
  if(projector){if(!code){openProjectorEntry();return;}try{await watchRoom(code);}catch(error){state.joining=false;openProjectorEntry(code);$('projector-error').textContent=error.message;}return;}
  const token=code?session.get(`comfy-token-${code}`):null;
  if(code&&token){
    state.phone=query.has('controller')?query.get('controller')==='1':Boolean(savedRoom?.phone);state.resumeCode=code;
    try{await connect();send({type:'join',code,token,name:storage.get('comfy-name')||'Driver',color:state.color});}
    catch(error){state.resumeCode=null;openEntry('join',code);$('entry-error').textContent=error.message;}
  }else if(code)openEntry('join',code);
}
boot();
