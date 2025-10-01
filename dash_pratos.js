/* ===================== CONFIG ===================== */
const APP_VERSION = 'v10.4-dbg3';
const DEBUG = true; // ative/desative logs
const SUPABASE_URL_ESTOQUE  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON_ESTOQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';

const supaEstoque = window.supabase.createClient(SUPABASE_URL_ESTOQUE, SUPABASE_ANON_ESTOQUE);

/* ===================== DEBUG HELPERS ===================== */
function dbg(...args){ if (DEBUG) console.log(...args); }
function dgbeg(label){ if (DEBUG) console.group(label); }
function dgbegc(label){ if (DEBUG) console.groupCollapsed(label); }
function dgend(){ if (DEBUG) console.groupEnd(); }
function dtime(label){ if (DEBUG) console.time(label); }
function dtimeEnd(label){ if (DEBUG) console.timeEnd(label); }

/* Timeout seguro para promessas longas (diagnóstico de “travou”) */
async function runWithTimeout(promise, ms, stage='op'){
  let t;
  const timeout = new Promise((_, rej)=> t = setTimeout(()=> rej(new Error(`Timeout (${ms}ms) em ${stage}`)), ms));
  try{
    const res = await Promise.race([promise, timeout]);
    clearTimeout(t);
    return res;
  }catch(e){
    clearTimeout(t);
    throw e;
  }
}

/* ===================== HELPERS ===================== */
const $  = (id)  => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const clampNum = (v) => { const n = +v; return Number.isFinite(n) ? n : 0; };
const num = (v, d=0) => (v==null||!isFinite(+v)) ? '0' : (+v).toLocaleString('pt-BR', {
  minimumFractionDigits:d, maximumFractionDigits:d
});
const sleep0 = () => new Promise(r=>setTimeout(r,0));

