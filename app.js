/* ENEM Master — app.js v2 */
const AREAS = [
  {id:"todas", nome:"Todas", desc:"visão geral", cor:"#fff"},
  {id:"linguagens", nome:"Linguagens", desc:"Port • Lit • Ing • Artes", cor:"#f472b6"},
  {id:"humanas", nome:"Humanas", desc:"Hist • Geo • Fil • Soc", cor:"#38bdf8"},
  {id:"natureza", nome:"Natureza", desc:"Bio • Fis • Qui", cor:"#34d399"},
  {id:"exatas", nome:"Exatas", desc:"Matemática", cor:"#fbbf24"},
  {id:"redacao", nome:"✍️ Redação", desc:"Temas + correção", cor:"#a78bfa"},
  {id:"flash", nome:"🃏 Flash", desc:"Revisão rápida", cor:"#22d3ee"},
];
const MATERIAS_POR_AREA = {
  todas: [], linguagens: ["Português","Literatura","Inglês","Artes","Educação Física"],
  humanas: ["História","Geografia","Filosofia","Sociologia"],
  natureza: ["Biologia","Física","Química"], exatas: ["Matemática"], redacao: [], flash: []
};
const XP_MAP = {"Fácil":10,"Médio":20,"Difícil":30};
const PAGE_SIZE = 10;
const CONQS = [
  {id:"q1", icon:"🌱", nome:"Primeiro passo", desc:"Responder 1 questão"},
  {id:"q10", icon:"🔥", nome:"Aquecendo", desc:"Responder 10 questões"},
  {id:"q50", icon:"🚀", nome:"Metade do caminho", desc:"Responder 50 questões"},
  {id:"all", icon:"👑", nome:"Zerou o banco", desc:"Responder todas as questões"},
  {id:"streak5", icon:"⚡", nome:"Em chamas", desc:"Acertar 5 seguidas"},
  {id:"prec", icon:"🎯", nome:"Precisão", desc:"80%+ de acerto (10+ respondidas)"},
  {id:"area4", icon:"🌍", nome:"Completo", desc:"Acertar em todas as 4 áreas"},
  {id:"red1", icon:"✍️", nome:"Redator", desc:"Salvar 1 redação"},
  {id:"sim1", icon:"🏁", nome:"Simulador", desc:"Finalizar 1 simulado"},
  {id:"foco", icon:"🍅", nome:"Focado", desc:"Completar 1 ciclo pomodoro"},
  {id:"flash20", icon:"🃏", nome:"Memória afiada", desc:"Marcar 20 flashcards como 'sei'"},
];

let state = { area:"todas", materia:"Todas", answers:{}, favs:new Set(), revs:new Set(),
  simulado:false, simStart:0, simEnd:0, simTimerInt:null, simCfg:null, order:[], page:1,
  onlyErradas:false, hist:[], wrongAt:{}, theme:"dark", fontScale:1,
  meta:10, conq:[], pomoCycles:0, flashKnown:[], flashUnknown:[], simDone:0,
  flashArea:"todas", flashIdx:0, flashOrder:[], flashFlip:false };

function load(){
  try{
    const d = JSON.parse(localStorage.getItem("enem-master-v2")||localStorage.getItem("enem-master-v1")||"{}");
    state.answers=d.answers||{}; state.favs=new Set(d.favs||[]); state.revs=new Set(d.revs||[]);
    state.hist=d.hist||[]; state.wrongAt=d.wrongAt||{}; state.theme=d.theme||"dark"; state.fontScale=d.fontScale||1;
    state.meta=d.meta||10; state.conq=d.conq||[]; state.pomoCycles=d.pomoCycles||0;
    state.flashKnown=d.flashKnown||[]; state.flashUnknown=d.flashUnknown||[]; state.simDone=d.simDone||0;
  }catch(e){}
}
function save(){
  localStorage.setItem("enem-master-v2", JSON.stringify({answers:state.answers,favs:[...state.favs],revs:[...state.revs],hist:state.hist.slice(-90),wrongAt:state.wrongAt,theme:state.theme,fontScale:state.fontScale,meta:state.meta,conq:state.conq,pomoCycles:state.pomoCycles,flashKnown:state.flashKnown,flashUnknown:state.flashUnknown,simDone:state.simDone}));
}
function applyTheme(){ document.documentElement.dataset.theme = state.theme;
  document.getElementById("btnTheme").textContent = state.theme==="dark"?"🌙":"☀️";
  document.body.style.fontSize = (15*state.fontScale)+"px"; }

