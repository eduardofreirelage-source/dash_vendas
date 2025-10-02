/* =======================================================================
   dash_pratos.js — v10.4-safemode2
   - Modo "safe": NÃO usa RPCs. Tudo sai de vendas_pratos (paginação).
   - KPIs/Top10/DOW do mesmo dataset => consistentes.
   - Gráfico mensal = últimos 12 meses a partir do MÊS da data inicial do filtro.
   - Logs/diagnósticos fortes no console.
   - Import XLSX robusto com multi-CDN + fallback CSV.
   ======================================================================= */

const APP_VERSION = 'v10.4-safemode2';
const DEBUG = true;

/* ===================== SUPABASE ===================== */
const SUPABASE_URL_ESTOQUE  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON_ESTOQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
const supaEstoque = window.supabase.createClient(SUPABASE_URL_ESTOQUE, SUPABASE_ANON_ESTOQUE);

/* ===================== DEBUG HELPERS ===================== */
const dbg = (...a)=> DEBUG && console.log(...a);
const warn = (...a)=> console.warn(...a);

/* ===================== HELPERS ===================== */
const $  = (id)=> document.getElementById(id);
const $$ = (s)=> document.querySelectorAll(s);
const cssVar = (name)=> getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const num = (v,d=0)=> (v==null||!isFinite(+v)) ? '0' : (+v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp = v => Number.isFinite(+v) ? +v : 0;

function getDateUTC(input){
  let d;
  if (typeof input==='string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) d=new Date(input+'T12:00:00Z');
  else if (input instanceof Date) d=new Date(Date.UTC(input.getUTCFullYear(),input.getUTCMonth(),input.getUTCDate(),12,0,0));
  else { const now=new Date(); d=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate(),12,0,0)); }
  if (isNaN(d)) return getDateUTC(new Date());
  return d;
}
const getISO = d => getDateUTC(d).toISOString().split('T')[0];
const daysInc = (s,e)=> Math.max(1, Math.round((getDateUTC(e)-getDateUTC(s))/86400000)+1);

