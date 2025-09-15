// =================================================================================
// SCRIPT COMPLETO E INTEGRAL (v8.3 - Módulos Completamente Restaurados)
// =================================================================================

console.log("[DIAGNOSTICO v8.3] Script Iniciado. Versão Completa e Funcional.");

/* ===== Helpers com verificações de segurança ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{
    const el=$('status'); if(!el) return;
    el.textContent=msg;
    const colorMap = { 'err': 'var(--down)', 'ok': 'var(--ok)', 'warn': 'var(--warn)' };
    if (el && el.style) {
        el.style.color = colorMap[cls] || 'var(--muted)';
    }
};
const fmt=(n, digits=3)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits, minimumFractionDigits: digits}).format(+n||0);
const fmtMoney=(n)=> new Intl.NumberFormat('pt-BR',{style: 'currency', currency: 'BRL'}).format(+n||0);
const showEditor = (id) => { const el = $(id); if(el && el.style) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el && el.style) el.style.display = 'none'; };

const getFormData = (formId) => {
    const form = $(formId);
    if (!form) return {};
    const data = new FormData(form);
    const obj = {};
    for (let element of form.elements) {
        if (element.name) {
            if (element.type === 'checkbox') {
                obj[element.name] = element.checked;
            } else if (element.type === 'number' || element.dataset.type === 'number') {
                obj[element.name] = element.value ? parseFloat(element.value) : null;
            } else if (data.has(element.name)) {
                const value = data.get(element.name);
                obj[element.name] = value || null;
            }
        }
    }
    const idInput = form.querySelector('input[name="id"]');
    if (idInput && idInput.value) {
        obj.id = idInput.value;
    } else {
        delete obj.id;
    }
    return obj;
};

/* ===================== CONFIGURAÇÃO DA API ===================== */
const SUPABASE_URL  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';

var supa;
if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada!");
    setStatus("Erro: Biblioteca Supabase não carregada.", "err");
} else {
    try {
        supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } catch (e) {
        console.error("Falha ao inicializar o cliente Supabase:", e);
        setStatus("Erro: Falha ao conectar com o banco de dados.", "err");
    }
}

function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) { element.addEventListener(event, handler); }
}

/* ===== ROTEAMENTO POR ABAS ===== */
function setupRouting() {
  const mainTabsContainer = $('main-tabs');
  if (!mainTabsContainer) return;
  const mainContents = $$('.tab-content');
  const setupSubTabs = (containerId, contentSelector) => {
      const container = $(containerId);
      if (!container) return;
      const contents = $$(contentSelector);
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.subtab) return;
        const subTabId = btn.dataset.subtab;
        if (containerId !== 'estoque-subtabs') {
            $$('.editor-container').forEach(ed => hideEditor(ed.id));
        }
        $$('button', container).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        contents.forEach(content => content.classList.toggle('active', content.id === 'sub-' + subTabId));
      });
  };
  mainTabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset.tab) return;
    const tabId = btn.dataset.tab;
    $$('button', mainTabsContainer).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mainContents.forEach(content => content.classList.toggle('active', content.id === 'tab-' + tabId));
  });
  setupSubTabs('cadastro-subtabs', '#tab-cadastros .subpage');
  setupSubTabs('estoque-subtabs', '#tab-estoque .subpage');
}

/* ===== FUNÇÕES DE CARREGAMENTO (LOADERS) ===== */
async function fillOptionsFrom(table, selId, valKey, labelKey, whereEq, allowEmpty = true){
  const sel=$(selId);
  if(!sel) return;
  if (sel.options.length > (allowEmpty ? 1 : 0) && !sel.dataset.loading && !sel.dataset.forceReload) return;
  
  sel.dataset.loading = true;
  delete sel.dataset.forceReload;
  const previousHTML = sel.innerHTML;
  if (sel.options.length === 0 || allowEmpty) sel.innerHTML='<option value="">Carregando…</option>';

  try{
    let query=supa.from(table).select(`${valKey},${labelKey}`).order(labelKey,{ascending:true});
    if(whereEq) Object.entries(whereEq).forEach(([k,v])=> query=query.eq(k,v));
    const {data,error}=await query;
    if(error) throw error;

    sel.innerHTML = allowEmpty ? '<option value="">Selecione</option>' : '';
    (data||[]).forEach(x=>{ const o=document.createElement('option'); o.value=x[valKey]; o.textContent=x[labelKey]; sel.appendChild(o); });
  }catch(e){
    console.error(`Erro ao carregar options para ${selId}:`, e);
    sel.innerHTML= previousHTML || '<option value="">(Erro)</option>';
  } finally {
      delete sel.dataset.loading;
  }
}

