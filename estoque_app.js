// =================================================================================
// SCRIPT COMPLETO, UNIFICADO E REVISADO (v3.6 com Importador)
// =================================================================================

/* ===== Helpers com verificações de segurança ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{
    const el=$('status'); if(!el) return; 
    el.textContent=msg; 
    const colorMap = { 'err': 'var(--down)', 'ok': 'var(--ok)', 'warn': 'var(--warn)' };
    el.style.color = colorMap[cls] || 'var(--muted)';
};
const fmt=(n, digits=3)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits, minimumFractionDigits: digits}).format(+n||0);
const fmtMoney=(n)=> new Intl.NumberFormat('pt-BR',{style: 'currency', currency: 'BRL'}).format(+n||0);
const showEditor = (id) => { const el = $(id); if(el) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el) el.style.display = 'none'; };

const getFormData = (formId) => {
    const form = $(formId);
    if (!form) return {};
    const data = new FormData(form);
    const obj = {};
    for (let element of form.elements) {
        if (element.name) {
            if (element.type === 'checkbox') {
                obj[element.name] = element.checked;
            } else if (element.type === 'number') {
                obj[element.name] = element.value ? parseFloat(element.value) : null;
            } else if (data.has(element.name)) {
                const value = data.get(element.name);
                obj[element.name] = value ? value : null;
            }
        }
    }
    const idInput = form.querySelector('input[name="id"]');
    if (idInput && idInput.value) {
        obj.id = idInput.value;
    }
    return obj;
};

/* ===================== CONFIGURAÇÃO DA API (PROJETO ESTOQUE) ===================== */
const SUPABASE_URL_ESTOQUE  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON_ESTOQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
// =================================================================================

// Inicialização segura do Supabase para o projeto de ESTOQUE
var supaEstoque;
if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada!");
} else {
    try {
        supaEstoque = supabase.createClient(SUPABASE_URL_ESTOQUE, SUPABASE_ANON_ESTOQUE);
    } catch (e) {
        console.error("Falha ao inicializar o cliente Supabase para Estoque:", e);
    }
}

