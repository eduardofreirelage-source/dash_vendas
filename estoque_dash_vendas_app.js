document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // Bloco Único de JavaScript: Lógica Principal, UI, e Inicialização (Arquitetura ELT)
    // Implementação Focada em Robustez e Estabilidade Operacional.
    // ===================================================================================
    
    /* ===================== CONFIG ===================== */
    // Funções RPC (APIs de Reporting)
    const RPC_KPI_FUNC = 'kpi_vendas_unificado';
    const RPC_CHART_MONTH_FUNC = 'chart_vendas_mes_v1';
    const RPC_CHART_DOW_FUNC = 'chart_vendas_dow_v1';
    const RPC_CHART_HOUR_FUNC = 'chart_vendas_hora_v1';
    const RPC_CHART_TURNO_FUNC = 'chart_vendas_turno_v1';
    
    // Configuração do Pipeline ELT
    // Tabela de Staging para ingestão bruta de dados.
    const DEST_INSERT_TABLE= 'stage_vendas_raw'; 
    // Função SQL que executa a transformação (T) e atualiza a Materialized View.
    const REFRESH_RPC     = 'refresh_sales_materialized';
    
    // Configuração do Cliente Supabase
    const SUPABASE_URL  = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
    // ALERTA DE SEGURANÇA CRÍTICO: A chave ANON abaixo está exposta publicamente.
    // Esta chave DEVE SER ROTACIONADA IMEDIATAMENTE no painel do Supabase (Settings > API).
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";
    
    // Validação de Dependências Externas (Princípio da Robustez)
    if (!window.supabase) { console.error("CRÍTICO: Supabase client library not loaded."); return; }
    if (typeof Chart === 'undefined') { console.error("CRÍTICO: Chart.js library not loaded."); return; }
    if (typeof Papa === 'undefined') { console.error("CRÍTICO: PapaParse library not loaded. Upload feature disabled."); return; }

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    
    /* ===================== CHART.JS — Configuração Visual (Tema Vinho) ===================== */
    Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
    Chart.defaults.color = '#334155';
    Chart.defaults.plugins.legend.position = 'top';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,.95)';
    Chart.defaults.datasets.bar.borderRadius = 6;
    Chart.defaults.datasets.bar.maxBarThickness = 42;

    // Gradientes para os gráficos
    function gradNow(ctx){
      const g = ctx.createLinearGradient(0,0,0,240);
      g.addColorStop(0,'rgba(123,30,58,0.95)'); // Cor Vinho (Atual)
      g.addColorStop(1,'rgba(156,53,84,0.55)');
      return g;
    }
    function gradPrev(ctx){
      const g = ctx.createLinearGradient(0,0,0,240);
      g.addColorStop(0,'rgba(148,163,184,0.85)'); // Cor Cinza (Anterior)
      g.addColorStop(1,'rgba(203,213,225,0.45)');
      return g;
    }
    
    /* ===================== HELPERS (Funções Auxiliares) ===================== */
    const $ = id => document.getElementById(id);
    
    // Função de status com logging para observabilidade
    const setStatus=(t,k)=>{ 
        const el=$('status'); 
        if(el) {
            el.textContent=t; 
            el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085');
        } 
        console.log(`[Status] [${k || 'info'}]: ${t}`); 
    };

    // Formatação Numérica
    const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const num =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
    
    // Limpeza de Strings (Essencial para robustez do CSV)
    // Remove espaços unicode não padrão e normaliza espaços múltiplos.
    function cleanSpaces(s){ return String(s||'').replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g,' ').replace(/\s+/g,' ').trim(); }
    
    // Formatação para Ticks dos Gráficos
    const formatCurrencyTick = (value) => {
      const v=Number(value)||0;
      if(Math.abs(v)>=1_000_000) return 'R$ '+(v/1_000_000).toFixed(1).replace('.',',')+' mi';
      if(Math.abs(v)>=1_000)     return 'R$ '+(v/1_000).toFixed(1).replace('.',',')+' mil';
      return 'R$ '+v.toFixed(0);
    };
    const formatTickBy = (fmt,v) => {
      if(fmt==='count') return (Number(v)||0).toLocaleString('pt-BR');
      return formatCurrencyTick(v);
    };
    const formatValueBy = (fmt,v) => {
      if(fmt==='count') return num(v);
      return money(v);
    };

    // Elementos Visuais (Delta Badges)
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

    // DateHelpers (Lógica de manipulação de datas e períodos - Completa e Corrigida)
    const DateHelpers = {
      // Usamos T12:00:00 para mitigar ambiguidades de fuso horário em operações de data pura (ISO).
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
              const m = d.getMonth();
              const y = String(d.getFullYear()).slice(-2);
              const n = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
              return `${n[m]}/${y}`;
          } catch (e) { return 'Erro'; }
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
      // Lógica complexa para cálculo do período anterior comparável (PoP Comparison)
      computePrevRangeISO: function(deISO, ateISO) {
          if(!deISO || !ateISO) return {dePrev:null, atePrev:null};
          const d1 = new Date(deISO + 'T12:00:00');
          const d2 = new Date(ateISO + 'T12:00:00');
          
          // Caso 1: Ano cheio (YoY Comparison)
          if (this.isFullYear(d1, d2)) {
              const p1 = this.shiftYear(d1, -1);
              const p2 = this.shiftYear(d2, -1);
              return { dePrev: this.iso(p1), atePrev: this.iso(p2) };
          }

          // Caso 2: Meses cheios alinhados
          if (this.isFullMonthsAligned(d1, d2)) {
            const atePrevDate = new Date(d1.getTime());
            atePrevDate.setDate(0); // Vai para o último dia do mês anterior ao início atual
            
            const durationMonths = (d2.getFullYear() * 12 + d2.getMonth()) - (d1.getFullYear() * 12 + d1.getMonth());

            const dePrevDate = new Date(atePrevDate.getTime());
            dePrevDate.setDate(1); 
            dePrevDate.setMonth(dePrevDate.getMonth() - durationMonths);

            return { dePrev: this.iso(dePrevDate), atePrev: this.iso(atePrevDate) };
          }

          // Caso 3: Período arbitrário (Comparação por duração exata de dias)
          const MS_IN_A_DAY = 86400000; // (1000*60*60*24)
          const durationMs = d2.getTime() - d1.getTime() + MS_IN_A_DAY; 
          
          const atePrevDate = new Date(d1.getTime() - MS_IN_A_DAY);
          const dePrevDate = new Date(d1.getTime() - durationMs);

          return { dePrev: this.iso(dePrevDate), atePrev: this.iso(dePrevDate) };
      }
    };

    /* ===================== FUNÇÃO DE MAPEAMENTO ELT (Posicional) ===================== */
    /**
     * Transforma uma linha bruta do CSV (array de valores) no objeto esperado pela tabela stage_vendas_raw.
     * Utiliza mapeamento posicional fixo para garantir robustez.
     * (Princípio da Verbosisidade Explícita e Intencional)
     */
    function mapCsvRowToStagingSchema(rawRowValues) {
        // Validação de integridade da linha (esperamos 26 colunas conforme o CSV fornecido)
        if (!rawRowValues || rawRowValues.length < 26) {
            console.warn("[ELT Mapping] Linha CSV incompleta (< 26 colunas) detectada. Pulando.", rawRowValues);
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

            // RESOLUÇÃO CRÍTICA DAS DUPLICATAS "Entregador" (Colunas 16 e 17 no CSV)
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
        
        // Filtro básico de validade: Linhas sem data ou total são inúteis para análise
        if (!stagingRecord["Data"] || !stagingRecord["Total"]) {
            return null;
        }

        return stagingRecord;
    }


    /* ===================== ESTADO DA APLICAÇÃO (State Management) ===================== */
    const State = {
        activeTab: 'vendas',
        activeKpi: 'fat', // Métrica ativa: 'fat', 'ped', 'tkt'
        filters: {
            de: null,
            ate: null,
            dePrev: null,
            atePrev: null
        },
        data: {},
        charts: {}, // Armazena instâncias do Chart.js
        isFetching: false,
        isUploading: false
    };

    /* ===================== LÓGICA DE UPLOAD E ELT (Fluxo Principal) ===================== */

    /**
     * Executa o pipeline ELT completo: Mapeamento, Limpeza, Carga e Transformação.
     * @param {Array<Array<string>>} parsedData - Dados do PapaParse (array de arrays, sem cabeçalho).
     */
    async function handleEltPipeline(parsedData) {
        if (State.isUploading) return;
        State.isUploading = true;
        const uploadButton = $('uploadTriggerButton');
        if (uploadButton) uploadButton.disabled = true;

        setStatus('Iniciando pipeline ELT...', 'info');

        // 1. Extração e Mapeamento (E)
        if (!parsedData || parsedData.length <= 1) {
            setStatus('Arquivo vazio ou apenas com cabeçalho.', 'err');
            State.isUploading = false;
            if (uploadButton) uploadButton.disabled = false;
            return;
        }

        // Remove a linha de cabeçalho original do CSV (pois usamos header: false no parser)
        const rawData = parsedData.slice(1); 

        // Usa o mapeamento posicional robusto
        const stagingData = rawData
            .map(row => mapCsvRowToStagingSchema(row))
            .filter(row => row !== null); // Remove linhas inválidas

        if (stagingData.length === 0) {
            setStatus('Erro: Nenhum dado válido encontrado após mapeamento.', 'err');
            State.isUploading = false;
            if (uploadButton) uploadButton.disabled = false;
            return;
        }

        try {
            // 2. Limpeza do Staging (Estratégia: Replace)
            setStatus('Limpando Staging (Removendo dados anteriores)...', 'info');
            // Usamos delete().neq('_id', 0) como um proxy eficiente para TRUNCATE via API PostgREST.
            const { error: deleteError } = await supa.from(DEST_INSERT_TABLE).delete().neq('_id', 0);

            if (deleteError) {
                console.error("[ELT] Erro ao limpar Staging:", deleteError);
                setStatus('Falha ao limpar Staging. Upload abortado.', 'err');
                return; 
            }

            // 3. Carga (L - Load)
            setStatus(`Carregando ${stagingData.length} registros (Staging)...`, 'info');
            
            // Nota de Arquitetura: Para arquivos > 5000 linhas, implementar inserção em batches (chunking).
            const { error: insertError } = await supa.from(DEST_INSERT_TABLE).insert(stagingData);

            if (insertError) {
                setStatus('Falha crítica na inserção (SQL Staging)', 'err');
                console.error("[ELT] Erro Supabase Insert:", insertError);
                return;
            }

            // 4. Transformação (T - Transform)
            setStatus('Acionando Transformação (Refresh MV)...', 'info');
            const { data: refreshData, error: refreshError } = await supa.rpc(REFRESH_RPC);
            
            // Validação robusta do retorno JSONB (Princípio da Robustez Absoluta)
            if (refreshError || !refreshData || refreshData.status !== 'success') {
                setStatus('Falha no Reprocessamento (ELT RPC)', 'err');
                console.error("[ELT] Erro Supabase RPC Refresh:", refreshError || (refreshData && refreshData.message));
                return;
            }

            setStatus(`Sucesso! Importados: ${stagingData.length}. Status ELT: ${refreshData.status}`, 'ok');
            
            // 5. Atualização do Dashboard
            initializeFilters(); // Reseta os filtros para o padrão com os novos dados
            fetchData(); 
        
        } catch (e) {
            setStatus('Erro inesperado no fluxo ELT', 'err');
            console.error('[ELT] Exceção não capturada:', e);
        } finally {
            State.isUploading = false;
            if (uploadButton) uploadButton.disabled = false;
        }
    }

    /**
     * Manipula o evento de seleção de arquivo e inicia o parsing via PapaParse.
     */
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        setStatus('Iniciando parsing do arquivo (PapaParse)...', 'info');

        Papa.parse(file, {
            header: false, // CRÍTICO: false para usar nosso mapeamento posicional robusto
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors && results.errors.length > 0) {
                    setStatus('Erros encontrados durante o parsing do CSV.', 'warn');
                    console.warn("PapaParse Errors:", results.errors);
                    // Continuamos mesmo com alguns erros de parsing se houver dados válidos (Resiliência).
                }
                // Chama o fluxo ELT principal
                handleEltPipeline(results.data);
            },
            error: (error) => {
                setStatus('Falha crítica no Parsing (PapaParse).', 'err');
                console.error("PapaParse Fatal Error:", error);
            }
        });
        
        // Limpa o input para permitir o upload do mesmo arquivo novamente
        event.target.value = '';
    }


    /* ===================== LÓGICA DE NEGÓCIO E FETCHING ===================== */

    /**
     * Inicializa os filtros de data para o período padrão (Mês Atual).
     */
    function initializeFilters() {
        // Define o padrão como Mês Atual (Month-to-Date) baseado na data de hoje.
        const today = new Date();
        State.filters.ate = DateHelpers.iso(today);
        State.filters.de = DateHelpers.monthStartISO(State.filters.ate);
    }

    /**
     * Busca todos os dados necessários para o dashboard usando as funções RPC.
     */
    async function fetchData() {
        if (State.isFetching) return;
        State.isFetching = true;

        // Calcula o período anterior automaticamente
        const prevRange = DateHelpers.computePrevRangeISO(State.filters.de, State.filters.ate);
        State.filters.dePrev = prevRange.dePrev;
        State.filters.atePrev = prevRange.atePrev;

        setStatus('Buscando dados analytics (RPC)...', 'info');

        // Parâmetros comuns para todas as chamadas RPC
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
                setStatus('Falha parcial na busca de dados (RPC).', 'err');
                console.error("[Fetching] RPC Errors:", errors);
                // Continua com os dados que foram buscados com sucesso (Degradação Graciosa)
            }

            // Atualiza o estado da aplicação
            State.data.kpis = kpiResult.data;
            State.data.chartMonth = monthResult.data;
            State.data.chartDow = dowResult.data;
            State.data.chartHour = hourResult.data;
            State.data.chartTurno = turnoResult.data;

            updateUI();
            setStatus('Dados atualizados.', 'ok');

        } catch (error) {
            // Captura erros de rede ou problemas com o Promise.all
            setStatus('Falha crítica na comunicação (Network/Promise).', 'err');
            console.error("[Fetching] Fetch Data Exception:", error);
        } finally {
            State.isFetching = false;
        }
    }

    /* ===================== RENDERIZAÇÃO E UI ===================== */

    function updateUI() {
        if (State.activeTab === 'vendas') {
            updateKpis();
            renderCharts();
        }
    }

    function updateKpis() {
        const data = State.data.kpis;
        // Validação de dados recebidos
        if (!data || !data.curr || !data.prev) {
            console.warn("[UI] Dados de KPI incompletos ou ausentes.");
            // Limpar KPIs se não houver dados
             ['fat', 'ped', 'tkt'].forEach(kpi => {
                if ($(`k_${kpi}`)) $(`k_${kpi}`).textContent = '—';
                if ($(`p_${kpi}`)) $(`p_${kpi}`).textContent = '—';
                deltaBadge($(`d_${kpi}`), null, null);
            });
            return;
        }

        const curr = data.curr;
        const prev = data.prev;

        // Faturamento
        $('k_fat').textContent = money(curr.fat);
        $('p_fat').textContent = money(prev.fat);
        deltaBadge($('d_fat'), curr.fat, prev.fat);

        // Pedidos
        $('k_ped').textContent = num(curr.ped);
        $('p_ped').textContent = num(prev.ped);
        deltaBadge($('d_ped'), curr.ped, prev.ped);

        // Ticket Médio (Calculado no frontend para garantir consistência)
        const tktCurr = curr.ped > 0 ? curr.fat / curr.ped : 0;
        const tktPrev = prev.ped > 0 ? prev.fat / prev.ped : 0;
        $('k_tkt').textContent = money(tktCurr);
        $('p_tkt').textContent = money(tktPrev);
        deltaBadge($('d_tkt'), tktCurr, tktPrev);
    }

    // Função auxiliar para obter a métrica ativa e o formato correspondente
    function getMetricAndFormat() {
        let metric = State.activeKpi;
        // Ticket médio usa faturamento como base nos gráficos agregados (pois não podemos somar médias)
        if (metric === 'tkt') metric = 'fat'; 
        const format = metric === 'fat' ? 'currency' : 'count';
        return { metric, format };
    }

    // Opções padrão reutilizáveis para gráficos de barras/linhas (Chart.js)
    function standardChartOptions(format) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatTickBy(format, value)
                    }
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

    function renderCharts() {
        // Destrói instâncias anteriores para garantir atualização correta e evitar vazamentos
        Object.values(State.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
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

        // Preparação dos dados: A API RPC retorna dados agregados por mês ('x' = 'YYYY-MM-DD').
        const labels = data.current.map(item => DateHelpers.formatYM(item.x));
        
        const currentData = data.current.map(item => item[metric]);
        const previousData = data.previous ? data.previous.map(item => item[metric]) : []; 

        const options = standardChartOptions(format);

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
            options: options
        });
    }

    // Função auxiliar para preencher dados sequenciais (Dias da semana 0-6, Horas 0-23)
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

    function renderDOWChart() {
        const data = State.data.chartDow;
        if (!data) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_dow');
        if (!canvas) return;

        const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        State.charts.dow = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: DOW_LABELS,
                datasets: [
                    {
                        label: 'Volume Atual',
                        data: fillSequentialData(data.current, 7, metric),
                        backgroundColor: gradNow(canvas.getContext('2d')),
                    }
                ]
            },
            options: standardChartOptions(format)
        });
    }

    function renderHourChart() {
        const data = State.data.chartHour;
        if (!data) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_hour');
        if (!canvas) return;

        const HOUR_LABELS = Array.from({length: 24}, (_, i) => `${i}h`);

        State.charts.hour = new Chart(canvas, {
            type: 'line', // Linha é mais adequada para padrões horários
            data: {
                labels: HOUR_LABELS,
                datasets: [
                    {
                        label: 'Volume Atual',
                        data: fillSequentialData(data.current, 24, metric),
                        borderColor: '#7b1e3a',
                        backgroundColor: gradNow(canvas.getContext('2d')),
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: standardChartOptions(format)
        });
    }

    function renderTurnoChart() {
        const data = State.data.chartTurno;
        if (!data || !data.current || data.current.length === 0) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_turno');
        if (!canvas) return;

        State.charts.turno = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.current.map(item => item.x),
                datasets: [{
                    data: data.current.map(item => item[metric]),
                    // Cores fixas para os turnos
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
        // 1. Tabs Navigation
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
                    // Redesenha os gráficos ao voltar para a aba (Chart.js workaround para layout)
                    renderCharts();
                }
            });
        });

        // 2. KPIs (Seleção da métrica ativa)
        const kpis = document.querySelectorAll('.kpi');
        kpis.forEach(kpi => {
            kpi.addEventListener('click', () => {
                State.activeKpi = kpi.dataset.kpi;
                kpis.forEach(k => k.classList.remove('active'));
                kpi.classList.add('active');
                // Atualiza os gráficos com a nova métrica selecionada (sem refetch)
                renderCharts();
            });
        });

        // 3. Upload Handler Setup
        setupUploadHandler();
    }

    /**
     * Configura o manipulador de upload de arquivos, criando elementos dinamicamente.
     */
    function setupUploadHandler() {
        const uploadBar = document.querySelector('.upload-bar');
        if (!uploadBar) {
            console.error("[Setup] Elemento .upload-bar não encontrado.");
            return;
        }

        // Cria o input de arquivo (invisível)
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileUploadInput';
        fileInput.accept = '.csv'; // Aceitar apenas CSV
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // Cria o botão de trigger visível
        const uploadButton = document.createElement('button');
        uploadButton.textContent = 'Importar Dados (CSV)';
        uploadButton.id = 'uploadTriggerButton';
        uploadButton.className = 'btn-upload';
        uploadBar.appendChild(uploadButton);

        // Conecta os eventos
        uploadButton.addEventListener('click', () => {
            if (!State.isUploading) {
                fileInput.click();
            }
        });
        fileInput.addEventListener('change', handleFileUpload);
    }


    // Inicialização Principal
    function init() {
        setStatus("Inicializando aplicação (v10.3 ELT)...", "info");
        setupEventListeners();
        initializeFilters();
        // Realiza a busca inicial de dados (caso já existam dados carregados no banco)
        fetchData();
    }

    init();
});
