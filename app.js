
// =================================================================================
// SCRIPT COMPLETO E INTEGRAL (v6.2 - Correção da Colisão do ID do Formulário)
// =================================================================================

// ESTA LINHA É CRUCIAL PARA VERIFICAR O CACHE
console.log("[DIAGNOSTICO v6.2] Script Iniciado. Se você vê esta mensagem, o script correto está ativo.");


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

// Função REFORMULADA (v6.2): Iteração direta sobre form.elements.
const getFormData = (formId) => {
    // Confirmação de que o formId é uma string
    if (typeof formId !== 'string') {
         console.error(`[DIAGNOSTICO v6.2] Erro: ID do formulário inválido fornecido:`, formId);
         return {};
    }

    const form = $(formId);
    if (!form) {
        console.error(`[DIAGNOSTICO v6.2] Formulário não encontrado. ID fornecido:`, formId);
        return {};
    }
    const obj = {};

    // Diagnóstico
    console.log(`[DIAGNOSTICO v6.2] Coletando dados do formulário: ${formId}`);

    // Itera diretamente sobre todos os elementos do formulário
    for (let element of form.elements) {
        // Ignora elementos sem nome, botões de submit/button, reset e fieldsets
        if (!element.name || ['submit', 'button', 'fieldset', 'reset'].includes(element.type)) {
            continue;
        }

        // Diagnóstico
        console.log(`[DIAGNOSTICO] Processando: Name=${element.name}, Type=${element.type}, Value=${element.value}`);

        if (element.type === 'checkbox') {
            obj[element.name] = element.checked;
        } else if (element.type === 'number' || element.dataset.type === 'number') {
            // Tratamento de Números
            if (element.value === "" || element.value === null) {
                obj[element.name] = null;
            } else {
                const numVal = parseFloat(element.value);
                obj[element.name] = isNaN(numVal) ? null : numVal;
            }
        } else if (element.type === 'radio') {
            // Tratamento de Radio Buttons (só inclui se estiver marcado)
            if (element.checked) {
                obj[element.name] = element.value;
            }
        } else {
            // Tratamento padrão (text, select-one, textarea, date, hidden, etc.)
            obj[element.name] = element.value;
        }
    }

    // Tratamento do ID (Remove se estiver vazio para permitir INSERTs)
    if (obj.hasOwnProperty('id')) {
         if (obj.id === "" || obj.id === null) {
             delete obj.id;
         }
    }

    // Diagnóstico
    console.log("[DIAGNOSTICO] Objeto Final Coletado:", obj);
    return obj;
};


/* ===================== CONFIGURAÇÃO DA API ===================== */
const SUPABASE_URL  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
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
    console.error("ERRO CRÍTICO: SUPABASE_URL inválida ou não configurada em app.js!");
}