/* ===== MÓDULO GENÉRICO DE CRUD ===== */
const GenericCRUD = {
    async loadTable(table, tableId, columns, actions = true, view = null) {
        const tb = $(tableId)?.querySelector('tbody');
        if (!tb) return;
        const source = view || table;
        let orderCol = columns.includes('nome') ? 'nome' : (columns.includes('data_hora') ? 'data_hora' : columns[0]);
        const ascending = !columns.includes('data_hora');
        tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando…</td></tr>`;

        try {
            const { data, error } = await supa.from(source).select('*').order(orderCol, { ascending: ascending }).limit(500);
            if (error) throw error;
            tb.innerHTML = '';
            if (!data || data.length === 0) {
                tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>`;
                return;
            }
            data.forEach(item => {
                const tr = document.createElement('tr');
                columns.forEach(col => {
                    const td = document.createElement('td');
                    if (col === 'ativo') {
                        td.innerHTML = item.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>';
                    } else if (col.includes('custo') || col.includes('preco')) {
                         td.textContent = fmtMoney(item[col]);
                    } else if (col === 'data_hora') {
                        td.textContent = new Date(item[col]).toLocaleString('pt-BR');
                    }
                    else {
                        td.textContent = item[col] || '—';
                    }
                    tr.appendChild(td);
                });
                if (actions) {
                    const tdActions = document.createElement('td');
                    tdActions.className = 'row-actions';
                    const toggleBtn = item.hasOwnProperty('ativo') ? `<button class="btn small" data-act="toggle" data-id="${item.id}">${item.ativo ? 'Desativar' : 'Ativar'}</button>` : '';
                    tdActions.innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button>${toggleBtn}`;
                    tr.appendChild(tdActions);
                }
                tb.appendChild(tr);
            });
        } catch (e) {
            console.error(`Erro ao carregar ${table}:`, e);
            tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Erro ao carregar.</td></tr>`;
        }
    },

    showForm(editorId, formId, titleId, titleText, data = null) {
        const form = $(formId);
        if (!form) return;
        form.reset();
        if ($(titleId)) $(titleId).textContent = titleText;
        if (data) {
            Object.keys(data).forEach(key => {
                const input = form.elements[key];
                if (input) {
                    if (input.type === 'checkbox') input.checked = data[key];
                    else input.value = data[key] || '';
                }
            });
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = data.id || '';
        } else {
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = '';
            if (form.elements['ativo'] && form.elements['ativo'].type === 'checkbox') {
                form.elements['ativo'].checked = true;
            }
        }
        showEditor(editorId);
    },

    async save(e, table, editorId, refreshCallback) {
        e.preventDefault();
        const form = e.target;
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
            setStatus('Por favor, preencha todos os campos obrigatórios.', 'err');
            if (typeof form.reportValidity === 'function') form.reportValidity();
            return;
        }
        const data = getFormData(e.target.id);
        const id = data.id;
        delete data.id;
        setStatus(`Salvando...`);
        try {
            const { error } = id ? await supa.from(table).update(data).eq('id', id) : await supa.from(table).insert([data]);
            if (error) throw error;
            setStatus(`Registro salvo com sucesso!`, 'ok');
            hideEditor(editorId);
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao salvar ${table}:`, err);
            setStatus(err.code === '23505' ? 'Erro: Já existe um registro com estes dados.' : `Erro: ${err.message}`, 'err');
        }
    },

    async toggle(table, id, refreshCallback) {
        setStatus('Atualizando status...');
        try {
            const { data, error: selectError } = await supa.from(table).select('ativo').eq('id', id).single();
            if (selectError || !data) throw new Error(selectError?.message || "Registro não encontrado.");
            const { error } = await supa.from(table).update({ ativo: !data.ativo }).eq('id', id);
            if (error) throw error;
            setStatus('Status atualizado.', 'ok');
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao alternar status em ${table}:`, err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },

    async handleTableClick(e, table, editorId, formId, titleId, refreshCallback) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const { act: action, id } = btn.dataset;

        if (action === 'toggle') {
            this.toggle(table, id, refreshCallback);
        } else if (action === 'edit') {
            if (table === 'pratos') hideEditor('prato-import-container');
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

/* ===== MÓDULO DE CADASTROS AUXILIARES ===== */
const AuxiliaresModule = {
    init() {
        this.setupCRUD('um', 'unidades_medida', ['sigla', 'nome', 'base', 'fator', 'ativo']);
        this.setupCRUD('unidades', 'unidades', ['nome', 'ativo']);
        this.setupCRUD('categorias', 'categorias', ['nome', 'tipo', 'ativo']);
        this.refreshAll();
    },

    setupCRUD(prefix, table, columns) {
        const editorId = `${prefix}-editor-container`;
        const formId = `form-${prefix}`;
        const titleId = `${prefix}-form-title`;
        const tableId = `tbl-${prefix}`;
        const capitalizedPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        const btnNewName = `btnShowNew${capitalizedPrefix}Form`;
        const btnCancelName = `btnCancel${capitalizedPrefix}Edit`;

        const refresh = () => {
            GenericCRUD.loadTable(table, tableId, columns);
            if (table === 'unidades_medida') this.refreshUMDropdowns();
            if (table === 'unidades') this.refreshUnidadesDropdowns();
            if (table === 'categorias') this.refreshCategoriasDropdowns(true);
        };
        addSafeEventListener(btnNewName, 'click', () => GenericCRUD.showForm(editorId, formId, titleId, `Novo Registro`));
        addSafeEventListener(btnCancelName, 'click', () => hideEditor(editorId));
        addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
        const tableEl = $(tableId);
        if (tableEl) {
             tableEl.addEventListener('click', (e) => GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh));
        }
    },
    
    refreshAll() {
        GenericCRUD.loadTable('unidades_medida', 'tbl-um', ['sigla', 'nome', 'base', 'fator', 'ativo']);
        GenericCRUD.loadTable('unidades', 'tbl-unidades', ['nome', 'ativo']);
        GenericCRUD.loadTable('categorias', 'tbl-categorias', ['nome', 'tipo', 'ativo']);
        this.refreshUMDropdowns();
        this.refreshUnidadesDropdowns();
        this.refreshCategoriasDropdowns();
    },

    refreshUMDropdowns() {
        fillOptionsFrom('unidades_medida', 'ing-unidade-medida', 'id', 'sigla', {ativo: true}, false);
        fillOptionsFrom('unidades_medida', 'draft-und', 'sigla', 'sigla', {ativo: true}, false);
    },

    refreshUnidadesDropdowns() {
        fillOptionsFrom('unidades', 'mov-unidade-origem', 'id', 'nome', {ativo: true});
        fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome', {ativo: true});
    },

    refreshCategoriasDropdowns(forceReload = false) {
        if(forceReload) {
            ['ing-categoria', 'prato-cat', 'cat-filter'].forEach(id => {
                const sel = $(id);
                if(sel) sel.dataset.forceReload = true;
            });
        }
        fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', {tipo: 'INGREDIENTE', ativo: true});
        fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', {tipo: 'PRATO', ativo: true});
        fillOptionsFrom('categorias', 'cat-filter', 'id', 'nome', {tipo: 'PRATO', ativo: true});
    }
};

/* ===== MÓDULO DE INGREDIENTES ===== */
const IngredientesModule = {
     init() {
        this.setupCRUD();
        this.loadIngredientes();
    },

    setupCRUD() {
        const table = 'ingredientes';
        const editorId = 'ingrediente-editor-container';
        const formId = 'form-ingrediente';
        const titleId = 'ingrediente-form-title';
        const tableId = 'tblIng';
        const refresh = () => {
            this.loadIngredientes();
            ReceitasModule.updateDraftRefOptions();
            EstoqueModule.updateMovItemDropdown();
        };
        addSafeEventListener('btnShowNewIngredienteForm', 'click', () => GenericCRUD.showForm(editorId, formId, titleId, 'Novo Ingrediente'));
        addSafeEventListener('btnCancelIngEdit', 'click', () => hideEditor(editorId));
        addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
        const tableEl = $(tableId);
        if (tableEl) tableEl.addEventListener('click', (e) => GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh));
    },

    loadIngredientes() {
        const columns = ['nome', 'categoria_nome', 'unidade_medida_sigla', 'custo_unitario', 'ativo'];
        GenericCRUD.loadTable('ingredientes', 'tblIng', columns, true, 'vw_ingredientes');
    }
}

/* ===== MÓDULO DE RECEITAS (FICHA TÉCNICA) ===== */
const ReceitasModule = {
    draftItems: [],
    init() {
        this.setupEventListeners();
        this.loadReceitas();
        this.updateDraftRefOptions();
    },
    setupEventListeners() {
        addSafeEventListener('btnShowNewRecipeForm', 'click', () => this.showRecipeForm());
        addSafeEventListener('btnCancelRecEdit', 'click', () => hideEditor('recipe-editor-container'));
        addSafeEventListener('form-receita', 'submit', (e) => this.saveRecipe(e));
        addSafeEventListener('draft-tipo', 'change', () => this.updateDraftRefOptions());
        addSafeEventListener('btnDraftAdd', 'click', () => this.addDraftItem());
        const tblRec = $('tblRec');
        if (tblRec) tblRec.addEventListener('click', (e) => this.handleRecipeTableClick(e));
        const tblDraft = $('tblDraft');
        if (tblDraft) tblDraft.addEventListener('click', (e) => this.handleDraftTableClick(e));
    },
    async loadReceitas() {
        GenericCRUD.loadTable('receitas', 'tblRec', ['nome', 'rendimento_formatado', 'total_itens', 'ativo'], true, 'vw_receitas_resumo');
    },
    updateDraftRefOptions() {
        const tipo = $('draft-tipo')?.value;
        if (!tipo) return;
        if (tipo === 'INGREDIENTE') {
            fillOptionsFrom('ingredientes', 'draft-ref', 'id', 'nome', {ativo: true});
        } else if (tipo === 'RECEITA') {
            fillOptionsFrom('receitas', 'draft-ref', 'id', 'nome', {ativo: true});
        }
    },
    async showRecipeForm(id = null) {
        const form = $('form-receita');
        if (!form) return;
        form.reset();
        this.draftItems = [];
        $('rec-id').value = '';
        $('recipe-form-title').textContent = id ? 'Editar Receita' : 'Nova Receita';
        if (id) {
            setStatus('Carregando receita para edição...');
            try {
                const { data: recData, error: recError } = await supa.from('receitas').select('*').eq('id', id).single();
                if (recError) throw recError;
                Object.keys(recData).forEach(key => {
                    const input = form.elements[key];
                    if(input) input.value = recData[key];
                });
                $('rec-id').value = id;
                const { data: itemsData, error: itemsError } = await supa.from('vw_receita_itens_detalhes').select('*').eq('receita_id', id);
                if (itemsError) throw itemsError;
                this.draftItems = itemsData.map(item => ({
                    tipo: item.tipo, referencia_id: item.referencia_id,
                    nome: item.nome_item, quantidade: item.quantidade, unidade: item.unidade
                }));
                setStatus('Receita carregada.', 'ok');
            } catch (e) {
                console.error("Erro ao carregar receita para edição:", e);
                setStatus(`Erro: ${e.message}`, 'err');
                return;
            }
        }
        this.renderDraftTable();
        this.updateDraftRefOptions();
        showEditor('recipe-editor-container');
    },
    async addDraftItem() {
        const tipo = $('draft-tipo').value;
        const refId = $('draft-ref').value;
        const qtd = parseFloat($('draft-qtd').value);
        const unidade = $('draft-und').value;
        const refSelect = $('draft-ref');
        const refName = refSelect.options[refSelect.selectedIndex]?.text;
        if (!refId || !qtd || qtd <= 0 || !unidade) {
            return setStatus('Preencha todos os campos do item corretamente.', 'err');
        }
        if (this.draftItems.some(item => item.tipo === tipo && item.referencia_id == refId)) {
            return setStatus('Este item já foi adicionado à receita.', 'warn');
        }
        this.draftItems.push({ tipo, referencia_id: refId, nome: refName, quantidade: qtd, unidade });
        this.renderDraftTable();
        $('draft-qtd').value = '';
        $('draft-ref').value = '';
    },
    renderDraftTable() {
        const tbody = $('tblDraft')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.draftItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.tipo}</td><td>${item.nome}</td>
                <td>${fmt(item.quantidade)}</td><td>${item.unidade}</td>
                <td><button type="button" class="btn small" data-act="remove-draft" data-index="${index}">Remover</button></td>`;
            tbody.appendChild(tr);
        });
    },
    async saveRecipe(e) {
        e.preventDefault();
        const recipeData = getFormData('form-receita');
        const id = recipeData.id;
        delete recipeData.id;
        if (this.draftItems.length === 0) {
            return setStatus('Adicione pelo menos um item à receita antes de salvar.', 'err');
        }
        setStatus('Salvando receita...');
        try {
            let savedRecipe;
            if (id) {
                const { data, error } = await supa.from('receitas').update(recipeData).eq('id', id).select().single();
                if (error) throw error;
                savedRecipe = data;
                await supa.from('receita_itens').delete().eq('receita_id', id);
            } else {
                const { data, error } = await supa.from('receitas').insert([recipeData]).select().single();
                if (error) throw error;
                savedRecipe = data;
            }
            const itemsToInsert = this.draftItems.map(item => ({
                receita_id: savedRecipe.id, tipo: item.tipo, referencia_id: item.referencia_id,
                quantidade: item.quantidade, unidade: item.unidade
            }));
            const { error: itemsError } = await supa.from('receita_itens').insert(itemsToInsert);
            if (itemsError) {
                if (!id) await supa.from('receitas').delete().eq('id', savedRecipe.id);
                throw itemsError;
            }
            setStatus('Receita salva com sucesso!', 'ok');
            hideEditor('recipe-editor-container');
            this.refreshAll();
        } catch (err) {
            console.error("Erro ao salvar receita:", err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },
    handleRecipeTableClick(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const { act: action, id } = btn.dataset;
        if (action === 'edit') this.showRecipeForm(id);
        else if (action === 'toggle') GenericCRUD.toggle('receitas', id, () => this.refreshAll());
    },
    handleDraftTableClick(e) {
        const btn = e.target.closest('button[data-act="remove-draft"]');
        if (!btn) return;
        this.draftItems.splice(parseInt(btn.dataset.index), 1);
        this.renderDraftTable();
    },
    refreshAll() {
        this.loadReceitas();
        this.updateDraftRefOptions();
        PratosModule.updatePratoComponentDropdowns();
        EstoqueModule.updateMovItemDropdown();
    }
};

/* ===== MÓDULO DE PRATOS E COMPONENTES ===== */
const PratosModule = {
    init() {
        this.setupPratoCRUD();
        this.setupComponentesEventListeners();
        this.loadPratos();
        this.updatePratoComponentDropdowns();
        this.setupImportEventListeners();
    },
    setupPratoCRUD() {
        const table = 'pratos';
        const editorId = 'prato-editor-container';
        const formId = 'form-prato';
        const titleId = 'prato-form-title';
        const tableId = 'tblPratos';
        const refresh = () => { this.loadPratos(); this.updatePratoComponentDropdowns(); };
        addSafeEventListener('btnNovoPrato', 'click', () => {
            hideEditor('prato-import-container');
            GenericCRUD.showForm(editorId, formId, titleId, 'Novo Prato');
        });
        addSafeEventListener('btnCancelarPrato', 'click', () => hideEditor(editorId));
        addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
        const tableEl = $(tableId);
        if (tableEl) {
             tableEl.addEventListener('click', (e) => GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh));
        }
    },
    setupComponentesEventListeners() {
        addSafeEventListener('cp-prato', 'change', (e) => this.loadComponentes(e.target.value));
        addSafeEventListener('btnAddPrComp', 'click', () => this.addComponente());
        const tblPrComp = $('tblPrComp');
        if (tblPrComp) tblPrComp.addEventListener('click', (e) => this.handleComponenteTableClick(e));
    },
    loadPratos() {
        GenericCRUD.loadTable('pratos', 'tblPratos', ['nome', 'categoria_nome', 'preco_venda', 'total_receitas', 'ativo'], true, 'vw_pratos_resumo');
    },
    updatePratoComponentDropdowns() {
        fillOptionsFrom('pratos', 'cp-prato', 'id', 'nome', {ativo: true});
        fillOptionsFrom('receitas', 'cp-receita', 'id', 'nome', {ativo: true});
    },
    async loadComponentes(pratoId) {
        const tbody = $('tblPrComp')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
        if (!pratoId) {
            tbody.innerHTML = '<tr><td colspan="3">Selecione um prato.</td></tr>';
            return;
        }
        try {
            const { data, error } = await supa.from('vw_prato_componentes_detalhes').select('*').eq('prato_id', pratoId).order('nome_receita', { ascending: true });
            if (error) throw error;
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Nenhuma receita associada.</td></tr>';
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${item.nome_receita}</td><td>${item.quantidade}</td><td><button class="btn small" data-act="remove-comp" data-id="${item.id}">Remover</button></td>`;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            console.error("Erro ao carregar componentes:", e);
            tbody.innerHTML = '<tr><td colspan="3">Erro ao carregar.</td></tr>';
        }
    },
    async addComponente() {
        const pratoId = $('cp-prato').value;
        const receitaId = $('cp-receita').value;
        const quantidade = parseFloat($('cp-qtd').value);
        if (!pratoId || !receitaId || !quantidade || quantidade <= 0) {
            setStatus("Preencha todos os campos para adicionar o componente.", 'err');
            return;
        }
        setStatus("Adicionando componente...");
        try {
            const { error } = await supa.from('prato_componentes').insert([{ prato_id: pratoId, receita_id: receitaId, quantidade: quantidade }]);
            if (error) throw error;
            setStatus("Componente adicionado!", 'ok');
            this.loadComponentes(pratoId);
            this.loadPratos();
        } catch (e) {
            console.error("Erro ao adicionar componente:", e);
            setStatus(e.code === '23505' ? "Erro: Esta receita já é um componente deste prato." : `Erro: ${e.message}`, 'err');
        }
    },
    async handleComponenteTableClick(e) {
        const btn = e.target.closest('button[data-act="remove-comp"]');
        if (!btn) return;
        const id = btn.dataset.id;
        const pratoId = $('cp-prato').value;
        if (confirm("Tem certeza que deseja remover este componente?")) {
            setStatus("Removendo...");
            try {
                const { error } = await supa.from('prato_componentes').delete().eq('id', id);
                if (error) throw error;
                setStatus("Componente removido.", 'ok');
                this.loadComponentes(pratoId);
                this.loadPratos();
            } catch (e) {
                console.error("Erro ao remover componente:", e);
                setStatus(`Erro: ${e.message}`, 'err');
            }
        }
    },
    setupImportEventListeners() {
        addSafeEventListener('btnImportarPratos', 'click', () => this.showImportUI());
        addSafeEventListener('btnCancelImport', 'click', () => hideEditor('prato-import-container'));
        addSafeEventListener('btnConfirmImport', 'click', () => this.confirmImport());
        addSafeEventListener('importCheckAll', 'click', (e) => {
            $$('#tblImportPratos tbody input[type="checkbox"]').forEach(chk => chk.checked = e.target.checked);
        });
    },
    showImportError(message, showSQLFix = false) {
        showEditor('import-error-detail');
        $('import-error-message').textContent = message;
        showSQLFix ? showEditor('import-sql-fix') : hideEditor('import-sql-fix');
    },
    hideImportError() {
        hideEditor('import-error-detail');
    },
    async showImportUI() {
        hideEditor('prato-editor-container');
        showEditor('prato-import-container');
        this.hideImportError();
        const loader = $('import-loader');
        const tbody = $('tblImportPratos')?.querySelector('tbody');
        const btnConfirm = $('btnConfirmImport');
        if (!tbody || !btnConfirm) return;
        tbody.innerHTML = '';
        showEditor('import-loader');
        $('importCheckAll').checked = false;
        btnConfirm.disabled = true;
        try {
            const { data, error } = await supa.rpc('get_unregistered_dishes');
            if (error) throw error;
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px;">Tudo certo! Todos os pratos vendidos já estão cadastrados.</td></tr>';
            } else {
                btnConfirm.disabled = false;
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    const categoriaSugerida = item.categoria_sugerida || '';
                    tr.innerHTML = `<td><input type="checkbox" data-nome="${encodeURIComponent(item.nome_prato)}" data-cat="${encodeURIComponent(categoriaSugerida)}"></td>
                                    <td>${item.nome_prato}</td>
                                    <td><span class="pill">${categoriaSugerida || '(Sem Categoria)'}</span></td>`;
                    tbody.appendChild(tr);
                });
            }
            setStatus('Lista de importação carregada.', 'ok');
        } catch (e) {
            console.error("Erro ao buscar pratos:", e);
            const functionMissing = e.code === '42883' || e.message.includes('function get_unregistered_dishes');
            const tableMissing = e.code === 'P0001' || e.message.includes('vendas_pratos');
            let errorMessage = `Detalhes: ${e.message}`;
            if (tableMissing) errorMessage = "A tabela de vendas (vendas_pratos) não foi encontrada ou está vazia. Importe os dados de vendas no Dashboard primeiro.";
            else if (functionMissing) errorMessage = "A função de busca 'get_unregistered_dishes' não foi encontrada no banco de dados.";
            this.showImportError(errorMessage, functionMissing && !tableMissing);
            setStatus(`Erro ao buscar pratos. Verifique os detalhes.`, 'err');
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--down);">Falha ao carregar. Verifique a caixa de erro.</td></tr>`;
        } finally {
            hideEditor('import-loader');
        }
    },
    async confirmImport() {
        const selectedItems = $$('#tblImportPratos tbody input[type="checkbox"]:checked');
        if (selectedItems.length === 0) return alert("Selecione pelo menos um prato.");
        setStatus('Iniciando importação...');
        const uniqueCategories = [...new Set(selectedItems.map(item => decodeURIComponent(item.dataset.cat)))].filter(Boolean);
        try {
            const { data: existingCats } = await supa.from('categorias').select('id, nome').eq('tipo', 'PRATO');
            const catMap = new Map(existingCats.map(c => [c.nome.toLowerCase(), c.id]));
            const catsToCreate = uniqueCategories.filter(name => !catMap.has(name.toLowerCase())).map(name => ({ nome: name, tipo: 'PRATO', ativo: true }));
            if (catsToCreate.length > 0) {
                setStatus(`Importando ${catsToCreate.length} novas categorias...`);
                const { data: insertedCats, error } = await supa.from('categorias').insert(catsToCreate).select('id, nome');
                if (error) throw error;
                insertedCats.forEach(c => catMap.set(c.nome.toLowerCase(), c.id));
                AuxiliaresModule.refreshCategoriasDropdowns(true);
            }
            const newPratosToInsert = selectedItems.map(item => {
                const nome = decodeURIComponent(item.dataset.nome);
                const catName = decodeURIComponent(item.dataset.cat);
                return { nome: nome, categoria_id: catName ? catMap.get(catName.toLowerCase()) : null, ativo: true, preco_venda: 0 };
            });
            if (newPratosToInsert.length > 0) {
                setStatus(`Importando ${newPratosToInsert.length} novos pratos...`);
                const { error } = await supa.from('pratos').insert(newPratosToInsert);
                if (error) throw error;
                setStatus(`Importação concluída! ${newPratosToInsert.length} pratos adicionados.`, 'ok');
            }
            hideEditor('prato-import-container');
            this.loadPratos();
            this.updatePratoComponentDropdowns();
        } catch (e) {
            console.error("Erro na importação de pratos:", e);
            setStatus(`Erro na importação: ${e.message}`, 'err');
        }
    }
};

