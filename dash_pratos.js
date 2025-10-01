(function() { // IIFE para encapsulamento seguro
/* ===================== CONFIG (PROJETO ESTOQUE) ===================== */
const SUPABASE_URL_ESTOQUE  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON_ESTOQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';

if (!window.supabase) {
    alert("Erro crítico: Cliente Supabase não carregou. Verifique a conexão.");
    return;
}

const supaEstoque = window.supabase.createClient(SUPABASE_URL_ESTOQUE, SUPABASE_ANON_ESTOQUE);
const APP_VERSION = 'v10.6'; // VERSÃO COM ENCAPSULAMENTO DE CSS E ROBUSTEZ

/* ===================== HELPERS GERAIS (ESCOPADOS) ===================== */
// v10.6: Define o escopo de atuação do JS para o container do dashboard
const dashboardContainer = document.querySelector('.dash-pratos-v10');
if (!dashboardContainer) {
    // Este check deve ocorrer após o DOMContentLoaded, mas mantemos aqui para segurança inicial.
    console.error(`[${APP_VERSION}] Erro Crítico: Container principal do Dashboard (.dash-pratos-v10) não encontrado.`);
    return;
}

// Helpers escopados ao container para evitar conflitos
const $ = id => dashboardContainer.querySelector(`#${id}`);
const $$ = sel => dashboardContainer.querySelectorAll(sel);
const num = (v, decimals = 0) => (v==null||!isFinite(+v)) ? '0' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Helpers de Data (UTC) - (Inalterados)
function getDateUTC(input) {
    let d;
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
        d = new Date(input + 'T12:00:00Z');
    } else if (input instanceof Date) {
        d = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 12, 0, 0));
    } else {
        const now = new Date();
        d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
    }
    if (isNaN(d.getTime())) {
        return getDateUTC(new Date());
    }
    return d;
}

function getDateISO(dateObj) {
    const d = getDateUTC(dateObj);
    return d.toISOString().split('T')[0];
}

function formatMonthName(isoMonth) {
    if (!isoMonth || !/^\d{4}-\d{2}$/.test(isoMonth)) return isoMonth;
    const [year, monthIndex] = isoMonth.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthIndex - 1, 1));
    const monthName = date.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
}


/* ===================== COMPONENTE MULTI-SELECT (MSel) ===================== */
// (Classe Inalterada, pois já operava dentro do container fornecido pelo ID que agora é buscado via helper $)
class MultiSelect {
    constructor(containerId, onChangeCallback) {
        this.container = $(containerId);
        if (!this.container) return;

        this.onChange = onChangeCallback;
        this.btn = this.container.querySelector('.msel-btn');
        this.panel = this.container.querySelector('.msel-panel');
        this.labelSingular = this.container.dataset.singular || 'Item';
        this.options = [];
        this.selected = new Set();
        this.isOpen = false;
        this.initialized = false;

        this.initEvents();
    }