function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) { element.addEventListener(event, handler); }
    else { console.warn(`Elemento não encontrado para listener: ${id}`); }
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
        if (!btn) return;
        const subTabId = btn.dataset.subtab;
        if (!subTabId) return;
        $$('button', container).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        contents.forEach(content => content.classList.toggle('active', content.id === 'sub-' + subTabId));
      });
  };
 
  mainTabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
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
  if (sel.options.length > (allowEmpty ? 1 : 0) && !sel.dataset.loading) return;
 
  sel.dataset.loading = true;
  const previousHTML = sel.innerHTML;
  if (sel.options.length === 0 || allowEmpty) sel.innerHTML='<option value="">Carregando…</option>';
 
  try{
    let query=supaEstoque.from(table).select(`${valKey},${labelKey}`).order(labelKey,{ascending:true});
    if(whereEq) Object.entries(whereEq).forEach(([k,v])=> query=query.eq(k,v));
    const {data,error}=await query;
    if(error) throw error;
   
    sel.innerHTML = allowEmpty ? '<option value="">Selecione</option>' : '';
    (data||[]).forEach(x=>{ const o=document.createElement('option'); o.value=x[valKey]; o.textContent=x[labelKey]; sel.appendChild(o); });
  }catch(e){
    console.error(`Erro ao carregar options para ${selId}:`, e);
    if (e.message.includes('Failed to fetch')) {
        setStatus('Erro de conexão (Failed to Fetch). Verifique as credenciais do Supabase.', 'err');
    }
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
        let orderCol = columns[0];
        if (columns.includes('nome')) orderCol = 'nome';
        else if (columns.includes('data_hora')) orderCol = 'data_hora';
        const ascending = !columns.includes('data_hora'); 
        tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando…</td></tr>`;
       
        try {
            const { data, error } = await supaEstoque.from(source).select('*').order(orderCol, { ascending: ascending }).limit(500);
            if (error) throw error;
            tb.innerHTML = '';
            (data || []).forEach(item => {
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
                    tdActions.innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button>
                                           <button class="btn small" data-act="toggle" data-id="${item.id}">${item.ativo ? 'Desativar' : 'Ativar'}</button>`;
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
        setStatus(`Salvando...`);
        try {
            let query = id ? supaEstoque.from(table).update(data).eq('id', id) : supaEstoque.from(table).insert([data]);
            const { error } = await query;
            if (error) throw error;
            setStatus(`Registro salvo com sucesso!`, 'ok');
            hideEditor(editorId);
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao salvar ${table}:`, err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },
    async toggle(table, id, refreshCallback) {
        setStatus('Atualizando status...');
        try {
            const { data, error: selectError } = await supaEstoque.from(table).select('ativo').eq('id', id).single();
            if (selectError || !data) throw new Error(selectError?.message || "Registro não encontrado.");
            const { error } = await supaEstoque.from(table).update({ ativo: !data.ativo }).eq('id', id);
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
        const action = btn.dataset.act;
        const id = btn.dataset.id;
        if (action === 'toggle') {
            this.toggle(table, id, refreshCallback);
        } else if (action === 'edit') {
            try {
                const { data, error } = await supaEstoque.from(table).select('*').eq('id', id).single();
                if (error) throw error;
                this.showForm(editorId, formId, titleId, `Editar Registro`, data);
            } catch (err) {
                setStatus(`Erro ao carregar dados: ${err.message}`, 'err');
            }
        }
    }
};

// ... (Restante dos módulos: AuxiliaresModule, IngredientesModule, ReceitasModule, PratosModule, etc.,
//      com todas as instâncias de `supa.` trocadas por `supaEstoque.`)
// A substituição completa é longa, então o código abaixo representa essa mudança.

/* ===== MÓDULO DE CADASTROS AUXILIARES ===== */
const AuxiliaresModule = {
    init() { this.setupCRUD('um', 'unidades_medida', ['sigla', 'nome', 'base', 'fator', 'ativo']); this.setupCRUD('unidades', 'unidades', ['nome', 'ativo']); this.setupCRUD('categorias', 'categorias', ['nome', 'tipo', 'ativo']); this.refreshAll(); },
    setupCRUD(prefix, table, columns) {
        const editorId = `${prefix}-editor-container`, formId = `form-${prefix}`, titleId = `${prefix}-form-title`, tableId = `tbl-${prefix}`, capPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1), btnNew = `btnShowNew${capPrefix}Form`, btnCancel = `btnCancel${capPrefix}Edit`;
        const refresh = () => { GenericCRUD.loadTable(table, tableId, columns); if (table === 'unidades_medida') this.refreshUMDropdowns(); if (table === 'unidades') this.refreshUnidadesDropdowns(); if (table === 'categorias') this.refreshCategoriasDropdowns(true); };
        addSafeEventListener(btnNew, 'click', () => GenericCRUD.showForm(editorId, formId, titleId, `Novo Registro`)); addSafeEventListener(btnCancel, 'click', () => hideEditor(editorId)); addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
        const tableEl = $(tableId); if (tableEl) tableEl.addEventListener('click', (e) => GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh));
    },
    refreshAll() { GenericCRUD.loadTable('unidades_medida', 'tbl-um', ['sigla', 'nome', 'base', 'fator', 'ativo']); GenericCRUD.loadTable('unidades', 'tbl-unidades', ['nome', 'ativo']); GenericCRUD.loadTable('categorias', 'tbl-categorias', ['nome', 'tipo', 'ativo']); this.refreshUMDropdowns(); this.refreshUnidadesDropdowns(); this.refreshCategoriasDropdowns(); },
    refreshUMDropdowns() { fillOptionsFrom('unidades_medida', 'ing-unidade-medida', 'id', 'sigla', {ativo: true}, false); fillOptionsFrom('unidades_medida', 'draft-und', 'sigla', 'sigla', {ativo: true}, false); },
    refreshUnidadesDropdowns() { fillOptionsFrom('unidades', 'ing-local-armazenagem', 'id', 'nome', {ativo: true}); fillOptionsFrom('unidades', 'mov-unidade-origem', 'id', 'nome', {ativo: true}); fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome', {ativo: true}); },
    refreshCategoriasDropdowns(forceReload = false) {
        fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', {tipo: 'INGREDIENTE', ativo: true}); fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', {tipo: 'PRATO', ativo: true});
        const catFilter = $('cat-filter');
        if (catFilter && (catFilter.options.length <= 1 || forceReload)) {
            if (typeof supaEstoque !== 'undefined' && supaEstoque.from) {
                catFilter.innerHTML = '<option value="">Todas</option>';
                supaEstoque.from('categorias').select('id, nome').eq('tipo', 'PRATO').eq('ativo', true).order('nome').then(({data, error}) => {
                    if (!error && data) data.forEach(cat => { const opt = document.createElement('option'); opt.value = cat.id; opt.textContent = cat.nome; catFilter.appendChild(opt); });
                });
            }
        }
    }
};

/* ===== MÓDULO DE INGREDIENTES ===== */
const IngredientesModule = {
    init() { this.setupCRUD(); this.loadIngredientes(); },
    setupCRUD() {
        const table = 'ingredientes', editorId = 'ingrediente-editor-container', formId = 'form-ingrediente', titleId = 'ingrediente-form-title', tableId = 'tblIng';
        const refresh = () => { this.loadIngredientes(); ReceitasModule.updateDraftRefOptions(); EstoqueModule.updateMovItemDropdown(); };
        addSafeEventListener('btnShowNewIngredienteForm', 'click', () => GenericCRUD.showForm(editorId, formId, titleId, 'Novo Ingrediente')); addSafeEventListener('btnCancelIngEdit', 'click', () => hideEditor(editorId)); addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
        const tableEl = $(tableId); if (tableEl) tableEl.addEventListener('click', (e) => GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh));
    },
    loadIngredientes() { GenericCRUD.loadTable('ingredientes', 'tblIng', ['nome', 'categoria_nome', 'unidade_medida_sigla', 'custo_unitario', 'ativo'], true, 'vw_ingredientes'); }
};

/* ===== MÓDULO DE RECEITAS ===== */
const ReceitasModule = {
    draftItems: [],
    init() { this.setupEventListeners(); this.loadReceitas(); this.updateDraftRefOptions(); },
    setupEventListeners() { addSafeEventListener('btnShowNewRecipeForm', 'click', () => this.showRecipeForm()); addSafeEventListener('btnCancelRecEdit', 'click', () => hideEditor('recipe-editor-container')); addSafeEventListener('form-receita', 'submit', (e) => this.saveRecipe(e)); addSafeEventListener('draft-tipo', 'change', () => this.updateDraftRefOptions()); addSafeEventListener('btnDraftAdd', 'click', () => this.addDraftItem()); const tblRec = $('tblRec'); if (tblRec) tblRec.addEventListener('click', (e) => this.handleRecipeTableClick(e)); const tblDraft = $('tblDraft'); if (tblDraft) tblDraft.addEventListener('click', (e) => this.handleDraftTableClick(e)); },
    async loadReceitas() { GenericCRUD.loadTable('receitas', 'tblRec', ['nome', 'rendimento_formatado', 'total_itens', 'ativo'], true, 'vw_receitas_resumo'); },
    updateDraftRefOptions() { const tipo = $('draft-tipo')?.value; if (!tipo) return; if (tipo === 'INGREDIENTE') fillOptionsFrom('ingredientes', 'draft-ref', 'id', 'nome', {ativo: true}); else if (tipo === 'RECEITA') fillOptionsFrom('receitas', 'draft-ref', 'id', 'nome', {ativo: true}); },
    async showRecipeForm(id = null) {
        const form = $('form-receita'); if (!form) return; form.reset(); this.draftItems = []; $('rec-id').value = ''; $('recipe-form-title').textContent = id ? 'Editar Receita' : 'Nova Receita';
        if (id) {
            setStatus('Carregando receita...');
            try {
                const { data: recData, error: recError } = await supaEstoque.from('receitas').select('*').eq('id', id).single(); if (recError) throw recError;
                Object.keys(recData).forEach(key => { const input = form.elements[key]; if(input) input.value = recData[key]; }); $('rec-id').value = id;
                const { data: itemsData, error: itemsError } = await supaEstoque.from('vw_receita_itens_detalhes').select('*').eq('receita_id', id); if (itemsError) throw itemsError;
                this.draftItems = itemsData.map(item => ({ tipo: item.tipo, referencia_id: item.referencia_id, nome: item.nome_item, quantidade: item.quantidade, unidade: item.unidade }));
                setStatus('Receita carregada.', 'ok');
            } catch (e) { console.error("Erro ao carregar receita:", e); setStatus(`Erro: ${e.message}`, 'err'); return; }
        }
        this.renderDraftTable(); this.updateDraftRefOptions(); showEditor('recipe-editor-container');
    },
    addDraftItem() {
        const tipo = $('draft-tipo').value, refId = $('draft-ref').value, qtd = parseFloat($('draft-qtd').value), unidade = $('draft-und').value, refSelect = $('draft-ref'), refName = refSelect.options[refSelect.selectedIndex]?.text;
        if (!refId || !qtd || qtd <= 0 || !unidade) { setStatus('Preencha todos os campos do item.', 'err'); return; }
        if (this.draftItems.some(item => item.tipo === tipo && item.referencia_id == refId)) { setStatus('Este item já foi adicionado.', 'warn'); return; }
        this.draftItems.push({ tipo, referencia_id: refId, nome: refName, quantidade: qtd, unidade });
        this.renderDraftTable(); $('draft-qtd').value = ''; $('draft-ref').value = '';
    },
    renderDraftTable() {
        const tbody = $('tblDraft')?.querySelector('tbody'); if (!tbody) return; tbody.innerHTML = '';
        this.draftItems.forEach((item, index) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.tipo}</td><td>${item.nome}</td><td>${fmt(item.quantidade)}</td><td>${item.unidade}</td><td><button type="button" class="btn small" data-act="remove-draft" data-index="${index}">Remover</button></td>`; tbody.appendChild(tr); });
    },
    async saveRecipe(e) {
        e.preventDefault(); const recipeData = getFormData('form-receita'), id = recipeData.id; delete recipeData.id;
        if (this.draftItems.length === 0) { setStatus('Adicione pelo menos um item à receita.', 'err'); return; }
        setStatus('Salvando receita...');
        try {
            let savedRecipe;
            if (id) {
                const { data, error } = await supaEstoque.from('receitas').update(recipeData).eq('id', id).select().single(); if (error) throw error; savedRecipe = data;
                await supaEstoque.from('receita_itens').delete().eq('receita_id', id);
            } else {
                const { data, error } = await supaEstoque.from('receitas').insert([recipeData]).select().single(); if (error) throw error; savedRecipe = data;
            }
            const itemsToInsert = this.draftItems.map(item => ({ receita_id: savedRecipe.id, tipo: item.tipo, referencia_id: item.referencia_id, quantidade: item.quantidade, unidade: item.unidade }));
            const { error: itemsError } = await supaEstoque.from('receita_itens').insert(itemsToInsert);
            if (itemsError) { if (!id) await supaEstoque.from('receitas').delete().eq('id', savedRecipe.id); throw itemsError; }
            setStatus('Receita salva com sucesso!', 'ok'); hideEditor('recipe-editor-container'); this.refreshAll();
        } catch (err) { console.error("Erro ao salvar receita:", err); setStatus(`Erro: ${err.message}`, 'err'); }
    },
    handleRecipeTableClick(e) { const btn = e.target.closest('button'); if (!btn) return; const action = btn.dataset.act, id = btn.dataset.id; if (action === 'edit') this.showRecipeForm(id); else if (action === 'toggle') GenericCRUD.toggle('receitas', id, () => this.refreshAll()); },
    handleDraftTableClick(e) { const btn = e.target.closest('button'); if (!btn || btn.dataset.act !== 'remove-draft') return; const index = parseInt(btn.dataset.index); this.draftItems.splice(index, 1); this.renderDraftTable(); },
    refreshAll() { this.loadReceitas(); this.updateDraftRefOptions(); PratosModule.updatePratoComponentDropdowns(); EstoqueModule.updateMovItemDropdown(); }
};

