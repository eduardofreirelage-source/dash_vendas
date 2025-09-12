// =================================================================================
// SCRIPT COMPLETO E REVISADO PARA O SISTEMA DE GESTÃO
// =================================================================================

/* ===== Helpers ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{
    const el=$('status'); if(!el) return; 
    el.textContent=msg; 
    // Mapeamento de classes para cores definidas no CSS :root
    const colorMap = { 'err': 'var(--down)', 'ok': 'var(--ok)', 'warn': 'var(--warn)' };
    el.style.color = colorMap[cls] || 'var(--muted)';
};
// Formatação numérica com casas decimais fixas
const fmt=(n, digits=3)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits, minimumFractionDigits: digits}).format(+n||0);
const fmtMoney=(n)=> new Intl.NumberFormat('pt-BR',{style: 'currency', currency: 'BRL'}).format(+n||0);
const showEditor = (id) => { const el = $(id); if(el) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el) el.style.display = 'none'; };
// Função auxiliar para obter dados do formulário de forma estruturada
const getFormData = (formId) => {
    const form = $(formId);
    if (!form) return {};
    const data = new FormData(form);
    const obj = {};
    // Itera sobre os elementos do formulário para tratar tipos específicos (checkbox, number)
    for (let element of form.elements) {
        if (element.name) {
            if (element.type === 'checkbox') {
                obj[element.name] = element.checked;
            } else if (element.type === 'number') {
                 // Trata inputs numéricos, garantindo que não sejam strings vazias
                obj[element.name] = element.value ? parseFloat(element.value) : null;
            } else if (data.has(element.name)) {
                const value = data.get(element.name);
                obj[element.name] = value ? value : null; // Trata string vazia como null
            }
        }
    }
    // Pega o ID se existir no input hidden (comum em formulários de edição)
    const idInput = form.querySelector('input[name="id"]');
    if (idInput && idInput.value) {
        obj.id = idInput.value;
    }
    return obj;
};


/* ===================== CONFIGURAÇÃO DA API ===================== */
// ATENÇÃO: SUBSTITUA ESTES VALORES PELOS SEUS DADOS REAIS DO PAINEL SUPABASE
const SUPABASE_URL  = 'https://msmyfxgrnuusnvoqyeuo.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U';
// ===============================================================

// Verifica se o objeto supabase está disponível globalmente
if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada!");
} else {
    var supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
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
// Função otimizada para preencher dropdowns (SELECT elements)
async function fillOptionsFrom(table, selId, valKey, labelKey, whereEq, allowEmpty = true){
  const sel=$(selId); if(!sel) return;
  // Evita recarregar se já estiver preenchido
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
    sel.innerHTML= previousHTML || '<option value="">(Erro)</option>';
  } finally {
      delete sel.dataset.loading;
  }
}