    initEvents() {
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.initialized) return;
            this.toggle();
        });

        this.panel.addEventListener('click', (e) => {
            const opt = e.target.closest('.msel-opt');
            if (opt) {
                const value = opt.dataset.value;
                const checkbox = opt.querySelector('input[type="checkbox"]');

                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                this.handleSelection(value, checkbox.checked);
            }
        });

        this.panel.addEventListener('click', (e) => e.stopPropagation());
    }

    initialize(optionsList) {
        this.options = optionsList.sort((a, b) => a.localeCompare(b));
        this.renderPanel();
        this.initialized = true;
        this.updateButtonText();
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        document.dispatchEvent(new CustomEvent('msel:closeAll', { detail: { except: this.container.id } }));

        this.container.classList.add('open');
        this.isOpen = true;
        const searchInput = this.panel.querySelector('.msel-search');
        if (searchInput) {
            searchInput.value = '';
            this.filterOptions('');
            // Foco gerenciado com cuidado em componentes embedados
            try { searchInput.focus(); } catch (e) { console.warn("Não foi possível focar o input de busca."); }
        }
    }

    close() {
        this.container.classList.remove('open');
        this.isOpen = false;
    }

    renderPanel() {
        let html = `<input type="search" class="msel-search" placeholder="Pesquisar...">`;
        html += `<div class="msel-options-list">`;

        if (this.options.length === 0) {
            html += `<div style="text-align: center; padding: 10px; color: var(--muted); font-size: 11px;">Nenhuma opção</div>`;
        } else {
            this.options.forEach(option => {
                const safeOption = option.replace(/"/g, '&quot;');
                const isChecked = this.selected.has(option) ? 'checked' : '';
                html += `
                    <label class="msel-opt" data-value="${safeOption}">
                        <input type="checkbox" ${isChecked}>
                        <span>${safeOption}</span>
                    </label>
                `;
            });
        }
        html += `</div>`;
        this.panel.innerHTML = html;

        const searchInput = this.panel.querySelector('.msel-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterOptions(e.target.value));
        }
    }

    filterOptions(query) {
        const filter = query.toLowerCase();
        const opts = this.panel.querySelectorAll('.msel-opt');
        opts.forEach(opt => {
            const text = opt.dataset.value.toLowerCase();
            opt.style.display = text.includes(filter) ? 'flex' : 'none';
        });
    }

    handleSelection(value, isSelected) {
        if (isSelected) {
            this.selected.add(value);
        } else {
            this.selected.delete(value);
        }
        this.updateButtonText();
        if (this.onChange) this.onChange();
    }

    updateButtonText() {
        const count = this.selected.size;
        if (count === 0) {
            this.btn.textContent = "Todos";
        } else if (count === 1) {
            this.btn.textContent = Array.from(this.selected)[0];
        } else {
            this.btn.textContent = `${count} ${this.labelSingular}s Selec.`;
        }
    }

    getSelected() {
        return this.selected.size > 0 ? Array.from(this.selected) : null;
    }

    reset() {
        this.selected.clear();
        if (this.initialized) {
            this.renderPanel();
            this.updateButtonText();
        }
    }
}

/* ===================== LÓGICA DOS FILTROS (FX) ===================== */
// (Lógica Inalterada, pois IDs e Classes FX/MSel foram mantidos e são buscados via helper $)

let filterUnidades, filterCategorias, filterPratos;

function fxDispatchApply(){
    const startInput = $('fxDuStart');
    const endInput = $('fxDuEnd');
    if (!startInput || !endInput || !startInput.value || !endInput.value) {
        return;
    }

    const payload = {
        start: startInput.value,
        end: endInput.value,
        unidades: filterUnidades ? filterUnidades.getSelected() : null,
        categorias: filterCategorias ? filterCategorias.getSelected() : null,
        pratos: filterPratos ? filterPratos.getSelected() : null,
    };

    document.dispatchEvent(new CustomEvent('filters:apply', { detail: payload }));
}

function fxSetRange(start, end) {
    const startInput = $('fxDuStart');
    const endInput = $('fxDuEnd');
    if (startInput && endInput) {
        startInput.value = getDateISO(start);
        endInput.value = getDateISO(end);
    }
}

function fxSetToLastMonthWithData(baseDateStr) {
    const baseDate = getDateUTC(baseDateStr);
    const year = baseDate.getUTCFullYear();
    const month = baseDate.getUTCMonth();

    const startOfLastMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfLastMonth = new Date(Date.UTC(year, month, 0));

    fxSetRange(startOfLastMonth, endOfLastMonth);

    $$('#fxQuickChips button').forEach(b => b.classList.remove('active'));
    // Usamos $ para garantir que buscamos dentro do dashboard
    const lastMonthBtn = $('#fxQuickChips button[data-win="lastMonth"]'); 
    if (lastMonthBtn) lastMonthBtn.classList.add('active');
    $$('#fxDuQuickDays button').forEach(b => b.classList.remove('fx-active'));
}

