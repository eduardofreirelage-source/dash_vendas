document.addEventListener('DOMContentLoaded', () => {
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

    // >>> INTERVENÇÃO ELT: Alteração do destino para a tabela de Staging. <<<
    // DE: 'vendas_xlsx'
    const DEST_INSERT_TABLE= 'stage_vendas_raw'; 
    const REFRESH_RPC     = 'refresh_sales_materialized';
    
    const SUPABASE_URL  = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
    // ALERTA DE SEGURANÇA CRÍTICO: Chave exposta. Rotacionar imediatamente no Supabase.
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";
    
    // Validação de Dependências (Princípio da Robustez Absoluta)
    if (!window.supabase || typeof Chart === 'undefined' || typeof Papa === 'undefined') {
        console.error("Dependências externas (Supabase, Chart.js ou PapaParse) não carregadas.");
        alert("Erro crítico: Bibliotecas necessárias não foram carregadas.");
        return;
    }

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    
    /* ===================== CHART.JS — tema vinho (Conforme original) ===================== */
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
    // Função de status aprimorada com logging no console para Observabilidade
    const setStatus=(t,k)=>{ const el=$('status'); if(el) {el.textContent=t; el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085');} console.log(`[Status] [${k || 'info'}] ${t}`); };
    const setDiag=(msg)=>{ const el=$('diag'); if(el) el.textContent = msg || ''; };
    const info=(msg)=>{ const el=$('uploadInfo'); if(el) el.textContent = msg || ''; };
    const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const num =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
    const pctf=v=>(v==null||!isFinite(+v))?'0,0%':((+v)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
    const rmAcc = (s)=> String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const normHeader = (s)=> rmAcc(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    
    // Função essencial para limpeza robusta de dados do CSV (inclui caracteres unicode de espaço)
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
    // Função completada (estava truncada no input original)
    const formatValueBy = (fmt,v) => {
      if(fmt==='count') return num(v);
      if(fmt==='percent') return pctf(v);
      return money(v);
    };

    // Helpers de UI (Reconstruídos)
    const upSVG = () => '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 4l5 6h-3v6H8v-6H5l5-6z"/></svg>';
    const downSVG = () => '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 16l-5-6h3V4h4v6h3l-5 6z"/></svg>';
    const deltaBadge = (el,curr,prev) => {
      if(!el) return;
      // Tratamento robusto para valores nulos, zero ou infinitos
      if(prev == null || !isFinite(prev) || +prev === 0 || curr == null || !isFinite(curr)){ 
          el.textContent='—'; el.className='delta flat'; return; 
      }
      const delta = (curr-prev)/prev;
      const p = delta*100;
      el.innerHTML=(p>=0? upSVG():downSVG())+' '+Math.abs(p).toFixed(1)+'%';
      el.className='delta '+(p>=0?'up':'down');
    };

    // DateHelpers (Reconstruído - Essencial para filtros e comparações)
    const DateHelpers = {
      // Usar meio-dia (T12:00:00) ao manipular datas ISO para evitar erros de fuso horário
      iso: (d) => d.toISOString().slice(0, 10),
      monthStartISO: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setDate(1);
          return d.toISOString().slice(0, 10);
      },
      formatYM: (isoStr) => {
          if (!isoStr) return 'N/A';
          try {
              const d = new Date(isoStr + 'T12:00:00');
              const n = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
              return `${n[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
          } catch (e) { return 'Erro'; }
      },
      // Lógica simplificada para cálculo do período anterior (baseado na duração em dias)
      computePrevRangeISO: function(deISO, ateISO) {
          if(!deISO || !ateISO) return {dePrev:null, atePrev:null};
          const d1 = new Date(deISO + 'T12:00:00');
          const d2 = new Date(ateISO + 'T12:00:00');
          
          const MS_IN_A_DAY = 86400000; // (1000*60*60*24)
          // Duração inclui o último dia
          const durationMs = d2.getTime() - d1.getTime() + MS_IN_A_DAY; 
          
          const atePrevDate = new Date(d1.getTime() - MS_IN_A_DAY);
          const dePrevDate = new Date(d1.getTime() - durationMs);

          return { dePrev: this.iso(dePrevDate), atePrev: this.iso(atePrevDate) };
      }
    };

    /* ===================== FUNÇÃO DE MAPEAMENTO ELT (Posicional) ===================== */
    // >>> NOVO CÓDIGO ELT: Resolve o problema das colunas duplicadas no CSV <<<
    /**
     * Transforma uma linha bruta do CSV (array de valores) no objeto esperado pela tabela stage_vendas_raw.
     * Utiliza mapeamento posicional fixo. (Princípio da Verbosisidade Explícita)
     */
    function mapCsvRowToStagingSchema(rawRowValues) {
        // Validação: Esperamos 26 colunas conforme o CSV fornecido
        if (!rawRowValues || rawRowValues.length < 26) {
            console.warn("[ELT Mapping] Linha CSV incompleta (< 26 colunas). Pulando.", rawRowValues);
            return null;
        }

        // Mapeamento Explícito e Posicional.
        const stagingRecord = {
            "Unidade": cleanSpaces(rawRowValues[0]),
            "Pedido": cleanSpaces(rawRowValues[1]),
            "Codigo": cleanSpaces(rawRowValues[2]),
            "loja": cleanSpaces(rawRowValues[3]), // Nome exato conforme schema SQL
            "Tipo": cleanSpaces(rawRowValues[4]),
            "Turno": cleanSpaces(rawRowValues[5]),
            "Canal": cleanSpaces(rawRowValues[6]),
            "Número do pedido no parceiro": cleanSpaces(rawRowValues[7]),
            "Data": cleanSpaces(rawRowValues[8]), // Formato 'DD/MM/YYYY HH:MM' (Convertido no SQL)
            "Consumidor": cleanSpaces(rawRowValues[9]),
            "Cupom": cleanSpaces(rawRowValues[10]),
            "Pagamento": cleanSpaces(rawRowValues[11]),
            "Cancelado": cleanSpaces(rawRowValues[12]),
            "Motivo do cancelamento": cleanSpaces(rawRowValues[13]),
            "Itens": cleanSpaces(rawRowValues[14]),
            "Entrega": cleanSpaces(rawRowValues[15]),

            // RESOLUÇÃO DAS DUPLICATAS "Entregador" (Colunas 16 e 17 no CSV)
            "Entregador_Valor_A": cleanSpaces(rawRowValues[16]), 
            "Entregador_Nome_B": cleanSpaces(rawRowValues[17]),

            "Bairro": cleanSpaces(rawRowValues[18]),
            "CEP": cleanSpaces(rawRowValues[19]),
            "Acrescimo": cleanSpaces(rawRowValues[20]),
            "Motivo de acréscimo": cleanSpaces(rawRowValues[21]),
            "Desconto": cleanSpaces(rawRowValues[22]),
            "Motivo do desconto": cleanSpaces(rawRowValues[23]),
            "Total": cleanSpaces(rawRowValues[24]),
            "taxa de serviço": cleanSpaces(rawRowValues[25])
        };
        
        // Filtro básico de validade
        if (!stagingRecord["Data"] || !stagingRecord["Total"]) {
            return null;
        }

        return stagingRecord;
    }

    /* ===================== ESTADO DA APLICAÇÃO (Reconstruído) ===================== */
    const State = {
        activeTab: 'vendas',
        activeKpi: 'fat', // 'fat', 'ped', 'tkt'
        filters: { de: null, ate: null, dePrev: null, atePrev: null },
        data: {},
        charts: {},
        isProcessing: false // Flag unificada para Upload e Fetching
    };

    /* ===================== LÓGICA DE UPLOAD E ELT (Fluxo Principal) ===================== */
    // >>> NOVO CÓDIGO ELT: Substitui a lógica de upload antiga <<<

    /**
     * Executa o pipeline ELT completo: Mapeamento, Limpeza, Carga e Transformação.
     */
    async function handleEltPipeline(parsedData) {
        State.isProcessing = true;
        const uploadButton = $('uploadTriggerButton');
        if (uploadButton) uploadButton.disabled = true;

        setStatus('Iniciando pipeline ELT...', 'info');

        // 1. Mapeamento (E)
        if (!parsedData || parsedData.length <= 1) {
            setStatus('Arquivo vazio ou sem dados.', 'err');
            resetProcessingState(uploadButton);
            return;
        }

        // Remove a linha de cabeçalho original do CSV
        const rawData = parsedData.slice(1); 
        const stagingData = rawData
            .map(row => mapCsvRowToStagingSchema(row))
            .filter(row => row !== null);

        if (stagingData.length === 0) {
            setStatus('Nenhum dado válido após mapeamento.', 'err');
            resetProcessingState(uploadButton);
            return;
        }

        try {
            // 2. Limpeza do Staging (Estratégia: Replace)
            setStatus('Limpando Staging (Removendo dados anteriores)...', 'info');
            // delete().neq('_id', 0) é usado como proxy para TRUNCATE via API PostgREST.
            const { error: deleteError } = await supa.from(DEST_INSERT_TABLE).delete().neq('_id', 0);

            if (deleteError) {
                console.error("[ELT] Erro ao limpar Staging:", deleteError);
                setStatus('Falha ao limpar Staging. Abortado.', 'err');
                // Se falhar a limpeza, abortamos para não misturar dados antigos e novos.
                return; 
            }

            // 3. Carga (L - Load)
            setStatus(`Carregando ${stagingData.length} registros...`, 'info');
            // Nota de Arquitetura: Para arquivos > 5000 linhas, implementar batching (chunking) aqui.
            const { error: insertError } = await supa.from(DEST_INSERT_TABLE).insert(stagingData);

            if (insertError) {
                setStatus('Falha na inserção (SQL Staging)', 'err');
                console.error("[ELT] Erro Supabase Insert:", insertError);
                return;
            }

            // 4. Transformação (T - Transform)
            setStatus('Acionando Transformação (Refresh MV)...', 'info');
            const { data: refreshData, error: refreshError } = await supa.rpc(REFRESH_RPC);
            
            // Validação robusta do retorno RPC (Princípio da Robustez Absoluta)
            if (refreshError || !refreshData || refreshData.status !== 'success') {
                setStatus('Falha no Reprocessamento (ELT RPC)', 'err');
                console.error("[ELT] Erro RPC Refresh:", refreshError || (refreshData && refreshData.message));
                return;
            }

            setStatus(`Sucesso! Importados: ${stagingData.length}.`, 'ok');
            
            // 5. Atualização do Dashboard
            initializeFilters();
            fetchData(); // fetchData() chamará resetProcessingState no seu bloco finally
        
        } catch (e) {
            setStatus('Erro inesperado no fluxo ELT', 'err');
            console.error('[ELT] Exceção não capturada:', e);
        } finally {
            // Se fetchData não foi chamado devido a um erro anterior, reseta o estado aqui.
            if (State.isProcessing) {
                resetProcessingState(uploadButton);
            }
        }
    }

    function resetProcessingState(uploadButton) {
        State.isProcessing = false;
        if (uploadButton) uploadButton.disabled = false;
    }

    /**
     * Manipula o evento de seleção de arquivo e inicia o parsing via PapaParse.
     */
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        setStatus('Iniciando parsing do arquivo (PapaParse)...', 'info');

        Papa.parse(file, {
            header: false, // CRÍTICO: false para usar mapeamento posicional robusto
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors && results.errors.length > 0) {
                    console.warn("PapaParse Errors:", results.errors);
                    // Continuamos se houver dados válidos (Resiliência)
                }
                handleEltPipeline(results.data);
            },
            error: (error) => {
                setStatus('Falha crítica no Parsing (PapaParse).', 'err');
                console.error("PapaParse Fatal Error:", error);
            }
        });
        
        event.target.value = ''; // Limpa o input
    }


    /* ===================== LÓGICA DE NEGÓCIO E FETCHING (Reconstruído) ===================== */

    /**
     * Inicializa os filtros de data (Padrão: Mês Atual).
     */
    function initializeFilters() {
        const today = new Date();
        State.filters.ate = DateHelpers.iso(today);
        State.filters.de = DateHelpers.monthStartISO(State.filters.ate);
    }

    /**
     * Busca todos os dados necessários para o dashboard usando as funções RPC.
     */
    async function fetchData() {
        if (State.isProcessing) return;
        State.isProcessing = true;

        // Calcula o período anterior
        const prevRange = DateHelpers.computePrevRangeISO(State.filters.de, State.filters.ate);
        State.filters.dePrev = prevRange.dePrev;
        State.filters.atePrev = prevRange.atePrev;

        setStatus('Buscando dados (RPC)...', 'info');

        const rpcParams = {
            de_iso: State.filters.de,
            ate_iso: State.filters.ate,
            de_prev_iso: State.filters.dePrev,
            ate_prev_iso: State.filters.atePrev
        };

        try {
            // Executa as chamadas RPC em paralelo para otimização
            const [kpiResult, monthResult, dowResult, hourResult, turnoResult] = await Promise.all([
                supa.rpc(RPC_KPI_FUNC, rpcParams),
                supa.rpc(RPC_CHART_MONTH_FUNC, rpcParams),
                supa.rpc(RPC_CHART_DOW_FUNC, rpcParams),
                supa.rpc(RPC_CHART_HOUR_FUNC, rpcParams),
                supa.rpc(RPC_CHART_TURNO_FUNC, rpcParams)
            ]);

            // Validação de erros centralizada
            const errors = [kpiResult.error, monthResult.error, dowResult.error, hourResult.error, turnoResult.error].filter(Boolean);
            if (errors.length > 0) {
                setStatus('Falha parcial na busca de dados.', 'err');
                console.error("RPC Errors:", errors);
            }

            // Atualiza o estado
            State.data.kpis = kpiResult.data;
            State.data.chartMonth = monthResult.data;
            State.data.chartDow = dowResult.data;
            State.data.chartHour = hourResult.data;
            State.data.chartTurno = turnoResult.data;

            updateUI();
            setStatus('Dados atualizados.', 'ok');

        } catch (error) {
            setStatus('Falha crítica na comunicação (Network/Promise).', 'err');
            console.error("Fetch Data Exception:", error);
        } finally {
            resetProcessingState($('uploadTriggerButton'));
        }
    }

    /* ===================== RENDERIZAÇÃO E UI (Reconstruído) ===================== */

    function updateUI() {
        if (State.activeTab === 'vendas') {
            updateKpis();
            renderCharts();
        }
    }

    function updateKpis() {
        const data = State.data.kpis;
        if (!data || !data.curr || !data.prev) return;

        const curr = data.curr;
        const prev = data.prev;

        // Faturamento e Pedidos
        $('k_fat').textContent = money(curr.fat);
        $('p_fat').textContent = money(prev.fat);
        deltaBadge($('d_fat'), curr.fat, prev.fat);

        $('k_ped').textContent = num(curr.ped);
        $('p_ped').textContent = num(prev.ped);
        deltaBadge($('d_ped'), curr.ped, prev.ped);

        // Ticket Médio (Calculado no frontend)
        const tktCurr = curr.ped > 0 ? curr.fat / curr.ped : 0;
        const tktPrev = prev.ped > 0 ? prev.fat / prev.ped : 0;
        $('k_tkt').textContent = money(tktCurr);
        $('p_tkt').textContent = money(tktPrev);
        deltaBadge($('d_tkt'), tktCurr, tktPrev);
    }

    function getMetricAndFormat() {
        let metric = State.activeKpi;
        // Ticket médio usa faturamento nos gráficos agregados (não se pode somar médias)
        if (metric === 'tkt') metric = 'fat'; 
        const format = metric === 'fat' ? 'currency' : 'count';
        return { metric, format };
    }

    function standardChartOptions(format) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => formatTickBy(format, value) }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label || context.label}: ${formatValueBy(format, context.raw)}`
                    }
                }
            }
        };
    }

    // Preenche dados sequenciais (Dias da semana 0-6, Horas 0-23)
    const fillSequentialData = (dataset, length, metric) => {
        const filled = [];
        if (!dataset) return Array(length).fill(0);
        for (let i = 0; i < length; i++) {
            // A API retorna 'x' como o índice (DOW ou Hora)
            const found = dataset.find(item => parseInt(item.x) === i);
            filled.push(found ? found[metric] : 0);
        }
        return filled;
    };

    function renderCharts() {
        // Destrói instâncias anteriores para garantir atualização correta
        Object.values(State.charts).forEach(chart => chart && chart.destroy());
        State.charts = {};

        renderMonthChart();
        renderDOWChart();
        renderHourChart();
        renderTurnoChart();
    }

    function renderMonthChart() {
        const data = State.data.chartMonth;
        if (!data || !data.current) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_month');
        if (!canvas) return;

        const labels = data.current.map(item => DateHelpers.formatYM(item.x));
        const currentData = data.current.map(item => item[metric]);
        const previousData = data.previous ? data.previous.map(item => item[metric]) : []; 

        State.charts.month = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Período Anterior',
                        data: previousData.slice(0, labels.length), // Garante alinhamento básico
                        backgroundColor: gradPrev(canvas.getContext('2d')),
                        order: 2
                    },
                    {
                        label: 'Período Atual',
                        data: currentData,
                        backgroundColor: gradNow(canvas.getContext('2d')),
                        order: 1
                    }
                ]
            },
            options: standardChartOptions(format)
        });
    }

    function renderDOWChart() {
        const data = State.data.chartDow;
        if (!data) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_dow');
        const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        State.charts.dow = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: DOW_LABELS,
                datasets: [{
                    label: 'Volume',
                    data: fillSequentialData(data.current, 7, metric),
                    backgroundColor: gradNow(canvas.getContext('2d')),
                }]
            },
            options: standardChartOptions(format)
        });
    }

    function renderHourChart() {
        const data = State.data.chartHour;
        if (!data) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_hour');
        const HOUR_LABELS = Array.from({length: 24}, (_, i) => `${i}h`);

        State.charts.hour = new Chart(canvas, {
            type: 'line', // Linha para padrão horário
            data: {
                labels: HOUR_LABELS,
                datasets: [{
                    label: 'Volume',
                    data: fillSequentialData(data.current, 24, metric),
                    borderColor: '#7b1e3a',
                    backgroundColor: gradNow(canvas.getContext('2d')),
                    tension: 0.3,
                    fill: true
                }]
            },
            options: standardChartOptions(format)
        });
    }

    function renderTurnoChart() {
        const data = State.data.chartTurno;
        if (!data || !data.current || data.current.length === 0) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_turno');

        State.charts.turno = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.current.map(item => item.x),
                datasets: [{
                    data: data.current.map(item => item[metric]),
                    backgroundColor: ['#7b1e3a', '#a73a5a', '#d4557a', '#9ca3af'],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${formatValueBy(format, context.raw)}`
                        }
                    }
                }
            }
        });
    }

    /* ===================== EVENT HANDLERS E INICIALIZAÇÃO ===================== */

    function setupEventListeners() {
        // 1. Tabs Navigation (Conforme original)
        const tabs = document.querySelectorAll('.tabs button');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                State.activeTab = tab.dataset.tab;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
                const activeTabEl = $(`tab-${State.activeTab}`);
                if (activeTabEl) activeTabEl.style.display = 'block';
                if (State.activeTab === 'vendas') {
                    renderCharts(); // Redesenha ao voltar para a aba
                }
            });
        });

        // 2. KPIs (Conforme original)
        const kpis = document.querySelectorAll('.kpi');
        kpis.forEach(kpi => {
            kpi.addEventListener('click', () => {
                State.activeKpi = kpi.dataset.kpi;
                kpis.forEach(k => k.classList.remove('active'));
                kpi.classList.add('active');
                renderCharts(); // Atualiza gráficos com a nova métrica
            });
        });

        // 3. Upload Handler Setup (Integrado ao ELT)
        setupUploadHandler();
    }

    /**
     * Configura o manipulador de upload (Injeta o botão e conecta ao novo fluxo ELT).
     */
    function setupUploadHandler() {
        const uploadBar = document.querySelector('.upload-bar');
        if (!uploadBar) return;

        // Cria o input de arquivo (invisível)
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.csv'; // Aceitar apenas CSV
        fileInput.style.display = 'none';

        // Cria o botão de trigger visível
        const uploadButton = document.createElement('button');
        uploadButton.textContent = 'Importar Dados (CSV)';
        uploadButton.id = 'uploadTriggerButton';
        uploadButton.className = 'btn-upload';
        
        uploadBar.appendChild(uploadButton);
        document.body.appendChild(fileInput); // Anexa o input ao body

        // Conecta os eventos ao novo manipulador ELT
        uploadButton.addEventListener('click', () => {
            if (!State.isProcessing) fileInput.click();
        });
        fileInput.addEventListener('change', handleFileUpload);
    }


    // Inicialização Principal
    function init() {
        setStatus("Inicializando aplicação...", "info");
        setupEventListeners();
        initializeFilters();
        // Busca inicial de dados (caso já existam dados no banco)
        fetchData();
    }

    init();
});