/* ===== MÓDULO GENÉRICO DE CRUD (Para tabelas simples) ===== */
// Usado para Unidades de Medida, Locais e Categorias
const GenericCRUD = {
    // Carrega dados na tabela HTML
    async loadTable(table, tableId, columns, actions = true) {
        const tb = $(tableId)?.querySelector('tbody'); if (!tb) return;
        tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando…</td></tr>`;
        try {
            const orderCol = columns.includes('nome') ? 'nome' : columns[0];
            const { data, error } = await supa.from(table).select('*').order(orderCol, { ascending: true });
            if (error) throw error;
            tb.innerHTML = '';
            (data || []).forEach(item => {
                const tr = document.createElement('tr');
                columns.forEach(col => {
                    const td = document.createElement('td');
                    if (col === 'ativo') {
                        td.innerHTML = item.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>';
                    } else {
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

    // Exibe o formulário de edição/criação
    showForm(editorId, formId, titleId, titleText, data = null) {
        const form = $(formId);
        if (!form) return;

        form.reset();
        $(titleId).textContent = titleText;
        
        // Preenche o formulário se houver dados (edição)
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

    // Salva os dados no Supabase (Insert ou Update)
    async save(e, table, editorId, refreshCallback) {
        e.preventDefault();
        const form = e.target;
        const data = getFormData(form.id);
        const id = data.id;
        delete data.id;

        setStatus(`Salvando ${table}...`);
        try {
            let query;
            if (id) {
                query = supa.from(table).update(data).eq('id', id);
            } else {
                // Remove o ID vazio se for inserção
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

    // Alterna o status (ativo/inativo)
    async toggle(table, id, refreshCallback) {
        setStatus('Atualizando status...');
        try {
            const { data } = await supa.from(table).select('ativo').eq('id', id).single();
            const { error } = await supa.from(table).update({ ativo: !data.ativo }).eq('id', id);
            if (error) throw error;

            setStatus('Status atualizado.', 'ok');
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao alternar status em ${table}:`, err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },

    // Gerencia cliques nos botões da tabela (Editar/Toggle)
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
        // Configura o CRUD para as tabelas auxiliares
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
        
        const refresh = () => {
            GenericCRUD.loadTable(table, tableId, columns);
            // Atualiza dropdowns relacionados após alterações
            if (table === 'unidades_medida') this.refreshUMDropdowns();
            if (table === 'unidades') this.refreshUnidadesDropdowns();
            if (table === 'categorias') this.refreshCategoriasDropdowns();
        };

        // Event Listeners para os botões e formulários
        addSafeEventListener(`btnShowNew${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Form`, 'click', () => {
            GenericCRUD.showForm(editorId, formId, titleId, `Novo Registro`);
        });
        addSafeEventListener(`btnCancel${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Edit`, 'click', () => hideEditor(editorId));
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
    
    // Funções para atualizar os dropdowns usados em outros módulos
    refreshUMDropdowns() {
        fillOptionsFrom('unidades_medida', 'ing-unidade-medida', 'id', 'sigla', {ativo: true}, false);
        fillOptionsFrom('unidades_medida', 'draft-und', 'sigla', 'sigla', {ativo: true}, false);
    },
    
    refreshUnidadesDropdowns() {
        fillOptionsFrom('unidades', 'ing-local-armazenagem', 'id', 'nome', {ativo: true});
        fillOptionsFrom('unidades', 'mov-unidade-origem', 'id', 'nome', {ativo: true});
        fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome', {ativo: true});
    },
    
    refreshCategoriasDropdowns() {
        fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', {tipo: 'INGREDIENTE', ativo: true});
        fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', {tipo: 'PRATO', ativo: true});
        
        // Preenche o filtro de categorias na aba Produção (com suporte a múltipla seleção)
        const catFilter = $('cat-filter');
        if (catFilter && catFilter.options.length === 0) {
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
};

/* ===== MÓDULO DE INGREDIENTES ===== */
const IngredientesModule = {
    init() {
        const editorId = 'ingrediente-editor-container';
        
        addSafeEventListener('btnShowNewIngredienteForm', 'click', () => this.showForm());
        addSafeEventListener('btnCancelIngEdit', 'click', () => hideEditor(editorId));
        addSafeEventListener('form-ingrediente', 'submit', (e) => this.save(e));
        addSafeEventListener('tblIng', 'click', (e) => this.handleTableClick(e));
        
        this.loadIngredientes();
    },

    async loadIngredientes() {
        const tb = $('tblIng')?.querySelector('tbody'); if (!tb) return;
        tb.innerHTML = '<tr><td colspan="6">Carregando ingredientes…</td></tr>';
        try {
            const { data, error } = await supa.from('ingredientes')
                .select('*, categoria:categorias(nome), unidade:unidades_medida(sigla)')
                .order('nome', { ascending: true });
            if (error) throw error;
            tb.innerHTML = '';
            (data || []).forEach(i => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${i.nome}</td>
                                <td>${i.categoria ? i.categoria.nome : '—'}</td>
                                <td>${i.unidade ? i.unidade.sigla : '—'}</td>
                                <td>${fmtMoney(i.custo_unitario)}</td>
                                <td>${i.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>'}</td>
                                <td class="row-actions">
                                    <button class="btn small" data-act="edit" data-id="${i.id}">Editar</button>
                                    <button class="btn small" data-act="toggle" data-id="${i.id}">${i.ativo ? 'Desativar' : 'Ativar'}</button>
                                </td>`;
                tb.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar ingredientes:", e);
            tb.innerHTML = '<tr><td colspan="6">Erro ao carregar.</td></tr>';
        }
    },

    showForm(data = null) {
        const form = $('form-ingrediente');
        form.reset();
        $('ingrediente-form-title').textContent = data ? 'Editar Ingrediente' : 'Novo Ingrediente';
        
        if (data) {
            // Preenche o formulário usando os nomes dos inputs definidos no HTML
            form.elements['id'].value = data.id;
            form.elements['nome'].value = data.nome;
            form.elements['categoria_id'].value = data.categoria_id;
            form.elements['custo_unitario'].value = data.custo_unitario;
            form.elements['unidade_medida_id'].value = data.unidade_medida_id;
            form.elements['estoque_min'].value = data.estoque_min;
            form.elements['estoque_max'].value = data.estoque_max;
            form.elements['local_armazenagem'].value = data.local_armazenagem;
            form.elements['obs'].value = data.obs;
        }
        showEditor('ingrediente-editor-container');
    },

    async save(e) {
        e.preventDefault();
        const data = getFormData('form-ingrediente');
        const id = data.id;
        delete data.id; // Remove o ID do payload principal

        setStatus('Salvando ingrediente...');
        try {
            let query;
            if (id) {
                query = supa.from('ingredientes').update(data).eq('id', id);
            } else {
                query = supa.from('ingredientes').insert([data]);
            }
            const { error } = await query;
            if (error) throw error;

            setStatus('Ingrediente salvo com sucesso!', 'ok');
            hideEditor('ingrediente-editor-container');
            this.loadIngredientes();
            // Atualiza dropdowns de ingredientes em outras abas
            ReceitasModule.updateDraftRefOptions();
        } catch (err) {
            console.error("Erro ao salvar ingrediente:", err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },

    handleTableClick(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.act;
        const id = btn.dataset.id;

        if (action === 'toggle') {
            GenericCRUD.toggle('ingredientes', id, () => this.loadIngredientes());
        } else if (action === 'edit') {
            supa.from('ingredientes').select('*').eq('id', id).single().then(({data, error}) => {
                if (error) {
                    setStatus(`Erro ao carregar dados: ${error.message}`, 'err');
                } else {
                    this.showForm(data);
                }
            });
        }
    }
};

/* ===== MÓDULO DE RECEITAS ===== */
const ReceitasModule = {
    draftItems: [], // Armazena temporariamente os itens da receita sendo editada
    
    init() {
        addSafeEventListener('btnShowNewRecipeForm', 'click', () => this.showForm());
        addSafeEventListener('btnCancelRecEdit', 'click', () => hideEditor('recipe-editor-container'));
        addSafeEventListener('form-receita', 'submit', (e) => this.save(e));
        addSafeEventListener('tblRec', 'click', (e) => this.handleTableClick(e));
        addSafeEventListener('draft-tipo', 'change', () => this.updateDraftRefOptions());
        addSafeEventListener('btnDraftAdd', 'click', () => this.addDraftItem());
        addSafeEventListener('tblDraft', 'click', (e) => this.removeDraftItem(e));

        this.loadReceitas();
        this.updateDraftRefOptions();
    },

    async loadReceitas() {
        const tb = $('tblRec')?.querySelector('tbody'); if (!tb) return;
        tb.innerHTML = '<tr><td colspan="5">Carregando receitas…</td></tr>';
        try {
            // Usando 'count' para contar os itens associados
            const { data, error } = await supa.from('receitas')
                .select('*, receita_itens(count)')
                .order('nome', { ascending: true });
            if (error) throw error;
            tb.innerHTML = '';
            (data || []).forEach(r => {
                const itemCount = r.receita_itens.length > 0 ? r.receita_itens[0].count : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${r.nome}</td>
                                <td>${fmt(r.rendimento_qtd)} ${r.rendimento_unidade}</td>
                                <td>${itemCount}</td>
                                <td>${r.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>'}</td>
                                <td class="row-actions">
                                    <button class="btn small" data-act="edit" data-id="${r.id}">Editar</button>
                                    <button class="btn small" data-act="toggle" data-id="${r.id}">${r.ativo ? 'Desativar' : 'Ativar'}</button>
                                </td>`;
                tb.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar receitas:", e);
            tb.innerHTML = '<tr><td colspan="5">Erro ao carregar.</td></tr>';
        }
    },

    // Atualiza o dropdown de referência (Ingrediente ou Receita) baseado no Tipo selecionado
    async updateDraftRefOptions() {
        const tipo = $('draft-tipo').value;
        const refSelect = $('draft-ref');
        refSelect.innerHTML = '<option value="">Carregando...</option>';
        
        const table = tipo === 'INGREDIENTE' ? 'ingredientes' : 'receitas';
        try {
            const { data, error } = await supa.from(table).select('id, nome').eq('ativo', true).order('nome');
            if (error) throw error;
            
            refSelect.innerHTML = '<option value="">Selecione</option>';
            (data || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = item.nome;
                refSelect.appendChild(opt);
            });
        } catch (e) {
            refSelect.innerHTML = '<option value="">(Erro)</option>';
        }
    },

    // Adiciona item ao rascunho da receita
    addDraftItem() {
        const tipo = $('draft-tipo').value;
        const refId = $('draft-ref').value;
        const refName = $('draft-ref').options[$('draft-ref').selectedIndex]?.text;
        const qtd = parseFloat($('draft-qtd').value);
        const und = $('draft-und').value;

        if (!refId || !qtd || qtd <= 0 || !und) {
            alert("Preencha todos os campos do item (Referência, Qtd e Unidade).");
            return;
        }

        this.draftItems.push({
            item_tipo: tipo,
            item_id: refId,
            nome: refName,
            quantidade: qtd,
            unidade: und
        });
        this.renderDraftTable();
        $('draft-qtd').value = '';
        $('draft-ref').focus();
    },

    renderDraftTable() {
        const tb = $('tblDraft')?.querySelector('tbody');
        if (!tb) return;
        tb.innerHTML = '';
        this.draftItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.item_tipo}</td>
                            <td>${item.nome}</td>
                            <td>${fmt(item.quantidade)}</td>
                            <td>${item.unidade}</td>
                            <td><button class="btn small" data-act="remove" data-index="${index}">Remover</button></td>`;
            tb.appendChild(tr);
        });
    },

    removeDraftItem(e) {
        const btn = e.target.closest('button');
        if (!btn || btn.dataset.act !== 'remove') return;
        const index = parseInt(btn.dataset.index);
        this.draftItems.splice(index, 1);
        this.renderDraftTable();
    },

    async showForm(data = null) {
        const form = $('form-receita');
        form.reset();
        this.draftItems = [];
        $('recipe-form-title').textContent = data ? 'Editar Receita' : 'Nova Receita';

        if (data) {
            // Preenche o formulário usando os nomes dos inputs definidos no HTML
            form.elements['id'].value = data.id;
            form.elements['nome'].value = data.nome;
            form.elements['perda_global_percentual'].value = data.perda_global_percentual;
            form.elements['rendimento_qtd'].value = data.rendimento_qtd;
            form.elements['rendimento_unidade'].value = data.rendimento_unidade;
            form.elements['obs'].value = data.obs;
            form.elements['modo_preparo'].value = data.modo_preparo;

            // Carregar itens da receita existente
            setStatus('Carregando itens da receita...');
            try {
                const { data: itens, error } = await supa.from('receita_itens')
                    .select('*')
                    .eq('receita_id', data.id);
                if (error) throw error;
                
                // Buscar os nomes dos itens (Ingredientes e Receitas)
                const ingIds = itens.filter(i => i.item_tipo === 'INGREDIENTE').map(i => i.item_id);
                const recIds = itens.filter(i => i.item_tipo === 'RECEITA').map(i => i.item_id);
                
                const [ingNomes, recNomes] = await Promise.all([
                    ingIds.length > 0 ? supa.from('ingredientes').select('id, nome').in('id', ingIds) : Promise.resolve({data: []}),
                    recIds.length > 0 ? supa.from('receitas').select('id, nome').in('id', recIds) : Promise.resolve({data: []})
                ]);

                const nomesMap = new Map();
                (ingNomes.data || []).forEach(i => nomesMap.set(i.id, i.nome));
                (recNomes.data || []).forEach(r => nomesMap.set(r.id, r.nome));

                this.draftItems = itens.map(item => ({
                    ...item,
                    nome: nomesMap.get(item.item_id) || 'Desconhecido'
                }));
                setStatus('Pronto', 'ok');
            } catch (e) {
                setStatus('Erro ao carregar itens da receita.', 'err');
            }
        }
        this.renderDraftTable();
        showEditor('recipe-editor-container');
    },

    // Salva a receita e seus itens (transacionalmente)
    async save(e) {
        e.preventDefault();
        if (this.draftItems.length === 0) {
            alert("Adicione pelo menos um item à receita antes de salvar.");
            return;
        }

        const receitaData = getFormData('form-receita');
        const id = receitaData.id;
        delete receitaData.id;
        
        // Remove campos do draft que ficam no form mas não vão para a tabela 'receitas'
        delete receitaData.draft_tipo; delete receitaData.draft_ref; 
        delete receitaData.draft_qtd; delete receitaData.draft_und;


        setStatus('Salvando receita...');
        try {
            let receitaId;
            if (id) {
                // Atualização
                const { error } = await supa.from('receitas').update(receitaData).eq('id', id);
                if (error) throw error;
                receitaId = id;
                
                // Para atualização: Removemos os itens antigos e inserimos os novos (abordagem mais simples)
                const { error: deleteError } = await supa.from('receita_itens').delete().eq('receita_id', receitaId);
                if (deleteError) throw deleteError;

            } else {
                // Inserção
                const { data: insertedData, error } = await supa.from('receitas').insert([receitaData]).select('id').single();
                if (error) throw error;
                receitaId = insertedData.id;
            }

            // Insere os itens da receita (do rascunho)
            const itensPayload = this.draftItems.map(item => ({
                receita_id: receitaId,
                item_tipo: item.item_tipo,
                item_id: item.item_id,
                quantidade: item.quantidade,
                unidade: item.unidade,
                perda_linha_percentual: item.perda_linha_percentual || 0
            }));

            const { error: itensError } = await supa.from('receita_itens').insert(itensPayload);
            if (itensError) throw itensError;

            setStatus('Receita salva com sucesso!', 'ok');
            hideEditor('recipe-editor-container');
            this.loadReceitas();
            // Atualiza dropdowns dependentes
            this.updateDraftRefOptions();
            PratosModule.updateComponenteDropdowns();
        } catch (err) {
            console.error("Erro ao salvar receita:", err);
            setStatus(`Erro ao salvar receita: ${err.message}`, 'err');
        }
    },

    handleTableClick(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.act;
        const id = btn.dataset.id;

        if (action === 'toggle') {
            GenericCRUD.toggle('receitas', id, () => this.loadReceitas());
        } else if (action === 'edit') {
            supa.from('receitas').select('*').eq('id', id).single().then(({data, error}) => {
                if (error) {
                    setStatus(`Erro ao carregar dados: ${error.message}`, 'err');
                } else {
                    this.showForm(data);
                }
            });
        }
    }
};

/* ===== MÓDULO DE PRATOS E COMPONENTES (Ficha Técnica) ===== */
const PratosModule = {
    init() {
        // Pratos (CRUD)
        addSafeEventListener('btnNovoPrato', 'click', () => this.showPratoForm());
        addSafeEventListener('btnCancelarPrato', 'click', () => hideEditor('prato-editor-container'));
        addSafeEventListener('form-prato', 'submit', (e) => this.savePrato(e));
        addSafeEventListener('tblPratos', 'click', (e) => this.handlePratoTableClick(e));
        
        // Componentes (Ficha Técnica)
        addSafeEventListener('cp-prato', 'change', (e) => this.loadComponentes(e.target.value));
        addSafeEventListener('btnAddPrComp', 'click', () => this.addComponente());
        addSafeEventListener('tblPrComp', 'click', (e) => this.removeComponente(e));

        this.loadPratos();
    },

    updateComponenteDropdowns() {
        fillOptionsFrom('receitas', 'cp-receita', 'id', 'nome', {ativo: true});
    },

    // --- PRATOS ---
    async loadPratos() {
        const tb = $('tblPratos')?.querySelector('tbody'); if (!tb) return;
        tb.innerHTML = '<tr><td colspan="6">Carregando pratos…</td></tr>';
        try {
            // Usando 'count' para contar as receitas associadas
            const { data, error } = await supa.from('pratos')
                .select('*, categoria:categorias(nome), prato_receitas(count)')
                .order('nome', { ascending: true });
            if (error) throw error;
            tb.innerHTML = '';
            (data || []).forEach(p => {
                const receitasCount = p.prato_receitas.length > 0 ? p.prato_receitas[0].count : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${p.nome}</td>
                                <td>${p.categoria ? p.categoria.nome : '—'}</td>
                                <td>${fmtMoney(p.preco_venda)}</td>
                                <td>${receitasCount}</td>
                                <td>${p.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>'}</td>
                                <td class="row-actions">
                                    <button class="btn small" data-act="edit" data-id="${p.id}">Editar</button>
                                    <button class="btn small" data-act="toggle" data-id="${p.id}">${p.ativo ? 'Desativar' : 'Ativar'}</button>
                                </td>`;
                tb.appendChild(tr);
            });
            // Atualiza o dropdown na aba Componentes
            fillOptionsFrom('pratos', 'cp-prato', 'id', 'nome', {ativo: true});
        } catch (e) {
            console.error("Erro ao carregar pratos:", e);
            tb.innerHTML = '<tr><td colspan="6">Erro ao carregar.</td></tr>';
        }
    },

    showPratoForm(data = null) {
        const form = $('form-prato');
        form.reset();
        $('prato-form-title').textContent = data ? 'Editar Prato' : 'Novo Prato';

        if (data) {
             // Preenche o formulário usando os nomes dos inputs definidos no HTML
            form.elements['id'].value = data.id;
            form.elements['nome'].value = data.nome;
            form.elements['categoria_id'].value = data.categoria_id;
            form.elements['peso_volume'].value = data.peso_volume;
            form.elements['unidade_peso_volume'].value = data.unidade_peso_volume;
            form.elements['preco_venda'].value = data.preco_venda;
            $('prato-custo').value = fmtMoney(data.custo_calculado);
            form.elements['descricao'].value = data.descricao;
        } else {
            $('prato-custo').value = 'R$ 0,00';
        }
        showEditor('prato-editor-container');
    },

    async savePrato(e) {
        e.preventDefault();
        const data = getFormData('form-prato');
        const id = data.id;
        delete data.id;

        setStatus('Salvando prato...');
        try {
            let query;
            if (id) {
                query = supa.from('pratos').update(data).eq('id', id);
            } else {
                query = supa.from('pratos').insert([data]);
            }
            const { error } = await query;
            if (error) throw error;

            setStatus('Prato salvo com sucesso!', 'ok');
            hideEditor('prato-editor-container');
            this.loadPratos();
        } catch (err) {
            console.error("Erro ao salvar prato:", err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },

    handlePratoTableClick(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.act;
        const id = btn.dataset.id;

        if (action === 'toggle') {
            GenericCRUD.toggle('pratos', id, () => this.loadPratos());
        } else if (action === 'edit') {
            supa.from('pratos').select('*').eq('id', id).single().then(({data, error}) => {
                if (error) {
                    setStatus(`Erro ao carregar dados: ${error.message}`, 'err');
                } else {
                    this.showPratoForm(data);
                }
            });
        }
    },

    // --- COMPONENTES (Ficha Técnica do Prato) ---
    async loadComponentes(pratoId) {
        const editor = $('componentes-editor');
        const tb = $('tblPrComp')?.querySelector('tbody');
        if (!tb) return;

        if (!pratoId) {
            editor.style.display = 'none';
            return;
        }
        
        editor.style.display = 'block';
        tb.innerHTML = '<tr><td colspan="4">Carregando componentes...</td></tr>';
        
        // Garante que os dropdowns estejam carregados
        this.updateComponenteDropdowns();

        try {
            const { data, error } = await supa.from('prato_receitas')
                .select('*, receita:receitas(nome)')
                .eq('prato_id', pratoId);
            if (error) throw error;
            
            tb.innerHTML = '';
            (data || []).forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.receita ? item.receita.nome : 'Erro'}</td>
                                <td>${fmt(item.quantidade)}</td>
                                <td>${item.unidade}</td>
                                <td><button class="btn small" data-act="remove" data-id="${item.id}">Remover</button></td>`;
                tb.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar componentes:", e);
            tb.innerHTML = '<tr><td colspan="4">Erro ao carregar.</td></tr>';
        }
    },

    async addComponente() {
        const pratoId = $('cp-prato').value;
        const receitaId = $('cp-receita').value;
        const qtd = parseFloat($('cp-qtd').value);
        const und = $('cp-und').value;

        if (!pratoId || !receitaId || !qtd || qtd <= 0 || !und) {
            alert("Preencha todos os campos para adicionar o componente.");
            return;
        }

        setStatus('Adicionando componente...');
        try {
            const { error } = await supa.from('prato_receitas').insert([{
                prato_id: pratoId,
                receita_id: receitaId,
                quantidade: qtd,
                unidade: und
            }]);
            if (error) throw error;

            setStatus('Componente adicionado!', 'ok');
            $('cp-qtd').value = '';
            this.loadComponentes(pratoId);
            this.loadPratos(); // Atualiza a contagem na tabela de pratos
        } catch (err) {
            console.error("Erro ao adicionar componente:", err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },

    async removeComponente(e) {
        const btn = e.target.closest('button');
        if (!btn || btn.dataset.act !== 'remove') return;
        const id = btn.dataset.id;
        const pratoId = $('cp-prato').value;

        if (!confirm("Tem certeza que deseja remover este componente?")) return;

        setStatus('Removendo componente...');
        try {
            const { error } = await supa.from('prato_receitas').delete().eq('id', id);
            if (error) throw error;
            
            setStatus('Componente removido.', 'ok');
            this.loadComponentes(pratoId);
            this.loadPratos();
        } catch (err) {
            console.error("Erro ao remover componente:", err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    }
};

/* ===== MÓDULO DE PRODUÇÃO (Cálculo de Previsão) ===== */
const ProducaoModule = {
    init() {
        addSafeEventListener('btnCalcularPrev', 'click', () => this.calcularPrevisao());
    },

    async calcularPrevisao() {
        const diasAnalise = parseInt($('win-dias').value);
        const diasProjecao = parseInt($('proj-dias').value);
        const categoriasSelect = $('cat-filter');
        // Coleta as categorias selecionadas no filtro múltiplo
        const categoriasIds = Array.from(categoriasSelect.selectedOptions).map(opt => opt.value);

        if (!diasAnalise || !diasProjecao) {
            alert("Preencha os dias de análise e projeção.");
            return;
        }

        setStatus('Calculando previsão (Isso pode levar alguns segundos)...');
        $('kpi-dias').textContent = diasAnalise;
        // Atualiza os cabeçalhos das tabelas com os dias de projeção
        if ($('th-proj-prato')) $('th-proj-prato').textContent = `Projeção (${diasProjecao}d)`;
        if ($('th-proj')) $('th-proj').textContent = `Qtd/Projeção (${diasProjecao}d)`;

        const tbPratos = $('tblResumoPratos')?.querySelector('tbody');
        const tbReceitas = $('tblPrev')?.querySelector('tbody');
        tbPratos.innerHTML = '<tr><td colspan="4">Calculando...</td></tr>';
        tbReceitas.innerHTML = '<tr><td colspan="4">Calculando...</td></tr>';

        try {
            // Chama a função RPC 'calcular_previsao_producao' definida no SQL
            const params = {
                p_dias_analise: diasAnalise,
                p_dias_projecao: diasProjecao,
                p_categorias_ids: categoriasIds.length > 0 ? categoriasIds : null
            };
            
            const { data, error } = await supa.rpc('calcular_previsao_producao', params);
            if (error) throw error;

            if (!data || data.length === 0) {
                tbPratos.innerHTML = '<tr><td colspan="4">Nenhuma venda encontrada no período ou os pratos vendidos não estão cadastrados no sistema de gestão.</td></tr>';
                tbReceitas.innerHTML = '<tr><td colspan="4">Nenhuma receita necessária.</td></tr>';
                $('kpi-pratos').textContent = 0;
                $('kpi-rec').textContent = 0;
                setStatus('Cálculo concluído, mas sem dados de vendas.', 'warn');
                return;
            }

            // Processa os resultados retornados pela RPC
            const pratosMap = new Map();
            const receitasConsolidadas = new Map();

            data.forEach(item => {
                // 1. Agrega dados dos pratos
                if (!pratosMap.has(item.prato_id)) {
                    pratosMap.set(item.prato_id, {
                        nome: item.prato_nome,
                        categoria: item.categoria_nome,
                        media_dia: item.media_vendas_dia,
                        projecao: item.projecao_pratos
                    });
                }

                // 2. Consolida dados das receitas (soma as necessidades de diferentes pratos)
                const key = item.receita_id;
                if (!receitasConsolidadas.has(key)) {
                    receitasConsolidadas.set(key, {
                        nome: item.receita_nome,
                        unidade: item.receita_unidade,
                        qtd_dia: 0,
                        qtd_projecao: 0
                    });
                }
                const rec = receitasConsolidadas.get(key);
                rec.qtd_dia += parseFloat(item.qtd_receita_dia);
                rec.qtd_projecao += parseFloat(item.qtd_receita_projecao);
            });

            // Renderiza Tabela Pratos
            tbPratos.innerHTML = '';
            pratosMap.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${p.nome}</td>
                                <td>${p.categoria || '—'}</td>
                                <td>${fmt(p.media_dia, 1)}</td>
                                <td>${fmt(p.projecao, 1)}</td>`;
                tbPratos.appendChild(tr);
            });

            // Renderiza Tabela Receitas
            tbReceitas.innerHTML = '';
            // Ordena por quantidade de projeção descendente
            const sortedReceitas = Array.from(receitasConsolidadas.values()).sort((a, b) => b.qtd_projecao - a.qtd_projecao);
            sortedReceitas.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${r.nome}</td>
                                <td>${r.unidade}</td>
                                <td>${fmt(r.qtd_dia, 2)}</td>
                                <td>${fmt(r.qtd_projecao, 2)}</td>`;
                tbReceitas.appendChild(tr);
            });

            $('kpi-pratos').textContent = pratosMap.size;
            $('kpi-rec').textContent = receitasConsolidadas.size;
            setStatus('Previsão calculada com sucesso!', 'ok');

        } catch (err) {
            console.error("Erro ao calcular previsão:", err);
            tbPratos.innerHTML = '<tr><td colspan="4">Erro no cálculo. Verifique o console e a função RPC.</td></tr>';
            tbReceitas.innerHTML = '<tr><td colspan="4">Erro no cálculo.</td></tr>';
            setStatus(`Erro ao calcular previsão: ${err.message}`, 'err');
        }
    }
};

/* ===== MÓDULO DE ESTOQUE ===== */
const EstoqueModule = {
    init() {
        // Visão Geral
        this.loadSaldos();
        this.loadLotes();

        // Movimentação
        $$('.mov-actions .btn').forEach(btn => btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.movType.toUpperCase();
            this.setupMovForm(type);
        }));
        addSafeEventListener('btnMovCancel', 'click', () => hideEditor('mov-form-container'));
        addSafeEventListener('frmMov', 'submit', (e) => this.handleMovimentacao(e));
        addSafeEventListener('mov-item-tipo', 'change', () => this.updateMovItemDropdown());
        
        this.updateMovItemDropdown();
        this.loadMovRecentes();

        // Histórico
        this.loadHistorico();
    },

    // --- Visão Geral ---
    async loadSaldos() {
       const tbody = $('tblSaldo')?.querySelector('tbody'); if (!tbody) return;
       tbody.innerHTML = '<tr><td colspan="6">Carregando saldos...</td></tr>';
       try {
           // Usa a VIEW 'estoque_saldo' criada no SQL
           const { data, error } = await supa.from('estoque_saldo').select('*').order('item_nome');
           if (error) throw error;
           tbody.innerHTML = '';
           if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="6">Nenhum saldo encontrado.</td></tr>'; return; }
           
           data.forEach(item => {
               // Lógica de Status baseada em Estoque Mínimo (apenas para ingredientes)
               let status = '<span class="pill ok">OK</span>';
               if (item.item_tipo === 'INGREDIENTE') {
                    if (item.estoque_min > 0 && item.saldo_total <= item.estoque_min) {
                        status = '<span class="pill bad">Abaixo Mín.</span>';
                    } else if (item.estoque_max > 0 && item.saldo_total > item.estoque_max) {
                        status = '<span class="pill warn">Acima Máx.</span>';
                    }
               }

               const tr = document.createElement('tr');
               tr.innerHTML = `<td>${item.item_nome}</td>
                               <td>${item.item_tipo}</td>
                               <td>${item.unidade_nome}</td>
                               <td>${fmt(item.saldo_total)}</td>
                               <td>${item.unidade_medida_sigla || 'N/D'}</td>
                               <td>${status}</td>`;
               tbody.appendChild(tr);
           });
       } catch(e) {
           tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar saldos.</td></tr>`;
           console.error("Erro em loadSaldos:", e);
       }
    },

    async loadLotes() {
        const tbody = $('tblSaldoLotes')?.querySelector('tbody'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6">Carregando lotes...</td></tr>';
        try {
            // Carrega lotes com saldo positivo
            const { data, error } = await supa.from('estoque_lotes').select('*, unidade:unidades(nome)').gt('saldo', 0.001).order('validade', { ascending: true });
            if (error) throw error;

            // Precisamos buscar os nomes dos itens (Ingredientes e Receitas)
            const ingIds = data.filter(i => i.item_tipo === 'INGREDIENTE').map(i => i.item_id);
            const recIds = data.filter(i => i.item_tipo === 'RECEITA').map(i => i.item_id);
            
            const [ingNomes, recNomes] = await Promise.all([
                ingIds.length > 0 ? supa.from('ingredientes').select('id, nome').in('id', ingIds) : Promise.resolve({data: []}),
                recIds.length > 0 ? supa.from('receitas').select('id, nome').in('id', recIds) : Promise.resolve({data: []})
            ]);

            const nomesMap = new Map();
            (ingNomes.data || []).forEach(i => nomesMap.set(i.id, i.nome));
            (recNomes.data || []).forEach(r => nomesMap.set(r.id, r.nome));

            tbody.innerHTML = '';
            data.forEach(item => {
                const nome = nomesMap.get(item.item_id) || 'Desconhecido';
                // Formatação da data de validade
                const validade = item.validade ? new Date(item.validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${nome}</td>
                                <td>${item.unidade.nome}</td>
                                <td>${item.lote}</td>
                                <td>${validade}</td>
                                <td>${fmt(item.saldo)}</td>
                                <td>${fmtMoney(item.custo_unitario)}</td>`;
                tbody.appendChild(tr);
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar lotes.</td></tr>`;
        }
    },

    // --- Movimentação ---
    async updateMovItemDropdown() {
        const tipo = $('mov-item-tipo').value;
        const table = tipo === 'INGREDIENTE' ? 'ingredientes' : 'receitas';
        fillOptionsFrom(table, 'mov-item', 'id', 'nome', {ativo: true});
    },

    setupMovForm(type) {
        const container = $('mov-form-container'); const form = $('frmMov');
        form.reset(); container.style.display = 'block'; form.dataset.movType = type;
        $('mov-form-title').textContent = `Registrar ${type}`;
        
        const show = (elId, visible) => { const group = $(elId); if (group) group.style.display = visible ? 'block' : 'none'; };

        // Lógica de visibilidade dos campos baseada no tipo de movimento
        show('mov-unidade-origem-group', type === 'SAIDA');
        show('mov-unidade-destino-group', type === 'ENTRADA');
        show('mov-lote-group', type === 'ENTRADA');
        show('mov-validade-group', type === 'ENTRADA');
        show('mov-custo-group', type === 'ENTRADA');
        
        // Define lote padrão para ENTRADA (Simplificação adotada)
        if (type === 'ENTRADA') {
            $('mov-lote').value = 'PADRAO';
        }
        // Garante que o dropdown de itens esteja atualizado
        this.updateMovItemDropdown();
    },

    async handleMovimentacao(e) {
        e.preventDefault();
        const form = e.target;
        const tipoMov = form.dataset.movType;
        const itemId = $('mov-item').value;
        const itemTipo = $('mov-item-tipo').value;
        const qtd = parseFloat($('mov-qtd').value);

        if (!itemId || !qtd || qtd <= 0) {
            alert("Item e Quantidade são obrigatórios.");
            return;
        }

        setStatus('Registrando movimentação...');
        try {
            let payload = {};
            let rpcName = '';

            if (tipoMov === 'ENTRADA') {
                rpcName = 'rpc_entrada';
                payload = {
                    p_item_id: itemId,
                    p_item_tipo: itemTipo,
                    p_unidade_destino_id: $('mov-unidade-destino').value,
                    p_quantidade: qtd,
                    p_lote: $('mov-lote').value || 'PADRAO',
                    p_validade: $('mov-validade').value || null,
                    p_custo_unitario: parseFloat($('mov-custo').value) || 0,
                    p_documento: $('mov-doc').value
                };
                if (!payload.p_unidade_destino_id) throw new Error("Unidade Destino é obrigatória.");

            } else if (tipoMov === 'SAIDA') {
                rpcName = 'rpc_saida';
                payload = {
                    p_item_id: itemId,
                    p_item_tipo: itemTipo,
                    p_unidade_origem_id: $('mov-unidade-origem').value,
                    p_quantidade: qtd,
                    p_documento: $('mov-doc').value
                };
                 if (!payload.p_unidade_origem_id) throw new Error("Unidade Origem é obrigatória.");
            } 

            // Chama a função RPC definida no SQL
            const { error } = await supa.rpc(rpcName, payload);
            if (error) throw error;

            setStatus('Movimentação registrada com sucesso!', 'ok');
            hideEditor('mov-form-container');
            // Atualiza todas as visualizações de estoque
            this.refreshAllStockData();
        } catch(ex) {
            console.error('Erro na movimentação:', ex);
            setStatus('Erro: ' + (ex.message || 'Verifique os dados'), 'err');
        }
    },

    refreshAllStockData() {
        this.loadSaldos();
        this.loadLotes();
        this.loadMovRecentes();
        this.loadHistorico();
        ComprasModule.loadSugestoes(); // Atualiza sugestões de compra
    },

    // Carrega as últimas 20 movimentações na aba Movimentar
    async loadMovRecentes() {
        const tbody = $('tblMovRecentes')?.querySelector('tbody'); if (!tbody) return;
        try {
            const { data, error } = await supa.from('estoque_movimentos')
                .select('*, unidade_origem:unidades!estoque_movimentos_unidade_origem_id_fkey(nome), unidade_destino:unidades!estoque_movimentos_unidade_destino_id_fkey(nome)')
                .order('ts', { ascending: false }).limit(20);
            if (error) throw error;

             // Busca nomes dos itens
            const ingIds = data.filter(i => i.item_tipo === 'INGREDIENTE').map(i => i.item_id);
            const recIds = data.filter(i => i.item_tipo === 'RECEITA').map(i => i.item_id);
            const [ingNomes, recNomes] = await Promise.all([
                ingIds.length > 0 ? supa.from('ingredientes').select('id, nome').in('id', ingIds) : Promise.resolve({data: []}),
                recIds.length > 0 ? supa.from('receitas').select('id, nome').in('id', recIds) : Promise.resolve({data: []})
            ]);
            const nomesMap = new Map();
            (ingNomes.data || []).forEach(i => nomesMap.set(i.id, i.nome));
            (recNomes.data || []).forEach(r => nomesMap.set(r.id, r.nome));

            tbody.innerHTML = '';
            data.forEach(mov => {
                const nome = nomesMap.get(mov.item_id) || 'Desconhecido';
                const local = mov.tipo === 'ENTRADA' ? mov.unidade_destino?.nome : mov.unidade_origem?.nome;
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${new Date(mov.ts).toLocaleString('pt-BR')}</td>
                                <td>${mov.tipo}</td>
                                <td>${nome}</td>
                                <td>${fmt(mov.quantidade)}</td>
                                <td>${local || '—'}</td>`;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar movimentos recentes:", e);
        }
    },
    
    // --- Histórico (Aba separada) ---
    async loadHistorico() {
         const tbody = $('tblEstoqueHist')?.querySelector('tbody'); if (!tbody) return;
        // Implementação básica do histórico completo (limitado a 500 registros)
        try {
            const { data, error } = await supa.from('estoque_movimentos')
                .select('*, unidade_origem:unidades!estoque_movimentos_unidade_origem_id_fkey(nome), unidade_destino:unidades!estoque_movimentos_unidade_destino_id_fkey(nome)')
                .order('ts', { ascending: false }).limit(500);
            if (error) throw error;

             // Busca nomes dos itens
            const ingIds = data.filter(i => i.item_tipo === 'INGREDIENTE').map(i => i.item_id);
            const recIds = data.filter(i => i.item_tipo === 'RECEITA').map(i => i.item_id);
            const [ingNomes, recNomes] = await Promise.all([
                ingIds.length > 0 ? supa.from('ingredientes').select('id, nome').in('id', ingIds) : Promise.resolve({data: []}),
                recIds.length > 0 ? supa.from('receitas').select('id, nome').in('id', recIds) : Promise.resolve({data: []})
            ]);
            const nomesMap = new Map();
            (ingNomes.data || []).forEach(i => nomesMap.set(i.id, i.nome));
            (recNomes.data || []).forEach(r => nomesMap.set(r.id, r.nome));

            tbody.innerHTML = '';
            data.forEach(mov => {
                const nome = nomesMap.get(mov.item_id) || 'Desconhecido';
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${new Date(mov.ts).toLocaleString('pt-BR')}</td>
                                <td>${mov.tipo}</td>
                                <td>${nome}</td>
                                <td>${mov.item_tipo}</td>
                                <td>${fmt(mov.quantidade)}</td>
                                <td>${mov.unidade_origem?.nome || '—'}</td>
                                <td>${mov.unidade_destino?.nome || '—'}</td>
                                <td>${mov.documento || '—'}</td>`;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar histórico:", e);
        }
    }
};

/* ===== MÓDULO DE COMPRAS ===== */
const ComprasModule = {
    init() {
        addSafeEventListener('btnRefreshSuggestions', 'click', () => this.loadSugestoes());
        // Carregamento inicial ocorre após o EstoqueModule.init()
    },
    
    // Carrega sugestões baseadas apenas no Estoque Mínimo
    async loadSugestoes() {
        const tbody = $('tblSugestoes')?.querySelector('tbody'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6">Calculando sugestões de compra...</td></tr>';

        try {
            // Usamos a view 'estoque_saldo' para verificar o estoque mínimo apenas para INGREDIENTES
            const { data, error } = await supa.from('estoque_saldo')
                .select('*')
                .eq('item_tipo', 'INGREDIENTE')
                .gt('estoque_min', 0); // Apenas itens com estoque mínimo definido

            if (error) throw error;

            tbody.innerHTML = '';
            let count = 0;
            // Filtra os itens onde o saldo atual é menor que o mínimo
            data.filter(item => item.saldo_total < item.estoque_min).forEach(item => {
                count++;
                // Sugestão simples: comprar a diferença para atingir o mínimo
                const sugestao = item.estoque_min - item.saldo_total;
                const status = '<span class="pill bad">Abaixo Mín.</span>';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.item_nome}</td>
                                <td>${status}</td>
                                <td>${fmt(item.saldo_total)}</td>
                                <td>${fmt(item.estoque_min)}</td>
                                <td>${fmt(sugestao)}</td>
                                <td>${item.unidade_medida_sigla}</td>`;
                tbody.appendChild(tr);
            });

            if (count === 0) {
                tbody.innerHTML = '<tr><td colspan="6">Nenhuma sugestão de compra no momento (todos os itens acima do mínimo).</td></tr>';
            }

        } catch (e) {
            console.error("Erro ao carregar sugestões de compra:", e);
            tbody.innerHTML = '<tr><td colspan="6">Erro ao calcular sugestões.</td></tr>';
        }
    }
};


/* ===== INICIALIZAÇÃO ===== */
async function init(){
  try{
    // Verifica se as credenciais foram inseridas
    if (!supa || SUPABASE_URL === 'SUA_URL_AQUI' || SUPABASE_ANON === 'SUA_CHAVE_ANON_AQUI') {
      throw new Error("As credenciais do Supabase não foram configuradas no arquivo estoque_app.js.");
    }
    setStatus('Inicializando módulos...');
    setupRouting();
    
    // Inicializa módulos na ordem de dependência
    AuxiliaresModule.init();
    IngredientesModule.init();
    ReceitasModule.init();
    PratosModule.init();
    ProducaoModule.init();
    EstoqueModule.init();
    ComprasModule.init(); // Depende dos dados de estoque
    
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
