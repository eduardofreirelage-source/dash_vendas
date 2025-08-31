/* ========= CONFIG ========= */
const SUPABASE_URL  = 'https://uahmcfzerofhzjvlzrqc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaG1jZnplcm9maHpqdmx6cnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNTg2MzQsImV4cCI6MjA3MDczNDYzNH0.lPVr3wmrXAmSMY5j7JFy6mI87T3I2TxhVKV-gLc7_VU';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* Candidate views (vamos tentar nessa ordem) */
const VIEW_CANDIDATES = ['vendas_canon_front','mv_vendas_canon_front','vendas_canon'];

/* RPCs (KPIs) — tentamos o primeiro que existir */
const KPI_RPC_CANDIDATES = ['kpi_vendas_front','kpi_vendas','kpi_vendas_v2'];

/* RPCs (charts) */
const CHART_RPC = {
  dow:   ['chart_vendas_dow_front','chart_vendas_dow_v1','chart_vendas_dow'],
  month: ['chart_vendas_mes_front','chart_vendas_mes_v1','chart_vendas_mes'],
  hour:  ['chart_vendas_hora_front','chart_vendas_hora_v1','chart_vendas_hora'],
  turno: ['chart_vendas_turno_front','chart_vendas_turno_v1','chart_vendas_turno'],
};

let READ_VIEW = VIEW_CANDIDATES[0];