/* ---------- abas ---------- */
function renderAreaTabs(){
  const el=document.getElementById("areaTabs"); el.innerHTML="";
  AREAS.forEach(a=>{
    const b=document.createElement("button");
    b.className="area-tab"+(state.area===a.id?" active":""); b.dataset.area=a.id;
    let total = a.id==="todas"?QUESTOES.length+" questões" : a.id==="redacao"?((window.TEMAS_REDACAO||[]).length+" temas") : a.id==="flash"?((window.FLASHCARDS||[]).length+" cards") : QUESTOES.filter(q=>q.area===a.id).length+" questões";
    b.innerHTML=`<b><span class="dot" style="background:${a.cor}"></span>${a.nome}</b><small>${a.desc} • ${total}</small>`;
    b.onclick=()=>{state.area=a.id;state.materia="Todas";state.page=1;state.onlyErradas=false;hideDash();renderAll();};
    el.appendChild(b);
  });
  const tq=document.getElementById("tagQ"); if(tq) tq.textContent=QUESTOES.length;
  const tr=document.getElementById("tagR"); if(tr) tr.textContent=(window.TEMAS_REDACAO||[]).length;
  const hc=document.getElementById("heroCounts"); if(hc) hc.textContent=`${QUESTOES.length} questões + ${(window.TEMAS_REDACAO||[]).length} temas de redação`;
}
function renderSubjectTabs(){
  const el=document.getElementById("subjectTabs"); el.innerHTML="";
  let mats = state.area==="todas"?["Todas",...new Set(QUESTOES.map(q=>q.materia))]:["Todas",...(MATERIAS_POR_AREA[state.area]||[])];
  mats.forEach(m=>{
    const b=document.createElement("button"); b.className="sub"+(state.materia===m?" active":"");
    const n = m==="Todas"?QUESTOES.filter(q=>state.area==="todas"||q.area===state.area).length:QUESTOES.filter(q=>q.materia===m&&(state.area==="todas"||q.area===state.area)).length;
    b.textContent=`${m} (${n})`; b.onclick=()=>{state.materia=m;state.page=1;renderQuestions();renderSubjectTabs();};
    el.appendChild(b);
  });
}