/* datas (UTC) */
function getDateUTC(input){
  let d;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)){
    d = new Date(input + 'T12:00:00Z');
  } else if (input instanceof Date){
    d = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 12,0,0));
  } else {
    const now = new Date();
    d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12,0,0));
  }
  if (isNaN(d.getTime())) return getDateUTC(new Date());
  return d;
}
function getDateISO(dateObj){ return getDateUTC(dateObj).toISOString().split('T')[0]; }
function daysInclusive(startIso, endIso){
  const s = getDateUTC(startIso), e = getDateUTC(endIso);
  const diff = Math.round((e - s) / (24*60*60*1000));
  return diff >= 0 ? (diff+1) : 0;
}
function formatMonthNameFromAny(x){
  if (!x) return '';
  let dt;
  if (typeof x === 'string'){
    if (/^\d{4}-\d{2}$/.test(x)){ dt = new Date(Date.UTC(+x.slice(0,4), +x.slice(5,7)-1, 1)); }
    else { const t = new Date(x); if (!isNaN(t)) dt = t; }
  } else if (x instanceof Date){ dt = x; }
  if (!dt) return String(x);
  const name = dt.toLocaleString('pt-BR', { month:'long', timeZone:'UTC' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/* XLSX robust loader */
function ensureXLSX(){
  return new Promise((resolve, reject)=>{
    if (window.XLSX) return resolve(window.XLSX);
    const existing = document.querySelector('script[src*="xlsx.full.min.js"]');
    if (existing){
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
    this.container = $(containerId);
    if (!this.container) return;
    this.onChange = onChange;
    this.btn = this.container.querySelector('.msel-btn');
    this.panel = this.container.querySelector('.msel-panel');
    this.labelSingular = this.container.dataset.singular || 'Item';
    this.options = [];
    this.selected = new Set();
    this.isOpen = false;
    this.initialized = false;
    this.initEvents();
  }
  initEvents(){
    this.btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      if (!this.initialized) return;
      this.toggle();
    });
    this.panel.addEventListener('click', (e)=>{
      const opt = e.target.closest('.msel-opt'); if (!opt) return;
      const value = opt.dataset.value;
      const cb = opt.querySelector('input[type="checkbox"]');
      if (e.target !== cb) cb.checked = !cb.checked;
      this.handleSelection(value, cb.checked);
    });
    this.panel.addEventListener('click',(e)=> e.stopPropagation());
    document.addEventListener('msel:closeAll',(e)=>{
      const exc = e.detail?.except;
      if (this.container.id !== exc) this.close();
    });
  }
  initialize(list){
    this.options = (list||[]).slice().sort((a,b)=> String(a).localeCompare(String(b)));
    this.renderPanel();
    this.initialized = true;
    this.updateButtonText();
  }
  renderPanel(){
    let html = `<input type="search" class="msel-search" placeholder="Pesquisar...">`;
    html += `<div class="msel-options-list">`;
    if (this.options.length === 0){
      html += `<div style="text-align:center;padding:10px;color:var(--muted);font-size:11px;">Nenhuma opção</div>`;
    } else {
      this.options.forEach(opt=>{
        const s = String(opt).replace(/"/g,'&quot;');
        const chk = this.selected.has(opt) ? 'checked' : '';
        html += `<label class="msel-opt" data-value="${s}"><input type="checkbox" ${chk}><span>${s}</span></label>`;
      });
    }
    html += `</div>`;
    this.panel.innerHTML = html;
    const search = this.panel.querySelector('.msel-search');
    if (search) search.addEventListener('input',(e)=> this.filterOptions(e.target.value));
  }
  filterOptions(q){
    const f = (q||'').toLowerCase();
    this.panel.querySelectorAll('.msel-opt').forEach(el=>{
      const t = (el.dataset.value||'').toLowerCase();
      el.style.display = t.includes(f) ? 'flex' : 'none';
    });
  }
  updateButtonText(){
    const c = this.selected.size;
    if (c===0) this.btn.textContent = 'Todos';
    else if (c===1) this.btn.textContent = Array.from(this.selected)[0];
    else this.btn.textContent = `${c} ${this.labelSingular}s Selec.`;
  }
  handleSelection(val, on){
    if (on) this.selected.add(val); else this.selected.delete(val);
    this.updateButtonText();
    if (this.onChange) this.onChange();
  }
  getSelected(){ return this.selected.size > 0 ? Array.from(this.selected) : null; }
  reset(){
    this.selected.clear();
    if (this.initialized){ this.renderPanel(); this.updateButtonText(); }
  }
  toggle(){ this.isOpen ? this.close() : this.open(); }
  open(){
    document.dispatchEvent(new CustomEvent('msel:closeAll',{detail:{except:this.container.id}}));
    this.container.classList.add('open'); this.isOpen = true;
    const s = this.panel.querySelector('.msel-search'); if (s){ s.value=''; this.filterOptions(''); s.focus(); }
  }
  close(){ this.container.classList.remove('open'); this.isOpen = false; }
}

/* ===================== Filtros ===================== */
let filterUnidades, filterCategorias, filterPratos;
function fxDispatchApply(){
  const s = $('fxDuStart'), e = $('fxDuEnd');
  if (!s || !e || !s.value || !e.value) return;
  const payload = {
    start: s.value, end: e.value,
    unidades: filterUnidades?.getSelected() || null,
    categorias: filterCategorias?.getSelected() || null,
    pratos: filterPratos?.getSelected() || null,
  };
  document.dispatchEvent(new CustomEvent('filters:apply',{detail:payload}));
}
function fxSetRange(start, end){
  const s = $('fxDuStart'), e = $('fxDuEnd');
  if (s && e){ s.value = getDateISO(start); e.value = getDateISO(end); }
}
function fxSetToLastMonthWithData(baseDateStr){
  const base = getDateUTC(baseDateStr);
  const y = base.getUTCFullYear(), m = base.getUTCMonth();
  const from = new Date(Date.UTC(y, m-1, 1));
  const to   = new Date(Date.UTC(y, m, 0));
  fxSetRange(from, to);
  $$('#fxQuickChips button').forEach(b=> b.classList.remove('active'));
  const lastMonthBtn = document.querySelector('#fxQuickChips button[data-win="lastMonth"]');
  if (lastMonthBtn) lastMonthBtn.classList.add('active');
  $$('#fxDuQuickDays button').forEach(b=> b.classList.remove('fx-active'));
}
function setupFilterInteractions(){
  const fx = {
    $btnMore:$('fxBtnMore'), $dropup:$('fxDropup'),
    $quickChips:$('fxQuickChips'), $quickDays:$('fxDuQuickDays'),
    $start:$('fxDuStart'), $end:$('fxDuEnd'), $btnReset:$('fxBtnReset')
  };
  fx.$btnMore.addEventListener('click',(e)=>{
    e.stopPropagation();
    const shown = fx.$dropup.classList.toggle('fx-show');
    fx.$btnMore.setAttribute('aria-expanded', shown);
  });
  document.addEventListener('click',()=>{
    if (fx.$dropup.classList.contains('fx-show')){
      fx.$dropup.classList.remove('fx-show'); fx.$btnMore.setAttribute('aria-expanded', false);
    }
    document.dispatchEvent(new CustomEvent('msel:closeAll'));
  });
  fx.$dropup.addEventListener('click',(e)=>{ if (!e.target.closest('.msel')) e.stopPropagation(); });

  fx.$quickChips.addEventListener('click',(e)=>{
    const btn = e.target.closest('button'); if (!btn || btn.classList.contains('active')) return;
    $$('#fxQuickChips button').forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    $$('#fxDuQuickDays button').forEach(b=> b.classList.remove('fx-active'));

    if (filterUnidades) filterUnidades.reset();
    if (filterCategorias){
      filterCategorias.reset();
      const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos');
      if (def) filterCategorias.handleSelection(def, true);
    }
    if (filterPratos) filterPratos.reset();

    const win = btn.dataset.win;
    const base = getDateUTC(window.__lastDay || new Date());
    let start,end;
    if (win==='today'){ start=end=base; }
    else if (win==='yesterday'){ start=new Date(base); start.setUTCDate(base.getUTCDate()-1); end=start; }
    else if (win==='lastMonth'){ fxSetToLastMonthWithData(window.__lastDay); fxDispatchApply(); return; }
    else if (win==='lastYear'){ const y=base.getUTCFullYear()-1; start=new Date(Date.UTC(y,0,1)); end=new Date(Date.UTC(y,11,31)); }
    if (start && end){ fxSetRange(start,end); fxDispatchApply(); }
  });

  fx.$quickDays.addEventListener('click',(e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    $$('#fxDuQuickDays button').forEach(b=> b.classList.remove('fx-active'));
    btn.classList.add('fx-active');
    const days = parseInt(btn.dataset.win,10);
    const end = getDateUTC(fx.$end.value || window.__lastDay);
    const start = new Date(end); start.setUTCDate(end.getUTCDate()-(days-1));
    fxSetRange(start,end);
    $$('#fxQuickChips button').forEach(b=> b.classList.remove('active'));
    fxDispatchApply();
  });

  const onDate = ()=>{
    if (fx.$start.value && fx.$end.value){
      $$('#fxQuickChips button').forEach(b=> b.classList.remove('active'));
      $$('#fxDuQuickDays button').forEach(b=> b.classList.remove('fx-active'));
      fxDispatchApply();
    }
  };
  fx.$start.addEventListener('change', onDate);
  fx.$end.addEventListener('change', onDate);

  fx.$btnReset.addEventListener('click', ()=>{
    fxSetToLastMonthWithData(window.__lastDay);
    if (filterUnidades) filterUnidades.reset();
    if (filterCategorias){
      filterCategorias.reset();
      const def = filterCategorias.options.find(c=> String(c).toLowerCase()==='pratos');
      if (def) filterCategorias.handleSelection(def, true);
    }
    if (filterPratos) filterPratos.reset();
    fxDispatchApply();
    fx.$dropup.classList.remove('fx-show'); fx.$btnMore.setAttribute('aria-expanded', false);
  });
}

/* ===================== Estado + UI (mensagens, kpis, charts) ===================== */
let chartMonth, chartDow;

function setChartMessage(boxId, message){
  const box = $(boxId);
  if (!box) return;
  let msg = box.querySelector('.chart-message');
  if (!message){
    if (msg) msg.remove();
    return;
  }
  if (!msg){
    msg = document.createElement('div');
    msg.className = 'chart-message';
    box.appendChild(msg);
  }
  msg.textContent = message;
}

/* HOTFIX: evitar TypeError e bloquear UI corretamente */
function setLoadingState(isLoading){
  const els = ['fxBtnMore','btnUpload','fxBtnReset'].map(id=> $(id)).filter(Boolean);
  els.forEach(el => { el.disabled = !!isLoading; });
}

/* Normalizador de KPIs (aceita variações de chaves do SQL) */
function normalizeKpis(k){
  k = k || {};
  const co = (a, ...alts) => a ?? alts.find(v=> v!=null);
  const current_total =
    clampNum(co(k.current_total, k.qtd_atual, k.total_atual, k.current, k.qtd, k.total, k.itens_atual, k.itens));
  const prev_total =
    clampNum(co(k.prev_total, k.qtd_anterior, k.total_anterior, k.previous, k.prev));
  const current_unique =
    clampNum(co(k.current_unique, k.unicos_atual, k.unique_current, k.pratos_unicos_atual, k.unicos));
  const prev_unique =
    clampNum(co(k.prev_unique, k.unicos_anterior, k.unique_previous, k.pratos_unicos_anterior));
  const current_daily_avg =
    clampNum(co(k.current_daily_avg, k.media_diaria, k.media_atual, k.avg_current));
  const prev_daily_avg =
    clampNum(co(k.prev_daily_avg, k.media_diaria_prev, k.media_anterior, k.avg_prev));

  return { current_total, prev_total, current_unique, prev_unique, current_daily_avg, prev_daily_avg };
}

function handleApiError(error){
  console.error(`[${APP_VERSION}] API Error:`, error);
  setChartMessage('box_month','Erro ao carregar dados.');
  setChartMessage('box_dow','Erro ao carregar dados.');
  alert(`Falha ao carregar dados:\n${error?.message || error}`);
  setLoadingState(false);
}

function updateDelta(elId, current, previous){
  const el = $(elId); if (!el) return;
  const c = +current || 0, p = +previous || 0;
  if (p === 0 && c === 0){ el.textContent = '—'; el.classList.remove('up','down'); return; }
  if (p === 0){ el.textContent = '+100%'; el.classList.add('up'); el.classList.remove('down'); return; }
  const delta = ((c - p) / p) * 100;
  const txt = (delta>=0?'+':'') + delta.toFixed(1) + '%';
  el.textContent = txt;
  el.classList.toggle('up', delta>=0);
  el.classList.toggle('down', delta<0);
}

function updateKpis(kpisObj){
  const K = normalizeKpis(kpisObj || {});
  $('k_qtd').textContent = num(K.current_total);
  $('p_qtd').textContent = num(K.prev_total);
  updateDelta('d_qtd', K.current_total, K.prev_total);

  $('k_pratos_unicos').textContent = num(K.current_unique);
  $('p_pratos_unicos').textContent = num(K.prev_unique);
  updateDelta('d_pratos_unicos', K.current_unique, K.prev_unique);

  $('k_media_diaria').textContent = num(K.current_daily_avg, 1);
  $('p_media_diaria').textContent = num(K.prev_daily_avg, 1);
  updateDelta('d_media_diaria', K.current_daily_avg, K.prev_daily_avg);
}

/* ===================== CHARTS ===================== */
function renderMonthChart(data){
  if (chartMonth) chartMonth.destroy();
  setChartMessage('box_month', null);

  if (!Array.isArray(data) || data.length===0){
    setChartMessage('box_month','Nenhum dado mensal encontrado para o período.');
    return;
  }

  const ctx = $('ch_month').getContext('2d');
  const wine = cssVar('--wine') || '#7b1e3a';
  const cprev = cssVar('--c-prev') || '#9ca3af';

  const labels = data.map(d=>{
    const m = d.mes ?? d.period ?? d.month ?? d.periodo;
    return formatMonthNameFromAny(m);
  });
  const current = data.map(d=> clampNum(d.vendas_atual ?? d.current ?? d.current_total ?? d.total));
  const previous = data.map(d=> clampNum(d.vendas_anterior ?? d.previous ?? d.prev_total));

  new Chart(ctx, {
    type: 'bar',
    data: { labels,
      datasets: [
        { label:'Período Atual', data: current, backgroundColor: wine, borderRadius: 4 },
        { label:'Período Anterior', data: previous, backgroundColor: cprev, borderRadius: 4 }
      ]},
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });
}

function renderDowChart(data, mode='TOTAL'){
  if (chartDow) chartDow.destroy();
  setChartMessage('box_dow', null);

  const labels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let source = Array.isArray(data) ? data : [];
  if (source.length===0){ setChartMessage('box_dow','Nenhum dado semanal encontrado para o período.'); }

  const rows = labels.map(name=>{
    const found = source.find(r => (r.dia_semana_nome??r.dow_name) === name);
    return { total: clampNum(found?.total_vendido ?? found?.total), media: clampNum(found?.media) };
  });
  const values = mode==='MÉDIA' ? rows.map(r=> r.media) : rows.map(r=> r.total);

  const ctx = $('ch_dow').getContext('2d');
  const wine = cssVar('--wine') || '#7b1e3a';

  chartDow = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: (mode==='MÉDIA'?'Média Diária':'Itens Vendidos'), data: values, backgroundColor: wine, borderColor: wine, borderWidth:1 }] },
    options: { responsive:true, maintainAspectRatio:false, indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
  });
}