function setupFilterInteractions() {
    const fx = {
        $btnMore: $('fxBtnMore'),
        $dropup: $('fxDropup'),
        $quickChips: $('fxQuickChips'),
        $quickDays: $('fxDuQuickDays'),
        $start: $('fxDuStart'),
        $end: $('fxDuEnd'),
        $btnReset: $('fxBtnReset')
    };

    // 1. Toggle do Dropup
    if (fx.$btnMore) {
        fx.$btnMore.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShown = fx.$dropup.classList.toggle('fx-show');
            fx.$btnMore.setAttribute('aria-expanded', isShown);
        });
    }

    // Listener global (document) para fechar modais/dropups (Importante para a aplicação inteira)
    document.addEventListener('click', (e) => {
        // Fecha o dropup se ele estiver aberto E o clique foi fora dele
        if (fx.$dropup && fx.$dropup.classList.contains('fx-show')) {
            if (!fx.$dropup.contains(e.target)) {
               fx.$dropup.classList.remove('fx-show');
               if (fx.$btnMore) fx.$btnMore.setAttribute('aria-expanded', false);
            }
        }
        document.dispatchEvent(new CustomEvent('msel:closeAll'));
    });

    if (fx.$dropup) {
        fx.$dropup.addEventListener('click', (e) => {
            // Impede que cliques dentro do dropup (exceto em MSels) o fechem
            if (!e.target.closest('.msel')) {
                 e.stopPropagation();
            }
        });
    }


    // 2. Botões Rápidos
    if (fx.$quickChips) {
        fx.$quickChips.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || btn.classList.contains('active')) return;

            $$('#fxQuickChips button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $$('#fxDuQuickDays button').forEach(b => b.classList.remove('fx-active'));

            // Resetar filtros analíticos
            if (filterUnidades) filterUnidades.reset();
            if (filterCategorias) {
                filterCategorias.reset();
                const defaultCategory = filterCategorias.options.find(cat => cat.toLowerCase() === 'pratos');
                 if (defaultCategory) {
                     filterCategorias.handleSelection(defaultCategory, true);
                }
            }
            if (filterPratos) filterPratos.reset();


            const win = btn.dataset.win;
            const baseDate = getDateUTC(lastDay);
            let start, end;

            switch(win) {
                case 'today':
                    start = end = baseDate;
                    break;
                case 'yesterday':
                    start = new Date(baseDate.getTime());
                    start.setUTCDate(baseDate.getUTCDate() - 1);
                    end = start;
                    break;
                case 'lastMonth':
                    fxSetToLastMonthWithData(lastDay);
                    fxDispatchApply();
                    return;
                case 'lastYear':
                    const year = baseDate.getUTCFullYear() - 1;
                    start = new Date(Date.UTC(year, 0, 1));
                    end = new Date(Date.UTC(year, 11, 31));
                    break;
            }

            if (start && end) {
                fxSetRange(start, end);
                fxDispatchApply();
            }
        });
    }

    // 3. Segmento de Dias Rápidos
    if (fx.$quickDays) {
        fx.$quickDays.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            $$('#fxDuQuickDays button').forEach(b => b.classList.remove('fx-active'));
            btn.classList.add('fx-active');

            const days = parseInt(btn.dataset.win);
            const currentEndStr = (fx.$end && fx.$end.value) || lastDay;
            const end = getDateUTC(currentEndStr);
            const start = new Date(end.getTime());
            start.setUTCDate(end.getUTCDate() - (days - 1));

            fxSetRange(start, end);
            $$('#fxQuickChips button').forEach(b => b.classList.remove('active'));
            fxDispatchApply();
        });
    }

    // 4. Mudanças Manuais nos Inputs de Data
    const handleDateChange = () => {
        if (fx.$start && fx.$end && fx.$start.value && fx.$end.value) {
            if (new Date(fx.$start.value) > new Date(fx.$end.value)) {
                console.warn("Data inicial maior que a data final.");
                return;
            }
            $$('#fxQuickChips button').forEach(b => b.classList.remove('active'));
            $$('#fxDuQuickDays button').forEach(b => b.classList.remove('fx-active'));
            fxDispatchApply();
        }
    };
    if (fx.$start) fx.$start.addEventListener('change', handleDateChange);
    if (fx.$end) fx.$end.addEventListener('change', handleDateChange);


    // 5. Botão Limpar (Reset)
    if (fx.$btnReset) {
        fx.$btnReset.addEventListener('click', () => {
            fxSetToLastMonthWithData(lastDay);
            if (filterUnidades) filterUnidades.reset();
            if (filterCategorias) {
                filterCategorias.reset();
                const defaultCategory = filterCategorias.options.find(cat => cat.toLowerCase() === 'pratos');
                 if (defaultCategory) {
                     filterCategorias.handleSelection(defaultCategory, true);
                }
            }
            if (filterPratos) filterPratos.reset();

            fxDispatchApply();
            if (fx.$dropup) fx.$dropup.classList.remove('fx-show');
            if (fx.$btnMore) fx.$btnMore.setAttribute('aria-expanded', false);
        });
    }
}

