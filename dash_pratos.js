/* =======================================================================
   dash_pratos.js — v10.5-fix1
   - CORRIGIDO: KPIs, Top 10, e Média DOW calculados a partir da mesma
      fonte de dados (linhas do período) para garantir consistência.
   - CORRIGIDO: Gráfico mensal sempre calculado localmente para garantir
      os 12 meses ancorados em payload.start.
   - CORRIGIDO: Filtros rápidos de dias (7D, 15D, etc.) agora são
      ancorados na data mais recente dos dados (window.__lastDay).
   - Default exclusivo "Pratos" na Categoria
   - Importação robusta + diagnósticos
   ======================================================================= */

/* ===================== CONFIG ===================== */
const APP_VERSION = 'v10.5-fix1';
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
const getDateISO = (dateObj)=> getDateUTC(dateObj).toISOString().split('T')[0];
const daysInclusive = (s,e)=> Math.max(0, Math.round((getDateUTC(e)-getDateUTC(s))/(24*60*60*1000)) + 1);

function startOfMonthUTC(d){
  const dt = getDateUTC(d); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 12,0,0));
}
function endOfMonthUTC(d){
  const dt = getDateUTC(d); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth()+1, 0, 12,0,0));
}
function addMonthsUTC(d, delta){
  const dt = getDateUTC(d); const y = dt.getUTCFullYear(); const m = dt.getUTCMonth() + delta;
  const base = new Date(Date.UTC(y, m, 1, 12,0,0));
  return base;
}
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
    'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.20.2/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.20.2/xlsx.full.min.js',
  ];
  for (let i=0;i<SOURCES.length;i++){
    const src = `${SOURCES[i]}?v=${Date.now()}`;
    dbg('Carregando XLSX de', src);
    const ok = await new Promise((resolve)=>{
      const s = document.createElement('script');
      s.src = src; s.async = true; s.referrerPolicy = 'no-referrer';
      s.onload = ()=> resolve(true); s.onerror = ()=> resolve(false);
      document.head.appendChild(s);
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
    this.onChange = onChange;
    this.btn = this.container.querySelector('.msel-btn');
    this.panel = this.container.querySelector('.msel-panel');
    this.labelSingular = this.container.dataset.singular || 'Item';
    this.options = []; this.selected = new Set(); this.isOpen = false; this.initialized = false;
    this.exclusiveDefault = null;
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
  initialize(list){
    this.options = (list||[]).slice().sort((a,b)=> String(a).localeCompare(String(b)));
    this.renderPanel(); this.initialized = true; this.updateButtonText();
  }
  renderPanel(){
    let html = `<input type="search" class="msel-search" placeholder="Pesquisar...">`;
    html += `<div class="msel-options-list">`;
    if (this.options.length===0){
      html += `<div style="text-align:center;padding:10px;color:var(--muted);font-size:11px;">Nenhuma opção</div>`;
    } else {
      this.options.forEach(opt=>{
        const s = String(opt).replace(/"/g,'&quot;'); const chk = this.selected.has(opt) ? 'checked' : '';
        html += `<label class="msel-opt" data-value="${s}"><input type="checkbox" ${chk}><span>${s}</span></label>`;
      });
    }
    html += `</div>`;
    this.panel.innerHTML = html;
    const search = this.panel.querySelector('.msel-search');
    if (search) search.addEventListener('input',(e)=> this.filterOptions(e.target.value));
  }
  filterOptions(q){ const f=(q||'').toLowerCase(); this.panel.querySelectorAll('.msel-opt').forEach(el=>{ const t=(el.dataset.value||'').toLowerCase(); el.style.display = t.includes(f) ? 'flex':'none'; }); }
  updateButtonText(){ const c=this.selected.size; if(c===0)this.btn.textContent='Todos'; else if(c===1)this.btn.textContent=Array.from(this.selected)[0]; else this.btn.textContent=`${c} ${this.labelSingular}s Selec.`; }
  handleSelection(value, isSelected) {
    if (isSelected) {
      if (this.exclusiveDefault && value === this.exclusiveDefault) {
        this.selected.clear();
        this.selected.add(this.exclusiveDefault);
      } else {
        this.selected.add(value);
        if (this.exclusiveDefault && this.selected.has(this.exclusiveDefault)) {
          this.selected.delete(this.exclusiveDefault);
        }
      }
    } else {
      this.selected.delete(value);
    }
    this.renderPanel();
    this.updateButtonText();
    if (this.onChange) this.onChange();
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
    $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active'));
    if(filterUnidades) filterUnidades.reset();
    if(filterCategorias){
      filterCategorias.reset();
      const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos');
      if(def){ filterCategorias.handleSelection(def,true); }
    }
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
    const days=parseInt(btn.dataset.win,10);
    // CORREÇÃO: Ancorar sempre na data mais recente dos dados para consistência.
    const end=getDateUTC(window.__lastDay);
    const start=new Date(end);
    start.setUTCDate(end.getUTCDate()-(days-1));
    fxSetRange(start,end); $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); fxDispatchApply();
  });

  const onDate = ()=>{ if(fx.$start.value && fx.$end.value){ $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active')); fxDispatchApply(); } };
  fx.$start.addEventListener('change', onDate); fx.$end.addEventListener('change', onDate);

  fx.$btnReset.addEventListener('click', ()=>{
    fxSetToLastMonthWithData(window.__lastDay);
    if(filterUnidades) filterUnidades.reset();
    if(filterCategorias){
      filterCategorias.reset();
      const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos');
      if(def){ filterCategorias.handleSelection(def,true); }
    }
    if(filterPratos) filterPratos.reset();
    fxDispatchApply();
    fx.$dropup.classList.remove('fx-show'); fx.$btnMore.setAttribute('aria-expanded', false);
  });
}

/* ===================== UI STATE ===================== */
let chartMonth, chartDow;

function setChartMessage(boxId, message){
  const box=$(boxId); if(!box) return;
  let msg=box.querySelector('.chart-message');
  if(!message){ if(msg) msg.remove(); return; }
  if(!msg){ msg=document.createElement('div'); msg.className='chart-message'; box.appendChild(msg); }
  msg.textContent=message;
}
function setLoadingState(isLoading){ ['fxBtnMore','btnUpload','fxBtnReset'].forEach(id=>{ const el=$(id); if(el) el.disabled=!!isLoading; }); }

function normalizeKpis(k){
  k = k || {};
  const co = (a, ...alts)=> a ?? alts.find(v=> v!=null);
  const current_total     = clampNum(co(k.current_total, k.qtd_atual,  k.total_atual, k.current, k.qtd, k.total, k.itens_atual, k.itens));
  const prev_total        = clampNum(co(k.prev_total,    k.qtd_anterior, k.total_anterior, k.previous, k.prev));
  const current_unique    = clampNum(co(k.current_unique,k.unicos_atual, k.unique_current, k.pratos_unicos_atual, k.unicos));
  const prev_unique       = clampNum(co(k.prev_unique,   k.unicos_anterior, k.unique_previous, k.pratos_unicos_anterior));
  const current_daily_avg = clampNum(co(k.current_daily_avg, k.media_diaria, k.media_atual, k.avg_current));
  const prev_daily_avg    = clampNum(co(k.prev_daily_avg,    k.media_diaria_prev, k.media_anterior, k.avg_prev));
  return { current_total, prev_total, current_unique, prev_unique, current_daily_avg, prev_daily_avg };
}
function updateKpis(kpisObj){
  const K = normalizeKpis(kpisObj||{});
  const kQtd=$('k_qtd'); if(kQtd) kQtd.textContent = num(K.current_total);
  const pQtd=$('p_qtd'); if(pQtd) pQtd.textContent = num(K.prev_total);
  updateDelta('d_qtd', K.current_total, K.prev_total);

  const kUni=$('k_pratos_unicos'); if(kUni) kUni.textContent = num(K.current_unique);
  const pUni=$('p_pratos_unicos'); if(pUni) pUni.textContent = num(K.prev_unique);
  updateDelta('d_pratos_unicos', K.current_unique, K.prev_unique);

  const kMed=$('k_media_diaria'); if(kMed) kMed.textContent = num(K.current_daily_avg,1);
  const pMed=$('p_media_diaria'); if(pMed) pMed.textContent = num(K.prev_daily_avg,1);
  updateDelta('d_media_diaria', K.current_daily_avg, K.prev_daily_avg);
}
function updateDelta(elId, current, previous){
  const el=$(elId); if(!el) return;
  const c=+current||0, p=+previous||0;
  if(p===0 && c===0){ el.textContent='—'; el.classList.remove('up','down'); return; }
  if(p===0 && c > 0){ el.textContent='+∞%'; el.classList.add('up'); el.classList.remove('down'); return; }
  if(p===0 && c < 0){ el.textContent='-∞%'; el.classList.add('down'); el.classList.remove('up'); return; }
  const d=((c-p)/p)*100; const txt=(d>=0?'+':'')+d.toFixed(1)+'%';
  el.textContent=txt; el.classList.toggle('up', d>=0); el.classList.toggle('down', d<0);
}

/* ===================== GRÁFICOS ===================== */
function renderMonthChart(data){
  if(chartMonth) chartMonth.destroy();
  setChartMessage('box_month', null);
  if(!Array.isArray(data) || data.length===0){ setChartMessage('box_month','Nenhum dado mensal encontrado para o período.'); return; }

  const ctx=$('ch_month').getContext('2d');
  const wine = cssVar('--wine') || '#7b1e3a';
  const cprev= cssVar('--c-prev') || '#9ca3af';

  const labels   = data.map(d=> formatMonthNameFromAny(d.mes ?? d.period ?? d.month ?? d.periodo));
  const current  = data.map(d=> clampNum(d.vendas_atual ?? d.current ?? d.current_total ?? d.total));
  const previous = data.map(d=> clampNum(d.vendas_anterior ?? d.previous ?? d.prev_total));

  chartMonth = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[ {label:'Período Atual', data:current, backgroundColor:wine, borderRadius:4}, {label:'Período Anterior', data:previous, backgroundColor:cprev, borderRadius:4} ] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });
}
function renderDowChart(data, mode='TOTAL'){
  if(chartDow) chartDow.destroy();
  setChartMessage('box_dow', null);

  const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const rows = labels.map(name=>{
    const f = Array.isArray(data) ? data.find(r=> (r.dia_semana_nome??r.dow_name)===name) : null;
    return { total: clampNum(f?.total_vendido ?? f?.total), media: clampNum(f?.media) };
  });
  if(rows.every(r=> (r.total||r.media)===0)){ setChartMessage('box_dow','Nenhum dado semanal encontrado para o período.'); }

  const vals = (mode==='MÉDIA') ? rows.map(r=>r.media) : rows.map(r=>r.total);
  const ctx=$('ch_dow').getContext('2d'); const wine=cssVar('--wine')||'#7b1e3a';

  chartDow = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:(mode==='MÉDIA'?'Média Diária':'Itens Vendidos'), data:vals, backgroundColor:wine, borderColor:wine, borderWidth:1 }] },
    options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
  });
}
function renderTop10(data, mode='MAIS'){
  const cont=$('top10-list-body'); if(!cont) return; cont.innerHTML='';
  const list = Array.isArray(data) ? data : [];
  const norm = list.map(r=>({ prato: r.prato ?? r.nome_prato ?? r.item ?? '—', qty: clampNum(r.qtd ?? r.quantidade ?? r.total ?? r.total_vendido) }));
  if(norm.length===0){ cont.innerHTML=`<div style="text-align:center;padding:20px;color:var(--muted);">Nenhum registro.</div>`; return; }
  norm.forEach((r,i)=>{
    const row=document.createElement('div'); row.className='top10-row';
    row.innerHTML = `<span class="top10-col-rank">${i+1}</span><span class="top10-col-prato" title="${r.prato}">${r.prato}</span><span class="top10-col-qty">${num(r.qty)}</span>`;
    cont.appendChild(row);
  });
}

