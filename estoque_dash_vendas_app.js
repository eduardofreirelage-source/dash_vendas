document.addEventListener('DOMContentLoaded', () => {
    // ### AJUSTE FINAL: Ocultar o slot livre ###
    // Troque 'ID_DO_SLOT_A_OCULTAR' pelo ID real do elemento que você quer esconder.
    const slotLivre = document.getElementById('ID_DO_SLOT_A_OCULTAR');
    if (slotLivre) {
        slotLivre.parentElement.style.display = 'none'; // Esconde o 'card' inteiro
    }
    // ===================================================================================
    
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
          const d = new Date(isoStr + 'T12:00:00Z');
          d.setDate(d.getDate() + n);
          return d.toISOString().slice(0, 10);
      },
      daysLen: (de, ate) => {
          if (!de || !ate) return 0;
          const d1 = new Date(de + 'T12:00:00Z');
          const d2 = new Date(ate + 'T12:00:00Z');
          return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      },
      monthStartISO: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00Z');
          d.setDate(1);
          return d.toISOString().slice(0, 10);
      },
      monthEndISO: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00Z');
          d.setMonth(d.getMonth() + 1, 0);
          return d.toISOString().slice(0, 10);
      },
      addMonthsISO: (isoStr, delta) => {
          const d = new Date(isoStr + 'T12:00:00Z');
          const day = d.getDate();
          d.setDate(1);
          d.setMonth(d.getMonth() + delta);
          const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          d.setDate(Math.min(day, last));
          return d.toISOString().slice(0, 10);
      },
      formatYM: (ymdString) => {
          const d = new Date(ymdString + 'T12:00:00Z');
          const m = d.getUTCMonth();
          const y = String(d.getUTCFullYear()).slice(-2);
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
          const d1 = new Date(deISO + 'T12:00:00Z');
          const d2 = new Date(ateISO + 'T12:00:00Z');
          
          if (this.isFullYear(d1, d2)) {
              const p1 = this.shiftYear(d1, -1);
              const p2 = this.shiftYear(d2, -1);
              return { dePrev: this.iso(p1), atePrev: this.iso(p2) };
          }

          if (this.isFullMonthsAligned(d1, d2)) {
              const numMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth() + 1;
              const atePrevDate = new Date(d1.getTime() - 86400000);
              const dePrevDate = new Date(d1);
              dePrevDate.setMonth(dePrevDate.getMonth() - numMonths);
              return { dePrev: this.iso(dePrevDate), atePrev: this.iso(atePrevDate) };
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
    let projectionDays = 30;
    let diagChartMode = 'total';
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

    function buildChartParams(de, ate, analiticos) {
      const params = buildParams(de, ate, analiticos);
      delete params.p_unids;
      return params;
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

    function renderVendasKPIs(allKpiValues) {
        if (!allKpiValues) {
            document.querySelectorAll('.kpi .val, .kpi .sub span').forEach(el => el.textContent = '—');
            document.querySelectorAll('.kpi .delta').forEach(el => { el.textContent = '—'; el.className = 'delta flat'; });
            return;
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
    }

    async function updateKPIs(de, ate, dePrev, atePrev, analiticos){
        let allKpiValues = {};
        try {
            const pTotalNow = buildParams(de, ate, { ...analiticos, cancelado: 'ambos' });
            const pTotalPrev = buildParams(dePrev, atePrev, { ...analiticos, cancelado: 'ambos' });

            const buildCountQuery = (startDate, endDate, cancelFilter) => {
                let query = supa.from('vendas_canon').select('*', { count: 'exact', head: true })
                    .gte('dia', startDate)
                    .lte('dia', endDate);
                
                const isActive = (val) => val && val.length > 0;
                if (isActive(analiticos.unidade)) query = query.in('unidade', analiticos.unidade);
                if (isActive(analiticos.loja)) query = query.in('loja', analiticos.loja);
                if (isActive(analiticos.turno)) query = query.in('turno', analiticos.turno);
                if (isActive(analiticos.canal)) query = query.in('canal', analiticos.canal);
                if (isActive(analiticos.pagamento)) query = query.in('pagamento_base', analiticos.pagamento);
                
                if (cancelFilter === 'Sim') query = query.eq('cancelado', 'Sim');
                if (cancelFilter === 'Não') query = query.eq('cancelado', 'Não');

                return query;
            };

            const [
                totalFinNowResult, totalFinPrevResult,
                { count: pedNowCount, error: errPedNow },
                { count: pedPrevCount, error: errPedPrev },
                { count: cnCount, error: errCn }, { count: vnCount, error: errVn },
                { count: cpCount, error: errCp }, { count: vpCount, error: errVp }
            ] = await Promise.all([
                supa.rpc(RPC_KPI_FUNC, pTotalNow),
                supa.rpc(RPC_KPI_FUNC, pTotalPrev),
                buildCountQuery(de, ate, null),
                buildCountQuery(dePrev, atePrev, null),
                buildCountQuery(de, ate, 'Sim'),
                buildCountQuery(de, ate, 'Não'),
                buildCountQuery(dePrev, atePrev, 'Sim'),
                buildCountQuery(dePrev, atePrev, 'Não')
            ]);

            if(totalFinNowResult.error) throw totalFinNowResult.error;
            if(errPedNow) throw errPedNow;
            
            const {data: cancDataNow} = await supa.rpc(RPC_KPI_FUNC, { ...buildParams(de, ate, analiticos), p_cancelado: 'Sim' });
            const {data: cancDataPrev} = await supa.rpc(RPC_KPI_FUNC, { ...buildParams(dePrev, atePrev, analiticos), p_cancelado: 'Sim' });

            const pedTotalNow = analiticos.cancelado === 'sim' ? cnCount : analiticos.cancelado === 'nao' ? vnCount : pedNowCount;
            const pedTotalPrev = analiticos.cancelado === 'sim' ? cpCount : analiticos.cancelado === 'nao' ? vpCount : pedPrevCount;

            const totalNow = { fat: +(totalFinNowResult.data[0]?.fat || 0), des: +(totalFinNowResult.data[0]?.des || 0), fre: +(totalFinNowResult.data[0]?.fre || 0) };
            const totalPrev = { fat: +(totalFinPrevResult.data[0]?.fat || 0), des: +(totalFinPrevResult.data[0]?.des || 0), fre: +(totalFinPrevResult.data[0]?.fre || 0) };
            const cancNow = { fat: +(cancDataNow[0]?.fat || 0), des: +(cancDataNow[0]?.des || 0), fre: +(cancDataNow[0]?.fre || 0) };
            const cancPrev = { fat: +(cancDataPrev[0]?.fat || 0), des: +(cancDataPrev[0]?.des || 0), fre: +(cancDataPrev[0]?.fre || 0) };

            let N_financial, P_financial;
            if (analiticos.cancelado === 'nao') {
                N_financial = { fat: totalNow.fat - cancNow.fat, des: totalNow.des - cancNow.des, fre: totalNow.fre - cancNow.fre };
                P_financial = { fat: totalPrev.fat - cancPrev.fat, des: totalPrev.des - cancPrev.des, fre: totalPrev.fre - cancPrev.fre };
            } else if (analiticos.cancelado === 'sim') {
                N_financial = cancNow;
                P_financial = cancPrev;
            } else {
                N_financial = totalNow;
                P_financial = totalPrev;
            }
            
            const N = { ped: pedTotalNow, ...N_financial };
            const P = { ped: pedTotalPrev, ...P_financial };

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
                canc_val: { current: cancNow.fat, previous: cancPrev.fat },
                fre: { current: N.fre, previous: P.fre },
                fremed: { current: freMedN, previous: freMedP },
                canc_ped: { current: cnCount, previous: cpCount },
            };

        } catch (e) {
            console.error("Erro detalhado em updateKPIs:", e);
            return null;
        }
        return allKpiValues;
    }

    async function getAndRenderUnitKPIs(kpi_key, de, ate, dePrev, atePrev, analiticos) {
      const mainKpiCard = $('hero_main_kpi');
      if (mainKpiCard) {
          const mainValueEl = mainKpiCard.querySelector('.hero-value-number');
          const mainDeltaEl = mainKpiCard.querySelector('.delta');
          const mainSubEl = mainKpiCard.querySelector('.hero-sub-value');
          
          const totalAnaliticos = {...analiticos, unidade: [], loja: []};
          const totalKpis = await updateKPIs(de, ate, dePrev, atePrev, totalAnaliticos);
          
          if(totalKpis && totalKpis[kpi_key]) {
              const meta = KPI_META[kpi_key];
              mainValueEl.textContent = formatValueBy(meta.fmt, totalKpis[kpi_key].current);
              mainSubEl.textContent = 'Anterior: ' + formatValueBy(meta.fmt, totalKpis[kpi_key].previous);
              deltaBadge(mainDeltaEl, totalKpis[kpi_key].current, totalKpis[kpi_key].previous);
          }
      }

      const fetchAndCalculateForUnit = async (unitName) => {
          const unitAnaliticos = { ...analiticos, unidade: [unitName] };
          return await updateKPIs(de, ate, dePrev, atePrev, unitAnaliticos);
      };
    
      try {
          const [rajaKpis, savassiKpis] = await Promise.all([
            fetchAndCalculateForUnit('Uni.Raja'), 
            fetchAndCalculateForUnit('Uni.Savassi')
          ]);

          const kpiMeta = KPI_META[kpi_key] || { fmt: 'money' };
          const renderUnit = (unitId, unitData) => {
            const card = $(unitId);
            const data = unitData?.[kpi_key];
            if (card && data) {
              card.querySelector('.unit-kpi-value').textContent = formatValueBy(kpiMeta.fmt, data.current);
              card.querySelector('.unit-kpi-sub').textContent = 'Anterior: ' + formatValueBy(kpiMeta.fmt, data.previous);
              deltaBadge(card.querySelector('.delta'), data.current, data.previous);
            } else if (card) {
                card.querySelector('.unit-kpi-value').textContent = '—';
                card.querySelector('.unit-kpi-sub').textContent = 'Anterior: —';
                deltaBadge(card.querySelector('.delta'), null, null);
            }
          };

          renderUnit('unit-kpi-raja', rajaKpis);
          renderUnit('unit-kpi-savassi', savassiKpis);
          
      } catch(e) {
          console.error("Erro ao renderizar KPIs de unidade:", e);
      }
    }
    
    async function updateProjections(de, ate, dePrev, atePrev, analiticos) {
        const kpiKey = $('kpi-select').value;
        const meta = KPI_META[kpiKey] || { fmt: 'money' };

        const calculateTrendProjection = (current, previous) => {
            if (current == null || !isFinite(current) || previous == null || !isFinite(previous) || previous === 0) {
                return { value: current, deltaVal: 0 };
            }
            const delta = (current - previous) / previous;
            return { value: current * (1 + delta), deltaVal: delta };
        };

        const len = DateHelpers.daysLen(de, ate);
        const projectionMultiplier = len > 0 ? projectionDays / len : 1;

        const resetUI = (scope) => {
            $('proj_total_label').textContent = `PROJEÇÃO ${meta.label.toUpperCase()} (${projectionDays}D)`;
            $('proj_raja_label').textContent = `UNI.RAJA - ${meta.label}`;
            $('proj_savassi_label').textContent = `UNI.SAVASSI - ${meta.label}`;
            if(scope === 'total' || scope === 'all') {
                $('proj_total_val').textContent = '—';
                deltaBadge($('proj_total_delta'), null, null);
            }
            if(scope === 'raja' || scope === 'all') {
                $('proj_raja_val').textContent = '—';
                deltaBadge($('proj_raja_delta'), null, null);
            }
            if(scope === 'savassi' || scope === 'all') {
                $('proj_savassi_val').textContent = '—';
                deltaBadge($('proj_savassi_delta'), null, null);
            }
        };
        resetUI('all');

        try {
            const [totalData, rajaData, savassiData] = await Promise.all([
                updateKPIs(de, ate, dePrev, atePrev, analiticos),
                updateKPIs(de, ate, dePrev, atePrev, { ...analiticos, unidade: ['Uni.Raja'] }),
                updateKPIs(de, ate, de
