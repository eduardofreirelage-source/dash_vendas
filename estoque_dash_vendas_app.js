document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // Bloco Único de JavaScript: Lógica Principal, UI, e Inicialização (Arquitetura ELT)
    // ===================================================================================
    
    /* ===================== CONFIG ===================== */
    const RPC_FILTER_FUNC = 'filter_vendas'; // Mantido para referência futura
    const RPC_KPI_FUNC = 'kpi_vendas_unificado';
    const RPC_CHART_MONTH_FUNC = 'chart_vendas_mes_v1';
    const RPC_CHART_DOW_FUNC = 'chart_vendas_dow_v1';
    const RPC_CHART_HOUR_FUNC = 'chart_vendas_hora_v1';
    const RPC_CHART_TURNO_FUNC = 'chart_vendas_turno_v1';
    const RPC_DIAGNOSTIC_FUNC = 'diagnostico_geral';

    // ALTERAÇÃO CRÍTICA: Mudar o destino para a tabela de Staging ELT
    // DE: 'vendas_xlsx' 
    const DEST_INSERT_TABLE= 'stage_vendas_raw'; // PARA: Novo destino robusto
    
    const REFRESH_RPC     = 'refresh_sales_materialized';
    
    // ALERTA DE SEGURANÇA: Chaves expostas. Rotacionar imediatamente e implementar RLS.
    const SUPABASE_URL  = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";
    
    // Validação de Dependências Externas
    if (!window.supabase) { console.error("Supabase client library not loaded."); return; }
    if (typeof Chart === 'undefined') { console.error("Chart.js library not loaded."); return; }
    // PapaParse é necessário para o upload robusto.
    if (typeof Papa === 'undefined') { console.error("PapaParse library not loaded. Upload feature disabled."); return; }

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
    // Status aprimorado com logging no console para observabilidade
    const setStatus=(t,k)=>{ const el=$('status'); if(el) {el.textContent=t; el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085');} console.log(`Status [${k || 'info'}]: ${t}`); };
    const setDiag=(msg)=>{ const el=$('diag'); if(el) el.textContent = msg || ''; };
    const info=(msg)=>{ const el=$('uploadInfo'); if(el) el.textContent = msg || ''; };
    const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const num =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
    const pctf=v=>(v==null||!isFinite(+v))?'0,0%':((+v)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
    const rmAcc = (s)=> String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const normHeader = (s)=> rmAcc(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    
    // Função de limpeza de espaços robusta (essencial para o parser CSV)
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

    // DateHelpers (Incluindo a correção da função truncada computePrevRangeISO)
    const DateHelpers = {
      // Usamos T12:00:00 para evitar ambiguidades de fuso horário em operações de data pura.
      iso: (d) => d.toISOString().slice(0, 10),
      addDaysISO: (isoStr, n) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setDate(d.getDate() + n);
          return d.toISOString().slice(0, 10);
      },
      daysLen: (de, ate) => {
          if (!de || !ate) return 0;
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
      // Função corrigida e completada (estava truncada no original)
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

          // Caso 2: Meses cheios alinhados (e.g., 01/Jan a 31/Mar vs período anterior)
          if (this.isFullMonthsAligned(d1, d2)) {
            const atePrevDate = new Date(d1.getTime());
            atePrevDate.setDate(0); // Vai para o último dia do mês anterior ao início atual
            
            // Calcula a duração em meses do período atual (e.g., Março (2) - Janeiro (0) = 2)
            const durationMonths = (d2.getFullYear() * 12 + d2.getMonth()) - (d1.getFullYear() * 12 + d1.getMonth());

            const dePrevDate = new Date(atePrevDate.getTime());
            dePrevDate.setDate(1); // Início do mês final do período anterior
                        
            // Subtrai a duração para encontrar o mês inicial do período anterior
            dePrevDate.setMonth(dePrevDate.getMonth() - durationMonths);

            return { dePrev: this.iso(dePrevDate), atePrev: this.iso(atePrevDate) };
          }

          // Caso 3: Período arbitrário (Comparação por duração exata de dias)
          const MS_IN_A_DAY = 86400000; // (1000*60*60*24)
          // Calcula a duração em milissegundos (incluindo o último dia)
          const durationMs = d2.getTime() - d1.getTime() + MS_IN_A_DAY; 
          
          // O final do período anterior é o dia antes do início do atual
          const atePrevDate = new Date(d1.getTime() - MS_IN_A_DAY);
          
          // O início do período anterior é o início atual menos a duração
          const dePrevDate = new Date(d1.getTime() - durationMs);

          return { dePrev: this.iso(dePrevDate), atePrev: this.iso(atePrevDate) };
      }
    };

    /* ===================== FUNÇÃO DE MAPEAMENTO ELT (Posicional) ===================== */
    /**
     * Transforma uma linha bruta do CSV (array de valores) no objeto esperado pela tabela stage_vendas_raw.
     * Utiliza mapeamento posicional fixo para garantir robustez contra nomes de colunas inconsistentes ou duplicados.
     * 
     * @param {Array<any>} rawRowValues - Array contendo os valores da linha do CSV (Parser configurado sem cabeçalho).
     * @returns {Object<string, string>|null} Objeto formatado para inserção no Supabase ou null se inválido.
     */
    function mapCsvRowToStagingSchema(rawRowValues) {
        // Validação básica de integridade da linha (esperamos 26 colunas no formato fornecido)
        if (!rawRowValues || rawRowValues.length < 26) {
            // Log de diagnóstico para observabilidade
            console.warn("[ELT] Linha CSV incompleta (< 26 colunas) detectada. Pulando.", rawRowValues);
            return null;
        }

        // Mapeamento Explícito e Posicional. Todos os valores são tratados como TEXT no Staging.
        const stagingRecord = {
            "Unidade": cleanSpaces(rawRowValues[0]),
            "Pedido": cleanSpaces(rawRowValues[1]),
            "Codigo": cleanSpaces(rawRowValues[2]),
            "loja": cleanSpaces(rawRowValues[3]), // Nome exato conforme schema SQL (o CSV original tinha um espaço)
            "Tipo": cleanSpaces(rawRowValues[4]),
            "Turno": cleanSpaces(rawRowValues[5]),
            "Canal": cleanSpaces(rawRowValues[6]),
            "Número do pedido no parceiro": cleanSpaces(rawRowValues[7]),
            "Data": cleanSpaces(rawRowValues[8]), // Formato DD/MM/YYYY HH:MM
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

        // Filtro adicional: Linhas sem data ou sem valor total são inválidas para análise
        if (!stagingRecord["Data"] || !stagingRecord["Total"]) {
            return null;
        }

        return stagingRecord;
    }


    /* ===================== ESTADO DA APLICAÇÃO (State Management) ===================== */
    // (Reconstruído com base nas necessidades do Dashboard)
    const State = {
        activeTab: 'vendas',
        activeKpi: 'fat', // 'fat', 'ped', 'tkt'
        filters: {
            de: null,
            ate: null,
            dePrev: null,
            atePrev: null
        },
        data: {
            kpis: null,
            chartMonth: null,
            chartDow: null,
            chartHour: null,
            chartTurno: null
        },
        charts: {}, // Instâncias do Chart.js
        isFetching: false
    };

    /* ===================== LÓGICA DE UPLOAD E ELT (Fluxo Principal) ===================== */

    /**
     * Processa os dados CSV parseados e executa o pipeline ELT.
     * @param {Array<Array<string>>} parsedData - Dados do PapaParse (array de arrays).
     */
    async function processCsvData(parsedData) {
        setStatus('Iniciando processamento ELT...', 'info');

        // 1. Preparação e Mapeamento (E - Extract)
        if (!parsedData || parsedData.length <= 1) {
            setStatus('Arquivo vazio ou apenas com cabeçalho.', 'err');
            return;
        }

        // Remove a linha de cabeçalho original (a primeira linha do arquivo)
        const rawData = parsedData.slice(1); 

        const stagingData = rawData
            .map(row => mapCsvRowToStagingSchema(row))
            .filter(row => row !== null); // Remove linhas que falharam na validação

        if (stagingData.length === 0) {
            setStatus('Erro: Nenhum dado válido encontrado após mapeamento.', 'err');
            return;
        }

        try {
            // 2. Limpeza do Staging (Estratégia: Replace)
            // Crucial para garantir que o dashboard reflita apenas o último upload.
            setStatus('Limpando dados anteriores (Staging)...', 'info');
            // Usamos delete().neq('_id', 0) como um proxy para TRUNCATE via API PostgREST.
            const { error: deleteError } = await supa.from(DEST_INSERT_TABLE).delete().neq('_id', 0);

            if (deleteError) {
                // Tratamento de erros de deleção. Em produção, isso deve ser robusto (e.g., verificar timeouts vs erros de permissão).
                console.error("[ELT] Erro ao limpar Staging:", deleteError);
                setStatus('Falha ao limpar Staging. Upload abortado.', 'err');
                return; 
            }

            // 3. Inserção no Staging (L - Load)
            setStatus(`Enviando ${stagingData.length} registros (Staging)...`, 'info');
            
            // Nota de Arquitetura: Em produção, isso deve ser feito em batches (chunks) para arquivos grandes (>5000 linhas).
            const { error: insertError } = await supa.from(DEST_INSERT_TABLE).insert(stagingData);

            if (insertError) {
                setStatus('Falha crítica na inserção (SQL Staging)', 'err');
                console.error("[ELT] Erro Supabase Insert:", insertError);
                return;
            }

            // 4. Trigger do Reprocessamento (T - Transform)
            setStatus('Sinalizando Reprocessamento (Analytics MV)...', 'info');
            const { data: refreshData, error: refreshError } = await supa.rpc(REFRESH_RPC);
            
            // Validação robusta do retorno JSONB da função RPC (Princípio da Robustez Absoluta)
            if (refreshError || !refreshData || refreshData.status !== 'success') {
                setStatus('Falha no Reprocessamento (ELT RPC)', 'err');
                console.error("[ELT] Erro Supabase RPC Refresh:", refreshError || (refreshData && refreshData.message));
                return;
            }

            setStatus(`Sucesso! Importados: ${stagingData.length}. Status ELT: ${refreshData.status}`, 'ok');
            
            // 4. Atualiza o Dashboard com os novos dados
            initializeFilters();
            fetchData(); 
        
        } catch (e) {
            // Captura exceções inesperadas no fluxo async
            setStatus('Erro inesperado no fluxo de upload/ELT', 'err');
            console.error('[ELT] Exceção não capturada no Processamento ELT:', e);
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
            // dynamicTyping: false, // Garantir que tudo seja string para o Staging
            complete: (results) => {
                if (results.errors && results.errors.length > 0) {
                    setStatus('Erros encontrados durante o parsing do CSV.', 'warn');
                    console.error("PapaParse Errors:", results.errors);
                    // Continuamos mesmo com alguns erros de parsing se houver dados válidos
                }
                processCsvData(results.data);
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
        // Define o padrão como Mês Atual (Month-to-Date)
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

        // Calcula o período anterior automaticamente com base no período atual
        const prevRange = DateHelpers.computePrevRangeISO(State.filters.de, State.filters.ate);
        State.filters.dePrev = prevRange.dePrev;
        State.filters.atePrev = prevRange.atePrev;

        setStatus('Buscando dados analytics...', 'info');

        const rpcParams = {
            de_iso: State.filters.de,
            ate_iso: State.filters.ate,
            de_prev_iso: State.filters.dePrev,
            ate_prev_iso: State.filters.atePrev
        };

        try {
            // Executa as chamadas RPC em paralelo para otimizar o tempo de carregamento
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
                console.error("RPC Errors:", errors);
                // Optamos por continuar com os dados que foram buscados com sucesso
            }

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
            State.isFetching = false;
        }
    }

    /* ===================== RENDERIZAÇÃO E UI ===================== */

    function updateUI() {
        if (State.activeTab === 'vendas') {
            updateKpis();
            renderCharts();
        }
        // Atualizar inputs de filtro (se existirem no HTML)
        if ($('filter-de')) $('filter-de').value = State.filters.de;
        if ($('filter-ate')) $('filter-ate').value = State.filters.ate;
    }

    function updateKpis() {
        const data = State.data.kpis;
        if (!data || !data.curr || !data.prev) return;

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
        if (metric === 'tkt') metric = 'fat'; // Ticket médio usa faturamento como base nos gráficos agregados
        const format = metric === 'fat' ? 'currency' : 'count';
        return { metric, format };
    }

    // Opções padrão reutilizáveis para gráficos de barras/linhas
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
        renderMonthChart();
        renderDOWChart();
        renderHourChart();
        renderTurnoChart();
    }

    function renderMonthChart() {
        const data = State.data.chartMonth;
        if (!data) return;
        const { metric, format } = getMetricAndFormat();

        const canvas = $('chart_month');
        if (!canvas) return;
        if (State.charts.month) State.charts.month.destroy();

        // Preparação dos dados para o Chart.js
        // A API RPC retorna dados agregados por mês. Precisamos formatar as labels para exibição.
        const labels = data.current.map(item => DateHelpers.formatYM(item.x));
        
        // Extrai os valores da métrica selecionada
        const currentData = data.current.map(item => item[metric]);
        
        // AVISO: Para uma comparação correta, assumimos que os períodos têm a mesma estrutura de duração 
        // e o backend retorna arrays correspondentes.
        const previousData = data.previous.map(item => item[metric]); 

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

    // Função auxiliar para preencher dados sequenciais (Dias da semana, Horas)
    const fillSequentialData = (dataset, length, metric) => {
        const filled = [];
        for (let i = 0; i < length; i++) {
            // A API retorna 'x' como o índice (DOW 0-6 ou Hora 0-23)
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
        if (State.charts.dow) State.charts.dow.destroy();

        const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        State.charts.dow = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: DOW_LABELS,
                datasets: [
                    {
                        label: 'Atual',
                        data: fillSequentialData(data.current, 7, metric),
                        backgroundColor: gradNow(canvas.getContext('2d')),
                    }
                    // Comparação com período anterior pode ser adicionada seguindo o padrão MonthChart
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
        if (State.charts.hour) State.charts.hour.destroy();

        const HOUR_LABELS = Array.from({length: 24}, (_, i) => `${i}h`);

        State.charts.hour = new Chart(canvas, {
            type: 'line', // Linha é melhor para visualizar padrão horário
            data: {
                labels: HOUR_LABELS,
                datasets: [
                    {
                        label: 'Atual',
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
        if (!data) return;
        const { metric, format } = getMetricAndFormat();
        const canvas = $('chart_turno');
        if (!canvas) return;
        if (State.charts.turno) State.charts.turno.destroy();

        State.charts.turno = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.current.map(item => item.x),
                datasets: [{
                    data: data.current.map(item => item[metric]),
                    // Cores fixas para os turnos (Dia/Noite/etc)
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
                    // Redesenha os gráficos ao voltar para a aba de vendas para garantir layout correto
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
        
        // 4. Setup Filter Handlers (Implementar se houver inputs de data no HTML)
        // ...
    }

    /**
     * Configura o manipulador de upload de arquivos, criando elementos dinamicamente se necessário.
     */
    function setupUploadHandler() {
        const uploadBar = document.querySelector('.upload-bar');
        if (!uploadBar) {
            console.warn("Elemento .upload-bar não encontrado. Funcionalidade de upload desabilitada.");
            return;
        }

        // Tenta encontrar ou criar o input de arquivo
        let fileInput = $('fileUploadInput');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'fileUploadInput';
            fileInput.accept = '.csv'; // Aceitar apenas CSV conforme o parser configurado
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
        }

        // Tenta encontrar ou criar o botão de trigger
        let uploadButton = $('uploadTriggerButton');
        if (!uploadButton) {
            uploadButton = document.createElement('button');
            uploadButton.textContent = 'Importar Dados (CSV)';
            uploadButton.id = 'uploadTriggerButton';
            uploadButton.className = 'btn-upload';
            // Insere o botão no upload-bar
            uploadBar.appendChild(uploadButton);
        }

        uploadButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
    }


    // Inicialização Principal
    function init() {
        setStatus("Inicializando aplicação...", "info");
        setupEventListeners();
        initializeFilters();
        // Realiza a busca inicial de dados com os filtros padrão
        fetchData();
    }

    init();
});
