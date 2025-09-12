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

    const DEST_INSERT_TABLE= 'vendas_xlsx';
    const REFRESH_RPC     = 'refresh_sales_materialized';
    
    // ATENÇÃO: VERIFIQUE SE ESTAS CREDENCIAIS ESTÃO CORRETAS E SE A URL COMEÇA COM HTTPS://
    const SUPABASE_URL  = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";
    
    // CORREÇÃO: Adicionada verificação de segurança para a URL
    if (!SUPABASE_URL || !SUPABASE_URL.startsWith('http')) {
        console.error("ERRO CRÍTICO: SUPABASE_URL inválida ou não configurada em estoque_dash_vendas_app.js!");
        alert("Erro de Configuração: A URL do Supabase não é válida.");
        return; 
    }

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    
    /* ===================== CHART.JS — tema vinho ===================== */
    // ... (Configurações do Chart.js permanecem iguais) ...

    /* ===================== HELPERS (BLOCOS COMPLETOS E CORRIGIDOS) ===================== */
    const $ = id => document.getElementById(id);
    // ... (Funções Helper permanecem iguais) ...
    
    /* ===================== MULTISELECT ===================== */
    // ... (Função MultiSelect permanece igual) ...
    
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

    // CORREÇÃO: A linha abaixo foi removida. O acesso ao elemento 'fxCanceled' agora é feito de forma segura dentro da função applyAll.
    // const fxCanceled = $('fxCanceled'); 
    
    /* ===================== LÓGICA DE DADOS (KPIs, Gráficos, etc.) ===================== */
    // ... (Funções de Lógica de Dados permanecem iguais) ...

    /* ===================== LOOP PRINCIPAL (applyAll) ===================== */
    // ESTA FUNÇÃO CONTÉM A CORREÇÃO PARA O ERRO DE NULL (Linha 1125 original)
    async function applyAll(details){
      const t0=performance.now();
      setStatus('Atualizando dados...');
      
      try{
        const de=details.start, ate=details.end;
        if(!de || !ate || new Date(de)>new Date(ate)){ setStatus('Período inválido','err'); return; }
        
        const {dePrev, atePrev} = DateHelpers.computePrevRangeISO(de, ate);

        // --- CORREÇÃO: Acesso seguro ao filtro de cancelados ---
        // Tentamos encontrar o elemento. Se não existir (null), usamos 'ambos' como padrão.
        const fxCanceledElement = $('fxCanceled');
        const canceladoValue = fxCanceledElement ? fxCanceledElement.value : 'ambos';
        // ------------------------------------------------------

        const analiticos = {
          unidade:   ms.unids.get(),
          loja:      ms.lojas.get(),
          turno:     ms.turnos.get(),
          canal:     ms.canais.get(),
          pagamento: ms.pags.get(),
          cancelado: canceladoValue, // Usando o valor seguro
        };
        
        updateChartTitles();

        // Define quais funções de atualização chamar com base na aba ativa
        const activeTab = document.querySelector('.tab[style*="display:block"], .tab.active');
        const activeTabId = activeTab ? activeTab.id : 'tab-vendas';

        const kpiPromise = updateKPIs(de, ate, dePrev, atePrev, analiticos).then(renderVendasKPIs);
        let chartsPromise = Promise.resolve();
        let monthPromise = Promise.resolve();
        let top6Promise = Promise.resolve();
        let diagUnitKpisPromise = Promise.resolve();
        let diagProjectionsPromise = Promise.resolve();
        let diagChartsPromise = Promise.resolve();
        let insightsPromise = Promise.resolve();

        if (activeTabId === 'tab-vendas' || activeTabId === 'tab-analitico') {
            chartsPromise = updateCharts(de, ate, dePrev, atePrev, analiticos);
            monthPromise = updateMonth12x12(analiticos);
        }

        if (activeTabId === 'tab-analitico') {
            top6Promise = updateTop6(de, ate, analiticos);
        }

        if (activeTabId === 'tab-diagnostico') {
            const kpiKey = $('kpi-select').value;
            diagUnitKpisPromise = getAndRenderUnitKPIs(kpiKey, de, ate, dePrev, atePrev, analiticos);
            diagProjectionsPromise = updateProjections(de, ate, dePrev, atePrev, analiticos);
            diagChartsPromise = updateDiagnosticCharts(de, ate, analiticos);
            insightsPromise = updateInsights(de, ate, analiticos, kpiKey);
        }

        // Executa todas as atualizações em paralelo
        await Promise.all([
            kpiPromise, chartsPromise, monthPromise, top6Promise, 
            diagUnitKpisPromise, diagProjectionsPromise, diagChartsPromise, insightsPromise
        ]);
        
        matchPanelHeights(); // Ajusta a altura dos painéis após o carregamento
        const dur = ((performance.now()-t0)/1000).toFixed(2);
        setStatus(`Dados atualizados (${dur}s)`, 'ok');

      }catch(e){
        console.error("Erro no applyAll:", e);
        setStatus('Falha na atualização dos dados','err');
      }
    }

    /* ===================== INICIALIZAÇÃO E CONTROLES DA UI ===================== */
    // ... (Restante do arquivo permanece igual, incluindo as funções de UI, Upload e Init) ...

    init(); // Dispara a inicialização
});