/* ===== MÓDULO DE ESTOQUE ===== */
const EstoqueModule = {
    init() {
        this.setupEventListeners();
        this.loadAllStockData();
        this.updateMovItemDropdown();
        this.updateFieldVisibility();
    },
    setupEventListeners() {
        addSafeEventListener('form-movimentacao', 'submit', (e) => this.registrarMovimentacao(e));
        addSafeEventListener('btnMovCancel', 'click', () => this.clearForm());
        addSafeEventListener('mov-tipo', 'change', (e) => {
            this.updateFieldVisibility(e.target.value);
            this.updateMovItemDropdown(e.target.value);
             $$('#quick-actions-bar button').forEach(b => b.classList.toggle('active', b.dataset.quickmov === e.target.value));
        });
        const quickActions = $('quick-actions-bar');
        if (quickActions) {
            quickActions.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-quickmov]');
                if (btn) this.preFillMovement(btn.dataset.quickmov);
            });
        }
    },
    loadAllStockData() {
        this.loadSaldoGeral();
        this.loadSaldoLotes();
        this.loadHistorico();
    },
    loadSaldoGeral() { GenericCRUD.loadTable('vw_estoque_geral', 'tblEstoqueGeral', ['nome_item', 'quantidade_total', 'unidade_medida', 'custo_medio_formatado'], false); },
    loadSaldoLotes() { GenericCRUD.loadTable('vw_estoque_lotes', 'tblEstoqueLotes', ['nome_item', 'quantidade', 'unidade_medida', 'custo_unitario_formatado', 'data_validade', 'unidade_nome'], false); },
    loadHistorico() { GenericCRUD.loadTable('vw_movimentacoes_historico', 'tblHistorico', ['data_hora', 'tipo', 'nome_item', 'quantidade_formatada', 'origem_destino', 'usuario', 'obs'], false); },
    updateMovItemDropdown(tipo = null) {
        const sel = $('mov-item');
        if (!sel) return;
        sel.innerHTML = '<option value="">Selecione...</option>';
        sel.dataset.forceReload = true;
        const tipoMov = tipo || $('mov-tipo')?.value;
        if (tipoMov === 'PRODUCAO') {
            fillOptionsFrom('receitas', 'mov-item', 'id', 'nome', { ativo: true }, false);
        } else if (['ENTRADA', 'SAIDA', 'AJUSTE', 'TRANSFERENCIA'].includes(tipoMov)) {
            fillOptionsFrom('ingredientes', 'mov-item', 'id', 'nome', { ativo: true }, false);
        }
    },
    clearForm() {
        $('form-movimentacao')?.reset();
        this.updateFieldVisibility();
        $$('#quick-actions-bar button').forEach(b => b.classList.remove('active'));
    },
    preFillMovement(type) {
        const movTipo = $('mov-tipo');
        if (movTipo) {
            movTipo.value = type;
            movTipo.dispatchEvent(new Event('change'));
            $('mov-item')?.focus();
        }
    },
    updateFieldVisibility(type = null) {
        const tipo = type || $('mov-tipo')?.value;
        const fields = {
            custo: $('field-custo'), origem: $('field-origem'),
            destino: $('field-destino'), validade: $('field-validade')
        };
        const selects = {
            origem: $('mov-unidade-origem'), destino: $('mov-unidade-destino')
        };
        Object.values(selects).forEach(s => { if(s) s.required = false; });
        const show = {
            custo: ['ENTRADA', 'AJUSTE'].includes(tipo),
            validade: ['ENTRADA', 'PRODUCAO', 'AJUSTE'].includes(tipo),
            origem: ['SAIDA', 'TRANSFERENCIA', 'PRODUCAO', 'AJUSTE'].includes(tipo),
            destino: ['ENTRADA', 'TRANSFERENCIA', 'AJUSTE'].includes(tipo),
        };
        Object.keys(fields).forEach(key => {
            if (fields[key]) fields[key].style.display = show[key] ? 'block' : 'none';
        });
        if (show.origem && selects.origem && ['SAIDA', 'TRANSFERENCIA', 'PRODUCAO'].includes(tipo)) selects.origem.required = true;
        if (show.destino && selects.destino && ['ENTRADA', 'TRANSFERENCIA'].includes(tipo)) selects.destino.required = true;
    },
    async registrarMovimentacao(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) {
            form.reportValidity();
            setStatus("Preencha todos os campos obrigatórios.", "err");
            return;
        }
        const data = getFormData('form-movimentacao');
        const tipo = data.tipo;
        if (tipo === 'TRANSFERENCIA' && data.unidade_origem_id === data.unidade_destino_id) {
            return setStatus("A unidade de origem e destino não podem ser a mesma.", 'err');
        }
        setStatus("Registrando movimentação...");
        try {
            const { error } = await supa.from('movimentacoes').insert([
                {
                    tipo: data.tipo,
                    ingrediente_id: (tipo !== 'PRODUCAO' ? data.item_id : null),
                    receita_id: (tipo === 'PRODUCAO' ? data.item_id : null),
                    quantidade: data.quantidade,
                    custo_unitario: data.custo_unitario || 0,
                    unidade_origem_id: data.unidade_origem_id || null,
                    unidade_destino_id: data.unidade_destino_id || null,
                    data_validade: data.data_validade || null,
                    obs: data.obs || null
                }
            ]);
            if (error) throw error;
            setStatus("Movimentação registrada com sucesso!", 'ok');
            this.clearForm();
            this.loadAllStockData();
        } catch (e) {
            console.error("Erro ao registrar movimentação:", e);
            setStatus(`Erro: ${e.message}`, 'err');
        }
    }
};

