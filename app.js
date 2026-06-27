/* =========================================================================
   IRONLEDGER · app logic (vanilla JS, no build step)
   ========================================================================= */
const $  = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const STORE = "ironledger.v1";
const DRAFT_STORE = "ironledger.draft.v1";

/* ---------- persistence ----------
   localStorage can be unavailable (private mode) or full (quota). We probe
   once, and every write reports success so the UI can warn instead of
   silently losing a workout. */
function storageAvailable(){
  try{
    const k="__ironledger_probe__";
    localStorage.setItem(k,"1"); localStorage.removeItem(k);
    return true;
  }catch{ return false; }
}
const STORAGE_OK = storageAvailable();

function load(){ try{ return JSON.parse(localStorage.getItem(STORE)) || {sessions:[]}; }catch{ return {sessions:[]}; } }
function save(d){
  try{ localStorage.setItem(STORE, JSON.stringify(d)); return true; }
  catch(e){ console.error("IronLedger: session save failed", e); return false; }
}
let DB = load();

/* current draft session: [{id,name,muscle,equipment,sets,reps,weight}].
   Persisted on every change so a refresh or crash mid-workout doesn't lose it. */
function loadDraft(){ try{ return JSON.parse(localStorage.getItem(DRAFT_STORE)) || []; }catch{ return []; } }
function saveDraft(){ try{ localStorage.setItem(DRAFT_STORE, JSON.stringify(draft)); }catch{} }
let draft = loadDraft();

/* ---------- toast ---------- */
let toastT;
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ---------- tonnage (signature counter) ---------- */
function totalTonnage(){
  return DB.sessions.reduce((a,s)=>a+s.tonnage,0);
}
function animateTonnage(toVal){
  const el=$("#tonnageNum"); const from=Number(el.dataset.v||0); const start=performance.now(); const dur=600;
  function step(now){
    const p=Math.min(1,(now-start)/dur);
    const eased=1-Math.pow(1-p,3);
    const v=Math.round(from+(toVal-from)*eased);
    el.textContent=v.toLocaleString();
    if(p<1) requestAnimationFrame(step); else el.dataset.v=toVal;
  }
  requestAnimationFrame(step);
}

/* =========================================================================
   VIEW: DATABASE
   ========================================================================= */
let activeMuscle="All", activeEquip="All", query="";

function buildFilters(){
  const mrow=$("#muscleChips");
  mrow.innerHTML = ["All",...MUSCLES].map(m=>
    `<button class="chip m" data-m="${m}" data-on="${m==='All'}">${m}</button>`).join("");
  const erow=$("#equipChips");
  erow.innerHTML = ["All",...EQUIPMENT].map(e=>
    `<button class="chip" data-e="${e}" data-on="${e==='All'}">${e}</button>`).join("");

  mrow.addEventListener("click",e=>{
    const b=e.target.closest(".chip"); if(!b)return;
    activeMuscle=b.dataset.m;
    $$(".chip",mrow).forEach(c=>c.dataset.on=(c.dataset.m===activeMuscle));
    renderDB();
  });
  erow.addEventListener("click",e=>{
    const b=e.target.closest(".chip"); if(!b)return;
    activeEquip=b.dataset.e;
    $$(".chip",erow).forEach(c=>c.dataset.on=(c.dataset.e===activeEquip));
    renderDB();
  });
  $("#search").addEventListener("input",e=>{ query=e.target.value.toLowerCase().trim(); renderDB(); });
}

function renderDB(){
  const list = EXERCISES.filter(x=>
    (activeMuscle==="All"||x.muscle===activeMuscle) &&
    (activeEquip==="All"||x.equipment===activeEquip) &&
    (!query || x.name.toLowerCase().includes(query) || x.group.toLowerCase().includes(query) || x.focus.toLowerCase().includes(query))
  );
  $("#dbCount").textContent = `${list.length} / ${EXERCISES.length} lifts`;
  const grid=$("#dbGrid");
  if(!list.length){ grid.innerHTML=`<div class="empty">No lifts match that filter. Loosen the search.</div>`; return; }
  grid.innerHTML = list.map(x=>`
    <article class="ex">
      <span class="tag-muscle" style="background:${MUSCLE_COLOR[x.muscle]}">${x.muscle}</span>
      <h3>${x.name}</h3>
      <div class="meta">
        <span>${x.group}</span>
        <span>${x.focus}</span>
        <span class="equip">${x.equipment}</span>
      </div>
      <button class="addbtn" data-add="${x.id}">+ Add to session</button>
    </article>`).join("");
  $$("[data-add]",grid).forEach(b=>b.onclick=()=>addToDraft(+b.dataset.add));
}

/* =========================================================================
   VIEW: LOGGER
   ========================================================================= */