/* ===================== ESTADO E GRÁFICOS ===================== */
let lastDay = '';
let chartMonth, chartDow;
let isFetching = false;

// Funções de Renderização, Estado e Tratamento de Erros (Ajustadas para classes prefixadas)

function setChartMessage(boxId, message) {
    const box = $(boxId);
    if (!box) return;
    // Ajuste para a nova classe prefixada dp-chart-message
    let msgEl = box.querySelector('.dp-chart-message');

    if (message) {
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.className = 'dp-chart-message';
            box.appendChild(msgEl);
        }
        msgEl.textContent = message;
        box.classList.add('has-message');
    } else {
        if (msgEl) {
            msgEl.remove();
        }
        box.classList.remove('has-message');
    }
}

function setLoadingState(isLoading) {
    isFetching = isLoading;
    console.log(`[Status ${APP_VERSION}] Loading state: ${isLoading}`);

    // Desabilita elementos interativos dentro do dashboard
    const filterElements = $$('.fx-filters-bar button, .fx-dropup button, .fx-input, .msel-btn');
    filterElements.forEach(el => {
        // Exceção para o botão de upload se já estiver desabilitado
        if (el.id === 'btnUpload' && el.disabled && isLoading) return;
        el.disabled = isLoading;
    });

    // Controla o cursor apenas sobre o container do dashboard
    if (dashboardContainer) {
        dashboardContainer.style.cursor = isLoading ? 'wait' : 'default';
    }
}

function handleApiError(error) {
    console.error(`[${APP_VERSION}] Erro na API/Dados:`, error);
    const message = error.message || JSON.stringify(error);
    alert(`Falha ao processar dados:\n${message}\n\nO Dashboard será resetado.`);
    handleEmptyData();
}

function updateDelta(elId, current, previous) {
    const el = $(elId);
    if (!el) return;

    if (current == null || previous == null || !isFinite(current) || !isFinite(previous) || previous === 0) {
        // Ajuste para a nova classe prefixada dp-delta
        el.className = 'dp-delta flat';
        el.textContent = '—';
        return;
    }

    const deltaVal = ((current - previous) / previous) * 100;

    if (deltaVal > 0.1) {
        el.className = 'dp-delta up';
        el.textContent = `▲ ${num(deltaVal, 1)}%`;
    } else if (deltaVal < -0.1) {
        el.className = 'dp-delta down';
        el.textContent = `▼ ${num(Math.abs(deltaVal), 1)}%`;
    } else {
        el.className = 'dp-delta flat';
        el.textContent = '—';
    }
}

