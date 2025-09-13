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
                // Garante que números vazios sejam nulos para o banco de dados
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

/* ===================== CONFIGURAÇÃO DA API ===================== */
// ATENÇÃO: SUBSTITUA ESTES VALORES PELOS SEUS DADOS REAIS DO PAINEL SUPABASE
const SUPABASE_URL  = 'https://tykdmxaqvqwskpmdiekw.supabase.co'; // DEVE COMEÇAR COM https://
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps'; // Sua chave pública (ANON)
// ===============================================================

// Inicialização segura do Supabase
var supa;
if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada!");
} else if (SUPABASE_URL.startsWith('http')) {
    try {
        supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } catch (e) {
        console.error("Falha ao inicializar o cliente Supabase:", e);
    }
} else {
    console.error("ERRO CRÍTICO: SUPABASE_URL inválida ou não configurada em estoque_app.js! Verifique se começa com https://.");
}


// Listener seguro que verifica se o elemento existe antes de adicionar o evento
function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) { element.addEventListener(event, handler); }
    // else { console.warn(`Elemento não encontrado para listener: ${id}`); }
}

/* ===== ROTEAMENTO POR ABAS ===== */
function setupRouting() {
  const mainTabsContainer = $('main-tabs');
  if (!mainTabsContainer) {
      console.error("Container de abas principais 'main-tabs' não encontrado. Roteamento falhou.");
      return;
  }
 
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

  // Evita recarregar se já estiver populado e não estiver carregando
  if (sel.options.length > (allowEmpty ? 1 : 0) && !sel.dataset.loading) return;
 
  sel.dataset.loading = true;
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
    if (e.message.includes('Failed to fetch')) {
        setStatus('Erro de conexão (Failed to Fetch). Verifique as credenciais do Supabase.', 'err');
    }
    sel.innerHTML= previousHTML || '<option value="">(Erro)</option>';
  } finally {
      delete sel.dataset.loading;
  }
}

