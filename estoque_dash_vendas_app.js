document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // ARQUITETURA FINAL E SIMPLIFICADA (LÓGICA NO CLIENT-SIDE)
    // ===================================================================================

    const $ = id => document.getElementById(id);
    const setStatus=(t,k)=>{ const el=$('status'); if(el) {el.textContent=t; el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085');} };
    const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const num =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
    const pctf=v=>(v==null||!isFinite(+v))?'0,0%':((+v)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
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
    const debounce = (func, delay) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };

    /* ===================== CONFIG ===================== */
    const SUPABASE_URL = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    
    const REFRESH_MV_RPC = 'refresh_vendas_analytics_mv';
    const DATA_SOURCE = 'vendas_analytics_mv';

    /* ===================== CHART.JS CONFIG ===================== */
    Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
    Chart.defaults.color = '#334155';
    Chart.defaults.plugins.legend.position = 'top';
    const gradNow = ctx => { const g=ctx.createLinearGradient(0,0,0,240); g.addColorStop(0,'rgba(123,30,58,0.95)'); g.addColorStop(1,'rgba(156,53,84,0.55)'); return g; };
    const gradPrev = ctx => { const g=ctx.createLinearGradient(0,0,0,240); g.addColorStop(0,'rgba(148,163,184,0.85)'); g.addColorStop(1,'rgba(203,213,225,0.45)'); return g; };

    /* ===================== HELPERS ===================== */
    const DateHelpers = {
      iso: (d) => d.toISOString().slice(0, 10),
      daysLen: (de, ate) => { if (!de || !ate) return 0; const d1 = new Date(de + 'T12:00:00'); const d2 = new Date(ate + 'T12:00:00'); return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1; },
      monthStartISO: (isoStr) => { const d = new Date(isoStr + 'T12:00:00'); d.setDate(1); return d.toISOString().slice(0, 10); },
      monthEndISO: (isoStr) => { const d = new Date(isoStr + 'T12:00:00'); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().slice(0, 10); },
      addMonthsISO: (isoStr, delta) => { const d = new Date(isoStr + 'T12:00:00'); d.setMonth(d.getMonth() + delta); return d.toISOString().slice(0, 10); },
      formatYM: (isoStr) => { const d = new Date(isoStr + 'T12:00:00'); const m = d.getMonth(); const y = String(d.getFullYear()).slice(-2); const n = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${n[m]}/${y}`; },
      computePrevRangeISO: function(deISO, ateISO) {
          if(!deISO || !ateISO) return {dePrev:null, atePrev:null};
          const d1 = new Date(deISO + 'T12:00:00');
          const len = this.daysLen(deISO, ateISO);
          const atePrev = new Date(d1.getTime() - 86400000);
          const dePrev = new Date(atePrev.getTime() - (len - 1) * 86400000);
          return { dePrev: this.iso(dePrev), atePrev: this.iso(atePrev) };
      }
    };
    function MultiSelect(rootId, placeholder, onChangeCallback){
      const root=$(rootId), btn=root.querySelector('.msel-btn'), panel=root.querySelector('.msel-panel');
      let options=[], selected=new Set();
      function render(){
        panel.innerHTML=`<input class="msel-search" placeholder="Filtrar…">`;
        const box=document.createElement('div'); box.className='msel-opts-box';
        options.forEach((v, index)=>{
          const row=document.createElement('div'); row.className='msel-opt';
          const cb=document.createElement('input'); cb.type='checkbox'; cb.value=v; cb.id = `msel-${rootId}-${index}`; cb.checked=selected.has(v);
          const lb=document.createElement('label'); lb.textContent=v; lb.setAttribute('for', cb.id);
          cb.addEventListener('change', () => { cb.checked ? selected.add(v) : selected.delete(v); refresh(); onChangeCallback(); });
          row.append(cb, lb); box.appendChild(row);
        });
        panel.appendChild(box);
        panel.querySelector('.msel-search').addEventListener('input', e => {
            const term = e.target.value.toLowerCase();
            box.querySelectorAll('.msel-opt').forEach(opt => {
                opt.style.display = opt.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
            });
        });
      }
      function refresh(){ btn.textContent = selected.size===0 ? placeholder : `${selected.size} sel.`; }
      btn.addEventListener('click',(e)=>{ e.stopPropagation(); root.classList.toggle('open'); if(root.classList.contains('open')) { panel.querySelector('.msel-search').focus(); }});
      document.addEventListener('click',(e)=>{ if(!root.contains(e.target)) root.classList.remove('open'); });
      return {
        setOptions(list){ options=(list||[]).filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR')); selected.clear(); render(); refresh(); },
        get(){return [...selected];},
        clear() { selected.clear(); render(); refresh(); }
      };
    }
    
    /* ===================== ESTADO / FILTROS ===================== */
    let firstDay='', lastDay='';
    let selectedKPI = 'fat';
    const fxDispatchApplyDebounced = debounce(() => fxDispatchApply(), 500);
    const ms={
      unids:  MultiSelect('fxUnit', 'Todas', fxDispatchApplyDebounced),
      lojas:  MultiSelect('fxStore', 'Todas', fxDispatchApplyDebounced),
      canais: MultiSelect('fxChannel', 'Todos', fxDispatchApplyDebounced),
      turnos: MultiSelect('fxShift', 'Todos', fxDispatchApplyDebounced),
      pags:   MultiSelect('fxPay', 'Todos', fxDispatchApplyDebounced),
    };
    const fxCanceled = $('fxCanceled');
    
    /* ===================== LÓGICA DE DADOS ===================== */
    async function fetchData(de, ate, analiticos) {
        if (!de || !ate) return [];
        let query = supa.from(DATA_SOURCE).select('*').gte('dia', de).lte('dia', ate);
        const isActive = (val) => val && val.length > 0;
        if (isActive(analiticos.unidade)) query = query.in('unidade', analiticos.unidade);
        if (isActive(analiticos.loja)) query = query.in('loja', analiticos.loja);
        if (isActive(analiticos.turno)) query = query.in('turno', analiticos.turno);
        if (isActive(analiticos.canal)) query = query.in('canal', analiticos.canal);
        if (isActive(analiticos.pagamento)) query = query.in('pagamento_base', analiticos.pagamento);
        if (analiticos.cancelado === 'sim') query = query.eq('cancelado', 'Sim');
        if (analiticos.cancelado === 'nao') query = query.eq('cancelado', 'Não');
        const { data, error } = await query;
        if (error) { console.error("FetchData error:", error); throw error; }
        return data || [];
    }

    function calculateAllKPIs(rows, numDays) {
        if (!rows || rows.length === 0) {
            return { fat: 0, ped: 0, des: 0, fre: 0, canc_val: 0, canc_ped: 0, tkt: 0, fatmed: 0, desperc: 0, roi: 0, fremed: 0 };
        }
        const res = { fat: 0, ped: 0, des: 0, fre: 0, canc_val: 0, canc_ped: 0 };
        for (const r of rows) {
            res.fat += r.fat;
            res.ped += r.pedidos;
            res.des += r.des;
            res.fre += r.fre;
            if (r.cancelado === 'Sim') {
                res.canc_val += r.fat;
                res.canc_ped += r.pedidos;
            }
        }
        return {
            ...res,
            tkt: res.fat / (res.ped || 1),
            fatmed: res.fat / (numDays || 1),
            desperc: res.des / (res.fat || 1),
            roi: (res.fat - res.des) / (res.des || 1),
            fremed: res.fre / (res.ped || 1),
        };
    }
    
    async function updateKPIs(de, ate, dePrev, atePrev, analiticos) {
        const [nowData, prevData] = await Promise.all([
            fetchData(de, ate, analiticos),
            fetchData(dePrev, atePrev, analiticos)
        ]);
        const N = calculateAllKPIs(nowData, DateHelpers.daysLen(de, ate));
        const P = calculateAllKPIs(prevData, DateHelpers.daysLen(dePrev, atePrev));
        const allKpiValues = {
            fat: { current: N.fat, previous: P.fat }, ped: { current: N.ped, previous: P.ped },
            tkt: { current: N.tkt, previous: P.tkt }, des: { current: N.des, previous: P.des },
            fatmed: { current: N.fatmed, previous: P.fatmed }, roi: { current: N.roi, previous: P.roi },
            desperc: { current: N.desperc, previous: P.desperc }, canc_val: { current: N.canc_val, previous: P.canc_val },
            fre: { current: N.fre, previous: P.fre }, fremed: { current: N.fremed, previous: P.fremed },
            canc_ped: { current: N.canc_ped, previous: P.canc_ped },
        };
        Object.keys(allKpiValues).forEach(key => {
            const kpi = allKpiValues[key];
            const valEl = $(`k_${key}`), prevEl = $(`p_${key}`), deltaEl = $(`d_${key}`);
            if (valEl) valEl.textContent = formatValueBy(KPI_META[key].fmt, kpi.current);
            if (prevEl) prevEl.textContent = formatValueBy(KPI_META[key].fmt, kpi.previous);
            if (deltaEl) deltaBadge(deltaEl, kpi.current, kpi.previous);
        });
    }

    const KPI_META = { fat: {label:'Faturamento', fmt:'money'}, ped: {label:'Pedidos', fmt:'count'}, tkt: {label:'Ticket Médio', fmt:'money'}, des: {label:'Incentivos', fmt:'money'}, desperc: {label:'% de incentivos', fmt:'percent'}, fre: {label:'Frete', fmt:'money'}, fremed: {label:'Frete Médio', fmt:'money'}, fatmed: {label:'Faturamento Médio', fmt:'money'}, canc_ped: {label:'Pedidos cancelados', fmt:'count'}, canc_val: {label:'Valor de cancelados', fmt:'money'}, roi: {label:'ROI', fmt:'percent'}, };
    let chartModeGlobal = 'total';

    function getChartValue(agg, kpi, mode) {
        if (!agg) return 0;
        const totalValue = () => {
            switch(kpi) {
                case 'fat': return agg.fat; case 'ped': return agg.pedidos; case 'des': return agg.des; case 'fre': return agg.fre;
                case 'canc_val': return agg.canc_val; case 'canc_ped': return agg.canc_ped;
                case 'tkt': return agg.fat / (agg.pedidos || 1);
                case 'desperc': return agg.des / (agg.fat || 1);
                case 'roi': return (agg.fat - agg.des) / (agg.des || 1);
                case 'fremed': return agg.fre / (agg.pedidos || 1);
                case 'fatmed': return agg.fat / (agg.days || 1);
                default: return 0;
            }
        };
        const mediaValue = () => {
            const val = totalValue();
            if (['tkt', 'desperc', 'roi', 'fremed', 'fatmed'].includes(kpi)) return val;
            return val / (agg.days || 1);
        };
        return mode === 'media' ? mediaValue() : totalValue();
    }
    
    function aggregateData(data, groupBy) {
        const aggregator = new Map();
        for(const r of data) {
            let key;
            if (groupBy === 'month') key = r.dia.substring(0, 7);
            else if (groupBy === 'dow') key = new Date(r.dia + 'T12:00:00').getDay();
            else if (groupBy === 'hour') key = r.hora ? new Date('1970-01-01T' + r.hora).getHours() : -1;
            else if (groupBy === 'turno') key = r.turno;
            else key = r[groupBy];

            if (key === -1 || key === null || key === undefined) continue;

            if (!aggregator.has(key)) aggregator.set(key, { fat: 0, pedidos: 0, des: 0, fre: 0, canc_val: 0, canc_ped: 0, days: new Set() });
            const current = aggregator.get(key);
            current.fat += r.fat; current.pedidos += r.pedidos; current.des += r.des; current.fre += r.fre;
            if(r.cancelado === 'Sim') { current.canc_val += r.fat; current.canc_ped += r.pedidos; }
            current.days.add(r.dia);
        }
        aggregator.forEach(v => v.days = v.days.size);
        return aggregator;
    }

    async function updateCharts(de, ate, dePrev, atePrev, analiticos) {
        try {
            const [nowData, prevData] = await Promise.all([fetchData(de, ate, analiticos), fetchData(dePrev, atePrev, analiticos)]);
            
            // DOW
            const dowNow = aggregateData(nowData, 'dow'), dowPrev = aggregateData(prevData, 'dow');
            const dowLabels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
            const dowNArr = dowLabels.map((_,i) => getChartValue(dowNow.get(i), selectedKPI, chartModeGlobal));
            const dowPArr = dowLabels.map((_,i) => getChartValue(dowPrev.get(i), selectedKPI, chartModeGlobal));
            ensureChart('ch_dow', dowLabels, dowNArr, dowPArr, '', KPI_META[selectedKPI].fmt);

            // HOUR
            const hourNow = aggregateData(nowData, 'hour'), hourPrev = aggregateData(prevData, 'hour');
            let minHour=24, maxHour=-1;
            for (let i=0; i<24; i++) { if (hourNow.has(i) || hourPrev.has(i)) { minHour = Math.min(minHour, i); maxHour = Math.max(maxHour, i); } }
            if (minHour > maxHour) { ensureChart('ch_hour', [], [], []); }
            else {
                const range = Array.from({length: maxHour-minHour+1}, (_,i) => i+minHour);
                const hourLabels = range.map(h => String(h).padStart(2,'0')+'h');
                const hourNArr = range.map(h => getChartValue(hourNow.get(h), selectedKPI, chartModeGlobal));
                const hourPArr = range.map(h => getChartValue(hourPrev.get(h), selectedKPI, chartModeGlobal));
                ensureChart('ch_hour', hourLabels, hourNArr, hourPArr, '', KPI_META[selectedKPI].fmt);
            }

            // TURNO
            const turnoNow = aggregateData(nowData, 'turno'), turnoPrev = aggregateData(prevData, 'turno');
            const turnoLabels = ['Dia', 'Noite'];
            const turnoNArr = turnoLabels.map(l => getChartValue(turnoNow.get(l), selectedKPI, chartModeGlobal));
            const turnoPArr = turnoLabels.map(l => getChartValue(turnoPrev.get(l), selectedKPI, chartModeGlobal));
            ensureChart('ch_turno', turnoLabels, turnoNArr, turnoPArr, '', KPI_META[selectedKPI].fmt);

        } catch(e) { console.error("Erro ao atualizar gráficos", e); }
    }

    async function updateMonth12x12(analiticos) {
        try {
            const end = lastDay || DateHelpers.iso(new Date());
            const endMonthStart = DateHelpers.monthStartISO(end);
            const last12Start = DateHelpers.addMonthsISO(endMonthStart, -11);
            const prev12Start = DateHelpers.addMonthsISO(endMonthStart, -23);
            
            const [nowData, prevData] = await Promise.all([
                fetchData(last12Start, DateHelpers.monthEndISO(end), analiticos),
                fetchData(prev12Start, DateHelpers.monthEndISO(DateHelpers.addMonthsISO(endMonthStart, -12)), analiticos)
            ]);
            
            const monthNow = aggregateData(nowData, 'month');
            const monthPrev = aggregateData(prevData, 'month');

            const labels = [], nowArr = [], prevArr = [];
            let cur = last12Start;
            for(let i=0; i<12; i++) {
                labels.push(DateHelpers.formatYM(cur));
                const ym = cur.substring(0, 7);
                const prevYm = DateHelpers.addMonthsISO(cur, -12).substring(0, 7);
                nowArr.push(getChartValue(monthNow.get(ym), selectedKPI, chartModeGlobal));
                prevArr.push(getChartValue(monthPrev.get(prevYm), selectedKPI, chartModeGlobal));
                cur = DateHelpers.addMonthsISO(cur, 1);
            }
            ensureChart('ch_month', labels, nowArr, prevArr, '', KPI_META[selectedKPI].fmt);
        } catch (e) { console.error("Erro ao atualizar gráfico mensal", e); }
    }
    
    function ensureChart(canvasId, labels, nowArr, prevArr, tooltipExtra='', fmt='money'){
      const canvas=$(canvasId); if(!canvas) return;
      if(canvas.__chart){ try{canvas.__chart.destroy();}catch(e){} canvas.__chart=null; }
      const ctx=canvas.getContext('2d');
      canvas.__chart=new Chart(ctx,{ type:'bar', data:{ labels, datasets:[ {label:'Atual', data:nowArr, backgroundColor:gradNow(ctx)}, {label:'Anterior', data:prevArr, backgroundColor:gradPrev(ctx)} ]}, options:{ responsive:true, maintainAspectRatio:false, animation:false, scales:{ x:{grid:{display:false}}, y:{beginAtZero:true, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{callback:(v)=> v.toLocaleString('pt-BR', {notation: 'compact'}) }}}, plugins:{ legend:{position:'top'}, tooltip:{mode:'index',intersect:false,callbacks:{ label:(ctx)=>`${ctx.dataset.label}: ${formatValueBy(fmt, ctx.parsed.y||0)}` }}} } });
    }
    
    function updateChartTitles(){
      const m=KPI_META[selectedKPI]||KPI_META.fat;
      const mode = chartModeGlobal ==='media' ? ' (média)' : '';
      $('title_month').textContent = `${m.label}${mode} por mês — últimos 12M vs. 12M anteriores`;
      $('title_dow').textContent   = `${m.label}${mode} por dia da semana`;
      $('title_hour').textContent  = `${m.label}${mode} por hora`;
      $('title_turno').textContent = `${m.label}${mode} por turno`;
      $('title_top6').textContent  = `Participação por loja — Top 6 (${m.label}${mode})`;
    }
    
    /* ===================== LOOP PRINCIPAL E INICIALIZAÇÃO ===================== */
    async function applyAll(details){
      try{
        setStatus('Consultando…');
        const {de, ate, analiticos} = details;
        const {dePrev, atePrev} = DateHelpers.computePrevRangeISO(de,ate);
        
        await Promise.all([
          updateKPIs(de, ate, dePrev, atePrev, { ...analiticos, unidade: [], loja: [] }), // KPIs gerais
          updateMonth12x12(analiticos),
          updateCharts(de, ate, dePrev, atePrev, analiticos)
          // Outras funções como projections, insights, top6 podem ser adicionadas aqui se necessário
        ]);
        
        setStatus('OK','ok');
      }catch(e){
        console.error('Erro em applyAll:', e);
        setStatus('Erro: '+(e.message||e),'err');
      }
    }

    function fxDispatchApply(){
      const payload = { start: $('fxDuStart').value, end: $('fxDuEnd').value,
        analiticos: { unidade: ms.unids.get(), loja: ms.lojas.get(), turno: ms.turnos.get(), canal: ms.canais.get(), pagamento: ms.pags.get(), cancelado: fxCanceled.value }
      };
      document.dispatchEvent(new CustomEvent('filters:apply', { detail: payload }));
    }
    
    (async function init(){
      try{
        setStatus('Carregando…');
        document.querySelectorAll('.kpi[data-kpi]').forEach(card=>{
            card.addEventListener('click', ()=>{ selectedKPI = card.dataset.kpi; document.querySelectorAll('.kpi[data-kpi]').forEach(k=>k.classList.toggle('active', k===card)); fxDispatchApply(); });
        });
        document.getElementById('segGlobal').addEventListener('click', (e) => {
            const btn=e.target.closest('button'); if(!btn) return;
            chartModeGlobal = btn.dataset.mode;
            document.getElementById('segGlobal').querySelectorAll('button').forEach(b=> b.classList.toggle('active', b===btn));
            fxDispatchApply();
        });
        
        const dr_min = await supa.from(DATA_SOURCE).select('dia').order('dia', { ascending: true }).limit(1);
        const dr_max = await supa.from(DATA_SOURCE).select('dia').order('dia', { ascending: false }).limit(1);
        if (dr_min.data?.length) firstDay = dr_min.data[0].dia;
        if (dr_max.data?.length) lastDay = dr_max.data[0].dia;
        
        const fx = { $start: $('fxDuStart'), $end: $('fxDuEnd') };
        const fxSetRange = (start,end) => { fx.$start.value = DateHelpers.iso(start); fx.$end.value = DateHelpers.iso(end) };
        const fxLastNDays = n => { const base = lastDay ? new Date(lastDay+'T12:00:00') : new Date(); const end = new Date(base); const start = new Date(base); start.setDate(base.getDate()-(n-1)); fxSetRange(start,end); };
        fxLastNDays(30);

        document.addEventListener('filters:apply', (e) => { if(e.detail) { updateChartTitles(); applyAll(e.detail); } });
        fxDispatchApply();

      }catch(e){
        console.error('Erro na inicialização:', e);
        setStatus('Erro ao iniciar: '+(e.message||e),'err');
      }
    })();
});