// (Inalterado)
function updateKpis(kpis) {
    if (!kpis) {
        const nullKpis = {
            vendas_atual: null, vendas_anterior: null,
            pratos_unicos_atual: null, pratos_unicos_anterior: null,
            media_diaria_atual: null, media_diaria_anterior: null
        };
        kpis = nullKpis;
    }

    const k_qtd = $('k_qtd');
    if (k_qtd) k_qtd.textContent = kpis.vendas_atual != null ? num(kpis.vendas_atual) : '—';
    const p_qtd = $('p_qtd');
    if (p_qtd) p_qtd.textContent = kpis.vendas_anterior != null ? num(kpis.vendas_anterior) : '—';
    updateDelta('d_qtd', kpis.vendas_atual, kpis.vendas_anterior);

    const k_pratos_unicos = $('k_pratos_unicos');
    if (k_pratos_unicos) k_pratos_unicos.textContent = kpis.pratos_unicos_atual != null ? num(kpis.pratos_unicos_atual) : '—';
    const p_pratos_unicos = $('p_pratos_unicos');
    if (p_pratos_unicos) p_pratos_unicos.textContent = kpis.pratos_unicos_anterior != null ? num(kpis.pratos_unicos_anterior) : '—';
    updateDelta('d_pratos_unicos', kpis.pratos_unicos_atual, kpis.pratos_unicos_anterior);

    const k_media_diaria = $('k_media_diaria');
    if (k_media_diaria) k_media_diaria.textContent = kpis.media_diaria_atual != null ? num(kpis.media_diaria_atual, 1) : '—';
    const p_media_diaria = $('p_media_diaria');
    if (p_media_diaria) p_media_diaria.textContent = kpis.media_diaria_anterior != null ? num(kpis.media_diaria_anterior, 1) : '—';
    updateDelta('d_media_diaria', kpis.media_diaria_atual, kpis.media_diaria_anterior);
}

// (Inalterado)
function handleEmptyData() {
    console.warn(`[${APP_VERSION}] Resetando UI para estado Vazio (Sem Dados ou Erro).`);

    updateKpis(null);

    if (chartMonth) chartMonth.destroy();
    chartMonth = null;
    setChartMessage('box_month', 'Nenhum dado encontrado para o período selecionado.');

    if (chartDow) chartDow.destroy();
    chartDow = null;
    setChartMessage('box_dow', 'Nenhum dado encontrado para o período selecionado.');

    renderTop10([], null);
    window.dashboardData = null;
}


// (Inalterado)
function renderMonthChart(data) {
    if (chartMonth) chartMonth.destroy();
    chartMonth = null;
    setChartMessage('box_month', null);

    if (!data || !Array.isArray(data) || data.length === 0) {
        setChartMessage('box_month', 'Nenhum dado mensal encontrado para o período.');
        return;
    }

    // Verificação necessária pois o canvas pode não existir se o DOM não carregou corretamente dentro do escopo
    const canvasEl = $('ch_month');
    if (!canvasEl) return; 

    const ctx = canvasEl.getContext('2d');
    const labels = data.map(d => formatMonthName(d.mes));
    const currentData = data.map(d => d.vendas_atual);
    const previousData = data.map(d => d.vendas_anterior);

    chartMonth = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Período Atual', data: currentData, backgroundColor: 'var(--wine)', borderRadius: 4 },
                { label: 'Período Anterior', data: previousData, backgroundColor: 'var(--c-prev)', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

// (Inalterado)
function renderDowChart(data) {
    if (chartDow) chartDow.destroy();
    chartDow = null;
    setChartMessage('box_dow', null);

    if (!data || !Array.isArray(data)) {
        data = [];
    }

    const hasData = data.length > 0 && data.some(d => d.total_vendido > 0);

    if (!hasData) {
        setChartMessage('box_dow', 'Nenhum dado semanal encontrado para o período.');
        return;
    }

    const canvasEl = $('ch_dow');
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const sortedData = labels.map(label => data.find(d => d.dia_semana_nome === label) || { total_vendido: 0 });

    chartDow = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Itens Vendidos',
                data: sortedData.map(d => d.total_vendido),
                backgroundColor: 'rgba(123, 30, 58, 0.7)',
                borderColor: 'var(--wine)',
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { beginAtZero: true } } }
    });
}

// Renderiza a lista Top 10 (Ajustado para classes prefixadas)
function renderTop10(data, mode) {
    const listBody = $('top10-list-body');
    if (!listBody) return;

    if (!data || data.length === 0) {
        listBody.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--muted);">Nenhum registro encontrado.</div>`;
        return;
    }

    let html = '';
    data.forEach((item, index) => {
        // Ajuste para as novas classes prefixadas dp-top10-*
        html += `
            <div class="dp-top10-row">
                <span class="dp-top10-col-rank">${index + 1}</span>
                <span class="dp-top10-col-prato" title="${item.prato.replace(/"/g, '&quot;')}">${item.prato}</span>
                <span class="dp-top10-col-qty">${num(item.quantidade)}</span>
            </div>
        `;
    });
    listBody.innerHTML = html;
}