/* ===================== DIAGNÓSTICOS & FALLBACKS ===================== */
async function diagnoseDataAvailability(payload, note=''){
  if(!DEBUG) return;
  dgbegc(`🔎 Diagnose vendas_pratos ${note?('— '+note):''}`);
  try{
    let q = supaEstoque.from('vendas_pratos')
      .select('data', { count:'exact', head:true })
      .gte('data', payload.start).lte('data', payload.end);
    if(payload.categorias) q = q.in('categoria', payload.categorias);
    if(payload.unidades)   q = q.in('unidade', payload.unidades);
    if(payload.pratos)     q = q.in('prato',    payload.pratos);

    dtime('count vendas_pratos');
    const { count, error } = await q;
    dtimeEnd('count vendas_pratos');

    dbg('Período:', payload.start, '→', payload.end);
    dbg('Filtros:', { unidades:payload.unidades, categorias:payload.categorias, pratos:payload.pratos });
    dbg('Total linhas no período (com filtros):', count);
    if(error) console.warn('Erro COUNT vendas_pratos:', error);

    const sample = await supaEstoque.from('vendas_pratos')
      .select('*').gte('data', payload.start).lte('data', payload.end).limit(1);
    if(sample.error) console.warn('RLS/sample erro:', sample.error);
    else dbg('Sample linha:', sample.data);

  }catch(e){ console.warn('Diagnose exception:', e); }
  finally{ dgend(); }
}

