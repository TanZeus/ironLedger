const $  = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const STORE = "ironledger.v1";
const DRAFT_STORE = "ironledger.draft.v1";
const EQUIP_STORE = "ironledger.equipment.v1";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => (
  {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
));
const num = v => Number.isFinite(+v) ? +v : 0;

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
  catch(e){ console.error("Dopamove Web: session save failed", e); return false; }
}
let DB = load();

function loadDraft(){ try{ return JSON.parse(localStorage.getItem(DRAFT_STORE)) || []; }catch{ return []; } }
function saveDraft(){ try{ localStorage.setItem(DRAFT_STORE, JSON.stringify(draft)); }catch{} }
let draft = loadDraft();

let toastT;
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2200);
}

function sessionTonnage(s){
  if(Number.isFinite(+s?.tonnage)) return +s.tonnage;
  return (s?.items||[]).reduce((a,it)=>a+num(it.sets)*num(it.reps)*num(it.weight),0);
}
function totalTonnage(){
  return DB.sessions.reduce((a,s)=>a+sessionTonnage(s),0);
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

let activeMuscle="All", activeEquip="All", query="";

function buildFilters(){
  const mrow=$("#muscleChips");
  mrow.innerHTML = ["All",...MUSCLES].map(m=>
    `<button class="chip m" data-m="${esc(m)}" data-on="${m==='All'}">${esc(m)}</button>`).join("");
  const erow=$("#equipChips");
  erow.innerHTML = ["All",...EQUIPMENT].map(e=>
    `<button class="chip" data-e="${esc(e)}" data-on="${e==='All'}">${esc(e)}</button>`).join("");

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
      <span class="tag-muscle" style="background:${MUSCLE_COLOR[x.muscle]}">${esc(x.muscle)}</span>
      <h3>${esc(x.name)}</h3>
      <div class="meta">
        <span>${esc(x.group)}</span>
        <span>${esc(x.focus)}</span>
        <span class="equip">${esc(x.equipment)}</span>
      </div>
      <button class="addbtn" data-add="${x.id}">+ Add to session</button>
    </article>`).join("");
  $$("[data-add]",grid).forEach(b=>b.onclick=()=>addToDraft(+b.dataset.add));
}

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
        <div class="lr-name">${esc(r.name)}<small>${esc(r.muscle)} · ${esc(r.equipment)}</small></div>
        <label><span class="field-lbl">Sets</span><input type="number" min="0" value="${num(r.sets)}" data-i="${i}" data-k="sets"></label>
        <label><span class="field-lbl">Reps</span><input type="number" min="0" value="${num(r.reps)}" data-i="${i}" data-k="reps"></label>
        <label><span class="field-lbl">Kg</span><input type="number" min="0" step="0.5" value="${num(r.weight)}" data-i="${i}" data-k="weight"></label>
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
  saveDraft();
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
  renderProgress();
  animateTonnage(totalTonnage());
  toast(ok
    ? `Session saved · ${tonnage.toLocaleString()} kg moved`
    : "⚠ Couldn't save to this browser — export a backup to keep this!");

  pushTag("sessions_logged", String(DB.sessions.length));
  pushTag("last_workout", date);
  switchView("history");
}

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
        <span class="sdate">${esc(fmtDate(s.date))}</span>
        <span class="stons">${sessionTonnage(s).toLocaleString()} kg moved</span>
        <button class="del" data-rm="${s.id}" title="Delete session">×</button>
      </div>
      <ul>${(s.items||[]).map(it=>`<li><span>${esc(it.name)}</span><span>${num(it.sets)}×${num(it.reps)} @ ${num(it.weight)}kg</span></li>`).join("")}</ul>
    </div>`).join("");
  $$("#histList .del").forEach(b=>b.onclick=()=>{
    DB.sessions=DB.sessions.filter(s=>s.id!=+b.dataset.rm);
    save(DB); renderHistory(); renderProgress(); animateTonnage(totalTonnage());
  });
}
function fmtDate(iso){
  const d=new Date(iso+"T00:00:00");
  if(isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
}

function exportData(){
  try{
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`dopamove-backup-${new Date().toISOString().slice(0,10)}.json`;
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
      if(!parsed || !Array.isArray(parsed.sessions)) throw new Error("not a Dopamove Web backup");
      const byId=new Map();
      [...DB.sessions,...parsed.sessions].forEach(s=>{
        if(s && s.id!=null){ s.tonnage=sessionTonnage(s); byId.set(s.id,s); }
      });
      DB.sessions=[...byId.values()].sort((a,b)=>b.id-a.id);
      save(DB);
      renderHistory();
      renderProgress();
      animateTonnage(totalTonnage());
      toast(`Imported · ${parsed.sessions.length} sessions merged`);
    }catch(e){ console.error(e); toast("Import failed — not a valid Dopamove Web backup."); }
  };
  reader.onerror=()=>toast("Couldn't read that file.");
  reader.readAsText(file);
}