function renderTop10(data, mode='MAIS'){
  const cont = $('top10-list-body');
  cont.innerHTML = '';
  const list = Array.isArray(data) ? data.slice() : [];

  const norm = list.map((r)=> ({
    prato: r.prato ?? r.nome_prato ?? r.item ?? '—',
    qty: clampNum(r.qtd ?? r.quantidade ?? r.total ?? r.total_vendido)
  }));

  if (norm.length===0){
    cont.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);">Nenhum registro.</div>`;
    return;
  }

  norm.forEach((r,idx)=>{
    const row = document.createElement('div');
    row.className = 'top10-row';
    row.innerHTML = `
      <span class="top10-col-rank">${idx+1}</span>
      <span class="top10-col-prato" title="${r.prato}">${r.prato}</span>
      <span class="top10-col-qty">${num(r.qty)}</span>
    `;
    cont.appendChild(row);
  });
}

/* ===================== DIAGNÓSTICO DE DADOS ===================== */
async function diagnoseDataAvailability(payload, note=''){
  if (!DEBUG) return;
  dgbegc(`🔎 Diagnose vendas_pratos ${note ? '— '+note : ''}`);
  try{
    let query = supaEstoque
      .from('vendas_pratos')
      .select('quantidade', { count: 'exact', head: true })
      .gte('data', payload.start)
      .lte('data', payload.end);

    if (payload.categorias) query = query.in('categoria', payload.categorias);
    if (payload.unidades)   query = query.in('unidade', payload.unidades);
    if (payload.pratos)     query = query.in('prato', payload.pratos);

    dtime('count vendas_pratos');
    const { count, error } = await query;
    dtimeEnd('count vendas_pratos');
    dbg('Período:', payload.start, '→', payload.end);
    dbg('Filtros:', { unidades: payload.unidades, categorias: payload.categorias, pratos: payload.pratos });
    dbg('Total de linhas no período (com filtros):', count);
    if (error) console.warn('Erro no COUNT vendas_pratos:', error);
  } catch(e){
    console.warn('Diagnose exception:', e);
  } finally{
    dgend();
  }
}