let __lastScanRows = null;

async function fetchRowsPagedFor(startIso, endIso, filters, limit=5000){
  dgbegc('🧩 Fallback scan — carregando linhas paginadas');

  let baseCount = supaEstoque.from('vendas_pratos')
    .select('data', { count:'exact', head:true })
    .gte('data', startIso).lte('data', endIso);
  if(filters?.categorias) baseCount = baseCount.in('categoria', filters.categorias);
  if(filters?.unidades)   baseCount = baseCount.in('unidade', filters.unidades);
  if(filters?.pratos)     baseCount = baseCount.in('prato', filters.pratos);

  const head = await baseCount;
  const total = head.count || 0;
  dbg('total rows scan:', total, 'range:', startIso, '→', endIso);
  if(total===0){ dgend(); return []; }

  const rows = [];
  for(let from=0; from<total; from+=limit){
    const to = Math.min(from+limit-1, total-1);

    let page = supaEstoque.from('vendas_pratos')
      .select('data,quantidade,prato,unidade,categoria')
      .gte('data', startIso).lte('data', endIso);
    if(filters?.categorias) page = page.in('categoria', filters.categorias);
    if(filters?.unidades)   page = page.in('unidade', filters.unidades);
    if(filters?.pratos)     page = page.in('prato', filters.pratos);

    dtime(`scan ${from}-${to}`);
    const { data, error } = await page.order('data', { ascending:true }).range(from, to);
    dtimeEnd(`scan ${from}-${to}`);

    if(error){ console.warn('scan error:', error); break; }
    rows.push(...(data||[]));
    await new Promise(r=> setTimeout(r,0));
  }
  // CORREÇÃO: Cache de linhas removido para garantir que cada `applyAll` use dados frescos.
  // __lastScanRows = rows;
  dgend();
  return rows;
}