// Função principal de busca de dados (Inalterada)
async function applyAll(payload) {
    if (!payload || !payload.start || !payload.end) {
        console.warn(`[${APP_VERSION}] Tentativa de busca com payload inválido.`);
        return;
    }

    if (isFetching) {
        console.warn(`[${APP_VERSION}] Busca já em progresso. Ignorando solicitação.`);
        return;
    }

    console.log(`[${APP_VERSION}] Buscando dados...`, payload);
    setLoadingState(true);

    try {
        const { data: rawData, error } = await supaEstoque.rpc('get_sales_dashboard_data', {
            start_date: payload.start,
            end_date: payload.end,
            unidades_filter: payload.unidades,
            categorias_filter: payload.categorias,
            pratos_filter: payload.pratos
        });

        // 1. Tratamento de Erros
        if (error) {
            handleApiError(error);
            return;
        }

        // 2. Normalização e Tratamento de Resposta Vazia
        let dashboardData = null;

        if (Array.isArray(rawData) && rawData.length > 0) {
            dashboardData = rawData[0];
        } else if (rawData && typeof rawData === 'object' && !Array.isArray(rawData) && Object.keys(rawData).length > 0) {
            dashboardData = rawData;
        }

        if (!dashboardData) {
            console.warn(`[${APP_VERSION}] Aviso: A consulta retornou vazia.`);
            handleEmptyData();
            return;
        }

        // 3. Validação da Estrutura
        if (!dashboardData.kpis || !dashboardData.sales_by_month || !dashboardData.sales_by_dow) {
            handleApiError(new Error("A resposta da API tem um formato inesperado (chaves ausentes)."));
            return;
        }

        // 4. Atualiza os KPIs e Gráficos
        updateKpis(dashboardData.kpis);
        renderMonthChart(dashboardData.sales_by_month);
        renderDowChart(dashboardData.sales_by_dow);

        // Ajuste para selecionar botões dentro do container do dashboard
        const activeTop10Btn = $('#segTop10 button.active');
        const mode = activeTop10Btn ? activeTop10Btn.dataset.mode : 'MAIS';
        const top10Data = (mode === 'MAIS') ? dashboardData.top_10_mais_vendidos : dashboardData.top_10_menos_vendidos;
        renderTop10(top10Data, mode);

        window.dashboardData = dashboardData;
        console.info(`[Status ${APP_VERSION}] [ok]: Dados atualizados.`);

    } catch (e) {
        handleApiError(e);
    } finally {
        setLoadingState(false);
    }
}


/* ===================== LÓGICA DE IMPORTAÇÃO ===================== */

