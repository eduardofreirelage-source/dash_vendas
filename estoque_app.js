// =================================================================================
// SCRIPT COMPLETO E UNIFICADO PARA O SISTEMA DE GESTÃO (app.html)
// Versão 4.0 - Restaurada e Revisada
// =================================================================================

/* ===== Helpers Globais e Configuração ===== */
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Configuração do Supabase (use suas chaves reais)
const SUPABASE_URL = 'https://rqeagimulvgfecvuzubk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const setStatus = (msg, cls) => {
    const el = $('status'); if (!el) return;
    el.textContent = msg;
    const colorMap = { 'err': 'var(--down)', 'ok': 'var(--ok)', 'warn': 'var(--warn)' };
    el.style.color = colorMap[cls] || 'var(--muted)';
};

const fmtMoney = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+n || 0);
const fmt = (n, d = 3) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(+n || 0);
const showEditor = (id) => { const el = $(id); if (el) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if (el) el.style.display = 'none'; };

const getFormData = (formId) => {
    const form = $(formId); if (!form) return {};
    const data = new FormData(form);
    const obj = {};
    for (let element of form.elements) {
        if (element.name) {
            if (element.type === 'checkbox') {
                obj[element.name] = element.checked;
            } else if (element.type === 'number') {
                obj[element.name] = element.value ? parseFloat(element.value) : null;
            } else {
                const value = data.get(element.name);
                obj[element.name] = value || null;
            }
        }
    }
    const idInput = form.querySelector('input[name="id"]');
    if (idInput && idInput.value) obj.id = idInput.value;
    return obj;
};