// CORREÇÃO: Centraliza o cálculo de todas as métricas a partir das mesmas linhas para garantir consistência.
function calculateMetricsFromRows(rows, daysInPeriod) {
    const total = rows.reduce((s, r) => s + clampNum(r.quantidade), 0);
    const uniquePlates = new Set();
    const plateTotals = new Map();
    const dowTotals = [0, 0, 0, 0, 0, 0, 0];
    const dowDayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dailyTotals = new Map();

    for (const r of rows) {
        const qty = clampNum(r.quantidade);
        if (qty > 0) {
            uniquePlates.add(r.prato || '—');
            plateTotals.set(r.prato, (plateTotals.get(r.prato) || 0) + qty);
        }
        dailyTotals.set(r.data, (dailyTotals.get(r.data) || 0) + qty);
    }

    for (const [dateStr, total] of dailyTotals.entries()) {
        const d = new Date(dateStr + 'T12:00:00Z');
        const dow = d.getUTCDay();
        dowTotals[dow] += total;
        dowDayCounts[dow]++;
    }

    const dowLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const sales_by_dow = dowLabels.map((name, idx) => ({
        dia_semana_nome: name,
        total: dowTotals[idx] || 0,
        media: dowDayCounts[idx] ? (dowTotals[idx] / dowDayCounts[idx]) : 0
    }));

    const sortedPlates = Array.from(plateTotals.entries()).map(([prato, total_vendido]) => ({ prato, total_vendido }));
    
    const top_10_mais = sortedPlates.sort((a, b) => b.total_vendido - a.total_vendido).slice(0, 10);
    const top_10_menos = sortedPlates.filter(x => x.total_vendido > 0).sort((a, b) => a.total_vendido - b.total_vendido).slice(0, 10);

    const days = Math.max(1, daysInPeriod);
    const avg = total / days;

    return {
        total: total,
        unique: uniquePlates.size,
        avg: avg,
        sales_by_dow,
        top_10_mais,
        top_10_menos
    };
}


