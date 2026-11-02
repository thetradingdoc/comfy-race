"use strict";
/* Lightweight client navigation. Streaming lifecycle remains in app.js and is host-controlled. */
const PAGES={"/":"home-screen","/play":"play-screen","/race":"race-screen","/race-complete":"complete-screen","/operator":"operator-screen"};
function showPage(){
  const path=location.pathname.replace(/\/$/,"")||"/";
  const active=PAGES[path]||PAGES["/"];
  for(const id of Object.values(PAGES))document.getElementById(id).hidden=(id!==active);
  document.title="Comfy Race · "+({"/":"Home","/play":"Play","/race":"Live Race","/race-complete":"Race Results","/operator":"Host Setup"}[path]||"Home");
  // Move the real returned-stream stage into the race view, and return to operator when configuring.
  const stage=document.querySelector(".stage");
  const raceMount=document.getElementById("race-stage");
  const operatorMount=document.querySelector("#operator-screen .layout");
  if(stage&&raceMount&&operatorMount){
    if(path==="/race")raceMount.append(stage);
    else operatorMount.prepend(stage);
  }
  window.scrollTo(0,0);
}
document.addEventListener("click",e=>{
 const a=e.target.closest('a[href^="/"]');
 if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;
 const dest=a.getAttribute("href");
 if(!(dest in PAGES))return;
 e.preventDefault();
 history.pushState({}, "",dest);
 showPage();
});
window.addEventListener("popstate",showPage);
showPage();
fetch("/api/status").then(r=>r.json()).then(data=>{
 const el=document.getElementById("game-gpu");
 if(el)el.textContent=data.configured?"GPU URL configured, connection still unverified":"GPU not configured";
}).catch(()=>{const el=document.getElementById("game-gpu");if(el)el.textContent="Cannot read local backend status";});