/* ===================== RPC HELPERS (com logs) ===================== */
async function rpcSafe(name, args){
  try{
    dtime(`rpc:${name}`);
    const { data, error } = await supaEstoque.rpc(name, args || {});
    dtimeEnd(`rpc:${name}`);
    if (error) throw error;
    dgbegc(`✅ RPC ${name} ok`); dbg('args:', args); dbg('data:', data); dgend();
    return data;
  }catch(e){
    dgbegc(`⚠️ RPC ${name} falhou`); dbg('args:', args); console.warn(`[${APP_VERSION}] RPC ${name} falhou:`, e?.message||e); dgend();
    return null;
  }
}

/* Fallbacks não-404 */
async function fetchMonthIfMissing(payload){
  let m = await rpcSafe('get_monthly_sales_chart_data_mom', {
    end_date_iso: payload.end,
    unids_filter: payload.unidades,
    cats_filter: payload.categorias,
    pratos_filter: payload.pratos,
    is_pratos_only: false
  });
  if (m && Array.isArray(m) && m.length) return m.map(r=>({
    period: r.period, current_total: r.current_total, prev_total: r.prev_total
  }));

  m = await rpcSafe('get_monthly_sales_chart_data', {
    end_date_iso: payload.end,
    unids_filter: payload.unidades,
    cats_filter: payload.categorias,
    pratos_filter: payload.pratos,
    is_pratos_only: false
  });
  if (m && Array.isArray(m) && m.length) return m.map(r=>({
    period: r.period, current_total: r.current_total, prev_total: r.prev_total
  }));

  const v2 = await rpcSafe('get_month_v2', {
    de: payload.start, ate: payload.end,
    unidades_filtro: payload.unidades,
    categorias_filtro: payload.categorias,
    pratos_filtro: payload.pratos
  });
  if (v2 && Array.isArray(v2) && v2.length) return v2.map(r=>({
    period: r.mes, current_total: r.total, prev_total: 0
  }));

  return [];
}