/* ======= 12 MESES ANCORADOS NO INÍCIO DO PERÍODO (payload.start) ======= */
function monthWindowForPayload(payload){
  const anchor = startOfMonthUTC(payload.start);        // mês da data mais velha
  const startM = addMonthsUTC(anchor, -11);             // 11 meses antes
  const endM   = endOfMonthUTC(anchor);                 // fim do mês âncora
  return { startIso:getDateISO(startM), endIso:getDateISO(endM), months:12 };
}

async function fetchMonthChartData(payload){
  // CORREÇÃO: Removido o RPC. Calcula sempre localmente para garantir 12 meses.
  const win = monthWindowForPayload(payload);
  const rows = await fetchRowsPagedFor(win.startIso, win.endIso, payload, 8000);

  const seq = [];
  let cur = startOfMonthUTC(win.startIso);
  for(let i=0;i<12;i++){
    seq.push(ymKey(cur));
    cur = addMonthsUTC(cur, 1);
  }

  const monthMap = new Map(seq.map(k=>[k,0]));
  for(const r of rows){
    const k = (r.data||'').slice(0,7);
    if(monthMap.has(k)) monthMap.set(k, monthMap.get(k) + clampNum(r.quantidade));
  }

  return seq.map(k=>({ period:k, current_total: monthMap.get(k)||0, prev_total:0 }));
}

function previousRangeOf(payload){
  const days = daysInclusive(payload.start, payload.end);
  const end = getDateUTC(payload.start); end.setUTCDate(end.getUTCDate()-1);
  const start = new Date(end); start.setUTCDate(end.getUTCDate()-(days-1));
  return { start:getDateISO(start), end:getDateISO(end), unidades:payload.unidades, categorias:payload.categorias, pratos:payload.pratos };
}

/* ===================== BUSCA PRINCIPAL ===================== */
let __inFlight=false;
async function applyAll(payload){
  if(!payload || !payload.start || !payload.end) return;
  if(__inFlight) return; __inFlight=true;

  dgbegc(`[${APP_VERSION}] applyAll`); dbg('payload:', JSON.stringify(payload));
  try{
    setLoadingState(true);
    await diagnoseDataAvailability(payload);

    // CORREÇÃO: Lógica unificada. Busca as linhas e calcula TUDO a partir delas.
    
    // 1. Período Atual
    const currentDays = daysInclusive(payload.start, payload.end);
    const currentRows = await fetchRowsPagedFor(payload.start, payload.end, payload, 8000);
    const currentMetrics = calculateMetricsFromRows(currentRows, currentDays);
    
    // 2. Período Anterior
    const prevPayload = previousRangeOf(payload);
    const prevDays = daysInclusive(prevPayload.start, prevPayload.end);
    const prevRows = await fetchRowsPagedFor(prevPayload.start, prevPayload.end, prevPayload, 8000);
    const prevMetrics = calculateMetricsFromRows(prevRows, prevDays);

    // 3. Gráfico Mensal (lógica separada de 12 meses)
    const monthBlock = await fetchMonthChartData(payload);

    // 4. Montar o objeto final de KPIs
    const kpisFinal = {
        current_total: currentMetrics.total,
        prev_total: prevMetrics.total,
        current_unique: currentMetrics.unique,
        prev_unique: prevMetrics.unique,
        current_daily_avg: currentMetrics.avg,
        prev_daily_avg: prevMetrics.avg,
    };

    // 5. Atualizar a UI
    updateKpis(kpisFinal);
    renderMonthChart(monthBlock);
    const segModeBtn = document.querySelector('#segDowMode button.active');
    renderDowChart(currentMetrics.sales_by_dow, segModeBtn ? segModeBtn.dataset.mode : 'TOTAL');
    const activeTop10Btn = document.querySelector('#segTop10 button.active');
    renderTop10(activeTop10Btn && activeTop10Btn.dataset.mode==='MENOS' ? currentMetrics.top_10_menos : currentMetrics.top_10_mais, activeTop10Btn?.dataset.mode || 'MAIS');

    // 6. Salvar dados globais para interações (troca de modo DOW/Top10)
    window.dashboardData = {
        kpis: kpisFinal,
        sales_by_month: monthBlock,
        sales_by_dow: currentMetrics.sales_by_dow,
        top_10_mais_vendidos: currentMetrics.top_10_mais,
        top_10_menos_vendidos: currentMetrics.top_10_menos
    };
    console.info(`[Status ${APP_VERSION}] [ok]: Dados atualizados consistentemente.`);
  }catch(err){
    console.error(`[${APP_VERSION}] API Error:`, err);
    setChartMessage('box_month','Erro ao carregar dados.');
    setChartMessage('box_dow','Erro ao carregar dados.');
    alert(`Falha ao carregar dados:\n${err?.message || err}`);
  }finally{
    setLoadingState(false); __inFlight=false; dgend();
  }
}

