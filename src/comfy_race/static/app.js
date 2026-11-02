/* Comfy Race local controller: real ComfyStream WebRTC only; no fake AI fallback. */
"use strict";
const $ = id => document.getElementById(id);
const canvas = $("source"), ctx = canvas.getContext("2d", {alpha:false});
const state={device:null,workflow:null,source:null,captured:null,pc:null,remote:null,frameTimes:[],lastFrame:0,startedAt:0,loop:0,connected:false};
const FRAME_MS=1000/24, STALE_MS=1500;
function setStatus(t){$("status").textContent=t;}
function health(ok,msg){$("stream-health").textContent=msg;$("stream-health").className=ok?"ok":"danger";$("empty-overlay").hidden=ok;}
function validWorkflow(g){
  if(!g||typeof g!=="object"||Array.isArray(g))throw Error("Workflow must be a ComfyUI API-format node dictionary");
  const nodes=Object.values(g);
  if(nodes.filter(n=>["LoadImage","PrimaryInputLoadImage"].includes(n?.class_type)).length!==1||
     nodes.filter(n=>["SaveImage","PreviewImage"].includes(n?.class_type)).length!==1)
      throw Error("Workflow requires one image input and one output");
  for(const node of nodes)for(const input of Object.values(node.inputs||{}))
    if(Array.isArray(input)&&input.length===2&&typeof input[0]==="string"&&Number.isInteger(input[1])&&!Object.hasOwn(g,input[0]))
      throw Error("Broken graph link: "+input[0]);
  return g;
}
function fit(sw,sh,dw=512,dh=512){if(!(sw>0&&sh>0))throw Error("Invalid source dimensions");const k=Math.min(dw/sw,dh/sh);return {x:(dw-sw*k)/2,y:(dh-sh*k)/2,w:sw*k,h:sh*k};}
function recordFrame(now){
 state.lastFrame=now;state.frameTimes.push(now);while(state.frameTimes.length&&state.frameTimes[0]<now-10000)state.frameTimes.shift();
 const n=state.frameTimes.length, span=n>1?state.frameTimes[n-1]-state.frameTimes[0]:0;
 $("fps").textContent=span>0?((n-1)*1000/span).toFixed(1):"Measuring...";
 $("presented").textContent="AI frames presented (10s): "+n;
 health(true,"AI FRAMES ARRIVING");
}
function renderSource(){
 if(!state.source)return;const v=$("source-video");
 if(v&&v.readyState>=2&&v.videoWidth){
  ctx.fillStyle="#060b13";ctx.fillRect(0,0,512,512);
  const f=fit(v.videoWidth,v.videoHeight);ctx.drawImage(v,f.x,f.y,f.w,f.h);
 }
 state.loop=requestAnimationFrame(renderSource);
}
function monitor(){
 const now=performance.now(),stale=state.connected&&now-state.lastFrame>STALE_MS;
 if(stale){health(false,"AI OUTPUT STALLED");$("freeze").textContent="AI feed stale; do not drive on source";$("last-frame").textContent=state.lastFrame?Math.round(now-state.lastFrame)+" ms ago":"No AI frames";}
 else if(state.connected&&state.lastFrame){$("freeze").textContent="Receiving generated frames";$("last-frame").textContent=Math.round(now-state.lastFrame)+" ms ago";}
 else if(!state.connected){health(false,"NOT CONNECTED");$("freeze").textContent="No live AI output";}
}
setInterval(monitor,300);
async function listCameras(){
 try{
  const devices=await navigator.mediaDevices.enumerateDevices();
  const cams=devices.filter(d=>d.kind==="videoinput");
  const select=$("camera"),old=select.value;select.replaceChildren(new Option("Select OBS Virtual Camera",""));
  for(const d of cams)select.add(new Option(d.label||"Video device (permission required)",d.deviceId));
  if([...select.options].some(o=>o.value===old))select.value=old;
  else {const obs=cams.find(d=>/obs virtual camera/i.test(d.label));if(obs)select.value=obs.deviceId;}
  setStatus(cams.length?"Choose OBS Virtual Camera, then load workflow":"No cameras listed; enable OBS Virtual Camera");
 }catch(e){setStatus("Camera discovery blocked: "+e.message);}
 canStart();
}
function canStart(){ $("start").disabled=!(state.workflow&&$("camera").value)&&!state.pc; }
$("refresh").addEventListener("click",listCameras);
$("camera").addEventListener("change",canStart);
$("workflow").addEventListener("change",async e=>{
 try{const file=e.target.files[0];if(!file)return;state.workflow=validWorkflow(JSON.parse(await file.text()));$("workflow-state").textContent="Valid API graph loaded: "+file.name;}
 catch(error){state.workflow=null;$("workflow-state").textContent="Invalid workflow: "+error.message;}
 canStart();
});
function onProcessedFrame(now){
 if(!state.pc)return;
 recordFrame(now);
 if("requestVideoFrameCallback" in $("processed"))$("processed").requestVideoFrameCallback(onProcessedFrame);
}
async function start(){
 if(state.pc)return;
 $("start").disabled=true;setStatus("Opening OBS video source...");
 try{
  const selected=$("camera").selectedOptions[0];
  if(!/obs virtual camera/i.test(selected?.text||""))throw Error("Only OBS Virtual Camera is permitted in V1");
  state.source=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:$("camera").value},width:{ideal:1280},height:{ideal:720}},audio:false});
  let sourceVideo=document.createElement("video");sourceVideo.id="source-video";sourceVideo.muted=true;sourceVideo.playsInline=true;sourceVideo.srcObject=state.source;
  await sourceVideo.play();document.body.append(sourceVideo);sourceVideo.hidden=true;
  $("dimensions").textContent=sourceVideo.videoWidth+" × "+sourceVideo.videoHeight+" → 512 × 512 contain";
  renderSource();
  state.captured=canvas.captureStream(24);
  const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});state.pc=pc;
  const transceiver=pc.addTransceiver(state.captured.getVideoTracks()[0],{direction:"sendrecv"});
  pc.ontrack=e=>{state.remote=e.streams?.[0]||new MediaStream([e.track]);$("processed").srcObject=state.remote;
    $("processed").play().then(()=>{if("requestVideoFrameCallback" in $("processed"))$("processed").requestVideoFrameCallback(onProcessedFrame);}).catch(err=>setStatus("Autoplay error: "+err.message));};
  pc.onconnectionstatechange=()=>{ $("rtc").textContent=pc.connectionState;state.connected=pc.connectionState==="connected";
    if(!state.connected){health(false,"AI OUTPUT DISCONNECTED");setStatus("Connection "+pc.connectionState);}};
  // ComfyStream's existing server accepts an SDP offer and a LIST of ComfyUI graph objects.
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);
  // Ice gathering complete is required for one-shot SDP POST (no trickle endpoint).
  if(pc.iceGatheringState!=="complete")await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error("ICE gathering timeout")),12000);
    pc.addEventListener("icegatheringstatechange",function changed(){if(pc.iceGatheringState==="complete"){clearTimeout(timeout);pc.removeEventListener("icegatheringstatechange",changed);resolve();}});});
  $("signal").textContent="Sending SDP offer...";
  const response=await fetch("/api/offer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({offer:{type:"offer",sdp:pc.localDescription.sdp},prompts:[state.workflow],resolution:{width:512,height:512}})});
  if(!response.ok){let err=await response.json().catch(()=>({error:"Signaling failed"}));throw Error(err.error||"Signaling failed");}
  const answer=await response.json();await pc.setRemoteDescription(answer);
  $("signal").textContent="WebRTC answer accepted";$("stop").disabled=false;setStatus("Awaiting live processed frames...");
 }catch(e){setStatus("Start failed: "+e.message);stop();}
}
function stop(){
 if(state.loop){cancelAnimationFrame(state.loop);state.loop=0;}
 if(state.pc){state.pc.close();state.pc=null;}
 for(const stream of [state.captured,state.source,state.remote])stream?.getTracks().forEach(t=>t.stop());
 state.captured=state.source=state.remote=null;state.connected=false;state.lastFrame=0;state.frameTimes=[];
 const video=document.getElementById("source-video");video?.remove();$("processed").srcObject=null;
 ctx.fillStyle="#060b13";ctx.fillRect(0,0,512,512);
 $("stop").disabled=true;$("signal").textContent="Stopped";$("rtc").textContent="Disconnected";$("fps").textContent="—";
 health(false,"NOT CONNECTED");canStart();
}
$("start").addEventListener("click",start);$("stop").addEventListener("click",stop);
$("export").addEventListener("click",()=>{
 const info={created_at:new Date().toISOString(),source:$("camera").selectedOptions[0]?.text||null,
 workflow_nodes:state.workflow?Object.keys(state.workflow).length:0,
 webRTC_state:$("rtc").textContent,received_frame_samples:state.frameTimes.length,presented_fps:$("fps").textContent,
 last_frame_age_ms:state.lastFrame?Math.round(performance.now()-state.lastFrame):null,
 latency_measured:false,gpu_inference_verified:false,
 note:"Client frame health only; no action-to-photon guarantee"};
 const url=URL.createObjectURL(new Blob([JSON.stringify(info,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="comfy-race-client-diagnostics.json";a.click();URL.revokeObjectURL(url);
});
(async()=>{try{const r=await (await fetch("/api/status")).json();setStatus(r.message);}catch{setStatus("Local server unavailable");}if(navigator.mediaDevices)listCameras();else setStatus("MediaDevices unavailable; open via localhost/HTTPS");})();
