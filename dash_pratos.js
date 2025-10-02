/* =======================================================================
   dash_pratos.js — v10.6-stable
   - LÓGICA CORRIGIDA: KPIs, Top 10 e Gráfico DOW são calculados a partir
      de uma única fonte de dados para garantir consistência total.
   - Gráfico mensal sempre calculado localmente para garantir 12 meses.
   - Filtros rápidos de dias ancorados na data mais recente dos dados.
   - Helper de data robusto para tratar formatos DD/MM/AAAA e AAAA-MM-DD.
   ======================================================================= */

/* ===================== CONFIG ===================== */
const APP_VERSION = 'v10.6-stable';
const DEBUG = true;

const SUPABASE_URL_ESTOQUE  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON_ESTOQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
const supaEstoque = window.supabase.createClient(SUPABASE_URL_ESTOQUE, SUPABASE_ANON_ESTOQUE);

/* ===================== DEBUG ===================== */
const dbg = (...a)=> DEBUG && console.log(...a);
const dgbeg = (l)=> DEBUG && console.group(l);
const dgbegc = (l)=> DEBUG && console.groupCollapsed(l);
const dgend = ()=> DEBUG && console.groupEnd();
const dtime = (l)=> DEBUG && console.time(l);
const dtimeEnd = (l)=> DEBUG && console.timeEnd(l);

function runWithTimeout(promise, ms, stage='op'){
  let t;
  const timeout = new Promise((_, rej)=> t = setTimeout(()=> rej(new Error(`Timeout (${ms}ms) em ${stage}`)), ms));
  return Promise.race([promise, timeout]).finally(()=> clearTimeout(t));
}

/* ===================== HARDENING GLOBAL ===================== */
window.addEventListener('error', (e)=> console.error(`[${APP_VERSION}] window.onerror:`, e?.message, e?.filename, e?.lineno, e?.colno, e?.error));
window.addEventListener('unhandledrejection', (e)=> console.error(`[${APP_VERSION}] unhandledrejection:`, e?.reason));

/* ===================== HELPERS ===================== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel)=> document.querySelectorAll(sel);
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const clampNum = (v) => { const n = +v; return Number.isFinite(n) ? n : 0; };
const num = (v,d=0)=> (v==null||!isFinite(+v)) ? '0' : (+v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});

function getDateUTC(input){
  let d;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)){ d = new Date(input + 'T12:00:00Z'); }
  else if (input instanceof Date){ d = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 12,0,0)); }
  else { const now = new Date(); d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12,0,0)); }
  if (isNaN(d)) return getDateUTC(new Date());
  return d;
}

function parseFlexibleDateString(dateStr) {
  if (typeof dateStr !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T12:00:00Z');
  }
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [_, dd, mm, yy] = m;
    dd = +dd; mm = +mm; yy = +yy;
    if (yy < 100) yy += (yy < 50 ? 2000 : 1900);
    const d = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
    if (d.getUTCFullYear() === yy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd) return d;
  }
  return null;
}

const getDateISO = (dateObj)=> getDateUTC(dateObj).toISOString().split('T')[0];
const daysInclusive = (s,e)=> Math.max(0, Math.round((getDateUTC(e)-getDateUTC(s))/(24*60*60*1000)) + 1);
function startOfMonthUTC(d){ const dt = getDateUTC(d); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 12,0,0)); }
function endOfMonthUTC(d){ const dt = getDateUTC(d); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth()+1, 0, 12,0,0)); }
function addMonthsUTC(d, delta){ const dt = getDateUTC(d); const y = dt.getUTCFullYear(); const m = dt.getUTCMonth() + delta; return new Date(Date.UTC(y, m, 1, 12,0,0)); }
function ymKey(d){ const dt=getDateUTC(d); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`; }
function formatMonthNameFromAny(x){
  if (!x) return '';
  let dt;
  if (typeof x==='string'){
    if (/^\d{4}-\d{2}$/.test(x)) dt = new Date(Date.UTC(+x.slice(0,4), +x.slice(5,7)-1, 1));
    else { const t = new Date(x); if (!isNaN(t)) dt = t; }
  } else if (x instanceof Date) dt = x;
  if (!dt) return String(x);
  const name = dt.toLocaleString('pt-BR',{month:'long', timeZone:'UTC'});
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/* ===================== XLSX LOADER (MULTI-CDN) ===================== */
async function ensureXLSX(){
  if (window.XLSX){ dbg('XLSX presente (window)'); return window.XLSX; }
  const SOURCES = [
    'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.20.2/dist/xlsx.full.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.20.2/xlsx.full.min.js',
  ];
  for (let i=0;i<SOURCES.length;i++){
    const src = `${SOURCES[i]}?v=${Date.now()}`; dbg('Carregando XLSX de', src);
    const ok = await new Promise((resolve)=>{
      const s = document.createElement('script'); s.src = src; s.async = true; s.referrerPolicy = 'no-referrer';
      s.onload = ()=> resolve(true); s.onerror = ()=> resolve(false); document.head.appendChild(s);
      setTimeout(()=> resolve(!!window.XLSX), 17000);
    });
    if (window.XLSX || ok){ dbg('XLSX OK de', src); return window.XLSX; }
  }
  throw new Error('XLSX não pôde ser carregado (multi-CDN).');
}