/* ===================== IMPORTAÇÃO ===================== */
function parseExcelDate(serial){
  if(typeof serial!=='number' || !isFinite(serial)) return null;
  const epoch=25569, ms=86400000; const d=new Date((serial-epoch)*ms);
  return isNaN(d) ? null : d;
}
function parseBrazilianDate(s){
  if(typeof s!=='string') return null;
  const t=s.trim().split(' ')[0]; const m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(!m) return null;
  let [_, dd, mm, yy]=m; dd=+dd; mm=+mm; yy=+yy; if(yy<100) yy+=(yy<50?2000:1900);
  const d=new Date(Date.UTC(yy,mm-1,dd,12,0,0)); if(d.getUTCMonth()!==mm-1 || d.getUTCDate()!==dd) return null; return d;
}
async function setupImportFeature(){
  const btn=$('btnUpload'), input=$('fileExcel'), txt=$('uploadText'), spn=$('uploadSpinner');
  if(!btn||!input) return;

  const strip=(s)=> (s==null?'':String(s).trim());
  const deburr=(s)=> strip(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const canon=(s)=> deburr(s).toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 ]/g,'').trim();

  const headerRules = [
    { role:'data',       match:(h)=> /(data|date)/.test(h) },
    { role:'unidade',    match:(h)=> /(unidade|loja|filial)/.test(h) },
    { role:'prato',      match:(h)=> /(prato|item|produto|descricao|item codigo mae|codigo mae)/.test(h) },
    { role:'categoria',  match:(h)=> /(categoria|categorias|depto|departamento|secao|seccao|grupo)/.test(h) },
    { role:'quantidade', match:(h)=> /(quantidade|qtd|qtde|qtd total|qtdade)/.test(h) },
  ];
  const mapHeaders=(headerRow)=>{ const ch=headerRow.map(canon); const map={}; headerRules.forEach(r=>{ const i=ch.findIndex(h=> r.match(h)); if(i>=0) map[r.role]=i; }); return map; };

  btn.addEventListener('click', ()=>{ if(!btn.disabled) input.click(); });

  input.addEventListener('change', async (ev)=>{
    const file=ev.target.files?.[0]; if(!file) return;

    dgbegc('📥 Importação — arquivo selecionado'); dbg('nome:', file.name, 'tamanho:', file.size, 'tipo:', file.type); dgend();

    btn.disabled=true; txt.textContent='Processando...'; spn.style.display='inline-block';
    try{
      dtime('ensureXLSX');
      await runWithTimeout(ensureXLSX(), 60000, 'ensureXLSX');
      dtimeEnd('ensureXLSX');

      if(!window.XLSX) throw new Error('Biblioteca XLSX indisponível.');

      dtime('file.arrayBuffer'); 
      let buf;
      try{ buf = await file.arrayBuffer(); }
      catch(e){
        console.warn('arrayBuffer falhou, tentando FileReader...', e);
        buf = await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error||new Error('FileReader erro')); fr.readAsArrayBuffer(file); });
      }
      dtimeEnd('file.arrayBuffer');

      const isCsv=file.name.toLowerCase().endsWith('.csv');

      dtime('xlsx:read');
      let wb;
      if(isCsv){ const text=new TextDecoder('utf-8').decode(new Uint8Array(buf)); wb=XLSX.read(text,{type:'string', raw:true}); }
      else { wb=XLSX.read(buf,{type:'array', cellDates:false}); }
      dtimeEnd('xlsx:read');

      const sheetName=wb.SheetNames[0]; const ws=wb.Sheets[sheetName]; if(!ws) throw new Error('Aba inicial não encontrada no arquivo.');
      dbg('Aba detectada:', sheetName);

      dtime('sheet_to_json');
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
      dtimeEnd('sheet_to_json');
      if(rows.length<=1) throw new Error('O arquivo está vazio ou só tem cabeçalho.');

      const header=rows[0].map(strip); const map=mapHeaders(header);
      const missing=['data','unidade','prato','categoria','quantidade'].filter(k=> map[k]==null);
      if(missing.length){
        console.error('Cabeçalhos encontrados:', header);
        throw new Error('Não identifiquei as colunas: '+missing.join(', ')+'\n\nCabeçalhos lidos: '+header.join(' | ')+'\n\nEx.: Data, Loja/Unidade, Item Código Mãe (Prato), Categorias, Quantidade');
      }
      dbg('Mapeamento de colunas:', map, '→', { data:header[map.data], unidade:header[map.unidade], prato:header[map.prato], categoria:header[map.categoria], quantidade:header[map.quantidade] });

      const dataRows=rows.slice(1);
      dtime('parse:linhas');
      const processed=[];
      for(let i=0;i<dataRows.length;i++){
        const r=dataRows[i]; if(!r) continue;

        let d=null; const rawDate=r[map.data];
        if(typeof rawDate==='number') d=parseExcelDate(rawDate);
        if(!d && typeof rawDate==='string') d=parseBrazilianDate(rawDate);
        if(!d && rawDate){ const d2=new Date(rawDate); if(!isNaN(d2)) d=d2; }
        if(!d) continue;

        const unidade=String(r[map.unidade] ?? '').trim(); if(!unidade) continue;
        const prato=String(r[map.prato] ?? '').trim(); if(!prato) continue;
        const categoria=String(r[map.categoria] ?? '').trim() || 'N/A';

        let qtdRaw=r[map.quantidade];
        if(typeof qtdRaw==='string'){ qtdRaw=deburr(qtdRaw).replace(/\./g,'').replace(/,/g,'.').replace(/[^\d\.-]/g,''); }
        const quantidade=parseInt(qtdRaw,10); if(!Number.isFinite(quantidade)||quantidade<=0) continue;

        processed.push({ data:getDateISO(d), unidade, prato, categoria, quantidade });
        if(i>0 && i%5000===0) await new Promise(r=> setTimeout(r,0));
      }
      dtimeEnd('parse:linhas');

      dbg('Registros válidos:', processed.length, '— amostra:', processed.slice(0,5));
      if(processed.length===0) throw new Error('Nenhum registro válido após o processamento. Verifique cabeçalhos e formato das datas.');

      txt.textContent='Enviando...';
      const BATCH=500; let sent=0;
      for(let i=0;i<processed.length;i+=BATCH){
        const batch=processed.slice(i,i+BATCH);
        txt.textContent=`Enviando ${Math.min(i+BATCH,processed.length)}/${processed.length}…`;
        dtime(`insert:lote:${i/BATCH+1}`);
        const { error } = await runWithTimeout( supaEstoque.from('vendas_pratos').insert(batch), 300000, `insert lote ${i/BATCH+1}` );
        dtimeEnd(`insert:lote:${i/BATCH+1}`);
        if(error) throw new Error(`Falha ao enviar lote: ${error.message}`);
        sent+=batch.length; dbg(`✔️ Lote ${i/BATCH+1} concluído — total acumulado: ${sent}`); await new Promise(r=> setTimeout(r,0));
      }

      alert(`${sent} registros importados com sucesso! Atualizando dashboard…`);
      __lastScanRows = null; // Invalida cache se houver
      fxDispatchApply();

    }catch(err){
      console.error(`[${APP_VERSION}] Erro na importação:`, err);
      alert(`Falha na importação:\n${err?.message||err}`);
    }finally{
      btn.disabled=false; txt.textContent='Importar'; spn.style.display='none'; input.value='';
    }
  });
}