// Helpers de Parsing de Data (Inalterados)
function parseExcelDate(serial) {
    if (typeof serial !== 'number' || !isFinite(serial)) {
        return null;
    }
    const excelEpochDiff = 25569;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const timestamp = (serial - excelEpochDiff) * millisecondsPerDay;
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function parseBrazilianDate(dateString) {
    if (typeof dateString !== 'string') return null;

    const normalizedString = dateString.trim().split(' ')[0];
    const parts = normalizedString.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    if (year >= 0 && year < 100) {
        year += (year < 50) ? 2000 : 1900;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;

    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

    return date;
}


// Configuração da funcionalidade de Importação (ATUALIZADA com maior tolerância de carregamento)
async function setupImportFeature() {
    const btnUpload = $('btnUpload');
    // O input file deve ser buscado no documento global pois pode estar fora do container principal ou ser movido pelo browser
    const fileInput = document.getElementById('fileExcel'); 
    const uploadText = $('uploadText');
    const uploadSpinner = $('uploadSpinner');

    if (!btnUpload || !fileInput || !uploadText || !uploadSpinner) return;

    const isXLSXAvailable = () => typeof window.XLSX !== 'undefined';

    // Verificação proativa inicial com espera ativa (Intervalo)
    if (!isXLSXAvailable()) {
        console.info(`[${APP_VERSION}] Aguardando carregamento da biblioteca XLSX...`);
        const checkInterval = 500;
        const maxWaitTime = 5000; // 5 segundos
        let waitedTime = 0;

        const intervalId = setInterval(() => {
            if (isXLSXAvailable()) {
                clearInterval(intervalId);
                console.info(`[${APP_VERSION}] Biblioteca XLSX carregada após ${waitedTime}ms.`);
            } else {
                waitedTime += checkInterval;
                if (waitedTime >= maxWaitTime) {
                    clearInterval(intervalId);
                    console.error(`[${APP_VERSION}] Erro Crítico: Biblioteca XLSX (SheetJS) não carregou após ${maxWaitTime}ms. Importação desativada.`);
                    btnUpload.disabled = true;
                    uploadText.textContent = 'Erro Lib';
                }
            }
        }, checkInterval);
    }

    btnUpload.addEventListener('click', () => {
        // Verificação reativa no clique
        if (!isXLSXAvailable()) {
             alert("A funcionalidade de importação ainda está carregando ou falhou (XLSX Undefined). Por favor, aguarde ou verifique sua conexão de rede (CDN).");
             return;
        }
        if (btnUpload.disabled) return;
        fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
        // Verificação final
        if (!isXLSXAvailable()) {
            alert("Erro: Biblioteca XLSX não está disponível.");
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        btnUpload.disabled = true;
        uploadText.textContent = 'Processando...';
        uploadSpinner.style.display = 'inline-block';

        try {
            // (Lógica de processamento e upload inalterada - já era robusta)
            const data = await file.arrayBuffer();
            const readOptions = { type: 'array', cellDates: false };

            if (file.name.toLowerCase().endsWith('.csv')) {
                readOptions.type = 'binary';
            }

            const workbook = window.XLSX.read(data, readOptions);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });

            if (rawData.length <= 1) {
                throw new Error("O arquivo está vazio ou contém apenas o cabeçalho.");
            }

            rawData.shift();

            const processedData = rawData.map((row, index) => {
                if (row.length < 5 || row[1] == null || row[2] == null) {
                    return null;
                }

                const rawDate = row[0];
                let date;

                if (typeof rawDate === 'string') {
                    date = parseBrazilianDate(rawDate);
                }

                if (!date && typeof rawDate === 'number') {
                    date = parseExcelDate(rawDate);
                }

                if (!date && rawDate) {
                    const parsedDate = new Date(rawDate);
                    if (!isNaN(parsedDate.getTime())) {
                        date = parsedDate;
                    }
                }

                if (!date) {
                    console.warn(`[Importação] Linha ${index + 2} ignorada: data inválida (${rawDate}).`);
                    return null;
                }

                const quantity = parseInt(row[4], 10);
                if (isNaN(quantity) || quantity <= 0) {
                    return null;
                }

                return {
                    data: getDateISO(date),
                    unidade: String(row[1]).trim(),
                    prato: String(row[2]).trim(),
                    categoria: row[3] ? String(row[3]).trim() : 'N/A',
                    quantidade: quantity
                };
            }).filter(item => item !== null);

            if (processedData.length === 0) {
                throw new Error("Nenhum dado válido encontrado no arquivo após o processamento.");
            }

            uploadText.textContent = 'Enviando...';
            const BATCH_SIZE = 500;
            let successCount = 0;
            for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
                const batch = processedData.slice(i, i + BATCH_SIZE);
                const { error } = await supaEstoque.from('vendas_pratos').insert(batch);
                if (error) {
                    throw new Error(`Falha ao enviar lote para o Supabase: ${error.message}`);
                }
                successCount += batch.length;
            }

            alert(`${successCount} registros importados com sucesso!\n\nAtualizando dashboard...`);
            window.location.reload();

        } catch (error) {
            console.error(`[${APP_VERSION}] Erro na importação:`, error);
            alert(`Falha na importação:\n${error.message}`);
        } finally {
            btnUpload.disabled = false;
            uploadText.textContent = 'Importar';
            uploadSpinner.style.display = 'none';
            fileInput.value = '';
        }
    });
}