/* ===================== MultiSelect (com default exclusivo) ===================== */
class MultiSelect{
  constructor(containerId, onChange){
    this.container = $(containerId); if (!this.container) return;
    this.onChange = onChange; this.btn = this.container.querySelector('.msel-btn');
    this.panel = this.container.querySelector('.msel-panel'); this.labelSingular = this.container.dataset.singular || 'Item';
    this.options = []; this.selected = new Set(); this.isOpen = false; this.initialized = false; this.exclusiveDefault = null;
    this.initEvents();
  }
  initEvents(){
    this.btn.addEventListener('click',(e)=>{ e.stopPropagation(); if (!this.initialized) return; this.toggle(); });
    this.panel.addEventListener('click',(e)=>{
      const opt = e.target.closest('.msel-opt'); if (!opt) return;
      const val = opt.dataset.value; const cb = opt.querySelector('input[type="checkbox"]');
      if (e.target!==cb) cb.checked = !cb.checked; this.handleSelection(val, cb.checked);
    });
    this.panel.addEventListener('click',(e)=> e.stopPropagation());
    document.addEventListener('msel:closeAll',(e)=>{ const exc=e.detail?.except; if (this.container.id!==exc) this.close(); });
  }
  initialize(list){ this.options = (list||[]).slice().sort((a,b)=> String(a).localeCompare(String(b))); this.renderPanel(); this.initialized = true; this.updateButtonText(); }
  renderPanel(){
    let html = `<input type="search" class="msel-search" placeholder="Pesquisar...">`; html += `<div class="msel-options-list">`;
    if (this.options.length===0){ html += `<div style="text-align:center;padding:10px;color:var(--muted);font-size:11px;">Nenhuma opção</div>`; }
    else { this.options.forEach(opt=>{ const s = String(opt).replace(/"/g,'&quot;'); const chk = this.selected.has(opt) ? 'checked' : ''; html += `<label class="msel-opt" data-value="${s}"><input type="checkbox" ${chk}><span>${s}</span></label>`; }); }
    html += `</div>`; this.panel.innerHTML = html;
    const search = this.panel.querySelector('.msel-search'); if (search) search.addEventListener('input',(e)=> this.filterOptions(e.target.value));
  }
  filterOptions(q){ const f=(q||'').toLowerCase(); this.panel.querySelectorAll('.msel-opt').forEach(el=>{ const t=(el.dataset.value||'').toLowerCase(); el.style.display = t.includes(f) ? 'flex':'none'; }); }
  updateButtonText(){ const c=this.selected.size; if(c===0)this.btn.textContent='Todos'; else if(c===1)this.btn.textContent=Array.from(this.selected)[0]; else this.btn.textContent=`${c} ${this.labelSingular}s Selec.`; }
  handleSelection(value, isSelected) {
    if (isSelected) {
      if (this.exclusiveDefault && value === this.exclusiveDefault) { this.selected.clear(); this.selected.add(this.exclusiveDefault); }
      else { this.selected.add(value); if (this.exclusiveDefault && this.selected.has(this.exclusiveDefault)) { this.selected.delete(this.exclusiveDefault); } }
    } else { this.selected.delete(value); }
    this.renderPanel(); this.updateButtonText(); if (this.onChange) this.onChange();
  }
  getSelected(){ return this.selected.size>0 ? Array.from(this.selected) : null; }
  reset(){ this.selected.clear(); if(this.initialized){ this.renderPanel(); this.updateButtonText(); } }
  toggle(){ this.isOpen ? this.close() : this.open(); }
  open(){ document.dispatchEvent(new CustomEvent('msel:closeAll',{detail:{except:this.container.id}})); this.container.classList.add('open'); this.isOpen=true; const s=this.panel.querySelector('.msel-search'); if(s){ s.value=''; this.filterOptions(''); s.focus(); } }
  close(){ this.container.classList.remove('open'); this.isOpen=false; }
}

/* ===================== FILTROS ===================== */
let filterUnidades, filterCategorias, filterPratos;
function fxDispatchApply(){
  const s=$('fxDuStart'), e=$('fxDuEnd'); if(!s||!e||!s.value||!e.value) return;
  const payload = { start:s.value, end:e.value, unidades:filterUnidades?.getSelected()||null, categorias:filterCategorias?.getSelected()||null, pratos:filterPratos?.getSelected()||null };
  document.dispatchEvent(new CustomEvent('filters:apply',{detail:payload}));
}
function fxSetRange(start,end){ const s=$('fxDuStart'), e=$('fxDuEnd'); if(s&&e){ s.value=getDateISO(start); e.value=getDateISO(end); } }
function fxSetToLastMonthWithData(baseDateStr){
  const base=getDateUTC(baseDateStr); const y=base.getUTCFullYear(), m=base.getUTCMonth();
  const from=new Date(Date.UTC(y, m-1, 1)); const to=new Date(Date.UTC(y, m, 0));
  fxSetRange(from,to); $$('#fxQuickChips button').forEach(b=>b.classList.remove('active'));
  document.querySelector('#fxQuickChips button[data-win="lastMonth"]')?.classList.add('active');
  $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active'));
}
function setupFilterInteractions(){
  const fx = { $btnMore:$('fxBtnMore'), $dropup:$('fxDropup'), $quickChips:$('fxQuickChips'), $quickDays:$('fxDuQuickDays'), $start:$('fxDuStart'), $end:$('fxDuEnd'), $btnReset:$('fxBtnReset') };
  fx.$btnMore.addEventListener('click',(e)=>{ e.stopPropagation(); const shown=fx.$dropup.classList.toggle('fx-show'); fx.$btnMore.setAttribute('aria-expanded', shown); });
  document.addEventListener('click',()=>{ if(fx.$dropup.classList.contains('fx-show')){ fx.$dropup.classList.remove('fx-show'); fx.$btnMore.setAttribute('aria-expanded', false); } document.dispatchEvent(new CustomEvent('msel:closeAll')); });
  fx.$dropup.addEventListener('click',(e)=>{ if(!e.target.closest('.msel')) e.stopPropagation(); });
  fx.$quickChips.addEventListener('click',(e)=>{
    const btn=e.target.closest('button'); if(!btn||btn.classList.contains('active')) return;
    $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active'));
    if(filterUnidades) filterUnidades.reset();
    if(filterCategorias){ filterCategorias.reset(); const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos'); if(def){ filterCategorias.handleSelection(def,true); } }
    if(filterPratos) filterPratos.reset();
    const win=btn.dataset.win; const base=getDateUTC(window.__lastDay||new Date()); let start,end;
    if(win==='today'){ start=end=base; }
    else if(win==='yesterday'){ start=new Date(base); start.setUTCDate(base.getUTCDate()-1); end=start; }
    else if(win==='lastMonth'){ fxSetToLastMonthWithData(window.__lastDay); fxDispatchApply(); return; }
    else if(win==='lastYear'){ const y=base.getUTCFullYear()-1; start=new Date(Date.UTC(y,0,1)); end=new Date(Date.UTC(y,11,31)); }
    if(start&&end){ fxSetRange(start,end); fxDispatchApply(); }
  });
  fx.$quickDays.addEventListener('click',(e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active')); btn.classList.add('fx-active');
    const days=parseInt(btn.dataset.win,10); const end=getDateUTC(window.__lastDay); const start=new Date(end); start.setUTCDate(end.getUTCDate()-(days-1));
    fxSetRange(start,end); $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); fxDispatchApply();
  });
  const onDate = ()=>{ if(fx.$start.value && fx.$end.value){ $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active')); fxDispatchApply(); } };
  fx.$start.addEventListener('change', onDate); fx.$end.addEventListener('change', onDate);
  fx.$btnReset.addEventListener('click', ()=>{
    fxSetToLastMonthWithData(window.__lastDay); if(filterUnidades) filterUnidades.reset();
    if(filterCategorias){ filterCategorias.reset(); const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos'); if(def){ filterCategorias.handleSelection(def,true); } }
    if(filterPratos) filterPratos.reset(); fxDispatchApply();
    fx.$dropup.classList.remove('fx-show'); fx.$btnMore.setAttribute('aria-expanded', false);
  });
}

/* ===================== UI STATE & GRÁFICOS ===================== */
let chartMonth, chartDow;
function setChartMessage(boxId, message){
  const box=$(boxId); if(!box) return; let msg=box.querySelector('.chart-message');
  if(!message){ if(msg) msg.remove(); return; }
  if(!msg){ msg=document.createElement('div'); msg.className='chart-message'; box.appendChild(msg); }
  msg.textContent=message;
}
function setLoadingState(isLoading){ ['fxBtnMore','btnUpload','fxBtnReset'].forEach(id=>{ const el=$(id); if(el) el.disabled=!!isLoading; }); }
function updateKpis(kpisObj){
  const K = kpisObj || {};
  $('k_qtd').textContent = num(K.current_total); $('p_qtd').textContent = num(K.prev_total);
  updateDelta('d_qtd', K.current_total, K.prev_total);
  $('k_pratos_unicos').textContent = num(K.current_unique); $('p_pratos_unicos').textContent = num(K.prev_unique);
  updateDelta('d_pratos_unicos', K.current_unique, K.prev_unique);
  $('k_media_diaria').textContent = num(K.current_daily_avg,1); $('p_media_diaria').textContent = num(K.prev_daily_avg,1);
  updateDelta('d_media_diaria', K.current_daily_avg, K.prev_daily_avg);
}
function updateDelta(elId, current, previous){
  const el=$(elId); if(!el) return; const c=+current||0, p=+previous||0;
  if(p===0 && c===0){ el.textContent='—'; el.classList.remove('up','down'); return; }
  if(p===0 && c > 0){ el.textContent='+∞%'; el.classList.add('up'); el.classList.remove('down'); return; }
  if(p===0){ el.textContent='-100%'; el.classList.add('down'); el.classList.remove('up'); return;}
  const d=((c-p)/p)*100; const txt=(d>=0?'+':'')+d.toFixed(1)+'%';
  el.textContent=txt; el.classList.toggle('up', d>=0); el.classList.toggle('down', d<0);
}
function renderMonthChart(data){
  if(chartMonth) chartMonth.destroy(); setChartMessage('box_month', null);
  if(!Array.isArray(data) || data.length===0){ setChartMessage('box_month','Nenhum dado mensal encontrado.'); return; }
  const ctx=$('ch_month').getContext('2d'); const wine = cssVar('--wine') || '#7b1e3a';
  const labels = data.map(d=> formatMonthNameFromAny(d.period)); const current = data.map(d=> clampNum(d.current_total));
  chartMonth = new Chart(ctx, { type:'bar', data:{ labels, datasets:[ {label:'Itens Vendidos', data:current, backgroundColor:wine, borderRadius:4} ] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } } });
}
function renderDowChart(data, mode='TOTAL'){
  if(chartDow) chartDow.destroy(); setChartMessage('box_dow', null);
  const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const rows = labels.map(name=>{ const f = Array.isArray(data) ? data.find(r=> r.dia_semana_nome===name) : null; return { total: clampNum(f?.total), media: clampNum(f?.media) }; });
  if(rows.every(r=> r.total===0 && r.media===0)){ setChartMessage('box_dow','Nenhum dado semanal encontrado.'); return; }
  const vals = (mode==='MÉDIA') ? rows.map(r=>r.media) : rows.map(r=>r.total);
  const ctx=$('ch_dow').getContext('2d'); const wine=cssVar('--wine')||'#7b1e3a';
  chartDow = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:(mode==='MÉDIA'?'Média Diária':'Itens Vendidos'), data:vals, backgroundColor:wine }] }, options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{legend:{display:false}}, scales:{ x:{ beginAtZero:true } } } });
}
function renderTop10(data){
  const cont=$('top10-list-body'); if(!cont) return; cont.innerHTML='';
  const list = Array.isArray(data) ? data.map(r=>({ prato: r.prato ?? '—', qty: clampNum(r.total_vendido) })) : [];
  if(list.length===0){ cont.innerHTML=`<div style="text-align:center;padding:20px;color:var(--muted);">Nenhum registro.</div>`; return; }
  list.forEach((r,i)=>{ const row=document.createElement('div'); row.className='top10-row'; row.innerHTML = `<span class="top10-col-rank">${i+1}</span><span class="top10-col-prato" title="${r.prato}">${r.prato}</span><span class="top10-col-qty">${num(r.qty)}</span>`; cont.appendChild(row); });
}