/* ---------- filtros ---------- */
function dueIds(){ const now=Date.now(),out=[]; for(const[id,ts]of Object.entries(state.wrongAt)){ if(now-ts>24*3600*1000) out.push(+id); } return new Set(out); }
function filtered(){
  const s=document.getElementById("search").value.toLowerCase();
  const diff=document.getElementById("filterDiff").value, st=document.getElementById("filterStatus").value, fonte=document.getElementById("filterFonte").value;
  const due=dueIds();
  let list=QUESTOES.filter(q=>{
    if(state.area!=="todas"&&q.area!==state.area) return false;
    if(state.materia!=="Todas"&&q.materia!==state.materia) return false;
    if(diff&&q.dificuldade!==diff) return false;
    if(fonte==="autoral"&&q.fonte==="ENEM") return false;
    if(fonte==="ENEM"&&q.fonte!=="ENEM") return false;
    if(s&&!(q.enunciado+q.tema+q.materia).toLowerCase().includes(s)) return false;
    const ans=state.answers[q.id];
    if(state.onlyErradas&&(ans===undefined||ans===q.correta)) return false;
    if(st==="unanswered"&&ans!==undefined) return false;
    if(st==="correct"&&ans!==q.correta) return false;
    if(st==="wrong"&&(ans===undefined||ans===q.correta)) return false;
    if(st==="review"&&!state.revs.has(q.id)) return false;
    if(st==="fav"&&!state.favs.has(q.id)) return false;
    if(st==="due"&&!due.has(q.id)) return false;
    return true;
  });
  if(state.order.length){ const pos={}; state.order.forEach((id,i)=>pos[id]=i); list=[...list].sort((a,b)=>(pos[a.id]??999)-(pos[b.id]??999)); }
  return list;
}
const LETRAS=["A","B","C","D","E"];
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function renderQuestions(){
  const box=document.getElementById("questions"); const list=filtered();
  const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
  if(state.page>pages) state.page=pages;
  const slice=list.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE);
  document.getElementById("resultCount").textContent=`${list.length} questão(ões) • ${state.area} • ${state.materia} • pág ${state.page}/${pages}`;
  document.getElementById("empty").classList.toggle("hidden",list.length>0);
  box.innerHTML="";
  slice.forEach((q,idx)=>{
    const globalIdx=(state.page-1)*PAGE_SIZE+idx+1;
    const ans=state.answers[q.id], responded=ans!==undefined;
    const card=document.createElement("article"); card.className="q"; card.tabIndex=0; card.dataset.qid=q.id;
    const areaNome=AREAS.find(a=>a.id===q.area)?.nome||q.area;
    card.innerHTML=`<div class="q-head"><span class="badge">${globalIdx}</span><span class="badge ${q.area}">${areaNome}</span><span class="badge">${q.materia}</span><span class="badge">${q.tema}</span><span class="badge diff-${q.dificuldade}">${q.dificuldade} • ${XP_MAP[q.dificuldade]||10}XP</span><span class="badge">${q.fonte==="ENEM"?("🏛 "+(q.ano||"ENEM")):(q.ano||"Estilo ENEM")}</span>
      ${responded&&!state.simulado?`<span class="badge ${ans===q.correta?"status-correct":"status-wrong"}">${ans===q.correta?"✔ correta":"✘ errou"}</span>`:""}${state.simulado&&responded?`<span class="badge">respondida</span>`:""}</div>
      <h3>${esc(q.enunciado)}</h3><div class="alts"></div><div class="fb"></div>
      <div class="q-actions"><button class="icon-btn fav ${state.favs.has(q.id)?"on":""}">♥ Favoritar</button><button class="icon-btn rev ${state.revs.has(q.id)?"on":""}">⚑ Revisar</button>${responded&&!state.simulado?`<button class="icon-btn clear">Limpar</button>`:""}</div>`;
    const ab=card.querySelector(".alts");
    // embaralhar alternativas no simulado se configurado
    let orderAlt=[0,1,2,3,4];
    if(state.simulado&&state.simCfg?.embaralhar){ if(!q._shuf) q._shuf=[...orderAlt].sort(()=>Math.random()-.5); orderAlt=q._shuf; }
    orderAlt.forEach(oi=>{
      const t=q.alternativas[oi]; const b=document.createElement("button");
      b.className="alt"; b.disabled=responded;
      if(responded&&!state.simulado){ if(oi===q.correta)b.className+=" correct"; else if(oi===ans)b.className+=" wrong"; }
      else if(responded&&state.simulado&&oi===ans) b.className+=" selected";
      b.innerHTML=`<span class="letter">${LETRAS[orderAlt.indexOf(oi)]}</span><span>${esc(t)}</span>`;
      b.onclick=()=>answer(q.id,oi); ab.appendChild(b);
    });
    const fb=card.querySelector(".fb");
    if(responded&&!state.simulado){const hit=ans===q.correta;
      fb.innerHTML=`<div class="feedback ${hit?"hit":"miss"}"><b>${hit?"✅ Acertou! +"+(XP_MAP[q.dificuldade]||10)+" XP":"❌ Gabarito: letra "+LETRAS[q.correta]}</b><br>${esc(q.explicacao)}</div>`;}
    else if(responded&&state.simulado) fb.innerHTML=`<div class="feedback sim">Registrada. Gabarito ao finalizar.</div>`;
    card.querySelector(".fav").onclick=e=>{toggleSet(state.favs,q.id);e.target.classList.toggle("on");save();};
    card.querySelector(".rev").onclick=e=>{toggleSet(state.revs,q.id);e.target.classList.toggle("on");save();};
    const c=card.querySelector(".clear"); if(c)c.onclick=()=>{delete state.answers[q.id];save();renderAll();};
    box.appendChild(card);
  });
  renderPagination(pages); updateStats();
}
function renderPagination(pages){
  const p=document.getElementById("pagination"); p.innerHTML="";
  if(pages<=1) return;
  const mk=(t,pg,dis,act)=>{const b=document.createElement("button");b.className="pg"+(act?" active":"");b.textContent=t;b.disabled=!!dis;b.onclick=()=>{state.page=pg;renderQuestions();window.scrollTo({top:document.getElementById("questoesMain").offsetTop-140,behavior:"smooth"});};p.appendChild(b);};
  mk("←",Math.max(1,state.page-1),state.page===1);
  for(let i=1;i<=pages;i++){ if(pages>9&&Math.abs(i-state.page)>2&&(i!==1&&i!==pages)) continue; mk(i,i,false,i===state.page); }
  mk("→",Math.min(pages,state.page+1),state.page===pages);
}
function toggleSet(s,id){s.has(id)?s.delete(id):s.add(id);}
function answer(id,idx){
  const q=QUESTOES.find(x=>x.id===id);
  const prev=state.answers[id];
  state.answers[id]=idx; save();
  // histórico + revisão espaçada
  const hit = q&&idx===q.correta;
  const today=new Date().toISOString().slice(0,10);
  let h=state.hist.find(x=>x.d===today);
  if(!h){h={d:today,t:0,h:0};state.hist.push(h);}
  if(prev===undefined){h.t++; if(hit)h.h++;}
  else { const wasHit = q&&prev===q.correta; if(wasHit&&!hit){h.h--;} if(!wasHit&&hit){h.h++;} }
  if(!hit) state.wrongAt[id]=Date.now(); else delete state.wrongAt[id];
  save(); checkConq(); renderQuestions();
}