/* ===================== INICIALIZAÇÃO E CONTROLES DA UI ===================== */

async function init() {
    try {
        console.info(`[Status ${APP_VERSION}] [info]: Inicializando aplicação...`);

        // 1. Inicializar componentes MultiSelect
        filterUnidades = new MultiSelect('ms-unids', fxDispatchApply);
        filterCategorias = new MultiSelect('ms-cats', fxDispatchApply);
        filterPratos = new MultiSelect('ms-pratos', fxDispatchApply);

        // Listener global para fechar MSels
        document.addEventListener('msel:closeAll', (e) => {
            const exceptId = e.detail ? e.detail.except : null;
            [filterUnidades, filterCategorias, filterPratos].forEach(ms => {
                if (ms && ms.isOpen && ms.container.id !== exceptId) {
                    ms.close();
                }
            });
        });

        // 2. Buscar Data Máxima e Opções de Filtro
        const [dateResult, filterResult] = await Promise.all([
            supaEstoque.from('vendas_pratos_daterange').select('max_data').maybeSingle(),
            supaEstoque.rpc('get_filter_options')
        ]);

        // Processar Data Máxima
        if (dateResult.error || !dateResult.data || !dateResult.data.max_data) {
            console.warn(`[${APP_VERSION}] Aviso: Falha ao buscar data mais recente ou banco vazio. Usando data atual como fallback.`);
            lastDay = getDateISO();
        } else {
            lastDay = dateResult.data.max_data;
        }
        console.info(`[Status ${APP_VERSION}] Data base definida para: ${lastDay}`);

        // Processar Opções de Filtro
        if (filterResult.error) {
             console.error(`[${APP_VERSION}] Erro ao buscar opções de filtro.`);
        } else {
            const optionsData = (Array.isArray(filterResult.data) && filterResult.data.length > 0) ? filterResult.data[0] : filterResult.data;

            if (optionsData && typeof optionsData === 'object') {
                filterUnidades.initialize(optionsData.unidades || []);
                filterCategorias.initialize(optionsData.categorias || []);
                filterPratos.initialize(optionsData.pratos || []);

                // Define o filtro padrão para Categoria = 'Pratos'
                const defaultCategory = (optionsData.categorias || []).find(cat => cat.toLowerCase() === 'pratos');
                if (defaultCategory) {
                    filterCategorias.selected.add(defaultCategory);
                    filterCategorias.updateButtonText();
                    filterCategorias.renderPanel();
                }
            }
        }

        // 3. Dispara o evento de inicialização dos filtros
        document.dispatchEvent(new Event('filters:init'));

    } catch (e) {
        console.error(`[${APP_VERSION}] Erro crítico na inicialização:`, e);
        handleApiError(new Error(`Falha crítica na inicialização da aplicação: ${e.message}`));
    }
}

// Usamos DOMContentLoaded no documento global para iniciar o script
document.addEventListener('DOMContentLoaded', () => {
    console.log(`[DIAGNÓSTICO ${APP_VERSION}] Script final iniciado.`);

    // Listeners de eventos customizados (podem ser disparados globalmente)
    document.addEventListener('filters:apply', (e) => {
        applyAll(e.detail);
    });

    document.addEventListener('filters:init', () => {
        setupFilterInteractions();
        fxSetToLastMonthWithData(lastDay);
        fxDispatchApply();
    });

    // Listeners do Top 10 (Ajustado para buscar dentro do container via helper $)
    const segTop10 = $('segTop10');
    if (segTop10) {
        segTop10.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || btn.classList.contains('active')) return;

            if (window.dashboardData) {
                // Ajustado para selecionar botões dentro do segmento
                segTop10.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const mode = btn.dataset.mode;
                const top10Data = (mode === 'MAIS') ? window.dashboardData.top_10_mais_vendidos : window.dashboardData.top_10_menos_vendidos;
                renderTop10(top10Data, mode);
            }
        });
    }

    setupImportFeature();

    init();
});

})();
