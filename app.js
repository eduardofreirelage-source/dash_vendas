/* ========= CONFIG ========= */
const SUPABASE_URL  = 'https://uahmcfzerofhzjvlzrqc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaG1jZnplcm9maHpqdmx6cnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNTg2MzQsImV4cCI6MjA3MDczNDYzNH0.lPVr3wmrXAmSMY5j7JFy6mI87T3I2TxhVKV-gLc7_VU';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* Views & RPCs candidatos */
const VIEW_CANDIDATES = ['vendas_canon_front','mv_vendas_canon_front','vendas_canon'];
const KPI_RPC_CANDIDATES = ['kpi_vendas_front','kpi_vendas','kpi_vendas_v2'];
const CHART_RPC = {
  dow:   ['chart_vendas_dow_front','chart_vendas_dow_v1','chart_vendas_dow'],
  month: ['chart_vendas_mes_front','chart_vendas_mes_v1','chart_vendas_mes'],
  hour:  ['chart_vendas_hora_front','chart_vendas_hora_v1','chart_vendas_hora'],
  turno: ['chart_vendas_turno_front','chart_vendas_turno_v1','chart_vendas_turno'],
};
let READ_VIEW = VIEW_CANDIDATES[0];

/* ========= HELPERS ========= */
const $=id=>document.getElementById(id);
const setStatus=(t,k)=>{const el=$('status'); if(!el) return; el.textContent=t; el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085');};
const setDiag=t=>{const el=$('diag'); if(el) el.textContent=t||'';};
const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const num  =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
const pctf =v=>(v==null||!isFinite(+v))?'0,0%':((+v)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const iso  =d=>d.toISOString().slice(0,10);
const addDaysISO=(s,n)=>{const d=new Date(s+'T00:00:00'); d.setDate(d.getDate()+n); return iso(d);};
const daysLen=(de,ate)=>{const d1=new Date(de+'T00:00:00'), d2=new Date(ate+'T00:00:00'); return Math.round((d2-d1)/86400000)+1;};
const upSVG =()=>'<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3l5 6h-3v8H8V9H5l5-6z"/></svg>';
const dnSVG =()=>'<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 17l-5-6h3V3h4v8h3l-5 6z"/></svg>';
function deltaBadge(el,curr,prev){ if(!el) return; if(!isFinite(prev)||+prev===0){el.textContent='—';el.className='delta flat';return;} const p=((curr-prev)/prev)*100; el.innerHTML=(p>=0?upSVG():dnSVG())+' '+Math.abs(p).toFixed(1)+'%'; el.className='delta '+(p>=0?'up':'down'); }
function computeROI(sum){ if(!sum || !isFinite(sum.des) || sum.des<=0) return NaN; return (sum.fat - sum.des)/sum.des; }

/* ========= MULTISELECT ========= */
function MultiSelect(rootId, placeholder){
  const root=$(rootId); const btn=root.querySelector('.msel-btn'); const panel=root.querySelector('.msel-panel');
  let options=[], selected=new Set(), filtered=[];
  function render(){ panel.innerHTML=''; const q=document.createElement('input'); q.className='msel-search'; q.placeholder='Filtrar…';
    q.addEventListener('input',()=>{filtered=options.filter(v=>String(v).toLowerCase().includes(q.value.toLowerCase())); draw();});
    panel.appendChild(q); draw();
  }
  function draw(){ const box=document.createElement('div');
    (filtered.length?filtered:options).forEach(v=>{ const row=document.createElement('div'); row.className='msel-opt';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.value=v; cb.checked=selected.has(v);
      const lb=document.createElement('label'); lb.textContent=v??'—';
      cb.addEventListener('change',()=>{cb.checked?selected.add(v):selected.delete(v); refresh(); applyAll();});
      row.appendChild(cb); row.appendChild(lb); box.appendChild(row);
    });
    panel.querySelectorAll('.msel-opt').forEach(n=>n.remove()); panel.appendChild(box);
  }
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
function applyQuick(v){ setActiveChip(v); const ate=lastDay||iso(new Date()); const de=addDaysISO(ate, -(Number(v)-1)); fDe.value=de; fAte.value=ate; if(periodoInfo) periodoInfo.textContent=`Último dia carregado: ${lastDay}`; applyAll(); }
$('btnClear').addEventListener('click',()=>{ ms.unids.set([]); ms.lojas.set([]); ms.canais.set([]); ms.turnos.set([]); ms.pags.set([]); const c=document.querySelector('#ms-cancel .msel-panel input[value="Não"]'); if(c){ c.checked=true; } const b=document.querySelector('#ms-cancel .msel-btn'); if(b) b.textContent='Não'; applyQuick('30'); });
chips.forEach(b=> b.addEventListener('click',()=>applyQuick(b.dataset.q)));
[fDe,fAte].forEach(i=> i.addEventListener('change',()=>{ chips.forEach(c=>c.classList.remove('active')); if(periodoInfo) periodoInfo.textContent=`Último dia carregado: ${lastDay}`; applyAll(); }));
function applyAll(){ updateEverything(); }

/* ========= DETECÇÃO DE VIEW / DATERANGE ========= */
async function probeView(){
  for(const v of VIEW_CANDIDATES){
    const r = await supa.from(v).select('dia').limit(1);
    if(!r.error){ READ_VIEW = v; return; }
  }
  throw new Error('Nenhuma view acessível: '+VIEW_CANDIDATES.join(', '));
}
async function loadDateRange(){
  // tenta a view vw_vendas_daterange; se 404, faz fallback
  const r = await supa.from('vw_vendas_daterange').select('*').limit(1);
  if(!r.error && r.data?.length){ firstDay=r.data[0].min_dia; lastDay=r.data[0].max_dia; return; }
  const minq = await supa.from(READ_VIEW).select('dia').order('dia',{ascending:true}).limit(1);
  const maxq = await supa.from(READ_VIEW).select('dia').order('dia',{ascending:false}).limit(1);
  firstDay = (!minq.error && minq.data?.[0]?.dia) || iso(new Date());
  lastDay  = (!maxq.error && maxq.data?.[0]?.dia) || iso(new Date());
}

/* ========= OPÇÕES ========= */
async function loadStaticOptions(){
  const de=fDe.value||firstDay, ate=fAte.value||lastDay;
  async function distinct(col){
    let q=supa.from(READ_VIEW).select(col,{distinct:true}).order(col,{ascending:true}).gte('dia',de).lte('dia',ate).limit(200000);
    const {data,error}=await q; if(error){return [];} return [...new Set((data||[]).map(r=>r[col]))];
  }
  const [unids,lojas,canais,turnos,pags]=await Promise.all([distinct('unidade'),distinct('loja'),distinct('canal'),distinct('turno'),distinct('pagamento_base')]);
  ms.unids.setOptions(unids); ms.lojas.setOptions(lojas); ms.canais.setOptions(canais); ms.turnos.setOptions(turnos); ms.pags.setOptions(pags);
}

/* ========= FILTROS ========= */
function applyFilters(q,de,ate){
  q.gte('dia',de).lte('dia',ate);
  const un=ms.unids.get(), lj=ms.lojas.get(), ca=ms.canais.get(), tu=ms.turnos.get(), pg=ms.pags.get();
  if(un.length) q.in('unidade', un);
  if(lj.length) q.in('loja', lj);
  if(ca.length) q.in('canal', ca);
  if(tu.length) q.in('turno', tu);
  if(pg.length) q.in('pagamento_base', pg);
  const btn=document.querySelector('#ms-cancel .msel-btn'); const txt=btn?btn.textContent.trim():'Não';
  if(txt==='Sim') q.eq('cancelado','Sim'); else if(txt==='Não') q.eq('cancelado','Não');
}

/* ========= FETCH LOCAL (com paginação) ========= */
async function countRows(de,ate){
  let q=supa.from(READ_VIEW).select('fat',{count:'exact',head:true}); applyFilters(q,de,ate);
  const {count}=await q; return count||0;
}
async function fetchAllRows(de,ate){
  const total=await countRows(de,ate);
  const page=5000; let from=0, rows=[];
  while(from<total){
    let to=Math.min(from+page-1,total-1);
    let q=supa.from(READ_VIEW).select('dia,hora,turno,unidade,loja,canal,pagamento_base,cancelado,pedidos,fat,des,fre').order('dia',{ascending:true}).range(from,to);
    applyFilters(q,de,ate);
    const {data,error}=await q; if(error) break; rows=rows.concat(data||[]); from=to+1;
  }
  return rows;
}
const toNum=x=>+x||0;
function sumKPIs(rows){
  let ped=0,fat=0,des=0,fre=0,cPed=0,cFat=0;
  for(const r of rows){
    const p=toNum(r.pedidos)||1;
    ped+=p; fat+=toNum(r.fat); des+=toNum(r.des); fre+=toNum(r.fre);
    if(String(r.cancelado).trim().toLowerCase()==='sim'){ cPed+=p; cFat+=toNum(r.fat); }
  }
  return {ped,fat,des,fre,cPed,cFat};
}

/* ========= RPC HELPER ========= */
async function tryRPC(names,args){
  const list=Array.isArray(names)?names:[names];
  for(const n of list){
    try{ const {data,error}=await supa.rpc(n,args); if(!error) return {name:n,data}; }catch(_e){}
  }
  return null;
}

/* ========= CHARTS ========= */
function formatCurrencyTick(value){
  const v=Number(value)||0;
  if(Math.abs(v)>=1_000_000) return 'R$ '+(v/1_000_000).toFixed(1).replace('.',',')+' mi';
  if(Math.abs(v)>=1_000)     return 'R$ '+(v/1_000).toFixed(1).replace('.',',')+' mil';
  return 'R$ '+v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function ensureChart(id,labels,nowArr,prevArr){
  const c=$(id); if(!c) return;
  if(c.__chart){ try{c.__chart.destroy();}catch(_){} c.__chart=null; }
  c.__chart=new Chart(c.getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'Atual',data:nowArr.map(v=>+v||0),backgroundColor:'rgba(47,110,247,0.85)'},
      {label:'Anterior',data:prevArr.map(v=>+v||0),backgroundColor:'rgba(2,132,199,0.6)'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'},ticks:{callback:formatCurrencyTick}}},
      plugins:{legend:{position:'top'},tooltip:{mode:'index',intersect:false,callbacks:{label:(ctx)=>`${ctx.dataset.label}: ${money(ctx.parsed.y||0)}`}}}
    }
  });
}
const chartMode={dow:'total',month:'total',hour:'total',turno:'total'};
document.querySelectorAll('.seg').forEach(seg=>{
  seg.addEventListener('click',(e)=>{const btn=e.target.closest('.seg-btn'); if(!btn) return; const key=seg.dataset.chart; chartMode[key]=btn.dataset.mode; seg.querySelectorAll('.seg-btn').forEach(b=>b.classList.toggle('active',b===btn)); updateChartsRPC(key);});
});
function ymLabel(ym){ const [y,m]=ym.split('-').map(Number); const n=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${n[m-1]}/${String(y).slice(-2)}`; }

/* cache de linhas para fallback de gráficos */
let cacheKey='', cacheNow=[], cachePrev=[];
function currentFilterKey(de,ate){ const b=document.querySelector('#ms-cancel .msel-btn'); const canc=b?b.textContent.trim():'Não'; return JSON.stringify({de,ate,un:ms.unids.get(),lj:ms.lojas.get(),ca:ms.canais.get(),tu:ms.turnos.get(),pg:ms.pags.get(),canc}); }
async function ensureRows(de,ate,dePrev,atePrev){
  const key=currentFilterKey(de,ate)+'|'+currentFilterKey(dePrev,atePrev);
  if(key===cacheKey && (cacheNow.length||cachePrev.length)) return;
  [cacheNow,cachePrev] = await Promise.all([fetchAllRows(de,ate), fetchAllRows(dePrev,atePrev)]);
  cacheKey=key;
}

function groupBy(rows, keyFn, valFn=(r)=>toNum(r.fat)){
  const map=new Map(); for(const r of rows){ const k=keyFn(r), v=valFn(r); map.set(k,(map.get(k)||0)+v); } return map;
}
function avgBy(rows, keyFn, valFn=(r)=>toNum(r.fat)){
  const sum=new Map(), cnt=new Map();
  for(const r of rows){ const k=keyFn(r), v=valFn(r); sum.set(k,(sum.get(k)||0)+v); cnt.set(k,(cnt.get(k)||0)+1); }
  const out=new Map(); for(const [k,s] of sum){ out.set(k, s/(cnt.get(k)||1)); } return out;
}
async function updateChartsLocal(only){
  const nRows=cacheNow, pRows=cachePrev;
  if(!nRows.length && !pRows.length){ return; }

  if(!only || only==='dow'){
    const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const idx=r=> new Date(r.dia+'T00:00:00').getDay();
    const sumN=Array(7).fill(0), sumP=Array(7).fill(0), avgN=Array(7).fill(0), avgP=Array(7).fill(0), cN=Array(7).fill(0), cP=Array(7).fill(0);
    nRows.forEach(r=>{ const i=idx(r); sumN[i]+=toNum(r.fat); cN[i]++; });
    pRows.forEach(r=>{ const i=idx(r); sumP[i]+=toNum(r.fat); cP[i]++; });
    for(let i=0;i<7;i++){ avgN[i]=cN[i]?sumN[i]/cN[i]:0; avgP[i]=cP[i]?sumP[i]/cP[i]:0; }
    ensureChart('ch_dow', labels, chartMode.dow==='media'?avgN:sumN, chartMode.dow==='media'?avgP:sumP);
  }

  if(!only || only==='month'){
    const key=r=>(r.dia||'').slice(0,7);
    const mN=groupBy(nRows,key), mP=groupBy(pRows,key);
    const all=[...new Set([...mN.keys(),...mP.keys()])].sort();
    ensureChart('ch_month', all.map(ymLabel), all.map(k=>mN.get(k)||0), all.map(k=>mP.get(k)||0));
  }

  if(!only || only==='hour'){
    const labels=Array.from({length:24},(_,h)=>String(h).padStart(2,'0')+'h');
    const sumN=Array(24).fill(0), sumP=Array(24).fill(0), avgN=Array(24).fill(0), avgP=Array(24).fill(0), cN=Array(24).fill(0), cP=Array(24).fill(0);
    nRows.forEach(r=>{ const h=(+r.hora)||0; sumN[h]+=toNum(r.fat); cN[h]++; });
    pRows.forEach(r=>{ const h=(+r.hora)||0; sumP[h]+=toNum(r.fat); cP[h]++; });
    for(let h=0;h<24;h++){ avgN[h]=cN[h]?sumN[h]/cN[h]:0; avgP[h]=cP[h]?sumP[h]/cP[h]:0; }
    ensureChart('ch_hour', labels, chartMode.hour==='media'?avgN:sumN, chartMode.hour==='media'?avgP:sumP);
  }

  if(!only || only==='turno'){
    const order=['Manhã','Tarde','Noite','Madrugada','Dia'];
    const label=r=>r.turno||'';
    const sN=groupBy(nRows,label), sP=groupBy(pRows,label);
    const labels=order.filter(x=> sN.has(x)||sP.has(x));
    let nArr=labels.map(l=>sN.get(l)||0), pArr=labels.map(l=>sP.get(l)||0);
    if(chartMode.turno==='media'){
      const aN=avgBy(nRows,label), aP=avgBy(pRows,label);
      nArr=labels.map(l=>aN.get(l)||0); pArr=labels.map(l=>aP.get(l)||0);
    }
    ensureChart('ch_turno', labels, nArr, pArr);
  }
}

async function updateChartsRPC(only){
  const de=fDe.value||firstDay, ate=fAte.value||lastDay;
  const {dePrev, atePrev} = computePrevRangeISO(de,ate);
  await ensureRows(de,ate,dePrev,atePrev); // para fallback local

  try{
    const kinds = only ? [only] : ['dow','month','hour','turno'];
    let hadRPC=false;

    for(const k of kinds){
      const paramsNow = buildParams(de,ate);
      const paramsPrev= buildParams(dePrev,atePrev);
      const rNow  = await tryRPC(CHART_RPC[k], paramsNow);
      const rPrev = await tryRPC(CHART_RPC[k], paramsPrev);
      if(!rNow || !rPrev){ continue; }
      hadRPC=true;

      if(k==='dow'){
        const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        const nArr=Array(7).fill(0), pArr=Array(7).fill(0), nMed=Array(7).fill(0), pMed=Array(7).fill(0);
        (rNow.data||[]).forEach(r=>{ nArr[r.dow]=+(r.total||0); nMed[r.dow]=+(r.media||0); });
        (rPrev.data||[]).forEach(r=>{ pArr[r.dow]=+(r.total||0); pMed[r.dow]=+(r.media||0); });
        ensureChart('ch_dow', labels, chartMode.dow==='media'?nMed:nArr, chartMode.dow==='media'?pMed:pArr);
      }
      if(k==='month'){
        const n=rNow.data||[], p=rPrev.data||[];
        const all=[...new Set([...n.map(r=>r.ym),...p.map(r=>r.ym)])].sort();
        const mapN=new Map(n.map(r=>[r.ym, chartMode.month==='media'? (+r.media||0):(+r.total||0)]));
        const mapP=new Map(p.map(r=>[r.ym, chartMode.month==='media'? (+r.media||0):(+r.total||0)]));
        ensureChart('ch_month', all.map(ymToLabel), all.map(x=>mapN.get(x)||0), all.map(x=>mapP.get(x)||0));
      }
      if(k==='hour'){
        const labels=Array.from({length:24},(_,h)=>String(h).padStart(2,'0')+'h');
        const nArr=Array(24).fill(0), pArr=Array(24).fill(0), nMed=Array(24).fill(0), pMed=Array(24).fill(0);
        (rNow.data||[]).forEach(r=>{ nArr[r.h]=+(r.total||0); nMed[r.h]=+(r.media||0); });
        (rPrev.data||[]).forEach(r=>{ pArr[r.h]=+(r.total||0); pMed[r.h]=+(r.media||0); });
        ensureChart('ch_hour', labels, chartMode.hour==='media'?nMed:nArr, chartMode.hour==='media'?pMed:pArr);
      }
      if(k==='turno'){
        const order=['Manhã','Tarde','Noite','Madrugada','Dia'];
        const n=new Map((rNow.data||[]).map(r=>[r.turno, chartMode.turno==='media'? (+r.media||0):(+r.total||0)]));
        const p=new Map((rPrev.data||[]).map(r=>[r.turno, chartMode.turno==='media'? (+r.media||0):(+r.total||0)]));
        const labels=order.filter(x=> n.has(x)||p.has(x));
        ensureChart('ch_turno', labels, labels.map(l=>n.get(l)||0), labels.map(l=>p.get(l)||0));
      }
    }

    if(!hadRPC){
      setStatus('OK (gráficos via RPC indisponíveis, usando view)','ok');
      await updateChartsLocal(only);
    }else{
      setStatus('OK','ok');
    }
  }catch(_e){
    setStatus('OK (gráficos via RPC indisponíveis, usando view)','ok');
    await updateChartsLocal(only);
  }
}

/* ========= KPIs ========= */
function computePrevRangeISO(deISO,ateISO){
  const d1=new Date(deISO+'T00:00:00'); const len=daysLen(deISO,ateISO);
  const atePrev=new Date(d1.getTime()-86400000); const dePrev=new Date(atePrev.getTime()-(len-1)*86400000);
  return { dePrev: iso(dePrev), atePrev: iso(atePrev) };
}
function buildParams(de,ate){
  const btn=document.querySelector('#ms-cancel .msel-btn'); const canc=btn?btn.textContent.trim():'Não';
  return {
    p_dini:de,p_dfim:ate,
    p_unids: ms.unids.get().length ? ms.unids.get():null,
    p_lojas: ms.lojas.get().length ? ms.lojas.get():null,
    p_turnos:ms.turnos.get().length? ms.turnos.get():null,
    p_canais:ms.canais.get().length? ms.canais.get():null,
    p_pags:  ms.pags.get().length  ? ms.pags.get()  :null,
    p_cancelado: (canc==='Sim'||canc==='Não')?canc:null
  };
}
function agg(rows){ let ped=0,fat=0,des=0,fre=0; for(const r of (rows||[])){ ped+=+r.pedidos||0; fat+=+r.fat||0; des+=+r.des||0; fre+=+r.fre||0; } return {ped,fat,des,fre}; }

async function updateKPIs(de,ate,dePrev,atePrev){
  // garantir cache de linhas para fallback
  await ensureRows(de,ate,dePrev,atePrev);

  const pNow=buildParams(de,ate), pPrev=buildParams(dePrev,atePrev);
  const now=await tryRPC(KPI_RPC_CANDIDATES,pNow);
  const prev=await tryRPC(KPI_RPC_CANDIDATES,pPrev);

  let N,P,CN,CP;
  if(now && prev){
    N=agg(now.data||[]); P=agg(prev.data||[]);
    const cNow=await tryRPC(KPI_RPC_CANDIDATES,{...pNow,p_cancelado:'Sim'});
    const cPre=await tryRPC(KPI_RPC_CANDIDATES,{...pPrev,p_cancelado:'Sim'});
    CN=agg((cNow?.data)||[]); CP=agg((cPre?.data)||[]);
  }else{
    const sumN=sumKPIs(cacheNow), sumP=sumKPIs(cachePrev);
    N={ped:sumN.ped,fat:sumN.fat,des:sumN.des,fre:sumN.fre};
    P={ped:sumP.ped,fat:sumP.fat,des:sumP.des,fre:sumP.fre};
    CN={ped:sumN.cPed,fat:sumN.cFat,des:0,fre:0};
    CP={ped:sumP.cPed,fat:sumP.cFat,des:0,fre:0};
    setDiag(`Local agg ✓ — linhas atual: ${cacheNow.length} / anterior: ${cachePrev.length} — fonte: ${READ_VIEW}`);
  }

  const len=daysLen(de,ate);
  const tktN=N.ped?N.fat/N.ped:0, tktP=P.ped?P.fat/P.ped:0;
  const fatMedN=len?N.fat/len:0,   fatMedP=len?P.fat/len:0;
  const desPercN=N.fat?N.des/N.fat:0, desPercP=P.fat?P.des/P.fat:0;
  const freMedN=N.ped?N.fre/N.ped:0, freMedP=P.ped?P.fre/P.ped:0;
  const partCancN=N.ped?CN.ped/N.ped:0, partCancP=P.ped?CP.ped/P.ped:0;

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

  const roiN=computeROI(N), roiP=computeROI(P);
  $('k_roi').textContent=Number.isFinite(roiN)?pctf(roiN):'—';
  $('p_roi').textContent=Number.isFinite(roiP)?pctf(roiP):'—';
  deltaBadge($('d_roi'),Number.isFinite(roiN)?roiN:0, Number.isFinite(roiP)?roiP:0);
}

/* ========= UPDATE GERAL ========= */
async function updateEverything(){
  try{
    setStatus('Atualizando…');
    const de=fDe.value||firstDay, ate=fAte.value||lastDay;
    const {dePrev,atePrev}=computePrevRangeISO(de,ate);
    await loadStaticOptions();
    await ensureRows(de,ate,dePrev,atePrev);
    await updateKPIs(de,ate,dePrev,atePrev);
    await updateChartsRPC();
    setStatus('OK','ok');
  }catch(e){
    console.error(e);
    setStatus('Erro ao atualizar','err');
    setDiag(e.message||String(e));
  }
}

/* ========= UPLOAD EXCEL (opcional) ========= */
document.getElementById('btnUpload')?.addEventListener('click',()=>document.getElementById('fileExcel').click());
document.getElementById('fileExcel')?.addEventListener('change', onUploadExcel);

async function onUploadExcel(ev){
  const file=ev.target.files?.[0]; if(!file) return;
  try{
    setStatus('Lendo Excel…');
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]];
    const json=XLSX.utils.sheet_to_json(ws,{raw:false,defval:null});
    if(!json.length){ setStatus('Arquivo vazio','err'); return; }

    // mapeia colunas pelos nomes padrões do seu schema
    const pick=(obj,keys)=> keys.find(k=>Object.prototype.hasOwnProperty.call(obj,k));
    const rows=json.map(r=>{
      const dia = r['dia']||r['data']||r['data_venda'];
      const hora= r['hora']??null;
      const row={
        dia: normDateCell(dia),
        hora: (hora==null? null : Math.max(0, Math.min(23, parseInt(String(hora).match(/\d+/)?.[0]||'0',10)))),
        unidade: (r['unidade']??'')+'',
        loja:    (r['loja']??r['Nome da loja']??'')+'',
        canal:   (r['canal']??r['Canal de venda']??'')+'',
        pagamento_base: (r['pagamento_base']??r['tipo_pagamento']??'')+'',
        cancelado: normCancel(r['cancelado']),
        pedidos: +r['pedidos']||1,
        fat: +br2num(r['fat']??r['faturamento']??0),
        des: +br2num(r['des']??0),
        fre: +br2num(r['fre']??0),
      };
      row.row_key = [row.dia,row.hora,row.unidade,row.loja,row.canal,row.pagamento_base,row.cancelado,row.pedidos].join('|').toLowerCase();
      return row;
    }).filter(x=>!!x.dia);

    if(!rows.length){ setStatus('Sem linhas válidas','err'); return; }
    setStatus(`Enviando ${rows.length} linhas…`);
    for(let i=0;i<rows.length;i+=500){
      const slice=rows.slice(i,i+500);
      const {error}=await supa.from('vendas_xlsx').upsert(slice,{onConflict:'row_key'});
      if(error) throw error;
    }
    setStatus('Upload concluído','ok');
    document.getElementById('fileExcel').value='';
    await updateEverything();
  }catch(e){
    console.error(e); setStatus('Erro no upload: '+(e.message||e),'err');
  }
}
function normDateCell(v){
  if(!v) return null;
  if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
  if(typeof v==='string'){ const m=v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if(m){ const [_,dd,mm,yy]=m; return iso(new Date(+yy,+mm-1,+dd)); } }
  if(typeof v==='number'){ const base=new Date(Date.UTC(1899,11,30)); return iso(new Date(base.getTime()+v*86400000)); }
  const d=new Date(v); return isNaN(d)? null : iso(d);
}
function br2num(v){ if(v==null) return 0; let s=String(v).replace(/[^\d,.\-]/g,''); const c=s.lastIndexOf(','); const d=s.lastIndexOf('.'); if(d>c){ s=s.replace(/,/g,''); } else { s=s.replace(/\./g,''); s=s.replace(',','.'); } const n=Number(s); return isFinite(n)?n:0; }
function normCancel(v){ const s=String(v??'').trim().toLowerCase(); if(['sim','s','true','1','yes','y'].includes(s)) return 'Sim'; return 'Não'; }

/* ========= INIT ========= */
(async function init(){
  try{
    setStatus('Carregando…');
    await probeView();
    await loadDateRange();
    if(periodoInfo) periodoInfo.textContent=`Último dia carregado: ${lastDay}`;
    applyQuick('30');
  }catch(e){
    console.error(e);
    setStatus('Erro ao iniciar: '+(e.message||e),'err');
  }
})();
function ymToLabel(ym){ const [y,m]=ym.split('-').map(Number); const n=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${n[m-1]}/${String(y).slice(-2)}`; }