/* ===== MÓDULO GENÉRICO DE CRUD (Para tabelas simples) ===== */
const GenericCRUD = {
    async loadTable(table, tableId, columns, actions = true, view = null) {
        const tb = $(tableId)?.querySelector('tbody'); 
        if (!tb) return;
       
        const source = view || table;
       
        // Determina a coluna de ordenação padrão
        let orderCol = columns[0];
        if (columns.includes('nome')) orderCol = 'nome';
        else if (columns.includes('data_hora')) orderCol = 'data_hora';

        // Define a direção da ordenação
        const ascending = !columns.includes('data_hora'); 

        tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando…</td></tr>`;
       
        try {
            const { data, error } = await supa.from(source).select('*').order(orderCol, { ascending: ascending }).limit(500);
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
                    if (input.type === 'checkbox') {
                        input.checked = data[key];
                    } else {
                        input.value = data[key];
                    }
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
            let query;
            if (id) {
                query = supa.from(table).update(data).eq('id', id);
            } else {
                query = supa.from(table).insert([data]);
            }
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
        const action = btn.dataset.act;
        const id = btn.dataset.id;

        if (action === 'toggle') {
            this.toggle(table, id, refreshCallback);
        } else if (action === 'edit') {
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

/* ===== MÓDULO DE CADASTROS AUXILIARES (Unidades, Categorias, UM) ===== */
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

        addSafeEventListener(btnNewName, 'click', () => {
            GenericCRUD.showForm(editorId, formId, titleId, `Novo Registro`);
        });
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
        fillOptionsFrom('unidades', 'ing-local-armazenagem', 'id', 'nome', {ativo: true});
        fillOptionsFrom('unidades', 'mov-unidade-origem', 'id', 'nome', {ativo: true});
        fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome', {ativo: true});
    },
   
    // Atualizado para permitir forçar o recarregamento dos dropdowns
    refreshCategoriasDropdowns(forceReload = false) {
        fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', {tipo: 'INGREDIENTE', ativo: true});
        fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', {tipo: 'PRATO', ativo: true});
       
        const catFilter = $('cat-filter');
        // Recarrega o filtro de produção se estiver vazio ou se forçado
        if (catFilter && (catFilter.options.length <= 1 || forceReload)) {
            if (typeof supa !== 'undefined' && supa.from) {
                catFilter.innerHTML = '<option value="">Todas</option>'; // Limpa e adiciona a opção padrão
                supa.from('categorias').select('id, nome').eq('tipo', 'PRATO').eq('ativo', true).order('nome').then(({data, error}) => {
                    if (!error && data) {
                        data.forEach(cat => {
                            const opt = document.createElement('option');
                            opt.value = cat.id;
                            opt.textContent = cat.nome;
                            catFilter.appendChild(opt);
                        });
                    }
                });
            }
        }
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
            // Atualiza dropdowns dependentes
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
        // Usa a view 'vw_ingredientes' para mostrar nomes de categorias e unidades
        const columns = ['nome', 'categoria_nome', 'unidade_medida_sigla', 'custo_unitario', 'ativo'];
        GenericCRUD.loadTable('ingredientes', 'tblIng', columns, true, 'vw_ingredientes');
    }
};

/* ===== MÓDULO DE RECEITAS (FICHA TÉCNICA) ===== */
const ReceitasModule = {
    draftItems: [], // Armazena temporariamente os itens da receita sendo editada
   
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
        // Usa a view 'vw_receitas_resumo'
        GenericCRUD.loadTable('receitas', 'tblRec', ['nome', 'rendimento_formatado', 'total_itens', 'ativo'], true, 'vw_receitas_resumo');
    },

    updateDraftRefOptions() {
        const tipo = $('draft-tipo')?.value;
        if (!tipo) return;

        if (tipo === 'INGREDIENTE') {
            fillOptionsFrom('ingredientes', 'draft-ref', 'id', 'nome', {ativo: true});
        } else if (tipo === 'RECEITA') {
            // Idealmente, filtrar para evitar referência circular (uma receita contendo a si mesma)
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
            // Lógica de carregamento para edição
            setStatus('Carregando receita para edição...');
            try {
                const { data: recData, error: recError } = await supa.from('receitas').select('*').eq('id', id).single();
                if (recError) throw recError;

                // Preenche o formulário principal
                Object.keys(recData).forEach(key => {
                    const input = form.elements[key];
                    if(input) input.value = recData[key];
                });
                $('rec-id').value = id;

                // Carrega os itens da receita
                const { data: itemsData, error: itemsError } = await supa.from('vw_receita_itens_detalhes').select('*').eq('receita_id', id);
                if (itemsError) throw itemsError;

                this.draftItems = itemsData.map(item => ({
                    tipo: item.tipo,
                    referencia_id: item.referencia_id,
                    nome: item.nome_item,
                    quantidade: item.quantidade,
                    unidade: item.unidade
                }));
                setStatus('Receita carregada.', 'ok');
            } catch (e) {
                console.error("Erro ao carregar receita para edição:", e);
                setStatus(`Erro: ${e.message}`, 'err');
                return; // Aborta se não conseguir carregar
            }
        }
       
        this.renderDraftTable();
        this.updateDraftRefOptions(); // Garante que os dropdowns estejam prontos
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
            setStatus('Preencha todos os campos do item corretamente.', 'err');
            return;
        }

        // Verifica se o item já foi adicionado
        const exists = this.draftItems.some(item => item.tipo === tipo && item.referencia_id == refId);
        if (exists) {
            setStatus('Este item já foi adicionado à receita.', 'warn');
            return;
        }

        this.draftItems.push({
            tipo: tipo,
            referencia_id: refId,
            nome: refName, // Armazena o nome para exibição
            quantidade: qtd,
            unidade: unidade
        });

        this.renderDraftTable();
        // Limpa os campos de adição
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
                <td>${item.tipo}</td>
                <td>${item.nome}</td>
                <td>${fmt(item.quantidade)}</td>
                <td>${item.unidade}</td>
                <td><button type="button" class="btn small" data-act="remove-draft" data-index="${index}">Remover</button></td>
            `;
            tbody.appendChild(tr);
        });
    },

    async saveRecipe(e) {
        e.preventDefault();
        const recipeData = getFormData('form-receita');
        const id = recipeData.id;
        delete recipeData.id;

        if (this.draftItems.length === 0) {
            setStatus('Adicione pelo menos um item à receita antes de salvar.', 'err');
            return;
        }

        setStatus('Salvando receita...');
        try {
            // Idealmente, usar uma função RPC para transação.
            // Aqui, faremos em múltiplas etapas.

            // 1. Salvar/Atualizar o cabeçalho da receita
            let savedRecipe;
            if (id) {
                const { data, error } = await supa.from('receitas').update(recipeData).eq('id', id).select().single();
                if (error) throw error;
                savedRecipe = data;
                // Deleta os itens antigos para depois inserir os novos
                await supa.from('receita_itens').delete().eq('receita_id', id);
            } else {
                const { data, error } = await supa.from('receitas').insert([recipeData]).select().single();
                if (error) throw error;
                savedRecipe = data;
            }
           
            // 2. Preparar e salvar os novos itens da receita
            const itemsToInsert = this.draftItems.map(item => ({
                receita_id: savedRecipe.id,
                tipo: item.tipo,
                referencia_id: item.referencia_id,
                quantidade: item.quantidade,
                unidade: item.unidade
            }));

            const { error: itemsError } = await supa.from('receita_itens').insert(itemsToInsert);
            if (itemsError) {
                // Se falhar ao inserir itens, tenta reverter (não é uma transação real)
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
        const action = btn.dataset.act;
        const id = btn.dataset.id;

        if (action === 'edit') {
            this.showRecipeForm(id);
        } else if (action === 'toggle') {
            GenericCRUD.toggle('receitas', id, () => this.refreshAll());
        }
    },

    handleDraftTableClick(e) {
        const btn = e.target.closest('button');
        if (!btn || btn.dataset.act !== 'remove-draft') return;
        const index = parseInt(btn.dataset.index);
        this.draftItems.splice(index, 1);
        this.renderDraftTable();
    },
   
    refreshAll() {
        this.loadReceitas();
        this.updateDraftRefOptions();
        PratosModule.updatePratoComponentDropdowns();
        EstoqueModule.updateMovItemDropdown();
    }
};


/* ===== MÓDULO DE PRATOS E COMPONENTES (MODIFICADO) ===== */
const PratosModule = {
    init() {
        this.setupPratoCRUD();
        this.setupComponentesEventListeners();
        this.loadPratos();
        this.updatePratoComponentDropdowns();
       
        // --- NOVOS LISTENERS PARA IMPORTAÇÃO ---
        this.setupImportEventListeners();
    },

    setupPratoCRUD() {
        const table = 'pratos';
        const editorId = 'prato-editor-container';
        const formId = 'form-prato';
        const titleId = 'prato-form-title';
        const tableId = 'tblPratos';
       
        const refresh = () => {
            this.loadPratos();
            this.updatePratoComponentDropdowns();
        };

        addSafeEventListener('btnNovoPrato', 'click', () => {
            hideEditor('prato-import-container'); // Esconde a UI de importação se estiver aberta
            GenericCRUD.showForm(editorId, formId, titleId, 'Novo Prato');
        });
        addSafeEventListener('btnCancelarPrato', 'click', () => hideEditor(editorId));
        addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
       
        const tableEl = $(tableId);
        if (tableEl) {
             tableEl.addEventListener('click', (e) => {
                // Esconde a UI de importação ao clicar em editar
                const btn = e.target.closest('button');
                if (btn && btn.dataset.act === 'edit') {
                    hideEditor('prato-import-container');
                }
                GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh)
            });
        }
    },

    setupComponentesEventListeners() {
        addSafeEventListener('cp-prato', 'change', (e) => this.loadComponentes(e.target.value));
        addSafeEventListener('btnAddPrComp', 'click', () => this.addComponente());
       
        const tblPrComp = $('tblPrComp');
        if (tblPrComp) tblPrComp.addEventListener('click', (e) => this.handleComponenteTableClick(e));
    },

    loadPratos() {
        // Usa a view 'vw_pratos_resumo'
        const columns = ['nome', 'categoria_nome', 'preco_venda', 'total_receitas', 'ativo'];
        GenericCRUD.loadTable('pratos', 'tblPratos', columns, true, 'vw_pratos_resumo');
    },

    updatePratoComponentDropdowns() {
        fillOptionsFrom('pratos', 'cp-prato', 'id', 'nome', {ativo: true});
        fillOptionsFrom('receitas', 'cp-receita', 'id', 'nome', {ativo: true});
    },

    // <<< INÍCIO DO CÓDIGO RESTAURADO >>>
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
            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.nome_receita}</td>
                    <td>${item.quantidade}</td>
                    <td>
                        <button class="btn small" data-act="remove-comp" data-id="${item.id}">Remover</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Nenhuma receita associada.</td></tr>';
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
            const { error } = await supa.from('prato_componentes').insert([{
                prato_id: pratoId,
                receita_id: receitaId,
                quantidade: quantidade
            }]);
            if (error) throw error;
            setStatus("Componente adicionado!", 'ok');
            this.loadComponentes(pratoId); // Recarrega a lista
            this.loadPratos(); // Recarrega a tabela de pratos para atualizar contagem
        } catch (e) {
            console.error("Erro ao adicionar componente:", e);
            if (e.code === '23505') { // Unique constraint violation
                setStatus("Erro: Esta receita já é um componente deste prato.", 'err');
            } else {
                setStatus(`Erro: ${e.message}`, 'err');
            }
        }
    },

    async handleComponenteTableClick(e) {
        const btn = e.target.closest('button');
        if (!btn || btn.dataset.act !== 'remove-comp') return;
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
    // <<< FIM DO CÓDIGO RESTAURADO >>>
   
    // --- NOVAS FUNÇÕES DE IMPORTAÇÃO ---
   
    setupImportEventListeners() {
        addSafeEventListener('btnImportarPratos', 'click', () => this.showImportUI());
        addSafeEventListener('btnCancelImport', 'click', () => hideEditor('prato-import-container'));
        addSafeEventListener('btnConfirmImport', 'click', () => this.confirmImport());
        addSafeEventListener('importCheckAll', 'click', (e) => {
            // Seleciona/Deseleciona todos os checkboxes na tabela de importação
            $$('#tblImportPratos tbody input[type="checkbox"]').forEach(chk => chk.checked = e.target.checked);
        });
    },

    // Exibe a interface de importação e carrega os pratos não registrados
    async showImportUI() {
        // Esconde o editor de cadastro manual e mostra o container de importação
        hideEditor('prato-editor-container');
        showEditor('prato-import-container');
       
        const loader = $('import-loader');
        const tbody = $('#tblImportPratos tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (loader) loader.style.display = 'block';
        if ($('importCheckAll')) $('importCheckAll').checked = false;

        try {
            // Chama a função RPC criada no banco de dados (get_unregistered_dishes)
            const { data, error } = await supa.rpc('get_unregistered_dishes');
            if (error) throw error;
           
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Tudo certo! Todos os pratos vendidos já estão cadastrados no estoque.</td></tr>';
                $('btnConfirmImport').disabled = true;
            } else {
                $('btnConfirmImport').disabled = false;
                // Renderiza a lista de pratos disponíveis para importação
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    // Armazena nome e categoria sugerida nos atributos data-* do checkbox
                    // Usa encodeURIComponent para garantir segurança nos atributos HTML
                    tr.innerHTML = `
                        <td><input type="checkbox" data-nome="${encodeURIComponent(item.nome_prato)}" data-cat="${encodeURIComponent(item.categoria_sugerida)}"></td>
                        <td>${item.nome_prato}</td>
                        <td><span class="pill">${item.categoria_sugerida}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            console.error("Erro ao buscar pratos não registrados:", e);
            let errorMessage = e.message;
            // Erro específico se a função RPC não existir
            if (e.code === '42883' || (e.message && e.message.includes('function get_unregistered_dishes'))) {
                 errorMessage = "Função 'get_unregistered_dishes' não encontrada. Execute o script SQL fornecido no Supabase.";
            }
            setStatus(`Erro ao buscar pratos: ${errorMessage}`, 'err');
            tbody.innerHTML = `<tr><td colspan="3">Erro ao carregar dados. Verifique o status e o console.</td></tr>`;
        } finally {
            if (loader) loader.style.display = 'none';
        }
    },

    // Processa a importação dos pratos selecionados
    async confirmImport() {
        const selectedItems = $$('#tblImportPratos tbody input[type="checkbox"]:checked');
        if (selectedItems.length === 0) {
            alert("Selecione pelo menos um prato para importar.");
            return;
        }
       
        setStatus('Iniciando importação...');
       
        // Coleta e decodifica as categorias únicas dos itens selecionados
        const uniqueCategories = [...new Set(selectedItems.map(item => decodeURIComponent(item.dataset.cat)))].filter(Boolean);
       
        try {
            // 1. Buscar categorias existentes no sistema (Tipo PRATO)
            const { data: existingCats, error: catError } = await supa.from('categorias').select('id, nome').eq('tipo', 'PRATO');
            if (catError) throw catError;
           
            // Mapeamento Nome (lowercase) -> ID para busca rápida
            const catMap = new Map(existingCats.map(c => [c.nome.toLowerCase(), c.id]));
           
            // 2. Identificar categorias que precisam ser criadas
            const catsToCreate = uniqueCategories
                .filter(name => !catMap.has(name.toLowerCase()))
                .map(name => ({ nome: name, tipo: 'PRATO', ativo: true }));
           
            // 3. Criar categorias faltantes, se necessário
            if (catsToCreate.length > 0) {
                setStatus(`Importando ${catsToCreate.length} novas categorias...`);
                const { data: insertedCats, error: newCatError } = await supa.from('categorias').insert(catsToCreate).select('id, nome');
                if (newCatError) throw newCatError;
               
                // Atualiza o mapa de categorias com as recém-inseridas
                insertedCats.forEach(c => catMap.set(c.nome.toLowerCase(), c.id));
                // Atualiza os dropdowns globalmente, forçando o recarregamento
                AuxiliaresModule.refreshCategoriasDropdowns(true); 
            }

            // 4. Preparar Pratos para inserção usando os IDs corretos
            setStatus('Preparando pratos para inserção...');
            const newPratosToInsert = selectedItems.map(item => {
                const nome = decodeURIComponent(item.dataset.nome);
                const catName = decodeURIComponent(item.dataset.cat);
                // Busca o ID da categoria no mapa (deve existir agora)
                const categoriaId = catName ? catMap.get(catName.toLowerCase()) : null;

                return {
                    nome: nome,
                    categoria_id: categoriaId,
                    ativo: true,
                    // Valores padrão
                    peso_volume: 0,
                    unidade_peso_volume: 'g',
                    preco_venda: 0
                };
            });

            // 5. Inserir novos Pratos
            if (newPratosToInsert.length > 0) {
                setStatus(`Importando ${newPratosToInsert.length} novos pratos...`);
                const { error: pratoError } = await supa.from('pratos').insert(newPratosToInsert);
                if (pratoError) throw pratoError;
                setStatus(`Importação concluída! ${newPratosToInsert.length} pratos adicionados.`, 'ok');
            }
           
            // 6. Atualizar a interface
            hideEditor('prato-import-container');
            this.loadPratos();
            this.updatePratoComponentDropdowns();

        } catch (e) {
            console.error("Erro na importação de pratos:", e);
            if (e.code === '23505') { // Código de erro para violação de unicidade (duplicata)
                setStatus(`Erro: Um ou mais pratos já existem. Tente novamente.`, 'err');
            } else {
                setStatus(`Erro na importação: ${e.message}`, 'err');
            }
        }
    }
};


/* ===== MÓDULO DE PRODUÇÃO (Previsão) ===== */
const ProducaoModule = {
    init() {
        addSafeEventListener('btnCalcularPrev', 'click', () => this.calcularPrevisao());
    },

    // <<< INÍCIO DO CÓDIGO RESTAURADO >>>
    async calcularPrevisao() {
        const dataInicio = $('prev-data-inicio').value;
        const dataFim = $('prev-data-fim').value;
        const categoriaId = $('cat-filter').value;
        const tbody = $('tbl-previsao')?.querySelector('tbody');

        if (!tbody) return;
        if (!dataInicio || !dataFim) {
            setStatus("Por favor, selecione as datas de início e fim.", 'err');
            return;
        }

        setStatus("Calculando previsão...");
        tbody.innerHTML = '<tr><td colspan="3">Calculando...</td></tr>';

        try {
            // Chama a RPC para obter a previsão de vendas
            const { data, error } = await supa.rpc('calcular_previsao_venda', {
                p_data_inicio: dataInicio,
                p_data_fim: dataFim,
                p_categoria_id: categoriaId || null
            });

            if (error) throw error;
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Nenhum dado de venda encontrado para o período e filtro selecionados.</td></tr>';
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.nome_prato}</td>
                        <td>${item.total_vendido}</td>
                        <td>${fmt(item.previsao_ajustada, 2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            setStatus("Previsão calculada.", 'ok');
        } catch (e) {
            console.error("Erro ao calcular previsão:", e);
             let errorMessage = e.message;
            if (e.code === '42883' || (e.message && e.message.includes('function calcular_previsao_venda'))) {
                 errorMessage = "Função 'calcular_previsao_venda' não encontrada. Execute o script SQL no Supabase.";
            }
            setStatus(`Erro: ${errorMessage}`, 'err');
            tbody.innerHTML = '<tr><td colspan="3">Erro ao calcular.</td></tr>';
        }
    }
    // <<< FIM DO CÓDIGO RESTAURADO >>>
};

/* ===== MÓDULO DE ESTOQUE ===== */
const EstoqueModule = {
    init() {
        this.setupEventListeners();
        this.refreshAll();
    },
    // <<< INÍCIO DO CÓDIGO RESTAURADO >>>
    setupEventListeners() {
        addSafeEventListener('form-movimentacao', 'submit', (e) => this.submitMov(e));
        addSafeEventListener('mov-tipo', 'change', (e) => this.updateMovItemDropdown(e.target.value));
    },

    refreshAll() {
        this.loadSaldoGeral();
        this.loadSaldoLotes();
        this.loadHistorico();
        this.updateMovItemDropdown();
    },
   
    updateMovItemDropdown(tipo = null) {
        const sel = $('mov-item');
        if (!sel) return;
        sel.innerHTML = '<option value="">Selecione...</option>';
        const tipoMov = tipo || $('mov-tipo')?.value;

        if (tipoMov === 'ENTRADA' || tipoMov === 'SAIDA' || tipoMov === 'AJUSTE') {
            fillOptionsFrom('ingredientes', 'mov-item', 'id', 'nome', { ativo: true });
        } else if (tipoMov === 'PRODUCAO') {
            fillOptionsFrom('receitas', 'mov-item', 'id', 'nome', { ativo: true });
        }
    },
   
    loadSaldoGeral() {
        GenericCRUD.loadTable('vw_estoque_geral', 'tblEstoqueGeral', ['nome_item', 'quantidade_total', 'unidade_medida', 'custo_medio_formatado'], false);
    },

    loadSaldoLotes() {
        GenericCRUD.loadTable('vw_estoque_lotes', 'tblEstoqueLotes', ['nome_item', 'quantidade', 'unidade_medida', 'custo_unitario_formatado', 'data_validade', 'unidade_nome'], false);
    },

    loadHistorico() {
        GenericCRUD.loadTable('vw_movimentacoes_historico', 'tblHistorico', ['data_hora', 'tipo', 'nome_item', 'quantidade_formatada', 'origem_destino', 'usuario', 'obs'], false);
    },

    async submitMov(e) {
        e.preventDefault();
        const data = getFormData('form-movimentacao');
        const tipo = data.tipo;

        // Validações
        if (!tipo || !data.item_id || !data.quantidade || data.quantidade <= 0) {
            setStatus("Preencha todos os campos obrigatórios (Tipo, Item, Quantidade).", 'err');
            return;
        }
        if ((tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA') && !data.unidade_destino_id) {
            setStatus("Para Entradas e Transferências, a Unidade de Destino é obrigatória.", 'err');
            return;
        }
        if ((tipo === 'SAIDA' || tipo === 'TRANSFERENCIA' || tipo === 'PRODUCAO') && !data.unidade_origem_id) {
            setStatus("Para Saídas, Transferências e Produção, a Unidade de Origem é obrigatória.", 'err');
            return;
        }
        if (tipo === 'TRANSFERENCIA' && data.unidade_origem_id === data.unidade_destino_id) {
            setStatus("A unidade de origem e destino não podem ser a mesma.", 'err');
            return;
        }

        setStatus("Registrando movimentação...");
        try {
            // O ideal é usar uma RPC que valide o saldo antes de registrar a saída.
            // Para simplicidade, vamos inserir diretamente.
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
            $('form-movimentacao').reset();
            this.refreshAll(); // Atualiza todas as tabelas de estoque

        } catch (e) {
            console.error("Erro ao registrar movimentação:", e);
            setStatus(`Erro: ${e.message}`, 'err');
        }
    }
    // <<< FIM DO CÓDIGO RESTAURADO >>>
};

/* ===== MÓDULO DE COMPRAS ===== */
const ComprasModule = {
    init() {
        addSafeEventListener('btnRefreshSuggestions', 'click', () => this.loadSuggestions());
        this.loadSuggestions();
    },

    // <<< INÍCIO DO CÓDIGO RESTAURADO >>>
    async loadSuggestions() {
        const tbody = $('tbl-sugestoes')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5">Carregando sugestões...</td></tr>';
        setStatus("Buscando sugestões de compra...");

        try {
            // Usando a view de sugestões. Pode ser uma RPC para mais complexidade.
            const { data, error } = await supa.from('vw_sugestao_compras').select('*');
            if (error) throw error;

            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Nenhum item precisa de reposição no momento.</td></tr>';
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.nome_ingrediente}</td>
                        <td>${fmt(item.estoque_atual)} ${item.unidade_medida}</td>
                        <td>${fmt(item.ponto_pedido)} ${item.unidade_medida}</td>
                        <td><strong class="down">${fmt(item.sugestao_compra)} ${item.unidade_medida}</strong></td>
                        <td>${item.ultimo_fornecedor || 'N/D'}</td>
                    `;
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
    // <<< FIM DO CÓDIGO RESTAURADO >>>
};


/* ===== INICIALIZAÇÃO ===== */
async function init(){
  try{
    // Verifica se o cliente Supabase foi inicializado corretamente
    if (typeof supa === 'undefined' || !supa.from) {
      throw new Error("Falha na inicialização do Supabase. Verifique as credenciais (URL/Chave) em estoque_app.js.");
    }
    setStatus('Inicializando módulos...');
   
    // Configura o roteamento
    setupRouting();
   
    // Inicializa módulos na ordem de dependência correta
    AuxiliaresModule.init();
    IngredientesModule.init();
    ReceitasModule.init();
    PratosModule.init();
    ProducaoModule.init();
    EstoqueModule.init();
    ComprasModule.init();
   
    setStatus('Pronto','ok');
  } catch(e) { 
    console.error("Erro fatal na inicialização:", e);
    setStatus(e.message, 'err');
  }
}

// Garante que o DOM esteja carregado antes de iniciar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