/* ===================== INIT ===================== */
window.__lastDay = getDateISO();

async function loadFilterOptionsFallback(){
  try{
    const [u,c,p] = await Promise.all([
      supaEstoque.from('vendas_pratos_unidades').select('unidade'),
      supaEstoque.from('vendas_pratos_categorias').select('categoria'),
      supaEstoque.from('vendas_pratos_pratos').select('prato')
    ]);
    return {
      unidades: (u.data||[]).map(r=> r.unidade).filter(Boolean),
      categorias: (c.data||[]).map(r=> r.categoria).filter(Boolean),
      pratos: (p.data||[]).map(r=> r.prato).filter(Boolean),
    };
  }catch(e){ return {unidades:[], categorias:[], pratos:[]}; }
}

async function init(){
  try{
    console.info(`[Status ${APP_VERSION}] [info]: Inicializando aplicação...`);

    filterUnidades = new MultiSelect('ms-unids', fxDispatchApply);
    filterCategorias= new MultiSelect('ms-cats',  fxDispatchApply);
    filterPratos    = new MultiSelect('ms-pratos', fxDispatchApply);

    let last = null;
    try{ const { data, error } = await supaEstoque.rpc('get_max_date'); if(!error && data) last=data; } catch(e){}
    if(!last){
      const { data, error } = await supaEstoque.from('vendas_pratos_daterange').select('max_data').maybeSingle();
      if(!error && data?.max_data) last=data.max_data;
      else{
        const { data:one } = await supaEstoque.from('vendas_pratos').select('data').order('data',{ascending:false}).limit(1);
        if(one && one.length) last = one[0].data;
      }
    }
    window.__lastDay = last || getDateISO();
    console.info(`[Status ${APP_VERSION}] Data base definida para: ${window.__lastDay}`);

    let filt = null;
    try{ const { data } = await supaEstoque.rpc('get_filter_options'); filt = Array.isArray(data) ? data[0] : data; }catch(e){}
    if(!filt){ filt = await loadFilterOptionsFallback(); }

    filterUnidades.initialize(filt?.unidades || []);
    filterCategorias.initialize(filt?.categorias || []);
    filterPratos.initialize(filt?.pratos || []);

    // PRATOS como default exclusivo na Categoria
    const def = (filt?.categorias||[]).find(c=> String(c).toLowerCase()==='pratos');
    if(def){
      filterCategorias.selected.add(def);
      filterCategorias.updateButtonText();
      filterCategorias.exclusiveDefault = def;
      filterCategorias.renderPanel();
    }

    document.addEventListener('filters:apply', (e)=> applyAll(e.detail));
    document.addEventListener('filters:init', ()=>{
      setupFilterInteractions();
      fxSetToLastMonthWithData(window.__lastDay);
      fxDispatchApply();
    });

    $('segDowMode')?.addEventListener('click',(e)=>{
      const b=e.target.closest('button'); if(!b) return;
      $$('#segDowMode button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
      const mode=b.dataset.mode||'TOTAL'; const src=window.dashboardData?.sales_by_dow ?? [];
      renderDowChart(src, mode);
    });
    $('segTop10')?.addEventListener('click',(e)=>{
      const b=e.target.closest('button'); if(!b) return;
      $$('#segTop10 button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
      const mode=b.dataset.mode||'MAIS'; const dash=window.dashboardData||{};
      const data = mode==='MAIS' ? (dash.top_10_mais_vendidos ?? []) : (dash.top_10_menos_vendidos ?? []);
      renderTop10(data, mode);
    });

    setupImportFeature();
    document.dispatchEvent(new Event('filters:init'));

  }catch(e){
    console.error(`[${APP_VERSION}] init error:`, e);
    alert(`Falha crítica na inicialização:\n${e?.message||e}`);
  }
}

/* ===================== BOOTSTRAP ===================== */
document.addEventListener('DOMContentLoaded', ()=>{
  console.log(`[DIAGNÓSTICO ${APP_VERSION}] Script final iniciado.`);
  init();
});