async function fetchDowIfMissing(payload){
  // get_dow_v2 tem dado 404/erro de MV — evitamos chamar se falhar
  const d = await rpcSafe('get_dow_v2', {
    de: payload.start, ate: payload.end,
    unidades_filtro: payload.unidades,
    categorias_filtro: payload.categorias,
    pratos_filtro: payload.pratos
  });
  if (d && Array.isArray(d)) return d.map(r=>({
    dia_semana_nome: r.dia_semana_nome, total: r.total ?? r.total_vendido ?? 0, media: r.media ?? 0
  }));
  return []; // ficará com mensagem de “sem dados”
}

async function fetchTop10IfMissing(payload){
  const j = await rpcSafe('get_top10_v2', {
    de: payload.start, ate: payload.end,
    unidades_filtro: payload.unidades,
    categorias_filtro: payload.categorias,
    pratos_filtro: payload.pratos
  });
  if (!j) return { mais: [], menos: [] };
  const obj = Array.isArray(j) ? (j[0]||{}) : j;
  return {
    mais: obj.top_10_mais_vendidos ?? obj.mais ?? obj.top10 ?? [],
    menos: obj.top_10_menos_vendidos ?? obj.menos ?? []
  };
}

/* ===================== BUSCA DE DADOS ===================== */
let __inFlight = false;

