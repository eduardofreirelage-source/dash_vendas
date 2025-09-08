xvdocument.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // Bloco Único de JavaScript: Lógica Principal, UI, e Inicialização
    // ===================================================================================
    
    /* ===================== CONFIG ===================== */
    const RPC_FILTER_FUNC = 'filter_vendas';
    const RPC_KPI_FUNC = 'kpi_vendas_unificado';
    const RPC_CHART_MONTH_FUNC = 'chart_vendas_mes_v1';
    const RPC_CHART_DOW_FUNC = 'chart_vendas_dow_v1';
    const RPC_CHART_HOUR_FUNC = 'chart_vendas_hora_v1';
    const RPC_CHART_TURNO_FUNC = 'chart_vendas_turno_v1';
    const RPC_DIAGNOSTIC_FUNC = 'diagnostico_geral';

    const DEST_INSERT_TABLE= 'vendas_xlsx';
    const REFRESH_RPC     = 'refresh_sales_materialized';
    const SUPABASE_URL  = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    
    /* ===================== CHART.JS — tema vinho ===================== */
    Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"';
    Chart.defaults.color = '#334155';
    Chart.defaults.plugins.legend.position = 'top';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(148,163,184,.25)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.datasets.bar.borderRadius = 6;
    Chart.defaults.datasets.bar.borderSkipped = false;
    Chart.defaults.datasets.bar.maxBarThickness = 42;
    Chart.defaults.devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    function gradNow(ctx){
      const g = ctx.createLinearGradient(0,0,0,240);
      g.addColorStop(0,'rgba(123,30,58,0.95)');
      g.addColorStop(1,'rgba(156,53,84,0.55)');
      return g;
    }
    function gradPrev(ctx){
      const g = ctx.createLinearGradient(0,0,0,240);
      g.addColorStop(0,'rgba(148,163,184,0.85)');
      g.addColorStop(1,'rgba(203,213,225,0.45)');
      return g;
    }
    
    /* ===================== HELPERS (BLOCOS COMPLETOS E CORRIGIDOS) ===================== */
    const $ = id => document.getElementById(id);
    const setStatus=(t,k)=>{ const el=$('status'); if(el) {el.textContent=t; el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085');} };
    const setDiag=(msg)=>{ const el=$('diag'); if(el) el.textContent = msg || ''; };
    const info=(msg)=>{ const el=$('uploadInfo'); if(el) el.textContent = msg || ''; };
    const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const num =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
    const pctf=v=>(v==null||!isFinite(+v))?'0,0%':((+v)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
    const rmAcc = (s)=> String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const normHeader = (s)=> rmAcc(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    function cleanSpaces(s){ return String(s||'').replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g,' ').replace(/\s+/g,' ').trim(); }
    function displayNormalize(s){ return cleanSpaces(s); }
    const agg = (rows) => {
      const ped = rows?.length || 0;
      let fat=0,des=0,fre=0; 
      for(const r of (rows||[])){ fat+=+r.fat||0; des+=+r.des||0; fre+=+r.fre||0; } 
      return {ped,fat,des,fre};
    };
    const formatCurrencyTick = (value) => {
      const v=Number(value)||0;
      if(Math.abs(v)>=1_000_000) return 'R$ '+(v/1_000_000).toFixed(1).replace('.',',')+' mi';
      if(Math.abs(v)>=1_000)     return 'R$ '+(v/1_000).toFixed(1).replace('.',',')+' mil';
      return 'R$ '+v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    };
    const formatTickBy = (fmt,v) => {
      if(fmt==='count') return (Number(v)||0).toLocaleString('pt-BR');
      if(fmt==='percent'){ const n=Number(v)||0; return (n*100).toFixed(0)+'%'; }
      return formatCurrencyTick(v);
    };
    const formatValueBy = (fmt,v) => {
      if(fmt==='count') return num(v);
      if(fmt==='percent') return pctf(v);
      return money(v);
    };
    const bucketKey = (type, row) => {
      if(type==='dow'){ return (new Date(row.dia+'T12:00:00')).getDay(); }
      if(type==='hour'){ return row.hora ?? null; }
      if(type==='turno'){ return row.turno ?? null; }
      if(type==='month'){ const d=new Date(row.dia+'T12:00:00'); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
      return null;
    };
    const upSVG = () => '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 4l5 6h-3v6H8v-6H5l5-6z"/></svg>';
    const downSVG = () => '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 16l-5-6h3V4h4v6h3l-5 6z"/></svg>';
    const deltaBadge = (el,curr,prev) => {
      if(!el) return;
      if(prev == null || !isFinite(prev) || +prev === 0 || curr == null || !isFinite(curr)){ el.textContent='—'; el.className='delta flat'; return; }
      const delta = (curr-prev)/prev;
      const p = delta*100;
      el.innerHTML=(p>=0? upSVG():downSVG())+' '+Math.abs(p).toFixed(1)+'%';
      el.className='delta '+(p>=0?'up':'down');
    };
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const DateHelpers = {
      iso: (d) => d.toISOString().slice(0, 10),
      addDaysISO: (isoStr, n) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setDate(d.getDate() + n);
          return d.toISOString().slice(0, 10);
      },
      daysLen: (de, ate) => {
          const d1 = new Date(de + 'T12:00:00');
          const d2 = new Date(ate + 'T12:00:00');
          return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      },
      monthStartISO: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setDate(1);
          return d.toISOString().slice(0, 10);
      },
      monthEndISO: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setMonth(d.getMonth() + 1, 0);
          return d.toISOString().slice(0, 10);
      },
      addMonthsISO: (isoStr, delta) => {
          const d = new Date(isoStr + 'T12:00:00');
          const day = d.getDate();
          d.setDate(1);
          d.setMonth(d.getMonth() + delta);
          const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          d.setDate(Math.min(day, last));
          return d.toISOString().slice(0, 10);
      },
      formatYM: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00');
          const m = d.getMonth();
          const y = String(d.getFullYear()).slice(-2);
          const n = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          return `${n[m]}/${y}`;
      },
      lastDayOfMonth: (y, m) => new Date(y, m + 1, 0).getDate(),
      isFullYear: (d1, d2) => d1.getMonth() === 0 && d1.getDate() === 1 && d2.getMonth() === 11 && d2.getDate() === 31 && d1.getFullYear() === d2.getFullYear(),
      isFullMonthsAligned: function(d1, d2) {
          return d1.getDate() === 1 && d2.getDate() === this.lastDayOfMonth(d2.getFullYear(), d2.getMonth());
      },
      shiftYear: function(date, delta) {
          const d = new Date(date);
          d.setFullYear(d.getFullYear() + delta);
          const ld = this.lastDayOfMonth(d.getFullYear(), d.getMonth());
          if (d.getDate() > ld) d.setDate(ld);
          return d;
      },
      computePrevRangeISO: function(deISO, ateISO) {
          if(!deISO || !ateISO) return {dePrev:null, atePrev:null};
          const d1 = new Date(deISO + 'T12:00:00');
          const d2 = new Date(ateISO + 'T12:00:00');
          if (this.isFullYear(d1, d2) || this.isFullMonthsAligned(d1, d2)) {
              const p1 = this.shiftYear(d1, -1);
              const p2 = this.shiftYear(d2, -1);
              return { dePrev: this.iso(p1), atePrev: this.iso(p2) };
          }
          const len = this.daysLen(deISO, ateISO);
          const atePrev = new Date(d1.getTime() - 86400000);
          const dePrev = new Date(atePrev.getTime() - (len - 1) * 86400000);
          return { dePrev: this.iso(dePrev), atePrev: this.iso(atePrev) };
      }
    };
    
    function matchPanelHeights() {
      const panel = document.querySelector('.panel');
      if (!panel) return;

      const chartCard = panel.querySelector('.card:first-child');
      const sideBar = panel.querySelector('.side');

      if (!chartCard || !sideBar) return;
      
      chartCard.style.height = 'auto';

      requestAnimationFrame(() => {
        const sideBarHeight = sideBar.offsetHeight;
        if (sideBarHeight > 0) {
          chartCard.style.height = `${sideBarHeight}px`;
        }
      });
    }

    /* ===================== MULTISELECT ===================== */
    function MultiSelect(rootId, placeholder, onChangeCallback){
      const root=$(rootId), btn=root.querySelector('.msel-btn'), panel=root.querySelector('.msel-panel');
      let options=[], selected=new Set(), filtered=[], q;

      function render(){ 
        panel.innerHTML=''; 
        q = document.createElement('input');
        q.className='msel-search'; 
        q.placeholder='Filtrar…';
        q.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 6px;';
        q.addEventListener('input',()=>{
          const searchTerm = q.value.toLowerCase();
          filtered = options.filter(v => String(v).toLowerCase().includes(searchTerm)); 
          draw();
        });
        panel.appendChild(q); 
        draw();
      }
      
      function draw(){
        const currentOpts = panel.querySelector('.msel-opts-box');
        if (currentOpts) currentOpts.remove();
        
        const box=document.createElement('div');
        box.className = 'msel-opts-box';
        
        const listToRender = (q && q.value) ? filtered : options;

        listToRender.forEach((v, index)=>{
          const row=document.createElement('div'); 
          row.className='msel-opt';
          row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px; border-radius:6px; font-size: 13px; cursor:pointer;';
          row.addEventListener('mouseenter', () => row.style.backgroundColor = '#f3f4f6');
          row.addEventListener('mouseleave', () => row.style.backgroundColor = 'transparent');
          
          const cb=document.createElement('input'); 
          cb.type='checkbox'; 
          cb.value=v; 
          cb.id = `msel-${rootId}-${index}`;
          cb.checked=selected.has(v);
          
          const lb=document.createElement('label'); 
          lb.textContent=v;
          lb.style.cursor = 'pointer';
          lb.setAttribute('for', cb.id);

          cb.addEventListener('change', (e) => {
            e.stopPropagation();
            cb.checked ? selected.add(v) : selected.delete(v); 
            refresh();
            if(onChangeCallback) onChangeCallback();
          });
          
          row.appendChild(cb); 
          row.appendChild(lb); 
          box.appendChild(row);
        });
        panel.appendChild(box);
      }
      
      function refresh(){ 
        btn.textContent = selected.size===0 ? placeholder : `${selected.size} sel.`; 
      }
      
      btn.addEventListener('click',(e)=>{ e.stopPropagation(); root.classList.toggle('open'); if(root.classList.contains('open')) { panel.querySelector('.msel-search').focus(); }});
      document.addEventListener('click',(e)=>{ if(!root.contains(e.target)) root.classList.remove('open'); });
      
      return {
        setOptions(list, keepOrder=false){
          options=(list||[]).filter(v=>v!=null).map(String);
          if(!keepOrder){ options.sort((a,b)=>a.localeCompare(b,'pt-BR')); }
          filtered=options.slice(); 
          selected=new Set([...selected].filter(v=>options.includes(v)));
          render(); 
          refresh();
        },
        get(){return [...selected];},
        set(vals){
          selected=new Set((vals||[]).map(String)); 
          refresh(); 
          render();
        },
        clear() {
          selected.clear();
          refresh();
          render();
        }
      };
    }
    
    /* ===================== ESTADO / FILTROS ===================== */
    let firstDay='', lastDay='';
    const fxDispatchApplyDebounced = debounce(() => fxDispatchApply(), 500);
    const ms={
      unids:  MultiSelect('fxUnit', 'Todas', fxDispatchApplyDebounced),
      lojas:  MultiSelect('fxStore', 'Todas', fxDispatchApplyDebounced),
      canais: MultiSelect('fxChannel', 'Todos', fxDispatchApplyDebounced),
      turnos: MultiSelect('fxShift', 'Todos', fxDispatchApplyDebounced),
      pags:   MultiSelect('fxPay', 'Todos', fxDispatchApplyDebounced),
    };
    const fxCanceled = $('fxCanceled');
    
    /* ===================== LÓGICA DE DADOS (KPIs, Gráficos, etc.) ===================== */
    function buildParams(de, ate, analiticos) {
      const isActive = (val) => val && val.length > 0;
      let p_cancelado = null;
      if (analiticos.cancelado === 'sim') p_cancelado = 'Sim';
      if (analiticos.cancelado === 'nao') p_cancelado = 'Não';
      return {
        p_dini: de, p_dfim: ate,
        p_unids:  isActive(analiticos.unidade) ? analiticos.unidade : null,
        p_lojas:  isActive(analiticos.loja) ? analiticos.loja : null,
        p_turnos: isActive(analiticos.turno) ? analiticos.turno : null,
        p_canais: isActive(analiticos.canal) ? analiticos.canal : null,
        p_pags:   isActive(analiticos.pagamento) ? analiticos.pagamento : null,
        p_cancelado
      };
    }

    async function baseQuery(de, ate, analiticos){
      const PAGE_SIZE = 1000;
      let allRows = [];
      let page = 0;
      let keepFetching = true;
      const params = buildParams(de, ate, analiticos);

      while (keepFetching) {
          const { data, error } = await supa.rpc(RPC_FILTER_FUNC, params)
                                          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          if (error) {
              console.error(`[RPC ${RPC_FILTER_FUNC}]`, error);
              throw error;
          }
          if (data && data.length > 0) {
              allRows.push(...data);
              page++;
              if (data.length < PAGE_SIZE) {
                  keepFetching = false;
              }
          } else {
              keepFetching = false;
          }
      }
      return allRows;
    }
    
    async function updateKPIs(de, ate, dePrev, atePrev, analiticos){
      let allKpiValues = {};
      try {
        const pNow = buildParams(de, ate, analiticos);
        const pPrev = buildParams(dePrev, atePrev, analiticos);
        
        const [
          finNowResult, finPrevResult,
          { count: pedNowCount, error: errPedNow },
          { count: pedPrevCount, error: errPedPrev },
          { count: cnCount, error: errCn }, { count: vnCount, error: errVn },
          { count: cpCount, error: errCp }, { count: vpCount, error: errVp }
        ] = await Promise.all([
            supa.rpc(RPC_KPI_FUNC, pNow),
            supa.rpc(RPC_KPI_FUNC, pPrev),
            supa.from('vendas_canon').select('*', { count: 'exact', head: true }).gte('dia', de).lte('dia', ate),
            supa.from('vendas_canon').select('*', { count: 'exact', head: true }).gte('dia', dePrev).lte('dia', atePrev),
            supa.from('vendas_canon').select('*', { count: 'exact', head: true }).gte('dia', de).lte('dia', ate).eq('cancelado', 'Sim'),
            supa.from('vendas_canon').select('*', { count: 'exact', head: true }).gte('dia', de).lte('dia', ate).eq('cancelado', 'Não'),
            supa.from('vendas_canon').select('*', { count: 'exact', head: true }).gte('dia', dePrev).lte('dia', atePrev).eq('cancelado', 'Sim'),
            supa.from('vendas_canon').select('*', { count: 'exact', head: true }).gte('dia', dePrev).lte('dia', atePrev).eq('cancelado', 'Não')
        ]);

        if(finNowResult.error) throw finNowResult.error;
        if(errPedNow) throw errPedNow;
        
        const pedTotalNow = analiticos.cancelado === 'sim' ? cnCount : analiticos.cancelado === 'nao' ? vnCount : pedNowCount;

        const N = {
            ped: pedTotalNow,
            fat: +(finNowResult.data[0]?.fat || 0),
            des: +(finNowResult.data[0]?.des || 0),
            fre: +(finNowResult.data[0]?.fre || 0)
        };
        const P = {
            ped: pedPrevCount,
            fat: +(finPrevResult.data[0]?.fat || 0),
            des: +(finPrevResult.data[0]?.des || 0),
            fre: +(finPrevResult.data[0]?.fre || 0)
        };

        const {data: cancDataNow} = await supa.rpc(RPC_KPI_FUNC, { ...pNow, p_cancelado: 'Sim' });
        const {data: cancDataPrev} = await supa.rpc(RPC_KPI_FUNC, { ...pPrev, p_cancelado: 'Sim' });
        
        const len = DateHelpers.daysLen(de, ate);
        const prevLen = DateHelpers.daysLen(dePrev, atePrev);

        const tktN = (N.ped > 0) ? (N.fat / N.ped) : 0;
        const tktP = (P.ped > 0) ? (P.fat / P.ped) : 0;
        const fatMedN = len > 0 ? (N.fat / len) : 0;
        const fatMedP = prevLen > 0 ? (P.fat / prevLen) : 0;
        const desPercN = N.fat > 0 ? (N.des / N.fat) : 0;
        const desPercP = P.fat > 0 ? (P.des / P.fat) : 0;
        const freMedN = N.ped > 0 ? (N.fre / N.ped) : 0;
        const freMedP = P.ped > 0 ? (P.fre / P.ped) : 0;
        const cancValN = +(cancDataNow[0]?.fat || 0);
        const cancValP = +(cancDataPrev[0]?.fat || 0);
        const roiN = N.des > 0 ? (N.fat - N.des) / N.des : NaN;
        const roiP = P.des > 0 ? (P.fat - P.des) / P.des : NaN;

        allKpiValues = {
            fat: { current: N.fat, previous: P.fat },
            ped: { current: N.ped, previous: P.ped },
            tkt: { current: tktN, previous: tktP },
            des: { current: N.des, previous: P.des },
            fatmed: { current: fatMedN, previous: fatMedP },
            roi: { current: roiN, previous: roiP },
            desperc: { current: desPercN, previous: desPercP },
            canc_val: { current: cancValN, previous: cancValP },
            fre: { current: N.fre, previous: P.fre },
            fremed: { current: freMedN, previous: freMedP },
            canc_ped: { current: cnCount, previous: cpCount },
        };

        Object.keys(allKpiValues).forEach(key => {
            const kpi = allKpiValues[key];
            const valEl = $(`k_${key}`);
            const prevEl = $(`p_${key}`);
            const deltaEl = $(`d_${key}`);
            if (valEl) valEl.textContent = formatValueBy(KPI_META[key].fmt, kpi.current);
            if (prevEl) prevEl.textContent = formatValueBy(KPI_META[key].fmt, kpi.previous);
            if (deltaEl) deltaBadge(deltaEl, kpi.current, kpi.previous);
        });

      } catch (e) {
        console.error("Erro detalhado em updateKPIs:", e);
        document.querySelectorAll('.kpi .val, .kpi .sub span').forEach(el => el.textContent = '—');
        document.querySelectorAll('.kpi .delta').forEach(el => { el.textContent = '—'; el.className = 'delta flat'; });
        throw e;
      }
      return allKpiValues;
    }
    let chartModeGlobal = 'total';
    const segGlobal = $('segGlobal');
    segGlobal.addEventListener('click',(e)=>{
      const btn=e.target.closest('.seg-btn'); if(!btn) return;
      chartModeGlobal = btn.dataset.mode;
      segGlobal.querySelectorAll('.seg-btn').forEach(b=> b.classList.toggle('active', b===btn));
      document.dispatchEvent(new Event('filters:apply:internal'));
    });
    function ensureChart(canvasId, labels, nowArr, prevArr, tooltipExtra='', fmt='money'){
      const canvas=$(canvasId); if(!canvas) return;
      if(canvas.__chart){ try{canvas.__chart.destroy();}catch(e){} canvas.__chart=null; }
      const ctx=canvas.getContext('2d');
      const chart=new Chart(ctx,{
        type:'bar',
        data:{ labels, datasets:[
          {label:'Atual', data:nowArr.map(v=>+v||0), backgroundColor:gradNow(ctx)},
          {label:'Anterior', data:prevArr.map(v=>+v||0), backgroundColor:gradPrev(ctx)}
        ]},
        options:{
          responsive:true, maintainAspectRatio:false, animation:false,
          scales:{ x:{grid:{display:false}}, y:{beginAtZero:true, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{callback:(v)=>formatTickBy(fmt,v)}}},
          plugins:{ legend:{position:'top'},
            tooltip:{mode:'index',intersect:false,callbacks:{
              label:(ctx)=>`${ctx.dataset.label}: ${formatValueBy(fmt, ctx.parsed.y||0)}`,
              footer:()=> tooltipExtra
            }}
          }
        }
      });
      canvas.__chart=chart;
    }
    let selectedKPI = 'fat';
    const KPI_META = {
      fat:       { label:'Faturamento',         fmt:'money' },
      ped:       { label:'Pedidos',             fmt:'count' },
      tkt:       { label:'Ticket Médio',        fmt:'money' },
      des:       { label:'Incentivos',          fmt:'money' },
      desperc:   { label:'% de incentivos',     fmt:'percent' },
      fre:       { label:'Frete',               fmt:'money' },
      fremed:    { label:'Frete Médio',         fmt:'money' },
      fatmed:    { label:'Faturamento Médio',   fmt:'money' },
      canc_ped:  { label:'Pedidos cancelados',  fmt:'count' },
      canc_val:  { label:'Valor de cancelados', fmt:'money' },
      roi:       { label:'ROI',                 fmt:'percent' },
    };
    function wantedCancelFilterForKPI(){
      const m=KPI_META[selectedKPI];
      return m?.needsCancel||null;
    }
    function effectiveMode(){
      const m=KPI_META[selectedKPI];
      return m?.forceMode || chartModeGlobal;
    }
    function updateChartTitles(){
      const m=KPI_META[selectedKPI]||KPI_META.fat;
      const mode = effectiveMode()==='media' ? ' (média)' : '';
      $('title_month').textContent = `${m.label}${mode} por mês — últimos 12M vs. 12M anteriores`;
      $('title_dow').textContent   = `${m.label}${mode} por dia da semana`;
      $('title_hour').textContent  = `${m.label}${mode} por hora`;
      $('title_turno').textContent = `${m.label}${mode} por turno`;
      $('title_top6').textContent  = `Participação por loja — Top 6 (${m.label}${mode})`;
    }
    function bindKPIClick(){
      document.querySelectorAll('.kpi[data-kpi]').forEach(card=>{
        card.addEventListener('click', ()=>{
          selectedKPI = card.dataset.kpi;
          document.querySelectorAll('.kpi[data-kpi]').forEach(k=>k.classList.toggle('active', k===card));
          document.dispatchEvent(new Event('filters:apply:internal'));
        });
      });
    }
    
    async function updateCharts(de, ate, dePrev, atePrev, analiticos) {
      const meta = KPI_META[selectedKPI] || KPI_META.fat;
      const mode = effectiveMode();
      try {
          setDiag('');
          const paramsNow = buildParams(de, ate, analiticos);
          const paramsPrev = buildParams(dePrev, atePrev, analiticos);

          const [
              {data: dowData}, {data: dowDataPrev},
              {data: hourData}, {data: hourDataPrev},
              {data: turnoData}, {data: turnoDataPrev}
          ] = await Promise.all([
              supa.rpc(RPC_CHART_DOW_FUNC, paramsNow),
              supa.rpc(RPC_CHART_DOW_FUNC, paramsPrev),
              supa.rpc(RPC_CHART_HOUR_FUNC, paramsNow),
              supa.rpc(RPC_CHART_HOUR_FUNC, paramsPrev),
              supa.rpc(RPC_CHART_TURNO_FUNC, paramsNow),
              supa.rpc(RPC_CHART_TURNO_FUNC, paramsPrev),
          ]);
          
          const tip = `Período anterior: ${dePrev} → ${atePrev}`;
          const valueKey = mode === 'media' ? 'media' : 'total';
          
          {
              const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
              const nArr = Array(7).fill(0), pArr = Array(7).fill(0);
              (dowData || []).forEach(r => nArr[r.dow] = r[valueKey]);
              (dowDataPrev || []).forEach(r => pArr[r.dow] = r[valueKey]);
              ensureChart('ch_dow', labels, nArr, pArr, tip, KPI_META[selectedKPI].fmt);
          }
          {
              const nArr = Array(24).fill(0), pArr = Array(24).fill(0);
              (hourData || []).forEach(r => nArr[r.h] = r[valueKey]);
              (hourDataPrev || []).forEach(r => pArr[r.h] = r[valueKey]);
              let minHour = 24, maxHour = -1;
              for (let i = 0; i < 24; i++) {
                  if (nArr[i] > 0 || pArr[i] > 0) {
                      if (i < minHour) minHour = i;
                      if (i > maxHour) maxHour = i;
                  }
              }
              if (minHour > maxHour) {
                  ensureChart('ch_hour', [], [], [], tip, KPI_META[selectedKPI].fmt);
              } else {
                  const range = Array.from({length: maxHour - minHour + 1}, (_, i) => i + minHour);
                  const labels = range.map(h => String(h).padStart(2, '0') + 'h');
                  const nowData = range.map(h => nArr[h]);
                  const prevData = range.map(h => pArr[h]);
                  ensureChart('ch_hour', labels, nowData, prevData, tip, KPI_META[selectedKPI].fmt);
              }
          }
          {
              const labels = ['Dia', 'Noite'];
              const nMap = new Map(), pMap = new Map();
              (turnoData || []).forEach(r => nMap.set(r.turno, r[valueKey]));
              (turnoDataPrev || []).forEach(r => pMap.set(r.turno, r[valueKey]));
              const nArr = labels.map(l => nMap.get(l) || 0);
              const pArr = labels.map(l => pMap.get(l) || 0);
              ensureChart('ch_turno', labels, nArr, pArr, tip, KPI_META[selectedKPI].fmt);
          }
      } catch (e) {
          console.error("Erro ao atualizar gráficos analíticos:", e); 
          setDiag('Erro ao atualizar gráficos');
      }
    }
    async function updateMonth12x12(analiticos){
      try{
        const end = lastDay || DateHelpers.iso(new Date());
        const endMonthStart = DateHelpers.monthStartISO(end);
        const last12Start = DateHelpers.addMonthsISO(endMonthStart, -11);
        const prev12Start = DateHelpers.addMonthsISO(endMonthStart, -23);
        const last12End   = DateHelpers.monthEndISO(end);
        const prev12EndAdj= DateHelpers.monthEndISO(DateHelpers.addMonthsISO(endMonthStart, -12));
        const meta = KPI_META[selectedKPI]||KPI_META.fat;
        
        const paramsNow = buildParams(last12Start, last12End, analiticos);
        const paramsPrev = buildParams(prev12Start, prev12EndAdj, analiticos);

        const [{data: nData, error: nErr}, {data: pData, error: pErr}] = await Promise.all([
            supa.rpc(RPC_CHART_MONTH_FUNC, paramsNow),
            supa.rpc(RPC_CHART_MONTH_FUNC, paramsPrev)
        ]);

        if (nErr) throw nErr;
        if (pErr) throw pErr;

        const mode = effectiveMode();
        const valueKey = mode === 'media' ? 'media' : 'total';
        
        const toMap = (arr)=> new Map((arr||[]).map(r=>[r.ym, +r[valueKey]||0]));
        const mNow = toMap(nData), mPrev = toMap(pData);
        
        let labels = [];
        const ymsNow = []; 
        let cur = last12Start;
        for(let i=0;i<12;i++){ 
            labels.push(DateHelpers.formatYM(cur)); 
            const d=new Date(cur+'T12:00:00'); 
            const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
            ymsNow.push(ym); 
            cur=DateHelpers.addMonthsISO(cur,1); 
        }

        const ymsPrev = ymsNow.map(ym=>{ const [yy,mm]=ym.split('-').map(Number); const p=new Date(yy,mm-1-12,1); return `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}`; });
        
        const nowArr  = ymsNow.map(ym => mNow.get(ym)||0);
        const prevArr = ymsPrev.map(ym => mPrev.get(ym)||0);
        const tip = `Comparação fixa: Últimos 12M vs 12M anteriores`;
        ensureChart('ch_month', labels, nowArr, prevArr, tip, meta.fmt);
      }catch(e){
        console.error("Erro detalhado em updateMonth12x12:", e); 
        setDiag('Erro ao atualizar gráfico mensal');
      }
    }
    const wine = ["#7b1e3a","#8c2947","#9c3554","#ad4061","#bd4c6e","#ce577b", "#e5e7eb"];
    function ensureDonutTop6(labels, values, centerText, fmt='money'){
      const cvs = $('ch_top6'); if(!cvs) return;
      if(cvs.__chart){ try{cvs.__chart.destroy();}catch(e){} cvs.__chart=null; }
      const ctx = cvs.getContext('2d');
      const total = (values||[]).reduce((a,b)=>a+(+b||0),0);
      $('top6Center').textContent = (centerText!=null ? centerText : 'Total: '+(fmt==='money'?money(total): fmt==='count'? num(total) : formatValueBy(fmt, total)));
      const chart = new Chart(ctx,{
        type:'doughnut',
        data:{ labels, datasets:[{ data: values, backgroundColor: wine, hoverBackgroundColor: wine, borderColor:'#fff', borderWidth:1 }]},
        options:{
          responsive:true, maintainAspectRatio:false, cutout:'60%',
          plugins:{
            legend:{ position:'right', labels:{ usePointStyle:true, pointStyle:'circle', boxWidth:10, padding:16, color:'#334155' } },
            tooltip:{ callbacks:{ label:(ctx)=>{ const label = ctx.label||''; const val = ctx.parsed||0; const ds = ctx.chart.data.datasets[0]; const tt = (ds.data||[]).reduce((a,b)=>a+(+b||0),0); const perc = tt ? ((val/tt)*100).toFixed(1) : 0; return `${label}: ${formatValueBy(KPI_META[selectedKPI]?.fmt||'money', val)} (${perc}%)`; } },
              backgroundColor:'rgba(15,23,42,.95)', titleColor:'#e2e8f0', bodyColor:'#e2e8f0', borderColor:'rgba(148,163,184,.25)', borderWidth:1 }
          }
        }
      });
      cvs.__chart = chart;
    }
    async function updateTop6(de, ate, analiticos){
      try{
        const meta = KPI_META[selectedKPI]||KPI_META.fat;
        const data = await baseQuery(de, ate, analiticos);
        const m = new Map();
        (data||[]).forEach(r=>{
          const loja = r.loja || '—';
          if(!m.has(loja)) m.set(loja, {fat:0, des:0, fre:0, ped:0, dias: new Set()});
          const acc = m.get(loja);
          acc.fat += +r.fat||0;
          acc.des += +r.des||0;
          acc.fre += +r.fre||0;
          acc.ped += 1;
          acc.dias.add(r.dia);
        });

        function metricVal(aggData){
          const mode = effectiveMode();
          const isRatio = ['tkt','desperc','fremed','roi'].includes(selectedKPI);
          if (isRatio) {
            switch(selectedKPI){
                case 'tkt': return (aggData.ped>0) ? aggData.fat/aggData.ped : 0;
                case 'desperc': return (aggData.fat>0) ? aggData.des/aggData.fat : 0;
                case 'fremed': return (aggData.ped>0) ? aggData.fre/aggData.ped : 0;
                case 'roi': return (aggData.des>0) ? (aggData.fat - aggData.des)/aggData.des : 0;
            }
          } else {
            const numDays = aggData.dias.size || 1;
            switch(selectedKPI){
                case 'fat': return mode==='media' ? aggData.fat / numDays : aggData.fat;
                case 'ped': return mode==='media' ? aggData.ped / numDays : aggData.ped;
                case 'des': return mode==='media' ? aggData.des / numDays : aggData.des;
                case 'fre': return mode==='media' ? aggData.fre / numDays : aggData.fre;
                case 'fatmed': return aggData.fat / numDays;
                case 'canc_ped': return mode==='media' ? aggData.ped / numDays : aggData.ped;
                case 'canc_val': return mode==='media' ? aggData.fat / numDays : aggData.fat;
            }
          }
          return 0;
        }

        const allStoresData = Array.from(m.entries()).map(([loja, aggData]) => ({ loja, valor: metricVal(aggData) }));
        allStoresData.sort((a,b)=> b.valor - a.valor);
        
        let finalData = allStoresData;
        if (allStoresData.length > 6) {
            const top5 = allStoresData.slice(0, 5);
            const othersValue = allStoresData.slice(5).reduce((acc, curr) => acc + curr.valor, 0);
            if (othersValue > 0.01) { 
              finalData = [...top5, { loja: 'Outros', valor: othersValue }];
            } else {
              finalData = top5;
            }
        }
        
        const labels = finalData.map(d => d.loja);
        const values = finalData.map(d => d.valor);
        const total = allStoresData.reduce((sum, item) => sum + item.valor, 0);
        ensureDonutTop6(labels, values, `Total: ${formatValueBy(meta.fmt, total)}`, meta.fmt);

      }catch(e){
        console.warn('top6 erro:', e.message||e);
        ensureDonutTop6([],[], 'Total: R$ 0,00','money');
      }
    }
    $('btnUpload').addEventListener('click', ()=> $('fileExcel').click());
    $('fileExcel').addEventListener('change', async (ev)=>{
      const file = ev.target.files?.[0];
      if(!file){ info(''); return; }
      info('Lendo arquivo…');
      try{
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { raw:false, defval:null });
      }catch(e){
        console.error(e);
        setStatus('Erro ao ler/enviar Excel: '+(e.message||e),'err');
        info('');
      }finally{
        $('fileExcel').value='';
      }
    }