// Listener seguro
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
            const { data, error } = await supa.from(source).select('*').order(orderCol, { ascending: ascending }).limit(500);
            if (error) throw error;
            tb.innerHTML = '';
            if ((data || []).length === 0) {
                tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>`;
            }

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
                    const toggleBtn = item.hasOwnProperty('ativo') ? `<button class="btn small" data-act="toggle" data-id="${item.id}">${item.ativo ? 'Desativar' : 'Ativar'}</button>` : '';
                    tdActions.innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button>
                                           ${toggleBtn}`;
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
             // Preenche o formulário com os dados existentes (Edição)
            Object.keys(data).forEach(key => {
                const input = form.elements[key];
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = data[key];
                    } else {
                        // Evita definir o valor como 'null' ou 'undefined' em campos de texto
                        input.value = data[key] || '';
                    }
                }
            });
             // Garante que o ID seja preenchido no campo hidden se existir
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = data.id || '';

        } else {
            // Limpa o ID ao criar novo registro
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = '';

            // Ao criar novo, garante que o checkbox 'ativo' esteja marcado se existir no form
            if (form.elements['ativo'] && form.elements['ativo'].type === 'checkbox') {
                form.elements['ativo'].checked = true;
            }
        }
        showEditor(editorId);
    },

    // Função SAVE (CORRIGIDA v6.2)
    async save(e, table, editorId, refreshCallback) {
        e.preventDefault();
        const form = e.target;

        // 1. Use native browser validation
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
            setStatus('Por favor, preencha todos os campos obrigatórios.', 'err');
            if (typeof form.reportValidity === 'function') {
                form.reportValidity();
            }
            return;
        }

        // 2. Collect data using the robust getFormData
        // CORREÇÃO v6.2: Usar getAttribute('id') para evitar colisão com inputs chamados 'id'.
        // O e.target é o próprio formulário, mas acessar e.target.id pode retornar um input filho.
        const formId = e.target.getAttribute('id');
        const data = getFormData(formId);

        const id = data.id;

        if (id) {
             delete data.id;
        }

        // 3. Manual validation
        if (table === 'unidades_medida' && (!data.sigla || String(data.sigla).trim() === '')) {
            setStatus('O campo Sigla é obrigatório.', 'err');
            return;
        }

        setStatus(`Salvando...`);
        try {
            let query;
            if (id) {
                // UPDATE path
                query = supa.from(table).update(data).eq('id', id);
            } else {
                // INSERT path
                if (!data.hasOwnProperty('ativo') && (table !== 'movimentacoes')) {
                    // Verifica se o elemento 'ativo' realmente existe no formulário antes de definir padrão
                    if (form.elements['ativo']) {
                         data.ativo = true;
                    }
                }
                query = supa.from(table).insert([data]);
            }
            const { error } = await query;
            if (error) throw error;

            // Atualizado para v6.2
            setStatus(`Registro salvo com sucesso! (v6.2)`, 'ok');
            hideEditor(editorId);
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao salvar ${table}:`, err);
            if (err.code === '23505') {
                setStatus(`Erro: Registro duplicado (violação de unicidade).`, 'err');
            } else {
                // Exibe o erro detalhado do banco de dados
                setStatus(`Erro no Banco de Dados: ${err.message} (Code: ${err.code})`, 'err');
            }
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

/* ===== MÓDULOS RESTANTES (Inalterados Funcionalmente) ===== */

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

    refreshCategoriasDropdowns(forceReload = false) {
        fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', {tipo: 'INGREDIENTE', ativo: true});
        fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', {tipo: 'PRATO', ativo: true});

        const catFilter = $('cat-filter');
        if (catFilter && (catFilter.options.length <= 1 || forceReload)) {
            if (typeof supa !== 'undefined' && supa.from) {
                const defaultOptionText = catFilter.options[0]?.text || 'Todas as Categorias';
                catFilter.innerHTML = `<option value="">${defaultOptionText}</option>`;
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
            // Evitar chamar loadSugestoes aqui para performance, melhor chamar após movimentação de estoque.
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
};

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
        if ($('rec-id')) $('rec-id').value = '';
        if ($('recipe-form-title')) $('recipe-form-title').textContent = id ? 'Editar Receita' : 'Nova Receita';

        if (id) {
            setStatus('Carregando receita para edição...');
            try {
                const { data: recData, error: recError } = await supa.from('receitas').select('*').eq('id', id).single();
                if (recError) throw recError;

                // Preenche o formulário principal
                Object.keys(recData).forEach(key => {
                    const input = form.elements[key];
                    if(input) {
                         if (input.type === 'checkbox') {
                            input.checked = recData[key];
                        } else {
                            input.value = recData[key] || '';
                        }
                    }
                });
                if ($('rec-id')) $('rec-id').value = id;

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
                return;
            }
        } else {
             // Garante que o checkbox 'ativo' esteja marcado ao criar novo, se existir no formulário
            if (form.elements['ativo'] && form.elements['ativo'].type === 'checkbox') {
                form.elements['ativo'].checked = true;
            }
        }

        this.renderDraftTable();
        this.updateDraftRefOptions();
        showEditor('recipe-editor-container');
    },

    async addDraftItem() {
        const tipoEl = $('draft-tipo');
        const refEl = $('draft-ref');
        const qtdEl = $('draft-qtd');
        const undEl = $('draft-und');

        if (!tipoEl || !refEl || !qtdEl || !undEl) return;

        const tipo = tipoEl.value;
        const refId = refEl.value;
        const qtd = parseFloat(qtdEl.value);
        const unidade = undEl.value;
        const refName = refEl.options[refEl.selectedIndex]?.text;

        if (!refId || !qtd || qtd <= 0 || !unidade) {
            setStatus('Preencha todos os campos do item corretamente.', 'err');
            return;
        }

        const exists = this.draftItems.some(item => item.tipo === tipo && item.referencia_id == refId);
        if (exists) {
            setStatus('Este item já foi adicionado à receita.', 'warn');
            return;
        }

        this.draftItems.push({
            tipo: tipo,
            referencia_id: refId,
            nome: refName,
            quantidade: qtd,
            unidade: unidade
        });

        this.renderDraftTable();
        qtdEl.value = '';
        refEl.value = '';
    },

    renderDraftTable() {
        const tbody = $('tblDraft')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.draftItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            // Ajustado para as colunas do app.html (Tipo, Nome, Qtd, UN, Ação)
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

    // Função saveRecipe ajustada para usar a validação nativa e o getFormData robusto
    async saveRecipe(e) {
        e.preventDefault();
        // Garante que estamos referenciando o formulário correto, mesmo se o evento vier de um botão externo (atributo form)
        const form = e.target.id === 'form-receita' ? e.target : $('form-receita');

         // 1. Validação Nativa
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
            setStatus('Por favor, preencha os campos obrigatórios da receita.', 'err');
            if (typeof form.reportValidity === 'function') {
                form.reportValidity();
            }
            return;
        }

        // 2. Coleta de Dados (CORREÇÃO v6.2 Aplicada indiretamente via getFormData)
        const recipeData = getFormData('form-receita');
        const id = recipeData.id;
        if (id) {
            delete recipeData.id;
        }

        // 3. Validação de Negócio
        if (this.draftItems.length === 0) {
            setStatus('Adicione pelo menos um item à receita antes de salvar.', 'err');
            return;
        }

        setStatus('Salvando receita...');
        try {
            // 4. Salvar/Atualizar o cabeçalho da receita
            let savedRecipe;
            if (id) {
                const { data, error } = await supa.from('receitas').update(recipeData).eq('id', id).select().single();
                if (error) throw error;
                savedRecipe = data;
                // Deleta os itens antigos para depois inserir os novos (simula REPLACE)
                await supa.from('receita_itens').delete().eq('receita_id', id);
            } else {
                // Garante que 'ativo' seja definido se não estiver presente (e se o campo existir no HTML)
                 if (!recipeData.hasOwnProperty('ativo') && form.elements['ativo']) {
                    recipeData.ativo = true;
                }
                const { data, error } = await supa.from('receitas').insert([recipeData]).select().single();
                if (error) throw error;
                savedRecipe = data;
            }

            // 5. Preparar e salvar os novos itens da receita
            const itemsToInsert = this.draftItems.map(item => ({
                receita_id: savedRecipe.id,
                tipo: item.tipo,
                referencia_id: item.referencia_id,
                quantidade: item.quantidade,
                unidade: item.unidade
            }));

            const { error: itemsError } = await supa.from('receita_itens').insert(itemsToInsert);
            if (itemsError) {
                // Rollback manual simplificado
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

        const refresh = () => {
            this.loadPratos();
            this.updatePratoComponentDropdowns();
        };

        addSafeEventListener('btnNovoPrato', 'click', () => {
            hideEditor('prato-import-container');
            GenericCRUD.showForm(editorId, formId, titleId, 'Novo Prato');
        });
        addSafeEventListener('btnCancelarPrato', 'click', () => hideEditor(editorId));
        addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));

        const tableEl = $(tableId);
        if (tableEl) {
             tableEl.addEventListener('click', (e) => {
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
        const columns = ['nome', 'categoria_nome', 'preco_venda', 'total_receitas', 'ativo'];
        GenericCRUD.loadTable('pratos', 'tblPratos', columns, true, 'vw_pratos_resumo');
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
        const pratoId = $('cp-prato')?.value;
        const receitaId = $('cp-receita')?.value;
        const quantidadeInput = $('cp-qtd');
        const quantidade = parseFloat(quantidadeInput?.value);

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
            this.loadComponentes(pratoId);
            this.loadPratos();
            if (quantidadeInput) quantidadeInput.value = 1;
        } catch (e) {
            console.error("Erro ao adicionar componente:", e);
            if (e.code === '23505') {
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
        const pratoId = $('cp-prato')?.value;

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

    // --- FUNÇÕES DE IMPORTAÇÃO ---

    setupImportEventListeners() {
        addSafeEventListener('btnImportarPratos', 'click', () => this.showImportUI());
        addSafeEventListener('btnCancelImport', 'click', () => hideEditor('prato-import-container'));
        addSafeEventListener('btnConfirmImport', 'click', () => this.confirmImport());
        addSafeEventListener('importCheckAll', 'click', (e) => {
            $$('#tblImportPratos tbody input[type="checkbox"]').forEach(chk => chk.checked = e.target.checked);
        });
    },

    async showImportUI() {
        hideEditor('prato-editor-container');
        showEditor('prato-import-container');

        const loader = $('import-loader');
        const tbody = $('#tblImportPratos tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (loader) loader.style.display = 'block';
        if ($('importCheckAll')) $('importCheckAll').checked = false;

        try {
            const { data, error } = await supa.rpc('get_unregistered_dishes');
            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Tudo certo! Todos os pratos vendidos já estão cadastrados no estoque.</td></tr>';
                if ($('btnConfirmImport')) $('btnConfirmImport').disabled = true;
            } else {
                if ($('btnConfirmImport')) $('btnConfirmImport').disabled = false;
                data.forEach(item => {
                    const tr = document.createElement('tr');
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
            if (e.code === '42883' || (e.message && e.message.includes('function get_unregistered_dishes'))) {
                 errorMessage = "Função 'get_unregistered_dishes' não encontrada.";
            }
            setStatus(`Erro ao buscar pratos: ${errorMessage}`, 'err');
            tbody.innerHTML = `<tr><td colspan="3">Erro ao carregar dados. Verifique o status e o console.</td></tr>`;
        } finally {
            if (loader) loader.style.display = 'none';
        }
    },

    async confirmImport() {
        const selectedItems = $$('#tblImportPratos tbody input[type="checkbox"]:checked');
        if (selectedItems.length === 0) {
            alert("Selecione pelo menos um prato para importar.");
            return;
        }

        setStatus('Iniciando importação...');

        const uniqueCategories = [...new Set(selectedItems.map(item => decodeURIComponent(item.dataset.cat)))].filter(Boolean);

        try {
            const { data: existingCats, error: catError } = await supa.from('categorias').select('id, nome').eq('tipo', 'PRATO');
            if (catError) throw catError;

            const catMap = new Map(existingCats.map(c => [c.nome.toLowerCase(), c.id]));

            const catsToCreate = uniqueCategories
                .filter(name => !catMap.has(name.toLowerCase()))
                .map(name => ({ nome: name, tipo: 'PRATO', ativo: true }));

            if (catsToCreate.length > 0) {
                setStatus(`Importando ${catsToCreate.length} novas categorias...`);
                const { data: insertedCats, error: newCatError } = await supa.from('categorias').insert(catsToCreate).select('id, nome');
                if (newCatError) throw newCatError;

                insertedCats.forEach(c => catMap.set(c.nome.toLowerCase(), c.id));
                AuxiliaresModule.refreshCategoriasDropdowns(true);
            }

            setStatus('Preparando pratos para inserção...');
            const newPratosToInsert = selectedItems.map(item => {
                const nome = decodeURIComponent(item.dataset.nome);
                const catName = decodeURIComponent(item.dataset.cat);
                const categoriaId = catName ? catMap.get(catName.toLowerCase()) : null;

                return {
                    nome: nome,
                    categoria_id: categoriaId,
                    ativo: true,
                    peso_volume: 0,
                    unidade_peso_volume: 'g',
                    preco_venda: 0
                };
            });

            if (newPratosToInsert.length > 0) {
                setStatus(`Importando ${newPratosToInsert.length} novos pratos...`);
                const { error: pratoError } = await supa.from('pratos').insert(newPratosToInsert);
                if (pratoError) throw pratoError;
                setStatus(`Importação concluída! ${newPratosToInsert.length} pratos adicionados.`, 'ok');
            }

            hideEditor('prato-import-container');
            this.loadPratos();
            this.updatePratoComponentDropdowns();

        } catch (e) {
            console.error("Erro na importação de pratos:", e);
            if (e.code === '23505') {
                setStatus(`Erro: Um ou mais pratos já existem. Tente novamente.`, 'err');
            } else {
                setStatus(`Erro na importação: ${e.message}`, 'err');
            }
        }
    }
};

const EstoqueModule = {
    init() {
        this.setupEventListeners();
        this.loadAllStockData();
        this.updateMovItemDropdown();
    },

    setupEventListeners() {
        addSafeEventListener('form-movimentacao', 'submit', (e) => this.registrarMovimentacao(e));
        addSafeEventListener('btnMovCancel', 'click', () => {
            const form = $('form-movimentacao');
            if (form) form.reset();
        });
    },

    loadAllStockData() {
        GenericCRUD.loadTable('vw_estoque_geral', 'tblEstoqueGeral', ['nome_item', 'quantidade_total', 'unidade_medida', 'custo_medio_formatado'], false);
        GenericCRUD.loadTable('vw_estoque_lotes', 'tblEstoqueLotes', ['nome_item', 'quantidade', 'unidade_medida', 'custo_unitario_formatado', 'data_validade', 'unidade_nome'], false);
        GenericCRUD.loadTable('vw_movimentacoes_historico', 'tblHistorico', ['data_hora', 'tipo', 'nome_item', 'quantidade_formatada', 'origem_destino', 'usuario', 'obs'], false);
    },

    async updateMovItemDropdown() {
        const sel = $('mov-item');
        if (!sel || sel.options.length > 1) return;

        sel.innerHTML = '<option value="">Carregando itens...</option>';

        try {
            const [{ data: ingData }, { data: recData }] = await Promise.all([
                supa.from('ingredientes').select('id, nome').eq('ativo', true).order('nome'),
                supa.from('receitas').select('id, nome').eq('ativo', true).order('nome')
            ]);

            sel.innerHTML = '<option value="">Selecione o Item</option>';

            const ingredientes = (ingData || []).map(i => ({ id: `ING:${i.id}`, name: i.nome, type: 'Ingrediente' }));
            const receitas = (recData || []).map(r => ({ id: `REC:${r.id}`, name: r.nome, type: 'Receita' }));
            const allItems = [...ingredientes, ...receitas].sort((a, b) => a.name.localeCompare(b.name));

             allItems.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = `${item.name} (${item.type})`;
                sel.appendChild(opt);
            });

        } catch (e) {
            console.error("Erro ao carregar itens para movimentação:", e);
            sel.innerHTML = '<option value="">(Erro ao carregar)</option>';
        }
    },

    // Função atualizada para usar validação nativa e getFormData robusto
    async registrarMovimentacao(e) {
        e.preventDefault();
        const form = e.target;

         // 1. Validação Nativa
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
            setStatus('Por favor, preencha todos os campos obrigatórios da movimentação.', 'err');
            if (typeof form.reportValidity === 'function') {
                form.reportValidity();
            }
            return;
        }

        // 2. Coleta de Dados (CORREÇÃO v6.2 Aplicada indiretamente via getFormData)
        const formData = getFormData('form-movimentacao');
        const itemValue = formData.item_id;

        // 3. Validação de Negócio
        if (!itemValue || !itemValue.includes(':')) {
            setStatus("Selecione um item válido.", 'err');
            return;
        }

        const [itemType, itemId] = itemValue.split(':');

        // Prepara o objeto de inserção (getFormData já trata números como null se vazios)
        const movData = {
            tipo: formData.tipo,
            quantidade: formData.quantidade,
            custo_unitario: formData.custo_unitario,
            // Campos de select/date devem ser explicitamente NULL se vazios (string vazia "")
            unidade_origem_id: formData.unidade_origem_id || null,
            unidade_destino_id: formData.unidade_destino_id || null,
            data_validade: formData.data_validade || null,
            obs: formData.obs,
            usuario: 'Sistema'
        };

        if (itemType === 'ING') {
            movData.ingrediente_id = itemId;
        } else if (itemType === 'REC') {
            movData.receita_id = itemId;
        }

        if (movData.tipo === 'TRANSFERENCIA' && movData.unidade_origem_id && movData.unidade_origem_id === movData.unidade_destino_id) {
            setStatus("A unidade de origem e destino não podem ser iguais em uma transferência.", 'err');
            return;
        }

        // 4. Envio ao Banco de Dados
        setStatus("Registrando movimentação...");
        try {
            const { error } = await supa.from('movimentacoes').insert([movData]);
            if (error) throw error;

            setStatus("Movimentação registrada com sucesso!", 'ok');
            if (form) form.reset();
            this.loadAllStockData();
            ComprasModule.loadSugestoes(true); // Atualiza sugestões após movimentação
        } catch (err) {
            console.error("Erro ao registrar movimentação:", err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    }
};

const ProducaoModule = {
    init() {
        this.setupEventListeners();
        this.setDefaultDates();
    },

    setupEventListeners() {
        addSafeEventListener('btnCalcularPrev', 'click', () => this.calcularPrevisao());
    },

    setDefaultDates() {
        const inicio = $('prev-data-inicio');
        const fim = $('prev-data-fim');

        if (inicio && fim && !inicio.value && !fim.value) {
            const hoje = new Date();
            const seteDiasAtras = new Date(hoje);
            seteDiasAtras.setDate(hoje.getDate() - 7);

            // Formata para YYYY-MM-DD compatível com input type="date"
            try {
                 const formatDate = (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };
                fim.value = formatDate(hoje);
                inicio.value = formatDate(seteDiasAtras);

            } catch (e) {
                console.warn("Não foi possível definir as datas padrão:", e);
            }
        }
    },

    async calcularPrevisao() {
        const dataInicio = $('prev-data-inicio')?.value;
        const dataFim = $('prev-data-fim')?.value;
        const categoriaId = $('cat-filter')?.value || null;

        if (!dataInicio || !dataFim) {
            setStatus("Selecione as datas de início e fim.", 'err');
            return;
        }

        if (new Date(dataInicio) > new Date(dataFim)) {
            setStatus("A data de início não pode ser posterior à data de fim.", 'err');
            return;
        }

        const tbody = $('tbl-previsao')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="3">Calculando previsão...</td></tr>';
        setStatus("Calculando previsão...");

        try {
            const { data, error } = await supa.rpc('calcular_previsao_venda', {
                p_data_inicio: dataInicio,
                p_data_fim: dataFim,
                p_categoria_id: categoriaId
            });

            if (error) throw error;

            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Nenhum dado de venda encontrado no período ou a tabela de vendas não existe.</td></tr>';
                setStatus("Previsão calculada (sem dados).", 'warn');
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
                setStatus("Previsão calculada.", 'ok');
            }

        } catch (e) {
            console.error("Erro ao calcular previsão:", e);
            let errorMessage = e.message;
             if (e.code === 'P0001') {
                 errorMessage = "Tabela de vendas não encontrada.";
             } else if (e.code === '42883') {
                 errorMessage = "Função de cálculo não encontrada no banco de dados.";
             }
            setStatus(`Erro: ${errorMessage}`, 'err');
            tbody.innerHTML = '<tr><td colspan="3">Erro ao calcular. Verifique o status.</td></tr>';
        }
    }
};

const ComprasModule = {
    init() {
        this.setupEventListeners();
        this.loadSugestoes();
    },

    setupEventListeners() {
        addSafeEventListener('btnRefreshSuggestions', 'click', () => this.loadSugestoes(true));
    },

    async loadSugestoes(force = false) {
        const tableId = 'tbl-sugestoes';
        const tb = $(tableId)?.querySelector('tbody');
        if (!tb) return;

        // Só carrega se forçado, se estiver vazio, ou se não estiver carregando
        if (tb.rows.length > 0 && !force && !tb.dataset.loading) return;

        tb.dataset.loading = true;
         // Só mostra o spinner se estiver forçando ou se a tabela estiver vazia/carregando
        if (force || tb.rows.length === 0 || (tb.rows.length === 1 && tb.rows[0].cells[0].textContent.includes('Carregando'))) {
             tb.innerHTML = `<tr><td colspan="5">Carregando sugestões…</td></tr>`;
        }


         try {
            const { data, error } = await supa.from('vw_sugestao_compras').select('*').order('sugestao_compra', { ascending: false });
            if (error) throw error;
            tb.innerHTML = '';

            if ((data || []).length === 0) {
                tb.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">Tudo certo! Nenhum item abaixo do ponto de pedido.</td></tr>`;
            } else {
                (data || []).forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.nome_ingrediente}</td>
                        <td>${fmt(item.estoque_atual)} ${item.unidade_medida}</td>
                        <td>${fmt(item.ponto_pedido)} ${item.unidade_medida}</td>
                        <td><strong>${fmt(item.sugestao_compra)} ${item.unidade_medida}</strong></td>
                        <td>${item.ultimo_fornecedor || '—'}</td>
                    `;
                    tb.appendChild(tr);
                });
            }
            if (force) setStatus('Sugestões de compra atualizadas.', 'ok');
        } catch (e) {
            console.error(`Erro ao carregar sugestões de compra:`, e);
            tb.innerHTML = `<tr><td colspan="5">Erro ao carregar sugestões.</td></tr>`;
        } finally {
            delete tb.dataset.loading;
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
        // Inicialização de todos os módulos
        AuxiliaresModule.init();
        IngredientesModule.init();
        ReceitasModule.init();
        PratosModule.init();
        EstoqueModule.init();
        ProducaoModule.init();
        ComprasModule.init();

        // Atualizado para v6.2
        setStatus("Aplicação carregada e pronta. (v6.2)", 'ok');
    } catch (e) {
        console.error("Erro durante a inicialização dos módulos:", e);
        setStatus("Erro na inicialização. Verifique o console.", 'err');
    }
});