function startOfMonthUTC(d){ const dt=getDateUTC(d); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 12,0,0)); }
function endOfMonthUTC(d){ const dt=getDateUTC(d); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth()+1, 0, 12,0,0)); }
function addMonthsUTC(d, m){ const dt=getDateUTC(d); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth()+m, 1, 12,0,0)); }
function ymKey(d){ const dt=getDateUTC(d); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`; }
function monthName(x){
  let dt; if(typeof x==='string' && /^\d{4}-\d{2}$/.test(x)) dt=new Date(Date.UTC(+x.slice(0,4), +x.slice(5,7)-1, 1));
  else if(x instanceof Date) dt=x; else dt=new Date(x);
  if(isNaN(dt)) return String(x);
  const nm = dt.toLocaleString('pt-BR',{month:'long', timeZone:'UTC'}); return nm.charAt(0).toUpperCase()+nm.slice(1);
}

/* ===================== UI HELPERS ===================== */
function setChartMessage(boxId, msg){
  const box=$(boxId); if(!box) return;
  let m = box.querySelector('.chart-message');
  if(!msg){ if(m) m.remove(); return; }
  if(!m){ m=document.createElement('div'); m.className='chart-message'; box.appendChild(m); }
  m.textContent = msg;
}
function updateDelta(elId, cur, prev){
  const el=$(elId); if(!el) return;
  const c=clamp(cur), p=clamp(prev);
  if(p===0 && c===0){ el.textContent='—'; el.classList.remove('up','down'); return; }
  if(p===0){ el.textContent='+100%'; el.classList.add('up'); el.classList.remove('down'); return; }
  const d=((c-p)/p)*100; const txt=(d>=0?'+':'')+d.toFixed(1)+'%';
  el.textContent=txt; el.classList.toggle('up', d>=0); el.classList.toggle('down', d<0);
}
function setLoading(on){ ['fxBtnMore','btnUpload','fxBtnReset'].forEach(id=>{ const el=$(id); if(el) el.disabled=!!on; }); }

/* ===================== CHARTS ===================== */
let chartMonth, chartDow;
function renderMonthChart(series){
  if(chartMonth) chartMonth.destroy();
  setChartMessage('box_month', null);
  if(!Array.isArray(series)||series.length===0){ setChartMessage('box_month','Sem dados.'); return; }
  const ctx=$('ch_month').getContext('2d');
  const wine=cssVar('--wine')||'#7b1e3a', cprev=cssVar('--c-prev')||'#9ca3af';
  const labels=series.map(s=> monthName(s.period));
  const cur=series.map(s=> clamp(s.current_total));
  const prv=series.map(s=> clamp(s.prev_total));
  chartMonth = new Chart(ctx,{
    type:'bar',
    data:{ labels, datasets:[ {label:'Período Atual', data:cur, backgroundColor:wine, borderRadius:4}, {label:'Período Anterior', data:prv, backgroundColor:cprev, borderRadius:4} ] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });
}
function renderDowChart(rows, mode='TOTAL'){
  if(chartDow) chartDow.destroy();
  const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const perDate = new Map(); // soma por data (depois mapeia para DOW)
  rows.forEach(r=>{
    const iso=r.data; const q=clamp(r.quantidade);
    perDate.set(iso, (perDate.get(iso)||0)+q);
  });
  const totals=[0,0,0,0,0,0,0], dayCounts=[0,0,0,0,0,0,0];
  for(const [iso, total] of perDate){
    const dow = new Date(iso+'T00:00:00Z').getUTCDay();
    totals[dow]+=total; dayCounts[dow]+=1;
  }
  const vals = (mode==='MÉDIA') ? totals.map((t,i)=> dayCounts[i] ? t/dayCounts[i] : 0) : totals;
  const ctx=$('ch_dow').getContext('2d'); const wine=cssVar('--wine')||'#7b1e3a';
  chartDow = new Chart(ctx,{
    type:'bar',
    data:{ labels, datasets:[{ label:(mode==='MÉDIA'?'Média Diária':'Itens Vendidos'), data:vals, backgroundColor:wine, borderColor:wine, borderWidth:1 }] },
    options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
  });
}
function renderTop10(rows, mode='MAIS'){
  const cont=$('top10-list-body'); if(!cont) return; cont.innerHTML='';
  const map=new Map();
  rows.forEach(r=>{ const p=r.prato||'—'; map.set(p, (map.get(p)||0)+clamp(r.quantidade)); });
  let arr=[...map.entries()].map(([prato,qty])=>({prato,qty}));
  arr = arr.filter(a=> a.qty>0);
  if(mode==='MAIS') arr.sort((a,b)=> b.qty-a.qty); else arr.sort((a,b)=> a.qty-b.qty);
  const list=arr.slice(0,10);
  if(list.length===0){ cont.innerHTML=`<div style="text-align:center;padding:20px;color:var(--muted);">Nenhum registro.</div>`; return; }
  list.forEach((r,i)=>{
    const row=document.createElement('div'); row.className='top10-row';
    row.innerHTML = `<span class="top10-col-rank">${i+1}</span>
                     <span class="top10-col-prato" title="${r.prato}">${r.prato}</span>
                     <span class="top10-col-qty">${num(r.qty)}</span>`;
    cont.appendChild(row);
  });
}

/* ===================== MULTISELECT ===================== */
class MultiSelect{
  constructor(id,onChange){ this.c=$(id); if(!this.c) return;
    this.onChange=onChange; this.btn=this.c.querySelector('.msel-btn'); this.panel=this.c.querySelector('.msel-panel');
    this.label=this.c.dataset.singular||'Item'; this.options=[]; this.selected=new Set(); this.initialized=false; this.exclusiveDefault=null;
    this.btn.addEventListener('click',(e)=>{ e.stopPropagation(); if(this.initialized) this.toggle(); });
    this.panel.addEventListener('click',(e)=>{ const opt=e.target.closest('.msel-opt'); if(!opt) return;
      const v=opt.dataset.value; const cb=opt.querySelector('input[type="checkbox"]'); if(e.target!==cb) cb.checked=!cb.checked; this.handle(v, cb.checked);
    });
    document.addEventListener('msel:closeAll',(ev)=>{ const exc=ev.detail?.except; if(this.c.id!==exc) this.close(); });
  }
  initialize(list){ this.options=(list||[]).slice().sort((a,b)=> String(a).localeCompare(String(b))); this.render(); this.initialized=true; this.updateBtn(); }
  render(){
    let html = `<input type="search" class="msel-search" placeholder="Pesquisar...">`;
    html += `<div class="msel-options-list">`;
    if(this.options.length===0){ html+=`<div style="text-align:center;padding:10px;color:var(--muted);font-size:11px;">Nenhuma opção</div>`; }
    else this.options.forEach(o=>{ const s=String(o).replace(/"/g,'&quot;'); const chk=this.selected.has(o)?'checked':''; html+=`<label class="msel-opt" data-value="${s}"><input type="checkbox" ${chk}><span>${s}</span></label>`; });
    html+=`</div>`;
    this.panel.innerHTML=html;
    const search=this.panel.querySelector('.msel-search'); if(search) search.addEventListener('input',(e)=> this.filter(e.target.value));
  }
  filter(q){ const f=(q||'').toLowerCase(); this.panel.querySelectorAll('.msel-opt').forEach(el=>{ const t=(el.dataset.value||'').toLowerCase(); el.style.display = t.includes(f) ? 'flex':'none'; }); }
  updateBtn(){ const c=this.selected.size; this.btn.textContent = c===0?'Todos':(c===1?Array.from(this.selected)[0]:`${c} ${this.label}s Selec.`); }
  handle(value, on){
    if (on){
      if(this.exclusiveDefault && value===this.exclusiveDefault){ this.selected.clear(); this.selected.add(value); }
      else { this.selected.add(value); if (this.exclusiveDefault) this.selected.delete(this.exclusiveDefault); }
    } else { this.selected.delete(value); }
    this.render(); this.updateBtn(); if(this.onChange) this.onChange();
  }
  getSelected(){ return this.selected.size>0 ? Array.from(this.selected) : null; }
  reset(){ this.selected.clear(); if(this.initialized){ this.render(); this.updateBtn(); } }
  toggle(){ this.c.classList.toggle('open'); }
  close(){ this.c.classList.remove('open'); }
}
let filterUnidades, filterCategorias, filterPratos;

/* ===================== FILTROS DE DATA ===================== */
function fxSetRange(s,e){ const a=$('fxDuStart'), b=$('fxDuEnd'); if(a&&b){ a.value=getISO(s); b.value=getISO(e); } }
function fxSetToLastMonthWithData(baseISO){
  const base=getDateUTC(baseISO); const from=new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth()-1, 1));
  const to=new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 0));
  fxSetRange(from,to);
  $$('#fxQuickChips button').forEach(b=>b.classList.remove('active'));
  document.querySelector('#fxQuickChips button[data-win="lastMonth"]')?.classList.add('active');
  $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active'));
}
function fxDispatchApply(){
  const s=$('fxDuStart')?.value, e=$('fxDuEnd')?.value; if(!s||!e) return;
  const payload={
    start:s, end:e,
    unidades:filterUnidades?.getSelected()||null,
    categorias:filterCategorias?.getSelected()||null,
    pratos:filterPratos?.getSelected()||null
  };
  document.dispatchEvent(new CustomEvent('filters:apply',{detail:payload}));
}
function setupFilterInteractions(){
  const fx = { $btnMore:$('fxBtnMore'), $dropup:$('fxDropup'), $quickChips:$('fxQuickChips'), $quickDays:$('fxDuQuickDays'), $start:$('fxDuStart'), $end:$('fxDuEnd'), $btnReset:$('fxBtnReset') };
  fx.$btnMore.addEventListener('click',(e)=>{ e.stopPropagation(); const s=fx.$dropup.classList.toggle('fx-show'); fx.$btnMore.setAttribute('aria-expanded', s); });
  document.addEventListener('click',()=>{ if(fx.$dropup.classList.contains('fx-show')){ fx.$dropup.classList.remove('fx-show'); fx.$btnMore.setAttribute('aria-expanded', false); } document.dispatchEvent(new CustomEvent('msel:closeAll')); });
  fx.$dropup.addEventListener('click',(e)=>{ if(!e.target.closest('.msel')) e.stopPropagation(); });

  fx.$quickChips.addEventListener('click',(e)=>{
    const btn=e.target.closest('button'); if(!btn||btn.classList.contains('active')) return;
    $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active'));
    if(filterUnidades) filterUnidades.reset();
    if(filterCategorias){
      filterCategorias.reset();
      const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos');
      if(def){ filterCategorias.selected.add(def); filterCategorias.exclusiveDefault=def; filterCategorias.render(); filterCategorias.updateBtn(); }
    }
    if(filterPratos) filterPratos.reset();

    const base=getDateUTC(window.__lastDay||new Date());
    let start,end;
    if(btn.dataset.win==='today'){ start=end=base; }
    else if(btn.dataset.win==='yesterday'){ start=new Date(base); start.setUTCDate(base.getUTCDate()-1); end=start; }
    else if(btn.dataset.win==='lastMonth'){ fxSetToLastMonthWithData(window.__lastDay); fxDispatchApply(); return; }
    else if(btn.dataset.win==='lastYear'){ const y=base.getUTCFullYear()-1; start=new Date(Date.UTC(y,0,1)); end=new Date(Date.UTC(y,11,31)); }
    if(start&&end){ fxSetRange(start,end); fxDispatchApply(); }
  });

  fx.$quickDays.addEventListener('click',(e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active')); btn.classList.add('fx-active');
    const n=parseInt(btn.dataset.win,10); const end=getDateUTC(fx.$end.value||window.__lastDay);
    const start=new Date(end); start.setUTCDate(end.getUTCDate()-(n-1));
    fxSetRange(start,end); $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); fxDispatchApply();
  });

  const onDate=()=>{ if(fx.$start.value && fx.$end.value){ $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active')); fxDispatchApply(); } };
  fx.$start.addEventListener('change', onDate); fx.$end.addEventListener('change', onDate);

  fx.$btnReset.addEventListener('click', ()=>{
    fxSetToLastMonthWithData(window.__lastDay);
    if(filterUnidades) filterUnidades.reset();
    if(filterCategorias){
      filterCategorias.reset();
      const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos');
      if(def){ filterCategorias.selected.add(def); filterCategorias.exclusiveDefault=def; filterCategorias.render(); filterCategorias.updateBtn(); }
    }
    if(filterPratos) filterPratos.reset();
    fxDispatchApply(); fx.$dropup.classList.remove('fx-show'); fx.$btnMore.setAttribute('aria-expanded', false);
  });
}

/* ===================== DATA ACCESS (SEM RPC) ===================== */
async function fetchRowsPaged(startIso, endIso, filters, page=5000){
  // 1) count
  let q = supaEstoque.from('vendas_pratos').select('data', { count:'exact', head:true })
    .filter('data', 'gte', startIso).filter('data','lte', endIso);
  if(filters?.unidades)   q = q.in('unidade', filters.unidades);
  if(filters?.categorias) q = q.in('categoria', filters.categorias);
  if(filters?.pratos)     q = q.in('prato',    filters.pratos);

  const head = await q;
  if(head.error){ throw head.error; }
  const total = head.count||0;
  dbg('scan count:', total, 'período:', startIso,'→', endIso, 'filtros:', filters);

  if(total===0) return [];

  // 2) paginação
  const rows=[];
  for(let from=0; from<total; from+=page){
    const to=Math.min(from+page-1, total-1);
    let p = supaEstoque.from('vendas_pratos').select('data,quantidade,prato,unidade,categoria')
      .filter('data','gte', startIso).filter('data','lte', endIso);
    if(filters?.unidades)   p = p.in('unidade', filters.unidades);
    if(filters?.categorias) p = p.in('categoria', filters.categorias);
    if(filters?.pratos)     p = p.in('prato',    filters.pratos);

    const { data, error } = await p.order('data',{ascending:true}).range(from, to);
    if(error) throw error;
    rows.push(...(data||[]));
    await new Promise(r=> setTimeout(r,0));
  }
  dbg('scan fetched rows:', rows.length);
  return rows;
}

/* ===================== AGREGAÇÕES (CONSISTENTES) ===================== */
function buildKpis(rows, startIso, endIso){
  const total = rows.reduce((s,r)=> s+clamp(r.quantidade), 0);
  const uniq  = new Set(rows.filter(r=> clamp(r.quantidade)>0).map(r=> r.prato||'—')).size;
  const avg   = total / daysInc(startIso, endIso);
  return { total, uniq, avg };
}
function monthWindow(payload){
  const anchor = startOfMonthUTC(payload.start);
  const curStart = addMonthsUTC(anchor, -11), curEnd = endOfMonthUTC(anchor);
  const prevStart= addMonthsUTC(curStart, -12), prevEnd = addMonthsUTC(anchor, -1);
  const seq=[]; for(let i=0, d=curStart; i<12; i++, d=addMonthsUTC(d,1)) seq.push(ymKey(d));
  return { cur:{start:getISO(curStart), end:getISO(curEnd)}, prev:{start:getISO(prevStart), end:getISO(prevEnd)}, seq };
}
function seriesByMonth(rows, seq){
  const map=new Map(seq.map(k=>[k,0]));
  rows.forEach(r=>{ const k=(r.data||'').slice(0,7); if(map.has(k)) map.set(k, map.get(k)+clamp(r.quantidade)); });
  return seq.map(k=> map.get(k)||0);
}

/* ===================== ORQUESTRAÇÃO ===================== */
let __busy=false;
async function applyAll(payload){
  if(!payload||!payload.start||!payload.end) return;
  if(__busy) return; __busy=true;
  console.groupCollapsed(`[${APP_VERSION}] applyAll`);
  console.log('payload:', payload);

  try{
    setLoading(true);

    // 1) Linhas do período atual (fonte única)
    const rows = await fetchRowsPaged(payload.start, payload.end, payload, 8000);

    // KPIs atuais
    const cur = buildKpis(rows, payload.start, payload.end);

    // KPIs anteriores (mesma quantidade de dias, período imediatamente anterior)
    const ndays = daysInc(payload.start, payload.end);
    const prevEnd = getDateUTC(payload.start); prevEnd.setUTCDate(prevEnd.getUTCDate()-1);
    const prevStart=new Date(prevEnd); prevStart.setUTCDate(prevEnd.getUTCDate()-(ndays-1));
    const prow = await fetchRowsPaged(getISO(prevStart), getISO(prevEnd), payload, 8000);
    const prv  = buildKpis(prow, getISO(prevStart), getISO(prevEnd));

    // Diagnóstico Top10 vs KPI
    const sumTopMais = (()=> {
      const mp = new Map(); rows.forEach(r=> mp.set(r.prato||'—', (mp.get(r.prato||'—')||0)+clamp(r.quantidade)) );
      const arr = [...mp.values()].sort((a,b)=> b-a).slice(0,10);
      return arr.reduce((s,v)=> s+v, 0);
    })();
    if (sumTopMais > cur.total + 1e-6) {
      warn('Σ Top10 > KPI total — isso não deveria acontecer pois os dois saem do MESMO dataset.',
           'ΣTop10=', sumTopMais, 'KPI=', cur.total);
    } else {
      dbg('ΣTop10=', sumTopMais, 'KPI=', cur.total);
    }

    // 2) Gráfico mensal (12m âncora no mês do start)
    const win = monthWindow(payload);
    const [rowsCur, rowsPrev] = await Promise.all([
      fetchRowsPaged(win.cur.start,  win.cur.end,  payload, 8000),
      fetchRowsPaged(win.prev.start, win.prev.end, payload, 8000),
    ]);
    const curM = seriesByMonth(rowsCur,  win.seq);
    const prvM = seriesByMonth(rowsPrev, win.seq);
    const monthSeries = win.seq.map((k,i)=> ({ period:k, current_total:curM[i], prev_total:prvM[i] }));

    // 3) Render
    renderMonthChart(monthSeries);
    const dowMode = document.querySelector('#segDowMode button.active')?.dataset.mode || 'TOTAL';
    renderDowChart(rows, dowMode);
    const topMode = document.querySelector('#segTop10 button.active')?.dataset.mode || 'MAIS';
    renderTop10(rows, topMode);

    // 4) KPIs na UI
    const k = {
      current_total: cur.total, prev_total: prv.total,
      current_unique: cur.uniq,  prev_unique: prv.uniq,
      current_daily_avg: cur.avg, prev_daily_avg: prv.avg
    };
    $('k_qtd').textContent = num(k.current_total);
    $('p_qtd').textContent = num(k.prev_total);
    updateDelta('d_qtd', k.current_total, k.prev_total);

    $('k_pratos_unicos').textContent = num(k.current_unique);
    $('p_pratos_unicos').textContent = num(k.prev_unique);
    updateDelta('d_pratos_unicos', k.current_unique, k.prev_unique);

    $('k_media_diaria').textContent = num(k.current_daily_avg,1);
    $('p_media_diaria').textContent = num(k.prev_daily_avg,1);
    updateDelta('d_media_diaria', k.current_daily_avg, k.prev_daily_avg);

    // snapshot p/ alternar segmentos sem recomputar
    window.dashboardData = { rowsPeriod: rows, monthSeries, kpis: k };

    console.info(`[Status ${APP_VERSION}] [ok]: Dados atualizados.`);
  }catch(err){
    console.error(`[${APP_VERSION}] applyAll error:`, err);
    alert(`Falha ao carregar dados:\n${err?.message||err}`);
    setChartMessage('box_month','Erro ao carregar dados.');
    setChartMessage('box_dow','Erro ao carregar dados.');
  }finally{
    setLoading(false);
    console.groupEnd();
    __busy=false;
  }
}

/* ===================== IMPORTAÇÃO ===================== */
async function ensureXLSX(){
  if(window.XLSX) return window.XLSX;
  const CDS = [
    'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.20.2/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.20.2/xlsx.full.min.js',
  ];
  for(const src0 of CDS){
    const src = `${src0}?v=${Date.now()}`;
    dbg('Carregando XLSX de', src);
    const ok = await new Promise(res=>{
      const s=document.createElement('script');
      s.src=src; s.async=true; s.crossOrigin='anonymous'; s.referrerPolicy='no-referrer';
      s.onload=()=>res(true); s.onerror=()=>res(false);
      document.head.appendChild(s);
      setTimeout(()=> res(!!window.XLSX), 18000);
    });
    if(window.XLSX || ok){ dbg('XLSX OK'); return window.XLSX; }
  }
  throw new Error('Não consegui carregar a lib XLSX (multi-CDN). Tente CSV.');
}
function parseExcelDate(n){ if(typeof n!=='number'||!isFinite(n)) return null; const d=new Date((n-25569)*86400000); return isNaN(d)?null:d; }
function parseBrDate(s){
  if(typeof s!=='string') return null; const t=s.trim().split(' ')[0]; const m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(!m) return null;
  let [_,dd,mm,yy]=m; dd=+dd; mm=+mm; yy=+yy; if(yy<100) yy+=(yy<50?2000:1900);
  const d=new Date(Date.UTC(yy,mm-1,dd,12,0,0)); if(d.getUTCMonth()!==mm-1||d.getUTCDate()!==dd) return null; return d;
}
async function setupImport(){
  const btn=$('btnUpload'), file=$('fileExcel'), txt=$('uploadText'), spn=$('uploadSpinner');
  if(!btn||!file) return;
  const strip=s=> s==null?'':String(s).trim();
  const deburr=s=> strip(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const canon=s=> deburr(s).toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 ]/g,'').trim();

  const guessHeader=(hdr)=>{
    const H=hdr.map(canon); const map={};
    const want=[
      ['data',       /(data|date)/],
      ['unidade',    /(unidade|loja|filial)/],
      ['prato',      /(prato|item|produto|descricao|item codigo mae|codigo mae)/],
      ['categoria',  /(categoria|categorias|depto|departamento|secao|seccao|grupo)/],
      ['quantidade', /(quantidade|qtd|qtde|qtd total|qtdade)/]
    ];
    for(const [role,rx] of want){ const i=H.findIndex(h=> rx.test(h)); if(i>=0) map[role]=i; }
    return map;
  };

  btn.addEventListener('click', ()=>{ if(!btn.disabled) file.click(); });

  file.addEventListener('change', async (ev)=>{
    const f=ev.target.files?.[0]; if(!f) return;
    console.groupCollapsed('📥 Importação'); console.log('arquivo:', f.name, f.size, f.type); console.groupEnd();

    btn.disabled=true; txt.textContent='Processando...'; spn.style.display='inline-block';
    try{
      let rows;
      if(f.name.toLowerCase().endsWith('.csv')){
        // CSV rápido (sem XLSX)
        const text = await f.text();
        rows = text.split(/\r?\n/).map(l=> l.split(';').length>l.split(',').length ? l.split(';') : l.split(','));
      }else{
        await ensureXLSX(); if(!window.XLSX) throw new Error('Lib XLSX indisponível.');
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf,{type:'array', cellDates:false});
        const ws = wb.Sheets[wb.SheetNames[0]]; if(!ws) throw new Error('Aba inicial não encontrada.');
        rows = XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
      }

      if(!rows || rows.length<=1) throw new Error('Arquivo vazio / só cabeçalho.');
      const header = rows[0].map(strip);
      const map = guessHeader(header);
      const miss = ['data','unidade','prato','categoria','quantidade'].filter(k=> map[k]==null);
      if(miss.length) throw new Error('Colunas não identificadas: '+miss.join(', '));

      const body = rows.slice(1);
      const payload=[];
      for(let i=0;i<body.length;i++){
        const r=body[i]; if(!r) continue;

        let d=null; const raw=r[map.data];
        if(typeof raw==='number') d=parseExcelDate(raw);
        if(!d && typeof raw==='string') d=parseBrDate(raw);
        if(!d && raw){ const d2=new Date(raw); if(!isNaN(d2)) d=d2; }
        if(!d) continue;

        const unidade = strip(r[map.unidade]); if(!unidade) continue;
        const prato   = strip(r[map.prato]);   if(!prato) continue;
        const categoria = strip(r[map.categoria]) || 'N/A';

        let qtd = r[map.quantidade];
        if(typeof qtd==='string'){ qtd=deburr(qtd).replace(/\./g,'').replace(/,/g,'.').replace(/[^\d\.-]/g,''); }
        qtd = parseInt(qtd,10); if(!Number.isFinite(qtd)||qtd<=0) continue;

        payload.push({ data:getISO(d), unidade, prato, categoria, quantidade:qtd });
        if(i>0 && i%5000===0) await new Promise(r=> setTimeout(r,0));
      }
      if(payload.length===0) throw new Error('Nenhuma linha válida após o parsing.');

      txt.textContent='Enviando...';
      const B=500; let sent=0;
      for(let i=0;i<payload.length;i+=B){
        const batch=payload.slice(i,i+B);
        const { error } = await supaEstoque.from('vendas_pratos').insert(batch);
        if(error) throw new Error(`Falha ao enviar lote: ${error.message}`);
        sent+=batch.length; dbg(`✔️ Lote ${i/B+1} — total enviado: ${sent}`);
        await new Promise(r=> setTimeout(r,0));
      }

      alert(`${sent} registros importados com sucesso! Recarregando dados…`);
      fxDispatchApply();

    }catch(err){
      console.error(`[${APP_VERSION}] Import error:`, err);
      alert(`Falha na importação:\n${err?.message||err}`);
    }finally{
      btn.disabled=false; txt.textContent='Importar'; spn.style.display='none'; file.value='';
    }
  });
}

/* ===================== INIT ===================== */
window.__lastDay = getISO(new Date());
async function loadFilterOptionsFallback(){
  try{
    const [u,c,p] = await Promise.all([
      supaEstoque.from('vendas_pratos_unidades').select('unidade'),
      supaEstoque.from('vendas_pratos_categorias').select('categoria'),
      supaEstoque.from('vendas_pratos_pratos').select('prato'),
    ]);
    return {
      unidades:(u.data||[]).map(x=>x.unidade).filter(Boolean),
      categorias:(c.data||[]).map(x=>x.categoria).filter(Boolean),
      pratos:(p.data||[]).map(x=>x.prato).filter(Boolean),
    };
  }catch{ return {unidades:[], categorias:[], pratos:[]}; }
}

async function init(){
  try{
    console.log(`[DIAGNÓSTICO ${APP_VERSION}] Script final iniciado.`);
    console.info(`[Status ${APP_VERSION}] [info]: Inicializando aplicação...`);

    // base date
    try{
      const { data } = await supaEstoque.from('vendas_pratos_daterange').select('max_data').maybeSingle();
      if(data?.max_data) window.__lastDay = data.max_data;
    }catch{}

    console.info(`[Status ${APP_VERSION}] Data base definida para: ${window.__lastDay}`);

    // multiselects
    filterUnidades = new MultiSelect('ms-unids', fxDispatchApply);
    filterCategorias= new MultiSelect('ms-cats',  fxDispatchApply);
    filterPratos    = new MultiSelect('ms-pratos', fxDispatchApply);

    let filt = await loadFilterOptionsFallback();
    filterUnidades.initialize(filt.unidades||[]);
    filterCategorias.initialize(filt.categorias||[]);
    filterPratos.initialize(filt.pratos||[]);

    // Default “Pratos” exclusivo se existir
    const def = (filt.categorias||[]).find(c=> String(c).toLowerCase()==='pratos');
    if(def){ filterCategorias.selected.add(def); filterCategorias.exclusiveDefault=def; filterCategorias.render(); filterCategorias.updateBtn(); }

    setupFilterInteractions();

    // Listeners
    document.addEventListener('filters:apply',(e)=> applyAll(e.detail));
    $('segDowMode')?.addEventListener('click',(e)=>{
      const b=e.target.closest('button'); if(!b) return;
      $$('#segDowMode button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
      const mode=b.dataset.mode||'TOTAL';
      const rows = window.dashboardData?.rowsPeriod || [];
      renderDowChart(rows, mode);
    });
    $('segTop10')?.addEventListener('click',(e)=>{
      const b=e.target.closest('button'); if(!b) return;
      $$('#segTop10 button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
      const mode=b.dataset.mode||'MAIS';
      const rows = window.dashboardData?.rowsPeriod || [];
      renderTop10(rows, mode);
    });

    setupImport();

    // Estado inicial (Mês anterior com base na lastDay)
    fxSetToLastMonthWithData(window.__lastDay);
    fxDispatchApply();

  }catch(err){
    console.error(`[${APP_VERSION}] init error:`, err);
    alert(`Falha crítica na inicialização:\n${err?.message||err}`);
  }
}
document.addEventListener('DOMContentLoaded', init);