/* ---------- stats / dashboard ---------- */
function xpTotal(){ let xp=0; for(const[id,a]of Object.entries(state.answers)){const q=QUESTOES.find(x=>x.id==id); if(q&&a===q.correta) xp+=XP_MAP[q.dificuldade]||10;} return xp; }
function level(xp){ return Math.floor(xp/200)+1; }
function updateStats(){
  const ids=Object.keys(state.answers), total=ids.length;
  let hits=0; ids.forEach(id=>{const q=QUESTOES.find(x=>x.id==id); if(q&&state.answers[id]===q.correta)hits++;});
  let streak=0; const ord=QUESTOES.filter(q=>state.answers[q.id]!==undefined);
  for(let i=ord.length-1;i>=0;i--){ if(state.answers[ord[i].id]===ord[i].correta)streak++; else break; }
  document.getElementById("statAnswered").textContent=total;
  document.getElementById("statHits").textContent=hits;
  document.getElementById("statPct").textContent=total?Math.round(hits/total*100)+"%":"0%";
  const xp=xpTotal(); document.getElementById("statXP").textContent=xp+" XP";
  document.getElementById("xpLevel").textContent="NV "+level(xp);
  const pct=Math.round(total/QUESTOES.length*100);
  document.getElementById("progressBar").style.width=pct+"%";
  document.getElementById("progressLabel").textContent=pct+"%";
  ["linguagens","humanas","natureza","exatas"].forEach(a=>{const qs=QUESTOES.filter(q=>q.area===a);const done=qs.filter(q=>state.answers[q.id]!==undefined).length;document.getElementById("bar-"+a).style.width=Math.round(done/qs.length*100)+"%";});
  document.getElementById("statStreakMini").textContent=streak;
  document.getElementById("revDueMini").textContent=dueIds().size;
  try{document.getElementById("redCountMini").textContent=(JSON.parse(localStorage.getItem("enem-redacoes-v1")||"[]")).length;}catch(e){}
}
function hideDash(){document.getElementById("dashView").classList.add("hidden");}
function showDash(){
  hideRedacaoIfNeeded(); hideQuestoes(false);
  const d=document.getElementById("dashView"); d.classList.toggle("hidden");
  if(d.classList.contains("hidden")) return;
  // últimos 7 dias
  const days=[]; for(let i=6;i>=0;i--){const dt=new Date(Date.now()-i*864e5);days.push(dt.toISOString().slice(0,10));}
  const cd=document.getElementById("chartDays"); cd.innerHTML="";
  const max=Math.max(5,...state.hist.map(h=>h.t));
  days.forEach(dt=>{const h=state.hist.find(x=>x.d===dt);const t=h?h.t:0,ht=h?h.h:0;
    const row=document.createElement("div");row.className="crow";
    row.innerHTML=`<small>${dt.slice(5)}</small><div class="ctrack"><div class="cfill" style="width:${Math.round(t/max*100)}%"></div><div class="chits" style="width:${Math.round(ht/max*100)}%"></div></div><b>${ht}/${t}</b>`;
    cd.appendChild(row);});
  // por área
  const ca=document.getElementById("chartAreas"); ca.innerHTML="";
  AREAS.filter(a=>["linguagens","humanas","natureza","exatas"].includes(a.id)).forEach(a=>{
    const qs=QUESTOES.filter(q=>q.area===a.id); const done=qs.filter(q=>state.answers[q.id]!==undefined);
    const hits=done.filter(q=>state.answers[q.id]===q.correta).length;
    const pct=done.length?Math.round(hits/done.length*100):0;
    const row=document.createElement("div");row.className="crow";
    row.innerHTML=`<small>${a.nome}</small><div class="ctrack"><div class="cfill" style="width:${pct}%;background:${a.cor}"></div></div><b>${pct}% (${hits}/${done.length})</b>`;
    ca.appendChild(row);});
  // revisão
  const due=[...dueIds()]; const rl=document.getElementById("revList");
  rl.innerHTML=due.length?due.slice(0,8).map(id=>{const q=QUESTOES.find(x=>x.id===id);return `<div class="rev-item">🔁 Q${id} • ${q?esc(q.materia+" — "+q.tema):""}</div>`;}).join("")+ (due.length>8?`<small class="muted">+${due.length-8} mais…</small>`:"") : `<p class="muted">✅ Nada vencido! Erros voltam aqui após 24h.</p>`;
  // xp
  const xp=xpTotal(), lv=level(xp), next=lv*200-xp;
  document.getElementById("xpBox").innerHTML=`<div style="font-size:28px;font-weight:800">Nv ${lv} • ${xp} XP</div><div class="bar"><div style="width:${Math.round((xp%200)/200*100)}%"></div></div><small class="muted">Faltam ${next} XP para o nível ${lv+1}</small>`;
  renderMeta(); renderConqs();
  document.getElementById("pomoCycles").textContent=state.pomoCycles;
}
function hideRedacaoIfNeeded(){}
function hideQuestoes(){}