/* ========= HELPERS ========= */
const $ = (id)=>document.getElementById(id);
const setStatus=(t,k)=>{ const el=$('status'); el.textContent=t; el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085'); };
const setDiag=(t)=>{ $('diag').textContent=t||''; };

const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const num  =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
const pctf =v=>(v==null||!isFinite(+v))?'0,0%':((+v)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const iso  =(d)=>d.toISOString().slice(0,10);
const addDaysISO=(s,n)=>{const d=new Date(s+'T00:00:00'); d.setDate(d.getDate()+n); return iso(d);};
const daysLen=(de,ate)=>{const d1=new Date(de+'T00:00:00'), d2=new Date(ate+'T00:00:00'); return Math.round((d2-d1)/86400000)+1;};
const upSVG =()=>'<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3l5 6h-3v8H8V9H5l5-6z"/></svg>';
const dnSVG =()=>'<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 17l-5-6h3V3h4v8h3l-5 6z"/></svg>';
function deltaBadge(el,curr,prev){ if(!isFinite(prev)||+prev===0){el.textContent='—';el.className='delta flat';return;} const p=((curr-prev)/prev)*100; el.innerHTML=(p>=0?upSVG():dnSVG())+' '+Math.abs(p).toFixed(1)+'%'; el.className='delta '+(p>=0?'up':'down'); }
function computeROI(sum){ if(!sum || !isFinite(sum.des) || sum.des<=0) return NaN; return (sum.fat - sum.des)/sum.des; }

/* ========= MULTISELECT ========= */
function MultiSelect(rootId, placeholder){
  const root=$(rootId), btn=root.querySelector('.msel-btn'), panel=root.querySelector('.msel-panel');
  let options=[], selected=new Set(), filtered=[];
  function render(){ panel.innerHTML=''; const q=document.createElement('input'); q.className='msel-search'; q.placeholder='Filtrar…'; q.addEventListener('input',()=>{filtered=options.filter(v=>String(v).toLowerCase().includes(q.value.toLowerCase())); draw();}); panel.appendChild(q); draw(); }
  function draw(){ const box=document.createElement('div'); (filtered.length?filtered:options).forEach(v=>{ const row=document.createElement('div'); row.className='msel-opt'; const cb=document.createElement('input'); cb.type='checkbox'; cb.value=v; cb.checked=selected.has(v); const lb=document.createElement('label'); lb.textContent=v??'—'; cb.addEventListener('change',()=>{cb.checked?selected.add(v):selected.delete(v); refresh(); applyAll();}); row.appendChild(cb); row.appendChild(lb); box.appendChild(row); }); panel.querySelectorAll('.msel-opt').forEach(n=>n.remove()); panel.appendChild(box); }
  function refresh(){ btn.textContent = selected.size===0 ? placeholder : `${selected.size} selecionado(s)`; }
  btn.addEventListener('click',()=>root.classList.toggle('open'));
  document.addEventListener('click',(e)=>{ if(!root.contains(e.target)) root.classList.remove('open'); });
  return { setOptions(list){ options=(list||[]).filter(v=>v!==undefined).map(v=>v===null?'—':String(v)); options.sort((a,b)=>a.localeCompare(b,'pt-BR')); filtered=options.slice(); selected=new Set([...selected].filter(v=>options.includes(v))); render(); refresh(); }, get(){ return [...selected].filter(v=>v!=='—'); }, set(vals){ selected=new Set((vals||[]).map(v=>v===null?'—':String(v))); refresh(); draw(); } };
}

/* ========= ESTADO ========= */
let firstDay='', lastDay='';
const chips=[...document.querySelectorAll('.chip')];
const fDe=$('fDe'), fAte=$('fAte'), periodoInfo=$('periodoInfo');
const ms={ unids:MultiSelect('ms-unids','Todas as unidades'), lojas:MultiSelect('ms-lojas','Todas as lojas'), canais:MultiSelect('ms-canais','Todos os canais'), turnos:MultiSelect('ms-turnos','Todos os turnos'), pags:MultiSelect('ms-pags','Todos os tipos') };
function setActiveChip(v){ chips.forEach(c=>c.classList.toggle('active', c.dataset.q===String(v))); }
function applyQuick(v){ setActiveChip(v); const ate=lastDay||iso(new Date()); const de=addDaysISO(ate, -(Number(v)-1)); fDe.value=de; fAte.value=ate; periodoInfo.textContent=`Último dia carregado: ${lastDay}`; applyAll(); }
$('btnClear').addEventListener('click',()=>{ ms.unids.set([]); ms.lojas.set([]); ms.canais.set([]); ms.turnos.set([]); ms.pags.set([]); const c=$('#ms-cancel .msel-panel input[value="Não"]'); if(c){ c.checked=true; } $('#ms-cancel .msel-btn').textContent='Não'; applyQuick('30'); });
chips.forEach(b=> b.addEventListener('click',()=>applyQuick(b.dataset.q)));
[fDe,fAte].forEach(i=> i.addEventListener('change',()=>{ chips.forEach(c=>c.classList.remove('active')); periodoInfo.textContent=`Último dia carregado: ${lastDay}`; applyAll(); }));
/* compat */
function applyAll(){ updateEverything(); }

/* ========= CORE: descobrir view e preencher opções ========= */
async function probeView(){
  for(const v of VIEW_CANDIDATES){
    const r = await supa.from(v).select('dia').limit(1);
    if(!r.error){ READ_VIEW = v; return v; }
  }
  throw new Error('Nenhum view acessível dentre: '+VIEW_CANDIDATES.join(', '));
}
async function loadDateRange(){
  // tenta view dedicada; fallback via READ_VIEW
  const r = await supa.from('vw_vendas_daterange').select('*').limit(1);
  if(!r.error && r.data?.length){
    firstDay=r.data[0].min_dia; lastDay=r.data[0].max_dia; return;
  }
  const minq = await supa.from(READ_VIEW).select('dia').order('dia',{ascending:true}).limit(1);
  const maxq = await supa.from(READ_VIEW).select('dia').order('dia',{ascending:false}).limit(1);
  firstDay = (!minq.error && minq.data?.[0]?.dia) || iso(new Date());
  lastDay  = (!maxq.error && maxq.data?.[0]?.dia) || iso(new Date());
}
async function loadStaticOptions(){
  const de=fDe.value||firstDay, ate=fAte.value||lastDay;
  async function distinct(col){
    let q=supa.from(READ_VIEW).select(col,{distinct:true}).order(col,{ascending:true}).gte('dia',de).lte('dia',ate).limit(200000);
    const {data,error}=await q; if(error){console.warn('distinct',col,error.message); return [];}
    return [...new Set((data||[]).map(r=>r[col]))];
  }
  const [unids,lojas,canais,turnos,pags]=await Promise.all([distinct('unidade'),distinct('loja'),distinct('canal'),distinct('turno'),distinct('pagamento_base')]);
  ms.unids.setOptions(unids); ms.lojas.setOptions(lojas); ms.canais.setOptions(canais); ms.turnos.setOptions(turnos); ms.pags.setOptions(pags);
}

/* ========= FILTROS APLICADOS ========= */
function applyFilters(q, de, ate){
  q.gte('dia', de).lte('dia', ate);
  const un=ms.unids.get(), lj=ms.lojas.get(), ca=ms.canais.get(), tu=ms.turnos.get(), pg=ms.pags.get();
  if(un.length) q.in('unidade', un);
  if(lj.length) q.in('loja', lj);
  if(ca.length) q.in('canal', ca);
  if(tu.length) q.in('turno', tu);
  if(pg.length) q.in('pagamento_base', pg);
  const btn = document.querySelector('#ms-cancel .msel-btn');
  const txt = btn ? btn.textContent.trim() : 'Não';
  if(txt==='Sim') q.eq('cancelado','Sim'); else if(txt==='Não') q.eq('cancelado','Não');
}

/* ========= FETCH LOCAL (fallback) ========= */
async function countRows(de,ate){
  let q=supa.from(READ_VIEW).select('fat',{count:'exact',head:true}); applyFilters(q,de,ate); const {count,error}=await q; if(error){return 0;} return count||0;
}
async function fetchAllRows(de,ate){
  const total = await countRows(de,ate);
  const page=5000; let from=0, rows=[];
  while(from < total){
    let to = Math.min(from+page-1, total-1);
    let q = supa.from(READ_VIEW).select('dia,hora,turno,unidade,loja,canal,pagamento_base,cancelado,pedidos,fat,des,fre').order('dia',{ascending:true}).range(from,to);
    applyFilters(q,de,ate);
    const { data, error } = await q;
    if(error){ console.error('fetchAllRows',error.message); break; }
    rows = rows.concat(data||[]);
    from = to+1;
  }
  return rows;
}
function toNum(x){ return +x || 0; }
function sumKPIs(rows){
  let ped=0,fat=0,des=0,fre=0, cPed=0,cFat=0;
  for(const r of rows){
    const p = toNum(r.pedidos)||1;
    ped += p; fat += toNum(r.fat); des += toNum(r.des); fre += toNum(r.fre);
    if(String(r.cancelado).trim().toLowerCase()==='sim'){ cPed += p; cFat += toNum(r.fat); }
  }
  return { ped, fat, des, fre, cPed, cFat };
}

/* ========= RPC HELPERS ========= */
async function tryRPC(names, args){
  const list = Array.isArray(names)? names : [names];
  for(const n of list){
    try{
      const {data,error} = await supa.rpc(n, args);
      if(!error) return {name:n, data};
    }catch(_e){}
  }
  return null;
}
function buildParams(de, ate){
  const btn = document.querySelector('#ms-cancel .msel-btn');
  const canc = btn ? btn.textContent.trim() : 'Não';
  return {
    p_dini: de, p_dfim: ate,
    p_unids:  ms.unids.get().length  ? ms.unids.get()  : null,
    p_lojas:  ms.lojas.get().length  ? ms.lojas.get()  : null,
    p_turnos: ms.turnos.get().length ? ms.turnos.get() : null,
    p_canais: ms.canais.get().length ? ms.canais.get() : null,
    p_pags:   ms.pags.get().length   ? ms.pags.get()   : null,
    p_cancelado: (canc==='Sim'||canc==='Não') ? canc : null
  };
}

/* ========= CHARTS ========= */
function formatCurrencyTick(value){
  const v=Number(value)||0;
  if(Math.abs(v)>=1_000_000) return 'R$ '+(v/1_000_000).toFixed(1).replace('.',',')+' mi';
  if(Math.abs(v)>=1_000)     return 'R$ '+(v/1_000).toFixed(1).replace('.',',')+' mil';
  return 'R$ '+v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function ensureChart(canvasId, labels, nowArr, prevArr){
  const canvas=$(canvasId); if(!canvas) return;
  if(canvas.__chart){ try{canvas.__chart.destroy();}catch(e){} canvas.__chart=null; }
  const ctx=canvas.getContext('2d');
  const chart=new Chart(ctx,{ type:'bar',
    data:{ labels, datasets:[ {label:'Atual', data:nowArr, backgroundColor:'rgba(47,110,247,0.85)'}, {label:'Anterior', data:prevArr, backgroundColor:'rgba(2,132,199,0.6)'} ] },
    options:{ responsive:true, maintainAspectRatio:false, animation:false,
      scales:{ x:{grid:{display:false}}, y:{beginAtZero:true, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{callback:formatCurrencyTick}} },
      plugins:{ legend:{position:'top'}, tooltip:{mode:'index',intersect:false,callbacks:{label:(ctx)=>`${ctx.dataset.label}: ${money(ctx.parsed.y||0)}`}} } }
  });
  canvas.__chart=chart;
}
const chartMode={dow:'total', month:'total', hour:'total', turno:'total'};
document.querySelectorAll('.seg').forEach(seg=>{
  seg.addEventListener('click',(e)=>{ const btn=e.target.closest('.seg-btn'); if(!btn) return; const key=seg.dataset.chart; chartMode[key]=btn.dataset.mode; seg.querySelectorAll('.seg-btn').forEach(b=>b.classList.toggle('active', b===btn)); updateChartsRPC(key); });
});
function ymLabel(ym){ const [y,m]=ym.split('-').map(Number); const n=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${n[m-1]}/${String(y).slice(-2)}`; }

async function updateChartsRPC(only){
  const de=fDe.value||firstDay, ate=fAte.value||lastDay;
  const { dePrev, atePrev } = computePrevRangeISO(de,ate);

  const kinds = only ? [only] : ['dow','month','hour','turno'];
  const packs = [];

  for(const k of kinds){
    const paramsNow = buildParams(de,ate);
    const paramsPrev= buildParams(dePrev,atePrev);

    const rNow  = await tryRPC(CHART_RPC[k], paramsNow);
    const rPrev = await tryRPC(CHART_RPC[k], paramsPrev);

    if(!rNow || !rPrev){ setStatus('OK (gráficos via RPC indisponíveis)','ok'); continue; }
    packs.push({k, now:rNow.data||[], prev:rPrev.data||[]});
  }

  const pD = packs.find(p=>p.k==='dow');
  if(!only || only==='dow'){
    const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const nArr = Array(7).fill(0), pArr=Array(7).fill(0), nMed=Array(7).fill(0), pMed=Array(7).fill(0);
    (pD?.now||[]).forEach(r=>{ nArr[r.dow]=+(r.total||0); nMed[r.dow]=+(r.media||0); });
    (pD?.prev||[]).forEach(r=>{ pArr[r.dow]=+(r.total||0); pMed[r.dow]=+(r.media||0); });
    ensureChart('ch_dow', labels, (chartMode.dow==='media'?nMed:nArr), (chartMode.dow==='media'?pMed:pArr));
  }

  const pM = packs.find(p=>p.k==='month');
  if(!only || only==='month'){
    const n = pM?.now||[], p = pM?.prev||[];
    const all = [...new Set([...n.map(r=>r.ym), ...p.map(r=>r.ym)])].sort();
    const mapN=new Map(n.map(r=>[r.ym, chartMode.month==='media' ? (+r.media||0) : (+r.total||0)]));
    const mapP=new Map(p.map(r=>[r.ym, chartMode.month==='media' ? (+r.media||0) : (+r.total||0)]));
    ensureChart('ch_month', all.map(ymLabel), all.map(x=>mapN.get(x)||0), all.map(x=>mapP.get(x)||0));
  }

  const pH = packs.find(p=>p.k==='hour');
  if(!only || only==='hour'){
    const labels=Array.from({length:24},(_,h)=>String(h).padStart(2,'0')+'h');
    const nArr = Array(24).fill(0), pArr=Array(24).fill(0), nMed=Array(24).fill(0), pMed=Array(24).fill(0);
    (pH?.now||[]).forEach(r=>{ nArr[r.h]=+(r.total||0); nMed[r.h]=+(r.media||0); });
    (pH?.prev||[]).forEach(r=>{ pArr[r.h]=+(r.total||0); pMed[r.h]=+(r.media||0); });
    ensureChart('ch_hour', labels, (chartMode.hour==='media'?nMed:nArr), (chartMode.hour==='media'?pMed:pArr));
  }

  const pT = packs.find(p=>p.k==='turno');
  if(!only || only==='turno'){
    const order=['Manhã','Tarde','Noite','Madrugada','Dia'];
    const n = new Map((pT?.now||[]).map(r=>[r.turno, chartMode.turno==='media'? (+r.media||0) : (+r.total||0)]));
    const p = new Map((pT?.prev||[]).map(r=>[r.turno, chartMode.turno==='media'? (+r.media||0) : (+r.total||0)]));
    const labels = order.filter(x=> n.has(x) || p.has(x));
    ensureChart('ch_turno', labels, labels.map(l=>n.get(l)||0), labels.map(l=>p.get(l)||0));
  }
}

/* ========= KPIs ========= */
function computePrevRangeISO(deISO,ateISO){
  const d1=new Date(deISO+'T00:00:00'), d2=new Date(ateISO+'T00:00:00');
  const len=daysLen(deISO,ateISO);
  const atePrev=new Date(d1.getTime()-86400000);
  const dePrev=new Date(atePrev.getTime()-(len-1)*86400000);
  return { dePrev: iso(dePrev), atePrev: iso(atePrev) };
}
function agg(rows){ let ped=0,fat=0,des=0,fre=0; for(const r of (rows||[])){ ped+=+r.pedidos||0; fat+=+r.fat||0; des+=+r.des||0; fre+=+r.fre||0; } return {ped,fat,des,fre}; }

async function updateKPIs(de, ate, dePrev, atePrev){
  const pNow=buildParams(de,ate), pPrev=buildParams(dePrev,atePrev);

  // 1) Tenta RPC de KPIs
  const now = await tryRPC(KPI_RPC_CANDIDATES, pNow);
  const prev= await tryRPC(KPI_RPC_CANDIDATES, pPrev);

  let N=null, P=null, CN=null, CP=null;
  if(now && prev){
    // o RPC deve retornar linhas já agregadas por filtros
    N = agg(now.data||[]);
    P = agg(prev.data||[]);

    // cancelados: força p_cancelado='Sim'
    const cNow = await tryRPC(KPI_RPC_CANDIDATES, {...pNow,  p_cancelado:'Sim'});
    const cPre = await tryRPC(KPI_RPC_CANDIDATES, {...pPrev, p_cancelado:'Sim'});
    CN = agg((cNow?.data)||[]);
    CP = agg((cPre?.data)||[]);
  }else{
    // 2) Fallback local (pode superestimar pedidos se a view não tiver 1:1 por pedido)
    const [rowsNow, rowsPrev] = await Promise.all([ fetchAllRows(de,ate), fetchAllRows(dePrev,atePrev) ]);
    const sumN = sumKPIs(rowsNow), sumP = sumKPIs(rowsPrev);
    N = {ped:sumN.ped, fat:sumN.fat, des:sumN.des, fre:sumN.fre};
    P = {ped:sumP.ped, fat:sumP.fat, des:sumP.des, fre:sumP.fre};
    CN = {ped:sumN.cPed, fat:sumN.cFat, des:0, fre:0};
    CP = {ped:sumP.cPed, fat:sumP.cFat, des:0, fre:0};
    setDiag(`Local agg ✓ — linhas atual: ${rowsNow.length} / anterior: ${rowsPrev.length} — fonte: ${READ_VIEW}`);
  }

  const len = daysLen(de,ate);
  const tktN = N.ped? N.fat/N.ped : 0, tktP = P.ped? P.fat/P.ped : 0;
  const fatMedN = len? N.fat/len : 0,    fatMedP = len? P.fat/len : 0;
  const desPercN = N.fat? N.des/N.fat : 0, desPercP = P.fat? P.des/P.fat : 0;
  const freMedN = N.ped? N.fre/N.ped : 0, freMedP = P.ped? P.fre/P.ped : 0;
  const partCancN = N.ped? CN.ped/N.ped : 0, partCancP = P.ped? CP.ped/P.ped : 0;

  $('k_ped').textContent=num(N.ped); $('p_ped').textContent=num(P.ped); deltaBadge($('d_ped'),N.ped,P.ped);
  $('k_tkt').textContent=money(tktN); $('p_tkt').textContent=money(tktP); deltaBadge($('d_tkt'),tktN,tktP);
  $('k_fat').textContent=money(N.fat); $('p_fat').textContent=money(P.fat); deltaBadge($('d_fat'),N.fat,P.fat);
  $('k_fatmed').textContent=money(fatMedN); $('p_fatmed').textContent=money(fatMedP); deltaBadge($('d_fatmed'),fatMedN,fatMedP);
  $('k_des').textContent=money(N.des); $('p_des').textContent=money(P.des); deltaBadge($('d_des'),N.des,P.des);
  $('k_desperc').textContent=pctf(desPercN); $('p_desperc').textContent=pctf(desPercP); deltaBadge($('d_desperc'),desPercN,desPercP);
  $('k_fre').textContent=money(N.fre); $('p_fre').textContent=money(P.fre); deltaBadge($('d_fre'),N.fre,P.fre);
  $('k_fremed').textContent=money(freMedN); $('p_fremed').textContent=money(freMedP); deltaBadge($('d_fremed'),freMedN,freMedP);

  $('k_canc_ped').textContent=num(CN.ped); deltaBadge($('d_canc_ped'),CN.ped,CP.ped);
  $('k_canc_val').textContent=money(CN.fat); $('p_canc_val').textContent=money(CP.fat); deltaBadge($('d_canc_val'),CN.fat,CP.fat);
  $('k_canc_part').textContent=pctf(partCancN); $('p_canc_part').textContent=pctf(partCancP);

  const roiN = computeROI(N), roiP = computeROI(P);
  $('k_roi').textContent= Number.isFinite(roiN)? pctf(roiN) : '—';
  $('p_roi').textContent= Number.isFinite(roiP)? pctf(roiP) : '—';
  deltaBadge($('d_roi'), Number.isFinite(roiN)?roiN:0, Number.isFinite(roiP)?roiP:0);
}

/* ========= UPDATE GERAL ========= */
async function updateEverything(){
  try{
    setStatus('Atualizando…','');
    const de=fDe.value||firstDay, ate=fAte.value||lastDay;
    const {dePrev, atePrev} = computePrevRangeISO(de,ate);

    await loadStaticOptions();
    await updateKPIs(de,ate,dePrev,atePrev);
    await updateChartsRPC();

    setStatus('OK','ok');
  }catch(e){
    console.error(e);
    setStatus('Erro ao atualizar','err');
    setDiag(e.message||String(e));
  }
}

/* ========= INIT ========= */
(async function init(){
  try{
    setStatus('Carregando…');
    await probeView();
    await loadDateRange();
    $('periodoInfo').textContent=`Último dia carregado: ${lastDay}`;
    applyQuick('30');
  }catch(e){
    console.error(e);
    setStatus('Erro ao iniciar: '+(e.message||e),'err');
  }
})();