/* ===================== LÓGICA DE DADOS ===================== */
async function fetchRowsPaged(startIso, endIso, filters, limit=5000){
  dgbegc(`🧩 Fetching rows: ${startIso} → ${endIso}`);
  let q = supaEstoque.from('vendas_pratos').select('data', { count:'exact', head:true }).gte('data', startIso).lte('data', endIso);
  if(filters?.categorias) q = q.in('categoria', filters.categorias); if(filters?.unidades) q = q.in('unidade', filters.unidades); if(filters?.pratos) q = q.in('prato', filters.pratos);
  const { count, error:countErr } = await q; if(countErr) throw countErr;
  dbg('Total rows to fetch:', count); if(count === 0){ dgend(); return []; }
  const rows = [];
  for(let from=0; from<count; from+=limit){
    const to = Math.min(from+limit-1, count-1);
    let pageQuery = supaEstoque.from('vendas_pratos').select('data,quantidade,prato').gte('data', startIso).lte('data', endIso);
    if(filters?.categorias) pageQuery = pageQuery.in('categoria', filters.categorias); if(filters?.unidades) pageQuery = pageQuery.in('unidade', filters.unidades); if(filters?.pratos) pageQuery = pageQuery.in('prato', filters.pratos);
    const { data, error } = await pageQuery.order('data').range(from, to);
    if(error) { console.warn(`Error fetching page ${from}-${to}:`, error); break; }
    rows.push(...(data||[]));
  }
  dgend(); return rows;
}