/* ---------- simulado TRI ---------- */
function peso(q){return q.dificuldade==="Fácil"?1:q.dificuldade==="Médio"?1.5:2;}
function openSimModal(){document.getElementById("simModal").classList.remove("hidden");}
function startSimuladoCfg(){
  const n=+document.getElementById("simN").value, t=+document.getElementById("simT").value;
  const area=document.getElementById("simArea").value, emb=document.getElementById("simEmbaralhar").checked;
  let pool=QUESTOES.filter(q=>area==="todas"||q.area===area);
  pool=[...pool].sort(()=>Math.random()-.5).slice(0,Math.min(n,pool.length));
  state.simulado=true; state.simCfg={embaralhar:emb,total:pool.length,area};
  state.simStart=Date.now(); state.simEnd=Date.now()+t*60*1000;
  state.order=pool.map(q=>q.id); state.area=area==="todas"?"todas":area; state.materia="Todas"; state.page=1;
  // limpa respostas só do simulado? mantém geral; marca início
  document.getElementById("simModal").classList.add("hidden");
  document.getElementById("simBar").classList.remove("hidden");
  document.getElementById("btnSimulado").textContent="⏸ Em simulado...";
  hideDash(); renderAll(); tickSim();
  clearInterval(state.simTimerInt);
  state.simTimerInt=setInterval(tickSim,1000);
  window.scrollTo({top:0,behavior:"smooth"});
}
function tickSim(){
  const left=Math.max(0,state.simEnd-Date.now());
  const s=Math.floor(left/1000), hh=String(Math.floor(s/3600)).padStart(2,"0"), mm=String(Math.floor(s%3600/60)).padStart(2,"0"), ss=String(s%60).padStart(2,"0");
  document.getElementById("simTimer").textContent=`⏱ ${hh}:${mm}:${ss}`;
  const done=state.order.filter(id=>state.answers[id]!==undefined).length;
  document.getElementById("simInfo").textContent=`Simulado TRI • ${done}/${state.order.length} • ${state.simCfg?.area||""}`;
  if(left<=0) finishSimulado(true);
}
function finishSimulado(auto){
  clearInterval(state.simTimerInt); state.simulado=false;
  document.getElementById("simBar").classList.add("hidden");
  document.getElementById("btnSimulado").textContent="▶ Simulado";
  const qs=state.order.map(id=>QUESTOES.find(q=>q.id===id)).filter(Boolean);
  let pts=0,max=0,facil={h:0,t:0},medio={h:0,t:0},dif={h:0,t:0};
  qs.forEach(q=>{const p=peso(q);max+=p;const ok=state.answers[q.id]===q.correta;if(ok)pts+=p;
    const g=q.dificuldade==="Fácil"?facil:q.dificuldade==="Médio"?medio:dif;g.t++;if(ok)g.h++;});
  const nota=Math.round(300+700*(max?pts/max:0)); // escala ENEM-like 300-1000
  document.getElementById("simResultBody").innerHTML=`
    <div class="nota-box"><span>${nota}</span><small>estimativa TRI (300-1000) • ${auto?"tempo esgotado":"finalizado"}</small></div>
    <div class="crow"><small>Acertos</small><div class="ctrack"><div class="cfill" style="width:${Math.round(pts/max*100)}%"></div></div><b>${Math.round(pts)}/${Math.round(max)} pts</b></div>
    <p class="muted">Fácil ${facil.h}/${facil.t} • Médio ${medio.h}/${medio.t} • Difícil ${dif.h}/${dif.t} — no ENEM, fáceis valem consistência; chute em difícil sem acertar fácil derruba a nota.</p>`;
  document.getElementById("simResult").classList.remove("hidden");
  state.order=[]; state.simDone++; save(); checkConq(); renderAll();
}

/* ---------- geral ---------- */
function renderAll(){
  renderAreaTabs();
  const isRed=state.area==="redacao", isFlash=state.area==="flash";
  document.getElementById("questoesToolbar").classList.toggle("hidden",isRed||isFlash);
  document.getElementById("questoesMain").classList.toggle("hidden",isRed||isFlash);
  document.getElementById("redacaoView").classList.toggle("hidden",!isRed);
  document.getElementById("flashView").classList.toggle("hidden",!isFlash);
  if(!document.getElementById("dashView").classList.contains("hidden")&&!isRed&&!isFlash){/* mantém */}
  if(isRed){if(window.renderRedacaoView)window.renderRedacaoView();return;}
  if(isFlash){renderFlash();updateStats();return;}
  renderSubjectTabs();renderQuestions();
}
window.__clearFilters=()=>{document.getElementById("search").value="";document.getElementById("filterDiff").value="";document.getElementById("filterStatus").value="";document.getElementById("filterFonte").value="";state.onlyErradas=false;state.page=1;renderQuestions();};