let prog = { lift:null, metric:"e1rm", q:"" };

const PROG_METRICS = {
  weight: {label:"Top weight", get:p=>p.weight},
  e1rm:   {label:"Est. 1RM",   get:p=>p.e1rm},
  volume: {label:"Volume",     get:p=>p.volume},
};

const fmtKg = n => (Math.round(num(n)*10)/10).toLocaleString();
function fmtShort(iso){
  const d=new Date(iso+"T00:00:00");
  if(isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined,{day:"2-digit",month:"short"});
}

function progressIndex(){
  const map=new Map();
  [...DB.sessions].sort((a,b)=>(a.id||0)-(b.id||0)).forEach(s=>{
    (s.items||[]).forEach(it=>{
      const w=num(it.weight), reps=num(it.reps), sets=num(it.sets);
      const r=map.get(it.name)||{name:it.name,muscle:it.muscle,points:[]};
      r.points.push({id:s.id||0, date:s.date, weight:w, reps, sets, volume:sets*reps*w, e1rm:w>0?w*(1+reps/30):0});
      map.set(it.name,r);
    });
  });
  return map;
}

function liftStats(r){
  let bestW=0,bestE=0,bestV=0,totalV=0;
  r.points.forEach(p=>{
    bestW=Math.max(bestW,p.weight);
    bestE=Math.max(bestE,p.e1rm);
    bestV=Math.max(bestV,p.volume);
    totalV+=p.volume;
  });
  return {sessions:r.points.length, bestW, bestE, bestV, totalV, last:r.points[r.points.length-1]};
}