async function applyAll(payload){
  if (!payload || !payload.start || !payload.end) return;
  if (__inFlight) return; // evita reentrância
  __inFlight = true;

  dgbegc(`[${APP_VERSION}] applyAll`);
  dbg('payload:', JSON.stringify(payload));
  try{
    setLoadingState(true);

    dtime('rpc:get_sales_dashboard_data');
    const { data: rawData, error } = await supaEstoque.rpc('get_sales_dashboard_data', {
      start_date: payload.start,
      end_date: payload.end,
      unidades_filter: payload.unidades,
      categorias_filter: payload.categorias,
      pratos_filter: payload.pratos
    });
    dtimeEnd('rpc:get_sales_dashboard_data');
    if (error) throw error;

    let dash = null;
    if (Array.isArray(rawData) && rawData.length>0) dash = rawData[0];
    else if (rawData && typeof rawData==='object') dash = rawData;
    dash = dash || {};
    dgbegc('↩️ resposta get_sales_dashboard_data'); dbg(dash); dgend();

    let kpisBlock = dash.kpis ?? dash.kpi ?? dash.metrics ?? null;
    let monthBlock = (dash.sales_by_month ?? dash.month_chart ?? dash.month ?? []);
    let dowBlock   = (dash.sales_by_dow   ?? dash.dow_chart   ?? dash.dow   ?? []);
    let tMais      = dash.top_10_mais_vendidos ?? dash.top10_mais ?? dash.top10 ?? [];
    let tMenos     = dash.top_10_menos_vendidos ?? dash.top10_menos ?? [];

    // KPI
    const K = normalizeKpis(kpisBlock || {});
    dbg('KPIs normalizados (primário):', K);

    // Se tudo zerado, tenta derivar do mês e diagnosticar disponibilidade
    const allZero = Object.values(K).every(v => (v==null || v===0));
    if (allZero){
      console.warn('KPIs vieram zerados — executando diagnose e fallbacks.');
      await diagnoseDataAvailability(payload, 'após get_sales_dashboard_data');

      // Month fallback
      if (!Array.isArray(monthBlock) || monthBlock.length===0){
        monthBlock = await fetchMonthIfMissing(payload);
      }
      const totalC = (monthBlock||[]).reduce((s,r)=> s + clampNum(r.current_total ?? r.current ?? r.vendas_atual ?? r.total), 0);
      const totalP = (monthBlock||[]).reduce((s,r)=> s + clampNum(r.prev_total ?? r.previous ?? r.vendas_anterior), 0);
      const days = daysInclusive(payload.start, payload.end) || 1;
      kpisBlock = {
        current_total: totalC,
        prev_total: totalP,
        current_unique: 0,
        prev_unique: 0,
        current_daily_avg: totalC/days,
        prev_daily_avg: totalP/days
      };
    }

    updateKpis(kpisBlock || K);

    // Month
    if (!Array.isArray(monthBlock) || monthBlock.length===0){
      monthBlock = await fetchMonthIfMissing(payload);
    }
    renderMonthChart(monthBlock);

    // DOW
    if (!Array.isArray(dowBlock) || dowBlock.length===0){
      const tmp = await fetchDowIfMissing(payload);
      if (tmp && tmp.length) dowBlock = tmp;
    }
    const segModeBtn = document.querySelector('#segDowMode button.active');
    const mode = segModeBtn ? segModeBtn.dataset.mode : 'TOTAL';
    renderDowChart(dowBlock, mode);

    // TOP10
    if ((!Array.isArray(tMais) || tMais.length===0) && (!Array.isArray(tMenos) || tMenos.length===0)){
      const t = await fetchTop10IfMissing(payload);
      tMais = t.mais; tMenos = t.menos;
    }
    const activeTop10Btn = document.querySelector('#segTop10 button.active');
    const tmode = activeTop10Btn ? activeTop10Btn.dataset.mode : 'MAIS';
    renderTop10(tmode==='MAIS' ? tMais : tMenos, tmode);

    window.dashboardData = {
      ...dash,
      kpis: normalizeKpis(kpisBlock || K),
      sales_by_month: monthBlock,
      sales_by_dow: dowBlock,
      top_10_mais_vendidos: tMais,
      top_10_menos_vendidos: tMenos
    };

    console.info(`[Status ${APP_VERSION}] [ok]: Dados atualizados.`);
  } catch(err){
    handleApiError(err);
  } finally{
    setLoadingState(false);
    __inFlight = false;
    dgend();
  }
}