function calculateMetricsFromRows(rows, daysInPeriod) {
    const total = rows.reduce((s, r) => s + clampNum(r.quantidade), 0);
    const uniquePlates = new Set(); const plateTotals = new Map();
    const dowTotals = [0,0,0,0,0,0,0]; const dowDayCounts = [0,0,0,0,0,0,0];
    const dailyTotals = new Map();
    for (const r of rows) {
        const qty = clampNum(r.quantidade);
        if (qty > 0) { uniquePlates.add(r.prato || '—'); plateTotals.set(r.prato, (plateTotals.get(r.prato) || 0) + qty); }
        dailyTotals.set(r.data, (dailyTotals.get(r.data) || 0) + qty);
    }
    for (const [dateStr, dailyTotal] of dailyTotals.entries()) {
        const d = parseFlexibleDateString(dateStr); if (!d || isNaN(d)) continue;
        const dow = d.getUTCDay(); dowTotals[dow] += dailyTotal; dowDayCounts[dow]++;
    }
    const dowLabels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const sales_by_dow = dowLabels.map((name, idx)=>({ dia_semana_nome: name, total: dowTotals[idx] || 0, media: dowDayCounts[idx] ? (dowTotals[idx] / dowDayCounts[idx]) : 0 }));
    const sortedPlates = Array.from(plateTotals.entries()).map(([prato, total_vendido])=>({prato, total_vendido}));
    const top_10_mais = sortedPlates.sort((a,b)=>b.total_vendido-a.total_vendido).slice(0,10);
    const top_10_menos = sortedPlates.filter(r=>r.total_vendido>0).sort((a,b)=>a.total_vendido-b.total_vendido).slice(0,10);
    const avg = total / Math.max(1, daysInPeriod);
    return { total, unique: uniquePlates.size, avg, sales_by_dow, top_10_mais, top_10_menos };
}