function progChart(points, getVal){
  const W=680,H=260,pl=46,pr=14,pt=16,pb=34;
  const vals=points.map(getVal);
  const n=vals.length;
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(lo===hi){ lo=Math.max(0,lo-1); hi=hi+1; }
  const span=hi-lo;
  const X=i=> n<=1 ? pl+(W-pl-pr)/2 : pl+i*(W-pl-pr)/(n-1);
  const Y=v=> H-pb-((v-lo)/span)*(H-pt-pb);

  let run=-Infinity;
  const prFlag=vals.map(v=>{ const f=v>run && v>0; if(v>run) run=v; return f; });
  let bi=0; vals.forEach((v,i)=>{ if(v>vals[bi]) bi=i; });

  const ticks=[lo,(lo+hi)/2,hi];
  const grid=ticks.map(t=>{
    const yy=Y(t).toFixed(1);
    return `<line x1="${pl}" y1="${yy}" x2="${W-pr}" y2="${yy}" class="cgrid"/>`+
           `<text x="${pl-7}" y="${(+yy+4).toFixed(1)}" class="cyl" text-anchor="end">${fmtKg(t)}</text>`;
  }).join("");

  const line = n>1 ? `<polyline points="${vals.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" class="cline"/>` : "";

  const dots=vals.map((v,i)=>{
    const cx=X(i).toFixed(1), cy=Y(v).toFixed(1), isPR=prFlag[i];
    return `<circle cx="${cx}" cy="${cy}" r="${isPR?5:3.2}" class="${isPR?'cpr':'cdot'}"><title>${esc(fmtShort(points[i].date))}: ${fmtKg(v)}kg${isPR?' · PR':''}</title></circle>`;
  }).join("");

  const bestY=Math.max(Y(vals[bi])-10, 12).toFixed(1);
  const bestLabel=`<text x="${X(bi).toFixed(1)}" y="${bestY}" class="cbest" text-anchor="middle">${fmtKg(vals[bi])}</text>`;

  const xi=[...new Set([0, Math.floor((n-1)/2), n-1])];
  const xlabels=xi.map(i=>`<text x="${X(i).toFixed(1)}" y="${H-12}" class="cxl" text-anchor="middle">${esc(fmtShort(points[i].date))}</text>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Trend chart">${grid}${line}${dots}${bestLabel}${xlabels}</svg>`;
}

function prCard(label,o){
  if(!o.name) return "";
  return `<div class="pr-card"><span>${esc(label)}</span><b>${fmtKg(o.v)}<i>kg</i></b><small>${esc(o.name)}</small></div>`;
}

function renderProgressDetail(idx){
  const box=$("#progDetail");
  const r = prog.lift && idx.get(prog.lift);
  if(!r){ box.innerHTML=`<div class="empty">Your per-lift trends will appear here.</div>`; return; }
  const m=PROG_METRICS[prog.metric], st=liftStats(r);
  const metricChips=Object.entries(PROG_METRICS).map(([k,v])=>
    `<button class="chip" data-metric="${esc(k)}" data-on="${k===prog.metric}">${esc(v.label)}</button>`).join("");
  const recent=[...r.points].slice(-12).reverse();
  box.innerHTML=`
    <div class="prog-head">
      <span class="prog-tag" style="background:${MUSCLE_COLOR[r.muscle]||'var(--ink)'}">${esc(r.muscle)}</span>
      <h3>${esc(r.name)}</h3>
    </div>
    <div class="prog-stats">
      <div class="stat"><span>Sessions</span><b>${st.sessions}</b></div>
      <div class="stat"><span>Top weight</span><b>${fmtKg(st.bestW)}<i>kg</i></b></div>
      <div class="stat"><span>Best est. 1RM</span><b>${fmtKg(st.bestE)}<i>kg</i></b></div>
      <div class="stat"><span>Best session vol.</span><b>${fmtKg(st.bestV)}<i>kg</i></b></div>
    </div>
    <div class="chip-row" style="margin:4px 0 14px">${metricChips}</div>
    <div class="chart-wrap">${progChart(r.points,m.get)}</div>
    <div class="scrollx"><table class="brut prog-table">
      <thead><tr><th>Date</th><th>Sets×Reps</th><th>Weight</th><th>Est. 1RM</th><th>Volume</th></tr></thead>
      <tbody>${recent.map(p=>`<tr><th>${esc(fmtShort(p.date))}</th><td>${num(p.sets)}×${num(p.reps)}</td><td>${fmtKg(p.weight)}kg</td><td>${fmtKg(p.e1rm)}kg</td><td>${fmtKg(p.volume)}kg</td></tr>`).join("")}</tbody>
    </table></div>`;
  $$("[data-metric]",box).forEach(b=>b.onclick=()=>{ prog.metric=b.dataset.metric; renderProgressDetail(idx); });
}

function renderProgress(){
  const idx=progressIndex();
  const rec=$("#prRecords"), box=$("#progList");
  if(!idx.size){
    rec.innerHTML="";
    box.innerHTML=`<div class="empty">No lifts logged yet. Save a session to start tracking PRs.</div>`;
    $("#progDetail").innerHTML=`<div class="empty">Your per-lift trends will appear here.</div>`;
    return;
  }
  let heavy={v:0}, e1={v:0}, vol={v:0};
  idx.forEach(r=>{
    const st=liftStats(r);
    if(st.bestW>heavy.v) heavy={v:st.bestW,name:r.name};
    if(st.bestE>e1.v) e1={v:st.bestE,name:r.name};
    if(st.bestV>vol.v) vol={v:st.bestV,name:r.name};
  });
  rec.innerHTML=`${prCard("Heaviest lift",heavy)}${prCard("Best est. 1RM",e1)}${prCard("Biggest session",vol)}`;

  if(prog.lift && !idx.get(prog.lift)) prog.lift=null;
  const items=[...idx.values()].map(r=>({r,st:liftStats(r)}))
    .filter(({r})=>!prog.q || r.name.toLowerCase().includes(prog.q))
    .sort((a,b)=>(b.r.points[b.r.points.length-1].id)-(a.r.points[a.r.points.length-1].id));
  if(!prog.lift && items.length) prog.lift=items[0].r.name;

  box.innerHTML = items.length ? items.map(({r,st})=>`
    <button class="prog-item" data-lift="${esc(r.name)}" data-on="${r.name===prog.lift}">
      <b>${esc(r.name)}</b>
      <span>${st.sessions}× · top ${fmtKg(st.bestW)}kg · 1RM ${fmtKg(st.bestE)}kg</span>
    </button>`).join("") : `<div class="empty">No lifts match.</div>`;
  $$("[data-lift]",box).forEach(b=>b.onclick=()=>{ prog.lift=b.dataset.lift; renderProgress(); });

  renderProgressDetail(idx);
}

function renderSafety(){
  $("#injuries").innerHTML = INJURIES.map((inj,i)=>`
    <div class="acc" data-open="${i===0}">
      <button data-acc aria-expanded="${i===0}">${esc(inj.area)}<span class="mono">${i===0?'–':'+'}</span></button>
      <div class="body">
        <p>${esc(inj.issue)}</p>
        <strong class="mono" style="font-size:11px;letter-spacing:.15em">PREVENTION</strong>
        <ul>${inj.prevention.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>
        <div class="tip">${esc(inj.tip)}</div>
      </div>
    </div>`).join("");
  $$("#injuries [data-acc]").forEach(b=>b.onclick=()=>{
    const acc=b.parentElement; const open=acc.dataset.open==="true";
    acc.dataset.open=String(!open);
    b.setAttribute("aria-expanded", String(!open));
    b.querySelector(".mono").textContent = open?"+":"–";
  });

  $("#redFlags").innerHTML = `
    <thead><tr><th>Symptom</th><th>Likely DOMS — keep training</th><th>Red flag — stop & see a pro</th></tr></thead>
    <tbody>${RED_FLAGS.map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td><td class="flag">${esc(r[2])}</td></tr>`).join("")}</tbody>`;

  $("#seePro").innerHTML = SEE_PRO.map(s=>`<li>${esc(s)}</li>`).join("");

  $("#cues").innerHTML = `
    <thead><tr><th>Exercise</th><th>Common error</th><th>External cue (fix)</th></tr></thead>
    <tbody>${CUES.map(c=>`<tr><th>${esc(c[0])}</th><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join("")}</tbody>`;

  $("#brace").innerHTML = BRACE.map((b,i)=>`<li><span>${esc(b)}</span><span class="mono">0${i+1}</span></li>`).join("");
}

function loadEquip(){
  try{
    const saved=JSON.parse(localStorage.getItem(EQUIP_STORE));
    if(Array.isArray(saved)){
      const valid=saved.filter(e=>EQUIPMENT.includes(e));
      if(valid.length) return new Set(valid);
    }
  }catch{}
  return new Set(EQUIPMENT);
}
function saveEquip(set){ try{ localStorage.setItem(EQUIP_STORE, JSON.stringify([...set])); }catch{} }

let gen = { mode:null, intensity:"hypertrophy", focus:"Full body", count:6, histMode:"recent", goal:"fatLoss", equipment:loadEquip(), result:[] };

const INTENSITY = {
  deload:       {label:"Deload",       sets:2, reps:14, load:0.60, accent:"var(--blue)",   note:"Recovery — light, clean reps to flush volume without taxing you."},
  hypertrophy:  {label:"Hypertrophy",  sets:4, reps:10, load:0.75, accent:"var(--lime)",   note:"Muscle growth — moderate load in the classic 8–12 rep range."},
  strength:     {label:"Strength",     sets:5, reps:4,  load:0.90, accent:"var(--coral)",  note:"Heavy, low-rep work with long rests. Brace hard, leave 1–2 in the tank."},
  conditioning: {label:"Conditioning", sets:3, reps:18, load:0.50, accent:"var(--orange)", note:"High-rep, short-rest pump work to build work capacity."},
};

const GOALS = {
  fatLoss:      {label:"Lose Weight",    sets:3, reps:20, load:0.50, accent:"var(--orange)", note:"Full-body circuits at high rep ranges to maximise calorie burn while preserving muscle.", equipPref:null,         bias:["Functional","Legs","Back"]},
  buildMuscle:  {label:"Build Muscle",   sets:4, reps:10, load:0.75, accent:"var(--lime)",   note:"Classic hypertrophy rep range — moderate load, controlled tempo, 60–90 s rest between sets.", equipPref:null,         bias:null},
  getStronger:  {label:"Get Stronger",   sets:5, reps:4,  load:0.90, accent:"var(--coral)",  note:"Heavy compound barbell lifts, long rests — leave 1–2 reps in the tank each set.", equipPref:"Barbell",    bias:null},
  endurance:    {label:"Endurance",      sets:3, reps:25, load:0.40, accent:"var(--blue)",   note:"Light loads, very high reps, minimal rest — build cardiovascular and muscular stamina.", equipPref:"Bodyweight", bias:["Functional","Legs"]},
  generalFitness:{label:"General Fitness",sets:3,reps:15, load:0.65, accent:"var(--violet)", note:"Balanced work across all major movement patterns — a solid, all-round base.", equipPref:null,         bias:null},
};

function historyIndex(){
  const map=new Map();
  DB.sessions.forEach(s=>{
    (s.items||[]).forEach(it=>{
      const r=map.get(it.name)||{name:it.name,muscle:it.muscle,count:0,lastWeight:0,bestWeight:0,reps:it.reps,sets:it.sets,lastSeen:0};
      r.count++;
      const t=s.id||0;
      if(t>=r.lastSeen){ r.lastSeen=t; r.lastWeight=it.weight; r.reps=it.reps; r.sets=it.sets; }
      r.bestWeight=Math.max(r.bestWeight, it.weight||0);
      map.set(it.name,r);
    });
  });
  return map;
}

function baselineWeight(ex){
  const eq=(ex.equipment||"").toLowerCase();
  if(/body|none/.test(eq)) return 0;
  if(/barbell|trap|smith/.test(eq)) return 40;
  if(/machine|cable|press/.test(eq)) return 35;
  if(/dumbbell|kettlebell/.test(eq)) return 12;
  if(/sandbag|mace|plate/.test(eq)) return 15;
  return 20;
}
const roundKg = w => Math.max(0, Math.round((w||0)*2)/2);
const exByName = name => EXERCISES.find(e=>e.name===name);
function toRow(ex,sets,reps,weight,why){
  return {id:ex.id, name:ex.name, muscle:ex.muscle, equipment:ex.equipment||"", sets, reps, weight:roundKg(weight), why};
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

function genFromIntensity(){
  const p=INTENSITY[gen.intensity];
  const idx=historyIndex();
  /* only build from gear the lifter actually has; fall back to everything if
     nothing is selected so we never hand back an empty workout */
  const haveAll = gen.equipment.size===0 || gen.equipment.size===EQUIPMENT.length;
  const owned = ex => haveAll || gen.equipment.has(ex.equipment);
  let picks;
  if(gen.focus==="Full body"){
    const byMuscle={}; MUSCLES.filter(m=>m!=="Cardio").forEach(m=>byMuscle[m]=shuffle(EXERCISES.filter(e=>e.muscle===m && owned(e))));
    const muscles=MUSCLES.filter(m=>byMuscle[m]?.length);
    picks=[]; let mi=0, guard=0;
    while(picks.length<gen.count && muscles.length && guard++<400){
      const arr=byMuscle[muscles[mi++%muscles.length]];
      if(arr&&arr.length) picks.push(arr.pop());
    }
  } else {
    /* no owned lift for this muscle → return nothing so generate() can explain,
       rather than silently handing back unrelated movements */
    const pool=EXERCISES.filter(e=>e.muscle===gen.focus && owned(e));
    picks=shuffle(pool).slice(0,gen.count);
  }
  return picks.map(ex=>{
    const h=idx.get(ex.name);
    const anchor=h?(h.bestWeight||h.lastWeight||0):0;
    const weight=h ? anchor*p.load : baselineWeight(ex)*(p.load/0.75);
    const why=h ? `tuned to your best ${anchor}kg` : `${p.label.toLowerCase()} baseline`;
    return toRow(ex,p.sets,p.reps,weight,why);
  });
}

function genFromGoal(){
  const g=GOALS[gen.goal];
  if(!g) return [];
  const idx=historyIndex();
  const haveAll=gen.equipment.size===0||gen.equipment.size===EQUIPMENT.length;
  const ownedBase=ex=>haveAll||gen.equipment.has(ex.equipment);
  const pickPool=muscle=>{
    const all=EXERCISES.filter(e=>e.muscle===muscle&&ownedBase(e));
    if(!g.equipPref) return shuffle([...all]);
    const pref=all.filter(e=>e.equipment===g.equipPref);
    return shuffle(pref.length>=2?[...pref]:[...all]);
  };
  let picks;
  if(gen.focus==="Full body"){
    const byMuscle={};
    MUSCLES.filter(m=>m!=="Cardio").forEach(m=>byMuscle[m]=pickPool(m));
    const muscleOrder=g.bias
      ?[...g.bias.filter(m=>byMuscle[m]?.length),...MUSCLES.filter(m=>m!=="Cardio"&&!g.bias.includes(m)&&byMuscle[m]?.length)]
      :MUSCLES.filter(m=>m!=="Cardio"&&byMuscle[m]?.length);
    picks=[];let mi=0,guard=0;
    while(picks.length<gen.count&&muscleOrder.length&&guard++<400){
      const arr=byMuscle[muscleOrder[mi++%muscleOrder.length]];
      if(arr&&arr.length) picks.push(arr.pop());
    }
  } else {
    picks=pickPool(gen.focus).slice(0,gen.count);
  }
  return picks.map(ex=>{
    const h=idx.get(ex.name);
    const anchor=h?(h.bestWeight||h.lastWeight||0):0;
    const weight=h?anchor*g.load:baselineWeight(ex)*(g.load/0.75);
    const why=h?`tuned to your best ${anchor}kg`:`${g.label.toLowerCase()} baseline`;
    return toRow(ex,g.sets,g.reps,weight,why);
  });
}

function genFromHistory(){
  if(!DB.sessions.length) return [];
  const idx=historyIndex();
  if(gen.histMode==="recent"){
    const last=DB.sessions[0];
    return (last.items||[]).map(it=>{
      const ex=exByName(it.name)||{id:Date.now()+Math.random(),name:it.name,muscle:it.muscle,equipment:""};
      return toRow(ex,it.sets,it.reps,it.weight,"repeat of last session");
    });
  }
  let ranked=[...idx.values()].sort((a,b)=>b.count-a.count || b.lastSeen-a.lastSeen);
  if(gen.focus!=="Full body"){
    const f=ranked.filter(r=>r.muscle===gen.focus);
    if(f.length) ranked=f;
  } else {
    ranked=ranked.filter(r=>r.muscle!=="Cardio");
  }
  return ranked.slice(0,gen.count).map(r=>{
    const ex=exByName(r.name)||{id:Date.now()+Math.random(),name:r.name,muscle:r.muscle,equipment:""};
    if(gen.histMode==="progressive"){
      return toRow(ex, r.sets||3, r.reps||8, (r.lastWeight||r.bestWeight)*1.025, `progressive · +2.5% on ${r.lastWeight||r.bestWeight}kg`);
    }
    return toRow(ex, r.sets||3, r.reps||10, r.lastWeight||r.bestWeight||baselineWeight(ex), `logged ${r.count}× · last ${r.lastWeight}kg`);
  });
}

function generate(){
  const rows = gen.mode==="history" ? genFromHistory() : gen.mode==="goal" ? genFromGoal() : genFromIntensity();
  if(!rows.length){
    let msg="Couldn't build a workout.";
    if(gen.mode==="history"){
      msg="No history yet — log a session, or use 'By intensity'.";
    } else if(gen.equipment.size && gen.equipment.size<EQUIPMENT.length){
      msg = gen.focus==="Full body"
        ? "No lifts match your equipment — add some gear above."
        : `No ${gen.focus} lifts for your equipment — try another focus or add gear.`;
    }
    toast(msg);
    return;
  }
  gen.result=rows;
  renderGenResult();
  showLayer(3);
}

/* short label of the gear a generated workout was built from */
function equipSummary(){
  const sz=gen.equipment.size;
  if(sz===0 || sz===EQUIPMENT.length) return "Full kit";
  const list=[...gen.equipment];
  return list.length<=3 ? list.join(" · ") : `${sz} equipment types`;
}

/* how many lifts the current equipment selection unlocks */
function equipNoteText(){
  if(gen.equipment.size===0) return "No equipment selected — pick what you've got, or the engine falls back to the full library.";
  const n=EXERCISES.filter(e=>gen.equipment.has(e.equipment)).length;
  if(gen.equipment.size===EQUIPMENT.length) return `Using everything — all ${n} lifts in play.`;
  return `${n} lift${n===1?"":"s"} available with your ${gen.equipment.size} selected item${gen.equipment.size===1?"":"s"}.`;
}

function renderGenConfig(){
  const box=$("#genConfig");
  const focusChips = ["Full body",...MUSCLES].map(m=>
    `<button class="chip${m!=="Full body"?" m":""}" data-focus="${esc(m)}" data-on="${m===gen.focus}">${esc(m)}</button>`).join("");
  const countBlock = `
    <span class="section-eyebrow" style="margin-top:18px">Exercises</span>
    <div class="count-row">
      <input type="range" id="genCount" min="3" max="10" value="${gen.count}" aria-label="Number of exercises">
      <b class="mono" id="genCountVal">${gen.count}</b>
    </div>`;

  if(gen.mode==="intensity"){
    const intens=Object.entries(INTENSITY).map(([k,v])=>
      `<button class="chip" data-intensity="${k}" data-on="${k===gen.intensity}">${v.label}</button>`).join("");
    const equipChips=EQUIPMENT.map(e=>
      `<button class="chip" data-equip="${e}" data-on="${gen.equipment.has(e)}">${e}</button>`).join("");
    box.innerHTML=`
      <span class="section-eyebrow">Intensity</span>
      <div class="chip-row">${intens}</div>
      <p class="cfg-note" id="intNote">${INTENSITY[gen.intensity].note}</p>
      <div class="equip-head" style="margin-top:18px">
        <span class="section-eyebrow" style="margin-bottom:0">Equipment you have</span>
        <span class="equip-tools">
          <button class="linkbtn" data-equip-all>All</button>
          <button class="linkbtn" data-equip-none>None</button>
        </span>
      </div>
      <div class="chip-row" id="equipPick" style="margin-top:10px">${equipChips}</div>
      <p class="cfg-note" id="equipNote">${equipNoteText()}</p>
      <span class="section-eyebrow" style="margin-top:18px">Focus</span>
      <div class="chip-row">${focusChips}</div>
      ${countBlock}`;
  } else if(gen.mode==="goal"){
    const goalChips=Object.entries(GOALS).map(([k,v])=>
      `<button class="chip" data-goal="${k}" data-on="${k===gen.goal}">${esc(v.label)}</button>`).join("");
    const equipChips=EQUIPMENT.map(e=>
      `<button class="chip" data-equip="${e}" data-on="${gen.equipment.has(e)}">${esc(e)}</button>`).join("");
    box.innerHTML=`
      <span class="section-eyebrow">Goal</span>
      <div class="chip-row">${goalChips}</div>
      <p class="cfg-note" id="goalNote">${esc(GOALS[gen.goal].note)}</p>
      <div class="equip-head" style="margin-top:18px">
        <span class="section-eyebrow" style="margin-bottom:0">Equipment you have</span>
        <span class="equip-tools">
          <button class="linkbtn" data-equip-all>All</button>
          <button class="linkbtn" data-equip-none>None</button>
        </span>
      </div>
      <div class="chip-row" id="equipPick" style="margin-top:10px">${equipChips}</div>
      <p class="cfg-note" id="equipNote">${equipNoteText()}</p>
      <span class="section-eyebrow" style="margin-top:18px">Focus</span>
      <div class="chip-row">${focusChips}</div>
      ${countBlock}`;
  } else {
    const modes=[
      ["recent","Repeat last session","Reload your most recent workout, exactly as logged."],
      ["frequent","Most-frequent lifts","Your go-to movements, ranked by how often you train them."],
      ["progressive","Progressive overload","Your frequent lifts with a +2.5% load bump on each."],
    ];
    box.innerHTML=`
      ${DB.sessions.length?"":`<p class="cfg-note">No sessions logged yet — switch to <b>By intensity</b> to get started.</p>`}
      <span class="section-eyebrow">Method</span>
      <div class="hmode-grid">
        ${modes.map(([k,t,d])=>`
          <button class="hmode" data-hmode="${esc(k)}" data-on="${k===gen.histMode}"><b>${esc(t)}</b><span>${esc(d)}</span></button>`).join("")}
      </div>
      <div id="histExtra" ${gen.histMode==="recent"?"hidden":""}>
        <span class="section-eyebrow" style="margin-top:18px">Focus</span>
        <div class="chip-row">${focusChips}</div>
        ${countBlock}
      </div>`;
  }
  wireGenConfig();
}

function wireGenConfig(){
  const box=$("#genConfig");
  $$("[data-intensity]",box).forEach(b=>b.onclick=()=>{
    gen.intensity=b.dataset.intensity;
    $$("[data-intensity]",box).forEach(c=>c.dataset.on=(c.dataset.intensity===gen.intensity));
    const n=$("#intNote"); if(n) n.textContent=INTENSITY[gen.intensity].note;
  });
  $$("[data-goal]",box).forEach(b=>b.onclick=()=>{
    gen.goal=b.dataset.goal;
    $$("[data-goal]",box).forEach(c=>c.dataset.on=(c.dataset.goal===gen.goal));
    const n=$("#goalNote"); if(n) n.textContent=GOALS[gen.goal].note;
  });
  $$("[data-focus]",box).forEach(b=>b.onclick=()=>{
    gen.focus=b.dataset.focus;
    $$("[data-focus]",box).forEach(c=>c.dataset.on=(c.dataset.focus===gen.focus));
  });
  /* equipment: toggle individual chips, or bulk All / None */
  const syncEquip=()=>{
    $$("[data-equip]",box).forEach(c=>c.dataset.on=gen.equipment.has(c.dataset.equip));
    const note=$("#equipNote"); if(note) note.textContent=equipNoteText();
    saveEquip(gen.equipment);
  };
  $$("[data-equip]",box).forEach(b=>b.onclick=()=>{
    const e=b.dataset.equip;
    gen.equipment.has(e) ? gen.equipment.delete(e) : gen.equipment.add(e);
    syncEquip();
  });
  const allBtn=$("[data-equip-all]",box);
  if(allBtn) allBtn.onclick=()=>{ gen.equipment=new Set(EQUIPMENT); syncEquip(); };
  const noneBtn=$("[data-equip-none]",box);
  if(noneBtn) noneBtn.onclick=()=>{ gen.equipment.clear(); syncEquip(); };
  $$("[data-hmode]",box).forEach(b=>b.onclick=()=>{
    gen.histMode=b.dataset.hmode;
    $$("[data-hmode]",box).forEach(c=>c.dataset.on=(c.dataset.hmode===gen.histMode));
    const extra=$("#histExtra"); if(extra) extra.hidden=(gen.histMode==="recent");
  });
  const cnt=$("#genCount");
  if(cnt) cnt.oninput=()=>{ gen.count=+cnt.value; $("#genCountVal").textContent=cnt.value; };
}

function renderGenResult(){
  const rows=gen.result;
  const tons=rows.reduce((a,r)=>a+r.sets*r.reps*r.weight,0);
  const accent = gen.mode==="intensity" ? INTENSITY[gen.intensity].accent
               : gen.mode==="goal" ? GOALS[gen.goal].accent
               : "var(--violet)";
  const title = gen.mode==="intensity" ? `${INTENSITY[gen.intensity].label} · ${gen.focus}`
               : gen.mode==="goal" ? `${GOALS[gen.goal].label} · ${gen.focus}`
               : ({recent:"Repeat last session",frequent:"Most-frequent lifts",progressive:"Progressive overload"})[gen.histMode];
  const sub = (gen.mode==="intensity"||gen.mode==="goal")
    ? `${equipSummary()} · ${rows.length} lift${rows.length===1?"":"s"}`
    : "";
  $("#genResult").innerHTML=`
    <div class="gen-head" style="box-shadow:6px 6px 0 ${accent}">
      <div>
        <span class="section-eyebrow">Generated workout</span>
        <h3>${title}</h3>
        ${sub?`<p class="gen-sub mono">${sub}</p>`:""}
      </div>
      <div class="gen-tot"><b>${tons.toLocaleString()}</b><span>kg planned</span></div>
    </div>
    <div class="gen-list">
      ${rows.map((r,i)=>`
        <div class="gen-row">
          <span class="gen-n mono">${String(i+1).padStart(2,"0")}</span>
          <div class="gen-name">${esc(r.name)}<small>${esc(r.muscle)}${r.why?` · ${esc(r.why)}`:""}</small></div>
          <span class="gen-presc mono">${r.sets} × ${r.reps} @ ${r.weight}kg</span>
        </div>`).join("")}
    </div>`;
}

function loadGenIntoLogger(){
  if(!gen.result.length) return;
  draft = gen.result.map(r=>({id:r.id,name:r.name,muscle:r.muscle,equipment:r.equipment,sets:r.sets,reps:r.reps,weight:r.weight}));
  renderDraft();
  switchView("log");
  toast(`Loaded ${draft.length} lifts into the logger`);
}

function showLayer(n){
  $("#genLayer1").hidden = n!==1;
  $("#genLayer2").hidden = n!==2;
  $("#genLayer3").hidden = n!==3;
  $$("#genSteps li").forEach(li=>li.dataset.on=(+li.dataset.step<=n));
}

function switchView(name){
  $$(".tab").forEach(t=>t.setAttribute("aria-selected", String(t.dataset.view===name)));
  $$(".view").forEach(v=>v.classList.toggle("active", v.id===`view-${name}`));
  window.scrollTo({top:0,behavior:"smooth"});
}

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
      await OneSignal.Slidedown.promptPush();
      await OneSignal.User.addTag("app","ironledger");
      refreshBellStatus();
      toast("Browser will ask for notification permission.");
    }catch(e){
      console.warn(e);
      toast("Push needs an HTTPS host + OneSignal dashboard config.");
    }
  });
}