/* ===================== IMPORTAÇÃO (XLS/CSV) ===================== */
function parseExcelDate(serial){
  if (typeof serial !== 'number' || !isFinite(serial)) return null;
  const epoch = 25569, msDay = 24*60*60*1000;
  const ts = (serial - epoch) * msDay;
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}
function parseBrazilianDate(s){
  if (typeof s !== 'string') return null;
  const normalized = s.trim().split(' ')[0];
  const parts = normalized.split('/'); if (parts.length!==3) return null;
  const dd = +parts[0], mm = +parts[1]; let yy = +parts[2];
  if ([dd,mm,yy].some(isNaN)) return null;
  if (yy>=0 && yy<100) yy += (yy<50 ? 2000 : 1900);
  if (mm<1||mm>12||dd<1||dd>31||yy<1900) return null;
  const d = new Date(Date.UTC(yy,mm-1,dd,12,0,0));
  if (d.getUTCMonth() !== mm-1 || d.getUTCDate() !== dd) return null;
  return d;
}

async function setupImportFeature(){
  const btn = $('btnUpload'), input = $('fileExcel'), txt = $('uploadText'), spn = $('uploadSpinner');
  if (!btn || !input) return;

  btn.addEventListener('click', ()=>{ if (!btn.disabled) input.click(); });

  input.addEventListener('change', async (ev)=>{
    const file = ev.target.files?.[0]; if (!file) return;

    dgbegc('📥 Importação — arquivo selecionado');
    dbg('nome:', file.name, 'tamanho:', file.size, 'tipo:', file.type);
    btn.disabled = true; txt.textContent = 'Processando...'; spn.style.display = 'inline-block';
    try{
      await ensureXLSX();

      const buf = await file.arrayBuffer();
      let wb;
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      dbg('isCsv:', isCsv);

      dtime('xlsx:read');
      if (isCsv){
        const text = new TextDecoder('utf-8').decode(new Uint8Array(buf));
        wb = XLSX.read(text, { type:'string', raw:true });
      } else {
        wb = XLSX.read(buf, { type:'array', cellDates:false });
      }
      dtimeEnd('xlsx:read');

      const first = wb.SheetNames[0];
      const ws = wb.Sheets[first];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:null });
      dbg('linhas totais (incl cabeçalho):', rows.length);
      if (rows.length <= 1) throw new Error('O arquivo está vazio ou contém apenas o cabeçalho.');

      rows.shift(); // cabeçalho
      dtime('parse linhas');
      const out = rows.map((r, i)=>{
        // Esperado: Data[0], Unidade[1], Prato[2], Categoria[3], Quantidade[4]
        if (r.length < 5 || r[1]==null || r[2]==null) return null;

        let date = null;
        const rawDate = r[0];
        if (typeof rawDate === 'string') date = parseBrazilianDate(rawDate);
        if (!date && typeof rawDate === 'number') date = parseExcelDate(rawDate);
        if (!date && rawDate){ const d2 = new Date(rawDate); if (!isNaN(d2)) date = d2; }
        if (!date){ if (DEBUG) console.warn(`[Import] Linha ${i+2} ignorada (data inválida):`, rawDate); return null; }

        const qty = parseInt(r[4],10); if (isNaN(qty) || qty<=0) return null;

        return {
          data: getDateISO(date),
          unidade: String(r[1]).trim(),
          prato: String(r[2]).trim(),
          categoria: r[3] ? String(r[3]).trim() : 'N/A',
          quantidade: qty
        };
      }).filter(Boolean);
      dtimeEnd('parse linhas');

      dbg('registros válidos:', out.length);
      if (DEBUG) console.table(out.slice(0,5));

      if (out.length===0) throw new Error('Nenhum dado válido encontrado após processamento. Verifique as datas (dd/mm/aaaa) ou seriais Excel.');

      const BATCH = 500;
      let sent = 0;
      for (let i=0;i<out.length;i+=BATCH){
        const batch = out.slice(i,i+BATCH);
        txt.textContent = `Enviando ${Math.min(i+BATCH,out.length)}/${out.length}…`;
        dtime(`insert lote ${i/BATCH+1}`);
        const { error } = await runWithTimeout(
          supaEstoque.from('vendas_pratos').insert(batch),
          120000, // 120s por lote
          `insert lote ${i/BATCH+1}`
        );
        dtimeEnd(`insert lote ${i/BATCH+1}`);
        if (error) throw new Error(`Falha ao enviar lote: ${error.message}`);
        sent += batch.length;
        dbg(`✔️ Lote ${i/BATCH+1} enviado. Total acumulado: ${sent}`);
        await sleep0(); // mantém a UI responsiva
      }

      alert(`${sent} registros importados com sucesso! Atualizando dashboard...`);
      // Atualiza o período corrente sem reload
      fxDispatchApply();

    } catch(err){
      console.error(`[${APP_VERSION}] Erro na importação:`, err);
      alert(`Falha na importação:\n${err?.message||err}`);
    } finally{
      btn.disabled = false; txt.textContent = 'Importar'; spn.style.display = 'none'; input.value='';
      dgend();
    }
  });
}