async function fetchMonthChartData(payload){
  const anchor = startOfMonthUTC(payload.start); const startM = addMonthsUTC(anchor, -11); const endM = endOfMonthUTC(anchor);
  const win = { startIso: getDateISO(startM), endIso: getDateISO(endM) };
  const rows = await fetchRowsPaged(win.startIso, win.endIso, payload, 8000);
  const monthSeq = Array.from({length:12}).map((_,i)=> ymKey(addMonthsUTC(startM,i)) );
  const monthMap = new Map(monthSeq.map(k=>[k,0]));
  for(const r of rows){ const k = r.data.slice(0,7); if(monthMap.has(k)) monthMap.set(k, monthMap.get(k) + clampNum(r.quantidade)); }
  return monthSeq.map(k=>({ period:k, current_total: monthMap.get(k)||0 }));
}

function getPreviousRange(payload){
  const days = daysInclusive(payload.start, payload.end);
  const end = getDateUTC(payload.start); end.setUTCDate(end.getUTCDate()-1);
  const start = new Date(end); start.setUTCDate(end.getUTCDate()-(days-1));
  return { start:getDateISO(start), end:getDateISO(end), unidades:payload.unidades, categorias:payload.categorias, pratos:payload.pratos };
}

/* ===================== BUSCA PRINCIPAL ===================== */
let __inFlight=false;
async function applyAll(payload){
  if(!payload || !payload.start || !payload.end || __inFlight) return;
  __inFlight=true; dgbegc(`[${APP_VERSION}] applyAll`); dbg(payload);
  try{
    setLoadingState(true);
    // 1. DADOS DO PERÍODO ATUAL
    const currentDays = daysInclusive(payload.start, payload.end);
    const currentRows = await fetchRowsPaged(payload.start, payload.end, payload);
    const currentMetrics = calculateMetricsFromRows(currentRows, currentDays);

    // 2. DADOS DO PERÍODO ANTERIOR PARA COMPARAÇÃO
    const prevPayload = getPreviousRange(payload);
    const prevDays = daysInclusive(prevPayload.start, prevPayload.end);
    const prevRows = await fetchRowsPaged(prevPayload.start, prevPayload.end, prevPayload);
    const prevMetrics = calculateMetricsFromRows(prevRows, prevDays);
    
    // 3. DADOS DO GRÁFICO MENSAL (SEMPRE ÚLTIMOS 12 MESES)
    const monthBlock = await fetchMonthChartData(payload);

    // 4. AGRUPAR KPIs PARA ATUALIZAÇÃO DA UI
    const kpisFinal = {
        current_total: currentMetrics.total, prev_total: prevMetrics.total,
        current_unique: currentMetrics.unique, prev_unique: prevMetrics.unique,
        current_daily_avg: currentMetrics.avg, prev_daily_avg: prevMetrics.avg,
    };

    // 5. RENDERIZAR TUDO
    updateKpis(kpisFinal);
    renderMonthChart(monthBlock);
    const segDowModeBtn = document.querySelector('#segDowMode button.active');
    renderDowChart(currentMetrics.sales_by_dow, segDowModeBtn?.dataset.mode || 'TOTAL');
    const segTop10Btn = document.querySelector('#segTop10 button.active');
    const top10Data = segTop10Btn?.dataset.mode==='MENOS' ? currentMetrics.top_10_menos : currentMetrics.top_10_mais;
    renderTop10(top10Data);
    
    // 6. ARMAZENAR DADOS GLOBAIS PARA INTERAÇÕES SECUNDÁRIAS
    window.dashboardData = { kpis:kpisFinal, sales_by_month:monthBlock, sales_by_dow:currentMetrics.sales_by_dow, top_10_mais_vendidos:currentMetrics.top_10_mais, top_10_menos_vendidos:currentMetrics.top_10_menos };
    console.info(`[Status ${APP_VERSION}] [ok]: Dados atualizados com consistência.`);
  }catch(err){
    console.error(`[${APP_VERSION}] API Error:`, err);
    setChartMessage('box_month','Erro ao carregar dados.'); setChartMessage('box_dow','Erro ao carregar dados.');
    alert(`Falha ao carregar dados:\n${err?.message || err}`);
  }finally{
    setLoadingState(false); __inFlight=false; dgend();
  }
}