function addToDraft(id){
  const x=EXERCISES.find(e=>e.id===id); if(!x)return;
  draft.push({id:x.id,name:x.name,muscle:x.muscle,equipment:x.equipment,sets:3,reps:10,weight:20});
  toast(`Added ${x.name}`);
  renderDraft();
}
function rowTonnage(r){ return (r.sets||0)*(r.reps||0)*(r.weight||0); }

function renderDraft(){
  const box=$("#logRows");
  if(!draft.length){
    box.innerHTML=`<div class="empty">Session empty. Add lifts from the Database tab, or start logging here.</div>`;
  } else {
    box.innerHTML = draft.map((r,i)=>`
      <div class="log-row">
        <div class="lr-name">${r.name}<small>${r.muscle} · ${r.equipment}</small></div>
        <label><span class="field-lbl">Sets</span><input type="number" min="0" value="${r.sets}" data-i="${i}" data-k="sets"></label>
        <label><span class="field-lbl">Reps</span><input type="number" min="0" value="${r.reps}" data-i="${i}" data-k="reps"></label>
        <label><span class="field-lbl">Kg</span><input type="number" min="0" step="0.5" value="${r.weight}" data-i="${i}" data-k="weight"></label>
        <button class="del" data-del="${i}" title="Remove">×</button>
      </div>`).join("");
    $$("#logRows input").forEach(inp=>inp.oninput=()=>{
      draft[+inp.dataset.i][inp.dataset.k]=parseFloat(inp.value)||0;
      renderSummary();
    });
    $$("#logRows .del").forEach(b=>b.onclick=()=>{ draft.splice(+b.dataset.del,1); renderDraft(); });
  }
  renderSummary();
}
function renderSummary(){
  const lifts=draft.length;
  const sets=draft.reduce((a,r)=>a+(+r.sets||0),0);
  const tons=draft.reduce((a,r)=>a+rowTonnage(r),0);
  $("#sumLifts").textContent=lifts;
  $("#sumSets").textContent=sets;
  $("#sumTons").textContent=tons.toLocaleString();
  $("#saveBtn").disabled = lifts===0;
  saveDraft();   // persist in-progress work so a refresh doesn't lose it
}

function saveSession(){
  if(!draft.length)return;
  const date=$("#sessDate").value || new Date().toISOString().slice(0,10);
  const tonnage=draft.reduce((a,r)=>a+rowTonnage(r),0);
  const session={
    id:Date.now(), date, tonnage,
    items:draft.map(r=>({name:r.name,muscle:r.muscle,sets:r.sets,reps:r.reps,weight:r.weight,tonnage:rowTonnage(r)})),
  };
  DB.sessions.unshift(session);
  const ok=save(DB);
  draft=[];
  renderDraft();
  renderHistory();
  animateTonnage(totalTonnage());
  toast(ok
    ? `Session saved · ${tonnage.toLocaleString()} kg moved`
    : "⚠ Couldn't save to this browser — export a backup to keep this!");

  /* tag the user in OneSignal so workout-streak segments are possible */
  pushTag("sessions_logged", String(DB.sessions.length));
  pushTag("last_workout", date);
  switchView("history");
}

/* =========================================================================
   VIEW: HISTORY
   ========================================================================= */
function renderHistory(){
  const box=$("#histList");
  if(!DB.sessions.length){
    box.innerHTML=`<div class="empty">No sessions yet. Your logged workouts will stack up here.</div>`;
    $("#histTotal").textContent="0"; $("#histCount").textContent="0";
    return;
  }
  $("#histTotal").textContent=totalTonnage().toLocaleString();
  $("#histCount").textContent=DB.sessions.length;
  box.innerHTML = DB.sessions.map(s=>`
    <div class="session">
      <div class="shead">
        <span class="sdate">${fmtDate(s.date)}</span>
        <span class="stons">${s.tonnage.toLocaleString()} kg moved</span>
        <button class="del" data-rm="${s.id}" title="Delete session">×</button>
      </div>
      <ul>${s.items.map(it=>`<li><span>${it.name}</span><span>${it.sets}×${it.reps} @ ${it.weight}kg</span></li>`).join("")}</ul>
    </div>`).join("");
  $$("#histList .del").forEach(b=>b.onclick=()=>{
    DB.sessions=DB.sessions.filter(s=>s.id!=+b.dataset.rm);
    save(DB); renderHistory(); animateTonnage(totalTonnage());
  });
}
function fmtDate(iso){
  const d=new Date(iso+"T00:00:00");
  if(isNaN(d)) return iso;
  return d.toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
}

/* =========================================================================
   BACKUP: export / import  (so data survives a cleared cache or new browser)
   ========================================================================= */