function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Elemento não encontrado para listener: ${id}`);
    }
}

/* ===== Roteamento por Abas ===== */
function setupRouting() {
    const mainTabsContainer = $('main-tabs');
    if (!mainTabsContainer) { console.error("Container de abas 'main-tabs' não encontrado."); return; }
    
    const mainContents = $$('.tab-content');
    mainTabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        const tabId = btn.dataset.tab;
        $$('button', mainTabsContainer).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mainContents.forEach(content => content.classList.toggle('active', content.id === 'tab-' + tabId));
    });

    const setupSubTabs = (containerId, contentSelector) => {
        const container = $(containerId); if (!container) return;
        const contents = $$(contentSelector);
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('button'); if (!btn) return;
            const subTabId = btn.dataset.subtab; if (!subTabId) return;
            $$('button', container).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            contents.forEach(content => content.classList.toggle('active', content.id === 'sub-' + subTabId));
        });
    };
    setupSubTabs('cadastro-subtabs', '#tab-cadastros .subpage');
    setupSubTabs('estoque-subtabs', '#tab-estoque .subpage');
}

/* ===== Módulo Genérico de CRUD (Para Cadastros Auxiliares) ===== */
const GenericCRUD = {
    async loadTable(table, tableId, columns, view = null, actions = true) {
        const tbody = $(tableId)?.querySelector('tbody'); if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando...</td></tr>`;
        try {
            const source = view || table;
            const orderCol = columns.includes('nome') ? 'nome' : columns[0];
            const { data, error } = await supa.from(source).select('*').order(orderCol, { ascending: true });
            if (error) throw error;
            tbody.innerHTML = '';
            data.forEach(item => {
                const tr = document.createElement('tr');
                columns.forEach(col => {
                    const td = document.createElement('td');
                    if (col === 'ativo') {
                        td.innerHTML = item.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>';
                    } else if (col.includes('custo') || col.includes('preco')) {
                        td.textContent = fmtMoney(item[col]);
                    } else {
                        td.textContent = item[col] || '—';
                    }
                    tr.appendChild(td);
                });
                if (actions) {
                    const tdActions = document.createElement('td');
                    tdActions.innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button>
                                           <button class="btn small" data-act="toggle" data-id="${item.id}">${item.ativo ? 'Desativar' : 'Ativar'}</button>`;
                    tr.appendChild(tdActions);
                }
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(`Erro ao carregar ${table}:`, e);
            tbody.innerHTML = `<tr><td colspan="100%">Erro ao carregar dados.</td></tr>`;
        }
    },
    showForm(editorId, formId, titleId, titleText, data = null) {
        const form = $(formId); if (!form) return;
        form.reset();
        if ($(titleId)) $(titleId).textContent = titleText;
        if (data) {
            Object.keys(data).forEach(key => {
                const input = form.elements[key];
                if (input) {
                    if (input.type === 'checkbox') input.checked = data[key];
                    else input.value = data[key];
                }
            });
        }
        showEditor(editorId);
    },
    async save(e, table, editorId, refreshCallback) {
        e.preventDefault();
        const data = getFormData(e.target.id);
        const id = data.id;
        delete data.id;
        setStatus(`Salvando ${table}...`);
        try {
            const { error } = id
                ? await supa.from(table).update(data).eq('id', id)
                : await supa.from(table).insert([data]);
            if (error) throw error;
            setStatus('Registro salvo com sucesso!', 'ok');
            hideEditor(editorId);
            if (refreshCallback) refreshCallback();
        } catch (err) {
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },
    async toggle(table, id, refreshCallback) {
        setStatus('Atualizando status...');
        try {
            const { data, error: fetchError } = await supa.from(table).select('ativo').eq('id', id).single();
            if (fetchError) throw fetchError;
            const { error } = await supa.from(table).update({ ativo: !data.ativo }).eq('id', id);
            if (error) throw error;
            setStatus('Status atualizado.', 'ok');
            if (refreshCallback) refreshCallback();
        } catch (err) {
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },
    async handleTableClick(e, table, editorId, formId, titleId, refreshCallback) {
        const btn = e.target.closest('button'); if (!btn) return;
        const { act, id } = btn.dataset;
        if (act === 'toggle') {
            this.toggle(table, id, refreshCallback);
        } else if (act === 'edit') {
            try {
                const { data, error } = await supa.from(table).select('*').eq('id', id).single();
                if (error) throw error;
                this.showForm(editorId, formId, titleId, `Editar Registro`, data);
            } catch (err) {
                setStatus(`Erro ao carregar dados: ${err.message}`, 'err');
            }
        }
    }
};

/* ===== Módulos Específicos da Aplicação ===== */

const AppModules = {
    // Módulo de Cadastros Auxiliares (UM, Unidades, Categorias)
    Auxiliares: {
        init() {
            this.setup('um', 'unidades_medida', ['sigla', 'nome', 'base', 'fator', 'ativo']);
            this.setup('unidades', 'unidades', ['nome', 'ativo']);
            this.setup('categorias', 'categorias', ['nome', 'tipo', 'ativo']);
            this.refreshAllDropdowns();
        },
        setup(prefix, table, columns) {
            const editorId = `${prefix}-editor-container`;
            const formId = `form-${prefix}`;
            const titleId = `${prefix}-form-title`;
            const tableId = `tbl-${prefix}`;
            const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1);

            const refresh = () => {
                GenericCRUD.loadTable(table, tableId, columns);
                this.refreshAllDropdowns();
            };

            addSafeEventListener(`btnShowNew${capitalized}Form`, 'click', () => GenericCRUD.showForm(editorId, formId, titleId, 'Novo Registro'));
            addSafeEventListener(`btnCancel${capitalized}Edit`, 'click', () => hideEditor(editorId));
            addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
            addSafeEventListener(tableId, 'click', (e) => GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh));
        },
        async fillOptionsFrom(table, selId, valKey, labelKey, where = {}) {
            const sel = $(selId); if (!sel) return;
            try {
                let query = supa.from(table).select(`${valKey}, ${labelKey}`).order(labelKey, { ascending: true });
                Object.entries(where).forEach(([k, v]) => query = query.eq(k, v));
                const { data, error } = await query;
                if (error) throw error;
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">Selecione...</option>';
                data.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item[valKey];
                    opt.textContent = item[labelKey];
                    sel.appendChild(opt);
                });
                sel.value = currentVal;
            } catch (e) { console.error(`Erro ao popular ${selId}`, e); }
        },
        refreshAllDropdowns() {
            // Dropdowns de Unidade de Medida
            this.fillOptionsFrom('unidades_medida', 'ing-unidade-medida', 'id', 'sigla', { ativo: true });
            this.fillOptionsFrom('unidades_medida', 'draft-und', 'sigla', 'sigla', { ativo: true });
            
            // Dropdowns de Locais/Unidades
            this.fillOptionsFrom('unidades', 'ing-local-armazenagem', 'id', 'nome', { ativo: true });
            this.fillOptionsFrom('unidades', 'mov-unidade-origem', 'id', 'nome', { ativo: true });
            this.fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome', { ativo: true });

            // Dropdowns de Categorias
            this.fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', { tipo: 'INGREDIENTE', ativo: true });
            this.fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', { tipo: 'PRATO', ativo: true });
            this.fillOptionsFrom('categorias', 'cat-filter', 'id', 'nome', { tipo: 'PRATO', ativo: true });
        }
    },

    // Módulo de Ingredientes
    Ingredientes: {
        init() {
            const refresh = () => this.load();
            addSafeEventListener('btnShowNewIngredienteForm', 'click', () => GenericCRUD.showForm('ingrediente-editor-container', 'form-ingrediente', 'ingrediente-form-title', 'Novo Ingrediente'));
            addSafeEventListener('btnCancelIngEdit', 'click', () => hideEditor('ingrediente-editor-container'));
            addSafeEventListener('form-ingrediente', 'submit', (e) => GenericCRUD.save(e, 'ingredientes', 'ingrediente-editor-container', refresh));
            addSafeEventListener('tblIng', 'click', (e) => GenericCRUD.handleTableClick(e, 'ingredientes', 'ingrediente-editor-container', 'form-ingrediente', 'ingrediente-form-title', refresh));
        },
        load() {
            GenericCRUD.loadTable('ingredientes', 'tblIng', ['nome', 'categoria_nome', 'unidade_medida_sigla', 'custo_unitario', 'ativo'], 'vw_ingredientes');
        }
    },

    // Módulo de Receitas
    Receitas: {
        draftItems: [],
        init() {
            addSafeEventListener('btnShowNewRecipeForm', 'click', () => this.showRecipeForm());
            addSafeEventListener('btnCancelRecEdit', 'click', () => hideEditor('recipe-editor-container'));
            addSafeEventListener('form-receita', 'submit', (e) => this.saveRecipe(e));
            addSafeEventListener('draft-tipo', 'change', () => this.updateDraftRefOptions());
            addSafeEventListener('btnDraftAdd', 'click', () => this.addDraftItem());
            addSafeEventListener('tblRec', 'click', (e) => this.handleTableClick(e));
            addSafeEventListener('tblDraft', 'click', (e) => this.handleDraftTableClick(e));
        },
        load() {
            GenericCRUD.loadTable('receitas', 'tblRec', ['nome', 'rendimento_formatado', 'total_itens', 'ativo'], 'vw_receitas_resumo');
        },
        updateDraftRefOptions() {
            const tipo = $('draft-tipo').value;
            const table = tipo === 'INGREDIENTE' ? 'ingredientes' : 'receitas';
            AppModules.Auxiliares.fillOptionsFrom(table, 'draft-ref', 'id', 'nome', { ativo: true });
        },
        async showRecipeForm(id = null) {
            $('form-receita').reset();
            this.draftItems = [];
            $('rec-id').value = '';
            $('recipe-form-title').textContent = id ? 'Editar Receita' : 'Nova Receita';

            if (id) {
                try {
                    const { data: recData, error: recErr } = await supa.from('receitas').select('*').eq('id', id).single();
                    if (recErr) throw recErr;
                    Object.keys(recData).forEach(key => { if ($(`rec-${key}`)) $(`rec-${key}`).value = recData[key]; });
                    $('rec-id').value = id;

                    const { data: itemsData, error: itemsErr } = await supa.from('vw_receita_itens_detalhes').select('*').eq('receita_id', id);
                    if (itemsErr) throw itemsErr;
                    this.draftItems = itemsData.map(i => ({ tipo: i.tipo, referencia_id: i.referencia_id, nome: i.nome_item, quantidade: i.quantidade, unidade: i.unidade }));
                } catch (e) { setStatus(`Erro ao carregar receita: ${e.message}`, 'err'); return; }
            }
            this.renderDraftTable();
            this.updateDraftRefOptions();
            showEditor('recipe-editor-container');
        },
        addDraftItem() {
            const tipo = $('draft-tipo').value;
            const refId = $('draft-ref').value;
            const qtd = parseFloat($('draft-qtd').value);
            const unidade = $('draft-und').value;
            const refName = $('draft-ref').options[$('draft-ref').selectedIndex].text;
            if (!refId || !qtd || !unidade) { setStatus('Preencha todos os campos do item.', 'warn'); return; }

            this.draftItems.push({ tipo, referencia_id: refId, nome: refName, quantidade: qtd, unidade });
            this.renderDraftTable();
            $('draft-qtd').value = '';
        },
        renderDraftTable() {
            const tbody = $('tblDraft')?.querySelector('tbody'); if (!tbody) return;
            tbody.innerHTML = '';
            this.draftItems.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.tipo}</td><td>${item.nome}</td><td>${fmt(item.quantidade)}</td><td>${item.unidade}</td>
                                <td><button type="button" class="btn small" data-index="${index}">Remover</button></td>`;
                tbody.appendChild(tr);
            });
        },
        async saveRecipe(e) {
            e.preventDefault();
            const recipeData = getFormData('form-receita');
            const id = recipeData.id;
            delete recipeData.id;

            if (this.draftItems.length === 0) { setStatus('Adicione itens à receita.', 'err'); return; }
            setStatus('Salvando receita...');

            try {
                // Salva o cabeçalho
                const { data: savedRecipe, error: recError } = id
                    ? await supa.from('receitas').update(recipeData).eq('id', id).select().single()
                    : await supa.from('receitas').insert([recipeData]).select().single();
                if (recError) throw recError;

                // Apaga itens antigos (se for edição)
                if (id) await supa.from('receita_itens').delete().eq('receita_id', id);

                // Insere novos itens
                const itemsToInsert = this.draftItems.map(item => ({
                    receita_id: savedRecipe.id,
                    tipo: item.tipo,
                    referencia_id: item.referencia_id,
                    quantidade: item.quantidade,
                    unidade: item.unidade
                }));
                const { error: itemsError } = await supa.from('receita_itens').insert(itemsToInsert);
                if (itemsError) throw itemsError;

                setStatus('Receita salva com sucesso!', 'ok');
                hideEditor('recipe-editor-container');
                this.load();
            } catch (err) { setStatus(`Erro ao salvar receita: ${err.message}`, 'err'); }
        },
        handleTableClick(e) {
            const btn = e.target.closest('button'); if (!btn) return;
            const { act, id } = btn.dataset;
            if (act === 'edit') this.showRecipeForm(id);
            else if (act === 'toggle') GenericCRUD.toggle('receitas', id, () => this.load());
        },
        handleDraftTableClick(e) {
            const btn = e.target.closest('button'); if (!btn) return;
            this.draftItems.splice(btn.dataset.index, 1);
            this.renderDraftTable();
        }
    },

    // Módulo de Pratos e Componentes
    Pratos: {
        init() {
            const refresh = () => this.load();
            addSafeEventListener('btnNovoPrato', 'click', () => GenericCRUD.showForm('prato-editor-container', 'form-prato', 'prato-form-title', 'Novo Prato'));
            addSafeEventListener('btnCancelarPrato', 'click', () => hideEditor('prato-editor-container'));
            addSafeEventListener('form-prato', 'submit', (e) => GenericCRUD.save(e, 'pratos', 'prato-editor-container', refresh));
            addSafeEventListener('tblPratos', 'click', (e) => GenericCRUD.handleTableClick(e, 'pratos', 'prato-editor-container', 'form-prato', 'prato-form-title', refresh));
            
            // Componentes
            addSafeEventListener('cp-prato', 'change', e => this.loadComponentes(e.target.value));
            addSafeEventListener('btnAddPrComp', 'click', () => this.addComponente());
            addSafeEventListener('tblPrComp', 'click', e => this.handleComponenteTableClick(e));
        },
        load() {
            GenericCRUD.loadTable('pratos', 'tblPratos', ['nome', 'categoria_nome', 'preco_venda', 'total_receitas', 'ativo'], 'vw_pratos_resumo');
            AppModules.Auxiliares.fillOptionsFrom('pratos', 'cp-prato', 'id', 'nome', { ativo: true });
            AppModules.Auxiliares.fillOptionsFrom('receitas', 'cp-receita', 'id', 'nome', { ativo: true });
        },
        async loadComponentes(pratoId) {
            const editor = $('componentes-editor');
            const tbody = $('tblPrComp')?.querySelector('tbody');
            if (!tbody || !editor) return;
            if (!pratoId) { editor.style.display = 'none'; return; }
            
            editor.style.display = 'block';
            tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
            try {
                const { data, error } = await supa.from('vw_prato_componentes_detalhes').select('*').eq('prato_id', pratoId);
                if (error) throw error;
                tbody.innerHTML = '';
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${item.nome_receita}</td><td>${item.quantidade}</td><td>${item.unidade}</td>
                                    <td><button class="btn small bad" data-id="${item.id}">Remover</button></td>`;
                    tbody.appendChild(tr);
                });
            } catch (e) { tbody.innerHTML = '<tr><td colspan="4">Erro ao carregar.</td></tr>'; }
        },
        async addComponente() {
            const pratoId = $('cp-prato').value;
            const receitaId = $('cp-receita').value;
            const qtd = $('cp-qtd').value;
            const und = $('cp-und').value;
            if (!pratoId || !receitaId || !qtd) { setStatus('Preencha todos os campos.', 'warn'); return; }
            try {
                const { error } = await supa.from('prato_componentes').insert([{ prato_id: pratoId, receita_id: receitaId, quantidade: qtd, unidade: und }]);
                if (error) throw error;
                this.loadComponentes(pratoId);
                this.load(); // Recarrega a tabela de pratos para atualizar contagem
            } catch (e) { setStatus('Erro: verifique se este componente já foi adicionado.', 'err'); }
        },
        async handleComponenteTableClick(e) {
            const btn = e.target.closest('button'); if (!btn) return;
            const pratoId = $('cp-prato').value;
            if (confirm('Deseja remover este componente?')) {
                try {
                    const { error } = await supa.from('prato_componentes').delete().eq('id', btn.dataset.id);
                    if (error) throw error;
                    this.loadComponentes(pratoId);
                    this.load();
                } catch (e) { setStatus('Erro ao remover.', 'err'); }
            }
        }
    },

    // Módulo de Produção
    Producao: {
        init() {
            addSafeEventListener('btnCalcularPrev', 'click', () => this.calcularPrevisao());
        },
        async calcularPrevisao() {
            setStatus('Calculando previsão...');
            const params = {
                p_win_dias: parseInt($('win-dias').value),
                p_proj_dias: parseInt($('proj-dias').value),
                p_cat_ids: $$('#cat-filter option:checked').map(opt => opt.value)
            };
            if (params.p_cat_ids.length === 0) params.p_cat_ids = null;
            
            try {
                const { data, error } = await supa.rpc('calcular_previsao_producao', params);
                if (error) throw error;
                
                // Popula as tabelas com os resultados
                const { kpis, pratos, receitas } = data[0];
                $('kpi-dias').textContent = kpis.dias_analisados;
                $('kpi-pratos').textContent = kpis.pratos_considerados;
                $('kpi-rec').textContent = kpis.receitas_consolidadas;
                $('th-proj-prato').textContent = `Projeção (${kpis.dias_projetados}d)`;
                $('th-proj').textContent = `Qtd/Projeção (${kpis.dias_projetados}d)`;
                
                const renderTable = (tbodyId, data, cols) => {
                    const tbody = $(tbodyId); tbody.innerHTML = '';
                    data.forEach(row => {
                        const tr = document.createElement('tr');
                        cols.forEach(col => tr.innerHTML += `<td>${row[col] ?? '—'}</td>`);
                        tbody.appendChild(tr);
                    });
                };
                
                renderTable('tblResumoPratos', pratos, ['prato_nome', 'categoria_nome', 'media_dia', 'projecao_total']);
                renderTable('tblPrev', receitas, ['receita_nome', 'unidade', 'qtd_dia', 'qtd_projecao']);
                setStatus('Previsão calculada com sucesso!', 'ok');
            } catch (e) {
                setStatus(`Erro no cálculo: ${e.message}`, 'err');
                console.error(e);
            }
        }
    },

    // Módulo de Compras
    Compras: {
        init() {
            addSafeEventListener('btnRefreshSuggestions', 'click', () => this.load());
        },
        load() {
            GenericCRUD.loadTable('vw_sugestao_compras', 'tblSugestoes', ['nome_ingrediente', 'status_estoque', 'saldo_atual_formatado', 'estoque_min_formatado', 'sugestao_compra_formatada', 'unidade_medida'], null, false);
        }
    },

    // Módulo de Estoque
    Estoque: {
        init() {
            this.setupMovForm();
        },
        load() {
            GenericCRUD.loadTable('vw_saldo_local', 'tblSaldo', ['nome_item', 'tipo_item', 'local_nome', 'saldo', 'unidade', 'status_estoque'], null, false);
            GenericCRUD.loadTable('vw_saldo_lotes', 'tblSaldoLotes', ['nome_item', 'local_nome', 'lote', 'data_validade', 'saldo', 'custo_unitario'], null, false);
            GenericCRUD.loadTable('movimentacoes', 'tblEstoqueHist', ['data_hora', 'tipo', 'item_nome', 'tipo_item', 'quantidade', 'origem_nome', 'destino_nome', 'documento'], 'vw_movimentacoes_detalhes', false);
        },
        setupMovForm() {
            const btns = $$('.mov-actions button');
            btns.forEach(btn => btn.addEventListener('click', () => {
                const type = btn.dataset.movType;
                $('mov-form-title').textContent = `${btn.textContent} de Estoque`;
                $('mov-form-container').style.display = 'block';
                // Lógica para mostrar/esconder campos baseada no 'type'
            }));
            addSafeEventListener('btnMovCancel', 'click', () => hideEditor('mov-form-container'));
            addSafeEventListener('frmMov', 'submit', (e) => this.saveMovimentacao(e));
        },
        async saveMovimentacao(e) {
            e.preventDefault();
            // Implementar lógica de salvar movimentação
            setStatus('Funcionalidade de movimentação ainda não implementada.', 'warn');
        }
    }
};

/* ===== Função Principal de Inicialização ===== */
async function init() {
    try {
        setStatus('Inicializando sistema...');
        setupRouting();

        // Inicializa todos os módulos
        AppModules.Auxiliares.init();
        AppModules.Ingredientes.init();
        AppModules.Receitas.init();
        AppModules.Pratos.init();
        AppModules.Producao.init();
        AppModules.Compras.init();
        AppModules.Estoque.init();
        
        // Carrega dados iniciais das tabelas visíveis
        AppModules.Pratos.load();
        AppModules.Ingredientes.load();
        AppModules.Receitas.load();
        AppModules.Compras.load();
        AppModules.Estoque.load();
        
        setStatus('Pronto.', 'ok');
    } catch (e) {
        console.error("Erro fatal na inicialização:", e);
        setStatus(`Erro fatal: ${e.message}`, 'err');
    }
}

// Garante que o DOM esteja carregado antes de iniciar
document.addEventListener('DOMContentLoaded', init);