/* ===================== IMPORTAÇÃO ===================== */
function parseExcelDate(serial){
  if(typeof serial!=='number' || !isFinite(serial)) return null;
  const d=new Date((serial-25569)*86400000); return isNaN(d) ? null : d;
}
function parseBrazilianDate(s){
  if(typeof s!=='string') return null;
  const m=s.trim().split(' ')[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(!m) return null;
  let [_, dd, mm, yy]=m; dd=+dd; mm=+mm; yy=+yy; if(yy<100) yy+=(yy<50?2000:1900);
  const d=new Date(Date.UTC(yy,mm-1,dd,12,0,0)); if(d.getUTCMonth()!==mm-1 || d.getUTCDate()!==dd) return null; return d;
}
async function setupImportFeature(){
  const btn=$('btnUpload'), input=$('fileExcel'), txt=$('uploadText'), spn=$('uploadSpinner'); if(!btn||!input) return;
  const strip=(s)=>(s==null?'':String(s).trim()); const deburr=(s)=>strip(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const canon=(s)=>deburr(s).toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 ]/g,'').trim();
  const headerRules = [ { role:'data', match:(h)=>/(data|date)/.test(h) }, { role:'unidade', match:(h)=>/(unidade|loja|filial)/.test(h) }, { role:'prato', match:(h)=>/(prato|item|produto|descricao|item codigo mae|codigo mae)/.test(h) }, { role:'categoria', match:(h)=>/(categoria|categorias|depto|departamento|secao|seccao|grupo)/.test(h) }, { role:'quantidade', match:(h)=>/(quantidade|qtd|qtde|qtd total|qtdade)/.test(h) }, ];
  const mapHeaders=(row)=> { const ch=row.map(canon); const map={}; headerRules.forEach(r=>{ const i=ch.findIndex(h=> r.match(h)); if(i>=0) map[r.role]=i; }); return map; };
  btn.addEventListener('click', ()=>{ if(!btn.disabled) input.click(); });
  input.addEventListener('change', async (ev)=>{
    const file=ev.target.files?.[0]; if(!file) return; btn.disabled=true; txt.textContent='Processando...'; spn.style.display='inline-block';
    try{
      await runWithTimeout(ensureXLSX(), 60000, 'ensureXLSX'); if(!window.XLSX) throw new Error('Biblioteca XLSX indisponível.');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf,{type:'array', cellDates:false}); const ws=wb.Sheets[wb.SheetNames[0]]; if(!ws) throw new Error('Aba não encontrada.');
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null}); if(rows.length<=1) throw new Error('Arquivo vazio ou só com cabeçalho.');
      const map=mapHeaders(rows[0]); const missing=['data','unidade','prato','categoria','quantidade'].filter(k=> map[k]==null);
      if(missing.length){ throw new Error('Colunas não identificadas: '+missing.join(', ')+'\n\nEx.: Data, Loja/Unidade, Item Código Mãe (Prato), Categorias, Quantidade'); }
      const processed=[];
      for(let i=1;i<rows.length;i++){
        const r=rows[i]; if(!r) continue; let d=null; const rawDate=r[map.data];
        if(typeof rawDate==='number') d=parseExcelDate(rawDate); else if(typeof rawDate==='string') d=parseBrazilianDate(rawDate);
        if(!d) continue; const unidade=strip(r[map.unidade]); if(!unidade) continue;
        const prato=strip(r[map.prato]); if(!prato) continue; const categoria=strip(r[map.categoria]) || 'N/A';
        let qtdRaw=r[map.quantidade]; if(typeof qtdRaw==='string') qtdRaw=deburr(qtdRaw).replace(/\./g,'').replace(/,/g,'.').replace(/[^\d\.-]/g,'');
        const quantidade=parseInt(qtdRaw,10); if(!isFinite(quantidade)||quantidade<=0) continue;
        processed.push({ data:getDateISO(d), unidade, prato, categoria, quantidade });
      }
      if(processed.length===0) throw new Error('Nenhum registro válido encontrado. Verifique cabeçalhos e formato das datas.');
      txt.textContent='Enviando...';
      for(let i=0;i<processed.length;i+=500){
        const batch=processed.slice(i,i+500); txt.textContent=`Enviando ${Math.min(i+500,processed.length)}/${processed.length}…`;
        const { error } = await runWithTimeout(supaEstoque.from('vendas_pratos').insert(batch), 300000, `insert lote`);
        if(error) throw new Error(`Falha ao enviar lote: ${error.message}`);
      }
      alert(`${processed.length} registros importados! Atualizando dashboard…`); fxDispatchApply();
    }catch(err){ console.error(`[${APP_VERSION}] Erro na importação:`, err); alert(`Falha na importação:\n${err?.message||err}`); }
    finally{ btn.disabled=false; txt.textContent='Importar'; spn.style.display='none'; input.value=''; }
  });
}