function exportData(){
  try{
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`ironledger-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast(`Backup downloaded · ${DB.sessions.length} sessions`);
  }catch(e){ console.error(e); toast("Export failed."); }
}

function importData(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      if(!parsed || !Array.isArray(parsed.sessions)) throw new Error("not an IronLedger backup");
      /* merge with what's already here, de-duping by session id */
      const byId=new Map();
      [...DB.sessions,...parsed.sessions].forEach(s=>{ if(s && s.id!=null) byId.set(s.id,s); });
      DB.sessions=[...byId.values()].sort((a,b)=>b.id-a.id);
      save(DB);
      renderHistory();
      animateTonnage(totalTonnage());
      toast(`Imported · ${parsed.sessions.length} sessions merged`);
    }catch(e){ console.error(e); toast("Import failed — not a valid IronLedger backup."); }
  };
  reader.onerror=()=>toast("Couldn't read that file.");
  reader.readAsText(file);
}

/* =========================================================================
   VIEW: SAFETY
   ========================================================================= */
function renderSafety(){
  $("#injuries").innerHTML = INJURIES.map((inj,i)=>`
    <div class="acc" data-open="${i===0}">
      <button data-acc>${inj.area}<span class="mono">${i===0?'–':'+'}</span></button>
      <div class="body">
        <p>${inj.issue}</p>
        <strong class="mono" style="font-size:11px;letter-spacing:.15em">PREVENTION</strong>
        <ul>${inj.prevention.map(p=>`<li>${p}</li>`).join("")}</ul>
        <div class="tip">${inj.tip}</div>
      </div>
    </div>`).join("");
  $$("#injuries [data-acc]").forEach(b=>b.onclick=()=>{
    const acc=b.parentElement; const open=acc.dataset.open==="true";
    acc.dataset.open=String(!open);
    b.querySelector(".mono").textContent = open?"+":"–";
  });

  $("#redFlags").innerHTML = `
    <thead><tr><th>Symptom</th><th>Likely DOMS — keep training</th><th>Red flag — stop & see a pro</th></tr></thead>
    <tbody>${RED_FLAGS.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td><td class="flag">${r[2]}</td></tr>`).join("")}</tbody>`;

  $("#seePro").innerHTML = SEE_PRO.map(s=>`<li>${s}</li>`).join("");

  $("#cues").innerHTML = `
    <thead><tr><th>Exercise</th><th>Common error</th><th>External cue (fix)</th></tr></thead>
    <tbody>${CUES.map(c=>`<tr><th>${c[0]}</th><td>${c[1]}</td><td>${c[2]}</td></tr>`).join("")}</tbody>`;

  $("#brace").innerHTML = BRACE.map((b,i)=>`<li><span>${b}</span><span class="mono">0${i+1}</span></li>`).join("");
}

/* =========================================================================
   TAB ROUTING
   ========================================================================= */
function switchView(name){
  $$(".tab").forEach(t=>t.setAttribute("aria-selected", String(t.dataset.view===name)));
  $$(".view").forEach(v=>v.classList.toggle("active", v.id===`view-${name}`));
  window.scrollTo({top:0,behavior:"smooth"});
}

/* =========================================================================
   ONESIGNAL HOOKS  (SDK is initialised in index.html <head>)
   ========================================================================= */
function osReady(cb){
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(cb);
}
function pushTag(key,val){
  osReady(async OneSignal=>{ try{ await OneSignal.User.addTag(key,val); }catch(e){ console.warn("OneSignal tag failed",e); } });
}
function refreshBellStatus(){
  osReady(async OneSignal=>{
    try{
      const optedIn = OneSignal.User?.PushSubscription?.optedIn;
      $("#bellStatus").textContent = optedIn ? "Reminders ON" : "Reminders OFF";
    }catch{ $("#bellStatus").textContent="Unavailable"; }
  });
}
function enableReminders(){
  osReady(async OneSignal=>{
    try{
      await OneSignal.Slidedown.promptPush();           // shows the OneSignal prompt
      await OneSignal.User.addTag("app","ironledger");
      refreshBellStatus();
      toast("Browser will ask for notification permission.");
    }catch(e){
      console.warn(e);
      toast("Push needs an HTTPS host + OneSignal dashboard config.");
    }
  });
}

/* =========================================================================
   INIT
   ========================================================================= */
function init(){
  // default session date = today
  $("#sessDate").value = new Date().toISOString().slice(0,10);

  buildFilters();
  renderDB();
  renderDraft();
  renderHistory();
  renderSafety();

  $$(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.view));
  $("#saveBtn").onclick=saveSession;
  $("#clearBtn").onclick=()=>{ if(draft.length){ draft=[]; renderDraft(); toast("Session cleared."); } };
  $("#bellBtn").onclick=enableReminders;

  /* backup controls */
  $("#exportBtn").onclick=exportData;
  $("#importBtn").onclick=()=>$("#importFile").click();
  $("#importFile").onchange=e=>{ const f=e.target.files[0]; if(f){ importData(f); e.target.value=""; } };

  animateTonnage(totalTonnage());
  refreshBellStatus();

  if(!STORAGE_OK){
    toast("⚠ This browser blocks local storage — sessions won't be saved. Export backups to keep them.");
  }
}
document.addEventListener("DOMContentLoaded",init);