document.getElementById("search").addEventListener("input",()=>{state.page=1;renderQuestions();});
document.getElementById("filterDiff").addEventListener("change",()=>{state.page=1;renderQuestions();});
document.getElementById("filterStatus").addEventListener("change",()=>{state.page=1;renderQuestions();});
document.getElementById("filterFonte").addEventListener("change",()=>{state.page=1;renderQuestions();});
document.getElementById("btnShuffle").onclick=()=>{state.order=[...filtered()].sort(()=>Math.random()-.5).map(q=>q.id);state.page=1;renderQuestions();};
document.getElementById("btnErradas").onclick=e=>{state.onlyErradas=!state.onlyErradas;e.target.classList.toggle("primary",state.onlyErradas);state.page=1;renderQuestions();};
document.getElementById("btnReset").onclick=()=>{if(!confirm("Apagar todo o progresso?"))return;state.answers={};state.favs=new Set();state.revs=new Set();state.order=[];state.hist=[];state.wrongAt={};state.conq=[];state.pomoCycles=0;state.flashKnown=[];state.flashUnknown=[];state.simDone=0;save();renderAll();};
document.getElementById("btnSimulado").onclick=()=>{state.simulado?finishSimulado(false):openSimModal();};
document.getElementById("btnSimClose").onclick=()=>document.getElementById("simModal").classList.add("hidden");
document.getElementById("btnSimStart").onclick=startSimuladoCfg;
document.getElementById("simN").addEventListener("input",e=>document.getElementById("simNLabel").textContent=e.target.value);
document.getElementById("simT").addEventListener("input",e=>document.getElementById("simTLabel").textContent=e.target.value);
document.getElementById("btnFinishSim").onclick=()=>finishSimulado(false);
document.getElementById("btnCancelSim").onclick=()=>{state.simulado=false;clearInterval(state.simTimerInt);document.getElementById("simBar").classList.add("hidden");document.getElementById("btnSimulado").textContent="▶ Simulado";state.order=[];renderAll();};
document.getElementById("btnSimResultClose").onclick=()=>document.getElementById("simResult").classList.add("hidden");
document.getElementById("btnDash").onclick=showDash;
document.getElementById("btnDashClose").onclick=hideDash;
document.getElementById("btnRevStart").onclick=()=>{hideDash();state.area="todas";state.materia="Todas";document.getElementById("filterStatus").value="due";state.page=1;renderAll();};
document.getElementById("btnTheme").onclick=()=>{state.theme=state.theme==="dark"?"light":"dark";save();applyTheme();};
document.getElementById("fontPlus").onclick=()=>{state.fontScale=Math.min(1.3,state.fontScale+0.05);save();applyTheme();};
document.getElementById("fontMinus").onclick=()=>{state.fontScale=Math.max(0.85,state.fontScale-0.05);save();applyTheme();};
document.getElementById("btnExport").onclick=()=>{
  const data={answers:state.answers,favs:[...state.favs],revs:[...state.revs],hist:state.hist,wrongAt:state.wrongAt,redacoes:JSON.parse(localStorage.getItem("enem-redacoes-v1")||"[]"),exportedAt:new Date().toISOString(),meta:state.meta,conq:state.conq,pomoCycles:state.pomoCycles,flashKnown:state.flashKnown,flashUnknown:state.flashUnknown,simDone:state.simDone};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"}));a.download="enem-backup.json";a.click();
};
document.getElementById("btnImport").onclick=()=>document.getElementById("importFile").click();
document.getElementById("importFile").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader(); r.onload=()=>{try{const d=JSON.parse(r.result);
    state.answers=d.answers||{};state.favs=new Set(d.favs||[]);state.revs=new Set(d.revs||[]);state.hist=d.hist||[];state.wrongAt=d.wrongAt||{};
    state.meta=d.meta||10;state.conq=d.conq||[];state.pomoCycles=d.pomoCycles||0;state.flashKnown=d.flashKnown||[];state.flashUnknown=d.flashUnknown||[];state.simDone=d.simDone||0;
    if(d.redacoes)localStorage.setItem("enem-redacoes-v1",JSON.stringify(d.redacoes));
    save();renderAll();alert("Backup importado!");}catch(err){alert("Arquivo inválido.");}}; r.readAsText(f);
});
/* v3 bindings */
document.getElementById("btnMetaSave").onclick=()=>{ const v=+document.getElementById("metaInput").value;
  state.meta=Math.min(100,Math.max(1,v||10)); save(); renderMeta(); toast(`🎯 Meta: ${state.meta}/dia`); };
document.getElementById("btnPomoStart").onclick=e=>{ if(pomoRun){clearInterval(pomoInt);pomoRun=false;e.target.textContent="▶ Continuar";return;}
  pomoRun=true; e.target.textContent="⏸ Pausar"; pomoInt=setInterval(pomoTick,1000); };
document.getElementById("btnPomoReset").onclick=()=>{ clearInterval(pomoInt);pomoRun=false;
  document.getElementById("btnPomoStart").textContent="▶ Iniciar";
  pomoLeft=(+document.getElementById("pomoMode").value)*60; pomoDraw(); };
document.getElementById("pomoMode").addEventListener("change",e=>{ if(!pomoRun){pomoLeft=(+e.target.value)*60; pomoDraw();} });
document.getElementById("btnCsv").onclick=exportCSV;
document.getElementById("btnReport").onclick=exportReport;
document.getElementById("flashArea").addEventListener("change",e=>{ state.flashArea=e.target.value; state.flashOrder=[]; state.flashIdx=0; state.flashFlip=false; renderFlash(); });
document.getElementById("flashCard").onclick=()=>{ state.flashFlip=!state.flashFlip; renderFlash(); };
document.getElementById("btnFlashNext").onclick=flashNext;
document.getElementById("btnFlashShuffle").onclick=()=>{ state.flashOrder=[]; state.flashIdx=0; state.flashFlip=false; renderFlash(); toast("🔀 Embaralhado!"); };
document.getElementById("btnFlashKnow").onclick=()=>{ const deck=flashDeck(), i=state.flashOrder[state.flashIdx], c=deck[i];
  const key=c.area+":"+c.frente;
  if(!state.flashKnown.includes(key))state.flashKnown.push(key);
  state.flashUnknown=state.flashUnknown.filter(k=>k!==key); save(); checkConq(); flashNext(); };
document.getElementById("btnFlashUnknown").onclick=()=>{ const deck=flashDeck(), i=state.flashOrder[state.flashIdx], c=deck[i];
  const key=c.area+":"+c.frente;
  if(!state.flashUnknown.includes(key))state.flashUnknown.push(key);
  state.flashKnown=state.flashKnown.filter(k=>k!==key); save(); flashNext(); };
