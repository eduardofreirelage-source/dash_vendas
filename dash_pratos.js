/* ===================== CONFIG ===================== */
const APP_VERSION = 'v10.4-dbg5';
const DEBUG = true;

const SUPABASE_URL_ESTOQUE  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON_ESTOQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
const supaEstoque = window.supabase.createClient(SUPABASE_URL_ESTOQUE, SUPABASE_ANON_ESTOQUE);

/* ===================== DEBUG HELPERS ===================== */
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
const $  = (id)=> document.getElementById(id);
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

/* ===================== XLSX LOADER ===================== */
function ensureXLSX(){
  return new Promise((resolve, reject)=>{
    if (window.XLSX){ dbg('XLSX presente (window)'); return resolve(window.XLSX); }
    const existing = document.querySelector('script[src*="xlsx.full.min.js"]');
    if (existing){
      dbg('Esperando script XLSX carregar…');
      existing.addEventListener('load', ()=> resolve(window.XLSX));
      existing.addEventListener('error', ()=> reject(new Error('Falha ao carregar XLSX (cdn)')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js';
    s.onload = ()=> resolve(window.XLSX);
    s.onerror = ()=> reject(new Error('Falha ao carregar XLSX (dynamic)'));
    document.head.appendChild(s);
  });
}

/* ===================== MultiSelect ===================== */
class MultiSelect{
  constructor(containerId, onChange){
    this.container = $(containerId); if (!this.container) return;
    this.onChange = onChange;
    this.btn = this.container.querySelector('.msel-btn');
    this.panel = this.container.querySelector('.msel-panel');
    this.labelSingular = this.container.dataset.singular || 'Item';
    this.options = []; this.selected = new Set(); this.isOpen = false; this.initialized = false;
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
    document.addEventListener('msel:closeAll',(e)=>{ const exc = e.detail?.except; if (this.container.id!==exc) this.close(); });
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
  handleSelection(val,on){ if(on)this.selected.add(val); else this.selected.delete(val); this.updateButtonText(); if(this.onChange)this.onChange(); }
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
  const from=new Date(Date.UTC(y,m-1,1)); const to=new Date(Date.UTC(y,m,0));
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
    if(filterCategorias){ filterCategorias.reset(); const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos'); if(def) filterCategorias.handleSelection(def,true); }
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
    const days=parseInt(btn.dataset.win,10); const end=getDateUTC(fx.$end.value||window.__lastDay); const start=new Date(end); start.setUTCDate(end.getUTCDate()-(days-1));
    fxSetRange(start,end); $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); fxDispatchApply();
  });

  const onDate = ()=>{ if(fx.$start.value && fx.$end.value){ $$('#fxQuickChips button').forEach(b=>b.classList.remove('active')); $$('#fxDuQuickDays button').forEach(b=>b.classList.remove('fx-active')); fxDispatchApply(); } };
  fx.$start.addEventListener('change', onDate); fx.$end.addEventListener('change', onDate);

  fx.$btnReset.addEventListener('click', ()=>{
    fxSetToLastMonthWithData(window.__lastDay);
    if(filterUnidades) filterUnidades.reset();
    if(filterCategorias){ filterCategorias.reset(); const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos'); if(def) filterCategorias.handleSelection(def,true); }
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
  const current_total     = clampNum(co(k.current_total, k.qtd_atual,        k.total_atual, k.current, k.qtd, k.total, k.itens_atual, k.itens));
  const prev_total        = clampNum(co(k.prev_total,    k.qtd_anterior,     k.total_anterior, k.previous, k.prev));
  const current_unique    = clampNum(co(k.current_unique,k.unicos_atual,     k.unique_current, k.pratos_unicos_atual, k.unicos));
  const prev_unique       = clampNum(co(k.prev_unique,   k.unicos_anterior,  k.unique_previous, k.pratos_unicos_anterior));
  const current_daily_avg = clampNum(co(k.current_daily_avg, k.media_diaria, k.media_atual, k.avg_current));
  const prev_daily_avg    = clampNum(co(k.prev_daily_avg,    k.media_diaria_prev, k.media_anterior, k.avg_prev));
  return { current_total, prev_total, current_unique, prev_unique, current_daily_avg, prev_daily_avg };
}
function updateDelta(elId, current, previous){
  const el=$(elId); if(!el) return;
  const c=+current||0, p=+previous||0;
  if(p===0 && c===0){ el.textContent='—'; el.classList.remove('up','down'); return; }
  if(p===0){ el.textContent='+100%'; el.classList.add('up'); el.classList.remove('down'); return; }
  const d=((c-p)/p)*100; const txt=(d>=0?'+':'')+d.toFixed(1)+'%';
  el.textContent=txt; el.classList.toggle('up', d>=0); el.classList.toggle('down', d<0);
}
function updateKpis(kpisObj){
  const K=normalizeKpis(kpisObj||{});
  const elKQtd = $('k_qtd'); if (elKQtd) elKQtd.textContent = num(K.current_total);
  const elPQtd = $('p_qtd'); if (elPQtd) elPQtd.textContent = num(K.prev_total);
  updateDelta('d_qtd', K.current_total, K.prev_total);

  const elKU = $('k_pratos_unicos'); if (elKU) elKU.textContent = num(K.current_unique);
  const elPU = $('p_pratos_unicos'); if (elPU) elPU.textContent = num(K.prev_unique);
  updateDelta('d_pratos_unicos', K.current_unique, K.prev_unique);

  const elKM = $('k_media_diaria'); if (elKM) elKM.textContent = num(K.current_daily_avg,1);
  const elPM = $('p_media_diaria'); if (elPM) elPM.textContent = num(K.prev_daily_avg,1);
  updateDelta('d_media_diaria', K.current_daily_avg, K.prev_daily_avg);
}

/* ===================== GRÁFICOS ===================== */
function renderMonthChart(data){
  if(chartMonth) chartMonth.destroy();
  setChartMessage('box_month', null);
  if(!Array.isArray(data) || data.length===0){ setChartMessage('box_month','Nenhum dado mensal encontrado para o período.'); return; }

  const ctx=$('ch_month').getContext('2d');
  const wine = cssVar('--wine') || '#7b1e3a';
  const cprev= cssVar('--c-prev') || '#9ca3af';

  const labels   = data.map(d=> formatMonthNameFromAny(d.mes ?? d.period ?? d.month ?? d.periodo));
  const current  = data.map(d=> clampNum(d.vendas_atual ?? d.current ?? d.current_total ?? d.total));
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

/* ===================== DIAGNÓSTICOS E FALLBACKS ===================== */
async function diagnoseDataAvailability(payload, note=''){
  if(!DEBUG) return;
  dgbegc(`🔎 Diagnose vendas_pratos ${note?('— '+note):''}`);
  try{
    let q = supaEstoque.from('vendas_pratos').select('quantidade',{ count:'exact', head:true }).gte('data', payload.start).lte('data', payload.end);
    if(payload.categorias) q = q.in('categoria', payload.categorias);
    if(payload.unidades)   q = q.in('unidade', payload.unidades);
    if(payload.pratos)     q = q.in('prato',    payload.pratos);

    dtime('count vendas_pratos');
    const { count, error } = await q;
    dtimeEnd('count vendas_pratos');

    dbg('Período:', payload.start, '→', payload.end);
    dbg('Filtros:', { unidades:payload.unidades, categorias:payload.categorias, pratos:payload.pratos });
    dbg('Total linhas no período (com filtros):', count);
    if(error) console.warn('Erro COUNT vendas_pratos:', error);

    const sample = await supaEstoque.from('vendas_pratos').select('*').gte('data', payload.start).lte('data', payload.end).limit(1);
    if(sample.error) console.warn('RLS/sample erro:', sample.error);
    else dbg('Sample linha:', sample.data);

  }catch(e){ console.warn('Diagnose exception:', e); }
  finally{ dgend(); }
}

const RPC_FAIL_CACHE = new Map();
function canCallRpc(name, coolDownMs=300000){ const last = RPC_FAIL_CACHE.get(name); return !last || (Date.now()-last) > coolDownMs; }
function markRpcFail(name){ RPC_FAIL_CACHE.set(name, Date.now()); }

async function rpcSafe(name, args){
  if(!canCallRpc(name)) return null;
  try{
    dtime(`rpc:${name}`);
    const { data, error } = await supaEstoque.rpc(name, args||{});
    dtimeEnd(`rpc:${name}`);
    if(error) throw error;
    dgbegc(`✅ RPC ${name} ok`); dbg('args:', args); dbg('data:', data); dgend();
    return data;
  }catch(e){
    markRpcFail(name);
    dgbegc(`⚠️ RPC ${name} falhou`); dbg('args:', args); console.warn(`[${APP_VERSION}] RPC ${name} falhou:`, e?.message||e); dgend();
    return null;
  }
}

/* Paginador de linhas para agregações locais */
async function fetchRowsPaged(payload, limit=5000){
  dgbegc('🧩 Fallback scan — carregando linhas paginadas');
  let base = supaEstoque.from('vendas_pratos').gte('data', payload.start).lte('data', payload.end);
  if(payload.categorias) base = base.in('categoria', payload.categorias);
  if(payload.unidades)   base = base.in('unidade', payload.unidades);
  if(payload.pratos)     base = base.in('prato', payload.pratos);

  const head = await base.select('*', { count:'exact', head:true });
  const total = head.count || 0;
  dbg('total rows scan:', total);
  if(total===0){ dgend(); return []; }

  const rows = [];
  for(let from=0; from<total; from+=limit){
    const to = Math.min(from+limit-1, total-1);
    dtime(`scan ${from}-${to}`);
    const { data, error } = await base.select('data,quantidade,prato,unidade,categoria').order('data', { ascending:true }).range(from, to);
    dtimeEnd(`scan ${from}-${to}`);
    if(error){ console.warn('scan error:', error); break; }
    rows.push(...(data||[]));
    await new Promise(r=> setTimeout(r,0));
  }
  dgend();
  return rows;
}

function aggregateDowFromRows(rows){
  const mapPerDate = new Map(); // 'YYYY-MM-DD' -> total do dia
  for(const r of rows){
    const dt = r.data; const q = clampNum(r.quantidade);
    mapPerDate.set(dt, (mapPerDate.get(dt) || 0) + q);
  }
  const totals = [0,0,0,0,0,0,0]; // 0=Dom...6=Sáb (usaremos UTC getUTCDay)
  const dayCounts = [0,0,0,0,0,0,0];
  for(const [dateStr,total] of mapPerDate){
    const d = new Date(dateStr+'T00:00:00Z');
    const dow = d.getUTCDay(); // 0..6
    totals[dow] += total;
    dayCounts[dow] += 1;
  }
  const labels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const out = labels.map((name, idx)=> ({ dia_semana_nome:name, total: totals[idx]||0, media: dayCounts[idx] ? (totals[idx]/dayCounts[idx]) : 0 }));
  return out;
}
function aggregateTop10FromRows(rows){
  const map = new Map(); // prato -> total
  for(const r of rows){
    const prato = r.prato || '—';
    const q = clampNum(r.quantidade);
    map.set(prato, (map.get(prato)||0) + q);
  }
  const arr = Array.from(map.entries()).map(([prato,qty])=>({ prato, total_vendido: qty }));
  const mais = arr.slice().sort((a,b)=> b.total_vendido - a.total_vendido).slice(0,10);
  const menos = arr.slice().filter(x=> x.total_vendido>0).sort((a,b)=> a.total_vendido - b.total_vendido).slice(0,10);
  return { mais, menos };
}

async function fetchMonthIfMissing(payload){
  let m = await rpcSafe('get_monthly_sales_chart_data_mom', { end_date_iso:payload.end, unids_filter:payload.unidades, cats_filter:payload.categorias, pratos_filter:payload.pratos, is_pratos_only:false });
  if(Array.isArray(m) && m.length) return m.map(r=>({ period:r.period, current_total:r.current_total, prev_total:r.prev_total }));

  m = await rpcSafe('get_monthly_sales_chart_data', { end_date_iso:payload.end, unids_filter:payload.unidades, cats_filter:payload.categorias, pratos_filter:payload.pratos, is_pratos_only:false });
  if(Array.isArray(m) && m.length) return m.map(r=>({ period:r.period, current_total:r.current_total, prev_total:r.prev_total }));

  const v2 = await rpcSafe('get_month_v2', { de:payload.start, ate:payload.end, unidades_filtro:payload.unidades, categorias_filtro:payload.categorias, pratos_filtro:payload.pratos });
  if(Array.isArray(v2) && v2.length) return v2.map(r=>({ period:r.mes, current_total:r.total, prev_total:0 }));

  // último fallback: agrega por mês a partir de linhas (prev_total=0)
  const rows = await fetchRowsPaged(payload, 8000);
  const monthMap = new Map(); // 'YYYY-MM' -> total
  for(const r of rows){
    const k = (r.data||'').slice(0,7);
    monthMap.set(k, (monthMap.get(k)||0) + clampNum(r.quantidade));
  }
  return Array.from(monthMap.entries()).sort((a,b)=> a[0].localeCompare(b[0])).map(([k,v])=>({ period:k, current_total:v, prev_total:0 }));
}
async function fetchDowIfMissing(payload){
  const d = await rpcSafe('get_dow_v2', { de:payload.start, ate:payload.end, unidades_filtro:payload.unidades, categorias_filtro:payload.categorias, pratos_filtro:payload.pratos });
  if(Array.isArray(d) && d.length) return d.map(r=>({ dia_semana_nome:r.dia_semana_nome, total:r.total ?? r.total_vendido ?? 0, media:r.media ?? 0 }));

  // agrega localmente
  const rows = await fetchRowsPaged(payload, 8000);
  return aggregateDowFromRows(rows);
}
async function fetchTop10IfMissing(payload){
  const j = await rpcSafe('get_top10_v2', { de:payload.start, ate:payload.end, unidades_filtro:payload.unidades, categorias_filtro:payload.categorias, pratos_filtro:payload.pratos });
  if(j){
    const obj = Array.isArray(j) ? (j[0]||{}) : j;
    return { mais: obj.top_10_mais_vendidos ?? obj.mais ?? obj.top10 ?? [], menos: obj.top_10_menos_vendidos ?? obj.menos ?? [] };
  }
  const rows = await fetchRowsPaged(payload, 8000);
  return aggregateTop10FromRows(rows);
}

/* ===================== BUSCA PRINCIPAL ===================== */
let __inFlight=false;
async function applyAll(payload){
  if(!payload || !payload.start || !payload.end) return;
  if(__inFlight) return; __inFlight=true;

  dgbegc(`[${APP_VERSION}] applyAll`); dbg('payload:', JSON.stringify(payload));
  try{
    setLoadingState(true);

    dtime('rpc:get_sales_dashboard_data');
    const { data:rawData, error } = await supaEstoque.rpc('get_sales_dashboard_data', {
      start_date: payload.start, end_date: payload.end,
      unidades_filter: payload.unidades, categorias_filter: payload.categorias, pratos_filter: payload.pratos
    });
    dtimeEnd('rpc:get_sales_dashboard_data');
    if(error) throw error;

    let dash=null;
    if(Array.isArray(rawData) && rawData.length>0) dash=rawData[0];
    else if(rawData && typeof rawData==='object') dash=rawData;
    dash = dash || {};

    dgbegc('↩️ resposta get_sales_dashboard_data'); dbg(dash); dgend();

    // Extrai blocos
    let kpisBlock = dash.kpis ?? dash.kpi ?? dash.metrics ?? null;
    let monthBlock = dash.sales_by_month ?? dash.month_chart ?? dash.month ?? [];
    let dowBlock   = dash.sales_by_dow   ?? dash.dow_chart   ?? dash.dow   ?? [];
    let tMais      = dash.top_10_mais_vendidos ?? dash.top10_mais ?? dash.top10 ?? [];
    let tMenos     = dash.top_10_menos_vendidos ?? dash.top10_menos ?? [];

    // Fallbacks se faltar coisa
    if(!Array.isArray(monthBlock) || monthBlock.length===0){ monthBlock = await fetchMonthIfMissing(payload); }
    if(!Array.isArray(dowBlock)   || dowBlock.length===0)  { dowBlock   = await fetchDowIfMissing(payload); }
    if((!Array.isArray(tMais)||!tMais.length) && (!Array.isArray(tMenos)||!tMenos.length)){
      const t = await fetchTop10IfMissing(payload); tMais=t.mais; tMenos=t.menos;
    }

    // KPIs — se zerados, derivar pelos dados mensais
    const K0 = normalizeKpis(kpisBlock||{});
    const allZero = Object.values(K0).every(v=> (v==null || v===0));
    if(allZero){
      await diagnoseDataAvailability(payload, 'após get_sales_dashboard_data');
      const totalC = (monthBlock||[]).reduce((s,r)=> s + clampNum(r.current_total ?? r.current ?? r.vendas_atual ?? r.total), 0);
      const totalP = (monthBlock||[]).reduce((s,r)=> s + clampNum(r.prev_total ?? r.previous ?? r.vendas_anterior), 0);
      const days = daysInclusive(payload.start, payload.end) || 1;
      kpisBlock = { current_total: totalC, prev_total: totalP, current_unique: 0, prev_unique: 0, current_daily_avg: totalC/days, prev_daily_avg: totalP/days };
    }

    // Atualiza UI
    updateKpis(kpisBlock || K0);
    renderMonthChart(monthBlock);
    const segModeBtn = document.querySelector('#segDowMode button.active');
    renderDowChart(dowBlock, segModeBtn ? segModeBtn.dataset.mode : 'TOTAL');
    const activeTop10Btn = document.querySelector('#segTop10 button.active');
    renderTop10(activeTop10Btn && activeTop10Btn.dataset.mode==='MENOS' ? tMenos : tMais, activeTop10Btn?.dataset.mode || 'MAIS');

    window.dashboardData = { ...dash, kpis: normalizeKpis(kpisBlock||K0), sales_by_month: monthBlock, sales_by_dow: dowBlock, top_10_mais_vendidos: tMais, top_10_menos_vendidos: tMenos };
    console.info(`[Status ${APP_VERSION}] [ok]: Dados atualizados.`);
  }catch(err){
    console.error(`[${APP_VERSION}] API Error:`, err);
    setChartMessage('box_month','Erro ao carregar dados.');
    setChartMessage('box_dow','Erro ao carregar dados.');
    alert(`Falha ao carregar dados:\n${err?.message || err}`);
  }finally{
    setLoadingState(false); __inFlight=false; dgend();
  }
}

/* ===================== IMPORTAÇÃO ROBUSTA (logs extras) ===================== */
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
    { role:'data',       match:(h)=> /(data|date)/.test(h) },
    { role:'unidade',    match:(h)=> /(unidade|loja|filial)/.test(h) },
    { role:'prato',      match:(h)=> /(prato|item|produto|descricao|item codigo mae|codigo mae)/.test(h) },
    { role:'categoria',  match:(h)=> /(categoria|categorias|depto|departamento|secao|seccao|grupo)/.test(h) },
    { role:'quantidade', match:(h)=> /(quantidade|qtd|qtde|qtd total|qtdade)/.test(h) },
  ];
  const mapHeaders=(headerRow)=>{ const ch=headerRow.map(canon); const map={}; headerRules.forEach(r=>{ const i=ch.findIndex(h=> r.match(h)); if(i>=0) map[r.role]=i; }); return map; };

  btn.addEventListener('click', ()=>{ if(!btn.disabled) input.click(); });

  input.addEventListener('change', async (ev)=>{
    const file=ev.target.files?.[0]; if(!file) return;

    dgbegc('📥 Importação — arquivo selecionado'); dbg('nome:', file.name, 'tamanho:', file.size, 'tipo:', file.type); dgend();

    btn.disabled=true; txt.textContent='Processando...'; spn.style.display='inline-block';
    try{
      dtime('ensureXLSX'); await ensureXLSX(); dtimeEnd('ensureXLSX');
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
        const { error } = await runWithTimeout( supaEstoque.from('vendas_pratos').insert(batch), 120000, `insert lote ${i/BATCH+1}` );
        dtimeEnd(`insert:lote:${i/BATCH+1}`);
        if(error) throw new Error(`Falha ao enviar lote: ${error.message}`);
        sent+=batch.length; dbg(`✔️ Lote ${i/BATCH+1} concluído — total acumulado: ${sent}`); await new Promise(r=> setTimeout(r,0));
      }

      alert(`${sent} registros importados com sucesso! Atualizando dashboard…`);
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

    const requiredIds = ['k_qtd','p_qtd','d_qtd','k_pratos_unicos','p_pratos_unicos','d_pratos_unicos','k_media_diaria','p_media_diaria','d_media_diaria','ch_month','ch_dow','top10-list-body','fxDuStart','fxDuEnd'];
    const missing = requiredIds.filter(id=> !$(id));
    if(missing.length){ console.warn('⚠️ Elementos ausentes no DOM:', missing); }

    filterUnidades = new MultiSelect('ms-unids', fxDispatchApply);
    filterCategorias= new MultiSelect('ms-cats',  fxDispatchApply);
    filterPratos    = new MultiSelect('ms-pratos', fxDispatchApply);

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

    const def = (filt?.categorias||[]).find(c=> String(c).toLowerCase()==='pratos');
    if(def){ filterCategorias.selected.add(def); filterCategorias.updateButtonText(); }
    else { console.warn('Categoria padrão "Pratos" não encontrada nos filtros — seguindo sem default.'); }

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
      const data = mode==='MAIS' ? (dash.top_10_mais_vendidos ?? dash.top10_mais ?? dash.top10 ?? []) : (dash.top_10_menos_vendidos ?? dash.top10_menos ?? []);
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