function init(){
  $("#sessDate").value = new Date().toISOString().slice(0,10);

  const liftCount = EXERCISES.length;
  $("#coverLede").textContent = liftCount;
  $("#coverLifts").textContent = liftCount;
  $("#genDbCount").textContent = liftCount;
  $("#footLifts").textContent = liftCount;
  $("#footGroups").textContent = MUSCLES.length;

  buildFilters();
  renderDB();
  renderDraft();
  renderHistory();
  renderProgress();
  renderSafety();

  $("#progSearch").addEventListener("input",e=>{ prog.q=e.target.value.toLowerCase().trim(); renderProgress(); });
  $$(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.view));
  $("#saveBtn").onclick=saveSession;
  $("#clearBtn").onclick=()=>{ if(draft.length){ draft=[]; renderDraft(); toast("Session cleared."); } };
  $("#bellBtn").onclick=enableReminders;

  $("#exportBtn").onclick=exportData;
  $("#importBtn").onclick=()=>$("#importFile").click();
  $("#importFile").onchange=e=>{ const f=e.target.files[0]; if(f){ importData(f); e.target.value=""; } };

  $("#coverTonnage").textContent=totalTonnage().toLocaleString();
  $("#coverSessions").textContent=DB.sessions.length;
  $("#enterBtn").onclick=()=>{
    $("#cover").classList.add("hide");
    document.body.classList.remove("cover-open");
  };

  $$("#genLayer1 .choice").forEach(b=>b.onclick=()=>{
    gen.mode=b.dataset.mode;
    if(gen.mode==="history") gen.histMode="recent";
    renderGenConfig();
    showLayer(2);
  });
  $("#genBtn").onclick=generate;
  $("#genRegen").onclick=generate;
  $("#genLoad").onclick=loadGenIntoLogger;
  $("#genBack1").onclick=()=>showLayer(1);
  $("#genBack2").onclick=()=>showLayer(2);
  showLayer(1);

  animateTonnage(totalTonnage());
  refreshBellStatus();

  if(!STORAGE_OK){
    toast("⚠ This browser blocks local storage — sessions won't be saved. Export backups to keep them.");
  }
}
document.addEventListener("DOMContentLoaded",init);