// teclado: 1-5 responde, setas mudam página
document.addEventListener("keydown",e=>{
  if(state.area==="redacao"||state.area==="flash")return;
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;
  if(["1","2","3","4","5"].includes(e.key)){
    const card=document.querySelector(".q:not(:has(.alt:disabled)) .alts, .q .alts");
    const first=document.querySelector("#questions .q");
    if(first){const btns=first.querySelectorAll(".alt:not(:disabled)");const b=btns[+e.key-1];if(b)b.click();}
  }
  if(e.key==="ArrowRight"){state.page++;renderQuestions();}
  if(e.key==="ArrowLeft"){state.page=Math.max(1,state.page-1);renderQuestions();}
});

/* ---------- v3: conquistas, meta, pomodoro, flashcards, relatórios ---------- */
let toastT=null;
function toast(msg){ const t=document.getElementById("toast"); if(!t) return;
  t.textContent=msg; t.classList.remove("hidden");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.add("hidden"),3200); }

function todayStr(off=0){ return new Date(Date.now()-off*864e5).toISOString().slice(0,10); }
function todayCount(){ const h=state.hist.find(x=>x.d===todayStr()); return h?h.t:0; }
function dayStreak(){ let s=0; for(let i=0;i<90;i++){ const h=state.hist.find(x=>x.d===todayStr(i)); if(h&&h.t>0)s++; else if(i===0)continue; else break; } return s; }
function redaCount(){ try{return JSON.parse(localStorage.getItem("enem-redacoes-v1")||"[]").length;}catch(e){return 0;} }
function bestRed(){ try{const r=JSON.parse(localStorage.getItem("enem-redacoes-v1")||"[]");return r.length?Math.max(...r.map(x=>x.total||0)):0;}catch(e){return 0;} }

function conqUnlocked(){
  const ids=Object.keys(state.answers), total=ids.length;
  let hits=0; ids.forEach(id=>{const q=QUESTOES.find(x=>x.id==id); if(q&&state.answers[id]===q.correta)hits++;});
  let streak=0; const ord=QUESTOES.filter(q=>state.answers[q.id]!==undefined);
  for(let i=ord.length-1;i>=0;i--){ if(state.answers[ord[i].id]===ord[i].correta)streak++; else break; }
  const areasHit=new Set(); ["linguagens","humanas","natureza","exatas"].forEach(a=>{
    if(QUESTOES.some(q=>q.area===a&&state.answers[q.id]===q.correta)) areasHit.add(a); });
  const out=new Set();
  if(total>=1)out.add("q1"); if(total>=10)out.add("q10"); if(total>=50)out.add("q50");
  if(total>=QUESTOES.length&&QUESTOES.length>0)out.add("all");
  if(streak>=5)out.add("streak5");
  if(total>=10&&hits/total>=0.8)out.add("prec");
  if(areasHit.size===4)out.add("area4");
  if(redaCount()>=1)out.add("red1");
  if(state.simDone>=1)out.add("sim1");
  if(state.pomoCycles>=1)out.add("foco");
  if(state.flashKnown.length>=20)out.add("flash20");
  return out;
}
function checkConq(){
  const un=conqUnlocked(); let novo=false;
  un.forEach(id=>{ if(!state.conq.includes(id)){ state.conq.push(id); novo=true;
    const c=CONQS.find(x=>x.id===id); if(c) toast(`🏆 Conquista: ${c.icon} ${c.nome}!`); }});
  if(novo) save();
  return un;
}
function renderConqs(){
  checkConq();
  const box=document.getElementById("conqList"); if(!box) return;
  const un=conqUnlocked();
  box.innerHTML=CONQS.map(c=>`<div class="conq ${un.has(c.id)?"unlocked":""}">${un.has(c.id)?c.icon:"🔒"} <span><b>${c.nome}</b><br><small class="muted">${c.desc}</small></span></div>`).join("");
}
function renderMeta(){
  const box=document.getElementById("metaBox"); if(!box) return;
  const done=todayCount(), pct=Math.min(100,Math.round(done/state.meta*100));
  box.innerHTML=`<div>Hoje: <b>${done}/${state.meta}</b> questões ${done>=state.meta?"✅ meta batida!":""}</div>
    <div class="bar"><div style="width:${pct}%"></div></div>
    <div class="muted" style="font-size:13px">🔥 <b>${dayStreak()}</b> dia(s) estudando • ✍️ melhor redação: <b>${bestRed()}</b></div>`;
  const mi=document.getElementById("metaInput"); if(mi&&document.activeElement!==mi) mi.value=state.meta;
  const cal=document.getElementById("daysCal"); if(cal){
    cal.innerHTML=""; for(let i=13;i>=0;i--){ const d=todayStr(i); const h=state.hist.find(x=>x.d===d);
      const el=document.createElement("div"); el.className="day"+(h&&h.t>0?" hit":"")+(i===0?" today":"");
      el.title=`${d}: ${h?h.h+"/"+h.t:"0"}`; el.textContent=d.slice(8); cal.appendChild(el); }
  }
}