/* ===== MÓDULO DE PRATOS E COMPONENTES ===== */
const PratosModule = {
    init() { this.setupPratoCRUD(); this.setupComponentesEventListeners(); this.loadPratos(); this.updatePratoComponentDropdowns(); this.setupImportEventListeners(); },
    setupPratoCRUD() {
        const table = 'pratos', editorId = 'prato-editor-container', formId = 'form-prato', titleId = 'prato-form-title', tableId = 'tblPratos';
        const refresh = () => { this.loadPratos(); this.updatePratoComponentDropdowns(); };
        addSafeEventListener('btnNovoPrato', 'click', () => { hideEditor('prato-import-container'); GenericCRUD.showForm(editorId, formId, titleId, 'Novo Prato'); }); addSafeEventListener('btnCancelarPrato', 'click', () => hideEditor(editorId)); addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
        const tableEl = $(tableId); if (tableEl) tableEl.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (btn && btn.dataset.act === 'edit') hideEditor('prato-import-container'); GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh) });
    },
    setupComponentesEventListeners() { addSafeEventListener('cp-prato', 'change', (e) => this.loadComponentes(e.target.value)); addSafeEventListener('btnAddPrComp', 'click', () => this.addComponente()); const tblPrComp = $('tblPrComp'); if (tblPrComp) tblPrComp.addEventListener('click', (e) => this.handleComponenteTableClick(e)); },
    loadPratos() { GenericCRUD.loadTable('pratos', 'tblPratos', ['nome', 'categoria_nome', 'preco_venda', 'total_receitas', 'ativo'], true, 'vw_pratos_resumo'); },
    updatePratoComponentDropdowns() { fillOptionsFrom('pratos', 'cp-prato', 'id', 'nome', {ativo: true}); fillOptionsFrom('receitas', 'cp-receita', 'id', 'nome', {ativo: true}); },
    async loadComponentes(pratoId) {
        const tbody = $('tblPrComp')?.querySelector('tbody'); if (!tbody) return; tbody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>'; if (!pratoId) { tbody.innerHTML = '<tr><td colspan="3">Selecione um prato.</td></tr>'; return; }
        try {
            const { data, error } = await supaEstoque.from('vw_prato_componentes_detalhes').select('*').eq('prato_id', pratoId).order('nome_receita', { ascending: true }); if (error) throw error;
            tbody.innerHTML = ''; data.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.nome_receita}</td><td>${item.quantidade}</td><td><button class="btn small" data-act="remove-comp" data-id="${item.id}">Remover</button></td>`; tbody.appendChild(tr); });
            if (data.length === 0) tbody.innerHTML = '<tr><td colspan="3">Nenhuma receita associada.</td></tr>';
        } catch (e) { console.error("Erro ao carregar componentes:", e); tbody.innerHTML = '<tr><td colspan="3">Erro ao carregar.</td></tr>'; }
    },
    async addComponente() {
        const pratoId = $('cp-prato').value, receitaId = $('cp-receita').value, quantidade = parseFloat($('cp-qtd').value);
        if (!pratoId || !receitaId || !quantidade || quantidade <= 0) { setStatus("Preencha todos os campos.", 'err'); return; } setStatus("Adicionando...");
        try {
            const { error } = await supaEstoque.from('prato_componentes').insert([{ prato_id: pratoId, receita_id: receitaId, quantidade }]); if (error) throw error;
            setStatus("Componente adicionado!", 'ok'); this.loadComponentes(pratoId); this.loadPratos();
        } catch (e) { console.error("Erro ao adicionar:", e); if (e.code === '23505') setStatus("Erro: Esta receita já é um componente.", 'err'); else setStatus(`Erro: ${e.message}`, 'err'); }
    },
    async handleComponenteTableClick(e) {
        const btn = e.target.closest('button'); if (!btn || btn.dataset.act !== 'remove-comp') return; const id = btn.dataset.id, pratoId = $('cp-prato').value;
        if (confirm("Remover este componente?")) {
            setStatus("Removendo...");
            try {
                const { error } = await supaEstoque.from('prato_componentes').delete().eq('id', id); if (error) throw error;
                setStatus("Componente removido.", 'ok'); this.loadComponentes(pratoId); this.loadPratos();
            } catch (e) { console.error("Erro ao remover:", e); setStatus(`Erro: ${e.message}`, 'err'); }
        }
    },
    setupImportEventListeners() { addSafeEventListener('btnImportarPratos', 'click', () => this.showImportUI()); addSafeEventListener('btnCancelImport', 'click', () => hideEditor('prato-import-container')); addSafeEventListener('btnConfirmImport', 'click', () => this.confirmImport()); addSafeEventListener('importCheckAll', 'click', (e) => $$('#tblImportPratos tbody input[type="checkbox"]').forEach(chk => chk.checked = e.target.checked)); },
    async showImportUI() {
        hideEditor('prato-editor-container'); showEditor('prato-import-container');
        const loader = $('import-loader'), tbody = $('#tblImportPratos tbody'); if (!tbody) return; tbody.innerHTML = ''; if (loader) loader.style.display = 'block'; if ($('importCheckAll')) $('importCheckAll').checked = false;
        try {
            const { data, error } = await supaEstoque.rpc('get_unregistered_dishes'); if (error) throw error;
            if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="3">Todos os pratos vendidos já estão cadastrados.</td></tr>'; $('btnConfirmImport').disabled = true; }
            else {
                $('btnConfirmImport').disabled = false;
                data.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td><input type="checkbox" data-nome="${encodeURIComponent(item.nome_prato)}" data-cat="${encodeURIComponent(item.categoria_sugerida)}"></td><td>${item.nome_prato}</td><td><span class="pill">${item.categoria_sugerida}</span></td>`; tbody.appendChild(tr); });
            }
        } catch (e) { console.error("Erro ao buscar pratos:", e); let msg = e.message; if (e.code === '42883' || msg.includes('function get_unregistered_dishes')) msg = "Função 'get_unregistered_dishes' não encontrada."; setStatus(`Erro: ${msg}`, 'err'); tbody.innerHTML = `<tr><td colspan="3">Erro ao carregar dados.</td></tr>`;
        } finally { if (loader) loader.style.display = 'none'; }
    },
    async confirmImport() {
        const selectedItems = $$('#tblImportPratos tbody input[type="checkbox"]:checked'); if (selectedItems.length === 0) { alert("Selecione pelo menos um prato."); return; }
        setStatus('Importando...');
        const uniqueCategories = [...new Set(selectedItems.map(item => decodeURIComponent(item.dataset.cat)))].filter(Boolean);
        try {
            const { data: existingCats, error: catError } = await supaEstoque.from('categorias').select('id, nome').eq('tipo', 'PRATO'); if (catError) throw catError;
            const catMap = new Map(existingCats.map(c => [c.nome.toLowerCase(), c.id]));
            const catsToCreate = uniqueCategories.filter(name => !catMap.has(name.toLowerCase())).map(name => ({ nome: name, tipo: 'PRATO', ativo: true }));
            if (catsToCreate.length > 0) {
                setStatus(`Criando ${catsToCreate.length} novas categorias...`);
                const { data: insertedCats, error: newCatError } = await supaEstoque.from('categorias').insert(catsToCreate).select('id, nome'); if (newCatError) throw newCatError;
                insertedCats.forEach(c => catMap.set(c.nome.toLowerCase(), c.id)); AuxiliaresModule.refreshCategoriasDropdowns(true); 
            }
            setStatus('Preparando pratos...');
            const newPratosToInsert = selectedItems.map(item => { const nome = decodeURIComponent(item.dataset.nome), catName = decodeURIComponent(item.dataset.cat), categoriaId = catName ? catMap.get(catName.toLowerCase()) : null; return { nome, categoria_id: categoriaId, ativo: true, peso_volume: 0, unidade_peso_volume: 'g', preco_venda: 0 }; });
            if (newPratosToInsert.length > 0) {
                setStatus(`Importando ${newPratosToInsert.length} pratos...`);
                const { error: pratoError } = await supaEstoque.from('pratos').insert(newPratosToInsert); if (pratoError) throw pratoError;
                setStatus(`Importação concluída!`, 'ok');
            }
            hideEditor('prato-import-container'); this.loadPratos(); this.updatePratoComponentDropdowns();
        } catch (e) { console.error("Erro na importação:", e); if (e.code === '23505') setStatus(`Erro: Um ou mais pratos já existem.`, 'err'); else setStatus(`Erro na importação: ${e.message}`, 'err'); }
    }
};