/* ===== MÓDULO DE PRODUÇÃO (Previsão) ===== */
const ProducaoModule = {
    init() {
        addSafeEventListener('btnCalcularPrev', 'click', () => this.calcularPrevisao());
    },
    async calcularPrevisao() {
        const dataInicio = $('prev-data-inicio').value;
        const dataFim = $('prev-data-fim').value;
        const categoriaId = $('cat-filter').value;
        const tbody = $('tbl-previsao')?.querySelector('tbody');
        if (!tbody) return;
        if (!dataInicio || !dataFim) {
            return setStatus("Por favor, selecione as datas de início e fim.", 'err');
        }
        setStatus("Calculando previsão...");
        tbody.innerHTML = '<tr><td colspan="3">Calculando...</td></tr>';
        try {
            const { data, error } = await supa.rpc('calcular_previsao_venda', {
                p_data_inicio: dataInicio, p_data_fim: dataFim, p_categoria_id: categoriaId || null
            });
            if (error) throw error;
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Nenhum dado de venda encontrado para o período.</td></tr>';
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${item.nome_prato}</td><td>${item.total_vendido}</td><td>${fmt(item.previsao_ajustada, 2)}</td>`;
                    tbody.appendChild(tr);
                });
            }
            setStatus("Previsão calculada.", 'ok');
        } catch (e) {
            console.error("Erro ao calcular previsão:", e);
            let msg = e.message.includes('function calcular_previsao_venda') ? "Função 'calcular_previsao_venda' não encontrada no BD." : e.message;
            setStatus(`Erro: ${msg}`, 'err');
            tbody.innerHTML = '<tr><td colspan="3">Erro ao calcular.</td></tr>';
        }
    }
};

/* ===== MÓDULO DE COMPRAS ===== */
const ComprasModule = {
    init() {
        addSafeEventListener('btnRefreshSuggestions', 'click', () => this.loadSuggestions());
        this.loadSuggestions();
    },
    async loadSuggestions() {
        const tbody = $('tbl-sugestoes')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5">Carregando sugestões...</td></tr>';
        setStatus("Buscando sugestões de compra...");
        try {
            const { data, error } = await supa.from('vw_sugestao_compras').select('*');
            if (error) throw error;
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Nenhum item precisa de reposição no momento.</td></tr>';
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${item.nome_ingrediente}</td>
                        <td>${fmt(item.estoque_atual)} ${item.unidade_medida}</td>
                        <td>${fmt(item.ponto_pedido)} ${item.unidade_medida}</td>
                        <td><strong style="color:var(--down)">${fmt(item.sugestao_compra)} ${item.unidade_medida}</strong></td>
                        <td>${item.ultimo_fornecedor || 'N/D'}</td>`;
                    tbody.appendChild(tr);
                });
            }
            setStatus("Sugestões carregadas.", 'ok');
        } catch (e) {
            console.error("Erro ao carregar sugestões:", e);
            setStatus(`Erro ao carregar sugestões: ${e.message}`, 'err');
            tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar.</td></tr>';
        }
    }
};

/* ===== INICIALIZAÇÃO PRINCIPAL ===== */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof supa === 'undefined') {
        setStatus("Erro crítico: Cliente Supabase não inicializado.", 'err');
        return;
    }
    setupRouting();
    try {
        // CORREÇÃO: Todos os módulos agora são inicializados
        AuxiliaresModule.init();
        IngredientesModule.init();
        ReceitasModule.init();
        PratosModule.init();
        EstoqueModule.init();
        ProducaoModule.init();
        ComprasModule.init();
        
        setStatus("Aplicação carregada e pronta.", 'ok');
    } catch (e) {
        console.error("Erro durante a inicialização dos módulos:", e);
        setStatus(`Erro na inicialização: ${e.message}`, 'err');
    }
});