/* ===================== INIT ===================== */
async function loadFilterOptions(){
  try {
    const { data, error } = await supaEstoque.rpc('get_filter_options');
    if(error) throw error;
    return (Array.isArray(data) ? data[0] : data) || {};
  } catch(e) {
    console.warn('Falha ao buscar opções de filtro via RPC, usando fallback.', e);
    const [u,c,p] = await Promise.all([ supaEstoque.from('vendas_pratos_unidades').select('unidade'), supaEstoque.from('vendas_pratos_categorias').select('categoria'), supaEstoque.from('vendas_pratos_pratos').select('prato') ]);
    return { unidades: (u.data||[]).map(r=>r.unidade), categorias: (c.data||[]).map(r=>r.categoria), pratos: (p.data||[]).map(r=>r.prato) };
  }
}
async function init(){
  try{
    console.info(`[Status ${APP_VERSION}] Inicializando...`);
    filterUnidades = new MultiSelect('ms-unids', fxDispatchApply); filterCategorias= new MultiSelect('ms-cats', fxDispatchApply); filterPratos = new MultiSelect('ms-pratos', fxDispatchApply);
    try {
      const { data:max_data } = await supaEstoque.rpc('get_max_date'); window.__lastDay = max_data || getDateISO();
    } catch(e) {
      console.warn("RPC get_max_date falhou, usando fallback.");
      const {data: d} = await supaEstoque.from('vendas_pratos').select('data').order('data', {ascending: false}).limit(1).single();
      window.__lastDay = d?.data || getDateISO();
    }
    console.info(`Data base definida para: ${window.__lastDay}`);

    const filtOpts = await loadFilterOptions();
    filterUnidades.initialize(filtOpts.unidades); filterCategorias.initialize(filtOpts.categorias); filterPratos.initialize(filtOpts.pratos);
    const defCat = (filtOpts.categorias||[]).find(c=> String(c).toLowerCase()==='pratos');
    if(defCat){ filterCategorias.selected.add(defCat); filterCategorias.updateButtonText(); filterCategorias.exclusiveDefault = defCat; filterCategorias.renderPanel(); }
    document.addEventListener('filters:apply', (e)=> applyAll(e.detail));
    document.addEventListener('filters:init', ()=>{ setupFilterInteractions(); fxSetToLastMonthWithData(window.__lastDay); fxDispatchApply(); });
    $('segDowMode')?.addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b) return; $$('#segDowMode button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderDowChart(window.dashboardData?.sales_by_dow, b.dataset.mode); });
    $('segTop10')?.addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b) return; $$('#segTop10 button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); const d=window.dashboardData; renderTop10(b.dataset.mode==='MENOS' ? d?.top_10_menos_vendidos : d?.top_10_mais_vendidos); });
    setupImportFeature(); document.dispatchEvent(new Event('filters:init'));
  }catch(e){ console.error(`[${APP_VERSION}] init error:`, e); alert(`Falha crítica na inicialização:\n${e?.message||e}`); }
}
document.addEventListener('DOMContentLoaded', init);