/* ===== MÓDULO DE PRODUÇÃO ===== */
const ProducaoModule = {
    init() { addSafeEventListener('btnCalcularPrev', 'click', () => this.calcularPrevisao()); },
    async calcularPrevisao() {
        const dataInicio = $('prev-data-inicio').value, dataFim = $('prev-data-fim').value, categoriaId = $('cat-filter').value, tbody = $('tbl-previsao')?.querySelector('tbody');
        if (!tbody) return; if (!dataInicio || !dataFim) { setStatus("Selecione as datas.", 'err'); return; }
        setStatus("Calculando..."); tbody.innerHTML = '<tr><td colspan="3">Calculando...</td></tr>';
        try {
            const { data, error } = await supaEstoque.rpc('calcular_previsao_venda', { p_data_inicio: dataInicio, p_data_fim: dataFim, p_categoria_id: categoriaId || null });
            if (error) throw error; tbody.innerHTML = '';
            if (data.length === 0) tbody.innerHTML = '<tr><td colspan="3">Nenhum dado de venda encontrado.</td></tr>';
            else data.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.nome_prato}</td><td>${item.total_vendido}</td><td>${fmt(item.previsao_ajustada, 2)}</td>`; tbody.appendChild(tr); });
            setStatus("Previsão calculada.", 'ok');
        } catch (e) { console.error("Erro ao calcular previsão:", e); let msg = e.message; if (e.code === '42883' || msg.includes('function calcular_previsao_venda')) msg = "Função 'calcular_previsao_venda' não encontrada."; setStatus(`Erro: ${msg}`, 'err'); tbody.innerHTML = '<tr><td colspan="3">Erro ao calcular.</td></tr>'; }
    }
};

/* ===== MÓDULO DE ESTOQUE ===== */
const EstoqueModule = {
    init() { this.setupEventListeners(); this.refreshAll(); },
    setupEventListeners() { addSafeEventListener('form-movimentacao', 'submit', (e) => this.submitMov(e)); addSafeEventListener('mov-tipo', 'change', (e) => this.updateMovItemDropdown(e.target.value)); addSafeEventListener('btnMovCancel', 'click', (e) => {$('form-movimentacao').reset(); this.updateMovItemDropdown()});},
    refreshAll() { this.loadSaldoGeral(); this.loadSaldoLotes(); this.loadHistorico(); this.updateMovItemDropdown(); },
    updateMovItemDropdown(tipo = null) {
        const sel = $('mov-item'); if (!sel) return; sel.innerHTML = '<option value="">Selecione...</option>';
        const tipoMov = tipo || $('mov-tipo')?.value;
        if (tipoMov === 'ENTRADA' || tipoMov === 'SAIDA' || tipoMov === 'AJUSTE') fillOptionsFrom('ingredientes', 'mov-item', 'id', 'nome', { ativo: true });
        else if (tipoMov === 'PRODUCAO') fillOptionsFrom('receitas', 'mov-item', 'id', 'nome', { ativo: true });
    },
    loadSaldoGeral() { GenericCRUD.loadTable('vw_estoque_geral', 'tblEstoqueGeral', ['nome_item', 'quantidade_total', 'unidade_medida', 'custo_medio_formatado'], false); },
    loadSaldoLotes() { GenericCRUD.loadTable('vw_estoque_lotes', 'tblEstoqueLotes', ['nome_item', 'quantidade', 'unidade_medida', 'custo_unitario_formatado', 'data_validade', 'unidade_nome'], false); },
    loadHistorico() { GenericCRUD.loadTable('vw_movimentacoes_historico', 'tblHistorico', ['data_hora', 'tipo', 'nome_item', 'quantidade_formatada', 'origem_destino', 'usuario', 'obs'], false); },
    async submitMov(e) {
        e.preventDefault(); const data = getFormData('form-movimentacao'), tipo = data.tipo;
        if (!tipo || !data.item_id || !data.quantidade || data.quantidade <= 0) { setStatus("Preencha Tipo, Item e Quantidade.", 'err'); return; }
        if ((tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA') && !data.unidade_destino_id) { setStatus("Unidade de Destino é obrigatória.", 'err'); return; }
        if ((tipo === 'SAIDA' || tipo === 'TRANSFERENCIA' || tipo === 'PRODUCAO') && !data.unidade_origem_id) { setStatus("Unidade de Origem é obrigatória.", 'err'); return; }
        if (tipo === 'TRANSFERENCIA' && data.unidade_origem_id === data.unidade_destino_id) { setStatus("Origem e destino não podem ser iguais.", 'err'); return; }
        setStatus("Registrando...");
        try {
            const { error } = await supaEstoque.from('movimentacoes').insert([{ tipo: data.tipo, ingrediente_id: (tipo !== 'PRODUCAO' ? data.item_id : null), receita_id: (tipo === 'PRODUCAO' ? data.item_id : null), quantidade: data.quantidade, custo_unitario: data.custo_unitario || 0, unidade_origem_id: data.unidade_origem_id || null, unidade_destino_id: data.unidade_destino_id || null, data_validade: data.data_validade || null, obs: data.obs || null }]);
            if (error) throw error;
            setStatus("Movimentação registrada!", 'ok'); $('form-movimentacao').reset(); this.refreshAll();
        } catch (e) { console.error("Erro ao registrar:", e); setStatus(`Erro: ${e.message}`, 'err'); }
    }
};

/* ===== MÓDULO DE COMPRAS ===== */
const ComprasModule = {
    init() { addSafeEventListener('btnRefreshSuggestions', 'click', () => this.loadSuggestions()); this.loadSuggestions(); },
    async loadSuggestions() {
        const tbody = $('tbl-sugestoes')?.querySelector('tbody'); if (!tbody) return; tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>'; setStatus("Buscando sugestões...");
        try {
            const { data, error } = await supaEstoque.from('vw_sugestao_compras').select('*'); if (error) throw error;
            tbody.innerHTML = '';
            if (data.length === 0) tbody.innerHTML = '<tr><td colspan="5">Nenhum item precisa de reposição.</td></tr>';
            else data.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.nome_ingrediente}</td><td>${fmt(item.estoque_atual)} ${item.unidade_medida}</td><td>${fmt(item.ponto_pedido)} ${item.unidade_medida}</td><td><strong class="down">${fmt(item.sugestao_compra)} ${item.unidade_medida}</strong></td><td>${item.ultimo_fornecedor || 'N/D'}</td>`; tbody.appendChild(tr); });
            setStatus("Sugestões carregadas.", 'ok');
        } catch (e) { console.error("Erro ao carregar sugestões:", e); setStatus(`Erro: ${e.message}`, 'err'); tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar.</td></tr>'; }
    }
};

/* ===== INICIALIZAÇÃO ===== */
async function init(){
  try{
    if (typeof supaEstoque === 'undefined' || !supaEstoque.from) { throw new Error("Falha na inicialização do Supabase para Estoque."); }
    setStatus('Inicializando módulos...');
    setupRouting();
    AuxiliaresModule.init(); IngredientesModule.init(); ReceitasModule.init(); PratosModule.init(); ProducaoModule.init(); EstoqueModule.init(); ComprasModule.init();
    setStatus('Pronto','ok');
  } catch(e) { console.error("Erro fatal:", e); setStatus(e.message, 'err'); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