/* pomodoro */
let pomoInt=null, pomoLeft=25*60, pomoRun=false;
function pomoDraw(){ const m=String(Math.floor(pomoLeft/60)).padStart(2,"0"), s=String(pomoLeft%60).padStart(2,"0");
  const el=document.getElementById("pomoTime"); if(el)el.textContent=`${m}:${s}`; }
function pomoTick(){ pomoLeft--; pomoDraw();
  if(pomoLeft<=0){ clearInterval(pomoInt); pomoRun=false;
    document.getElementById("btnPomoStart").textContent="▶ Iniciar";
    const mode=document.getElementById("pomoMode"); const isFoco=+mode.value>=25;
    if(isFoco){ state.pomoCycles++; save(); checkConq(); document.getElementById("pomoCycles").textContent=state.pomoCycles; toast("🍅 Ciclo concluído! Faça uma pausa."); }
    else toast("⏰ Pausa encerrada. Bora focar!");
    try{new AudioContext();}catch(e){}
  } }

/* flashcards */
function flashDeck(){ const all=window.FLASHCARDS||[];
  return (state.flashArea==="todas"?all:all.filter(c=>c.area===state.flashArea)); }
function flashEnsureOrder(){ const d=flashDeck();
  if(!state.flashOrder.length||state._farea!==state.flashArea){ state.flashOrder=d.map((_,i)=>i).sort(()=>Math.random()-.5); state._farea=state.flashArea; state.flashIdx=0; state.flashFlip=false; } }
function renderFlash(){
  const deck=flashDeck(); flashEnsureOrder();
  if(state.flashIdx>=state.flashOrder.length) state.flashIdx=0;
  document.getElementById("flashCount").textContent=`${deck.length} cards • ${state.flashKnown.length} sei`;
  const i=state.flashOrder[state.flashIdx];
  const card=deck[i];
  const box=document.getElementById("flashCard");
  if(!card){ box.innerHTML="<p class='muted'>Sem cards aqui.</p>"; return; }
  document.getElementById("flashFront").textContent=(state.flashFlip?"":"❓ ")+card.frente;
  const back=document.getElementById("flashBack");
  back.textContent="💡 "+card.verso; back.classList.toggle("hidden",!state.flashFlip);
  box.querySelector("small").textContent=`${card.materia} • carta ${state.flashIdx+1}/${deck.length} • clique para ${state.flashFlip?"esconder":"revelar"}`;
  const known=state.flashKnown.length, unk=state.flashUnknown.length;
  document.getElementById("flashStats").innerHTML=`<span>✅ ${known} sei</span><span>❌ ${unk} revisar</span>`;
}
function flashNext(){ state.flashIdx++; state.flashFlip=false;
  if(state.flashIdx>=state.flashOrder.length){ state.flashOrder=state.flashOrder.sort(()=>Math.random()-.5); state.flashIdx=0; toast("🔀 Baralho reembaralhado!"); }
  renderFlash(); }

/* relatórios */
function download(nome, texto, tipo="text/plain;charset=utf-8"){
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([texto],{type:tipo})); a.download=nome; a.click(); }
function exportCSV(){
  const rows=[["id","area","materia","tema","dificuldade","status"].join(";")];
  QUESTOES.forEach(q=>{ const a=state.answers[q.id];
    rows.push([q.id,q.area,q.materia,`"${q.tema}"`,q.dificuldade,a===undefined?"nao_respondida":(a===q.correta?"correta":"errada")].join(";")); });
  download("enem-desempenho.csv",rows.join("\n"),"text/csv;charset=utf-8"); toast("📄 CSV baixado!");
}
function exportReport(){
  const ids=Object.keys(state.answers); let hits=0;
  ids.forEach(id=>{const q=QUESTOES.find(x=>x.id==id); if(q&&state.answers[id]===q.correta)hits++;});
  const L=[`ENEM MASTER — RESUMO DE DESEMPENHO`,`Gerado em ${new Date().toLocaleString("pt-BR")}`,"",
    `Questões: ${hits}/${ids.length} acertos (${ids.length?Math.round(hits/ids.length*100):0}%) de ${QUESTOES.length}`,
    `XP: ${xpTotal()} (Nv ${level(xpTotal())}) • Dias estudando: ${dayStreak()} • Pomodoros: ${state.pomoCycles}`,
    `Conquistas: ${state.conq.length}/${CONQS.length} • Revisões vencidas: ${dueIds().size}`,"",
    `POR ÁREA:`];
  ["linguagens","humanas","natureza","exatas"].forEach(a=>{ const qs=QUESTOES.filter(q=>q.area===a);
    const done=qs.filter(q=>state.answers[q.id]!==undefined), h=done.filter(q=>state.answers[q.id]===q.correta).length;
    L.push(`- ${a}: ${h}/${done.length} (${done.length?Math.round(h/done.length*100):0}%)`); });
  L.push("",`REDAÇÃO: ${redaCount()} salva(s) • melhor nota: ${bestRed()}`);
  download("enem-resumo.txt",L.join("\n")); toast("📄 Resumo baixado!");
}

load();applyTheme();renderAll();