/* ===================== INIT ===================== */
window.__lastDay = getDateISO(); // fallback

async function init(){
  try{
    console.info(`[Status ${APP_VERSION}] [info]: Inicializando aplicação...`);

    // inicia MSels
    filterUnidades = new MultiSelect('ms-unids', fxDispatchApply);
    filterCategorias = new MultiSelect('ms-cats',  fxDispatchApply);
    filterPratos    = new MultiSelect('ms-pratos', fxDispatchApply);

    // pega data máxima
    let last = null;
    try{
      const { data, error } = await supaEstoque.rpc('get_max_date');
      if (!error && data) last = data;
    } catch(e){}
    if (!last){
      const { data, error } = await supaEstoque.from('vendas_pratos_daterange').select('max_data').maybeSingle();
      if (!error && data?.max_data) last = data.max_data;
    }
    window.__lastDay = last || getDateISO();

    console.info(`[Status ${APP_VERSION}] Data base definida para: ${window.__lastDay}`);

    // opções de filtros
    const { data: filt } = await supaEstoque.rpc('get_filter_options');
    if (filt){
      const obj = Array.isArray(filt) ? filt[0] : filt;
      filterUnidades.initialize(obj?.unidades || []);
      filterCategorias.initialize(obj?.categorias || []);
      filterPratos.initialize(obj?.pratos || []);

      // Categoria padrão: 'Pratos'
      const def = (obj?.categorias||[]).find(c=> String(c).toLowerCase()==='pratos');
      if (def){ filterCategorias.selected.add(def); filterCategorias.updateButtonText(); }
    }

    document.dispatchEvent(new Event('filters:init'));

  } catch(e){
    handleApiError(e);
  }
}

/* ===================== BOOTSTRAP ===================== */
document.addEventListener('DOMContentLoaded', ()=>{
  console.log(`[DIAGNÓSTICO ${APP_VERSION}] Script final iniciado.`);

  // dow mode
  document.getElementById('segDowMode')?.addEventListener('click',(e)=>{
    const b = e.target.closest('button'); if (!b) return;
    $$('#segDowMode button').forEach(x=> x.classList.remove('active'));
    b.classList.add('active');
    const mode = b.dataset.mode || 'TOTAL';
    const src = window.dashboardData?.sales_by_dow ?? window.dashboardData?.dow_chart ?? [];
    renderDowChart(src, mode);
  });

  // top10 toggle
  document.getElementById('segTop10')?.addEventListener('click',(e)=>{
    const b = e.target.closest('button'); if (!b) return;
    $$('#segTop10 button').forEach(x=> x.classList.remove('active'));
    b.classList.add('active');
    const mode = b.dataset.mode || 'MAIS';
    const dash = window.dashboardData || {};
    const data = mode==='MAIS'
      ? (dash.top_10_mais_vendidos ?? dash.top10_mais ?? dash.top10 ?? [])
      : (dash.top_10_menos_vendidos ?? dash.top10_menos ?? []);
    renderTop10(data, mode);
  });

  document.addEventListener('filters:apply', (e)=> applyAll(e.detail));
  document.addEventListener('filters:init', ()=>{
    setupFilterInteractions();
    fxSetToLastMonthWithData(window.__lastDay);
    fxDispatchApply();
  });

  setupImportFeature();
  init();
});
